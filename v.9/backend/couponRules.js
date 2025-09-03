const fs = require('fs');
const path = require('path');

// ✅ FIXED: Enhanced error handling and logging
const loadCoupons = () => {
  try {
    const couponsPath = path.join(__dirname, 'coupons.json');
    console.log('📂 Loading coupons from:', couponsPath);
    
    if (!fs.existsSync(couponsPath)) {
      console.warn('⚠️ Coupons file not found:', couponsPath);
      return [];
    }

    const couponsData = fs.readFileSync(couponsPath, 'utf8');
    const parsedData = JSON.parse(couponsData);
    const coupons = parsedData.coupons || [];
    
    console.log('✅ Loaded', coupons.length, 'coupons from JSON file');
    return coupons;
  } catch (error) {
    console.error('❌ Error loading coupons:', error.message);
    return [];
  }
};

// Coupon Rule Engine Class
class CouponRuleEngine {
  
  static getAllCoupons() {
    return loadCoupons();
  }

  static getActiveCoupons() {
    const allCoupons = loadCoupons();
    const now = new Date();
    
    const activeCoupons = allCoupons.filter(coupon => {
      try {
        const validFrom = new Date(coupon.validFrom);
        const validUpto = new Date(coupon.validUpto);
        
        return coupon.isActive && 
               now >= validFrom && 
               now <= validUpto &&
               (!coupon.usageLimit || coupon.used < coupon.usageLimit);
      } catch (error) {
        console.error('❌ Error validating coupon dates:', coupon.id, error);
        return false;
      }
    });

    console.log('🎟️ Active coupons:', activeCoupons.length, 'out of', allCoupons.length);
    return activeCoupons;
  }

  // ✅ FIXED: validateCoupon method with proper context
  static validateCoupon(coupon, cartState, userState = {}) {
    try {
      const now = new Date();
      const validFrom = new Date(coupon.validFrom);
      const validUpto = new Date(coupon.validUpto);

      const validationResult = {
        isValid: false,
        reasons: [],
        discountAmount: 0,
        finalTotal: cartState.total || 0
      };

      if (!coupon.isActive) {
        validationResult.reasons.push('Coupon is not active');
        return validationResult;
      }

      if (now < validFrom || now > validUpto) {
        validationResult.reasons.push('Coupon has expired or not yet valid');
        return validationResult;
      }

      if (coupon.usageLimit && coupon.used >= coupon.usageLimit) {
        validationResult.reasons.push('Coupon usage limit reached');
        return validationResult;
      }

      if (cartState.total < coupon.threshold) {
        validationResult.reasons.push(`Minimum order value ₹${coupon.threshold} required`);
        return validationResult;
      }

      // ✅ FIXED: Enhanced conditions validation
      if (coupon.conditions) {
        const conditions = coupon.conditions;

        if (conditions.cartValue) {
          if (conditions.cartValue.min && cartState.total < conditions.cartValue.min) {
            validationResult.reasons.push(`Minimum cart value ₹${conditions.cartValue.min} required`);
            return validationResult;
          }
          if (conditions.cartValue.max && cartState.total > conditions.cartValue.max) {
            validationResult.reasons.push(`Maximum cart value ₹${conditions.cartValue.max} exceeded`);
            return validationResult;
          }
        }

        if (conditions.itemCount && cartState.items) {
          const totalItems = cartState.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
          if (conditions.itemCount.min && totalItems < conditions.itemCount.min) {
            validationResult.reasons.push(`Minimum ${conditions.itemCount.min} items required`);
            return validationResult;
          }
          if (conditions.itemCount.max && totalItems > conditions.itemCount.max) {
            validationResult.reasons.push(`Maximum ${conditions.itemCount.max} items allowed`);
            return validationResult;
          }
        }

        if (conditions.userType && userState.type !== conditions.userType) {
          validationResult.reasons.push(`This coupon is only for ${conditions.userType} users`);
          return validationResult;
        }

        // ✅ FIXED: Time restriction validation with proper context
        if (conditions.timeRestriction) {
          if (!CouponRuleEngine.isValidTime(conditions.timeRestriction)) {
            validationResult.reasons.push('Coupon not valid at this time');
            return validationResult;
          }
        }

        if (conditions.dayRestriction && conditions.dayRestriction.length > 0) {
          const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
          if (!conditions.dayRestriction.includes(currentDay)) {
            validationResult.reasons.push(`Coupon only valid on ${conditions.dayRestriction.join(', ')}`);
            return validationResult;
          }
        }
      }

      if (coupon.paymentMethods && coupon.paymentMethods.length > 0 && userState.paymentMethod) {
        if (!coupon.paymentMethods.includes(userState.paymentMethod)) {
          validationResult.reasons.push(`Payment method ${userState.paymentMethod} not supported`);
          return validationResult;
        }
      }

      if (coupon.categories && coupon.categories.length > 0 && cartState.items) {
        const hasValidCategory = cartState.items.some(item => 
          coupon.categories.includes(item.category)
        );
        if (!hasValidCategory) {
          validationResult.reasons.push(`Coupon only applicable to ${coupon.categories.join(', ')} categories`);
          return validationResult;
        }
      }

      // ✅ FIXED: Calculate discount with proper context
      const discountAmount = CouponRuleEngine.calculateDiscount(coupon, cartState);
      const finalTotal = Math.max(0, cartState.total - discountAmount);

      validationResult.isValid = true;
      validationResult.discountAmount = discountAmount;
      validationResult.finalTotal = finalTotal;

      return validationResult;
    } catch (error) {
      console.error('❌ Error validating coupon:', coupon.id, error);
      return {
        isValid: false,
        reasons: ['Error validating coupon'],
        discountAmount: 0,
        finalTotal: cartState.total || 0
      };
    }
  }

