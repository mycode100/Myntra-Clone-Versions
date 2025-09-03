import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Dimensions,
  StatusBar,
  Animated,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Package,
  ChevronRight,
  MapPin,
  Truck,
  Clock,
  Calendar,
  CreditCard,
  ArrowLeft,
  Filter,
  Search,
  Star,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Eye,
  Download,
  Phone,
  MessageCircle,
  Navigation,
} from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { Product } from "@/types/product";

// ✅ UPDATED: Import centralized API functions
import {
  getUserOrders,
  cancelOrder,
  getOrderById,
  trackOrder,
  handleApiError
} from "@/utils/api";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

// Responsive helpers
const isTablet = screenWidth >= 768;
const wp = (percentage: number) => (screenWidth * percentage) / 100;
const hp = (percentage: number) => (screenHeight * percentage) / 100;

// Types (keeping all existing types unchanged)
interface OrderItem {
  _id: string;
  productId: Product;
  productSnapshot: {
    name: string;
    brand: string;
    images: string[];
    description: string;
  };
  size?: string;
  color?: string;
  price: number;
  quantity: number;
  discount: {
    percentage: number;
    amount: number;
    code: string;
  };
  status: 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled' | 'Returned';
}

interface TrackingTimeline {
  status: string;
  location: string;
  timestamp: string;
  description: string;
  updatedBy: string;
}

interface TrackingInfo {
  number: string;
  carrier: string;
  estimatedDelivery: string;
  actualDelivery?: string;
  currentLocation: string;
  status: string;
  timeline: TrackingTimeline[];
  deliveryAttempts: number;
  deliveryInstructions: string;
  recipientName: string;
  deliveryProof: string;
}

