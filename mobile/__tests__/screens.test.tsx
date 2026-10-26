import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Providers, mockNavigation } from '../test-utils';
import { WelcomeScreen } from '../src/screens/auth/WelcomeScreen';
import { OnboardingScreen } from '../src/screens/auth/OnboardingScreen';
import { LoginScreen } from '../src/screens/auth/LoginScreen';
import { ResultsScreen } from '../src/screens/patient/ResultsScreen';
import { EmergencyScreen } from '../src/screens/patient/EmergencyScreen';
import { Triage } from '../src/api/types';

const mockSignIn = jest.fn();
jest.mock('../src/auth/AuthContext', () => ({
  useAuth: () => ({ signIn: mockSignIn, user: null }),
}));

const wrap = async (ui: React.ReactElement) => render(<Providers>{ui}</Providers>);

describe('Welcome', () => {
  it('opens with brief, easy sentences and no long lists', async () => {
    const nav = mockNavigation();
    await wrap(<WelcomeScreen navigation={nav} route={{ key: 'w', name: 'Welcome' } as any} />);
    const sentences = ['We help you understand your health.', 'We help you find the right care.'];
    for (const s of sentences) {
      expect(screen.getByText(s)).toBeTruthy();
      expect(s.split(' ').length).toBeLessThanOrEqual(8);
    }
    await fireEvent.press(screen.getByTestId('get-started'));
    expect(nav.navigate).toHaveBeenCalledWith('Onboarding');
  });
});

describe('Onboarding', () => {
  it('allows multiple categories and passes them to registration', async () => {
    const nav = mockNavigation();
    await wrap(<OnboardingScreen navigation={nav} route={{ key: 'o', name: 'Onboarding' } as any} />);
    await fireEvent.press(screen.getByTestId('cat-symptoms'));
    await fireEvent.press(screen.getByTestId('cat-increased_risk'));
    await fireEvent.press(screen.getByTestId('onboarding-next'));
    expect(nav.navigate).toHaveBeenCalledWith('Register', { categories: ['symptoms', 'increased_risk'] });
    expect(screen.getByText(/does not diagnose or treat/)).toBeTruthy();
  });
});

describe('Login form validation', () => {
  it('shows friendly errors and does not call the API with bad input', async () => {
    await wrap(<LoginScreen navigation={mockNavigation()} route={{ key: 'l', name: 'Login' } as any} />);
    await fireEvent.press(screen.getByTestId('login-submit'));
    expect(await screen.findByText('Please enter a valid email')).toBeTruthy();
    expect(screen.getByText('Please enter your password')).toBeTruthy();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('submits valid credentials', async () => {
    await wrap(<LoginScreen navigation={mockNavigation()} route={{ key: 'l', name: 'Login' } as any} />);
    await fireEvent.changeText(screen.getByTestId('login-email'), 'me@example.com');
    await fireEvent.changeText(screen.getByTestId('login-password'), 'Secret12345');
    await fireEvent.press(screen.getByTestId('login-submit'));
    await waitFor(() => expect(mockSignIn).toHaveBeenCalledWith('me@example.com', 'Secret12345'));
  });
});

const baseTriage: Triage = {
  careLevel: 'routine',
  timeframe: 'routine',
  headline: 'Here are some helpful next steps.',
  warnings: [],
  nextSteps: [{ id: 'screening_discussion', title: 'Talk about colorectal cancer screening', detail: 'Ask a doctor.', specialty: 'primary_care' }],
  medication: { status: 'not_requested', title: '', message: '', reasons: [], cautions: [] },
  comfort: { show: true, options: [] },
  disclaimers: [
    'This is not a diagnosis (a doctor’s decision about what is causing your symptoms).',
    'Not having warning signs does not mean you do not have cancer or another illness.',
  ],
  rulesetVersion: 'test',
};

describe('Results', () => {
  it('shows disclaimers and never says the user is cancer-free', async () => {
    await wrap(<ResultsScreen navigation={mockNavigation()} route={{ key: 'r', name: 'Results', params: { triage: baseTriage, recommendations: [] } } as any} />);
    expect(screen.getByText(/does not mean you do not have cancer/)).toBeTruthy();
    expect(screen.queryByText(/cancer[- ]free|you are healthy|nothing to worry/i)).toBeNull();
  });

  it('lets the user jump to a matching specialist', async () => {
    const nav = mockNavigation();
    await wrap(<ResultsScreen navigation={nav} route={{ key: 'r', name: 'Results', params: { triage: baseTriage, recommendations: [] } } as any} />);
    await fireEvent.press(screen.getByText('Find Primary care'));
    expect(nav.navigate).toHaveBeenCalledWith('PatientTabs', { screen: 'FindCare', params: { specialty: 'primary_care' } });
  });

  it('emergency results show only the emergency panel', async () => {
    const t = { ...baseTriage, careLevel: 'emergency' as const, warnings: [{ ruleId: 'E-BREATHING', level: 'emergency' as const, timeframe: 'now', title: 'Breathing', message: 'Call 911 now.', explanation: 'Very hard to breathe.' }] };
    await wrap(<ResultsScreen navigation={mockNavigation()} route={{ key: 'r', name: 'Results', params: { triage: t, recommendations: [] } } as any} />);
    expect(screen.getByTestId('call-emergency')).toBeTruthy();
    expect(screen.queryByText('Talk about colorectal cancer screening')).toBeNull();
  });
});

describe('Emergency screen', () => {
  it('has a prominent call button and explains why', async () => {
    const warnings = [{ ruleId: 'E-BLEEDING', level: 'emergency' as const, timeframe: 'now', title: 'Bleeding', message: 'Call 911 now.', explanation: 'Heavy bleeding.' }];
    await wrap(<EmergencyScreen navigation={mockNavigation()} route={{ key: 'e', name: 'Emergency', params: { warnings } } as any} />);
    expect(screen.getByRole('button', { name: 'Call 911' })).toBeTruthy();
    expect(screen.getByText(/Heavy bleeding/)).toBeTruthy();
  });
});
