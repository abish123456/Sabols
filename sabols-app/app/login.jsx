import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image, Linking, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Phone, Send, CheckCircle2, ArrowLeft, AlertCircle } from 'lucide-react-native';
import { apiFetch } from '../lib/api';
import PaymentPolicy from '../components/PaymentPolicy';
import { registerForPushNotificationsAsync } from '../hooks/usePushNotifications';


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
  const [globalCooldown, setGlobalCooldown] = useState(0);

  useEffect(() => {
    let timer;
    if (globalCooldown > 0) {
      timer = setInterval(() => {
        setGlobalCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [globalCooldown]);

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
        if (data.retryAfter) {
          setGlobalCooldown(data.retryAfter);
          setError('');
        } else {
          setError(data.message || 'Failed to send OTP. Please try again.');
        }
      }
    } catch (err) {
      console.error('Error sending OTP:', err);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsSendingOTP(false);
    }
  };

  const handleOTPSubmit = async (otp, force = false, preAuthToken = null) => {
    setIsVerifyingOTP(true);
    setError('');

    try {
      // If no local token exists (fresh install / uninstall-reinstall), silently force
      // overwrite the old server session without showing the "other device" dialog.
      const existingToken = await AsyncStorage.getItem('authToken');
      const shouldForce = force || !existingToken;

      const response = await apiFetch('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ phone: phoneNumber, otp, reqId, force: shouldForce, ...(preAuthToken ? { preAuthToken } : {}) }),
      });

      const data = await response.json();

      if (response.status === 409 && data.errorType === 'EXISTING_SESSION') {
        // Another device is logged in AND we have a local token (genuine multi-device case)
        const receivedPreAuthToken = data.preAuthToken;
        setIsVerifyingOTP(false);
        Alert.alert(
          'Already Logged In',
          'You are already logged in on another device. Do you want to log in here and log out from there?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Yes, Log In Here',
              style: 'destructive',
              onPress: () => handleOTPSubmit(otp, true, receivedPreAuthToken),
            },
          ]
        );
        return;
      }

      if (response.ok) {
        await AsyncStorage.setItem('isLoggedIn', 'true');
        if (data.token) {
          await AsyncStorage.setItem('authToken', data.token);
          
          // Send push token to backend immediately after successful login
          try {
             const token = await registerForPushNotificationsAsync();
             if (token) {
               const pushRes = await apiFetch('/api/user/push-token', {
                 method: 'POST',
                 headers: { 'Authorization': `Bearer ${data.token}` },
                 body: JSON.stringify({ pushToken: token }),
               });
               
               if (pushRes.ok) {
                 await AsyncStorage.setItem('pushTokenSent', 'true');
                 // Alert.alert('Success', 'Push token successfully registered with server!');
               } else {
                 const text = await pushRes.text();
                 Alert.alert('Push Registration Failed', `Server responded with ${pushRes.status}: ${text}`);
               }
             } else {
               Alert.alert('Push Registration Failed', 'Could not generate a token from Expo. Please check your internet connection or Google Play Services.');
             }
          } catch (e) {
             Alert.alert('Push Registration Error', e.message || 'Unknown error occurred while generating or sending push token.');
             console.log("Could not register push token after login", e);
          }
        }

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
          router.replace({ pathname: '/(tabs)/profile', params: { isNewUser: 'true' } });
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
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
            <PhoneInput 
              onPhoneSubmit={handlePhoneSubmit} 
              isSending={isSendingOTP} 
              cooldown={globalCooldown} 
            />) : (
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

        <View className="flex-row items-center justify-center mt-6 flex-wrap">
          <Text className="text-xs text-gray-500">By continuing, you agree to our </Text>
          <PaymentPolicy />
        </View>
        
        <View className="flex-row items-center justify-center mt-8 pb-4">
          <Text className="text-xs font-medium text-gray-400 mr-1.5">Powered by</Text>
          <TouchableOpacity onPress={() => Linking.openURL('https://www.stedaxis.com').catch(() => {})}>
            <Image source={require('../assets/stedaxis_logo.png')} style={{ width: 70, height: 14 }} resizeMode="contain" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PhoneInput({ onPhoneSubmit, isSending, cooldown = 0 }) {
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
        disabled={isSending || phone.length < MAX_LENGTH || cooldown > 0}
        className={`w-full py-3 rounded-md flex-row justify-center items-center ${isSending || phone.length < MAX_LENGTH || cooldown > 0 ? 'bg-sky-300' : 'bg-[#0ea5e9]'}`}
      >
        {isSending ? (
          <ActivityIndicator size="small" color="white" className="mr-2" />
        ) : cooldown > 0 ? (
          null
        ) : (
          <Send size={16} color="white" className="mr-2" />
        )}
        <Text className="text-white font-semibold text-base">
          {isSending ? 'Sending OTP...' : cooldown > 0 ? `Try again in ${cooldown}s` : 'Send OTP'}
        </Text>
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
    const cleaned = text.replace(/\D/g, '');
    
    if (cleaned.length > 1) {
      // Handle paste
      const digits = cleaned.slice(0, 6).split('');
      const newOtp = [...otp];
      for (let i = 0; i < digits.length; i++) {
        if (i < 6) {
          newOtp[i] = digits[i];
        }
      }
      setOtp(newOtp);
      
      const lastFilledIndex = Math.min(digits.length - 1, 5);
      if (inputRefs.current[lastFilledIndex]) {
        inputRefs.current[lastFilledIndex].focus();
      }
      
      if (newOtp.every(digit => digit !== '') && newOtp.length === 6) {
        onOTPSubmit(newOtp.join(''));
      }
      return;
    }

    const value = cleaned;
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
            maxLength={6}
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
