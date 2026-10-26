import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Providers, mockNavigation } from '../test-utils';
import { QuestionnaireScreen } from '../src/screens/patient/QuestionnaireScreen';
import { QuestionnaireDefinition } from '../src/questionnaire/shared/types';

const mockApi = { get: jest.fn(), post: jest.fn(), patch: jest.fn() };
jest.mock('../src/api/client', () => {
  class ApiError extends Error {}
  return { api: { get: (...a: unknown[]) => mockApi.get(...a), post: (...a: unknown[]) => mockApi.post(...a), patch: (...a: unknown[]) => mockApi.patch(...a) }, ApiError };
});

const definition: QuestionnaireDefinition = {
  version: '1.0.0',
  sections: [
    {
      id: 'urgent_check',
      title: 'Quick safety check',
      intro: 'First, a few quick questions.',
      questions: [
        {
          id: 'breathing',
          type: 'single',
          label: 'How is your breathing right now?',
          safetyCritical: true,
          required: true,
          options: [
            { value: 'normal', label: 'Normal' },
            { value: 'severe', label: 'Very hard to breathe, even when resting' },
          ],
        },
        { id: 'vomiting_blood', type: 'single', label: 'Have you thrown up blood?', safetyCritical: true, required: true, options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
      ],
    },
    {
      id: 'duration',
      title: 'How long',
      intro: '',
      questions: [
        { id: 'comfort_tried', type: 'single', label: 'Have you tried things without medicine?', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
        { id: 'comfort_effect', type: 'single', label: 'Did it help?', showIf: { q: 'comfort_tried', eq: 'yes' }, options: [{ value: 'helped', label: 'It helped' }] },
      ],
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockApi.get.mockResolvedValue({ definition, inProgress: null });
  mockApi.post.mockResolvedValue({ questionnaire: { _id: 'q1' } });
  mockApi.patch.mockResolvedValue({ safetyCheck: { emergency: false, warnings: [] } });
});

const renderScreen = async (nav = mockNavigation()) => {
  await render(
    <Providers>
      <QuestionnaireScreen navigation={nav} route={{ key: 'q', name: 'Questionnaire', params: undefined } as any} />
    </Providers>,
  );
  return nav;
};

describe('Questionnaire', () => {
  it('shows the emergency screen as soon as an emergency answer is given — before finishing', async () => {
    const warnings = [{ ruleId: 'E-BREATHING', level: 'emergency', timeframe: 'now', title: 'Breathing', message: 'Call 911', explanation: 'x' }];
    mockApi.patch.mockResolvedValueOnce({ safetyCheck: { emergency: true, warnings } });
    const nav = await renderScreen();
    await fireEvent.press(await screen.findByTestId('breathing-severe'));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('Emergency', { warnings }));
    expect(mockApi.patch).toHaveBeenCalledWith('/api/questionnaires/q1', { answers: { breathing: 'severe' }, currentSection: 'urgent_check' });
    expect(mockApi.post).not.toHaveBeenCalledWith(expect.stringContaining('/submit'));
  });

  it('requires answers before moving on', async () => {
    await renderScreen();
    await fireEvent.press(await screen.findByTestId('questionnaire-next'));
    expect(await screen.findAllByText('Please choose an answer')).toHaveLength(2);
  });

  it('shows a progress indicator and branches follow-up questions', async () => {
    await renderScreen();
    expect(await screen.findByText('Step 1 of 2')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('breathing-normal'));
    await fireEvent.press(screen.getByTestId('vomiting_blood-no'));
    await fireEvent.press(screen.getByTestId('questionnaire-next'));
    expect(await screen.findByText('Step 2 of 2')).toBeTruthy();
    expect(screen.queryByText('Did it help?')).toBeNull();
    await fireEvent.press(screen.getByTestId('comfort_tried-yes'));
    expect(screen.getByText('Did it help?')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('comfort_tried-no'));
    expect(screen.queryByText('Did it help?')).toBeNull();
  });

  it('submits on the last step and opens results', async () => {
    const triage = { careLevel: 'routine', warnings: [], nextSteps: [], disclaimers: [] };
    mockApi.post.mockImplementation(async (path: string) => (path.endsWith('/submit') ? { triage, recommendations: [] } : { questionnaire: { _id: 'q1' } }));
    const nav = await renderScreen();
    await fireEvent.press(await screen.findByTestId('breathing-normal'));
    await fireEvent.press(screen.getByTestId('vomiting_blood-no'));
    await fireEvent.press(screen.getByTestId('questionnaire-next'));
    await screen.findByText('Step 2 of 2');
    await fireEvent.press(screen.getByTestId('comfort_tried-no'));
    await fireEvent.press(screen.getByTestId('questionnaire-next'));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('Results', { triage, recommendations: [] }));
  });
});
