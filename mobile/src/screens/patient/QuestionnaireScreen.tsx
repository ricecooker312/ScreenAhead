import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useForm } from 'react-hook-form';
import { api, ApiError } from '../../api/client';
import { Recommendation, Triage, Warning } from '../../api/types';
import { Body, Button, Card, ErrorState, Loading, ProgressBar, Screen, Title } from '../../components/ui';
import { EmergencyFooter } from '../../components/health';
import { QuestionField } from '../../questionnaire/QuestionField';
import { visibleQuestions, visibleSections } from '../../questionnaire/shared/branching';
import { Answers, AnswerValue, Question, QuestionnaireDefinition } from '../../questionnaire/shared/types';
import { errorMessage } from '../../hooks/useApi';
import { RootStackParamList } from '../../navigation/types';
import { colors, spacing } from '../../theme';
import { EMERGENCY_NUMBER } from '../../config';

type Props = NativeStackScreenProps<RootStackParamList, 'Questionnaire'>;

interface SaveResponse {
  safetyCheck: { emergency: boolean; warnings: Warning[] };
}

const isAnswered = (v: AnswerValue | undefined) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0);

export function QuestionnaireScreen({ navigation, route }: Props) {
  const [def, setDef] = useState<QuestionnaireDefinition | null>(null);
  const [qid, setQid] = useState<string | null>(null);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [offline, setOffline] = useState(false);
  const { watch, setValue, reset } = useForm<Answers>({ defaultValues: {} });
  const answers = watch();

  // Load the definition and resume (or start) a questionnaire.
  useEffect(() => {
    (async () => {
      try {
        const current = await api.get<{ definition: QuestionnaireDefinition; inProgress: { _id: string; responses: Answers; currentSection?: string } | null }>(
          '/api/questionnaires',
        );
        let id = current.inProgress?._id;
        let responses: Answers = current.inProgress?.responses ?? {};
        if (!id || route.params?.restart) {
          const created = await api.post<{ questionnaire: { _id: string } }>('/api/questionnaires');
          id = created.questionnaire._id;
          responses = {};
        }
        reset(responses);
        setDef(current.definition);
        setQid(id);
        const sections = visibleSections(current.definition, responses);
        const resumeAt = sections.findIndex((s) => s.id === current.inProgress?.currentSection);
        setSectionIndex(resumeAt > 0 && !route.params?.restart ? resumeAt : 0);
      } catch (e) {
        setLoadError(errorMessage(e));
      }
    })();
  }, [reset, route.params?.restart]);

  const sections = useMemo(() => (def ? visibleSections(def, answers) : []), [def, answers]);
  const section = sections[Math.min(sectionIndex, sections.length - 1)];
  const questions = section ? visibleQuestions(section, answers) : [];

  const goEmergency = (warnings: Warning[]) => navigation.replace('Emergency', { warnings });

  /** Saves answers. Returns false if an emergency was detected. */
  const save = async (partial: Answers, currentSection?: string): Promise<boolean> => {
    if (!qid) return true;
    try {
      const r = await api.patch<SaveResponse>(`/api/questionnaires/${qid}`, { answers: partial, currentSection });
      setOffline(false);
      if (r.safetyCheck.emergency) {
        goEmergency(r.safetyCheck.warnings);
        return false;
      }
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 0) setOffline(true);
      throw e;
    }
  };

  const onAnswer = (q: Question, v: AnswerValue) => {
    setValue(q.id, v);
    setErrors((er) => ({ ...er, [q.id]: '' }));
    // Safety questions are checked the moment they are answered.
    if (q.safetyCritical) void save({ [q.id]: v }, section?.id).catch(() => undefined);
  };

  const next = async () => {
    if (!section || !def) return;
    const missing: Record<string, string> = {};
    for (const q of questions) if (q.required && !isAnswered(answers[q.id])) missing[q.id] = 'Please choose an answer';
    setErrors(missing);
    if (Object.keys(missing).length) return;

    // Send this section's visible answers, and clear answers to questions now hidden.
    const visibleIds = new Set(questions.map((q) => q.id));
    const partial: Answers = {};
    for (const q of section.questions) {
      if (visibleIds.has(q.id) && isAnswered(answers[q.id])) partial[q.id] = answers[q.id] as AnswerValue;
      else if (!visibleIds.has(q.id) && answers[q.id] !== undefined) partial[q.id] = null;
    }

    setSaving(true);
    try {
      const nextSection = sections[sectionIndex + 1];
      if (!(await save(partial, nextSection?.id ?? section.id))) return;
      if (nextSection) {
        setSectionIndex(sectionIndex + 1);
      } else {
        const r = await api.post<{ triage: Triage; recommendations: Recommendation[] }>(`/api/questionnaires/${qid}/submit`);
        if (r.triage.careLevel === 'emergency') goEmergency(r.triage.warnings);
        else navigation.replace('Results', { triage: r.triage, recommendations: r.recommendations });
      }
    } catch (e) {
      if (e instanceof ApiError && Array.isArray(e.details)) {
        const fieldErrors: Record<string, string> = {};
        for (const d of e.details as { questionId?: string; message: string }[]) if (d.questionId) fieldErrors[d.questionId] = d.message;
        setErrors(fieldErrors);
      }
      setLoadError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (loadError && !def) {
    return (
      <Screen>
        <ErrorState message={loadError} onRetry={() => navigation.replace('Questionnaire')} />
      </Screen>
    );
  }
  if (!def || !section) {
    return (
      <Screen scroll={false}>
        <Loading label="Getting your questions ready…" />
      </Screen>
    );
  }

  return (
    <Screen key={section.id} variant={sectionIndex} testID="questionnaire-screen">
      <ProgressBar value={(sectionIndex + 1) / sections.length} label={`Step ${sectionIndex + 1} of ${sections.length}`} />
      <Title>{section.title}</Title>
      <Body muted>{section.intro}</Body>

      {offline && (
        <Card tint={colors.promptBg}>
          <Body style={{ color: colors.promptText }} accessibilityRole="alert">
            You seem to be offline. If you feel very unwell, call {EMERGENCY_NUMBER} now.
          </Body>
        </Card>
      )}

      {questions.map((q) => (
        <Card key={q.id}>
          <QuestionField question={q} value={answers[q.id]} onChange={(v) => onAnswer(q, v)} error={errors[q.id]} />
        </Card>
      ))}

      {loadError && <ErrorState message={loadError} />}

      <View style={{ gap: spacing(1) }}>
        <Button
          title={sectionIndex === sections.length - 1 ? 'See my next steps' : 'Next'}
          onPress={() => {
            setLoadError(null);
            void next();
          }}
          loading={saving}
          testID="questionnaire-next"
        />
        {sectionIndex > 0 && <Button title="Back" variant="secondary" onPress={() => setSectionIndex(sectionIndex - 1)} testID="questionnaire-back" />}
      </View>
      <Body muted style={{ fontSize: 14 }}>Your answers save as you go. You can stop and come back later.</Body>
      <EmergencyFooter />
    </Screen>
  );
}