interface Order {
  _id: string;
  orderId: string;
  userId: string;
  items: OrderItem[];
  status: 'Pending' | 'Confirmed' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled' | 'Returned' | 'Refunded';
  orderDate: string;
  expectedDeliveryDate?: string;
  actualDeliveryDate?: string;
  pricing: {
    subtotal: number;
    discount: number;
    shipping: number;
    tax: number;
    total: number;
  };
  coupons: Array<{
    code: string;
    discount: number;
    type: string;
  }>;
  shippingAddress: {
    fullName: string;
    phone: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  payment: {
    method: string;
    status: string;
    transactionId?: string;
    paymentGateway?: string;
    paidAmount: number;
  };
  tracking?: TrackingInfo;
  customerNotes: string;
  // Enhanced computed fields
  canBeCancelled?: boolean;
  canBeReturned?: boolean;
  isDelivered?: boolean;
  itemCount?: number;
  daysSinceOrder?: number;
  estimatedDaysRemaining?: number;
}

interface OrdersState {
  orders: Order[];
  filteredOrders: Order[];
  isLoading: boolean;
  refreshing: boolean;
  error: string | null;
  stats: {
    totalOrders: number;
    totalSpent: number;
    averageOrderValue: number;
    statusBreakdown: { [key: string]: number };
  } | null;
}

type OrderStatus = 'all' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled';
type SortOption = 'newest' | 'oldest' | 'amount_high' | 'amount_low';

const ORDER_STATUS_OPTIONS = [
  { label: 'All Orders', value: 'all' as OrderStatus, color: '#666' },
  { label: 'Processing', value: 'Processing' as OrderStatus, color: '#ffa500' },
  { label: 'Shipped', value: 'Shipped' as OrderStatus, color: '#2196f3' },
  { label: 'Delivered', value: 'Delivered' as OrderStatus, color: '#4caf50' },
  { label: 'Cancelled', value: 'Cancelled' as OrderStatus, color: '#ff6b6b' },
];

const SORT_OPTIONS = [
  { label: 'Newest First', value: 'newest' as SortOption },
  { label: 'Oldest First', value: 'oldest' as SortOption },
  { label: 'Amount: High to Low', value: 'amount_high' as SortOption },
  { label: 'Amount: Low to High', value: 'amount_low' as SortOption },
];

export default function Orders() {
  const router = useRouter();
  const { user } = useAuth();

  // State
  const [state, setState] = useState<OrdersState>({
    orders: [],
    filteredOrders: [],
    isLoading: false,
    refreshing: false,
    error: null,
    stats: null,
  });

  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // Effects
  useEffect(() => {
    if (user) {
      fetchOrders();
      initializeAnimations();
    }
  }, [user]);

  useEffect(() => {
    if (state.orders.length > 0) {
      filterAndSortOrders();
    }
  }, [selectedStatus, sortBy, state.orders]);

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

  // ✅ UPDATED: API calls using centralized functions
  const fetchOrders = async (showLoading = true) => {
    if (!user) return;

    try {
      if (showLoading) {
        setState(prev => ({ ...prev, isLoading: true, error: null }));
      }

      // ✅ UPDATED: Use centralized getUserOrders function
      const response = await getUserOrders(user._id, {
        sortBy: 'orderDate',
        sortOrder: 'desc',
        limit: 100 // Get enough orders for the user
      });

      if (response.success) {
        const orders = response.data || [];
        
        // Calculate stats from orders data
        const stats = {
          totalOrders: orders.length,
          totalSpent: orders.reduce((sum: number, order: any) => 
            sum + (order.pricing?.total || 0), 0),
          averageOrderValue: orders.length > 0 
            ? orders.reduce((sum: number, order: any) => sum + (order.pricing?.total || 0), 0) / orders.length 
            : 0,
          statusBreakdown: orders.reduce((acc: any, order: any) => {
            acc[order.status] = (acc[order.status] || 0) + 1;
            return acc;
          }, {}),
        };

        // Enhance orders with computed fields
        const enhancedOrders = orders.map((order: any) => ({
          ...order,
          canBeCancelled: ['Pending', 'Confirmed', 'Processing'].includes(order.status),
          canBeReturned: order.status === 'Delivered',
          isDelivered: order.status === 'Delivered',
          itemCount: order.items?.length || 0,
          daysSinceOrder: Math.floor(
            (Date.now() - new Date(order.orderDate).getTime()) / (1000 * 60 * 60 * 24)
          ),
          estimatedDaysRemaining: order.expectedDeliveryDate 
            ? Math.max(0, Math.floor(
                (new Date(order.expectedDeliveryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
              ))
            : null,
        }));

        setState(prev => ({
          ...prev,
          orders: enhancedOrders,
          filteredOrders: enhancedOrders,
          stats,
          isLoading: false,
          error: null,
        }));
      } else {
        throw new Error(handleApiError(response.error));
      }
    } catch (error: any) {
      console.error("Error fetching orders:", error);
      const errorMessage = error.message || "Failed to load orders";
      
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
        orders: [],
        filteredOrders: [],
      }));
    }
  };

  const filterAndSortOrders = () => {
    let filtered = [...state.orders];

    // Filter by status
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(order => order.status === selectedStatus);
    }

