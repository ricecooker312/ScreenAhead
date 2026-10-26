import React, { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Body, Button, Card, Heading, Pill } from './ui';
import { careLevelStyle, colors, spacing } from '../theme';
import { EMERGENCY_NUMBER } from '../config';
import { Warning } from '../api/types';

export const callEmergency = () => Linking.openURL(`tel:${EMERGENCY_NUMBER}`);

/** Always-available, low-key emergency reminder. */
export function EmergencyFooter() {
  return (
    <Pressable onPress={callEmergency} accessibilityRole="button" accessibilityLabel={`In an emergency, call ${EMERGENCY_NUMBER}`}>
      <Body muted style={{ textAlign: 'center', fontSize: 14 }}>
        In an emergency, call {EMERGENCY_NUMBER} 📞
      </Body>
    </Pressable>
  );
}

/** Prominent, calm emergency panel with a one-tap call button. */
export function EmergencyPanel({ warnings, onSafe }: { warnings: Warning[]; onSafe?: () => void }) {
  return (
    <Card tint={colors.emergencyBg} style={{ borderWidth: 3, borderColor: colors.emergencyButton }}>
      <Text style={{ fontSize: 44, textAlign: 'center' }} accessibilityElementsHidden>
        🚑
      </Text>
      <Heading style={{ color: colors.emergencyText, textAlign: 'center', fontSize: 26, lineHeight: 32 }} accessibilityRole="alert">
        Please get emergency help now
      </Heading>
      <Body style={{ color: colors.emergencyText, textAlign: 'center' }}>
        {warnings[0]?.message ?? `Call ${EMERGENCY_NUMBER} or your local emergency number now.`}
      </Body>
      <Button title={`Call ${EMERGENCY_NUMBER}`} icon="📞" variant="danger" onPress={callEmergency} testID="call-emergency" />
      <View style={{ gap: spacing(1) }}>
        <Body style={{ fontWeight: '700', color: colors.emergencyText }}>Why we are showing this:</Body>
        {warnings.map((w) => (
          <Body key={w.ruleId} style={{ color: colors.emergencyText }}>
            • {w.explanation}
          </Body>
        ))}
      </View>
      <Body muted style={{ fontSize: 14 }}>Outside the U.S.? Call your local emergency number. Do not drive yourself.</Body>
      {onSafe && <Button title="Go back" variant="ghost" onPress={onSafe} />}
    </Card>
  );
}

export function CareLevelBanner({ level, headline }: { level: string; headline: string }) {
  const s = careLevelStyle[level] ?? careLevelStyle.insufficient_information;
  return (
    <Card tint={s.bg}>
      <Text style={{ fontSize: 34 }} accessibilityElementsHidden>
        {s.emoji}
      </Text>
      <Pill text={s.label} bg="#FFFFFF" color={s.text} />
      <Heading style={{ color: s.text, fontSize: 24, lineHeight: 30 }}>{headline}</Heading>
    </Card>
  );
}

/** Collapsible "Why am I seeing this?" explanations. */
export function WhyThis({ items }: { items: { title: string; explanation: string }[] }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <View>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={{ minHeight: 48, justifyContent: 'center' }}>
        <Body style={{ color: colors.primary, fontWeight: '700' }}>{open ? '▾' : '▸'} Why am I seeing this?</Body>
      </Pressable>
      {open &&
        items.map((i) => (
          <Body key={i.title} muted>
            • <Text style={{ fontWeight: '700' }}>{i.title}:</Text> {i.explanation}
          </Body>
        ))}
    </View>
  );
}

export function Disclaimers({ items }: { items: string[] }) {
  return (
    <Card tint="#F7F9FC">
      <Body style={{ fontWeight: '700' }}>Please remember</Body>
      {items.map((d) => (
        <Body key={d} muted style={{ fontSize: 15 }}>
          • {d}
        </Body>
      ))}
    </Card>
  );
}

/** Simple bar timeline of the user's own self-reported severity. */
export function SeverityTimeline({ points }: { points: { date: string; severity?: number }[] }) {
  const shown = points.filter((p) => typeof p.severity === 'number').slice(-14);
  if (shown.length < 2) return <Body muted>Log a few entries to see your timeline.</Body>;
  const summary = shown.map((p) => `${new Date(p.date).toLocaleDateString()}: ${p.severity}`).join(', ');
  return (
    <View accessible accessibilityLabel={`Your severity over time: ${summary}`}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 6 }}>
        {shown.map((p, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
            <Text style={{ fontSize: 11, color: colors.textMuted }}>{p.severity}</Text>
            <View
              style={{
                width: '100%',
                height: `${(p.severity! / 10) * 85}%`,
                backgroundColor: [colors.bubbleMint, colors.bubbleBlue, colors.bubbleLavender, colors.bubblePink][i % 4],
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            />
          </View>
        ))}
      </View>
      <Body muted style={{ fontSize: 13, marginTop: 6 }}>
        This shows what you logged. Feeling better on the chart does not prove a health problem is gone.
      </Body>
    </View>
  );
}
