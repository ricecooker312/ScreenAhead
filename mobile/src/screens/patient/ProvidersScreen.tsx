import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../../api/client';
import { Paged, Provider, SPECIALTY_SHORT } from '../../api/types';
import { useApi } from '../../hooks/useApi';
import { Body, Button, Card, Chip, EmptyState, ErrorState, Heading, Loading, Pill, Row, Screen, Title } from '../../components/ui';
import { TextField, ToggleRow } from '../../components/forms';
import { PatientTabParamList, RootStackParamList } from '../../navigation/types';
import { colors } from '../../theme';

export function ProviderCard({ p, onPress }: { p: Provider; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${p.name}, ${p.specialties.map((s) => SPECIALTY_SHORT[s]).join(', ')}`} onPress={onPress}>
      <Card>
        {p.isDemo ? (
          <Pill text="Demo data — not a real provider" bg={colors.demoBg} color={colors.demoText} />
        ) : p.verification.status === 'verified' ? (
          <Pill text="✓ Verified" bg={colors.routineBg} color={colors.routineText} />
        ) : (
          <Pill text="Not yet verified" bg={colors.infoBg} color={colors.infoText} />
        )}
        <Heading>
          {p.name}
          {p.credentials ? `, ${p.credentials}` : ''}
        </Heading>
        <Body muted>{p.specialties.map((s) => SPECIALTY_SHORT[s] ?? s).join(' · ')}</Body>
        {p.organization && <Body>{p.organization}</Body>}
        {p.location?.city && (
          <Body muted>
            📍 {p.location.city}, {p.location.state}
          </Body>
        )}
        <Row>
          {p.telehealth?.value && <Pill text="Video visits" bg={colors.bubbleMint} />}
          {p.languages?.values.map((l) => <Pill key={l} text={l} bg={colors.bubbleLavender} />)}
          {p.saved && <Pill text="★ Saved" bg={colors.bubbleYellow} />}
        </Row>
      </Card>
    </Pressable>
  );
}

export function ProvidersScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<PatientTabParamList, 'FindCare'>>();
  const [specialty, setSpecialty] = useState<string | undefined>(route.params?.specialty);
  const [postalCode, setPostalCode] = useState('');
  const [language, setLanguage] = useState('');
  const [telehealth, setTelehealth] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [q, setQ] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (route.params?.specialty) setSpecialty(route.params.specialty);
  }, [route.params?.specialty]);

  const query = {
    specialty,
    postalCode: postalCode.length >= 3 ? postalCode : undefined,
    language: language || undefined,
    telehealth: telehealth ? 'true' : undefined,
    verifiedOnly: verifiedOnly ? 'true' : undefined,
    q: q.length >= 2 ? q : undefined,
  };
  const { data, loading, error, reload } = useApi(() => api.get<Paged<Provider>>('/api/providers', query), [JSON.stringify(query)]);

  return (
    <Screen variant={5} testID="providers-screen">
      <Title>Find care</Title>
      <Body muted>Find a <Body style={{ fontWeight: '700' }}>specialist</Body> (an expert doctor) or support service.</Body>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 16 }} accessibilityLabel="Type of care">
        {Object.entries(SPECIALTY_SHORT).map(([k, label]) => (
          <Chip key={k} label={label} selected={specialty === k} onPress={() => setSpecialty(specialty === k ? undefined : k)} testID={`spec-${k}`} />
        ))}
      </ScrollView>
      <Button
        title={showFilters ? 'Hide filters' : 'More filters'}
        icon="⚙️"
        variant="ghost"
        onPress={() => setShowFilters(!showFilters)}
        accessibilityHint="Search by name, ZIP code, language, video visits"
      />
      {showFilters && (
        <Card>
          <TextField label="Search by name" value={q} onChangeText={setQ} />
          <TextField label="ZIP code" keyboardType="number-pad" value={postalCode} onChangeText={setPostalCode} maxLength={10} />
          <TextField label="Language" placeholder="e.g. Spanish" value={language} onChangeText={setLanguage} />
          <ToggleRow label="Video visits (telehealth)" value={telehealth} onChange={setTelehealth} />
          <ToggleRow label="Verified only" hint="Hide demo and unverified listings" value={verifiedOnly} onChange={setVerifiedOnly} />
        </Card>
      )}

      {loading && !data ? (
        <Loading label="Searching…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data?.items.length ? (
        <EmptyState emoji="🔎" title="No matches" detail="Try fewer filters or a nearby ZIP code." />
      ) : (
        <>
          <Body muted>{data.total} found</Body>
          {data.items.map((p) => (
            <ProviderCard key={p._id} p={p} onPress={() => navigation.navigate('ProviderDetail', { id: p._id })} />
          ))}
        </>
      )}
      <Body muted style={{ fontSize: 13 }}>
        We only show insurance, languages and video visits when they have been checked. Always confirm details with the office.
      </Body>
    </Screen>
  );
}
