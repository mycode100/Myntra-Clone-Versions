const recommendationService = require('../services/recommendationService');
const { handleApiError, sendSuccessResponse, sendErrorResponse, validateRequiredFields } = require('../utils/apiHelpers');

class RecommendationController {

  // GET /api/recommendations/product/:productId?userId=xxx&limit=6
  async getProductRecommendations(req, res) {
    try {
      const { productId } = req.params;
      const { limit = 6, userId } = req.query; // ✅ UPDATED: Get userId from query params
      const userIdFromAuth = req.user?.id || userId || null; // ✅ UPDATED: Flexible user detection

      if (!productId) {
        return sendErrorResponse(res, 'Product ID is required', 400);
      }

      console.log(`🎯 Getting recommendations for product: ${productId}, user: ${userIdFromAuth || 'anonymous'}`);

      const recommendations = await recommendationService.generateRecommendations(
        productId, 
        userIdFromAuth, 
        parseInt(limit)
      );

      return sendSuccessResponse(res, {
        recommendations: recommendations.map(rec => ({
          product: rec.product,
          score: rec.totalScore || rec.score,
          reasons: rec.reasons || [rec.reason]
        })),
        meta: {
          count: recommendations.length,
          userId: userIdFromAuth || 'anonymous',
          timestamp: new Date(),
          algorithm: userIdFromAuth ? 'personalized' : 'generic'
        }
      }, 'Recommendations generated successfully');

    } catch (error) {
      console.error('❌ Get recommendations error:', error);
      return sendErrorResponse(res, error, 500);
    }
  }

  // POST /api/recommendations/track-view
  async trackProductView(req, res) {
    try {
      const { productId, sessionId, userId, metadata = {} } = req.body; // ✅ UPDATED: Get userId from body
      const userIdFromAuth = req.user?.id || userId || null; // ✅ UPDATED: Flexible user detection

      // Validate required fields
      validateRequiredFields(req.body, ['productId', 'sessionId']);

      console.log(`📊 Tracking view for product: ${productId}, user: ${userIdFromAuth || 'anonymous'}, session: ${sessionId}`);

      // ✅ UPDATED: Track for both logged-in and anonymous users
      const historyEntry = await recommendationService.trackBrowsingHistory(
        userIdFromAuth, // Can be null for anonymous users
        productId,
        sessionId,
        {
          ...metadata,
          userAgent: req.headers['user-agent'] || '',
          platform: req.headers['x-platform'] || 'web'
        }
      );

      return sendSuccessResponse(res, historyEntry, 
        userIdFromAuth ? 'Product view tracked successfully' : 'Anonymous view tracked successfully'
      );

    } catch (error) {
      console.error('❌ Track view error:', error);
      return sendErrorResponse(res, error, 500);
    }
  }

  // GET /api/recommendations/user-history?userId=xxx OR /api/recommendations/user-history (with userId in auth)
  async getUserBrowsingHistory(req, res) {
    try {
      const { limit = 20, page = 1, userId } = req.query; // ✅ UPDATED: Get userId from query
      const userIdFromAuth = req.user?.id || userId || null; // ✅ UPDATED: Flexible user detection

      if (!userIdFromAuth) {
        return sendErrorResponse(res, 'User ID is required', 400);
      }

      const BrowsingHistory = require('../models/BrowsingHistory');
      
      const skip = (page - 1) * limit;
      const history = await BrowsingHistory.find({ userId: userIdFromAuth })
        .populate('productId', 'name brand price images rating category')
        .sort({ viewedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await BrowsingHistory.countDocuments({ userId: userIdFromAuth });

      return sendSuccessResponse(res, {
        history,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }, 'User browsing history retrieved successfully');

    } catch (error) {
      console.error('❌ Get user history error:', error);
      return sendErrorResponse(res, error, 500);
    }
  }

  // DELETE /api/recommendations/clear-cache/:productId?userId=xxx
  async clearRecommendationCache(req, res) {
    try {
      const { productId } = req.params;
      const { userId } = req.query; // ✅ UPDATED: Get userId from query
      const userIdFromAuth = req.user?.id || userId || null; // ✅ UPDATED: Flexible user detection

      if (!productId) {
        return sendErrorResponse(res, 'Product ID is required', 400);
      }

      const ProductRecommendation = require('../models/ProductRecommendation');
      
      const query = { forProductId: productId };
      if (userIdFromAuth) {
        query.userId = userIdFromAuth;
        console.log(`🗑️ Clearing user-specific cache for product: ${productId}, user: ${userIdFromAuth}`);
      } else {
        query.userId = null; // Clear anonymous cache
        console.log(`🗑️ Clearing anonymous cache for product: ${productId}`);
      }

      const result = await ProductRecommendation.deleteMany(query);

      return sendSuccessResponse(res, {
        deletedCount: result.deletedCount,
        productId,
        userId: userIdFromAuth || 'anonymous'
      }, `Recommendation cache cleared (${result.deletedCount} entries removed)`);

    } catch (error) {
      console.error('❌ Clear cache error:', error);
      return sendErrorResponse(res, error, 500);
    }
  }

  // ✅ NEW: Get popular products based on browsing history
  async getPopularProducts(req, res) {
    try {
      const { limit = 10, days = 7, category } = req.query;

      const BrowsingHistory = require('../models/BrowsingHistory');
      const startDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

      let matchQuery = { viewedAt: { $gte: startDate } };
      
      const popularProducts = await BrowsingHistory.aggregate([
        { $match: matchQuery },
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
        { $limit: parseInt(limit) },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'product'
          }
        },
        { $unwind: '$product' },
        {
          $project: {
            product: 1,
            viewCount: 1,
            uniqueUserCount: 1,
            uniqueSessionCount: 1,
            avgTimeSpent: 1,
            avgScrollDepth: 1,
            wishlistAdds: 1,
            bagAdds: 1,
            popularityScore: 1
          }
        }
      ]);

      return sendSuccessResponse(res, popularProducts, 'Popular products retrieved successfully');

    } catch (error) {
      console.error('❌ Get popular products error:', error);
      return sendErrorResponse(res, error, 500);
    }
  }
}

module.exports = new RecommendationController();
