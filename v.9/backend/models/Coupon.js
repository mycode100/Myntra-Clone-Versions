const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    minlength: 3,
    maxlength: 20
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  discount_type: {
    type: String,
    enum: ['percentage', 'fixed', 'shipping', 'bogo', 'cashback'],
    required: true
  },
  discount_value: {
    type: Number,
    required: true,
    min: 0
  },
  min_cart_value: {
    type: Number,
    default: 0,
    min: 0
  },
  max_discount_amount: {
    type: Number,
    default: null // null means no maximum limit
  },
  expiry_date: {
    type: Date,
    required: true
  },
  usage_limit: {
    type: Number,
    default: null // null means unlimited usage
  },
  used_count: {
    type: Number,
    default: 0,
    min: 0
  },
  user_usage_limit: {
    type: Number,
    default: 1 // How many times one user can use this coupon
  },
  active: {
    type: Boolean,
    default: true
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  applicable_categories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],
  applicable_products: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  used_by: [{
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    usage_count: {
      type: Number,
      default: 1
    },
    used_dates: [{
      type: Date,
      default: Date.now
    }]
  }],

  // ✅ NEW ENHANCED FIELDS
  priority: {
    type: Number,
    default: 3,
    min: 1,
    max: 5 // 1 = highest priority, 5 = lowest priority
  },
  payment_methods: [{
    type: String,
    enum: ['UPI', 'Card', 'Wallet', 'COD'],
    default: []
  }],
  stackable: {
    type: Boolean,
    default: false // Single coupon system
  },
  conditions: {
    cart_value: {
      min: { type: Number, default: null },
      max: { type: Number, default: null }
    },
    item_count: {
      min: { type: Number, default: null },
      max: { type: Number, default: null }
    },
    user_type: {
      type: String,
      enum: ['new', 'loyal', 'premium', 'vip', 'student', 'birthday', 'referral', 'returning', 'first_purchase', 'social_follower', 'affiliate', 'influencer_referred', 'survey_completed', 'subscriber', 'gold_member', 'feedback_giver', null],
      default: null
    },
    day_restriction: [{
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    }],
    time_restriction: {
      start: { type: String }, // Format: "HH:MM"
      end: { type: String }    // Format: "HH:MM"
    },
    category_count: {
      min: { type: Number, default: null }
    },
    days_since_last_order: {
      min: { type: Number, default: null }
    },
    checkout_time: {
      max: { type: Number, default: null } // Max seconds for checkout
    },
    minimum_orders: {
      type: Number,
      default: null // Required previous orders
    },
    platform: {
      type: String,
      enum: ['web', 'mobile_app', 'both'],
      default: 'both'
    }
  },
  auto_apply: {
    type: Boolean,
    default: false
  },
  coupon_type: {
    type: String,
    enum: ['general', 'welcome', 'loyalty', 'birthday', 'referral', 'seasonal', 'flash', 'weekend', 'bulk', 'combo', 'clearance', 'premium', 'student', 'social', 'affiliate', 'app_exclusive'],
    default: 'general'
  },
  valid_from: {
    type: Date,
    default: Date.now
  },
  threshold: {
    type: Number,
    default: function() { return this.min_cart_value || 0; }
  }
}, {
  timestamps: true
});

// ✅ ENHANCED INDEXES for better performance
couponSchema.index({ code: 1 });
couponSchema.index({ active: 1, expiry_date: 1 });
couponSchema.index({ priority: 1, active: 1 });
couponSchema.index({ coupon_type: 1, active: 1 });
couponSchema.index({ valid_from: 1, expiry_date: 1 });

// ✅ EXISTING VIRTUALS (preserved)
couponSchema.virtual('is_expired').get(function() {
  return new Date() > this.expiry_date;
});

couponSchema.virtual('is_usage_limit_reached').get(function() {
  if (this.usage_limit === null) return false;
  return this.used_count >= this.usage_limit;
});

// ✅ NEW VIRTUAL - Check if coupon is currently valid
couponSchema.virtual('is_currently_valid').get(function() {
  const now = new Date();
  return this.active && 
         now >= this.valid_from && 
         now <= this.expiry_date &&
         !this.is_usage_limit_reached;
});

