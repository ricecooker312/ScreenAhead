import React from 'react';
import { Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Body, Button, Card, Screen, Title } from '../../components/ui';
import { EmergencyFooter } from '../../components/health';
import { RootStackParamList } from '../../navigation/types';

/** First screen: three short sentences, three clear choices. */
export function WelcomeScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Welcome'>) {
  return (
    <Screen variant={1} testID="welcome-screen">
      <View style={{ height: 40 }} />
      <Text style={{ fontSize: 64, textAlign: 'center' }} accessibilityElementsHidden>
        🧭
      </Text>
      <Title style={{ textAlign: 'center' }}>Hi, welcome to CareCompass</Title>
      <Card>
        <Body style={{ fontSize: 19, lineHeight: 28, textAlign: 'center' }}>We help you understand your health.</Body>
        <Body style={{ fontSize: 19, lineHeight: 28, textAlign: 'center' }}>We help you find the right care.</Body>
        <Body muted style={{ textAlign: 'center' }}>We are not a doctor, but we can help you talk to one.</Body>
      </Card>
      <Button title="Get started" onPress={() => navigation.navigate('Onboarding')} testID="get-started" />
      <Button title="I have an account" variant="secondary" onPress={() => navigation.navigate('Login')} />
      <Button title="Just looking? Learn first" variant="ghost" onPress={() => navigation.navigate('PublicResources')} />
      <EmergencyFooter />
    </Screen>
  );
}
