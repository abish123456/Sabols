import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '../lib/api';

/**
 * usePushNotifications hook.
 *
 * Uses dynamic imports for expo-notifications so that the package's
 * module-level side-effects (DevicePushTokenAutoRegistration) do NOT run
 * on app startup — only after the user is confirmed logged in.
 */
export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState('');
  const [notification, setNotification] = useState(false);
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    let isMounted = true;

    AsyncStorage.getItem('isLoggedIn').then(async loggedIn => {
      if (loggedIn !== 'true' || !isMounted) return;

      // Dynamically import expo-notifications so it only loads AFTER login check.
      // This prevents the package's side-effects from running on app startup.
      const Notifications = await import('expo-notifications');

      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });

      const token = await registerForPushNotificationsAsync();
      if (token && isMounted) {
        setExpoPushToken(token);
        await sendTokenToBackend(token);
      }

      notificationListener.current = Notifications.addNotificationReceivedListener(n => {
        if (isMounted) setNotification(n);
      });

      responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
        console.log('Notification tapped:', response);
      });
    });

    return () => {
      isMounted = false;
      import('expo-notifications').then(Notifications => {
        if (notificationListener.current) {
          Notifications.removeNotificationSubscription(notificationListener.current);
        }
        if (responseListener.current) {
          Notifications.removeNotificationSubscription(responseListener.current);
        }
      });
    };
  }, []);

  return { expoPushToken, notification };
}

/**
 * Called explicitly from login.jsx right after OTP verification succeeds.
 * Also uses dynamic import so expo-notifications is never loaded pre-login.
 */
export async function registerForPushNotificationsAsync() {
  // Dynamic import — only loads expo-notifications when this function is actually called.
  const Notifications = await import('expo-notifications');
  const Device = await import('expo-device');
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

  // Ensure notifications show up even when the app is open!
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });

  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
  return tokenData.data;
}

async function sendTokenToBackend(token) {
  try {
    const authToken = await AsyncStorage.getItem('authToken');
    if (!authToken) return;

    const response = await apiFetch('/api/user/push-token', {
      method: 'POST',
      body: JSON.stringify({ pushToken: token }),
    });

    if (response.ok) {
      console.log('Push token registered with backend');
    } else {
      console.error('Failed to register push token with backend');
    }
  } catch (error) {
    console.error('Error sending push token to backend:', error);
  }
}
