const mongoose = require("mongoose");

// ============================================================================
// ENHANCED ORDER MODEL WITH PROFESSIONAL FEATURES & TRACKING
// ============================================================================

// ✅ Enhanced Timeline Schema with validation
const TimelineSchema = new mongoose.Schema({
  status: {
    type: String,
    required: true,
    enum: [
      'Order Placed',
      'Order Confirmed', 
      'Payment Verified',
      'Processing',
      'Packed',
      'Shipped',
      'Out for Delivery',
      'Delivered',
      'Cancelled',
      'Returned',
      'Refunded'
    ]
  },
  location: {
    type: String,
    required: true,
    maxlength: 100
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now
  },
  description: {
    type: String,
    maxlength: 300,
    default: ''
  },
  // ✅ Track who updated this status
  updatedBy: {
    type: String,
    enum: ['system', 'admin', 'courier', 'customer'],
    default: 'system'
  }
}, { _id: false });

// ✅ Enhanced Tracking Schema with comprehensive details
const TrackingSchema = new mongoose.Schema({
  number: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  carrier: {
    type: String,
    required: true,
    enum: [
      'Delhivery', 
      'Bluedart', 
      'Ecom Express', 
      'XpressBees', 
      'India Post',
      'FedEx',
      'DHL',
      'Aramex'
    ]
  },
  estimatedDelivery: {
    type: Date,
    required: true
  },
  actualDelivery: {
    type: Date
  },
  currentLocation: {
    type: String,
    required: true,
    maxlength: 100
  },
  status: {
    type: String,
    required: true,
    enum: [
      'Label Created',
      'Picked Up',
      'In Transit',
      'Out for Delivery',
      'Delivered',
      'Failed Delivery',
      'Returned to Sender',
      'Lost'
    ],
    default: 'Label Created'
  },
  timeline: {
    type: [TimelineSchema],
    default: []
  },
  // ✅ Additional tracking fields
  deliveryAttempts: {
    type: Number,
    default: 0,
    min: 0,
    max: 3
  },
  deliveryInstructions: {
    type: String,
    maxlength: 200,
    default: ''
  },
  recipientName: {
    type: String,
    maxlength: 100
  },
  deliveryProof: {
    type: String, // URL to delivery photo/signature
    default: ''
  }
}, { _id: false });

// ✅ Enhanced Order Item Schema with detailed tracking
const OrderItemSchema = new mongoose.Schema({
  productId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Product",
    required: true
  },
  // ✅ Capture product details at time of order
  productSnapshot: {
    name: { type: String, required: true },
    brand: { type: String, required: true },
    images: [{ type: String }],
    description: String
  },
  size: {
    type: String,
    required: false
  },
  color: {
    type: String,
    required: false
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    max: 10
  },
  // ✅ Item-level discount tracking
  discount: {
    percentage: { type: Number, default: 0, min: 0, max: 100 },
    amount: { type: Number, default: 0, min: 0 },
    code: { type: String, default: '' }
  },
  // ✅ Item status (for partial deliveries)
  status: {
    type: String,
    enum: ['Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned'],
    default: 'Processing'
  },
  // ✅ Return/cancellation info
  cancellationReason: String,
  returnReason: String,
  returnStatus: {
    type: String,
    enum: ['Not Requested', 'Requested', 'Approved', 'Rejected', 'Completed'],
    default: 'Not Requested'
  }
});

// ✅ Enhanced Address Schema
const AddressSchema = new mongoose.Schema({
  fullName: { type: String, required: true, maxlength: 100 },
  phone: { type: String, required: true, match: /^[6-9]\d{9}$/ },
  addressLine1: { type: String, required: true, maxlength: 200 },
  addressLine2: { type: String, maxlength: 200, default: '' },
  landmark: { type: String, maxlength: 100, default: '' },
  city: { type: String, required: true, maxlength: 50 },
  state: { type: String, required: true, maxlength: 50 },
  pincode: { type: String, required: true, match: /^[1-9][0-9]{5}$/ },
  country: { type: String, default: 'India' },
  addressType: {
    type: String,
    enum: ['Home', 'Office', 'Other'],
    default: 'Home'
  }
}, { _id: false });

