const mongoose = require('mongoose');

const productRecommendationSchema = new mongoose.Schema({
  forProductId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // ✅ ADDED: Explicitly allow null for anonymous users
    sparse: true // For user-specific recommendations
  },
  recommendedProducts: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    score: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },
    reasons: [{
      type: String,
      enum: [
        'same_category',
        'similar_price',
        'user_behavior',
        'collaborative_filtering',
        'content_similarity',
        'wishlist_pattern',
        'purchase_together'
      ]
    }],
    weight: {
      type: Number,
      default: 1
    }
  }],
  algorithm: {
    type: String,
    enum: ['collaborative', 'content_based', 'hybrid', 'popularity'],
    required: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
    index: true
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    index: true
  }
}, {
  timestamps: true
});

// Compound indexes
productRecommendationSchema.index({ forProductId: 1, userId: 1 });
productRecommendationSchema.index({ forProductId: 1, algorithm: 1 });

// TTL index for automatic cleanup
productRecommendationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('ProductRecommendation', productRecommendationSchema);
