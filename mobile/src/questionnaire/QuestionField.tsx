import React from 'react';
import { View } from 'react-native';
import { AnswerValue, Question, UNKNOWN, PREFER_NOT } from './shared/types';
import { Body, Chip, Heading, Radio, Row, FieldError } from '../components/ui';
import { SeverityScale, TextField } from '../components/forms';
import { spacing } from '../theme';

interface Props {
  question: Question;
  value: AnswerValue | undefined;
  onChange: (v: AnswerValue) => void;
  error?: string;
}

const extras = (q: Question) => [
  ...(q.allowUnknown ? [{ value: UNKNOWN, label: 'I don’t know' }] : []),
  ...(q.allowPreferNot ? [{ value: PREFER_NOT, label: 'Prefer not to answer' }] : []),
];

/** Renders one questionnaire question based on its type. */
export function QuestionField({ question: q, value, onChange, error }: Props) {
  const special = extras(q);
  const isSpecial = typeof value === 'string' && (value === UNKNOWN || value === PREFER_NOT);

  const specialChoices = special.length > 0 && (
    <Row>
      {special.map((o) => (
        <Chip key={o.value} label={o.label} selected={value === o.value} onPress={() => onChange(o.value)} testID={`${q.id}-${o.value}`} />
      ))}
    </Row>
  );

  let input: React.ReactNode = null;
  switch (q.type) {
    case 'single':
      input = (
        <View style={{ gap: spacing(1) }} accessibilityRole="radiogroup" accessibilityLabel={q.label}>
          {[...(q.options ?? []), ...special].map((o) => (
            <Radio key={o.value} label={o.label} selected={value === o.value} onPress={() => onChange(o.value)} testID={`${q.id}-${o.value}`} />
          ))}
        </View>
      );
      break;
    case 'multi': {
      const arr = Array.isArray(value) ? value : [];
      const toggle = (v: string, exclusive?: boolean) => {
        if (exclusive) return onChange(arr.includes(v) ? [] : [v]);
        const exclusiveValues = (q.options ?? []).filter((o) => o.exclusive).map((o) => o.value);
        const base = arr.filter((x) => !exclusiveValues.includes(x));
        onChange(base.includes(v) ? base.filter((x) => x !== v) : [...base, v]);
      };
      input = (
        <>
          <Row>
            {(q.options ?? []).map((o) => (
              <Chip key={o.value} label={o.label} selected={arr.includes(o.value)} onPress={() => toggle(o.value, o.exclusive)} testID={`${q.id}-${o.value}`} />
            ))}
          </Row>
          {specialChoices}
        </>
      );
      break;
    }
    case 'scale':
      input = (
        <SeverityScale
          value={typeof value === 'number' || value === 'na' ? (value as number | 'na') : undefined}
          onChange={onChange}
          allowNotApplicable={q.allowNotApplicable}
          minLabel={q.minLabel}
          maxLabel={q.maxLabel}
        />
      );
      break;
    case 'number':
      input = (
        <>
          <TextField
            label={`${q.label}${q.unit ? ` (${q.unit})` : ''}`}
            keyboardType="numeric"
            value={typeof value === 'number' ? String(value) : ''}
            onChangeText={(t) => {
              const n = Number(t.replace(',', '.'));
              onChange(t.trim() === '' || !Number.isFinite(n) ? null : n);
            }}
            testID={`${q.id}-input`}
          />
          {specialChoices}
        </>
      );
      break;
    case 'date':
      input = (
        <TextField
          label="Date"
          hint="Like 2026-09-15 (year-month-day)"
          value={typeof value === 'string' ? value : ''}
          onChangeText={(t) => onChange(t.trim() === '' ? null : t.trim())}
          testID={`${q.id}-input`}
        />
      );
      break;
    case 'text':
      input = (
        <TextField
          label={q.label}
          multiline
          maxLength={q.maxLength ?? 1000}
          value={typeof value === 'string' && !isSpecial ? value : ''}
          onChangeText={(t) => onChange(t === '' ? null : t)}
          testID={`${q.id}-input`}
        />
      );
      break;
  }

  return (
    <View style={{ gap: spacing(1.25) }} testID={`question-${q.id}`}>
      <Heading>{q.label}</Heading>
      {q.help && <Body muted>{q.help}</Body>}
      {q.why && <Body muted style={{ fontSize: 15 }}>Why we ask: {q.why}</Body>}
      {input}
      <FieldError message={error} />
    </View>
  );
}
