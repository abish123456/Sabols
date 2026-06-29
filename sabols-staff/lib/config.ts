import Constants from "expo-constants";

// Get the local IP address for development
const localHost = Constants.expoConfig?.hostUri
  ? Constants.expoConfig.hostUri.split(`:`)[0]
  : "192.168.1.121"; // Explicitly set to your PC's IP

export const API_URL = `http://${localHost}:3000/shop`;
// export const API_URL = "https://mobile-app-vert-kappa.vercel.app/shop";