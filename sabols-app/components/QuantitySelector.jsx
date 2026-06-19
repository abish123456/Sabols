import { View, TextInput, TouchableOpacity } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';

export default function QuantitySelector({ quantity, onChange, min = 1, max = 100, disabled = false, hasPendingDeposit = false }) {
  const handleDecrement = () => {
    if (quantity > min) {
      onChange(quantity - 1);
    }
  };

  const handleIncrement = () => {
    if (quantity < max) {
      onChange(quantity + 1);
    }
  };

  const handleChangeText = (text) => {
    if (text === '') {
      onChange(min);
      return;
    }
    const val = parseInt(text.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(val)) {
      onChange(Math.max(min, Math.min(max, val)));
    }
  };

  const isDecrementDisabled = disabled || quantity <= min || hasPendingDeposit;
  const isIncrementDisabled = disabled || quantity >= max || hasPendingDeposit;

  return (
    <View className={`flex-row items-center rounded-lg border px-2 py-1 ${hasPendingDeposit ? 'border-gray-200 bg-gray-50' : 'border-blue-300 bg-blue-50'}`}>
      <TouchableOpacity
        onPress={handleDecrement}
        disabled={isDecrementDisabled}
        className={`w-8 h-8 items-center justify-center rounded-md ${isDecrementDisabled ? 'opacity-50' : 'bg-blue-100'}`}
      >
        <Minus size={16} color={hasPendingDeposit ? "#9ca3af" : "#3b82f6"} />
      </TouchableOpacity>

      <TextInput
        value={String(quantity)}
        onChangeText={handleChangeText}
        keyboardType="numeric"
        editable={!disabled && !hasPendingDeposit}
        className={`w-12 h-8 text-center font-bold p-0 ${hasPendingDeposit ? 'text-gray-500' : 'text-blue-700'}`}
      />

      <TouchableOpacity
        onPress={handleIncrement}
        disabled={isIncrementDisabled}
        className={`w-8 h-8 items-center justify-center rounded-md ${isIncrementDisabled ? 'opacity-50' : 'bg-blue-100'}`}
      >
        <Plus size={16} color={hasPendingDeposit ? "#9ca3af" : "#1d4ed8"} />
      </TouchableOpacity>
    </View>
  );
}
