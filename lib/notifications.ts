import * as Notifications from 'expo-notifications';
import { Day, Settings } from './types';
import { todayISO } from './dates';
import i18n from './i18n';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// Returns the current notification permission state without prompting the
// user. Used to detect when iOS has revoked permissions outside the app so
// we can keep the in-app toggle in sync with reality.
export async function hasPermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

export async function scheduleDaily(hour: number, minute: number): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: i18n.t('notif.title'),
      body: i18n.t('notif.body'),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

export async function cancelAll(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function refreshNotificationSchedule(
  settings: Settings,
  days: Day[]
): Promise<void> {
  await cancelAll();
  if (!settings.notifEnabled) return;

  const today = todayISO();
  const remoHoy = days.some((d) => d.date === today);
  if (remoHoy) return;

  const [h, m] = settings.notifTime.split(':').map(Number);
  await scheduleDaily(h, m);
}
