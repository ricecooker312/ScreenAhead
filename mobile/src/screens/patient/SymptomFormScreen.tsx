import React, { useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../../api/client';
import { Body, Button, Card, Chip, ErrorState, Heading, Radio, Row, Screen, Title } from '../../components/ui';
import { FormField, SeverityScale } from '../../components/forms';
import { errorMessage } from '../../hooks/useApi';
import { RootStackParamList } from '../../navigation/types';
import { colors } from '../../theme';

const COMMON = ['Belly pain', 'Bloating', 'Tiredness', 'Diarrhea', 'Constipation', 'Nausea', 'Blood in stool', 'Poor appetite'];
const MEASURES = ['Rest', 'Changing position', 'Warm pack', 'Cold pack', 'Relaxing', 'Medicine from my doctor'];

export const symptomSchema = z.object({
  symptomType: z.string().trim().min(1, 'What symptom are you logging?').max(80),
  severity: z.union([z.number().int().min(1).max(10), z.literal('na')]).optional(),
  frequency: z.enum(['constant', 'intermittent', 'occasional', 'once']).optional(),
  changeSinceLast: z.enum(['better', 'same', 'worse', 'first_entry']).optional(),
  durationText: z.string().max(120).optional(),
  measure: z.string().optional(),
  effect: z.enum(['helped', 'no_difference', 'worse', 'unsure']).optional(),
  notesForAppointment: z.string().max(2000).optional(),
});
type Form = z.infer<typeof symptomSchema>;

export function SymptomFormScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'SymptomForm'>) {
  const [error, setError] = useState<string | null>(null);
  const [nudge, setNudge] = useState<string | null>(null);
  const { control, handleSubmit, watch, setValue, formState } = useForm<Form>({ resolver: zodResolver(symptomSchema), defaultValues: { symptomType: '' } });
  const measure = watch('measure');

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      const r = await api.post<{ safetyNudge: string | null }>('/api/symptoms', {
        symptomType: v.symptomType,
        severity: typeof v.severity === 'number' ? v.severity : null,
        frequency: v.frequency,
        changeSinceLast: v.changeSinceLast,
        durationText: v.durationText || undefined,
        interventions: v.measure ? [{ measure: v.measure, effect: v.effect ?? 'unsure' }] : undefined,
        notesForAppointment: v.notesForAppointment || undefined,
      });
      if (r.safetyNudge) setNudge(r.safetyNudge);
      else navigation.goBack();
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  if (nudge) {
    return (
      <Screen>
        <Card tint={colors.promptBg}>
          <Heading style={{ color: colors.promptText }}>Saved. One more thing…</Heading>
          <Body style={{ color: colors.promptText }}>{nudge}</Body>
          <Button title="Take the quick safety check" onPress={() => navigation.replace('Questionnaire', { restart: true })} />
          <Button title="Done" variant="ghost" onPress={() => navigation.goBack()} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen variant={1}>
      <Title>Log a symptom</Title>
      <Card>
        <Heading>What are you feeling?</Heading>
        <Row>
          {COMMON.map((c) => (
            <Chip key={c} label={c} selected={watch('symptomType') === c} onPress={() => setValue('symptomType', c, { shouldValidate: true })} />
          ))}
        </Row>
        <FormField control={control} name="symptomType" label="Or type it" testID="symptom-type" />
      </Card>
      <Card>
        <Heading>How strong is it?</Heading>
        <Controller control={control} name="severity" render={({ field }) => <SeverityScale value={field.value} onChange={field.onChange} allowNotApplicable />} />
      </Card>
      <Card>
        <Heading>How often?</Heading>
        <Controller
          control={control}
          name="frequency"
          render={({ field }) => (
            <>
              {[
                ['constant', 'All the time'],
                ['intermittent', 'Comes and goes'],
                ['occasional', 'Once in a while'],
                ['once', 'Just once'],
              ].map(([v, l]) => (
                <Radio key={v} label={l} selected={field.value === v} onPress={() => field.onChange(v)} />
              ))}
            </>
          )}
        />
        <FormField control={control} name="durationText" label="How long has it lasted? (optional)" placeholder="e.g. 3 days" />
      </Card>
      <Card>
        <Heading>Compared to last time?</Heading>
        <Controller
          control={control}
          name="changeSinceLast"
          render={({ field }) => (
            <Row>
              {[
                ['better', 'Better'],
                ['same', 'Same'],
                ['worse', 'Worse'],
                ['first_entry', 'First time'],
              ].map(([v, l]) => (
                <Chip key={v} label={l} selected={field.value === v} onPress={() => field.onChange(v)} />
              ))}
            </Row>
          )}
        />
      </Card>
      <Card>
        <Heading>Did you try anything?</Heading>
        <Row>
          {MEASURES.map((m) => (
            <Chip key={m} label={m} selected={measure === m} onPress={() => setValue('measure', measure === m ? undefined : m)} />
          ))}
        </Row>
        {measure && (
          <Controller
            control={control}
            name="effect"
            render={({ field }) => (
              <Row>
                {[
                  ['helped', 'It helped'],
                  ['no_difference', 'No change'],
                  ['worse', 'Made it worse'],
                ].map(([v, l]) => (
                  <Chip key={v} label={l} selected={field.value === v} onPress={() => field.onChange(v)} />
                ))}
              </Row>
            )}
          />
        )}
      </Card>
      <Card>
        <FormField control={control} name="notesForAppointment" label="Note for my next appointment (optional)" multiline />
      </Card>
      {error && <ErrorState message={error} />}
      <Button title="Save" onPress={onSubmit} loading={formState.isSubmitting} testID="save-symptom" />
    </Screen>
  );
}
