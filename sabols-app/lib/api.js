import AsyncStorage from '@react-native-async-storage/async-storage';

export const BASE_URL = 'https://mobile-app-liard-kappa.vercel.app/shop';

export const getAuthToken = async () => {
  try {
    return await AsyncStorage.getItem('authToken');
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
};

export const apiFetch = async (endpoint, options = {}) => {
  const token = await getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
    // Some backend routes might only check cookies
    headers.Cookie = `token=${token}`;
  }

  // Spoof headers to prevent backend CORS/CSRF/Fraud blocks for payment endpoints
  headers.Origin = 'https://mobile-app-liard-kappa.vercel.app';
  headers.Referer = 'https://mobile-app-liard-kappa.vercel.app/';
  headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  const url = `${BASE_URL}${endpoint}`;
  console.log(`[API] Fetching: ${url}`);
  
  return fetch(url, {
    ...options,
    headers,
  });
};
