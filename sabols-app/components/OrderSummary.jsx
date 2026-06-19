import { View, Text } from 'react-native';
import { Package, CheckCircle2 } from 'lucide-react-native';
import DeliverySlotSelector from './DeliverySlotSelector';

export default function OrderSummary({ cart, slot, onSlotChange, slotError, subtotal, gst, total, depositInfo, pendingReturns = 0 }) {
  const hasDepositProducts = cart.some(item => (item.depositAmount || 0) > 0);

  return (
    <View className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
      <View className="flex-row items-center mb-3 border-b border-gray-100 pb-2">
        <Package size={20} color="#0ea5e9" className="mr-2" />
        <Text className="text-lg font-bold text-black">Order Summary</Text>
      </View>
      
      {cart.map((item) => (
        <View key={item.id} className="flex-row justify-between mb-2 mt-2">
          <Text className="text-gray-600 flex-1">{item.name} × {item.quantity}</Text>
          <Text className="text-black font-medium">₹{(item.price * item.quantity).toFixed(2)}</Text>
        </View>
      ))}
      
      <View className="mt-2 mb-3">
        <DeliverySlotSelector
          value={slot}
          onChange={onSlotChange}
          error={slotError}
        />
      </View>

      <View className="border-t border-gray-100 pt-3">
        <View className="flex-row justify-between mb-2">
          <Text className="text-gray-600">Subtotal</Text>
          <Text className="text-black font-semibold">₹{subtotal.toFixed(2)}</Text>
        </View>
        <View className="flex-row justify-between mb-2">
          <Text className="text-gray-600">GST</Text>
          <Text className="text-black font-semibold">₹{gst.toFixed(2)}</Text>
        </View>

        {pendingReturns > 0 && (
          <View className="flex-row justify-between mb-2">
            <Text className="text-blue-600 font-medium">Pending Returns Applied</Text>
            <Text className="text-blue-600 font-semibold">{pendingReturns} Cans</Text>
          </View>
        )}

        {(depositInfo?.toPay > 0 || depositInfo?.walletCredit > 0) ? (
          <View className="border-t border-dashed border-gray-200 mt-2 pt-2 mb-2">
            {depositInfo?.toPay > 0 && (
              <View className="flex-row justify-between mb-1">
                <View>
                  <Text className="text-black font-semibold">New Can Charges</Text>
                  {depositInfo.cansRequiringDeposit > 0 && depositInfo.depositRate > 0 && (
                    <Text className="text-xs text-gray-500">
                      ({depositInfo.cansRequiringDeposit} × ₹{depositInfo.depositRate.toFixed(2)})
                    </Text>
                  )}
                </View>
                <Text className="text-black font-semibold">₹{depositInfo.toPay.toFixed(2)}</Text>
              </View>
            )}
            {depositInfo?.walletCredit > 0 && (
              <View className="bg-blue-50 border border-blue-100 rounded-md p-2 mb-1">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <CheckCircle2 size={14} color="#1d4ed8" className="mr-1" />
                    <Text className="text-xs font-bold text-blue-700">Deposit Surplus Available</Text>
                  </View>
                  <Text className="text-xs font-bold text-blue-700">₹{depositInfo.walletCredit.toFixed(2)}</Text>
                </View>
                <Text className="text-[10px] text-blue-600 mt-1">
                  You have a surplus from extra returns. No deposit needed for this order.
                </Text>
              </View>
            )}
          </View>
        ) : hasDepositProducts && (
          <View className="border-t border-dashed border-gray-200 mt-2 pt-2 mb-1">
            <View className="flex-row items-center">
              <CheckCircle2 size={12} color="#2563eb" className="mr-1" />
              <Text className="text-[10px] text-blue-600 italic">20L Can balance adjusted for this order</Text>
            </View>
          </View>
        )}

        <View className="flex-row justify-between items-center mt-2 pt-2 border-t border-gray-200">
          <Text className="text-lg font-bold text-black">Total Amount</Text>
          <Text className="text-xl font-bold text-[#0ea5e9]">₹{Math.round(total)}</Text>
        </View>
      </View>
    </View>
  );
}
