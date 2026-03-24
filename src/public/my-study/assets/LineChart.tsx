/* eslint-disable */
import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { StimulusParams } from '../../../store/types';

type LineChartParams = {
  dataFile: string;
  title: string;
  color?: string;
  thresholdLow?: number;
  thresholdHigh?: number;
  xLabel?: string;
  yLabel?: string;
};

const SVG_WIDTH = 1000;
const SVG_HEIGHT = 460;
const MARGIN = {
  top: 50,
  right: 30,
  bottom: 130,
  left: 70,
};

type Datum = { label: string; rawLabel: string; value: number };
type GlucoseUnit = 'mmol' | 'mg';
const MMOL_TO_MGDL = 18;
const GLUCOSE_UNIT_RESPONSE_ID = 'glucose-preferred-unit';

const labelKeys = ['Date Range', 'Date', 'Day', 'Hour', 'Hour Range', 'label', 'Date/Time'];

const getLabelKey = (row: d3.DSVRowString<string>) =>
  Object.keys(row).find((rowKey) => labelKeys.some(
    (candidate) => rowKey.replace(/^\uFEFF/, '').trim().toLowerCase()
      === candidate.trim().toLowerCase(),
  ))
  || Object.keys(row)[0]
  || 'label';

const getValueKey = (row: d3.DSVRowString<string>) =>
  Object.keys(row).find((rowKey) => (['Average Glucose level', 'value'] as const).some(
    (candidate) => rowKey.replace(/^\uFEFF/, '').trim().toLowerCase()
      === candidate.trim().toLowerCase(),
  ))
  || Object.keys(row)[1]
  || 'value';

const DAY_TO_ABBR: Record<string, string> = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun',
};

const ABBR_DAYS = Object.values(DAY_TO_ABBR);
const FULL_DAYS = Object.keys(DAY_TO_ABBR);
const SUNDAY_FIRST_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_COLOR_MAP: Record<string, string> = {
  Sun: '#CC79A7',
  Mon: '#E69F00',
  Tue: '#7A7A00',
  Wed: '#009E73',
  Thu: '#F0E442',
  Fri: '#0072B2',
  Sat: '#D55E00',
};

const toAbbrevDay = (label: string) =>
  label.replace(
    new RegExp(`^(${FULL_DAYS.join('|')})\\b`, 'i'),
    (matched) => DAY_TO_ABBR[matched.charAt(0).toUpperCase() + matched.slice(1).toLowerCase()] || matched,
  );

const addHoursToClock = (clock: string, deltaHours: number): string | null => {
  const match = clock.match(/^(1[0-2]|[1-9])(am|pm)$/i);
  if (!match) return null;
  const hour = Number(match[1]);
  const suffix = match[2].toLowerCase();
  const hour24 = (hour % 12) + (suffix === 'pm' ? 12 : 0);
  const next = (hour24 + deltaHours) % 24;
  const nextSuffix = next >= 12 ? 'pm' : 'am';
  const nextHour12 = next % 12 === 0 ? 12 : next % 12;
  return `${nextHour12}${nextSuffix}`;
};

const formatLabelForDataset = (rawLabel: string, dataFile: string): string => {
  const abbreviated = toAbbrevDay(rawLabel.trim());
  const parts = abbreviated.split(/\s+/);
  const day = parts[0];
  const time = parts[1];

  if (!ABBR_DAYS.includes(day) || !time) {
    return abbreviated;
  }

  if (dataFile.includes('glucose_002_points_per_day')) {
    const end = addHoursToClock(time, 12);
    return end ? `${day} ${time} - ${end}` : abbreviated;
  }

  if (dataFile.includes('glucose_004_points_per_day')) {
    const end = addHoursToClock(time, 6);
    return end ? `${day} ${time} - ${end}` : abbreviated;
  }

  return abbreviated;
};

const getDayName = (label: string): string | null => {
  const dayPattern = new RegExp(`^(${FULL_DAYS.join('|')}|${ABBR_DAYS.join('|')})\\b`, 'i');
  const match = label.match(dayPattern);
  if (!match) return null;
  const found = match[1];
  if (ABBR_DAYS.includes(found)) return found;
  return DAY_TO_ABBR[found.charAt(0).toUpperCase() + found.slice(1).toLowerCase()] || null;
};

const parseClockTo24Hour = (label: string): number => {
  const match = label.match(/\b(1[0-2]|[1-9])(am|pm)\b/i);
  if (!match) return -1;

  const hour12 = Number(match[1]);
  const suffix = match[2].toLowerCase();
  return (hour12 % 12) + (suffix === 'pm' ? 12 : 0);
};

