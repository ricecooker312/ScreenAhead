import { Recommendation, Triage, Warning } from '../api/types';

export type RootStackParamList = {
  // signed out
  Welcome: undefined;
  Onboarding: undefined;
  Register: { categories?: string[]; role?: 'patient' | 'clinician' } | undefined;
  Login: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token?: string } | undefined;
  // shared
  ResourceDetail: { id: string };
  PublicResources: undefined;
  MessageThread: { connectionId: string; title: string };
  // patient
  PatientTabs: undefined;
  Questionnaire: { restart?: boolean } | undefined;
  Results: { triage: Triage; recommendations: Recommendation[] };
  Emergency: { warnings: Warning[] };
  SymptomForm: undefined;
  Appointments: undefined;
  AppointmentForm: { providerId?: string; providerName?: string } | undefined;
  ProviderDetail: { id: string };
  HealthProfile: undefined;
  CareTeam: undefined;
  Summary: undefined;
  Settings: undefined;
  // clinician
  ClinicianTabs: undefined;
  PatientDetail: { connectionId: string; name: string };
  AdminHome: undefined;
};

export type PatientTabParamList = {
  Home: undefined;
  Track: undefined;
  FindCare: { specialty?: string } | undefined;
  Learn: { topic?: string } | undefined;
  Me: undefined;
};

export type ClinicianTabParamList = {
  Patients: undefined;
  Account: undefined;
};
