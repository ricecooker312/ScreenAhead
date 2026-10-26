import React, { useState } from 'react';
import { Share } from 'react-native';
import { api } from '../../api/client';
import { User } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { errorMessage } from '../../hooks/useApi';
import { Body, Button, Card, ErrorState, Heading, Screen, Title } from '../../components/ui';
import { TextField, ToggleRow } from '../../components/forms';
import { colors } from '../../theme';

export function SettingsScreen() {
  const { user, setUser, signOut } = useAuth();
  const [name, setName] = useState(user?.displayName ?? '');
  const [phone, setPhone] = useState(user?.contactPhone ?? '');
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const patch = async (body: Record<string, unknown>) => {
    setError(null);
    try {
      setUser(await api.patch<User>('/api/users/me', body));
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const exportData = async () => {
    try {
      const data = await api.get('/api/users/me/export');
      await Share.share({ message: JSON.stringify(data, null, 2), title: 'My CareCompass data' });
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const deleteAccount = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.del('/api/users/me', { password });
      await signOut();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen variant={4}>
      <Title>Settings & privacy</Title>
      <Card>
        <Heading>You</Heading>
        <TextField label="First name" value={name} onChangeText={setName} onBlur={() => void patch({ displayName: name })} />
        <TextField
          label="Phone (optional)"
          hint="Only shared with doctors you connect with, if you choose."
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          onBlur={() => void patch({ contactPhone: phone })}
        />
      </Card>
      <Card>
        <Heading>Reading</Heading>
        <ToggleRow label="Bigger text" value={!!user?.settings.largeText} onChange={(v) => void patch({ settings: { largeText: v } })} />
        <ToggleRow
          label="Explain hard words"
          hint="Shows a short meaning after medical words."
          value={user?.settings.showDefinitions ?? true}
          onChange={(v) => void patch({ settings: { showDefinitions: v } })}
        />
      </Card>
      <Card tint="#F2FBF8">
        <Heading>Your privacy</Heading>
        <Body>We keep your health information to guide you. We never sell it. We never use it for ads.</Body>
        <Body>Doctors only see what you choose to share. You can stop sharing any time.</Body>
        <Button title="Download my data" variant="secondary" onPress={() => void exportData()} />
        <Button title="Sign out on all devices" variant="secondary" onPress={() => void api.post('/api/auth/logout-all').then(signOut)} />
      </Card>
      <Card tint={colors.emergencyBg}>
        <Heading style={{ color: colors.emergencyText }}>Delete my account</Heading>
        <Body style={{ color: colors.emergencyText }}>This removes your account and all your health information. It cannot be undone.</Body>
        {!confirmDelete ? (
          <Button title="Delete my account" variant="danger" onPress={() => setConfirmDelete(true)} />
        ) : (
          <>
            <TextField label="Type your password to confirm" secureTextEntry value={password} onChangeText={setPassword} testID="delete-password" />
            <Button title="Yes, delete everything" variant="danger" onPress={() => void deleteAccount()} loading={busy} disabled={!password} testID="confirm-delete" />
            <Button title="Cancel" variant="ghost" onPress={() => setConfirmDelete(false)} />
          </>
        )}
      </Card>
      {error && <ErrorState message={error} />}
    </Screen>
  );
}
