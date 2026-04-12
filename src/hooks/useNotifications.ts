import { useEffect, useRef } from 'react';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';

// expo-notifications requires a dev/standalone build — not available in Expo Go.
// Use require() inside a try-catch so the import itself doesn't crash.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Notifications: typeof import('expo-notifications') | null = null;
try {
  Notifications = require('expo-notifications');
  Notifications!.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch (_) {
  // Native module not found (Expo Go) — notifications disabled
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Notifications) return null;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF5E1A',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return tokenData.data;
  } catch (_) {
    return null;
  }
}

/** Store the Expo push token on the user's profile row in Supabase */
async function savePushToken(profileId: string, token: string | null) {
  await supabase
    .from('profiles')
    .update({ push_token: token })
    .eq('id', profileId);
}

/**
 * Schedule a local "Event starting soon" notification 24 hours before an event.
 * Call this when the user RSVPs as GOING.
 */
export async function scheduleEventReminder(
  eventId: string,
  eventTitle: string,
  startTime: string,
) {
  if (!Notifications) return;
  try {
    const start = new Date(startTime);
    const reminderTime = new Date(start.getTime() - 24 * 60 * 60 * 1000);
    const now = new Date();

    if (reminderTime <= now) return;

    await cancelEventReminder(eventId);

    await Notifications.scheduleNotificationAsync({
      identifier: `event-reminder-${eventId}`,
      content: {
        title: 'Event starting soon',
        body: `${eventTitle} starts in 24 hours. Don't forget to show up!`,
        data: { eventId, type: 'event_reminder' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderTime,
      },
    });
  } catch (_) {}
}

/** Cancel a previously scheduled event reminder */
export async function cancelEventReminder(eventId: string) {
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(`event-reminder-${eventId}`);
  } catch (_) {}
}

/** Check the current iOS/Android notification permission status */
export async function getNotificationPermissionStatus(): Promise<
  'granted' | 'denied' | 'undetermined'
> {
  if (!Notifications) return 'undetermined';
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted'
      ? 'granted'
      : status === 'denied'
        ? 'denied'
        : 'undetermined';
  } catch (_) {
    return 'undetermined';
  }
}

/** Cancel all scheduled local notifications (used when user disables notifications) */
export async function cancelAllLocalNotifications() {
  if (!Notifications) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (_) {}
}

/**
 * Hook: registers for push notifications on mount (if enabled), saves token to Supabase,
 * and wires up a tap listener that navigates to the relevant screen.
 */
export function useNotifications(
  profileId: string | undefined,
  notificationsEnabled: boolean,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const responseListener = useRef<any>(null);

  useEffect(() => {
    if (!Notifications) return;

    if (profileId) {
      if (notificationsEnabled) {
        registerForPushNotifications().then(token => {
          if (token) savePushToken(profileId, token);
        });
      } else {
        // User disabled notifications — clear push token and cancel local reminders
        savePushToken(profileId, null);
        cancelAllLocalNotifications();
      }
    }

    try {
      responseListener.current = Notifications!.addNotificationResponseReceivedListener(response => {
        const data = response.notification.request.content.data as {
          type?: string;
          eventId?: string;
          profileId?: string;
        };

        if (data?.type === 'event_reminder' && data.eventId) {
          router.push(`/event/${data.eventId}`);
        } else if (data?.type === 'new_follower' && data.profileId) {
          router.push(`/profile/${data.profileId}`);
        }
      });
    } catch (_) {}

    return () => {
      responseListener.current?.remove();
    };
  }, [profileId, notificationsEnabled]);
}
