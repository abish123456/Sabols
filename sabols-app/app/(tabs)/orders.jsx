import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Linking } from 'react-native';
import Toast from 'react-native-toast-message';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Package, Clock, CheckCircle2, XCircle, Truck, AlertCircle, ChevronDown, ChevronUp, Wallet, MapPin, ChevronLeft, ChevronRight, Calendar } from 'lucide-react-native';
import RazorpayCheckout from 'react-native-razorpay';
import { apiFetch } from '../../lib/api';

const LIMIT = 10;

// Sort orders by UTC timestamp descending (latest first) — same as web app
const sortOrdersDesc = (list) => {
  if (!list || !Array.isArray(list)) return [];
  return [...list].sort((a, b) => {
    const dateA = new Date(a.createdAt);
    const dateB = new Date(b.createdAt);
    if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    }
    return dateB.getTime() - dateA.getTime();
  });
};

const getStatusLabel = (order) => {
  const { status, paymentStatus, isAssigned, isRouteGenerated } = order;
  if (status === 'DELIVERED' || status === 'CANCELLED' || status === 'NOT_DELIVERED') {
    return status === 'NOT_DELIVERED' ? 'Not Delivered' : status.replace(/_/g, ' ');
  }
  if (status === 'PENDING' && (paymentStatus === 'SUCCESS' || paymentStatus === 'COD') && !isAssigned) {
    return 'Order Placed';
  }
  if (isAssigned && !isRouteGenerated) return 'Confirmed';
  if (isRouteGenerated || status === 'CONFIRMED' || status === 'OUT_FOR_DELIVERY') return 'Delivery in Progress';
  return status.replace(/_/g, ' ');
};

const canPayNow = (order) =>
  (order.paymentStatus === 'COD' || order.paymentStatus === 'PENDING') &&
  order.status !== 'DELIVERED' &&
  order.status !== 'CANCELLED' &&
  order.status !== 'NOT_DELIVERED';

const formatDateIST = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatTimeIST = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatPaymentStatus = (order) => {
  const { paymentStatus, paymentMethod } = order;
  if (paymentMethod === 'ONLINE' && paymentStatus === 'SUCCESS') return 'Online - Paid';
  switch (paymentStatus) {
    case 'SUCCESS': return 'Paid';
    case 'PENDING': return 'Pending';
    case 'FAILED': return 'Failed';
    case 'COD': return 'COD';
    default: return paymentStatus || 'N/A';
  }
};

