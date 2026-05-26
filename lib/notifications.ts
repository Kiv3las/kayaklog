import * as Notifications from 'expo-notifications';
import { Day, Settings } from './types';
import { todayISO } from './dates';

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

export async function scheduleDaily(hour: number, minute: number): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Kayak',
      body: '¿Remaste hoy? Añade un registro',
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
