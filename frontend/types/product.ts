// ============================================================================
// PRODUCT & CATEGORY INTERFACES
// ============================================================================

export interface Product {
  _id: string;
  name: string;
  brand: string;
  price: number;
  originalPrice?: number;
  discount?: string;
  description?: string;
  images: string[];
  category?: {
    _id: string;
    name: string;
    subcategory: string[];
  };
  categoryName?: string;
  subcategory?: string;
  rating?: number;
  ratingCount?: number;
  sizes?: string[];
  createdAt?: string;
  updatedAt?: string;
  popularity?: number;
  tags?: string[];
  isNew?: boolean;
  isBestseller?: boolean;
  isFeatured?: boolean;
  stock?: number;
  colors?: string[];
}

export interface Category {
  _id: string;
  name: string;
  subcategory: string[];
  image: string;
  productId?: Product[];
  productCount?: number;
  createdAt?: string;
  updatedAt?: string;
  isPopular?: boolean;
  description?: string;
}

// ============================================================================
// RATING SYSTEM INTERFACES
// ============================================================================

export interface RatingDisplayProps {
  rating?: number;
  size?: 'small' | 'medium' | 'large';
  showCount?: boolean;
  reviewCount?: number;
  showText?: boolean;
  color?: string;
  style?: any;
}

export interface RatingBreakdown {
  average: number;
  total: number;
  breakdown: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
  percentages: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}

export interface Review {
  _id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  productId: string;
  rating: number;
  title?: string;
  comment: string;
  helpful: number;
  verified: boolean;
  createdAt: string;
  updatedAt?: string;
  images?: string[];
  size?: string;
}

// ============================================================================
// FILTER & SEARCH INTERFACES
// ============================================================================

export interface FilterState {
  category?: string;
  subcategory?: string;
  priceMin?: number;
  priceMax?: number;
  rating?: number;
  brands?: string[];
  discount?: number;
  sortBy?: SortOption;
  colors?: string[];
  sizes?: string[];
  isNew?: boolean;
  isBestseller?: boolean;
  inStock?: boolean;
}

export interface FilterOptions {
  category?: string;
  subcategory?: string;
  priceMin?: number;
  priceMax?: number;
  rating?: number;
  brands?: string[];
  sortBy?: SortOption;
}

export type SortOption =
  | 'relevance'
  | 'price_asc'
  | 'price_desc'
  | 'rating'
  | 'newest'
  | 'popularity';

export interface PriceRange {
  min: number;
  max: number;
  label?: string;
}

export interface SearchFilters extends FilterState {
  query?: string;
  searchIn?: ('name' | 'brand' | 'description' | 'tags')[];
}

export interface SearchResult extends Product {
  relevanceScore?: number;
  matchedTerms?: string[];
  highlightedName?: string;
  highlightedBrand?: string;
  highlightedDescription?: string;
}

export interface SearchSuggestion {
  id: string;
  text: string;
  type: 'product' | 'brand' | 'category' | 'recent' | 'trending' | 'filter';
  count?: number;
  image?: string;
  categoryId?: string;
  categoryName?: string;
  subcategory?: string;
  productId?: string;
  brand?: string;
  filters?: Partial<FilterState>;
  priority?: number;
}

// ============================================================================
// ENHANCED SEARCH WITH FILTERS INTERFACES
// ============================================================================

export interface SearchWithFiltersState {
  query: string;
  filters: FilterState;
  results: Product[];
  suggestions: SearchSuggestion[];
  isLoading: boolean;
  error: string | null;
  totalResults: number;
  appliedFiltersCount: number;
}

export interface SearchFilterOption {
  id: string;
  label: string;
  value: string | number;
  count?: number;
  selected?: boolean;
}

export interface SearchFilterGroup {
  id: string;
  title: string;
  type: 'single' | 'multiple' | 'range' | 'toggle';
  options: SearchFilterOption[];
  isExpanded?: boolean;
  hasSearch?: boolean;
}

export interface FilterQuickAction {
  id: string;
  label: string;
  icon?: string;
  filters: Partial<FilterState>;
  isActive?: boolean;
}

// ============================================================================
// API RESPONSE INTERFACES
// ============================================================================

export interface ProductListResponse {
  products: Product[];
  total: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  totalPages: number;
  filters: {
    availableBrands: string[];
    priceRange: PriceRange;
    availableColors: string[];
    availableSizes: string[];
    categories: Category[];
  };
}

export interface CategoryListResponse {
  categories: Category[];
  total: number;
  featured: Category[];
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  suggestions: SearchSuggestion[];
  filters: {
    availableBrands: string[];
    priceRange: PriceRange;
    categories: Category[];
    appliedFilters: FilterState;
  };
  query: string;
  page: number;
  limit: number;
}

