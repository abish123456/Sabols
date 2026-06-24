import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image, TextInput, Linking } from 'react-native';
import { useRouter, useFocusEffect, Tabs } from 'expo-router';
import Toast from 'react-native-toast-message';
import { Droplet, Trash2, Plus, Minus, MapPin, Bell, ShoppingCart, Search, Heart, ShieldCheck, Truck, RotateCcw } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetch } from '../../lib/api';
import { registerForPushNotificationsAsync } from '../../hooks/usePushNotifications';

export default function ItemsScreen() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [defaultAddress, setDefaultAddress] = useState(null);
  const [pendingReturns, setPendingReturns] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const timeoutRefs = useRef({});
  const pendingUpdates = useRef({});

  // One-time push notification setup for returning users already logged in.
  // For fresh logins, login.jsx handles it right after OTP verification.
  useEffect(() => {
    const setupPush = async () => {
      const alreadySetup = await AsyncStorage.getItem('pushTokenSent');
      if (alreadySetup === 'true') return; // Already registered in this install

      const token = await registerForPushNotificationsAsync();
      if (token) {
        await apiFetch('/api/user/push-token', {
          method: 'POST',
          body: JSON.stringify({ pushToken: token }),
        });
        await AsyncStorage.setItem('pushTokenSent', 'true');
      }
    };
    setupPush();
  }, []);


  useFocusEffect(
    useCallback(() => {
      const fetchItems = async () => {
        try {
          const response = await apiFetch('/api/products');
          const data = await response.json();
          if (data.success) {
            setItems(data.products || []);
          }
        } catch (err) {
          console.error('Error fetching items:', err);
        } finally {
          setIsLoading(false);
        }
      };

      const loadCartAndProfile = async () => {
        try {
          // Fast optimistic update from local storage
          const cached = await AsyncStorage.getItem('cart');
          if (cached) setCart(JSON.parse(cached));
          else setCart([]);

          const cartRes = await apiFetch('/api/cart');
          if (cartRes.ok) {
            const cartData = await cartRes.json();
            if (cartData.success) {
              setCart(cartData.items || []);
              await AsyncStorage.setItem('cart', JSON.stringify(cartData.items || []));
            }
          }

          const profileRes = await apiFetch('/api/user/profile');
          if (profileRes.ok) {
            const profileData = await profileRes.json();
            if (profileData.profile) setCustomer(profileData.profile);
          }

          const returnsRes = await apiFetch('/api/user/return-request');
          if (returnsRes.ok) {
            const returnsData = await returnsRes.json();
            if (returnsData.requests) {
              const count = returnsData.requests
                .filter(r => r.status === 'REQUESTED')
                .reduce((s, r) => s + r.quantity, 0);
              setPendingReturns(count);
            }
          }

          const addrRes = await apiFetch('/api/user/addresses');
          if (addrRes.ok) {
            const addrData = await addrRes.json();
            if (addrData.addresses && addrData.addresses.length > 0) {
              const def = addrData.addresses.find(a => a.isDefault) || addrData.addresses[0];
              setDefaultAddress(def);
            }
          }
        } catch (err) {
          console.error('Error loading data:', err);
        }
      };

      fetchItems();
      loadCartAndProfile();
    }, [])
  );

  useEffect(() => {

    // Flush on unmount
    return () => {
      Object.keys(pendingUpdates.current).forEach(itemId => {
        const update = pendingUpdates.current[itemId];
        if (update) {
          if (timeoutRefs.current[itemId]) clearTimeout(timeoutRefs.current[itemId]);
          apiFetch('/api/cart', { method: 'POST', body: JSON.stringify(update) })
            .catch(e => console.error('Flush error', e));
        }
      });
    };
  }, []);

  const getItemQuantity = (itemId) => {
    const cartItem = cart.find(i => i.id === itemId);
    return cartItem ? cartItem.quantity : 0;
  };

  // Recalculate returnQuantity for all deposit items in a cart snapshot
  const calcReturnQtys = (cartSnapshot, customer, pendingReturns) => {
    const cih = customer?.cansInHand || 0;
    const pr = customer?.pendingReturned || 0;
    const explicitPR = pendingReturns || 0;
    let available = Math.max(0, cih - pr - explicitPR);

    return cartSnapshot.map(ci => {
      if ((ci.depositAmount || 0) > 0) {
        const returnQty = Math.min(ci.quantity, available);
        available -= returnQty;
        return { ...ci, returnQuantity: returnQty };
      }
      return { ...ci, returnQuantity: 0 };
    });
  };

  // Sync debounced update to server
  const syncToServer = (item, newQuantity, returnQuantity) => {
    const payload = { productId: item.id, quantity: newQuantity, returnQuantity };
    pendingUpdates.current[item.id] = payload;

    if (timeoutRefs.current[item.id]) clearTimeout(timeoutRefs.current[item.id]);
    timeoutRefs.current[item.id] = setTimeout(async () => {
      try {
        await apiFetch('/api/cart', { method: 'POST', body: JSON.stringify(payload) });
        delete pendingUpdates.current[item.id];
      } catch (err) {
        console.error('Error syncing cart:', err);
      }
    }, 300);
  };

  const changeQuantity = (item, delta, { immediate = false } = {}) => {
    setCart(prevCart => {
      const existing = prevCart.find(ci => ci.id === item.id);
      const currentQty = existing ? existing.quantity : 0;
      const newQty = Math.max(1, Math.min(100, currentQty + delta));

      let newCart;
      if (existing) {
        newCart = prevCart.map(ci => ci.id === item.id ? { ...ci, quantity: newQty } : ci);
      } else {
        newCart = [...prevCart, { ...item, quantity: newQty, returnQuantity: 0 }];
      }

      const withReturns = calcReturnQtys(newCart, customer, pendingReturns);
      AsyncStorage.setItem('cart', JSON.stringify(withReturns)).catch(() => {});

      const target = withReturns.find(ci => ci.id === item.id);
      if (immediate) {
        // Sync immediately (new item or single-product redirect)
        if (timeoutRefs.current[item.id]) clearTimeout(timeoutRefs.current[item.id]);
        const payload = { productId: item.id, quantity: newQty, returnQuantity: target?.returnQuantity || 0 };
        pendingUpdates.current[item.id] = payload;
        apiFetch('/api/cart', { method: 'POST', body: JSON.stringify(payload) })
          .then(() => { delete pendingUpdates.current[item.id]; })
          .catch(e => console.error(e));
      } else {
        syncToServer(item, newQty, target?.returnQuantity || 0);
      }

      return withReturns;
    });
  };

  const removeFromCart = (itemId) => {
    setCart(prevCart => {
      const newCart = prevCart.filter(ci => ci.id !== itemId);
      AsyncStorage.setItem('cart', JSON.stringify(newCart)).catch(() => {});
      if (timeoutRefs.current[itemId]) clearTimeout(timeoutRefs.current[itemId]);
      apiFetch('/api/cart', { method: 'POST', body: JSON.stringify({ productId: itemId, quantity: 0 }) })
        .catch(e => console.error('Error removing cart item:', e));
      return newCart;
    });
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-slate-50">
        <View className="flex-1 p-4">
          <View className="flex-row justify-between mb-8 mt-4">
             <View className="w-32 h-10 bg-slate-200 rounded-xl" />
             <View className="w-10 h-10 bg-slate-200 rounded-full" />
          </View>
          <View className="w-full h-40 bg-slate-200 rounded-3xl mb-8" />
          <View className="flex-row flex-wrap justify-between">
            {[1, 2, 3, 4].map((i) => (
              <View key={i} className="w-[48%] h-64 bg-slate-200 rounded-3xl mb-4" />
            ))}
          </View>
        </View>
      </View>
    );
  }

  const categories = ['All', ...new Set(items.map(item => item.unit).filter(Boolean))];

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = activeCategory === 'All' || item.unit === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <View className="flex-1 bg-slate-50">
      <Tabs.Screen 
        options={{ 
          headerShown: true,
          headerRight: () => (
            <View className="flex-row gap-4 mr-4 items-center">
              <TouchableOpacity onPress={() => Toast.show({ type: 'info', text1: 'Notifications', text2: 'No new notifications at this time' })} className="relative">
                <Bell size={24} color="#334155" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/(tabs)/cart')} className="relative">
                <ShoppingCart size={24} color="#334155" />
                {cart.length > 0 && (
                  <View className="absolute -top-2 -right-2 bg-sky-500 rounded-full w-4 h-4 items-center justify-center">
                    <Text className="text-[10px] text-white font-bold">{cart.length}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          )
        }} 
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>

        {/* Location Header */}
        <View className="flex-row justify-between items-center mb-6">
          <TouchableOpacity onPress={() => router.push({ pathname: '/(tabs)/profile', params: { openAddresses: 'true', returnToHome: 'true' } })} className="flex-row items-center flex-1 mr-4">
            <View className="w-10 h-10 rounded-full bg-sky-50 items-center justify-center mr-3">
              <MapPin size={20} color="#0ea5e9" />
            </View>
            <View className="flex-1">
              <Text className="text-xs text-gray-500 font-medium">Delivering to <Text className="text-sky-500 font-bold">{defaultAddress?.nickname || 'Home'}</Text></Text>
              <Text className="text-sm font-bold text-gray-900" numberOfLines={1}>
                {defaultAddress ? `${defaultAddress.line1}, ${defaultAddress.area}, ${defaultAddress.city}` : 'Select your delivery address'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Promotional Banner */}
        <View className="w-full h-40 rounded-2xl overflow-hidden mb-6 relative">
          <Image source={require('../../assets/banner.png')} className="w-full h-full" resizeMode="cover" />
          <View className="absolute top-4 left-4">
            <Text className="text-slate-800 text-xs font-bold mb-1">Good Morning 👋</Text>
            <Text className="text-slate-900 text-xl font-black w-4/5 leading-tight">Stay Hydrated, We'll Deliver!</Text>
          </View>
          <View className="absolute bottom-4 left-0 w-full px-5 flex-row justify-between">
            <View className="items-center flex-1">
              <ShieldCheck size={16} color="#0f172a" />
              <Text className="text-slate-900 text-[10px] mt-1 font-bold text-center leading-tight">100%{"\n"}Authentic</Text>
            </View>
            <View className="items-center flex-1">
              <Truck size={16} color="#0f172a" />
              <Text className="text-slate-900 text-[10px] mt-1 font-bold text-center leading-tight">On-time{"\n"}Delivery</Text>
            </View>
            <View className="items-center flex-1">
              <RotateCcw size={16} color="#0f172a" />
              <Text className="text-slate-900 text-[10px] mt-1 font-bold text-center leading-tight">Easy{"\n"}Returns</Text>
            </View>
          </View>
        </View>

        {/* Search Bar */}
        <View className="flex-row items-center bg-white border border-gray-100 rounded-xl px-4 py-3 mb-6 shadow-sm">
          <Search size={20} color="#94a3b8" className="mr-3" />
          <TextInput 
            placeholder="Search for 10 Litre, 20 Litre, etc." 
            placeholderTextColor="#94a3b8"
            className="flex-1 text-base text-gray-800"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <Text className="text-sm font-bold text-gray-800 mb-4 tracking-wide uppercase">Our Products</Text>

        <View className="flex-row flex-wrap justify-between">
          {isLoading ? (
            <ActivityIndicator size="large" color="#0ea5e9" className="mt-10 mx-auto" />
          ) : filteredItems.length === 0 ? (
            <Text className="text-gray-500 mt-4 mx-auto">No products found.</Text>
          ) : (
            filteredItems.map(item => (
              <View key={item.id} className="w-[48%] bg-white rounded-2xl p-4 mb-4 shadow-sm border border-gray-100 relative">
                {item.quantityAvailable > 0 && item.quantityAvailable <= 5 && (
                  <View className="absolute top-3 left-3 bg-red-100 px-2 py-1 rounded-md z-10">
                    <Text className="text-[10px] font-bold text-red-600">Only {item.quantityAvailable} left</Text>
                  </View>
                )}
                


                <View className="items-center mb-4 mt-2">
                  <View className="w-24 h-24 bg-sky-50 rounded-2xl items-center justify-center overflow-hidden">
                    {item.image ? (
                      <Image source={{ uri: item.image }} style={{ width: 80, height: 80 }} resizeMode="contain" />
                    ) : (
                      <Droplet size={40} color="#0ea5e9" />
                    )}
                  </View>
                </View>
                
                <Text className="text-sm font-bold text-gray-900 mb-1" numberOfLines={1}>{item.name}</Text>
                <Text className="text-xs text-gray-500 mb-3">{item.description || '1 NO'}</Text>
                
                <Text className="text-lg font-black text-gray-900 mb-3">₹{item.price}</Text>

                <View className="mt-auto">
                  {!item.inStock ? (
                    <View className="w-full py-2.5 bg-gray-100 rounded-xl items-center">
                      <Text className="text-gray-500 font-semibold text-xs">Out of Stock</Text>
                    </View>
                  ) : item.hasPendingDeposit ? (
                    <View className="w-full py-2.5 bg-yellow-50 rounded-xl items-center">
                      <Text className="text-yellow-700 font-semibold text-xs">Pending Approval</Text>
                    </View>
                  ) : cart.find(i => i.id === item.id) ? (
                    <View className="flex-row gap-2 w-full">
                      <TouchableOpacity
                        onPress={() => router.push('/(tabs)/cart')}
                        className="flex-1 py-2.5 rounded-xl flex-row justify-center items-center bg-white border border-sky-500"
                      >
                        <Text className="text-sky-500 font-bold text-[13px]">Go to Cart</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => removeFromCart(item.id)}
                        className="w-11 py-2.5 rounded-xl items-center justify-center bg-white border border-red-200"
                      >
                        <Trash2 size={16} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={() => {
                         changeQuantity(item, 1, { immediate: true });
                         if (items.length === 1) router.push('/(tabs)/cart');
                      }}
                      className="w-full py-2.5 rounded-xl flex-row justify-center items-center bg-sky-500"
                    >
                      <ShoppingCart size={14} color="white" />
                      <Text className="text-white font-bold text-[13px] ml-2">Add to Cart</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Powered By STEDAXIS */}
        <View className="flex-row items-center justify-center py-6 mt-4 opacity-70">
          <Text className="text-xs font-medium text-gray-400 mr-1.5">Powered by</Text>
          <TouchableOpacity onPress={() => Linking.openURL('https://www.stedaxis.com').catch(() => {})}>
            <Image source={require('../../assets/stedaxis_logo.png')} style={{ width: 70, height: 14 }} resizeMode="contain" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