    // Sort orders
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime();
        case 'oldest':
          return new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime();
        case 'amount_high':
          return b.pricing.total - a.pricing.total;
        case 'amount_low':
          return a.pricing.total - b.pricing.total;
        default:
          return 0;
      }
    });

    setState(prev => ({ ...prev, filteredOrders: filtered }));
  };

  const onRefresh = async () => {
    setState(prev => ({ ...prev, refreshing: true }));
    await fetchOrders(false);
    setState(prev => ({ ...prev, refreshing: false }));
  };

  const toggleOrderDetails = (orderId: string) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  // ✅ UPDATED: Track order using centralized API
  const handleTrackOrder = async (trackingNumber: string) => {
    try {
      // ✅ UPDATED: Use centralized trackOrder function
      const response = await trackOrder(trackingNumber);
      
      if (response.success) {
        const trackingData = response.data;
        
        if (trackingData) {
          Alert.alert(
            "Tracking Information",
            `Status: ${trackingData.status}\nLocation: ${trackingData.currentLocation}\nEstimated Delivery: ${new Date(trackingData.estimatedDelivery).toLocaleDateString()}`,
            [
              { text: "Close", style: "cancel" },
              { text: "View Details", onPress: () => {
                // Could navigate to a detailed tracking page
                // router.push(`/tracking/${trackingNumber}`);
              }}
            ]
          );
        } else {
          Alert.alert(
            "Tracking Information",
            "Tracking details are currently unavailable.",
            [
              { text: "Close", style: "cancel" }
            ]
          );
        }
      } else {
        Alert.alert(
          "Track Order",
          `Tracking Number: ${trackingNumber}\n\nTrack your order online or contact customer support for updates.`,
          [
            { text: "Copy", onPress: () => {/* Copy to clipboard */} },
            { text: "Contact Support", onPress: () => {/* Contact support */} },
            { text: "Close", style: "cancel" }
          ]
        );
      }
    } catch (error) {
      Alert.alert(
        "Track Order",
        `Tracking Number: ${trackingNumber}\n\nUnable to fetch live tracking. Please check the tracking number on the carrier's website.`,
        [
          { text: "Copy", onPress: () => {/* Copy to clipboard */} },
          { text: "Close", style: "cancel" }
        ]
      );
    }
  };

  // ✅ UPDATED: Cancel order using centralized API
  const handleCancelOrder = (order: Order) => {
    if (!order.canBeCancelled) {
      Alert.alert("Cannot Cancel", "This order cannot be cancelled at this stage.");
      return;
    }

    Alert.alert(
      "Cancel Order",
      `Are you sure you want to cancel order ${order.orderId}?`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              // ✅ UPDATED: Use centralized cancelOrder function
              const response = await cancelOrder(order._id, "Customer request");
              
              if (response.success) {
                // Refresh orders
                fetchOrders();
                Alert.alert("Order Cancelled", "Your order has been cancelled successfully.");
              } else {
                Alert.alert("Error", handleApiError(response.error));
              }
            } catch (error) {
              console.error("Error cancelling order:", error);
              Alert.alert("Error", "Failed to cancel order. Please try again.");
            }
          }
        }
      ]
    );
  };

  const handleContactSupport = (order: Order) => {
    Alert.alert(
      "Contact Support",
      `Need help with order ${order.orderId}?`,
      [
        { text: "Call Support", onPress: () => {/* Initiate call */} },
        { text: "Chat Support", onPress: () => {/* Open chat */} },
        { text: "Email Support", onPress: () => {/* Open email */} },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  // Components (keeping all existing components unchanged)
  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      'Pending': '#ffa500',
      'Confirmed': '#2196f3',
      'Processing': '#ffa500',
      'Shipped': '#2196f3',
      'Delivered': '#4caf50',
      'Cancelled': '#ff6b6b',
      'Returned': '#9c27b0',
      'Refunded': '#607d8b',
    };
    return colors[status] || '#666';
  };

  const getStatusIcon = (status: string) => {
    const icons: { [key: string]: React.ReactNode } = {
      'Pending': <Clock size={16} color={getStatusColor(status)} />,
      'Confirmed': <CheckCircle size={16} color={getStatusColor(status)} />,
      'Processing': <Package size={16} color={getStatusColor(status)} />,
      'Shipped': <Truck size={16} color={getStatusColor(status)} />,
      'Delivered': <CheckCircle size={16} color={getStatusColor(status)} />,
      'Cancelled': <AlertCircle size={16} color={getStatusColor(status)} />,
    };
    return icons[status] || <Package size={16} color="#666" />;
  };

  const OrderCard: React.FC<{ 
    order: Order; 
    isExpanded: boolean;
    onToggle: () => void;
  }> = ({ order, isExpanded, onToggle }) => {
    return (
      <Animated.View 
        style={[
          styles.orderCard,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Order Header */}
        <TouchableOpacity
          style={styles.orderHeader}
          onPress={onToggle}
          activeOpacity={0.8}
        >
          <View style={styles.orderHeaderLeft}>
            <View>
              <Text style={styles.orderId}>#{order.orderId}</Text>
              <Text style={styles.orderDate}>
                {new Date(order.orderDate).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
              </Text>
            </View>
          </View>
          
          <View style={styles.orderHeaderRight}>
            <View style={[styles.statusContainer, { backgroundColor: `${getStatusColor(order.status)}20` }]}>
              {getStatusIcon(order.status)}
              <Text style={[styles.orderStatus, { color: getStatusColor(order.status) }]}>
                {order.status}
              </Text>
            </View>
            <ChevronRight 
              size={20} 
              color="#666" 
              style={{
                transform: [{ rotate: isExpanded ? '90deg' : '0deg' }]
              }}
            />
          </View>
        </TouchableOpacity>

        {/* Order Items Preview */}
        <View style={styles.itemsPreview}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.itemsScrollContainer}
          >
            {order.items.slice(0, 3).map((item) => (
              <View key={item._id} style={styles.itemPreview}>
                <Image
                  source={{ 
                    uri: item.productSnapshot.images[0] || item.productId?.images?.[0] || "https://via.placeholder.com/60" 
                  }}
                  style={styles.itemPreviewImage}
                  defaultSource={{ uri: "https://via.placeholder.com/60" }}
                />
                <Text style={styles.itemPreviewName} numberOfLines={1}>
                  {item.productSnapshot.name}
                </Text>
                <Text style={styles.itemPreviewPrice}>₹{item.price}</Text>
              </View>
            ))}
            {order.items.length > 3 && (
              <View style={styles.moreItemsIndicator}>
                <Text style={styles.moreItemsText}>+{order.items.length - 3}</Text>
                <Text style={styles.moreItemsLabel}>more</Text>
              </View>
            )}
          </ScrollView>
        </View>

        {/* Order Summary */}
        <View style={styles.orderSummary}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              {order.items.length} item{order.items.length !== 1 ? 's' : ''}
            </Text>
            <Text style={styles.summaryValue}>₹{order.pricing.total}</Text>
          </View>
          
          {order.tracking && (
            <View style={styles.trackingPreview}>
              <Truck size={14} color="#666" />
              <Text style={styles.trackingText}>
                {order.tracking.currentLocation}
              </Text>
            </View>
          )}
        </View>

        {/* Expanded Details */}
        {isExpanded && (
          <Animated.View 
            style={styles.expandedContent}
          >
            {/* Detailed Items */}
            <View style={styles.detailedItems}>
              <Text style={styles.sectionTitle}>Order Items</Text>
              {order.items.map((item) => (
                <View key={item._id} style={styles.detailedItem}>
                  <Image
                    source={{ 
                      uri: item.productSnapshot.images[0] || item.productId?.images?.[0] || "https://via.placeholder.com/80" 
                    }}
                    style={styles.detailedItemImage}
                    defaultSource={{ uri: "https://via.placeholder.com/80" }}
                  />
                  <View style={styles.detailedItemInfo}>
                    <Text style={styles.detailedItemBrand}>
                      {item.productSnapshot.brand}
                    </Text>
                    <Text style={styles.detailedItemName} numberOfLines={2}>
                      {item.productSnapshot.name}
                    </Text>
                    {(item.size || item.color) && (
                      <View style={styles.itemVariations}>
                        {item.size && (
                          <Text style={styles.variationText}>Size: {item.size}</Text>
                        )}
                        {item.color && (
                          <Text style={styles.variationText}>Color: {item.color}</Text>
                        )}
                      </View>
                    )}
                    <View style={styles.itemPricing}>
                      <Text style={styles.itemPrice}>₹{item.price}</Text>
                      <Text style={styles.itemQuantity}>Qty: {item.quantity}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>

            {/* Shipping Address */}
            <View style={styles.addressSection}>
              <View style={styles.sectionHeader}>
                <MapPin size={18} color="#666" />
                <Text style={styles.sectionTitle}>Shipping Address</Text>
              </View>
              <Text style={styles.addressText}>
                {order.shippingAddress.fullName}
              </Text>
              <Text style={styles.addressText}>
                {order.shippingAddress.addressLine1}
                {order.shippingAddress.addressLine2 && `, ${order.shippingAddress.addressLine2}`}
              </Text>
              <Text style={styles.addressText}>
                {order.shippingAddress.city}, {order.shippingAddress.state} - {order.shippingAddress.pincode}
              </Text>
              <Text style={styles.addressText}>
                Phone: {order.shippingAddress.phone}
              </Text>
            </View>

            {/* Payment Information */}
            <View style={styles.paymentSection}>
              <View style={styles.sectionHeader}>
                <CreditCard size={18} color="#666" />
                <Text style={styles.sectionTitle}>Payment</Text>
              </View>
              <View style={styles.paymentInfo}>
                <Text style={styles.paymentMethod}>
                  {order.payment.method}
                </Text>
                <View style={[
                  styles.paymentStatus,
                  { backgroundColor: order.payment.status === 'Completed' ? '#e8f5e8' : '#fff3e0' }
                ]}>
                  <Text style={[
                    styles.paymentStatusText,
                    { color: order.payment.status === 'Completed' ? '#4caf50' : '#ffa500' }
                  ]}>
                    {order.payment.status}
                  </Text>
                </View>
              </View>
              {order.payment.transactionId && (
                <Text style={styles.transactionId}>
                  Transaction ID: {order.payment.transactionId}
                </Text>
              )}
            </View>

            {/* Tracking Information */}
            {order.tracking && (
              <View style={styles.trackingSection}>
                <View style={styles.sectionHeader}>
                  <Truck size={18} color="#666" />
                  <Text style={styles.sectionTitle}>Tracking Details</Text>
                  <TouchableOpacity
                    style={styles.trackButton}
                    onPress={() => handleTrackOrder(order.tracking!.number)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.trackButtonText}>Track</Text>
                  </TouchableOpacity>
                </View>
                
                <View style={styles.trackingInfo}>
                  <Text style={styles.trackingNumber}>
                    {order.tracking.number}
                  </Text>
                  <Text style={styles.trackingCarrier}>
                    via {order.tracking.carrier}
                  </Text>
                </View>

                {/* Timeline */}
                <View style={styles.timeline}>
                  {order.tracking.timeline.map((event, index) => (
                    <View key={index} style={styles.timelineEvent}>
                      <View style={[
                        styles.timelinePoint,
                        index === 0 && styles.activeTimelinePoint
                      ]} />
                      {index !== order.tracking!.timeline.length - 1 && (
                        <View style={styles.timelineLine} />
                      )}
                      <View style={styles.timelineContent}>
                        <Text style={styles.timelineStatus}>
                          {event.status}
                        </Text>
                        <Text style={styles.timelineLocation}>
                          {event.location}
                        </Text>
                        <Text style={styles.timelineTimestamp}>
                          {new Date(event.timestamp).toLocaleString('en-IN')}
                        </Text>
                        {event.description && (
                          <Text style={styles.timelineDescription}>
                            {event.description}
                          </Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>

                {order.expectedDeliveryDate && (
                  <View style={styles.deliveryEstimate}>
                    <Calendar size={16} color="#4caf50" />
                    <Text style={styles.deliveryEstimateText}>
                      Expected delivery: {new Date(order.expectedDeliveryDate).toLocaleDateString('en-IN')}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Order Actions */}
            <View style={styles.orderActions}>
              {order.canBeCancelled && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.cancelButton]}
                  onPress={() => handleCancelOrder(order)}
                  activeOpacity={0.7}
                >
                  <AlertCircle size={16} color="#ff6b6b" />
                  <Text style={[styles.actionButtonText, { color: '#ff6b6b' }]}>
                    Cancel Order
                  </Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleContactSupport(order)}
                activeOpacity={0.7}
              >
                <MessageCircle size={16} color="#666" />
                <Text style={styles.actionButtonText}>Contact Support</Text>
              </TouchableOpacity>

              {order.tracking && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleTrackOrder(order.tracking!.number)}
                  activeOpacity={0.7}
                >
                  <Navigation size={16} color="#666" />
                  <Text style={styles.actionButtonText}>Track Order</Text>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        )}
      </Animated.View>
    );
  };

  const EmptyOrdersState: React.FC = () => (
    <Animated.View 
      style={[
        styles.emptyState,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <Package size={80} color="#ff3f6c" />
      <Text style={styles.emptyTitle}>No orders yet</Text>
      <Text style={styles.emptySubtitle}>
        Start shopping and your orders will appear here
      </Text>
      <TouchableOpacity
        style={styles.startShoppingButton}
        onPress={() => router.push("/(tabs)/categories")}
        activeOpacity={0.8}
      >
        <Text style={styles.startShoppingText}>Start Shopping</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const OrdersStats: React.FC = () => {
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
          <Text style={styles.statNumber}>{state.stats.totalOrders}</Text>
          <Text style={styles.statLabel}>Total Orders</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>₹{Math.round(state.stats.totalSpent)}</Text>
          <Text style={styles.statLabel}>Total Spent</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>₹{Math.round(state.stats.averageOrderValue)}</Text>
          <Text style={styles.statLabel}>Avg Order</Text>
        </View>
      </Animated.View>
    );
  };

  const FilterBar: React.FC = () => (
    <Animated.View 
      style={[
        styles.filterBar,
        {
          opacity: fadeAnim,
        },
      ]}
    >
      {/* Status Filter */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScrollContent}
      >
        {ORDER_STATUS_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.filterChip,
              selectedStatus === option.value && styles.activeFilterChip,
            ]}
            onPress={() => setSelectedStatus(option.value)}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.filterChipText,
              selectedStatus === option.value && styles.activeFilterChipText,
            ]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Sort Options */}
      <View style={styles.sortSection}>
        <Text style={styles.sortLabel}>Sort by:</Text>
        {SORT_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.sortChip,
              sortBy === option.value && styles.activeSortChip,
            ]}
            onPress={() => setSortBy(option.value)}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.sortChipText,
              sortBy === option.value && styles.activeSortChipText,
            ]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );

  // Login required state
  if (!user) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Orders</Text>
        </View>
        
        <View style={styles.emptyState}>
          <Package size={80} color="#ff3f6c" />
          <Text style={styles.emptyTitle}>Please login to view your orders</Text>
          <Text style={styles.emptySubtitle}>
            Track your orders and view order history
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
      
      {/* Header */}
      <Animated.View 
        style={[
          styles.header,
          {
            opacity: fadeAnim,
          }
        ]}
      >
        <Text style={styles.headerTitle}>My Orders</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => fetchOrders()}
          activeOpacity={0.7}
        >
          <RefreshCw size={20} color="#666" />
        </TouchableOpacity>
      </Animated.View>

      {/* Content */}
      {state.isLoading && state.orders.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ff3f6c" />
          <Text style={styles.loadingText}>Loading your orders...</Text>
        </View>
      ) : state.error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorText}>{state.error}</Text>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={() => fetchOrders()}
            activeOpacity={0.8}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : state.orders.length === 0 ? (
        <EmptyOrdersState />
      ) : (
        <>
          {/* Stats */}
          <OrdersStats />

          {/* Filters */}
          <FilterBar />

          {/* Orders List */}
          <FlatList
            data={state.filteredOrders}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <OrderCard
                order={item}
                isExpanded={expandedOrders.has(item._id)}
                onToggle={() => toggleOrderDetails(item._id)}
              />
            )}
            contentContainerStyle={styles.ordersContainer}
            refreshControl={
              <RefreshControl
                refreshing={state.refreshing}
                onRefresh={onRefresh}
                colors={["#ff3f6c"]}
                tintColor="#ff3f6c"
              />
            }
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.orderSeparator} />}
          />
        </>
      )}
    </View>
  );
}

