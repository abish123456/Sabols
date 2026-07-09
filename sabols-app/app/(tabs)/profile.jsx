import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert, Modal, Linking, BackHandler, Image } from 'react-native';
import Toast from 'react-native-toast-message';
import { useRouter, useLocalSearchParams, useNavigation, Tabs, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, LogOut, Pencil, Save, AlertCircle, Wallet, ShoppingBag, MapPin, CreditCard, History, ChevronRight, Phone, Mail, CheckCircle2, X, Copy, ShoppingCart, Bell } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetch } from '../../lib/api';
import * as Clipboard from 'expo-clipboard';
import AddressesManager from '../../components/AddressesManager';
import ReturnSelector from '../../components/ReturnSelector';
import AddressForm from '../../components/AddressForm';

export default function ProfileScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isNewProfile, setIsNewProfile] = useState(params.isNewUser === 'true');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [addresses, setAddresses] = useState([]);
  const [cartCount, setCartCount] = useState(0);
  
  const [cansInHand, setCansInHand] = useState(0);
  const [depositWalletBalance, setDepositWalletBalance] = useState(0);
  const [orderWalletBalance, setOrderWalletBalance] = useState(0);
  const [customerId, setCustomerId] = useState('');
  
  const [showAddressesModal, setShowAddressesModal] = useState(false);
  const [showPaymentsModal, setShowPaymentsModal] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState({ upi: [], card: [] });

  useEffect(() => {
    if (isNewProfile) {
      const backAction = () => {
        Alert.alert('Cancel Setup', 'Are you sure you want to go back? This will cancel your registration and log you out.', [
          { text: 'Cancel', style: 'cancel', onPress: () => null },
          { 
            text: 'Yes', 
            style: 'destructive',
            onPress: async () => {
              await AsyncStorage.multiRemove(['isLoggedIn', 'userPhone', 'authToken', 'lastUserPhone', 'isNewUserFlow', 'cart']);
              router.replace('/login');
            }
          },
        ]);
        return true;
      };

      const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
      return () => backHandler.remove();
    }
  }, [isNewProfile]);

  const [formData, setFormData] = useState({
    name: '',
    nickname: '',
    contactPhone: '',
    addressLine1: '',
    addressLine2: '',
    area: '',
    city: '',
    pincode: '',
    landmark: '',
    location: null,
  });

  const [hasExistingDeposit, setHasExistingDeposit] = useState('');
  const [depositProducts, setDepositProducts] = useState([]);
  const [selectedDepositProductId, setSelectedDepositProductId] = useState('');
  const [depositQuantity, setDepositQuantity] = useState('1');
  const [isLoadingDepositProducts, setIsLoadingDepositProducts] = useState(false);

  // Support Contacts
  const [supportContacts, setSupportContacts] = useState([]);
  const [showSupportModal, setShowSupportModal] = useState(false);

  // Refund Flow
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundQuantity, setRefundQuantity] = useState('1');
  const [refundMethod, setRefundMethod] = useState('cod'); // 'cod', 'upi', 'account'
  const [refundBankDetails, setRefundBankDetails] = useState({ upiId: '', accountNumber: '', ifscCode: '', bankName: '' });
  const [isRefundSubmitting, setIsRefundSubmitting] = useState(false);
  const [refundHistory, setRefundHistory] = useState([]);
  const [refundError, setRefundError] = useState('');

  const fetchRefundHistory = async () => {
    try {
      const res = await apiFetch('/api/user/deposit-refund');
      if (res.ok) {
        const data = await res.json();
        setRefundHistory(data.requests || []);
      }
    } catch (err) {
      console.error("Failed to fetch refund history", err);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await apiFetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.config?.supportContacts) {
          setSupportContacts(data.config.supportContacts);
        }
      }
    } catch (err) {
      console.error('Error fetching config:', err);
    }
  };

  const loadDepositProducts = async () => {
    try {
      setIsLoadingDepositProducts(true);
      const res = await apiFetch('/api/products?forDeposit=true');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.products) {
          setDepositProducts(data.products);
          if (data.products.length > 0) setSelectedDepositProductId(data.products[0].id);
        }
      }
    } catch (err) {
      console.error('Error loading deposit products', err);
    } finally {
      setIsLoadingDepositProducts(false);
    }
  };

  const loadProfile = useCallback(async () => {
      try {
        const phone = await AsyncStorage.getItem('userPhone');
        if (phone) setPhoneNumber(phone);

        // Fetch profile and addresses in parallel for speed
        const [response, addrResponse] = await Promise.all([
          apiFetch('/api/user/profile'),
          apiFetch('/api/user/addresses'),
        ]);

        if (response.ok) {
          const data = await response.json();
          if (data.profile) {
            setFormData({
              name: data.profile.name || '',
              nickname: data.profile.nickname || '',
              contactPhone: data.profile.contactPhone || '',
              addressLine1: data.profile.addressLine1 || '',
              addressLine2: data.profile.addressLine2 || '',
              area: data.profile.area || '',
              city: data.profile.city || '',
              pincode: data.profile.pincode || '',
              landmark: data.profile.landmark || '',
              location: data.profile.latitude && data.profile.longitude ? { type: 'Point', coordinates: [data.profile.longitude, data.profile.latitude] } : null,
            });
            setCansInHand(data.profile.cansInHand || 0);
            setDepositWalletBalance(data.profile.depositWalletBalance || 0);
            setOrderWalletBalance(data.profile.orderWalletBalance || 0);
            
            const hasBasicInfo = data.profile.name || data.profile.addressLine1 || data.profile.area || data.profile.city || data.profile.pincode;
            
            if (!hasBasicInfo) {
              setIsEditing(true);
              setIsNewProfile(true);
              loadDepositProducts();
            } else {
              // Rescue stuck users: if they have basic info, they are NOT a new profile anymore!
              setIsNewProfile(false);
              AsyncStorage.removeItem('isNewUserFlow').catch(() => {});
              
              setCustomerId(data.profile.id || '');
              setPaymentMethods(data.profile.paymentMethods || { upi: [], card: [] });
            }
          }
        }
        
        // Always use the dedicated addresses endpoint as source of truth
        if (addrResponse.ok) {
          const addrData = await addrResponse.json();
          if (Array.isArray(addrData.addresses)) {
            setAddresses(addrData.addresses);
          }
        }
      } catch (err) {
        console.error('Error loading profile:', err);
      } finally {
        setIsLoading(false);
      }
  }, []);

  const refreshAddresses = useCallback(async () => {
    try {
      const res = await apiFetch('/api/user/addresses');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.addresses)) {
          setAddresses(data.addresses);
        }
      }
    } catch (err) {
      console.error('Error refreshing addresses:', err);
    }
  }, []);


  useFocusEffect(
    useCallback(() => {
      loadProfile();
      fetchRefundHistory();
      fetchConfig();
      AsyncStorage.getItem('cart').then(c => {
        if (c) {
          const parsed = JSON.parse(c);
          setCartCount(Array.isArray(parsed) ? parsed.length : 0);
        }
      });
    }, [loadProfile])
  );

  useEffect(() => {
    if (params.openAddresses === 'true') {
      setShowAddressesModal(true);
    }
  }, [params.openAddresses]);

  const handleCloseAddresses = () => {
    setShowAddressesModal(false);
    if (params.returnToHome === 'true') {
      router.setParams({ openAddresses: '', returnToHome: '' });
      router.push('/(tabs)/items');
    }
  };

  const validateForm = () => {
    // Name validation
    const trimmedName = formData.name ? formData.name.trim() : '';
    if (!trimmedName) return 'Name is required';
    if (trimmedName.length < 2) return 'Name must be at least 2 characters';
    if (trimmedName.length > 100) return 'Name must not exceed 100 characters';
    if (!/^[a-zA-Z\s\-']+$/.test(trimmedName)) return 'Name can only contain letters, spaces, hyphens, and apostrophes';

    // Contact Phone validation
    const trimmedPhone = formData.contactPhone ? formData.contactPhone.trim() : '';
    if (!trimmedPhone) return 'Contact phone is required';
    if (trimmedPhone.startsWith('0')) return 'Contact phone cannot start with 0';
    if (!/^\d{10}$/.test(trimmedPhone)) return 'Valid 10-digit contact phone is required';
    
    if (isNewProfile) {
      if (!hasExistingDeposit) return 'Please select if you are an existing customer';
      if (hasExistingDeposit === 'yes') {
        if (!selectedDepositProductId) return 'Please select a deposit product';
        const qty = parseInt(depositQuantity, 10);
        if (isNaN(qty) || qty <= 0) return 'Deposit quantity must be at least 1';
        if (qty > 50) return 'Maximum 50 deposit cans allowed';
      }
    }

    if (isNewProfile || formData.addressLine1 || formData.pincode || formData.city || formData.area) {
      const trimmedAddr = formData.addressLine1 ? formData.addressLine1.trim() : '';
      if (!trimmedAddr) return 'Address Line 1 is required';
      if (trimmedAddr.length < 5) return 'Address Line 1 must be at least 5 characters';
      if (trimmedAddr.length > 200) return 'Address Line 1 must not exceed 200 characters';

      const trimmedCity = formData.city ? formData.city.trim() : '';
      if (!trimmedCity) return 'City is required';
      if (trimmedCity.length < 2) return 'City must be at least 2 characters';
      if (trimmedCity.length > 100) return 'City must not exceed 100 characters';
      if (!/^[a-zA-Z\s\-]+$/.test(trimmedCity)) return 'City can only contain letters, spaces, and hyphens';

      const trimmedArea = formData.area ? formData.area.trim() : '';
      if (!trimmedArea) return 'Area/Zone is required';
      if (trimmedArea.length < 2) return 'Area/Zone must be at least 2 characters';
      if (trimmedArea.length > 100) return 'Area/Zone must not exceed 100 characters';

      const trimmedPin = formData.pincode ? formData.pincode.trim() : '';
      if (!trimmedPin) return 'Pincode is required';
      if (!/^\d{6}$/.test(trimmedPin)) return 'Pincode must be exactly 6 digits';
      const pinNum = parseInt(trimmedPin, 10);
      if (pinNum < 100000 || pinNum > 999999) return 'Pincode must be between 100000 and 999999';

      if (isNewProfile && (!formData.location?.coordinates || formData.location.coordinates.length < 2)) {
        return 'Please pin your exact location on the map';
      }
    }
    
    return null;
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');
    
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    
    setIsSaving(true);
    try {
      const payload = { ...formData, latitude: formData.location?.coordinates?.[1] || null, longitude: formData.location?.coordinates?.[0] || null };
      
      if (isNewProfile && hasExistingDeposit === 'yes') {
        payload.hasExistingDeposit = true;
        payload.depositProducts = [{ productId: selectedDepositProductId, quantity: parseInt(depositQuantity, 10) }];
      }

      const response = await apiFetch('/api/user/profile', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setIsEditing(false);
        setIsNewProfile(false);
        await AsyncStorage.removeItem('isNewUserFlow'); // Clear the flag so they don't get trapped here on app restart!
        setSuccess('Profile saved successfully!');
        setTimeout(() => setSuccess(''), 3000);
        if (isNewProfile) {
          router.replace('/(tabs)/items'); // Use replace to prevent going back to profile
        }
      } else {
        const data = await response.json();
        setError(data.message || 'Failed to save profile');
      }
    } catch (err) {
      console.error('Error saving profile:', err);
      setError('Network error. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure want to logout? You will need to log in again to access your orders and profile.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: async () => {
          try {
            await apiFetch('/api/auth/logout', { method: 'POST' });
          } catch (e) {
            console.error('Logout API failed:', e);
          }
          await AsyncStorage.removeItem('authToken');
          await AsyncStorage.removeItem('userPhone');
          await AsyncStorage.removeItem('isLoggedIn');
          router.replace('/login');
        }
      }
    ]);
  };

  const handleCopyId = async () => {
    if (customerId) {
      await Clipboard.setStringAsync(customerId);
      Toast.show({ type: 'success', text1: 'Copied', text2: 'Customer ID copied to clipboard' });
    }
  };

  const handleRefundSubmit = async () => {
    setRefundError('');
    const qty = parseInt(refundQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
      setRefundError('Invalid quantity');
      return;
    }
    if (qty > cansInHand) {
      setRefundError(`Cannot return more than ${cansInHand} cans`);
      return;
    }
    
    if (refundMethod === 'upi' && !refundBankDetails.upiId) {
      setRefundError('UPI ID is required'); return;
    }
    if (refundMethod === 'account' && (!refundBankDetails.accountNumber || !refundBankDetails.ifscCode)) {
      setRefundError('Account Number and IFSC Code are required'); return;
    }

    setIsRefundSubmitting(true);
    try {
      const res = await apiFetch('/api/user/deposit-refund', {
        method: 'POST',
        body: JSON.stringify({
          quantity: qty,
          refundMethod: refundMethod === 'cod' ? 'COD' : 'ONLINE',
          bankDetails: refundMethod === 'cod' ? null : { type: refundMethod, ...refundBankDetails }
        })
      });
      const data = await res.json();
      if (res.ok) {
        setRefundHistory(prev => [data.refund, ...prev]);
        setShowRefundModal(false);
        setRefundQuantity('');
        Toast.show({ type: 'success', text1: 'Success', text2: 'Refund request submitted successfully' });
      } else {
        setRefundError(data.message || 'Failed to submit request');
      }
    } catch (e) {
      setRefundError('Network error');
    } finally {
      setIsRefundSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-[#f3f7fb]">
        <ActivityIndicator size="large" color="#0ea5e9" />
      </View>
    );
  }

  return (
    <>
      <Tabs.Screen options={{ 
        tabBarStyle: { 
          display: isNewProfile ? 'none' : 'flex',
          pointerEvents: isSaving ? 'none' : 'auto',
          opacity: isSaving ? 0.5 : 1
        } 
      }} />
      <View className="flex-1 bg-[#f3f7fb]" pointerEvents={isSaving ? "none" : "auto"}>
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      
        {!isNewProfile && (
          <View className="mb-2" />
        )}
      
      {/* ─── Support Modal ──────────────────────────────────────────────── */}
      <Modal visible={showSupportModal} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl p-6">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold text-black flex-row items-center">
                <AlertCircle size={20} color="#0ea5e9" /> Support & Help
              </Text>
              <TouchableOpacity onPress={() => setShowSupportModal(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            
            {supportContacts.length === 0 ? (
              <Text className="text-center text-gray-500 py-4">Support is currently unavailable.</Text>
            ) : (
              <View className="space-y-4">
                {supportContacts.map(c => (
                  <TouchableOpacity 
                    key={c.id} 
                    onPress={() => {
                      if (c.type === 'PHONE') Linking.openURL(`tel:${c.value}`);
                      if (c.type === 'EMAIL') Linking.openURL(`mailto:${c.value}`);
                    }}
                    className="flex-row items-center p-4 bg-gray-50 rounded-xl border border-gray-200"
                  >
                    <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-4">
                      {c.type === 'PHONE' ? <Phone size={20} color="#0ea5e9" /> : <Mail size={20} color="#0ea5e9" />}
                    </View>
                    <View className="flex-1">
                      <Text className="text-xs text-gray-500 font-bold uppercase">{c.label}</Text>
                      <Text className="text-base font-bold text-black">{c.value}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <TouchableOpacity onPress={() => setShowSupportModal(false)} className="mt-6 py-4 bg-gray-100 rounded-xl items-center">
              <Text className="font-bold text-gray-700">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── Refund Modal ───────────────────────────────────────────────── */}
      <Modal visible={showRefundModal} animationType="fade" transparent>
        <View className="flex-1 justify-center bg-black/50 p-4" pointerEvents={isRefundSubmitting ? "none" : "auto"}>
          <View className="bg-white rounded-2xl p-6">
            <Text className="text-xl font-bold text-black mb-2">Request Refund</Text>
            <Text className="text-gray-500 mb-4">Select number of empty cans to return.</Text>
            
            {refundError ? <Text className="text-red-500 mb-4 text-sm">{refundError}</Text> : null}

            <Text className="font-semibold text-black mb-2">Quantity (Max: {cansInHand})</Text>
            <TextInput 
              value={refundQuantity}
              onChangeText={setRefundQuantity}
              keyboardType="numeric"
              className="border border-gray-300 rounded-lg p-3 text-lg text-center mb-4"
            />

            <Text className="font-semibold text-black mb-2">Refund Method</Text>
            <View className="flex-row gap-4 mb-4">
              {['cod', 'upi', 'account'].map(type => (
                <TouchableOpacity 
                  key={type} 
                  onPress={() => setRefundMethod(type)}
                  className={`flex-row items-center p-2 rounded border ${refundMethod === type ? 'border-sky-500 bg-blue-50' : 'border-gray-200'}`}
                >
                  <View className={`w-4 h-4 rounded-full border mr-2 items-center justify-center ${refundMethod === type ? 'border-sky-500' : 'border-gray-300'}`}>
                    {refundMethod === type && <View className="w-2 h-2 rounded-full bg-[#0ea5e9]" />}
                  </View>
                  <Text className="capitalize text-sm font-semibold">{type === 'cod' ? 'Cash' : type}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {refundMethod === 'upi' && (
              <TextInput placeholder="UPI ID" value={refundBankDetails.upiId} onChangeText={t => setRefundBankDetails(p => ({...p, upiId: t}))} className="border border-gray-300 rounded-lg p-3 mb-4" />
            )}
            {refundMethod === 'account' && (
              <>
                <TextInput placeholder="Account Number" value={refundBankDetails.accountNumber} onChangeText={t => setRefundBankDetails(p => ({...p, accountNumber: t}))} className="border border-gray-300 rounded-lg p-3 mb-2" />
                <TextInput placeholder="IFSC Code" value={refundBankDetails.ifscCode} onChangeText={t => setRefundBankDetails(p => ({...p, ifscCode: t}))} className="border border-gray-300 rounded-lg p-3 mb-4" />
              </>
            )}

            <View className="flex-row gap-3">
              <TouchableOpacity onPress={() => setShowRefundModal(false)} className="flex-1 py-4 border border-gray-300 rounded-xl items-center"><Text className="font-bold text-gray-700">Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleRefundSubmit} disabled={isRefundSubmitting} className="flex-1 py-4 bg-[#0ea5e9] rounded-xl items-center">
                <Text className="font-bold text-white">{isRefundSubmitting ? 'Submitting...' : 'Submit'}</Text>
              </TouchableOpacity>
            </View>

            {isRefundSubmitting && (
              <View className="absolute inset-0 bg-white/60 z-50 rounded-2xl items-center justify-center">
                <ActivityIndicator size="large" color="#0ea5e9" />
              </View>
            )}
          </View>
        </View>
      </Modal>

      {!isEditing && (
        <View className="items-center mb-6 mt-2">
          <View className="w-24 h-24 bg-blue-100 rounded-full items-center justify-center mb-4">
            <User size={48} color="#0ea5e9" />
          </View>
          <View className="items-center w-full">
            <View className="flex-row items-center justify-center mb-1">
              <Text className="text-xl font-bold text-black mr-2">{formData.name || 'Set Name'}</Text>
              <TouchableOpacity onPress={() => setIsEditing(true)} className="p-2 bg-gray-100 rounded-full">
                <Pencil size={14} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <Text className="text-gray-500 text-center">{phoneNumber}</Text>
            {customerId && (
              <TouchableOpacity onPress={handleCopyId} className="mt-2 flex-row items-center bg-gray-100 px-3 py-1 rounded-full">
                <Text className="text-xs font-mono font-bold text-gray-500 tracking-widest">#{customerId.slice(-8).toUpperCase()}</Text>
                <View className="ml-2">
                  <Copy size={12} color="#6b7280" />
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {isEditing && (
        <View className="p-4 border-b border-gray-200 mb-6 bg-white mx-[-16px] mt-[-16px]">
          <View className="flex-row items-center gap-3">
            <View className="rounded-full bg-blue-50 p-2.5">
              <User size={24} color="#0ea5e9" />
            </View>
            <View>
              <Text className="text-lg font-bold text-black">Edit Profile</Text>
              <Text className="text-xs text-gray-500">Update your details</Text>
            </View>
          </View>
        </View>
      )}

      {/* ─── Stats Dashboard ───────────────────────────────────────────── */}
      {!isEditing && (
        <View className="flex-row gap-3 mb-4">
          <View className="flex-1 bg-blue-50/50 border border-blue-100 py-3 px-2 rounded-xl items-center">
            <View className="w-8 h-8 bg-blue-100 rounded-full items-center justify-center mb-1">
              <Wallet size={16} color="#0ea5e9" />
            </View>
            <Text className="text-lg font-bold text-[#0ea5e9]">₹{Math.ceil(depositWalletBalance)}</Text>
            <Text className="text-[9px] uppercase font-bold text-gray-500 text-center">Deposit Paid</Text>
          </View>

          {orderWalletBalance > 0 && (
            <View className="flex-1 bg-green-50/50 border border-green-100 py-3 px-2 rounded-xl items-center">
              <View className="w-8 h-8 bg-green-100 rounded-full items-center justify-center mb-1">
                <ShoppingCart size={16} color="#16a34a" />
              </View>
              <Text className="text-lg font-bold text-green-600">₹{Math.ceil(orderWalletBalance)}</Text>
              <Text className="text-[9px] uppercase font-bold text-gray-500 text-center">Order Wallet</Text>
            </View>
          )}

          <View className="flex-1 bg-orange-50/50 border border-orange-100 py-3 px-2 rounded-xl items-center">
            <View className="w-8 h-8 bg-orange-100 rounded-full items-center justify-center mb-1">
              <ShoppingBag size={16} color="#ea580c" />
            </View>
            <Text className="text-lg font-bold text-orange-600">{cansInHand}</Text>
            <Text className="text-[9px] uppercase font-bold text-gray-500 text-center">Empty Cans</Text>
          </View>
        </View>
      )}

      {error ? (
        <View className="bg-red-50 p-3 rounded-md border border-red-200 mb-4 flex-row items-center">
          <AlertCircle size={20} color="#dc2626" style={{ marginRight: 8 }} />
          <Text className="text-red-700">{error}</Text>
        </View>
      ) : null}
      
      {success ? (
        <View className="bg-green-50 p-3 rounded-md border border-green-200 mb-4 flex-row items-center">
          <CheckCircle2 size={20} color="#16a34a" style={{ marginRight: 8 }} />
          <Text className="text-green-700">{success}</Text>
        </View>
      ) : null}

      {!isEditing && (
        <View className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
          <TouchableOpacity onPress={() => setShowAddressesModal(true)} className="flex-row items-center justify-between p-3 border-b border-gray-100">
            <View className="flex-row items-center">
              <View className="w-8 h-8 bg-blue-50 rounded-full items-center justify-center mr-3"><MapPin size={16} color="#0ea5e9" /></View>
              <Text className="font-semibold text-black text-sm">My Addresses</Text>
            </View>
            <ChevronRight size={16} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setShowPaymentsModal(true)} className="flex-row items-center justify-between p-3 border-b border-gray-100">
            <View className="flex-row items-center">
              <View className="w-8 h-8 bg-green-50 rounded-full items-center justify-center mr-3"><CreditCard size={16} color="#16a34a" /></View>
              <Text className="font-semibold text-black text-sm">Payment Methods</Text>
            </View>
            <ChevronRight size={16} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/(tabs)/orders')} className="flex-row items-center justify-between p-3 border-b border-gray-100">
            <View className="flex-row items-center">
              <View className="w-8 h-8 bg-purple-50 rounded-full items-center justify-center mr-3"><History size={16} color="#9333ea" /></View>
              <Text className="font-semibold text-black text-sm">Order History</Text>
            </View>
            <ChevronRight size={16} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setShowRefundModal(true)} className="flex-row items-center justify-between p-3 border-b border-gray-100">
            <View className="flex-row items-center">
              <View className="w-8 h-8 bg-orange-50 rounded-full items-center justify-center mr-3"><Wallet size={16} color="#ea580c" /></View>
              <View>
                <Text className="font-semibold text-black text-sm">Request Refund</Text>
                <Text className="text-[10px] text-gray-500 uppercase font-medium">Return empty cans</Text>
              </View>
            </View>
            <ChevronRight size={16} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setShowSupportModal(true)} className="flex-row items-center justify-between p-3">
            <View className="flex-row items-center">
              <View className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center mr-3"><AlertCircle size={16} color="#4b5563" /></View>
              <Text className="font-semibold text-black text-sm">Support & Help</Text>
            </View>
            <ChevronRight size={16} color="#9ca3af" />
          </TouchableOpacity>
        </View>
      )}

      {/* ─── Refund History ───────────────────────────────────────────── */}
      {!isEditing && refundHistory.length > 0 && (
        <View className="mb-6">
          <Text className="text-xs font-bold text-gray-500 uppercase ml-2 mb-3">Refund History</Text>
          <View className="space-y-3">
            {refundHistory.slice(0, 3).map(r => (
              <View key={r.id} className="bg-white p-4 rounded-xl border border-gray-200 flex-row justify-between items-center">
                <View>
                  <Text className="font-bold text-black">{r.quantity} Cans</Text>
                  <Text className="text-xs text-gray-500">{new Date(r.createdAt).toLocaleDateString()}</Text>
                </View>
                <View className={`px-3 py-1 rounded-full ${r.status === 'PENDING' ? 'bg-orange-100' : r.status === 'APPROVED' ? 'bg-green-100' : 'bg-gray-100'}`}>
                  <Text className={`text-xs font-bold ${r.status === 'PENDING' ? 'text-orange-600' : r.status === 'APPROVED' ? 'text-green-600' : 'text-gray-600'}`}>{r.status}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {isEditing && (
        <View className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6 p-4 space-y-4">
          
          {isNewProfile && (
            <View className="mb-4">
              <Text className="text-sm font-semibold text-gray-700 mb-2">Are you an old customer of Sabols? *</Text>
              <View className="flex-row gap-6 mt-1">
                <TouchableOpacity onPress={() => setHasExistingDeposit('no')} className="flex-row items-center gap-2">
                  <View className={`w-5 h-5 rounded-full border items-center justify-center ${hasExistingDeposit === 'no' ? 'border-sky-500' : 'border-gray-300'}`}>
                    {hasExistingDeposit === 'no' && <View className="w-3 h-3 rounded-full bg-[#0ea5e9]" />}
                  </View>
                  <Text className="text-gray-700">No</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setHasExistingDeposit('yes')} className="flex-row items-center gap-2">
                  <View className={`w-5 h-5 rounded-full border items-center justify-center ${hasExistingDeposit === 'yes' ? 'border-sky-500' : 'border-gray-300'}`}>
                    {hasExistingDeposit === 'yes' && <View className="w-3 h-3 rounded-full bg-[#0ea5e9]" />}
                  </View>
                  <Text className="text-gray-700">Yes</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {isNewProfile && hasExistingDeposit === 'yes' && (
            <View className="p-4 bg-gray-50 border border-gray-200 rounded-lg mb-4 space-y-4">
              {isLoadingDepositProducts ? (
                <ActivityIndicator color="#0ea5e9" />
              ) : depositProducts.length === 0 ? (
                <Text className="text-sm text-gray-500">No deposit products available.</Text>
              ) : (
                <>
                  {depositProducts.length > 1 && (
                    <View>
                      <Text className="text-sm font-semibold text-gray-700 mb-1">Select Product *</Text>
                      {depositProducts.map(p => (
                        <TouchableOpacity 
                          key={p.id} 
                          onPress={() => setSelectedDepositProductId(p.id)}
                          className={`p-3 border rounded-lg mb-2 ${selectedDepositProductId === p.id ? 'border-sky-500 bg-blue-50' : 'border-gray-200 bg-white'}`}
                        >
                          <Text className={`font-medium ${selectedDepositProductId === p.id ? 'text-sky-500' : 'text-gray-700'}`}>{p.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  <View>
                    <Text className="text-sm font-semibold text-gray-700 mb-1">
                      {depositProducts.length === 1
                        ? `How many ${depositProducts[0].name} (${depositProducts[0].unit || 'item'}${depositProducts[0].unit?.endsWith('s') ? '' : 's'}) have you got in your hand? *`
                        : `Quantity (${depositProducts.find(p => p.id === selectedDepositProductId)?.unit || 'item'}${depositProducts.find(p => p.id === selectedDepositProductId)?.unit?.endsWith('s') ? '' : 's'}) *`}
                    </Text>
                    <TextInput 
                      value={depositQuantity}
                      onChangeText={t => {
                        const val = parseInt(t, 10);
                        if (!isNaN(val) && val > 0 && val <= 50) setDepositQuantity(val.toString());
                        else if (t === '') setDepositQuantity('');
                      }}
                      keyboardType="numeric"
                      className="border border-gray-300 rounded-lg p-3 bg-white text-black"
                      placeholder="e.g. 2"
                    />
                  </View>
                </>
              )}
            </View>
          )}

          <View>
            <Text className="text-sm font-semibold text-gray-500 mb-1">Full Name *</Text>
            <TextInput 
              value={formData.name}
              onChangeText={(text) => { setFormData({...formData, name: text}); setError(''); }}
              className="border border-gray-300 rounded-md p-3 text-black bg-white"
              placeholder="Enter your name"
            />
          </View>

          {isNewProfile && (
            <View className="mt-4 pt-4 border-t border-gray-100">
              <View className="flex-row items-center gap-2 mb-4">
                <MapPin size={20} color="#0ea5e9" />
                <Text className="text-base font-semibold text-black">Address</Text>
              </View>
              <AddressForm 
                formData={formData} 
                onChange={(key, val) => setFormData(p => ({...p, [key]: val}))} 
                errors={{}} 
                showDefaultToggle={false} 
              />
            </View>
          )}

          <View className="flex-row gap-3 pt-4 mt-2 border-t border-gray-100">
            {!isNewProfile && (
              <TouchableOpacity 
                onPress={() => { setIsEditing(false); loadProfile(); setError(''); }}
                className="flex-1 py-3 border border-gray-300 rounded-md items-center"
              >
                <Text className="font-bold text-gray-700">Cancel</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              onPress={handleSave}
              disabled={isSaving}
              className={`flex-1 py-3 rounded-md items-center flex-row justify-center ${isSaving ? 'bg-sky-300' : 'bg-sky-500'}`}
            >
              {isSaving ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-lg">Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!isEditing && (
        <View className="mb-4">
          <TouchableOpacity 
            onPress={handleLogout}
            className="bg-red-50 py-3 rounded-xl border border-red-200 items-center flex-row justify-center"
          >
            <LogOut size={16} color="#ef4444" style={{ marginRight: 8 }} />
            <Text className="text-red-600 font-bold text-base">Log Out</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ─── Addresses Modal ───────────────────────────────────────────── */}
      <Modal visible={showAddressesModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleCloseAddresses}>
        <SafeAreaView className="flex-1 bg-[#f3f7fb]">
          <View className="flex-row justify-between items-center p-4 border-b border-gray-200 bg-white">
            <Text className="text-lg font-bold text-black">My Addresses</Text>
            <TouchableOpacity onPress={handleCloseAddresses} className="w-8 h-8 items-center justify-center rounded-full bg-gray-100">
              <X size={20} color="#000" />
            </TouchableOpacity>
          </View>
          <ScrollView className="flex-1 p-4" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <AddressesManager addresses={addresses} onRefresh={refreshAddresses} setAddresses={setAddresses} />
            <View className="h-10" />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ─── Payment Methods Modal ─────────────────────────────────────── */}
      <Modal visible={showPaymentsModal} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl p-6 max-h-[80%]">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold text-black flex-row items-center">
                <CreditCard size={20} color="#0ea5e9" /> Payment Methods
              </Text>
              <TouchableOpacity onPress={() => setShowPaymentsModal(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            
            <ScrollView className="space-y-4" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text className="text-sm text-gray-500 mb-2">Saved payment methods cannot be edited directly. Delete them and add a new one during checkout if needed.</Text>
              
              <Text className="font-bold text-black mt-2">Saved UPI IDs</Text>
              {paymentMethods.upi && paymentMethods.upi.length > 0 ? paymentMethods.upi.map(pm => (
                <View key={pm.id} className="bg-white p-4 rounded-xl border border-gray-200 flex-row justify-between items-center">
                  <Text className="font-semibold text-black">{pm.details}</Text>
                  {pm.isDefault && <Text className="text-xs font-bold text-[#0ea5e9] bg-sky-50 px-2 py-1 rounded">Default</Text>}
                </View>
              )) : <Text className="text-sm text-gray-500 italic">No saved UPI IDs</Text>}

              <Text className="font-bold text-black mt-4">Saved Cards</Text>
              {paymentMethods.card && paymentMethods.card.length > 0 ? paymentMethods.card.map(pm => (
                <View key={pm.id} className="bg-white p-4 rounded-xl border border-gray-200 flex-row justify-between items-center">
                  <View>
                    <Text className="font-semibold text-black">
                      **** **** **** {pm.cardLast4 || 'XXXX'} {pm.cardBrand ? `(${pm.cardBrand})` : ''}
                    </Text>
                    {pm.razorpayTokenId && <Text className="text-xs text-[#0ea5e9] font-bold mt-1">⚡ Quick Pay active</Text>}
                  </View>
                  {pm.isDefault && <Text className="text-xs font-bold text-[#0ea5e9] bg-sky-50 px-2 py-1 rounded">Default</Text>}
                </View>
              )) : <Text className="text-sm text-gray-500 italic">No saved cards</Text>}
              <View className="h-4" />
            </ScrollView>
            
            <TouchableOpacity onPress={() => setShowPaymentsModal(false)} className="mt-4 py-4 bg-gray-100 rounded-xl items-center">
              <Text className="font-bold text-gray-700">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

          {/* Powered By STEDAXIS */}
          <View className="flex-row items-center justify-center py-6 opacity-70">
            <Text className="text-xs font-medium text-gray-400 mr-1.5">Powered by</Text>
            <TouchableOpacity onPress={() => Linking.openURL('https://www.stedaxis.com').catch(() => {})}>
              <Image source={require('../../assets/stedaxis_logo.png')} style={{ width: 70, height: 14 }} resizeMode="contain" />
            </TouchableOpacity>
          </View>

        </ScrollView>
        {isSaving && (
          <View className="absolute inset-0 bg-white/60 z-50 items-center justify-center">
            <ActivityIndicator size="large" color="#0ea5e9" />
          </View>
        )}
      </View>
    </>
  );
}
