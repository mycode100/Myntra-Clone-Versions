import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  StatusBar,
  Dimensions,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import {
  ShoppingBag,
  Minus,
  Plus,
  Trash2,
  Star,
  ArrowRight,
  ShoppingCart,
  Tag,
  CheckCircle2,
  XCircle,
  Gift,
} from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { BagItem, WishlistItem, ApiResponse, Address } from "@/types/product"; // ✅ Added Address import
import {
  getUserBag,
  updateBagItemQuantity,
  removeBagItem,
  addToWishlist,
  handleApiError,
  applyCoupon,
  removeCoupon,
  getAvailableCoupons,
  getThresholdSuggestions,
  validateAppliedCoupon,
} from "@/utils/api";

// ✅ Import coupon components
import CouponOverlay from "@/components/CouponOverlay";
import CouponThresholdMessage from "@/components/CouponThresholdMessage";

// ✅ NEW: Import address and order overlays
import AddressSelectionOverlay from "@/components/AddressSelectionOverlay";
import AddressManagementOverlay from "@/components/AddressManagementOverlay";
import OrderPreviewOverlay from "@/components/OrderPreviewOverlay";

const { width: screenWidth } = Dimensions.get("window");

interface BagTotals {
  itemCount: number;
  subtotal: number;
  shipping: number;
  tax: number;
  finalTotal: number;
  couponDiscount: number;
}

interface CouponState {
  code: string;
  isApplied: boolean;
  discountAmount: number;
  message: string;
  isLoading: boolean;
  error: string | null;
}

interface CouponData {
  availableCoupons: any[];
  expiredCoupons: any[];
  cartTotal: number;
}

interface ThresholdSuggestion {
  coupon: any;
  amountNeeded: number;
  potentialSavings: number;
}

