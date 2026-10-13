import { MAX_CHART_POINTS, downsample } from '../ProgressChart';

const series = (n: number) => Array.from({ length: n }, (_, i) => ({ x: i * 1000, y: 100 + (i % 7), label: String(i) }));

it('leaves short series alone', () => {
  expect(downsample(series(10))).toHaveLength(10);
});

it('thins long series, keeping first, last and the peaks', () => {
  const pts = series(900);
  pts[450] = { ...pts[450], y: 999 }; // a record in the middle
  const out = downsample(pts);
  expect(out.length).toBeLessThanOrEqual(MAX_CHART_POINTS);
  expect(out[0]).toBe(pts[0]);
  expect(out[out.length - 1]).toBe(pts[899]);
  expect(out.some(p => p.y === 999)).toBe(true);
  expect(out.every((p, i) => i === 0 || p.x > out[i - 1].x)).toBe(true);
});
