import React from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/ui';
import { EmergencyPanel } from '../../components/health';
import { RootStackParamList } from '../../navigation/types';

/** Shown as soon as any emergency rule fires — never after the rest of the questionnaire. */
export function EmergencyScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'Emergency'>) {
  return (
    <Screen testID="emergency-screen">
      <EmergencyPanel warnings={route.params.warnings} onSafe={() => navigation.navigate('PatientTabs')} />
    </Screen>
  );
}
