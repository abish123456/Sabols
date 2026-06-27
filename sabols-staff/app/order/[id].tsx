import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, TextInput, ScrollView, Linking, Modal, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ArrowLeft, MapPin, Phone, Package, CreditCard, Banknote, XCircle, Navigation, QrCode, CheckCircle2, Reply } from 'lucide-react-native';
import * as Location from 'expo-location';
import { API_URL } from '../../lib/config';

// Helper function to calculate distance in meters (Haversine formula)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // Earth radius in metres
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

export default function OrderDetailsScreen() {
  const searchParams = useLocalSearchParams();
  const { id } = searchParams;
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reasons, setReasons] = useState<any[]>([]);
  const [shiftStatus, setShiftStatus] = useState<string>('UNKNOWN');
  
  // Form states
  const [deliveredAmount, setDeliveredAmount] = useState('');
  const [notDeliveredReason, setNotDeliveredReason] = useState('');
  const [showReasonModal, setShowReasonModal] = useState(false);

  // COD Modal States
  const [showCODModal, setShowCODModal] = useState(false);
  const [showMarkDeliveredModal, setShowMarkDeliveredModal] = useState(false);
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [codPaymentLinkData, setCodPaymentLinkData] = useState<any>(null);
  const [isPollingPayment, setIsPollingPayment] = useState(false);
  const [pollIntervalId, setPollIntervalId] = useState<NodeJS.Timeout | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successStatus, setSuccessStatus] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState<'DELIVERED' | 'NOT_DELIVERED' | null>(null);

  useEffect(() => {
    fetchOrderDetails();
    if (searchParams.reasons) {
      try { setReasons(JSON.parse(searchParams.reasons as string)); } catch (e) {}
    }
    if (searchParams.shiftStatus) {
      setShiftStatus(searchParams.shiftStatus as string);
    }
  }, [id]);

  const fetchOrderDetails = async () => {
    try {
      const token = await AsyncStorage.getItem('staffToken');
      const response = await fetch(`${API_URL}/api/delivery/route/today`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (response.ok && data.success) {
        const ordersArray = data.route?.orders || data.data || [];
        const found = ordersArray.find((o: any) => o.id === id);
        if (found) {
          setOrder(found);
          setDeliveredAmount(found.quantity ? found.quantity.toString() : '');

          // If COD payment was already collected but order is not marked as delivered yet, force the popup
          const isCOD = found.paymentMethod === 'COD' || found.order?.paymentType === 'COD';
          const isPaid = found.paymentStatus === 'SUCCESS' || found.codCollected === true;
          const isNotCompleted = found.deliveryStatus !== 'DELIVERED' && found.deliveryStatus !== 'NOT_DELIVERED';
          
          if (isCOD && isPaid && isNotCompleted) {
            setShowMarkDeliveredModal(true);
          }
        } else {
          Alert.alert('Error', 'Order not found in today\'s route');
          router.back();
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch order details');
    } finally {
      setLoading(false);
    }
  };

  const verifyLocation = async (actionName: string): Promise<boolean> => {
    if (!order?.address?.latitude || !order?.address?.longitude) return true;
    try {
      let { status: permissionStatus } = await Location.requestForegroundPermissionsAsync();
      if (permissionStatus !== 'granted') {
        Alert.alert('Permission Denied', `Location permission is required to ${actionName}.`);
        return false;
      }
      let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const distance = calculateDistance(
        location.coords.latitude,
        location.coords.longitude,
        order.address.latitude,
        order.address.longitude
      );
      if (distance > 100) {
        Alert.alert(
          'Too Far',
          `You are ${Math.round(distance)} meters away from the delivery location. You must be within 100 meters to ${actionName}.`
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error("Location error:", error);
      Alert.alert('Location Error', 'Could not get your current location. Please try again.');
      return false;
    }
  };

  const handleUpdateStatus = async (status: 'DELIVERED' | 'NOT_DELIVERED', payloadReason?: string) => {
    if (status === 'NOT_DELIVERED') {
      if (!notDeliveredReason && !payloadReason) {
        Alert.alert('Error', 'Please provide a reason for not delivering');
        return;
      }
    }

    if (status === 'DELIVERED') {
      setSubmitting(true);
      setUpdatingStatus(status);
      
      if (!showMarkDeliveredModal) {
        const isNear = await verifyLocation('mark as delivered');
        if (!isNear) {
          setSubmitting(false);
          setUpdatingStatus(null);
          return;
        }
      }
    } else {
      setUpdatingStatus(status);
      setSubmitting(true);
    }
    try {
      const token = await AsyncStorage.getItem('staffToken');
      
      const payload: any = {
        routeOrderId: order?.routeOrderId || id,
        deliveryStatus: status,
      };

      if (status === 'DELIVERED') {
        payload.deliveredAmount = parseInt(deliveredAmount);
      } else {
        payload.notDeliveredReason = payloadReason || notDeliveredReason;
      }

      const response = await fetch(`${API_URL}/api/route-orders/update-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (response.ok && data.success) {
        if (showMarkDeliveredModal) {
          setShowMarkDeliveredModal(false);
          router.back();
        } else {
          setSuccessStatus(status);
          setShowSuccessModal(true);
        }
      } else {
        Alert.alert('Error', data.message || 'Failed to update order');
        setSubmitting(false);
        setUpdatingStatus(null);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update order status');
      setSubmitting(false);
      setUpdatingStatus(null);
    }
  };

  const pollPaymentStatus = async (paymentId: string, orderIdToPoll: string) => {
    const id = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/payments/check-status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentLinkId: paymentId,
            orderId: orderIdToPoll
          })
        });
        const data = await res.json();

        if (data.success && (data.status === "SUCCESS" || data.status === "paid")) {
          clearInterval(id);
          setIsPollingPayment(false);
          setShowCODModal(false);
          setCodPaymentLinkData(null);
          setShowMarkDeliveredModal(true);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 3000);
    setPollIntervalId(id);

    // Stop polling after 5 mins
    setTimeout(() => {
      clearInterval(id);
      setIsPollingPayment(false);
    }, 5 * 60 * 1000);
  };

  const handleGenerateQR = async () => {
    try {
      setIsGeneratingQR(true);
      const isNear = await verifyLocation('generate QR code');
      if (!isNear) {
        setIsGeneratingQR(false);
        return;
      }
      const token = await AsyncStorage.getItem('staffToken');
      const res = await fetch(`${API_URL}/api/route-orders/generate-qr`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          routeOrderId: order?.routeOrderId || id,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCodPaymentLinkData(data.paymentLink);
        setIsPollingPayment(true);
        pollPaymentStatus(data.paymentLink.id, order.orderId);
      } else {
        Alert.alert("Error", data.message || "Failed to generate QR code");
      }
    } catch (err) {
      Alert.alert("Error", "Failed to generate QR code");
    } finally {
      setIsGeneratingQR(false);
    }
  };

  const handleMarkAsPaid = async () => {
    try {
      setSubmitting(true);
      const isNear = await verifyLocation('collect COD');
      if (!isNear) {
        setSubmitting(false);
        return;
      }
      const token = await AsyncStorage.getItem('staffToken');
      const res = await fetch(`${API_URL}/api/route-orders/mark-paid`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          routeOrderId: order?.routeOrderId || id,
          actualReturns: 0
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setShowCODModal(false);
        setShowMarkDeliveredModal(true);
      } else {
        Alert.alert("Error", data.message || "Failed to mark as paid");
      }
    } catch (err) {
      Alert.alert("Error", "Failed to mark as paid");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelQR = () => {
    if (pollIntervalId) clearInterval(pollIntervalId);
    setCodPaymentLinkData(null);
    setIsPollingPayment(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2563EB" />
      </SafeAreaView>
    );
  }

  if (!order) return null;

  const isCompleted = order.deliveryStatus === 'DELIVERED' || order.deliveryStatus === 'NOT_DELIVERED';
  const customer = order.customer;
  const isCOD = order.paymentMethod === 'COD';
  const totalAmount = Math.round(Number(order.amount || order.order?.totalAmount || 0));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }} edges={['top']}>
      {/* Header */}
      <View className="bg-white px-4 py-4 flex-row items-center border-b border-gray-200 shadow-sm z-10">
        <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1">
          <ArrowLeft size={28} color="#111827" />
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-gray-900 flex-1">Order Details</Text>
        <View className={`px-2 py-1 rounded-md ${
          (!order.deliveryStatus || order.deliveryStatus === 'PENDING') ? 'bg-amber-100' : 
          order.deliveryStatus === 'DELIVERED' ? 'bg-green-100' : 'bg-red-100'
        }`}>
          <Text className={`text-sm font-bold ${
            (!order.deliveryStatus || order.deliveryStatus === 'PENDING') ? 'text-amber-800' : 
            order.deliveryStatus === 'DELIVERED' ? 'text-green-800' : 'text-red-800'
          }`}>
            {(!order.deliveryStatus || order.deliveryStatus === 'PENDING') 
              ? (order.status ? order.status.replace(/_/g, ' ') : 'PENDING')
              : order.deliveryStatus.replace(/_/g, ' ')}
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false}>
        {/* Customer Info */}
        <View className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
          <View className="flex-row items-start justify-between mb-2">
            <View className="flex-1">
              <Text className="text-xl font-bold text-gray-900">{customer?.name}</Text>
              {order.address?.nickname ? (
                <Text className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded self-start mt-1.5 border border-blue-100">
                  {order.address.nickname}
                </Text>
              ) : null}
            </View>
            <View className="flex-col items-end">
              <View className="bg-blue-50 px-2.5 py-1.5 rounded border border-blue-100 ml-2">
                <Text className="text-sm font-bold text-blue-700">#{order.orderNumber || order.id.slice(-8).toUpperCase()}</Text>
              </View>
              {order.isReassigned && (
                <View className="flex-row items-center ml-2 mt-2">
                  <Reply size={14} color="#F59E0B" />
                  <Text className="text-xs font-bold text-amber-600 uppercase ml-1">
                    Re-assigned {order.reassignedCount > 0 && `(${order.reassignedCount})`}
                  </Text>
                </View>
              )}
            </View>
          </View>
          
          <View className="flex-row items-start mt-2">
            <MapPin size={18} color="#6B7280" style={{ marginTop: 4, flexShrink: 0 }} />
            <Text className="text-gray-600 ml-2 flex-1 text-base leading-6">
              {order.address?.line1 ? 
                `${order.address.line1}${order.address.area ? ', ' + order.address.area : ''}${order.address.city ? ', ' + order.address.city : ''}${order.address.pincode ? ' - ' + order.address.pincode : ''}` 
                : (customer?.address || 'No address')}
              {(!order.address?.latitude || !order.address?.longitude) && (
                <Text className="text-red-500 font-bold text-sm"> (No GPS Pin)</Text>
              )}
            </Text>
            <TouchableOpacity 
              className="bg-blue-50 px-3.5 py-2 rounded-lg flex-row items-center ml-2 border border-blue-100"
              onPress={() => {
                if (order.address?.latitude && order.address?.longitude) {
                  Linking.openURL(`https://maps.google.com/?q=${order.address.latitude},${order.address.longitude}`);
                } else {
                  Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(customer?.address || order.address?.line1 || '')}`);
                }
              }}
            >
              <Navigation size={16} color="#2563EB" />
              <Text className="text-blue-600 font-bold ml-1.5 text-sm">Maps</Text>
            </TouchableOpacity>
          </View>

          {order.address?.contactName ? (
            <TouchableOpacity 
              className="flex-row items-center mt-3 bg-gray-50 p-3.5 rounded-lg border border-gray-200"
              onPress={() => {
                const phone = order.address?.contactPhone || customer?.phone;
                if (phone) Linking.openURL(`tel:${phone}`);
              }}
            >
              <Text className="text-gray-700 font-medium text-base flex-1">
                Contact: <Text className="font-bold text-gray-900">{order.address.contactName}</Text>
              </Text>
              <View className="flex-row items-center bg-green-50 px-3 py-1.5 rounded border border-green-200">
                <Phone size={16} color="#16A34A" />
                <Text className="text-green-700 font-bold text-sm ml-1.5 uppercase tracking-wide">Call</Text>
              </View>
            </TouchableOpacity>
          ) : null}

          {(!order.address?.contactName && customer?.phone) ? (
            <TouchableOpacity 
              className="flex-row items-center justify-between mt-3 pt-3 border-t border-gray-100"
              onPress={() => {
                if (customer?.phone) Linking.openURL(`tel:${customer.phone}`);
              }}
            >
              <Text className="text-gray-700 font-medium text-base">Customer Phone</Text>
              <View className="bg-green-50 px-4 py-2.5 rounded-lg border border-green-200 flex-row items-center">
                <Phone size={16} color="#16A34A" />
                <Text className="text-green-700 font-bold text-base ml-1.5">Call</Text>
              </View>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Order Info */}
        <View className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
          <Text className="font-bold text-gray-900 mb-3 text-lg">Order Information</Text>
          
          {order.createdAt ? (
            <View className="flex-row justify-between mb-3 pb-3 border-b border-gray-100">
              <Text className="text-gray-600 text-base">Ordered On</Text>
              <Text className="text-base font-bold text-gray-900">
                {new Date(order.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
              </Text>
            </View>
          ) : null}
          {typeof order.totalDepositCans === 'number' && (
            <View className="flex-row justify-between mb-3 pb-3 border-b border-gray-100">
              <Text className="text-gray-600 text-base">Total Deposit Cans</Text>
              <Text className="text-base font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md">{order.totalDepositCans}</Text>
            </View>
          )}

          {order.items && order.items.length > 0 ? (
            <View className="mb-3 pb-3 border-b border-gray-100">
              <Text className="text-gray-600 text-base mb-2 font-medium">Items Breakdown</Text>
              {order.items.map((item: any, idx: number) => (
                <View key={idx} className="flex-row justify-between items-center mb-1 bg-gray-50 p-2.5 rounded">
                  <Text className="text-gray-900 text-base font-medium">{item.quantity}x {item.productName}</Text>
                  <Text className="text-gray-700 text-base font-bold">₹{item.price * item.quantity}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View className="flex-row justify-between mb-3 pb-3 border-b border-gray-100">
              <Text className="text-gray-600 text-base">Total Items</Text>
              <Text className="text-base font-bold text-gray-900">{order.quantity || 0} Items</Text>
            </View>
          )}

          <View className="flex-row justify-between mb-3 pb-3 border-b border-gray-100">
            <Text className="text-gray-600 text-base">Total Amount</Text>
            <Text className="font-bold text-gray-900 text-xl">₹{Math.round(Number(order.amount || order.order?.totalAmount || 0))}</Text>
          </View>
          
          <View className="flex-row justify-between">
            <Text className="text-gray-600 text-base">Payment Method</Text>
            <Text className={`text-base font-bold ${isCOD ? 'text-orange-600' : 'text-green-600'}`}>
              {order.isQrPayment 
                ? `QR (${order.paymentInstrument || 'UPI'})`
                : (order.paymentMethod === 'ONLINE')
                  ? `ONLINE (${order.paymentInstrument || 'UPI'})`
                  : (order.paymentMethod || order.paymentStatus || 'N/A')}
            </Text>
          </View>
        </View>

        {/* Action Form (Only if PENDING) */}
        {!isCompleted ? (
          order.status === 'OUT_FOR_DELIVERY' ? (
            <View className="mb-8">
            <Text className="font-bold text-gray-900 mb-3 ml-1 text-lg">Update Status</Text>

            {/* Shift Check before Action Buttons */}
            {shiftStatus !== 'ACTIVE' ? (
              <View className="bg-gray-100 p-4 rounded-xl items-center border border-gray-200">
                <Text className="text-gray-500 text-base font-bold">
                  {shiftStatus === 'NOT_STARTED' ? 'Start shift to deliver' : 
                   shiftStatus === 'PAUSED' ? 'Resume shift to deliver' : 'Shift ended'}
                </Text>
              </View>
            ) : (
              <>
                {/* Action Buttons */}
                {isCOD && order.paymentStatus !== 'SUCCESS' ? (
              <View className="mb-8 flex-row gap-3">
                <TouchableOpacity 
                  className="flex-1 bg-red-50 border border-red-200 py-4 rounded-xl items-center"
                  onPress={() => setShowReasonModal(true)}
                  disabled={submitting}
                >
                  {updatingStatus === 'NOT_DELIVERED' && !showMarkDeliveredModal ? <ActivityIndicator color="#DC2626" /> : (
                    <Text className="text-red-600 font-bold text-xl">Not Delivered</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity 
                  className="flex-1 bg-blue-600 py-4 rounded-xl items-center shadow-sm flex-row justify-center"
                  onPress={() => setShowCODModal(true)}
                  disabled={submitting}
                >
                  <Banknote size={24} color="#fff" style={{ marginRight: 8 }} />
                  <Text className="text-white font-bold text-xl">Collect COD</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="mb-8 flex-row gap-3">
                <TouchableOpacity 
                  className="flex-1 bg-red-50 border border-red-200 py-4 rounded-xl items-center"
                  onPress={() => setShowReasonModal(true)}
                  disabled={submitting}
                >
                  {updatingStatus === 'NOT_DELIVERED' && !showMarkDeliveredModal ? <ActivityIndicator color="#DC2626" /> : (
                    <Text className="text-red-600 font-bold text-xl">Not Delivered</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity 
                  className="flex-1 bg-green-600 py-4 rounded-xl items-center shadow-sm flex-row justify-center"
                  onPress={() => handleUpdateStatus('DELIVERED')}
                  disabled={submitting}
                >
                  {updatingStatus === 'DELIVERED' && !showMarkDeliveredModal ? <ActivityIndicator color="#fff" style={{ marginRight: 8 }} /> : null}
                  <Text className="text-white font-bold text-xl">Delivered</Text>
                </TouchableOpacity>
              </View>
            )}
              </>
            )}
            </View>
          ) : null
        ) : (
          <View className="mb-8 bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <Text className="font-bold text-gray-900 mb-3 text-lg">Delivery Status</Text>
            {order.deliveryStatus === 'DELIVERED' ? (
              <View className="bg-green-50 p-4 rounded-xl border border-green-100 flex-row items-center">
                <View className="bg-green-100 p-2.5 rounded-full mr-4">
                  <Package size={24} color="#16A34A" />
                </View>
                <View className="flex-1">
                  <Text className="text-green-800 font-bold text-xl">Delivered</Text>
                  {order.updatedAt ? (
                    <Text className="text-green-700 mt-1 text-base">
                      {new Date(order.updatedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : (
              <View className="bg-red-50 p-4 rounded-xl border border-red-100 flex-row items-start">
                <View className="bg-red-100 p-2.5 rounded-full mr-4 mt-1">
                  <XCircle size={24} color="#DC2626" />
                </View>
                <View className="flex-1">
                  <Text className="text-red-800 font-bold text-xl">Not Delivered</Text>
                  {order.notDeliveredReason ? (
                    <Text className="text-red-700 font-medium mt-1 text-base">Reason: {order.notDeliveredReason}</Text>
                  ) : null}
                  {order.updatedAt ? (
                    <Text className="text-red-600 mt-1 text-base">
                      {new Date(order.updatedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                    </Text>
                  ) : null}
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* COD Collection Modal */}
      <Modal
        visible={showCODModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          if (!isPollingPayment) setShowCODModal(false);
        }}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-6 min-h-[300px]">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold text-gray-900">Collect Payment</Text>
              {!isPollingPayment && (
                <TouchableOpacity onPress={() => setShowCODModal(false)}>
                  <XCircle size={24} color="#6B7280" />
                </TouchableOpacity>
              )}
            </View>

            {codPaymentLinkData ? (
              <View className="items-center">
                <View className="bg-white p-4 rounded-xl border-2 border-gray-200 mb-4">
                  <Image
                    source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(codPaymentLinkData.short_url)}` }}
                    style={{ width: 200, height: 200 }}
                  />
                </View>
                <Text className="text-2xl font-black text-gray-900 mb-1">₹{codPaymentLinkData.amount}</Text>
                <Text className="text-gray-500 mb-4">Scan using PhonePe, GPay, Paytm</Text>
                
                <View className="bg-blue-50 p-3 rounded-lg flex-row items-center justify-center w-full mb-4">
                  <ActivityIndicator color="#2563EB" size="small" style={{ marginRight: 8 }} />
                  <Text className="text-blue-700 font-medium">Waiting for payment...</Text>
                </View>

                <TouchableOpacity 
                  className="w-full border border-gray-300 py-4 rounded-xl items-center"
                  onPress={handleCancelQR}
                >
                  <Text className="text-gray-700 font-bold">Cancel QR Code</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="space-y-4">
                <View className="bg-gray-50 p-4 rounded-xl mb-4 items-center">
                  <Text className="text-gray-500 text-sm mb-1">Total Amount Due</Text>
                  <Text className="text-3xl font-black text-gray-900">₹{totalAmount}</Text>
                </View>

                <TouchableOpacity 
                  className="w-full bg-blue-600 py-4 rounded-xl items-center shadow-sm flex-row justify-center mb-3"
                  onPress={handleMarkAsPaid}
                  disabled={submitting || isGeneratingQR}
                >
                  {submitting ? <ActivityIndicator color="#fff" /> : (
                    <>
                      <Banknote size={20} color="#fff" style={{ marginRight: 8 }} />
                      <Text className="text-white font-bold text-lg">Cash Collected</Text>
                    </>
                  )}
                </TouchableOpacity>

                <View className="flex-row items-center my-2">
                  <View className="flex-1 h-px bg-gray-200" />
                  <Text className="mx-4 text-gray-400 font-medium uppercase text-xs">Or pay online</Text>
                  <View className="flex-1 h-px bg-gray-200" />
                </View>

                <TouchableOpacity 
                  className="w-full border border-blue-200 bg-blue-50 py-4 rounded-xl items-center flex-row justify-center mt-3"
                  onPress={handleGenerateQR}
                  disabled={submitting || isGeneratingQR}
                >
                  {isGeneratingQR ? <ActivityIndicator color="#2563EB" /> : (
                    <>
                      <QrCode size={20} color="#2563EB" style={{ marginRight: 8 }} />
                      <Text className="text-blue-700 font-bold text-lg">Generate Payment QR</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Not Delivered Reason Modal */}
      <Modal
        visible={showReasonModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowReasonModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-6 max-h-[70%]">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold text-gray-900">Select Reason</Text>
              <TouchableOpacity onPress={() => setShowReasonModal(false)}>
                <XCircle size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {reasons.length > 0 ? (
                reasons.map((reason: string, index: number) => (
                  <TouchableOpacity
                    key={index}
                    className="py-4 border-b border-gray-100 flex-row items-center justify-between"
                    onPress={() => {
                      setNotDeliveredReason(reason);
                      setShowReasonModal(false);
                      setTimeout(() => handleUpdateStatus('NOT_DELIVERED', reason), 300);
                    }}
                  >
                    <Text className="text-lg text-gray-800">{reason}</Text>
                  </TouchableOpacity>
                ))
              ) : (
                <Text className="text-gray-500 text-center py-4">No reasons configured by admin.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Mark Delivered Modal (Auto shown after payment) */}
      <Modal
        visible={showMarkDeliveredModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View className="flex-1 bg-black/50 justify-center items-center p-6">
          <View className="bg-white rounded-3xl p-6 w-full max-w-sm items-center shadow-lg">
            <View className="bg-green-100 p-5 rounded-full mb-5">
              <Banknote size={36} color="#16A34A" />
            </View>
            <Text className="text-2xl font-black text-gray-900 mb-2">Payment Received</Text>
            <Text className="text-gray-500 text-center mb-8 text-base">
              The payment has been successfully recorded. You must mark this order as delivered to continue.
            </Text>
            
            <TouchableOpacity 
              className={`w-full py-4 rounded-xl items-center shadow-sm flex-row justify-center ${submitting ? 'bg-green-700' : 'bg-green-600'}`}
              onPress={() => handleUpdateStatus('DELIVERED')}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />
              ) : (
                <Package size={20} color="#fff" style={{ marginRight: 8 }} />
              )}
              <Text className="text-white font-bold text-lg">
                {submitting ? 'Updating...' : 'Mark as Delivered'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View className="flex-1 bg-black/50 justify-center px-4">
          <View className="bg-white rounded-2xl p-6 items-center">
            <View className="w-full flex-row justify-end mb-2">
              <TouchableOpacity onPress={() => {
                setShowSuccessModal(false);
                router.back();
              }}>
                <XCircle size={28} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            
            <View className={`p-4 rounded-full mb-4 ${successStatus === 'DELIVERED' ? 'bg-green-100' : 'bg-red-100'}`}>
              {successStatus === 'DELIVERED' ? (
                <CheckCircle2 size={48} color="#16A34A" />
              ) : (
                <XCircle size={48} color="#DC2626" />
              )}
            </View>
            
            <Text className="text-xl font-bold text-gray-900 text-center mb-2">Success!</Text>
            <Text className="text-gray-600 text-center mb-6 text-base">
              Order has been marked as {successStatus === 'DELIVERED' ? 'Delivered' : 'Not Delivered'}
            </Text>
            
            <TouchableOpacity 
              className="w-full bg-blue-600 py-3.5 rounded-xl items-center shadow-sm"
              onPress={() => {
                setShowSuccessModal(false);
                router.back();
              }}
            >
              <Text className="text-white font-bold text-lg">OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