  static calculateDiscount(coupon, cartState) {
    try {
      let discountAmount = 0;

      switch (coupon.discountType) {
        case 'percentage':
          discountAmount = (cartState.total * coupon.discount) / 100;
          if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
            discountAmount = coupon.maxDiscount;
          }
          break;

        case 'fixed':
          discountAmount = coupon.discount;
          break;

        case 'shipping':
          discountAmount = cartState.shippingCost || 40;
          break;

        case 'bogo':
          if (cartState.items && cartState.items.length >= 2) {
            const sortedItems = cartState.items.sort((a, b) => a.price - b.price);
            discountAmount = (sortedItems[0].price * coupon.discount) / 100;
          }
          break;

        case 'cashback':
          discountAmount = coupon.discount;
          break;

        default:
          discountAmount = 0;
      }

      return Math.min(discountAmount, cartState.total);
    } catch (error) {
      console.error('❌ Error calculating discount:', coupon.id, error);
      return 0;
    }
  }

  static findApplicableCoupons(cartState, userState = {}) {
    const activeCoupons = CouponRuleEngine.getActiveCoupons();
    const applicableCoupons = [];

    activeCoupons.forEach(coupon => {
      const validation = CouponRuleEngine.validateCoupon(coupon, cartState, userState);
      if (validation.isValid) {
        applicableCoupons.push({
          ...coupon,
          calculatedDiscount: validation.discountAmount,
          finalTotal: validation.finalTotal
        });
      }
    });

    return applicableCoupons.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return b.calculatedDiscount - a.calculatedDiscount;
    });
  }

  static getThresholdSuggestions(cartState, userState = {}) {
    const allCoupons = CouponRuleEngine.getActiveCoupons();
    const suggestions = [];

    allCoupons.forEach(coupon => {
      try {
        const tempValidation = CouponRuleEngine.validateCoupon(coupon, cartState, userState);
        
        if (!tempValidation.isValid && 
            tempValidation.reasons.length === 1 && 
            tempValidation.reasons[0].includes('Minimum order value')) {
          
          const amountNeeded = coupon.threshold - cartState.total;
          if (amountNeeded > 0 && amountNeeded <= 2000) {
            suggestions.push({
              coupon,
              amountNeeded,
              potentialSavings: CouponRuleEngine.calculateDiscount(coupon, {
                ...cartState,
                total: coupon.threshold
              })
            });
          }
        }
      } catch (error) {
        console.error('❌ Error processing threshold suggestion:', coupon.id, error);
      }
    });

    return suggestions.sort((a, b) => {
      if (Math.abs(a.amountNeeded - b.amountNeeded) < 50) {
        return b.potentialSavings - a.potentialSavings;
      }
      return a.amountNeeded - b.amountNeeded;
    });
  }

  static getBestThresholdSuggestion(cartState, userState = {}) {
    const suggestions = CouponRuleEngine.getThresholdSuggestions(cartState, userState);
    return suggestions.length > 0 ? suggestions[0] : null;
  }

  static isValidTime(timeRestriction) {
    if (!timeRestriction.start || !timeRestriction.end) return true;

    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);

    const startTime = timeRestriction.start;
    const endTime = timeRestriction.end;

    if (startTime > endTime) {
      return currentTime >= startTime || currentTime <= endTime;
    } else {
      return currentTime >= startTime && currentTime <= endTime;
    }
  }

  static getCouponById(couponId) {
    const allCoupons = CouponRuleEngine.getAllCoupons();
    return allCoupons.find(coupon => coupon.id === couponId);
  }

  static isCouponCodeValid(code) {
    const allCoupons = CouponRuleEngine.getAllCoupons();
    return allCoupons.some(coupon => coupon.name === code.toUpperCase());
  }

  static getExpiredCoupons() {
    const allCoupons = loadCoupons();
    const now = new Date();
    
    return allCoupons.filter(coupon => {
      try {
        const validUpto = new Date(coupon.validUpto);
        return now > validUpto || !coupon.isActive;
      } catch (error) {
        console.error('❌ Error checking expired coupon:', coupon.id, error);
        return true; // Consider it expired if there's an error
      }
    });
  }

  static getCouponsByCategory(category) {
    const activeCoupons = CouponRuleEngine.getActiveCoupons();
    return activeCoupons.filter(coupon => 
      !coupon.categories || !coupon.categories.length || coupon.categories.includes(category)
    );
  }

  static getCouponsByPaymentMethod(paymentMethod) {
    const activeCoupons = CouponRuleEngine.getActiveCoupons();
    return activeCoupons.filter(coupon => 
      !coupon.paymentMethods || !coupon.paymentMethods.length || coupon.paymentMethods.includes(paymentMethod)
    );
  }

  static getAutoApplyCoupon(cartState, userState = {}) {
    const applicableCoupons = CouponRuleEngine.findApplicableCoupons(cartState, userState);
    const autoApplyCoupons = applicableCoupons.filter(coupon => 
      coupon.autoApply || coupon.priority === 1
    );
    return autoApplyCoupons.length > 0 ? autoApplyCoupons[0] : null;
  }

  static getCouponUsageStats(couponId) {
    const coupon = CouponRuleEngine.getCouponById(couponId);
    if (!coupon) return null;

    return {
      id: coupon.id,
      name: coupon.name,
      used: coupon.used,
      usageLimit: coupon.usageLimit,
      usagePercentage: coupon.usageLimit ? (coupon.used / coupon.usageLimit) * 100 : 0,
      isActive: coupon.isActive,
      daysUntilExpiry: Math.ceil((new Date(coupon.validUpto) - new Date()) / (1000 * 60 * 60 * 24))
    };
  }

  static formatCouponForDisplay(coupon, cartState = null, userState = {}) {
    try {
      const formatted = {
        id: coupon.id,
        name: coupon.name,
        description: coupon.description,
        discount: coupon.discount,
        discountType: coupon.discountType,
        threshold: coupon.threshold,
        maxDiscount: coupon.maxDiscount,
        validUpto: coupon.validUpto,
        isActive: coupon.isActive,
        priority: coupon.priority
      };

      if (cartState) {
        const validation = CouponRuleEngine.validateCoupon(coupon, cartState, userState);
        formatted.isApplicable = validation.isValid;
        formatted.reasons = validation.reasons;
        formatted.calculatedDiscount = validation.discountAmount;
        formatted.finalTotal = validation.finalTotal;
      }

      return formatted;
    } catch (error) {
      console.error('❌ Error formatting coupon for display:', coupon.id, error);
      return {
        ...coupon,
        isApplicable: false,
        reasons: ['Error formatting coupon']
      };
    }
  }

  static incrementUsageCount(couponId) {
    try {
      const couponsPath = path.join(__dirname, 'coupons.json');
      const couponsData = JSON.parse(fs.readFileSync(couponsPath, 'utf8'));
      
      const couponIndex = couponsData.coupons.findIndex(c => c.id === couponId);
      if (couponIndex !== -1) {
        couponsData.coupons[couponIndex].used += 1;
        fs.writeFileSync(couponsPath, JSON.stringify(couponsData, null, 2));
        console.log('✅ Incremented usage count for coupon:', couponId);
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Error incrementing usage count:', error);
      return false;
    }
  }

  static decrementUsageCount(couponId) {
    try {
      const couponsPath = path.join(__dirname, 'coupons.json');
      const couponsData = JSON.parse(fs.readFileSync(couponsPath, 'utf8'));
      
      const couponIndex = couponsData.coupons.findIndex(c => c.id === couponId);
      if (couponIndex !== -1 && couponsData.coupons[couponIndex].used > 0) {
        couponsData.coupons[couponIndex].used -= 1;
        fs.writeFileSync(couponsPath, JSON.stringify(couponsData, null, 2));
        console.log('✅ Decremented usage count for coupon:', couponId);
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Error decrementing usage count:', error);
      return false;
    }
  }
}

module.exports = CouponRuleEngine;
