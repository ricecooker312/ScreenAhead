const store: Record<string, string> = {};
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (k: string) => store[k] ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => {
    store[k] = v;
  }),
  deleteItemAsync: jest.fn(async (k: string) => {
    delete store[k];
  }),
}));

jest.mock('@react-native-community/slider', () => {
  const { View } = require('react-native');
  return (props: Record<string, unknown>) => require('react').createElement(View, { ...props, testID: props.testID ?? 'slider' });
});