// ✅ KEEPING ALL EXISTING STYLES UNCHANGED
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
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  refreshButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
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
  filterScrollContent: {
    paddingRight: 16,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  activeFilterChip: {
    backgroundColor: '#ff3f6c',
    borderColor: '#ff3f6c',
  },
  filterChipText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeFilterChipText: {
    color: '#fff',
  },
  sortSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    flexWrap: 'wrap',
  },
  sortLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    marginRight: 12,
  },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  activeSortChip: {
    backgroundColor: '#ff3f6c',
  },
  sortChipText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  activeSortChipText: {
    color: '#fff',
  },
  ordersContainer: {
    padding: 16,
  },
  orderSeparator: {
    height: 12,
  },
  orderCard: {
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
    overflow: 'hidden',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  orderHeaderLeft: {
    flex: 1,
  },
  orderId: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 2,
  },
  orderDate: {
    fontSize: 14,
    color: '#666',
  },
  orderHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  orderStatus: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  itemsPreview: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  itemsScrollContainer: {
    paddingRight: 16,
  },
  itemPreview: {
    alignItems: 'center',
    marginRight: 12,
    width: 60,
  },
  itemPreviewImage: {
    width: 50,
    height: 60,
    borderRadius: 6,
    backgroundColor: '#f8f9fa',
    marginBottom: 4,
  },
  itemPreviewName: {
    fontSize: 10,
    color: '#333',
    textAlign: 'center',
    marginBottom: 2,
  },
  itemPreviewPrice: {
    fontSize: 10,
    color: '#ff3f6c',
    fontWeight: '600',
  },
  moreItemsIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 60,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
  },
  moreItemsText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
  },
  moreItemsLabel: {
    fontSize: 10,
    color: '#666',
  },
  orderSummary: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  trackingPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  trackingText: {
    fontSize: 12,
    color: '#2196f3',
    marginLeft: 6,
    fontWeight: '500',
  },
  expandedContent: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  detailedItems: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  detailedItem: {
    flexDirection: 'row',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailedItemImage: {
    width: 60,
    height: 75,
    borderRadius: 6,
    backgroundColor: '#f8f9fa',
  },
  detailedItemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  detailedItemBrand: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    marginBottom: 2,
  },
  detailedItemName: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 4,
  },
  itemVariations: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  variationText: {
    fontSize: 12,
    color: '#666',
    marginRight: 12,
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  itemPricing: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ff3f6c',
  },
  itemQuantity: {
    fontSize: 12,
    color: '#666',
  },
  addressSection: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  addressText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 2,
  },
  paymentSection: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  paymentInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentMethod: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  paymentStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  paymentStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  transactionId: {
    fontSize: 12,
    color: '#666',
  },
  trackingSection: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  trackButton: {
    marginLeft: 'auto',
    backgroundColor: '#ff3f6c',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  trackButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  trackingInfo: {
    marginBottom: 16,
  },
  trackingNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  trackingCarrier: {
    fontSize: 12,
    color: '#666',
  },
  timeline: {
    marginBottom: 16,
  },
  timelineEvent: {
    flexDirection: 'row',
    marginBottom: 12,
    position: 'relative',
  },
  timelinePoint: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e0e0e0',
    marginTop: 4,
    marginRight: 12,
  },
  activeTimelinePoint: {
    backgroundColor: '#ff3f6c',
  },
  timelineLine: {
    position: 'absolute',
    left: 5,
    top: 16,
    width: 2,
    height: 30,
    backgroundColor: '#e0e0e0',
  },
  timelineContent: {
    flex: 1,
  },
  timelineStatus: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  timelineLocation: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  timelineTimestamp: {
    fontSize: 11,
    color: '#999',
    marginBottom: 2,
  },
  timelineDescription: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  deliveryEstimate: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  deliveryEstimateText: {
    fontSize: 12,
    color: '#4caf50',
    marginLeft: 6,
    fontWeight: '500',
  },
  orderActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cancelButton: {
    backgroundColor: '#ffeaea',
    borderRadius: 6,
  },
  actionButtonText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginTop: 24,
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
  startShoppingButton: {
    backgroundColor: '#ff3f6c',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
    shadowColor: '#ff3f6c',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  startShoppingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  loginButton: {
    backgroundColor: '#ff3f6c',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 10,
    shadowColor: '#ff3f6c',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
