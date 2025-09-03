const BrowsingHistory = require('../models/BrowsingHistory');
const Product = require('../models/Product');
const mongoose = require('mongoose'); // ✅ ADDED: Direct mongoose import
const { handleApiError, sendSuccessResponse, sendErrorResponse, validateRequiredFields } = require('../utils/apiHelpers');

class BrowsingHistoryController {

  // POST /api/browsing-history/track
  async trackBrowsingHistory(req, res) {
    try {
      const { productId, sessionId, userId, timeSpent, source, deviceInfo, scrollDepth, addedToWishlist, addedToBag } = req.body; // ✅ UPDATED: Added userId from body
      const userIdFromAuth = req.user?.id || userId || null; // ✅ UPDATED: Flexible user detection

      // Validate required fields
      validateRequiredFields(req.body, ['productId', 'sessionId']);

      console.log(`📊 Tracking browsing history - Product: ${productId}, User: ${userIdFromAuth || 'anonymous'}, Session: ${sessionId}`);

      // Check if product exists
      const productExists = await Product.findById(productId);
      if (!productExists) {
        return sendErrorResponse(res, 'Product not found', 404);
      }

      // ✅ UPDATED: Check for recent duplicate entry (support null userId for anonymous users)
      const recentEntry = await BrowsingHistory.findOne({
        userId: userIdFromAuth,
        productId,
        sessionId,
        viewedAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) }
      });

      let historyEntry;

      if (recentEntry) {
        // Update existing entry
        historyEntry = await BrowsingHistory.findByIdAndUpdate(
          recentEntry._id,
          {
            viewedAt: new Date(),
            timeSpent: Math.max(timeSpent || 0, recentEntry.timeSpent || 0), // ✅ UPDATED: Use Math.max for timeSpent too
            scrollDepth: Math.max(scrollDepth || 0, recentEntry.scrollDepth || 0),
            addedToWishlist: addedToWishlist || recentEntry.addedToWishlist,
            addedToBag: addedToBag || recentEntry.addedToBag,
            source: source || recentEntry.source,
            deviceInfo: deviceInfo || recentEntry.deviceInfo
          },
          { new: true }
        );
        console.log(`📝 Updated existing browsing entry for user: ${userIdFromAuth || 'anonymous'}`);
      } else {
        // Create new entry
        historyEntry = await BrowsingHistory.create({
          userId: userIdFromAuth, // Can be null for anonymous users
          productId,
          sessionId,
          viewedAt: new Date(),
          timeSpent: timeSpent || 0,
          source: source || 'direct',
          deviceInfo: deviceInfo || req.headers['user-agent'] || '', // ✅ UPDATED: Fallback to user-agent
          scrollDepth: scrollDepth || 0,
          addedToWishlist: addedToWishlist || false,
          addedToBag: addedToBag || false
        });
        console.log(`📝 Created new browsing entry for user: ${userIdFromAuth || 'anonymous'}`);
      }

