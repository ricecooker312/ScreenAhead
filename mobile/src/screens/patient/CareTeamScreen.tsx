import React, { useCallback, useState } from 'react';
import { Alert, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../../api/client';
import { errorMessage, useApi } from '../../hooks/useApi';
import { Body, Button, Card, Chip, EmptyState, ErrorState, Heading, Loading, Pill, Row, Screen, Title } from '../../components/ui';
import { RootStackParamList } from '../../navigation/types';
import { colors } from '../../theme';

const SCOPES: [string, string][] = [
  ['summary', 'My health profile'],
  ['symptoms', 'My symptom log'],
  ['triage', 'My health check results'],
  ['medications', 'Medicines and allergies'],
  ['contact', 'My email and phone'],
  ['messages', 'Messages'],
];

interface Connection {
  _id: string;
  status: 'pending' | 'active';
  scopes: string[];
  codeExpiresAt?: string;
  clinician?: { displayName?: string; clinician?: { credentials?: string; specialty?: string; organization?: string } };
}

export function CareTeamScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'CareTeam'>) {
  const { data, loading, error, reload } = useApi(() => api.get<{ items: Connection[] }>('/api/connections'), []);
  useFocusEffect(useCallback(() => void reload(), [reload]));
  const [scopes, setScopes] = useState<string[]>(['summary', 'symptoms', 'triage', 'messages']);
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const toggle = (s: string) => setScopes((x) => (x.includes(s) ? x.filter((y) => y !== s) : [...x, s]));

  const createCode = async () => {
    setBusy(true);
    setActionError(null);
    try {
      setCode(await api.post('/api/connections/invite', { scopes }));
      void reload();
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const disconnect = (c: Connection) =>
    Alert.alert('Stop sharing?', 'This doctor will no longer see your information or message you here.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Stop sharing', style: 'destructive', onPress: () => void api.del(`/api/connections/${c._id}`).then(reload) },
    ]);

  const active = (data?.items ?? []).filter((c) => c.status === 'active');

  return (
    <Screen variant={5} testID="care-team-screen">
      <Title>My care team</Title>
      <Body muted>You choose what your doctor can see. You can stop sharing any time.</Body>

      <Card tint="#EAF3FF">
        <Heading>Connect with a doctor</Heading>
        <Body>1. Pick what to share.</Body>
        <Row>
          {SCOPES.map(([k, l]) => (
            <Chip key={k} label={l} selected={scopes.includes(k)} onPress={() => toggle(k)} />
          ))}
        </Row>
        <Body>2. Get a code and tell it to your doctor.</Body>
        <Button title="Get my share code" onPress={createCode} loading={busy} disabled={!scopes.length} testID="create-code" />
        {code && (
          <Card tint={colors.bubbleYellow} style={{ alignItems: 'center' }}>
            <Body>Your code</Body>
            <Text selectable style={{ fontSize: 36, fontWeight: '800', letterSpacing: 4, color: colors.text }} testID="share-code" accessibilityLabel={`Share code ${code.code.split('').join(' ')}`}>
              {code.code}
            </Text>
            <Body muted>Works once. Expires {new Date(code.expiresAt).toLocaleString()}.</Body>
          </Card>
        )}
        {actionError && <ErrorState message={actionError} />}
      </Card>

      <Heading>Connected</Heading>
      {loading && !data ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : active.length === 0 ? (
        <EmptyState emoji="🤝" title="No doctors connected yet" />
      ) : (
        active.map((c) => {
          const name = c.clinician?.displayName ?? 'Your clinician';
          return (
            <Card key={c._id}>
              <Heading>{name}</Heading>
              {c.clinician?.clinician && (
                <Body muted>{[c.clinician.clinician.credentials, c.clinician.clinician.specialty, c.clinician.clinician.organization].filter(Boolean).join(' · ')}</Body>
              )}
              <Row>
                {c.scopes.map((s) => (
                  <Pill key={s} text={SCOPES.find(([k]) => k === s)?.[1] ?? s} bg={colors.bubbleMint} />
                ))}
              </Row>
              {c.scopes.includes('messages') && (
                <Button title="Messages" icon="💬" onPress={() => navigation.navigate('MessageThread', { connectionId: c._id, title: name })} />
              )}
              <Button title="Stop sharing" variant="ghost" onPress={() => disconnect(c)} />
            </Card>
          );
        })
      )}
      <Body muted style={{ fontSize: 13 }}>Messages are not for emergencies. Your doctor may not see them right away.</Body>
    </Screen>
  );
}
