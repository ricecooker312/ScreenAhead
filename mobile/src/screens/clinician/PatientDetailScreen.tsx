import React, { useState } from 'react';
import { Alert, Linking, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../../api/client';
import { errorMessage, useApi } from '../../hooks/useApi';
import { Body, Button, Card, ErrorState, Heading, Loading, Pill, Row, Screen } from '../../components/ui';
import { RootStackParamList } from '../../navigation/types';
import { colors } from '../../theme';

interface PatientSummary {
  connectionId: string;
  scopes: string[];
  patient: { displayName: string; contact: { email?: string; phone?: string | null } | null };
  summary: { text: string; sections: string[] };
}

const SCOPE_LABELS: Record<string, string> = {
  summary: 'Health profile',
  symptoms: 'Symptom log',
  triage: 'Health check results',
  medications: 'Medicines & allergies',
  contact: 'Phone & email',
  messages: 'Messages',
};

const TEMPLATES: { kind: 'check_in_request' | 'appointment_request' | 'text'; label: string; body: string }[] = [
  { kind: 'check_in_request', label: 'Ask for a check-in', body: 'Hi, this is your care team checking in. How are you feeling today? Please reply when you can.' },
  { kind: 'appointment_request', label: 'Ask them to book a visit', body: 'Please call our office to book a follow-up visit at your earliest convenience.' },
  { kind: 'text', label: 'Remind about health check', body: 'Please complete a new health check in CareCompass so we can see how you are doing.' },
];

/** Everything a clinician needs to reach a patient quickly, limited to what the patient shared. */
export function PatientDetailScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'PatientDetail'>) {
  const { connectionId, name } = route.params;
  const { data, loading, error, reload } = useApi(() => api.get<PatientSummary>(`/api/connections/${connectionId}/summary`), [connectionId]);
  const [sent, setSent] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (loading && !data) return <Screen scroll={false}><Loading /></Screen>;
  if (error || !data) return <Screen><ErrorState message={error ?? 'Not available'} onRetry={reload} /></Screen>;

  const canMessage = data.scopes.includes('messages');
  const contact = data.patient.contact;

  const sendTemplate = async (t: (typeof TEMPLATES)[number]) => {
    setActionError(null);
    try {
      await api.post(`/api/connections/${connectionId}/messages`, { body: t.body, kind: t.kind });
      setSent(`Sent: “${t.label}”`);
    } catch (e) {
      setActionError(errorMessage(e));
    }
  };

  const disconnect = () =>
    Alert.alert('Disconnect?', `You will no longer see ${name}'s information.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disconnect', style: 'destructive', onPress: () => void api.del(`/api/connections/${connectionId}`).then(() => navigation.goBack()) },
    ]);

  return (
    <Screen variant={3} testID="patient-detail">
      <Card tint="#EAF3FF">
        <Heading>Contact {data.patient.displayName}</Heading>
        <Row>
          {canMessage && (
            <Button title="Message" icon="💬" onPress={() => navigation.navigate('MessageThread', { connectionId, title: data.patient.displayName })} testID="message-patient" />
          )}
          {contact?.phone && <Button title="Call" icon="📞" variant="secondary" onPress={() => void Linking.openURL(`tel:${contact.phone}`)} testID="call-patient" />}
          {contact?.email && <Button title="Email" icon="✉️" variant="secondary" onPress={() => void Linking.openURL(`mailto:${contact.email}`)} />}
        </Row>
        {!contact && <Body muted style={{ fontSize: 14 }}>The patient has not shared phone or email.</Body>}
        {canMessage && (
          <>
            <Body style={{ fontWeight: '700' }}>Quick messages</Body>
            {TEMPLATES.map((t) => (
              <Button key={t.label} title={t.label} variant="ghost" onPress={() => void sendTemplate(t)} />
            ))}
          </>
        )}
        {sent && <Body style={{ color: colors.routineText }} accessibilityLiveRegion="polite">{sent} ✓</Body>}
        {actionError && <ErrorState message={actionError} />}
      </Card>

      <Card>
        <Heading>Shared by the patient</Heading>
        <Row>
          {data.scopes.map((s) => (
            <Pill key={s} text={SCOPE_LABELS[s] ?? s} bg={colors.bubbleMint} />
          ))}
        </Row>
        <Text selectable style={{ fontFamily: 'Courier', fontSize: 14, color: colors.text }}>
          {data.summary.text}
        </Text>
        <Body muted style={{ fontSize: 13 }}>Patient-reported information and app guidance. Not a diagnosis or medical record.</Body>
      </Card>
      <Button title="Disconnect from patient" variant="ghost" onPress={disconnect} />
    </Screen>
  );
}
