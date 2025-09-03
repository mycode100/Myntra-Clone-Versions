import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Animated,
  Dimensions,
  StatusBar,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Heart,
  Trash2,
  Star,
  ArrowRight,
  Grid3X3,
  List,
  Package,
  Sparkles,
  TrendingUp,
} from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { Product } from "@/types/product";

// ✅ UPDATED: Only import needed API functions
import {
  getUserWishlist,
  removeFromWishlist,
  handleApiError
} from "@/utils/api";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

// Responsive helpers
const isTablet = screenWidth >= 768;
const isLargeTablet = screenWidth >= 1024;

const getResponsiveValue = (phone: number, tablet: number, largeTablet?: number) => {
  if (isLargeTablet && largeTablet) return largeTablet;
  if (isTablet) return tablet;
  return phone;
};

const wp = (percentage: number) => (screenWidth * percentage) / 100;
const hp = (percentage: number) => (screenHeight * percentage) / 100;

// Types
interface WishlistItem {
  _id: string;
  userId: string;
  productId: Product;
  addedAt: string;
  priority: 'low' | 'medium' | 'high';
  notes: string;
  priceAlertEnabled: boolean;
  originalPrice: number;
  daysInWishlist: number;
}

interface WishlistState {
  items: WishlistItem[];
  stats: any;
  isLoading: boolean;
  refreshing: boolean;
  error: string | null;
}

type ViewMode = 'grid' | 'list';
type SortOption = 'newest' | 'oldest' | 'price_low' | 'price_high' | 'priority';

// ✅ Sort options configuration
const SORT_OPTIONS = [
  { label: 'Newest First', value: 'newest' as SortOption },
  { label: 'Oldest First', value: 'oldest' as SortOption },
  { label: 'Price: Low to High', value: 'price_low' as SortOption },
  { label: 'Price: High to Low', value: 'price_high' as SortOption },
  { label: 'Priority', value: 'priority' as SortOption },
];

