import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { X, Tag, Copy, Gift, Clock, CheckCircle } from 'lucide-react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Types
interface Coupon {
  id: string;
  name: string;
  description: string;
  discount: number;
  discountType: 'percentage' | 'fixed' | 'shipping' | 'bogo' | 'cashback';
  threshold: number;
  maxDiscount?: number;
  validUpto: string;
  isActive: boolean;
  priority: number;
  reasons?: string[];
  calculatedDiscount?: number;
  finalTotal?: number;
  isApplicable?: boolean;
  categories?: string[];
  paymentMethods?: string[];
}

interface CouponOverlayProps {
  visible: boolean;
  onClose: () => void;
  onApplyCoupon: (couponCode: string) => void;
  coupons: Coupon[];
  expiredCoupons?: Coupon[];
  loading?: boolean;
  currentTotal: number;
  appliedCouponCode?: string;
}

export default function CouponOverlay({
  visible,
  onClose,
  onApplyCoupon,
  coupons,
  expiredCoupons = [],
  loading = false,
  currentTotal,
  appliedCouponCode
}: CouponOverlayProps) {

  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Handle copy to clipboard
  const handleCopyCode = (code: string) => {
    // For React Native, you might want to use @react-native-clipboard/clipboard
    // For now, we'll use a simple alert
    setCopiedCode(code);
    Alert.alert('Copied!', `Coupon code ${code} copied to clipboard`);
    
    // Reset copied state after 2 seconds
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Handle coupon application
  const handleApplyCoupon = (coupon: Coupon) => {
    if (!coupon.isApplicable) {
      const reason = coupon.reasons?.[0] || 'This coupon cannot be applied';
      Alert.alert('Cannot Apply Coupon', reason);
      return;
    }

    if (appliedCouponCode === coupon.name) {
      Alert.alert('Already Applied', 'This coupon is already applied to your order');
      return;
    }

    onApplyCoupon(coupon.name);
    onClose();
  };

  // Check if coupon is expired
  const isCouponExpired = (coupon: Coupon) => {
    const now = new Date();
    const expiryDate = new Date(coupon.validUpto);
    return !coupon.isActive || expiryDate < now;
  };

  // Get discount display text
  const getDiscountText = (coupon: Coupon) => {
    switch (coupon.discountType) {
      case 'percentage':
        return `${coupon.discount}% OFF`;
      case 'fixed':
        return `₹${coupon.discount} OFF`;
      case 'shipping':
        return 'FREE SHIP';
      case 'bogo':
        return 'BOGO';
      case 'cashback':
        return `₹${coupon.discount} BACK`;
      default:
        return 'DISCOUNT';
    }
  };

  // Render individual coupon card
  const renderCouponCard = (coupon: Coupon, isExpired: boolean = false) => {
    const canApply = !isExpired && coupon.isApplicable && coupon.isActive;
    const alreadyApplied = appliedCouponCode === coupon.name;
    const discountText = getDiscountText(coupon);

    return (
      <View
        key={coupon.id}
        style={[
          styles.couponCard,
          isExpired && styles.expiredCouponCard,
          !canApply && !isExpired && styles.ineligibleCouponCard,
          alreadyApplied && styles.appliedCouponCard,
        ]}
      >
        {/* Left side - Discount Badge */}
        <View style={[styles.couponLeft, isExpired && styles.expiredCouponLeft]}>
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{discountText}</Text>
          </View>
          {alreadyApplied && (
            <View style={styles.appliedIndicator}>
              <CheckCircle size={16} color="#4CAF50" />
            </View>
          )}
        </View>

        {/* Right side - Coupon Details */}
        <View style={styles.couponRight}>
          <View style={styles.couponInfo}>
            <Text style={[styles.couponCode, isExpired && styles.expiredText]}>
              {coupon.name}
            </Text>
            <Text style={[styles.couponDescription, isExpired && styles.expiredText]}>
              {coupon.description}
            </Text>
            
            <View style={styles.couponDetails}>
              <Text style={[styles.detailText, isExpired && styles.expiredText]}>
                Min order: ₹{coupon.threshold}
              </Text>
              {coupon.maxDiscount && (
                <Text style={[styles.detailText, isExpired && styles.expiredText]}>
                  Max discount: ₹{coupon.maxDiscount}
                </Text>
              )}
              <Text style={[styles.detailText, isExpired && styles.expiredText]}>
                Valid till: {new Date(coupon.validUpto).toLocaleDateString()}
              </Text>
            </View>

            {/* Show reasons if not applicable */}
            {coupon.reasons && coupon.reasons.length > 0 && !isExpired && (
              <Text style={styles.reasonText}>
                * {coupon.reasons.join(', ')}
              </Text>
            )}

            {/* Show calculated savings if applicable */}
            {coupon.calculatedDiscount && coupon.calculatedDiscount > 0 && canApply && (
              <Text style={styles.savingsText}>
                You'll save ₹{coupon.calculatedDiscount}
              </Text>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              onPress={() => handleCopyCode(coupon.name)}
              style={[styles.copyButton, copiedCode === coupon.name && styles.copiedButton]}
              activeOpacity={0.7}
            >
              <Copy size={16} color={copiedCode === coupon.name ? "#4CAF50" : "#666"} />
              <Text style={[styles.copyButtonText, copiedCode === coupon.name && styles.copiedButtonText]}>
                {copiedCode === coupon.name ? 'Copied' : 'Copy'}
              </Text>
            </TouchableOpacity>

            {alreadyApplied ? (
              <View style={[styles.applyButton, styles.appliedButton]}>
                <CheckCircle size={16} color="#4CAF50" />
                <Text style={styles.appliedButtonText}>Applied</Text>
              </View>
            ) : canApply ? (
              <TouchableOpacity
                onPress={() => handleApplyCoupon(coupon)}
                style={styles.applyButton}
                activeOpacity={0.8}
              >
                <Text style={styles.applyButtonText}>APPLY</Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.applyButton, styles.disabledButton]}>
                <Text style={[styles.applyButtonText, styles.disabledButtonText]}>
                  {isExpired ? 'EXPIRED' : 'NOT ELIGIBLE'}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      statusBarTranslucent={false}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Gift size={24} color="#ff3f6c" />
            <Text style={styles.title}>Available Coupons</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#333" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ff3f6c" />
            <Text style={styles.loadingText}>Loading coupons...</Text>
          </View>
        ) : (
          <ScrollView 
            style={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Current Order Summary */}
            <View style={styles.orderSummary}>
              <Text style={styles.orderSummaryTitle}>Current Order Total</Text>
              <Text style={styles.orderSummaryAmount}>₹{currentTotal.toLocaleString()}</Text>
            </View>

            {/* Available Coupons Section */}
            {coupons.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Available Coupons</Text>
                  <View style={styles.sectionBadge}>
                    <Text style={styles.sectionBadgeText}>{coupons.length}</Text>
                  </View>
                </View>
                {coupons.map(coupon => renderCouponCard(coupon, false))}
              </View>
            )}

            {/* Expired Coupons Section */}
            {expiredCoupons.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Clock size={20} color="#999" />
                  <Text style={[styles.sectionTitle, styles.expiredSectionTitle]}>
                    Expired Coupons
                  </Text>
                  <View style={[styles.sectionBadge, styles.expiredSectionBadge]}>
                    <Text style={styles.expiredSectionBadgeText}>{expiredCoupons.length}</Text>
                  </View>
                </View>
                {expiredCoupons.map(coupon => renderCouponCard(coupon, true))}
              </View>
            )}

            {/* Empty State */}
            {coupons.length === 0 && expiredCoupons.length === 0 && (
              <View style={styles.emptyState}>
                <Tag size={80} color="#ddd" />
                <Text style={styles.emptyTitle}>No Coupons Available</Text>
                <Text style={styles.emptyText}>
                  Check back later for amazing deals and discounts!
                </Text>
              </View>
            )}

            {/* Bottom Spacing */}
            <View style={styles.bottomSpacing} />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginLeft: 8,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
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
    fontWeight: '500',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  orderSummary: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  orderSummaryTitle: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  orderSummaryAmount: {
    fontSize: 20,
    color: '#333',
    fontWeight: '700',
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  expiredSectionTitle: {
    color: '#999',
  },
  sectionBadge: {
    backgroundColor: '#ff3f6c',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  expiredSectionBadge: {
    backgroundColor: '#ccc',
  },
  sectionBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  expiredSectionBadgeText: {
    color: '#666',
  },
  couponCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  expiredCouponCard: {
    backgroundColor: '#f5f5f5',
    opacity: 0.7,
  },
  ineligibleCouponCard: {
    backgroundColor: '#fff9e6',
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  appliedCouponCard: {
    backgroundColor: '#f0f8f0',
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  couponLeft: {
    width: 100,
    backgroundColor: '#ff3f6c',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  expiredCouponLeft: {
    backgroundColor: '#ccc',
  },
  discountBadge: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  discountText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  appliedIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 2,
  },
  couponRight: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  couponInfo: {
    flex: 1,
  },
  couponCode: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  couponDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  couponDetails: {
    marginBottom: 8,
  },
  detailText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  expiredText: {
    color: '#aaa',
  },
  reasonText: {
    fontSize: 12,
    color: '#ff6b35',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  savingsText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
    marginBottom: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  copiedButton: {
    backgroundColor: '#e8f5e8',
  },
  copyButtonText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
    fontWeight: '500',
  },
  copiedButtonText: {
    color: '#4CAF50',
  },
  applyButton: {
    backgroundColor: '#ff3f6c',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    minWidth: 80,
  },
  appliedButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
  },
  disabledButton: {
    backgroundColor: '#ddd',
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  appliedButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  disabledButtonText: {
    color: '#999',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#999',
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#bbb',
    textAlign: 'center',
    lineHeight: 24,
  },
  bottomSpacing: {
    height: 20,
  },
});
