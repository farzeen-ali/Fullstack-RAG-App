import '@/global.css';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { KnowledgeBaseProvider } from '@/context/knowledge-base';
import { useAppTheme } from '@/hooks/use-app-theme';

export default function RootLayout() {
  const { isDark, palette } = useAppTheme();
  const base = isDark ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: palette.brand,
      background: palette.background,
      card: palette.surface,
      border: palette.border,
      text: palette.text,
    },
  };

  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <ThemeProvider value={navigationTheme}>
          <KnowledgeBaseProvider>
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: palette.background },
              }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="knowledge" options={{ presentation: 'modal' }} />
            </Stack>
          </KnowledgeBaseProvider>
        </ThemeProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