export default function Wishlist() {
  const router = useRouter();
  
  // ✅ CLEANED: Only necessary AuthContext methods
  const { 
    user, 
    refreshUserPreferences,
    updateWishlistStatus,
    forceWishlistRefresh,
    wishlistRefreshTrigger,
  } = useAuth();

  // State
  const [state, setState] = useState<WishlistState>({
    items: [],
    stats: null,
    isLoading: false,
    refreshing: false,
    error: null,
  });

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [removingItems, setRemovingItems] = useState<Set<string>>(new Set());

  // ✅ Filter and sort state
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // Responsive calculations
  const itemWidth = viewMode === 'grid'
    ? (screenWidth - wp(6)) / getResponsiveValue(2, 3, 4) - wp(2)
    : screenWidth - wp(8);

  // Effects
  useEffect(() => {
    if (user) {
      fetchWishlist();
      initializeAnimations();
    }
  }, [user]);

  // ✅ Sort items when sortBy changes
  useEffect(() => {
    if (user && state.items.length > 0) {
      sortItems();
    }
  }, [sortBy]);

  // ✅ Listen to wishlist refresh triggers
  useEffect(() => {
    if (wishlistRefreshTrigger > 0) {
      console.log("🔄 Wishlist refresh trigger activated");
      fetchWishlist(false);
    }
  }, [wishlistRefreshTrigger]);

  // Animations
  const initializeAnimations = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const fetchWishlist = async (showLoading = true) => {
    if (!user) return;

    try {
      if (showLoading) {
        setState(prev => ({ ...prev, isLoading: true, error: null }));
      }
     
      const wishlistResponse = await getUserWishlist(user._id, {
        includeStats: true
      });

      if (wishlistResponse.success) {
        const items = Array.isArray(wishlistResponse.data) ? wishlistResponse.data : [];
       
        const stats = {
          totalItems: items.length,
          totalValue: items.reduce((sum: number, item: any) =>
            sum + (item.productId?.price || 0), 0),
          uniqueBrands: new Set(items.map((item: any) => item.productId?.brand)).size,
          priceAlertsEnabled: items.filter((item: any) => item.priceAlertEnabled).length,
        };

        setState(prev => ({
          ...prev,
          items: items.map((item: any) => ({
            ...item,
            originalPrice: item.originalPrice || item.productId?.price || 0,
            daysInWishlist: item.daysInWishlist ||
              Math.floor((Date.now() - new Date(item.addedAt).getTime()) / (1000 * 60 * 60 * 24)),
            priority: item.priority || 'medium',
            priceAlertEnabled: item.priceAlertEnabled || false,
            notes: item.notes || '',
          })),
          stats,
          isLoading: false,
          error: null,
        }));
      } else {
        const errorMessage = handleApiError(wishlistResponse.error);
        setState(prev => ({
          ...prev,
          error: errorMessage,
          isLoading: false,
          items: [],
        }));
      }
    } catch (error: any) {
      console.error("Error fetching wishlist:", error);
      setState(prev => ({
        ...prev,
        error: "Failed to load wishlist",
        isLoading: false,
        items: [],
      }));
    }
  };

  // ✅ Sort items functionality
  const sortItems = () => {
    setState(prev => ({
      ...prev,
      items: [...prev.items].sort((a, b) => {
        switch (sortBy) {
          case 'newest':
            return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
          case 'oldest':
            return new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime();
          case 'price_low':
            return a.productId.price - b.productId.price;
          case 'price_high':
            return b.productId.price - a.productId.price;
          case 'priority':
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
          default:
            return 0;
        }
      })
    }));
  };

  // ✅ Filter items by priority
  const filteredItems = useMemo(() => {
    if (selectedPriority === 'all') return state.items;
    return state.items.filter(item => item.priority === selectedPriority);
  }, [state.items, selectedPriority]);

  // ✅ SIMPLIFIED: Direct removal function
  const handleRemoveFromWishlist = async (item: WishlistItem) => {
    console.log("🗑️ Removing from wishlist:", item.productId.name);
    
    const productId = item.productId._id;
    const itemId = item._id;
    
    if (!productId || !user) {
      Alert.alert("Error", "Unable to remove item. Please try again.");
      return;
    }
    
    // Add to removing state
    setRemovingItems(prev => new Set([...prev, itemId]));
    
    try {
      const response = await removeFromWishlist(productId, user._id);
     
      if (response.success) {
        // Update local state immediately
        setState(prev => ({
          ...prev,
          items: prev.items.filter(wishlistItem => wishlistItem._id !== itemId),
          stats: prev.stats ? {
            ...prev.stats,
            totalItems: prev.stats.totalItems - 1,
            totalValue: prev.stats.totalValue - item.productId.price,
          } : null,
        }));
        
        // Update global state
        updateWishlistStatus(productId, null);
        
        // Refresh global preferences
        await refreshUserPreferences();
        forceWishlistRefresh();
        
      } else {
        const errorMessage = handleApiError(response.error);
        Alert.alert("Error", errorMessage || "Failed to remove from wishlist");
      }
    } catch (error: any) {
      console.error("Error removing from wishlist:", error);
      Alert.alert("Error", "Failed to remove item. Please try again.");
    } finally {
      setRemovingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  const onRefresh = async () => {
    setState(prev => ({ ...prev, refreshing: true }));
    await fetchWishlist(false);
    await refreshUserPreferences();
    setState(prev => ({ ...prev, refreshing: false }));
  };

  // ✅ Priority Badge Component
  const PriorityBadge: React.FC<{ priority: string }> = ({ priority }) => {
    const colors = {
      high: '#ff3f6c',
      medium: '#ffa500',
      low: '#666'
    };

    return (
      <View style={[styles.priorityBadge, { backgroundColor: colors[priority as keyof typeof colors] }]}>
        <Text style={styles.priorityText}>{priority.toUpperCase()}</Text>
      </View>
    );
  };

  // ✅ UPDATED: WishlistItemCard with only remove functionality
  const WishlistItemCard: React.FC<{
    item: WishlistItem;
    onRemove: () => void;
    isRemoving: boolean;
  }> = ({ item, onRemove, isRemoving }) => {
    const product = item.productId;
    const cardStyle = viewMode === 'grid' ? styles.gridCard : styles.listCard;
    const imageStyle = viewMode === 'grid' ? styles.gridImage : styles.listImage;
    const infoStyle = viewMode === 'grid' ? styles.gridInfo : styles.listInfo;

    // ✅ Better image fallback
    const imageUri = product.images?.[0] && product.images[0].trim() && !product.images[0].includes('via.placeholder.com')
      ? product.images[0] 
      : `https://picsum.photos/200/200?random=${product._id}`;

    // ✅ Price comparison logic
    const priceChanged = item.originalPrice !== product.price;
    const priceSavings = item.originalPrice - product.price;

    return (
      <Animated.View
        style={[
          cardStyle,
          { width: itemWidth },
          {
            opacity: isRemoving ? 0.5 : fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.productTouchable}
          onPress={() => router.push(`/product/${product._id}`)}
          activeOpacity={0.8}
          disabled={isRemoving}
        >
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: imageUri }}
              style={imageStyle}
              defaultSource={{ uri: `https://picsum.photos/200/200?random=${product._id}` }}
            />
           
            <View style={styles.productBadges}>
              {product.isNew && (
                <View style={styles.newBadge}>
                  <Text style={styles.badgeText}>NEW</Text>
                </View>
              )}
              {product.discount && (
                <View style={styles.discountBadge}>
                  <Text style={styles.badgeText}>{product.discount}</Text>
                </View>
              )}
              {priceChanged && priceSavings > 0 && (
                <View style={styles.priceDrop}>
                  <Text style={styles.badgeText}>↓₹{priceSavings}</Text>
                </View>
              )}
            </View>

            {/* Priority badge in top right */}
            <View style={styles.wishlistActions}>
              <PriorityBadge priority={item.priority} />
            </View>
          </View>

          <View style={infoStyle}>
            <Text style={styles.brandName} numberOfLines={1}>
              {product.brand}
            </Text>
            <Text style={styles.productName} numberOfLines={viewMode === 'grid' ? 2 : 1}>
              {product.name}
            </Text>
           
            <View style={styles.priceContainer}>
              <Text style={styles.price}>₹{product.price}</Text>
              {priceChanged && (
                <Text style={[
                  styles.originalPrice,
                  priceSavings > 0 ? styles.priceDown : styles.priceUp
                ]}>
                  ₹{item.originalPrice}
                </Text>
              )}
            </View>

            {product.rating && (
              <View style={styles.ratingContainer}>
                <Star size={12} color="#ffa500" fill="#ffa500" />
                <Text style={styles.ratingText}>{product.rating.toFixed(1)}</Text>
              </View>
            )}

            <View style={styles.itemMeta}>
              <Text style={styles.daysInWishlist}>
                Added {item.daysInWishlist} day{item.daysInWishlist !== 1 ? 's' : ''} ago
              </Text>
              {item.priceAlertEnabled && (
                <View style={styles.alertBadge}>
                  <Text style={styles.alertText}>🔔</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>

        {/* ✅ SIMPLIFIED: Only remove button */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.removeButton, isRemoving && styles.removeButtonDisabled]}
            onPress={onRemove}
            disabled={isRemoving}
            activeOpacity={0.7}
          >
            {isRemoving ? (
              <ActivityIndicator size="small" color="#ff3b30" />
            ) : (
              <>
                <Trash2 size={18} color="#ff3b30" />
                <Text style={styles.removeButtonText}>Remove</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  const EmptyWishlistState: React.FC = () => (
    <Animated.View
      style={[
        styles.emptyState,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.emptyIconContainer}>
        <Heart size={80} color="#ff3f6c" />
        <Sparkles size={32} color="#ffa500" style={styles.sparkleIcon} />
      </View>
      <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
      <Text style={styles.emptySubtitle}>
        Add items you love to your wishlist and never lose track of them
      </Text>
      <TouchableOpacity
        style={styles.browseButton}
        onPress={() => router.push("/(tabs)/categories")}
        activeOpacity={0.8}
      >
        <Package size={20} color="#fff" />
        <Text style={styles.browseButtonText}>Browse Products</Text>
        <ArrowRight size={16} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );

  const WishlistStats: React.FC = () => {
    if (!state.stats) return null;

    return (
      <Animated.View
        style={[
          styles.statsContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{state.stats.totalItems}</Text>
          <Text style={styles.statLabel}>Items</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>₹{state.stats.totalValue}</Text>
          <Text style={styles.statLabel}>Total Value</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{state.stats.uniqueBrands}</Text>
          <Text style={styles.statLabel}>Brands</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{state.stats.priceAlertsEnabled}</Text>
          <Text style={styles.statLabel}>Alerts</Text>
        </View>
      </Animated.View>
    );
  };

  // ✅ Filter Bar Component
  const FilterBar: React.FC = () => (
    <Animated.View
      style={[
        styles.filterBar,
        {
          opacity: fadeAnim,
        },
      ]}
    >
      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>Priority:</Text>
        <View style={styles.filterChips}>
          {['all', 'high', 'medium', 'low'].map((priority) => (
            <TouchableOpacity
              key={priority}
              style={[
                styles.filterChip,
                selectedPriority === priority && styles.activeFilterChip,
              ]}
              onPress={() => setSelectedPriority(priority)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.filterChipText,
                selectedPriority === priority && styles.activeFilterChipText,
              ]}>
                {priority === 'all' ? 'All' : priority.charAt(0).toUpperCase() + priority.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>Sort:</Text>
        <View style={styles.filterChips}>
          {SORT_OPTIONS.slice(0, 3).map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.filterChip,
                sortBy === option.value && styles.activeFilterChip,
              ]}
              onPress={() => setSortBy(option.value)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.filterChipText,
                sortBy === option.value && styles.activeFilterChipText,
              ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Animated.View>
  );

  // Login required state
  if (!user) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
       
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Wishlist</Text>
        </View>
       
        <View style={styles.emptyState}>
          <Heart size={80} color="#ff3f6c" />
          <Text style={styles.emptyTitle}>Please login to view your wishlist</Text>
          <Text style={styles.emptySubtitle}>
            Save your favorite items and access them anytime
          </Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push("/login")}
            activeOpacity={0.8}
          >
            <Text style={styles.loginButtonText}>LOGIN</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
     
      {/* Enhanced Header */}
      <Animated.View
        style={[
          styles.header,
          {
            opacity: fadeAnim,
          }
        ]}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Wishlist</Text>
          {filteredItems.length > 0 && (
            <View style={styles.itemCount}>
              <Text style={styles.itemCountText}>{filteredItems.length}</Text>
            </View>
          )}
        </View>
       
        {state.items.length > 0 && (
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.viewModeButton, viewMode === 'grid' && styles.activeViewMode]}
              onPress={() => setViewMode('grid')}
              activeOpacity={0.7}
            >
              <Grid3X3 size={18} color={viewMode === 'grid' ? "#ff3f6c" : "#666"} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewModeButton, viewMode === 'list' && styles.activeViewMode]}
              onPress={() => setViewMode('list')}
              activeOpacity={0.7}
            >
              <List size={18} color={viewMode === 'list' ? "#ff3f6c" : "#666"} />
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>

      {/* Content */}
      {state.isLoading && state.items.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ff3f6c" />
          <Text style={styles.loadingText}>Loading your wishlist...</Text>
        </View>
      ) : state.error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorText}>{state.error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => fetchWishlist()}
            activeOpacity={0.8}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : state.items.length === 0 ? (
        <EmptyWishlistState />
      ) : (
        <>
          <WishlistStats />
          <FilterBar />

          <FlatList
            data={filteredItems} 
            keyExtractor={(item) => item._id}
            numColumns={viewMode === 'grid' ? getResponsiveValue(2, 3, 4) : 1}
            key={`${viewMode}-${getResponsiveValue(2, 3, 4)}`}
            renderItem={({ item }) => (
              <WishlistItemCard
                item={item}
                onRemove={() => handleRemoveFromWishlist(item)}
                isRemoving={removingItems.has(item._id)}
              />
            )}
            contentContainerStyle={[
              styles.listContainer,
              viewMode === 'list' && styles.listModeContainer,
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
            ItemSeparatorComponent={() =>
              viewMode === 'list' ? <View style={styles.listSeparator} /> : null
            }
          />
        </>
      )}
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
    fontWeight: '500',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: hp(6),
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  itemCount: {
    backgroundColor: '#ff3f6c',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  itemCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    padding: 2,
  },
  viewModeButton: {
    padding: 8,
    borderRadius: 4,
  },
  activeViewMode: {
    backgroundColor: '#fff',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#f8f9fa',
    paddingVertical: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ff3f6c',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  filterBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterSection: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  activeFilterChip: {
    backgroundColor: '#ff3f6c',
    borderColor: '#ff3f6c',
  },
  filterChipText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  activeFilterChipText: {
    color: '#fff',
  },
  listContainer: {
    padding: 16,
  },
  listModeContainer: {
    paddingHorizontal: 16,
  },
  gridCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: 'hidden',
  },
  listCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: 'hidden',
  },
  productTouchable: {
    flex: 1,
  },
  imageContainer: {
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#f8f9fa',
  },
  listImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#f8f9fa',
  },
  productBadges: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'column',
  },
  newBadge: {
    backgroundColor: '#4caf50',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  discountBadge: {
    backgroundColor: '#ff3f6c',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  priceDrop: {
    backgroundColor: '#4caf50',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '600',
  },
  wishlistActions: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  priorityText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '600',
  },
  gridInfo: {
    padding: 12,
    paddingBottom: 0,
  },
  listInfo: {
    padding: 12,
    paddingBottom: 0,
  },
  brandName: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    marginBottom: 2,
  },
  productName: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 6,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  price: {
    fontSize: 16,
    color: '#333',
    fontWeight: '700',
  },
  originalPrice: {
    fontSize: 12,
    marginLeft: 6,
    textDecorationLine: 'line-through',
  },
  priceDown: {
    color: '#4caf50',
  },
  priceUp: {
    color: '#ff6b6b',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingText: {
    marginLeft: 4,
    color: '#666',
    fontWeight: '500',
    fontSize: 12,
  },
  itemMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  daysInWishlist: {
    fontSize: 10,
    color: '#999',
  },
  alertBadge: {
    backgroundColor: '#ffa500',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  alertText: {
    fontSize: 8,
  },
  // ✅ SIMPLIFIED: Only remove button styles
  actionButtons: {
    padding: 12,
    paddingTop: 8,
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
  },
  removeButtonDisabled: {
    opacity: 0.5,
    backgroundColor: '#f5f5f5',
    borderColor: '#e5e5e5',
  },
  removeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
    color: '#ff3b30',
  },
  listSeparator: {
    height: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  sparkleIcon: {
    position: 'absolute',
    top: -10,
    right: -10,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  browseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff3f6c',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  browseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 8,
  },
  loginButton: {
    backgroundColor: '#ff3f6c',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 10,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
