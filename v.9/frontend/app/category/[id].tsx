import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  RefreshControl,
  FlatList,
  Animated,
  StatusBar,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Search,
  Filter,
  Grid3X3,
  List,
  Star,
  Heart,
  SlidersHorizontal,
  TrendingUp,
  Award,
  Tag,
} from "lucide-react-native";

// ✅ UPDATED: Only import wishlist-related API functions
import {
  getCategories,
  getProducts,
  getCategoryById,
  getProductsByCategory,
  addToWishlist,
  removeFromWishlist,
  handleApiError,
  getUserWishlist,
} from "@/utils/api";

import { Product as OriginalProduct, Category, SortOption, FilterState } from "@/types/product";

// Extend Product type to include optional 'id' for compatibility
type Product = OriginalProduct & { id?: string };
import FilterModal from "@/components/FilterModal";
import SearchOverlay from "@/components/SearchOverlay";
import { useAuth } from "@/context/AuthContext";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

// Types
interface CategoryDetailState {
  category: Category | null;
  products: Product[];
  filteredProducts: Product[];
  isLoading: boolean;
  error: string | null;
  refreshing: boolean;
}

interface ProductCardProps {
  product: Product;
  onPress: () => void;
  onWishlistPress?: () => void;
  isWishlisted?: boolean;
  layout?: 'grid' | 'list';
  wishlistLoading?: boolean;
}

// Constants
const PRODUCTS_PER_PAGE = 20;

const SORT_OPTIONS: { label: string; value: SortOption; icon: string }[] = [
  { label: 'Relevance', value: 'relevance', icon: '🎯' },
  { label: 'Price: Low to High', value: 'price_asc', icon: '📈' },
  { label: 'Price: High to Low', value: 'price_desc', icon: '📉' },
  { label: 'Customer Rating', value: 'rating', icon: '⭐' },
  { label: 'Newest First', value: 'newest', icon: '🆕' },
  { label: 'Most Popular', value: 'popularity', icon: '🔥' },
];

