import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/lib/supabase';
import { Colors, Typography, Spacing, BorderRadius } from '../../src/constants/theme';

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{
    code?: string;
    error_description?: string;
  }>();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (params.error_description) {
      setErrorMessage(params.error_description);
      return;
    }
    if (!params.code) {
      router.replace('/(auth)');
      return;
    }
    supabase.auth.exchangeCodeForSession(params.code).then(({ error }) => {
      if (error) {
        setErrorMessage(error.message);
      }
    });
  }, [params.code, params.error_description]);

  if (errorMessage) {
    return (
      <View style={styles.container}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.cancelled} />
        <Text style={styles.title}>Verification failed</Text>
        <Text style={styles.body}>{errorMessage}</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.replace('/(auth)')}
        >
          <Text style={styles.buttonText}>Back to sign in</Text>
        </TouchableOpacity>
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
});
