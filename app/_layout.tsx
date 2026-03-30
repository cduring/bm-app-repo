import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../src/lib/supabase';
import { AuthContext } from '../src/context/auth';
import { RSVPProvider } from '../src/context/rsvp';
import { useNotifications } from '../src/hooks/useNotifications';

function NotificationSetup({ profileId }: { profileId: string | null }) {
  useNotifications(profileId ?? undefined);
  return null;
}

const queryClient = new QueryClient();

export default function RootLayout() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [profileExists, setProfileExists] = useState<boolean | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const router = useRouter();
  const segments = useSegments();

  // Subscribe to Supabase auth state changes
  useEffect(() => {
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        if (session) {
          // Validate against the server — catches deleted users whose access
          // token hasn't expired yet (getSession() returns the cached token
          // without a network call, so .catch() below never fires for them).
          const { error } = await supabase.auth.getUser();
          if (error) {
            await supabase.auth.signOut();
            setSession(null);
            return;
          }
        }
        setSession(session ?? null);
      })
      .catch(async () => {
        // Token rejected by server (expired, account deleted, project reset, etc).
        // Clear the stale token from SecureStore so the guard redirects to auth.
        await supabase.auth.signOut();
        setSession(null);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session ?? null);
      if (event === 'SIGNED_OUT') {
        setProfileExists(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Check whether the current user has completed onboarding (has a profile row)
  const userId = session?.user?.id;
  useEffect(() => {
    if (!userId) {
      setProfileExists(null);
      return;
    }

    supabase
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        setProfileExists(!!data);
        setProfileId(data?.id ?? null);
      });
  }, [userId]);

  // Navigation guard — runs whenever auth state or route segment changes
  useEffect(() => {
    if (session === undefined) return; // still reading session from storage

    const inAuth = segments[0] === '(auth)';
    const inOnboarding = segments[0] === '(onboarding)';

    if (!session) {
      if (!inAuth) router.replace('/(auth)');
      return;
    }

    if (profileExists === null) return; // logged in, profile check still pending

    if (!profileExists) {
      if (!inOnboarding) router.replace('/(onboarding)');
    } else {
      // Allow any non-auth/onboarding route (e.g. /edit-profile, /profile/[id])
      if (inAuth || inOnboarding) router.replace('/(tabs)');
    }
  }, [session, profileExists, segments]);

  // Called by the onboarding screen after the profile is successfully created
  function onboardingComplete() {
    setProfileExists(true);
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthContext.Provider value={{ session, profileExists, onboardingComplete }}>
        <QueryClientProvider client={queryClient}>
          <RSVPProvider>
            <NotificationSetup profileId={profileId} />
            <StatusBar style="light" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="host" options={{ presentation: 'fullScreenModal', headerShown: false }} />
            </Stack>
          </RSVPProvider>
        </QueryClientProvider>
      </AuthContext.Provider>
    </GestureHandlerRootView>
  );
}
