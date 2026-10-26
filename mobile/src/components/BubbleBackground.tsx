import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { colors } from '../theme';

const BUBBLES = [
  { color: colors.bubbleBlue, size: 0.75, top: -0.12, left: -0.25 },
  { color: colors.bubblePink, size: 0.45, top: 0.08, left: 0.7 },
  { color: colors.bubbleMint, size: 0.6, top: 0.42, left: -0.28 },
  { color: colors.bubbleLavender, size: 0.38, top: 0.55, left: 0.72 },
  { color: colors.bubblePeach, size: 0.5, top: 0.82, left: 0.15 },
  { color: colors.bubbleYellow, size: 0.22, top: 0.3, left: 0.45 },
  { color: colors.bubbleMint, size: 0.12, top: 0.18, left: 0.08 },
  { color: colors.bubblePink, size: 0.16, top: 0.7, left: 0.55 },
  { color: colors.bubbleBlue, size: 0.09, top: 0.92, left: 0.82 },
];

/**
 * Soft pastel circles behind every screen. Purely decorative: hidden from
 * screen readers and never placed behind text without a solid card on top.
 */
export function BubbleBackground({ variant = 0 }: { variant?: number }) {
  const { width, height } = useWindowDimensions();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {BUBBLES.map((b, i) => {
        const d = b.size * width;
        const shift = ((variant + i) % 3) * 0.04;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              width: d,
              height: d,
              borderRadius: d / 2,
              backgroundColor: b.color,
              opacity: 0.85,
              top: (b.top + shift) * height,
              left: (b.left - shift) * width,
            }}
          />
        );
      })}
    </View>
  );
}
