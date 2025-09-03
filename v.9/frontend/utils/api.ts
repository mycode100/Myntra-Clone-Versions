// Import your comprehensive types
import {
  Product,
  Category,
  BagItem,
  WishlistItem,
  User,
  ApiResponse,
  FilterState,
  PaginationParams,
  SortParams,
  SearchSuggestion,
  SORT_OPTIONS,
  CouponResponseData,  // ✅ FIXED: Import from types instead of defining here
  BagSummaryData       // ✅ FIXED: Import from types instead of defining here
} from '@/types/product';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

// ============================================================================
// ENHANCED GENERIC API CALL FUNCTION WITH PERFECT ERROR HANDLING
// ============================================================================

async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    console.log('🔗 API Call:', url);

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP error! status: ${response.status}`;

      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.message || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }

      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('✅ API Response:', data);

    // Return all properties from the API response
    return data;
  } catch (error) {
    console.error('❌ API Error:', error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        statusCode: error instanceof Error && 'status' in error ? (error as any).status : 500
      }
    };
  }
}

// ============================================================================
// CATEGORY APIs
// ============================================================================

export const getCategories = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  includeStats?: boolean;
}): Promise<ApiResponse<Category[]>> => {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.search) queryParams.append('search', params.search);
  if (params?.includeStats) queryParams.append('includeStats', 'true');

  const endpoint = `/api/category${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  return apiCall<Category[]>(endpoint);
};

export const getCategoryById = async (categoryId: string): Promise<ApiResponse<Category>> => {
  return apiCall<Category>(`/api/category/${categoryId}`);
};

// ============================================================================
// PRODUCT APIs
// ============================================================================

export const getProducts = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  brand?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: FilterState;
}): Promise<ApiResponse<Product[]>> => {
  const queryParams = new URLSearchParams();

  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.search) queryParams.append('search', params.search);
  if (params?.categoryId) queryParams.append('categoryId', params.categoryId);
  if (params?.minPrice) queryParams.append('minPrice', params.minPrice.toString());
  if (params?.maxPrice) queryParams.append('maxPrice', params.maxPrice.toString());
  if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
  if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);

  let brandValues: string[] = [];
  if (params?.brand) {
    brandValues.push(params.brand);
  }

  if (params?.filters) {
    if (params.filters.brands?.length) {
      brandValues.push(...params.filters.brands);
    }
    if (params.filters.colors?.length) {
      queryParams.append('colors', params.filters.colors.join(','));
    }
    if (params.filters.sizes?.length) {
      queryParams.append('sizes', params.filters.sizes.join(','));
    }
    if (params.filters.rating) {
      queryParams.append('rating', params.filters.rating.toString());
    }
    if (params.filters.discount) {
      queryParams.append('discount', params.filters.discount.toString());
    }
    if (params.filters.priceMin) {
      queryParams.append('priceMin', params.filters.priceMin.toString());
    }
    if (params.filters.priceMax) {
      queryParams.append('priceMax', params.filters.priceMax.toString());
    }
    if (params.filters.category) {
      queryParams.append('categoryId', params.filters.category);
    }
    if (params.filters.subcategory) {
      queryParams.append('subcategory', params.filters.subcategory);
    }
    if (params.filters.inStock !== undefined) {
      queryParams.append('inStock', params.filters.inStock.toString());
    }
    if (params.filters.isNew) {
      queryParams.append('isNew', 'true');
    }
    if (params.filters.isBestseller) {
      queryParams.append('isBestseller', 'true');
    }
    if (params.filters.sortBy) {
      queryParams.append('sortBy', params.filters.sortBy);
    }
  }

  if (brandValues.length > 0) {
    const uniqueBrands = [...new Set(brandValues)];
    queryParams.append('brand', uniqueBrands.join(','));
  }

  const endpoint = `/api/product${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  return apiCall<Product[]>(endpoint);
};

export const getProduct = async (productId: string): Promise<ApiResponse<Product>> => {
  return apiCall<Product>(`/api/product/${productId}`);
};

export const getProductById = async (productId: string): Promise<ApiResponse<Product>> => {
  return getProduct(productId);
};

export const getProductsByCategory = async (
  categoryId: string,
  params?: PaginationParams & SortParams & {
    minPrice?: number;
    maxPrice?: number;
    brand?: string;
    filters?: FilterState;
  }
): Promise<ApiResponse<Product[]>> => {
  const queryParams = new URLSearchParams();

  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.minPrice) queryParams.append('minPrice', params.minPrice.toString());
  if (params?.maxPrice) queryParams.append('maxPrice', params.maxPrice.toString());
  if (params?.brand) queryParams.append('brand', params.brand);
  if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
  if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);

  const endpoint = `/api/product/category/${categoryId}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  return apiCall<Product[]>(endpoint);
};

