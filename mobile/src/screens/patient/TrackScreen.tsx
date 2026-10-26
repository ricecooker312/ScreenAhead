import React, { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../../api/client';
import { Paged, SymptomEntry } from '../../api/types';
import { useApi } from '../../hooks/useApi';
import { Body, Button, Card, Chip, EmptyState, ErrorState, Heading, Loading, Row, Screen, Title } from '../../components/ui';
import { SeverityTimeline } from '../../components/health';
import { RootStackParamList } from '../../navigation/types';

export function TrackScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { data, loading, error, reload } = useApi(() => api.get<Paged<SymptomEntry>>('/api/symptoms', { limit: 100 }), []);
  useFocusEffect(useCallback(() => void reload(), [reload]));
  const [type, setType] = useState<string | null>(null);

  const types = useMemo(() => Array.from(new Set((data?.items ?? []).map((s) => s.symptomType))), [data]);
  const selected = type ?? types[0] ?? null;
  const points = (data?.items ?? [])
    .filter((s) => s.symptomType === selected)
    .map((s) => ({ date: s.recordedAt, severity: s.severity }))
    .reverse();

  const remove = (id: string) =>
    Alert.alert('Delete this entry?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void api.del(`/api/symptoms/${id}`).then(reload) },
    ]);

  return (
    <Screen variant={3} testID="track-screen">
      <Title>Track how you feel</Title>
      <Body muted>Logging helps you remember details for your doctor.</Body>
      <Button title="Log a symptom" icon="➕" onPress={() => navigation.navigate('SymptomForm')} testID="add-symptom" />
      <Button title="My appointments" icon="📅" variant="secondary" onPress={() => navigation.navigate('Appointments')} />

      {loading && !data ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data?.items.length ? (
        <EmptyState emoji="📝" title="No entries yet" detail="Tap “Log a symptom” to add your first one." />
      ) : (
        <>
          <Card>
            <Heading>Your timeline</Heading>
            <Row>
              {types.map((t) => (
                <Chip key={t} label={t} selected={t === selected} onPress={() => setType(t)} />
              ))}
            </Row>
            <SeverityTimeline points={points} />
          </Card>
          <Heading>All entries</Heading>
          {data.items.map((s) => (
            <Card key={s._id}>
              <Body style={{ fontWeight: '700' }}>
                {s.symptomType}
                {s.severity ? ` · ${s.severity}/10` : ''}
              </Body>
              <Body muted>
                {new Date(s.recordedAt).toLocaleString()}
                {s.frequency ? ` · ${s.frequency}` : ''}
                {s.changeSinceLast && s.changeSinceLast !== 'first_entry' ? ` · ${s.changeSinceLast}` : ''}
              </Body>
              {s.interventions?.map((i) => (
                <Body key={i.measure} muted>
                  Tried: {i.measure} ({i.effect.replace('_', ' ')})
                </Body>
              ))}
              {s.notesForAppointment && <Body>For my doctor: {s.notesForAppointment}</Body>}
              <Button title="Delete" variant="ghost" onPress={() => remove(s._id)} />
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}
