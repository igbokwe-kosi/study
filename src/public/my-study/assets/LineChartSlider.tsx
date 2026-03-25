/* eslint-disable */
import { useMemo, useState } from 'react';
import LineChart from './LineChart';
import BarChart from './BarChart';
import { StimulusParams } from '../../../store/types';

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
  answers: StimulusParams<ChartConfig>['answers'];
};

export default function LineChartSlider({ parameters, answers }: Props) {
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
  const TRACK_SIDE_INSET_PX = 10;

  const markerLeft = (index: number) => {
    const percent = items.length === 1 ? 50 : (index / (items.length - 1)) * 100;
    return items.length === 1
      ? '50%'
      : `calc(${TRACK_SIDE_INSET_PX}px + (${percent} * (100% - ${TRACK_SIDE_INSET_PX * 2}px) / 100))`;
  };

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
        Visualization Comparison by Aggregations
      </div>

      <ChartComponent
        parameters={selected.chart}
        setAnswer={() => {}}
        answers={answers}
      />

      <div
        style={{
          fontSize: '16px',
          fontWeight: 'bold',
          color: '#333',
          marginBottom: '12px',
          lineHeight: 1.35,
        }}
      >
        Use the slider to review all four aggregation levels and choose the interval you are most comfortable using for making health decisions.
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

          <div style={{ flex: 1 }}>
            <div style={{ position: 'relative', height: '24px', display: 'flex', alignItems: 'center' }}>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  zIndex: 3,
                }}
              >
                {items.map((item, index) => (
                  <div
                    key={`dot-${item.label}`}
                    style={{
                      position: 'absolute',
                      left: markerLeft(index),
                      top: '50%',
                      width: index === safeIndex ? '16px' : '10px',
                      height: index === safeIndex ? '16px' : '10px',
                      marginLeft: index === safeIndex ? '-8px' : '-5px',
                      marginTop: index === safeIndex ? '-8px' : '-5px',
                      borderRadius: '50%',
                      background: index === safeIndex ? '#0b5cab' : '#1f3a4a',
                      border: index === safeIndex ? '2px solid #ffffff' : '1px solid #ffffff',
                      boxShadow: index === safeIndex
                        ? '0 0 0 3px rgba(11, 92, 171, 0.35)'
                        : '0 1px 2px rgba(0, 0, 0, 0.25)',
                    }}
                  />
                ))}
              </div>

              <input
                type="range"
                min={0}
                max={items.length - 1}
                step={1}
                value={safeIndex}
                onChange={(event) => setSelectedIndex(Number(event.target.value))}
                style={{ width: '100%', position: 'relative', zIndex: 2 }}
              />
            </div>

            <div style={{ position: 'relative', height: '22px', marginTop: '10px' }}>
              {items.map((item, index) => (
                <div
                  key={item.label}
                  style={{
                    position: 'absolute',
                    left: markerLeft(index),
                    transform: 'translateX(-50%)',
                    fontSize: '12px',
                    color: '#555',
                    fontWeight: index === safeIndex ? 'bold' : 'normal',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.label}
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSelectedIndex((i) => Math.min(items.length - 1, i + 1))}
            disabled={safeIndex === items.length - 1}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
