import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { MapPin } from 'lucide-react-native';
import MapPicker from './MapPicker';

export default function AddressForm({ formData, onChange, errors, showDefaultToggle }) {
  const [showMap, setShowMap] = useState(false);

  const handleLocationSelect = (data) => {
    if (data.coordinates) {
      onChange('location', {
        type: 'Point',
        coordinates: [data.coordinates.longitude, data.coordinates.latitude]
      });
    }
    
    if (data.addressInfo) {
      if (data.addressInfo.name) onChange('addressLine1', data.addressInfo.name);
      if (data.addressInfo.street) onChange('addressLine2', data.addressInfo.street);
      if (data.addressInfo.city) onChange('city', data.addressInfo.city);
      if (data.addressInfo.postalCode) onChange('pincode', data.addressInfo.postalCode);
      if (data.addressInfo.district || data.addressInfo.subregion) {
        onChange('area', data.addressInfo.district || data.addressInfo.subregion);
      }
    }
  };

  return (
    <View className="space-y-4 w-full">
      {/* Map Picker Button */}
      <TouchableOpacity 
        className="w-full bg-blue-50 border border-[#0ea5e9] p-4 rounded-xl flex-row items-center justify-center mb-2"
        onPress={() => setShowMap(true)}
      >
        <MapPin size={20} color="#0ea5e9" className="mr-2" />
        <Text className="text-[#0ea5e9] font-bold text-base">
          {formData.location?.coordinates ? 'Update Location on Map' : 'Select Location on Map'}
        </Text>
      </TouchableOpacity>

      {formData.location?.coordinates && (
        <Text className="text-xs text-green-600 font-medium text-center mb-2">
          ✓ Location coordinates saved
        </Text>
      )}

      <MapPicker 
        visible={showMap}
        onClose={() => setShowMap(false)}
        onLocationSelect={handleLocationSelect}
        initialLocation={
          formData.location?.coordinates 
            ? { 
                latitude: formData.location.coordinates[1], 
                longitude: formData.location.coordinates[0] 
              } 
            : null
        }
      />

      <View>
        <Text className="text-sm font-semibold text-gray-700 mb-1">Nickname (e.g. Home, Work)</Text>
        <TextInput
          className={`bg-white border rounded-lg px-4 py-3 text-black ${errors?.nickname ? 'border-red-500' : 'border-gray-200'}`}
          placeholder="Home"
          value={formData.nickname}
          onChangeText={(text) => onChange('nickname', text)}
        />
      </View>

      <View>
        <Text className="text-sm font-semibold text-gray-700 mb-1">Contact Name *</Text>
        <TextInput
          className={`bg-white border rounded-lg px-4 py-3 text-black ${errors?.contactName ? 'border-red-500' : 'border-gray-200'}`}
          placeholder="John Doe"
          value={formData.contactName}
          onChangeText={(text) => onChange('contactName', text)}
        />
      </View>

      <View>
        <Text className="text-sm font-semibold text-gray-700 mb-1">Contact Phone *</Text>
        <TextInput
          className={`bg-white border rounded-lg px-4 py-3 text-black ${errors?.contactPhone ? 'border-red-500' : 'border-gray-200'}`}
          placeholder="10-digit number"
          keyboardType="phone-pad"
          maxLength={10}
          value={formData.contactPhone}
          onChangeText={(text) => onChange('contactPhone', text)}
        />
        {errors?.contactPhone && <Text className="text-xs text-red-500 mt-1">{errors.contactPhone}</Text>}
      </View>

      <View>
        <Text className="text-sm font-semibold text-gray-700 mb-1">Address Line 1 *</Text>
        <TextInput
          className={`bg-white border rounded-lg px-4 py-3 text-black ${errors?.addressLine1 ? 'border-red-500' : 'border-gray-200'}`}
          placeholder="House/Flat No., Building Name"
          value={formData.addressLine1}
          onChangeText={(text) => onChange('addressLine1', text)}
        />
        {errors?.addressLine1 && <Text className="text-xs text-red-500 mt-1">{errors.addressLine1}</Text>}
      </View>

      <View>
        <Text className="text-sm font-semibold text-gray-700 mb-1">Address Line 2</Text>
        <TextInput
          className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-black"
          placeholder="Street Name, Locality"
          value={formData.addressLine2}
          onChangeText={(text) => onChange('addressLine2', text)}
        />
      </View>

      <View className="flex-row gap-4">
        <View className="flex-1">
          <Text className="text-sm font-semibold text-gray-700 mb-1">City *</Text>
          <TextInput
            className={`bg-white border rounded-lg px-4 py-3 text-black ${errors?.city ? 'border-red-500' : 'border-gray-200'}`}
            placeholder="Coimbatore"
            value={formData.city}
            onChangeText={(text) => onChange('city', text)}
          />
          {errors?.city && <Text className="text-xs text-red-500 mt-1">{errors.city}</Text>}
        </View>

        <View className="flex-1">
          <Text className="text-sm font-semibold text-gray-700 mb-1">Pincode *</Text>
          <TextInput
            className={`bg-white border rounded-lg px-4 py-3 text-black ${errors?.pincode ? 'border-red-500' : 'border-gray-200'}`}
            placeholder="641001"
            keyboardType="numeric"
            maxLength={6}
            value={formData.pincode}
            onChangeText={(text) => onChange('pincode', text)}
          />
          {errors?.pincode && <Text className="text-xs text-red-500 mt-1">{errors.pincode}</Text>}
        </View>
      </View>

      <View>
        <Text className="text-sm font-semibold text-gray-700 mb-1">Area / Neighborhood *</Text>
        <TextInput
          className={`bg-white border rounded-lg px-4 py-3 text-black ${errors?.area ? 'border-red-500' : 'border-gray-200'}`}
          placeholder="Peelamedu"
          value={formData.area}
          onChangeText={(text) => onChange('area', text)}
        />
        {errors?.area && <Text className="text-xs text-red-500 mt-1">{errors.area}</Text>}
      </View>

      <View>
        <Text className="text-sm font-semibold text-gray-700 mb-1">Landmark (Optional)</Text>
        <TextInput
          className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-black"
          placeholder="Near central park"
          value={formData.landmark}
          onChangeText={(text) => onChange('landmark', text)}
        />
      </View>

      {showDefaultToggle && (
        <TouchableOpacity 
          className="flex-row items-center mt-2"
          onPress={() => onChange('isDefault', !formData.isDefault)}
        >
          <View className={`w-5 h-5 rounded border ${formData.isDefault ? 'bg-[#0ea5e9] border-[#0ea5e9]' : 'border-gray-300 bg-white'} items-center justify-center mr-2`}>
            {formData.isDefault && <Text className="text-white text-xs font-bold">✓</Text>}
          </View>
          <Text className="text-gray-700 font-medium">Set as default address</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
