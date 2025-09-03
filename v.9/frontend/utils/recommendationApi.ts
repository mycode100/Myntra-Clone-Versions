// ✅ COMPLETE RECOMMENDATION API UTILITIES
import AsyncStorage from '@react-native-async-storage/async-storage';

// ✅ TypeScript Interfaces
export interface Product {
  _id: string;
  name: string;
  brand: string;
  price: number;
  originalPrice?: number;
  images: string[];
  rating?: number;
  ratingCount?: number;
  discount?: string;
  category?: string;
  subcategory?: string;
  colors?: string[];
  sizes?: string[];
  description?: string;
  isActive?: boolean;
}

export interface Recommendation {
  product: Product;
  score: number;
  reasons: string[];
  metadata?: {
    viewerCount?: number;
    totalViews?: number;
    [key: string]: any;
  };
}

export interface RecommendationMeta {
  count: number;
  userId: string;
  algorithm: string;
  timestamp: string;
}

export interface RecommendationResponse {
  success: boolean;
  message: string;
  data: {
    recommendations: Recommendation[];
    meta: RecommendationMeta;
  };
  timestamp: string;
}

export interface TrackingData {
  productId: string;
  sessionId: string;
  userId?: string;
  source: string;
  timeSpent?: number;
  scrollDepth?: number;
  addedToWishlist?: boolean;
  addedToBag?: boolean;
  metadata?: {
    userAgent?: string;
    platform?: string;
    timestamp?: string;
    recommendationIndex?: number;
    fromProduct?: string;
    clickedAt?: string;
    [key: string]: any;
  };
}

export interface TrackingResponse {
  success: boolean;
  message: string;
  data: {
    _id: string;
    userId: string | null;
    productId: string;
    sessionId: string;
    viewedAt: string;
    timeSpent: number;
    source: string;
    deviceInfo: string;
    scrollDepth: number;
    addedToWishlist: boolean;
    addedToBag: boolean;
    createdAt: string;
    updatedAt: string;
  };
  timestamp: string;
}

export interface PopularProduct {
  product: Product;
  viewCount: number;
  uniqueUserCount: number;
  uniqueSessionCount: number;
  avgTimeSpent: number;
  avgScrollDepth: number;
  wishlistAdds: number;
  bagAdds: number;
  popularityScore: number;
}

export interface PopularProductsResponse {
  success: boolean;
  message: string;
  data: PopularProduct[];
  timestamp: string;
}

export interface BrowsingHistoryEntry {
  _id: string;
  userId?: string;
  productId: Product;
  sessionId: string;
  viewedAt: string;
  timeSpent: number;
  source: string;
  deviceInfo: string;
  scrollDepth: number;
  addedToWishlist: boolean;
  addedToBag: boolean;
}

export interface UserHistoryResponse {
  success: boolean;
  message: string;
  data: {
    history: BrowsingHistoryEntry[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
  timestamp: string;
}

export interface ApiError {
  success: false;
  message: string;
  error: string;
  type: string;
  timestamp: string;
}

// ✅ Configuration
export class RecommendationApiConfig {
  private static instance: RecommendationApiConfig;
  private baseUrl: string;
  private defaultTimeout: number;

  private constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
    this.defaultTimeout = 10000; // 10 seconds
  }

  public static getInstance(): RecommendationApiConfig {
    if (!RecommendationApiConfig.instance) {
      RecommendationApiConfig.instance = new RecommendationApiConfig();
    }
    return RecommendationApiConfig.instance;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public setTimeout(timeout: number): void {
    this.defaultTimeout = timeout;
  }

  public getTimeout(): number {
    return this.defaultTimeout;
  }

  public setBaseUrl(url: string): void {
    this.baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
  }
}

// ✅ Utility Functions
class ApiUtils {
  private static config = RecommendationApiConfig.getInstance();

  static async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    timeout?: number
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout || this.config.getTimeout());

    try {
      const url = `${this.config.getBaseUrl()}${endpoint}`;
      
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || 
          `HTTP ${response.status}: ${response.statusText}`
        );
      }

