import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { LogOut, MapPin, Package, Clock, CheckCircle2, ChevronRight, Route as RouteIcon } from 'lucide-react-native';
import { API_URL } from '../lib/config';

export default function RoutesScreen() {
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [staffName, setStaffName] = useState('');

  const fetchRoutes = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('staffToken');
      if (!token) {
        router.replace('/login');
        return;
      }

      const name = await AsyncStorage.getItem('staffName');
      if (name) setStaffName(name);

      const response = await fetch(`${API_URL}/api/delivery/routes/today`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        setRoutes(data.routes || []);
      } else {
        if (response.status === 401) {
          await AsyncStorage.removeItem('staffToken');
          router.replace('/login');
        } else {
          Alert.alert('Error', data.message || 'Failed to fetch routes');
        }
      }
    } catch (error) {
      console.error('Fetch routes error:', error);
      Alert.alert('Error', 'Network error while fetching routes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchRoutes();
    }, [fetchRoutes])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRoutes();
  }, [fetchRoutes]);

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Logout', 
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('staffToken');
          await AsyncStorage.removeItem('staffName');
          router.replace('/login');
        }
      }
    ]);
  };

  const renderRouteItem = ({ item }: { item: any }) => {
    const shiftStatus = item.shift?.status || 'NOT_STARTED';
    
    let shiftBadgeBg = shiftStatus === 'ACTIVE' ? 'bg-green-100' : 
                       shiftStatus === 'PAUSED' ? 'bg-orange-100' :
                       shiftStatus === 'ENDED' ? 'bg-gray-200' : 'bg-blue-100';
    let shiftBadgeText = shiftStatus === 'ACTIVE' ? 'text-green-700' : 
                         shiftStatus === 'PAUSED' ? 'text-orange-700' :
                         shiftStatus === 'ENDED' ? 'text-gray-700' : 'text-blue-700';

    return (
      <TouchableOpacity 
        className="bg-white rounded-xl p-4 mb-4 shadow-sm border border-gray-100"
        onPress={() => router.push(`/route/${item.id}`)}
      >
        <View className="flex-row justify-between items-center mb-3">
          <View className="flex-row items-center">
            <View className="w-10 h-10 bg-blue-50 rounded-full items-center justify-center mr-3">
              <MapPin size={20} color="#2563EB" />
            </View>
            <View>
              <Text className="text-lg font-bold text-gray-900">{item.area || 'Unknown Area'}</Text>
              <View className={`px-2 py-0.5 rounded mt-1 self-start ${shiftBadgeBg}`}>
                <Text className={`text-xs font-bold ${shiftBadgeText}`}>{shiftStatus.replace('_', ' ')}</Text>
              </View>
            </View>
          </View>
          <ChevronRight size={24} color="#9CA3AF" />
        </View>

        <View className="flex-row justify-between border-t border-gray-100 pt-3">
          <View className="items-center">
            <Package size={16} color="#6B7280" className="mb-1" />
            <Text className="text-gray-900 font-bold">{item.summary.totalOrders}</Text>
            <Text className="text-xs text-gray-500">Orders</Text>
          </View>
          <View className="items-center">
            <CheckCircle2 size={16} color="#10B981" className="mb-1" />
            <Text className="text-gray-900 font-bold">{item.summary.deliveredCount}</Text>
            <Text className="text-xs text-gray-500">Delivered</Text>
          </View>
          <View className="items-center">
            <Clock size={16} color="#F59E0B" className="mb-1" />
            <Text className="text-gray-900 font-bold">{item.summary.pendingCount}</Text>
            <Text className="text-xs text-gray-500">Pending</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <ActivityIndicator size="large" color="#2563EB" />
        <Text className="mt-4 text-gray-500">Loading your routes...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50 relative">
      <View className="bg-slate-50 px-4 pt-4 pb-2 flex-row justify-between items-center">
        <View className="flex-row items-center flex-wrap">
          <Text className="text-base font-medium text-gray-600 mr-1.5">Welcome,</Text>
          <Text className="text-2xl font-extrabold text-gray-900">{staffName || 'Delivery Staff'}</Text>
          <Text className="text-2xl ml-1">👋</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} className="w-10 h-10 bg-white border border-gray-100 rounded-xl items-center justify-center shadow-sm">
          <LogOut size={18} color="#EF4444" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <View className="flex-1 px-4 pt-4">
        <Text className="text-xl font-bold text-gray-900 mb-4">Your Routes Today</Text>

        {routes.length === 0 ? (
          <View className="flex-1 justify-center items-center">
            <MapPin size={48} color="#D1D5DB" />
            <Text className="text-xl font-bold text-gray-900 mt-4">No Routes Assigned</Text>
            <Text className="text-gray-500 text-center mt-2 px-6">
              You haven't been assigned any routes for today. Please check back later or contact the admin.
            </Text>
            <TouchableOpacity 
              className="mt-6 bg-blue-100 px-6 py-3 rounded-full"
              onPress={fetchRoutes}
            >
              <Text className="text-blue-700 font-bold">Refresh</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={routes}
            keyExtractor={(item) => item.id}
            renderItem={renderRouteItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563EB']} />
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