export default function CategoryDetails() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  
  // ✅ UPDATED: Only use wishlist-related context methods
  const { 
    user, 
    wishlistItems,
    updateWishlistStatus,
    refreshUserPreferences,
    optimisticUpdateWishlist,
    forceWishlistRefresh,
    wishlistRefreshTrigger,
  } = useAuth();

  console.log("🔍 Category ID from params:", id, typeof id);

  // State
  const [state, setState] = useState<CategoryDetailState>({
    category: null,
    products: [],
    filteredProducts: [],
    isLoading: true,
    error: null,
    refreshing: false,
  });

  const [filters, setFilters] = useState<FilterState>({
    sortBy: 'relevance',
  });
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showSearchOverlay, setShowSearchOverlay] = useState(false);
  
  // ✅ UPDATED: Only wishlist loading state
  const [wishlistLoading, setWishlistLoading] = useState<Set<string>>(new Set());

  // Refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const headerScrollY = useRef(new Animated.Value(0)).current;

  // ✅ Listen to wishlist refresh triggers for cross-page sync
  useEffect(() => {
    if (wishlistRefreshTrigger > 0) {
      console.log("🔄 Category: Wishlist refresh trigger activated");
      setState(prev => ({ ...prev }));
    }
  }, [wishlistRefreshTrigger]);

  // Memoized calculations
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.priceMin !== undefined || filters.priceMax !== undefined) count++;
    if (filters.rating) count++;
    if (filters.brands && filters.brands.length > 0) count++;
    if (filters.discount) count++;
    if (filters.sortBy && filters.sortBy !== 'relevance') count++;
    if (filters.category) count++;
    if (filters.subcategory) count++;
    return count;
  }, [filters]);

  const availableBrands = useMemo(() => {
    const brandsSet = new Set<string>();
    state.products.forEach(product => {
      if (product.brand) brandsSet.add(product.brand);
    });
    return Array.from(brandsSet).sort();
  }, [state.products]);

  const priceRange = useMemo(() => {
    if (state.products.length === 0) return { min: 0, max: 50000 };
    
    const prices = state.products.map(p => p.price);
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
    };
  }, [state.products]);

  // Apply filters to products
  const filteredProducts = useMemo(() => {
    let filtered = [...state.products];

    // Apply price filter
    if (filters.priceMin !== undefined) {
      filtered = filtered.filter(p => p.price >= filters.priceMin!);
    }
    if (filters.priceMax !== undefined) {
      filtered = filtered.filter(p => p.price <= filters.priceMax!);
    }

    // Apply rating filter
    if (filters.rating) {
      filtered = filtered.filter(p => (p.rating || 0) >= filters.rating!);
    }

    // Apply brand filter
    if (filters.brands && filters.brands.length > 0) {
      filtered = filtered.filter(p => p.brand && filters.brands!.includes(p.brand));
    }

    // Apply discount filter
    if (filters.discount) {
      filtered = filtered.filter(p => {
        if (!p.discount) return false;
        const discountPercent = parseInt(p.discount.replace(/\D/g, ''));
        return discountPercent >= filters.discount!;
      });
    }

    // Apply sorting
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

    return filtered;
  }, [state.products, filters]);

  // Effects
  useEffect(() => {
    if (id) {
      fetchCategoryData();
    }
  }, [id]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  // ✅ Enhanced fetchCategoryData with better error handling
  const fetchCategoryData = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      if (!id) {
        throw new Error("Category ID is missing");
      }

      console.log("🔍 Fetching category data for ID:", id);

      // Get category first
      const categoryResponse = await getCategoryById(id as string);
      
      if (!categoryResponse.success) {
        throw new Error(handleApiError(categoryResponse.error));
      }

      const matchedCategory = categoryResponse.data;
      console.log("🔍 Category found:", matchedCategory);

      if (!matchedCategory) {
        setState(prev => ({
          ...prev,
          error: "Category not found",
          isLoading: false,
        }));
        return;
      }

      // Try multiple approaches to get products
      let categoryProducts: Product[] = [];

      // Method 1: Try category-specific products endpoint
      try {
        console.log("🔍 Trying getProductsByCategory...");
        const productsResponse = await getProductsByCategory(id as string, { 
          limit: 50,
          page: 1 
        });
        
        if (productsResponse.success && productsResponse.data) {
          categoryProducts = productsResponse.data;
          console.log("✅ Got products from getProductsByCategory:", categoryProducts.length);
        }
      } catch (error) {
        console.warn("⚠️ getProductsByCategory failed, trying fallback");
      }

      // Method 2: Use category's productId array if available
      if (
        categoryProducts.length === 0 &&
        Array.isArray(matchedCategory.productId) &&
        matchedCategory.productId.length > 0
      ) {
        console.log("🔍 Using category.productId array:", matchedCategory.productId.length);
        categoryProducts = matchedCategory.productId;
      }

      // Method 3: Fallback - Get products with category filter
      if (categoryProducts.length === 0) {
        try {
          console.log("🔍 Trying fallback with getProducts...");
          const allProductsResponse = await getProducts({ 
            limit: 50,
            categoryId: id as string
          });
          
          if (allProductsResponse.success && allProductsResponse.data) {
            categoryProducts = (allProductsResponse.data || []).filter((product: Product) => {
              // Check if product belongs to this category
              if (typeof product.category === 'object' && product.category?._id === id) {
                return true;
              }
              if (typeof product.category === 'string' && product.category === id) {
                return true;
              }
              return false;
            });
            console.log("✅ Got products from fallback filtering:", categoryProducts.length);
          }
        } catch (error) {
          console.warn("⚠️ Fallback getProducts also failed");
        }
      }

      // Ensure products have proper IDs
      const enhancedProducts = categoryProducts.map((product: Product) => {
        const productId = product._id || product.id || `temp-${Math.random()}`;
        
        return {
          ...product,
          _id: productId,
          id: productId,
          rating: product.rating || (3.5 + Math.random() * 1.5),
          ratingCount: product.ratingCount || Math.floor(Math.random() * 500) + 10,
          popularity: product.popularity || Math.floor(Math.random() * 1000),
          isNew: product.isNew ?? (Math.random() > 0.8),
          isBestseller: product.isBestseller ?? (Math.random() > 0.9),
        };
      });

      console.log("🔍 Final enhanced products:", enhancedProducts.length);
      console.log("🔍 First product structure:", enhancedProducts[0]);

      setState(prev => ({
        ...prev,
        category: matchedCategory,
        products: enhancedProducts,
        filteredProducts: enhancedProducts,
        isLoading: false,
      }));

    } catch (error: any) {
      console.error("❌ Error loading category:", error);
      setState(prev => ({
        ...prev,
        error: error.message || "Failed to load category data",
        isLoading: false,
      }));
    }
  };

  // ✅ Updated onRefresh to use global preferences
  const onRefresh = async () => {
    setState(prev => ({ ...prev, refreshing: true }));
    await fetchCategoryData();
    
    if (user) {
      await refreshUserPreferences();
    }
    
    setState(prev => ({ ...prev, refreshing: false }));
  };

  // ✅ Enhanced product press handler with debugging
  const handleProductPress = (product: Product) => {
    const productId = product._id || product.id;
    console.log("🔍 Product pressed:", productId, product);
    
    if (!productId) {
      console.error("❌ Product missing ID:", product);
      return;
    }
    
    console.log("🔍 Navigating to product:", productId);
    router.push(`/product/${productId}`);
  };

  // ✅ FIXED: Wishlist handler with proper type safety
  const handleWishlistPress = async (productId: string) => {
    if (!user) {
      Alert.alert(
        "Login Required",
        "Please login to add items to wishlist",
        [
          { text: "Login", onPress: () => router.push("/login") },
          { text: "Cancel", style: "cancel" },
        ]
      );
      return;
    }

    try {
      // Add loading state
      setWishlistLoading(prev => new Set([...prev, productId]));
      
      const isCurrentlyWishlisted = wishlistItems.has(productId);
      
      if (isCurrentlyWishlisted) {
        // ✅ OPTIMISTIC UPDATE: Update UI immediately
        console.log("🔄 Category: Optimistic update - Removing from wishlist UI");
        optimisticUpdateWishlist(productId, null);
        
        console.log("🔍 Category: Removing from wishlist:", productId);
        const response = await removeFromWishlist(productId, user._id);
        
        if (response.success) {
          console.log("✅ Category: Successfully removed from wishlist");
          Alert.alert("Removed ❤️", "Item removed from wishlist");
          
          // ✅ Force complete refresh for cross-page sync
          await refreshUserPreferences();
          forceWishlistRefresh();
          
        } else {
          // ✅ REVERT: Revert optimistic update on failure
          console.log("❌ Category: Failed to remove, reverting UI");
          const product = filteredProducts.find(p => (p._id || p.id) === productId);
          if (product) {
            const revertItem = { 
              _id: productId, 
              productId: product,
              userId: user._id, 
              addedAt: new Date().toISOString(),
              priority: 'medium' as const,
              notes: '',
              priceAlertEnabled: false,
              originalPrice: product.price,
              daysInWishlist: 0,
            };
            optimisticUpdateWishlist(productId, revertItem);
          }
          throw new Error(response.error?.message || "Failed to remove from wishlist");
        }
      } else {
        // ✅ OPTIMISTIC UPDATE: Update UI immediately
        console.log("🔄 Category: Optimistic update - Adding to wishlist UI");
        
        const product = filteredProducts.find(p => (p._id || p.id) === productId);
        if (!product) {
          Alert.alert("Error", "Product not found. Please refresh and try again.");
          return;
        }
        
        const optimisticItem = { 
          _id: productId, 
          productId: product,
          userId: user._id, 
          addedAt: new Date().toISOString(),
          priority: 'medium' as const,
          notes: '',
          priceAlertEnabled: false,
          originalPrice: product.price,
          daysInWishlist: 0,
        };
        optimisticUpdateWishlist(productId, optimisticItem);
        
        console.log("🔍 Category: Adding to wishlist:", productId);
        const response = await addToWishlist({
          userId: user._id,
          productId,
          priority: 'medium'
        });
        
        if (response.success) {
          console.log("✅ Category: Successfully added to wishlist");
          Alert.alert("Added ❤️", "Item added to wishlist");
          
          // ✅ Force complete refresh for cross-page sync
          await refreshUserPreferences();
          forceWishlistRefresh();
          
        } else {
          // ✅ REVERT: Revert optimistic update on failure
          console.log("❌ Category: Failed to add, reverting UI");
          optimisticUpdateWishlist(productId, null);
          throw new Error(response.error?.message || "Failed to add to wishlist");
        }
      }
    } catch (error: any) {
      console.error("❌ Error updating wishlist:", error);
      Alert.alert(
        "Error",
        handleApiError(error) || "Failed to update wishlist. Please try again.",
        [{ text: "OK", style: "default" }]
      );
    } finally {
      // Remove loading state
      setWishlistLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(productId);
        return newSet;
      });
    }
  };

  // Other handlers
  const handleFilterApply = (newFilters: FilterState) => {
    setFilters(newFilters);
    setShowFilterModal(false);
  };

  const handleSortChange = (value: SortOption) => {
    setFilters(prev => ({
      ...prev,
      sortBy: value,
    }));
  };

  const handleRatingFilter = () => {
    setFilters(prev => ({
      ...prev,
      rating: prev.rating === 4 ? undefined : 4
    }));
  };

  const clearAllFilters = () => {
    setFilters({ sortBy: 'relevance' });
  };

  // Rating Component
  const RatingDisplay: React.FC<{ 
    rating?: number; 
    size?: number; 
    showText?: boolean;
    ratingCount?: number;
  }> = ({ rating, size = 14, showText = true, ratingCount }) => {
    if (!rating) return null;
    
    return (
      <View style={styles.ratingContainer}>
        <Star size={size} color="#ffa500" fill="#ffa500" />
        {showText && (
          <Text style={[styles.ratingText, { fontSize: size - 2 }]}>
            {rating.toFixed(1)}
          </Text>
        )}
        {ratingCount && showText && (
          <Text style={[styles.ratingCount, { fontSize: size - 4 }]}>
            ({ratingCount})
          </Text>
        )}
      </View>
    );
  };

  // ✅ UPDATED: ProductCard with only wishlist functionality
  const ProductCard: React.FC<ProductCardProps> = ({
    product,
    onPress,
    onWishlistPress,
    isWishlisted = false,
    layout = 'grid',
    wishlistLoading = false,
  }) => {
    const cardStyle = layout === 'grid' ? styles.gridProductCard : styles.listProductCard;
    const imageStyle = layout === 'grid' ? styles.gridProductImage : styles.listProductImage;
    const infoStyle = layout === 'grid' ? styles.gridProductInfo : styles.listProductInfo;

    return (
      <TouchableOpacity
        style={cardStyle}
        onPress={() => {
          console.log("🔍 ProductCard pressed:", product._id || product.id);
          onPress();
        }}
        activeOpacity={0.8}
      >
        <View style={styles.productImageContainer}>
          <Image
            source={{ uri: product.images?.[0] || 'https://via.placeholder.com/200' }}
            style={imageStyle}
            defaultSource={{ uri: 'https://via.placeholder.com/200' }}
          />
          
          {/* Product Badges */}
          <View style={styles.productBadges}>
            {product.isNew && (
              <View style={[styles.badge, styles.newBadge]}>
                <Text style={styles.badgeText}>NEW</Text>
              </View>
            )}
            {product.isBestseller && (
              <View style={[styles.badge, styles.bestsellerBadge]}>
                <Text style={styles.badgeText}>BESTSELLER</Text>
              </View>
            )}
          </View>

          {/* ✅ UPDATED: Only wishlist icon - no bag icon */}
          <View style={styles.quickActions}>
            {onWishlistPress && (
              <TouchableOpacity
                style={[styles.quickActionButton, isWishlisted && styles.activeWishlist]}
                onPress={onWishlistPress}
                disabled={wishlistLoading}
                activeOpacity={0.7}
              >
                {wishlistLoading ? (
                  <ActivityIndicator size={16} color="#ff3f6c" />
                ) : (
                  <Heart
                    size={16}
                    color={isWishlisted ? "#ff3f6c" : "#666"}
                    fill={isWishlisted ? "#ff3f6c" : "none"}
                  />
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={infoStyle}>
          <Text style={styles.productBrand} numberOfLines={1}>
            {product.brand}
          </Text>
          <Text 
            style={styles.productName} 
            numberOfLines={layout === 'grid' ? 2 : 1}
          >
            {product.name}
          </Text>
          
          <View style={styles.productPricing}>
            <Text style={styles.productPrice}>₹{product.price}</Text>
            {product.discount && (
              <Text style={styles.productDiscount}>{product.discount}</Text>
            )}
          </View>

          <RatingDisplay 
            rating={product.rating} 
            size={12} 
            ratingCount={product.ratingCount}
          />

          {layout === 'list' && product.description && (
            <Text style={styles.productDescription} numberOfLines={2}>
              {product.description}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Header Component
  const renderHeader = () => (
    <Animated.View 
      style={[
        styles.header,
        {
          shadowOpacity: headerScrollY.interpolate({
            inputRange: [0, 50],
            outputRange: [0, 0.1],
            extrapolate: 'clamp',
          }),
        },
      ]}
    >
      <View style={styles.headerTop}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={24} color="#333" />
        </TouchableOpacity>

        <View style={styles.headerTitle}>
          <Text style={styles.categoryName} numberOfLines={1}>
            {state.category?.name || 'Category'}
          </Text>
          <Text style={styles.productCount}>
            {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.searchButton}
          onPress={() => setShowSearchOverlay(true)}
          activeOpacity={0.7}
        >
          <Search size={22} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Filter Bar */}
      <View style={styles.filterBar}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          <TouchableOpacity
            style={styles.filterChip}
            onPress={() => setShowFilterModal(true)}
            activeOpacity={0.7}
          >
            <SlidersHorizontal size={16} color="#666" />
            <Text style={styles.filterChipText}>Filter</Text>
            {activeFiltersCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {SORT_OPTIONS.slice(1, 4).map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.filterChip,
                filters.sortBy === option.value && styles.activeFilterChip,
              ]}
              onPress={() => handleSortChange(option.value)}
              activeOpacity={0.7}
            >
              <Text style={styles.filterChipEmoji}>{option.icon}</Text>
              <Text style={[
                styles.filterChipText,
                filters.sortBy === option.value && styles.activeFilterChipText,
              ]}>
                {option.label.replace('Price: ', '')}
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[
              styles.filterChip,
              filters.rating === 4 && styles.activeFilterChip,
            ]}
            onPress={handleRatingFilter}
            activeOpacity={0.7}
          >
            <Star size={16} color={filters.rating === 4 ? "#fff" : "#666"} />
            <Text style={[
              styles.filterChipText,
              filters.rating === 4 && styles.activeFilterChipText,
            ]}>
              4+ Stars
            </Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.layoutToggle}>
          <TouchableOpacity
            style={[styles.layoutButton, layout === 'grid' && styles.activeLayoutButton]}
            onPress={() => setLayout('grid')}
            activeOpacity={0.7}
          >
            <Grid3X3 size={18} color={layout === 'grid' ? "#ff3f6c" : "#666"} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.layoutButton, layout === 'list' && styles.activeLayoutButton]}
            onPress={() => setLayout('list')}
            activeOpacity={0.7}
          >
            <List size={18} color={layout === 'list' ? "#ff3f6c" : "#666"} />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );

  // Loading State
  if (state.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff3f6c" />
        <Text style={styles.loadingText}>Loading category...</Text>
      </View>
    );
  }

  // Error State
  if (state.error || !state.category) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Category not found</Text>
        <Text style={styles.errorText}>
          {state.error || "The category you're looking for doesn't exist"}
        </Text>
        <TouchableOpacity 
          style={styles.retryButton} 
          onPress={fetchCategoryData}
          activeOpacity={0.8}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {renderHeader()}

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {filteredProducts.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No products found</Text>
            <Text style={styles.emptyText}>
              Try adjusting your filters or explore other categories
            </Text>
            {activeFiltersCount > 0 && (
              <TouchableOpacity 
                style={styles.clearFiltersButton} 
                onPress={clearAllFilters}
                activeOpacity={0.8}
              >
                <Text style={styles.clearFiltersButtonText}>Clear All Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList
            data={filteredProducts}
            keyExtractor={(item, index) => `${item._id || item.id}-${index}`}
            numColumns={layout === 'grid' ? 2 : 1}
            key={layout}
            renderItem={({ item }) => {
              const productId = item._id || item.id || '';
              return (
                <ProductCard
                  product={item}
                  layout={layout}
                  onPress={() => handleProductPress(item)}
                  onWishlistPress={() => {
                    if (productId) handleWishlistPress(productId);
                  }}
                  isWishlisted={wishlistItems.has(productId)}
                  wishlistLoading={wishlistLoading.has(productId)}
                />
              );
            }}
            contentContainerStyle={[
              styles.productsList,
              layout === 'list' && styles.listLayout,
            ]}
            refreshControl={
              <RefreshControl
                refreshing={state.refreshing}
                onRefresh={onRefresh}
                colors={["#ff3f6c"]}
                tintColor="#ff3f6c"
              />
            }
            showsVerticalScrollIndicator={false}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: headerScrollY } } }],
              { useNativeDriver: false }
            )}
            ItemSeparatorComponent={() => 
              layout === 'list' ? <View style={styles.listSeparator} /> : null
            }
          />
        )}
      </Animated.View>

      {/* Filter Modal */}
      <FilterModal
        visible={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        onApply={handleFilterApply}
        currentFilters={filters}
        categories={[]}
        brands={availableBrands}
        priceRange={priceRange}
        totalProducts={filteredProducts.length}
      />

      {/* ✅ UPDATED: Search Overlay with only wishlist functionality */}
      <SearchOverlay
        visible={showSearchOverlay}
        onClose={() => setShowSearchOverlay(false)}
        products={state.products}
        onProductPress={(productId: string) => {
          const product = state.products.find(
            (p) => p._id === productId || p.id === productId
          );
          if (product) {
            handleProductPress(product);
          } else {
            console.warn("Product not found for ID:", productId);
          }
        }}
        activeFilters={filters}
        onWishlistPress={handleWishlistPress}
        onBagPress={undefined} // ✅ REMOVED: No bag functionality
        onFilterPress={() => {
          setShowSearchOverlay(false);
          setShowFilterModal(true);
        }}
      />
    </View>
  );
}

