/* eslint-disable */
import { useMemo, useState } from 'react';
import LineChart from './LineChart';
import BarChart from './BarChart';

type ChartConfig = {
  type: 'line' | 'bar';
  dataFile: string;
  title: string;
  color?: string;
  thresholdLow?: number;
  thresholdHigh?: number;
  xLabel?: string;
  yLabel?: string;
};

type ChartComparisonParams = {
  chartA?: ChartConfig;
  chartB?: ChartConfig;
  chartC?: ChartConfig;
  chartD?: ChartConfig;
  chartE?: ChartConfig;
  chartF?: ChartConfig;
};

type SliderItem = {
  label: string;
  chart: ChartConfig;
};

type Props = {
  parameters: ChartComparisonParams;
};

export default function LineChartSlider({ parameters }: Props) {
  const items = useMemo<SliderItem[]>(() => {
    const ordered: Array<{ key: keyof ChartComparisonParams; label: string }> = [
      { key: 'chartA', label: '1 point' },
      { key: 'chartB', label: '2 points' },
      { key: 'chartC', label: '4 points' },
      { key: 'chartD', label: '24 points' },
    ];

    return ordered
      .map(({ key, label }) => {
        const chart = parameters[key];
        return chart ? { label, chart } : null;
      })
      .filter((item): item is SliderItem => item !== null);
  }, [parameters]);

  const [selectedIndex, setSelectedIndex] = useState(0);

  if (items.length === 0) {
    return <div>No chart data available.</div>;
  }

  const safeIndex = Math.min(selectedIndex, items.length - 1);
  const selected = items[safeIndex];
  const ChartComponent = selected.chart.type === 'line' ? LineChart : BarChart;

  return (
    <div
      style={{
        border: '2px solid #ddd',
        borderRadius: '8px',
        padding: '16px',
        backgroundColor: '#fff',
      }}
    >
      <div
        style={{
          fontSize: '20px',
          fontWeight: 'bold',
          marginBottom: '12px',
          color: '#333',
        }}
      >
        Visualization Comparison by Aggregation
      </div>

      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={() => setSelectedIndex((i) => Math.max(0, i - 1))}
            disabled={safeIndex === 0}
          >
            Previous
          </button>

          <input
            type="range"
            min={0}
            max={items.length - 1}
            step={1}
            value={safeIndex}
            onChange={(event) => setSelectedIndex(Number(event.target.value))}
            style={{ flex: 1 }}
          />

          <button
            type="button"
            onClick={() => setSelectedIndex((i) => Math.min(items.length - 1, i + 1))}
            disabled={safeIndex === items.length - 1}
          >
            Next
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${items.length}, 1fr)`,
            marginTop: '8px',
            fontSize: '12px',
            color: '#555',
          }}
        >
          {items.map((item, index) => (
            <div
              key={item.label}
              style={{
                textAlign: 'center',
                fontWeight: index === safeIndex ? 'bold' : 'normal',
              }}
            >
              {item.label}
            </div>
          ))}
        </div>
      </div>

      <ChartComponent
        parameters={selected.chart}
        setAnswer={() => {}}
        answers={{}}
      />
    </div>
  );
}
