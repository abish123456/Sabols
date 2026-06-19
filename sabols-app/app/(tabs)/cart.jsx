import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ShoppingCart, Trash2, Minus, Plus, AlertCircle, CheckCircle2 } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { apiFetch } from '../../lib/api';

export default function CartScreen() {
  const router = useRouter();
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [isFetching, setIsFetching] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingReturns, setPendingReturns] = useState(0);

  useFocusEffect(
    useCallback(() => {
      const loadCart = async () => {
        if (cart.length === 0) setIsFetching(true); // Only show full loader on initial empty
        try {
          // Fast optimistic update
          const cached = await AsyncStorage.getItem('cart');
          if (cached) setCart(JSON.parse(cached));
          else setCart([]);

          const res = await apiFetch('/api/cart');
          if (res.ok) {
            const data = await res.json();
            if (data.success) {
              setCart(data.items || []);
              await AsyncStorage.setItem('cart', JSON.stringify(data.items || []));
            }
          }

          const custRes = await apiFetch('/api/user/profile');
          if (custRes.ok) {
            const custData = await custRes.json();
            if (custData.success || custData.profile) {
              setCustomer(custData.profile || custData.customer);
            }
          }

          const returnsRes = await apiFetch('/api/user/return-request');
          if (returnsRes.ok) {
            const returnsData = await returnsRes.json();
            if (returnsData.requests) {
              const pendingCount = returnsData.requests
                .filter(req => req.status === 'REQUESTED')
                .reduce((sum, req) => sum + req.quantity, 0);
              setPendingReturns(pendingCount);
            }
          }
        } catch (err) {
          console.error('Error loading cart from server:', err);
        } finally {
          setIsFetching(false);
        }
      };

      loadCart();
    }, [])
  );

  const pendingUpdatesRef = useRef({});
  const timeoutRefs = useRef({});

  const flushPendingUpdates = async () => {
    const updatePromises = Object.keys(pendingUpdatesRef.current).map(async (itemId) => {
      const payload = pendingUpdatesRef.current[itemId];
      if (!payload) return;

      if (timeoutRefs.current[itemId]) {
        clearTimeout(timeoutRefs.current[itemId]);
        delete timeoutRefs.current[itemId];
      }

      try {
        await apiFetch('/api/cart', { method: 'POST', body: JSON.stringify(payload) });
        delete pendingUpdatesRef.current[itemId];
      } catch (err) {
        console.error(`Final flush failed for item ${itemId}`, err);
      }
    });

    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
    }
  };

  const updateQuantity = (itemId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId);
      return;
    }

    if (newQuantity > 100) {
      Toast.show({ type: 'error', text1: 'Quantity Too High', text2: 'Quantity cannot exceed 100 per item.' });
      return;
    }

    // Clamp to max 100
    const clampedQty = Math.min(100, Math.max(1, newQuantity));

    setCart(prevCart => {
      const customerForCalc = customer || {};
      const currentCansInHand = customerForCalc.cansInHand || 0;
      const pendingReturned = customerForCalc.pendingReturned || 0;
      const totalExplicitPendingReturns = pendingReturns || 0;
      const availableForSwapTotal = Math.max(0, currentCansInHand - pendingReturned - totalExplicitPendingReturns);

      let availableForSwap = availableForSwapTotal;

      const newCart = prevCart.map((item) => {
        if (item.id === itemId) {
          let itemReturnQty = 0;
          if ((item.depositAmount || 0) > 0) {
            itemReturnQty = Math.min(clampedQty, availableForSwap);
            availableForSwap -= itemReturnQty;
          }
          return { ...item, quantity: clampedQty, returnQuantity: itemReturnQty };
        } else {
          if ((item.depositAmount || 0) > 0) {
            const itemReturnQty = Math.min(item.quantity, availableForSwap);
            availableForSwap -= itemReturnQty;
            return { ...item, returnQuantity: itemReturnQty };
          }
          return item;
        }
      });

      AsyncStorage.setItem('cart', JSON.stringify(newCart)).catch(() => {});

      const targetItem = newCart.find(i => i.id === itemId);
      const payload = {
        productId: itemId,
        quantity: clampedQty,
        returnQuantity: targetItem?.returnQuantity || 0,
      };

      pendingUpdatesRef.current[itemId] = payload;

      if (timeoutRefs.current[itemId]) {
        clearTimeout(timeoutRefs.current[itemId]);
      }

      timeoutRefs.current[itemId] = setTimeout(() => {
        apiFetch('/api/cart', { method: 'POST', body: JSON.stringify(payload) })
          .then(() => { delete pendingUpdatesRef.current[itemId]; })
          .catch(err => console.error('Error updating cart on server:', err));
      }, 500);

      return newCart;
    });
  };

  const removeFromCart = (itemId) => {
    setCart(prevCart => {
      const newCart = prevCart.filter(item => item.id !== itemId);
      AsyncStorage.setItem('cart', JSON.stringify(newCart)).catch(() => {});

      const payload = { productId: itemId, quantity: 0 };
      pendingUpdatesRef.current[itemId] = payload;

      if (timeoutRefs.current[itemId]) {
        clearTimeout(timeoutRefs.current[itemId]);
      }

      apiFetch('/api/cart', { method: 'POST', body: JSON.stringify(payload) })
        .then(() => { delete pendingUpdatesRef.current[itemId]; })
        .catch(err => console.error('Error removing cart item on server:', err));

      return newCart;
    });
  };

  const calculateSubtotal = () => cart.filter(i => i.isAvailable !== false).reduce((sum, item) => sum + item.price * item.quantity, 0);
  
  const calculateGST = () => cart.filter(i => i.isAvailable !== false).reduce((sum, item) => {
    const itemGstRate = item.gst ?? 5.0;
    return sum + ((item.price * item.quantity) * (itemGstRate / 100));
  }, 0);

  const calculateDeposit = () => {
    const depositItems = cart.filter((item) => item.isAvailable !== false && (item.depositAmount || 0) > 0);
    if (depositItems.length === 0) return { toPay: 0, walletUsed: 0, walletCredit: 0, totalRequired: 0, cansRequiringDeposit: 0, depositRate: 0 };

    const currentCansInHand = customer?.cansInHand || 0;
    const pendingOrdered = customer?.pendingOrdered || 0;
    const pendingReturned = customer?.pendingReturned || 0;
    const walletBalance = customer?.depositWalletBalance || 0;
    const pendingDeposit = customer?.pendingDeposit || 0;

    const totalOrderedInCart = depositItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalReturnedInCart = depositItems.reduce((sum, item) => sum + (item.returnQuantity || 0), 0);
    const totalExplicitPendingReturns = pendingReturns || 0;

    const futureCansInHand = currentCansInHand + (pendingOrdered - pendingReturned) + (totalOrderedInCart - (totalReturnedInCart + totalExplicitPendingReturns));
    const depositRate = depositItems[0]?.depositAmount || 0;
    const requiredDepositBalance = Math.max(0, futureCansInHand * depositRate);
    const toPay = Math.max(0, requiredDepositBalance - walletBalance - pendingDeposit);

    if (toPay > 0) return { toPay, walletUsed: 0, walletCredit: 0, totalRequired: toPay, cansRequiringDeposit: Math.ceil(toPay / depositRate), depositRate };
    if (requiredDepositBalance < walletBalance) {
      const surplus = walletBalance - requiredDepositBalance;
      return { toPay: 0, walletUsed: 0, walletCredit: surplus, totalRequired: -surplus, cansRequiringDeposit: 0, depositRate };
    }
    return { toPay: 0, walletUsed: 0, walletCredit: 0, totalRequired: 0, cansRequiringDeposit: 0, depositRate };
  };

  const getUnavailableItems = () => cart.filter(i => i.isAvailable === false);
  const getAvailableItems = () => cart.filter(i => i.isAvailable !== false);
  const hasDepositProducts = () => cart.some(item => item.isAvailable !== false && (item.depositAmount || 0) > 0);

  const handleProceedToCheckout = async () => {
    const availableItems = getAvailableItems();
    if (availableItems.length === 0) return;
    if (getUnavailableItems().length > 0) {
      Toast.show({ type: 'error', text1: 'Remove Unavailable Items', text2: 'Please remove unavailable items before proceeding to checkout.' });
      return;
    }

    const hasHighQuantity = availableItems.some(item => item.quantity > 100);
    if (hasHighQuantity) {
      Toast.show({ type: 'error', text1: 'Quantity Too High', text2: 'Quantity cannot exceed 100 per item.' });
      return;
    }

    setIsLoading(true);
    await flushPendingUpdates();
    router.push('/order');
    setIsLoading(false);
  };

  if (isFetching) {
    return (
      <View className="flex-1 justify-center items-center bg-[#f3f7fb]">
        <ActivityIndicator size="large" color="#0ea5e9" />
      </View>
    );
  }

  if (cart.length === 0) {
    return (
      <View className="flex-1 bg-[#f3f7fb] justify-center items-center p-6">
        <View className="w-24 h-24 bg-blue-100 rounded-full items-center justify-center mb-6">
          <ShoppingCart size={48} color="#0ea5e9" />
        </View>
        <Text className="text-2xl font-bold text-black mb-2">Your cart is empty</Text>
        <Text className="text-gray-500 mb-8 text-center">Add items to your cart to continue</Text>
        <TouchableOpacity 
          className="bg-[#0ea5e9] px-8 py-3 rounded-md"
          onPress={() => router.push('/(tabs)/items')}
        >
          <Text className="text-white font-semibold text-lg">Browse Items</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const subtotal = calculateSubtotal();
  const gst = calculateGST();
  const depositInfo = calculateDeposit();
  const total = subtotal + gst + depositInfo.toPay;
  const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
  const unavailableItems = getUnavailableItems();

  return (
    <ScrollView className="flex-1 bg-[#f3f7fb]" contentContainerStyle={{ padding: 16 }}>
      <Text className="text-2xl font-bold text-black mb-1">Cart Summary</Text>
      <Text className="text-gray-500 mb-4">{totalQuantity} Item{totalQuantity !== 1 ? 's' : ''} in this cart</Text>

      {/* Unavailable items alert */}
      {unavailableItems.length > 0 && (
        <View className="bg-red-50 p-3 rounded-xl border border-red-200 mb-4 flex-row items-start">
          <AlertCircle size={20} color="#dc2626" className="mr-2 mt-0.5" />
          <Text className="text-red-700 flex-1 text-sm font-medium">
            Some products are no longer available. Please remove them before checkout.
          </Text>
        </View>
      )}

      {cart.map((item) => {
        const isUnavailable = item.isAvailable === false;
        return (
          <View key={item.id} className={`bg-white rounded-xl shadow-sm mb-4 border ${isUnavailable ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
            <View className="p-4 flex-row">
              {item.image ? (
                <Image source={{ uri: item.image }} style={{ width: 64, height: 64, borderRadius: 8, marginRight: 16 }} resizeMode="contain" />
              ) : (
                <View className="w-16 h-16 bg-sky-50 rounded-md items-center justify-center mr-4">
                  <ShoppingCart size={24} color="#0ea5e9" />
                </View>
              )}
              
              <View className="flex-1">
                <Text className="text-lg font-semibold text-black mb-2">{item.name}</Text>
                <Text className="text-lg font-bold text-black mb-3">₹{(item.price * item.quantity).toFixed(2)}</Text>
                
                <View className="flex-row items-center justify-between">
                  {/* Quantity controls with min=1 enforcement */}
                  <View className="flex-row items-center border border-blue-200 bg-blue-50 rounded-md">
                    <TouchableOpacity
                      onPress={() => updateQuantity(item.id, item.quantity - 1)}
                      disabled={isUnavailable || item.quantity <= 1}
                      className={`p-2 ${item.quantity <= 1 || isUnavailable ? 'opacity-40' : ''}`}
                    >
                      <Minus size={16} color="#0ea5e9" />
                    </TouchableOpacity>
                    <Text className="font-bold text-blue-700 px-3">{item.quantity}</Text>
                    <TouchableOpacity
                      onPress={() => updateQuantity(item.id, item.quantity + 1)}
                      disabled={isUnavailable || item.quantity >= 100}
                      className={`p-2 ${item.quantity >= 100 || isUnavailable ? 'opacity-40' : ''}`}
                    >
                      <Plus size={16} color="#0ea5e9" />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    onPress={() => removeFromCart(item.id)}
                    className="p-2 bg-red-50 rounded-md border border-red-200"
                  >
                    <Trash2 size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>

                {item.depositAmount > 0 && (
                  <View className="mt-4 pt-3 border-t border-gray-100">
                    {item.returnQuantity > 0 ? (
                      <View className="flex-row items-center">
                        <CheckCircle2 size={14} color="#15803d" className="mr-1" />
                        <Text className="text-xs text-green-700 flex-1">
                          {item.returnQuantity} empty {item.unit}{item.returnQuantity > 1 ? 's' : ''} will be collected from you.
                        </Text>
                      </View>
                    ) : (
                      <Text className="text-xs text-gray-700">
                        No empty {item.unit}s available to return from your stock.
                      </Text>
                    )}
                    {depositInfo.toPay > 0 && item.returnQuantity < item.quantity && (
                      <Text className="text-xs text-amber-600 font-medium mt-2">
                        Note: ₹{item.depositAmount.toFixed(2)} per new can for {item.quantity - item.returnQuantity} {item.unit}{item.quantity - item.returnQuantity > 1 ? 's' : ''}
                      </Text>
                    )}
                  </View>
                )}

                {isUnavailable && (
                  <View className="mt-3 flex-row items-center bg-red-100 px-3 py-2 rounded-md">
                    <AlertCircle size={14} color="#dc2626" className="mr-2" />
                    <Text className="text-xs font-medium text-red-700">This product was removed. Please remove it from your cart.</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        );
      })}

      <View className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mt-2 mb-6">
        <Text className="text-lg font-bold text-black mb-4">Order Summary</Text>
        
        {cart.map((item) => (
          <View key={item.id} className="flex-row justify-between mb-2">
            <Text className="text-gray-600 flex-1">{item.name} × {item.quantity}</Text>
            <Text className="text-black font-medium">₹{(item.price * item.quantity).toFixed(2)}</Text>
          </View>
        ))}
        
        <View className="border-t border-gray-100 mt-3 pt-3">
          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-600">Subtotal</Text>
            <Text className="text-black font-semibold">₹{subtotal.toFixed(2)}</Text>
          </View>
          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-600">GST</Text>
            <Text className="text-black font-semibold">₹{gst.toFixed(2)}</Text>
          </View>

          {pendingReturns > 0 && (
            <View className="flex-row justify-between mb-2">
              <Text className="text-blue-600 font-medium">Pending Returns Applied</Text>
              <Text className="text-blue-600 font-semibold">{pendingReturns} Cans</Text>
            </View>
          )}

          {(depositInfo.toPay > 0 || depositInfo.walletCredit > 0) ? (
            <View className="border-t border-dashed border-gray-200 mt-2 pt-2 mb-2">
              {depositInfo.toPay > 0 && (
                <View className="flex-row justify-between">
                  <View>
                    <Text className="font-semibold text-black">New Can Charges</Text>
                    {depositInfo.cansRequiringDeposit > 0 && depositInfo.depositRate > 0 && (
                      <Text className="text-xs text-gray-500">
                        ({depositInfo.cansRequiringDeposit} × ₹{depositInfo.depositRate.toFixed(2)})
                      </Text>
                    )}
                  </View>
                  <Text className="font-semibold text-black">₹{depositInfo.toPay.toFixed(2)}</Text>
                </View>
              )}
              {depositInfo.walletCredit > 0 && (
                <View className="flex-col p-2 bg-blue-50 rounded-md border border-blue-100 mt-1">
                  <View className="flex-row justify-between">
                    <View className="flex-row items-center">
                      <CheckCircle2 size={14} color="#1d4ed8" className="mr-1" />
                      <Text className="text-xs text-blue-700 font-bold">Deposit Surplus Available</Text>
                    </View>
                    <Text className="text-xs font-bold text-blue-700">₹{depositInfo.walletCredit.toFixed(2)}</Text>
                  </View>
                  <Text className="text-[10px] text-blue-600 mt-1">You have a surplus from extra returns. No deposit needed for this order.</Text>
                </View>
              )}
            </View>
          ) : hasDepositProducts() && (
            <View className="border-t border-dashed border-gray-200 mt-2 pt-2 mb-1">
              <View className="flex-row items-center">
                <CheckCircle2 size={12} color="#2563eb" className="mr-1" />
                <Text className="text-[10px] text-blue-600 italic">20L Can balance adjusted for this order</Text>
              </View>
            </View>
          )}

          <View className="border-t border-gray-200 mt-3 pt-3 flex-row justify-between items-center">
            <Text className="text-lg font-bold text-black">Total</Text>
            <Text className="text-xl font-bold text-[#0ea5e9]">₹{Math.round(total)}</Text>
          </View>
        </View>

        {unavailableItems.length > 0 && (
          <View className="bg-red-50 p-3 rounded-lg border border-red-200 mt-3">
            <Text className="text-xs text-red-700 text-center font-medium">Remove unavailable items to proceed</Text>
          </View>
        )}

        <TouchableOpacity 
          onPress={handleProceedToCheckout}
          disabled={isLoading || getAvailableItems().length === 0 || unavailableItems.length > 0}
          className={`w-full py-3 rounded-md items-center mt-5 ${isLoading || unavailableItems.length > 0 ? 'bg-sky-300' : 'bg-[#0ea5e9]'}`}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-bold text-lg">Proceed to Checkout</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Powered By STEDAXIS */}
      <View className="items-center justify-center py-6 mt-4 opacity-70">
        <Text className="text-[10px] text-gray-400">Powered by</Text>
        <TouchableOpacity onPress={() => Linking.openURL('https://www.stedaxis.com')}>
          <Text className="text-xs font-bold text-gray-500 mt-0.5 tracking-wider">STEDAXIS</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
