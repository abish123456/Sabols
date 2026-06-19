import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Index() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const isLoggedIn = await AsyncStorage.getItem('isLoggedIn');
        setIsAuthenticated(isLoggedIn === 'true');
      } catch (error) {
        console.error('Failed to check auth state:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-[#f3f7fb]">
        <ActivityIndicator size="large" color="#0ea5e9" />
      </View>
    );
  }

  return isAuthenticated ? <Redirect href="/(tabs)/items" /> : <Redirect href="/login" />;
}
