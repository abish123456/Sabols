import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import Toast from 'react-native-toast-message';
import { Minus, Plus, RefreshCcw } from 'lucide-react-native';
import { apiFetch } from '../lib/api';

export default function ReturnSelector({ cansInHand = 0, onReturnRequested }) {
  const [quantity, setQuantity] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDecrement = () => {
    if (quantity > 0) setQuantity(quantity - 1);
  };

  const handleIncrement = () => {
    if (quantity < cansInHand) setQuantity(quantity + 1);
  };

  const handleSubmit = async () => {
    if (quantity <= 0) return;
    setIsSubmitting(true);
    try {
      const response = await apiFetch('/api/user/return-request', {
        method: 'POST',
        body: JSON.stringify({ quantity })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        Toast.show({ type: 'success', text1: 'Success', text2: 'Return request submitted successfully.' });
        setQuantity(0);
        if (onReturnRequested) onReturnRequested();
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: data.message || 'Failed to submit return request.' });
      }
    } catch (error) {
      console.error('Return request error:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Network error while submitting request.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (cansInHand <= 0) {
    return null; // Nothing to return
  }

  return (
    <View className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4 mt-4">
      <View className="flex-row items-center mb-4">
        <RefreshCcw size={20} color="#0ea5e9" className="mr-2" />
        <Text className="text-lg font-bold text-black">Return Empty Cans</Text>
      </View>
      <Text className="text-gray-500 text-sm mb-4">
        You have {cansInHand} cans in hand. Select how many you want to return.
      </Text>

      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center border border-gray-300 rounded-lg p-1 bg-gray-50">
          <TouchableOpacity 
            onPress={handleDecrement}
            disabled={quantity <= 0}
            className={`w-10 h-10 items-center justify-center rounded-md ${quantity <= 0 ? 'opacity-50' : 'bg-gray-200'}`}
          >
            <Minus size={20} color="#374151" />
          </TouchableOpacity>
          
          <Text className="w-12 text-center text-lg font-bold text-black">{quantity}</Text>

          <TouchableOpacity 
            onPress={handleIncrement}
            disabled={quantity >= cansInHand}
            className={`w-10 h-10 items-center justify-center rounded-md ${quantity >= cansInHand ? 'opacity-50' : 'bg-gray-200'}`}
          >
            <Plus size={20} color="#374151" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          onPress={handleSubmit}
          disabled={quantity <= 0 || isSubmitting}
          className={`px-6 py-3 rounded-lg ${quantity <= 0 || isSubmitting ? 'bg-sky-300' : 'bg-[#0ea5e9]'}`}
        >
          {isSubmitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-bold">Request Return</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
