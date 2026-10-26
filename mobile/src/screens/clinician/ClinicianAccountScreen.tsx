import React from 'react';
import { useAuth } from '../../auth/AuthContext';
import { Body, Button, Card, Heading, Pill, Screen, Title } from '../../components/ui';
import { colors } from '../../theme';

export function ClinicianAccountScreen() {
  const { user, signOut } = useAuth();
  const status = user?.clinician?.verificationStatus ?? 'pending';
  return (
    <Screen variant={1}>
      <Title>Account</Title>
      <Card>
        <Heading>{user?.displayName ?? user?.email}</Heading>
        <Body muted>{[user?.clinician?.credentials, user?.clinician?.specialty, user?.clinician?.organization].filter(Boolean).join(' · ')}</Body>
        <Pill
          text={status === 'verified' ? '✓ Verified clinician' : status === 'rejected' ? 'Verification not approved' : 'Verification pending'}
          bg={status === 'verified' ? colors.routineBg : colors.infoBg}
          color={status === 'verified' ? colors.routineText : colors.infoText}
        />
      </Card>
      <Card tint="#F7F9FC">
        <Body>Patients decide what you can see and can stop sharing at any time. Every time you open a patient summary, it is recorded in an audit log.</Body>
      </Card>
      <Button title="Sign out" variant="secondary" onPress={() => void signOut()} />
    </Screen>
  );
}
