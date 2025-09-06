import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  ScrollView,
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Dimensions,
  Animated,
  StatusBar,
  Platform,
} from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from "expo-router";
import {
  Search,
  ChevronRight,
  Star,
  Heart,
  TrendingUp,
  Sparkles,
  Tag,
  Award,
  Eye,
  ChevronDown,
  ChevronUp,
  Zap,
  ShoppingBag,
  MapPin,
} from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { Product, Category, FilterState, Address } from "@/types/product";
import { useFocusEffect } from '@react-navigation/native';

// ✅ API imports
import {
  getCategories,
  getProducts,
  addToWishlist as addWishlistApi,        
  removeFromWishlist as removeWishlistApi, 
  checkWishlistStatus,
  handleApiError,
} from "@/utils/api";

// ✅ Recently Viewed imports
import { getRecentlyViewed } from "@/utils/recentlyViewed";

// ✅ NEW: Address overlays
import AddressSelectionOverlay from "@/components/AddressSelectionOverlay";
import AddressManagementOverlay from "@/components/AddressManagementOverlay";
import SearchOverlay from "@/components/SearchOverlay";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
const isTablet = screenWidth >= 768;
const isLargeTablet = screenWidth >= 1024;

// ✅ Enhanced responsive helper functions
const wp = (percentage: number) => (screenWidth * percentage) / 100;
const hp = (percentage: number) => (screenHeight * percentage) / 100;

const getResponsiveValue = (phone: number, tablet: number, largeTablet = tablet) => {
  if (isLargeTablet) return largeTablet;
  if (isTablet) return tablet;
  return phone;
};

// ✅ Ultimate design spacing system
const spacing = {
  xs: getResponsiveValue(4, 6, 8),
  sm: getResponsiveValue(8, 12, 16),
  md: getResponsiveValue(12, 16, 20),
  lg: getResponsiveValue(16, 20, 24),
  xl: getResponsiveValue(20, 24, 28),
  xxl: getResponsiveValue(24, 32, 40),
  xxxl: getResponsiveValue(32, 40, 48),
};

const typography = {
  xs: getResponsiveValue(10, 12, 14),
  sm: getResponsiveValue(12, 14, 16),
  md: getResponsiveValue(14, 16, 18),
  lg: getResponsiveValue(16, 18, 20),
  xl: getResponsiveValue(18, 20, 22),
  xxl: getResponsiveValue(20, 22, 24),
  xxxl: getResponsiveValue(24, 28, 32),
  xxxxl: getResponsiveValue(28, 32, 36),
};

// ✅ FIXED: Ultimate Myntra-inspired color scheme
const colors = {
  primary: '#ff3f6c',
  primaryDark: '#e91e63',
  primaryLight: '#fff4f6',
  secondary: '#282c34',
  accent: '#ff6b35',
  background: '#ffffff',
  surface: '#f8f9fa',
  surfaceSecondary: '#f1f3f4',
  text: '#1a1a1a',
  textLight: '#666666',
  textMuted: '#999999',
  border: '#e8e8e8',
  borderLight: '#f0f0f0',
  shadow: 'rgba(0, 0, 0, 0.1)',
  shadowDark: 'rgba(0, 0, 0, 0.15)',
  success: '#00c851',
  warning: '#ffbb33',
  info: '#33b5e5',
  error: '#ff4444',
  gradient: {
    primary: ['#ff3f6c', '#ff6b35'] as const,
    secondary: ['#667eea', '#764ba2'] as const,
    success: ['#56ab2f', '#a8e6cf'] as const,
    warm: ['#ff9a9e', '#fecfef'] as const,
  },
};

// ✅ Enhanced deals data
const deals = [
  {
    id: 1,
    title: "Under ₹599",
    description: "Budget-friendly fashion finds",
    image: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=500",
    discount: "UP TO 60% OFF",
    category: "budget",
    gradient: ['#ff6b6b', '#ee5a24'],
    icon: <Tag size={20} color="#fff" />,
  },
  {
    id: 2,
    title: "Flash Sale",
    description: "Limited time mega discounts",
    image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=500",
    discount: "70% OFF",
    category: "sale",
    gradient: ['#5f27cd', '#341f97'],
    icon: <Zap size={20} color="#fff" />,
  },
  {
    id: 3,
    title: "New Arrivals",
    description: "Latest fashion trends",
    image: "https://images.unsplash.com/photo-1441986302599-5a16a6ab8f72?w=500",
    discount: "NEW",
    category: "new",
    gradient: ['#00d2d3', '#01a3a4'],
    icon: <Sparkles size={20} color="#fff" />,
  },
  {
    id: 4,
    title: "Premium Brands",
    description: "Luxury fashion collections",
    image: "https://images.unsplash.com/photo-1512436991641-6745cad1c942?w=500",
    discount: "EXCLUSIVE",
    category: "premium",
    gradient: ['#feca57', '#ff9ff3'],
    icon: <Award size={20} color="#fff" />,
  },
];

