import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import type { BodyRegion, MuscleHighlight } from '../../domain/models';
import { translate, useT, type Params, type TKey } from '../../i18n';
import { useStyles, useTheme } from '../../theme/ThemeProvider';
import type { Theme } from '../../theme/tokens';
import { AppText } from '../common/AppText';

type Shape =
  | { k: 'e'; cx: number; cy: number; rx: number; ry: number }
  | { k: 'r'; x: number; y: number; w: number; h: number; r: number }
  | { k: 'p'; d: string };

/** Mirrors an ellipse to both sides of the body (centre line x = 50). */
const pair = (cx: number, cy: number, rx: number, ry: number): Shape[] => [
  { k: 'e', cx, cy, rx, ry },
  { k: 'e', cx: 100 - cx, cy, rx, ry },
];

// Original, deliberately simple figure on a 100 × 190 grid per view.
const FRONT: Array<[BodyRegion | null, Shape[]]> = [
  ['sideDelts', pair(23, 43, 4.5, 7.5)],
  ['frontDelts', pair(30.5, 40, 7, 6.5)],
  ['chest', pair(41, 49, 9, 7.5)],
  ['biceps', pair(23.5, 61, 4.6, 10)],
  ['forearms', pair(21, 84, 4, 11)],
  ['abs', [{ k: 'r', x: 42, y: 59, w: 16, h: 31, r: 5 }]],
  ['obliques', pair(36, 73, 3.6, 12)],
  ['hipFlexors', pair(42.5, 97, 5.5, 4)],
  ['quads', pair(40.5, 123, 8, 20)],
  [null, pair(40.5, 165, 5, 15)], // shins
];
const BACK: Array<[BodyRegion | null, Shape[]]> = [
  ['upperBack', [{ k: 'p', d: 'M38 33 L62 33 L66 46 L56 56 L44 56 L34 46 Z' }]],
  ['sideDelts', pair(23, 43, 4.5, 7.5)],
  ['rearDelts', pair(30.5, 40, 7, 6.5)],
  ['lats', [{ k: 'p', d: 'M34 49 L44 58 L46 78 L38 76 L32 60 Z' }, { k: 'p', d: 'M66 49 L56 58 L54 78 L62 76 L68 60 Z' }]],
  ['triceps', pair(23.5, 61, 4.6, 10)],
  ['forearms', pair(21, 84, 4, 11)],
  ['lowerBack', [{ k: 'r', x: 44, y: 70, w: 12, h: 18, r: 4 }]],
  ['glutes', pair(42, 99, 8.5, 8)],
  ['hamstrings', pair(40.5, 127, 7.5, 18)],
  ['calves', pair(40.5, 164, 6, 14)],
];

function ShapeEl({ s, fill, stroke }: { s: Shape; fill: string; stroke?: string }) {
  const p = { fill, stroke, strokeWidth: stroke ? 1.2 : 0 };
  if (s.k === 'e') return <Ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} {...p} />;
  if (s.k === 'r') return <Rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r} {...p} />;
  return <Path d={s.d} {...p} />;
}

function Figure({ parts, highlight }: { parts: typeof FRONT; highlight: MuscleHighlight }) {
  const t = useTheme();
  const colour = (r: BodyRegion | null) =>
    r && highlight.primary.includes(r)
      ? { fill: t.colors.amber }
      : r && highlight.secondary.includes(r)
        ? { fill: t.colors.amberSoft, stroke: t.colors.amber }
        : { fill: t.colors.raise };
  return (
    <Svg width={110} height={200} viewBox="0 0 100 190">
      <G>
        <Circle cx={50} cy={15} r={10} fill={t.colors.raise} />
        <Rect x={45} y={25} width={10} height={8} rx={2} fill={t.colors.raise} />
        <Circle cx={19.5} cy={100} r={4} fill={t.colors.raise} />
        <Circle cx={80.5} cy={100} r={4} fill={t.colors.raise} />
        {parts.map(([region, shapes], i) => (
          <G key={i}>
            {shapes.map((s, j) => (
              <ShapeEl key={j} s={s} {...colour(region)} />
            ))}
          </G>
        ))}
      </G>
    </Svg>
  );
}

type T = (key: TKey, params?: Params) => string;
const english: T = (key, params) => translate('en', key, params);

/** Screen-reader sentence for the map. English unless `t` from useT() is passed. */
export function describeHighlight(h: MuscleHighlight, t: T = english): string {
  const readable = (r: BodyRegion) => t(`exercises.map.region.${r}`);
  const p = h.primary.map(readable).join(', ');
  const s = h.secondary.map(readable).join(', ');
  const main = t('exercises.map.describe', { main: p || t('exercises.map.none') });
  return s ? `${main} ${t('exercises.map.describeAlso', { also: s })}` : main;
}

/** Front and back figures with the exercise's muscles highlighted. Renders nothing when no region is known. */
export function MuscleMap({ highlight }: { highlight: MuscleHighlight }) {
  const s = useStyles(styles);
  const { t } = useT();
  if (!highlight.primary.length && !highlight.secondary.length) return null;
  return (
    <View style={s.wrap} accessible accessibilityRole="image" accessibilityLabel={describeHighlight(highlight, t)} testID="muscle-map">
      <View style={s.figures}>
        <View style={s.fig}>
          <Figure parts={FRONT} highlight={highlight} />
          <AppText variant="caption" color="ink3">
            {t('exercises.map.front')}
          </AppText>
        </View>
        <View style={s.fig}>
          <Figure parts={BACK} highlight={highlight} />
          <AppText variant="caption" color="ink3">
            {t('exercises.map.back')}
          </AppText>
        </View>
      </View>
      <View style={s.legend}>
        <View style={[s.swatch, s.primary]} />
        <AppText variant="caption" color="ink2">
          {t('exercises.map.main')}
        </AppText>
        {highlight.secondary.length ? (
          <>
            <View style={[s.swatch, s.secondary]} />
            <AppText variant="caption" color="ink2">
              {t('exercises.map.alsoWorks')}
            </AppText>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    wrap: {
      marginTop: 18,
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.line,
      borderRadius: t.radii.lg,
      paddingVertical: 14,
      alignItems: 'center',
    },
    figures: { flexDirection: 'row', gap: 24 },
    fig: { alignItems: 'center', gap: 4 },
    legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
    swatch: { width: 12, height: 12, borderRadius: 3, marginLeft: 6 },
    primary: { backgroundColor: t.colors.amber },
    secondary: { backgroundColor: t.colors.amberSoft, borderWidth: 1, borderColor: t.colors.amber },
  });
