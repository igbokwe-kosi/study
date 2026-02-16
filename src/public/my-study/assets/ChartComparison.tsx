/* eslint-disable */
import { useEffect } from 'react';
import { StimulusParams } from '../../../store/types';
import LineChart from './LineChart';
import BarChart from './BarChart';

type ChartComparisonParams = {
  chartA: {
    type: 'line' | 'bar';
    dataFile: string;
    title: string;
    color?: string;
    thresholdLow?: number;
    thresholdHigh?: number;
    xLabel?: string;
    yLabel?: string;
  };
  chartB: {
    type: 'line' | 'bar';
    dataFile: string;
    title: string;
    color?: string;
    thresholdLow?: number;
    thresholdHigh?: number;
    xLabel?: string;
    yLabel?: string;
  };
  chartC: {
    type: 'line' | 'bar';
    dataFile: string;
    title: string;
    color?: string;
    thresholdLow?: number;
    thresholdHigh?: number;
    xLabel?: string;
    yLabel?: string;
  };
  chartD: {
    type: 'line' | 'bar';
    dataFile: string;
    title: string;
    color?: string;
    thresholdLow?: number;
    thresholdHigh?: number;
    xLabel?: string;
    yLabel?: string;
  };
};

export default function ChartComparison({
  parameters,
  setAnswer,
}: StimulusParams<ChartComparisonParams>) {
  useEffect(() => {
    if (!setAnswer) return;
    setAnswer({ status: true, answers: {} });
  }, [setAnswer]);

  const renderChart = (chartConfig: ChartComparisonParams['chartA'], label: string) => {
    const ChartComponent = chartConfig.type === 'line' ? LineChart : BarChart;
    return (
      <div
        key={label}
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
            marginBottom: '8px',
            color: '#333',
          }}
        >
          Chart {label}
        </div>
        <ChartComponent
          parameters={chartConfig}
          setAnswer={() => {}}
          answers={{}}
        />
      </div>
    );
  };

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: '8px 16px' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '16px',
          maxWidth: '1600px',
          margin: '0 auto',
        }}
      >
        {renderChart(parameters.chartA, 'A')}
        {renderChart(parameters.chartB, 'B')}
        {renderChart(parameters.chartC, 'C')}
        {renderChart(parameters.chartD, 'D')}
      </div>
    </div>
  );
}