// ============================================================================
// COMPONENT PROP INTERFACES
// ============================================================================

export interface ProductCardProps {
  product: Product;
  onPress?: (productId: string) => void;
  onWishlistPress?: (productId: string) => void;
  onBagPress?: (productId: string) => void;
  showWishlistButton?: boolean;
  showBagButton?: boolean;
  style?: any;
  imageStyle?: any;
  cardWidth?: number;
  isWishlisted?: boolean;
  inBag?: boolean;
}

export interface CategoryCardProps {
  category: Category;
  onPress?: (categoryId: string) => void;
  style?: any;
  imageStyle?: any;
  showProductCount?: boolean;
}

export interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: FilterState) => void;
  currentFilters: FilterState;
  categories?: Category[];
  brands?: string[];
  priceRange?: PriceRange;
  totalProducts?: number;
  colors?: string[];
  sizes?: string[];
}

export interface SearchOverlayProps {
  visible: boolean;
  onClose: () => void;
  products: Product[];
  categories?: Category[];
  onProductPress?: (productId: string) => void;
  onFilterPress?: () => void;
  initialQuery?: string;
  showFilters?: boolean;
  activeFilters?: FilterState;
  onWishlistPress?: (productId: string) => void;
  onBagPress?: (productId: string) => void;
  onSearchComplete?: (query: string) => void;
  onCategoryPress?: (categoryId: string, categoryName: string) => void;
  onSubcategoryPress?: (categoryId: string, subcategory: string, categoryName: string) => void;
  onApplyFilters?: (filters: FilterState) => void;
  availableBrands?: string[];
  priceRange?: PriceRange;
  availableColors?: string[];
  availableSizes?: string[];
  totalProducts?: number;
  onSortChange?: (sortBy: SortOption) => void;
}

// ============================================================================
// SHOPPING CART & WISHLIST INTERFACES
// ============================================================================

export interface BagItem {
  _id: string;
  productId: Product;
  userId: string;
  quantity: number;
  size?: string;
  color?: string;
  addedAt?: string;
  updatedAt?: string;
  priceWhenAdded: number;
  discountWhenAdded?: string;
  savedForLater?: boolean;
  addedFrom?: string;
  appliedCoupon?: string;
  discountAmount?: number;
}

export interface WishlistItem {
  _id: string;
  productId: Product;
  userId: string;
  addedAt: string;
  priority?: 'low' | 'medium' | 'high';
  notes?: string;
  priceAlertEnabled?: boolean;
}

export interface Order {
  _id: string;
  userId: string;
  items: BagItem[];
  totalAmount: number;
  discount?: number;
  shippingCost: number;
  finalAmount: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | 'returned';
  shippingAddress: Address;
  paymentMethod: 'cod' | 'card' | 'upi' | 'wallet';
  trackingId?: string;
  createdAt: string;
  updatedAt?: string;
  estimatedDelivery?: string;
}

export interface Address {
  _id?: string;
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
  isDefault?: boolean;
}

// ============================================================================
// USER & AUTH INTERFACES
// ============================================================================

export interface User {
  _id: string;
  id?: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  addresses: Address[];
  preferences: {
    notifications: boolean;
    newsletter: boolean;
    recommendations: boolean;
    theme: 'light' | 'dark' | 'auto';
  };
  createdAt: string;
  updatedAt?: string;
  lastLogin?: string;
  isVerified: boolean;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

// ============================================================================
// UTILITY & HELPER INTERFACES
// ============================================================================

export interface ApiError {
  message: string;
  code?: string;
  statusCode?: number;
  field?: string;
}

// ✅ FIXED: Enhanced ApiResponse to handle all backend responses with coupon property
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: ApiError;
  meta?: any;
  statistics?: any;
  
  // Bag-specific properties
  totals?: {
    itemCount: number;
    subtotal: number;
    shipping: number;
    tax: number;
    finalTotal: number;
    couponDiscount: number;
  };
  alerts?: {
    hasOutOfStockItems?: boolean;
    hasPriceChanges?: boolean;
    freeShippingEligible?: boolean;
    freeShippingRemaining?: number;
    couponApplied?: boolean;
  };
  // ✅ ADDED: Missing coupon property
  coupon?: {
    code: string;
    description?: string;
    discount_value?: number;
    discount_type?: string;
    couponDiscount: number;
    message?: string;
  };
}

// ✅ FIXED: CouponResponseData with optional message property
export interface CouponResponseData {
  couponCode: string;
  discountAmount: number;
  cartTotal: number;
  newTotal: number;
  couponId: string;
  message?: string; // ✅ FIXED: Made optional to match api.ts
}

