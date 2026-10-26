import React from 'react';
import { useAuth } from '../../auth/AuthContext';
import { Body, Button, Card, Screen, Title } from '../../components/ui';

/** Admin tools (provider verification, clinician verification, content) are API-only for now. */
export function AdminHomeScreen() {
  const { signOut } = useAuth();
  return (
    <Screen>
      <Title>Admin</Title>
      <Card>
        <Body>Admin tools are available through the API (/api/admin). See the API docs at /api/docs.</Body>
        <Body muted>Admins cannot view patient health information.</Body>
      </Card>
      <Button title="Sign out" variant="secondary" onPress={() => void signOut()} />
    </Screen>
  );
}
