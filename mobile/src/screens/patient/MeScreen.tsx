import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthContext';
import { Body, Button, Card, Heading, Screen, Title } from '../../components/ui';
import { EmergencyFooter } from '../../components/health';
import { RootStackParamList } from '../../navigation/types';

export function MeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, signOut } = useAuth();
  return (
    <Screen variant={1} testID="me-screen">
      <Title>Me</Title>
      <Body muted>{user?.email}</Body>
      <Card>
        <Heading>My health</Heading>
        <Button title="Health profile" icon="🧾" variant="secondary" onPress={() => navigation.navigate('HealthProfile')} />
        <Button title="Share a summary with my doctor" icon="📄" variant="secondary" onPress={() => navigation.navigate('Summary')} />
        <Button title="Appointments" icon="📅" variant="secondary" onPress={() => navigation.navigate('Appointments')} />
      </Card>
      <Card>
        <Heading>My care team</Heading>
        <Body muted>Connect with your doctor so they can see what you choose and message you.</Body>
        <Button title="Connect & message" icon="💬" variant="secondary" onPress={() => navigation.navigate('CareTeam')} />
      </Card>
      <Card>
        <Button title="Settings & privacy" icon="⚙️" variant="secondary" onPress={() => navigation.navigate('Settings')} />
        <Button title="Sign out" variant="ghost" onPress={() => void signOut()} testID="sign-out" />
      </Card>
      <EmergencyFooter />
    </Screen>
  );
}
