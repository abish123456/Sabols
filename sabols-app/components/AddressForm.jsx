import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { MapPin, Search, ChevronDown, X } from 'lucide-react-native';
import MapPicker from './MapPicker';
import { apiFetch } from '../lib/api';

export default function AddressForm({ formData, onChange, errors, showDefaultToggle }) {
  const [detectedAddress, setDetectedAddress] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [serviceAreas, setServiceAreas] = useState([]);
  const [showPincodeDropdown, setShowPincodeDropdown] = useState(false);
  const [searchPincode, setSearchPincode] = useState('');

  const nicknameRef = useRef(null);
  const contactNameRef = useRef(null);
  const contactPhoneRef = useRef(null);
  const addressLine1Ref = useRef(null);
  const addressLine2Ref = useRef(null);
  const cityRef = useRef(null);
  const landmarkRef = useRef(null);
  const areaRef = useRef(null);

  useEffect(() => {
    if (errors && Object.keys(errors).length > 0) {
      if (errors.contactPhone && contactPhoneRef.current) contactPhoneRef.current.focus();
      else if (errors.addressLine1 && addressLine1Ref.current) addressLine1Ref.current.focus();
      else if (errors.city && cityRef.current) cityRef.current.focus();
      else if (errors.area && areaRef.current) areaRef.current.focus();
      else if (errors.nickname && nicknameRef.current) nicknameRef.current.focus();
    }
  }, [errors]);

  useEffect(() => {
    const fetchServiceAreas = async () => {
      try {
        const response = await apiFetch('/api/service-areas');
        const data = await response.json();
        if (data.success && data.serviceAreas) {
          setServiceAreas(data.serviceAreas);
        }
      } catch (err) {
        console.error('Error fetching service areas:', err);
      }
    };
    fetchServiceAreas();
  }, []);

  const handlePincodeSelect = (area) => {
    onChange('pincode', area.pincode);
    onChange('area', area.areaName);
    if (!formData.city) {
      onChange('city', 'Coimbatore');
    }
    setShowPincodeDropdown(false);
    setSearchPincode('');
  };

  const filteredAreas = serviceAreas.filter(a => a.pincode.includes(searchPincode) || a.areaName.toLowerCase().includes(searchPincode.toLowerCase()));

  const fetchCoordinateAddress = async (lat, lng) => {
    setIsGeocoding(true);
    try {
      const response = await apiFetch(`/api/geocode?lat=${lat}&lon=${lng}`);
      const data = await response.json();
      
      if (data && data.display_name) {
        setDetectedAddress(data.display_name);
        
        // Auto-fill pincode if available
        if (data.address && data.address.postcode && !formData.pincode) {
          onChange('pincode', data.address.postcode);
        }
      } else {
        setDetectedAddress('');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleLocationSelect = React.useCallback((data) => {
    if (data.coordinates) {
      const lat = data.coordinates.latitude || data.coordinates[1];
      const lng = data.coordinates.longitude || data.coordinates[0];
      
      onChange('location', {
        type: 'Point',
        coordinates: [lng, lat]
      });
      
      fetchCoordinateAddress(lat, lng);
    }
  }, [onChange]);

  const initialMapLocation = React.useMemo(() => {
    return formData.location?.coordinates 
      ? { 
          latitude: formData.location.coordinates[1] || formData.location.coordinates.latitude, 
          longitude: formData.location.coordinates[0] || formData.location.coordinates.longitude
        } 
      : null;
  }, [formData.location?.coordinates]);

  return (
    <View className="space-y-4 w-full">
      <Modal
        visible={showPincodeDropdown}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPincodeDropdown(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 justify-end bg-black/50"
        >
          <View className="bg-white h-[85%] rounded-t-3xl overflow-hidden shadow-xl">
            <View className="flex-row justify-between items-center p-5 border-b border-gray-100 bg-white">
              <Text className="text-xl font-black text-black">Select Pincode</Text>
              <TouchableOpacity onPress={() => setShowPincodeDropdown(false)} className="p-2 bg-gray-100 rounded-full">
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <View className="p-4 border-b border-gray-100 bg-white">
              <View className="flex-row items-center bg-gray-100 rounded-2xl px-4 py-3">
                <Search size={20} color="#9ca3af" style={{ marginRight: 8 }} />
                <TextInput
                  className="flex-1 text-black font-medium text-base"
                  placeholder="Search by pincode or area..."
                  value={searchPincode}
                  onChangeText={setSearchPincode}
                  autoFocus={true}
                  autoComplete="off"
                  autoCorrect={false}
                  importantForAutofill="no"
                  textContentType="none"
                />
              </View>
            </View>
            <ScrollView className="flex-1 bg-gray-50" nestedScrollEnabled={true}>
              {serviceAreas.length === 0 ? (
                <View className="py-12 items-center justify-center">
                  <ActivityIndicator size="large" color="#0ea5e9" />
                  <Text className="text-gray-500 mt-4 font-medium">Loading service areas...</Text>
                </View>
              ) : filteredAreas.length === 0 ? (
                <View className="py-12 items-center justify-center px-6">
                  <View className="w-16 h-16 bg-gray-200 rounded-full items-center justify-center mb-4">
                    <Search size={24} color="#9ca3af" />
                  </View>
                  <Text className="text-lg font-bold text-gray-700 text-center mb-1">No areas found</Text>
                  <Text className="text-gray-500 text-center text-sm">We couldn't find any service area matching "{searchPincode}".</Text>
                </View>
              ) : (
                filteredAreas.map((area) => (
                  <TouchableOpacity
                    key={area.pincode}
                    className="flex-row items-center p-4 border-b border-gray-200 bg-white active:bg-blue-50"
                    onPress={() => handlePincodeSelect(area)}
                  >
                    <View className="w-10 h-10 bg-blue-50 rounded-full items-center justify-center mr-4">
                      <MapPin size={18} color="#0ea5e9" />
                    </View>
                    <View className="flex-1">
                      <Text className="font-black text-base text-black mb-0.5">{area.pincode}</Text>
                      <Text className="text-sm text-gray-500 font-medium">{area.areaName}</Text>
                    </View>
                    <ChevronDown size={20} color="#d1d5db" style={{ transform: [{ rotate: '-90deg' }] }} />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <View>
        <Text className="text-sm font-semibold text-gray-700 mb-1">Address Nickname (Optional)</Text>
        <TextInput
          ref={nicknameRef}
          className={`bg-white border rounded-lg px-4 py-3 text-black ${errors?.nickname ? 'border-red-500' : 'border-gray-200'}`}
          placeholder="Home / Office / Other"
          value={formData.nickname}
          onChangeText={(text) => onChange('nickname', text)}
        />
      </View>

      <View className="flex-row gap-4">
        <View className="flex-1">
          <Text className="text-sm font-semibold text-gray-700 mb-1">Contact Person (Optional)</Text>
          <TextInput
            ref={contactNameRef}
            className={`bg-white border rounded-lg px-4 py-3 text-black ${errors?.contactName ? 'border-red-500' : 'border-gray-200'}`}
            placeholder="Recipient Name"
            value={formData.contactName}
            onChangeText={(text) => onChange('contactName', text)}
          />
        </View>

        <View className="flex-1">
          <Text className="text-sm font-semibold text-gray-700 mb-1">Contact Phone *</Text>
          <TextInput
            ref={contactPhoneRef}
            className={`bg-white border rounded-lg px-4 py-3 text-black ${errors?.contactPhone ? 'border-red-500' : 'border-gray-200'}`}
            placeholder="10-digit Number"
            keyboardType="phone-pad"
            maxLength={10}
            value={formData.contactPhone}
            onChangeText={(text) => onChange('contactPhone', text)}
          />
          {errors?.contactPhone && <Text className="text-xs text-red-500 mt-1">{errors.contactPhone}</Text>}
        </View>
      </View>

      <View>
        <Text className="text-sm font-semibold text-gray-700 mb-1">Address Line 1 *</Text>
        <TextInput
          ref={addressLine1Ref}
          className={`bg-white border rounded-lg px-4 py-3 text-black ${errors?.addressLine1 ? 'border-red-500' : 'border-gray-200'}`}
          placeholder="House/Flat No., Building Name"
          value={formData.addressLine1}
          onChangeText={(text) => onChange('addressLine1', text)}
        />
        {errors?.addressLine1 && <Text className="text-xs text-red-500 mt-1">{errors.addressLine1}</Text>}
      </View>

      <View>
        <Text className="text-sm font-semibold text-gray-700 mb-1">Address Line 2 (Optional)</Text>
        <TextInput
          ref={addressLine2Ref}
          className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-black"
          placeholder="Street, Road name"
          value={formData.addressLine2}
          onChangeText={(text) => onChange('addressLine2', text)}
        />
      </View>

      <View className="flex-row gap-4">
        <View className="flex-1">
          <Text className="text-sm font-semibold text-gray-700 mb-1">City *</Text>
          <TextInput
            ref={cityRef}
            className={`bg-white border rounded-lg px-4 py-3 text-black ${errors?.city ? 'border-red-500' : 'border-gray-200'}`}
            placeholder="City"
            value={formData.city}
            onChangeText={(text) => onChange('city', text)}
          />
          {errors?.city && <Text className="text-xs text-red-500 mt-1">{errors.city}</Text>}
        </View>

        <View className="flex-1">
          <Text className="text-sm font-semibold text-gray-700 mb-1">Landmark (Optional)</Text>
          <TextInput
            ref={landmarkRef}
            className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-black"
            placeholder="Nearby landmark"
            value={formData.landmark}
            onChangeText={(text) => onChange('landmark', text)}
          />
        </View>
      </View>

      <View className="flex-row gap-4 relative z-10">
        <View className="flex-1">
          <Text className="text-sm font-semibold text-gray-700 mb-1">Pincode *</Text>
          <TouchableOpacity
            className={`bg-white border flex-row items-center justify-between px-3 py-3 rounded-lg ${showPincodeDropdown ? 'border-sky-500' : 'border-gray-200'} ${errors?.pincode ? 'border-red-500' : ''}`}
            onPress={() => setShowPincodeDropdown(!showPincodeDropdown)}
          >
            <Text 
              className={formData.pincode ? "text-black font-medium flex-1 mr-2" : "text-gray-400 font-medium flex-1 mr-2"}
              numberOfLines={1} 
            >
              {formData.pincode ? `${formData.pincode}${formData.area ? ` - ${formData.area}` : ''}` : "Select Pincode"}
            </Text>
            {showPincodeDropdown ? (
              <X size={20} color="#9ca3af" />
            ) : (
              <ChevronDown size={20} color="#9ca3af" />
            )}
          </TouchableOpacity>
          {errors?.pincode && !showPincodeDropdown && <Text className="text-xs text-red-500 mt-1">{errors.pincode}</Text>}
        </View>

        <View className="flex-1">
          <Text className="text-sm font-semibold text-gray-700 mb-1">Area / Zone *</Text>
          <TextInput
            ref={areaRef}
            className={`border rounded-lg px-4 py-3 ${formData.pincode ? 'bg-gray-100 text-gray-500 border-gray-200' : 'bg-white text-black border-gray-200'} ${errors?.area ? 'border-red-500' : ''}`}
            placeholder="Area or Zone"
            value={formData.area}
            onChangeText={(text) => onChange('area', text)}
            editable={!formData.pincode}
            selectTextOnFocus={!formData.pincode}
            autoComplete="off"
            autoCorrect={false}
            importantForAutofill="no"
            textContentType="none"
          />{errors?.area && <Text className="text-xs text-red-500 mt-1">{errors.area}</Text>}
        </View>
      </View>

      <View className="pt-4 border-t border-gray-100">
        <Text className="text-sm font-semibold text-gray-700 mb-2">Pin Exact Location *</Text>
        
        {isGeocoding ? (
          <View className="flex-row items-center mb-2">
            <ActivityIndicator size="small" color="#0ea5e9" style={{ marginRight: 8 }} />
            <Text className="text-xs text-gray-500">Detecting address...</Text>
          </View>
        ) : null}

        {!isGeocoding && (detectedAddress || (formData.addressLine1 && formData.city)) ? (
          <View className="p-3 rounded-xl bg-blue-50 border border-blue-100 flex-row items-start mb-3">
            <View className="h-8 w-8 rounded-full bg-blue-100 items-center justify-center mr-3 mt-0.5">
              <MapPin size={16} color="#0ea5e9" />
            </View>
            <View className="flex-1">
              <Text className="text-[10px] uppercase font-black text-[#0ea5e9] tracking-widest">Detected Address</Text>
              <Text className="text-sm font-semibold text-gray-700 leading-snug">
                {detectedAddress || `${formData.addressLine1}${formData.addressLine2 ? ', ' + formData.addressLine2 : ''}, ${formData.area ? formData.area + ', ' : ''}${formData.city}${formData.pincode ? ' - ' + formData.pincode : ''}`}
              </Text>
            </View>
          </View>
        ) : null}

        <MapPicker 
          onLocationSelect={handleLocationSelect}
          initialLocation={initialMapLocation}
        />
      </View>

      {showDefaultToggle && (
        <TouchableOpacity 
          className="flex-row items-center mt-2"
          onPress={() => onChange('isDefault', !formData.isDefault)}
        >
          <View className={`w-5 h-5 rounded border ${formData.isDefault ? 'bg-sky-500 border-sky-500' : 'border-gray-300 bg-white'} items-center justify-center mr-2`}>
            {formData.isDefault && <Text className="text-white text-xs font-bold">✓</Text>}
          </View>
          <Text className="text-gray-700 font-medium">Set as default address</Text>
        </TouchableOpacity>
      )}

    </View>
  );
}
