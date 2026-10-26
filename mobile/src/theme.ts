/**
 * Calm healthcare palette (blue, teal, white, neutrals) with soft pastel accents
 * for the bubbly backgrounds. Text colours meet WCAG AA contrast on white and
 * on the pastel tints.
 */
export const colors = {
  background: '#F4F8FF',
  surface: '#FFFFFF',
  text: '#1B2A41', // navy — 14:1 on white
  textMuted: '#4A5B70', // 7:1 on white
  primary: '#1F6FB2', // blue — 5.4:1 on white
  primaryDark: '#165287',
  teal: '#0F7C7A', // 5:1 on white
  border: '#D5DFEC',
  focus: '#7C4DFF',
  // pastel bubbles
  bubbleBlue: '#CFE6FF',
  bubbleMint: '#CFF3E8',
  bubblePink: '#FFD9E6',
  bubbleLavender: '#E5DAFF',
  bubblePeach: '#FFE3CC',
  bubbleYellow: '#FFF3C4',
  // care levels — gentle tints with strong text
  emergencyBg: '#FFE1DE',
  emergencyText: '#8A1C12',
  emergencyButton: '#B3261E',
  promptBg: '#FFEBD2',
  promptText: '#7A3E00',
  routineBg: '#D9F5EC',
  routineText: '#0B5D46',
  infoBg: '#ECE6FF',
  infoText: '#4527A0',
  demoBg: '#FFF3C4',
  demoText: '#6B4E00',
  error: '#B3261E',
};

export const radius = { sm: 10, md: 18, lg: 28, pill: 999 };
export const spacing = (n: number) => n * 8;
export const MIN_TOUCH = 48;

export const careLevelStyle: Record<string, { bg: string; text: string; label: string; emoji: string }> = {
  emergency: { bg: colors.emergencyBg, text: colors.emergencyText, label: 'Get help now', emoji: '🚑' },
  prompt: { bg: colors.promptBg, text: colors.promptText, label: 'See a doctor', emoji: '🩺' },
  routine: { bg: colors.routineBg, text: colors.routineText, label: 'Next steps', emoji: '🌱' },
  insufficient_information: { bg: colors.infoBg, text: colors.infoText, label: 'Talk to a professional', emoji: '💬' },
};
