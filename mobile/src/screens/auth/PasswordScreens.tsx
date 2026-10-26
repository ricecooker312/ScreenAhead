import React, { useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../../api/client';
import { Body, Button, Card, ErrorState, Screen, Title } from '../../components/ui';
import { FormField } from '../../components/forms';
import { errorMessage } from '../../hooks/useApi';
import { RootStackParamList } from '../../navigation/types';
import { passwordRule } from './RegisterScreen';
import { colors } from '../../theme';

export function ForgotPasswordScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>) {
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<{ email: string }>({
    resolver: zodResolver(z.object({ email: z.email('Please enter a valid email') })),
    defaultValues: { email: '' },
  });
  const onSubmit = handleSubmit(async ({ email }) => {
    setError(null);
    try {
      const r = await api.publicPost<{ message: string }>('/api/auth/forgot-password', { email: email.trim() });
      setSent(r.message);
    } catch (e) {
      setError(errorMessage(e));
    }
  });
  return (
    <Screen>
      <Title>Reset your password</Title>
      <Body muted>We will email you a link.</Body>
      <Card>
        <FormField control={control} name="email" label="Email" autoCapitalize="none" keyboardType="email-address" />
      </Card>
      {sent && (
        <Card tint={colors.routineBg}>
          <Body accessibilityLiveRegion="polite">{sent}</Body>
        </Card>
      )}
      {error && <ErrorState message={error} />}
      <Button title="Send link" onPress={onSubmit} loading={formState.isSubmitting} />
      <Button title="I have a reset code" variant="ghost" onPress={() => navigation.navigate('ResetPassword')} />
    </Screen>
  );
}

const resetSchema = z
  .object({ token: z.string().min(20, 'Paste the code from your email'), newPassword: passwordRule, confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

export function ResetPasswordScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'ResetPassword'>) {
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { token: route.params?.token ?? '', newPassword: '', confirm: '' },
  });
  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      await api.publicPost('/api/auth/reset-password', { token: v.token.trim(), newPassword: v.newPassword });
      navigation.navigate('Login');
    } catch (e) {
      setError(errorMessage(e));
    }
  });
  return (
    <Screen>
      <Title>Choose a new password</Title>
      <Card>
        <FormField control={control} name="token" label="Code from your email" autoCapitalize="none" />
        <FormField control={control} name="newPassword" label="New password" hint="10+ characters, with a number" secureTextEntry />
        <FormField control={control} name="confirm" label="Type it again" secureTextEntry />
      </Card>
      {error && <ErrorState message={error} />}
      <Button title="Save password" onPress={onSubmit} loading={formState.isSubmitting} />
    </Screen>
  );
}
