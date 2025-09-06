import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
  FlatList,
  Dimensions,
  RefreshControl,
  Animated,
  StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Search,
  Star,
  ArrowRight,
  TrendingUp,
  Tag,
  Heart,
  ChevronRight,
  Sparkles,
  Package,
  Award,
  Flame,
} from "lucide-react-native";

// ✅ UPDATED: Only import wishlist-related API functions
import {
  getCategories,
  getProducts,
  handleApiError,
  addToWishlist,
  removeFromWishlist,
} from "@/utils/api";

import { Category, Product, FilterState } from "@/types/product";
import { useAuth } from "@/context/AuthContext";
import SearchOverlay from "@/components/SearchOverlay";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

// ✅ Professional responsive helpers
const isTablet = screenWidth >= 768;
const isLargeTablet = screenWidth >= 1024;

const wp = (percentage: number) => (screenWidth * percentage) / 100;
const hp = (percentage: number) => (screenHeight * percentage) / 100;

const getResponsiveValue = (phone: number, tablet: number, largeTablet = tablet) => {
  if (isLargeTablet) return largeTablet;
  if (isTablet) return tablet;
  return phone;
};

// ✅ Professional design system
const spacing = {
  xs: getResponsiveValue(4, 6, 8),
  sm: getResponsiveValue(8, 12, 16),
  md: getResponsiveValue(12, 16, 20),
  lg: getResponsiveValue(16, 20, 24),
  xl: getResponsiveValue(20, 24, 28),
  xxl: getResponsiveValue(24, 32, 40),
};

const typography = {
  xs: getResponsiveValue(10, 12, 14),
  sm: getResponsiveValue(12, 14, 16),
  md: getResponsiveValue(14, 16, 18),
  lg: getResponsiveValue(16, 18, 20),
  xl: getResponsiveValue(18, 20, 22),
  xxl: getResponsiveValue(20, 24, 28),
  xxxl: getResponsiveValue(24, 28, 32),
};

const colors = {
  primary: '#ff3f6c',
  primaryLight: '#fff4f6',
  secondary: '#3e3e3e',
  text: '#333333',
  textLight: '#666666',
  textMuted: '#999999',
  background: '#ffffff',
  surface: '#f8f9fa',
  border: '#e8e8e8',
  shadow: 'rgba(0, 0, 0, 0.1)',
  success: '#4caf50',
  warning: '#ff9800',
  info: '#2196f3',
};

// Types
interface CategoryWithStats extends Category {
  productCount: number;
  averageRating: number;
  minPrice: number;
  maxPrice: number;
  topBrands: string[];
  hasDiscount: boolean;
  isPopular?: boolean;
  isTrending?: boolean;
  isFeatured?: boolean;
  totalSales?: number;
  newArrivals?: number;
}

interface CategoriesState {
  categories: Category[];
  allProducts: Product[];
  featuredProducts: Product[];
  trendingProducts: Product[];
  searchQuery: string;
  isLoading: boolean;
  error: string | null;
  refreshing: boolean;
}

