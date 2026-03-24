/* eslint-disable */
import { useEffect } from 'react';
import { StimulusParams } from '../../../store/types';
import LineChartSlider from './LineChartSlider';

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

export default function ChartComparison({ parameters, setAnswer, answers }: StimulusParams<ChartComparisonParams>) {
  useEffect(() => {
    if (!setAnswer) return;
    setAnswer({ status: true, answers: {} });
  }, [setAnswer]);

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: '8px 16px' }}>
      <LineChartSlider parameters={parameters} answers={answers} />
    </div>
  );
}