// ✅ ENHANCED METHOD - Validate coupon with new conditions
couponSchema.methods.validateCoupon = function(userId, cartItems, cartTotal, userState = {}, cartState = {}) {
  const errors = [];

  // Check if coupon is active
  if (!this.active) {
    errors.push('Coupon is not active');
  }

  // Check if coupon is expired
  if (this.is_expired) {
    errors.push('Coupon has expired');
  }

  // Check if coupon is valid from date
  if (new Date() < this.valid_from) {
    errors.push('Coupon is not yet valid');
  }

  // Check if overall usage limit is reached
  if (this.is_usage_limit_reached) {
    errors.push('Coupon usage limit has been reached');
  }

  // Check minimum cart value
  if (cartTotal < this.min_cart_value) {
    errors.push(`Minimum cart value of ₹${this.min_cart_value} is required`);
  }

  // Check user-specific usage limit
  if (userId) {
    const userUsage = this.used_by.find(usage => usage.user_id.toString() === userId.toString());
    if (userUsage && userUsage.usage_count >= this.user_usage_limit) {
      errors.push('You have already used this coupon maximum number of times');
    }
  }

  // ✅ NEW: Enhanced conditions validation
  if (this.conditions) {
    // Cart value conditions
    if (this.conditions.cart_value) {
      if (this.conditions.cart_value.min && cartTotal < this.conditions.cart_value.min) {
        errors.push(`Minimum cart value ₹${this.conditions.cart_value.min} required`);
      }
      if (this.conditions.cart_value.max && cartTotal > this.conditions.cart_value.max) {
        errors.push(`Maximum cart value ₹${this.conditions.cart_value.max} exceeded`);
      }
    }

    // Item count conditions
    if (this.conditions.item_count && cartState.totalItems) {
      if (this.conditions.item_count.min && cartState.totalItems < this.conditions.item_count.min) {
        errors.push(`Minimum ${this.conditions.item_count.min} items required`);
      }
      if (this.conditions.item_count.max && cartState.totalItems > this.conditions.item_count.max) {
        errors.push(`Maximum ${this.conditions.item_count.max} items allowed`);
      }
    }

    // User type validation
    if (this.conditions.user_type && userState.type !== this.conditions.user_type) {
      errors.push(`This coupon is only for ${this.conditions.user_type} users`);
    }

    // Day restriction validation
    if (this.conditions.day_restriction && this.conditions.day_restriction.length > 0) {
      const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      if (!this.conditions.day_restriction.includes(currentDay)) {
        errors.push(`Coupon only valid on ${this.conditions.day_restriction.join(', ')}`);
      }
    }

    // Time restriction validation
    if (this.conditions.time_restriction && this.conditions.time_restriction.start) {
      if (!this.isValidTime(this.conditions.time_restriction)) {
        errors.push('Coupon not valid at this time');
      }
    }

    // Platform restriction
    if (this.conditions.platform && this.conditions.platform !== 'both' && userState.platform) {
      if (this.conditions.platform !== userState.platform) {
        errors.push(`Coupon only valid on ${this.conditions.platform}`);
      }
    }
  }

  // ✅ NEW: Payment method validation
  if (this.payment_methods && this.payment_methods.length > 0 && userState.paymentMethod) {
    if (!this.payment_methods.includes(userState.paymentMethod)) {
      errors.push(`Payment method ${userState.paymentMethod} not supported`);
    }
  }

  // Check if coupon is applicable to cart items (category/product specific)
  if (this.applicable_categories.length > 0 || this.applicable_products.length > 0) {
    const applicableItems = cartItems.filter(item => {
      const productApplicable = this.applicable_products.some(prodId => 
        prodId.toString() === item.product_id.toString()
      );
      const categoryApplicable = this.applicable_categories.some(catId => 
        catId.toString() === item.product_id.category.toString()
      );
      return productApplicable || categoryApplicable;
    });

    if (applicableItems.length === 0) {
      errors.push('Coupon is not applicable to items in your cart');
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
};

// ✅ ENHANCED METHOD - Calculate discount with new types
couponSchema.methods.calculateDiscount = function(cartTotal, cartItems = []) {
  let discountAmount = 0;
  let applicableAmount = cartTotal;

  // If coupon is category/product specific, calculate applicable amount
  if (this.applicable_categories.length > 0 || this.applicable_products.length > 0) {
    applicableAmount = cartItems
      .filter(item => {
        const productApplicable = this.applicable_products.some(prodId => 
          prodId.toString() === item.product_id.toString()
        );
        const categoryApplicable = this.applicable_categories.some(catId => 
          catId.toString() === item.product_id.category.toString()
        );
        return productApplicable || categoryApplicable;
      })
      .reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  // ✅ ENHANCED: Support new discount types
  switch (this.discount_type) {
    case 'percentage':
      discountAmount = (applicableAmount * this.discount_value) / 100;
      break;
    case 'fixed':
      discountAmount = Math.min(this.discount_value, applicableAmount);
      break;
    case 'shipping':
      discountAmount = Math.min(40, applicableAmount); // Default shipping cost
      break;
    case 'bogo':
      if (cartItems.length >= 2) {
        const sortedItems = cartItems.sort((a, b) => a.price - b.price);
        discountAmount = (sortedItems[0].price * this.discount_value) / 100;
      }
      break;
    case 'cashback':
      discountAmount = Math.min(this.discount_value, applicableAmount);
      break;
    default:
      discountAmount = 0;
  }

  // Apply maximum discount limit if set
  if (this.max_discount_amount && discountAmount > this.max_discount_amount) {
    discountAmount = this.max_discount_amount;
  }

  return Math.round(discountAmount * 100) / 100; // Round to 2 decimal places
};

// ✅ NEW METHOD - Time validation helper
couponSchema.methods.isValidTime = function(timeRestriction) {
  if (!timeRestriction.start || !timeRestriction.end) return true;

  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM format

  const startTime = timeRestriction.start;
  const endTime = timeRestriction.end;

  // Handle overnight time ranges (e.g., 23:00 to 02:00)
  if (startTime > endTime) {
    return currentTime >= startTime || currentTime <= endTime;
  } else {
    return currentTime >= startTime && currentTime <= endTime;
  }
};

// ✅ EXISTING METHOD (preserved)
couponSchema.methods.recordUsage = async function(userId) {
  // Increment overall used count
  this.used_count += 1;

  // Record user-specific usage
  if (userId) {
    const existingUsage = this.used_by.find(usage => 
      usage.user_id.toString() === userId.toString()
    );

    if (existingUsage) {
      existingUsage.usage_count += 1;
      existingUsage.used_dates.push(new Date());
    } else {
      this.used_by.push({
        user_id: userId,
        usage_count: 1,
        used_dates: [new Date()]
      });
    }
  }

  return this.save();
};

// ✅ ENHANCED STATIC METHOD - Find valid coupon with new validation
couponSchema.statics.findValidCoupon = async function(code, userId, cartItems, cartTotal, userState = {}, cartState = {}) {
  const coupon = await this.findOne({ 
    code: code.toUpperCase(),
    active: true 
  }).populate('applicable_categories applicable_products');

  if (!coupon) {
    return {
      valid: false,
      errors: ['Invalid coupon code'],
      coupon: null
    };
  }

  const validation = coupon.validateCoupon(userId, cartItems, cartTotal, userState, cartState);
  
  return {
    valid: validation.valid,
    errors: validation.errors,
    coupon: validation.valid ? coupon : null
  };
};

// ✅ NEW STATIC METHOD - Get active coupons with conditions
couponSchema.statics.getActiveCoupons = function(conditions = {}) {
  const query = { 
    active: true, 
    expiry_date: { $gt: new Date() },
    valid_from: { $lte: new Date() }
  };

  if (conditions.coupon_type) {
    query.coupon_type = conditions.coupon_type;
  }

  if (conditions.payment_method) {
    query.payment_methods = { $in: [conditions.payment_method] };
  }

  if (conditions.user_type) {
    query['conditions.user_type'] = conditions.user_type;
  }

  return this.find(query).sort({ priority: 1, discount_value: -1 });
};

// ✅ NEW STATIC METHOD - Get coupons by priority
couponSchema.statics.getCouponsByPriority = function(priority = 1) {
  return this.find({ 
    active: true, 
    priority: priority,
    expiry_date: { $gt: new Date() },
    valid_from: { $lte: new Date() }
  });
};

// ✅ EXISTING PRE-SAVE MIDDLEWARE (preserved)
couponSchema.pre('save', function(next) {
  if (this.code) {
    this.code = this.code.toUpperCase();
  }
  
  // ✅ NEW: Set threshold from min_cart_value if not explicitly set
  if (!this.threshold && this.min_cart_value) {
    this.threshold = this.min_cart_value;
  }
  
  next();
});

module.exports = mongoose.model('Coupon', couponSchema);
