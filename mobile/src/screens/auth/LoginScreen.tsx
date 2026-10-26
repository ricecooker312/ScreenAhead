import React, { useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Body, Button, Card, ErrorState, Screen, Title } from '../../components/ui';
import { FormField } from '../../components/forms';
import { useAuth } from '../../auth/AuthContext';
import { errorMessage } from '../../hooks/useApi';
import { RootStackParamList } from '../../navigation/types';

const schema = z.object({
  email: z.email('Please enter a valid email'),
  password: z.string().min(1, 'Please enter your password'),
});
type Form = z.infer<typeof schema>;

export function LoginScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Login'>) {
  const { signIn } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      await signIn(v.email.trim(), v.password);
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  return (
    <Screen variant={4} testID="login-screen">
      <Title>Welcome back</Title>
      <Body muted>Sign in to see your next steps.</Body>
      <Card>
        <FormField control={control} name="email" label="Email" autoCapitalize="none" keyboardType="email-address" autoComplete="email" testID="login-email" />
        <FormField control={control} name="password" label="Password" secureTextEntry autoComplete="current-password" testID="login-password" />
      </Card>
      {error && <ErrorState message={error} />}
      <Button title="Sign in" onPress={onSubmit} loading={formState.isSubmitting} testID="login-submit" />
      <Button title="Forgot password?" variant="ghost" onPress={() => navigation.navigate('ForgotPassword')} />
    </Screen>
  );
}
