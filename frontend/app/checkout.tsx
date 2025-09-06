import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  StatusBar,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import {
  CreditCard,
  MapPin,
  Truck,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Edit3,
  Shield,
  Clock,
  Package,
  Gift,
  Tag,
} from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";

// ✅ UPDATED: Import centralized API functions
import {
  createOrder,
  handleApiError
} from "@/utils/api";
import { getBagSummary } from '../utils/api';
const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

// Responsive helpers
const isTablet = screenWidth >= 768;
const wp = (percentage: number) => (screenWidth * percentage) / 100;
const hp = (percentage: number) => (screenHeight * percentage) / 100;

// Types
interface Address {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  addressType: 'Home' | 'Office' | 'Other';
}

interface PaymentMethod {
  method: 'COD' | 'Credit Card' | 'Debit Card' | 'UPI' | 'Net Banking' | 'Wallet';
  cardNumber?: string;
  expiryDate?: string;
  cvv?: string;
  cardHolderName?: string;
  upiId?: string;
}

interface OrderSummary {
  itemCount: number;
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  savings: number;
}

interface CheckoutState {
  shippingAddress: Address;
  billingAddress: Address;
  paymentMethod: PaymentMethod;
  orderSummary: OrderSummary;
  isLoading: boolean;
  isPlacingOrder: boolean;
  errors: { [key: string]: string };
  useBillingAsShipping: boolean;
  selectedDeliveryTime: string;
  specialInstructions: string;
}

const DELIVERY_TIME_SLOTS = [
  { value: 'Anytime', label: 'Anytime (9AM - 9PM)', icon: '🕐' },
  { value: 'Morning (9AM-12PM)', label: 'Morning (9AM - 12PM)', icon: '🌅' },
  { value: 'Afternoon (12PM-6PM)', label: 'Afternoon (12PM - 6PM)', icon: '☀️' },
  { value: 'Evening (6PM-9PM)', label: 'Evening (6PM - 9PM)', icon: '🌆' },
];

const PAYMENT_METHODS = [
  { 
    value: 'COD', 
    label: 'Cash on Delivery', 
    icon: '💵',
    description: 'Pay when your order arrives',
    processingFee: 0
  },
  { 
    value: 'Credit Card', 
    label: 'Credit Card', 
    icon: '💳',
    description: 'Visa, Mastercard, Amex accepted',
    processingFee: 0
  },
  { 
    value: 'Debit Card', 
    label: 'Debit Card', 
    icon: '💳',
    description: 'All major banks supported',
    processingFee: 0
  },
  { 
    value: 'UPI', 
    label: 'UPI Payment', 
    icon: '📱',
    description: 'GPay, PhonePe, Paytm & more',
    processingFee: 0
  },
  { 
    value: 'Net Banking', 
    label: 'Net Banking', 
    icon: '🏦',
    description: 'All major banks',
    processingFee: 0
  },
];

export default function Checkout() {
  const router = useRouter();
  const { user } = useAuth();

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // State
  const [state, setState] = useState<CheckoutState>({
    shippingAddress: {
      fullName: '',
      phone: '',
      addressLine1: '',
      addressLine2: '',
      landmark: '',
      city: '',
      state: '',
      pincode: '',
      country: 'India',
      addressType: 'Home',
    },
    billingAddress: {
      fullName: '',
      phone: '',
      addressLine1: '',
      addressLine2: '',
      landmark: '',
      city: '',
      state: '',
      pincode: '',
      country: 'India',
      addressType: 'Home',
    },
    paymentMethod: {
      method: 'COD',
    },
    orderSummary: {
      itemCount: 0,
      subtotal: 0,
      discount: 0,
      shipping: 0,
      tax: 0,
      total: 0,
      savings: 0,
    },
    isLoading: true,
    isPlacingOrder: false,
    errors: {},
    useBillingAsShipping: true,
    selectedDeliveryTime: 'Anytime',
    specialInstructions: '',
  });

  // Effects
  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    
    fetchBagSummary();
    initializeAnimations();
  }, [user]);

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
  // ✅ UPDATE: Your existing fetchBagSummary function in checkout.tsx
