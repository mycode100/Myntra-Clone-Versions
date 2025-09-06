import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  Dimensions,
  Animated,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from 'react-native';
import {
  Search,
  X,
  Clock,
  TrendingUp,
  ArrowUpRight,
  Mic,
  Camera,
  Tag,
  Filter,
  Grid3X3,
  List,
  Star,
  Heart,
  ShoppingBag,
  SortAsc,
  RotateCcw,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

import { 
  Product, 
  SearchSuggestion, 
  FilterState, 
  Category,
  PriceRange,
  SortOption,
  getActiveFiltersCount,
  getSortLabel,
  SORT_OPTIONS,
  resetFilters,
} from '@/types/product';
import { applyFiltersToProducts } from '@/utils/api';
import FilterModal from '@/components/FilterModal';

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;

// ✅ ENHANCED SearchOverlayProps interface
interface SearchOverlayProps {
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
  onSearchComplete?: (query: string, filters?: FilterState) => void;
  onCategoryPress?: (categoryId: string, categoryName: string) => void;
  onSubcategoryPress?: (categoryId: string, subcategory: string, categoryName: string) => void;
  // ✅ NEW: Enhanced props for integrated filters
  onApplyFilters?: (filters: FilterState) => void;
  availableBrands?: string[];
  priceRange?: PriceRange;
  availableColors?: string[];
  availableSizes?: string[];
  totalProducts?: number;
  onSortChange?: (sortBy: SortOption) => void;
}

interface RecentSearch {
  id: string;
  query: string;
  timestamp: number;
}

interface EnhancedSearchSuggestion extends SearchSuggestion {
  categoryId?: string;
  categoryName?: string;
  subcategory?: string;
  productId?: string;
  brand?: string;
}

const RECENT_SEARCHES_KEY = '@recent_searches';
const MAX_RECENT_SEARCHES = 10;
const SEARCH_DELAY = 300;

const TRENDING_SEARCHES = [
  { id: '1', text: 'T-Shirts', type: 'category' as const, count: 1250 },
  { id: '2', text: 'Jeans', type: 'category' as const, count: 890 },
  { id: '3', text: 'Dresses', type: 'category' as const, count: 756 },
  { id: '4', text: 'Roadster', type: 'brand' as const, count: 645 },
  { id: '5', text: 'Men', type: 'category' as const, count: 523 },
  { id: '6', text: 'Women', type: 'category' as const, count: 434 },
];

// ✅ HELPER: Safe function to get product ID
const getProductId = (product: Product): string => {
  return (product as any).id?.toString() || product._id || '';
};

// ✅ NEW: ProductCard Component for filtered results
interface ProductCardProps {
  product: Product;
  layout: 'grid' | 'list';
  onPress: () => void;
  onWishlistPress?: () => void;
  onBagPress?: () => void;
  isInWishlist?: boolean;
  isInBag?: boolean;
}

const ProductCard: React.FC<ProductCardProps> = ({ 
  product, 
  layout, 
  onPress, 
  onWishlistPress,
  onBagPress,
  isInWishlist = false,
  isInBag = false
}) => {
  const cardStyle = layout === 'grid' ? styles.productCardGrid : styles.productCardList;
  const imageStyle = layout === 'grid' ? styles.productImage : styles.productImageList;
  
  const formatPrice = (price: number) => {
    return `₹${price.toLocaleString()}`;
  };

  const renderRating = (rating: number, ratingCount?: number) => {
    if (!rating) return null;
    return (
      <View style={styles.productRating}>
        <Star size={12} color="#ffb400" fill="#ffb400" />
        <Text style={styles.ratingText}>
          {rating.toFixed(1)} {ratingCount && `(${ratingCount})`}
        </Text>
      </View>
    );
  };

  return (
    <TouchableOpacity
      style={[styles.productCard, cardStyle]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: product.images?.[0] || 'https://via.placeholder.com/200' }}
        style={imageStyle}
        resizeMode="cover"
      />
      
      <View style={styles.productDetails}>
        <Text style={styles.productBrand} numberOfLines={1}>
          {product.brand}
        </Text>
        <Text style={styles.productName} numberOfLines={2}>
          {product.name}
        </Text>
        
        <View style={styles.productPriceContainer}>
          <Text style={styles.productPrice}>
            {formatPrice(product.price)}
          </Text>
          {product.originalPrice && product.originalPrice > product.price && (
            <>
              <Text style={styles.productOriginalPrice}>
                {formatPrice(product.originalPrice)}
              </Text>
              <Text style={styles.productDiscount}>
                {Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}% OFF
              </Text>
            </>
          )}
        </View>

        {product.rating && renderRating(product.rating, product.ratingCount)}
      </View>

      {layout === 'list' && (
        <View style={styles.productActions}>
          <TouchableOpacity
            style={[styles.actionButton, isInWishlist && styles.actionButtonActive]}
            onPress={onWishlistPress}
          >
            <Heart size={16} color={isInWishlist ? '#fff' : '#ff3f6c'} fill={isInWishlist ? '#fff' : 'none'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, isInBag && styles.actionButtonActive]}
            onPress={onBagPress}
          >
            <ShoppingBag size={16} color={isInBag ? '#fff' : '#ff3f6c'} fill={isInBag ? '#fff' : 'none'} />
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
};

const SearchOverlay: React.FC<SearchOverlayProps> = ({
  visible,
  onClose,
  products = [],
  categories = [],
  onProductPress,
  onFilterPress,
  initialQuery = '',
  showFilters = true,
  activeFilters = {},
  onWishlistPress,
  onBagPress,
  onSearchComplete,
  onCategoryPress,
  onSubcategoryPress,
  // ✅ NEW: Enhanced props
  onApplyFilters,
  availableBrands = [],
  priceRange,
  availableColors = [],
  availableSizes = [],
  totalProducts = 0,
  onSortChange,
}) => {
  const router = useRouter();
  
  // ✅ ENHANCED: State management
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showResults, setShowResults] = useState(false);
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  
  // ✅ NEW: Filter state
  const [filters, setFilters] = useState<FilterState>(activeFilters);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  
  const [fadeAnim] = useState(new Animated.Value(0));
  const searchInputRef = useRef<TextInput>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | undefined>();

  // ✅ ENHANCED: Safety check with proper ID handling
  const safeProducts = useMemo(() => {
    return Array.isArray(products) ? products.filter(p => p && typeof p === 'object' && getProductId(p)) : [];
  }, [products]);

  const safeCategories = useMemo(() => {
    return Array.isArray(categories) ? categories.filter(c => c && typeof c === 'object' && c._id && c.name) : [];
  }, [categories]);

  // ✅ NEW: Apply filters and search to products
  const filteredProducts = useMemo(() => {
    let filtered = [...safeProducts];

    // Apply search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(product =>
        product.name?.toLowerCase().includes(query) ||
        product.brand?.toLowerCase().includes(query) ||
        product.categoryName?.toLowerCase().includes(query) ||
        product.description?.toLowerCase().includes(query)
      );
    }

    // Apply filters using utility function
    filtered = applyFiltersToProducts(filtered, filters);

    return filtered;
  }, [safeProducts, searchQuery, filters]);

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    return getActiveFiltersCount(filters);
  }, [filters]);

  // ✅ ENHANCED: Advanced search suggestions with proper IDs
  const searchSuggestions = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return [];
    
    const query = searchQuery.toLowerCase();
    const suggestions: EnhancedSearchSuggestion[] = [];

    // Category suggestions
    safeCategories.forEach(category => {
      const categoryId = category._id;
      const categoryName = category.name;
      
      if (categoryName && categoryName.toLowerCase().includes(query)) {
        suggestions.push({
          id: `category-${categoryId}`,
          text: categoryName,
          type: 'category',
          image: category.image,
          count: safeProducts.filter(p => p.categoryName === categoryName).length,
          categoryId: categoryId,
          categoryName: categoryName,
        });
      }

      // Subcategory suggestions
      if (Array.isArray(category.subcategory)) {
        category.subcategory.forEach((sub: string) => {
          if (sub && sub.toLowerCase().includes(query)) {
            suggestions.push({
              id: `subcategory-${categoryId}-${sub.replace(/\s+/g, '-')}`,
              text: `${sub} in ${categoryName}`,
              type: 'category',
              image: category.image,
              count: safeProducts.filter(p => 
                p.categoryName === categoryName && 
                (p.subcategory === sub || (p.name && p.name.toLowerCase().includes(sub.toLowerCase())))
              ).length,
              categoryId: categoryId,
              categoryName: categoryName,
              subcategory: sub,
            });
          }
        });
      }
    });

    // Product suggestions
    const productSuggestions = safeProducts
      .filter(p => p?.name && typeof p.name === 'string' && p.name.toLowerCase().includes(query))
      .slice(0, 4)
      .map(p => ({
        id: getProductId(p),
        text: p.name,
        type: 'product' as const,
        image: p.images?.[0],
        productId: getProductId(p),
        brand: p.brand,
        categoryName: p.categoryName,
      }));

    // Brand suggestions
    const brandSet = new Set<string>();
    const brandSuggestions: EnhancedSearchSuggestion[] = [];
    
    for (const p of safeProducts) {
      if (p?.brand && typeof p.brand === 'string' && 
          p.brand.toLowerCase().includes(query) && 
          !brandSet.has(p.brand)) {
        brandSet.add(p.brand);
        brandSuggestions.push({
          id: `brand-${p.brand.replace(/\s+/g, '-')}`,
          text: p.brand,
          type: 'brand',
          count: safeProducts.filter(prod => prod?.brand === p.brand).length,
          brand: p.brand,
        });
        if (brandSuggestions.length >= 3) break;
      }
    }
    
    return [...productSuggestions, ...suggestions.slice(0, 3), ...brandSuggestions].slice(0, 8);
  }, [searchQuery, safeProducts, safeCategories]);

  // Update filters when activeFilters change
  useEffect(() => {
    setFilters(activeFilters);
  }, [activeFilters]);

  // Load recent searches
  const loadRecentSearches = async () => {
    try {
      const stored = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        const recent: RecentSearch[] = JSON.parse(stored);
        const validated = recent.filter(
          item => item && typeof item.id === 'string' && typeof item.query === 'string'
        );
        setRecentSearches(validated.sort((a, b) => b.timestamp - a.timestamp));
      }
    } catch (error) {
      console.error('Error loading recent searches:', error);
      setRecentSearches([]);
    }
  };

  // Save recent search
  const saveRecentSearch = async (query: string) => {
    if (!query.trim()) return;
    try {
      const newSearch: RecentSearch = {
        id: Date.now().toString(),
        query: query.trim(),
        timestamp: Date.now(),
      };
      const filtered = recentSearches.filter(item => item.query.toLowerCase() !== query.toLowerCase());
      const updated = [newSearch, ...filtered].slice(0, MAX_RECENT_SEARCHES);
      await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      setRecentSearches(updated);
    } catch (error) {
      console.error('Error saving recent search:', error);
    }
  };

  // Clear recent searches
  const clearRecentSearches = async () => {
    try {
      await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
      setRecentSearches([]);
    } catch (error) {
      console.error('Error clearing recent searches:', error);
    }
  };

  // Handle visibility changes
  useEffect(() => {
    if (visible) {
      setSearchQuery(initialQuery);
      setShowResults(Boolean(initialQuery.trim()));
      loadRecentSearches();
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      setShowResults(false);
      setShowSuggestions(true);
    }
  }, [visible, initialQuery]);

  // Handle search debouncing
  useEffect(() => {
    if (searchQuery.trim()) {
      setIsSearching(true);
      setShowSuggestions(false);

      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

      searchTimeoutRef.current = setTimeout(() => {
        setIsSearching(false);
        setShowSuggestions(true);
        setShowResults(searchQuery.trim().length >= 2);
      }, SEARCH_DELAY);
    } else {
      setShowSuggestions(true);
      setShowResults(false);
      setIsSearching(false);

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = undefined;
      }
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = undefined;
      }
    };
  }, [searchQuery]);

  // Handle input change
  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  // ✅ ENHANCED: Apply filters
  const handleApplyFilters = (newFilters: FilterState) => {
    setFilters(newFilters);
    if (onApplyFilters) {
      onApplyFilters(newFilters);
    }
    setShowFilterModal(false);
  };

  // ✅ NEW: Reset filters
  const handleResetFilters = () => {
    const resetedFilters = resetFilters();
    setFilters(resetedFilters);
    if (onApplyFilters) {
      onApplyFilters(resetedFilters);
    }
  };

  // ✅ NEW: Handle sort change
  const handleSortChange = (sortBy: SortOption) => {
    const newFilters = { ...filters, sortBy };
    setFilters(newFilters);
    if (onApplyFilters) {
      onApplyFilters(newFilters);
    }
    if (onSortChange) {
      onSortChange(sortBy);
    }
    setShowSortModal(false);
  };

  // ✅ ENHANCED: Handle brand navigation
  const handleSuggestionPress = (suggestion: EnhancedSearchSuggestion) => {
    console.log('🔍 Suggestion pressed:', suggestion);
    saveRecentSearch(suggestion.text);

    if (suggestion.type === 'product') {
      const productId = suggestion.productId || suggestion.id;
      if (onProductPress && productId) {
        console.log('🔍 Navigating to product:', productId);
        onProductPress(productId);
        handleClose();
        return;
      }
    } else if (suggestion.type === 'category') {
      if (suggestion.subcategory && suggestion.categoryId && suggestion.categoryName) {
        if (onSubcategoryPress) {
          console.log('🔍 Navigating to subcategory:', suggestion.categoryId, suggestion.subcategory, suggestion.categoryName);
          onSubcategoryPress(suggestion.categoryId, suggestion.subcategory, suggestion.categoryName);
          handleClose();
          return;
        }
      } else if (suggestion.categoryId && suggestion.categoryName) {
        if (onCategoryPress) {
          console.log('🔍 Navigating to category:', suggestion.categoryId, suggestion.categoryName);
          onCategoryPress(suggestion.categoryId, suggestion.categoryName);
          handleClose();
          return;
        }
      }
    } else if (suggestion.type === 'brand') {
      // ✅ ENHANCED: Brand navigation using router
      console.log('🔍 Navigating to brand:', suggestion.brand);
      if (suggestion.brand) {
        router.push(`/brand/${encodeURIComponent(suggestion.brand)}` as any);
        handleClose();
        return;
      }
    }
    
    // Default: Trigger search complete and show results
    console.log('🔍 Default search for:', suggestion.text);
    setSearchQuery(suggestion.text);
    setShowResults(true);
    if (onSearchComplete) {
      onSearchComplete(suggestion.text, filters);
    }
  };

  // ✅ ENHANCED: Handle recent search press
  const handleRecentSearchPress = (query: string) => {
    console.log('🔍 Recent search pressed:', query);
    saveRecentSearch(query);
    setSearchQuery(query);
    setShowResults(true);
    if (onSearchComplete) {
      onSearchComplete(query, filters);
    }
  };

  // ✅ ENHANCED: Handle search input submit (stay open)
  const handleSearchSubmit = () => {
    if (searchQuery.trim().length >= 2) {
      console.log('🔍 Search submitted:', searchQuery);
      saveRecentSearch(searchQuery.trim());
      setShowResults(true);
      if (onSearchComplete) {
        onSearchComplete(searchQuery.trim(), filters);
      }
      // ✅ STAY OPEN - Don't close overlay
    }
  };

  // Handle close with cleanup
  const handleClose = () => {
    setSearchQuery('');
    setShowSuggestions(true);
    setShowResults(false);
    setShowFilterModal(false);
    setShowSortModal(false);
    onClose();
  };

  // ✅ NEW: Handle product press
  const handleProductPress = (product: Product) => {
    const productId = getProductId(product);
    if (onProductPress && productId) {
      onProductPress(productId);
    }
  };

  // ✅ ENHANCED: Suggestion item with type indicators
  const SuggestionItem: React.FC<{ suggestion: EnhancedSearchSuggestion; onPress: () => void; icon: React.ReactNode }> = ({
    suggestion,
    onPress,
    icon,
  }) => (
    <TouchableOpacity style={styles.suggestionItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.suggestionLeft}>
        {suggestion.image ? (
          <Image 
            source={{ uri: suggestion.image }} 
            style={styles.suggestionImage}
          />
        ) : (
          <View style={styles.suggestionIcon}>{icon}</View>
        )}
        <View style={styles.suggestionTextContainer}>
          <Text style={styles.suggestionText}>{suggestion.text}</Text>
          {suggestion.count && <Text style={styles.suggestionCount}>{suggestion.count} products</Text>}
          <Text style={styles.suggestionType}>
            {suggestion.type === 'product' ? '🛍️ Product' : 
             suggestion.type === 'brand' ? '🏷️ Brand' : 
             suggestion.subcategory ? '📂 Subcategory' : '📁 Category'}
          </Text>
        </View>
      </View>
      <ArrowUpRight size={16} color="#999" />
    </TouchableOpacity>
  );

  // ✅ NEW: Render sort modal
  const renderSortModal = () => (
    <Modal visible={showSortModal} transparent animationType="fade" onRequestClose={() => setShowSortModal(false)}>
      <TouchableOpacity style={styles.sortModalOverlay} activeOpacity={1} onPress={() => setShowSortModal(false)}>
        <View style={styles.sortModalContent}>
          <Text style={styles.sortModalTitle}>Sort By</Text>
          {SORT_OPTIONS.map(option => (
            <TouchableOpacity
              key={option.value}
              style={[styles.sortOption, filters.sortBy === option.value && styles.sortOptionActive]}
              onPress={() => handleSortChange(option.value)}
              activeOpacity={0.7}
            >
              <Text style={[styles.sortOptionText, filters.sortBy === option.value && styles.sortOptionTextActive]}>
                {option.label}
              </Text>
              {option.icon && <Text style={styles.sortOptionIcon}>{option.icon}</Text>}
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />

          <Animated.View
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [
                  {
                    translateY: fadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-50, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.searchContainer}>
                <View style={styles.searchInputContainer}>
                  <Search size={20} color="#666" style={styles.searchIcon} />
                  <TextInput
                    ref={searchInputRef}
                    style={styles.searchInput}
                    value={searchQuery}
                    onChangeText={handleSearch}
                    onSubmitEditing={handleSearchSubmit}
                    placeholder="Search for products, brands, categories and more"
                    placeholderTextColor="#999"
                    returnKeyType="search"
                    autoCorrect={false}
                    autoCapitalize="none"
                    blurOnSubmit={false}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity
                      style={styles.clearButton}
                      onPress={() => {
                        setSearchQuery('');
                        setShowResults(false);
                      }}
                      activeOpacity={0.7}
                      accessibilityLabel="Clear search query"
                    >
                      <X size={18} color="#666" />
                    </TouchableOpacity>
                  )}
                  <View style={styles.searchActions}>
                    <TouchableOpacity style={styles.voiceButton} activeOpacity={0.7} accessibilityLabel="Voice search">
                      <Mic size={18} color="#666" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cameraButton} activeOpacity={0.7} accessibilityLabel="Camera search">
                      <Camera size={18} color="#666" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <View style={styles.headerActions}>
                {showFilters && (
                  <TouchableOpacity 
                    style={styles.filterButton} 
                    onPress={() => setShowFilterModal(true)} 
                    activeOpacity={0.7}
                  >
                    <Filter size={20} color="#ff3f6c" />
                    {activeFiltersCount > 0 && (
                      <View style={styles.filterBadge}>
                        <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.closeButton} onPress={handleClose} activeOpacity={0.7} accessibilityLabel="Close search overlay">
                  <X size={24} color="#333" />
                </TouchableOpacity>
              </View>
            </View>

            {/* ✅ NEW: Results Header with filters and sort */}
            {showResults && (
              <View style={styles.resultsHeader}>
                <Text style={styles.resultsCount}>
                  {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} found
                  {searchQuery.trim() && ` for "${searchQuery}"`}
                </Text>
                
                <View style={styles.resultsActions}>
                  {activeFiltersCount > 0 && (
                    <TouchableOpacity
                      style={styles.resetFiltersButton}
                      onPress={handleResetFilters}
                      activeOpacity={0.7}
                    >
                      <RotateCcw size={16} color="#ff3f6c" />
                      <Text style={styles.resetFiltersText}>Reset</Text>
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity
                    style={styles.sortButton}
                    onPress={() => setShowSortModal(true)}
                    activeOpacity={0.7}
                  >
                    <SortAsc size={16} color="#666" />
                    <Text style={styles.sortButtonText}>{getSortLabel(filters.sortBy || 'relevance')}</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.layoutButton}
                    onPress={() => setLayout(layout === 'grid' ? 'list' : 'grid')}
                    activeOpacity={0.7}
                  >
                    {layout === 'grid' ? <List size={18} color="#666" /> : <Grid3X3 size={18} color="#666" />}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Content */}
            <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {isSearching && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#ff3f6c" />
                  <Text style={styles.loadingText}>Searching...</Text>
                </View>
              )}

              {/* ✅ NEW: Search Results */}
              {!isSearching && showResults && (
                <View style={styles.resultsContainer}>
                  {filteredProducts.length > 0 ? (
                    <FlatList
                      data={filteredProducts}
                      keyExtractor={(item, index) => `${getProductId(item)}-${index}`}
                      numColumns={layout === 'grid' ? 2 : 1}
                      key={layout}
                      renderItem={({ item }) => (
                        <ProductCard
                          product={item}
                          layout={layout}
                          onPress={() => handleProductPress(item)}
                          onWishlistPress={() => onWishlistPress?.(getProductId(item))}
                          onBagPress={() => onBagPress?.(getProductId(item))}
                        />
                      )}
                      contentContainerStyle={styles.productsList}
                      showsVerticalScrollIndicator={false}
                      nestedScrollEnabled
                    />
                  ) : (
                    <View style={styles.noResultsContainer}>
                      <Text style={styles.noResultsText}>No products found</Text>
                      <Text style={styles.noResultsSubtext}>Try adjusting your search or filters</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Search suggestions */}
              {!isSearching && searchQuery.trim() && searchSuggestions.length > 0 && !showResults && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Suggestions</Text>
                  </View>
                  {searchSuggestions.map((suggestion) => (
                    <SuggestionItem
                      key={suggestion.id}
                      suggestion={suggestion}
                      onPress={() => handleSuggestionPress(suggestion)}
                      icon={
                        suggestion.type === 'product' ? (
                          <Search size={16} color="#666" />
                        ) : (
                          <Tag size={16} color="#666" />
                        )
                      }
                    />
                  ))}
                </View>
              )}

              {/* Recent searches */}
              {showSuggestions && !searchQuery.trim() && recentSearches.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Recent Searches</Text>
                    <TouchableOpacity onPress={clearRecentSearches} activeOpacity={0.7} accessibilityLabel="Clear all recent searches">
                      <Text style={styles.clearText}>Clear All</Text>
                    </TouchableOpacity>
                  </View>
                  {recentSearches.map((search) => (
                    <TouchableOpacity
                      key={search.id}
                      style={styles.recentItem}
                      onPress={() => handleRecentSearchPress(search.query)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.recentLeft}>
                        <Clock size={16} color="#999" />
                        <Text style={styles.recentText}>{search.query}</Text>
                      </View>
                      <ArrowUpRight size={16} color="#999" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Trending searches */}
              {showSuggestions && !searchQuery.trim() && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Trending</Text>
                  </View>
                  {TRENDING_SEARCHES.map((trend) => (
                    <TouchableOpacity
                      key={trend.id}
                      style={styles.trendingItem}
                      onPress={() => handleRecentSearchPress(trend.text)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.trendingLeft}>
                        <TrendingUp size={16} color="#ff3f6c" />
                        <View style={styles.trendingTextContainer}>
                          <Text style={styles.trendingText}>{trend.text}</Text>
                          <Text style={styles.trendingCount}>{trend.count} products</Text>
                        </View>
                      </View>
                      <ArrowUpRight size={16} color="#999" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={{ height: 50 }} />
            </ScrollView>
          </Animated.View>
        </Animated.View>

        {/* ✅ NEW: Filter Modal */}
        <FilterModal
          visible={showFilterModal}
          onClose={() => setShowFilterModal(false)}
          onApply={handleApplyFilters}
          currentFilters={filters}
          categories={safeCategories}
          brands={availableBrands.length > 0 ? availableBrands : Array.from(new Set(safeProducts.map(p => p.brand).filter(Boolean)))}
          priceRange={priceRange}
          totalProducts={filteredProducts.length}
          colors={availableColors.length > 0 ? availableColors : Array.from(new Set(safeProducts.flatMap(p => p.colors || [])))}
          sizes={availableSizes.length > 0 ? availableSizes : Array.from(new Set(safeProducts.flatMap(p => p.sizes || [])))}
          products={safeProducts}
        />

        {/* ✅ NEW: Sort Modal */}
        {renderSortModal()}
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ✅ ENHANCED: Complete styles with new components
const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  content: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: Platform.OS === 'ios' ? 44 : 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: isTablet ? 24 : 16,
    paddingVertical: isTablet ? 16 : 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  searchContainer: { flex: 1 },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: isTablet ? 16 : 12,
    paddingHorizontal: isTablet ? 16 : 12,
    height: isTablet ? 48 : 44,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    fontSize: isTablet ? 18 : 16,
    color: '#333',
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
    marginRight: 8,
  },
  searchActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voiceButton: { padding: 6, marginRight: 4 },
  cameraButton: { padding: 6 },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  filterButton: {
    position: 'relative',
    padding: 8,
    marginRight: 8,
  },
  filterBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#ff3f6c',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  
  // ✅ NEW: Results header styles
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: isTablet ? 24 : 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#f8f9fa',
  },
  resultsCount: {
    fontSize: isTablet ? 16 : 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  resultsActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resetFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
  },
  resetFiltersText: {
    fontSize: 12,
    color: '#ff3f6c',
    fontWeight: '500',
    marginLeft: 4,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  sortButtonText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  layoutButton: {
    padding: 8,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },

  scrollContent: {
    flex: 1,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: isTablet ? 24 : 20,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: isTablet ? 16 : 14,
    color: '#666',
  },

  // ✅ NEW: Results container styles
  resultsContainer: {
    flex: 1,
  },
  productsList: {
    paddingHorizontal: isTablet ? 20 : 16,
    paddingVertical: isTablet ? 16 : 12,
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  noResultsText: {
    fontSize: isTablet ? 20 : 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  noResultsSubtext: {
    fontSize: isTablet ? 16 : 14,
    color: '#666',
    textAlign: 'center',
  },

  // ✅ NEW: Product card styles
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  productCardGrid: {
    width: (screenWidth - (isTablet ? 60 : 48)) / 2,
    marginHorizontal: (isTablet ? 4 : 2),
  },
  productCardList: {
    width: '100%',
    flexDirection: 'row',
  },
  productImage: {
    width: '100%',
    height: isTablet ? 200 : 160,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: '#f8f9fa',
  },
  productImageList: {
    width: isTablet ? 120 : 100,
    height: isTablet ? 120 : 100,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    backgroundColor: '#f8f9fa',
  },
  productDetails: {
    padding: isTablet ? 16 : 12,
    flex: 1,
  },
  productBrand: {
    fontSize: isTablet ? 14 : 12,
    color: '#ff3f6c',
    fontWeight: '500',
    marginBottom: 4,
  },
  productName: {
    fontSize: isTablet ? 16 : 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  productPriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  productPrice: {
    fontSize: isTablet ? 18 : 16,
    fontWeight: '700',
    color: '#333',
    marginRight: 8,
  },
  productOriginalPrice: {
    fontSize: isTablet ? 14 : 12,
    color: '#999',
    textDecorationLine: 'line-through',
    marginRight: 8,
  },
  productDiscount: {
    fontSize: isTablet ? 12 : 10,
    color: '#4caf50',
    fontWeight: '600',
  },
  productRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: isTablet ? 12 : 10,
    color: '#666',
    marginLeft: 4,
  },
  productActions: {
    flexDirection: 'row',
    paddingHorizontal: isTablet ? 16 : 12,
    paddingBottom: isTablet ? 16 : 12,
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ff3f6c',
    backgroundColor: '#fff',
  },
  actionButtonActive: {
    backgroundColor: '#ff3f6c',
  },

  // ✅ NEW: Sort modal styles
  sortModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortModalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    minWidth: 200,
    maxWidth: 280,
  },
  sortModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  sortOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  sortOptionActive: {
    backgroundColor: '#ff3f6c',
  },
  sortOptionText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  sortOptionTextActive: {
    color: '#fff',
  },
  sortOptionIcon: {
    fontSize: 16,
  },

  // Original suggestion styles
  section: {
    paddingHorizontal: isTablet ? 24 : 16,
    paddingVertical: isTablet ? 12 : 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: isTablet ? 16 : 12,
  },
  sectionTitle: {
    fontSize: isTablet ? 18 : 16,
    fontWeight: '600',
    color: '#333',
  },
  clearText: {
    fontSize: isTablet ? 16 : 14,
    color: '#ff3f6c',
    fontWeight: '500',
  },
  suggestionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: isTablet ? 16 : 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  suggestionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  suggestionImage: {
    width: isTablet ? 48 : 40,
    height: isTablet ? 48 : 40,
    borderRadius: isTablet ? 8 : 6,
    backgroundColor: '#f8f9fa',
  },
  suggestionIcon: {
    width: isTablet ? 48 : 40,
    height: isTablet ? 48 : 40,
    borderRadius: isTablet ? 8 : 6,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionTextContainer: {
    marginLeft: isTablet ? 16 : 12,
    flex: 1,
  },
  suggestionText: {
    fontSize: isTablet ? 16 : 15,
    color: '#333',
    fontWeight: '400',
  },
  suggestionCount: {
    fontSize: isTablet ? 14 : 12,
    color: '#666',
    marginTop: 2,
  },
  suggestionType: {
    fontSize: isTablet ? 12 : 10,
    color: '#ff3f6c',
    marginTop: 2,
    fontWeight: '500',
  },
  recentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: isTablet ? 16 : 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  recentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  recentText: {
    fontSize: isTablet ? 16 : 15,
    color: '#333',
    marginLeft: isTablet ? 16 : 12,
  },
  trendingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: isTablet ? 16 : 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  trendingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  trendingTextContainer: {
    marginLeft: isTablet ? 16 : 12,
    flex: 1,
  },
  trendingText: {
    fontSize: isTablet ? 16 : 15,
    color: '#333',
    fontWeight: '500',
  },
  trendingCount: {
    fontSize: isTablet ? 14 : 12,
    color: '#ff3f6c',
    marginTop: 2,
  },
});

export default SearchOverlay;
