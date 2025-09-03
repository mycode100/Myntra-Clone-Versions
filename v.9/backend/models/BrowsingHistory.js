const mongoose = require('mongoose');

const browsingHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null, // Allow null for anonymous users
    index: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  viewedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  // ✅ FIXED: Updated enum with all tracking source values
  source: {
    type: String,
    enum: [
      'direct',
      'search',
      'category',
      'recommendation',
      'product_detail',           // ✅ Added
      'product_detail_extended',  // ✅ Added
      'product_detail_scroll',    // ✅ Added
      'recommendation_carousel',  // ✅ Added
      'recommendation_click',     // ✅ Added
      'wishlist_action',         // ✅ Added
      'bag_action',              // ✅ Added
      'share_action',            // ✅ Added
      'related_product_click',   // ✅ Added
      'homepage',
      'banner',
      'promotion',
      'external'
    ],
    default: 'direct'
  },
  timeSpent: {
    type: Number,
    default: 0,
    min: 0
  },
  deviceInfo: {
    type: String,
    default: ''
  },
  scrollDepth: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  addedToWishlist: {
    type: Boolean,
    default: false
  },
  addedToBag: {
    type: Boolean,
    default: false
  },
  // ✅ Additional tracking metadata
  metadata: {
    userAgent: String,
    platform: String,
    referrer: String,
    utm_source: String,
    utm_campaign: String,
    utm_medium: String,
    recommendationIndex: Number,
    fromProduct: String,
    clickedAt: Date,
    action: String,
    quantity: Number,
    selectedSize: String,
    selectedColor: String,
    viewDuration: Number,
    maxScrollDepth: Number,
    scrollEngagement: String,
    timeToScroll: Number
  }
}, {
  timestamps: true,
  // ✅ Compound indexes for better query performance
  indexes: [
    { userId: 1, viewedAt: -1 },
    { productId: 1, viewedAt: -1 },
    { sessionId: 1, viewedAt: -1 },
    { source: 1, viewedAt: -1 },
    { viewedAt: 1, expiresAfterSeconds: 86400 * 365 } // Auto-delete after 1 year
  ]
});

// ✅ Instance methods for analytics
browsingHistorySchema.methods.getEngagementScore = function() {
  let score = 0;
  
  // Time spent scoring (0-40 points)
  if (this.timeSpent > 0) {
    score += Math.min(this.timeSpent / 60, 40); // Max 40 points for 60+ seconds
  }
  
  // Scroll depth scoring (0-30 points)
  if (this.scrollDepth > 0) {
    score += (this.scrollDepth / 100) * 30;
  }
  
  // Action scoring (0-30 points)
  if (this.addedToWishlist) score += 15;
  if (this.addedToBag) score += 15;
  
  return Math.round(score);
};

// ✅ Static methods for analytics
browsingHistorySchema.statics.getPopularProducts = function(days = 7, limit = 10) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  return this.aggregate([
    { $match: { viewedAt: { $gte: startDate } } },
    {
      $group: {
        _id: '$productId',
        viewCount: { $sum: 1 },
        uniqueUsers: { $addToSet: '$userId' },
        uniqueSessions: { $addToSet: '$sessionId' },
        avgTimeSpent: { $avg: '$timeSpent' },
        avgScrollDepth: { $avg: '$scrollDepth' },
        wishlistAdds: { $sum: { $cond: ['$addedToWishlist', 1, 0] } },
        bagAdds: { $sum: { $cond: ['$addedToBag', 1, 0] } }
      }
    },
    {
      $addFields: {
        uniqueUserCount: { $size: { $filter: { input: '$uniqueUsers', cond: { $ne: ['$$this', null] } } } },
        uniqueSessionCount: { $size: '$uniqueSessions' },
        popularityScore: {
          $add: [
            { $multiply: ['$viewCount', 1] },
            { $multiply: [{ $size: { $filter: { input: '$uniqueUsers', cond: { $ne: ['$$this', null] } } } }, 2] },
            { $multiply: ['$wishlistAdds', 3] },
            { $multiply: ['$bagAdds', 5] }
          ]
        }
      }
    },
    { $sort: { popularityScore: -1 } },
    { $limit: limit }
  ]);
};

browsingHistorySchema.statics.getUserBehaviorInsights = function(userId, days = 30) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  return this.aggregate([
    { $match: { userId: mongoose.Types.ObjectId(userId), viewedAt: { $gte: startDate } } },
    {
      $group: {
        _id: null,
        totalViews: { $sum: 1 },
        totalTimeSpent: { $sum: '$timeSpent' },
        avgScrollDepth: { $avg: '$scrollDepth' },
        uniqueProducts: { $addToSet: '$productId' },
        wishlistActions: { $sum: { $cond: ['$addedToWishlist', 1, 0] } },
        bagActions: { $sum: { $cond: ['$addedToBag', 1, 0] } },
        sourceBreakdown: { $push: '$source' }
      }
    },
    {
      $addFields: {
        uniqueProductCount: { $size: '$uniqueProducts' },
        avgTimePerView: { $divide: ['$totalTimeSpent', '$totalViews'] },
        conversionRate: { 
          $multiply: [
            { $divide: ['$bagActions', '$totalViews'] }, 
            100
          ]
        }
      }
    }
  ]);
};

const BrowsingHistory = mongoose.model('BrowsingHistory', browsingHistorySchema);

module.exports = BrowsingHistory;
