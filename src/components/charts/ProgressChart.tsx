import React, { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';

export interface ChartPoint {
  x: number;
  y: number;
  /** Short axis label, e.g. "12 Oct". */
  label: string;
}

function useWidth(initial = 320) {
  const [w, setW] = useState(initial);
  return [w, (e: LayoutChangeEvent) => setW(Math.max(160, Math.round(e.nativeEvent.layout.width)))] as const;
}

const fmt = (v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v)));

/**
 * Line chart for progression over time (e.g. estimated 1RM). The accessibility
 * label carries the data, so the chart is never only visual.
 */
export function LineChart({
  points,
  height = 190,
  accessibilityLabel,
}: {
  points: readonly ChartPoint[];
  height?: number;
  accessibilityLabel: string;
}) {
  const t = useTheme();
  const [W, onLayout] = useWidth();
  const left = 38;
  const right = 12;
  const top = 14;
  const bottom = 24;
  const ys = points.map(p => p.y);
  let min = Math.min(...ys);
  let max = Math.max(...ys);
  const pad = Math.max(2, (max - min) * 0.15);
  min -= pad;
  max += pad;
  const xs = points.map(p => p.x);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const X = (x: number) => left + (x1 === x0 ? 0.5 : (x - x0) / (x1 - x0)) * (W - left - right);
  const Y = (y: number) => top + (1 - (y - min) / (max - min)) * (height - top - bottom);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ');
  const area = points.length > 1 ? `${d} L${X(x1)},${height - bottom} L${X(x0)},${height - bottom} Z` : '';

  return (
    <View onLayout={onLayout} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <Svg width={W} height={height}>
        {[0, 0.5, 1].map(f => {
          const v = min + f * (max - min);
          const y = Y(v);
          return (
            <React.Fragment key={f}>
              <Line x1={left} x2={W - right} y1={y} y2={y} stroke={t.colors.line} strokeWidth={1} />
              <SvgText x={left - 6} y={y + 3.5} fill={t.colors.ink3} fontSize={10.5} textAnchor="end">
                {fmt(v)}
              </SvgText>
            </React.Fragment>
          );
        })}
        {area ? <Path d={area} fill={t.colors.amberSoft} /> : null}
        <Path d={d} fill="none" stroke={t.colors.ink} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => {
          const last = i === points.length - 1;
          return (
            <Circle
              key={i}
              cx={X(p.x)}
              cy={Y(p.y)}
              r={last ? 5 : 3}
              fill={last ? t.colors.amber : t.colors.surface}
              stroke={last ? t.colors.amber : t.colors.ink}
              strokeWidth={2}
            />
          );
        })}
        {points.length ? (
          <>
            <SvgText x={left} y={height - 6} fill={t.colors.ink3} fontSize={10.5}>
              {points[0].label}
            </SvgText>
            <SvgText x={W - right} y={height - 6} fill={t.colors.ink3} fontSize={10.5} textAnchor="end">
              {points[points.length - 1].label}
            </SvgText>
          </>
        ) : null}
      </Svg>
    </View>
  );
}

export interface Bar {
  value: number;
  label: string;
}

/** Bar chart with the latest bar highlighted, and value labels on the latest and tallest bars. */
export function BarChart({
  bars,
  height = 150,
  accessibilityLabel,
  formatValue = fmt,
}: {
  bars: readonly Bar[];
  height?: number;
  accessibilityLabel: string;
  formatValue?: (v: number) => string;
}) {
  const t = useTheme();
  const [W, onLayout] = useWidth();
  const top = 20;
  const bottom = 22;
  const step = W / Math.max(1, bars.length);
  const bw = step * 0.56;
  const max = Math.max(1, ...bars.map(b => b.value));
  const maxIndex = bars.findIndex(b => b.value === max);
  const labelEvery = bars.length > 8 ? Math.ceil(bars.length / 6) : 1;

  return (
    <View onLayout={onLayout} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <Svg width={W} height={height}>
        <Line x1={0} x2={W} y1={height - bottom} y2={height - bottom} stroke={t.colors.line} strokeWidth={1} />
        {bars.map((b, i) => {
          const h = Math.max(b.value > 0 ? 3 : 0, (b.value / max) * (height - top - bottom));
          const x = i * step + (step - bw) / 2;
          const y = height - bottom - h;
          const cur = i === bars.length - 1;
          const showValue = b.value > 0 && (cur || i === maxIndex);
          const showLabel = (bars.length - 1 - i) % labelEvery === 0;
          return (
            <React.Fragment key={i}>
              <Rect x={x} y={y} width={bw} height={h} rx={Math.min(6, bw / 2)} fill={cur ? t.colors.amber : t.colors.raise} />
              {showValue ? (
                <SvgText x={x + bw / 2} y={y - 6} fill={t.colors.ink} fontSize={11.5} fontWeight="700" textAnchor="middle">
                  {formatValue(b.value)}
                </SvgText>
              ) : null}
              {showLabel ? (
                <SvgText x={x + bw / 2} y={height - 6} fill={t.colors.ink3} fontSize={10.5} textAnchor="middle">
                  {b.label}
                </SvgText>
              ) : null}
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}