export default function Home() {
  const router = useRouter();
  
  const { 
    user, 
    wishlistItems, 
    updateWishlistStatus, 
    refreshUserPreferences,
    optimisticUpdateWishlist,
    forceWishlistRefresh,
    wishlistRefreshTrigger,
    addresses,
    defaultAddressId,
  } = useAuth();

  // ✅ Enhanced state with recently viewed toggle
  const [state, setState] = useState<{
    isLoading: boolean;
    refreshing: boolean;
    products: Product[];
    categories: Category[];
    featuredProducts: Product[];
    newArrivals: Product[];
    recentlyViewed: Product[];
    error: string | null;
  }>({
    isLoading: false,
    refreshing: false,
    products: [],
    categories: [],
    featuredProducts: [],
    newArrivals: [],
    recentlyViewed: [],
    error: null,
  });

  const [searchVisible, setSearchVisible] = useState(false);
  const [filters] = useState<FilterState>({ sortBy: "relevance" });
  
  // ✅ NEW: Address overlay states
  const [addressSelectionVisible, setAddressSelectionVisible] = useState(false);
  const [addressManagementVisible, setAddressManagementVisible] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null); // ✅ NEW: State for editing address
  
  // ✅ NEW: Recently viewed toggle state
  const [recentlyViewedCollapsed, setRecentlyViewedCollapsed] = useState(false);

  // ✅ Enhanced animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;
  const recentlyViewedHeightAnim = useRef(new Animated.Value(1)).current;

  // ✅ Enhanced responsive calculations
  const numCols = getResponsiveValue(2, 3, 4);
  const productCardWidth = getResponsiveValue(160, 180, 200);
  const categorySize = getResponsiveValue(wp(18), wp(14), wp(11));
  const dealCardWidth = getResponsiveValue(wp(85), wp(50), wp(40));

  // ✅ Enhanced product processing
  const searchProducts = useMemo(() => {
    const catProducts = state.categories
      .filter(cat => cat && cat.productId && Array.isArray(cat.productId))
      .flatMap((cat) => {
        const products = cat.productId ?? [];
        return products
          .filter(p => p && typeof p === 'object' && p._id)
          .map((p) => ({
            ...p,
            categoryName: cat.name || 'Unknown Category',
            subcategory: cat.subcategory?.[0] || p.subcategory || 'General',
          }));
      });

    const safeProducts = state.products.filter(p => p && typeof p === 'object' && p._id);
    const all = [...safeProducts, ...catProducts];
    
    const uniqueMap = new Map<string, Product>();
    all.forEach((p) => {
      if (p && p._id) {
        uniqueMap.set(p._id, p);
      }
    });
    
    return Array.from(uniqueMap.values());
  }, [state.categories, state.products]);

  const availableBrands = useMemo(() => {
    const brandSet = new Set<string>();
    searchProducts.forEach((p) => {
      if (p?.brand && typeof p.brand === 'string' && p.brand.trim()) {
        brandSet.add(p.brand.trim());
      }
    });
    return Array.from(brandSet).sort();
  }, [searchProducts]);

  const priceRange = useMemo(() => {
    if (searchProducts.length === 0) return { min: 0, max: 50000 };
    
    const validPrices = searchProducts
      .filter(p => p?.price && typeof p.price === 'number' && p.price > 0)
      .map(p => p.price);
      
    if (validPrices.length === 0) return { min: 0, max: 50000 };
    
    return { 
      min: Math.min(...validPrices), 
      max: Math.max(...validPrices) 
    };
  }, [searchProducts]);

  // ✅ Get default address for display
  const defaultAddress = useMemo(() => {
    if (defaultAddressId && addresses.has(defaultAddressId)) {
      return addresses.get(defaultAddressId);
    }
    return Array.from(addresses.values()).find(addr => addr.isDefault) || null;
  }, [addresses, defaultAddressId]);

  // ✅ Load recently viewed function
  const loadRecentlyViewed = async () => {
    try {
      const recentProducts = await getRecentlyViewed();
      setState(prev => ({
        ...prev,
        recentlyViewed: recentProducts,
      }));
    } catch (error) {
      console.error('Error loading recently viewed products:', error);
    }
  };

  // ✅ Toggle recently viewed function
  const toggleRecentlyViewed = () => {
    const toValue = recentlyViewedCollapsed ? 1 : 0;
    
    Animated.spring(recentlyViewedHeightAnim, {
      toValue,
      tension: 100,
      friction: 8,
      useNativeDriver: false,
    }).start();
    
    setRecentlyViewedCollapsed(!recentlyViewedCollapsed);
  };

  useEffect(() => {
    fetchData();
    loadRecentlyViewed();
    
    // ✅ Ultimate entrance animations
    Animated.sequence([
      Animated.parallel([
        Animated.timing(headerAnim, { 
          toValue: 1, 
          duration: 800, 
          useNativeDriver: true 
        }),
        Animated.timing(fadeAnim, { 
          toValue: 1, 
          duration: 1200, 
          useNativeDriver: true 
        }),
      ]),
      Animated.parallel([
        Animated.spring(slideAnim, { 
          toValue: 0, 
          tension: 80,
          friction: 8,
          useNativeDriver: true 
        }),
        Animated.spring(scaleAnim, { 
          toValue: 1, 
          tension: 100,
          friction: 8,
          useNativeDriver: true 
        }),
      ]),
    ]).start();
  }, []);

  // ✅ Listen to wishlist refresh triggers
  useEffect(() => {
    if (wishlistRefreshTrigger > 0) {
      setState(prev => ({ ...prev }));
    }
  }, [wishlistRefreshTrigger]);

  // ✅ Refresh recently viewed when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadRecentlyViewed();
    }, [])
  );

  // ✅ Enhanced data fetching
  async function fetchData() {
    try {
      setState((s) => ({ ...s, isLoading: true, error: null }));
      
      const [catRes, prodRes] = await Promise.all([
        getCategories({ includeStats: true }),
        getProducts({ limit: 50, sortBy: "createdAt", sortOrder: "desc" })
      ]);

      let hasData = false;

      if (catRes.success && Array.isArray(catRes.data)) {
        setState((s) => ({ ...s, categories: catRes.data || [] }));
        hasData = true;
      } else {
        console.warn("Categories load error:", handleApiError(catRes.error));
      }

      if (prodRes.success && Array.isArray(prodRes.data)) {
        const enhanced = prodRes.data
          .filter(p => p && typeof p === 'object' && p._id)
          .map((p) => ({
            ...p,
            description: p.description || `${p.brand || 'Unknown'} ${p.name || 'Product'}`,
            rating: p.rating || 3.5 + Math.random() * 1.5,
            ratingCount: p.ratingCount || Math.floor(Math.random() * 500) + 10,
            categoryName: p.categoryName || "Fashion",
            subcategory: p.subcategory || "General",
            popularity: Math.floor(Math.random() * 1000),
            isNew: Math.random() > 0.8,
            isFeatured: Math.random() > 0.7,
            isBestseller: Math.random() > 0.9,
            brand: p.brand || 'Unknown Brand',
            name: p.name || 'Unknown Product',
            price: typeof p.price === 'number' ? p.price : 0,
            images: Array.isArray(p.images) ? p.images : [],
          }));

        setState((s) => ({
          ...s,
          products: enhanced,
          featuredProducts: enhanced.filter((p) => p.isFeatured).slice(0, 8),
          newArrivals: enhanced
            .slice()
            .sort((a, b) => {
              const aDate = new Date(a.createdAt || 0).getTime();
              const bDate = new Date(b.createdAt || 0).getTime();
              return bDate - aDate;
            })
            .slice(0, 8),
        }));
        hasData = true;
      } else {
        console.warn("Products load error:", handleApiError(prodRes.error));
      }

      if (!hasData) {
        throw new Error("Failed to load data from server");
      }

    } catch (e: any) {
      console.error("Fetch data error:", e);
      setState((s) => ({ ...s, error: e.message || "Failed to load data" }));
      
      Alert.alert(
        "Error Loading Data", 
        e.message || "Failed to load data", 
        [
          { text: "Retry", onPress: fetchData },
          { text: "Cancel", style: "cancel" },
        ]
      );
    } finally {
      setState((s) => ({ ...s, isLoading: false, refreshing: false }));
    }
  }

  // ✅ Enhanced wishlist handler
  async function handleWishlistPress(productId: string) {
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

      if (currentWishlistStatus) {
        optimisticUpdateWishlist(productId, null);
        const res = await removeWishlistApi(productId, user._id);
        
        if (res.success) {
          Alert.alert("Removed ❤️", "Item removed from wishlist");
          await refreshUserPreferences();
          forceWishlistRefresh();
        } else {
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
        
        const res = await addWishlistApi({ 
          userId: user._id, 
          productId, 
          priority: "medium" 
        });
        
        if (res.success) {
          Alert.alert("Added ❤️", "Item added to wishlist");
          await refreshUserPreferences();
          forceWishlistRefresh();
        } else {
          optimisticUpdateWishlist(productId, null);
          throw new Error(res.error?.message || "Failed to add to wishlist");
        }
      }
    } catch (error: any) {
      console.error("❌ Home: Wishlist error:", error);
      Alert.alert("Error", handleApiError(error) || "Failed to update wishlist. Please try again.");
    }
  }

  function handleSearchPress() {
    if (!searchProducts.length) {
      Alert.alert("Please wait", "Products are still loading.");
      return;
    }
    setSearchVisible(true);
  }

  // ✅ NEW: Handle bag navigation
  function handleBagPress() {
    router.push("/(tabs)/bag");
  }

  // ✅ NEW: Address handlers
  function handleAddressPress() {
    setAddressSelectionVisible(true);
  }

  function handleSelectAddress(addressId: string) {
    // Address selection handled by AuthContext
    setAddressSelectionVisible(false);
  }

  function handleAddNewAddress() {
    setAddressSelectionVisible(false);
    setEditingAddress(null); // ✅ Clear editing address for new address
    setAddressManagementVisible(true);
  }

  // ✅ NEW: Handle edit address
  const handleEditAddress = (address: Address) => {
    // Close address selection overlay
    setAddressSelectionVisible(false);
    
    // Set the address to edit and open address management overlay
    setEditingAddress(address);
    setAddressManagementVisible(true);
  };

  function handleDealPress(deal: typeof deals[number]) {
    switch (deal.category) {
      case "budget":
        router.push("/categories?maxPrice=599");
        break;
      case "sale":
        router.push("/categories?discount=40");
        break;
      case "new":
        router.push("/categories?newArrivals=true");
        break;
      default:
        router.push("/categories");
    }
  }

  // ✅ Enhanced rating display component
  const RatingDisplay = ({ rating, ratingCount }: { rating?: number; ratingCount?: number }) => {
    if (!rating) return null;
    return (
      <View style={styles.ratingContainer}>
        <Star size={typography.sm} color={colors.warning} fill={colors.warning} />
        <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
        {!!ratingCount && <Text style={styles.ratingCountText}>({ratingCount})</Text>}
      </View>
    );
  };

  // ✅ Enhanced product card component for horizontal scrolling
  const ProductCard = ({ product, onPress }: { product: Product; onPress: () => void }) => {
    const isWishlisted = wishlistItems.has(product._id);

    return (
      <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity 
          style={[styles.productCard, { width: productCardWidth }]} 
          onPress={onPress} 
          activeOpacity={0.9}
        >
          <View style={styles.productImageWrapper}>
            <Image
              source={{ 
                uri: product.images?.[0] && product.images[0].trim() 
                  ? product.images[0] 
                  : undefined
              }}
              style={[
                styles.productImage, 
                { 
                  width: productCardWidth, 
                  height: productCardWidth * 1.3,
                }
              ]}
              resizeMode="cover"
            />
            
            <View style={styles.badgesContainer}>
              {product.isNew && (
                <View style={styles.newBadge}>
                  <Text style={styles.badgeText}>NEW</Text>
                </View>
              )}
              {product.isFeatured && (
                <View style={styles.featuredBadge}>
                  <Text style={styles.badgeText}>⭐</Text>
                </View>
              )}
              {product.isBestseller && (
                <View style={styles.bestsellerBadge}>
                  <Text style={styles.badgeText}>🏆</Text>
                </View>
              )}
            </View>

            <View style={styles.quickActions}>
              <TouchableOpacity
                style={[styles.quickActionButton, isWishlisted && styles.activeWishlist]}
                onPress={() => {
                  handleWishlistPress(product._id);
                }}
              >
                <Heart 
                  size={getResponsiveValue(16, 18, 20)} 
                  color={isWishlisted ? colors.primary : colors.textLight} 
                  fill={isWishlisted ? colors.primary : "none"} 
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.productInfo}>
            <Text style={styles.brandName} numberOfLines={1}>
              {product.brand}
            </Text>
            <Text style={styles.productName} numberOfLines={2}>
              {product.name}
            </Text>
            <View style={styles.priceRow}>
              <Text style={styles.priceText}>₹{product.price}</Text>
              {product.discount && <Text style={styles.discountText}>{product.discount}</Text>}
            </View>
            <RatingDisplay rating={product.rating} ratingCount={product.ratingCount} />
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // ✅ NEW: Address section component
  const AddressSection = () => {
    if (!user) return null;

    return (
      <View style={styles.addressSection}>
        <TouchableOpacity 
          style={styles.addressContainer}
          onPress={handleAddressPress}
          activeOpacity={0.8}
        >
          <View style={styles.addressHeader}>
            <MapPin size={20} color={colors.primary} />
            <Text style={styles.addressTitle}>Deliver to</Text>
            <ChevronDown size={16} color={colors.primary} />
          </View>
          
          {defaultAddress ? (
            <View style={styles.addressContent}>
              <Text style={styles.addressName} numberOfLines={1}>
                {defaultAddress.name}
              </Text>
              <Text style={styles.addressText} numberOfLines={2}>
                {defaultAddress.addressLine1}, {defaultAddress.city} - {defaultAddress.pincode}
              </Text>
            </View>
          ) : (
            <Text style={styles.addAddressText}>Add delivery address</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  // ✅ Enhanced Recently Viewed Carousel Component
  const RecentlyViewedCarousel = () => {
    if (state.recentlyViewed.length === 0) return null;

    const animatedHeight = recentlyViewedHeightAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 280],
      extrapolate: 'clamp',
    });

    return (
      <View style={styles.recentlyViewedSection}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleContainer}>
            <Eye size={getResponsiveValue(18, 20, 22)} color={colors.primary} />
            <Text style={styles.sectionTitle}>RECENTLY VIEWED</Text>
          </View>
          <TouchableOpacity 
            style={styles.toggleButton}
            onPress={toggleRecentlyViewed}
            activeOpacity={0.8}
          >
            <Text style={styles.toggleButtonText}>
              {recentlyViewedCollapsed ? "View All" : "Hide All"}
            </Text>
            {recentlyViewedCollapsed ? (
              <ChevronDown size={16} color={colors.primary} />
            ) : (
              <ChevronUp size={16} color={colors.primary} />
            )}
          </TouchableOpacity>
        </View>

        <Animated.View style={[styles.recentlyViewedContainer, { height: animatedHeight }]}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recentlyViewedScrollContainer}
          >
            {state.recentlyViewed.map((product) => (
              <TouchableOpacity
                key={product._id}
                style={styles.recentlyViewedCard}
                onPress={() => router.push(`/product/${product._id}`)}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri: product.images?.[0] }}
                  style={styles.recentlyViewedImage}
                  resizeMode="cover"
                />
                
                <View style={styles.recentlyViewedInfo}>
                  <Text style={styles.recentlyViewedBrand} numberOfLines={1}>
                    {product.brand}
                  </Text>
                  <Text style={styles.recentlyViewedName} numberOfLines={2}>
                    {product.name}
                  </Text>
                  <Text style={styles.recentlyViewedPrice}>₹{product.price}</Text>
                  {product.rating && (
                    <Text style={styles.recentlyViewedRating}>⭐ {product.rating.toFixed(1)}</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>
      </View>
    );
  };

  // ✅ Enhanced categories section
  function renderCategories() {
    if (state.isLoading && state.categories.length === 0) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading categories...</Text>
        </View>
      );
    }

    if (!state.categories.length) {
      return (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No categories available</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.categoriesScroll} 
        contentContainerStyle={styles.categoriesContainer}
      >
        {state.categories.slice(0, 8).map((cat, index) => (
          <Animated.View
            key={cat._id}
            style={{
              opacity: fadeAnim,
              transform: [{
                translateX: slideAnim.interpolate({
                  inputRange: [0, 50],
                  outputRange: [0, index * 20],
                  extrapolate: 'clamp',
                })
              }]
            }}
          >
            <TouchableOpacity
              style={[styles.categoryCard, { width: categorySize }]}
              onPress={() => router.push(`/category/${cat._id}`)}
              activeOpacity={0.8}
            >
              <View style={styles.categoryImageContainer}>
                <Image
                  source={{ 
                    uri: cat.image && cat.image.trim() 
                      ? cat.image 
                      : undefined
                  }}
                  style={[
                    styles.categoryImage, 
                    { 
                      width: categorySize, 
                      height: categorySize,
                    }
                  ]}
                  resizeMode="cover"
                />
              </View>
              <Text style={styles.categoryName} numberOfLines={1}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </ScrollView>
    );
  }

  // ✅ Enhanced deals section  
  function renderDeals() {
    return (
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.dealsScroll} 
        contentContainerStyle={styles.dealsContainer}
      >
        {deals.map((deal, index) => (
          <Animated.View
            key={deal.id}
            style={{
              opacity: fadeAnim,
              transform: [{
                translateX: slideAnim.interpolate({
                  inputRange: [0, 50],
                  outputRange: [0, index * 15],
                  extrapolate: 'clamp',
                })
              }]
            }}
          >
            <TouchableOpacity
              style={[styles.dealCard, { width: dealCardWidth }]}
              onPress={() => handleDealPress(deal)}
              activeOpacity={0.9}
            >
              <Image source={{ uri: deal.image }} style={styles.dealImage} />
              <View style={styles.dealOverlay}>
                <View style={styles.dealBadge}>
                  {deal.icon}
                  <Text style={styles.dealBadgeText}>{deal.discount}</Text>
                </View>
                <Text style={styles.dealTitle}>{deal.title}</Text>
                <Text style={styles.dealDescription} numberOfLines={2}>
                  {deal.description}
                </Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </ScrollView>
    );
  }

  // ✅ Enhanced products horizontal scroll
  function renderProductsHorizontal(products: Product[], title: string) {
    if (state.isLoading && products.length === 0) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading {title.toLowerCase()}...</Text>
        </View>
      );
    }

    if (!products.length) {
      return (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No {title.toLowerCase()} available</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
            <Text style={styles.retryButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.productsHorizontalContainer}
      >
        {products.map((product) => (
          <ProductCard
            key={product._id}
            product={product}
            onPress={() => router.push(`/product/${product._id}`)}
          />
        ))}
      </ScrollView>
    );
  }

  // ✅ Enhanced error state
  if (state.error && !state.refreshing && !state.isLoading) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Oops! Something went wrong</Text>
        <Text style={styles.errorText}>{state.error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl 
            refreshing={state.refreshing} 
            onRefresh={fetchData} 
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ✅ Header with search and bag icons */}
        <Animated.View style={[styles.header, { opacity: headerAnim }]}>
          <LinearGradient
            colors={colors.gradient.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.headerGradient}
          >
            <View style={styles.headerContent}>
              <View style={styles.headerLeft}>
                <Image source={require("@/assets/images/myntra-fav.webp")} style={styles.logoImage} />
                <Text style={styles.logo}>MYNTRA</Text>
              </View>
              
              <View style={styles.headerActions}>
                <TouchableOpacity 
                  style={styles.headerActionButton} 
                  onPress={handleSearchPress} 
                  activeOpacity={0.8}
                >
                  <Search size={getResponsiveValue(22, 24, 26)} color="#fff" />
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.headerActionButton}
                  onPress={handleBagPress}
                  activeOpacity={0.8}
                >
                  <ShoppingBag size={getResponsiveValue(22, 24, 26)} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ✅ NEW: Address Section */}
        <AddressSection />

        {/* ✅ Fashion Forward Banner */}
        <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
          <TouchableOpacity activeOpacity={0.95} style={styles.bannerContainer}>
            <Image
              source={{ uri: "https://images.unsplash.com/photo-1441986302599-5a16a6ab8f72?w=800" }}
              style={styles.banner}
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.7)']}
              style={styles.bannerOverlay}
            >
              <Text style={styles.bannerTitle}>Fashion Forward</Text>
              <Text style={styles.bannerSubtitle}>Discover your unique style</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* ✅ Shop by Category */}
        <Animated.View style={[styles.section, { 
          opacity: fadeAnim, 
          transform: [{ translateY: slideAnim }] 
        }]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <Tag size={getResponsiveValue(18, 20, 22)} color={colors.primary} />
              <Text style={styles.sectionTitle}>SHOP BY CATEGORY</Text>
            </View>
            <TouchableOpacity 
              onPress={() => router.push("/(tabs)/categories")} 
              style={styles.viewAll}
            >
              <Text style={styles.viewAllText}>View All</Text>
              <ChevronRight size={getResponsiveValue(18, 20, 22)} color={colors.primary} />
            </TouchableOpacity>
          </View>
          {renderCategories()}
        </Animated.View>

        {/* ✅ Deals of the Day */}
        <Animated.View style={[styles.section, { 
          opacity: fadeAnim, 
          transform: [{ translateY: slideAnim }] 
        }]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <Sparkles size={getResponsiveValue(18, 20, 22)} color={colors.primary} />
              <Text style={styles.sectionTitle}>DEALS OF THE DAY</Text>
            </View>
          </View>
          {renderDeals()}
        </Animated.View>

        {/* ✅ Trending Products */}
        <Animated.View style={[styles.section, { 
          opacity: fadeAnim, 
          transform: [{ translateY: slideAnim }] 
        }]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <TrendingUp size={getResponsiveValue(18, 20, 22)} color={colors.primary} />
              <Text style={styles.sectionTitle}>TRENDING NOW</Text>
            </View>
            <TouchableOpacity 
              style={styles.viewAll} 
              onPress={() => router.push("/(tabs)/categories")}
            >
              <Text style={styles.viewAllText}>View All</Text>
              <ChevronRight size={getResponsiveValue(18, 20, 22)} color={colors.primary} />
            </TouchableOpacity>
          </View>
          {renderProductsHorizontal(state.products, "Trending Products")}
        </Animated.View>

        {/* ✅ Recently Viewed */}
        {state.recentlyViewed.length > 0 && (
          <Animated.View style={[styles.section, { 
            opacity: fadeAnim, 
            transform: [{ translateY: slideAnim }] 
          }]}>
            <RecentlyViewedCarousel />
          </Animated.View>
        )}

        {/* ✅ Featured Products */}
        {state.featuredProducts.length > 0 && (
          <Animated.View style={[styles.section, { 
            opacity: fadeAnim, 
            transform: [{ translateY: slideAnim }] 
          }]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <Award size={getResponsiveValue(18, 20, 22)} color={colors.primary} />
                <Text style={styles.sectionTitle}>FEATURED PRODUCTS</Text>
              </View>
              <TouchableOpacity 
                style={styles.viewAll} 
                onPress={() => router.push("/(tabs)/categories?featured=true")}
              >
                <Text style={styles.viewAllText}>View All</Text>
                <ChevronRight size={getResponsiveValue(18, 20, 22)} color={colors.primary} />
              </TouchableOpacity>
            </View>
            {renderProductsHorizontal(state.featuredProducts, "Featured Products")}
          </Animated.View>
        )}

        {/* Bottom spacing */}
        <View style={{ height: hp(8) }} />
      </ScrollView>

      {/* ✅ Enhanced Search Overlay */}
      <SearchOverlay
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        products={searchProducts}
        categories={state.categories}
        onProductPress={(id) => router.push(`/product/${id}`)}
        activeFilters={filters}
        onWishlistPress={handleWishlistPress}
        onBagPress={undefined}
        onCategoryPress={(categoryId, categoryName) => router.push(`/category/${categoryId}`)}
        onSubcategoryPress={(categoryId, subcategory, categoryName) => router.push(`/category/${categoryId}?subcategory=${subcategory}`)}
      />

      {/* ✅ FIXED: Address Selection Overlay with onEditAddress prop */}
      <AddressSelectionOverlay
        visible={addressSelectionVisible}
        onClose={() => setAddressSelectionVisible(false)}
        onSelectAddress={handleSelectAddress}
        onAddNewAddress={handleAddNewAddress}
        onEditAddress={handleEditAddress} // ✅ NOW INCLUDED
      />

      {/* ✅ NEW: Address Management Overlay with editingAddress */}
      <AddressManagementOverlay
        visible={addressManagementVisible}
        onClose={() => {
          setAddressManagementVisible(false);
          setEditingAddress(null); // ✅ Clear editing address when closing
        }}
        editingAddress={editingAddress} // ✅ Pass the address to edit
        onSuccess={() => {
          setAddressManagementVisible(false);
          setEditingAddress(null); // ✅ Clear editing address after success
          // Refresh will happen via AuthContext
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // ===============================
  // HEADER STYLES
  // ===============================
  header: {
    zIndex: 10,
    elevation: 8,
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 50 : 25,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoImage: {
    width: getResponsiveValue(28, 32, 36),
    height: getResponsiveValue(28, 32, 36),
    borderRadius: getResponsiveValue(6, 8, 10),
    marginRight: spacing.sm,
  },
  logo: {
    fontSize: typography.xl,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1.2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerActionButton: {
    padding: spacing.sm,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ===============================
  // NEW: ADDRESS SECTION STYLES
  // ===============================
  addressSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  addressContainer: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  addressTitle: {
    fontSize: typography.md,
    fontWeight: '600',
    color: colors.text,
    marginLeft: spacing.sm,
    marginRight: spacing.sm,
    flex: 1,
  },
  addressContent: {
    marginLeft: 28,
  },
  addressName: {
    fontSize: typography.sm,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  addressText: {
    fontSize: typography.sm,
    color: colors.textLight,
    lineHeight: 18,
  },
  addAddressText: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: '600',
    marginLeft: 28,
  },

  // ===============================
  // BANNER STYLES
  // ===============================
  bannerContainer: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  banner: {
    width: '100%',
    height: getResponsiveValue(200, 240, 280),
  },
  bannerOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    justifyContent: 'flex-end',
  },
  bannerTitle: {
    fontSize: typography.xxl,
    fontWeight: '700',
    color: '#fff',
    marginBottom: spacing.xs,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bannerSubtitle: {
    fontSize: typography.md,
    color: '#fff',
    opacity: 0.9,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // ===============================
  // SECTION STYLES
  // ===============================
  section: {
    marginBottom: spacing.xxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionTitle: {
    fontSize: typography.lg,
    fontWeight: '700',
    color: colors.text,
    marginLeft: spacing.sm,
    letterSpacing: 0.5,
  },
  viewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primaryLight,
    borderRadius: 20,
  },
  viewAllText: {
    fontSize: typography.sm,
    fontWeight: '600',
    color: colors.primary,
    marginRight: spacing.xs,
  },

  // ===============================
  // CATEGORIES STYLES
  // ===============================
  categoriesScroll: {
    marginLeft: spacing.lg,
  },
  categoriesContainer: {
    paddingRight: spacing.lg,
    gap: spacing.md,
  },
  categoryCard: {
    alignItems: 'center',
    marginRight: spacing.md,
  },
  categoryImageContainer: {
    borderRadius: getResponsiveValue(wp(9), wp(7), wp(5.5)),
    overflow: 'hidden',
    elevation: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    backgroundColor: colors.surface,
  },
  categoryImage: {
    borderRadius: getResponsiveValue(wp(9), wp(7), wp(5.5)),
  },
categoryName: {
  fontSize: typography.xs,
  fontWeight: '600',
  color: colors.text,
  textAlign: 'center',
  marginTop: spacing.sm,
  maxWidth: getResponsiveValue(wp(18), wp(14), wp(11)), // ✅ Direct calculation
},


  // ===============================
  // DEALS STYLES
  // ===============================
  dealsScroll: {
    marginLeft: spacing.lg,
  },
  dealsContainer: {
    paddingRight: spacing.lg,
    gap: spacing.lg,
  },
  dealCard: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    backgroundColor: colors.surface,
    marginRight: spacing.lg,
  },
  dealImage: {
    width: '100%',
    height: getResponsiveValue(140, 160, 180),
  },
  dealOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    padding: spacing.lg,
    justifyContent: 'space-between',
  },
  dealBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    alignSelf: 'flex-start',
    gap: spacing.xs,
  },
  dealBadgeText: {
    fontSize: typography.xs,
    fontWeight: '700',
    color: colors.text,
  },
  dealTitle: {
    fontSize: typography.lg,
    fontWeight: '700',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  dealDescription: {
    fontSize: typography.sm,
    color: '#fff',
    opacity: 0.9,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // ===============================
  // PRODUCT CARD STYLES
  // ===============================
  productsHorizontalContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  productCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    marginRight: spacing.md,
  },
  productImageWrapper: {
    position: 'relative',
  },
  productImage: {
    backgroundColor: colors.surface,
  },
  badgesContainer: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    gap: spacing.xs,
  },
  newBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 4,
  },
  featuredBadge: {
    backgroundColor: colors.warning,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bestsellerBadge: {
    backgroundColor: colors.info,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },
  quickActions: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
  },
  quickActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  activeWishlist: {
    backgroundColor: colors.primaryLight,
  },
  productInfo: {
    padding: spacing.md,
  },
  brandName: {
    fontSize: typography.xs,
    fontWeight: '500',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  productName: {
    fontSize: typography.sm,
    fontWeight: '600',
    color: colors.text,
    lineHeight: typography.sm * 1.3,
    marginBottom: spacing.xs,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.xs,
  },
  priceText: {
    fontSize: typography.md,
    fontWeight: '700',
    color: colors.text,
  },
  discountText: {
    fontSize: typography.xs,
    fontWeight: '600',
    color: colors.success,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: typography.xs,
    fontWeight: '600',
    color: colors.textLight,
  },
  ratingCountText: {
    fontSize: typography.xs,
    color: colors.textMuted,
  },

  // ===============================
  // RECENTLY VIEWED STYLES
  // ===============================
  recentlyViewedSection: {
    marginHorizontal: spacing.lg,
  },
  recentlyViewedContainer: {
    overflow: 'hidden',
  },
  recentlyViewedScrollContainer: {
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primaryLight,
    borderRadius: 20,
    gap: spacing.xs,
  },
  toggleButtonText: {
    fontSize: typography.xs,
    fontWeight: '600',
    color: colors.primary,
  },
  recentlyViewedCard: {
    backgroundColor: colors.background,
    borderRadius: 10,
    overflow: 'hidden',
    width: getResponsiveValue(130, 140, 150),
    elevation: 3,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  recentlyViewedImage: {
    width: '100%',
    height: getResponsiveValue(100, 110, 120),
    backgroundColor: colors.surface,
  },
  recentlyViewedInfo: {
    padding: spacing.sm,
  },
  recentlyViewedBrand: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  recentlyViewedName: {
    fontSize: typography.xs,
    fontWeight: '600',
    color: colors.text,
    lineHeight: typography.xs * 1.2,
    marginVertical: 2,
  },
  recentlyViewedPrice: {
    fontSize: typography.xs,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  recentlyViewedRating: {
    fontSize: 9,
    color: colors.textLight,
  },

  // ===============================
  // STATE STYLES
  // ===============================
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
  },
  loadingText: {
    fontSize: typography.md,
    color: colors.textLight,
    marginTop: spacing.md,
    fontWeight: '500',
  },
  emptyText: {
    fontSize: typography.md,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 8,
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  retryButtonText: {
    fontSize: typography.md,
    fontWeight: '600',
    color: '#fff',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background,
  },
  errorTitle: {
    fontSize: typography.xl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  errorText: {
    fontSize: typography.md,
    color: colors.textLight,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: typography.md * 1.4,
  },
});
