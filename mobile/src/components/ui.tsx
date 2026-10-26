import React, { createContext, useContext } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextProps,
  View,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BubbleBackground } from './BubbleBackground';
import { colors, MIN_TOUCH, radius, spacing } from '../theme';
import { define } from '../content/glossary';

/** Text size preferences from the user's settings. */
export const DisplayPrefs = createContext({ scale: 1, showDefinitions: true });
const useScale = () => useContext(DisplayPrefs).scale;

export function Screen({
  children,
  scroll = true,
  variant = 0,
  testID,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  variant?: number;
  testID?: string;
}) {
  const body = scroll ? (
    <ScrollView contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.screenContent, { flex: 1 }]}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']} testID={testID}>
      <BubbleBackground variant={variant} />
      {body}
    </SafeAreaView>
  );
}

export function Title({ children, style, ...p }: TextProps & { children: React.ReactNode }) {
  const s = useScale();
  return (
    <Text accessibilityRole="header" style={[styles.title, { fontSize: 28 * s, lineHeight: 34 * s }, style]} {...p}>
      {children}
    </Text>
  );
}

export function Heading({ children, style, ...p }: TextProps & { children: React.ReactNode }) {
  const s = useScale();
  return (
    <Text accessibilityRole="header" style={[styles.heading, { fontSize: 20 * s, lineHeight: 26 * s }, style]} {...p}>
      {children}
    </Text>
  );
}

export function Body({ children, muted, style, ...p }: TextProps & { children: React.ReactNode; muted?: boolean }) {
  const s = useScale();
  return (
    <Text style={[styles.body, { fontSize: 17 * s, lineHeight: 25 * s }, muted && { color: colors.textMuted }, style]} {...p}>
      {children}
    </Text>
  );
}

/**
 * A hard word followed by its meaning in brackets, e.g.
 * "colonoscopy (a test where a doctor looks inside your bowel with a thin camera)".
 */
export function Term({ word, display }: { word: string; display?: string }) {
  const { showDefinitions } = useContext(DisplayPrefs);
  const meaning = define(word);
  const shown = display ?? word;
  if (!meaning || !showDefinitions) return <Text style={styles.term}>{shown}</Text>;
  return (
    <Text>
      <Text style={styles.term}>{shown}</Text>
      <Text style={styles.definition}> ({meaning})</Text>
    </Text>
  );
}

export function Card({ children, style, tint }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; tint?: string }) {
  return <View style={[styles.card, tint ? { backgroundColor: tint } : null, style]}>{children}</View>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  accessibilityHint,
  testID,
  icon,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
  testID?: string;
  icon?: string;
}) {
  const s = useScale();
  const v = buttonVariants[variant];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [styles.button, v.container, (disabled || loading) && { opacity: 0.55 }, pressed && { transform: [{ scale: 0.98 }] }]}
    >
      {loading ? (
        <ActivityIndicator color={v.text.color} />
      ) : (
        <Text style={[styles.buttonText, v.text, { fontSize: 17 * s }]}>
          {icon ? `${icon}  ` : ''}
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const buttonVariants = {
  primary: { container: { backgroundColor: colors.primary }, text: { color: '#FFFFFF' } },
  secondary: { container: { backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.primary }, text: { color: colors.primary } },
  ghost: { container: { backgroundColor: 'transparent' }, text: { color: colors.primary } },
  danger: { container: { backgroundColor: colors.emergencyButton }, text: { color: '#FFFFFF' } },
};

export function Chip({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const s = useScale();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, { fontSize: 16 * s }, selected && { color: '#FFFFFF' }]}>
        {selected ? '✓ ' : ''}
        {label}
      </Text>
    </Pressable>
  );
}

export function Radio({ label, selected, onPress, testID }: { label: string; selected: boolean; onPress: () => void; testID?: string }) {
  const s = useScale();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.radio, selected && styles.radioSelected]}
    >
      <View style={[styles.radioDot, selected && styles.radioDotSelected]} />
      <Text style={[styles.body, { flex: 1, fontSize: 17 * s }]}>{label}</Text>
    </Pressable>
  );
}

export function Pill({ text, bg = colors.bubbleBlue, color = colors.text }: { text: string; bg?: string; color?: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={{ color, fontWeight: '600', fontSize: 13 }}>{text}</Text>
    </View>
  );
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct * 100}%` }]} />
      </View>
      <Body muted style={{ fontSize: 14, marginTop: 4 }}>
        {label}
      </Body>
    </View>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.center} accessibilityLiveRegion="polite">
      <ActivityIndicator size="large" color={colors.primary} />
      <Body muted style={{ marginTop: 12 }}>
        {label}
      </Body>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card tint={colors.emergencyBg}>
      <Body style={{ color: colors.emergencyText }} accessibilityRole="alert">
        {message}
      </Body>
      {onRetry && <Button title="Try again" variant="secondary" onPress={onRetry} />}
    </Card>
  );
}

export function EmptyState({ emoji = '🫧', title, detail, action }: { emoji?: string; title: string; detail?: string; action?: React.ReactNode }) {
  return (
    <Card style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 36 }} accessibilityElementsHidden>
        {emoji}
      </Text>
      <Heading style={{ textAlign: 'center' }}>{title}</Heading>
      {detail && <Body muted style={{ textAlign: 'center' }}>{detail}</Body>}
      {action}
    </Card>
  );
}

export function Row({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1) }, style]}>{children}</View>;
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <Text style={styles.fieldError} accessibilityRole="alert">
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  screenContent: { padding: spacing(2.5), paddingBottom: spacing(6), gap: spacing(2) },
  title: { color: colors.text, fontWeight: '800' },
  heading: { color: colors.text, fontWeight: '700' },
  body: { color: colors.text },
  term: { fontWeight: '700', color: colors.text },
  definition: { color: colors.textMuted, fontStyle: 'italic' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing(2.5),
    gap: spacing(1.5),
    shadowColor: '#5B7BA6',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  button: {
    minHeight: MIN_TOUCH + 6,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(3),
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontWeight: '700' },
  chip: {
    minHeight: MIN_TOUCH,
    paddingHorizontal: spacing(2),
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: colors.primary },
  chipText: { color: colors.primary, fontWeight: '600' },
  radio: {
    minHeight: MIN_TOUCH + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1),
  },
  radioSelected: { borderColor: colors.primary, backgroundColor: '#EAF3FF' },
  radioDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.textMuted },
  radioDotSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  pill: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 4 },
  progressTrack: { height: 12, borderRadius: 6, backgroundColor: colors.bubbleBlue, overflow: 'hidden' },
  progressFill: { height: 12, borderRadius: 6, backgroundColor: colors.teal },
  center: { alignItems: 'center', justifyContent: 'center', padding: spacing(4) },
  fieldError: { color: colors.error, fontSize: 15, fontWeight: '600' },
});
