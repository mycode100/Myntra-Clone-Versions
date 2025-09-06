import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
  Share,
  Animated,
  PanResponder,
  StatusBar,
  RefreshControl,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Heart,
  ShoppingBag,
  ArrowLeft,
  Star,
  Share2,
  Truck,
  RefreshCw,
  Shield,
  Award,
  Users,
  MessageCircle,
  ChevronRight,
  Info,
  Check,
  X,
  Plus,
  Minus,
} from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { Product, Review, RatingBreakdown, BagItem, WishlistItem } from "@/types/product";

// ✅ UPDATED: Import the API functions we need
import {
  getProduct,
  getProducts,
  handleApiError,
  addToBag,
  addToWishlist,
  removeFromWishlist,
  checkWishlistStatus,
  getUserBag,
  updateBagItemQuantity,
} from "@/utils/api";

// ✅ NEW: Recently viewed tracking import
import { addToRecentlyViewed } from "@/utils/recentlyViewed";

// ✅ NEW: Sweet Alert import using existing library
import AwesomeAlert from 'react-native-awesome-alerts';

// ✅ NEW: Import recommendation components and APIs
import YouMayAlsoLikeCarousel from "@/components/YouMayAlsoLikeCarousel";
import { recommendationApi, trackProductView } from "@/utils/recommendationApi";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

// ✅ CORRECTED: Helper function to get product ID (consistent with _id)
const getProductId = (product: Product): string => {
  return product._id;
};

// Types
interface ProductDetailState {
  product: Product | null;
  relatedProducts: Product[];
  reviews: Review[];
  ratingBreakdown: RatingBreakdown | null;
  isLoading: boolean;
  error: string | null;
}

interface ImageGalleryProps {
  images: string[];
  onImagePress: (index: number) => void;
}

// Constants
const PRODUCT_FEATURES = [
  { icon: <Truck size={16} color="#4caf50" />, text: "Free delivery on orders above ₹999" },
  { icon: <RefreshCw size={16} color="#2196f3" />, text: "15 days return policy" },
  { icon: <Shield size={16} color="#ff9800" />, text: "Authentic products guaranteed" },
  { icon: <Award size={16} color="#9c27b0" />, text: "Quality checked by experts" },
];

