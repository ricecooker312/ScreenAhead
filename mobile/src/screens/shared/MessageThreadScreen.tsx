import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { errorMessage, useApi } from '../../hooks/useApi';
import { Body, Button, Card, EmptyState, ErrorState, Loading, Pill, Screen } from '../../components/ui';
import { TextField } from '../../components/forms';
import { RootStackParamList } from '../../navigation/types';
import { colors, radius } from '../../theme';
import { EMERGENCY_NUMBER } from '../../config';

interface Message {
  _id: string;
  senderRole: 'patient' | 'clinician';
  kind: string;
  body: string;
  createdAt: string;
}

const KIND_LABEL: Record<string, string> = { check_in_request: 'Check-in request', appointment_request: 'Appointment request' };

/** Secure, non-urgent messaging between a patient and a connected clinician. */
export function MessageThreadScreen({ route }: NativeStackScreenProps<RootStackParamList, 'MessageThread'>) {
  const { user } = useAuth();
  const { connectionId } = route.params;
  const { data, loading, error, reload } = useApi(() => api.get<{ items: Message[] }>(`/api/connections/${connectionId}/messages`, { limit: 50 }), [connectionId]);
  useFocusEffect(useCallback(() => void reload(), [reload]));
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    setSendError(null);
    try {
      await api.post(`/api/connections/${connectionId}/messages`, { body: text.trim() });
      setText('');
      void reload();
    } catch (e) {
      setSendError(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const mine = user?.role === 'clinician' ? 'clinician' : 'patient';
  const items = [...(data?.items ?? [])].reverse();

  return (
    <Screen variant={2}>
      <Card tint={colors.promptBg}>
        <Body style={{ color: colors.promptText, fontSize: 15 }}>Not for emergencies. If you need help now, call {EMERGENCY_NUMBER}.</Body>
      </Card>
      {loading && !data ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : items.length === 0 ? (
        <EmptyState emoji="💬" title="No messages yet" detail="Say hello or ask a question." />
      ) : (
        items.map((m) => (
          <View
            key={m._id}
            style={{
              alignSelf: m.senderRole === mine ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              backgroundColor: m.senderRole === mine ? '#DCEBFF' : '#FFFFFF',
              borderRadius: radius.md,
              padding: 12,
              gap: 4,
            }}
            accessible
            accessibilityLabel={`${m.senderRole === mine ? 'You' : m.senderRole === 'clinician' ? 'Your clinician' : 'Patient'}: ${m.body}`}
          >
            {KIND_LABEL[m.kind] && <Pill text={KIND_LABEL[m.kind]} bg={colors.bubbleLavender} />}
            <Body>{m.body}</Body>
            <Body muted style={{ fontSize: 12 }}>{new Date(m.createdAt).toLocaleString()}</Body>
          </View>
        ))
      )}
      <TextField label="Write a message" multiline value={text} onChangeText={setText} maxLength={4000} testID="message-input" />
      {sendError && <ErrorState message={sendError} />}
      <Button title="Send" onPress={send} loading={sending} disabled={!text.trim()} testID="send-message" />
    </Screen>
  );
}
