import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, ActivityIndicator, Alert } from 'react-native';
import { MapPin, Plus, Pencil, Trash2, Star, X } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import AddressForm from './AddressForm';
import { apiFetch } from '../lib/api';

const initialFormState = {
  nickname: '',
  contactName: '',
  contactPhone: '',
  addressLine1: '',
  addressLine2: '',
  area: '',
  city: '',
  pincode: '',
  landmark: '',
  isDefault: false
};

export default function AddressesManager({ addresses, onRefresh, setAddresses }) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState(initialFormState);
  const [errors, setErrors] = useState({});

  const handleAddNew = () => {
    setEditingAddress(null);
    setFormData(initialFormState);
    setErrors({});
    setIsFormOpen(true);
  };

  const handleEdit = (addr) => {
    setEditingAddress(addr);
    setFormData({
      nickname: addr.nickname || '',
      contactName: addr.contactName || '',
      contactPhone: addr.contactPhone || '',
      addressLine1: addr.line1 || '',
      addressLine2: addr.line2 || '',
      area: addr.area || '',
      city: addr.city || '',
      pincode: addr.pincode || '',
      landmark: addr.landmark || '',
      isDefault: addr.isDefault || false
    });
    setErrors({});
    setIsFormOpen(true);
  };

  const handleDelete = (id) => {
    Alert.alert('Delete Address', 'Are you sure you want to remove this location?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive',
        onPress: async () => {
          const prevAddresses = [...addresses];
          if (setAddresses) {
            setAddresses(addresses.filter(a => a.id !== id));
          }
          try {
            const res = await apiFetch(`/api/user/addresses/${id}`, { method: 'DELETE' });
            if (!res.ok) {
              const errorData = await res.json().catch(() => ({}));
              throw new Error(errorData.message || 'Failed to delete address');
            }
            onRefresh();
          } catch (error) {
            if (setAddresses) setAddresses(prevAddresses);
            Toast.show({ type: 'error', text1: 'Error', text2: error.message || 'Failed to delete address' });
          }
        }
      }
    ]);
  };

  const handleSetDefault = async (addr) => {
    Alert.alert('Set as Default', 'Use this address automatically for future orders?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Set Default', 
        onPress: async () => {
          const prevAddresses = [...addresses];
          if (setAddresses) {
            setAddresses(addresses.map(a => ({ ...a, isDefault: a.id === addr.id })));
          }
          try {
            const res = await apiFetch(`/api/user/addresses/${addr.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ ...addr, isDefault: true })
            });
            if (!res.ok) {
              const errorData = await res.json().catch(() => ({}));
              throw new Error(errorData.message || 'Failed to update default address');
            }
            onRefresh();
          } catch (error) {
            if (setAddresses) setAddresses(prevAddresses);
            Toast.show({ type: 'error', text1: 'Error', text2: error.message || 'Failed to update default address' });
          }
        }
      }
    ]);
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.addressLine1?.trim()) newErrors.addressLine1 = 'Required';
    if (!formData.area?.trim()) newErrors.area = 'Required';
    if (!formData.city?.trim()) newErrors.city = 'Required';
    if (!formData.pincode?.trim()) newErrors.pincode = 'Required';
    if (!formData.contactPhone || formData.contactPhone.length !== 10) {
      newErrors.contactPhone = 'Valid 10-digit number required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setIsSubmitting(true);
    
    try {
      const payload = {
        nickname: formData.nickname,
        contactName: formData.contactName,
        contactPhone: formData.contactPhone,
        line1: formData.addressLine1,
        line2: formData.addressLine2,
        area: formData.area,
        city: formData.city,
        pincode: formData.pincode,
        landmark: formData.landmark,
        isDefault: formData.isDefault
      };

      const url = editingAddress ? `/api/user/addresses/${editingAddress.id}` : '/api/user/addresses';
      const method = editingAddress ? 'PATCH' : 'POST';

      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to save address');
      }

      await onRefresh();
      setIsFormOpen(false);
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.message || 'Failed to save address' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View className="space-y-4">
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center">
          <View className="w-8 h-8 rounded-full bg-sky-100 items-center justify-center mr-2">
            <MapPin size={16} color="#0ea5e9" />
          </View>
          <View>
            <Text className="text-lg font-bold text-black">Saved Addresses</Text>
            <Text className="text-xs text-gray-500">Manage your delivery locations</Text>
          </View>
        </View>
        <TouchableOpacity 
          onPress={handleAddNew}
          className="flex-row items-center bg-white border border-gray-200 px-3 py-1.5 rounded-full shadow-sm"
        >
          <Plus size={14} color="#0ea5e9" className="mr-1" />
          <Text className="text-sm font-semibold text-[#0ea5e9]">Add New</Text>
        </TouchableOpacity>
      </View>

      {addresses.map((addr) => (
        <View key={addr.id} className={`p-4 rounded-2xl border ${addr.isDefault ? 'border-[#0ea5e9] bg-sky-50' : 'border-gray-200 bg-white'} mb-3`}>
          <View className="flex-row justify-between items-start mb-2">
            <View className="flex-row items-center">
              <View className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${addr.isDefault ? 'bg-[#0ea5e9]' : 'bg-gray-100'}`}>
                <MapPin size={16} color={addr.isDefault ? 'white' : '#6b7280'} />
              </View>
              <View>
                <Text className="font-bold text-base text-black">{addr.nickname || (addr.isDefault ? 'Home' : 'Other')}</Text>
                {addr.isDefault ? (
                  <Text className="text-[10px] font-bold text-green-600 uppercase tracking-widest mt-0.5">Default Address</Text>
                ) : (
                  <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">Saved Address</Text>
                )}
              </View>
            </View>

            <View className="flex-row gap-2">
              {!addr.isDefault && (
                <TouchableOpacity onPress={() => handleSetDefault(addr)} className="w-8 h-8 items-center justify-center rounded-full bg-yellow-50">
                  <Star size={14} color="#eab308" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => handleEdit(addr)} className="w-8 h-8 items-center justify-center rounded-full bg-gray-50">
                <Pencil size={14} color="#6b7280" />
              </TouchableOpacity>
              {!addr.isDefault && (
                <TouchableOpacity onPress={() => handleDelete(addr.id)} className="w-8 h-8 items-center justify-center rounded-full bg-red-50">
                  <Trash2 size={14} color="#ef4444" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <Text className="text-sm font-semibold text-black mt-2">{addr.line1}</Text>
          {addr.line2 ? <Text className="text-sm text-gray-700">{addr.line2}</Text> : null}
          <Text className="text-xs font-medium text-gray-500 mt-1">{addr.area} • {addr.city} • {addr.pincode}</Text>
          
          <View className="mt-3 pt-3 border-t border-gray-200 flex-row justify-between items-end">
            <View>
              <Text className="text-[10px] uppercase font-bold text-gray-400">Deliver To</Text>
              <Text className="text-sm font-bold text-black">{addr.contactName || 'No Name'}</Text>
              <Text className="text-[11px] font-bold text-[#0ea5e9]">{addr.contactPhone || 'No Phone'}</Text>
            </View>
          </View>
        </View>
      ))}

      {addresses.length === 0 && (
        <View className="py-10 items-center justify-center border border-dashed border-gray-300 rounded-2xl bg-gray-50 mt-4">
          <MapPin size={32} color="#9ca3af" className="mb-2" />
          <Text className="font-bold text-black">No saved addresses</Text>
          <Text className="text-xs text-gray-500 mt-1">Add a location to start ordering.</Text>
        </View>
      )}

      <Modal visible={isFormOpen} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-white">
          <View className="flex-row justify-between items-center p-4 border-b border-gray-100">
            <Text className="text-lg font-bold text-black">{editingAddress ? 'Edit Address' : 'Add New Address'}</Text>
            <TouchableOpacity onPress={() => setIsFormOpen(false)} className="w-8 h-8 items-center justify-center rounded-full bg-gray-100">
              <X size={20} color="#000" />
            </TouchableOpacity>
          </View>
          
          <ScrollView className="flex-1 p-4" keyboardShouldPersistTaps="handled">
            <AddressForm 
              formData={formData} 
              onChange={(field, value) => {
                setFormData(prev => ({ ...prev, [field]: value }));
                if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
              }} 
              errors={errors} 
              showDefaultToggle={true} 
            />
            <View className="h-20" />
          </ScrollView>

          <View className="p-4 border-t border-gray-100 bg-white">
            <TouchableOpacity 
              onPress={handleSave} 
              disabled={isSubmitting}
              className={`w-full py-4 rounded-xl items-center justify-center ${isSubmitting ? 'bg-sky-300' : 'bg-[#0ea5e9]'}`}
            >
              {isSubmitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold text-base">Save Address</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