      const data = await response.json();
      return data as T;

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timed out. Please check your connection and try again.');
      }
      
      throw error;
    }
  }

  static generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static async getStoredUserId(): Promise<string | null> {
    try {
      // Try secure store first (mobile)
      if (typeof window === 'undefined') {
        const SecureStore = require('expo-secure-store');
        return await SecureStore.getItemAsync('userid');
      }
      
      // Fallback to AsyncStorage
      return await AsyncStorage.getItem('userid');
    } catch (error) {
      console.warn('Failed to get stored user ID:', error);
      return null;
    }
  }

  static async getSessionId(): Promise<string> {
    try {
      let sessionId = await AsyncStorage.getItem('browsing_session_id');
      if (!sessionId) {
        sessionId = this.generateSessionId();
        await AsyncStorage.setItem('browsing_session_id', sessionId);
      }
      return sessionId;
    } catch (error) {
      console.warn('Failed to get/create session ID:', error);
      return this.generateSessionId();
    }
  }

  static buildQueryParams(params: Record<string, any>): string {
    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        searchParams.append(key, String(value));
      }
    });
    
    return searchParams.toString();
  }
}

// ✅ MAIN RECOMMENDATION API CLASS
export class RecommendationApi {
  private static instance: RecommendationApi;
  
  private constructor() {}

  public static getInstance(): RecommendationApi {
    if (!RecommendationApi.instance) {
      RecommendationApi.instance = new RecommendationApi();
    }
    return RecommendationApi.instance;
  }

  // ✅ GET PRODUCT RECOMMENDATIONS
  async getProductRecommendations(
    productId: string,
    options: {
      userId?: string;
      limit?: number;
      timeout?: number;
    } = {}
  ): Promise<RecommendationResponse> {
    if (!productId) {
      throw new Error('Product ID is required');
    }

    const { userId, limit = 6, timeout } = options;
    const queryParams: Record<string, any> = { limit };
    
    // Add userId if provided or try to get from storage
    const finalUserId = userId || await ApiUtils.getStoredUserId();
    if (finalUserId) {
      queryParams.userId = finalUserId;
    }

    const queryString = ApiUtils.buildQueryParams(queryParams);
    const endpoint = `/api/recommendations/product/${productId}${queryString ? `?${queryString}` : ''}`;

    console.log(`🎯 Fetching recommendations for product: ${productId}${finalUserId ? ` (user: ${finalUserId})` : ' (anonymous)'}`);

    return ApiUtils.makeRequest<RecommendationResponse>(endpoint, {
      method: 'GET',
    }, timeout);
  }

  // ✅ TRACK PRODUCT VIEW
  async trackProductView(
    productId: string,
    options: {
      userId?: string;
      sessionId?: string;
      source?: string;
      timeSpent?: number;
      scrollDepth?: number;
      addedToWishlist?: boolean;
      addedToBag?: boolean;
      metadata?: Record<string, any>;
      timeout?: number;
    } = {}
  ): Promise<TrackingResponse> {
    if (!productId) {
      throw new Error('Product ID is required');
    }

    const {
      userId,
      sessionId,
      source = 'direct',
      timeSpent = 0,
      scrollDepth = 0,
      addedToWishlist = false,
      addedToBag = false,
      metadata = {},
      timeout
    } = options;

    // Get or generate session ID
    const finalSessionId = sessionId || await ApiUtils.getSessionId();
    
    // Get userId if not provided
    const finalUserId = userId || await ApiUtils.getStoredUserId();

    const trackingData: TrackingData = {
      productId,
      sessionId: finalSessionId,
      source,
      timeSpent,
      scrollDepth,
      addedToWishlist,
      addedToBag,
      metadata: {
        userAgent: 'ReactNative',
        platform: 'mobile',
        timestamp: new Date().toISOString(),
        ...metadata,
      },
    };

    if (finalUserId) {
      trackingData.userId = finalUserId;
    }

    console.log(`📊 Tracking product view: ${productId}${finalUserId ? ` (user: ${finalUserId})` : ' (anonymous)'}`);

    return ApiUtils.makeRequest<TrackingResponse>('/api/browsing-history/track', {
      method: 'POST',
      body: JSON.stringify(trackingData),
    }, timeout);
  }

