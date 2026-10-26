import React from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, TextInputProps, View } from 'react-native';
import { Control, Controller, FieldValues, Path } from 'react-hook-form';
import Slider from '@react-native-community/slider';
import { Body, FieldError } from './ui';
import { colors, MIN_TOUCH, radius, spacing } from '../theme';

export function TextField({
  label,
  hint,
  error,
  ...input
}: TextInputProps & { label: string; hint?: string; error?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label} nativeID={`${label}-label`}>
        {label}
      </Text>
      {hint && <Body muted style={{ fontSize: 15 }}>{hint}</Body>}
      <TextInput
        accessibilityLabel={label}
        accessibilityLabelledBy={`${label}-label`}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, error ? { borderColor: colors.error } : null, input.multiline && { minHeight: 96, textAlignVertical: 'top' }]}
        {...input}
      />
      <FieldError message={error} />
    </View>
  );
}

/** react-hook-form wrapper around TextField. */
export function FormField<T extends FieldValues>({
  control,
  name,
  label,
  hint,
  numeric,
  ...input
}: TextInputProps & { control: Control<T>; name: Path<T>; label: string; hint?: string; numeric?: boolean }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { value, onChange, onBlur }, fieldState }) => (
        <TextField
          label={label}
          hint={hint}
          error={fieldState.error?.message}
          value={value === undefined || value === null ? '' : String(value)}
          onChangeText={onChange}
          onBlur={onBlur}
          keyboardType={numeric ? 'numeric' : input.keyboardType}
          {...input}
        />
      )}
    />
  );
}

export function ToggleRow({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <Body>{label}</Body>
        {hint && <Body muted style={{ fontSize: 14 }}>{hint}</Body>}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.teal, false: colors.border }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

/**
 * 1–10 severity input. A slider plus − / + buttons (easier for many users and
 * for screen readers), with an optional "Not applicable".
 */
export function SeverityScale({
  value,
  onChange,
  allowNotApplicable,
  minLabel = 'Very mild',
  maxLabel = 'Worst ever',
}: {
  value: number | 'na' | undefined | null;
  onChange: (v: number | 'na') => void;
  allowNotApplicable?: boolean;
  minLabel?: string;
  maxLabel?: string;
}) {
  const n = typeof value === 'number' ? value : undefined;
  const faces = ['🙂', '🙂', '😐', '😐', '😕', '😕', '😣', '😣', '😖', '😫'];
  return (
    <View style={{ gap: spacing(1) }}>
      <View style={styles.scaleRow}>
        <StepButton label="Lower" symbol="−" onPress={() => onChange(Math.max(1, (n ?? 2) - 1))} />
        <View style={styles.scaleValue} accessible accessibilityLiveRegion="polite" accessibilityLabel={n ? `Severity ${n} out of 10` : 'No rating chosen'}>
          <Text style={{ fontSize: 34 }}>{n ? faces[n - 1] : '❔'}</Text>
          <Text style={styles.scaleNumber} testID="severity-value">
            {n ? `${n} / 10` : value === 'na' ? 'Not applicable' : 'Tap to choose'}
          </Text>
        </View>
        <StepButton label="Higher" symbol="+" onPress={() => onChange(Math.min(10, (n ?? 0) + 1))} />
      </View>
      <Slider
        testID="severity-slider"
        accessibilityLabel="Severity from 1 to 10"
        minimumValue={1}
        maximumValue={10}
        step={1}
        value={n ?? 1}
        onValueChange={(v: number) => onChange(Math.round(v))}
        minimumTrackTintColor={colors.teal}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.primary}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Body muted style={{ fontSize: 14 }}>1 · {minLabel}</Body>
        <Body muted style={{ fontSize: 14 }}>10 · {maxLabel}</Body>
      </View>
      {allowNotApplicable && (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: value === 'na' }}
          onPress={() => onChange('na')}
          style={[styles.naButton, value === 'na' && { borderColor: colors.primary, backgroundColor: '#EAF3FF' }]}
          testID="severity-na"
        >
          <Body>{value === 'na' ? '✓ ' : ''}Not applicable</Body>
        </Pressable>
      )}
    </View>
  );
}

function StepButton({ label, symbol, onPress }: { label: string; symbol: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.step} testID={`severity-${label.toLowerCase()}`}>
      <Text style={{ fontSize: 28, color: colors.primary, fontWeight: '800' }}>{symbol}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 17, fontWeight: '700', color: colors.text },
  input: {
    minHeight: MIN_TOUCH + 4,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1.25),
    fontSize: 17,
    color: colors.text,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), minHeight: MIN_TOUCH },
  scaleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scaleValue: { alignItems: 'center', flex: 1 },
  scaleNumber: { fontSize: 20, fontWeight: '800', color: colors.text },
  step: {
    width: MIN_TOUCH + 8,
    height: MIN_TOUCH + 8,
    borderRadius: (MIN_TOUCH + 8) / 2,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  naButton: {
    minHeight: MIN_TOUCH,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
});
