import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '../lib/api';

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
          try {
            const res = await apiFetch('/api/user/profile');
            if (res.ok) {
              setIsAuthenticated(true);
              setIsNewUser(isNewUserFlow === 'true');
            } else if (res.status === 401) {
              await AsyncStorage.multiRemove(['isLoggedIn', 'authToken', 'userPhone', 'lastUserPhone', 'isNewUserFlow']);
              setIsAuthenticated(false);
            } else {
              setIsAuthenticated(true);
              setIsNewUser(isNewUserFlow === 'true');
            }
          } catch (e) {
            setIsAuthenticated(true);
            setIsNewUser(isNewUserFlow === 'true');
          }
        } else {
          await AsyncStorage.multiRemove(['isLoggedIn', 'authToken', 'userPhone', 'lastUserPhone', 'isNewUserFlow']);
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Failed to check auth state:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return isNewUser ? <Redirect href={{ pathname: "/(tabs)/profile", params: { isNewUser: 'true' } }} /> : <Redirect href="/(tabs)/items" />;
}