  // ✅ TRACK PRODUCT CLICK (from recommendations)
  async trackRecommendationClick(
    clickedProductId: string,
    fromProductId: string,
    recommendationIndex: number,
    options: {
      userId?: string;
      sessionId?: string;
      metadata?: Record<string, any>;
      timeout?: number;
    } = {}
  ): Promise<TrackingResponse> {
    const { userId, sessionId, metadata = {}, timeout } = options;

    return this.trackProductView(clickedProductId, {
      userId,
      sessionId,
      source: 'recommendation_click',
      metadata: {
        ...metadata,
        fromProduct: fromProductId,
        recommendationIndex,
        clickedAt: new Date().toISOString(),
      },
      timeout,
    });
  }

  // ✅ GET POPULAR PRODUCTS
  async getPopularProducts(
    options: {
      limit?: number;
      days?: number;
      category?: string;
      timeout?: number;
    } = {}
  ): Promise<PopularProductsResponse> {
    const { limit = 10, days = 7, category, timeout } = options;
    
    const queryParams: Record<string, any> = { limit, days };
    if (category) {
      queryParams.category = category;
    }

    const queryString = ApiUtils.buildQueryParams(queryParams);
    const endpoint = `/api/browsing-history/popular-products${queryString ? `?${queryString}` : ''}`;

    console.log(`🔥 Fetching popular products (limit: ${limit}, days: ${days})`);

    return ApiUtils.makeRequest<PopularProductsResponse>(endpoint, {
      method: 'GET',
    }, timeout);
  }

  // ✅ GET USER BROWSING HISTORY
  async getUserBrowsingHistory(
    userId: string,
    options: {
      limit?: number;
      page?: number;
      days?: number;
      timeout?: number;
    } = {}
  ): Promise<UserHistoryResponse> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const { limit = 20, page = 1, days = 30, timeout } = options;
    
    const queryParams = ApiUtils.buildQueryParams({ limit, page, days });
    const endpoint = `/api/browsing-history/user/${userId}${queryParams ? `?${queryParams}` : ''}`;

    console.log(`📚 Fetching browsing history for user: ${userId}`);

