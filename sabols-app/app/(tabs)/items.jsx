import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image, TextInput } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Droplet, Trash2, Plus, Minus, MapPin, Bell, ShoppingCart, Search, Heart, ShieldCheck, Truck, RotateCcw } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetch } from '../../lib/api';

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
      <SafeAreaView className="flex-1 bg-slate-50">
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
      </SafeAreaView>
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
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        
        {/* Custom Header */}
        <View className="flex-row justify-between items-center mb-6 pt-2">
          <TouchableOpacity onPress={() => router.push({ pathname: '/(tabs)/profile', params: { openAddresses: 'true', returnToHome: 'true' } })} className="flex-row items-center flex-1 mr-4">
            <View className="w-10 h-10 rounded-full bg-sky-50 items-center justify-center mr-3">
              <MapPin size={20} color="#0ea5e9" />
            </View>
            <View className="flex-1">
              <Text className="text-xs text-gray-500 font-medium">Delivering to <Text className="text-sky-500 font-bold">{defaultAddress?.nickname || 'Home'}</Text></Text>
              <Text className="text-sm font-bold text-gray-900" numberOfLines={1}>
                {defaultAddress ? `${defaultAddress.line1}${defaultAddress.city ? ', ' + defaultAddress.city : ''}` : 'Select Address'}
              </Text>
            </View>
          </TouchableOpacity>
          <View className="flex-row gap-4">
            <TouchableOpacity className="relative">
              <Bell size={24} color="#334155" />
              <View className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-50" />
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
        </View>

        {/* Hero Section */}
        <View className="mb-6 rounded-3xl overflow-hidden w-full relative h-[180px]">
          <Image 
            source={require('../../assets/banner.png')} 
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
            resizeMode="cover"
          />
          <View className="absolute top-0 left-0 w-2/3 h-full justify-center p-5 z-10">
            <Text className="text-slate-800 text-sm mb-1 font-bold">Good Morning 👋</Text>
            <Text className="text-2xl font-extrabold text-slate-900 leading-tight">Stay Hydrated,</Text>
            <Text className="text-2xl font-extrabold text-slate-900 leading-tight mb-4">We'll Deliver!</Text>
            
            <View className="flex-row gap-3">
              <View className="items-center flex-1">
                <ShieldCheck size={16} color="#0f172a" />
                <Text className="text-[10px] text-center mt-1 text-slate-900 font-bold">100%{"\n"}Authentic</Text>
              </View>
              <View className="items-center flex-1">
                <Truck size={16} color="#0f172a" />
                <Text className="text-[10px] text-center mt-1 text-slate-900 font-bold">On-time{"\n"}Delivery</Text>
              </View>
              <View className="items-center flex-1">
                <RotateCcw size={16} color="#0f172a" />
                <Text className="text-[10px] text-center mt-1 text-slate-900 font-bold">Easy{"\n"}Returns</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Search */}
        <View className="flex-row items-center bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 mb-6">
          <Search size={20} color="#94a3b8" />
          <TextInput 
            className="ml-3 flex-1 text-sm text-gray-800" 
            placeholder="Search for 10 Litre, 20 Litre, etc." 
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>



        <View className="flex-row justify-between items-end mb-4">
          <Text className="text-lg font-bold text-slate-900">Popular Brands</Text>
        </View>

        {/* Product Grid */}
        <View className="flex-row flex-wrap justify-between">
          {filteredItems.length === 0 ? (
            <View className="w-full bg-white rounded-3xl p-8 items-center mt-4">
              <Droplet size={48} color="#cbd5e1" />
              <Text className="text-lg font-bold text-slate-800 mt-4">No items found</Text>
              <Text className="text-gray-500 mt-2 text-center">Try adjusting your search or filter</Text>
            </View>
          ) : (
            filteredItems.map((item) => {
              const quantity = getItemQuantity(item.id);
              const isSingleCatalogue = items.length === 1;

              return (
                <View key={item.id} className="w-[48%] bg-white rounded-3xl p-4 mb-4 shadow-sm border border-gray-50">


                  <View className="items-center mb-4 mt-4">
                    {item.image ? (
                      <Image source={{ uri: item.image }} style={{ width: 90, height: 110 }} resizeMode="contain" />
                    ) : (
                      <View className="w-20 h-24 bg-sky-50 rounded-2xl items-center justify-center">
                        <Droplet size={40} color="#0ea5e9" />
                      </View>
                    )}
                  </View>

                  <Text className="font-bold text-slate-900 text-[13px] mb-1" numberOfLines={1}>{item.name}</Text>
                  <Text className="text-xs text-gray-500 mb-3" numberOfLines={1}>{item.description}</Text>

                  <View className="flex-row justify-between items-center mb-3">
                    <Text className="text-base font-extrabold text-slate-900">₹{Number(item.price).toFixed(0)}</Text>
                  </View>

                  {!item.inStock ? (
                    <View className="w-full py-2.5 bg-gray-100 rounded-xl items-center">
                      <Text className="text-gray-500 font-semibold text-xs">Out of Stock</Text>
                    </View>
                  ) : item.hasPendingDeposit ? (
                    <View className="w-full py-2.5 bg-yellow-50 rounded-xl items-center">
                      <Text className="text-yellow-700 font-semibold text-xs">Pending Approval</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={() => {
                        if (quantity > 0) {
                           router.push('/(tabs)/cart');
                        } else {
                           changeQuantity(item, 1, { immediate: true });
                           if (isSingleCatalogue) router.push('/(tabs)/cart');
                        }
                      }}
                      className="w-full py-2.5 rounded-xl flex-row justify-center items-center bg-sky-500"
                    >
                      <ShoppingCart size={14} color="white" className="mr-1.5" />
                      <Text className="text-white font-bold text-[13px]">{quantity > 0 ? 'Go to Cart' : 'Add to Cart'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* Info Footer */}
        <View className="flex-row justify-between bg-white rounded-2xl p-4 mt-4 shadow-sm border border-gray-100">
           <View className="items-center flex-1">
              <Truck size={20} color="#334155" />
              <Text className="text-[10px] font-bold text-slate-800 mt-2">Fast Delivery</Text>
              <Text className="text-[9px] text-gray-500">Within 60 mins</Text>
           </View>
           <View className="w-[1px] bg-gray-100 my-1" />
           <View className="items-center flex-1">
              <Bell size={20} color="#334155" />
              <Text className="text-[10px] font-bold text-slate-800 mt-2">Schedule Order</Text>
              <Text className="text-[9px] text-gray-500">Choose your time</Text>
           </View>
           <View className="w-[1px] bg-gray-100 my-1" />
           <View className="items-center flex-1">
              <ShieldCheck size={20} color="#334155" />
              <Text className="text-[10px] font-bold text-slate-800 mt-2">Secure Payments</Text>
              <Text className="text-[9px] text-gray-500">100% Safe</Text>
           </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
