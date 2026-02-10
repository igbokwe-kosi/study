/* eslint-disable */
import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { StimulusParams } from '../../../store/types';

type LineChartQuartileParams = {
dataFile: string;
title: string;
thresholdLow?: number;
thresholdHigh?: number;
};

type SeriesDef = {
	id: string;
	label: string;
	color: string;
	csvKey: string;
};

const SVG_WIDTH = 900;
const SVG_HEIGHT = 520;
const MARGIN = {
  top: 50,
  right: 30,
  bottom: 80,
  left: 70,
};

type Datum = {
	label: string;
	rawLabel: string;
	values: Record<string, number>;
};

const SERIES: SeriesDef[] = [
  {
    id: 'p5',
    label: '5th percentile',
    color: '#b3cde3',
    csvKey: '5th Percentile',
  },
  {
    id: 'p25',
    label: '25th percentile',
    color: '#6497b1',
    csvKey: '25th Percentile',
  },
  {
    id: 'avg',
    label: 'Average',
    color: '#2c3e50',
    csvKey: 'Average Glucose level',
  },
  {
    id: 'p75',
    label: '75th percentile',
    color: '#6497b1',
    csvKey: '75th Percentile',
  },
  {
    id: 'p95',
    label: '95th percentile',
    color: '#b3cde3',
    csvKey: '95th Percentile',
  },
];

export default function LineChartQuartile({
	parameters,
	setAnswer,
}: StimulusParams<LineChartQuartileParams>) {
	const svgRef = useRef<SVGSVGElement | null>(null);
	const [data, setData] = useState<Datum[] | null>(null);

	const low = parameters.thresholdLow ?? 70;
	const high = parameters.thresholdHigh ?? 180;

	useEffect(() => {
		let mounted = true;
		const formatHour = (value: string) => {
			const hour = Number(value);
			if (!Number.isFinite(hour)) return value;
			return `${hour}:00`;
		};

		d3.csv(parameters.dataFile).then((rows) => {
			if (!mounted) return;
			const parsed = rows
				.map((d) => {
					const raw =
						(d['Hour'] as string) || (d['Date Range'] as string) || (d.label as string) || '';
					const values: Record<string, number> = {};
					SERIES.forEach((series) => {
						values[series.id] = Number(d[series.csvKey] || 0);
					});
					return {
						rawLabel: raw,
						label: formatHour(raw),
						values,
					};
				})
				.filter((d) => SERIES.some((series) => Number.isFinite(d.values[series.id])));
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

		const allValues: number[] = [];
		data.forEach((d) => {
			SERIES.forEach((series) => {
				const value = d.values[series.id];
				if (Number.isFinite(value)) allValues.push(value);
			});
		});

		const yExtent = d3.extent(allValues) as [number, number];
		const yMin = Math.min(low, yExtent[0] ?? 0);
		const yMax = Math.max(high, yExtent[1] ?? 0);

		const y = d3
			.scaleLinear()
			.domain([yMin - 10, yMax + 10])
			.range([height, 0])
			.nice();
		const x = d3
			.scalePoint<string>()
			.domain(data.map((d) => d.label))
			.range([0, width])
			.padding(0.5);

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

		thresholds.forEach(({ value, label, color, hover }) => {
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
						.html(`<strong>${label}</strong><br/>${value} mg/dL`);
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

		const areaOuter = d3
			.area<Datum>()
			.defined(
				(d) => Number.isFinite(d.values.p5) && Number.isFinite(d.values.p95),
			)
			.x((d) => x(d.label) ?? 0)
			.y0((d) => y(d.values.p5))
			.y1((d) => y(d.values.p95));

		const areaInner = d3
			.area<Datum>()
			.defined(
				(d) => Number.isFinite(d.values.p25) && Number.isFinite(d.values.p75),
			)
			.x((d) => x(d.label) ?? 0)
			.y0((d) => y(d.values.p25))
			.y1((d) => y(d.values.p75));

		root
			.append('path')
			.datum(data)
			.attr('fill', '#b3cde3')
			.attr('opacity', 0.45)
			.attr('d', areaOuter);

		root
			.append('path')
			.datum(data)
			.attr('fill', '#6497b1')
			.attr('opacity', 0.6)
			.attr('d', areaInner);

		const avgLine = d3
			.line<Datum>()
			.defined((d) => Number.isFinite(d.values.avg))
			.x((d) => x(d.label) ?? 0)
			.y((d) => y(d.values.avg));

		root
			.append('path')
			.datum(data)
			.attr('fill', 'none')
			.attr('stroke', '#2c3e50')
			.attr('stroke-width', 4)
			.attr('d', avgLine);

		root
			.selectAll('.avg-point')
			.data(data.filter((d) => Number.isFinite(d.values.avg)))
			.enter()
			.append('circle')
			.attr('class', 'avg-point')
			.attr('cx', (d) => x(d.label) ?? 0)
			.attr('cy', (d) => y(d.values.avg))
			.attr('r', 3)
			.attr('fill', '#2c3e50')
			.style('cursor', 'pointer')
			.on('mouseenter', (event: MouseEvent, d: Datum) => {
				d3.select(event.currentTarget as SVGCircleElement)
					.attr('r', 5)
					.attr('stroke', '#111')
					.attr('stroke-width', 1.2);
				tooltip
					.style('opacity', '1')
					.html(
						`<strong>${d.rawLabel}</strong><br/>Average: ${d.values.avg.toFixed(2)} mg/dL`,
					);
			})
			.on('mousemove', (event: MouseEvent) => {
				tooltip
					.style('left', `${event.pageX + 12}px`)
					.style('top', `${event.pageY - 28}px`);
			})
			.on('mouseleave', (event: MouseEvent) => {
				d3.select(event.currentTarget as SVGCircleElement)
					.attr('r', 3)
					.attr('stroke', null);
				tooltip.style('opacity', '0');
			});

		root
			.append('g')
			.attr('transform', `translate(0,${height})`)
			.call(d3.axisBottom(x).tickFormat((d) => d.toString()))
			.selectAll('text')
			.attr('transform', 'rotate(40)')
			.style('text-anchor', 'start')
			.style('font-size', '13px')
			.style('font-weight', 'bold');

		root
			.append('g')
			.call(d3.axisLeft(y).ticks(6))
			.selectAll('text')
			.style('font-size', '13px')
			.style('font-weight', 'bold');

		root
			.append('g')
			.attr('class', 'y-grid')
			.call(
				d3
					.axisLeft(y)
					.ticks(6)
					.tickSize(-width)
					.tickFormat(() => ''),
			)
			.selectAll('line')
			.attr('stroke', '#e0e0e0');

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
			.attr('y', height + 90)
			.attr('text-anchor', 'middle')
			.style('font-size', '14px')
			.style('font-weight', 'bold')
			.text('Hour');

		root
			.append('text')
			.attr('transform', 'rotate(-90)')
			.attr('x', -height / 2)
			.attr('y', -50)
			.attr('text-anchor', 'middle')
			.style('font-size', '14px')
			.style('font-weight', 'bold')
			.text('Glucose Level (mg/dL)');
	}, [data, high, low, parameters.title]);

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
