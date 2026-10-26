import React, { useCallback, useState } from 'react';
import { Pressable } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { errorMessage, useApi } from '../../hooks/useApi';
import { Body, Button, Card, EmptyState, ErrorState, Heading, Loading, Pill, Row, Screen, Title } from '../../components/ui';
import { TextField } from '../../components/forms';
import { RootStackParamList } from '../../navigation/types';
import { careLevelStyle, colors } from '../../theme';

export interface PatientConnection {
  _id: string;
  scopes: string[];
  patient: { _id: string; displayName?: string };
  unreadCount: number;
  latestGuidance: { careLevel: string; createdAt: string } | null;
  needsAttention: boolean;
  acceptedAt?: string;
}

/** Clinician home: patients who need attention first, plus connect-by-code. */
export function ClinicianPatientsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const verified = user?.clinician?.verificationStatus === 'verified';
  const { data, loading, error, reload } = useApi(
    () => (verified ? api.get<{ items: PatientConnection[] }>('/api/connections') : Promise.resolve({ items: [] })),
    [verified],
  );
  useFocusEffect(useCallback(() => void reload(), [reload]));
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const connect = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api.post('/api/connections/accept', { code: code.trim() });
      setCode('');
      setMsg({ ok: true, text: 'Connected! The patient now appears in your list.' });
      void reload();
    } catch (e) {
      setMsg({ ok: false, text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen variant={0} testID="clinician-patients">
      <Title>My patients</Title>
      {!verified ? (
        <Card tint={colors.infoBg}>
          <Heading style={{ color: colors.infoText }}>Verification pending</Heading>
          <Body style={{ color: colors.infoText }}>
            We are checking your credentials. Once verified, you can connect with patients using their share code.
          </Body>
        </Card>
      ) : (
        <Card tint="#EAF3FF">
          <Heading>Connect with a patient</Heading>
          <Body muted>Ask your patient for the code shown in their app (Me → Care team).</Body>
          <TextField label="Patient share code" placeholder="ABCD-EF23" autoCapitalize="characters" value={code} onChangeText={setCode} testID="code-input" />
          <Button title="Connect" onPress={connect} loading={busy} disabled={code.trim().length < 8} testID="connect-code" />
          {msg && (
            <Body style={{ color: msg.ok ? colors.routineText : colors.error }} accessibilityRole="alert">
              {msg.text}
            </Body>
          )}
        </Card>
      )}

      {loading && !data ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : verified && !data?.items.length ? (
        <EmptyState emoji="👥" title="No patients connected yet" />
      ) : (
        data?.items.map((c) => {
          const level = c.latestGuidance ? careLevelStyle[c.latestGuidance.careLevel] : null;
          const name = c.patient.displayName ?? 'Patient';
          return (
            <Pressable
              key={c._id}
              accessibilityRole="button"
              accessibilityLabel={`${name}${c.needsAttention ? ', needs attention' : ''}${c.unreadCount ? `, ${c.unreadCount} unread messages` : ''}`}
              onPress={() => navigation.navigate('PatientDetail', { connectionId: c._id, name })}
            >
              <Card style={c.needsAttention ? { borderWidth: 2, borderColor: colors.promptText } : undefined}>
                <Heading>{name}</Heading>
                <Row>
                  {c.needsAttention && <Pill text="Needs attention" bg={colors.promptBg} color={colors.promptText} />}
                  {c.unreadCount > 0 && <Pill text={`💬 ${c.unreadCount} new`} bg={colors.bubbleBlue} />}
                  {level && <Pill text={`Last check: ${level.label}`} bg={level.bg} color={level.text} />}
                </Row>
                {c.latestGuidance && <Body muted>Checked {new Date(c.latestGuidance.createdAt).toLocaleDateString()}</Body>}
              </Card>
            </Pressable>
          );
        })
      )}
    </Screen>
  );
}
