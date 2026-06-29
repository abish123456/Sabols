import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_URL } from '../lib/config';

export default function Login() {
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!emailOrUsername || !password) {
      Alert.alert('Error', 'Please enter email/username and password');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/delivery/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ identifier: emailOrUsername, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        await AsyncStorage.setItem('staffToken', data.token);
        await AsyncStorage.setItem('staffName', data.profile.name);
        
        // Register for push notifications and send token to backend
        try {
          const { registerForPushNotificationsAsync, sendTokenToBackend } = await import('../hooks/usePushNotifications');
          const pushToken = await registerForPushNotificationsAsync();
          if (pushToken) {
            await sendTokenToBackend(pushToken);
          }
        } catch (pushErr) {
          console.log('Failed to register push notifications:', pushErr);
        }

        router.replace('/routes');
      } else {
        Alert.alert('Login Failed', data.message || 'Invalid credentials');
      }
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50 justify-center">
      <View className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mx-4">
        
        <View className="items-center mb-2 mt-2" >
          <Image 
            source={require('../assets/logo.jpg')} 
            style={{ width: 100, height: 60, resizeMode: 'contain' }} 
          />
          <Text className="text-3xl font-bold mt-3 text-slate-900">Staff Login</Text>
        </View>

        <View className="space-y-4">
          <View>
            <Text className="text-base font-medium text-slate-700 mb-2">Email</Text>
            <TextInput
              className="bg-white border border-slate-200 rounded-md px-3 py-3 text-slate-900 text-lg"
              placeholder="Enter your email"
              value={emailOrUsername}
              onChangeText={setEmailOrUsername}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View>
            <Text className="text-base font-medium text-slate-700 mb-2 mt-2">Password</Text>
            <TextInput
              className="bg-white border border-slate-200 rounded-md px-3 py-3 text-slate-900 text-lg"
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            className={`bg-blue-600 rounded-md py-3 items-center justify-center mt-4 ${loading ? 'opacity-70' : ''}`}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <View className="flex-row items-center">
                <ActivityIndicator color="#fff" size="small" className="mr-2" />
                <Text className="text-white font-medium text-lg">Signing in...</Text>
              </View>
            ) : (
              <Text className="text-white font-medium text-lg">Sign In</Text>
            )}
          </TouchableOpacity>
        </View>
        
      </View>
    </SafeAreaView>
  );
}
