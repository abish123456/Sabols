import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../lib/config';
import Constants from 'expo-constants';

/**
 * usePushNotifications hook for staff.
 *
 * Uses dynamic imports for expo-notifications so that the package's
 * module-level side-effects do NOT run on app startup — only after login.
 */
export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState('');
  const [notification, setNotification] = useState<any>(false);
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;

    AsyncStorage.getItem('staffToken').then(async (staffToken) => {
      if (!staffToken || !isMounted) return;

      const Notifications = await import('expo-notifications');

      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      const token = await registerForPushNotificationsAsync();
      if (token && isMounted) {
        setExpoPushToken(token);
        await sendTokenToBackend(token);
      }

      notificationListener.current = Notifications.addNotificationReceivedListener((n: any) => {
        if (isMounted) setNotification(n);
      });

      responseListener.current = Notifications.addNotificationResponseReceivedListener((response: any) => {
        console.log('Notification tapped:', response);
      });
    });

    return () => {
      isMounted = false;
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  return { expoPushToken, notification };
}

/**
 * Called explicitly from login.tsx right after login succeeds.
 */
export async function registerForPushNotificationsAsync() {
  const Notifications = await import('expo-notifications');
  const Constants = (await import('expo-constants')).default;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0ea5e9',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    throw new Error("User denied push notification permissions");
  }

  const appConfig = require('../app.json');
  const projectId =
    appConfig?.expo?.extra?.eas?.projectId ||
    Constants?.expoConfig?.extra?.eas?.projectId;

  if (!projectId) {
    throw new Error("Project ID is completely missing from app.json");
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
  return tokenData.data;
}

export async function sendTokenToBackend(token: string) {
  try {
    const staffToken = await AsyncStorage.getItem('staffToken');
    if (!staffToken) return;

    const response = await fetch(`${API_URL}/api/delivery/push-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify({ pushToken: token }),
    });

    if (response.ok) {
      console.log('Push token registered with staff backend');
    } else {
      console.error('Failed to register push token with staff backend');
    }
  } catch (error) {
    console.error('Error sending push token to backend:', error);
  }
}
