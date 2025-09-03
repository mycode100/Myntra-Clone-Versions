import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// Check if SecureStore is available (mobile platforms only)
const isSecureStoreAvailable = Platform.OS !== 'web';

export const saveUserData = async (
  _id: string,
  name: string,
  email: string
) => {
  try {
    if (isSecureStoreAvailable) {
      // Use SecureStore for mobile platforms
      await Promise.all([
        SecureStore.setItemAsync("userid", _id),
        SecureStore.setItemAsync("userName", name),
        SecureStore.setItemAsync("userEmail", email)
      ]);
    } else {
      // Use AsyncStorage for web platform
      await Promise.all([
        AsyncStorage.setItem("userid", _id),
        AsyncStorage.setItem("userName", name),
        AsyncStorage.setItem("userEmail", email)
      ]);
    }
  } catch (error) {
    console.error("Error saving user data:", error);
    throw error;
  }
};

export const getUserData = async () => {
  try {
    let _id: string | null;
    let name: string | null;
    let email: string | null;

    if (isSecureStoreAvailable) {
      // Use SecureStore for mobile platforms
      [_id, name, email] = await Promise.all([
        SecureStore.getItemAsync("userid"),
        SecureStore.getItemAsync("userName"),
        SecureStore.getItemAsync("userEmail")
      ]);
    } else {
      // Use AsyncStorage for web platform
      [_id, name, email] = await Promise.all([
        AsyncStorage.getItem("userid"),
        AsyncStorage.getItem("userName"),
        AsyncStorage.getItem("userEmail")
      ]);
    }

    return { _id, name, email };
  } catch (error) {
    console.error("Error getting user data:", error);
    return { _id: null, name: null, email: null };
  }
};

export const clearUserData = async () => {
  try {
    if (isSecureStoreAvailable) {
      // Use SecureStore for mobile platforms
      await Promise.all([
        SecureStore.deleteItemAsync("userid"),
        SecureStore.deleteItemAsync("userName"),
        SecureStore.deleteItemAsync("userEmail")
      ]);
    } else {
      // Use AsyncStorage for web platform
      await Promise.all([
        AsyncStorage.removeItem("userid"),
        AsyncStorage.removeItem("userName"),
        AsyncStorage.removeItem("userEmail")
      ]);
    }
  } catch (error) {
    console.error("Error clearing user data:", error);
    throw error;
  }
};

// Optional: Check if user data exists
export const hasUserData = async (): Promise<boolean> => {
  try {
    const { _id } = await getUserData();
    return _id !== null;
  } catch (error) {
    console.error("Error checking user data:", error);
    return false;
  }
};