export default function ProductDetails() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  // ✅ ENHANCED: Use enhanced AuthContext with sync triggers
  const {
    user,
    wishlistItems,
    bagItems,
    updateWishlistStatus,
    updateBagStatus,
    refreshUserPreferences,
    optimisticUpdateWishlist,
    forceWishlistRefresh,
    wishlistRefreshTrigger,
    bagRefreshTrigger,
  } = useAuth();

  // State
  const [state, setState] = useState<ProductDetailState>({
    product: null,
    relatedProducts: [],
    reviews: [],
    ratingBreakdown: null,
    isLoading: true,
    error: null,
  });

  const [selectedSize, setSelectedSize] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [addToBagLoading, setAddToBagLoading] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  // ✅ NEW: Sweet Alert state
  const [showSizeAlert, setShowSizeAlert] = useState(false);

  // ✅ ENHANCED: Track wishlist and bag status from global state with instant updates
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [inBag, setInBag] = useState(false);

  // ✅ NEW: Recommendation and tracking state
  const [viewStartTime, setViewStartTime] = useState<number>(Date.now());
  const [scrollDepth, setScrollDepth] = useState(0);
  const [hasTrackedView, setHasTrackedView] = useState(false);

  // Refs
  const scrollViewRef = useRef<ScrollView>(null);
  const imageScrollRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Auto-scroll for image gallery
  const autoScrollTimer = useRef<NodeJS.Timeout>();

  // ✅ NEW: Refs for tracking
  const viewTrackingTimer = useRef<NodeJS.Timeout>();
  const scrollTrackingTimer = useRef<NodeJS.Timeout>();

  // Memoized calculations
  const averageRating = useMemo(() => {
    if (!state.ratingBreakdown) return 0;
    return state.ratingBreakdown.average;
  }, [state.ratingBreakdown]);

  const totalReviews = useMemo(() => {
    if (!state.ratingBreakdown) return 0;
    return state.ratingBreakdown.total;
  }, [state.ratingBreakdown]);

  const discountPercentage = useMemo(() => {
    if (!state.product?.discount) return 0;
    const match = state.product.discount.match(/(\d+)%/);
    return match ? parseInt(match[1], 10) : 0;
  }, [state.product?.discount]);

  const originalPrice = useMemo(() => {
    if (!state.product?.price || !discountPercentage) return null;
    return Math.round(state.product.price / (1 - discountPercentage / 100));
  }, [state.product?.price, discountPercentage]);

  // Effects
  useEffect(() => {
    if (id) {
      fetchProductData();
    }
  }, [id]);

  useEffect(() => {
    startImageAutoScroll();
    return () => {
      if (autoScrollTimer.current) {
        clearInterval(autoScrollTimer.current);
      }
    };
  }, [state.product?.images, currentImageIndex]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  // ✅ ENHANCED: Check status from global AuthContext state with refresh trigger
  useEffect(() => {
    if (state.product && user) {
      checkWishlistAndBagStatus();
    }
  }, [state.product, user, wishlistItems, bagItems, wishlistRefreshTrigger, bagRefreshTrigger]);

  // ✅ NEW: Track product view and user behavior
  useEffect(() => {
    if (state.product && !hasTrackedView) {
      trackInitialProductView();
      setHasTrackedView(true);
    }

    // Set up view duration tracking
    if (state.product) {
      viewTrackingTimer.current = setTimeout(() => {
        trackExtendedView();
      }, 30000); // Track after 30 seconds
    }

    return () => {
      if (viewTrackingTimer.current) {
        clearTimeout(viewTrackingTimer.current);
      }
      if (scrollTrackingTimer.current) {
        clearTimeout(scrollTrackingTimer.current);
      }
    };
  }, [state.product, hasTrackedView]);

  // ✅ NEW: Track product view when component loads
  const trackInitialProductView = async () => {
    if (!state.product) return;

    try {
      console.log('📊 Tracking initial product view:', state.product.name);
      
      await trackProductView(getProductId(state.product), {
        userId: user?._id,
        source: 'product_detail',
        metadata: {
          platform: 'mobile',
          userAgent: 'ReactNative',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.warn('⚠️ Failed to track initial product view:', error);
    }
  };

  // ✅ NEW: Track extended viewing time
  const trackExtendedView = async () => {
    if (!state.product) return;

    try {
      const timeSpent = Math.floor((Date.now() - viewStartTime) / 1000);
      
      await trackProductView(getProductId(state.product), {
        userId: user?._id,
        source: 'product_detail_extended',
        timeSpent,
        scrollDepth,
        metadata: {
          platform: 'mobile',
          userAgent: 'ReactNative',
          viewDuration: timeSpent,
          maxScrollDepth: scrollDepth,
        },
      });
    } catch (error) {
      console.warn('⚠️ Failed to track extended view:', error);
    }
  };

  // ✅ NEW: Handle scroll tracking for user engagement
  const handleScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const currentScrollDepth = Math.round(
      (contentOffset.y / (contentSize.height - layoutMeasurement.height)) * 100
    );
    
    if (currentScrollDepth > scrollDepth) {
      setScrollDepth(Math.min(currentScrollDepth, 100));
    }

    // Debounced scroll tracking
    if (scrollTrackingTimer.current) {
      clearTimeout(scrollTrackingTimer.current);
    }

    scrollTrackingTimer.current = setTimeout(() => {
      if (state.product && currentScrollDepth > 50) { // Track when user scrolls more than 50%
        trackScrollEngagement(currentScrollDepth);
      }
    }, 2000);
  };

  // ✅ NEW: Track scroll engagement
  const trackScrollEngagement = async (depth: number) => {
    if (!state.product) return;

    try {
      const timeSpent = Math.floor((Date.now() - viewStartTime) / 1000);
      
      await trackProductView(getProductId(state.product), {
        userId: user?._id,
        source: 'product_detail_scroll',
        timeSpent,
        scrollDepth: depth,
        metadata: {
          platform: 'mobile',
          scrollEngagement: 'high',
          timeToScroll: timeSpent,
        },
      });
    } catch (error) {
      console.warn('⚠️ Failed to track scroll engagement:', error);
    }
  };

  // ✅ UPDATED: Use direct named function calls
  const fetchProductData = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      if (!id) {
        throw new Error("Product ID is missing");
      }

      console.log("🔍 Fetching product data for ID:", id);

      const [productResponse, relatedResponse] = await Promise.all([
        getProduct(id as string),
        getProducts({ limit: 6 }),
      ]);

      if (!productResponse.success || !productResponse.data) {
        throw new Error(productResponse.error?.message || "Product not found");
      }

      const product = productResponse.data;
      const allProducts = relatedResponse.success ? relatedResponse.data || [] : [];

      // ✅ CORRECTED: Use _id consistently
      const enhancedProduct = {
        ...product,
        _id: product._id,
      };

      // Generate mock rating breakdown and reviews for demonstration
      const mockRatingBreakdown: RatingBreakdown = {
        average: enhancedProduct?.rating || 4.2,
        total: Math.floor(Math.random() * 500) + 50,
        breakdown: {
          5: Math.floor(Math.random() * 200) + 50,
          4: Math.floor(Math.random() * 150) + 30,
          3: Math.floor(Math.random() * 80) + 20,
          2: Math.floor(Math.random() * 30) + 10,
          1: Math.floor(Math.random() * 20) + 5,
        },
        percentages: {
          5: 0, 4: 0, 3: 0, 2: 0, 1: 0,
        },
      };

      // Calculate percentages
      Object.keys(mockRatingBreakdown.breakdown).forEach(key => {
        const rating = parseInt(key);
        mockRatingBreakdown.percentages[rating as keyof typeof mockRatingBreakdown.percentages] =
          (mockRatingBreakdown.breakdown[rating as keyof typeof mockRatingBreakdown.breakdown] / mockRatingBreakdown.total) * 100;
      });

      const related = allProducts
        .filter((p: Product) => getProductId(p) !== getProductId(enhancedProduct))
        .slice(0, 6);

      setState(prev => ({
        ...prev,
        product: enhancedProduct,
        relatedProducts: related,
        ratingBreakdown: mockRatingBreakdown,
        isLoading: false,
      }));

      // ✅ NEW: Track recently viewed product
      await addToRecentlyViewed(enhancedProduct);

      // ✅ NEW: Reset tracking state for new product
      setViewStartTime(Date.now());
      setScrollDepth(0);
      setHasTrackedView(false);

    } catch (error: any) {
      console.error("❌ Error fetching product:", error);
      setState(prev => ({
        ...prev,
        error: error.message || "Failed to load product details",
        isLoading: false,
      }));
    }
  };

  // ✅ ENHANCED: Check status from global AuthContext state with refresh trigger
  const checkWishlistAndBagStatus = () => {
    if (!state.product) return;

    const productId = getProductId(state.product);
    
    // The has() method now works on the Map
    const newIsWishlisted = wishlistItems.has(productId);
    const newInBag = bagItems.has(productId);

    if (newIsWishlisted !== isWishlisted) {
      setIsWishlisted(newIsWishlisted);
    }
    if (newInBag !== inBag) {
      setInBag(newInBag);
    }
  };

  const startImageAutoScroll = () => {
    if (!state.product?.images || state.product.images.length <= 1) return;

    if (autoScrollTimer.current) {
      clearInterval(autoScrollTimer.current);
    }

    autoScrollTimer.current = setInterval(() => {
      const nextIndex = (currentImageIndex + 1) % state.product!.images.length;
      setCurrentImageIndex(nextIndex);

      if (imageScrollRef.current) {
        imageScrollRef.current.scrollTo({
          x: nextIndex * screenWidth,
          animated: true,
        });
      }
    }, 4000);
  };

  // ✅ CORRECTED: Wishlist handler now uses the new updateWishlistStatus signature
  const handleAddToWishlist = async () => {
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

    const productId = getProductId(state.product!);
    if (!productId) {
      console.error("❌ Product ID is missing for wishlist operation");
      Alert.alert("Error", "Product ID not found");
      return;
    }

    try {
      setWishlistLoading(true);
      const currentWishlistStatus = wishlistItems.has(productId);

      // ✅ NEW: Track wishlist interaction
      await trackProductView(productId, {
        userId: user._id,
        source: 'wishlist_action',
        addedToWishlist: !currentWishlistStatus,
        metadata: {
          action: currentWishlistStatus ? 'remove' : 'add',
          fromPage: 'product_detail',
        },
      });

      if (currentWishlistStatus) {
        // Optimistic update
        optimisticUpdateWishlist(productId, null);
        setIsWishlisted(false);
        
        const response = await removeFromWishlist(productId, user._id);
        
        if (response.success) {
          Alert.alert("Removed from Wishlist ❤️", `${state.product!.name} has been removed from your wishlist`);
          // Full refresh to ensure perfect sync
          await refreshUserPreferences();
        } else {
          // Revert optimistic update on failure
          const revertItem = { _id: productId, productId: state.product!, userId: user._id, addedAt: new Date().toISOString() } as WishlistItem;
          optimisticUpdateWishlist(productId, revertItem);
          setIsWishlisted(true);
          throw new Error(response.error?.message || "Failed to remove from wishlist");
        }
      } else {
        // Optimistic update
        const optimisticItem = { _id: productId, productId: state.product!, userId: user._id, addedAt: new Date().toISOString() } as WishlistItem;
        optimisticUpdateWishlist(productId, optimisticItem);
        setIsWishlisted(true);
        
        const response = await addToWishlist({
          userId: user._id,
          productId: productId,
          priority: 'medium'
        });
        
        if (response.success) {
          Alert.alert(
            "Added to Wishlist ❤️",
            `${state.product!.name} has been added to your wishlist`,
            [
              { text: "Continue Shopping", style: "cancel" },
              { text: "View Wishlist", onPress: () => router.push("/(tabs)/wishlist") },
            ]
          );
          // Full refresh to ensure perfect sync
          await refreshUserPreferences();
        } else {
          // Revert optimistic update on failure
          optimisticUpdateWishlist(productId, null);
          setIsWishlisted(false);
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
      setWishlistLoading(false);
    }
  };
  
  // ✅ UPDATED: Enhanced bag handler with sweet alert for size selection
  const handleAddToBag = async () => {
    // Check if user is logged in
    if (!user) {
      Alert.alert(
        "Login Required",
        "Please login to add items to bag",
        [
          { text: "Login", onPress: () => router.push("/login") },
          { text: "Cancel", style: "cancel" },
        ]
      );
      return;
    }

    // ✅ UPDATED: Check if a size is required and has been selected - show sweet alert
    if (state.product?.sizes && state.product.sizes.length > 0 && !selectedSize) {
      setShowSizeAlert(true);
      return;
    }

    const productId = getProductId(state.product!);
    if (!productId) {
      console.error("❌ Product ID is missing for bag operation");
      Alert.alert("Error", "Product ID not found");
      return;
    }
    
    console.log("Adding to bag with details:", { productId, selectedSize, quantity });
    
    try {
      setAddToBagLoading(true);

      // ✅ NEW: Track bag interaction
      await trackProductView(productId, {
        userId: user._id,
        source: 'bag_action',
        addedToBag: true,
        metadata: {
          action: 'add',
          quantity,
          selectedSize,
          selectedColor,
          fromPage: 'product_detail',
        },
      });

      const existingBagItem = bagItems.get(productId);

      if (existingBagItem) {
        if (existingBagItem.quantity >= 10) {
          Alert.alert("Quantity Limit Reached", "You can only have a maximum of 10 of this item in your bag.");
          return;
        }

        const newQuantity = Math.min(existingBagItem.quantity + quantity, 10);
        console.log(`🔍 Updating quantity from ${existingBagItem.quantity} to ${newQuantity}`);
        const updateResponse = await updateBagItemQuantity(existingBagItem._id, newQuantity);

        if (updateResponse.success) {
          Alert.alert("Bag Updated 🛍️", `${state.product!.name} quantity has been updated to ${newQuantity} in your bag.`);
          await refreshUserPreferences();
        } else {
          throw new Error(updateResponse.error?.message || "Failed to update item quantity in bag.");
        }

      } else {
        const bagData = {
          userId: user._id,
          productId: productId,
          quantity,
          size: selectedSize || undefined,
          color: selectedColor || undefined,
          priceWhenAdded: state.product!.price,
        };
        
        console.log("🔍 Calling addToBag API with data:", bagData);

        const response = await addToBag(bagData);

        if (response.success) {
          Alert.alert(
            "Added to Bag 🛍️",
            `${state.product!.name} has been added to your bag`,
            [
              { text: "Continue Shopping", style: "cancel" },
              { text: "View Bag", onPress: () => router.push("/(tabs)/bag") },
            ]
          );
          await refreshUserPreferences();
        } else {
          throw new Error(response.error?.message || "Failed to add to bag.");
        }
      }
    } catch (error: any) {
      console.error("❌ Error adding/updating bag:", error);
      Alert.alert(
        "Error",
        handleApiError(error) || "Failed to update bag. Please try again.",
        [{ text: "OK", style: "default" }]
      );
    } finally {
      setAddToBagLoading(false);
    }
  };

  const handleShare = async () => {
    if (!state.product) return;

    try {
      const productId = getProductId(state.product);
      
      // ✅ NEW: Track share action
      await trackProductView(productId, {
        userId: user?._id,
        source: 'share_action',
        metadata: {
          action: 'share',
          fromPage: 'product_detail',
        },
      });

      await Share.share({
        message: `Check out this ${state.product.name} by ${state.product.brand} for ₹${state.product.price}`,
        url: `https://yourapp.com/product/${productId}`,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProductData();
    setRefreshing(false);
  };

  const handleImageScroll = (event: any) => {
    const contentOffset = event.nativeEvent.contentOffset;
    const imageIndex = Math.round(contentOffset.x / screenWidth);
    setCurrentImageIndex(imageIndex);
  };

  // ✅ NEW: Handle recommendation product press with tracking
  const handleRecommendationProductPress = (product: Product) => {
    const productId = getProductId(product);
    if (!productId) {
      console.error("❌ Recommendation product missing ID:", product);
      return;
    }
    
    // Track recommendation click
    if (state.product) {
      trackProductView(productId, {
        userId: user?._id,
        source: 'recommendation_click',
        metadata: {
          fromProduct: getProductId(state.product),
          clickedProduct: productId,
          fromPage: 'product_detail',
        },
      }).catch(console.warn);
    }

    router.push(`/product/${productId}`);
  };

  const handleRelatedProductPress = (product: Product) => {
    const productId = getProductId(product);
    if (!productId) {
      console.error("❌ Related product missing ID:", product);
      return;
    }

    // ✅ NEW: Track related product click
    if (state.product) {
      trackProductView(productId, {
        userId: user?._id,
        source: 'related_product_click',
        metadata: {
          fromProduct: getProductId(state.product),
          clickedProduct: productId,
          fromPage: 'product_detail',
        },
      }).catch(console.warn);
    }

    router.push(`/product/${productId}`);
  };

  // Rating Stars Component
  const RatingStars: React.FC<{
    rating: number;
    size?: number;
    showRating?: boolean;
    style?: any;
  }> = ({
    rating,
    size = 16,
    showRating = true,
    style
  }) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    return (
      <View style={[styles.ratingContainer, style]}>
        <View style={styles.starsContainer}>
          {[...Array(fullStars)].map((_, i) => (
            <Star key={`full-${i}`} size={size} color="#ffa500" fill="#ffa500" />
          ))}
          {hasHalfStar && (
            <View style={styles.halfStarContainer}>
              <Star size={size} color="#ffa500" fill="#ffa500" />
              <View style={[styles.halfStarMask, { width: size / 2 }]}>
                <Star size={size} color="#e0e0e0" fill="#e0e0e0" />
              </View>
            </View>
          )}
          {[...Array(emptyStars)].map((_, i) => (
            <Star key={`empty-${i}`} size={size} color="#e0e0e0" fill="#e0e0e0" />
          ))}
        </View>
        {showRating && (
          <Text style={[styles.ratingText, { fontSize: size - 2 }]}>
            {rating.toFixed(1)}
          </Text>
        )}
      </View>
    );
  };

  // Rating Breakdown Component
  const RatingBreakdownComponent: React.FC<{ breakdown: RatingBreakdown }> = ({ breakdown }) => (
    <View style={styles.ratingBreakdownContainer}>
      <Text style={styles.ratingBreakdownTitle}>Rating Breakdown</Text>
      {[5, 4, 3, 2, 1].map((rating) => (
        <View key={rating} style={styles.ratingBreakdownRow}>
          <Text style={styles.ratingNumber}>{rating}</Text>
          <Star size={14} color="#ffa500" fill="#ffa500" />
          <View style={styles.ratingBar}>
            <View
              style={[
                styles.ratingBarFill,
                { width: `${breakdown.percentages[rating as keyof typeof breakdown.percentages]}%` }
              ]}
            />
          </View>
          <Text style={styles.ratingCount}>
            {breakdown.breakdown[rating as keyof typeof breakdown.breakdown]}
          </Text>
        </View>
      ))}
    </View>
  );

  // Image Gallery Component
  const ImageGallery: React.FC<ImageGalleryProps> = ({ images, onImagePress }) => (
    <View style={styles.imageGalleryContainer}>
      <ScrollView
        ref={imageScrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleImageScroll}
        scrollEventThrottle={16}
      >
        {images.map((image, index) => (
          <TouchableOpacity
            key={index}
            style={styles.imageContainer}
            onPress={() => onImagePress(index)}
            activeOpacity={0.9}
          >
            <Image
              source={{ uri: image }}
              style={styles.productImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Image Indicators */}
      <View style={styles.imageIndicators}>
        {images.map((_, index) => (
          <View
            key={index}
            style={[
              styles.imageIndicator,
              currentImageIndex === index && styles.activeImageIndicator,
            ]}
          />
        ))}
      </View>

      {/* Image Counter */}
      <View style={styles.imageCounter}>
        <Text style={styles.imageCounterText}>
          {currentImageIndex + 1} / {images.length}
        </Text>
      </View>
    </View>
  );

  // Product Info Component
  const ProductInfo: React.FC<{ product: Product }> = ({ product }) => (
    <View style={styles.productInfoContainer}>
      <Text style={styles.brandName}>{product.brand}</Text>
      <Text style={styles.productName}>{product.name}</Text>

      <View style={styles.ratingSection}>
        <RatingStars rating={averageRating} size={18} />
        <Text style={styles.reviewCount}>({totalReviews} reviews)</Text>
      </View>

      <View style={styles.priceSection}>
        <Text style={styles.currentPrice}>₹{product.price}</Text>
        {originalPrice && (
          <Text style={styles.originalPrice}>₹{originalPrice}</Text>
        )}
        {product.discount && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{product.discount}</Text>
          </View>
        )}
      </View>

      <Text style={styles.taxText}>inclusive of all taxes</Text>
    </View>
  );

  if (state.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff3f6c" />
        <Text style={styles.loadingText}>Loading product details...</Text>
      </View>
    );
  }

  if (state.error || !state.product) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Product not found</Text>
        <Text style={styles.errorText}>
          {state.error || "The product you're looking for doesn't exist"}
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={fetchProductData}
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

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={24} color="#333" />
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerActionButton}
            onPress={handleShare}
            activeOpacity={0.7}
          >
            <Share2 size={22} color="#333" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.headerActionButton,
              isWishlisted && styles.activeWishlistButton,
            ]}
            onPress={handleAddToWishlist}
            disabled={wishlistLoading}
            activeOpacity={0.7}
          >
            {wishlistLoading ? (
              <ActivityIndicator size={22} color="#ff3f6c" />
            ) : (
              <Heart
                size={22}
                color={isWishlisted ? "#ff3f6c" : "#333"}
                fill={isWishlisted ? "#ff3f6c" : "none"}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll} // ✅ NEW: Added scroll tracking
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#ff3f6c"]}
            tintColor="#ff3f6c"
          />
        }
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Image Gallery */}
          <ImageGallery
            images={state.product.images || []}
            onImagePress={(index) => setCurrentImageIndex(index)}
          />

          {/* Product Info */}
          <ProductInfo product={state.product} />

          {/* Size Selection */}
          {state.product.sizes && state.product.sizes.length > 0 && (
            <View style={styles.sizeSection}>
              <Text style={styles.sectionTitle}>Select Size</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.sizeGrid}>
                  {state.product.sizes.map((size) => (
                    <TouchableOpacity
                      key={size}
                      style={[
                        styles.sizeButton,
                        selectedSize === size && styles.selectedSizeButton,
                      ]}
                      onPress={() => setSelectedSize(size)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.sizeButtonText,
                          selectedSize === size && styles.selectedSizeButtonText,
                        ]}
                      >
                        {size}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Quantity Selection */}
          <View style={styles.quantitySection}>
            <Text style={styles.sectionTitle}>Quantity</Text>
            <View style={styles.quantityControls}>
              <TouchableOpacity
                style={[
                  styles.quantityButton,
                  quantity <= 1 && styles.disabledQuantityButton,
                ]}
                onPress={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
                activeOpacity={0.7}
              >
                <Minus size={16} color={quantity <= 1 ? "#ccc" : "#333"} />
              </TouchableOpacity>

              <Text style={styles.quantityText}>{quantity}</Text>

              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => setQuantity(quantity + 1)}
                activeOpacity={0.7}
              >
                <Plus size={16} color="#333" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Product Features */}
          <View style={styles.featuresSection}>
            {PRODUCT_FEATURES.map((feature, index) => (
              <View key={index} style={styles.featureItem}>
                {feature.icon}
                <Text style={styles.featureText}>{feature.text}</Text>
              </View>
            ))}
          </View>

          {/* Description */}
          <View style={styles.descriptionSection}>
            <Text style={styles.sectionTitle}>Product Details</Text>
            <Text
              style={styles.descriptionText}
              numberOfLines={showFullDescription ? undefined : 3}
            >
              {state.product.description || `${state.product.brand} ${state.product.name} - A premium quality product designed for comfort and style. Perfect for everyday wear with excellent durability and finish.`}
            </Text>
            <TouchableOpacity
              style={styles.readMoreButton}
              onPress={() => setShowFullDescription(!showFullDescription)}
              activeOpacity={0.7}
            >
              <Text style={styles.readMoreText}>
                {showFullDescription ? "Show Less" : "Read More"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ✅ NEW: AI-Powered Recommendation Carousel */}
          <YouMayAlsoLikeCarousel
            currentProductId={getProductId(state.product)}
            onProductPress={handleRecommendationProductPress}
            limit={6}
            style={styles.recommendationSection}
          />

          {/* Rating & Reviews */}
          {state.ratingBreakdown && (
            <View style={styles.reviewsSection}>
              <View style={styles.reviewsHeader}>
                <Text style={styles.sectionTitle}>Ratings & Reviews</Text>
                <TouchableOpacity
                  style={styles.seeAllButton}
                  onPress={() => setShowAllReviews(!showAllReviews)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.seeAllText}>
                    {showAllReviews ? "Show Less" : "See All"}
                  </Text>
                  <ChevronRight size={16} color="#ff3f6c" />
                </TouchableOpacity>
              </View>

              <View style={styles.overallRatingContainer}>
                <View style={styles.overallRatingLeft}>
                  <Text style={styles.overallRatingNumber}>
                    {averageRating.toFixed(1)}
                  </Text>
                  <RatingStars rating={averageRating} size={20} showRating={false} />
                  <Text style={styles.totalReviewsText}>
                    Based on {totalReviews} reviews
                  </Text>
                </View>
                <View style={styles.overallRatingRight}>
                  <RatingBreakdownComponent breakdown={state.ratingBreakdown} />
                </View>
              </View>
            </View>
          )}

          {/* Related Products */}
          {state.relatedProducts.length > 0 && (
            <View style={styles.relatedSection}>
              <Text style={styles.sectionTitle}>You Might Also Like</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.relatedGrid}>
                  {state.relatedProducts.map((product) => (
                    <TouchableOpacity
                      key={getProductId(product)}
                      style={styles.relatedProduct}
                      onPress={() => handleRelatedProductPress(product)}
                      activeOpacity={0.8}
                    >
                      <Image
                        source={{ uri: product.images?.[0] }}
                        style={styles.relatedProductImage}
                      />
                      <Text style={styles.relatedProductBrand} numberOfLines={1}>
                        {product.brand}
                      </Text>
                      <Text style={styles.relatedProductName} numberOfLines={2}>
                        {product.name}
                      </Text>
                      <View style={styles.relatedProductPrice}>
                        <Text style={styles.relatedProductPriceText}>
                          ₹{product.price}
                        </Text>
                        {product.rating && (
                          <RatingStars rating={product.rating} size={12} />
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Bottom Spacing */}
          <View style={{ height: 100 }} />
        </Animated.View>
      </ScrollView>

      {/* Fixed Bottom Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[
            styles.addToBagButton,
            (addToBagLoading || inBag) && styles.disabledButton,
          ]}
          onPress={handleAddToBag}
          disabled={addToBagLoading}
          activeOpacity={0.8}
        >
          {addToBagLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : inBag ? (
            <>
              <Check size={20} color="#fff" />
              <Text style={styles.addToBagButtonText}>Added to Bag</Text>
            </>
          ) : (
            <>
              <ShoppingBag size={20} color="#fff" />
              <Text style={styles.addToBagButtonText}>ADD TO BAG</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* ✅ NEW: Sweet Alert Component using your existing library */}
      <AwesomeAlert
        show={showSizeAlert}
        showProgress={false}
        title="Size Required"
        message="Please select your size before proceeding to add this item to your bag."
        closeOnTouchOutside={true}
        closeOnHardwareBackPress={false}
        showConfirmButton={true}
        confirmText="Got it!"
        confirmButtonColor="#ff3f6c"
        confirmButtonStyle={{
          paddingHorizontal: 24,
          paddingVertical: 12,
          borderRadius: 8,
        }}
        confirmButtonTextStyle={{
          fontSize: 16,
          fontWeight: '600',
        }}
        titleStyle={{
          fontSize: 20,
          fontWeight: '700',
          color: '#1e293b',
          marginBottom: 8,
        }}
        messageStyle={{
          fontSize: 16,
          color: '#64748b',
          textAlign: 'center',
          lineHeight: 22,
        }}
        contentContainerStyle={{
          borderRadius: 16,
          padding: 24,
        }}
        onConfirmPressed={() => setShowSizeAlert(false)}
        onDismiss={() => setShowSizeAlert(false)}
      />
    </View>
  );
}

// ✅ ALL YOUR EXISTING STYLES + NEW RECOMMENDATION SECTION STYLE
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafbfc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fafbfc',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fafbfc',
    paddingHorizontal: 24,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: '#ff3f6c',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#ff3f6c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    padding: 12,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerActionButton: {
    padding: 12,
    marginLeft: 8,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
  },
  activeWishlistButton: {
    backgroundColor: '#fef2f2',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#fff',
  },
  imageGalleryContainer: {
    position: 'relative',
    backgroundColor: '#fff',
  },
  imageContainer: {
    width: screenWidth,
    height: screenWidth * 1.1,
    backgroundColor: '#f8fafc',
  },
  productImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f8fafc',
  },
  imageIndicators: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  activeImageIndicator: {
    backgroundColor: '#fff',
    transform: [{ scale: 1.2 }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  imageCounter: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backdropFilter: 'blur(10px)',
  },
  imageCounterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  productInfoContainer: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  brandName: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 6,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  productName: {
    fontSize: 22,
    color: '#1e293b',
    fontWeight: '700',
    lineHeight: 28,
    marginBottom: 12,
  },
  ratingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  halfStarContainer: {
    position: 'relative',
  },
  halfStarMask: {
    position: 'absolute',
    top: 0,
    right: 0,
    overflow: 'hidden',
  },
  ratingText: {
    marginLeft: 8,
    color: '#475569',
    fontWeight: '600',
    fontSize: 14,
  },
  reviewCount: {
    marginLeft: 12,
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  priceSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  currentPrice: {
    fontSize: 28,
    color: '#1e293b',
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  originalPrice: {
    fontSize: 18,
    color: '#94a3b8',
    textDecorationLine: 'line-through',
    marginLeft: 12,
    fontWeight: '500',
  },
  discountBadge: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 12,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  discountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  taxText: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
    marginTop: 4,
  },
  sizeSection: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  sectionTitle: {
    fontSize: 18,
    color: '#1e293b',
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  sizeGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  sizeButton: {
    borderWidth: 2,
    borderColor: '#e2e8f0',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginRight: 12,
    marginBottom: 8,
    minWidth: 60,
    alignItems: 'center',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  selectedSizeButton: {
    borderColor: '#ff3f6c',
    backgroundColor: '#fef2f2',
    transform: [{ scale: 1.05 }],
  },
  sizeButtonText: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '600',
  },
  selectedSizeButtonText: {
    color: '#ff3f6c',
    fontWeight: '700',
  },
  quantitySection: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    borderWidth: 2,
    borderColor: '#e2e8f0',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  disabledQuantityButton: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
  },
  quantityText: {
    fontSize: 18,
    color: '#1e293b',
    fontWeight: '700',
    marginHorizontal: 24,
    minWidth: 40,
    textAlign: 'center',
  },
  featuresSection: {
    padding: 20,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  featureText: {
    fontSize: 14,
    color: '#475569',
    marginLeft: 12,
    flex: 1,
    fontWeight: '500',
    lineHeight: 20,
  },
  descriptionSection: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  descriptionText: {
    fontSize: 16,
    color: '#475569',
    lineHeight: 24,
    fontWeight: '400',
  },
  readMoreButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  readMoreText: {
    fontSize: 14,
    color: '#ff3f6c',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  // ✅ NEW: Recommendation section styling
  recommendationSection: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    marginBottom: 0,
  },
  reviewsSection: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  reviewsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  seeAllText: {
    fontSize: 14,
    color: '#ff3f6c',
    fontWeight: '600',
    marginRight: 4,
  },
  overallRatingContainer: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
  },
  overallRatingLeft: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 20,
  },
  overallRatingNumber: {
    fontSize: 52,
    color: '#1e293b',
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: -1,
  },
  totalReviewsText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 6,
    textAlign: 'center',
    fontWeight: '500',
  },
  overallRatingRight: {
    flex: 2,
  },
  ratingBreakdownContainer: {
    flex: 1,
  },
  ratingBreakdownTitle: {
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '700',
    marginBottom: 12,
  },
  ratingBreakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  ratingNumber: {
    fontSize: 14,
    color: '#475569',
    width: 16,
    fontWeight: '600',
  },
  ratingBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  ratingBarFill: {
    height: '100%',
    backgroundColor: '#fbbf24',
    borderRadius: 4,
  },
  ratingCount: {
    fontSize: 12,
    color: '#64748b',
    width: 35,
    textAlign: 'right',
    fontWeight: '500',
  },
  relatedSection: {
    padding: 20,
    backgroundColor: '#fff',
  },
  relatedGrid: {
    flexDirection: 'row',
    paddingHorizontal: 4,
  },
  relatedProduct: {
    width: 160,
    marginRight: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  relatedProductImage: {
    width: '100%',
    height: 190,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    marginBottom: 12,
  },
  relatedProductBrand: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  relatedProductName: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 8,
  },
  relatedProductPrice: {
    marginTop: 4,
  },
  relatedProductPriceText: {
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '700',
    marginBottom: 4,
  },
  bottomBar: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  addToBagButton: {
    backgroundColor: '#ff3f6c',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 12,
    shadowColor: '#ff3f6c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  disabledButton: {
    backgroundColor: '#94a3b8',
    shadowOpacity: 0,
  },
  addToBagButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
    letterSpacing: 0.5,
  },
});
