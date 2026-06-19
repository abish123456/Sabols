import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Phone, Send, CheckCircle2, ArrowLeft, AlertCircle } from 'lucide-react-native';
import { apiFetch } from '../lib/api';

const COUNTRY_CODE = '+91';
const MAX_LENGTH = 10;
const PATTERN = /^[6-9]\d{9}$/;

export default function LoginPage() {
  const router = useRouter();
  const [isSendingOTP, setIsSendingOTP] = useState(false);
  const [isVerifyingOTP, setIsVerifyingOTP] = useState(false);
  const [error, setError] = useState('');
  const [phoneSent, setPhoneSent] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [reqId, setReqId] = useState('');

  const handlePhoneSubmit = async (phone) => {
    setIsSendingOTP(true);
    setError('');
    setPhoneNumber(phone);

    try {
      const response = await apiFetch('/api/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      });

      const data = await response.json();

      if (response.ok) {
        setReqId(data.reqId);
        setPhoneSent(true);
      } else {
        setError(data.message || 'Failed to send OTP. Please try again.');
      }
    } catch (err) {
      console.error('Error sending OTP:', err);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsSendingOTP(false);
    }
  };

  const handleOTPSubmit = async (otp) => {
    setIsVerifyingOTP(true);
    setError('');

    try {
      const response = await apiFetch('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ phone: phoneNumber, otp, reqId }),
      });

      const data = await response.json();

      if (response.ok) {
        await AsyncStorage.setItem('isLoggedIn', 'true');

        const previousPhone = await AsyncStorage.getItem('userPhone');
        const lastUserPhone = await AsyncStorage.getItem('lastUserPhone');

        const isDifferentUser = previousPhone && previousPhone !== phoneNumber;
        const wasDifferentUserLastTime = lastUserPhone && lastUserPhone !== phoneNumber;

        if (data.isNewUser || isDifferentUser || wasDifferentUserLastTime) {
          await AsyncStorage.removeItem('cart');
        }

        await AsyncStorage.setItem('userPhone', phoneNumber);
        await AsyncStorage.setItem('lastUserPhone', phoneNumber);

        if (data.isNewUser) {
          await AsyncStorage.setItem('isNewUserFlow', 'true');
          router.replace('/profile');
        } else {
          await AsyncStorage.removeItem('isNewUserFlow');
          router.replace('/(tabs)/items');
        }
      } else {
        setError(data.message || 'Invalid OTP. Please try again.');
      }
    } catch (err) {
      console.error('Error verifying OTP:', err);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsVerifyingOTP(false);
    }
  };

  const handleResendOTP = async () => {
    setIsSendingOTP(true);
    setError('');

    try {
      const response = await apiFetch('/api/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ phone: phoneNumber }),
      });

      const data = await response.json();

      if (response.ok) {
        setReqId(data.reqId);
        setError('');
        return { success: true };
      } else {
        setError(data.message || 'Failed to resend OTP.');
        return { success: false, retryAfter: data.retryAfter };
      }
    } catch (err) {
      console.error('Error resending OTP:', err);
      setError('Network error. Please check your connection and try again.');
      return { success: false };
    } finally {
      setIsSendingOTP(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-[#f3f7fb]"
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}>
        <View className="bg-white rounded-2xl shadow-sm p-6 w-full max-w-md self-center border border-sky-100">
          <View className="items-center mb-6">
            <View className="w-24 h-24 rounded-full items-center justify-center mb-3 overflow-hidden bg-white shadow-sm border border-gray-100">
              <Image source={require('../assets/icon.png')} className="w-full h-full" resizeMode="contain" />
            </View>
            <Text className="text-3xl font-bold text-black">SABOLS</Text>
            <Text className="text-base text-gray-500 mt-1">Watercan Ordering System</Text>
          </View>

          {error ? (
            <View className="flex-row items-center bg-red-50 p-3 rounded-lg mb-4 border border-red-200">
              <AlertCircle size={16} color="#ef4444" />
              <Text className="text-red-500 ml-2 text-sm flex-1">{error}</Text>
            </View>
          ) : null}

          {!phoneSent ? (
            <PhoneInput onPhoneSubmit={handlePhoneSubmit} isSending={isSendingOTP} />
          ) : (
            <OTPInput
              phoneNumber={phoneNumber}
              onOTPSubmit={handleOTPSubmit}
              onResend={handleResendOTP}
              onChangeNumber={() => {
                setPhoneSent(false);
                setError('');
              }}
              isVerifying={isVerifyingOTP}
              isSending={isSendingOTP}
            />
          )}
        </View>

        <Text className="text-center text-xs text-gray-500 mt-6">
          By continuing, you agree to our Payment Policy
        </Text>
        
        <View className="items-center justify-center mt-8 pb-4">
          <Text className="text-xs text-gray-400">Powered by</Text>
          <TouchableOpacity onPress={() => Linking.openURL('https://www.stedaxis.com')}>
            <Text className="text-sm font-bold text-gray-500 mt-1">STEDAXIS</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PhoneInput({ onPhoneSubmit, isSending }) {
  const [phone, setPhone] = useState('');
  const [localError, setLocalError] = useState('');

  const handleSubmit = () => {
    setLocalError('');
    const cleanPhone = phone.replace(/\D/g, '');

    if (cleanPhone.length < MAX_LENGTH) {
      setLocalError(`Phone number must be ${MAX_LENGTH} digits`);
      return;
    }

    if (!PATTERN.test(cleanPhone)) {
      setLocalError('Please enter a valid 10-digit Indian mobile number');
      return;
    }

    onPhoneSubmit(COUNTRY_CODE + cleanPhone);
  };

  const handleChange = (text) => {
    const digitsOnly = text.replace(/\D/g, '');
    if (digitsOnly.length <= MAX_LENGTH) {
      setPhone(digitsOnly);
      setLocalError('');
    }
  };

  return (
    <View className="space-y-4">
      <Text className="text-lg font-semibold text-black mb-2">Login with Phone number</Text>
      
      <View className="flex-row items-center mb-4">
        <View className="bg-gray-100 px-3 py-3 rounded-l-md border border-gray-300 border-r-0">
          <Text className="text-gray-700 font-medium">{COUNTRY_CODE}</Text>
        </View>
        <View className="flex-1 relative flex-row items-center border border-gray-300 rounded-r-md bg-white">
          <View className="pl-3">
            <Phone size={16} color="#9ca3af" />
          </View>
          <TextInput
            className="flex-1 py-3 px-2 text-black"
            placeholder="Enter your 10-digit mobile number"
            value={phone}
            onChangeText={handleChange}
            keyboardType="phone-pad"
            maxLength={MAX_LENGTH}
            editable={!isSending}
          />
        </View>
      </View>
      
      {localError ? (
        <Text className="text-red-500 text-sm mb-4">{localError}</Text>
      ) : null}

      <TouchableOpacity
        onPress={handleSubmit}
        disabled={isSending || phone.length < MAX_LENGTH}
        className={`w-full py-3 rounded-md flex-row justify-center items-center ${isSending || phone.length < MAX_LENGTH ? 'bg-sky-300' : 'bg-[#0ea5e9]'}`}
      >
        {isSending ? (
          <ActivityIndicator size="small" color="white" className="mr-2" />
        ) : (
          <Send size={16} color="white" className="mr-2" />
        )}
        <Text className="text-white font-semibold text-base">{isSending ? 'Sending OTP...' : 'Send OTP'}</Text>
      </TouchableOpacity>
    </View>
  );
}

function OTPInput({ phoneNumber, onOTPSubmit, onResend, onChangeNumber, isVerifying, isSending }) {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [cooldown, setCooldown] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef([]);

  useEffect(() => {
    let timer;
    if (cooldown > 0 && !canResend) {
      timer = setInterval(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
    } else if (cooldown === 0) {
      setCanResend(true);
    }
    return () => clearInterval(timer);
  }, [cooldown, canResend]);

  const handleResendClick = async () => {
    if (!canResend || isSending || isVerifying) return;
    setCanResend(false);
    setOtp(['', '', '', '', '', '']);
    
    const result = await onResend();
    if (result?.success) {
      setCooldown(60);
    } else if (result?.retryAfter) {
      setCooldown(result.retryAfter);
    } else {
      setCooldown(60);
    }
  };

  const handleChange = (text, index) => {
    if (text.length > 1) {
      // Handle paste
      const digits = text.replace(/\D/g, '').slice(0, 6).split('');
      if (digits.length === 6) {
        setOtp(digits);
        onOTPSubmit(digits.join(''));
        return;
      }
    }

    const value = text.replace(/[^0-9]/g, '');
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1].focus();
    }

    if (newOtp.every(digit => digit !== '') && newOtp.length === 6) {
      onOTPSubmit(newOtp.join(''));
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1].focus();
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
    }
  };

  return (
    <View className="space-y-4">
      <View className="items-center mb-4">
        <Text className="text-lg font-semibold text-black">Enter OTP</Text>
        <Text className="text-sm text-gray-500 text-center mt-1">
          We've sent a 6-digit code to{'\n'}
          <Text className="font-medium text-black">{phoneNumber}</Text>
        </Text>
      </View>

      <View className="flex-row justify-center gap-2 mb-6">
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={(el) => (inputRefs.current[index] = el)}
            className="w-11 h-12 border border-gray-300 rounded-md text-center text-lg font-semibold bg-white text-black"
            value={digit}
            onChangeText={(text) => handleChange(text, index)}
            onKeyPress={(e) => handleKeyPress(e, index)}
            keyboardType="numeric"
            maxLength={1}
            editable={!isVerifying}
          />
        ))}
      </View>

      <TouchableOpacity
        onPress={() => onOTPSubmit(otp.join(''))}
        disabled={isVerifying || otp.some(d => !d)}
        className={`w-full py-3 rounded-md flex-row justify-center items-center ${isVerifying || otp.some(d => !d) ? 'bg-sky-300' : 'bg-[#0ea5e9]'} mb-4`}
      >
        {isVerifying ? (
          <ActivityIndicator size="small" color="white" className="mr-2" />
        ) : (
          <CheckCircle2 size={16} color="white" className="mr-2" />
        )}
        <Text className="text-white font-semibold text-base">{isVerifying ? 'Verifying...' : 'Verify OTP'}</Text>
      </TouchableOpacity>

      <View className="items-center space-y-4 border-t border-gray-100 pt-4 mt-2">
        <View className="items-center">
          <Text className="text-xs text-gray-500 mb-1">Didn't receive the code?</Text>
          <TouchableOpacity 
            onPress={handleResendClick} 
            disabled={!canResend || isSending || isVerifying}
          >
            <Text className={`text-sm ${canResend ? 'text-[#0ea5e9]' : 'text-gray-400'}`}>
              {isSending ? 'Sending...' : !canResend ? `Resend OTP in ${cooldown}s` : 'Resend OTP'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          onPress={onChangeNumber}
          disabled={isVerifying || isSending}
          className="flex-row items-center mt-2"
        >
          <ArrowLeft size={14} color="#6b7280" className="mr-1" />
          <Text className="text-sm text-gray-500">Change Phone Number</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
