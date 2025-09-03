import { createContext, useContext, useEffect, useState } from "react";
import { getUserData, saveUserData, clearUserData } from "@/utils/storage";
import { 
  getUserWishlist, 
  getUserBag, 
  handleApiError,
  getBagSummary,
  applyCoupon,
  removeCoupon,
  addToBag  // ✅ FIXED: Direct import instead of dynamic import
} from "@/utils/api";
import React from "react";
import axios from "axios";
import { BagItem, WishlistItem, BagSummaryData, CouponResponseData } from "@/types/product";

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

// ✅ FIXED: Updated return type for coupon operations
type CouponOperationResult = {
  success: boolean;
  message?: string;
  data?: CouponResponseData;
};

// ✅ ENHANCED AuthContextType with complete bag and coupon support
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
  
  // ✅ ENHANCED: Comprehensive preferences state
  wishlistItems: Map<string, WishlistItem>;
  bagItems: Map<string, BagItem>;
  bagSummary: BagSummaryData | null;
  appliedCoupon: CouponResponseData | null;
  
  // ✅ NEW: Computed values for UI
  totalBagItems: number;
  totalWishlistItems: number;
  bagSubtotal: number;
  
  // Refresh and update methods
  refreshUserPreferences: () => Promise<void>;
  updateWishlistStatus: (productId: string, wishlistItem: WishlistItem | null) => void;
  updateBagStatus: (productId: string, bagItem: BagItem | null) => void;
  
  // ✅ NEW: Bag operations with loading states
  addToBagWithSync: (productId: string, options?: {
    size?: string;
    color?: string;
    quantity?: number;
    addedFrom?: string;
  }) => Promise<{ success: boolean; message?: string }>;
  
  // ✅ FIXED: Proper return types for coupon operations
  applyCouponCode: (couponCode: string) => Promise<CouponOperationResult>;
  removeCouponCode: () => Promise<{ success: boolean; message?: string }>;
  
  // Loading states
  isRefreshingPreferences: boolean;
  isAddingToBag: Set<string>;
  isApplyingCoupon: boolean;
  
  // Sync triggers
  wishlistRefreshTrigger: number;
  bagRefreshTrigger: number;
  forceWishlistRefresh: () => void;
  forceBagRefresh: () => void;
  
  // ✅ ENHANCED: Optimistic updates for both wishlist and bag
  optimisticUpdateWishlist: (productId: string, wishlistItem: WishlistItem | null) => void;
  optimisticUpdateBag: (productId: string, bagItem: BagItem | null) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<{ _id: string; name: string; email: string } | null>(null);

  // ✅ ENHANCED: Complete state management
  const [wishlistItems, setWishlistItems] = useState<Map<string, WishlistItem>>(new Map());
  const [bagItems, setBagItems] = useState<Map<string, BagItem>>(new Map());
  const [bagSummary, setBagSummary] = useState<BagSummaryData | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<CouponResponseData | null>(null);
  
  // Loading states
  const [isRefreshingPreferences, setIsRefreshingPreferences] = useState(false);
  const [isAddingToBag, setIsAddingToBag] = useState<Set<string>>(new Set());
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  // Refresh triggers
  const [wishlistRefreshTrigger, setWishlistRefreshTrigger] = useState(0);
  const [bagRefreshTrigger, setBagRefreshTrigger] = useState(0);

  // ✅ NEW: Computed values for UI components
  const totalBagItems = bagItems.size;
  const totalWishlistItems = wishlistItems.size;
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
      setWishlistRefreshTrigger(0);
      setBagRefreshTrigger(0);
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

  // ✅ ENHANCED: Complete preferences refresh with bag summary and coupon state
  const refreshUserPreferences = async () => {
  if (!user) return;

  try {
    setIsRefreshingPreferences(true);
    console.log("🔄 Refreshing complete user preferences for:", user._id);

    // Fetch all data in parallel
    const [wishlistResponse, bagResponse, bagSummaryResponse] = await Promise.all([
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
      console.log("✅ Updated wishlist items:", Array.from(newWishlistMap.keys()));
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
      console.log("✅ Updated bag items:", Array.from(newBagMap.keys()));
      setBagItems(newBagMap);
    }

    // Update bag summary
    if (bagSummaryResponse.success && bagSummaryResponse.data) {
      setBagSummary(bagSummaryResponse.data);
    }

    // ✅ FIXED: Handle coupon detection through bag summary and bag items (no more TypeScript errors)
    if (bagSummaryResponse.success && 
        bagSummaryResponse.data && 
        bagSummaryResponse.data.couponApplied && 
        bagSummaryResponse.data.couponDiscount > 0) {
      
      // Get coupon details from bag items that have applied coupon
      const bagItemWithCoupon = bagResponse.success && Array.isArray(bagResponse.data) 
        ? (bagResponse.data as BagItem[]).find(item => item.appliedCoupon && item.discountAmount)
        : null;
      
      if (bagItemWithCoupon?.appliedCoupon) {
        const couponData: CouponResponseData = {
          couponCode: 'APPLIED', // You can enhance this by storing coupon code in bag item
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
  }
};


  // ✅ FIXED: Remove dynamic import and use direct import
  const addToBagWithSync = async (productId: string, options = {}) => {
    if (!user) {
      return { success: false, message: "Please login to add items to bag" };
    }

    // Add to loading state
    setIsAddingToBag(prev => new Set([...prev, productId]));

    try {
      const response = await addToBag({
        userId: user._id,
        productId,
        ...options
      });

      if (response.success && response.data) {
        // Update local state optimistically
        updateBagStatus(productId, response.data);
        
        // Remove from wishlist if it exists (matches backend behavior)
        if (wishlistItems.has(productId)) {
          updateWishlistStatus(productId, null);
        }
        
        // Refresh full preferences to sync totals
        await refreshUserPreferences();
        
        return { success: true, message: "Added to bag successfully!" };
      } else {
        return { success: false, message: handleApiError(response.error) };
      }
    } catch (error) {
      console.error("❌ Add to bag error:", error);
      return { success: false, message: "Failed to add to bag. Please try again." };
    } finally {
      // Remove from loading state
      setIsAddingToBag(prev => {
        const newSet = new Set(prev);
        newSet.delete(productId);
        return newSet;
      });
    }
  };

  // ✅ FIXED: Proper return type matching the interface
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
        await refreshUserPreferences(); // Sync bag totals
        
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
        await refreshUserPreferences(); // Sync bag totals
        
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

  const forceWishlistRefresh = () => {
    console.log("🔄 Forcing wishlist refresh");
    setWishlistRefreshTrigger(prev => prev + 1);
  };

  const forceBagRefresh = () => {
    console.log("🔄 Forcing bag refresh");
    setBagRefreshTrigger(prev => prev + 1);
  };

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

  // ✅ ENHANCED: Optimistic updates for both wishlist and bag
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

  // Auth methods (keeping your existing implementation)
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
      
      // ✅ ENHANCED: Complete cleanup
      setWishlistItems(new Map());
      setBagItems(new Map());
      setBagSummary(null);
      setAppliedCoupon(null);
      setWishlistRefreshTrigger(0);
      setBagRefreshTrigger(0);
      setIsAddingToBag(new Set());
      setIsApplyingCoupon(false);
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

  // ✅ COMPLETE: Enhanced context value
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
        
        // State
        wishlistItems,
        bagItems,
        bagSummary,
        appliedCoupon,
        
        // Computed values
        totalBagItems,
        totalWishlistItems,
        bagSubtotal,
        
        // Operations
        refreshUserPreferences,
        updateWishlistStatus,
        updateBagStatus,
        addToBagWithSync,
        applyCouponCode,
        removeCouponCode,
        
        // Loading states
        isRefreshingPreferences,
        isAddingToBag,
        isApplyingCoupon,
        
        // Sync
        wishlistRefreshTrigger,
        bagRefreshTrigger,
        forceWishlistRefresh,
        forceBagRefresh,
        optimisticUpdateWishlist,
        optimisticUpdateBag,
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