export default function Categories() {
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

  // ✅ Professional state management
  const [state, setState] = useState<CategoriesState>({
    categories: [],
    allProducts: [],
    featuredProducts: [],
    trendingProducts: [],
    searchQuery: "",
    isLoading: true,
    error: null,
    refreshing: false,
  });

  const [showSearchOverlay, setShowSearchOverlay] = useState(false);
  const [filters] = useState<FilterState>({ sortBy: "relevance" });

  // ✅ Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  // ✅ Categories with comprehensive statistics
  const categoriesWithStats = useMemo((): CategoryWithStats[] => {
    return state.categories.map(category => {
      const categoryProducts = state.allProducts.filter(product => {
        if (typeof product.category === 'string') {
          return product.category === category._id;
        }
        if (typeof product.category === 'object' && product.category?._id) {
          return product.category._id === category._id;
        }
        return product.categoryName === category.name;
      });
      
      const validProducts = categoryProducts.filter(p => p && p.price);
      const totalSales = Math.floor(Math.random() * 10000) + 1000;
      
      return {
        ...category,
        productCount: validProducts.length,
        averageRating: validProducts.length > 0 
          ? validProducts.reduce((sum, p) => sum + (p.rating || 0), 0) / validProducts.length
          : 0,
        minPrice: validProducts.length > 0 
          ? Math.min(...validProducts.map(p => p.price))
          : 0,
        maxPrice: validProducts.length > 0 
          ? Math.max(...validProducts.map(p => p.price))
          : 0,
        topBrands: Array.from(new Set(validProducts.map(p => p.brand).filter(Boolean))).slice(0, 3),
        hasDiscount: validProducts.some(p => p.discount),
        isPopular: totalSales > 5000,
        isTrending: Math.random() > 0.6,
        isFeatured: Math.random() > 0.7,
        totalSales,
        newArrivals: validProducts.filter(p => p.isNew).length,
      };
    });
  }, [state.categories, state.allProducts]);

  // ✅ Search products for SearchOverlay
  const searchProducts = useMemo(() => {
    const uniqueProducts = state.allProducts
      .filter(product => product && product._id)
      .map(product => ({
        ...product,
        categoryName: product.categoryName || 
          state.categories.find(cat => 
            cat._id === (typeof product.category === 'string' ? product.category : product.category?._id)
          )?.name || 'Unknown'
      }));
    
    return uniqueProducts.filter((product, index, arr) => 
      arr.findIndex(p => p._id === product._id) === index
    );
  }, [state.allProducts, state.categories]);

  // ✅ Effects with professional functionality
  useEffect(() => {
    fetchData();
    initializeAnimations();
  }, []);

  // ✅ Listen to wishlist refresh triggers for cross-page sync
  useEffect(() => {
    if (wishlistRefreshTrigger > 0) {
      console.log("🔄 Categories: Wishlist refresh trigger activated");
      setState(prev => ({ ...prev }));
    }
  }, [wishlistRefreshTrigger]);

  // ✅ Professional animations
  const initializeAnimations = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // ✅ Professional data fetching
  const fetchData = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const [categoriesResponse, productsResponse] = await Promise.all([
        getCategories({ includeStats: true }),
        getProducts({ 
          limit: 1000,
          sortBy: 'createdAt', 
          sortOrder: 'desc' 
        }),
      ]);

      if (categoriesResponse.success && Array.isArray(categoriesResponse.data)) {
        const categories = categoriesResponse.data.map((category: Category) => ({
          ...category,
          isPopular: Math.random() > 0.7,
        }));

        setState(prev => ({
          ...prev,
          categories,
        }));
      } else {
        throw new Error(handleApiError(categoriesResponse.error));
      }

      if (productsResponse.success && Array.isArray(productsResponse.data)) {
        const enhancedProducts = productsResponse.data.map((product: any) => ({
          ...product,
          rating: product.rating || (3.5 + Math.random() * 1.5),
          ratingCount: product.ratingCount || Math.floor(Math.random() * 500) + 10,
          isNew: Math.random() > 0.8,
          isFeatured: Math.random() > 0.7,
          isBestseller: Math.random() > 0.9,
        }));

        // Separate featured and trending products
        const featuredProducts = enhancedProducts.filter(p => p.isFeatured).slice(0, 10);
        const trendingProducts = enhancedProducts.filter(p => p.isBestseller || Math.random() > 0.6).slice(0, 10);

        setState(prev => ({
          ...prev,
          allProducts: enhancedProducts,
          featuredProducts,
          trendingProducts,
        }));
      } else if (!productsResponse.success) {
        console.warn("Products fetch failed:", handleApiError(productsResponse.error));
        setState(prev => ({
          ...prev,
          allProducts: [],
          featuredProducts: [],
          trendingProducts: [],
        }));
      }

    } catch (error: any) {
      console.error("Error fetching data:", error);
      const errorMessage = error.message || "Failed to load categories";
      setState(prev => ({ ...prev, error: errorMessage }));
      
      Alert.alert("Error", errorMessage, [
        { text: "Retry", onPress: fetchData },
        { text: "Cancel", style: "cancel" }
      ]);
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  // ✅ FIXED: Wishlist handler with proper type safety
  const handleWishlistPress = async (productId: string) => {
    if (!user) {
      Alert.alert(
        "Login Required", 
        "Please login to add items to your wishlist",
        [
          { text: "Login", onPress: () => router.push("/login") },
          { text: "Cancel", style: "cancel" },
        ]
      );
      return;
    }

    try {
      const currentWishlistStatus = wishlistItems.has(productId);
      console.log(`🔄 Categories: Wishlist action: ${productId} - Currently wishlisted: ${currentWishlistStatus}`);

      if (currentWishlistStatus) {
        // ✅ OPTIMISTIC UPDATE: Update UI immediately
        console.log("🔄 Categories: Optimistic update - Removing from wishlist UI");
        optimisticUpdateWishlist(productId, null);
        
        console.log("🔍 Categories: API Call - Removing from wishlist:", productId);
        const res = await removeFromWishlist(productId, user._id);
        
        if (res.success) {
          console.log("✅ Categories: Successfully removed from wishlist");
          Alert.alert("Removed ❤️", "Item removed from wishlist");
          
          // ✅ Force complete refresh for cross-page sync
          await refreshUserPreferences();
          forceWishlistRefresh();
          
        } else {
          // ✅ REVERT: Revert optimistic update on failure
          console.log("❌ Categories: Failed to remove, reverting UI");
          const product = searchProducts.find(p => p._id === productId);
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
          throw new Error(res.error?.message || "Failed to remove from wishlist");
        }
      } else {
        // ✅ OPTIMISTIC UPDATE: Update UI immediately
        console.log("🔄 Categories: Optimistic update - Adding to wishlist UI");
        
        const product = searchProducts.find(p => p._id === productId);
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
        
        console.log("🔍 Categories: API Call - Adding to wishlist:", productId);
        const res = await addToWishlist({ 
          userId: user._id, 
          productId, 
          priority: "medium" 
        });
        
        if (res.success) {
          console.log("✅ Categories: Successfully added to wishlist");
          Alert.alert("Added ❤️", "Item added to wishlist");
          
          // ✅ Force complete refresh for cross-page sync
          await refreshUserPreferences();
          forceWishlistRefresh();
          
        } else {
          // ✅ REVERT: Revert optimistic update on failure
          console.log("❌ Categories: Failed to add, reverting UI");
          optimisticUpdateWishlist(productId, null);
          throw new Error(res.error?.message || "Failed to add to wishlist");
        }
      }
    } catch (error: any) {
      console.error('❌ Categories: Wishlist error:', error);
      Alert.alert("Error", handleApiError(error) || "Failed to update wishlist. Please try again.");
    }
  };

  const onRefresh = async () => {
    setState(prev => ({ ...prev, refreshing: true }));
    await fetchData();
    setState(prev => ({ ...prev, refreshing: false }));
  };

  const handleCategoryPress = (categoryId: string) => {
    router.push(`/category/${categoryId}`);
  };

  const handleProductPress = (productId: string) => {
    router.push(`/product/${productId}`);
  };

  const handleSearchPress = () => {
    setShowSearchOverlay(true);
  };

  // ✅ Large Category Card Component
  const CategoryCard: React.FC<{ 
    category: CategoryWithStats; 
    index: number;
  }> = ({ category, index }) => {
    return (
      <Animated.View 
        style={{
          opacity: fadeAnim,
          transform: [
            { scale: scaleAnim },
            {
              translateY: slideAnim.interpolate({
                inputRange: [0, 50],
                outputRange: [0, index * 10],
                extrapolate: 'clamp',
              })
            }
          ]
        }}
      >
        <TouchableOpacity
          style={styles.largeCategoryCard}
          onPress={() => handleCategoryPress(category._id)}
          activeOpacity={0.9}
        >
          <View style={styles.categoryImageContainer}>
            <Image
              source={{ 
                uri: category.image || "https://via.placeholder.com/300" 
              }}
              style={styles.categoryImage}
              resizeMode="cover"
            />
            
            {/* Enhanced Category Badges */}
            <View style={styles.categoryBadges}>
              {category.isPopular && (
                <View style={[styles.badge, styles.popularBadge]}>
                  <Flame size={10} color="#fff" />
                  <Text style={styles.badgeText}>Popular</Text>
                </View>
              )}
              {category.hasDiscount && (
                <View style={[styles.badge, styles.discountBadge]}>
                  <Tag size={10} color="#fff" />
                  <Text style={styles.badgeText}>Sale</Text>
                </View>
              )}
              {(category.newArrivals ?? 0) > 0 && (
                <View style={[styles.badge, styles.newBadge]}>
                  <Sparkles size={10} color="#fff" />
                  <Text style={styles.badgeText}>New</Text>
                </View>
              )}
            </View>

            {/* Category Overlay */}
            <View style={styles.categoryOverlay}>
              <Text style={styles.categoryName}>{category.name}</Text>
              <Text style={styles.categoryProductCount}>
                {category.productCount} product{category.productCount !== 1 ? 's' : ''}
              </Text>
              
              {category.averageRating > 0 && (
                <View style={styles.categoryRating}>
                  <Star size={14} color={colors.warning} fill={colors.warning} />
                  <Text style={styles.ratingText}>{category.averageRating.toFixed(1)}</Text>
                </View>
              )}

              {category.minPrice > 0 && (
                <Text style={styles.priceRange}>
                  ₹{category.minPrice.toLocaleString()} - ₹{category.maxPrice.toLocaleString()}
                </Text>
              )}
            </View>

            {/* Arrow Indicator */}
            <View style={styles.arrowContainer}>
              <ArrowRight size={20} color={colors.background} />
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // ✅ UPDATED: Product card with only wishlist functionality
  const ProductCard: React.FC<{ 
    product: Product; 
    onPress: () => void;
  }> = ({ product, onPress }) => {
    // ✅ Use global AuthContext state with perfect cross-page sync
    const isWishlisted = wishlistItems.has(product._id);

    console.log(`🔍 Categories ProductCard: ${product.name} - Wishlisted: ${isWishlisted}`);

    return (
      <TouchableOpacity 
        style={styles.productCard} 
        onPress={onPress} 
        activeOpacity={0.9}
      >
        <View style={styles.productImageWrapper}>
          <Image
            source={{ 
              uri: product.images?.[0] && product.images[0].trim() 
                ? product.images[0] 
                : "https://via.placeholder.com/200"
            }}
            style={styles.productImage}
            resizeMode="cover"
          />
          
          {/* Product Badges */}
          <View style={styles.productBadges}>
            {product.isNew && (
              <View style={styles.newProductBadge}>
                <Text style={styles.productBadgeText}>NEW</Text>
              </View>
            )}
            {product.isBestseller && (
              <View style={styles.bestsellerBadge}>
                <Text style={styles.productBadgeText}>🏆</Text>
              </View>
            )}
          </View>

          {/* ✅ UPDATED: Only wishlist icon - no bag icon */}
          <View style={styles.productQuickActions}>
            <TouchableOpacity
              style={[styles.quickActionButton, isWishlisted && styles.activeWishlist]}
              onPress={(e) => {
                e.stopPropagation();
                console.log("🔍 Categories: Heart button pressed for:", product.name);
                handleWishlistPress(product._id);
              }}
            >
              <Heart 
                size={16} 
                color={isWishlisted ? colors.primary : colors.textLight} 
                fill={isWishlisted ? colors.primary : "none"} 
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.productInfo}>
          <Text style={styles.productBrand} numberOfLines={1}>
            {product.brand}
          </Text>
          <Text style={styles.productName} numberOfLines={2}>
            {product.name}
          </Text>
          <View style={styles.productPriceRow}>
            <Text style={styles.productPrice}>₹{product.price}</Text>
            {product.discount && <Text style={styles.productDiscount}>{product.discount}</Text>}
          </View>
          {product.rating && (
            <View style={styles.productRating}>
              <Star size={12} color={colors.warning} fill={colors.warning} />
              <Text style={styles.productRatingText}>{product.rating.toFixed(1)}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // ✅ Loading State
  if (state.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading categories...</Text>
      </View>
    );
  }

  // ✅ Error State
  if (state.error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorText}>{state.error}</Text>
        <TouchableOpacity 
          style={styles.retryButton} 
          onPress={fetchData}
          activeOpacity={0.8}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      
      {/* ✅ Header with title and search */}
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Categories</Text>
          <Text style={styles.headerSubtitle}>
            Discover {categoriesWithStats.length} categories
          </Text>
        </View>
        
        <TouchableOpacity
          style={styles.searchButton}
          onPress={handleSearchPress}
          activeOpacity={0.8}
        >
          <Search size={getResponsiveValue(22, 24, 26)} color={colors.secondary} />
        </TouchableOpacity>
      </Animated.View>

      {/* ✅ Content with new layout */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={state.refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          {/* ✅ ALL CATEGORIES SECTION */}
          <View style={styles.allCategoriesSection}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <Tag size={getResponsiveValue(20, 22, 24)} color={colors.primary} />
                <Text style={styles.sectionTitle}>All Categories</Text>
              </View>
              <Text style={styles.sectionCount}>{categoriesWithStats.length}</Text>
            </View>
            
            {categoriesWithStats.length === 0 ? (
              <View style={styles.emptyState}>
                <Package size={getResponsiveValue(50, 60, 70)} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No categories found</Text>
                <Text style={styles.emptyText}>
                  Categories will appear here once available
                </Text>
              </View>
            ) : (
              <FlatList
                data={categoriesWithStats}
                keyExtractor={(item) => item._id}
                renderItem={({ item, index }) => <CategoryCard category={item} index={index} />}
                numColumns={2}
                contentContainerStyle={styles.categoriesGrid}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
                columnWrapperStyle={styles.categoryRow}
              />
            )}
          </View>

          {/* ✅ FEATURED PRODUCTS SECTION */}
          {state.featuredProducts.length > 0 && (
            <View style={styles.productsSection}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleContainer}>
                  <Award size={getResponsiveValue(20, 22, 24)} color={colors.primary} />
                  <Text style={styles.sectionTitle}>Featured Products</Text>
                </View>
                <TouchableOpacity style={styles.seeAllButton} activeOpacity={0.7}>
                  <Text style={styles.seeAllText}>See All</Text>
                  <ChevronRight size={getResponsiveValue(14, 16, 18)} color={colors.primary} />
                </TouchableOpacity>
              </View>
              
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.productsScrollContainer}
              >
                {state.featuredProducts.map((product) => (
                  <View key={product._id} style={styles.productWrapper}>
                    <ProductCard
                      product={product}
                      onPress={() => handleProductPress(product._id)}
                    />
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* ✅ TRENDING PRODUCTS SECTION */}
          {state.trendingProducts.length > 0 && (
            <View style={styles.productsSection}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleContainer}>
                  <TrendingUp size={getResponsiveValue(20, 22, 24)} color={colors.success} />
                  <Text style={styles.sectionTitle}>Trending Products</Text>
                </View>
                <TouchableOpacity style={styles.seeAllButton} activeOpacity={0.7}>
                  <Text style={styles.seeAllText}>See All</Text>
                  <ChevronRight size={getResponsiveValue(14, 16, 18)} color={colors.primary} />
                </TouchableOpacity>
              </View>
              
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.productsScrollContainer}
              >
                {state.trendingProducts.map((product) => (
                  <View key={product._id} style={styles.productWrapper}>
                    <ProductCard
                      product={product}
                      onPress={() => handleProductPress(product._id)}
                    />
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Bottom Spacing */}
          <View style={{ height: hp(5) }} />
        </Animated.View>
      </ScrollView>

      {/* ✅ UPDATED: Search Overlay with only wishlist functionality */}
      <SearchOverlay
        visible={showSearchOverlay}
        onClose={() => setShowSearchOverlay(false)}
        products={searchProducts}
        categories={state.categories}
        onProductPress={handleProductPress}
        activeFilters={filters}
        onWishlistPress={handleWishlistPress}
        onBagPress={undefined} // ✅ REMOVED: No bag functionality
        onCategoryPress={(categoryId, categoryName) => handleCategoryPress(categoryId)}
        onSubcategoryPress={(categoryId, subcategory, categoryName) => 
          router.push(`/category/${categoryId}?subcategory=${subcategory}`)
        }
      />
    </View>
  );
}

// ✅ UPDATED STYLES - Removed bag-related styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.md,
    color: colors.textLight,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
  },
  errorTitle: {
    fontSize: typography.xl,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  errorText: {
    fontSize: typography.md,
    color: colors.textLight,
    textAlign: 'center',
    marginBottom: spacing.xxl,
    lineHeight: typography.lg,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: spacing.sm,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  retryButtonText: {
    color: colors.background,
    fontSize: typography.md,
    fontWeight: '600',
  },

  // ✅ Header Design
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: typography.xxxl,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.xs,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: typography.sm,
    color: colors.textLight,
    fontWeight: '500',
  },
  searchButton: {
    padding: spacing.md,
    borderRadius: 20,
    backgroundColor: colors.surface,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },

  // ✅ Content Design
  content: {
    flex: 1,
  },
  allCategoriesSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    backgroundColor: colors.background,
    marginBottom: spacing.sm,
  },
  productsSection: {
    paddingVertical: spacing.xl,
    backgroundColor: colors.background,
    marginBottom: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionTitle: {
    fontSize: typography.xl,
    fontWeight: '700',
    color: colors.text,
    marginLeft: spacing.sm,
    letterSpacing: 0.5,
  },
  sectionCount: {
    fontSize: typography.md,
    color: colors.primary,
    fontWeight: '600',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAllText: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: '600',
    marginRight: spacing.xs,
  },
  categoriesGrid: {
    paddingTop: spacing.sm,
  },
  categoryRow: {
    justifyContent: 'space-between',
  },

  // ✅ Large Category Card Design
  largeCategoryCard: {
    width: (screenWidth - spacing.lg * 3) / 2,
    height: getResponsiveValue(200, 240, 280),
    borderRadius: spacing.lg,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  categoryImageContainer: {
    flex: 1,
    position: 'relative',
  },
  categoryImage: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.surface,
  },
  categoryBadges: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  popularBadge: {
    backgroundColor: colors.warning,
  },
  discountBadge: {
    backgroundColor: '#e91e63',
  },
  newBadge: {
    backgroundColor: colors.success,
  },
  badgeText: {
    color: colors.background,
    fontSize: 9,
    fontWeight: '700',
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  categoryOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: spacing.md,
  },
  categoryName: {
    fontSize: typography.lg,
    fontWeight: '700',
    color: colors.background,
    marginBottom: spacing.xs,
  },
  categoryProductCount: {
    fontSize: typography.sm,
    color: colors.background,
    opacity: 0.9,
    marginBottom: spacing.xs,
  },
  categoryRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  ratingText: {
    fontSize: typography.sm,
    color: colors.background,
    marginLeft: spacing.xs,
    fontWeight: '600',
  },
  priceRange: {
    fontSize: typography.sm,
    color: colors.background,
    fontWeight: '600',
    opacity: 0.9,
  },
  arrowContainer: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 20,
    padding: spacing.xs,
  },

  // ✅ UPDATED: Product Card Design - Only wishlist functionality
  productsScrollContainer: {
    paddingLeft: spacing.lg,
  },
  productWrapper: {
    marginRight: spacing.md,
    width: getResponsiveValue(160, 200, 240),
  },
  productCard: {
    backgroundColor: colors.background,
    borderRadius: spacing.md,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
    overflow: 'hidden',
  },
  productImageWrapper: {
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: getResponsiveValue(140, 180, 220),
    backgroundColor: colors.surface,
  },
  productBadges: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    flexDirection: 'column',
  },
  newProductBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  bestsellerBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 4,
  },
  productBadgeText: {
    color: colors.background,
    fontSize: 8,
    fontWeight: '700',
  },
  // ✅ UPDATED: Only wishlist action
  productQuickActions: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
  },
  quickActionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: spacing.sm,
    borderRadius: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  activeWishlist: {
    backgroundColor: colors.primaryLight,
  },
  productInfo: {
    padding: spacing.md,
  },
  productBrand: {
    fontSize: typography.xs,
    color: colors.textLight,
    marginBottom: spacing.xs,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  productName: {
    fontSize: typography.sm,
    marginBottom: spacing.sm,
    color: colors.text,
    lineHeight: typography.md,
    fontWeight: '600',
  },
  productPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  productPrice: {
    fontSize: typography.md,
    fontWeight: '700',
    color: colors.text,
    marginRight: spacing.sm,
  },
  productDiscount: {
    fontSize: typography.xs,
    color: colors.primary,
    fontWeight: '600',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: 4,
  },
  productRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productRatingText: {
    marginLeft: 4,
    color: colors.textLight,
    fontWeight: '600',
    fontSize: typography.xs,
  },

  // ✅ Utility Styles
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  emptyTitle: {
    fontSize: typography.xl,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: typography.md,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: typography.lg,
    fontWeight: '500',
  },
});
