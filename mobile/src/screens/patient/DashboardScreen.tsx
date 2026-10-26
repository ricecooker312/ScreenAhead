import React, { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../../api/client';
import { Appointment, Provider, Resource, SymptomEntry, Warning } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { useApi } from '../../hooks/useApi';
import { Body, Button, Card, EmptyState, ErrorState, Heading, Loading, Pill, Row, Screen, Title } from '../../components/ui';
import { EmergencyFooter } from '../../components/health';
import { RootStackParamList } from '../../navigation/types';
import { careLevelStyle, colors } from '../../theme';

interface Dashboard {
  nextAction: { title: string; detail: string; action: string };
  activeWarnings: Warning[];
  lastCheckAt: string | null;
  careLevel: string | null;
  recentSymptoms: SymptomEntry[];
  upcomingAppointments: Appointment[];
  savedProviders: Provider[];
  resources: Resource[];
  medications: { name: string }[];
  allergies: { substance: string; reaction?: string }[];
  questionsForClinician: string[];
  inProgressQuestionnaire: { _id: string } | null;
  unreadMessages: number;
}

export function DashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi(() => api.get<Dashboard>('/api/dashboard'), []);
  useFocusEffect(useCallback(() => void reload(), [reload]));

  if (loading && !data) return <Screen scroll={false}><Loading /></Screen>;
  if (error && !data) return <Screen><ErrorState message={error} onRetry={reload} /></Screen>;
  if (!data) return null;

  const level = data.careLevel ? careLevelStyle[data.careLevel] : null;

  return (
    <Screen variant={0} testID="dashboard-screen">
      <Title>Hi{user?.displayName ? `, ${user.displayName}` : ''} 👋</Title>

      {data.activeWarnings.length > 0 && level && (
        <Card tint={level.bg}>
          <Pill text={level.label} bg="#FFFFFF" color={level.text} />
          {data.activeWarnings.slice(0, 2).map((w) => (
            <Body key={w.ruleId} style={{ color: level.text }}>
              {w.message}
            </Body>
          ))}
        </Card>
      )}

      <Card tint="#EAF3FF">
        <Body muted style={{ fontSize: 15 }}>Your next step</Body>
        <Heading>{data.nextAction.title}</Heading>
        <Body>{data.nextAction.detail}</Body>
        {data.inProgressQuestionnaire ? (
          <Button title="Continue health check" onPress={() => navigation.navigate('Questionnaire')} testID="resume-check" />
        ) : (
          <Button
            title={data.lastCheckAt ? 'Update my health check' : 'Start health check'}
            onPress={() => navigation.navigate('Questionnaire', { restart: true })}
            testID="start-check"
          />
        )}
        {data.lastCheckAt && <Body muted style={{ fontSize: 14 }}>Last check: {new Date(data.lastCheckAt).toLocaleDateString()}</Body>}
      </Card>

      <Row>
        <QuickTile emoji="📝" label="Log symptom" onPress={() => navigation.navigate('SymptomForm')} />
        <QuickTile emoji="📅" label="Appointments" onPress={() => navigation.navigate('Appointments')} />
        <QuickTile emoji="💬" label={data.unreadMessages ? `Care team (${data.unreadMessages})` : 'Care team'} onPress={() => navigation.navigate('CareTeam')} />
        <QuickTile emoji="📄" label="Share summary" onPress={() => navigation.navigate('Summary')} />
      </Row>

      {data.questionsForClinician.length > 0 && (
        <Card tint={colors.bubbleLavender}>
          <Heading>Questions for your doctor</Heading>
          {data.questionsForClinician.map((q) => (
            <Body key={q}>• {q}</Body>
          ))}
        </Card>
      )}

      <Card>
        <Heading>Recent symptoms</Heading>
        {data.recentSymptoms.length === 0 ? (
          <Body muted>Nothing logged yet.</Body>
        ) : (
          data.recentSymptoms.map((s) => (
            <Body key={s._id}>
              {new Date(s.recordedAt).toLocaleDateString()} · {s.symptomType}
              {s.severity ? ` · ${s.severity}/10` : ''}
            </Body>
          ))
        )}
      </Card>

      <Card>
        <Heading>Coming up</Heading>
        {data.upcomingAppointments.length === 0 ? (
          <Body muted>No appointments saved.</Body>
        ) : (
          data.upcomingAppointments.map((a) => (
            <Body key={a._id}>
              {new Date(a.startsAt).toLocaleString()} · {a.title}
            </Body>
          ))
        )}
      </Card>

      {(data.medications.length > 0 || data.allergies.length > 0) && (
        <Card>
          <Heading>My medicines & allergies</Heading>
          {data.medications.length > 0 && <Body>Medicines: {data.medications.map((m) => m.name).join(', ')}</Body>}
          {data.allergies.length > 0 && <Body>Allergies: {data.allergies.map((a) => a.substance).join(', ')}</Body>}
        </Card>
      )}

      {data.savedProviders.length > 0 && (
        <Card>
          <Heading>Saved specialists</Heading>
          {data.savedProviders.map((p) => (
            <Pressable key={p._id} accessibilityRole="button" onPress={() => navigation.navigate('ProviderDetail', { id: p._id })} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Body style={{ color: colors.primary, fontWeight: '600' }}>{p.name}</Body>
            </Pressable>
          ))}
        </Card>
      )}

      <Heading>For you to read</Heading>
      {data.resources.length === 0 ? (
        <EmptyState title="Nothing here yet" />
      ) : (
        data.resources.map((r) => (
          <Pressable key={r._id} accessibilityRole="button" onPress={() => navigation.navigate('ResourceDetail', { id: r.slug })}>
            <Card>
              <Body style={{ fontWeight: '700' }}>{r.title}</Body>
              <Body muted>{r.summary}</Body>
              <Body muted style={{ fontSize: 13 }}>Source: {r.source.name}</Body>
            </Card>
          </Pressable>
        ))
      )}
      <EmergencyFooter />
    </Screen>
  );
}

function QuickTile({ emoji, label, onPress }: { emoji: string; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ width: '47%', minHeight: 88, backgroundColor: '#FFFFFF', borderRadius: 22, padding: 14, justifyContent: 'center', alignItems: 'center', gap: 4 }}
    >
      <Text style={{ fontSize: 28 }} accessibilityElementsHidden>
        {emoji}
      </Text>
      <View>
        <Body style={{ fontWeight: '700', textAlign: 'center', fontSize: 15 }}>{label}</Body>
      </View>
    </Pressable>
  );
}