const getStatusColor = (status) => {
  switch (status) {
    case 'DELIVERED': return { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' };
    case 'OUT_FOR_DELIVERY':
    case 'CONFIRMED': return { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' };
    case 'CANCELLED':
    case 'NOT_DELIVERED': return { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' };
    default: return { bg: '#fefce8', border: '#fde68a', text: '#92400e' };
  }
};

const getStatusIcon = (status) => {
  switch (status) {
    case 'DELIVERED': return <CheckCircle2 size={14} color="#16a34a" />;
    case 'OUT_FOR_DELIVERY': return <Truck size={14} color="#2563eb" />;
    case 'CONFIRMED': return <CheckCircle2 size={14} color="#2563eb" />;
    case 'CANCELLED': return <XCircle size={14} color="#dc2626" />;
    case 'NOT_DELIVERED': return <AlertCircle size={14} color="#dc2626" />;
    default: return <Clock size={14} color="#ca8a04" />;
  }
};

export default function OrdersScreen() {
  const router = useRouter();
  const searchParams = useLocalSearchParams();

  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [paginationLoading, setPaginationLoading] = useState(false);

  const [expandedOrders, setExpandedOrders] = useState(new Set());
  const [orderItemsMap, setOrderItemsMap] = useState({});
  const [loadingItemsId, setLoadingItemsId] = useState(null);

  const [payingId, setPayingId] = useState(null);
  const [isPaymentSuccess, setIsPaymentSuccess] = useState(false);

  const fetchOrders = useCallback(async (page = 1, showSpinner = true) => {
    try {
      if (showSpinner && page === 1) setIsLoading(true);
      if (page !== 1) setPaginationLoading(true);

      const response = await apiFetch(`/api/orders?page=${page}&limit=${LIMIT}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const sorted = sortOrdersDesc(data.orders || []);
          setOrders(sorted);
          setCurrentPage(data.pagination?.page || page);
          setTotalPages(data.pagination?.totalPages || 1);
          setTotalOrders(data.pagination?.total || 0);
        } else {
          setError(data.message || 'Failed to fetch orders');
        }
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
      if (page === 1) setError('Failed to load orders. Please try again.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
      setPaginationLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders(1);

    // Handle payment=success param from redirect
    if (searchParams?.payment === 'success') {
      setIsPaymentSuccess(true);
      setTimeout(() => setIsPaymentSuccess(false), 3000);
    }
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchOrders(1, false);
  }, [fetchOrders]);

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages || paginationLoading) return;
    fetchOrders(newPage);
  };

  const toggleOrderItems = async (orderId) => {
    if (expandedOrders.has(orderId)) {
      const newExpanded = new Set(expandedOrders);
      newExpanded.delete(orderId);
      setExpandedOrders(newExpanded);
      return;
    }

    const newExpanded = new Set(expandedOrders);
    newExpanded.add(orderId);
    setExpandedOrders(newExpanded);

    if (!orderItemsMap[orderId]) {
      try {
        setLoadingItemsId(orderId);
        const response = await apiFetch(`/api/orders/${orderId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.order) {
            setOrderItemsMap(prev => ({
              ...prev,
              [orderId]: data.order.items || [],
            }));
          }
        }
      } catch (err) {
        console.error('Error fetching order items:', err);
      } finally {
        setLoadingItemsId(null);
      }
    }
  };

  const processPayment = async (order) => {
    setPayingId(order.id);
    try {
      const paymentResponse = await apiFetch('/api/payments/create', {
        method: 'POST',
        body: JSON.stringify({ orderId: order.id, amount: Math.round(order.amount * 100) }),
      });
      const paymentData = await paymentResponse.json();

      if (!paymentResponse.ok || !paymentData.success) {
        throw new Error(paymentData.message || 'Failed to initialize payment');
      }

      const options = {
        description: paymentData.description || `Order #${order.orderNumber || order.id.slice(-8).toUpperCase()}`,
        currency: paymentData.currency || 'INR',
        key: paymentData.key,
        amount: paymentData.amount,
        name: paymentData.name || 'SABOLS',
        order_id: paymentData.orderId,
        prefill: {
          ...(paymentData.prefill?.email ? { email: paymentData.prefill.email } : {}),
          ...(paymentData.prefill?.contact ? { contact: paymentData.prefill.contact } : {}),
          ...(paymentData.prefill?.name ? { name: paymentData.prefill.name } : {}),
        },
        theme: { color: '#0ea5e9' },
      };

      const razorpayRes = await RazorpayCheckout.open(options);

      const verifyResponse = await apiFetch('/api/payments/verify-payment', {
        method: 'POST',
        body: JSON.stringify({
          razorpay_order_id: razorpayRes.razorpay_order_id,
          razorpay_payment_id: razorpayRes.razorpay_payment_id,
          razorpay_signature: razorpayRes.razorpay_signature,
          orderId: order.id,
        }),
      });

      const verifyData = await verifyResponse.json();
      if (verifyResponse.ok && verifyData.success) {
        setIsPaymentSuccess(true);
        setTimeout(() => setIsPaymentSuccess(false), 3000);
        setOrders(prev => sortOrdersDesc(prev.map(o =>
          o.id === order.id ? { ...o, paymentStatus: 'SUCCESS' } : o
        )));
        // Re-fetch to get latest order state
        setTimeout(() => fetchOrders(currentPage, false), 2000);
      } else {
        throw new Error(verifyData.message || 'Verification failed');
      }
    } catch (err) {
      if (err?.code !== 2 && err?.code !== 0) { // code 2 or 0 = user cancelled
        console.error('Payment error:', err);
        Toast.show({ type: 'error', text1: 'Payment Failed', text2: err.message || 'Payment process failed. You can retry from Orders.' });
      }
    } finally {
      setPayingId(null);
    }
  };

  const sortedOrders = useMemo(() => sortOrdersDesc(orders), [orders]);

  if (isLoading && sortedOrders.length === 0) {
    return (
      <View className="flex-1 justify-center items-center bg-[#f3f7fb]">
        <ActivityIndicator size="large" color="#0ea5e9" />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-[#f3f7fb]"
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Payment Success Banner */}
      {isPaymentSuccess && (
        <View className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 flex-row items-center">
          <CheckCircle2 size={20} color="#16a34a" className="mr-2" />
          <Text className="text-green-800 font-semibold flex-1">Payment Successful! Order placed.</Text>
        </View>
      )}

      <View className="flex-row justify-between items-center mb-4">
        <View>
          <Text className="text-2xl font-bold text-black">My Orders</Text>
          <Text className="text-gray-500 text-sm">View your order history and track deliveries</Text>
        </View>
        <TouchableOpacity
          className="bg-[#0ea5e9] px-4 py-2 rounded-md flex-row items-center"
          onPress={() => router.push('/(tabs)/items')}
        >
          <Package size={16} color="white" />
          <Text className="text-white font-semibold ml-1">New Order</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View className="bg-red-50 p-4 rounded-md border border-red-200 mb-4 flex-row items-center">
          <AlertCircle size={20} color="#dc2626" className="mr-2" />
          <Text className="text-red-700 flex-1">{error}</Text>
        </View>
      ) : null}

      {sortedOrders.length === 0 && !error ? (
        <View className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 items-center justify-center mt-4">
          <Package size={48} color="#9ca3af" />
          <Text className="text-lg font-semibold text-black mb-2 mt-4">No orders yet</Text>
          <Text className="text-gray-500 mb-6 text-center">Start ordering water cans to see them here</Text>
          <TouchableOpacity
            className="bg-[#0ea5e9] px-6 py-3 rounded-md"
            onPress={() => router.push('/(tabs)/items')}
          >
            <Text className="text-white font-semibold">Place Your First Order</Text>
          </TouchableOpacity>
        </View>
      ) : (
        sortedOrders.map((order) => {
          const statusColor = getStatusColor(order.status);
          const statusLabel = getStatusLabel(order);
          const items = orderItemsMap[order.id];
          const isExpanded = expandedOrders.has(order.id);

          return (
            <View key={order.id} className="bg-white rounded-xl shadow-sm border border-gray-200 mb-4 overflow-hidden">
              {/* Order Header */}
              <TouchableOpacity onPress={() => toggleOrderItems(order.id)} className="p-4">
                <View className="flex-row justify-between items-start mb-3">
                  <View className="flex-1">
                    <View className="flex-row items-center mb-1">
                      <Package size={16} color="#0ea5e9" />
                      <Text className="text-base font-bold text-black ml-2">
                        Order #{order.orderNumber || order.id.slice(-8).toUpperCase()}
                      </Text>
                    </View>
                    <Text className="text-xs text-gray-500">
                      Placed on {order.createdAtIST || `${formatDateIST(order.createdAt)} at ${formatTimeIST(order.createdAt)}`}
                    </Text>
                  </View>
                  <View
                    style={{ backgroundColor: statusColor.bg, borderColor: statusColor.border, borderWidth: 1 }}
                    className="flex-row items-center px-2 py-1 rounded-full"
                  >
                    {getStatusIcon(order.status)}
                    <Text style={{ color: statusColor.text }} className="text-xs font-bold ml-1">{statusLabel}</Text>
                  </View>
                </View>

                <View className="flex-row justify-between items-center border-t border-gray-100 pt-3">
                  <View>
                    <Text className="text-gray-500 text-xs mb-0.5">Total Amount</Text>
                    <Text className="font-bold text-black">₹{Math.round(Number(order.amount))}</Text>
                    {order.paidAmount > 0 && order.paidAmount < order.amount && (
                      <Text className="text-[10px] text-green-600 font-medium">Paid: ₹{Math.round(Number(order.paidAmount))}</Text>
                    )}
                  </View>
                  <View>
                    <Text className="text-gray-500 text-xs mb-0.5">Payment</Text>
                    <Text className="font-semibold text-black text-sm">{formatPaymentStatus(order)}</Text>
                  </View>
                  {isExpanded ? (
                    <ChevronUp size={20} color="#6b7280" />
                  ) : (
                    <ChevronDown size={20} color="#6b7280" />
                  )}
                </View>
              </TouchableOpacity>

              {/* Expanded Details */}
              {isExpanded && (
                <View className="bg-gray-50 border-t border-gray-200 p-4">
                  {/* Items list */}
                  {loadingItemsId === order.id ? (
                    <ActivityIndicator size="small" color="#0ea5e9" />
                  ) : items && items.length > 0 ? (
                    <View className="mb-3">
                      {items.map((item, idx) => {
                        const itemSubtotal = (item.price || 0) * item.quantity;
                        return (
                          <View key={idx} className="flex-row justify-between items-center mb-2">
                            <Text className="text-black flex-1 text-sm">
                              {item.quantity} × {item.productName}
                            </Text>
                            <Text className="font-semibold text-black text-sm">
                              ₹{itemSubtotal.toFixed(2)}
                            </Text>
                          </View>
                        );
                      })}
                      {/* Subtotal + GST breakdown */}
                      <View className="border-t border-dashed border-gray-300 pt-2 mt-2">
                        {(() => {
                          const sub = items.reduce((s, i) => s + ((i.price || 0) * i.quantity), 0);
                          const gstTotal = items.reduce((s, i) => s + ((i.price || 0) * i.quantity) * ((i.gst || 5.0) / 100), 0);
                          return (
                            <>
                              <View className="flex-row justify-between">
                                <Text className="text-gray-500 text-xs">Subtotal</Text>
                                <Text className="text-gray-600 text-xs">₹{sub.toFixed(2)}</Text>
                              </View>
                              <View className="flex-row justify-between mt-1">
                                <Text className="text-gray-500 text-xs">Total Tax (GST)</Text>
                                <Text className="text-gray-600 text-xs">₹{gstTotal.toFixed(2)}</Text>
                              </View>
                            </>
                          );
                        })()}
                      </View>
                    </View>
                  ) : (
                    <Text className="text-xs text-gray-400 italic mb-3">No item details available</Text>
                  )}

                  {/* Delivery date */}
                  <View className="flex-row items-center mt-2 mb-2">
                    <Calendar size={14} color="#6b7280" />
                    <Text className="text-gray-600 text-xs ml-2">
                      {order.status === 'DELIVERED' ? 'Delivered: ' : 'Expected: '}
                      {order.status === 'DELIVERED'
                        ? (order.updatedAtIST || formatDateIST(order.updatedAt))
                        : (order.deliveryDate ? formatDateIST(order.deliveryDate) : (order.deliverySlot || 'N/A'))}
                    </Text>
                  </View>

                  {/* Delivery Address */}
                  {order.address && (
                    <View className="flex-row items-start mt-1 mb-3">
                      <MapPin size={14} color="#6b7280" />
                      <Text className="text-gray-600 text-xs ml-2 flex-1">
                        {order.address.line1}
                        {order.address.line2 ? `, ${order.address.line2}` : ''}{'\n'}
                        {order.address.city} - {order.address.pincode}
                        {order.address.area ? `, ${order.address.area}` : ''}
                      </Text>
                    </View>
                  )}

                  {/* Action Buttons */}
                  {canPayNow(order) && (
                    <View className="flex-row gap-2 border-t border-gray-200 pt-3 mt-2">
                      <TouchableOpacity
                        className="bg-red-600 px-4 py-2 rounded-md flex-row items-center justify-center flex-1 mr-1"
                        onPress={() => processPayment(order)}
                        disabled={payingId === order.id}
                      >
                        {payingId === order.id ? (
                          <ActivityIndicator size="small" color="white" />
                        ) : (
                          <>
                            <Wallet size={14} color="white" />
                            <Text className="text-white font-semibold text-sm ml-2">
                              Pay ₹{Math.round(order.amount)}
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })
      )}

      {/* Pagination: Previous / Page X of Y / Next */}
      {totalPages > 1 && (
        <View className="flex-row items-center justify-end gap-2 mt-4 mb-8">
          <TouchableOpacity
            onPress={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1 || paginationLoading}
            className={`p-2 border border-gray-300 rounded-md bg-white ${currentPage <= 1 ? 'opacity-40' : ''}`}
          >
            <ChevronLeft size={18} color="#374151" />
          </TouchableOpacity>

          {paginationLoading ? (
            <ActivityIndicator size="small" color="#0ea5e9" />
          ) : (
            <Text className="text-sm font-medium text-gray-700">
              Page {currentPage} of {totalPages}
            </Text>
          )}

          <TouchableOpacity
            onPress={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || paginationLoading}
            className={`p-2 border border-gray-300 rounded-md bg-white ${currentPage >= totalPages ? 'opacity-40' : ''}`}
          >
            <ChevronRight size={18} color="#374151" />
          </TouchableOpacity>
        </View>
      )}

      {/* Powered By STEDAXIS */}
      <View className="items-center justify-center py-6 mt-4 opacity-70">
        <Text className="text-[10px] text-gray-400">Powered by</Text>
        <TouchableOpacity onPress={() => Linking.openURL('https://www.stedaxis.com')}>
          <Text className="text-xs font-bold text-gray-500 mt-0.5 tracking-wider">STEDAXIS</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
