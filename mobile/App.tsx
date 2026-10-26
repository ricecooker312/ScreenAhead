import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { DisplayPrefs } from './src/components/ui';

function WithPrefs({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const prefs = { scale: user?.settings?.largeText ? 1.2 : 1, showDefinitions: user?.settings?.showDefinitions ?? true };
  return <DisplayPrefs.Provider value={prefs}>{children}</DisplayPrefs.Provider>;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <WithPrefs>
          <StatusBar style="dark" />
          <RootNavigator />
        </WithPrefs>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
