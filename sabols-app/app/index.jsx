import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import { apiFetch } from '../lib/api';

// Keep the native splash screen visible until we're ready
SplashScreen.preventAutoHideAsync();

export default function Index() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const isLoggedIn = await AsyncStorage.getItem('isLoggedIn');
        const isNewUserFlow = await AsyncStorage.getItem('isNewUserFlow');
        
        if (isLoggedIn === 'true') {
          // Verify session with backend using apiFetch.
          try {
            const res = await apiFetch('/api/user/profile');
            if (res.ok) {
              setIsAuthenticated(true);
              setIsNewUser(isNewUserFlow === 'true');
            } else if (res.status === 401) {
              // Session really expired
              await AsyncStorage.multiRemove(['isLoggedIn', 'authToken', 'userPhone', 'lastUserPhone', 'isNewUserFlow']);
              setIsAuthenticated(false);
            } else {
              // Network error or other server issue (500) - assume logged in
              setIsAuthenticated(true);
              setIsNewUser(isNewUserFlow === 'true');
            }
          } catch (e) {
            // Network error (offline) - assume logged in
            setIsAuthenticated(true);
            setIsNewUser(isNewUserFlow === 'true');
          }
        } else {
          // Not logged in
          await AsyncStorage.multiRemove(['isLoggedIn', 'authToken', 'userPhone', 'lastUserPhone', 'isNewUserFlow']);
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Failed to check auth state:', error);
      } finally {
        setIsLoading(false);
        // Hide the splash screen only after auth check is complete
        await SplashScreen.hideAsync();
      }
    };
    
    checkAuth();
  }, []);

  // While loading, render nothing — the native splash screen is still showing
  if (isLoading) {
    return <View className="flex-1 bg-white" />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return isNewUser ? <Redirect href={{ pathname: "/(tabs)/profile", params: { isNewUser: 'true' } }} /> : <Redirect href="/(tabs)/items" />;
}