export default function Bag() {
  const router = useRouter();
  const {
    user,
    refreshUserPreferences,
    updateBagStatus,
    updateWishlistStatus,
    bagRefreshTrigger,
    addresses,
    defaultAddressId,
  } = useAuth();

  const [bagItems, setBagItems] = useState<BagItem[]>([]);
  const [totals, setTotals] = useState<BagTotals>({
    itemCount: 0,
    subtotal: 0,
    shipping: 0,
    tax: 0,
    finalTotal: 0,
    couponDiscount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set());
  const [deletingItems, setDeletingItems] = useState<Set<string>>(new Set());
  
  const [coupon, setCoupon] = useState<CouponState>({
    code: "",
    isApplied: false,
    discountAmount: 0,
    message: "",
    isLoading: false,
    error: null,
  });

  const [showCouponOverlay, setShowCouponOverlay] = useState(false);
  const [couponData, setCouponData] = useState<CouponData>({
    availableCoupons: [],
    expiredCoupons: [],
    cartTotal: 0,
  });
  const [thresholdSuggestion, setThresholdSuggestion] = useState<ThresholdSuggestion | null>(null);
  const [loadingCoupons, setLoadingCoupons] = useState(false);
  const [loadingThreshold, setLoadingThreshold] = useState(false);

  // ✅ NEW: Address and order overlay states
  const [showAddressSelection, setShowAddressSelection] = useState(false);
  const [showAddressManagement, setShowAddressManagement] = useState(false);
  const [showOrderPreview, setShowOrderPreview] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null); // ✅ NEW: State for editing address

  // ✅ Get selected address
  const selectedAddress = defaultAddressId && addresses.has(defaultAddressId) 
    ? addresses.get(defaultAddressId) 
    : Array.from(addresses.values()).find(addr => addr.isDefault) || null;

  useEffect(() => {
    if (user) {
      fetchBagData();
    }
  }, [user, bagRefreshTrigger]);

  useEffect(() => {
    if (user && totals.subtotal > 0) {
      fetchThresholdSuggestions();
    }
  }, [user, totals.subtotal]);

  useEffect(() => {
    if (user && coupon.isApplied && totals.subtotal > 0) {
      validateCurrentCoupon();
    }
  }, [user, totals.subtotal, bagItems.length]);

  // ✅ FIXED: fetchBagData with type assertions
  const fetchBagData = async (showLoading = true) => {
    if (!user?._id) {
      console.log("No user found, skipping bag fetch");
      return;
    }

    try {
      if (showLoading) setLoading(true);

      const response = await getUserBag(user._id);

      if (response?.success && response?.data) {
        const bagData = response.data ?? [];
        setBagItems(bagData);

        // ✅ FIXED: Use type assertion for safe property access
        const responseTotals = (response as any).totals || {};
        setTotals({
          itemCount: responseTotals.itemCount ?? 0,
          subtotal: responseTotals.subtotal ?? 0,
          shipping: responseTotals.shipping ?? 0,
          tax: responseTotals.tax ?? 0,
          finalTotal: responseTotals.finalTotal ?? 0,
          couponDiscount: responseTotals.couponDiscount ?? 0,
        });
        
        // ✅ FIXED: Use type assertion for alerts and coupon data
        const alerts = (response as any).alerts || {};
        const couponInfo = (response as any).coupon || {};
        
        if (alerts.couponApplied) {
          setCoupon(prev => ({
            ...prev,
            isApplied: true,
            discountAmount: responseTotals.couponDiscount ?? 0,
            message: couponInfo.message ?? "Coupon applied!",
            error: null,
            code: couponInfo.code ?? ""
          }));
        } else {
          setCoupon(prev => ({
            ...prev,
            isApplied: false,
            discountAmount: 0,
            message: "",
            error: null,
            code: "",
          }));
        }
      } else {
        setBagItems([]);
        setTotals({
          itemCount: 0,
          subtotal: 0,
          shipping: 0,
          tax: 0,
          finalTotal: 0,
          couponDiscount: 0,
        });
        setCoupon({
          code: "",
          isApplied: false,
          discountAmount: 0,
          message: "",
          isLoading: false,
          error: null,
        });
        
        if (response?.error) {
          Alert.alert("Error", handleApiError(response.error) || "Failed to load bag");
        }
      }
    } catch (error: any) {
      console.error("Error fetching bag:", error);
      Alert.alert("Error", "Failed to load your bag. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ✅ FIXED: fetchAvailableCoupons with type assertion
  const fetchAvailableCoupons = async () => {
    if (!user?._id) return;

    try {
      setLoadingCoupons(true);
      const response = await getAvailableCoupons(user._id);

      if (response?.success && response?.data) {
        const data = (response as any).data;
        setCouponData({
          availableCoupons: data.availableCoupons ?? [],
          expiredCoupons: data.expiredCoupons ?? [],
          cartTotal: data.cartTotal ?? totals.subtotal,
        });
      } else {
        console.error("Failed to fetch available coupons:", response?.error);
      }
    } catch (error) {
      console.error("Error fetching available coupons:", error);
    } finally {
      setLoadingCoupons(false);
    }
  };

  // ✅ FIXED: fetchThresholdSuggestions with type assertion
  const fetchThresholdSuggestions = async () => {
    if (!user?._id) return;

    try {
      setLoadingThreshold(true);
      const response = await getThresholdSuggestions(user._id);

      if (response?.success && response?.data) {
        const data = (response as any).data;
        setThresholdSuggestion(data.suggestion ?? null);
      } else {
        setThresholdSuggestion(null);
      }
    } catch (error) {
      console.error("Error fetching threshold suggestions:", error);
      setThresholdSuggestion(null);
    } finally {
      setLoadingThreshold(false);
    }
  };

  // ✅ FIXED: validateCurrentCoupon with type assertion
  const validateCurrentCoupon = async () => {
    if (!user?._id || !coupon.isApplied) return;

    try {
      const response = await validateAppliedCoupon(user._id);

      if (response?.success && response?.data) {
        const validationData = (response as any).data;
        if (!validationData.isValid && validationData.shouldRemove) {
          setCoupon(prev => ({
            ...prev,
            isApplied: false,
            discountAmount: 0,
            message: "",
            code: "",
            error: `Coupon removed: ${validationData.reason ?? 'Invalid coupon'}`,
          }));
          
          Alert.alert(
            "Coupon Removed",
            validationData.reason ?? "Your coupon is no longer valid for this cart.",
            [{ text: "OK" }]
          );

          await fetchBagData(false);
        }
      }
    } catch (error) {
      console.error("Error validating applied coupon:", error);
    }
  };

  const updateQuantity = async (itemId: string, newQuantity: number) => {
    if (!user?._id) return;
    if (newQuantity < 1 || newQuantity > 10) return;

    setUpdatingItems(prev => new Set([...prev, itemId]));

    try {
      const response = await updateBagItemQuantity(itemId, newQuantity);
      if (response?.success) {
        await refreshUserPreferences?.();
      } else {
        Alert.alert("Error", handleApiError(response?.error) || "Failed to update quantity");
      }
    } catch (error) {
      console.error("Error updating quantity:", error);
      Alert.alert("Error", "Failed to update quantity. Please try again.");
    } finally {
      setUpdatingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  const removeItem = async (itemId: string, productId: string, productName: string) => {
    console.log("🗑️ Removing item:", itemId, productName);
    
    setDeletingItems(prev => new Set([...prev, itemId]));
    
    try {
      const response = await removeBagItem(itemId);
      console.log("🗑️ Remove API response:", response);
      
      if (response?.success) {
        updateBagStatus?.(productId, null);
        await refreshUserPreferences?.();
        console.log("✅ Item removed successfully");
      } else {
        console.error("❌ Failed to remove item:", response?.error);
        Alert.alert("Error", handleApiError(response?.error) || "Failed to remove item");
      }
    } catch (error) {
      console.error("❌ Error removing item:", error);
      Alert.alert("Error", "Failed to remove item. Please try again.");
    } finally {
      setDeletingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBagData(false);
    await refreshUserPreferences?.();
    
    if (showCouponOverlay) {
      await fetchAvailableCoupons();
    }
    await fetchThresholdSuggestions();
    
    setRefreshing(false);
  };

  // ✅ UPDATED: Enhanced checkout handler with overlays
  const handleCheckout = () => {
    if (bagItems.length === 0) {
      Alert.alert(
        "Empty Bag", 
        "Your bag is empty. Add items to your bag before checkout.",
        [
          { text: "Start Shopping", onPress: () => router.push("/(tabs)/categories") },
          { text: "OK", style: "cancel" }
        ]
      );
      return;
    }

    // Show order preview overlay
    setShowOrderPreview(true);
  };

  // ✅ NEW: Handle address selection for checkout
  const handleAddressSelection = () => {
    setShowOrderPreview(false);
    setShowAddressSelection(true);
  };

  // ✅ NEW: Handle address management
  const handleAddressManagement = () => {
    setShowAddressSelection(false);
    setEditingAddress(null); // ✅ Clear editing address for new address
    setShowAddressManagement(true);
  };

  // ✅ NEW: Handle edit address
  const handleEditAddress = (address: Address) => {
    // Close address selection overlay
    setShowAddressSelection(false);
    
    // Set the address to edit and open address management overlay
    setEditingAddress(address);
    setShowAddressManagement(true);
  };

  // ✅ NEW: Handle address selection from overlay
  const handleSelectAddress = (addressId: string) => {
    // Address selection is handled by AuthContext automatically
    setShowAddressSelection(false);
    setShowOrderPreview(true); // Return to order preview
  };

  // ✅ NEW: Handle order placement
  const handlePlaceOrder = async () => {
    if (!user || bagItems.length === 0 || !selectedAddress) {
      Alert.alert("Error", "Unable to place order. Please check your bag and address.");
      return;
    }

    try {
      // Here you would call your order placement API
      // For now, we'll simulate order placement
      
      // Simulate order processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Clear bag after successful order
      setBagItems([]);
      setTotals({
        itemCount: 0,
        subtotal: 0,
        shipping: 0,
        tax: 0,
        finalTotal: 0,
        couponDiscount: 0,
      });
      
      // Close overlay and navigate
      setShowOrderPreview(false);
      
      Alert.alert(
        "Order Placed Successfully! 🎉",
        "Your order has been confirmed. You will receive a confirmation email shortly.",
        [
          { text: "View Orders", onPress: () => router.push("/orders") },
          { text: "Continue Shopping", onPress: () =>  router.push("/(tabs)")}
        ]
      );
      
    } catch (error) {
      console.error("Error placing order:", error);
      throw error; // Let OrderPreviewOverlay handle the error
    }
  };

  const handleApplyCoupon = async () => {
    if (!user?._id || coupon.code.length < 3) {
      Alert.alert("Invalid Input", "Please enter a valid coupon code.");
      return;
    }
    if (coupon.isLoading) return;

    try {
      setCoupon(prev => ({ ...prev, isLoading: true, error: null, message: "" }));
      const response = await applyCoupon(user._id, coupon.code);
      if (response?.success) {
        Alert.alert("Coupon Applied!", "Your discount has been applied.");
        await refreshUserPreferences?.();
        await fetchThresholdSuggestions();
      } else {
        setCoupon(prev => ({ ...prev, error: handleApiError(response?.error) || "Failed to apply coupon." }));
      }
    } catch (error) {
      console.error("Error applying coupon:", error);
      setCoupon(prev => ({ ...prev, error: "Failed to apply coupon. Please try again." }));
    } finally {
      setCoupon(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleRemoveCoupon = async () => {
    if (!user?._id || coupon.isLoading) return;
    try {
      setCoupon(prev => ({ ...prev, isLoading: true, error: null, message: "" }));
      const response = await removeCoupon(user._id);
      if (response?.success) {
        Alert.alert("Coupon Removed", "Your coupon has been removed.");
        await refreshUserPreferences?.();
        await fetchThresholdSuggestions();
      } else {
        setCoupon(prev => ({ ...prev, error: handleApiError(response?.error) || "Failed to remove coupon." }));
      }
    } catch (error) {
      console.error("Error removing coupon:", error);
      setCoupon(prev => ({ ...prev, error: "Failed to remove coupon. Please try again." }));
    } finally {
      setCoupon(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleViewCoupons = async () => {
    await fetchAvailableCoupons();
    setShowCouponOverlay(true);
  };

  const handleApplyCouponFromOverlay = async (couponCode: string) => {
    if (!user?._id) return;

    setCoupon(prev => ({ ...prev, code: couponCode }));
    setShowCouponOverlay(false);
    
    try {
      setCoupon(prev => ({ ...prev, isLoading: true, error: null, message: "" }));
      const response = await applyCoupon(user._id, couponCode);
      if (response?.success) {
        Alert.alert("Coupon Applied!", "Your discount has been applied.");
        await refreshUserPreferences?.();
        await fetchThresholdSuggestions();
      } else {
        setCoupon(prev => ({ ...prev, error: handleApiError(response?.error) || "Failed to apply coupon." }));
      }
    } catch (error) {
      console.error("Error applying coupon from overlay:", error);
      setCoupon(prev => ({ ...prev, error: "Failed to apply coupon. Please try again." }));
    } finally {
      setCoupon(prev => ({ ...prev, isLoading: false }));
    }
  };

  const RatingDisplay = ({ rating }: { rating?: number }) => {
    if (!rating) return null;
    return (
      <View style={styles.ratingContainer}>
        <Star size={12} color="#ffa500" fill="#ffa500" />
        <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
      </View>
    );
  };

  const BagItemCard = ({ item }: { item: BagItem }) => {
    const isUpdating = updatingItems.has(item._id);
    const isDeleting = deletingItems.has(item._id);
    const price = item.productId.price;

    const handleDeletePress = () => {
      console.log("🔍 Delete button clicked for:", item.productId.name);
      removeItem(item._id, item.productId._id, item.productId.name);
    };

    return (
      <View style={styles.itemCard}>
        <TouchableOpacity
          style={styles.itemContent}
          onPress={() => router.push(`/product/${item.productId._id}`)}
          activeOpacity={0.8}
        >
          <Image
            source={{ uri: item.productId.images?.[0] || "https://via.placeholder.com/80" }}
            style={styles.itemImage}
          />
          <View style={styles.itemInfo}>
            <Text style={styles.brandName}>{item.productId.brand}</Text>
            <Text style={styles.productName} numberOfLines={2}>
              {item.productId.name}
            </Text>
            {(item.size || item.color) && (
              <View style={styles.variations}>
                {item.size && <Text style={styles.variationText}>Size: {item.size}</Text>}
                {item.color && <Text style={styles.variationText}>Color: {item.color}</Text>}
              </View>
            )}
            <Text style={styles.price}>₹{price}</Text>
            <RatingDisplay rating={item.productId.rating} />
          </View>
        </TouchableOpacity>
        
        <View style={styles.quantitySection}>
          <View style={styles.quantityControls}>
            <TouchableOpacity
              style={[styles.quantityButton, item.quantity <= 1 && styles.quantityButtonDisabled]}
              onPress={() => updateQuantity(item._id, item.quantity - 1)}
              disabled={item.quantity <= 1 || isUpdating || isDeleting}
            >
              <Minus size={16} color={item.quantity <= 1 ? "#ccc" : "#666"} />
            </TouchableOpacity>
            <View style={styles.quantityDisplay}>
              {isUpdating ? (
                <ActivityIndicator size="small" color="#ff3f6c" />
              ) : (
                <Text style={styles.quantityText}>{item.quantity}</Text>
              )}
            </View>
            <TouchableOpacity
              style={[styles.quantityButton, item.quantity >= 10 && styles.quantityButtonDisabled]}
              onPress={() => updateQuantity(item._id, item.quantity + 1)}
              disabled={item.quantity >= 10 || isUpdating || isDeleting}
            >
              <Plus size={16} color={item.quantity >= 10 ? "#ccc" : "#666"} />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity
            style={[
              styles.deleteButton,
              (isDeleting || isUpdating) && styles.deleteButtonDisabled
            ]}
            onPress={handleDeletePress}
            activeOpacity={0.7}
            disabled={isDeleting || isUpdating}
          >
            {isDeleting ? (
              <ActivityIndicator size={18} color="#ff3b30" />
            ) : (
              <Trash2 size={18} color="#ff3b30" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const EmptyBagState = () => (
    <View style={styles.emptyState}>
      <ShoppingBag size={80} color="#ff3f6c" />
      <Text style={styles.emptyTitle}>Your bag is empty</Text>
      <Text style={styles.emptySubtitle}>Add items to start shopping</Text>
      <TouchableOpacity
        style={styles.shopButton}
        onPress={() => router.push("/(tabs)/categories")}
      >
        <ShoppingCart size={20} color="#fff" />
        <Text style={styles.shopButtonText}>Start Shopping</Text>
      </TouchableOpacity>
    </View>
  );

  if (!user) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.emptyState}>
          <ShoppingBag size={80} color="#ff3f6c" />
          <Text style={styles.emptyTitle}>Please login to view your bag</Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push("/login")}
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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Shopping Bag</Text>
        {bagItems.length > 0 && (
          <View style={styles.itemCount}>
            <Text style={styles.itemCountText}>{bagItems.length}</Text>
          </View>
        )}
      </View>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ff3f6c" />
          <Text style={styles.loadingText}>Loading your bag...</Text>
        </View>
      ) : bagItems.length === 0 ? (
        <EmptyBagState />
      ) : (
        <View style={styles.contentContainer}>
          <ScrollView
            style={styles.scrollContainer}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={["#ff3f6c"]}
                tintColor="#ff3f6c"
              />
            }
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ✅ Threshold Message at the top */}
            <CouponThresholdMessage
              currentTotal={totals.subtotal}
              suggestion={thresholdSuggestion}
              onPressViewCoupons={handleViewCoupons}
              loading={loadingThreshold}
            />

            {/* ✅ Shipping banner */}
            {totals.subtotal > 0 && totals.subtotal < 499 && (
              <View style={styles.shippingBanner}>
                <Text style={styles.shippingBannerText}>
                  Add ₹{499 - totals.subtotal} more for FREE shipping! 🚚
                </Text>
              </View>
            )}
            
            {/* ✅ Items section */}
            <View style={styles.itemsSection}>
              {bagItems.map((item) => (
                <BagItemCard key={item._id} item={item} />
              ))}
            </View>
            
            {/* ✅ Enhanced Coupon section */}
            <View style={styles.couponSection}>
              <View style={styles.couponHeader}>
                <Tag size={20} color="#666" />
                <Text style={styles.couponTitle}>Apply Coupon</Text>
              </View>

              {/* ✅ View & Apply Coupons Button */}
              <TouchableOpacity
                style={styles.viewCouponsButton}
                onPress={handleViewCoupons}
                activeOpacity={0.8}
              >
                <Gift size={16} color="#ff3f6c" />
                <Text style={styles.viewCouponsText}>View & Apply Coupons</Text>
                <ArrowRight size={16} color="#ff3f6c" />
              </TouchableOpacity>

              {/* ✅ Original coupon input/display */}
              {!coupon.isApplied ? (
                <>
                  <View style={styles.couponInputContainer}>
                    <TextInput
                      style={styles.couponInput}
                      placeholder="Enter coupon code"
                      placeholderTextColor="#999"
                      value={coupon.code}
                      onChangeText={text => setCoupon(prev => ({ ...prev, code: text }))}
                      autoCapitalize="characters"
                    />
                    <TouchableOpacity
                      style={styles.couponButton}
                      onPress={handleApplyCoupon}
                      disabled={coupon.isLoading}
                    >
                      {coupon.isLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.couponButtonText}>APPLY</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                  {coupon.error && (
                    <View style={styles.couponMessageRow}>
                      <XCircle size={14} color="#ff3f6c" />
                      <Text style={styles.couponErrorText}>{coupon.error}</Text>
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.couponAppliedContainer}>
                  <View style={styles.couponMessageRow}>
                    <CheckCircle2 size={16} color="#4caf50" />
                    <Text style={styles.couponSuccessText}>{coupon.message}</Text>
                  </View>
                  <TouchableOpacity onPress={handleRemoveCoupon} disabled={coupon.isLoading}>
                    {coupon.isLoading ? (
                      <ActivityIndicator size="small" color="#ff3f6c" />
                    ) : (
                      <Text style={styles.removeCouponText}>REMOVE</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
            
            <View style={{ height: 200 }} />
          </ScrollView>
          
          {/* ✅ UPDATED: Checkout section with enhanced button */}
          <View style={styles.checkoutSection}>
            <View style={styles.orderSummary}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal ({totals.itemCount} items)</Text>
                <Text style={styles.summaryValue}>₹{totals.subtotal}</Text>
              </View>
              {totals.couponDiscount > 0 && (
                <View style={[styles.summaryRow, styles.discountRow]}>
                  <Text style={styles.summaryLabel}>Coupon Discount</Text>
                  <Text style={styles.discountValue}>- ₹{totals.couponDiscount}</Text>
                </View>
              )}
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Shipping</Text>
                <Text style={[styles.summaryValue, totals.shipping === 0 && { color: "#4caf50" }]}>
                  {totals.shipping === 0 ? "FREE" : `₹${totals.shipping}`}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Tax</Text>
                <Text style={styles.summaryValue}>₹{totals.tax}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>₹{totals.finalTotal}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.checkoutButton}
              onPress={handleCheckout}
              activeOpacity={0.8}
            >
              <Text style={styles.checkoutButtonText}>
                CHECKOUT • ₹{totals.finalTotal}
              </Text>
              <ArrowRight size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ✅ Coupon Overlay */}
      <CouponOverlay
        visible={showCouponOverlay}
        onClose={() => setShowCouponOverlay(false)}
        onApplyCoupon={handleApplyCouponFromOverlay}
        coupons={couponData.availableCoupons}
        expiredCoupons={couponData.expiredCoupons}
        loading={loadingCoupons}
        currentTotal={totals.subtotal}
        appliedCouponCode={coupon.isApplied ? coupon.code : undefined}
      />

      {/* ✅ NEW: Order Preview Overlay */}
      <OrderPreviewOverlay
        visible={showOrderPreview}
        onClose={() => setShowOrderPreview(false)}
        onEditAddress={handleAddressSelection}
        onPlaceOrder={handlePlaceOrder}
        selectedAddress={selectedAddress}
      />

      {/* ✅ FIXED: Address Selection Overlay with onEditAddress prop */}
      <AddressSelectionOverlay
        visible={showAddressSelection}
        onClose={() => {
          setShowAddressSelection(false);
          setShowOrderPreview(true); // Return to order preview
        }}
        onSelectAddress={handleSelectAddress}
        onAddNewAddress={handleAddressManagement}
        onEditAddress={handleEditAddress} // ✅ NOW INCLUDED
      />

      {/* ✅ FIXED: Address Management Overlay with editingAddress */}
      <AddressManagementOverlay
        visible={showAddressManagement}
        onClose={() => {
          setShowAddressManagement(false);
          setEditingAddress(null); // ✅ Clear editing address when closing
          setShowOrderPreview(true); // Return to order preview
        }}
        editingAddress={editingAddress} // ✅ Pass the address to edit
        onSuccess={() => {
          setShowAddressManagement(false);
          setEditingAddress(null); // ✅ Clear editing address after success
          setShowOrderPreview(true); // Return to order preview with updated address
        }}
      />
    </View>
  );
}

// ✅ Styles remain the same as your original code
const styles = StyleSheet.create({
  // ... [All your existing styles remain exactly the same]
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  contentContainer: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  shippingBanner: {
    backgroundColor: '#e8f5e8',
    margin: 16,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4caf50',
  },
  shippingBannerText: {
    fontSize: 14,
    color: '#2e7d32',
    fontWeight: '600',
    textAlign: 'center',
  },
  itemsSection: {
    paddingHorizontal: 16,
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemContent: {
    flexDirection: 'row',
    padding: 16,
  },
  itemImage: {
    width: 80,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 16,
  },
  brandName: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  productName: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    marginVertical: 4,
    lineHeight: 18,
  },
  variations: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  variationText: {
    fontSize: 10,
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  price: {
    fontSize: 16,
    color: '#333',
    fontWeight: '700',
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  quantitySection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  quantityButton: {
    padding: 8,
  },
  quantityButtonDisabled: {
    opacity: 0.3,
  },
  quantityDisplay: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 40,
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  deleteButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    marginLeft: 16,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonDisabled: {
    opacity: 0.5,
    backgroundColor: '#f5f5f5',
    borderColor: '#e5e5e5',
  },
  checkoutSection: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    paddingTop: 8,
  },
  orderSummary: {
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ff3f6c',
  },
  checkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff3f6c',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 16,
    borderRadius: 8,
  },
  checkoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginRight: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  shopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff3f6c',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  shopButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  loginButton: {
    backgroundColor: '#ff3f6c',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  couponSection: {
    marginHorizontal: 16,
    marginTop: 20,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  couponHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  couponTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginLeft: 8,
  },
  couponInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  couponInput: {
    flex: 1,
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  couponButton: {
    backgroundColor: '#ff3f6c',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginLeft: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  couponButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  couponMessageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  couponSuccessText: {
    fontSize: 14,
    color: '#4caf50',
    fontWeight: '600',
    marginLeft: 6,
  },
  couponErrorText: {
    fontSize: 14,
    color: '#ff3f6c',
    fontWeight: '600',
    marginLeft: 6,
  },
  couponAppliedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  removeCouponText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ff3f6c',
    textDecorationLine: 'underline',
  },
  discountRow: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    marginTop: 8,
    paddingTop: 8,
  },
  discountValue: {
    color: '#4caf50',
    fontSize: 14,
    fontWeight: '500',
  },
  viewCouponsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff4f6',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffcdd2',
    marginBottom: 12,
  },
  viewCouponsText: {
    marginLeft: 8,
    marginRight: 'auto',
    fontSize: 14,
    color: '#ff3f6c',
    fontWeight: '600',
  },
});