const fetchBagSummary = async () => {
  if (!user) return;

  try {
    // ✅ UPDATED: Use centralized getBagSummary function
    const response = await getBagSummary(user._id);
    
    if (response.success) {
      const summary = response.data;
      
      if (summary) {
        setState(prev => ({
          ...prev,
          orderSummary: {
            itemCount: summary.itemCount || 0,
            subtotal: summary.subtotal || 0,
            discount: summary.discount || 0,
            shipping: summary.shipping || 0,
            tax: summary.tax || 0,
            total: summary.total || 0,
            savings: summary.savings || 0,
          },
          isLoading: false,
        }));
      } else {
        setState(prev => ({
          ...prev,
          isLoading: false,
        }));
        Alert.alert(
          "Error",
          "Order summary could not be loaded.",
          [
            { text: "Retry", onPress: fetchBagSummary },
            { text: "Cancel", onPress: () => router.back() }
          ]
        );
      }

      // If bag is empty, redirect back
      if (summary && (summary.itemCount || 0) === 0) {
        Alert.alert(
          "Empty Bag",
          "Your bag is empty. Add items before checkout.",
          [
            { text: "OK", onPress: () => router.push("/(tabs)/bag") }
          ]
        );
      }
    } else {
      throw new Error(handleApiError(response.error));
    }
  } catch (error: any) {
    console.error("Error fetching bag summary:", error);
    setState(prev => ({ ...prev, isLoading: false }));
    Alert.alert(
      "Error",
      error.message || "Failed to load order details. Please try again.",
      [
        { text: "Retry", onPress: fetchBagSummary },
        { text: "Cancel", onPress: () => router.back() }
      ]
    );
  }
};


  // Validation functions (keeping existing validation unchanged)
  const validateAddress = (address: Address): { [key: string]: string } => {
    const errors: { [key: string]: string } = {};

    if (!address.fullName.trim()) {
      errors.fullName = 'Full name is required';
    }

    if (!address.phone.trim()) {
      errors.phone = 'Phone number is required';
    } else if (!/^[6-9]\d{9}$/.test(address.phone)) {
      errors.phone = 'Please enter a valid 10-digit mobile number';
    }

    if (!address.addressLine1.trim()) {
      errors.addressLine1 = 'Address is required';
    }

    if (!address.city.trim()) {
      errors.city = 'City is required';
    }

    if (!address.state.trim()) {
      errors.state = 'State is required';
    }

    if (!address.pincode.trim()) {
      errors.pincode = 'Pincode is required';
    } else if (!/^[1-9][0-9]{5}$/.test(address.pincode)) {
      errors.pincode = 'Please enter a valid 6-digit pincode';
    }

    return errors;
  };

  const validatePayment = (payment: PaymentMethod): { [key: string]: string } => {
    const errors: { [key: string]: string } = {};

    if (payment.method === 'Credit Card' || payment.method === 'Debit Card') {
      if (!payment.cardNumber?.trim()) {
        errors.cardNumber = 'Card number is required';
      } else if (!/^\d{16}$/.test(payment.cardNumber.replace(/\s/g, ''))) {
        errors.cardNumber = 'Please enter a valid 16-digit card number';
      }

      if (!payment.expiryDate?.trim()) {
        errors.expiryDate = 'Expiry date is required';
      } else if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(payment.expiryDate)) {
        errors.expiryDate = 'Please enter a valid expiry date (MM/YY)';
      }

      if (!payment.cvv?.trim()) {
        errors.cvv = 'CVV is required';
      } else if (!/^\d{3,4}$/.test(payment.cvv)) {
        errors.cvv = 'Please enter a valid CVV';
      }

      if (!payment.cardHolderName?.trim()) {
        errors.cardHolderName = 'Cardholder name is required';
      }
    }

    if (payment.method === 'UPI') {
      if (!payment.upiId?.trim()) {
        errors.upiId = 'UPI ID is required';
      } else if (!/^[\w.-]+@[\w.-]+$/.test(payment.upiId)) {
        errors.upiId = 'Please enter a valid UPI ID';
      }
    }

    return errors;
  };

  // Handlers (keeping existing handlers unchanged)
  const handleAddressChange = (field: keyof Address, value: string, isShipping = true) => {
    setState(prev => ({
      ...prev,
      shippingAddress: isShipping 
        ? { ...prev.shippingAddress, [field]: value }
        : prev.shippingAddress,
      billingAddress: !isShipping || prev.useBillingAsShipping
        ? { ...prev.billingAddress, [field]: value }
        : prev.billingAddress,
      errors: {
        ...prev.errors,
        [`${isShipping ? 'shipping' : 'billing'}_${field}`]: '',
      },
    }));
  };

  const handlePaymentChange = (field: keyof PaymentMethod, value: string) => {
    setState(prev => ({
      ...prev,
      paymentMethod: { ...prev.paymentMethod, [field]: value },
      errors: { ...prev.errors, [`payment_${field}`]: '' },
    }));
  };

  const handleUseBillingAsShipping = (value: boolean) => {
    setState(prev => ({
      ...prev,
      useBillingAsShipping: value,
      billingAddress: value ? { ...prev.shippingAddress } : prev.billingAddress,
    }));
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  // ✅ UPDATED: Place order using centralized API
  const handlePlaceOrder = async () => {
    // Validate all fields
    const shippingErrors = validateAddress(state.shippingAddress);
    const billingErrors = state.useBillingAsShipping ? {} : validateAddress(state.billingAddress);
    const paymentErrors = validatePayment(state.paymentMethod);

    const allErrors = {
      ...Object.keys(shippingErrors).reduce((acc, key) => ({
        ...acc,
        [`shipping_${key}`]: shippingErrors[key]
      }), {}),
      ...Object.keys(billingErrors).reduce((acc, key) => ({
        ...acc,
        [`billing_${key}`]: billingErrors[key]
      }), {}),
      ...Object.keys(paymentErrors).reduce((acc, key) => ({
        ...acc,
        [`payment_${key}`]: paymentErrors[key]
      }), {}),
    };

    if (Object.keys(allErrors).length > 0) {
      setState(prev => ({ ...prev, errors: allErrors }));
      Alert.alert("Validation Error", "Please fix the errors before proceeding");
      return;
    }

    setState(prev => ({ ...prev, isPlacingOrder: true }));

    try {
      const orderData = {
        shippingAddress: state.shippingAddress,
        billingAddress: state.useBillingAsShipping ? state.shippingAddress : state.billingAddress,
        paymentMethod: state.paymentMethod.method,
        paymentGateway: state.paymentMethod.method !== 'COD' ? 'Razorpay' : null,
        customerNotes: state.specialInstructions,
        deliveryPreferences: {
          timeSlot: state.selectedDeliveryTime,
          instructions: state.specialInstructions,
          requireSignature: false,
          allowPartialDelivery: true,
        },
        analytics: {
          sourceChannel: 'mobile_app',
          campaign: '',
          referrer: 'checkout',
          deviceInfo: Platform.OS + ' ' + Platform.Version,
        }
      };

      // ✅ UPDATED: Use centralized createOrder function
      const response = await createOrder(user!._id, orderData);

      if (response.success) {
        // Order placed successfully
        Alert.alert(
          "Order Placed Successfully! 🎉",
          `Your order has been confirmed. Track it using: ${
            response.data?.trackingNumber || (response.data ? 'Order ID: ' + response.data._id : '')
          }`,
          [
            {
              text: "View Orders",
              onPress: () => router.push("/orders")
            },
            {
              text: "Continue Shopping",
              onPress: () => router.push("/(tabs)/categories")
            }
          ]
        );
      } else {
        throw new Error(handleApiError(response.error));
      }
    } catch (error: any) {
      console.error("Error placing order:", error);
      const errorMessage = error.message || "Failed to place order. Please try again.";
      Alert.alert("Order Failed", errorMessage);
    } finally {
      setState(prev => ({ ...prev, isPlacingOrder: false }));
    }
  };

  // Components (keeping all existing components unchanged)
  const InputField: React.FC<{
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    placeholder: string;
    error?: string;
    keyboardType?: any;
    maxLength?: number;
    multiline?: boolean;
    required?: boolean;
  }> = ({ 
    label, 
    value, 
    onChangeText, 
    placeholder, 
    error, 
    keyboardType = 'default',
    maxLength,
    multiline = false,
    required = false
  }) => (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
      <TextInput
        style={[
          styles.input,
          multiline && styles.multilineInput,
          error && styles.inputError
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#999"
        keyboardType={keyboardType}
        maxLength={maxLength}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
      {error && (
        <View style={styles.errorRow}>
          <AlertCircle size={14} color="#ff6b6b" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );

  const SectionHeader: React.FC<{ 
    title: string; 
    icon: React.ReactNode;
    step: number;
    isCompleted?: boolean;
  }> = ({ title, icon, step, isCompleted }) => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        <View style={[
          styles.stepNumber,
          isCompleted && styles.stepCompleted
        ]}>
          {isCompleted ? (
            <CheckCircle size={20} color="#4caf50" />
          ) : (
            <Text style={styles.stepText}>{step}</Text>
          )}
        </View>
        <View style={styles.sectionTitleContainer}>
          {icon}
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
      </View>
    </View>
  );

  if (!user) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#ff3f6c" />
      </View>
    );
  }

  if (state.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff3f6c" />
        <Text style={styles.loadingText}>Loading checkout details...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header */}
      <Animated.View 
        style={[
          styles.header,
          { opacity: fadeAnim }
        ]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={styles.secureIcon}>
          <Shield size={20} color="#4caf50" />
        </View>
      </Animated.View>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          {/* Delivery Address Section */}
          <View style={styles.section}>
            <SectionHeader
              step={1}
              title="Delivery Address"
              icon={<MapPin size={20} color="#ff3f6c" />}
            />
            
            <View style={styles.sectionContent}>
              <View style={styles.addressTypeSelector}>
                {(['Home', 'Office', 'Other'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.addressTypeChip,
                      state.shippingAddress.addressType === type && styles.activeAddressType
                    ]}
                    onPress={() => handleAddressChange('addressType', type)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.addressTypeText,
                      state.shippingAddress.addressType === type && styles.activeAddressTypeText
                    ]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
                  <InputField
                    label="Full Name"
                    value={state.shippingAddress.fullName}
                    onChangeText={(text) => handleAddressChange('fullName', text)}
                    placeholder="Enter full name"
                    error={state.errors.shipping_fullName}
                    required
                  />
                </View>
                <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
                  <InputField
                    label="Phone Number"
                    value={state.shippingAddress.phone}
                    onChangeText={(text) => handleAddressChange('phone', text)}
                    placeholder="10-digit mobile number"
                    keyboardType="phone-pad"
                    maxLength={10}
                    error={state.errors.shipping_phone}
                    required
                  />
                </View>
              </View>

              <InputField
                label="Address Line 1"
                value={state.shippingAddress.addressLine1}
                onChangeText={(text) => handleAddressChange('addressLine1', text)}
                placeholder="House/Flat/Office Number, Building Name"
                error={state.errors.shipping_addressLine1}
                required
              />

              <InputField
                label="Address Line 2"
                value={state.shippingAddress.addressLine2}
                onChangeText={(text) => handleAddressChange('addressLine2', text)}
                placeholder="Area, Street, Sector, Village (Optional)"
              />

              <InputField
                label="Landmark"
                value={state.shippingAddress.landmark}
                onChangeText={(text) => handleAddressChange('landmark', text)}
                placeholder="Nearby landmark (Optional)"
              />

              <View style={styles.inputRow}>
                <View style={[styles.inputContainer, { flex: 2, marginRight: 8 }]}>
                  <InputField
                    label="City"
                    value={state.shippingAddress.city}
                    onChangeText={(text) => handleAddressChange('city', text)}
                    placeholder="City"
                    error={state.errors.shipping_city}
                    required
                  />
                </View>
                <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
                  <InputField
                    label="Pincode"
                    value={state.shippingAddress.pincode}
                    onChangeText={(text) => handleAddressChange('pincode', text)}
                    placeholder="6-digit pincode"
                    keyboardType="number-pad"
                    maxLength={6}
                    error={state.errors.shipping_pincode}
                    required
                  />
                </View>
              </View>

              <InputField
                label="State"
                value={state.shippingAddress.state}
                onChangeText={(text) => handleAddressChange('state', text)}
                placeholder="State"
                error={state.errors.shipping_state}
                required
              />
            </View>
          </View>

          {/* Delivery Time Section */}
          <View style={styles.section}>
            <SectionHeader
              step={2}
              title="Delivery Time"
              icon={<Clock size={20} color="#ff3f6c" />}
            />
            
            <View style={styles.sectionContent}>
              {DELIVERY_TIME_SLOTS.map((slot) => (
                <TouchableOpacity
                  key={slot.value}
                  style={[
                    styles.deliverySlot,
                    state.selectedDeliveryTime === slot.value && styles.activeDeliverySlot
                  ]}
                  onPress={() => setState(prev => ({ 
                    ...prev, 
                    selectedDeliveryTime: slot.value 
                  }))}
                  activeOpacity={0.7}
                >
                  <Text style={styles.slotIcon}>{slot.icon}</Text>
                  <Text style={[
                    styles.slotLabel,
                    state.selectedDeliveryTime === slot.value && styles.activeSlotLabel
                  ]}>
                    {slot.label}
                  </Text>
                  {state.selectedDeliveryTime === slot.value && (
                    <CheckCircle size={20} color="#ff3f6c" />
                  )}
                </TouchableOpacity>
              ))}
              
              <InputField
                label="Special Instructions"
                value={state.specialInstructions}
                onChangeText={(text) => setState(prev => ({ 
                  ...prev, 
                  specialInstructions: text 
                }))}
                placeholder="Any special delivery instructions (Optional)"
                multiline
                maxLength={200}
              />
            </View>
          </View>

          {/* Payment Method Section */}
          <View style={styles.section}>
            <SectionHeader
              step={3}
              title="Payment Method"
              icon={<CreditCard size={20} color="#ff3f6c" />}
            />
            
            <View style={styles.sectionContent}>
              {PAYMENT_METHODS.map((method) => (
                <TouchableOpacity
                  key={method.value}
                  style={[
                    styles.paymentMethod,
                    state.paymentMethod.method === method.value && styles.activePaymentMethod
                  ]}
                  onPress={() => handlePaymentChange('method', method.value)}
                  activeOpacity={0.7}
                >
                  <View style={styles.paymentMethodLeft}>
                    <Text style={styles.paymentIcon}>{method.icon}</Text>
                    <View style={styles.paymentMethodInfo}>
                      <Text style={[
                        styles.paymentMethodLabel,
                        state.paymentMethod.method === method.value && styles.activePaymentMethodLabel
                      ]}>
                        {method.label}
                      </Text>
                      <Text style={styles.paymentMethodDescription}>
                        {method.description}
                      </Text>
                    </View>
                  </View>
                  {state.paymentMethod.method === method.value && (
                    <CheckCircle size={20} color="#ff3f6c" />
                  )}
                </TouchableOpacity>
              ))}

              {/* Card Details (if card payment selected) */}
              {(state.paymentMethod.method === 'Credit Card' || state.paymentMethod.method === 'Debit Card') && (
                <View style={styles.cardDetails}>
                  <InputField
                    label="Cardholder Name"
                    value={state.paymentMethod.cardHolderName || ''}
                    onChangeText={(text) => handlePaymentChange('cardHolderName', text)}
                    placeholder="Name on card"
                    error={state.errors.payment_cardHolderName}
                    required
                  />
                  
                  <InputField
                    label="Card Number"
                    value={state.paymentMethod.cardNumber || ''}
                    onChangeText={(text) => handlePaymentChange('cardNumber', formatCardNumber(text))}
                    placeholder="1234 5678 9012 3456"
                    keyboardType="number-pad"
                    maxLength={19}
                    error={state.errors.payment_cardNumber}
                    required
                  />
                  
                  <View style={styles.inputRow}>
                    <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
                      <InputField
                        label="Expiry Date"
                        value={state.paymentMethod.expiryDate || ''}
                        onChangeText={(text) => {
                          let formatted = text.replace(/\D/g, '');
                          if (formatted.length >= 2) {
                            formatted = formatted.substring(0, 2) + '/' + formatted.substring(2, 4);
                          }
                          handlePaymentChange('expiryDate', formatted);
                        }}
                        placeholder="MM/YY"
                        keyboardType="number-pad"
                        maxLength={5}
                        error={state.errors.payment_expiryDate}
                        required
                      />
                    </View>
                    <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
                      <InputField
                        label="CVV"
                        value={state.paymentMethod.cvv || ''}
                        onChangeText={(text) => handlePaymentChange('cvv', text)}
                        placeholder="123"
                        keyboardType="number-pad"
                        maxLength={4}
                        error={state.errors.payment_cvv}
                        required
                      />
                    </View>
                  </View>
                </View>
              )}

              {/* UPI Details (if UPI selected) */}
              {state.paymentMethod.method === 'UPI' && (
                <View style={styles.upiDetails}>
                  <InputField
                    label="UPI ID"
                    value={state.paymentMethod.upiId || ''}
                    onChangeText={(text) => handlePaymentChange('upiId', text)}
                    placeholder="yourname@paytm"
                    keyboardType="email-address"
                    error={state.errors.payment_upiId}
                    required
                  />
                </View>
              )}
            </View>
          </View>

          {/* Order Summary Section */}
          <View style={styles.section}>
            <SectionHeader
              step={4}
              title="Order Summary"
              icon={<Package size={20} color="#ff3f6c" />}
            />
            
            <View style={styles.orderSummary}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  Subtotal ({state.orderSummary.itemCount} item{state.orderSummary.itemCount !== 1 ? 's' : ''})
                </Text>
                <Text style={styles.summaryValue}>₹{state.orderSummary.subtotal}</Text>
              </View>

              {state.orderSummary.discount > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: '#4caf50' }]}>Discount</Text>
                  <Text style={[styles.summaryValue, { color: '#4caf50' }]}>
                    -₹{state.orderSummary.discount}
                  </Text>
                </View>
              )}

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Delivery Charges</Text>
                <Text style={[
                  styles.summaryValue,
                  state.orderSummary.shipping === 0 && { color: '#4caf50' }
                ]}>
                  {state.orderSummary.shipping === 0 ? 'FREE' : `₹${state.orderSummary.shipping}`}
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Taxes & Fees</Text>
                <Text style={styles.summaryValue}>₹{state.orderSummary.tax}</Text>
              </View>

              <View style={styles.summaryDivider} />

              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total Amount</Text>
                <Text style={styles.totalValue}>₹{state.orderSummary.total}</Text>
              </View>

              {state.orderSummary.savings > 0 && (
                <View style={styles.savingsRow}>
                  <Text style={styles.savingsText}>
                    You saved ₹{state.orderSummary.savings} on this order! 🎉
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Reserved Sections */}
          <View style={styles.section}>
            <View style={styles.reservedSection}>
              <Gift size={20} color="#ff3f6c" />
              <Text style={styles.reservedText}>Offers & Coupons (Coming Soon)</Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Place Order Button */}
      <Animated.View 
        style={[
          styles.footer,
          {
            opacity: fadeAnim,
            transform: [{
              translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [100, 0],
              })
            }]
          }
        ]}
      >
        <TouchableOpacity
          style={[
            styles.placeOrderButton,
            state.isPlacingOrder && styles.placeOrderButtonDisabled
          ]}
          onPress={handlePlaceOrder}
          disabled={state.isPlacingOrder}
          activeOpacity={0.8}
        >
          {state.isPlacingOrder ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Truck size={20} color="#fff" />
          )}
          <Text style={styles.placeOrderButtonText}>
            {state.isPlacingOrder ? 'PLACING ORDER...' : `PLACE ORDER • ₹${state.orderSummary.total}`}
          </Text>
        </TouchableOpacity>
        
        <View style={styles.securityNote}>
          <Shield size={16} color="#4caf50" />
          <Text style={styles.securityText}>
            Your payment information is secure and encrypted
          </Text>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  secureIcon: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ff3f6c',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stepCompleted: {
    backgroundColor: '#4caf50',
  },
  stepText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  sectionContent: {
    padding: 16,
  },
  addressTypeSelector: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  addressTypeChip: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
    backgroundColor: '#f8f9fa',
  },
  activeAddressType: {
    borderColor: '#ff3f6c',
    backgroundColor: '#fff5f7',
  },
  addressTypeText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeAddressTypeText: {
    color: '#ff3f6c',
    fontWeight: '600',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  required: {
    color: '#ff3f6c',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',
  },
  multilineInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: '#ff6b6b',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#ff6b6b',
    marginLeft: 4,
  },
  deliverySlot: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#f8f9fa',
  },
  activeDeliverySlot: {
    borderColor: '#ff3f6c',
    backgroundColor: '#fff5f7',
  },
  slotIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  slotLabel: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  activeSlotLabel: {
    color: '#ff3f6c',
    fontWeight: '600',
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#f8f9fa',
  },
  activePaymentMethod: {
    borderColor: '#ff3f6c',
    backgroundColor: '#fff5f7',
  },
  paymentMethodLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  paymentIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  paymentMethodInfo: {
    flex: 1,
  },
  paymentMethodLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  activePaymentMethodLabel: {
    color: '#ff3f6c',
  },
  paymentMethodDescription: {
    fontSize: 12,
    color: '#666',
  },
  cardDetails: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#fff5f7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ff3f6c',
  },
  upiDetails: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#fff5f7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ff3f6c',
  },
  orderSummary: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginHorizontal: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 12,
  },
  totalRow: {
    paddingVertical: 12,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ff3f6c',
  },
  savingsRow: {
    backgroundColor: '#e8f5e8',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginTop: 8,
  },
  savingsText: {
    fontSize: 14,
    color: '#4caf50',
    fontWeight: '600',
    textAlign: 'center',
  },
  reservedSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    marginHorizontal: 16,
  },
  reservedText: {
    fontSize: 16,
    color: '#999',
    marginLeft: 8,
    fontStyle: 'italic',
  },
  footer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 10,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  placeOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff3f6c',
    paddingVertical: 16,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#ff3f6c',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  placeOrderButtonDisabled: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
    elevation: 0,
  },
  placeOrderButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 6,
  },
});
