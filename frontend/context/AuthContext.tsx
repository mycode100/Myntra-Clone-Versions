// frontend/context/AuthContext.tsx
import { createContext, useContext, useEffect, useState } from "react";
import { getUserData, saveUserData, clearUserData } from "@/utils/storage";
import { 
  getUserWishlist, 
  getUserBag, 
  handleApiError,
  getBagSummary,
  applyCoupon,
  removeCoupon,
  addToBag
} from "@/utils/api";

// ✅ NEW: Import address API functions
import {
  getUserAddresses,
  getDefaultAddress,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  handleAddressApiError
} from "@/utils/addressApi";

import React from "react";
import axios from "axios";
import { BagItem, WishlistItem, BagSummaryData, CouponResponseData, Address } from "@/types/product";

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

type CouponOperationResult = {
  success: boolean;
  message?: string;
  data?: CouponResponseData;
};

// ✅ ENHANCED: Updated AuthContextType with address management
type AuthContextType = {
  isAuthenticated: boolean;
  user: { _id: string; name: string; email: string } | null;
  isLoading: boolean;
  
  // Auth methods
  Signup: (fullName: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<{ message: string; resetToken?: string }>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  
  // Existing state
  wishlistItems: Map<string, WishlistItem>;
  bagItems: Map<string, BagItem>;
  bagSummary: BagSummaryData | null;
  appliedCoupon: CouponResponseData | null;
  
  // ✅ NEW: Address state
  addresses: Map<string, Address>;
  defaultAddressId: string | null;
  
  // Computed values
  totalBagItems: number;
  totalWishlistItems: number;
  totalAddresses: number;
  bagSubtotal: number;
  
  // Refresh and update methods
  refreshUserPreferences: () => Promise<void>;
  updateWishlistStatus: (productId: string, wishlistItem: WishlistItem | null) => void;
  updateBagStatus: (productId: string, bagItem: BagItem | null) => void;
  
  // ✅ NEW: Address update methods
  updateAddressStatus: (addressId: string, address: Address | null) => void;
  updateDefaultAddressId: (addressId: string | null) => void;
  
  // Bag operations
  addToBagWithSync: (productId: string, options?: {
    size?: string;
    color?: string;
    quantity?: number;
    addedFrom?: string;
  }) => Promise<{ success: boolean; message?: string }>;
  
  // Coupon operations
  applyCouponCode: (couponCode: string) => Promise<CouponOperationResult>;
  removeCouponCode: () => Promise<{ success: boolean; message?: string }>;
  
  // ✅ NEW: Address operations
  createAddressWithSync: (addressData: Partial<Address>) => Promise<{ success: boolean; message?: string; data?: Address }>;
  updateAddressWithSync: (addressId: string, updates: Partial<Address>) => Promise<{ success: boolean; message?: string }>;
  deleteAddressWithSync: (addressId: string) => Promise<{ success: boolean; message?: string }>;
  setDefaultAddressWithSync: (addressId: string) => Promise<{ success: boolean; message?: string }>;
  
  // Loading states
  isRefreshingPreferences: boolean;
  isAddingToBag: Set<string>;
  isApplyingCoupon: boolean;
  
  // ✅ NEW: Address loading states
  isAddingAddress: boolean;
  isUpdatingAddress: Set<string>;
  isDeletingAddress: Set<string>;
  isSettingDefaultAddress: boolean;
  
  // Sync triggers
  wishlistRefreshTrigger: number;
  bagRefreshTrigger: number;
  addressRefreshTrigger: number; // ✅ NEW
  forceWishlistRefresh: () => void;
  forceBagRefresh: () => void;
  forceAddressRefresh: () => void; // ✅ NEW
  
  // Optimistic updates
  optimisticUpdateWishlist: (productId: string, wishlistItem: WishlistItem | null) => void;
  optimisticUpdateBag: (productId: string, bagItem: BagItem | null) => void;
  optimisticUpdateAddress: (addressId: string, address: Address | null) => void; // ✅ NEW
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<{ _id: string; name: string; email: string } | null>(null);

  // Existing state
  const [wishlistItems, setWishlistItems] = useState<Map<string, WishlistItem>>(new Map());
  const [bagItems, setBagItems] = useState<Map<string, BagItem>>(new Map());
  const [bagSummary, setBagSummary] = useState<BagSummaryData | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<CouponResponseData | null>(null);
  
  // ✅ NEW: Address state
  const [addresses, setAddresses] = useState<Map<string, Address>>(new Map());
  const [defaultAddressId, setDefaultAddressId] = useState<string | null>(null);
  
  // Loading states
  const [isRefreshingPreferences, setIsRefreshingPreferences] = useState(false);
  const [isAddingToBag, setIsAddingToBag] = useState<Set<string>>(new Set());
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  
  // ✅ NEW: Address loading states
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [isUpdatingAddress, setIsUpdatingAddress] = useState<Set<string>>(new Set());
  const [isDeletingAddress, setIsDeletingAddress] = useState<Set<string>>(new Set());
  const [isSettingDefaultAddress, setIsSettingDefaultAddress] = useState(false);

  // Refresh triggers
  const [wishlistRefreshTrigger, setWishlistRefreshTrigger] = useState(0);
  const [bagRefreshTrigger, setBagRefreshTrigger] = useState(0);
  const [addressRefreshTrigger, setAddressRefreshTrigger] = useState(0); // ✅ NEW

  // Computed values
  const totalBagItems = bagItems.size;
  const totalWishlistItems = wishlistItems.size;
  const totalAddresses = addresses.size; // ✅ NEW
  const bagSubtotal = Array.from(bagItems.values())
    .reduce((total, item) => total + (item.quantity * item.priceWhenAdded), 0);

  useEffect(() => {
    checkStoredUser();
  }, []);

  useEffect(() => {
    if (user) {
      refreshUserPreferences();
    } else {
      // Clear all state on logout
      setWishlistItems(new Map());
      setBagItems(new Map());
      setBagSummary(null);
      setAppliedCoupon(null);
      setAddresses(new Map()); // ✅ NEW
      setDefaultAddressId(null); // ✅ NEW
      setWishlistRefreshTrigger(0);
      setBagRefreshTrigger(0);
      setAddressRefreshTrigger(0); // ✅ NEW
    }
  }, [user]);

  const checkStoredUser = async () => {
    try {
      const data = await getUserData();
      if (data._id && data.name && data.email) {
        setUser({ _id: data._id, name: data.name, email: data.email });
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error("Error checking stored user:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ ENHANCED: Complete preferences refresh with addresses
  const refreshUserPreferences = async () => {
    if (!user) return;

    try {
      setIsRefreshingPreferences(true);
      console.log("🔄 Refreshing complete user preferences for:", user._id);

      // Fetch all data in parallel including addresses
      const [wishlistResponse, bagResponse, bagSummaryResponse, addressesResponse] = await Promise.all([
        getUserWishlist(user._id).catch(err => {
          console.warn("Wishlist fetch failed:", err);
          return { success: false, data: [] };
        }),
        getUserBag(user._id).catch(err => {
          console.warn("Bag fetch failed:", err);
          return { success: false, data: [] };
        }),
        getBagSummary(user._id).catch(err => {
          console.warn("Bag summary fetch failed:", err);
          return { success: false, data: null };
        }),
        // ✅ NEW: Fetch addresses
        getUserAddresses(user._id).catch(err => {
          console.warn("Addresses fetch failed:", err);
          return { success: false, data: [] };
        })
      ]);

      // Update wishlist
      if (wishlistResponse.success && Array.isArray(wishlistResponse.data)) {
        const newWishlistMap = new Map<string, WishlistItem>();
        (wishlistResponse.data as WishlistItem[]).forEach(item => {
          const productId = item.productId?._id;
          if (productId) {
            newWishlistMap.set(productId, item);
          }
        });
        setWishlistItems(newWishlistMap);
      }

      // Update bag
      if (bagResponse.success && Array.isArray(bagResponse.data)) {
        const newBagMap = new Map<string, BagItem>();
        (bagResponse.data as BagItem[]).forEach(item => {
          const productId = item.productId?._id;
          if (productId) {
            newBagMap.set(productId, item);
          }
        });
        setBagItems(newBagMap);
      }

      // Update bag summary
      if (bagSummaryResponse.success && bagSummaryResponse.data) {
        setBagSummary(bagSummaryResponse.data);
      }

      // ✅ NEW: Update addresses
      if (addressesResponse.success && Array.isArray(addressesResponse.data)) {
        const newAddressMap = new Map<string, Address>();
        let defaultId: string | null = null;
        
        (addressesResponse.data as Address[]).forEach(address => {
          if (address._id) {
            newAddressMap.set(address._id, address);
            if (address.isDefault) {
              defaultId = address._id;
            }
          }
        });
        
        setAddresses(newAddressMap);
        setDefaultAddressId(defaultId);
      }

      // Handle coupon detection
      if (bagSummaryResponse.success && 
          bagSummaryResponse.data && 
          bagSummaryResponse.data.couponApplied && 
          bagSummaryResponse.data.couponDiscount > 0) {
        
        const bagItemWithCoupon = bagResponse.success && Array.isArray(bagResponse.data) 
          ? (bagResponse.data as BagItem[]).find(item => item.appliedCoupon && item.discountAmount)
          : null;
        
        if (bagItemWithCoupon?.appliedCoupon) {
          const couponData: CouponResponseData = {
            couponCode: 'APPLIED',
            discountAmount: bagSummaryResponse.data.couponDiscount,
            cartTotal: bagSummaryResponse.data.subtotal + bagSummaryResponse.data.couponDiscount,
            newTotal: bagSummaryResponse.data.subtotal,
            couponId: bagItemWithCoupon.appliedCoupon,
            message: 'Coupon applied successfully'
          };
          setAppliedCoupon(couponData);
        } else {
          setAppliedCoupon(null);
        }
      } else {
        setAppliedCoupon(null);
      }

    } catch (error) {
      console.error("❌ Error refreshing user preferences:", error);
    } finally {
      setIsRefreshingPreferences(false);
      forceWishlistRefresh();
      forceBagRefresh();
      forceAddressRefresh(); // ✅ NEW
    }
  };

  // ✅ NEW: Address operation methods
  const createAddressWithSync = async (addressData: Partial<Address>) => {
    if (!user) {
      return { success: false, message: "Please login to add addresses" };
    }

    setIsAddingAddress(true);

    try {
      const response = await createAddress({ ...addressData, userId: user._id });

      if (response.success && response.data) {
        // Update local state optimistically
        updateAddressStatus(response.data._id!, response.data);
        
        // If this is the first address, set as default
        if (addresses.size === 0 || response.data.isDefault) {
          setDefaultAddressId(response.data._id!);
        }
        
        // Refresh preferences
        await refreshUserPreferences();
        
        return { success: true, message: "Address added successfully!", data: response.data };
      } else {
        return { success: false, message: handleAddressApiError(response.error) };
      }
    } catch (error: any) {
      console.error("❌ Create address error:", error);
      return { success: false, message: "Failed to add address. Please try again." };
    } finally {
      setIsAddingAddress(false);
    }
  };

  const updateAddressWithSync = async (addressId: string, updates: Partial<Address>) => {
    if (!user) {
      return { success: false, message: "Please login to update addresses" };
    }

    setIsUpdatingAddress(prev => new Set([...prev, addressId]));

    try {
      const response = await updateAddress(addressId, updates);

      if (response.success && response.data) {
        updateAddressStatus(addressId, response.data);
        
        // If setting as default, update defaultAddressId
        if (response.data.isDefault) {
          setDefaultAddressId(addressId);
        }
        
        await refreshUserPreferences();
        
        return { success: true, message: "Address updated successfully!" };
      } else {
        return { success: false, message: handleAddressApiError(response.error) };
      }
    } catch (error: any) {
      console.error("❌ Update address error:", error);
      return { success: false, message: "Failed to update address. Please try again." };
    } finally {
      setIsUpdatingAddress(prev => {
        const newSet = new Set(prev);
        newSet.delete(addressId);
        return newSet;
      });
    }
  };

const deleteAddressWithSync = async (addressId: string) => {
  if (!user) {
    return { success: false, message: "Please login to delete addresses" };
  }

  setIsDeletingAddress(prev => new Set([...prev, addressId]));

  try {
    const response = await deleteAddress(addressId);

    if (response.success) {
      // ✅ Remove locally
      updateAddressStatus(addressId, null);

      // ✅ Clear default if deleted one was default
      if (defaultAddressId === addressId) {
        setDefaultAddressId(null);
      }

      // ✅ Refresh to sync backend
      await refreshUserPreferences();

      return {
        success: true,
        message: response.message || "Address deleted successfully!",
        data: response.data ?? { deletedAddressId: addressId }
      };
    } else {
      return { success: false, message: handleAddressApiError(response.error) };
    }
  } catch (error: any) {
    console.error("❌ Delete address error:", error);
    return { success: false, message: "Failed to delete address. Please try again." };
  } finally {
    setIsDeletingAddress(prev => {
      const newSet = new Set(prev);
      newSet.delete(addressId);
      return newSet;
    });
  }
};


  const setDefaultAddressWithSync = async (addressId: string) => {
    if (!user) {
      return { success: false, message: "Please login to set default address" };
    }

    setIsSettingDefaultAddress(true);

    try {
      const response = await setDefaultAddress(addressId, user._id);

      if (response.success) {
        setDefaultAddressId(addressId);
        await refreshUserPreferences();
        
        return { success: true, message: "Default address updated successfully!" };
      } else {
        return { success: false, message: handleAddressApiError(response.error) };
      }
    } catch (error: any) {
      console.error("❌ Set default address error:", error);
      return { success: false, message: "Failed to set default address. Please try again." };
    } finally {
      setIsSettingDefaultAddress(false);
    }
  };

  // Existing methods (unchanged)
  const addToBagWithSync = async (productId: string, options = {}) => {
    if (!user) {
      return { success: false, message: "Please login to add items to bag" };
    }

    setIsAddingToBag(prev => new Set([...prev, productId]));

    try {
      const response = await addToBag({
        userId: user._id,
        productId,
        ...options
      });

      if (response.success && response.data) {
        updateBagStatus(productId, response.data);
        
        if (wishlistItems.has(productId)) {
          updateWishlistStatus(productId, null);
        }
        
        await refreshUserPreferences();
        
        return { success: true, message: "Added to bag successfully!" };
      } else {
        return { success: false, message: handleApiError(response.error) };
      }
    } catch (error: any) {
      console.error("❌ Add to bag error:", error);
      return { success: false, message: "Failed to add to bag. Please try again." };
    } finally {
      setIsAddingToBag(prev => {
        const newSet = new Set(prev);
        newSet.delete(productId);
        return newSet;
      });
    }
  };

  const applyCouponCode = async (couponCode: string): Promise<CouponOperationResult> => {
    if (!user) {
      return { success: false, message: "Please login to apply coupons" };
    }

    if (!couponCode.trim()) {
      return { success: false, message: "Please enter a coupon code" };
    }

    setIsApplyingCoupon(true);

    try {
      const response = await applyCoupon(user._id, couponCode.trim());

      if (response.success && response.data) {
        setAppliedCoupon(response.data);
        await refreshUserPreferences();
        
        return { 
          success: true, 
          message: `Coupon applied! You saved ₹${response.data.discountAmount}`,
          data: response.data 
        };
      } else {
        return { success: false, message: handleApiError(response.error) };
      }
    } catch (error) {
      console.error("❌ Apply coupon error:", error);
      return { success: false, message: "Failed to apply coupon. Please try again." };
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const removeCouponCode = async () => {
    if (!user) {
      return { success: false, message: "Please login first" };
    }

    setIsApplyingCoupon(true);

    try {
      const response = await removeCoupon(user._id);

      if (response.success) {
        setAppliedCoupon(null);
        await refreshUserPreferences();
        
        return { success: true, message: "Coupon removed successfully" };
      } else {
        return { success: false, message: handleApiError(response.error) };
      }
    } catch (error) {
      console.error("❌ Remove coupon error:", error);
      return { success: false, message: "Failed to remove coupon" };
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  // Refresh triggers
  const forceWishlistRefresh = () => {
    setWishlistRefreshTrigger(prev => prev + 1);
  };

  const forceBagRefresh = () => {
    setBagRefreshTrigger(prev => prev + 1);
  };

  // ✅ NEW: Address refresh trigger
  const forceAddressRefresh = () => {
    setAddressRefreshTrigger(prev => prev + 1);
  };

  // Update methods
  const updateWishlistStatus = (productId: string, wishlistItem: WishlistItem | null) => {
    setWishlistItems(prev => {
      const newMap = new Map(prev);
      if (wishlistItem) {
        newMap.set(productId, wishlistItem);
      } else {
        newMap.delete(productId);
      }
      return newMap;
    });
    forceWishlistRefresh();
  };

  const updateBagStatus = (productId: string, bagItem: BagItem | null) => {
    setBagItems(prev => {
      const newMap = new Map(prev);
      if (bagItem) {
        newMap.set(productId, bagItem);
      } else {
        newMap.delete(productId);
      }
      return newMap;
    });
    forceBagRefresh();
  };

  // ✅ NEW: Address update methods
  const updateAddressStatus = (addressId: string, address: Address | null) => {
    setAddresses(prev => {
      const newMap = new Map(prev);
      if (address) {
        newMap.set(addressId, address);
      } else {
        newMap.delete(addressId);
      }
      return newMap;
    });
    forceAddressRefresh();
  };

  const updateDefaultAddressId = (addressId: string | null) => {
    setDefaultAddressId(addressId);
  };

  // Optimistic updates
  const optimisticUpdateWishlist = (productId: string, wishlistItem: WishlistItem | null) => {
    setWishlistItems(prev => {
      const newMap = new Map(prev);
      if (wishlistItem) {
        newMap.set(productId, wishlistItem);
      } else {
        newMap.delete(productId);
      }
      return newMap;
    });
  };

  const optimisticUpdateBag = (productId: string, bagItem: BagItem | null) => {
    setBagItems(prev => {
      const newMap = new Map(prev);
      if (bagItem) {
        newMap.set(productId, bagItem);
      } else {
        newMap.delete(productId);
      }
      return newMap;
    });
  };

  // ✅ NEW: Address optimistic update
  const optimisticUpdateAddress = (addressId: string, address: Address | null) => {
    setAddresses(prev => {
      const newMap = new Map(prev);
      if (address) {
        newMap.set(addressId, address);
      } else {
        newMap.delete(addressId);
      }
      return newMap;
    });
  };

  // Auth methods (keeping existing implementation)
  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      
      const response = await axios.post(`${API_BASE_URL}/api/user/login`, {
        email: email.trim().toLowerCase(),
        password,
      });

      if (response.data?.data) {
        const { _id, fullName, email } = response.data.data;
        
        await saveUserData(_id, fullName, email);
        setUser({ _id, name: fullName, email });
        setIsAuthenticated(true);
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (error: any) {
      console.error("Login error:", error);
      if (error.response?.status === 401) {
        throw new Error("Invalid email or password");
      } else if (!error.response) {
        throw new Error("Network error. Please check your connection.");
      } else {
        throw new Error(error.response.data?.message || "Login failed");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const Signup = async (fullName: string, email: string, password: string) => {
    try {
      setIsLoading(true);
      
      const response = await axios.post(`${API_BASE_URL}/api/user/signup`, {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
      });

      if (response.data?.data) {
        const { _id, fullName, email } = response.data.data;
        
        await saveUserData(_id, fullName, email);
        setUser({ _id, name: fullName, email });
        setIsAuthenticated(true);
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (error: any) {
      console.error("Signup error:", error);
      if (error.response?.status === 409) {
        throw new Error("An account with this email already exists");
      } else if (!error.response) {
        throw new Error("Network error. Please check your connection.");
      } else {
        throw new Error(error.response.data?.message || "Signup failed");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await clearUserData();
      setUser(null);
      setIsAuthenticated(false);
      
      // ✅ ENHANCED: Complete cleanup including addresses
      setWishlistItems(new Map());
      setBagItems(new Map());
      setBagSummary(null);
      setAppliedCoupon(null);
      setAddresses(new Map());
      setDefaultAddressId(null);
      setWishlistRefreshTrigger(0);
      setBagRefreshTrigger(0);
      setAddressRefreshTrigger(0);
      setIsAddingToBag(new Set());
      setIsApplyingCoupon(false);
      setIsAddingAddress(false);
      setIsUpdatingAddress(new Set());
      setIsDeletingAddress(new Set());
      setIsSettingDefaultAddress(false);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const forgotPassword = async (email: string): Promise<{ message: string; resetToken?: string }> => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/user/forgot-password`, {
        email: email.trim().toLowerCase(),
      });
      return response.data;
    } catch (error: any) {
      console.error("Forgot password error:", error);
      if (!error.response) {
        throw new Error("Network error. Please check your connection.");
      }
      throw new Error(error.response.data?.message || "Failed to send reset email");
    }
  };

  const resetPassword = async (token: string, newPassword: string): Promise<void> => {
    try {
      await axios.post(`${API_BASE_URL}/api/user/reset-password`, {
        token,
        newPassword,
      });
    } catch (error: any) {
      console.error("Reset password error:", error);
      if (!error.response) {
        throw new Error("Network error. Please check your connection.");
      }
      throw new Error(error.response.data?.message || "Failed to reset password");
    }
  };

  // ✅ COMPLETE: Enhanced context value with address management
  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        isLoading,
        Signup,
        login,
        logout,
        forgotPassword,
        resetPassword,
        
        // Existing state
        wishlistItems,
        bagItems,
        bagSummary,
        appliedCoupon,
        
        // ✅ NEW: Address state
        addresses,
        defaultAddressId,
        
        // Computed values
        totalBagItems,
        totalWishlistItems,
        totalAddresses,
        bagSubtotal,
        
        // Operations
        refreshUserPreferences,
        updateWishlistStatus,
        updateBagStatus,
        updateAddressStatus,
        updateDefaultAddressId,
        addToBagWithSync,
        applyCouponCode,
        removeCouponCode,
        
        // ✅ NEW: Address operations
        createAddressWithSync,
        updateAddressWithSync,
        deleteAddressWithSync,
        setDefaultAddressWithSync,
        
        // Loading states
        isRefreshingPreferences,
        isAddingToBag,
        isApplyingCoupon,
        isAddingAddress,
        isUpdatingAddress,
        isDeletingAddress,
        isSettingDefaultAddress,
        
        // Sync
        wishlistRefreshTrigger,
        bagRefreshTrigger,
        addressRefreshTrigger,
        forceWishlistRefresh,
        forceBagRefresh,
        forceAddressRefresh,
        optimisticUpdateWishlist,
        optimisticUpdateBag,
        optimisticUpdateAddress,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
