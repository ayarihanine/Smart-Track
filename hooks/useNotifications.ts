import { useState, useEffect, useRef } from 'react';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { useSettingsStore } from '@/store/settingsStore';
import { savePushToken, clearPushToken } from '@/lib/api';

let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
  if (Notifications) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }
} catch (e) {
  console.warn('Push notifications not available in this environment', e);
}

export function useNotifications() {
  const [expoPushToken, setExpoPushToken] = useState('');
  const [notification, setNotification] = useState<any>(undefined);
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);
  const notificationsEnabled = useSettingsStore(s => s.notificationsEnabled);
  const savedToken = useRef<string | null>(null);

  useEffect(() => {
    if (!notificationsEnabled || !Notifications) {
      if (savedToken.current) {
        clearPushToken();
        savedToken.current = null;
      }
      return;
    }

    registerForPushNotificationsAsync().then(token => {
      if (token) {
        setExpoPushToken(token);
        if (token !== savedToken.current) {
          savePushToken(token);
          savedToken.current = token;
        }
      }
    });

    notificationListener.current = Notifications.addNotificationReceivedListener((notification: any) => {
      setNotification(notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response: any) => {
      const data = response?.notification?.request?.content?.data;
      if (data?.cardId) {
        router.push(`/card/${data.cardId}`);
      } else if (data?.screen) {
        router.push(data.screen as any);
      } else {
        router.push('/notifications' as any);
      }
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [notificationsEnabled]);

  return {
    expoPushToken,
    notification,
  };
}

async function registerForPushNotificationsAsync() {
  if (!Notifications) return undefined;
  
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#8B5CF6',
    });
  }

  if (Device.isDevice || Platform.OS === 'web') {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      clearPushToken();
      return;
    }
    try {
        token = (await Notifications.getExpoPushTokenAsync()).data;
    } catch (e) {
        // May fail if projectId is missing, but local notifications still work
    }
  }

  return token;
}
