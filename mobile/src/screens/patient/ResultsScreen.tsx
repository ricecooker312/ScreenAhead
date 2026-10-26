import React from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CompositeNavigationProp } from '@react-navigation/native';
import { Body, Button, Card, Heading, Pill, Screen, Term } from '../../components/ui';
import { CareLevelBanner, Disclaimers, EmergencyFooter, EmergencyPanel, WhyThis } from '../../components/health';
import { RootStackParamList } from '../../navigation/types';
import { SPECIALTY_SHORT } from '../../api/types';
import { colors } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Results'>;

const CARD_TINT: Record<string, string> = {
  professional_assessment: '#EAF3FF',
  medication_info: colors.bubblePeach,
  comfort_support: colors.bubbleMint,
  nutrition: colors.bubbleYellow,
  screening_risk: colors.bubbleLavender,
  emotional_support: colors.bubblePink,
  survivorship: colors.bubbleMint,
  caregiver: colors.bubblePink,
  insufficient_information: colors.infoBg,
};

export function ResultsScreen({ route, navigation }: Props) {
  const { triage, recommendations } = route.params;
  const nav = navigation as unknown as CompositeNavigationProp<any, any>;

  if (triage.careLevel === 'emergency') {
    return (
      <Screen>
        <EmergencyPanel warnings={triage.warnings} />
      </Screen>
    );
  }

  const findCare = (specialty?: string) => nav.navigate('PatientTabs', { screen: 'FindCare', params: { specialty } });

  return (
    <Screen variant={2} testID="results-screen">
      <CareLevelBanner level={triage.careLevel} headline={triage.headline} />
      <Body muted>
        This is guidance, not a <Term word="diagnosis" />.
      </Body>

      <WhyThis items={triage.warnings.map((w) => ({ title: w.title, explanation: w.explanation }))} />

      <Heading>What you can do next</Heading>
      {triage.nextSteps.map((s, i) => (
        <Card key={s.id}>
          <Pill text={`Step ${i + 1}`} />
          <Body style={{ fontWeight: '700', fontSize: 18 }}>{s.title}</Body>
          <Body muted>{s.detail}</Body>
          {s.specialty && (
            <Button title={`Find ${SPECIALTY_SHORT[s.specialty] ?? 'care'}`} variant="secondary" onPress={() => findCare(s.specialty)} />
          )}
        </Card>
      ))}

      {recommendations
        .filter((r) => r.category !== 'professional_assessment' || triage.careLevel !== 'routine')
        .map((r) => (
          <Card key={r.category} tint={CARD_TINT[r.category]}>
            <Heading>{r.title}</Heading>
            <Body>{r.body}</Body>
            {r.bullets?.map((b) => (
              <Body key={b} muted>
                • {b}
              </Body>
            ))}
            {r.resourceTopics[0] && (
              <Button
                title="Learn more"
                variant="ghost"
                onPress={() => nav.navigate('PatientTabs', { screen: 'Learn', params: { topic: r.resourceTopics[0] } })}
              />
            )}
          </Card>
        ))}

      <Disclaimers items={triage.disclaimers} />
      <Button title="Go to my dashboard" onPress={() => navigation.navigate('PatientTabs')} testID="results-done" />
      <Body muted style={{ fontSize: 12, textAlign: 'center' }}>Ruleset {triage.rulesetVersion}</Body>
      <EmergencyFooter />
    </Screen>
  );
}
