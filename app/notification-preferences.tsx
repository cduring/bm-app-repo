import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BorderRadius, Colors, Spacing, Typography } from '../src/constants/theme';
import { useAuth } from '../src/context/auth';
import { useProfile } from '../src/hooks/useProfile';
import { supabase } from '../src/lib/supabase';
import {
  registerForPushNotifications,
  cancelAllLocalNotifications,
} from '../src/hooks/useNotifications';

export default function NotificationPreferencesScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const { data, isLoading } = useProfile(userId);
  const profile = data?.profile;
  const queryClient = useQueryClient();

  const [allowNotifications, setAllowNotifications] = useState(true);
  const [saving, setSaving] = useState(false);

  // Sync toggle with DB value once profile loads
  useEffect(() => {
    if (profile) {
      setAllowNotifications(profile.notifications_enabled ?? true);
    }
  }, [profile?.notifications_enabled]);

  async function handleToggle(value: boolean) {
    if (!profile) return;
    setAllowNotifications(value);
    setSaving(true);
    try {
      await supabase
        .from('profiles')
        .update({ notifications_enabled: value })
        .eq('id', profile.id);

      if (value) {
        // Re-register for push and save new token
        const token = await registerForPushNotifications();
        if (token) {
          await supabase
            .from('profiles')
            .update({ push_token: token })
            .eq('id', profile.id);
        }
      } else {
        // Clear push token and cancel all local reminders
        await supabase
          .from('profiles')
          .update({ push_token: null })
          .eq('id', profile.id);
        await cancelAllLocalNotifications();
      }

      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    } catch (_) {
      // Revert on error
      setAllowNotifications(!value);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.backButton} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {isLoading ? (
          <ActivityIndicator color={Colors.primary} />
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <Ionicons name="notifications-outline" size={20} color={Colors.textPrimary} />
                  <Text style={styles.rowLabel}>Allow Notifications</Text>
                </View>
                <Switch
                  value={allowNotifications}
                  onValueChange={handleToggle}
                  disabled={saving}
                  trackColor={{ false: Colors.border, true: Colors.primary }}
                  thumbColor={Colors.textPrimary}
                />
              </View>
            </View>
            <Text style={styles.hint}>
              Control whether BrandMe can send you push notifications about events and activity.
            </Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  backButton: {
    width: 36,
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },
  content: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    minHeight: 56,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  rowLabel: {
    fontSize: Typography.size.base,
    color: Colors.textPrimary,
    fontWeight: Typography.weight.regular,
  },
  hint: {
    fontSize: Typography.size.sm,
    color: Colors.textTertiary,
    lineHeight: 18,
    paddingHorizontal: Spacing.xs,
  },
});
