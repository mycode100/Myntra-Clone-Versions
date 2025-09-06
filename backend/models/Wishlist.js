const mongoose = require("mongoose");

// ============================================================================
// ENHANCED WISHLIST MODEL WITH PROFESSIONAL FEATURES
// ============================================================================

const WishlistSchema = new mongoose.Schema(
  {
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User",
      required: true,
      index: true
    },
    productId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Product",
      required: true,
      index: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    notes: {
      type: String,
      maxlength: 500,
      default: ''
    },
    priceAlertEnabled: {
      type: Boolean,
      default: false
    },
    originalPrice: {
      type: Number,
      min: 0
    }
  },
  { 
    timestamps: true
  }
);

// ✅ Prevent duplicate entries
WishlistSchema.index({ userId: 1, productId: 1 }, { unique: true });

// ✅ FIXED: Complete implementation of static methods
WishlistSchema.statics.getUserWishlistWithProducts = async function(userId, options = {}) {
  try {
    const {
      limit = 50,
      skip = 0,
      sortBy = 'addedAt',
      sortOrder = -1,
      priority
    } = options;

    // Build query
    const query = { userId: new mongoose.Types.ObjectId(userId) };
    if (priority) query.priority = priority;

    console.log('🔍 Wishlist query:', query);

    // Execute query with population
    const items = await this.find(query)
      .populate({
        path: 'productId',
        select: 'name brand price discount images rating ratingCount isNew isFeatured',
        match: { $ne: null } // Only populate if product exists
      })
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();

    console.log('🔍 Raw wishlist items found:', items.length);

    // Filter out items where product was deleted (productId is null)
    const validItems = items.filter(item => item.productId !== null);
    
    console.log('🔍 Valid wishlist items after filtering:', validItems.length);

    return validItems;

  } catch (error) {
    console.error('❌ Error in getUserWishlistWithProducts:', error);
    throw error;
  }
};

WishlistSchema.statics.getUserWishlistCount = async function(userId) {
  try {
    const count = await this.countDocuments({ 
      userId: new mongoose.Types.ObjectId(userId) 
    });
    console.log('🔍 Wishlist count for user:', userId, '=', count);
    return count;
  } catch (error) {
    console.error('❌ Error in getUserWishlistCount:', error);
    throw error;
  }
};

WishlistSchema.statics.findByUserAndProduct = async function(userId, productId) {
  try {
    return await this.findOne({ 
      userId: new mongoose.Types.ObjectId(userId), 
      productId: new mongoose.Types.ObjectId(productId) 
    });
  } catch (error) {
    console.error('❌ Error in findByUserAndProduct:', error);
    throw error;
  }
};

// ✅ Instance methods
WishlistSchema.methods.toJSON = function() {
  const wishlistItem = this.toObject();
  wishlistItem.daysInWishlist = Math.floor(
    (new Date() - this.addedAt) / (1000 * 60 * 60 * 24)
  );
  return wishlistItem;
};

module.exports = mongoose.model("Wishlist", WishlistSchema);