      return sendSuccessResponse(res, historyEntry, 'Browsing history tracked successfully', 201);

    } catch (error) {
      console.error('❌ Track browsing history error:', error);
      return sendErrorResponse(res, error, 500);
    }
  }

  // GET /api/browsing-history/user/:userId
  async getUserBrowsingHistory(req, res) {
    try {
      const { userId } = req.params;
      const { limit = 20, page = 1, days = 30 } = req.query;

      // ✅ UPDATED: Simplified auth check - allow user to access their own data
      const userIdFromAuth = req.user?.id;
      if (userIdFromAuth && userIdFromAuth !== userId && req.user?.role !== 'admin') {
        return sendErrorResponse(res, 'Unauthorized access', 403);
      }

      if (!userId) {
        return sendErrorResponse(res, 'User ID is required', 400);
      }

      const skip = (page - 1) * limit;
      const startDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

      console.log(`📚 Retrieving browsing history for user: ${userId}, days: ${days}`);

      const history = await BrowsingHistory.find({
        userId,
        viewedAt: { $gte: startDate }
      })
      .populate('productId', 'name brand price images rating ratingCount category')
      .sort({ viewedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

      const total = await BrowsingHistory.countDocuments({
        userId,
        viewedAt: { $gte: startDate }
      });

      const responseData = {
        history,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      };

      return sendSuccessResponse(res, responseData, 'User browsing history retrieved successfully');

    } catch (error) {
      console.error('❌ Get user browsing history error:', error);
      return sendErrorResponse(res, error, 500);
    }
  }

  // GET /api/browsing-history/session/:sessionId
  async getSessionBrowsingHistory(req, res) {
    try {
      const { sessionId } = req.params;
      const { limit = 50 } = req.query;

      console.log(`📱 Retrieving session browsing history for session: ${sessionId}`);

      const history = await BrowsingHistory.find({ sessionId })
        .populate('productId', 'name brand price images rating category')
        .sort({ viewedAt: -1 })
        .limit(parseInt(limit));

      return sendSuccessResponse(res, history, 'Session browsing history retrieved successfully');

    } catch (error) {
      console.error('❌ Get session browsing history error:', error);
      return sendErrorResponse(res, error, 500);
    }
  }

  // GET /api/browsing-history/product/:productId/analytics
  async getProductAnalytics(req, res) {
    try {
      const { productId } = req.params;
      const { days = 30 } = req.query;

      const startDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

      console.log(`📊 Generating analytics for product: ${productId}, days: ${days}`);

      // ✅ UPDATED: Modern mongoose ObjectId syntax
      const productObjectId = new mongoose.Types.ObjectId(productId);

      // Get product view analytics
      const analytics = await BrowsingHistory.aggregate([
        {
          $match: {
            productId: productObjectId,
            viewedAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: null,
            totalViews: { $sum: 1 },
            uniqueUsers: { $addToSet: '$userId' },
            uniqueSessions: { $addToSet: '$sessionId' },
            avgTimeSpent: { $avg: '$timeSpent' },
            avgScrollDepth: { $avg: '$scrollDepth' },
            wishlistAdds: { $sum: { $cond: ['$addedToWishlist', 1, 0] } },
            bagAdds: { $sum: { $cond: ['$addedToBag', 1, 0] } },
            sources: { $push: '$source' }
          }
        },
        {
          $addFields: {
            // ✅ UPDATED: Filter out null userIds for unique count
            uniqueUserCount: { 
              $size: { 
                $filter: { 
                  input: '$uniqueUsers', 
                  cond: { $ne: ['$$this', null] } 
                } 
              } 
            },
            uniqueSessionCount: { $size: '$uniqueSessions' },
            conversionRate: {
              $multiply: [
                { $divide: ['$bagAdds', { $max: ['$totalViews', 1] }] }, // ✅ UPDATED: Prevent division by zero
                100
              ]
            },
            wishlistRate: {
              $multiply: [
                { $divide: ['$wishlistAdds', { $max: ['$totalViews', 1] }] }, // ✅ UPDATED: Prevent division by zero
                100
              ]
            }
          }
        }
      ]);

      // Get daily view trends
      const dailyTrends = await BrowsingHistory.aggregate([
        {
          $match: {
            productId: productObjectId,
            viewedAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$viewedAt' },
              month: { $month: '$viewedAt' },
              day: { $dayOfMonth: '$viewedAt' }
            },
            views: { $sum: 1 },
            uniqueUsers: { $addToSet: '$userId' },
            uniqueSessions: { $addToSet: '$sessionId' }
          }
        },
        {
          $addFields: {
            date: {
              $dateFromParts: {
                year: '$_id.year',
                month: '$_id.month',
                day: '$_id.day'
              }
            },
            // ✅ UPDATED: Filter out null userIds
            uniqueUserCount: { 
              $size: { 
                $filter: { 
                  input: '$uniqueUsers', 
                  cond: { $ne: ['$$this', null] } 
                } 
              } 
            },
            uniqueSessionCount: { $size: '$uniqueSessions' }
          }
        },
        { $sort: { date: 1 } }
      ]);

      const responseData = {
        analytics: analytics[0] || {
          totalViews: 0,
          uniqueUserCount: 0,
          uniqueSessionCount: 0,
          avgTimeSpent: 0,
          avgScrollDepth: 0,
          wishlistAdds: 0,
          bagAdds: 0,
          conversionRate: 0,
          wishlistRate: 0
        },
        dailyTrends,
        period: {
          days: parseInt(days),
          startDate,
          endDate: new Date()
        }
      };

      return sendSuccessResponse(res, responseData, 'Product analytics retrieved successfully');

    } catch (error) {
      console.error('❌ Get product analytics error:', error);
      return sendErrorResponse(res, error, 500);
    }
  }

  // DELETE /api/browsing-history/user/:userId/clear
  async clearUserHistory(req, res) {
    try {
      const { userId } = req.params;
      const { olderThanDays } = req.query;

      // ✅ UPDATED: Simplified auth check
      const userIdFromAuth = req.user?.id;
      if (userIdFromAuth && userIdFromAuth !== userId && req.user?.role !== 'admin') {
        return sendErrorResponse(res, 'Unauthorized access', 403);
      }

      if (!userId) {
        return sendErrorResponse(res, 'User ID is required', 400);
      }

      let deleteQuery = { userId };

      if (olderThanDays) {
        const cutoffDate = new Date(Date.now() - parseInt(olderThanDays) * 24 * 60 * 60 * 1000);
        deleteQuery.viewedAt = { $lt: cutoffDate };
      }

      console.log(`🗑️ Clearing browsing history for user: ${userId}${olderThanDays ? ` (older than ${olderThanDays} days)` : ''}`);

      const result = await BrowsingHistory.deleteMany(deleteQuery);

      return sendSuccessResponse(res, {
        deletedCount: result.deletedCount,
        userId,
        clearedAt: new Date()
      }, `Successfully cleared ${result.deletedCount} browsing history entries`);

    } catch (error) {
      console.error('❌ Clear user history error:', error);
      return sendErrorResponse(res, error, 500);
    }
  }

  // PUT /api/browsing-history/:historyId/update-engagement
  async updateEngagementMetrics(req, res) {
    try {
      const { historyId } = req.params;
      const { timeSpent, scrollDepth, addedToWishlist, addedToBag } = req.body;

      const historyEntry = await BrowsingHistory.findById(historyId);
      if (!historyEntry) {
        return sendErrorResponse(res, 'Browsing history entry not found', 404);
      }

      // ✅ UPDATED: Check if user owns this history entry (handle null userIds)
      const userIdFromAuth = req.user?.id;
      if (userIdFromAuth && historyEntry.userId && historyEntry.userId.toString() !== userIdFromAuth) {
        return sendErrorResponse(res, 'Unauthorized access', 403);
      }

      const updateData = {};
      if (timeSpent !== undefined) updateData.timeSpent = Math.max(timeSpent, historyEntry.timeSpent || 0);
      if (scrollDepth !== undefined) updateData.scrollDepth = Math.max(scrollDepth, historyEntry.scrollDepth || 0);
      if (addedToWishlist !== undefined) updateData.addedToWishlist = addedToWishlist;
      if (addedToBag !== undefined) updateData.addedToBag = addedToBag;

      console.log(`📊 Updating engagement metrics for history entry: ${historyId}`);

      const updatedEntry = await BrowsingHistory.findByIdAndUpdate(
        historyId,
        updateData,
        { new: true }
      );

      return sendSuccessResponse(res, updatedEntry, 'Engagement metrics updated successfully');

    } catch (error) {
      console.error('❌ Update engagement metrics error:', error);
      return sendErrorResponse(res, error, 500);
    }
  }

  // GET /api/browsing-history/popular-products
  async getPopularProducts(req, res) {
    try {
      const { limit = 10, days = 7, category } = req.query;
      const startDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

      console.log(`🔥 Retrieving popular products - Days: ${days}, Limit: ${limit}`);

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
            // ✅ UPDATED: Filter out null userIds for accurate unique count
            uniqueUserCount: { 
              $size: { 
                $filter: { 
                  input: '$uniqueUsers', 
                  cond: { $ne: ['$$this', null] } 
                } 
              } 
            },
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

module.exports = new BrowsingHistoryController();