// ✅ ADDED: Missing BagSummaryData interface
export interface BagSummaryData {
  itemCount: number;
  savedItemCount: number;
  subtotal: number;
  couponDiscount: number;
  shipping: number;
  tax: number;
  total: number;
  freeShippingEligible: boolean;
  freeShippingRemaining: number;
  couponApplied: boolean;
}

export interface LoadingState {
  isLoading: boolean;
  error: string | null;
  lastUpdated?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface SortParams {
  sortBy?: SortOption;
  sortOrder?: 'asc' | 'desc';
}

// ============================================================================
// SCREEN & NAVIGATION INTERFACES
// ============================================================================

export interface HomeScreenData {
  categories: Category[];
  featuredProducts: Product[];
  newArrivals: Product[];
  bestDeals: Product[];
  banners: Banner[];
  isLoading: boolean;
  error: string | null;
}

export interface CategoryScreenData {
  categories: Category[];
  selectedCategory: Category | null;
  products: Product[];
  filters: FilterState;
  isLoading: boolean;
  error: string | null;
}

export interface ProductScreenData {
  product: Product | null;
  relatedProducts: Product[];
  reviews: Review[];
  ratingBreakdown: RatingBreakdown;
  isLoading: boolean;
  error: string | null;
  isWishlisted: boolean;
  inBag: boolean;
}

export interface Banner {
  _id: string;
  title: string;
  subtitle?: string;
  image: string;
  link?: string;
  type: 'promotion' | 'category' | 'product' | 'brand';
  isActive: boolean;
  order: number;
  startDate?: string;
  endDate?: string;
}

// ============================================================================
// RESPONSIVE & UI INTERFACES
// ============================================================================

export interface ResponsiveConfig {
  isPhone: boolean;
  isTablet: boolean;
  isLargeTablet: boolean;
  screenWidth: number;
  screenHeight: number;
  columns: number;
  cardWidth: number;
}

export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  error: string;
  success: string;
  warning: string;
  info: string;
}

// ============================================================================
// ANALYTICS & TRACKING INTERFACES
// ============================================================================

export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, any>;
  userId?: string;
  timestamp?: string;
}

export interface ProductView extends AnalyticsEvent {
  name: 'product_view';
  properties: {
    productId: string;
    productName: string;
    brand: string;
    category: string;
    price: number;
    source: 'search' | 'category' | 'home' | 'recommendation';
  };
}

export interface SearchEvent extends AnalyticsEvent {
  name: 'search';
  properties: {
    query: string;
    resultsCount: number;
    filters?: FilterState;
  };
}

export interface FilterApplied extends AnalyticsEvent {
  name: 'filter_applied' | 'filter_removed' | 'sort_changed' | 'quick_filter_used';
  properties: {
    filterType?: keyof FilterState;
    filterValue?: any;
    sortOption?: SortOption;
    quickFilterId?: string;
    searchQuery?: string;
    resultCount: number;
    screen: 'search' | 'category' | 'brand';
    appliedFilters: FilterState;
  };
}

// ============================================================================
// EXPORT COMMONLY USED TYPES
// ============================================================================

export type {
  Product as ProductType,
  Category as CategoryType,
  FilterState as Filters,
  User as UserType,
  BagItem as CartItem,
  WishlistItem as WishlistType,
};

// ============================================================================
// CONSTANTS & ENUMS - REDUCED SORT OPTIONS
// ============================================================================

export const SORT_OPTIONS: { label: string; value: SortOption; icon?: string }[] = [
  { label: 'Relevance', value: 'relevance', icon: '🎯' },
  { label: 'Price: Low to High', value: 'price_asc', icon: '💰' },
  { label: 'Price: High to Low', value: 'price_desc', icon: '💎' },
  { label: 'Customer Rating', value: 'rating', icon: '⭐' },
  { label: 'Newest First', value: 'newest', icon: '🆕' },
  { label: 'Popularity', value: 'popularity', icon: '🔥' },
];

export const RATING_LABELS: Record<number, string> = {
  5: 'Excellent',
  4: 'Very Good',
  3: 'Good',
  2: 'Fair',
  1: 'Poor',
};

export const PRICE_RANGES: PriceRange[] = [
  { label: 'Under ₹299', min: 0, max: 299 },
  { label: '₹300 - ₹599', min: 300, max: 599 },
  { label: '₹600 - ₹999', min: 600, max: 999 },
  { label: '₹1000 - ₹1999', min: 1000, max: 1999 },
  { label: '₹2000 - ₹4999', min: 2000, max: 4999 },
  { label: '₹5000+', min: 5000, max: Infinity },
];

