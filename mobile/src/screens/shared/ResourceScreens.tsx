import React, { useEffect, useState } from 'react';
import { Linking, Pressable } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../../api/client';
import { Paged, Resource } from '../../api/types';
import { useApi } from '../../hooks/useApi';
import { Body, Button, Card, Chip, EmptyState, ErrorState, Heading, Loading, Row, Screen, Title } from '../../components/ui';
import { TextField } from '../../components/forms';
import { RootStackParamList } from '../../navigation/types';
import { colors } from '../../theme';

const TOPICS: [string, string][] = [
  ['symptoms', 'Symptoms'],
  ['screening', 'Screening'],
  ['family_history', 'Family risk'],
  ['diagnostic_tests', 'Tests'],
  ['pathology', 'Biopsy reports'],
  ['treatment', 'Treatment'],
  ['side_effects', 'Side effects'],
  ['pain_comfort', 'Pain & comfort'],
  ['nutrition', 'Food'],
  ['emotional_wellbeing', 'Feelings'],
  ['caregiver', 'Caregivers'],
  ['survivorship', 'After treatment'],
  ['other_cancers', 'Other cancers'],
];

export function ResourcesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<any>();
  const [topic, setTopic] = useState<string | undefined>(route.params?.topic);
  const [q, setQ] = useState('');
  useEffect(() => {
    if (route.params?.topic) setTopic(route.params.topic);
  }, [route.params?.topic]);

  const query = { topic, q: q.length >= 2 ? q : undefined, limit: 50 };
  const { data, loading, error, reload } = useApi(() => api.publicGet<Paged<Resource>>('/api/resources', query), [topic, q]);

  return (
    <Screen variant={4} testID="resources-screen">
      <Title>Learn</Title>
      <Body muted>Short, trusted reads. Each one links to its source.</Body>
      <TextField label="Search" value={q} onChangeText={setQ} placeholder="e.g. colonoscopy" />
      <Row>
        {TOPICS.map(([k, l]) => (
          <Chip key={k} label={l} selected={topic === k} onPress={() => setTopic(topic === k ? undefined : k)} />
        ))}
      </Row>
      {loading && !data ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data?.items.length ? (
        <EmptyState emoji="📚" title="Nothing found" />
      ) : (
        data.items.map((r, i) => (
          <Pressable key={r._id} accessibilityRole="button" onPress={() => navigation.navigate('ResourceDetail', { id: r.slug })}>
            <Card tint={[colors.surface, '#F5FBFF', '#FBF7FF'][i % 3]}>
              <Heading>{r.title}</Heading>
              <Body>{r.summary}</Body>
              <Body muted style={{ fontSize: 13 }}>From {r.source.name}</Body>
            </Card>
          </Pressable>
        ))
      )}
      <Body muted style={{ fontSize: 13 }}>General information only. It is not advice for your own health.</Body>
    </Screen>
  );
}

export function ResourceDetailScreen({ route }: NativeStackScreenProps<RootStackParamList, 'ResourceDetail'>) {
  const { data: r, loading, error, reload } = useApi(() => api.publicGet<Resource>(`/api/resources/${route.params.id}`), [route.params.id]);
  if (loading && !r) return <Screen scroll={false}><Loading /></Screen>;
  if (error || !r) return <Screen><ErrorState message={error ?? 'Not found'} onRetry={reload} /></Screen>;
  return (
    <Screen variant={2}>
      <Title>{r.title}</Title>
      <Card>
        {(r.body ?? r.summary).split('\n\n').map((para, i) => (
          <Body key={i}>{para}</Body>
        ))}
      </Card>
      <Card tint="#F7F9FC">
        <Body style={{ fontWeight: '700' }}>Where this comes from</Body>
        <Body>{r.source.name}</Body>
        {r.source.publishedOrReviewed && <Body muted>{r.source.publishedOrReviewed}</Body>}
        <Body muted>Last checked by CareCompass: {new Date(r.lastReviewedAt).toLocaleDateString()}</Body>
        {r.reviewedBy && <Body muted>Review status: {r.reviewedBy}</Body>}
        <Button title="Read the full source" variant="secondary" onPress={() => void Linking.openURL(r.source.url)} />
      </Card>
      <Body muted style={{ fontSize: 13 }}>This is general information, not advice for your own health. Talk with your care team about your situation.</Body>
    </Screen>
  );
}