// ✅ Enhanced Payment Schema
const PaymentSchema = new mongoose.Schema({
  method: {
    type: String,
    required: true,
    enum: ['COD', 'Credit Card', 'Debit Card', 'UPI', 'Net Banking', 'Wallet']
  },
  status: {
    type: String,
    enum: ['Pending', 'Completed', 'Failed', 'Refunded', 'Partially Refunded'],
    default: 'Pending'
  },
  transactionId: String,
  paymentGateway: {
    type: String,
    enum: ['Razorpay', 'Payu', 'CCAvenue', 'Stripe', 'PayPal'],
    required: function() { return this.method !== 'COD'; }
  },
  paidAmount: { type: Number, default: 0, min: 0 },
  refundAmount: { type: Number, default: 0, min: 0 },
  paymentDate: Date,
  refundDate: Date
}, { _id: false });

// ✅ Main Order Schema with comprehensive features
const OrderSchema = new mongoose.Schema(
  {
    // ✅ Order identification
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User",
      required: true,
      index: true
    },
    
    // ✅ Order details
    items: {
      type: [OrderItemSchema],
      required: true,
      validate: {
        validator: function(items) {
          return items && items.length > 0;
        },
        message: 'Order must have at least one item'
      }
    },
    
    // ✅ Status and dates
    status: {
      type: String,
      required: true,
      enum: [
        'Pending',
        'Confirmed', 
        'Processing',
        'Shipped',
        'Delivered',
        'Cancelled',
        'Returned',
        'Refunded'
      ],
      default: 'Pending'
    },
    orderDate: {
      type: Date,
      default: Date.now,
      required: true
    },
    expectedDeliveryDate: Date,
    actualDeliveryDate: Date,
    
    // ✅ Pricing breakdown
    pricing: {
      subtotal: { type: Number, required: true, min: 0 },
      discount: { type: Number, default: 0, min: 0 },
      shipping: { type: Number, default: 0, min: 0 },
      tax: { type: Number, default: 0, min: 0 },
      total: { type: Number, required: true, min: 0 }
    },
    
    // ✅ Applied coupons and offers
    coupons: [{
      code: { type: String, required: true },
      discount: { type: Number, required: true, min: 0 },
      type: { type: String, enum: ['percentage', 'fixed'], required: true }
    }],
    
    // ✅ Enhanced address and payment
    shippingAddress: {
      type: AddressSchema,
      required: true
    },
    billingAddress: AddressSchema, // Optional, defaults to shipping
    payment: {
      type: PaymentSchema,
      required: true
    },
    
    // ✅ Enhanced tracking
    tracking: TrackingSchema,
    
    // ✅ Customer interaction
    customerNotes: {
      type: String,
      maxlength: 500,
      default: ''
    },
    internalNotes: {
      type: String,
      maxlength: 1000,
      default: ''
    },
    
    // ✅ Delivery preferences
    deliveryPreferences: {
      timeSlot: {
        type: String,
        enum: ['Morning (9AM-12PM)', 'Afternoon (12PM-6PM)', 'Evening (6PM-9PM)', 'Anytime'],
        default: 'Anytime'
      },
      instructions: {
        type: String,
        maxlength: 200,
        default: ''
      },
      requireSignature: { type: Boolean, default: false },
      allowPartialDelivery: { type: Boolean, default: true }
    },
    
    // ✅ Analytics and source tracking
    analytics: {
      sourceChannel: {
        type: String,
        enum: ['website', 'mobile_app', 'social_media', 'email', 'sms', 'direct'],
        default: 'mobile_app'
      },
      campaign: String,
      referrer: String,
      deviceInfo: String
    }
  },
  { 
    timestamps: true,
    // ✅ Add indexes for better performance
    indexes: [
      { userId: 1, createdAt: -1 }, // User's orders by newest
      { status: 1, createdAt: -1 }, // Orders by status
      { orderId: 1 }, // Unique order lookup
      { 'tracking.number': 1 }, // Tracking number lookup
      { orderDate: -1 }, // Date-based queries
      { 'payment.status': 1 } // Payment status queries
    ]
  }
);

