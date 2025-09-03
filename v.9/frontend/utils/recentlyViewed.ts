import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product } from '@/types/product';

const RECENTLY_VIEWED_KEY = 'recently_viewed_products';
const MAX_RECENTLY_VIEWED = 10;

export const addToRecentlyViewed = async (product: Product): Promise<void> => {
  try {
    const existing = await getRecentlyViewed();
    
    // Remove if already exists (to avoid duplicates)
    const filtered = existing.filter(p => p._id !== product._id);
    
    // Add to front, limit to MAX_RECENTLY_VIEWED
    const updated = [product, ...filtered].slice(0, MAX_RECENTLY_VIEWED);
    
    await AsyncStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error saving to recently viewed:', error);
  }
};

export const getRecentlyViewed = async (): Promise<Product[]> => {
  try {
    const data = await AsyncStorage.getItem(RECENTLY_VIEWED_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting recently viewed:', error);
    return [];
  }
};

export const clearRecentlyViewed = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(RECENTLY_VIEWED_KEY);
  } catch (error) {
    console.error('Error clearing recently viewed:', error);
  }
};
