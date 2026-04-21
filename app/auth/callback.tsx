import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../../src/lib/supabase';
import { Colors, Typography, Spacing, BorderRadius } from '../../src/constants/theme';

type CallbackError = {
  title: string;
  body: string;
  primaryLabel: string;
  primaryHref: '/(auth)/forgot-password' | '/(auth)/sign-up' | '/(auth)';
};

function mapError(rawMessage: string, isRecovery: boolean): CallbackError {
  const msg = rawMessage.toLowerCase();
  const isExpiredOrUsed =
    msg.includes('code verifier') ||
    msg.includes('expired') ||
    msg.includes('invalid') ||
    msg.includes('not found');

  if (isExpiredOrUsed) {
    return isRecovery
      ? {
          title: 'Link expired',
          body: 'This reset link has already been used or has expired. Please request a new one.',
          primaryLabel: 'Request new reset link',
          primaryHref: '/(auth)/forgot-password',
        }
      : {
          title: 'Link expired',
          body: 'This verification link has already been used or has expired. Please sign up again to get a new one.',
          primaryLabel: 'Back to sign up',
          primaryHref: '/(auth)/sign-up',
        };
  }

  return {
    title: 'Something went wrong',
    body: "We couldn't complete that request. Please try again.",
    primaryLabel: isRecovery ? 'Request new reset link' : 'Back to sign in',
    primaryHref: isRecovery ? '/(auth)/forgot-password' : '/(auth)',
  };
}

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{
    code?: string;
    type?: string;
    error_description?: string;
  }>();
  const [error, setError] = useState<CallbackError | null>(null);
  const isRecovery = params.type === 'recovery';

  useEffect(() => {
    if (params.error_description) {
      setError(mapError(params.error_description, isRecovery));
      return;
    }
    if (!params.code) {
      router.replace('/(auth)');
      return;
    }

    // If a session already exists, the code was already exchanged on a prior
    // mount (e.g. the user reloaded the app while the deep-link URL was still
    // the initial route). Skip re-exchange — the PKCE verifier is single-use.
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (session) {
          router.replace(isRecovery ? '/reset-password' : '/(tabs)');
          return null;
        }
        return supabase.auth.exchangeCodeForSession(params.code!);
      })
      .then((result) => {
        if (!result) return;
        const { error: exchangeError } = result;
        if (exchangeError) {
          console.error('exchangeCodeForSession failed:', exchangeError);
          setError(mapError(exchangeError.message, isRecovery));
          return;
        }
        // Check the SecureStore flag set by forgot-password.tsx to determine
        // intent — Supabase PKCE fires SIGNED_IN for recovery codes so auth
        // events alone are not a reliable signal.
        SecureStore.getItemAsync('loam_pending_recovery').then((flag) => {
          if (flag) SecureStore.deleteItemAsync('loam_pending_recovery');
          router.replace(flag ? '/reset-password' : '/(tabs)');
        });
      })
      .catch((err) => {
        console.error('Auth callback unexpected error:', err);
        setError(mapError(err?.message ?? '', isRecovery));
      });
  }, [params.code, params.error_description, isRecovery]);

  if (error) {
    return (
      <View style={styles.container}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.cancelled} />
        <Text style={styles.title}>{error.title}</Text>
        <Text style={styles.body}>{error.body}</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.replace(error.primaryHref)}
        >
          <Text style={styles.buttonText}>{error.primaryLabel}</Text>
        </TouchableOpacity>
        {error.primaryHref !== '/(auth)' && (
          <TouchableOpacity onPress={() => router.replace('/(auth)')}>
            <Text style={styles.secondaryLink}>Back to sign in</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator color={Colors.primary} size="large" />
      <Text style={styles.body}>Verifying your email…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  title: {
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.bold,
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
  },
  body: {
    fontSize: Typography.size.base,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.md,
  },
  buttonText: {
    color: Colors.textPrimary,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
  },
  secondaryLink: {
    marginTop: Spacing.md,
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.textSecondary,
  },
});