export const QUICK_FILTERS: FilterQuickAction[] = [
  {
    id: 'new',
    label: 'New Arrivals',
    icon: '🆕',
    filters: { isNew: true, sortBy: 'newest' }
  },
  {
    id: 'bestseller',
    label: 'Bestsellers',
    icon: '🔥',
    filters: { isBestseller: true, sortBy: 'popularity' }
  },
  {
    id: 'discount',
    label: 'On Sale',
    icon: '🏷️',
    filters: { discount: 10 }
  },
  {
    id: 'budget',
    label: 'Budget Friendly',
    icon: '💰',
    filters: { priceMax: 999, sortBy: 'price_asc' }
  },
  {
    id: 'top_rated',
    label: 'Top Rated',
    icon: '⭐',
    filters: { rating: 4, sortBy: 'rating' }
  }
];

export const DEFAULT_FILTER_STATE: FilterState = {
  sortBy: 'relevance',
};

// ============================================================================
// TYPE GUARDS & UTILITY FUNCTIONS
// ============================================================================

export const isProduct = (item: any): item is Product => {
  return item && typeof item === 'object' &&
    typeof item._id === 'string' &&
    typeof item.name === 'string' &&
    typeof item.price === 'number';
};

export const isCategory = (item: any): item is Category => {
  return item && typeof item === 'object' &&
    typeof item._id === 'string' &&
    typeof item.name === 'string' &&
    Array.isArray(item.subcategory);
};

export const hasValidRating = (product: Product): boolean => {
  return typeof product.rating === 'number' &&
    product.rating >= 0 &&
    product.rating <= 5;
};

export const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(price);
};

export const formatRating = (rating?: number): string => {
  if (!rating) return '0.0';
  return rating.toFixed(1);
};

export const getDiscountPercentage = (originalPrice: number, discountedPrice: number): number => {
  return Math.round(((originalPrice - discountedPrice) / originalPrice) * 100);
};

export const isValidDiscountString = (discount?: string): boolean => {
  if (!discount) return false;
  const regex = /(\d+)%/;
  return regex.test(discount);
};

export const extractDiscountPercentage = (discount?: string): number => {
  if (!discount) return 0;
  const match = discount.match(/(\d+)%/);
  return match ? parseInt(match[1], 10) : 0;
};

// ============================================================================
// FILTER UTILITY FUNCTIONS
// ============================================================================

export const getActiveFiltersCount = (filters: FilterState): number => {
  let count = 0;
  if (filters.category) count++;
  if (filters.subcategory) count++;
  if (filters.priceMin || filters.priceMax) count++;
  if (filters.rating) count++;
  if (filters.brands?.length) count += filters.brands.length;
  if (filters.discount) count++;
  if (filters.colors?.length) count += filters.colors.length;
  if (filters.sizes?.length) count += filters.sizes.length;
  if (filters.isNew) count++;
  if (filters.isBestseller) count++;
  if (filters.inStock) count++;
  if (filters.sortBy && filters.sortBy !== 'relevance') count++;
  return count;
};

export const resetFilters = (): FilterState => ({
  sortBy: 'relevance'
});

export const applyQuickFilter = (currentFilters: FilterState, quickFilter: FilterQuickAction): FilterState => {
  return {
    ...currentFilters,
    ...quickFilter.filters
  };
};

export const getFilterDisplayText = (filters: FilterState): string[] => {
  const texts: string[] = [];

  if (filters.category) texts.push(`Category: ${filters.category}`);
  if (filters.priceMin || filters.priceMax) {
    const min = filters.priceMin || 0;
    const max = filters.priceMax || Infinity;
    texts.push(`Price: ₹${min} - ${max === Infinity ? '∞' : max}`);
  }
  if (filters.rating) texts.push(`Rating: ${filters.rating}+ ⭐`);
  if (filters.brands?.length) texts.push(`Brands: ${filters.brands.join(', ')}`);
  if (filters.discount) texts.push(`Discount: ${filters.discount}%+`);
  if (filters.isNew) texts.push('New Arrivals');
  if (filters.isBestseller) texts.push('Bestsellers');
  if (filters.colors?.length) texts.push(`Colors: ${filters.colors.join(', ')}`);
  if (filters.sizes?.length) texts.push(`Sizes: ${filters.sizes.join(', ')}`);

  return texts;
};

export const getSortLabel = (sortBy: SortOption): string => {
  const sortOption = SORT_OPTIONS.find(option => option.value === sortBy);
  return sortOption?.label || 'Relevance';
};

export const getSortIcon = (sortBy: SortOption): string => {
  const sortOption = SORT_OPTIONS.find(option => option.value === sortBy);
  return sortOption?.icon || '🎯';
};

export const hasActiveFilters = (filters: FilterState): boolean => {
  return getActiveFiltersCount(filters) > 0;
};

export const getFilterSummary = (filters: FilterState): string => {
  const activeCount = getActiveFiltersCount(filters);
  if (activeCount === 0) return 'No filters applied';
  if (activeCount === 1) return '1 filter applied';
  return `${activeCount} filters applied`;
};
