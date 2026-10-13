import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useStore } from 'zustand';
import { AppText } from '../components/common/AppText';
import { Button } from '../components/common/Button';
import { Toast } from '../components/common/Toast';
import { GoogleAuthGateway } from '../infrastructure/google-auth/GoogleAuthGateway';
import { LOCAL_OWNER, ownerForAccount } from '../infrastructure/database/metaStore';
import { openAppDatabase, openMetaStore } from '../infrastructure/database/openDatabase';
import { SchemaTooNewError } from '../infrastructure/database/migrations';
import { I18nProvider, t, tn, useT } from '../i18n';
import { toast, toastError } from '../store/toastStore';
import { ThemeProvider, useTheme } from '../theme/ThemeProvider';
import { AppContextProvider, type AccountActions } from './AppContext';
import { RootNavigator } from './navigation/RootNavigator';
import { openSession, type Session } from './session';

type Status = { state: 'loading' } | { state: 'ready'; session: Session } | { state: 'error'; message: string };

const auth = new GoogleAuthGateway();

/** Workouts logged before signing in, carried into the account's database if the user agrees. */
type Carry = { json: string; count: number } | null;

export default function App() {
  const [status, setStatus] = useState<Status>({ state: 'loading' });
  const sessionRef = useRef<Session | null>(null);

  const open = useCallback(async (owner?: string, carry: Carry = null) => {
    setStatus({ state: 'loading' });
    try {
      const meta = await openMetaStore();
      const target = owner ?? (await meta.getOwner());
      if (sessionRef.current) await sessionRef.current.dispose();
      sessionRef.current = null;
      const session = await openSession(target, auth);
      await meta.setOwner(target);
      sessionRef.current = session;
      setStatus({ state: 'ready', session });
      if (carry) offerCarry(session, carry);
    } catch (e) {
      console.error(e);
      setStatus({
        state: 'error',
        message:
          e instanceof SchemaTooNewError ? t('common.app.schemaTooNew') : t('common.app.openFailed'),
      });
    }
  }, []);

  useEffect(() => {
    void open();
    return () => {
      void sessionRef.current?.dispose();
    };
  }, [open]);

  const account: AccountActions = useMemo(
    () => ({
      async signIn() {
        const current = sessionRef.current;
        if (!current) return;
        const acc = await auth.signIn();
        if (!acc) return; // cancelled
        const target = ownerForAccount(acc.id);
        if (target === current.owner) {
          await current.scheduler.refresh();
          return;
        }
        let carry: Carry = null;
        if (current.owner === LOCAL_OWNER) {
          const count = (await current.services.history.list({ limit: 1 })).length;
          if (count) {
            const { json } = await current.services.backup.exportJson();
            carry = { json, count: (await current.services.history.list({ limit: 5000 })).length };
          }
        }
        await open(target, carry);
      },
      async connectDrive() {
        const s = sessionRef.current;
        if (!s) return;
        const granted = await auth.authorizeDrive();
        await s.scheduler.refresh();
        if (granted) {
          const out = await s.scheduler.runNow();
          if (out) toast(t('backup.account.backedUp'));
        }
      },
      async signOut() {
        await auth.signOut();
        await open(LOCAL_OWNER);
        toast(t('backup.account.signedOut'));
      },
      async disconnect() {
        await auth.revoke();
        await open(LOCAL_OWNER);
        toast(t('backup.account.disconnected'));
      },
      async wipeLocal() {
        const s = sessionRef.current;
        if (!s) return;
        await s.dispose();
        sessionRef.current = null;
        // Reopen just to delete: destroy() removes the whole file.
        openAppDatabase(s.owner).destroy();
        await open(s.owner);
        toast(t('backup.account.wiped'));
      },
    }),
    [open],
  );

  return (
    <SafeAreaProvider>
      {status.state === 'ready' ? (
        <Ready session={status.session} account={account} />
      ) : (
        <ThemeProvider preference="system">
          <Splash error={status.state === 'error' ? status.message : null} onRetry={() => void open()} />
        </ThemeProvider>
      )}
    </SafeAreaProvider>
  );
}

/** Asks before copying pre-sign-in workouts into an account that has none yet. */
function offerCarry(session: Session, carry: NonNullable<Carry>) {
  void session.services.history.list({ limit: 1 }).then(existing => {
    if (existing.length) return; // the account already has history; never mix silently
    Alert.alert(
      t('backup.carry.title'),
      tn('backup.carry.message', carry.count),
      [
        { text: t('backup.carry.notNow'), style: 'cancel' },
        {
          text: t('backup.carry.add'),
          onPress: async () => {
            try {
              const preview = await session.services.backup.previewImport(carry.json);
              await session.services.backup.applyImport(preview.file);
              await session.activeWorkout.getState().load();
              toast(t('backup.carry.added'));
            } catch (e) {
              toastError(e);
            }
          },
        },
      ],
    );
  }, toastError);
}

function Ready({ session, account }: { session: Session; account: AccountActions }) {
  const theme = useStore(session.settings, s => s.settings.theme);
  const language = useStore(session.settings, s => s.settings.language);
  const value = useMemo(() => ({ ...session, account }), [session, account]);
  return (
    <AppContextProvider value={value}>
      <I18nProvider preference={language}>
        <ThemeProvider preference={theme}>
          <ThemedStatusBar />
          {/* Remount navigation per owner (no screen keeps another account's data) and per language (headers re-read their titles). */}
          <RootNavigator key={`${session.owner}|${language}`} />
          <Toast />
        </ThemeProvider>
      </I18nProvider>
    </AppContextProvider>
  );
}

function ThemedStatusBar() {
  const theme = useTheme();
  return <StatusBar barStyle={theme.dark ? 'light-content' : 'dark-content'} />;
}

function Splash({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  const theme = useTheme();
  const { t: tr } = useT();
  return (
    // While loading it continues the native launch screen (amber); errors use the normal theme to stay readable.
    <View style={[s.splash, { backgroundColor: error ? theme.colors.bg : theme.colors.amber }]}>
      <AppText variant="display" style={!error && s.onAmber}>
        RepNexa
      </AppText>
      {error ? (
        <>
          <AppText color="ink2" style={s.msg}>
            {error}
          </AppText>
          <Button label={tr('common.retry')} onPress={onRetry} style={s.btn} />
        </>
      ) : (
        <ActivityIndicator color={LAUNCH_INK} style={s.msg} />
      )}
    </View>
  );
}

/** Matches the launch storyboard / Android splash. */
const LAUNCH_INK = '#241600';

const s = StyleSheet.create({
  onAmber: { color: LAUNCH_INK },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  msg: { marginTop: 16, textAlign: 'center' },
  btn: { marginTop: 20, alignSelf: 'stretch' },
});