// ✅ Virtual fields for computed properties
OrderSchema.virtual('itemCount').get(function() {
  return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

OrderSchema.virtual('isDelivered').get(function() {
  return this.status === 'Delivered';
});

OrderSchema.virtual('canBeCancelled').get(function() {
  return ['Pending', 'Confirmed', 'Processing'].includes(this.status);
});

OrderSchema.virtual('canBeReturned').get(function() {
  if (!this.isDelivered || !this.actualDeliveryDate) return false;
  const daysSinceDelivery = (new Date() - this.actualDeliveryDate) / (1000 * 60 * 60 * 24);
  return daysSinceDelivery <= 30; // 30-day return policy
});

// ✅ Instance methods for order operations
OrderSchema.methods.updateStatus = function(newStatus, location = '', description = '') {
  this.status = newStatus;
  
  // Update tracking timeline
  if (this.tracking) {
    this.tracking.timeline.push({
      status: newStatus,
      location: location || this.tracking.currentLocation,
      timestamp: new Date(),
      description,
      updatedBy: 'system'
    });
    
    // Update tracking status
    this.tracking.status = newStatus;
    if (location) this.tracking.currentLocation = location;
  }
  
  // Set delivery date if delivered
  if (newStatus === 'Delivered' && !this.actualDeliveryDate) {
    this.actualDeliveryDate = new Date();
  }
  
  return this.save();
};

OrderSchema.methods.cancelOrder = function(reason = '') {
  if (!this.canBeCancelled) {
    throw new Error('This order cannot be cancelled');
  }
  
  this.status = 'Cancelled';
  this.items.forEach(item => {
    item.status = 'Cancelled';
    if (reason) item.cancellationReason = reason;
  });
  
  return this.updateStatus('Cancelled', 'System', `Order cancelled: ${reason}`);
};

OrderSchema.methods.processRefund = function(amount) {
  this.payment.status = amount >= this.pricing.total ? 'Refunded' : 'Partially Refunded';
  this.payment.refundAmount = (this.payment.refundAmount || 0) + amount;
  this.payment.refundDate = new Date();
  
  return this.save();
};

// ✅ Static methods for common operations
OrderSchema.statics.generateOrderId = function() {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ORD${timestamp.slice(-6)}${random}`;
};

OrderSchema.statics.getUserOrders = function(userId, options = {}) {
  const {
    status,
    limit = 20,
    skip = 0,
    sortBy = 'createdAt',
    sortOrder = -1,
    startDate,
    endDate
  } = options;

  let query = { userId };
  if (status) query.status = status;
  if (startDate || endDate) {
    query.orderDate = {};
    if (startDate) query.orderDate.$gte = new Date(startDate);
    if (endDate) query.orderDate.$lte = new Date(endDate);
  }

  return this.find(query)
    .populate({
      path: 'items.productId',
      select: 'name brand images price discount rating'
    })
    .sort({ [sortBy]: sortOrder })
    .skip(skip)
    .limit(limit)
    .lean();
};

OrderSchema.statics.getOrderStats = function(userId) {
  return this.aggregate([
    { $match: { userId: mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalSpent: { $sum: '$pricing.total' },
        avgOrderValue: { $avg: '$pricing.total' },
        statusBreakdown: {
          $push: '$status'
        }
      }
    }
  ]);
};

// ✅ Pre-save middleware for data processing
OrderSchema.pre('save', function(next) {
  // Generate order ID if not present
  if (!this.orderId) {
    this.orderId = this.constructor.generateOrderId();
  }
  
  // Set billing address to shipping if not provided
  if (!this.billingAddress) {
    this.billingAddress = this.shippingAddress;
  }
  
  // Calculate expected delivery date if not set
  if (!this.expectedDeliveryDate) {
    const deliveryDays = this.payment.method === 'COD' ? 7 : 5;
    this.expectedDeliveryDate = new Date(Date.now() + deliveryDays * 24 * 60 * 60 * 1000);
  }
  
  next();
});

// ✅ Post-save middleware for notifications
OrderSchema.post('save', function(doc) {
  // Send notifications based on status changes
  console.log(`Order ${doc.orderId} status: ${doc.status}`);
  // Here you can add email/SMS notification logic
});

module.exports = mongoose.model("Order", OrderSchema);
