import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../../theme/ThemeProvider';
import { BarChart, LineChart, type ChartPoint } from '../ProgressChart';

/** Text drawn inside an SVG is not a host Text node; collect it from the rendered tree. */
function svgText(): string[] {
  const out: string[] = [];
  const walk = (n: unknown): void => {
    if (n == null) return;
    if (typeof n === 'string') return void out.push(n);
    if (Array.isArray(n)) return n.forEach(walk);
    const node = n as { props?: { content?: unknown }; children?: unknown };
    if (typeof node.props?.content === 'string') out.push(node.props.content);
    walk(node.children);
  };
  walk(screen.toJSON());
  return out;
}

const wrap = (ui: React.ReactElement) => render(<ThemeProvider preference="light">{ui}</ThemeProvider>);
const series = (n: number): ChartPoint[] => Array.from({ length: n }, (_, i) => ({ x: i * 86_400_000, y: 100 + (i % 7), label: `d${i}` }));

describe('LineChart', () => {
  it('exposes its data through the accessibility label, with first and last labels drawn', async () => {
    await wrap(<LineChart points={series(5)} accessibilityLabel="e1RM: 100 to 104" />);
    expect(screen.getByRole('image')).toHaveAccessibleName('e1RM: 100 to 104');
    expect(svgText()).toEqual(expect.arrayContaining(['d0', 'd4']));
  });

  it('keeps the true first and last points of a long, thinned series', async () => {
    await wrap(<LineChart points={series(900)} accessibilityLabel="long" />);
    expect(svgText()).toEqual(expect.arrayContaining(['d0', 'd899']));
  });
});

describe('BarChart', () => {
  it('labels the latest and tallest bars with their values', async () => {
    const bars = [
      { value: 1200, label: 'W1' },
      { value: 3400, label: 'W2' },
      { value: 900, label: 'W3' },
    ];
    await wrap(<BarChart bars={bars} accessibilityLabel="volume" formatValue={v => `${v}kg`} />);
    const text = svgText();
    expect(text).toEqual(expect.arrayContaining(['3400kg', '900kg']));
    expect(text).not.toContain('1200kg');
  });
});
