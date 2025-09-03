const mongoose = require('mongoose');

const bagSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    max: 10,
    default: 1
  },
  // ✅ FLEXIBLE: Accepts all product sizes (5ml, M, 32, 2Y, etc.)
  size: {
    type: String,
    required: false,
    trim: true,
    validate: {
      validator: function(v) {
        return !v || (typeof v === 'string' && v.trim().length > 0);
      },
      message: 'Size must be a valid string if provided'
    }
  },
  color: {
    type: String,
    required: false,
    trim: true
  },
  priceWhenAdded: {
    type: Number,
    required: true
  },
  discountWhenAdded: {
    type: String,
    required: false
  },
  savedForLater: {
    type: Boolean,
    default: false
  },
  addedFrom: {
    type: String,
    default: 'product_page',
    trim: true
  },
  appliedCoupon: {
    type: String,
    required: false,
    trim: true
  },
  discountAmount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// ✅ INDEXES
bagSchema.index({ userId: 1, productId: 1 }, { unique: true });
bagSchema.index({ userId: 1, savedForLater: 1 });
bagSchema.index({ userId: 1, updatedAt: -1 });

// ✅ STATIC METHODS (Required by your routes)

// Get user's bag item count
bagSchema.statics.getUserBagCount = function(userId, includeSaved = false) {
  const query = { userId: new mongoose.Types.ObjectId(userId) };
  if (!includeSaved) {
    query.savedForLater = false;
  }
  return this.countDocuments(query);
};

// Get user's bag total
bagSchema.statics.getUserBagTotal = async function(userId) {
  const pipeline = [
    { $match: { userId: new mongoose.Types.ObjectId(userId), savedForLater: false } },
    { 
      $group: { 
        _id: null, 
        total: { $sum: { $multiply: ['$quantity', '$priceWhenAdded'] } },
        itemCount: { $sum: 1 }
      } 
    }
  ];
  
  const result = await this.aggregate(pipeline);
  return {
    total: result[0]?.total || 0,
    itemCount: result[0]?.itemCount || 0
  };
};

// Get user's bag with populated products
bagSchema.statics.getUserBagWithProducts = function(userId, options = {}) {
  const {
    includeSaved = false,
    limit = 50,
    skip = 0,
    sortBy = 'createdAt',
    sortOrder = -1
  } = options;

  const query = { userId: new mongoose.Types.ObjectId(userId) };
  if (!includeSaved) {
    query.savedForLater = false;
  }

  return this.find(query)
    .populate({
      path: 'productId',
      select: 'name brand price discount images rating ratingCount stock colors sizes isNew isFeatured category',
      match: { _id: { $exists: true } }
    })
    .populate({
      path: 'appliedCoupon',
      select: 'code discountType discountValue isActive'
    })
    .sort({ [sortBy]: sortOrder })
    .skip(skip)
    .limit(limit)
    .lean();
};

// Get saved items
bagSchema.statics.getSavedItems = function(userId, options = {}) {
  const {
    limit = 20,
    skip = 0,
    sortBy = 'savedAt',
    sortOrder = -1
  } = options;

  return this.find({ 
    userId: new mongoose.Types.ObjectId(userId), 
    savedForLater: true 
  })
    .populate({
      path: 'productId',
      select: 'name brand price discount images rating ratingCount stock',
      match: { _id: { $exists: true } }
    })
    .sort({ [sortBy]: sortOrder })
    .skip(skip)
    .limit(limit)
    .lean();
};

// Find by user and product
bagSchema.statics.findByUserAndProduct = function(userId, productId, size, color) {
  const query = { 
    userId: new mongoose.Types.ObjectId(userId), 
    productId: new mongoose.Types.ObjectId(productId), 
    savedForLater: false 
  };
  
  if (size) query.size = size;
  if (color) query.color = color;
  
  return this.findOne(query);
};

// Clear user's bag
bagSchema.statics.clearUserBag = function(userId) {
  return this.deleteMany({ 
    userId: new mongoose.Types.ObjectId(userId), 
    savedForLater: false 
  });
};

// Update item quantity
bagSchema.statics.updateItemQuantity = async function(userId, productId, newQuantity, size, color) {
  const query = { 
    userId: new mongoose.Types.ObjectId(userId), 
    productId: new mongoose.Types.ObjectId(productId), 
    savedForLater: false 
  };
  
  if (size) query.size = size;
  if (color) query.color = color;
  
  return this.findOneAndUpdate(
    query,
    { quantity: Math.max(1, Math.min(10, newQuantity)) },
    { new: true }
  );
};

// Move to saved for later
bagSchema.statics.moveToSaved = function(userId, itemId) {
  return this.findOneAndUpdate(
    { _id: new mongoose.Types.ObjectId(itemId), userId: new mongoose.Types.ObjectId(userId) },
    { savedForLater: true, savedAt: new Date() },
    { new: true }
  );
};

// Move back to bag
bagSchema.statics.moveToCart = function(userId, itemId) {
  return this.findOneAndUpdate(
    { _id: new mongoose.Types.ObjectId(itemId), userId: new mongoose.Types.ObjectId(userId) },
    { savedForLater: false, savedAt: null },
    { new: true }
  );
};

// ✅ MIDDLEWARE
bagSchema.pre('save', function(next) {
  if (this.size) this.size = this.size.trim();
  if (this.color) this.color = this.color.trim();
  if (this.priceWhenAdded <= 0) return next(new Error('Price when added must be greater than 0'));
  
  // Set savedAt when moving to saved for later
  if (this.savedForLater && !this.savedAt) {
    this.savedAt = new Date();
  }
  
  // Clear savedAt when moving back to cart
  if (!this.savedForLater && this.savedAt) {
    this.savedAt = null;
  }
  
  // Ensure quantity is within bounds
  this.quantity = Math.max(1, Math.min(10, this.quantity));
  
  next();
});

module.exports = mongoose.model('Bag', bagSchema);
