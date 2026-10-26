import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Body, Button, Card, ErrorState, FieldError, Heading, Screen, Title } from '../../components/ui';
import { FormField } from '../../components/forms';
import { useAuth } from '../../auth/AuthContext';
import { errorMessage } from '../../hooks/useApi';
import { RootStackParamList } from '../../navigation/types';
import { colors } from '../../theme';

export const passwordRule = z
  .string()
  .min(10, 'Use at least 10 characters')
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'Use letters and at least one number');

const mustAgree = (msg: string) => z.boolean().refine((v) => v === true, msg);

const schema = z
  .object({
    displayName: z.string().max(80).optional(),
    email: z.email('Please enter a valid email'),
    password: passwordRule,
    confirm: z.string(),
    acceptTerms: mustAgree('Please agree to the terms'),
    acceptPrivacy: mustAgree('Please agree to the privacy notice'),
    consentHealthData: mustAgree('We need your OK to keep health information'),
    credentials: z.string().optional(),
    specialty: z.string().optional(),
    organization: z.string().optional(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

type Form = z.infer<typeof schema>;

function Check({ label, detail, value, onChange, error, testID }: { label: string; detail: string; value: boolean; onChange: (v: boolean) => void; error?: string; testID: string }) {
  return (
    <View>
      <Pressable
        testID={testID}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: value }}
        accessibilityLabel={label}
        onPress={() => onChange(!value)}
        style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', minHeight: 48, paddingVertical: 4 }}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            borderWidth: 2,
            borderColor: colors.primary,
            backgroundColor: value ? colors.primary : '#FFF',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {value && <Body style={{ color: '#FFF', fontWeight: '800' }}>✓</Body>}
        </View>
        <View style={{ flex: 1 }}>
          <Body style={{ fontWeight: '700' }}>{label}</Body>
          <Body muted style={{ fontSize: 15 }}>{detail}</Body>
        </View>
      </Pressable>
      <FieldError message={error} />
    </View>
  );
}

export function RegisterScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'Register'>) {
  const { register } = useAuth();
  const role = route.params?.role ?? 'patient';
  const [serverError, setServerError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { acceptTerms: false, acceptPrivacy: false, consentHealthData: false },
  });

  const onSubmit = handleSubmit(async (v) => {
    setServerError(null);
    if (role === 'clinician' && (!v.credentials || !v.specialty)) {
      setServerError('Please add your credentials and specialty.');
      return;
    }
    try {
      await register({
        email: v.email.trim(),
        password: v.password,
        displayName: v.displayName?.trim() || undefined,
        role,
        onboardingCategories: route.params?.categories ?? [],
        acceptTerms: true,
        acceptPrivacy: true,
        consentHealthData: true,
        clinician: role === 'clinician' ? { credentials: v.credentials, specialty: v.specialty, organization: v.organization || undefined } : undefined,
      });
    } catch (e) {
      setServerError(errorMessage(e));
    }
  });

  return (
    <Screen variant={3} testID="register-screen">
      <Title>{role === 'clinician' ? 'Clinician account' : 'Create your account'}</Title>
      <Body muted>{role === 'clinician' ? 'We check every clinician before they can connect with patients.' : 'It only takes a minute.'}</Body>
      <Card>
        <FormField control={control} name="displayName" label="First name (optional)" autoComplete="given-name" />
        <FormField control={control} name="email" label="Email" autoCapitalize="none" keyboardType="email-address" autoComplete="email" testID="email" />
        <FormField control={control} name="password" label="Password" hint="10+ characters, with a number" secureTextEntry autoComplete="new-password" testID="password" />
        <FormField control={control} name="confirm" label="Type password again" secureTextEntry testID="confirm" />
      </Card>

      {role === 'clinician' && (
        <Card>
          <Heading>Your practice</Heading>
          <FormField control={control} name="credentials" label="Credentials" placeholder="e.g. MD, RN, NP" />
          <FormField control={control} name="specialty" label="Specialty" placeholder="e.g. Gastroenterology" />
          <FormField control={control} name="organization" label="Clinic or hospital (optional)" />
        </Card>
      )}

      <Card tint="#F2FBF8">
        <Heading>Your privacy</Heading>
        <Body>Your health information stays private. We never sell it or use it for ads. You can delete it any time.</Body>
        <Controller control={control} name="acceptTerms" render={({ field, fieldState }) => (
          <Check testID="accept-terms" label="I agree to the terms" detail="CareCompass gives information, not medical care." value={field.value} onChange={field.onChange} error={fieldState.error?.message} />
        )} />
        <Controller control={control} name="acceptPrivacy" render={({ field, fieldState }) => (
          <Check testID="accept-privacy" label="I have read the privacy notice" detail="It explains what we keep, why, and how to delete it." value={field.value} onChange={field.onChange} error={fieldState.error?.message} />
        )} />
        <Controller control={control} name="consentHealthData" render={({ field, fieldState }) => (
          <Check testID="accept-health" label="You may store my health answers" detail="Only to guide you. Only shared with a doctor if you choose." value={field.value} onChange={field.onChange} error={fieldState.error?.message} />
        )} />
      </Card>

      {serverError && <ErrorState message={serverError} />}
      <Button title="Create account" onPress={onSubmit} loading={formState.isSubmitting} testID="register-submit" />
      <Button title="I already have an account" variant="ghost" onPress={() => navigation.navigate('Login')} />
    </Screen>
  );
}
