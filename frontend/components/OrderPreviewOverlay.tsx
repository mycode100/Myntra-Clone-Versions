import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Animated,
} from "react-native";
import { useAuth } from "@/context/AuthContext";
import { BagItem, Address } from "@/types/product";
import {
  X,
  MapPin,
  Edit2,
  ShoppingBag,
  Receipt,
  CheckCircle2,
  AlertCircle,
  Package,
  Truck,
  CreditCard,
  Tag,
  Smartphone,
  Banknote,
  Wallet,
  ArrowRight,
} from "lucide-react-native";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

interface OrderPreviewOverlayProps {
  visible: boolean;
  onClose: () => void;
  onEditAddress: () => void;
  onPlaceOrder: () => Promise<void>;
  selectedAddress?: Address | null;
}

// ✅ NEW: Payment method types
type PaymentMethod = {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  recommended?: boolean;
};

const OrderPreviewOverlay: React.FC<OrderPreviewOverlayProps> = ({
  visible,
  onClose,
  onEditAddress,
  onPlaceOrder,
  selectedAddress,
}) => {
  const {
    user,
    bagItems,
    bagSummary,
    addresses,
    defaultAddressId,
    appliedCoupon,
    totalBagItems,
    bagSubtotal,
    isRefreshingPreferences,
  } = useAuth();

  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderStep, setOrderStep] = useState<"preview" | "placing" | "success">("preview");
  
  // ✅ NEW: Payment method selection
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("cod");
  
  // ✅ NEW: Button animation values
  const [buttonScale] = useState(new Animated.Value(1));
  const [buttonProgress] = useState(new Animated.Value(0));

  // ✅ NEW: Payment methods configuration
  const paymentMethods: PaymentMethod[] = [
    {
      id: "cod",
      name: "Cash on Delivery",
      description: "Pay when your order arrives",
      icon: <Banknote size={20} color="#4caf50" />,
      enabled: true,
      recommended: true,
    },
    {
      id: "upi",
      name: "UPI Payment",
      description: "PhonePe, GPay, Paytm & more",
      icon: <Smartphone size={20} color="#ff9800" />,
      enabled: true,
    },
    {
      id: "card",
      name: "Credit/Debit Card",
      description: "Visa, Mastercard, RuPay",
      icon: <CreditCard size={20} color="#2196f3" />,
      enabled: true,
    },
    {
      id: "wallet",
      name: "Digital Wallet",
      description: "Amazon Pay, Paytm Wallet",
      icon: <Wallet size={20} color="#9c27b0" />,
      enabled: true,
    },
  ];

  // Get selected address (prop takes priority, fallback to default)
  const deliveryAddress = selectedAddress || 
    (defaultAddressId ? addresses.get(defaultAddressId) : null) ||
    Array.from(addresses.values()).find(addr => addr.isDefault) ||
    null;

  const bagItemsArray = Array.from(bagItems.values());
  
  // Calculate totals
  const subtotal = bagSummary?.subtotal || bagSubtotal;
  const shipping = bagSummary?.shipping || (subtotal > 499 ? 0 : 50);
  const tax = bagSummary?.tax || Math.round(subtotal * 0.18);
  const couponDiscount = bagSummary?.couponDiscount || appliedCoupon?.discountAmount || 0;
  const finalTotal = bagSummary?.total || (subtotal + shipping + tax - couponDiscount);

  const canPlaceOrder = bagItemsArray.length > 0 && 
                       deliveryAddress !== null && 
                       !isPlacingOrder &&
                       !isRefreshingPreferences;

  useEffect(() => {
    if (visible) {
      setOrderStep("preview");
      setIsPlacingOrder(false);
      buttonProgress.setValue(0);
    }
  }, [visible]);

  // ✅ NEW: Button animation functions
  const animateButtonPress = () => {
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const animateButtonProgress = () => {
    Animated.timing(buttonProgress, {
      toValue: 1,
      duration: 2000,
      useNativeDriver: false,
    }).start();
  };

  const handlePlaceOrder = async () => {
    if (!canPlaceOrder || !user) {
      Alert.alert("Error", "Unable to place order. Please check your bag and address.");
      return;
    }

    try {
      setIsPlacingOrder(true);
      setOrderStep("placing");
      
      // ✅ Start button animation
      animateButtonPress();
      animateButtonProgress();

      await onPlaceOrder();
      
      setOrderStep("success");
      
      // Auto-close after success
      setTimeout(() => {
        onClose();
      }, 2000);

    } catch (error) {
      console.error("Order placement failed:", error);
      setOrderStep("preview");
      buttonProgress.setValue(0);
      Alert.alert(
        "Order Failed", 
        "We couldn't process your order. Please try again.",
        [{ text: "OK" }]
      );
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const handleClose = () => {
    if (isPlacingOrder) return; // Prevent closing during order placement
    onClose();
  };

  const formatAddress = (address: Address): string => {
    const parts = [
      address.addressLine1,
      address.addressLine2,
      address.landmark,
      address.city,
      address.state,
      address.pincode
    ].filter(Boolean);
    return parts.join(", ");
  };

  const renderBagItem = ({ item, index }: { item: BagItem; index: number }) => (
    <View style={[styles.bagItem, index === bagItemsArray.length - 1 && styles.lastBagItem]}>
      <Image
        source={{ uri: item.productId.images?.[0] || "https://via.placeholder.com/60" }}
        style={styles.itemImage}
        resizeMode="cover"
      />
      
      <View style={styles.itemDetails}>
        <Text style={styles.itemBrand} numberOfLines={1}>
          {item.productId.brand || "Unknown Brand"}
        </Text>
        <Text style={styles.itemName} numberOfLines={2}>
          {item.productId.name || "Unknown Product"}
        </Text>
        
        {(item.size || item.color) && (
          <View style={styles.itemVariations}>
            {item.size && <Text style={styles.variationText}>Size: {item.size}</Text>}
            {item.color && <Text style={styles.variationText}>Color: {item.color}</Text>}
          </View>
        )}
        
        <View style={styles.itemPriceRow}>
          <Text style={styles.itemQuantity}>Qty: {item.quantity}</Text>
          <Text style={styles.itemPrice}>₹{item.priceWhenAdded}</Text>
        </View>
      </View>
    </View>
  );

  const renderOrderSummary = () => (
    <View style={styles.summarySection}>
      <View style={styles.summaryHeader}>
        <Receipt size={20} color="#ff3f6c" />
        <Text style={styles.summaryTitle}>Order Summary</Text>
      </View>
      
      <View style={styles.summaryContent}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal ({totalBagItems} items)</Text>
          <Text style={styles.summaryValue}>₹{subtotal}</Text>
        </View>
        
        {couponDiscount > 0 && (
          <View style={[styles.summaryRow, styles.discountRow]}>
            <Text style={styles.summaryLabel}>Coupon Discount</Text>
            <Text style={styles.discountValue}>- ₹{couponDiscount}</Text>
          </View>
        )}
        
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Shipping</Text>
          <Text style={[styles.summaryValue, shipping === 0 && styles.freeShipping]}>
            {shipping === 0 ? "FREE" : `₹${shipping}`}
          </Text>
        </View>
        
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Tax (GST)</Text>
          <Text style={styles.summaryValue}>₹{tax}</Text>
        </View>
        
        <View style={styles.summaryDivider} />
        
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total Amount</Text>
          <Text style={styles.totalValue}>₹{finalTotal}</Text>
        </View>
      </View>
    </View>
  );

  const renderDeliveryAddress = () => (
    <View style={styles.addressSection}>
      <View style={styles.addressHeader}>
        <View style={styles.addressTitleRow}>
          <MapPin size={20} color="#ff3f6c" />
          <Text style={styles.addressTitle}>Delivery Address</Text>
        </View>
        
        <TouchableOpacity
          style={styles.changeAddressButton}
          onPress={onEditAddress}
          activeOpacity={0.7}
          accessible
          accessibilityLabel="Change delivery address"
        >
          <Edit2 size={16} color="#ff3f6c" />
          <Text style={styles.changeAddressText}>Change</Text>
        </TouchableOpacity>
      </View>

      {deliveryAddress ? (
        <View style={styles.addressCard}>
          <Text style={styles.addressName}>{deliveryAddress.name}</Text>
          <Text style={styles.addressPhone}>+91 {deliveryAddress.phone}</Text>
          <Text style={styles.addressText}>{formatAddress(deliveryAddress)}</Text>
          
          {deliveryAddress.isDefault && (
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultBadgeText}>DEFAULT</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.noAddressCard}>
          <AlertCircle size={24} color="#ff6b6b" />
          <Text style={styles.noAddressTitle}>No Delivery Address</Text>
          <Text style={styles.noAddressText}>Please add a delivery address to place your order</Text>
          <TouchableOpacity
            style={styles.addAddressButton}
            onPress={onEditAddress}
            activeOpacity={0.7}
          >
            <Text style={styles.addAddressButtonText}>Add Address</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // ✅ NEW: Enhanced payment method selection
  const renderPaymentMethods = () => (
    <View style={styles.paymentSection}>
      <View style={styles.paymentHeader}>
        <CreditCard size={20} color="#ff3f6c" />
        <Text style={styles.sectionTitle}>Payment Method</Text>
      </View>
      
      {paymentMethods.map((method) => (
        <TouchableOpacity
          key={method.id}
          style={[
            styles.paymentMethodCard,
            selectedPaymentMethod === method.id && styles.selectedPaymentMethod,
            !method.enabled && styles.disabledPaymentMethod,
          ]}
          onPress={() => method.enabled && setSelectedPaymentMethod(method.id)}
          disabled={!method.enabled}
          activeOpacity={0.7}
        >
          <View style={styles.paymentMethodLeft}>
            <View style={styles.paymentMethodIcon}>
              {method.icon}
            </View>
            <View style={styles.paymentMethodInfo}>
              <View style={styles.paymentMethodNameRow}>
                <Text style={styles.paymentMethodName}>{method.name}</Text>
                {method.recommended && (
                  <View style={styles.recommendedBadge}>
                    <Text style={styles.recommendedText}>RECOMMENDED</Text>
                  </View>
                )}
              </View>
              <Text style={styles.paymentMethodDescription}>{method.description}</Text>
            </View>
          </View>
          
          <View style={[
            styles.radioButton,
            selectedPaymentMethod === method.id && styles.radioButtonSelected
          ]}>
            {selectedPaymentMethod === method.id && (
              <View style={styles.radioButtonInner} />
            )}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderPlacingOrder = () => (
    <View style={styles.placingOrderContainer}>
      <ActivityIndicator size="large" color="#ff3f6c" />
      <Text style={styles.placingOrderTitle}>Placing Your Order...</Text>
      <Text style={styles.placingOrderText}>Please wait while we process your order</Text>
    </View>
  );

  const renderOrderSuccess = () => (
    <View style={styles.successContainer}>
      <CheckCircle2 size={64} color="#4caf50" />
      <Text style={styles.successTitle}>Order Placed Successfully!</Text>
      <Text style={styles.successText}>Thank you for your purchase</Text>
      <Text style={styles.successSubtext}>You will receive an order confirmation shortly</Text>
    </View>
  );

  // ✅ NEW: Animated progress bar for button
  const progressWidth = buttonProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
      hardwareAccelerated
      statusBarTranslucent
    >
      <Pressable 
        style={styles.backdrop} 
        onPress={handleClose}
        accessible
        accessibilityLabel="Close order preview"
      />
      
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Package size={20} color="#ff3f6c" />
            <Text style={styles.headerTitle}>
              {orderStep === "preview" && "Order Preview"}
              {orderStep === "placing" && "Processing Order"}
              {orderStep === "success" && "Order Confirmed"}
            </Text>
          </View>
          
          {orderStep === "preview" && (
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeButton}
              accessible
              accessibilityLabel="Close"
            >
              <X size={24} color="#333" />
            </TouchableOpacity>
          )}
        </View>

        {/* Content */}
        {orderStep === "placing" ? (
          renderPlacingOrder()
        ) : orderStep === "success" ? (
          renderOrderSuccess()
        ) : (
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Items Section */}
            <View style={styles.itemsSection}>
              <View style={styles.itemsHeader}>
                <ShoppingBag size={20} color="#ff3f6c" />
                <Text style={styles.sectionTitle}>Items ({totalBagItems})</Text>
              </View>
              
              {bagItemsArray.length === 0 ? (
                <View style={styles.emptyBagContainer}>
                  <ShoppingBag size={48} color="#ccc" />
                  <Text style={styles.emptyBagTitle}>Your bag is empty</Text>
                  <Text style={styles.emptyBagText}>Add items to your bag to place an order</Text>
                </View>
              ) : (
                <FlatList
                  data={bagItemsArray}
                  keyExtractor={(item) => item._id}
                  renderItem={renderBagItem}
                  scrollEnabled={false}
                  contentContainerStyle={styles.itemsList}
                />
              )}
            </View>

            {/* Order Summary */}
            {renderOrderSummary()}

            {/* Delivery Address */}
            {renderDeliveryAddress()}

            {/* ✅ NEW: Enhanced Payment Methods */}
            {renderPaymentMethods()}

            {/* Spacer for button */}
            <View style={styles.buttonSpacer} />
          </ScrollView>
        )}

        {/* ✅ NEW: Enhanced Footer - Place Order Button with Animation */}
        {orderStep === "preview" && (
          <View style={styles.footer}>
            <Animated.View style={[styles.placeOrderButtonContainer, { transform: [{ scale: buttonScale }] }]}>
              <TouchableOpacity
                style={[
                  styles.placeOrderButton,
                  !canPlaceOrder && styles.placeOrderButtonDisabled
                ]}
                onPress={handlePlaceOrder}
                disabled={!canPlaceOrder}
                activeOpacity={0.9}
                accessible
                accessibilityLabel={canPlaceOrder ? "Place order" : "Cannot place order"}
              >
                {/* ✅ NEW: Animated progress background */}
                <Animated.View style={[styles.buttonProgressBar, { width: progressWidth }]} />
                
                <View style={styles.buttonContent}>
                  {isPlacingOrder ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <CheckCircle2 size={20} color="#fff" />
                      <Text style={styles.placeOrderButtonText}>
                        Place Order • ₹{finalTotal}
                      </Text>
                      <ArrowRight size={16} color="#fff" />
                    </>
                  )}
                </View>
              </TouchableOpacity>
            </Animated.View>

            {!deliveryAddress && (
              <Text style={styles.footerWarning}>
                Please add a delivery address to place your order
              </Text>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: screenHeight * 0.85,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    marginLeft: 8,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#f8f9fa",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  itemsSection: {
    marginTop: 16,
  },
  itemsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginLeft: 8,
  },
  itemsList: {
    gap: 0,
  },
  bagItem: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f0f0f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  lastBagItem: {
    marginBottom: 0,
  },
  itemImage: {
    width: 60,
    height: 80,
    borderRadius: 8,
    backgroundColor: "#f8f9fa",
  },
  itemDetails: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "space-between",
  },
  itemBrand: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  itemName: {
    fontSize: 14,
    color: "#333",
    fontWeight: "600",
    lineHeight: 18,
    marginTop: 2,
  },
  itemVariations: {
    flexDirection: "row",
    marginTop: 4,
    gap: 8,
  },
  variationText: {
    fontSize: 11,
    color: "#666",
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  itemPriceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  itemQuantity: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  itemPrice: {
    fontSize: 14,
    color: "#333",
    fontWeight: "700",
  },
  summarySection: {
    marginTop: 24,
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    overflow: "hidden",
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginLeft: 8,
  },
  summaryContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  summaryLabel: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  summaryValue: {
    fontSize: 14,
    color: "#333",
    fontWeight: "600",
  },
  discountRow: {
    backgroundColor: "#e8f5e8",
    marginHorizontal: -8,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  discountValue: {
    color: "#4caf50",
    fontSize: 14,
    fontWeight: "700",
  },
  freeShipping: {
    color: "#4caf50",
    fontWeight: "700",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "#e0e0e0",
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    backgroundColor: "#fff",
    marginHorizontal: -8,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ff3f6c",
  },
  addressSection: {
    marginTop: 24,
  },
  addressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  addressTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  addressTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginLeft: 8,
  },
  changeAddressButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#fff4f6",
    borderWidth: 1,
    borderColor: "#ff3f6c",
  },
  changeAddressText: {
    color: "#ff3f6c",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  addressCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    position: "relative",
  },
  addressName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginBottom: 4,
  },
  addressPhone: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  addressText: {
    fontSize: 14,
    color: "#555",
    lineHeight: 20,
  },
  defaultBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "#ff3f6c",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  defaultBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  noAddressCard: {
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  noAddressTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#dc2626",
    marginTop: 8,
    marginBottom: 4,
  },
  noAddressText: {
    fontSize: 14,
    color: "#991b1b",
    textAlign: "center",
    marginBottom: 16,
  },
  addAddressButton: {
    backgroundColor: "#ff3f6c",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addAddressButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  // ✅ NEW: Enhanced Payment Section Styles
  paymentSection: {
    marginTop: 24,
  },
  paymentHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  paymentMethodCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  selectedPaymentMethod: {
    borderColor: "#ff3f6c",
    backgroundColor: "#fff4f6",
    borderWidth: 2,
  },
  disabledPaymentMethod: {
    opacity: 0.5,
    backgroundColor: "#f5f5f5",
  },
  paymentMethodLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  paymentMethodIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f8f9fa",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  paymentMethodInfo: {
    flex: 1,
  },
  paymentMethodNameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  paymentMethodName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    flex: 1,
  },
  recommendedBadge: {
    backgroundColor: "#4caf50",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  recommendedText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.3,
  },
  paymentMethodDescription: {
    fontSize: 12,
    color: "#666",
    lineHeight: 16,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#ddd",
    alignItems: "center",
    justifyContent: "center",
  },
  radioButtonSelected: {
    borderColor: "#ff3f6c",
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#ff3f6c",
  },
  buttonSpacer: {
    height: 20,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  // ✅ NEW: Enhanced Button Styles with Animation
  placeOrderButtonContainer: {
    borderRadius: 12,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#ff3f6c",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  placeOrderButton: {
    position: "relative",
    backgroundColor: "#ff3f6c",
    paddingVertical: 18,
    borderRadius: 12,
    overflow: "hidden",
  },
  placeOrderButtonDisabled: {
    backgroundColor: "#ccc",
    opacity: 0.6,
  },
  buttonProgressBar: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: "#4caf50",
    zIndex: 1,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    zIndex: 2,
  },
  placeOrderButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  footerWarning: {
    textAlign: "center",
    marginTop: 8,
    fontSize: 12,
    color: "#ff6b6b",
    fontWeight: "500",
  },
  emptyBagContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyBagTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    marginTop: 12,
    marginBottom: 4,
  },
  emptyBagText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  placingOrderContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  placingOrderTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
    marginTop: 20,
    marginBottom: 8,
  },
  placingOrderText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#4caf50",
    marginTop: 20,
    marginBottom: 8,
    textAlign: "center",
  },
  successText: {
    fontSize: 16,
    color: "#333",
    marginBottom: 8,
    textAlign: "center",
  },
  successSubtext: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
});

export default OrderPreviewOverlay;