const getPreferredUnitFromAnswers = (answers: StimulusParams<LineChartParams>['answers']): GlucoseUnit | null => {
  const unitAnswer = Object.values(answers).find((storedAnswer) => Object.hasOwn(storedAnswer.answer, GLUCOSE_UNIT_RESPONSE_ID))
    ?.answer?.[GLUCOSE_UNIT_RESPONSE_ID];

  if (typeof unitAnswer !== 'string') return null;
  const normalized = unitAnswer.toLowerCase();
  if (normalized.includes('mg')) return 'mg';
  if (normalized.includes('mmol')) return 'mmol';
  return null;
};

export default function LineChart({
  parameters,
  setAnswer,
  answers,
}: StimulusParams<LineChartParams>) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [data, setData] = useState<Datum[] | null>(null);
  const [unit, setUnit] = useState<GlucoseUnit>('mmol');

  const strokeColor = parameters.color || '#4c6ef5';

  useEffect(() => {
    let mounted = true;
    // helper to remove year (YYYY-) from date strings to declutter labels
    const cleanLabel = (s: string) => {
      const parts = s.split(' - ');
      const rmYear = (p: string) => p.replace(/^\d{4}-/, '');
      if (parts.length === 2) {
        return `${rmYear(parts[0])} – ${rmYear(parts[1])}`;
      }
      return s.replace(/^\d{4}-/, '');
    };

    d3.csv(parameters.dataFile).then((rows) => {
      if (!mounted) return;
      if (rows.length === 0) return;

      const labelKey = getLabelKey(rows[0]);
      const valueKey = getValueKey(rows[0]);
      const shouldCleanLabel = labelKey === 'Date Range';

      const parsed = rows
        .map((d) => {
          const raw = ((d[labelKey] as string) || '').trim();
          const formattedLabel = shouldCleanLabel
            ? cleanLabel(raw)
            : formatLabelForDataset(raw, parameters.dataFile);
          const rawValue = (d[valueKey] as string) || '';
          const valueMgdl = Number(rawValue);
          return {
            rawLabel: formattedLabel,
            label: formattedLabel,
            value: valueMgdl,
            hasValue: rawValue.trim() !== '',
          };
        })
        .filter((d) => d.label !== '' && d.hasValue && Number.isFinite(d.value))
        .map(({ hasValue: _hasValue, ...rest }) => rest);

      const withIndex = parsed.map((d, index) => ({ ...d, index }));
      const shouldSortSundayFirst = !parameters.dataFile.includes('first_2_weeks')
        && withIndex.length <= 168
        && withIndex.every((d) => getDayName(d.label) !== null);

      const finalData = shouldSortSundayFirst
        ? withIndex
          .sort((a, b) => {
            const aDay = getDayName(a.label) || 'Sun';
            const bDay = getDayName(b.label) || 'Sun';
            const dayDiff = SUNDAY_FIRST_DAYS.indexOf(aDay) - SUNDAY_FIRST_DAYS.indexOf(bDay);
            if (dayDiff !== 0) return dayDiff;

            const timeDiff = parseClockTo24Hour(a.label) - parseClockTo24Hour(b.label);
            if (timeDiff !== 0) return timeDiff;

            return a.index - b.index;
          })
          .map(({ index: _index, ...rest }) => rest)
        : withIndex.map(({ index: _index, ...rest }) => rest);

      const preferredUnit = getPreferredUnitFromAnswers(answers);
      const yLabel = (parameters.yLabel || '').toLowerCase();
      const hasMgHint = /\bmg\b|mg\/dl/.test(yLabel);
      const thresholdSuggestsMg = Math.max(parameters.thresholdLow ?? 0, parameters.thresholdHigh ?? 0) > 22;
      const valueSuggestsMg = (d3.max(finalData, (d) => d.value) ?? 0) > 22;
      const resolvedUnit: GlucoseUnit = preferredUnit || (hasMgHint || thresholdSuggestsMg || valueSuggestsMg ? 'mg' : 'mmol');
      const convertedData = resolvedUnit === 'mg'
        ? finalData.map((d) => ({ ...d, value: d.value * MMOL_TO_MGDL }))
        : finalData;

      setUnit(resolvedUnit);

      setData(convertedData);
    });
    return () => {
      mounted = false;
    };
  }, [parameters.dataFile, parameters.thresholdLow, parameters.thresholdHigh, parameters.yLabel, answers]);

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const low = unit === 'mg' ? 4 * MMOL_TO_MGDL : 4;
    const high = unit === 'mg' ? 8 * MMOL_TO_MGDL : 8;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = SVG_WIDTH - MARGIN.left - MARGIN.right;
    const height = SVG_HEIGHT - MARGIN.top - MARGIN.bottom;

    const root = svg
      .attr('viewBox', `0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`)
      .append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    const yUpperBound = unit === 'mg' ? 400 : 22;
    const y = d3
      .scaleLinear()
      .domain([0, yUpperBound])
      .range([height, 0]);

    const pointCount = data.length;
    const likelyPointsPerDay = Math.round(pointCount / 7);
    const hideDenseXAxisTickLabels = likelyPointsPerDay >= 6;
    const dayNamesInOrder = data
      .map((d) => getDayName(d.label))
      .filter((day): day is string => day !== null)
      .filter((day, index, arr) => arr.indexOf(day) === index);

    const useDayColors = dayNamesInOrder.length > 1;

    const getDatumColor = (datum: Datum) => {
      if (!useDayColors) return strokeColor;
      const day = getDayName(datum.label);
      return day ? DAY_COLOR_MAP[day] || strokeColor : strokeColor;
    };

    const getXPadding = () => {
      if (pointCount <= 7) return 1.2;
      if (pointCount <= 14) return 0.9;
      if (pointCount <= 42) return 0.65;
      return 0.4;
    };

    const x = d3
      .scalePoint<string>()
      .domain(data.map((d) => d.label))
      .range([0, width])
      .padding(getXPadding());

    const line = d3
      .line<Datum>()
      .x((d) => x(d.label) ?? 0)
      .y((d) => y(d.value));

    // Tooltip container (HTML) for interactive hover
    const container = d3.select(svgRef.current!.parentElement as HTMLElement);
    container.selectAll('.chart-tooltip').remove();
    const tooltip = container
      .append('div')
      .attr('class', 'chart-tooltip')
      .style('position', 'absolute')
      .style('pointer-events', 'none')
      .style('background', '#ffffff')
      .style('border', '1px solid #ccc')
      .style('border-radius', '4px')
      .style('padding', '6px 8px')
      .style('font', '12px Arial, sans-serif')
      .style('box-shadow', '0 2px 6px rgba(0,0,0,0.15)')
      .style('opacity', '0');

    // Threshold definitions
    const thresholds = [
      {
        value: low,
        label: 'Low threshold',
        color: '#2b8a3e',
        hover: '#2f9e44',
      },
      {
        value: high,
        label: 'High threshold',
        color: '#2b8a3e',
        hover: '#2f9e44',
      },
    ];

    // Interactive threshold lines with hit area
    thresholds.forEach(({
      value, label, color, hover,
    }) => {
      const yPos = y(value);
      const g = root.append('g').attr('class', 'threshold');

      const display = g
        .append('line')
        .attr('x1', 0)
        .attr('x2', width)
        .attr('y1', yPos)
        .attr('y2', yPos)
        .attr('stroke', color)
        .attr('stroke-dasharray', '6,6')
        .attr('stroke-width', 2);

      g.append('line')
        .attr('x1', 0)
        .attr('x2', width)
        .attr('y1', yPos)
        .attr('y2', yPos)
        .attr('stroke', 'transparent')
        .attr('stroke-width', 12)
        .style('pointer-events', 'stroke')
        .on('mouseenter', () => {
          display.attr('stroke-width', 3).attr('stroke', hover);
          tooltip
            .style('opacity', '1')
            .html(`<strong>${label}</strong><br/>${unit === 'mg' ? value.toFixed(0) : value.toFixed(1)} ${unit === 'mg' ? 'mg/dl' : 'mmol/L'}`);
        })
        .on('mousemove', (e: MouseEvent) => {
          tooltip
            .style('left', `${e.pageX + 12}px`)
            .style('top', `${e.pageY - 28}px`);
        })
        .on('mouseleave', () => {
          display.attr('stroke-width', 2).attr('stroke', color);
          tooltip.style('opacity', '0');
        });
    });

    if (useDayColors) {
      for (let i = 1; i < data.length; i++) {
        const prev = data[i - 1];
        const curr = data[i];
        const prevX = x(prev.label) ?? 0;
        const currX = x(curr.label) ?? 0;
        const prevDay = getDayName(prev.label);

        root
          .append('line')
          .attr('x1', prevX)
          .attr('x2', currX)
          .attr('y1', y(prev.value))
          .attr('y2', y(curr.value))
          .attr('stroke', prevDay ? DAY_COLOR_MAP[prevDay] || strokeColor : strokeColor)
          .attr('stroke-width', 3);
      }
    } else {
      root
        .append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', strokeColor)
        .attr('stroke-width', 3)
        .attr('d', line);
    }

    root
      .selectAll('circle')
      .data(data)
      .enter()
      .append('circle')
      .attr('cx', (d) => x(d.label) ?? 0)
      .attr('cy', (d) => y(d.value))
      .attr('r', 5)
      .attr('fill', (d) => getDatumColor(d))
      .style('cursor', 'pointer')
      .on('mouseenter', (event: MouseEvent, d: Datum) => {
        d3.select(event.currentTarget as SVGCircleElement)
          .attr('r', 7)
          .attr('stroke', '#333')
          .attr('stroke-width', 1.5);
        tooltip
          .style('opacity', '1')
          .html(
            `<strong>${d.rawLabel}</strong><br/>${unit === 'mg' ? d.value.toFixed(0) : d.value.toFixed(1)} ${unit === 'mg' ? 'mg/dl' : 'mmol/L'}`,
          );
      })
      .on('mousemove', (event: MouseEvent) => {
        tooltip
          .style('left', `${event.pageX + 12}px`)
          .style('top', `${event.pageY - 28}px`);
      })
      .on('mouseleave', (event: MouseEvent) => {
        d3.select(event.currentTarget as SVGCircleElement)
          .attr('r', 5)
          .attr('stroke', null);
        tooltip.style('opacity', '0');
      });

    const xAxisGroup = root
      .append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).tickFormat((d) => d.toString()));

    if (hideDenseXAxisTickLabels) {
      xAxisGroup.selectAll('text').style('display', 'none');
      xAxisGroup.selectAll('line').style('display', 'none');

      // Add day labels for dense charts (6+ points per day)
      // Group data points by day
      const dayGroups = new Map<string, number[]>();
      data.forEach((d, i) => {
        const day = getDayName(d.label);
        if (day) {
          if (!dayGroups.has(day)) {
            dayGroups.set(day, []);
          }
          dayGroups.get(day)!.push(i);
        }
      });

      // Add day label at the center of each day's data points
      dayGroups.forEach((indices, day) => {
        if (indices.length > 0) {
          // Calculate center position for this day
          const firstIdx = indices[0];
          const lastIdx = indices[indices.length - 1];
          const firstX = x(data[firstIdx].label) ?? 0;
          const lastX = x(data[lastIdx].label) ?? 0;
          const centerX = (firstX + lastX) / 2;

          root
            .append('text')
            .attr('x', centerX)
            .attr('y', height + 30)
            .attr('text-anchor', 'middle')
            .style('font-size', '13px')
            .style('font-weight', 'normal')
            .style('fill', '#333')
            .text(day);
        }
      });
    } else {
      const useTiltedLabels = pointCount > 10;
      xAxisGroup
        .selectAll('text')
        .attr('transform', useTiltedLabels ? 'rotate(40)' : 'rotate(0)')
        .style('text-anchor', useTiltedLabels ? 'start' : 'middle')
        .style('font-size', '12px')
        .style('font-weight', 'normal');
    }

    const yTickStep = unit === 'mg' ? 20 : 1;
    const yTickValues = d3.range(0, yUpperBound + yTickStep, yTickStep);

    root
      .append('g')
      .call(d3.axisLeft(y).tickValues(yTickValues))
      .selectAll('text')
      .style('font-size', '17px')
      .style('font-weight', 'bold');

    root
      .append('text')
      .attr('x', width / 2)
      .attr('y', -20)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .style('font-weight', 'bold')
      .text(parameters.title);

    root
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2)
      .attr('y', -50)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .style('font-weight', 'bold')
      .text(parameters.yLabel || `Glucose Level (${unit === 'mg' ? 'mg/dl' : 'mmol/L'})`);
  }, [
    data,
    strokeColor,
    parameters.title,
    parameters.yLabel,
    parameters.thresholdLow,
    parameters.thresholdHigh,
    unit,
  ]);

  useEffect(() => {
    if (!setAnswer) return;
    setAnswer({ status: true, answers: {} });
  }, [setAnswer]);

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: 16 }}>
      <svg
        ref={svgRef}
        width="100%"
        height="620"
        role="img"
        aria-label={parameters.title}
      />
    </div>
  );
}
