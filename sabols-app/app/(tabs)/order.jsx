import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  Modal, TextInput, Switch, BackHandler
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CreditCard, CheckCircle2, MapPin, AlertCircle, Plus,
  ChevronRight, ChevronDown, Pencil, X, Smartphone, Banknote, Landmark
} from 'lucide-react-native';
import RazorpayCheckout from 'react-native-razorpay';
import { apiFetch } from '../../lib/api';
import MapPicker from '../../components/MapPicker';
import OrderSummary from '../../components/OrderSummary';

// ─── Address Form Modal ────────────────────────────────────────────────────────
function AddressFormModal({ visible, onClose, onSaved, initialData, serviceAreas = [] }) {
  const isNew = !initialData?.id;
  const [formData, setFormData] = useState({
    nickname: '', contactName: '', contactPhone: '',
    addressLine1: '', addressLine2: '', area: '', city: '',
    pincode: '', landmark: '', isDefault: false,
    latitude: null, longitude: null,
    ...(initialData || {}),
  });
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [showPincodePicker, setShowPincodePicker] = useState(false);

  useEffect(() => {
    if (visible) {
      if (initialData) {
        setFormData({
          nickname: '', contactName: '', contactPhone: '',
          addressLine1: '', addressLine2: '', area: '', city: '',
          pincode: '', landmark: '', isDefault: false,
          latitude: null, longitude: null,
          ...initialData,
        });
      } else {
        setFormData({
          nickname: '', contactName: '', contactPhone: '',
          addressLine1: '', addressLine2: '', area: '', city: '',
          pincode: '', landmark: '', isDefault: false,
          latitude: null, longitude: null,
        });
      }
      setErrors({});
    }
  }, [visible, initialData]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
  };

  const handlePincodeSelect = (selectedPincode) => {
    handleChange('pincode', selectedPincode);
    const match = serviceAreas.find(sa => sa.pincode === selectedPincode);
    if (match) {
      handleChange('area', match.areaName);
      if (!formData.city) {
        handleChange('city', 'Coimbatore');
      }
    }
    setShowPincodePicker(false);
  };

  const handleLocationSelect = (data) => {
    if (data.coordinates) {
      handleChange('latitude', data.coordinates.latitude);
      handleChange('longitude', data.coordinates.longitude);
    }
    if (data.addressInfo) {
      if (data.addressInfo.name && !formData.addressLine1) handleChange('addressLine1', data.addressInfo.name);
      if (data.addressInfo.city && !formData.city) handleChange('city', data.addressInfo.city);
      if (data.addressInfo.postalCode && !formData.pincode) handleChange('pincode', data.addressInfo.postalCode);
      if ((data.addressInfo.district || data.addressInfo.subregion) && !formData.area) {
        handleChange('area', data.addressInfo.district || data.addressInfo.subregion);
      }
    }
  };

  const validate = () => {
    const errs = {};
    if (!formData.addressLine1?.trim()) errs.addressLine1 = 'Required';
    if (!formData.area?.trim()) errs.area = 'Required';
    if (!formData.city?.trim()) errs.city = 'Required';
    if (!/^\d{6}$/.test(formData.pincode?.trim() || '')) errs.pincode = '6-digit pincode required';
    if (!formData.contactPhone || formData.contactPhone.length !== 10) errs.contactPhone = 'Valid 10-digit number required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setIsSaving(true);
    try {
      const payload = {
        nickname: formData.nickname || null,
        contactName: formData.contactName || null,
        contactPhone: formData.contactPhone,
        line1: formData.addressLine1,
        line2: formData.addressLine2 || '',
        area: formData.area,
        city: formData.city,
        pincode: formData.pincode,
        landmark: formData.landmark || '',
        isDefault: formData.isDefault || false,
        latitude: formData.latitude || null,
        longitude: formData.longitude || null,
      };

      let res;
      if (!isNew && formData.id) {
        res = await apiFetch(`/api/user/addresses/${formData.id}`, {
          method: 'PATCH', body: JSON.stringify(payload),
        });
      } else {
        res = await apiFetch('/api/user/addresses', {
          method: 'POST', body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        const data = await res.json();
        onSaved(data.address || data);
        onClose();
      } else {
        const data = await res.json().catch(() => ({}));
        Toast.show({ type: 'error', text1: 'Error', text2: data.message || 'Failed to save address' });
      }
    } catch (e) {
      console.error('Save address error:', e);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Could not save address' });
    } finally {
      setIsSaving(false);
    }
  };

  const renderField = ({ label, field, placeholder, keyboardType, maxLength, required }) => (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4 }}>
        {label}{required ? ' *' : ''}
      </Text>
      <TextInput
        style={{
          borderWidth: 1, borderColor: errors[field] ? '#ef4444' : '#d1d5db',
          borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
          fontSize: 15, color: '#000', backgroundColor: '#fff',
        }}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        value={formData[field] ? String(formData[field]) : ''}
        onChangeText={(v) => handleChange(field, v)}
        keyboardType={keyboardType || 'default'}
        maxLength={maxLength}
      />
      {errors[field] && <Text style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>{errors[field]}</Text>}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: '#e5e7eb' }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#000' }}>
            {isNew ? 'Add New Address' : 'Edit Address'}
          </Text>
          <TouchableOpacity onPress={onClose} style={{ width: 32, height: 32, backgroundColor: '#f3f4f6', borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}>
            <X size={20} color="#000" />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1, padding: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4 }}>
            Pin Location on Map (Optional)
          </Text>
          <MapPicker
            onLocationSelect={handleLocationSelect}
            initialLocation={formData.latitude ? { latitude: formData.latitude, longitude: formData.longitude } : null}
          />

          {(formData.addressLine1 && formData.city) ? (
            <View style={{ padding: 12, borderRadius: 12, backgroundColor: '#f0f9ff', borderWidth: 1, borderColor: '#bae6fd', flexDirection: 'row', alignItems: 'flex-start', marginTop: 12, marginBottom: 12 }}>
              <View style={{ height: 32, width: 32, borderRadius: 16, backgroundColor: '#e0f2fe', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <MapPin size={16} color="#0ea5e9" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: '900', color: '#0ea5e9', letterSpacing: 1 }}>Detected Address</Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#4b5563', marginTop: 4 }}>
                  {`${formData.addressLine1}${formData.addressLine2 ? ', ' + formData.addressLine2 : ''}, ${formData.area ? formData.area + ', ' : ''}${formData.city}${formData.pincode ? ' - ' + formData.pincode : ''}`}
                </Text>
              </View>
            </View>
          ) : (
            formData.latitude && (
              <Text style={{ fontSize: 11, color: '#16a34a', textAlign: 'center', marginBottom: 12, fontWeight: '600', marginTop: 8 }}>
                ✓ Coordinates saved ({formData.latitude?.toFixed(4)}, {formData.longitude?.toFixed(4)})
              </Text>
            )
          )}

          {renderField({ label: "Nickname", field: "nickname", placeholder: "Home, Work…" })}
          {renderField({ label: "Contact Name", field: "contactName", placeholder: "John Doe" })}
          {renderField({ label: "Contact Phone", field: "contactPhone", placeholder: "10-digit number", keyboardType: "phone-pad", maxLength: 10, required: true })}
          {renderField({ label: "Address Line 1", field: "addressLine1", placeholder: "House/Flat No., Building Name", required: true })}
          {renderField({ label: "Address Line 2", field: "addressLine2", placeholder: "Street Name, Locality" })}

          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              {renderField({ label: "City", field: "city", placeholder: "Coimbatore", required: true })}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4 }}>Pincode *</Text>
              <TouchableOpacity
                onPress={() => setShowPincodePicker(true)}
                style={{
                  borderWidth: 1, borderColor: errors.pincode ? '#ef4444' : '#d1d5db',
                  borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
                  backgroundColor: '#fff', justifyContent: 'center', height: 42
                }}
              >
                <Text style={{ fontSize: 15, color: formData.pincode ? '#000' : '#9ca3af' }}>
                  {formData.pincode || 'Select Pincode'}
                </Text>
              </TouchableOpacity>
              {errors.pincode && <Text style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>{errors.pincode}</Text>}
            </View>
          </View>

          <Modal visible={showPincodePicker} transparent animationType="fade">
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }}>
              <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, maxHeight: '80%' }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>Select Pincode</Text>
                <ScrollView>
                  {serviceAreas.map((sa) => (
                    <TouchableOpacity
                      key={sa.id || sa.pincode}
                      onPress={() => handlePincodeSelect(sa.pincode)}
                      style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}
                    >
                      <Text style={{ fontSize: 16, color: '#1f2937' }}>{sa.pincode} - {sa.areaName}</Text>
                    </TouchableOpacity>
                  ))}
                  {serviceAreas.length === 0 && (
                    <Text style={{ color: '#6b7280', textAlign: 'center', padding: 20 }}>No service areas loaded.</Text>
                  )}
                </ScrollView>
                <TouchableOpacity
                  onPress={() => setShowPincodePicker(false)}
                  style={{ marginTop: 16, padding: 12, backgroundColor: '#f3f4f6', borderRadius: 8, alignItems: 'center' }}
                >
                  <Text style={{ fontWeight: 'bold', color: '#374151' }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {renderField({ label: "Area / Neighborhood", field: "area", placeholder: "Peelamedu", required: true })}
          {renderField({ label: "Landmark", field: "landmark", placeholder: "Near central park" })}

          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
            <Switch
              value={formData.isDefault || false}
              onValueChange={(v) => handleChange('isDefault', v)}
              trackColor={{ true: '#0ea5e9' }}
            />
            <Text style={{ marginLeft: 10, fontSize: 14, color: '#374151', fontWeight: '500' }}>Set as default address</Text>
          </View>
        </ScrollView>

        <View style={{ padding: 16, borderTopWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' }}>
          <TouchableOpacity
            onPress={handleSave}
            disabled={isSaving}
            style={{ backgroundColor: isSaving ? '#7dd3fc' : '#0ea5e9', paddingVertical: 16, borderRadius: 12, alignItems: 'center' }}
          >
            {isSaving ? <ActivityIndicator color="white" /> : (
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Save Address</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Checkout Screen ──────────────────────────────────────────────────────
export default function OrderScreen() {
  const router = useRouter();
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [isPaymentSuccess, setIsPaymentSuccess] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('ONLINE');
  const [onlinePaymentMethodType, setOnlinePaymentMethodType] = useState('upi');
  const [createdOrderId, setCreatedOrderId] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState({ upi: [], card: [] });
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [serviceAreas, setServiceAreas] = useState([]);
  const [showServiceAreaError, setShowServiceAreaError] = useState(false);
  const [deliverySlot, setDeliverySlot] = useState(null);
  const [dateError, setDateError] = useState('');
  const [pendingReturns, setPendingReturns] = useState(0);
  const [error, setError] = useState('');

  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [showPaymentDropdown, setShowPaymentDropdown] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        if (cart.length === 0) setIsLoading(true);
        try {
          const cached = await AsyncStorage.getItem('cart');
          if (cached) setCart(JSON.parse(cached));
          else setCart([]);

          const cartRes = await apiFetch('/api/cart');
          if (cartRes.ok) {
            const cartData = await cartRes.json();
            if (cartData.success && cartData.items) {
              setCart(cartData.items);
              if (cartData.items.length === 0) {
                router.replace('/(tabs)/items');
                return;
              }
            }
          }

          try {
            const saRes = await apiFetch('/api/service-areas');
            if (saRes.ok) {
              const saData = await saRes.json();
              if (saData.success) {
                setServiceAreas(saData.serviceAreas || []);
              }
            }
          } catch (err) { console.error('Error fetching service areas:', err); }

          const profileRes = await apiFetch('/api/user/profile');
          if (profileRes.ok) {
            const profileData = await profileRes.json();
            if (profileData.profile) {
              setCustomer(profileData.profile);
              const userAddresses = profileData.profile.addresses || [];
              setAddresses(userAddresses);
              if (userAddresses.length > 0) {
                const def = userAddresses.find(a => a.isDefault);
                setSelectedAddressId(def ? def.id : userAddresses[0].id);
              }
              const pm = profileData.profile.paymentMethods || { upi: [], card: [] };
              setPaymentMethods(pm);
            }
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
        } catch (err) {
          console.error('Error loading checkout data:', err);
        } finally {
          setIsLoading(false);
        }
      };
      loadData();
    }, [])
  );

  useEffect(() => {
    if (paymentMethod === 'ONLINE') {
      const methods = paymentMethods[onlinePaymentMethodType] || [];
      if (methods.length > 0) {
        const def = methods.find((m) => m.isDefault) || methods[0];
        setSelectedPaymentMethod({
          id: def.id, type: onlinePaymentMethodType, details: def.details,
          razorpayTokenId: def.razorpayTokenId, cardLast4: def.cardLast4, cardBrand: def.cardBrand,
        });
      } else {
        setSelectedPaymentMethod({ id: 'new', type: onlinePaymentMethodType, details: '', isNew: true });
      }
    }
  }, [onlinePaymentMethodType, paymentMethods, paymentMethod]);

  useEffect(() => {
    const onBackPress = () => {
      if (isPlacingOrder) {
        return true;
      }
      return false;
    };
    BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
  }, [isPlacingOrder]);

  const refreshAddresses = async (knownId) => {
    try {
      const profileRes = await apiFetch('/api/user/profile');
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        const userAddresses = profileData.profile?.addresses || [];
        setAddresses(userAddresses);
        
        setSelectedAddressId((currentId) => {
          if (knownId) return knownId;
          const stillExists = userAddresses.some(a => a.id === currentId);
          if (stillExists) return currentId;
          return userAddresses.length > 0 ? userAddresses[0].id : null;
        });
      }
    } catch (err) {
      console.error('Failed to refresh addresses:', err);
    }
  };

  const handleAddressSaved = async (savedAddr) => {
    await refreshAddresses(savedAddr?.id);
  };

  const calculateSubtotal = () => cart.filter(i => i.isAvailable !== false).reduce((s, i) => s + i.price * i.quantity, 0);
  const calculateGST = () => cart.filter(i => i.isAvailable !== false).reduce((s, i) => s + (i.price * i.quantity) * ((i.gst ?? 5.0) / 100), 0);

  const calculateDeposit = () => {
    const depositItems = cart.filter(i => i.isAvailable !== false && (i.depositAmount || 0) > 0);
    if (!depositItems.length) return { toPay: 0, walletUsed: 0, walletCredit: 0, totalRequired: 0, cansRequiringDeposit: 0, depositRate: 0 };

    const cih = customer?.cansInHand || 0;
    const po = customer?.pendingOrdered || 0;
    const pr = customer?.pendingReturned || 0;
    const wb = customer?.depositWalletBalance || 0;
    const pd = customer?.pendingDeposit || 0;
    const orderedQty = depositItems.reduce((s, i) => s + i.quantity, 0);
    const returnedQty = depositItems.reduce((s, i) => s + (i.returnQuantity || 0), 0);
    const explicitReturns = pendingReturns || 0;
    const futureCans = cih + (po - pr) + (orderedQty - (returnedQty + explicitReturns));
    const rate = depositItems[0]?.depositAmount || 0;
    const required = Math.max(0, futureCans * rate);
    const toPay = Math.max(0, required - wb - pd);

    if (toPay > 0) return { toPay, walletUsed: 0, walletCredit: 0, totalRequired: toPay, cansRequiringDeposit: Math.ceil(toPay / rate), depositRate: rate };
    if (required < wb) {
      const surplus = wb - required;
      return { toPay: 0, walletUsed: 0, walletCredit: surplus, totalRequired: -surplus, cansRequiringDeposit: 0, depositRate: rate };
    }
    return { toPay: 0, walletUsed: 0, walletCredit: 0, totalRequired: 0, cansRequiringDeposit: 0, depositRate: rate };
  };

  const handleErrorDialogConfirm = async () => {
    setShowErrorDialog(false);
    setIsPlacingOrder(true);
    try {
      await apiFetch('/api/cart', { method: 'DELETE' });
      await AsyncStorage.removeItem('cart');
      setCart([]);
    } catch (e) { console.error(e); }
    router.push('/(tabs)/items');
    setIsPlacingOrder(false);
  };

  const processRazorpay = async (orderId, amountInPaise) => {
    try {
      const payRes = await apiFetch('/api/payments/create', {
        method: 'POST',
        body: JSON.stringify({ 
          orderId, 
          amount: amountInPaise,
          paymentMethodId: onlinePaymentMethodType === 'card' && selectedPaymentMethod?.id !== 'new' ? selectedPaymentMethod?.id : undefined
        }),
      });
      const payData = await payRes.json();

      if (!payRes.ok || !payData.success) {
        throw new Error(payData.message || 'Failed to create payment order');
      }

      const options = {
        description: payData.description || `Order`,
        currency: payData.currency || 'INR',
        key: payData.key,
        amount: payData.amount,
        name: payData.name || 'SABOLS',
        order_id: payData.orderId,
        prefill: {
          ...(payData.prefill?.email ? { email: payData.prefill.email } : {}),
          ...(payData.prefill?.contact ? { contact: payData.prefill.contact } : {}),
          ...(payData.prefill?.name ? { name: payData.prefill.name } : {}),
        },
        method: {
          upi: onlinePaymentMethodType === 'upi',
          card: onlinePaymentMethodType === 'card',
          netbanking: onlinePaymentMethodType === 'netbanking',
          wallet: false,
          emi: false,
          paylater: false,
        },
        theme: { color: '#0ea5e9' },
      };

      const rzRes = await RazorpayCheckout.open(options);
      setIsPaymentSuccess(true);

      const verifyRes = await apiFetch('/api/payments/verify-payment', {
        method: 'POST',
        body: JSON.stringify({
          razorpay_order_id: rzRes.razorpay_order_id,
          razorpay_payment_id: rzRes.razorpay_payment_id,
          razorpay_signature: rzRes.razorpay_signature,
          orderId,
        }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.success) {
        setIsPaymentSuccess(false);
        throw new Error(verifyData.message || 'Payment verification failed');
      }
      return true;
    } catch (err) {
      if (err?.code === 2 || err?.code === 0) return false;
      setIsPaymentSuccess(false);
      let errorMsg = err.message || 'Payment process failed. Please try again.';
      Toast.show({ type: 'error', text1: 'Payment Error', text2: errorMsg });
      return false;
    }
  };

  const handlePlaceOrder = async () => {
    setError('');
    setDateError('');

    if (!selectedAddressId) {
      Toast.show({ type: 'error', text1: 'Address Required', text2: 'Please select or add a delivery address.' });
      return;
    }

    if (!deliverySlot) {
      setDateError('Please select a delivery date');
      return;
    }

    const availableItems = cart.filter(i => i.isAvailable !== false);
    const unavailableItems = cart.filter(i => i.isAvailable === false);
    
    if (unavailableItems.length > 0) {
      Toast.show({ type: 'error', text1: 'Unavailable Items', text2: 'Some items in your cart are no longer available. Please return to the cart and remove them.' });
      return;
    }

    const totalQuantity = availableItems.reduce((s, i) => s + i.quantity, 0);
    if (!totalQuantity) { router.push('/(tabs)/items'); return; }

    const addr = addresses.find(a => a.id === selectedAddressId);
    
    if (serviceAreas.length > 0 && addr?.pincode) {
      const isSupported = serviceAreas.some(sa => sa.pincode === addr.pincode);
      if (!isSupported) {
        setShowServiceAreaError(true);
        return;
      }
    }

    setIsPlacingOrder(true);

    try {
      if (createdOrderId && paymentMethod === 'ONLINE') {
        const amountInPaise = Math.round(total * 100);
        const paid = await processRazorpay(createdOrderId, amountInPaise);
        if (paid) {
          (async () => {
            try {
              await apiFetch('/api/cart', { method: 'DELETE' });
              await AsyncStorage.removeItem('cart');
            } catch (e) { console.error(e); }
          })();
          setTimeout(() => {
            router.replace('/(tabs)/orders?payment=success&orderId=' + createdOrderId);
          }, 1500);
        } else {
          setIsPlacingOrder(false);
        }
        return;
      }

      const payload = {
        quantity: totalQuantity,
        deliverySlot,
        paymentType: paymentMethod,
        paymentMethodId: paymentMethod === 'ONLINE' ? (selectedPaymentMethod?.id === 'new' ? 'ONLINE' : selectedPaymentMethod?.id) : undefined,
        addressId: selectedAddressId,
        addressLine1: addr?.line1 || addr?.addressLine1 || '',
        addressLine2: addr?.line2 || addr?.addressLine2 || '',
        area: addr?.area || '',
        city: addr?.city || '',
        pincode: addr?.pincode || '',
        landmark: addr?.landmark || '',
        nickname: addr?.nickname || null,
        contactName: addr?.contactName || null,
        contactPhone: addr?.contactPhone || null,
        latitude: addr?.latitude || null,
        longitude: addr?.longitude || null,
      };

      const res = await apiFetch('/api/orders', { method: 'POST', body: JSON.stringify(payload) });
      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.errorType === 'INSUFFICIENT_CANS' || data.errorType === 'STALE_CART') {
          setErrorMessage(
            data.errorType === 'STALE_CART'
              ? 'Your cart is outdated. We will reset it so it recalculates correctly. Please add your items again.'
              : 'Your available empty cans balance has changed. We need to reset your cart for accurate deposit calculation. Please add your items again.'
          );
          setShowErrorDialog(true);
          setIsPlacingOrder(false);
          return;
        }
        Toast.show({ type: 'error', text1: 'Order Failed', text2: data.message || 'Failed to place order. Please try again.' });
        setIsPlacingOrder(false);
        return;
      }

      if (paymentMethod === 'COD') {
        (async () => {
          try {
            await apiFetch('/api/cart', { method: 'DELETE' });
            await AsyncStorage.removeItem('cart');
          } catch (e) { console.error(e); }
        })();
        router.replace('/(tabs)/orders?payment=success&orderId=' + data.order.id);
        return;
      }

      setCreatedOrderId(data.order.id);
      const amountInPaise = Math.round(data.order.amount * 100);
      
      if (amountInPaise === 0) {
        (async () => {
          try {
            await apiFetch('/api/cart', { method: 'DELETE' });
            await AsyncStorage.removeItem('cart');
          } catch (e) { console.error(e); }
        })();
        router.replace('/(tabs)/orders?payment=success&orderId=' + data.order.id);
        return;
      }

      const paid = await processRazorpay(data.order.id, amountInPaise);
      if (paid) {
        (async () => {
          try {
            await apiFetch('/api/cart', { method: 'DELETE' });
            await AsyncStorage.removeItem('cart');
          } catch (e) { console.error(e); }
        })();
        setTimeout(() => {
          router.replace('/(tabs)/orders?payment=success&orderId=' + data.order.id);
        }, 1500);
      } else {
        setIsPlacingOrder(false);
      }
    } catch (err) {
      console.error('Place order error:', err);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Network error while placing order.' });
    } finally {
      setIsPlacingOrder(false);
    }
  };

  // ── Payment success overlay ──────────────────────────────────────────────────
  if (isPaymentSuccess) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: '#22c55e', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <CheckCircle2 size={48} color="white" />
        </View>
        <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#000', marginBottom: 8 }}>Payment Successful!</Text>
        <Text style={{ color: '#6b7280' }}>Redirecting to your orders…</Text>
        <ActivityIndicator color="#0ea5e9" style={{ marginTop: 16 }} />
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f3f7fb' }}>
        <ActivityIndicator size="large" color="#0ea5e9" />
      </View>
    );
  }

  const subtotal = calculateSubtotal();
  const gst = calculateGST();
  const depositInfo = calculateDeposit();
  const total = subtotal + gst + depositInfo.toPay;
  const selectedAddress = addresses.find(a => a.id === selectedAddressId);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f3f7fb' }} contentContainerStyle={{ padding: 16 }}>

      {/* STALE_CART / INSUFFICIENT_CANS Dialog */}
      <Modal visible={showErrorDialog} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%' }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#000', marginBottom: 12 }}>Action Required</Text>
            <Text style={{ color: '#374151', marginBottom: 24 }}>{errorMessage}</Text>
            <TouchableOpacity onPress={handleErrorDialogConfirm} style={{ backgroundColor: '#0ea5e9', paddingVertical: 14, borderRadius: 10, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>OK, Reset Cart</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Service Area Error Dialog */}
      <Modal visible={showServiceAreaError} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', alignItems: 'center' }}>
            <AlertCircle size={48} color="#ef4444" style={{ marginBottom: 16 }} />
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#000', marginBottom: 12, textAlign: 'center' }}>Service Unavailable</Text>
            <Text style={{ color: '#374151', marginBottom: 24, textAlign: 'center' }}>We currently do not deliver to this pincode. Please select a different address.</Text>
            <TouchableOpacity onPress={() => setShowServiceAreaError(false)} style={{ backgroundColor: '#0ea5e9', paddingVertical: 14, borderRadius: 10, alignItems: 'center', width: '100%' }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Change Address</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Address Form Modal */}
      <AddressFormModal
        visible={showAddressForm}
        onClose={() => { setShowAddressForm(false); setEditingAddress(null); }}
        onSaved={handleAddressSaved}
        initialData={editingAddress}
        serviceAreas={serviceAreas}
      />

      <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#000', marginBottom: 4 }}>Checkout</Text>
      <Text style={{ color: '#6b7280', marginBottom: 20 }}>Complete your order details</Text>

      {/* ── ORDER SUMMARY ────────────────────────────────────────────────────── */}
      <OrderSummary
        cart={cart}
        slot={deliverySlot}
        onSlotChange={(slot) => { setDeliverySlot(slot); setDateError(''); }}
        slotError={dateError}
        subtotal={subtotal}
        gst={gst}
        depositInfo={depositInfo}
        total={total}
        pendingReturns={pendingReturns}
      />

      <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', padding: 16, marginBottom: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#000', marginBottom: 16 }}>Delivery & Payment</Text>
        
        {error && !dateError && (
          <Text style={{ color: '#dc2626', fontWeight: '500', fontSize: 13, marginBottom: 12 }}>{error}</Text>
        )}

        {/* ── DELIVERY ADDRESS ────────────────────────────────────────────────── */}
        <View style={{ marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#e0f2fe', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
              <MapPin size={16} color="#0ea5e9" />
            </View>
            <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#000' }}>Delivery Address</Text>
          </View>

          {addresses.length === 0 ? (
            <TouchableOpacity
              onPress={() => { setEditingAddress(null); setShowAddressForm(true); }}
              style={{ borderWidth: 2, borderStyle: 'dashed', borderColor: '#bae6fd', borderRadius: 12, padding: 24, alignItems: 'center', backgroundColor: '#f0f9ff' }}
            >
              <MapPin size={28} color="#0ea5e9" />
              <Text style={{ fontWeight: '600', color: '#000', marginTop: 8 }}>No Addresses Saved</Text>
              <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>Tap to add your delivery location</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ gap: 8 }}>
              {addresses.map(addr => {
                const isSelected = selectedAddressId === addr.id;
                return (
                  <TouchableOpacity
                    key={addr.id}
                    onPress={() => setSelectedAddressId(addr.id)}
                    style={{
                      padding: 12, borderRadius: 8, borderWidth: 1,
                      borderColor: isSelected ? '#0ea5e9' : '#e5e7eb',
                      backgroundColor: isSelected ? '#f0f9ff' : '#fff',
                      flexDirection: 'row', alignItems: 'flex-start'
                    }}
                  >
                    <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: isSelected ? '#0ea5e9' : '#9ca3af', alignItems: 'center', justifyContent: 'center', marginTop: 2, marginRight: 8 }}>
                      {isSelected && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#0ea5e9' }} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <Text style={{ fontWeight: 'bold', color: '#000', fontSize: 14 }}>
                          {addr.nickname || (addr.isDefault ? 'Primary' : 'Saved Address')}
                        </Text>
                        {addr.isDefault && (
                          <View style={{ backgroundColor: '#e0f2fe', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, marginLeft: 8 }}>
                            <Text style={{ color: '#0ea5e9', fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase' }}>Default</Text>
                          </View>
                        )}
                      </View>
                      <Text style={{ color: '#374151', fontSize: 12, lineHeight: 18 }}>
                        {addr.line1}, {addr.city} - {addr.pincode}, {addr.area}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        setEditingAddress({
                          id: addr.id,
                          nickname: addr.nickname || '',
                          contactName: addr.contactName || '',
                          contactPhone: addr.contactPhone || '',
                          addressLine1: addr.line1 || '',
                          addressLine2: addr.line2 || '',
                          area: addr.area || '',
                          city: addr.city || '',
                          pincode: addr.pincode || '',
                          landmark: addr.landmark || '',
                          isDefault: addr.isDefault || false,
                          latitude: addr.latitude || null,
                          longitude: addr.longitude || null,
                        });
                        setShowAddressForm(true);
                      }}
                      style={{ padding: 4 }}
                    >
                      <Pencil size={14} color="#6b7280" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
              
              <TouchableOpacity
                onPress={() => { setEditingAddress(null); setShowAddressForm(true); }}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  paddingVertical: 12, marginTop: 4, borderRadius: 8,
                  borderWidth: 1, borderStyle: 'dashed', borderColor: '#d1d5db',
                  backgroundColor: '#fff'
                }}
              >
                <Plus size={16} color="#4b5563" />
                <Text style={{ color: '#4b5563', fontWeight: '500', fontSize: 14, marginLeft: 8 }}>Add New Address</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

      {/* ── PAYMENT METHOD ───────────────────────────────────────────────────── */}
      {Math.round(total) > 0 && (
        <View style={{ marginBottom: 8 }}>
          <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#000', marginBottom: 12 }}>Payment Method</Text>

          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
            {[
              { value: 'ONLINE', label: 'Online Payment', icon: <Smartphone size={20} color={paymentMethod === 'ONLINE' ? '#fff' : '#6b7280'} /> },
              { value: 'COD', label: 'Cash on Delivery', icon: <Banknote size={20} color={paymentMethod === 'COD' ? '#fff' : '#6b7280'} /> },
            ].map(opt => {
              const isSelected = paymentMethod === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setPaymentMethod(opt.value)}
                  style={{
                    flex: 1, alignItems: 'center', padding: 12,
                    borderRadius: 8, borderWidth: 1,
                    borderColor: isSelected ? '#16a34a' : '#d1d5db',
                    backgroundColor: isSelected ? '#f0fdf4' : '#fff',
                    position: 'relative'
                  }}
                >
                  {isSelected && (
                    <View style={{ position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center' }}>
                      <CheckCircle2 size={12} color="#fff" />
                    </View>
                  )}
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isSelected ? '#16a34a' : '#f3f4f6', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    {opt.icon}
                  </View>
                  <Text style={{ fontWeight: '500', color: '#000', fontSize: 14 }}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
            
          {paymentMethod === 'ONLINE' && (
            <View style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                {[
                  { id: 'upi', label: 'UPI', icon: <Smartphone size={16} color={onlinePaymentMethodType === 'upi' ? '#15803d' : '#374151'} /> },
                  { id: 'card', label: 'Card', icon: <CreditCard size={16} color={onlinePaymentMethodType === 'card' ? '#15803d' : '#374151'} /> },
                  { id: 'netbanking', label: 'Net Banking', icon: <Landmark size={16} color={onlinePaymentMethodType === 'netbanking' ? '#15803d' : '#374151'} /> }
                ].map(type => (
                    <TouchableOpacity
                      key={type.id}
                      onPress={() => setOnlinePaymentMethodType(type.id)}
                      style={{
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                        flex: 1, minWidth: '30%', paddingVertical: 10, borderRadius: 8,
                        borderWidth: 1, borderColor: onlinePaymentMethodType === type.id ? '#16a34a' : '#d1d5db',
                        backgroundColor: onlinePaymentMethodType === type.id ? '#f0fdf4' : '#fff',
                      }}
                    >
                      {type.icon}
                      <Text style={{ 
                        color: onlinePaymentMethodType === type.id ? '#15803d' : '#374151', 
                        fontWeight: onlinePaymentMethodType === type.id ? 'bold' : '500', 
                        fontSize: 13, marginLeft: 6 
                      }}>
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                ))}
              </View>

              {paymentMethods[onlinePaymentMethodType]?.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 }}>
                    Select {onlinePaymentMethodType === 'upi' ? 'UPI ID' : (onlinePaymentMethodType === 'card' ? 'Card' : 'Bank')} *
                  </Text>
                  
                  {/* Dropdown Trigger */}
                  <TouchableOpacity
                    onPress={() => setShowPaymentDropdown(true)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                      paddingHorizontal: 16, paddingVertical: 14, borderRadius: 8,
                      borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff'
                    }}
                  >
                    <Text style={{ color: selectedPaymentMethod ? '#1f2937' : '#9ca3af', fontSize: 14, fontWeight: '500' }}>
                      {selectedPaymentMethod 
                        ? (selectedPaymentMethod.id === 'new' 
                            ? (onlinePaymentMethodType === 'netbanking' ? 'Pay via Net Banking' : `Add New ${onlinePaymentMethodType === 'upi' ? 'UPI' : 'Card'}`)
                            : (onlinePaymentMethodType === 'card' && selectedPaymentMethod.cardLast4 
                                ? `**** **** **** ${selectedPaymentMethod.cardLast4}${selectedPaymentMethod.cardBrand ? ` (${selectedPaymentMethod.cardBrand})` : ''}` 
                                : selectedPaymentMethod.details))
                        : `Choose a ${onlinePaymentMethodType === 'upi' ? 'UPI ID' : (onlinePaymentMethodType === 'card' ? 'card' : 'bank')}`}
                    </Text>
                    <ChevronDown size={20} color="#6b7280" />
                  </TouchableOpacity>

                  {/* Dropdown Modal */}
                  <Modal visible={showPaymentDropdown} transparent animationType="fade">
                    <TouchableOpacity 
                      activeOpacity={1} 
                      onPress={() => setShowPaymentDropdown(false)}
                      style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
                    >
                      <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, maxHeight: '60%' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1f2937' }}>
                            Select {onlinePaymentMethodType === 'upi' ? 'UPI ID' : (onlinePaymentMethodType === 'card' ? 'Card' : 'Bank')}
                          </Text>
                          <TouchableOpacity onPress={() => setShowPaymentDropdown(false)}>
                            <X size={24} color="#6b7280" />
                          </TouchableOpacity>
                        </View>
                        <ScrollView keyboardShouldPersistTaps="handled">
                          <View style={{ gap: 8 }}>
                            {paymentMethods[onlinePaymentMethodType].map((method) => {
                              const hasToken = method.razorpayTokenId && onlinePaymentMethodType === 'card';
                              const displayText = onlinePaymentMethodType === 'card' && method.cardLast4
                                ? `**** **** **** ${method.cardLast4}${method.cardBrand ? ` (${method.cardBrand})` : ''}`
                                : method.details;
                              const isSelected = selectedPaymentMethod?.id === method.id;
                              
                              return (
                                <TouchableOpacity
                                  key={method.id}
                                  onPress={() => {
                                    setSelectedPaymentMethod({
                                      id: method.id, type: onlinePaymentMethodType, details: method.details,
                                      razorpayTokenId: method.razorpayTokenId, cardLast4: method.cardLast4, cardBrand: method.cardBrand
                                    });
                                    setShowPaymentDropdown(false);
                                  }}
                                  style={{
                                    flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 8,
                                    backgroundColor: isSelected ? '#f0fdf4' : '#f9fafb'
                                  }}
                                >
                                  <View style={{ flex: 1 }}>
                                    <Text style={{ fontWeight: isSelected ? 'bold' : '500', color: isSelected ? '#15803d' : '#374151', fontSize: 15 }}>
                                      {displayText} {method.isDefault ? '(Default)' : ''}
                                    </Text>
                                    {hasToken && (
                                      <Text style={{ color: '#0ea5e9', fontSize: 12, marginTop: 4, fontWeight: '600' }}>⚡ Quick Pay available</Text>
                                    )}
                                  </View>
                                  {isSelected && <CheckCircle2 size={20} color="#16a34a" />}
                                </TouchableOpacity>
                              );
                            })}
                            <TouchableOpacity
                              onPress={() => {
                                setSelectedPaymentMethod({ id: 'new', type: onlinePaymentMethodType, details: '', isNew: true });
                                setShowPaymentDropdown(false);
                              }}
                              style={{
                                flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 8,
                                backgroundColor: selectedPaymentMethod?.id === 'new' ? '#f0fdf4' : '#f9fafb'
                              }}
                            >
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontWeight: selectedPaymentMethod?.id === 'new' ? 'bold' : '500', color: selectedPaymentMethod?.id === 'new' ? '#15803d' : '#0ea5e9', fontSize: 15 }}>
                                  + {onlinePaymentMethodType === 'netbanking' ? 'Pay via Net Banking' : `Add New ${onlinePaymentMethodType === 'upi' ? 'UPI' : 'Card'}`}
                                </Text>
                              </View>
                              {selectedPaymentMethod?.id === 'new' && <CheckCircle2 size={20} color="#16a34a" />}
                            </TouchableOpacity>
                          </View>
                        </ScrollView>
                      </View>
                    </TouchableOpacity>
                  </Modal>
                </View>
              )}
            </View>
          )}

          {paymentMethod === 'COD' && (
            <View style={{ backgroundColor: '#f3f4f6', borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'flex-start' }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Banknote size={16} color="#16a34a" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '600', color: '#000', fontSize: 14 }}>Pay on Delivery</Text>
                <Text style={{ color: '#4b5563', fontSize: 12, marginTop: 2 }}>Pay cash at the time of delivery.</Text>
              </View>
            </View>
          )}
        </View>
      )}
      
      </View>

      {/* ── PLACE ORDER BUTTON ───────────────────────────────────────────────── */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 40 }}>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/cart')}
          disabled={isPlacingOrder || isLoading}
          style={{
            flex: 1, paddingVertical: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
            borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff',
            opacity: isPlacingOrder || isLoading ? 0.5 : 1
          }}
        >
          <Text style={{ color: '#374151', fontWeight: 'bold', fontSize: 16 }}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handlePlaceOrder}
          disabled={isPlacingOrder || isLoading}
          style={{
            flex: 2, backgroundColor: isPlacingOrder ? '#7dd3fc' : '#0ea5e9',
            paddingVertical: 16, borderRadius: 12, alignItems: 'center',
            flexDirection: 'row', justifyContent: 'center',
          }}
        >
          {isPlacingOrder ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <CheckCircle2 size={20} color="white" />
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 17, marginLeft: 8 }}>
                Place Order (₹{Math.round(total)})
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
