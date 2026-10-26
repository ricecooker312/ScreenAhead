import React, { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../../api/client';
import { Appointment, Paged } from '../../api/types';
import { errorMessage, useApi } from '../../hooks/useApi';
import { Body, Button, Card, EmptyState, ErrorState, Heading, Loading, Pill, Screen, Title } from '../../components/ui';
import { FormField } from '../../components/forms';
import { RootStackParamList } from '../../navigation/types';

export function AppointmentsScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Appointments'>) {
  const { data, loading, error, reload } = useApi(() => api.get<Paged<Appointment>>('/api/appointments', { upcoming: true }), []);
  useFocusEffect(useCallback(() => void reload(), [reload]));

  const setStatus = async (a: Appointment, status: string) => {
    await api.patch(`/api/appointments/${a._id}`, { status });
    void reload();
  };
  const remove = (a: Appointment) =>
    Alert.alert('Delete appointment?', a.title, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void api.del(`/api/appointments/${a._id}`).then(reload) },
    ]);

  return (
    <Screen variant={4}>
      <Title>Appointments</Title>
      <Body muted>Keep track of visits and the questions you want to ask.</Body>
      <Button title="Add appointment" icon="➕" onPress={() => navigation.navigate('AppointmentForm')} />
      {loading && !data ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data?.items.length ? (
        <EmptyState emoji="📅" title="No upcoming appointments" />
      ) : (
        data.items.map((a) => (
          <Card key={a._id}>
            <Pill text={a.status} />
            <Heading>{a.title}</Heading>
            <Body>{new Date(a.startsAt).toLocaleString()}</Body>
            {a.providerName && <Body muted>With {a.providerName}</Body>}
            {a.location && <Body muted>{a.location}</Body>}
            {a.questionsToAsk?.map((q) => (
              <Body key={q}>❓ {q}</Body>
            ))}
            {a.status === 'planned' && <Button title="Mark as confirmed" variant="secondary" onPress={() => void setStatus(a, 'confirmed')} />}
            <Button title="Delete" variant="ghost" onPress={() => remove(a)} />
          </Card>
        ))
      )}
      <Body muted style={{ fontSize: 13 }}>Adding an appointment here does not book it with the office.</Body>
    </Screen>
  );
}

const schema = z.object({
  title: z.string().trim().min(1, 'Add a short title').max(160),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use year-month-day, like 2026-11-03'),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour time, like 14:30'),
  providerName: z.string().max(160).optional(),
  location: z.string().max(200).optional(),
  questions: z.string().max(3000).optional(),
  notes: z.string().max(2000).optional(),
});
type Form = z.infer<typeof schema>;

export function AppointmentFormScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'AppointmentForm'>) {
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { title: route.params?.providerName ? `Visit with ${route.params.providerName}` : '', providerName: route.params?.providerName },
  });
  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    const startsAt = new Date(`${v.date}T${v.time}:00`);
    if (Number.isNaN(startsAt.getTime())) return setError('That date does not look right.');
    try {
      await api.post('/api/appointments', {
        title: v.title,
        startsAt: startsAt.toISOString(),
        providerId: route.params?.providerId,
        providerName: v.providerName || undefined,
        location: v.location || undefined,
        notes: v.notes || undefined,
        questionsToAsk: (v.questions ?? '').split('\n').map((q) => q.trim()).filter(Boolean),
      });
      navigation.goBack();
    } catch (e) {
      setError(errorMessage(e));
    }
  });
  return (
    <Screen variant={2}>
      <Title>Add appointment</Title>
      <Card>
        <FormField control={control} name="title" label="What is it for?" />
        <FormField control={control} name="date" label="Date" placeholder="2026-11-03" />
        <FormField control={control} name="time" label="Time" placeholder="14:30" />
        <FormField control={control} name="providerName" label="Doctor or clinic (optional)" />
        <FormField control={control} name="location" label="Where (optional)" />
      </Card>
      <Card>
        <Heading>Questions to ask</Heading>
        <FormField control={control} name="questions" label="One question per line" multiline />
        <FormField control={control} name="notes" label="Other notes (optional)" multiline />
      </Card>
      {error && <ErrorState message={error} />}
      <Button title="Save" onPress={onSubmit} loading={formState.isSubmitting} />
    </Screen>
  );
}