    return ApiUtils.makeRequest<UserHistoryResponse>(endpoint, {
      method: 'GET',
    }, timeout);
  }

  // ✅ CLEAR RECOMMENDATION CACHE
  async clearRecommendationCache(
    productId: string,
    options: {
      userId?: string;
      timeout?: number;
    } = {}
  ): Promise<{ success: boolean; message: string; data: any }> {
    if (!productId) {
      throw new Error('Product ID is required');
    }

    const { userId, timeout } = options;
    const finalUserId = userId || await ApiUtils.getStoredUserId();
    
    const queryParams: Record<string, any> = {};
    if (finalUserId) {
      queryParams.userId = finalUserId;
    }

    const queryString = ApiUtils.buildQueryParams(queryParams);
    const endpoint = `/api/recommendations/clear-cache/${productId}${queryString ? `?${queryString}` : ''}`;

    console.log(`🗑️ Clearing recommendation cache for product: ${productId}`);

    return ApiUtils.makeRequest(endpoint, {
      method: 'DELETE',
    }, timeout);
  }

  // ✅ BATCH TRACK MULTIPLE VIEWS (for performance)
  async batchTrackViews(
    views: Array<{
      productId: string;
      source?: string;
      timeSpent?: number;
      scrollDepth?: number;
      metadata?: Record<string, any>;
    }>,
    options: {
      userId?: string;
      sessionId?: string;
      timeout?: number;
    } = {}
  ): Promise<TrackingResponse[]> {
    const { userId, sessionId, timeout } = options;
    
    // Track all views concurrently
    const trackingPromises = views.map(view => 
      this.trackProductView(view.productId, {
        ...view,
        userId,
        sessionId,
        timeout,
      }).catch(error => {
        console.warn(`Failed to track view for product ${view.productId}:`, error);
        return null;
      })
    );

    const results = await Promise.all(trackingPromises);
    return results.filter((result): result is TrackingResponse => result !== null);
  }

  // ✅ SEARCH PRODUCTS WITH RECOMMENDATIONS
  async getSearchRecommendations(
    query: string,
    options: {
      userId?: string;
      limit?: number;
      includePopular?: boolean;
      timeout?: number;
    } = {}
  ): Promise<{
    searchResults: Product[];
    recommendations: Recommendation[];
    popular?: PopularProduct[];
  }> {
    const { userId, limit = 6, includePopular = true, timeout } = options;

    try {
      // This would integrate with your existing search API
      // For now, we'll focus on getting popular products as search suggestions
      const [popularResponse] = await Promise.all([
        includePopular ? this.getPopularProducts({ limit, timeout }) : Promise.resolve(null),
      ]);

      return {
        searchResults: [], // Would come from your search API
        recommendations: [], // Would come from search-based recommendations
        popular: popularResponse?.data || [],
      };
    } catch (error) {
      console.error('Error getting search recommendations:', error);
      throw error;
    }
  }
}

// ✅ CONVENIENCE FUNCTIONS (for easier imports)
export const recommendationApi = RecommendationApi.getInstance();

// ✅ Individual function exports for direct use
export const getProductRecommendations = (productId: string, options?: any) =>
  recommendationApi.getProductRecommendations(productId, options);

export const trackProductView = (productId: string, options?: any) =>
  recommendationApi.trackProductView(productId, options);

export const trackRecommendationClick = (clickedProductId: string, fromProductId: string, index: number, options?: any) =>
  recommendationApi.trackRecommendationClick(clickedProductId, fromProductId, index, options);

export const getPopularProducts = (options?: any) =>
  recommendationApi.getPopularProducts(options);

export const getUserBrowsingHistory = (userId: string, options?: any) =>
  recommendationApi.getUserBrowsingHistory(userId, options);

export const clearRecommendationCache = (productId: string, options?: any) =>
  recommendationApi.clearRecommendationCache(productId, options);

// ✅ ERROR HANDLING UTILITIES
export class RecommendationApiError extends Error {
  public readonly type: string;
  public readonly statusCode?: number;
  public readonly originalError?: any;

  constructor(message: string, type: string = 'API_ERROR', statusCode?: number, originalError?: any) {
    super(message);
    this.name = 'RecommendationApiError';
    this.type = type;
    this.statusCode = statusCode;
    this.originalError = originalError;
  }

  static fromApiResponse(error: any): RecommendationApiError {
    if (error.response) {
      return new RecommendationApiError(
        error.response.data?.message || error.message,
        error.response.data?.type || 'HTTP_ERROR',
        error.response.status,
        error
      );
    }
    
    return new RecommendationApiError(
      error.message || 'Unknown API error',
      'NETWORK_ERROR',
      undefined,
      error
    );
  }
}

// ✅ HOOKS FOR REACT COMPONENTS (if using React)
export const useRecommendationApi = () => {
  return {
    api: recommendationApi,
    getRecommendations: getProductRecommendations,
    trackView: trackProductView,
    trackClick: trackRecommendationClick,
    getPopular: getPopularProducts,
    getUserHistory: getUserBrowsingHistory,
    clearCache: clearRecommendationCache,
  };
};

// ✅ DEFAULT EXPORT
export default RecommendationApi;
