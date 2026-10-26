import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Term, DisplayPrefs, Button } from '../src/components/ui';
import { SeverityScale } from '../src/components/forms';
import { GLOSSARY } from '../src/content/glossary';

describe('Term (plain-language definitions)', () => {
  it('shows the word followed by a simple meaning', async () => {
    await render(<Term word="colonoscopy" />);
    expect(screen.getByText('colonoscopy')).toBeTruthy();
    expect(screen.getByText(/a test where a doctor looks inside your bowel/)).toBeTruthy();
  });

  it('can be turned off in settings', async () => {
    await render(
      <DisplayPrefs.Provider value={{ scale: 1, showDefinitions: false }}>
        <Term word="colonoscopy" />
      </DisplayPrefs.Provider>,
    );
    expect(screen.queryByText(/thin camera/)).toBeNull();
  });

  it('glossary definitions use short, simple sentences', async () => {
    for (const [word, meaning] of Object.entries(GLOSSARY)) {
      expect(meaning.split(' ').length).toBeLessThanOrEqual(14);
      expect(meaning).not.toMatch(new RegExp(`\\b${word}\\b`, 'i'));
    }
  });
});

describe('SeverityScale', () => {
  it('steps up and down within 1–10', async () => {
    const onChange = jest.fn();
    const { rerender } = await render(<SeverityScale value={10} onChange={onChange} />);
    await fireEvent.press(screen.getByTestId('severity-higher'));
    expect(onChange).toHaveBeenLastCalledWith(10);
    await rerender(<SeverityScale value={1} onChange={onChange} />);
    await fireEvent.press(screen.getByTestId('severity-lower'));
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it('offers "Not applicable" when allowed', async () => {
    const onChange = jest.fn();
    await render(<SeverityScale value={undefined} onChange={onChange} allowNotApplicable />);
    await fireEvent.press(screen.getByTestId('severity-na'));
    expect(onChange).toHaveBeenCalledWith('na');
  });

  it('announces the current value to screen readers', async () => {
    await render(<SeverityScale value={6} onChange={jest.fn()} />);
    expect(screen.getByLabelText('Severity 6 out of 10')).toBeTruthy();
  });
});

describe('Button', () => {
  it('is an accessible button and respects disabled', async () => {
    const onPress = jest.fn();
    await render(<Button title="Save" onPress={onPress} disabled />);
    const btn = screen.getByRole('button', { name: 'Save' });
    await fireEvent.press(btn);
    expect(onPress).not.toHaveBeenCalled();
  });
});
