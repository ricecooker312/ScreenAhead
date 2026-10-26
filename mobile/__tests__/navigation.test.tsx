import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Providers } from '../test-utils';
import { RootNavigator } from '../src/navigation/RootNavigator';

let mockUser: any = null;
jest.mock('../src/auth/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, loading: false, signOut: jest.fn() }),
}));

const mockGet = jest.fn();
jest.mock('../src/api/client', () => ({
  api: { get: (...a: unknown[]) => mockGet(...a), publicGet: (...a: unknown[]) => mockGet(...a), post: jest.fn() },
  ApiError: class extends Error {},
}));

const dashboard = {
  nextAction: { title: 'Take the health check', detail: 'A few short questions.', action: 'questionnaire' },
  activeWarnings: [],
  lastCheckAt: null,
  careLevel: null,
  recentSymptoms: [],
  upcomingAppointments: [],
  savedProviders: [],
  resources: [],
  medications: [],
  allergies: [],
  questionsForClinician: [],
  inProgressQuestionnaire: null,
  unreadMessages: 0,
};

const renderNav = () =>
  render(
    <Providers>
      <RootNavigator />
    </Providers>,
  );

describe('navigation by role', () => {
  beforeEach(() => mockGet.mockReset());

  it('signed-out users see the welcome screen', async () => {
    mockUser = null;
    await renderNav();
    expect(await screen.findByTestId('welcome-screen')).toBeTruthy();
  });

  it('patients land on the dashboard with tabs', async () => {
    mockUser = { _id: 'u', role: 'patient', email: 'p@x', settings: {} };
    mockGet.mockResolvedValue(dashboard);
    await renderNav();
    expect(await screen.findByTestId('dashboard-screen')).toBeTruthy();
    expect(screen.getByText('Take the health check')).toBeTruthy();
    for (const tab of ['Home', 'Track', 'Find care', 'Learn', 'Me']) expect(screen.getAllByText(tab).length).toBeGreaterThan(0);
  });

  it('clinicians land on their patient list', async () => {
    mockUser = { _id: 'c', role: 'clinician', email: 'c@x', settings: {}, clinician: { verificationStatus: 'verified' } };
    mockGet.mockResolvedValue({ items: [] });
    await renderNav();
    expect(await screen.findByTestId('clinician-patients')).toBeTruthy();
    expect(screen.getByText('Connect with a patient')).toBeTruthy();
  });

  it('unverified clinicians are told verification is pending', async () => {
    mockUser = { _id: 'c', role: 'clinician', email: 'c@x', settings: {}, clinician: { verificationStatus: 'pending' } };
    await renderNav();
    expect(await screen.findByText('Verification pending')).toBeTruthy();
  });
});
