/* eslint-disable */
import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { StimulusParams } from '../../../store/types';

type BarChartParams = {
	dataFile: string;
	title: string;
	color?: string;
	thresholdLow?: number;
	thresholdHigh?: number;
	xLabel?: string;
	yLabel?: string;
};

const SVG_WIDTH = 1300;
const SVG_HEIGHT = 600;
const MARGIN = {
	top: 50,
	right: 30,
	bottom: 80,
	left: 70,
};

type Datum = { label: string; rawLabel: string; value: number };

const labelKeys = ['Day', 'Day of Week', 'Hour', 'Date Range', 'label'];

const getLabelKey = (row: d3.DSVRowString<string>) =>
	labelKeys.find((key) => key in row) || 'label';

const getValueKey = (row: d3.DSVRowString<string>) =>
	(['Average Glucose level', 'value'] as const).find((key) => key in row) || 'value';

export default function BarChart({
	parameters,
	setAnswer,
}: StimulusParams<BarChartParams>) {
	const svgRef = useRef<SVGSVGElement | null>(null);
	const [data, setData] = useState<Datum[] | null>(null);
	const [xAxisLabel, setXAxisLabel] = useState<string>('Category');

	const fillColor = parameters.color || '#4c6ef5';
	const low = parameters.thresholdLow ?? 70;
	const high = parameters.thresholdHigh ?? 180;
	const yAxisLabel = parameters.yLabel || 'Glucose Level (mg/dL)';

	useEffect(() => {
		let mounted = true;

		d3.csv(parameters.dataFile).then((rows) => {
			if (!mounted) return;
			if (rows.length === 0) return;

			const labelKey = getLabelKey(rows[0]);
			const valueKey = getValueKey(rows[0]);
			setXAxisLabel(parameters.xLabel || labelKey);

			const parsed = rows
				.map((d) => {
					const raw = (d[labelKey] as string) || '';
					return {
						rawLabel: raw,
						label: raw,
						value: Number(d[valueKey] || 0),
					};
				})
				.filter((d) => Number.isFinite(d.value));
			setData(parsed);
		});

		return () => {
			mounted = false;
		};
	}, [parameters.dataFile, parameters.xLabel]);

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

		const y = d3
			.scaleLinear()
			.domain([yMin - 10, yMax + 10])
			.range([height, 0]);
		const x = d3
			.scaleBand()
			.domain(data.map((d) => d.label))
			.range([0, width])
			.padding(0.2);

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

		root
			.selectAll('rect')
			.data(data)
			.enter()
			.append('rect')
			.attr('x', (d) => x(d.label) ?? 0)
			.attr('y', (d) => y(d.value))
			.attr('width', x.bandwidth())
			.attr('height', (d) => y.range()[0] - y(d.value))
			.attr('fill', fillColor)
			.style('cursor', 'pointer')
			.on('mouseenter', (event: MouseEvent, d: Datum) => {
				d3.select(event.currentTarget as SVGRectElement)
					.attr('stroke', '#333')
					.attr('stroke-width', 1.5);
				tooltip
					.style('opacity', '1')
					.html(`<strong>${d.rawLabel}</strong><br/>${d.value.toFixed(2)} mg/dL`);
			})
			.on('mousemove', (event: MouseEvent) => {
				tooltip
					.style('left', `${event.pageX + 12}px`)
					.style('top', `${event.pageY - 28}px`);
			})
			.on('mouseleave', (event: MouseEvent) => {
				d3.select(event.currentTarget as SVGRectElement)
					.attr('stroke', null);
				tooltip.style('opacity', '0');
			});

		root
			.append('g')
			.attr('transform', `translate(0,${height})`)
			.call(d3.axisBottom(x))
			.selectAll('text')
			.attr('transform', 'rotate(40)')
			.style('text-anchor', 'start')
			.style('font-size', '17px')
			.style('font-weight', 'bold');

		root
			.append('g')
			.call(d3.axisLeft(y).ticks(4))
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
			.attr('y', height + 90)
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
			.text(yAxisLabel);
	}, [data, fillColor, high, low, parameters.title, xAxisLabel, yAxisLabel]);

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
