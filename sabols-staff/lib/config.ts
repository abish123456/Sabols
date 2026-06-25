import Constants from "expo-constants";

// Get the local IP address for development
const localHost = Constants.expoConfig?.hostUri
  ? Constants.expoConfig.hostUri.split(`:`)[0]
  : "192.168.1.121"; // Explicitly set to your PC's IP

export const API_URL = "https://vera-mobile-app.vercel.app/shop";
