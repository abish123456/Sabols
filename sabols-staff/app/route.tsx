import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert, RefreshControl, Linking, Modal, TextInput, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { LogOut, MapPin, Phone, User, Package, CheckCircle2, XCircle, Clock, Map as MapIcon, LayoutGrid, ChevronRight, RefreshCw, ShoppingBag, Truck, Reply, List, Grid, Banknote, QrCode, AlertTriangle, HelpCircle } from 'lucide-react-native';
import * as Location from 'expo-location';
import { API_URL } from '../lib/config';

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

export default function RouteScreen() {
  const [routeOrders, setRouteOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [staffName, setStaffName] = useState('');
  const [activeTab, setActiveTab] = useState('PENDING');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [summary, setSummary] = useState<any>(null);
  const [returnRequests, setReturnRequests] = useState<any[]>([]);
  const [notDeliveredReasons, setNotDeliveredReasons] = useState<string[]>([]);
  const [confirmingReturnId, setConfirmingReturnId] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [notDeliveredReason, setNotDeliveredReason] = useState<string>('');
  const [customReason, setCustomReason] = useState('');
  const [showCODModal, setShowCODModal] = useState(false);
  const [codPaymentLinkData, setCodPaymentLinkData] = useState<any>(null);
  const [isPollingPayment, setIsPollingPayment] = useState(false);
  const [pollIntervalId, setPollIntervalId] = useState<any>(null);
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [alertModalData, setAlertModalData] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'confirm';
    onConfirm?: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'success'
  });

  const fetchRoute = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('staffToken');
      if (!token) {
        router.replace('/login');
        return;
      }

      const name = await AsyncStorage.getItem('staffName');
      if (name) setStaffName(name);

      const response = await fetch(`${API_URL}/api/delivery/route/today`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        setRouteOrders(data.route ? data.route.orders : []);
        setSummary(data.route?.summary || null);
        setReturnRequests(data.route?.returnRequests || []);
        setNotDeliveredReasons(data.route?.notDeliveredReasons || []);
      } else {
        if (response.status === 401) {
          await AsyncStorage.removeItem('staffToken');
          router.replace('/login');
        } else {
          Alert.alert('Error', data.message || 'Failed to fetch route');
        }
      }
    } catch (error) {
      console.error('Fetch route error:', error);
      Alert.alert('Error', 'Network error while fetching route');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchRoute();
    }, [fetchRoute])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRoute();
  }, [fetchRoute]);

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Logout', 
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('staffToken');
          await AsyncStorage.removeItem('staffName');
          router.replace('/login');
        }
      }
    ]);
  };

  const handleConfirmReturn = async (returnId: string) => {
    try {
      setConfirmingReturnId(returnId);
      const token = await AsyncStorage.getItem('staffToken');
      const res = await fetch(`${API_URL}/api/delivery/can-returns/${returnId}/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        Alert.alert("Success", "Return collection confirmed");
        fetchRoute();
      } else {
        Alert.alert("Error", data.message || "Failed to confirm collection");
      }
    } catch (err) {
      Alert.alert("Error", "Failed to confirm collection");
    } finally {
      setConfirmingReturnId(null);
    }
  };

  const verifyLocation = async (orderId: string, actionName: string): Promise<boolean> => {
    const orderToUpdate = routeOrders.find((o: any) => o.id === orderId || o.order?.id === orderId);
    if (!orderToUpdate?.address?.latitude || !orderToUpdate?.address?.longitude) return true;
    
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
        orderToUpdate.address.latitude,
        orderToUpdate.address.longitude
      );
      if (distance > 100) {
        setAlertModalData({
          visible: true,
          type: 'warning',
          title: 'Too Far',
          message: `You are ${Math.round(distance)} meters away from the delivery location. You must be within 100 meters to ${actionName}.`
        });
        return false;
      }
      return true;
    } catch (error) {
      console.error("Location error:", error);
      Alert.alert('Location Error', 'Could not get your current location. Please try again.');
      return false;
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
          // Mark as delivered automatically
          handleUpdateStatus(orderIdToPoll, 'DELIVERED');
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
    if (!selectedOrderId) return;
    const order = routeOrders.find((o: any) => o.id === selectedOrderId || o.order?.id === selectedOrderId);
    if (!order) return;
    
    try {
      setIsGeneratingQR(true);
      const isNear = await verifyLocation(order.id, 'generate QR code');
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
          routeOrderId: order.routeOrderId || order.id,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCodPaymentLinkData(data.paymentLink);
        setIsPollingPayment(true);
        pollPaymentStatus(data.paymentLink.id, order.id);
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
    if (!selectedOrderId) return;
    const order = routeOrders.find((o: any) => o.id === selectedOrderId || o.order?.id === selectedOrderId);
    if (!order) return;

    try {
      setSubmitting(true);
      const isNear = await verifyLocation(order.id, 'collect COD');
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
          routeOrderId: order.routeOrderId || order.id,
          actualReturns: 0
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setShowCODModal(false);
        handleUpdateStatus(selectedOrderId, 'DELIVERED');
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

  const handleUpdateStatus = async (orderId: string, status: 'DELIVERED' | 'NOT_DELIVERED', payloadReason?: string) => {
    if (status === 'NOT_DELIVERED') {
      if (!notDeliveredReason && !payloadReason) {
        Alert.alert('Error', 'Please provide a reason for not delivering');
        return;
      }
    }

    setUpdatingOrderId(orderId);
    setUpdatingStatus(status);

    if (status === 'DELIVERED') {
      const isNear = await verifyLocation(orderId, 'mark as delivered');
      if (!isNear) {
        setUpdatingOrderId(null);
        setUpdatingStatus(null);
        return;
      }
    }

    try {
      const token = await AsyncStorage.getItem('staffToken');
      
      const order = routeOrders.find((o: any) => o.id === orderId || o.order?.id === orderId);
      const actualRouteOrderId = order?.routeOrderId || orderId;

      const payload: any = {
        routeOrderId: actualRouteOrderId,
        deliveryStatus: status,
      };

      if (status === 'NOT_DELIVERED') {
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
        setShowReasonModal(false);
        setNotDeliveredReason('');
        setCustomReason('');
        fetchRoute(); // Refresh the list
        setAlertModalData({ 
          visible: true, 
          type: 'success',
          title: 'Success!',
          message: `Order has been marked as ${status === 'DELIVERED' ? 'Delivered' : 'Not Delivered'}` 
        });
      } else {
        Alert.alert('Error', data.message || 'Failed to update order');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update order status');
    } finally {
      setUpdatingOrderId(null);
      setUpdatingStatus(null);
    }
  };

  const renderOrderItem = ({ item, index }) => {
    const isDelivered = item.deliveryStatus === 'DELIVERED';
    const isFailed = item.deliveryStatus === 'NOT_DELIVERED';
    const isPending = !item.deliveryStatus || item.deliveryStatus === 'PENDING';
    
    let borderColor = isDelivered ? 'border-l-green-500' : isFailed ? 'border-l-red-500' : 'border-l-orange-400';
    let badgeBg = isDelivered ? 'bg-green-50' : isFailed ? 'bg-red-50' : 'bg-orange-50';
    let badgeText = isDelivered ? 'text-green-700' : isFailed ? 'text-red-700' : 'text-orange-700';

    return (
      <TouchableOpacity 
        className={`bg-white rounded-xl p-3 mb-3 shadow-sm border border-gray-100 border-l-4 ${borderColor}`}
        onPress={() => router.push({
          pathname: `/order/${item.id}`,
          params: { 
            order: JSON.stringify(item),
            reasons: JSON.stringify(notDeliveredReasons)
          }
        })}
      >
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-row">
            <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${badgeBg}`}>
              <Text className={`font-bold text-xl ${badgeText}`}>{index + 1}</Text>
            </View>
            <View className="flex-1 mt-0.5">
              <View className="flex-row justify-between items-center mb-1">
                <Text className="text-sm font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                  #{item.orderNumber || item.id.slice(-8).toUpperCase()}
                </Text>
                
                <View className="flex-col items-end gap-1">
                  <View className={`flex-row items-center px-1.5 py-0.5 rounded ${isDelivered ? 'bg-green-50' : isFailed ? 'bg-red-50' : 'bg-orange-50'}`}>
                    <Text className={`text-sm font-bold mr-1 ${isDelivered ? 'text-green-600' : isFailed ? 'text-red-600' : 'text-orange-600'}`}>
                      {isDelivered ? 'DELIVERED' : isFailed ? 'NOT DELIVERED' : 'DELIVERY IN PROGRESS'}
                    </Text>
                    {isDelivered && <CheckCircle2 size={12} color="#16A34A" strokeWidth={3} />}
                    {isFailed && <XCircle size={10} color="#DC2626" strokeWidth={3} />}
                    {isPending && <Truck size={10} color="#EA580C" strokeWidth={2.5} />}
                  </View>
                  {item.isReassigned && (
                    <View className="flex-row items-center mt-1">
                      <Reply size={12} color="#F59E0B" />
                      <Text className="text-xs font-bold text-amber-600 uppercase ml-1">
                        Re-assigned {item.reassignedCount > 0 && `(${item.reassignedCount})`}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              
              <Text className="text-2xl font-extrabold text-gray-900 mt-1 mb-1.5" numberOfLines={1}>
                {item.customer?.name}
              </Text>
              
              <View className="flex-row items-start pr-2">
                <MapPin size={16} color="#9CA3AF" className="mt-0.5" />
                <Text className="text-gray-500 text-base ml-1.5 leading-5">
                  {item.address?.line1 ? 
                    `${item.address.line1}${item.address.area ? ', ' + item.address.area : ''}${item.address.city ? ', ' + item.address.city : ''}${item.address.pincode ? ' - ' + item.address.pincode : ''}` 
                    : (item.customer?.address || 'No address provided')}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View className="h-px bg-gray-100 my-2 ml-11" />

        <View className="flex-row items-center justify-between ml-11">
          <View className="flex-row items-center">
            <Package size={20} color="#6B7280" />
            <Text className="text-gray-600 ml-1.5 font-medium text-lg">{item.quantity || 0} Items</Text>
          </View>
          <View className="flex-row items-center">
            <Text className="text-blue-600 font-bold text-xl mr-1">₹{Math.round(Number(item.amount || item.order?.totalAmount || 0))}</Text>
            <ChevronRight size={16} color="#9CA3AF" />
          </View>
        </View>

        {isPending && item.status === 'OUT_FOR_DELIVERY' && (
          <View className="flex-row gap-2 mt-3 ml-11 border-t border-gray-100 pt-3">
            <TouchableOpacity 
              className="flex-1 bg-red-50 border border-red-200 py-3 rounded-lg items-center justify-center flex-row"
              onPress={() => {
                setSelectedOrderId(item.id);
                setShowReasonModal(true);
              }}
              disabled={updatingOrderId === item.id}
            >
              {updatingOrderId === item.id && updatingStatus === 'NOT_DELIVERED' ? <ActivityIndicator size="small" color="#DC2626" className="mr-2" /> : null}
              <Text className="text-red-600 font-bold text-base">Not Delivered</Text>
            </TouchableOpacity>

            {item.paymentMethod === 'COD' && item.paymentStatus !== 'SUCCESS' ? (
              <TouchableOpacity 
                className="flex-1 bg-blue-600 py-3 rounded-lg items-center shadow-sm flex-row justify-center"
                onPress={() => {
                  setSelectedOrderId(item.id);
                  setShowCODModal(true);
                }}
                disabled={updatingOrderId === item.id}
              >
                <Text className="text-white font-bold text-base">Collect COD</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                className="flex-1 bg-green-600 py-3 rounded-lg items-center shadow-sm flex-row justify-center"
                onPress={() => {
                  setAlertModalData({
                    visible: true,
                    type: 'confirm',
                    title: "Confirm Delivery",
                    message: "Are you sure you want to mark this order as delivered?",
                    onConfirm: () => handleUpdateStatus(item.id, 'DELIVERED')
                  });
                }}
                disabled={updatingOrderId === item.id}
              >
                {updatingOrderId === item.id && updatingStatus === 'DELIVERED' ? <ActivityIndicator size="small" color="#fff" className="mr-2" /> : null}
                <Text className="text-white font-bold text-base">Delivered</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderGridItem = ({ item, index }) => {
    const isDelivered = item.deliveryStatus === 'DELIVERED';
    const isFailed = item.deliveryStatus === 'NOT_DELIVERED';
    const isPending = !item.deliveryStatus || item.deliveryStatus === 'PENDING';
    
    let borderColor = isDelivered ? 'border-t-green-500' : isFailed ? 'border-t-red-500' : 'border-t-orange-400';
    let badgeBg = isDelivered ? 'bg-green-50' : isFailed ? 'bg-red-50' : 'bg-orange-50';
    let badgeText = isDelivered ? 'text-green-700' : isFailed ? 'text-red-700' : 'text-orange-700';

    return (
      <TouchableOpacity 
        className={`bg-white rounded-xl p-3 shadow-sm border border-gray-100 border-t-4 ${borderColor} flex-1 m-1.5 min-h-[140px]`}
        onPress={() => router.push({
          pathname: `/order/${item.id}`,
          params: { 
            order: JSON.stringify(item),
            reasons: JSON.stringify(notDeliveredReasons)
          }
        })}
      >
        <View className="flex-row justify-between items-start mb-2">
          <View className={`w-8 h-8 rounded-full items-center justify-center ${badgeBg}`}>
            <Text className={`font-bold text-base ${badgeText}`}>{index + 1}</Text>
          </View>
          <Text className="text-xs font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded" numberOfLines={1}>
            #{item.orderNumber || item.id.slice(-6).toUpperCase()}
          </Text>
        </View>
        
        <View className="flex-1 justify-center">
          <Text className="text-lg font-extrabold text-gray-900 mb-1" numberOfLines={2}>
            {item.customer?.name}
          </Text>
          <View className="flex-row items-center mt-1">
            <Package size={14} color="#6B7280" />
            <Text className="text-gray-600 ml-1 font-medium text-sm">{item.quantity || 0} Items</Text>
          </View>
          <View className="flex-row items-center mt-1">
            <Text className="text-blue-600 font-bold text-base">₹{Math.round(Number(item.amount || item.order?.totalAmount || 0))}</Text>
          </View>
        </View>
        
        <View className={`mt-2 flex-row justify-center items-center py-1 rounded-md ${isDelivered ? 'bg-green-50' : isFailed ? 'bg-red-50' : 'bg-orange-50'}`}>
          <Text className={`text-xs font-bold ${isDelivered ? 'text-green-600' : isFailed ? 'text-red-600' : 'text-orange-600'}`}>
            {isDelivered ? 'DELIVERED' : isFailed ? 'NOT DELIVERED' : 'DELIVERY IN PROGRESS'}
          </Text>
        </View>

        {isPending && item.status === 'OUT_FOR_DELIVERY' && (
          <View className="gap-1 mt-2 border-t border-gray-100 pt-2">
            <View className="flex-row gap-1">
              <TouchableOpacity 
                className="flex-1 bg-red-50 border border-red-200 py-1.5 rounded items-center justify-center flex-row"
                onPress={() => {
                  setSelectedOrderId(item.id);
                  setShowReasonModal(true);
                }}
                disabled={updatingOrderId === item.id}
              >
                {updatingOrderId === item.id && updatingStatus === 'NOT_DELIVERED' ? <ActivityIndicator size="small" color="#DC2626" /> : (
                  <Text className="text-red-600 font-bold text-xs">Not Delivered</Text>
                )}
              </TouchableOpacity>

              {item.paymentMethod === 'COD' && item.paymentStatus !== 'SUCCESS' ? (
                <TouchableOpacity 
                  className="flex-1 bg-blue-600 py-1.5 rounded items-center justify-center flex-row"
                  onPress={() => {
                    setSelectedOrderId(item.id);
                    setShowCODModal(true);
                  }}
                  disabled={updatingOrderId === item.id}
                >
                  <Text className="text-white font-bold text-xs">Collect COD</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  className="flex-1 bg-green-600 py-1.5 rounded items-center justify-center flex-row"
                  onPress={() => {
                    setAlertModalData({
                      visible: true,
                      type: 'confirm',
                      title: "Confirm Delivery",
                      message: "Are you sure you want to mark this order as delivered?",
                      onConfirm: () => handleUpdateStatus(item.id, 'DELIVERED')
                    });
                  }}
                  disabled={updatingOrderId === item.id}
                >
                  {updatingOrderId === item.id && updatingStatus === 'DELIVERED' ? <ActivityIndicator size="small" color="#fff" /> : (
                    <Text className="text-white font-bold text-xs">Delivered</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <ActivityIndicator size="large" color="#2563EB" />
        <Text className="mt-4 text-gray-500">Loading your route...</Text>
      </View>
    );
  }

  const totalStops = routeOrders.length;
  const completedStops = routeOrders.filter((o: any) => o.deliveryStatus === 'DELIVERED').length;
  const failedStops = routeOrders.filter((o: any) => o.deliveryStatus === 'NOT_DELIVERED').length;
  const inProgressStops = totalStops - completedStops - failedStops;

  const filteredOrders = routeOrders.filter((item: any) => {
    if (activeTab === 'ALL') return true;
    if (activeTab === 'PENDING') return item.deliveryStatus === 'PENDING' || !item.deliveryStatus;
    if (activeTab === 'COMPLETED') return item.deliveryStatus === 'DELIVERED';
    if (activeTab === 'FAILED') return item.deliveryStatus === 'NOT_DELIVERED';
    return true;
  });

  const ListHeader = () => (
    <View className="mb-3">
      <View className="flex-row justify-between items-center mb-3">
        <View className="flex-row items-end">
          <Text className="text-2xl font-extrabold text-gray-900">Today's Route</Text>
          <Text className="text-gray-400 font-medium ml-2 mb-0.5 text-base">({routeOrders.length} stops)</Text>
        </View>
        <View className="flex-row bg-gray-100 rounded-lg p-0.5">
          <TouchableOpacity 
            onPress={() => setViewMode('list')}
            className={`p-1.5 rounded-md ${viewMode === 'list' ? 'bg-white shadow-sm' : ''}`}
          >
            <List size={16} color={viewMode === 'list' ? '#2563EB' : '#9CA3AF'} />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setViewMode('grid')}
            className={`p-1.5 rounded-md ${viewMode === 'grid' ? 'bg-white shadow-sm' : ''}`}
          >
            <Grid size={16} color={viewMode === 'grid' ? '#2563EB' : '#9CA3AF'} />
          </TouchableOpacity>
        </View>
      </View>

      {routeOrders.length > 0 && (
        <View className="flex-row mb-4 gap-2">
          <TouchableOpacity 
            onPress={() => setActiveTab('PENDING')}
            className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg border ${activeTab === 'PENDING' ? 'bg-blue-600 border-blue-600 shadow-sm shadow-blue-200' : 'bg-white border-gray-200'}`}
          >
            <Clock size={16} color={activeTab === 'PENDING' ? '#fff' : '#F59E0B'} />
            <Text className={`ml-1.5 text-sm font-bold ${activeTab === 'PENDING' ? 'text-white' : 'text-gray-700'}`}>Pending ({inProgressStops})</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setActiveTab('COMPLETED')}
            className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg border ${activeTab === 'COMPLETED' ? 'bg-blue-600 border-blue-600 shadow-sm shadow-blue-200' : 'bg-white border-gray-200'}`}
          >
            <CheckCircle2 size={16} color={activeTab === 'COMPLETED' ? '#fff' : '#10B981'} />
            <Text className={`ml-1.5 text-sm font-bold ${activeTab === 'COMPLETED' ? 'text-white' : 'text-gray-700'}`}>Delivered ({completedStops})</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setActiveTab('FAILED')}
            className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg border ${activeTab === 'FAILED' ? 'bg-blue-600 border-blue-600 shadow-sm shadow-blue-200' : 'bg-white border-gray-200'}`}
          >
            <XCircle size={16} color={activeTab === 'FAILED' ? '#fff' : '#EF4444'} />
            <Text className={`ml-1.5 text-sm font-bold ${activeTab === 'FAILED' ? 'text-white' : 'text-gray-700'}`}>Not Delivered ({failedStops})</Text>
          </TouchableOpacity>
        </View>
      )}

      {returnRequests && returnRequests.length > 0 && activeTab === 'ALL' && (
        <View className="mb-4">
          <View className="flex-row items-center gap-2 mb-3">
            <View className="h-px flex-1 bg-gray-200"></View>
            <Text className="text-sm font-bold text-orange-600 uppercase">Return Requests</Text>
            <View className="h-px flex-1 bg-gray-200"></View>
          </View>
          {returnRequests.map((req, idx) => (
            <View key={req.id || idx} className={`bg-white rounded-xl p-5 mb-4 shadow-sm border ${(req.status === 'COLLECTED' || req.status === 'REFUNDED') ? 'border-gray-200 opacity-70' : 'border-orange-200'}`}>
              <View className="flex-row justify-between mb-1">
                <Text className="text-lg font-bold text-gray-900">{req.customer?.name}</Text>
                <Text className="text-base font-bold text-orange-700">{req.quantity} Cans</Text>
              </View>
              <Text className="text-sm text-gray-500 mb-1">{req.customer?.phone}</Text>
              <View className="flex-row items-center mt-2 bg-gray-50 p-2.5 rounded-lg">
                <MapPin size={14} color="#6B7280" />
                <Text className="text-sm text-gray-600 ml-1.5 flex-1">{req.address?.line1}, {req.address?.area}</Text>
              </View>
              <View className="flex-row justify-between items-center mt-4">
                <Text className="text-sm font-bold text-gray-600">Refund: ₹{Math.round(Number(req.refundAmount || 0))}</Text>
                {req.status !== 'COLLECTED' && req.status !== 'REFUNDED' ? (
                  <TouchableOpacity 
                    className="bg-orange-600 px-4 py-2 rounded-lg"
                    onPress={() => handleConfirmReturn(req.id)}
                    disabled={confirmingReturnId === req.id}
                  >
                    {confirmingReturnId === req.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text className="text-white text-sm font-bold">Confirm Pick Up</Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View className="bg-green-100 px-4 py-2 rounded-lg">
                    <Text className="text-green-700 text-sm font-bold">Collected</Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>
      )}


    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-slate-50 relative">
      <View className="bg-slate-50 px-4 pt-4 pb-2 flex-row justify-between items-center">
        <View className="flex-row items-center flex-wrap">
          <Text className="text-base font-medium text-gray-600 mr-1.5">Welcome,</Text>
          <Text className="text-2xl font-extrabold text-gray-900">{staffName || 'Delivery Staff'}</Text>
          <Text className="text-2xl ml-1">👋</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} className="w-10 h-10 bg-white border border-gray-100 rounded-xl items-center justify-center shadow-sm">
          <LogOut size={18} color="#EF4444" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <View className="flex-1 px-3 pt-2">
        {routeOrders.length === 0 ? (
          <View className="flex-1 justify-center items-center">
            <MapPin size={48} color="#D1D5DB" />
            <Text className="text-xl font-bold text-gray-900 mt-4">No Route Assigned</Text>
            <Text className="text-gray-500 text-center mt-2 px-6">
              You haven't been assigned any route for today. Please check back later or contact the admin.
            </Text>
            <TouchableOpacity 
              className="mt-6 bg-blue-100 px-6 py-3 rounded-full"
              onPress={fetchRoute}
            >
              <Text className="text-blue-700 font-bold">Refresh Route</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            key={viewMode}
            data={filteredOrders}
            keyExtractor={(item) => item.id}
            renderItem={viewMode === 'grid' ? renderGridItem : renderOrderItem}
            numColumns={viewMode === 'grid' ? 2 : 1}
            ListHeaderComponent={ListHeader}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
            columnWrapperStyle={viewMode === 'grid' ? { paddingHorizontal: 4 } : undefined}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563EB']} />
            }
            ListEmptyComponent={() => (
              <View className="py-10 items-center justify-center">
                <Package size={40} color="#D1D5DB" />
                <Text className="text-gray-500 mt-4 text-center">
                  {activeTab === 'PENDING' ? "No pending deliveries." :
                   activeTab === 'COMPLETED' ? "No completed deliveries yet." :
                   activeTab === 'FAILED' ? "No failed deliveries." :
                   "No orders found."}
                </Text>
              </View>
            )}
          />
        )}
      </View>

      {/* Not Delivered Reason Modal */}
      <Modal
        visible={showReasonModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (updatingStatus !== 'NOT_DELIVERED') {
            setShowReasonModal(false);
          }
        }}
      >
        <View className="flex-1 bg-black/50 justify-center px-4">
          <View className="bg-white rounded-2xl p-6">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold text-gray-900">Reason for Non-Delivery</Text>
              {updatingStatus !== 'NOT_DELIVERED' && (
                <TouchableOpacity onPress={() => setShowReasonModal(false)}>
                  <XCircle size={24} color="#6B7280" />
                </TouchableOpacity>
              )}
            </View>

            <View className="flex-col gap-3 mb-6">
              {notDeliveredReasons.map((reason, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => {
                    setNotDeliveredReason(reason);
                    setCustomReason('');
                  }}
                  className={`flex-row items-center p-4 rounded-xl border ${notDeliveredReason === reason ? 'bg-red-50 border-red-500' : 'bg-gray-50 border-gray-200'}`}
                >
                  <View className={`w-5 h-5 rounded-full border-2 items-center justify-center mr-3 ${notDeliveredReason === reason ? 'border-red-600' : 'border-gray-400'}`}>
                    {notDeliveredReason === reason && <View className="w-2.5 h-2.5 rounded-full bg-red-600" />}
                  </View>
                  <Text className={`flex-1 text-base ${notDeliveredReason === reason ? 'text-red-700 font-bold' : 'text-gray-700 font-medium'}`}>
                    {reason}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              className={`w-full py-4 rounded-xl items-center flex-row justify-center ${!notDeliveredReason ? 'bg-red-300' : 'bg-red-600'}`}
              disabled={!notDeliveredReason || updatingStatus === 'NOT_DELIVERED'}
              onPress={() => {
                if (selectedOrderId) {
                  setAlertModalData({
                    visible: true,
                    type: 'confirm',
                    title: "Confirm Non-Delivery",
                    message: "Are you sure you want to mark this order as not delivered?",
                    onConfirm: () => handleUpdateStatus(selectedOrderId, 'NOT_DELIVERED', notDeliveredReason)
                  });
                }
              }}
            >
              {updatingStatus === 'NOT_DELIVERED' ? <ActivityIndicator color="#fff" className="mr-2" /> : null}
              <Text className="text-white font-bold text-lg">Submit Reason</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* COD Collection Modal */}
      <Modal
        visible={showCODModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          if (!isPollingPayment) {
            setShowCODModal(false);
          }
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
                  <Text className="text-3xl font-black text-gray-900">₹{
                    Math.round(Number((routeOrders.find((o: any) => o.id === selectedOrderId || o.order?.id === selectedOrderId) as any)?.amount || 
                    (routeOrders.find((o: any) => o.id === selectedOrderId || o.order?.id === selectedOrderId) as any)?.order?.totalAmount || 0))
                  }</Text>
                </View>

                <TouchableOpacity 
                  className="w-full bg-blue-600 py-4 rounded-xl items-center shadow-sm flex-row justify-center mb-3"
                  onPress={() => {
                    setAlertModalData({
                      visible: true,
                      type: 'confirm',
                      title: "Confirm Payment",
                      message: "Are you sure you have collected the cash and want to mark as delivered?",
                      onConfirm: () => handleMarkAsPaid()
                    });
                  }}
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

      {/* Alert/Confirmation Modal */}
      <Modal
        visible={alertModalData.visible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (alertModalData.type === 'confirm' && alertModalData.onCancel) {
            alertModalData.onCancel();
          }
          setAlertModalData({ ...alertModalData, visible: false });
        }}
      >
        <View className="flex-1 bg-black/50 justify-center px-4">
          <View className="bg-white rounded-2xl p-6 items-center">
            <View className="w-full flex-row justify-end mb-2">
              <TouchableOpacity onPress={() => {
                if (alertModalData.type === 'confirm' && alertModalData.onCancel) {
                  alertModalData.onCancel();
                }
                setAlertModalData({ ...alertModalData, visible: false });
              }}>
                <XCircle size={28} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            
            <View className={`p-4 rounded-full mb-4 ${
              alertModalData.type === 'success' ? 'bg-green-100' : 
              alertModalData.type === 'error' ? 'bg-red-100' : 
              alertModalData.type === 'warning' ? 'bg-orange-100' : 
              'bg-blue-100'
            }`}>
              {alertModalData.type === 'success' && <CheckCircle2 size={48} color="#16A34A" />}
              {alertModalData.type === 'error' && <XCircle size={48} color="#DC2626" />}
              {alertModalData.type === 'warning' && <AlertTriangle size={48} color="#EA580C" />}
              {alertModalData.type === 'confirm' && <HelpCircle size={48} color="#2563EB" />}
            </View>
            
            <Text className="text-xl font-bold text-gray-900 text-center mb-2">{alertModalData.title}</Text>
            <Text className="text-gray-600 text-center mb-6 text-base">{alertModalData.message}</Text>
            
            {alertModalData.type === 'confirm' ? (
              <View className="flex-row gap-3 w-full">
                <TouchableOpacity 
                  className="flex-1 bg-gray-100 py-3.5 rounded-xl items-center"
                  onPress={() => {
                    if (alertModalData.onCancel) alertModalData.onCancel();
                    setAlertModalData({ ...alertModalData, visible: false });
                  }}
                >
                  <Text className="text-gray-700 font-bold text-lg">{alertModalData.cancelText || 'Cancel'}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  className="flex-1 bg-blue-600 py-3.5 rounded-xl items-center shadow-sm"
                  onPress={() => {
                    if (alertModalData.onConfirm) alertModalData.onConfirm();
                    setAlertModalData({ ...alertModalData, visible: false });
                  }}
                >
                  <Text className="text-white font-bold text-lg">{alertModalData.confirmText || 'Confirm'}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity 
                className="w-full bg-blue-600 py-3.5 rounded-xl items-center shadow-sm"
                onPress={() => {
                  if (alertModalData.onConfirm) alertModalData.onConfirm();
                  setAlertModalData({ ...alertModalData, visible: false });
                }}
              >
                <Text className="text-white font-bold text-lg">{alertModalData.confirmText || 'OK'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {updatingOrderId && !showReasonModal && !showCODModal && (
        <View className="absolute top-0 bottom-0 left-0 right-0 z-50 justify-center items-center bg-black/20" pointerEvents="auto">
          <View className="bg-white px-6 py-4 rounded-xl flex-row items-center shadow-lg">
            <ActivityIndicator size="large" color="#2563EB" />
            <Text className="ml-4 font-bold text-gray-800 text-base">Processing...</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
