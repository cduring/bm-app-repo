import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
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
import { useProfileSettings, useUpdateProfileSettings } from '../src/hooks/useProfileSettings';
import {
  registerForPushNotifications,
  cancelAllLocalNotifications,
  getNotificationPermissionStatus,
} from '../src/hooks/useNotifications';

export default function NotificationPreferencesScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const { data } = useProfile(userId);
  const profile = data?.profile;

  const { data: settings, isLoading } = useProfileSettings(profile?.id ? String(profile.id) : undefined);
  const updateSettings = useUpdateProfileSettings(profile?.id ? String(profile.id) : undefined);

  const [allowNotifications, setAllowNotifications] = useState(true);
  const [saving, setSaving] = useState(false);
  const [iosPermissionDenied, setIosPermissionDenied] = useState(false);
  const appState = useRef(AppState.currentState);
  // Track whether the last disable was due to iOS denial (vs user choice)
  const wasDeviceDenied = useRef(false);

  // Check iOS permission status and sync with DB
  const checkAndSyncPermission = useCallback(async () => {
    if (!profile || !settings) return;
    const status = await getNotificationPermissionStatus();
    const denied = status === 'denied';
    setIosPermissionDenied(denied);

    if (denied && settings.notifications_enabled) {
      // iOS permission was revoked — sync DB to match
      wasDeviceDenied.current = true;
      setAllowNotifications(false);
      await updateSettings.mutateAsync({ notifications_enabled: false, push_token: null });
      await cancelAllLocalNotifications();
    } else if (status === 'granted' && !settings.notifications_enabled && wasDeviceDenied.current) {
      // iOS permission was re-granted after a device-level denial — re-enable
      wasDeviceDenied.current = false;
      setAllowNotifications(true);
      const token = await registerForPushNotifications();
      await updateSettings.mutateAsync({ notifications_enabled: true, push_token: token ?? null });
    }
  }, [profile, settings, updateSettings]);

  // Sync toggle with DB value once settings load, then check iOS permission
  useEffect(() => {
    if (settings) {
      setAllowNotifications(settings.notifications_enabled ?? true);
      checkAndSyncPermission();
    }
  }, [settings?.notifications_enabled, checkAndSyncPermission]);

  // Re-check when app returns to foreground (user may have changed in iOS Settings)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        checkAndSyncPermission();
      }
      appState.current = nextAppState;
    });
    return () => subscription.remove();
  }, [checkAndSyncPermission]);

  async function handleToggle(value: boolean) {
    if (!profile) return;

    if (value) {
      // Enabling — attempt to register for push
      setSaving(true);
      try {
        const token = await registerForPushNotifications();
        if (!token) {
          // Permission denied by iOS — check if it's a hard denial
          const status = await getNotificationPermissionStatus();
          if (status === 'denied') {
            setIosPermissionDenied(true);
            Alert.alert(
              'Notifications Blocked',
              'Push notifications are blocked by your device settings. Open Settings to allow them.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => Linking.openSettings() },
              ],
            );
            return; // Keep toggle OFF
          }
          // undetermined or other — just couldn't get token, but don't block
        }

        setAllowNotifications(true);
        await updateSettings.mutateAsync({ notifications_enabled: true, push_token: token ?? null });
        setIosPermissionDenied(false);
      } catch (_) {
        // Revert on error
        setAllowNotifications(false);
      } finally {
        setSaving(false);
      }
    } else {
      // Disabling
      setAllowNotifications(false);
      setSaving(true);
      try {
        await updateSettings.mutateAsync({ notifications_enabled: false, push_token: null });
        await cancelAllLocalNotifications();
      } catch (_) {
        setAllowNotifications(true);
      } finally {
        setSaving(false);
      }
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
              Control whether Loam can send you push notifications about events and activity.
            </Text>

            {iosPermissionDenied && (
              <TouchableOpacity
                style={styles.warningBanner}
                onPress={() => Linking.openSettings()}
                activeOpacity={0.7}
                accessibilityLabel="Open device settings to allow notifications"
                accessibilityRole="button"
              >
                <Ionicons name="warning-outline" size={16} color={Colors.primary} />
                <Text style={styles.warningText}>
                  Push notifications are blocked by your device settings.{' '}
                  <Text style={styles.warningLink}>Open Settings</Text>
                </Text>
              </TouchableOpacity>
            )}
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
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(255, 94, 26, 0.1)',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  warningText: {
    flex: 1,
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  warningLink: {
    color: Colors.primary,
    fontWeight: Typography.weight.semibold,
  },
});
