import { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { MapPin, Plus, CheckCircle2, ChevronRight, X } from 'lucide-react-native';
import AddressForm from './AddressForm';
import { apiFetch } from '../lib/api';

export default function AddressSelector({ addresses, selectedAddressId, onSelect, onAddressAdded }) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({
    nickname: '', contactName: '', contactPhone: '', addressLine1: '',
    addressLine2: '', area: '', city: '', pincode: '', landmark: '', isDefault: false
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedAddress = addresses.find(a => a.id === selectedAddressId);

  const handleAddNew = () => {
    setFormData({
      nickname: '', contactName: '', contactPhone: '', addressLine1: '',
      addressLine2: '', area: '', city: '', pincode: '', landmark: '', isDefault: false
    });
    setErrors({});
    setIsFormOpen(true);
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
        nickname: formData.nickname, contactName: formData.contactName,
        contactPhone: formData.contactPhone, line1: formData.addressLine1,
        line2: formData.addressLine2, area: formData.area, city: formData.city,
        pincode: formData.pincode, landmark: formData.landmark, isDefault: formData.isDefault
      };

      const res = await apiFetch('/api/user/addresses', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      setIsFormOpen(false);
      if (onAddressAdded) {
        onAddressAdded();
      }
      if (data.address && onSelect) {
        onSelect(data.address.id);
      }
    } catch (error) {
      console.error('Failed to save address');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View className="mb-6">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-lg font-bold text-black">Delivery Address</Text>
        <TouchableOpacity onPress={handleAddNew}>
          <Text className="text-[#0ea5e9] font-semibold text-sm">+ Add New</Text>
        </TouchableOpacity>
      </View>

      {addresses.length === 0 ? (
        <TouchableOpacity 
          onPress={handleAddNew}
          className="border-2 border-dashed border-sky-200 rounded-xl p-6 items-center bg-sky-50 justify-center"
        >
          <MapPin size={24} color="#0ea5e9" className="mb-2" />
          <Text className="font-semibold text-black">No Addresses Saved</Text>
          <Text className="text-gray-500 text-xs mt-1">Tap to add your delivery location</Text>
        </TouchableOpacity>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="pb-2">
          {addresses.map(addr => {
            const isSelected = selectedAddressId === addr.id;
            return (
              <TouchableOpacity
                key={addr.id}
                onPress={() => onSelect(addr.id)}
                className={`w-64 p-4 rounded-xl border mr-3 ${isSelected ? 'border-[#0ea5e9] bg-sky-50' : 'border-gray-200 bg-white'}`}
              >
                <View className="flex-row justify-between items-start mb-2">
                  <View className="flex-row items-center">
                    <MapPin size={16} color={isSelected ? '#0ea5e9' : '#6b7280'} className="mr-1.5" />
                    <Text className="font-bold text-black">{addr.nickname || (addr.isDefault ? 'Home' : 'Other')}</Text>
                  </View>
                  {isSelected && <CheckCircle2 size={18} color="#0ea5e9" />}
                </View>

                <Text className="text-sm font-semibold text-black mt-1" numberOfLines={1}>{addr.line1}</Text>
                <Text className="text-xs text-gray-500 mt-1" numberOfLines={1}>{addr.area}, {addr.city}</Text>
                
                <Text className="text-[10px] text-gray-400 font-bold mt-2 pt-2 border-t border-gray-100">
                  {addr.contactName} • {addr.contactPhone}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <Modal visible={isFormOpen} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-white">
          <View className="flex-row justify-between items-center p-4 border-b border-gray-100">
            <Text className="text-lg font-bold text-black">Add New Address</Text>
            <TouchableOpacity onPress={() => setIsFormOpen(false)} className="w-8 h-8 items-center justify-center rounded-full bg-gray-100">
              <X size={20} color="#000" />
            </TouchableOpacity>
          </View>
          
          <ScrollView className="flex-1 p-4">
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
              <Text className="text-white font-bold text-base">{isSubmitting ? 'Saving...' : 'Save Address'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
