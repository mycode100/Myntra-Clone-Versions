import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { Tag, ArrowRight, Gift, TrendingUp } from 'lucide-react-native';

const { width: screenWidth } = Dimensions.get('window');

// Types matching your backend structure
interface ThresholdCoupon {
  id: string;
  name: string;
  description: string;
  discount: number;
  discountType: 'percentage' | 'fixed' | 'shipping' | 'bogo' | 'cashback';
  threshold: number;
  maxDiscount?: number;
  validUpto: string;
  priority: number;
}

interface ThresholdSuggestion {
  coupon: ThresholdCoupon;
  amountNeeded: number;
  potentialSavings: number;
}

interface CouponThresholdMessageProps {
  currentTotal: number;
  suggestion: ThresholdSuggestion | null;
  onPressViewCoupons: () => void;
  loading?: boolean;
}

export default function CouponThresholdMessage({
  currentTotal,
  suggestion,
  onPressViewCoupons,
  loading = false
}: CouponThresholdMessageProps) {
  
  const [visible, setVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-50)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Show/hide animation
  useEffect(() => {
    if (suggestion && suggestion.amountNeeded > 0 && suggestion.amountNeeded <= 3000) {
      setVisible(true);
      
      // Animate entrance
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();

      // Animate progress bar
      const progressValue = Math.max(0, Math.min(1, currentTotal / suggestion.coupon.threshold));
      Animated.timing(progressAnim, {
        toValue: progressValue,
        duration: 800,
        useNativeDriver: false,
      }).start();
      
    } else {
      // Animate exit
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: -50,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setVisible(false);
      });
    }
  }, [suggestion, currentTotal]);

  if (!visible || !suggestion || loading) {
    return null;
  }

  const { coupon, amountNeeded, potentialSavings } = suggestion;

  // Get discount display text
  const getDiscountText = () => {
    switch (coupon.discountType) {
      case 'percentage':
        return `${coupon.discount}% OFF`;
      case 'fixed':
        return `₹${coupon.discount} OFF`;
      case 'shipping':
        return 'FREE SHIPPING';
      case 'bogo':
        return 'BOGO OFFER';
      case 'cashback':
        return `₹${coupon.discount} CASHBACK`;
      default:
        return 'SPECIAL OFFER';
    }
  };

  // Calculate progress percentage
  const progressPercentage = Math.max(0, Math.min(100, (currentTotal / coupon.threshold) * 100));

  // Get appropriate icon based on coupon type
  const getIcon = () => {
    if (coupon.discountType === 'shipping') {
      return <TrendingUp size={20} color="#ff3f6c" />;
    }
    return <Tag size={20} color="#ff3f6c" />;
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {/* Main Content */}
      <View style={styles.content}>
        {/* Left Icon */}
        <View style={styles.iconContainer}>
          {getIcon()}
        </View>

        {/* Message Content */}
        <View style={styles.messageContent}>
          <Text style={styles.mainMessage}>
            Add ₹{amountNeeded.toLocaleString()} more to unlock
          </Text>
          <Text style={styles.couponName}>
            {coupon.name} • {getDiscountText()}
          </Text>
          
          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              ₹{currentTotal.toLocaleString()} / ₹{coupon.threshold.toLocaleString()}
            </Text>
          </View>

          {/* Savings Info */}
          {potentialSavings > 0 && (
            <Text style={styles.savingsText}>
              💰 You'll save ₹{potentialSavings.toLocaleString()}
            </Text>
          )}
        </View>

        {/* Action Button */}
        <TouchableOpacity
          onPress={onPressViewCoupons}
          style={styles.actionButton}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>View</Text>
          <ArrowRight size={14} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Decorative Elements */}
      <View style={styles.decorativeElements}>
        <Gift size={12} color="#ffccd5" style={styles.decorativeIcon1} />
        <Gift size={8} color="#ffccd5" style={styles.decorativeIcon2} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff4f6',
    borderLeftWidth: 4,
    borderLeftColor: '#ff3f6c',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    shadowColor: '#ff3f6c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff3f6c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  messageContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  mainMessage: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    marginBottom: 4,
  },
  couponName: {
    fontSize: 12,
    color: '#ff3f6c',
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  progressContainer: {
    marginBottom: 6,
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#ffccd5',
    borderRadius: 2,
    marginBottom: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ff3f6c',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 10,
    color: '#666',
    fontWeight: '500',
  },
  savingsText: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '600',
    marginTop: 4,
  },
  actionButton: {
    backgroundColor: '#ff3f6c',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#ff3f6c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginRight: 4,
  },
  decorativeElements: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  decorativeIcon1: {
    position: 'absolute',
    top: 8,
    right: 60,
    opacity: 0.3,
  },
  decorativeIcon2: {
    position: 'absolute',
    bottom: 8,
    right: 20,
    opacity: 0.2,
  },
});
