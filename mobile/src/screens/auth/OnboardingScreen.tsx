import React, { useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Body, Button, Card, Chip, Heading, Row, Screen, Title } from '../../components/ui';
import { RootStackParamList } from '../../navigation/types';

export const CATEGORIES: { value: string; label: string }[] = [
  { value: 'diagnosed', label: 'I have cancer' },
  { value: 'symptoms', label: 'I have symptoms that worry me' },
  { value: 'increased_risk', label: 'I may be at higher risk' },
  { value: 'screening_prevention', label: 'I want screening or prevention info' },
  { value: 'in_treatment', label: 'I am getting cancer treatment' },
  { value: 'survivor', label: 'I am a cancer survivor' },
  { value: 'supporting_someone', label: 'I am helping someone I love' },
  { value: 'other_concern', label: 'Something else' },
];

export function OnboardingScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Onboarding'>) {
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (v: string) => setSelected((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));

  return (
    <Screen variant={2} testID="onboarding-screen">
      <Title>What brings you here?</Title>
      <Body muted>Pick all that fit. You can change this later.</Body>
      <Row>
        {CATEGORIES.map((c) => (
          <Chip key={c.value} label={c.label} selected={selected.includes(c.value)} onPress={() => toggle(c.value)} testID={`cat-${c.value}`} />
        ))}
      </Row>
      <Card tint="#EAF3FF">
        <Heading>Good to know</Heading>
        <Body>CareCompass teaches and guides. It does not diagnose or treat. Always check with a health professional.</Body>
      </Card>
      <Button
        title="Next"
        disabled={selected.length === 0}
        onPress={() => navigation.navigate('Register', { categories: selected })}
        accessibilityHint="Choose at least one option first"
        testID="onboarding-next"
      />
      <Button title="I am a doctor or nurse" variant="ghost" onPress={() => navigation.navigate('Register', { role: 'clinician' })} />
    </Screen>
  );
}
