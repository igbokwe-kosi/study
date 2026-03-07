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
const SVG_HEIGHT = 400;
const MARGIN = {
  top: 50,
  right: 30,
  bottom: 80,
  left: 70,
};

type Datum = { label: string; rawLabel: string; value: number };

const labelKeys = ['Date Range', 'Date', 'Day', 'Hour', 'Hour Range', 'label', 'Date/Time'];

const getLabelKey = (row: d3.DSVRowString<string>) =>
  labelKeys.find((key) => key in row) || 'label';

const getValueKey = (row: d3.DSVRowString<string>) =>
  (['Average Glucose level', 'value'] as const).find((key) => key in row) || 'value';

const MGDL_TO_MMOLL = 18;

export default function LineChart({
  parameters,
  setAnswer,
}: StimulusParams<LineChartParams>) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [data, setData] = useState<Datum[] | null>(null);
  const [xAxisLabel, setXAxisLabel] = useState<string>('Date');

  const strokeColor = parameters.color || '#4c6ef5';
  const normalizeThreshold = (value: number | undefined, fallbackMmol: number) => {
    const resolved = value ?? fallbackMmol;
    return resolved > 30 ? resolved / MGDL_TO_MMOLL : resolved;
  };
  const low = normalizeThreshold(parameters.thresholdLow, 3.9);
  const high = normalizeThreshold(parameters.thresholdHigh, 10.0);

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
      setXAxisLabel(parameters.xLabel || labelKey);
      const shouldCleanLabel = labelKey === 'Date Range';

      const parsed = rows
        .map((d) => {
          const raw = (d[labelKey] as string) || '';
          const valueMgdl = Number(d[valueKey] || 0);
          return {
            rawLabel: raw,
            label: shouldCleanLabel ? cleanLabel(raw) : raw,
            value: valueMgdl / MGDL_TO_MMOLL,
          };
        })
        .filter((d) => Number.isFinite(d.value));
      setData(parsed);
    });
    return () => {
      mounted = false;
    };
  }, [parameters.dataFile]);

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = SVG_WIDTH - MARGIN.left - MARGIN.right;
    const height = SVG_HEIGHT - MARGIN.top - MARGIN.bottom;

    const root = svg
      .attr('viewBox', `0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`)
      .append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    const yExtent = d3.extent(data, (d) => d.value) as [number, number];
    const yMin = Math.min(low, yExtent[0] ?? 0);
    const yMax = Math.max(high, yExtent[1] ?? 0);

    const yPadding = Math.max(0.8, (yMax - yMin) * 0.1);
    const y = d3
      .scaleLinear()
      .domain([Math.max(0, yMin - yPadding), yMax + yPadding])
      .range([height, 0]);

    const pointCount = data.length;
    const likelyPointsPerDay = Math.round(pointCount / 7);
    const hideDenseXAxisTickLabels = likelyPointsPerDay >= 6;
    const xAxisTitleOffset =
      likelyPointsPerDay === 2 || likelyPointsPerDay === 4 ? 130 : 90;

    const getDayName = (label: string): string | null => {
      const dayPattern = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i;
      const match = label.match(dayPattern);
      return match ? match[1] : null;
    };

    const dayNamesInOrder = data
      .map((d) => getDayName(d.label))
      .filter((day): day is string => day !== null)
      .filter((day, index, arr) => arr.indexOf(day) === index);

    const dayColorScale = d3
      .scaleOrdinal<string, string>()
      .domain(dayNamesInOrder)
      .range(['#e03131', '#f08c00', '#2f9e44', '#1c7ed6', '#7048e8', '#c2255c', '#0b7285']);

    const useDayColors = likelyPointsPerDay > 1 && dayNamesInOrder.length > 1;

    const getDatumColor = (datum: Datum) => {
      if (!useDayColors) return strokeColor;
      const day = getDayName(datum.label);
      return day ? dayColorScale(day) : strokeColor;
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

    const areaFill = d3.color(strokeColor) || d3.rgb('#4c6ef5');
    areaFill.opacity = 0.12;
    const area = d3
      .area<Datum>()
      .x((d) => x(d.label) ?? 0)
      .y0(() => y.range()[0])
      .y1((d) => y(d.value));

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
        color: '#ff6b6b',
        hover: '#ff3b3b',
      },
      {
        value: high,
        label: 'High threshold',
        color: '#ffa94d',
        hover: '#ff922b',
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
            .html(`<strong>${label}</strong><br/>${value.toFixed(1)} mmol/L`);
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

    const daySeparatorIndices: number[] = [];
    for (let i = 1; i < data.length; i++) {
      const prevDay = getDayName(data[i - 1].label);
      const currentDay = getDayName(data[i].label);
      
      if (prevDay && currentDay && prevDay !== currentDay) {
        daySeparatorIndices.push(i);
      }
    }

    daySeparatorIndices.forEach((idx) => {
      const prevLabel = data[idx - 1].label;
      const currentLabel = data[idx].label;
      const prevX = x(prevLabel) ?? 0;
      const currentX = x(currentLabel) ?? 0;
      const separatorX = (prevX + currentX) / 2;

      root
        .append('line')
        .attr('x1', separatorX)
        .attr('x2', separatorX)
        .attr('y1', 0)
        .attr('y2', height)
        .attr('stroke', '#444444')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4,4')
        .style('opacity', 0.6);
    });

    root
      .append('path')
      .datum(data)
      .attr('fill', areaFill.formatRgb())
      .attr('stroke', 'none')
      .attr('d', area);

    if (useDayColors) {
      const groupedByDay = d3.group(data, (d) => getDayName(d.label) || '__none__');
      groupedByDay.forEach((dayData, day) => {
        if (dayData.length < 2) return;
        root
          .append('path')
          .datum(dayData)
          .attr('fill', 'none')
          .attr('stroke', day === '__none__' ? strokeColor : dayColorScale(day))
          .attr('stroke-width', 3)
          .attr('d', line);
      });
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
            `<strong>${d.rawLabel}</strong><br/>${d.value.toFixed(1)} mmol/L`,
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
      xAxisGroup.selectAll('path').style('display', 'none');

      // Add day labels for dense charts (6+ points per day)
      const getDayName = (label: string): string | null => {
        const dayPattern = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i;
        const match = label.match(dayPattern);
        return match ? match[1] : null;
      };

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
            .style('font-size', '17px')
            .style('font-weight', 'bold')
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
        .style('font-size', '17px')
        .style('font-weight', 'bold');
    }

    root
      .append('g')
      .call(d3.axisLeft(y))
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
      .attr('x', width / 2)
      .attr('y', height + xAxisTitleOffset)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .style('font-weight', 'bold')
      .text(xAxisLabel);

    root
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2)
      .attr('y', -50)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .style('font-weight', 'bold')
      .text('Glucose Level (mmol/L)');
  }, [data, high, low, strokeColor, parameters.title, xAxisLabel]);

  useEffect(() => {
    if (!setAnswer) return;
    setAnswer({ status: true, answers: {} });
  }, [setAnswer]);

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: 16 }}>
      <svg
        ref={svgRef}
        width="100%"
        height="520"
        role="img"
        aria-label={parameters.title}
      />
    </div>
  );
}
