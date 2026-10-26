import React from 'react';
import { Text } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../auth/AuthContext';
import { colors } from '../theme';
import { Loading, Screen } from '../components/ui';
import { RootStackParamList, PatientTabParamList, ClinicianTabParamList } from './types';

import { WelcomeScreen } from '../screens/auth/WelcomeScreen';
import { OnboardingScreen } from '../screens/auth/OnboardingScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { ForgotPasswordScreen, ResetPasswordScreen } from '../screens/auth/PasswordScreens';
import { DashboardScreen } from '../screens/patient/DashboardScreen';
import { QuestionnaireScreen } from '../screens/patient/QuestionnaireScreen';
import { ResultsScreen } from '../screens/patient/ResultsScreen';
import { EmergencyScreen } from '../screens/patient/EmergencyScreen';
import { TrackScreen } from '../screens/patient/TrackScreen';
import { SymptomFormScreen } from '../screens/patient/SymptomFormScreen';
import { AppointmentsScreen, AppointmentFormScreen } from '../screens/patient/AppointmentScreens';
import { ProvidersScreen } from '../screens/patient/ProvidersScreen';
import { ProviderDetailScreen } from '../screens/patient/ProviderDetailScreen';
import { ResourcesScreen, ResourceDetailScreen } from '../screens/shared/ResourceScreens';
import { MeScreen } from '../screens/patient/MeScreen';
import { HealthProfileScreen } from '../screens/patient/HealthProfileScreen';
import { CareTeamScreen } from '../screens/patient/CareTeamScreen';
import { SummaryScreen } from '../screens/patient/SummaryScreen';
import { SettingsScreen } from '../screens/patient/SettingsScreen';
import { MessageThreadScreen } from '../screens/shared/MessageThreadScreen';
import { ClinicianPatientsScreen } from '../screens/clinician/ClinicianPatientsScreen';
import { PatientDetailScreen } from '../screens/clinician/PatientDetailScreen';
import { ClinicianAccountScreen } from '../screens/clinician/ClinicianAccountScreen';
import { AdminHomeScreen } from '../screens/clinician/AdminHomeScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const PatientTab = createBottomTabNavigator<PatientTabParamList>();
const ClinicianTab = createBottomTabNavigator<ClinicianTabParamList>();

const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.background, primary: colors.primary, text: colors.text } };
const icon = (emoji: string) => () => <Text style={{ fontSize: 22 }}>{emoji}</Text>;
const tabOptions = {
  headerShown: false,
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: colors.textMuted,
  tabBarLabelStyle: { fontSize: 13, fontWeight: '600' as const },
  tabBarStyle: { minHeight: 64, paddingTop: 6 },
};

function PatientTabs() {
  return (
    <PatientTab.Navigator screenOptions={tabOptions}>
      <PatientTab.Screen name="Home" component={DashboardScreen} options={{ tabBarIcon: icon('🏠') }} />
      <PatientTab.Screen name="Track" component={TrackScreen} options={{ tabBarIcon: icon('📈') }} />
      <PatientTab.Screen name="FindCare" component={ProvidersScreen} options={{ title: 'Find care', tabBarIcon: icon('🩺') }} />
      <PatientTab.Screen name="Learn" component={ResourcesScreen} options={{ tabBarIcon: icon('📚') }} />
      <PatientTab.Screen name="Me" component={MeScreen} options={{ tabBarIcon: icon('🙂') }} />
    </PatientTab.Navigator>
  );
}

function ClinicianTabs() {
  return (
    <ClinicianTab.Navigator screenOptions={tabOptions}>
      <ClinicianTab.Screen name="Patients" component={ClinicianPatientsScreen} options={{ tabBarIcon: icon('👥') }} />
      <ClinicianTab.Screen name="Account" component={ClinicianAccountScreen} options={{ tabBarIcon: icon('🪪') }} />
    </ClinicianTab.Navigator>
  );
}

const stackOptions = {
  headerTintColor: colors.primary,
  headerTitleStyle: { color: colors.text, fontWeight: '700' as const },
  headerBackTitle: 'Back',
  headerShadowVisible: false,
  headerStyle: { backgroundColor: colors.background },
};

export function RootNavigator() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <Screen scroll={false}>
        <Loading label="Opening CareCompass…" />
      </Screen>
    );
  }

  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator screenOptions={stackOptions}>
        {!user ? (
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ title: 'About you' }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Create account' }} />
            <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Sign in' }} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Forgot password' }} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ title: 'New password' }} />
            <Stack.Screen name="PublicResources" component={ResourcesScreen} options={{ title: 'Learn' }} />
          </>
        ) : user.role === 'patient' ? (
          <>
            <Stack.Screen name="PatientTabs" component={PatientTabs} options={{ headerShown: false }} />
            <Stack.Screen name="Questionnaire" component={QuestionnaireScreen} options={{ title: 'Health check' }} />
            <Stack.Screen name="Results" component={ResultsScreen} options={{ title: 'Your next steps' }} />
            <Stack.Screen name="Emergency" component={EmergencyScreen} options={{ title: 'Get help now', presentation: 'fullScreenModal' }} />
            <Stack.Screen name="SymptomForm" component={SymptomFormScreen} options={{ title: 'Log a symptom' }} />
            <Stack.Screen name="Appointments" component={AppointmentsScreen} options={{ title: 'Appointments' }} />
            <Stack.Screen name="AppointmentForm" component={AppointmentFormScreen} options={{ title: 'Add appointment' }} />
            <Stack.Screen name="ProviderDetail" component={ProviderDetailScreen} options={{ title: 'Provider' }} />
            <Stack.Screen name="HealthProfile" component={HealthProfileScreen} options={{ title: 'Health profile' }} />
            <Stack.Screen name="CareTeam" component={CareTeamScreen} options={{ title: 'My care team' }} />
            <Stack.Screen name="Summary" component={SummaryScreen} options={{ title: 'Share a summary' }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings & privacy' }} />
            <Stack.Screen name="MessageThread" component={MessageThreadScreen} options={({ route }) => ({ title: route.params.title })} />
          </>
        ) : user.role === 'clinician' ? (
          <>
            <Stack.Screen name="ClinicianTabs" component={ClinicianTabs} options={{ headerShown: false }} />
            <Stack.Screen name="PatientDetail" component={PatientDetailScreen} options={({ route }) => ({ title: route.params.name })} />
            <Stack.Screen name="MessageThread" component={MessageThreadScreen} options={({ route }) => ({ title: route.params.title })} />
          </>
        ) : (
          <Stack.Screen name="AdminHome" component={AdminHomeScreen} options={{ title: 'Admin' }} />
        )}
        <Stack.Screen name="ResourceDetail" component={ResourceDetailScreen} options={{ title: 'Learn' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
