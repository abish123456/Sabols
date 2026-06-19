import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert, Modal, Linking } from 'react-native';
import Toast from 'react-native-toast-message';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, LogOut, Pencil, Save, AlertCircle, Wallet, ShoppingBag, MapPin, CreditCard, History, ChevronRight, Phone, Mail, CheckCircle2, X, Copy } from 'lucide-react-native';
import { apiFetch } from '../../lib/api';
import * as Clipboard from 'expo-clipboard';
import AddressesManager from '../../components/AddressesManager';
import ReturnSelector from '../../components/ReturnSelector';

export default function ProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [addresses, setAddresses] = useState([]);
  
  const [cansInHand, setCansInHand] = useState(0);
  const [depositWalletBalance, setDepositWalletBalance] = useState(0);
  const [customerId, setCustomerId] = useState('');
  
  const [showAddressesModal, setShowAddressesModal] = useState(false);
  const [showPaymentsModal, setShowPaymentsModal] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState({ upi: [], card: [] });

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
  });

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

  const loadProfile = useCallback(async () => {
      try {
        const phone = await AsyncStorage.getItem('userPhone');
        if (phone) setPhoneNumber(phone);

        const response = await apiFetch('/api/user/profile');
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
            });
            setCansInHand(data.profile.cansInHand || 0);
            setDepositWalletBalance(data.profile.depositWalletBalance || 0);
            
            // If profile is empty, start in edit mode
            if (!data.profile.name) {
              setIsEditing(true);
            } else {
              setCustomerId(data.profile.id || '');
              setPaymentMethods(data.profile.paymentMethods || { upi: [], card: [] });
            }
          }
        }
        
        const addrResponse = await apiFetch('/api/user/addresses');
        if (addrResponse.ok) {
          const addrData = await addrResponse.json();
          setAddresses(addrData.addresses || []);
        }
      } catch (err) {
        console.error('Error loading profile:', err);
      } finally {
        setIsLoading(false);
      }
  }, []);

  useEffect(() => {
    loadProfile();
    fetchRefundHistory();
    fetchConfig();
  }, [loadProfile]);

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
    if (!formData.name.trim()) return 'Name is required';
    if (formData.name.trim().length < 2) return 'Name must be at least 2 characters';
    if (!/^[a-zA-Z\s\-']+$/.test(formData.name.trim())) return 'Name can only contain letters, spaces, hyphens';

    if (formData.contactPhone && !/^\d{10}$/.test(formData.contactPhone.trim())) return 'Contact phone must be 10 digits';
    
    // Check if adding default address through profile directly
    if (formData.addressLine1 || formData.pincode || formData.city) {
      if (!formData.addressLine1.trim()) return 'Address Line 1 is required';
      if (!formData.city.trim()) return 'City is required';
      if (!formData.area.trim()) return 'Area is required';
      if (!/^\d{6}$/.test(formData.pincode.trim())) return 'Pincode must be exactly 6 digits';
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
      const response = await apiFetch('/api/user/profile', {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setIsEditing(false);
        setSuccess('Profile saved successfully!');
        setTimeout(() => setSuccess(''), 3000);
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
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: async () => {
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
    <ScrollView className="flex-1 bg-[#f3f7fb]" contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      
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
        <View className="flex-1 justify-center bg-black/50 p-4">
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
                  className={`flex-row items-center p-2 rounded border ${refundMethod === type ? 'border-[#0ea5e9] bg-blue-50' : 'border-gray-200'}`}
                >
                  <View className={`w-4 h-4 rounded-full border mr-2 items-center justify-center ${refundMethod === type ? 'border-[#0ea5e9]' : 'border-gray-300'}`}>
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
                {isRefundSubmitting ? <ActivityIndicator color="white" /> : <Text className="font-bold text-white">Submit</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View className="items-center mb-6 mt-2">
        <View className="w-24 h-24 bg-blue-100 rounded-full items-center justify-center mb-4">
          <User size={48} color="#0ea5e9" />
        </View>
        {!isEditing ? (
          <View className="items-center">
            <View className="flex-row items-center justify-center mb-1">
              <Text className="text-2xl font-bold text-black mr-2">{formData.name || 'Set Name'}</Text>
              <TouchableOpacity onPress={() => setIsEditing(true)} className="p-2 bg-gray-100 rounded-full">
                <Pencil size={14} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <Text className="text-gray-500">{phoneNumber}</Text>
            {customerId && (
              <TouchableOpacity onPress={handleCopyId} className="mt-2 flex-row items-center bg-gray-100 px-3 py-1 rounded-full">
                <Text className="text-xs font-mono font-bold text-gray-500 tracking-widest">#{customerId.slice(-8).toUpperCase()}</Text>
                <Copy size={12} color="#6b7280" className="ml-2" />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <Text className="text-xl font-bold text-black mb-2">Edit Profile</Text>
        )}
      </View>

      {/* ─── Stats Dashboard ───────────────────────────────────────────── */}
      {!isEditing && (
        <View className="flex-row gap-4 mb-6">
          <View className="flex-1 bg-blue-50/50 border border-blue-100 p-4 rounded-2xl items-center">
            <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center mb-2">
              <Wallet size={20} color="#0ea5e9" />
            </View>
            <Text className="text-xl font-bold text-[#0ea5e9]">₹{Math.ceil(depositWalletBalance)}</Text>
            <Text className="text-[10px] uppercase font-bold text-gray-500 mt-1 text-center">Deposit Paid</Text>
          </View>
          
          <View className="flex-1 bg-orange-50/50 border border-orange-100 p-4 rounded-2xl items-center">
            <View className="w-10 h-10 bg-orange-100 rounded-full items-center justify-center mb-2">
              <ShoppingBag size={20} color="#ea580c" />
            </View>
            <Text className="text-xl font-bold text-orange-600">{cansInHand}</Text>
            <Text className="text-[10px] uppercase font-bold text-gray-500 mt-1 text-center">Empty Cans in Hand</Text>
          </View>
        </View>
      )}

      {error ? (
        <View className="bg-red-50 p-3 rounded-md border border-red-200 mb-4 flex-row items-center">
          <AlertCircle size={20} color="#dc2626" className="mr-2" />
          <Text className="text-red-700">{error}</Text>
        </View>
      ) : null}
      
      {success ? (
        <View className="bg-green-50 p-3 rounded-md border border-green-200 mb-4 flex-row items-center">
          <CheckCircle2 size={20} color="#16a34a" className="mr-2" />
          <Text className="text-green-700">{success}</Text>
        </View>
      ) : null}

      {!isEditing && (
        <View className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
          <TouchableOpacity onPress={() => setShowAddressesModal(true)} className="flex-row items-center justify-between p-4 border-b border-gray-100">
            <View className="flex-row items-center">
              <View className="w-10 h-10 bg-blue-50 rounded-full items-center justify-center mr-3"><MapPin size={20} color="#0ea5e9" /></View>
              <Text className="font-semibold text-black">My Addresses</Text>
            </View>
            <ChevronRight size={20} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setShowPaymentsModal(true)} className="flex-row items-center justify-between p-4 border-b border-gray-100">
            <View className="flex-row items-center">
              <View className="w-10 h-10 bg-green-50 rounded-full items-center justify-center mr-3"><CreditCard size={20} color="#16a34a" /></View>
              <Text className="font-semibold text-black">Payment Methods</Text>
            </View>
            <ChevronRight size={20} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/(tabs)/orders')} className="flex-row items-center justify-between p-4 border-b border-gray-100">
            <View className="flex-row items-center">
              <View className="w-10 h-10 bg-purple-50 rounded-full items-center justify-center mr-3"><History size={20} color="#9333ea" /></View>
              <Text className="font-semibold text-black">Order History</Text>
            </View>
            <ChevronRight size={20} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setShowRefundModal(true)} className="flex-row items-center justify-between p-4 border-b border-gray-100">
            <View className="flex-row items-center">
              <View className="w-10 h-10 bg-orange-50 rounded-full items-center justify-center mr-3"><Wallet size={20} color="#ea580c" /></View>
              <View>
                <Text className="font-semibold text-black">Request Refund</Text>
                <Text className="text-[10px] text-gray-500 uppercase font-medium">Return empty cans</Text>
              </View>
            </View>
            <ChevronRight size={20} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setShowSupportModal(true)} className="flex-row items-center justify-between p-4">
            <View className="flex-row items-center">
              <View className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center mr-3"><AlertCircle size={20} color="#4b5563" /></View>
              <Text className="font-semibold text-black">Support & Help</Text>
            </View>
            <ChevronRight size={20} color="#9ca3af" />
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
          <View>
            <Text className="text-sm font-semibold text-gray-500 mb-1">Full Name *</Text>
            <TextInput 
              value={formData.name}
              onChangeText={(text) => { setFormData({...formData, name: text}); setError(''); }}
              className="border border-gray-300 rounded-md p-3 text-black bg-white"
              placeholder="Enter your name"
            />
          </View>
          
          <View>
            <Text className="text-sm font-semibold text-gray-500 mb-1">Contact Phone</Text>
            <TextInput 
              value={formData.contactPhone}
              editable={false}
              className="border border-gray-200 rounded-md p-3 text-gray-500 bg-gray-50"
            />
            <Text className="text-xs text-gray-400 mt-1">Phone number cannot be changed.</Text>
          </View>

          <View className="flex-row gap-3 pt-4 mt-2 border-t border-gray-100">
            <TouchableOpacity 
              onPress={() => { setIsEditing(false); loadProfile(); setError(''); }}
              className="flex-1 py-3 border border-gray-300 rounded-md items-center"
            >
              <Text className="font-bold text-gray-700">Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={handleSave}
              disabled={isSaving}
              className={`flex-1 py-3 rounded-md items-center flex-row justify-center ${isSaving ? 'bg-sky-300' : 'bg-[#0ea5e9]'}`}
            >
              {isSaving ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-lg">Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!isEditing && (
        <View className="mb-8">
          <TouchableOpacity 
            onPress={handleLogout}
            className="bg-red-50 py-4 rounded-xl border border-red-200 items-center flex-row justify-center mb-6"
          >
            <LogOut size={20} color="#ef4444" className="mr-2" />
            <Text className="text-red-600 font-bold text-lg">Log Out</Text>
          </TouchableOpacity>
          
          <View className="items-center justify-center py-4">
            <Text className="text-xs text-gray-400">Powered by</Text>
            <TouchableOpacity onPress={() => Linking.openURL('https://www.stedaxis.com')}>
              <Text className="text-sm font-bold text-gray-500 mt-1">STEDAXIS</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ─── Addresses Modal ───────────────────────────────────────────── */}
      <Modal visible={showAddressesModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleCloseAddresses}>
        <View className="flex-1 bg-[#f3f7fb]">
          <View className="flex-row justify-between items-center p-4 border-b border-gray-200 bg-white">
            <Text className="text-lg font-bold text-black">My Addresses</Text>
            <TouchableOpacity onPress={handleCloseAddresses} className="w-8 h-8 items-center justify-center rounded-full bg-gray-100">
              <X size={20} color="#000" />
            </TouchableOpacity>
          </View>
          <ScrollView className="flex-1 p-4" keyboardShouldPersistTaps="handled">
            <AddressesManager addresses={addresses} onRefresh={loadProfile} setAddresses={setAddresses} />
            <View className="h-10" />
          </ScrollView>
        </View>
      </Modal>

      {/* ─── Payment Methods Modal ─────────────────────────────────────── */}
      <Modal visible={showPaymentsModal} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-[#f3f7fb]">
          <View className="flex-row justify-between items-center p-4 border-b border-gray-200 bg-white">
            <Text className="text-lg font-bold text-black">Payment Methods</Text>
            <TouchableOpacity onPress={() => setShowPaymentsModal(false)} className="w-8 h-8 items-center justify-center rounded-full bg-gray-100">
              <X size={20} color="#000" />
            </TouchableOpacity>
          </View>
          <ScrollView className="flex-1 p-4 space-y-4" keyboardShouldPersistTaps="handled">
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
          </ScrollView>
        </View>
      </Modal>

    </ScrollView>
  );
}
