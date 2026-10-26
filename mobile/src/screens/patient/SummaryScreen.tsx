import React, { useState } from 'react';
import { Share, Text } from 'react-native';
import { api } from '../../api/client';
import { errorMessage } from '../../hooks/useApi';
import { Body, Button, Card, Chip, ErrorState, Heading, Row, Screen, Title } from '../../components/ui';
import { colors } from '../../theme';

const SECTIONS: [string, string][] = [
  ['profile', 'Health history'],
  ['medications', 'Medicines & allergies'],
  ['symptoms', 'Symptom log'],
  ['triage', 'Last health check'],
  ['appointments', 'Appointments & questions'],
];

/** Builds a readable summary the user can share with a clinician. Nothing is sent until the user shares it. */
export function SummaryScreen() {
  const [selected, setSelected] = useState(SECTIONS.map(([k]) => k));
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const build = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.get<{ text: string }>('/api/users/me/summary', { sections: selected.join(',') });
      setText(r.text);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen variant={2}>
      <Title>Share a summary</Title>
      <Body muted>Make an easy-to-read summary for your doctor. You pick what goes in it.</Body>
      <Row>
        {SECTIONS.map(([k, l]) => (
          <Chip key={k} label={l} selected={selected.includes(k)} onPress={() => setSelected((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))} />
        ))}
      </Row>
      <Button title="Make my summary" onPress={build} loading={busy} disabled={!selected.length} />
      {error && <ErrorState message={error} />}
      {text && (
        <>
          <Card>
            <Heading>Preview</Heading>
            <Text selectable style={{ fontFamily: 'Courier', fontSize: 14, color: colors.text }}>
              {text}
            </Text>
          </Card>
          <Button title="Share or save" icon="📤" onPress={() => void Share.share({ message: text, title: 'My health summary' })} />
          <Body muted style={{ fontSize: 13 }}>Only share with people you trust. Email and text messages may not be private.</Body>
        </>
      )}
    </Screen>
  );
}