// ✅ UPDATED STYLES - Removed bag-related styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#ff3f6c',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowRadius: 3.84,
    elevation: 5,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    marginHorizontal: 12,
  },
  categoryName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  productCount: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  searchButton: {
    padding: 8,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  filterScrollContent: {
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  activeFilterChip: {
    backgroundColor: '#ff3f6c',
    borderColor: '#ff3f6c',
  },
  filterChipEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  filterChipText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  activeFilterChipText: {
    color: '#fff',
  },
  filterBadge: {
    backgroundColor: '#ff3f6c',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  layoutToggle: {
    flexDirection: 'row',
    marginLeft: 'auto',
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    padding: 2,
  },
  layoutButton: {
    padding: 6,
    borderRadius: 4,
  },
  activeLayoutButton: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  content: {
    flex: 1,
  },
  productsList: {
    padding: 16,
  },
  listLayout: {
    paddingHorizontal: 16,
  },
  gridProductCard: {
    flex: 1,
    margin: 4,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  listProductCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  productImageContainer: {
    position: 'relative',
  },
  gridProductImage: {
    width: '100%',
    height: 180,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: '#f8f9fa',
  },
  listProductImage: {
    width: 120,
    height: 120,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    backgroundColor: '#f8f9fa',
  },
  productBadges: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  newBadge: {
    backgroundColor: '#4caf50',
  },
  bestsellerBadge: {
    backgroundColor: '#ff9800',
  },
  badgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '600',
  },
  // ✅ UPDATED: Only wishlist action
  quickActions: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  quickActionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 8,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  activeWishlist: {
    backgroundColor: '#fff0f3',
  },
  gridProductInfo: {
    padding: 12,
  },
  listProductInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  productBrand: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    marginBottom: 2,
  },
  productName: {
    fontSize: 14,
    color: '#333',
    fontWeight: '400',
    lineHeight: 18,
    marginBottom: 6,
  },
  productPricing: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  productPrice: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  productDiscount: {
    fontSize: 12,
    color: '#ff3f6c',
    marginLeft: 6,
    fontWeight: '500',
  },
  productDescription: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
    marginTop: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    marginLeft: 4,
    color: '#666',
    fontWeight: '500',
  },
  ratingCount: {
    marginLeft: 2,
    color: '#999',
  },
  listSeparator: {
    height: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  clearFiltersButton: {
    backgroundColor: '#ff3f6c',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  clearFiltersButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});