// ============================================================================
// USER APIs
// ============================================================================

export const registerUser = async (userData: {
  fullName: string;
  email: string;
  password: string;
}): Promise<ApiResponse<User>> => {
  return apiCall<User>('/api/user/signup', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
};

export const loginUser = async (credentials: {
  email: string;
  password: string;
}): Promise<ApiResponse<User>> => {
  return apiCall<User>('/api/user/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
};

export const getUserById = async (userId: string): Promise<ApiResponse<User>> => {
  return apiCall<User>(`/api/user/${userId}`);
};

// ============================================================================
// ENHANCED BAG APIs - FULLY UPDATED
// ============================================================================

export const getUserBag = async (
  userId: string,
  params?: {
    includeSaved?: boolean;
    includeStats?: boolean;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }
): Promise<ApiResponse<BagItem[]>> => {
  const queryParams = new URLSearchParams();
  if (params?.includeSaved) queryParams.append('includeSaved', 'true');
  if (params?.includeStats) queryParams.append('includeStats', 'true');
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
  if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);

  const endpoint = `/api/bag/${userId}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  return apiCall<BagItem[]>(endpoint);
};

export const addToBag = async (
  productIdOrData: string | {
    userId: string;
    productId: string;
    size?: string;
    color?: string;
    quantity?: number;
    priceWhenAdded?: number;
    addedFrom?: string;
  },
  userId?: string,
  options?: {
    size?: string;
    color?: string;
    quantity?: number;
    priceWhenAdded?: number;
    addedFrom?: string;
  }
): Promise<ApiResponse<BagItem>> => {
  let bagData: {
    userId: string;
    productId: string;
    size?: string;
    color?: string;
    quantity?: number;
    priceWhenAdded?: number;
    addedFrom?: string;
  };

  if (typeof productIdOrData === 'string') {
    if (!userId) {
      throw new Error('userId is required when productId is provided as string');
    }
    bagData = {
      userId,
      productId: productIdOrData,
      quantity: options?.quantity || 1,
      size: options?.size || 'M',
      color: options?.color || '',
      priceWhenAdded: options?.priceWhenAdded,
      addedFrom: options?.addedFrom || 'product_page',
    };
  } else {
    bagData = {
      ...productIdOrData,
      quantity: productIdOrData.quantity || 1,
      size: productIdOrData.size || 'M',
      color: productIdOrData.color || '',
      addedFrom: productIdOrData.addedFrom || 'product_page',
    };
  }

  return apiCall<BagItem>('/api/bag', {
    method: 'POST',
    body: JSON.stringify(bagData),
  });
};

export const updateBagItemQuantity = async (
  itemId: string,
  quantity: number
): Promise<ApiResponse<BagItem>> => {
  if (quantity < 1 || quantity > 10) {
    return {
      success: false,
      error: { message: 'Quantity must be between 1 and 10' }
    };
  }

  return apiCall<BagItem>(`/api/bag/${itemId}/quantity`, {
    method: 'PUT',
    body: JSON.stringify({ quantity }),
  });
};

export const removeBagItem = async (itemId: string): Promise<ApiResponse<any>> => {
  return apiCall<any>(`/api/bag/${itemId}`, {
    method: 'DELETE',
  });
};

export const moveItemToSaved = async (itemId: string): Promise<ApiResponse<BagItem>> => {
  return apiCall<BagItem>(`/api/bag/${itemId}/save`, {
    method: 'PATCH',
  });
};

export const moveItemToBag = async (itemId: string): Promise<ApiResponse<BagItem>> => {
  return apiCall<BagItem>(`/api/bag/${itemId}/move-to-bag`, {
    method: 'PATCH',
  });
};

export const getSavedItems = async (
  userId: string,
  params?: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }
): Promise<ApiResponse<BagItem[]>> => {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
  if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);

  const endpoint = `/api/bag/${userId}/saved${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  return apiCall<BagItem[]>(endpoint);
};

export const clearBag = async (userId: string): Promise<ApiResponse<{ deletedCount: number; clearedAt: string }>> => {
  return apiCall<{ deletedCount: number; clearedAt: string }>(`/api/bag/user/${userId}/clear`, {
    method: 'DELETE',
  });
};

export const getBagSummary = async (userId: string): Promise<ApiResponse<BagSummaryData>> => {
  return apiCall<BagSummaryData>(`/api/bag/${userId}/summary`);
};

// ============================================================================
// WISHLIST APIs
// ============================================================================

export const getUserWishlist = async (
  userId: string,
  params?: PaginationParams & {
    includeStats?: boolean;
    priority?: 'low' | 'medium' | 'high';
    search?: string;
    priceRange?: string;
  }
): Promise<ApiResponse<WishlistItem[]>> => {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.includeStats) queryParams.append('includeStats', 'true');
  if (params?.priority) queryParams.append('priority', params.priority);
  if (params?.search) queryParams.append('search', params.search);
  if (params?.priceRange) queryParams.append('priceRange', params.priceRange);

  const endpoint = `/api/wishlist/${userId}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  return apiCall<WishlistItem[]>(endpoint);
};

export const addToWishlist = async (
  productIdOrData: string | {
    userId: string;
    productId: string;
    priority?: 'low' | 'medium' | 'high';
    notes?: string;
    priceAlertEnabled?: boolean;
  },
  userId?: string
): Promise<ApiResponse<WishlistItem>> => {
  let wishlistData: {
    userId: string;
    productId: string;
    priority?: 'low' | 'medium' | 'high';
    notes?: string;
    priceAlertEnabled?: boolean;
  };

  if (typeof productIdOrData === 'string') {
    if (!userId) {
      throw new Error('userId is required when productId is provided as string');
    }
    wishlistData = {
      userId,
      productId: productIdOrData,
      priority: 'medium'
    };
  } else {
    wishlistData = productIdOrData;
  }

  return apiCall<WishlistItem>('/api/wishlist', {
    method: 'POST',
    body: JSON.stringify(wishlistData),
  });
};

export const removeFromWishlist = async (
  productOrItemId: string,
  userId?: string
): Promise<ApiResponse<any>> => {
  try {
    // Case 1: You have userId + productId → use efficient backend endpoint
    if (userId) {
      console.log('🔍 Removing wishlist item by userId + productId:', userId, productOrItemId);
      return await apiCall<any>(
        `/api/wishlist/user/${userId}/product/${productOrItemId}`,
        { method: 'DELETE' }
      );
    }

    // Case 2: Fallback (using itemId, e.g. wishlist Mongo _id)
    console.log('🔍 Removing wishlist item by itemId:', productOrItemId);
    return await apiCall<any>(`/api/wishlist/${productOrItemId}`, {
      method: 'DELETE',
    });
  } catch (error) {
    console.error('❌ Error in removeFromWishlist:', error);
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to remove from wishlist',
      },
    };
  }
};

export const checkWishlistStatus = async (
  userId: string,
  productId: string
): Promise<ApiResponse<{
  isInWishlist: boolean;
  wishlistItemId: string | null;
  addedAt: string | null;
}>> => {
  return apiCall<{
    isInWishlist: boolean;
    wishlistItemId: string | null;
    addedAt: string | null;
  }>(`/api/wishlist/check/${userId}/${productId}`);
};

// ============================================================================
// ENHANCED COUPON APIs - FULLY INTEGRATED WITH NEW SYSTEM
// ============================================================================

// ✅ ENHANCED: Apply coupon with enhanced response
export const applyCoupon = async (
  userId: string,
  couponCode: string
): Promise<ApiResponse<CouponResponseData>> => {
  if (!userId || !couponCode) {
    return {
      success: false,
      error: { message: 'User ID and coupon code are required' }
    };
  }

  return apiCall<CouponResponseData>('/api/coupons/apply', {
    method: 'POST',
    body: JSON.stringify({ userId, couponCode: couponCode.toUpperCase().trim() }),
  });
};

// ✅ ENHANCED: Remove coupon with enhanced response
export const removeCoupon = async (
  userId: string
): Promise<ApiResponse<{ message: string; discountAmount: number }>> => {
  if (!userId) {
    return {
      success: false,
      error: { message: 'User ID is required' }
    };
  }

  return apiCall<{ message: string; discountAmount: number }>('/api/coupons/remove', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
};

// ✅ NEW: Get available coupons for CouponOverlay
export const getAvailableCoupons = async (userId: string): Promise<ApiResponse<{
  availableCoupons: any[];
  expiredCoupons: any[];
  cartTotal: number;
}>> => {
  if (!userId) {
    return {
      success: false,
      error: { message: 'User ID is required' }
    };
  }

  return apiCall<{
    availableCoupons: any[];
    expiredCoupons: any[];
    cartTotal: number;
  }>(`/api/coupons/available/${userId}`);
};

// ✅ NEW: Get threshold suggestions for CouponThresholdMessage
export const getThresholdSuggestions = async (userId: string): Promise<ApiResponse<{
  cartTotal: number;
  suggestion: {
    coupon: any;
    amountNeeded: number;
    potentialSavings: number;
  } | null;
}>> => {
  if (!userId) {
    return {
      success: false,
      error: { message: 'User ID is required' }
    };
  }

  return apiCall<{
    cartTotal: number;
    suggestion: {
      coupon: any;
      amountNeeded: number;
      potentialSavings: number;
    } | null;
  }>('/api/coupons/threshold-check', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
};

// ✅ NEW: Validate applied coupon when cart changes
export const validateAppliedCoupon = async (userId: string): Promise<ApiResponse<{
  isValid: boolean;
  shouldRemove: boolean;
  reason?: string;
  newDiscount?: number;
}>> => {
  if (!userId) {
    return {
      success: false,
      error: { message: 'User ID is required' }
    };
  }

  return apiCall<{
    isValid: boolean;
    shouldRemove: boolean;
    reason?: string;
    newDiscount?: number;
  }>('/api/coupons/validate-applied', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
};

// ✅ NEW: Apply coupon directly to bag (alternative endpoint)
export const applyBagCoupon = async (
  userId: string,
  couponCode: string
): Promise<ApiResponse<CouponResponseData>> => {
  return apiCall<CouponResponseData>('/api/bag/apply-coupon', {
    method: 'POST',
    body: JSON.stringify({ userId, couponCode: couponCode.toUpperCase().trim() }),
  });
};

// ✅ NEW: Remove coupon from bag (alternative endpoint)
export const removeBagCoupon = async (
  userId: string
): Promise<ApiResponse<{ message: string }>> => {
  return apiCall<{ message: string }>('/api/bag/remove-coupon', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
};

// ============================================================================
// ORDER APIs
// ============================================================================

export const createOrder = async (orderData: any): Promise<ApiResponse<any>> => {
  return apiCall<any>('/api/order', {
    method: 'POST',
    body: JSON.stringify(orderData),
  });
};

export const getOrderHistory = async (userId: string): Promise<ApiResponse<any[]>> => {
  return apiCall<any[]>(`/api/order/user/${userId}`);
};

export const getOrderDetails = async (orderId: string): Promise<ApiResponse<any>> => {
  return apiCall<any>(`/api/order/${orderId}`);
};

// ============================================================================
// ENHANCED HELPER FUNCTIONS
// ============================================================================

export const getImageUrl = (imagePath: string): string => {
  if (!imagePath) return '';
  if (imagePath.startsWith('http')) return imagePath;
  return `${API_BASE_URL}${imagePath}`;
};

export const handleApiError = (error: any): string => {
  if (error?.error?.message) {
    return error.error.message;
  }
  if (error?.message) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Something went wrong. Please try again.';
};

export const applyFiltersToProducts = (products: Product[], filters: FilterState): Product[] => {
  let filtered = [...products];

  if (filters.priceMin !== undefined) {
    filtered = filtered.filter(p => p.price >= filters.priceMin!);
  }
  if (filters.priceMax !== undefined) {
    filtered = filtered.filter(p => p.price <= filters.priceMax!);
  }

  if (filters.rating) {
    filtered = filtered.filter(p => (p.rating || 0) >= filters.rating!);
  }

  if (filters.brands?.length) {
    filtered = filtered.filter(p => filters.brands!.includes(p.brand));
  }

  if (filters.colors?.length) {
    filtered = filtered.filter(p =>
      p.colors?.some(color => filters.colors!.includes(color))
    );
  }

  if (filters.sizes?.length) {
    filtered = filtered.filter(p =>
      p.sizes?.some(size => filters.sizes!.includes(size))
    );
  }

  if (filters.discount) {
    filtered = filtered.filter(p => {
      if (p.originalPrice && p.originalPrice > p.price) {
        const discountPercent = ((p.originalPrice - p.price) / p.originalPrice) * 100;
        return discountPercent >= filters.discount!;
      }
      return false;
    });
  }

  if (filters.isNew) {
    filtered = filtered.filter(p => p.isNew === true);
  }
  if (filters.isBestseller) {
    filtered = filtered.filter(p => p.isBestseller === true);
  }
  if (filters.inStock) {
    filtered = filtered.filter(p => (p.stock || 0) > 0);
  }

  if (filters.sortBy) {
    switch (filters.sortBy) {
      case 'price_asc':
        filtered.sort((a, b) => a.price - b.price);
        break;
      case 'price_desc':
        filtered.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case 'newest':
        filtered.sort((a, b) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
        break;
      case 'popularity':
        filtered.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        break;
      default:
        break;
    }
  }

  return filtered;
};

// ============================================================================
// ENHANCED UTILITY FUNCTIONS FOR API RESPONSES
// ============================================================================

export const isApiSuccess = <T>(response: ApiResponse<T>): response is ApiResponse<T> & { success: true } => {
  return response.success === true;
};

export const extractApiData = <T>(response: ApiResponse<T>): T | null => {
  return isApiSuccess(response) ? response.data || null : null;
};

export const getApiErrorMessage = <T>(response: ApiResponse<T>): string => {
  if (isApiSuccess(response)) return '';
  return handleApiError(response.error);
};

// ✅ NEW: Enhanced validation helpers for coupon system
export const validateUserId = (userId: string): boolean => {
  return !!(userId && userId.length > 0);
};

export const validateProductId = (productId: string): boolean => {
  return !!(productId && productId.length > 0);
};

export const validateQuantity = (quantity: number): { valid: boolean; message?: string } => {
  if (quantity < 1) {
    return { valid: false, message: 'Quantity must be at least 1' };
  }
  if (quantity > 10) {
    return { valid: false, message: 'Quantity cannot exceed 10' };
  }
  return { valid: true };
};

export const validateCouponCode = (couponCode: string): { valid: boolean; message?: string } => {
  const trimmed = couponCode.trim();
  if (!trimmed) {
    return { valid: false, message: 'Coupon code is required' };
  }
  if (trimmed.length < 3) {
    return { valid: false, message: 'Coupon code must be at least 3 characters' };
  }
  if (trimmed.length > 20) {
    return { valid: false, message: 'Coupon code must be less than 20 characters' };
  }
  return { valid: true };
};

// ✅ NEW: Retry mechanism for failed API calls
export const retryApiCall = async <T>(
  apiFunction: () => Promise<ApiResponse<T>>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<ApiResponse<T>> => {
  let lastError: ApiResponse<T>;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await apiFunction();
      if (result.success) {
        return result;
      }
      lastError = result;
    } catch (error) {
      lastError = {
        success: false,
        error: { message: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
    
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
  
  return lastError!;
};

// ✅ NEW: Network status helper
export const isNetworkError = (error: any): boolean => {
  return error?.message?.includes('Failed to fetch') || 
         error?.message?.includes('Network request failed') ||
         error?.message?.includes('fetch');
};

// ✅ NEW: Format currency helper
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// ✅ NEW: Calculate discount percentage
export const calculateDiscountPercentage = (originalPrice: number, currentPrice: number): number => {
  if (originalPrice <= 0 || currentPrice >= originalPrice) return 0;
  return Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
};
