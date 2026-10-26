import React, { useState } from 'react';
import { Linking } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../../api/client';
import { Provider, SPECIALTY_LABELS } from '../../api/types';
import { errorMessage, useApi } from '../../hooks/useApi';
import { Body, Button, Card, ErrorState, Heading, Loading, Pill, Screen, Title } from '../../components/ui';
import { RootStackParamList } from '../../navigation/types';
import { colors } from '../../theme';

export function ProviderDetailScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'ProviderDetail'>) {
  const { data: p, loading, error, reload, setData } = useApi(() => api.get<Provider>(`/api/providers/${route.params.id}`), [route.params.id]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (loading && !p) return <Screen scroll={false}><Loading /></Screen>;
  if (error || !p) return <Screen><ErrorState message={error ?? 'Not found'} onRetry={reload} /></Screen>;

  const toggleSave = async () => {
    setBusy(true);
    setActionError(null);
    try {
      if (p.saved) await api.del(`/api/providers/${p._id}/save`);
      else await api.post(`/api/providers/${p._id}/save`);
      setData({ ...p, saved: !p.saved });
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen variant={1}>
      {p.isDemo && (
        <Card tint={colors.demoBg}>
          <Body style={{ color: colors.demoText, fontWeight: '700' }}>Demonstration data — this is not a real provider.</Body>
          <Body style={{ color: colors.demoText }}>Do not call these numbers. They are for testing only.</Body>
        </Card>
      )}
      <Title>{p.name}</Title>
      {p.credentials && <Body muted>{p.credentials}</Body>}
      <Card>
        {p.specialties.map((s) => (
          <Body key={s}>🩺 {SPECIALTY_LABELS[s] ?? s}</Body>
        ))}
        {p.focusAreas?.length ? <Body muted>Focus: {p.focusAreas.join(', ')}</Body> : null}
        {p.organization && <Body>{p.organization}</Body>}
        {p.location && (
          <Body muted>
            📍 {[p.location.addressLine, p.location.city, p.location.state, p.location.postalCode].filter(Boolean).join(', ')}
          </Body>
        )}
      </Card>
      <Card>
        <Heading>Details</Heading>
        <Body>Video visits: {p.telehealth ? (p.telehealth.value ? 'Yes' : 'No') : 'Not verified — ask the office'}</Body>
        <Body>Languages: {p.languages ? p.languages.values.join(', ') : 'Not verified — ask the office'}</Body>
        <Body>Insurance: {p.insuranceAccepted ? p.insuranceAccepted.values.join(', ') : 'Not verified — ask the office'}</Body>
        <Pill text={p.label} bg={p.isDemo ? colors.demoBg : colors.bubbleBlue} />
        {p.verification.source && <Body muted style={{ fontSize: 13 }}>Source: {p.verification.source}</Body>}
      </Card>

      {p.contact?.phone && <Button title={`Call ${p.contact.phone}`} icon="📞" onPress={() => void Linking.openURL(`tel:${p.contact!.phone}`)} />}
      {p.bookingUrl && <Button title="Request an appointment online" variant="secondary" onPress={() => void Linking.openURL(p.bookingUrl!)} />}
      {p.website && <Button title="Visit website" variant="secondary" onPress={() => void Linking.openURL(p.website!)} />}
      <Button title={p.saved ? '★ Saved — tap to remove' : '☆ Save this provider'} variant="secondary" onPress={toggleSave} loading={busy} testID="save-provider" />
      <Button title="Add an appointment with them" variant="ghost" onPress={() => navigation.navigate('AppointmentForm', { providerId: p._id, providerName: p.name })} />
      {actionError && <ErrorState message={actionError} />}
      <Body muted style={{ fontSize: 13 }}>CareCompass does not book appointments or make referrals. Contact the office to confirm.</Body>
    </Screen>
  );
}
