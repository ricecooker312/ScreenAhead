import React, { useEffect, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../../api/client';
import { errorMessage } from '../../hooks/useApi';
import { Body, Button, Card, Chip, ErrorState, Heading, Loading, Row, Screen, Term, Title } from '../../components/ui';
import { FormField } from '../../components/forms';
import { RootStackParamList } from '../../navigation/types';
import { colors } from '../../theme';

const optionalNumber = (min: number, max: number) =>
  z
    .string()
    .optional()
    .refine((v) => !v || (Number(v) >= min && Number(v) <= max), `Enter a number from ${min} to ${max}`);

const schema = z.object({
  age: optionalNumber(0, 120),
  heightCm: optionalNumber(30, 260),
  weightKg: optionalNumber(2, 400),
  conditions: z.string().max(1000).optional(),
  cancerType: z.string().max(120).optional(),
  cancerStatus: z.enum(['current', 'remission', 'unknown']).optional(),
  currentTreatments: z.string().max(500).optional(),
  previousTreatments: z.string().max(500).optional(),
  allergies: z.string().max(1000).optional(),
  medications: z.string().max(1000).optional(),
  familyHistory: z.string().max(1000).optional(),
  hereditary: z.string().max(300).optional(),
  smoking: z.enum(['never', 'former', 'current', 'prefer_not']).optional(),
  alcohol: z.enum(['none', 'occasional', 'one_two_daily', 'three_plus_daily', 'prefer_not']).optional(),
  dietPattern: z.string().max(500).optional(),
  bowelHabits: z.string().max(500).optional(),
  providers: z.string().max(500).optional(),
  postalCode: z.string().max(12).optional(),
});
type Form = z.infer<typeof schema>;

const list = (s?: string) => (s ?? '').split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
const num = (s?: string) => (s ? Number(s) : undefined);

/** Converts the simple form into the API profile shape. */
export function toProfile(v: Form) {
  return {
    age: num(v.age),
    heightCm: num(v.heightCm),
    weightKg: num(v.weightKg),
    medicalConditions: list(v.conditions),
    cancerHistory: v.cancerType ? [{ cancerType: v.cancerType, status: v.cancerStatus ?? 'unknown' }] : [],
    currentTreatments: list(v.currentTreatments),
    previousTreatments: list(v.previousTreatments),
    allergies: list(v.allergies).map((a) => {
      const [substance, ...reaction] = a.split(':');
      return { substance: substance.trim(), reaction: reaction.join(':').trim() || undefined };
    }),
    medications: list(v.medications).map((name) => ({
      name,
      containsAcetaminophen: /acetaminophen|paracetamol|tylenol/i.test(name) ? 'yes' : 'unknown',
    })),
    familyHistory: list(v.familyHistory).map((condition) => ({ relation: 'other', condition })),
    hereditarySyndromes: list(v.hereditary),
    smoking: v.smoking,
    alcohol: v.alcohol,
    dietPattern: v.dietPattern || undefined,
    bowelHabits: v.bowelHabits || undefined,
    existingProviders: list(v.providers).map((name) => ({ name })),
    postalCode: v.postalCode || undefined,
  };
}

function fromProfile(p: any): Form {
  const s = (n?: number) => (n === undefined || n === null ? '' : String(n));
  return {
    age: s(p.age),
    heightCm: s(p.heightCm),
    weightKg: s(p.weightKg),
    conditions: (p.medicalConditions ?? []).join(', '),
    cancerType: p.cancerHistory?.[0]?.cancerType ?? '',
    cancerStatus: p.cancerHistory?.[0]?.status,
    currentTreatments: (p.currentTreatments ?? []).join(', '),
    previousTreatments: (p.previousTreatments ?? []).join(', '),
    allergies: (p.allergies ?? []).map((a: any) => (a.reaction ? `${a.substance}: ${a.reaction}` : a.substance)).join('\n'),
    medications: (p.medications ?? []).map((m: any) => m.name).join('\n'),
    familyHistory: (p.familyHistory ?? []).map((f: any) => f.condition).filter(Boolean).join('\n'),
    hereditary: (p.hereditarySyndromes ?? []).join(', '),
    smoking: p.smoking,
    alcohol: p.alcohol,
    dietPattern: p.dietPattern ?? '',
    bowelHabits: p.bowelHabits ?? '',
    providers: (p.existingProviders ?? []).map((x: any) => x.name).filter(Boolean).join(', '),
    postalCode: p.postalCode ?? '',
  };
}

function Choice<T extends string>({ value, onChange, options }: { value?: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <Row>
      {options.map(([v, l]) => (
        <Chip key={v} label={l} selected={value === v} onPress={() => onChange(v)} />
      ))}
    </Row>
  );
}

export function HealthProfileScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'HealthProfile'>) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const { control, handleSubmit, reset, formState } = useForm<Form>({ resolver: zodResolver(schema) });

  useEffect(() => {
    api
      .get('/api/health-profile')
      .then((p) => reset(fromProfile(p)))
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoaded(true));
  }, [reset]);

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    setSaved(false);
    try {
      await api.put('/api/health-profile', toProfile(v));
      setSaved(true);
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  if (!loaded) return <Screen scroll={false}><Loading /></Screen>;

  return (
    <Screen variant={3}>
      <Title>Health profile</Title>
      <Body muted>Everything here is optional. Add only what you are comfortable with. It helps us keep tips safe for you.</Body>

      <Card>
        <Heading>About you</Heading>
        <FormField control={control} name="age" label="Age" numeric hint="Screening advice depends partly on age." />
        <FormField control={control} name="heightCm" label="Height (cm)" numeric />
        <FormField control={control} name="weightKg" label="Weight (kg)" numeric />
        <FormField control={control} name="postalCode" label="ZIP / postal code" hint="Only used to find care near you." />
      </Card>

      <Card>
        <Heading>Health history</Heading>
        <FormField control={control} name="conditions" label="Health conditions" hint="Separate with commas. Example: diabetes, liver disease" multiline />
        <FormField control={control} name="cancerType" label="Past or current cancer (type)" />
        <Controller control={control} name="cancerStatus" render={({ field }) => (
          <Choice value={field.value} onChange={field.onChange} options={[['current', 'I have it now'], ['remission', 'In remission'], ['unknown', 'Not sure']]} />
        )} />
        <Body muted style={{ fontSize: 15 }}>
          <Term word="remission" />
        </Body>
        <FormField control={control} name="currentTreatments" label="Current treatments" />
        <FormField control={control} name="previousTreatments" label="Past treatments" />
      </Card>

      <Card tint={colors.bubblePeach}>
        <Heading>Medicines & allergies</Heading>
        <Body muted>We use this to avoid unsafe medicine tips.</Body>
        <FormField control={control} name="medications" label="Medicines I take" hint="One per line" multiline />
        <FormField control={control} name="allergies" label="Allergies or bad reactions" hint="One per line. Example: Penicillin: rash" multiline />
      </Card>

      <Card tint={colors.bubbleLavender}>
        <Heading>Family & genes</Heading>
        <FormField control={control} name="familyHistory" label="Cancer in close family" hint="Example: Mother — colon cancer at 58" multiline />
        <FormField control={control} name="hereditary" label="Inherited conditions or genetic test results" hint="Example: Lynch syndrome" />
      </Card>

      <Card>
        <Heading>Habits</Heading>
        <Body>Smoking</Body>
        <Controller control={control} name="smoking" render={({ field }) => (
          <Choice value={field.value} onChange={field.onChange} options={[['never', 'Never'], ['former', 'Used to'], ['current', 'Yes'], ['prefer_not', 'Prefer not to say']]} />
        )} />
        <Body>Alcohol</Body>
        <Controller control={control} name="alcohol" render={({ field }) => (
          <Choice
            value={field.value}
            onChange={field.onChange}
            options={[['none', 'None'], ['occasional', 'Now and then'], ['one_two_daily', '1–2 a day'], ['three_plus_daily', '3+ a day'], ['prefer_not', 'Prefer not to say']]}
          />
        )} />
        <FormField control={control} name="dietPattern" label="How I usually eat (optional)" multiline />
        <FormField control={control} name="bowelHabits" label="My usual bowel habits (optional)" multiline />
        <FormField control={control} name="providers" label="My doctors (optional)" hint="Separate with commas" />
      </Card>

      {error && <ErrorState message={error} />}
      {saved && (
        <Card tint={colors.routineBg}>
          <Body accessibilityLiveRegion="polite">Saved ✓</Body>
        </Card>
      )}
      <Button title="Save profile" onPress={onSubmit} loading={formState.isSubmitting} testID="save-profile" />
      <Button title="Done" variant="ghost" onPress={() => navigation.goBack()} />
    </Screen>
  );
}
