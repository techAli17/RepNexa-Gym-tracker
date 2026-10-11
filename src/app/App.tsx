import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useStore } from 'zustand';
import { createAppServices } from '../application/container';
import { AppText } from '../components/common/AppText';
import { Button } from '../components/common/Button';
import { Toast } from '../components/common/Toast';
import { SchemaTooNewError } from '../infrastructure/database/migrations';
import { openAppDatabase } from '../infrastructure/database/openDatabase';
import { createActiveWorkoutStore } from '../store/activeWorkoutStore';
import { createSettingsStore } from '../store/settingsStore';
import { ThemeProvider, useTheme } from '../theme/ThemeProvider';
import { AppContextProvider, type AppContextValue } from './AppContext';
import { RootNavigator } from './navigation/RootNavigator';

type Boot = { state: 'loading' } | { state: 'ready'; ctx: AppContextValue } | { state: 'error'; message: string };

/**
 * Opens the database, migrates, seeds the catalog and restores any in-progress
 * workout before the first screen renders, so a crash mid-workout resumes cleanly.
 */
async function boot(): Promise<AppContextValue> {
  const db = openAppDatabase();
  try {
    const services = await createAppServices(db);
    const settings = createSettingsStore(services);
    await settings.getState().load();
    const activeWorkout = createActiveWorkoutStore(services, () => settings.getState().settings);
    await activeWorkout.getState().load();
    return { services, settings, activeWorkout };
  } catch (e) {
    db.close(); // free the name so "Try again" can reopen it
    throw e;
  }
}

export default function App() {
  const [status, setStatus] = useState<Boot>({ state: 'loading' });
  const run = useCallback(() => {
    setStatus({ state: 'loading' });
    boot().then(
      ctx => setStatus({ state: 'ready', ctx }),
      e => {
        console.error(e);
        setStatus({
          state: 'error',
          message:
            e instanceof SchemaTooNewError
              ? 'Your data was saved by a newer version of RepNexa. Update the app to open it.'
              : 'RepNexa could not open its database. Your data has not been changed.',
        });
      },
    );
  }, []);
  useEffect(run, [run]);

  return (
    <SafeAreaProvider>
      {status.state === 'ready' ? (
        <Ready ctx={status.ctx} />
      ) : (
        <ThemeProvider preference="system">
          <Splash error={status.state === 'error' ? status.message : null} onRetry={run} />
        </ThemeProvider>
      )}
    </SafeAreaProvider>
  );
}

function Ready({ ctx }: { ctx: AppContextValue }) {
  const theme = useStore(ctx.settings, s => s.settings.theme);
  return (
    <AppContextProvider value={ctx}>
      <ThemeProvider preference={theme}>
        <ThemedStatusBar />
        <RootNavigator />
        <Toast />
      </ThemeProvider>
    </AppContextProvider>
  );
}

function ThemedStatusBar() {
  const t = useTheme();
  return <StatusBar barStyle={t.dark ? 'light-content' : 'dark-content'} />;
}

function Splash({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  const t = useTheme();
  return (
    <View style={[s.splash, { backgroundColor: t.colors.bg }]}>
      <AppText variant="display">RepNexa</AppText>
      {error ? (
        <>
          <AppText color="ink2" style={s.msg}>
            {error}
          </AppText>
          <Button label="Try again" onPress={onRetry} style={s.btn} />
        </>
      ) : (
        <ActivityIndicator color={t.colors.ink3} style={s.msg} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  msg: { marginTop: 16, textAlign: 'center' },
  btn: { marginTop: 20, alignSelf: 'stretch' },
});
