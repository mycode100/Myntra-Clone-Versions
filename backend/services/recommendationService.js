const Product = require('../models/Product');
const BrowsingHistory = require('../models/BrowsingHistory');
const Wishlist = require('../models/Wishlist');
const ProductRecommendation = require('../models/ProductRecommendation');
const mongoose = require('mongoose'); // ✅ ADDED: Direct mongoose import
const similarityService = require('./similarityService');

class RecommendationService {
  
  // Main recommendation engine
  async generateRecommendations(productId, userId = null, limit = 6) {
    try {
      console.log(`🎯 Generating recommendations for product: ${productId}, user: ${userId || 'anonymous'}, limit: ${limit}`);

      // Check cached recommendations first
      const cached = await this.getCachedRecommendations(productId, userId);
      if (cached && cached.length >= limit) {
        console.log(`📋 Using cached recommendations (${cached.length} found)`);
        return cached.slice(0, limit);
      }

      const currentProduct = await Product.findById(productId);
      if (!currentProduct) throw new Error('Product not found');

      let recommendations = [];

      if (userId) {
        console.log(`👤 Generating personalized recommendations for user: ${userId}`);
        // User-specific recommendations
        recommendations = await this.generateUserSpecificRecommendations(
          currentProduct, userId, limit
        );
      } else {
        console.log(`🌐 Generating generic recommendations for anonymous user`);
        // Generic recommendations for non-logged users
        recommendations = await this.generateGenericRecommendations(
          currentProduct, limit
        );
      }

      // Cache the results
      await this.cacheRecommendations(productId, userId, recommendations);

      console.log(`✅ Generated ${recommendations.length} recommendations`);
      return recommendations;

    } catch (error) {
      console.error('❌ Error generating recommendations:', error);
      // Fallback to basic recommendations
      return await this.getFallbackRecommendations(productId, limit);
    }
  }

  // User-specific recommendations using hybrid approach
  async generateUserSpecificRecommendations(currentProduct, userId, limit) {
    const recommendations = new Map(); // Use Map to avoid duplicates

    try {
      // 1. Collaborative Filtering (40% weight)
      const collaborativeRecs = await this.collaborativeFiltering(currentProduct, userId);
      this.addToRecommendations(recommendations, collaborativeRecs, 0.4);

      // 2. Content-Based Filtering (30% weight)
      const contentRecs = await this.contentBasedFiltering(currentProduct);
      this.addToRecommendations(recommendations, contentRecs, 0.3);

      // 3. User Browsing History (20% weight)
      const historyRecs = await this.browsingHistoryBased(currentProduct, userId);
      this.addToRecommendations(recommendations, historyRecs, 0.2);

      // 4. Wishlist Patterns (10% weight)
      const wishlistRecs = await this.wishlistBased(currentProduct, userId);
      this.addToRecommendations(recommendations, wishlistRecs, 0.1);

      // Convert Map to sorted array
      return Array.from(recommendations.values())
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, limit);
    } catch (error) {
      console.error('❌ Error in user-specific recommendations:', error);
      // Fallback to content-based if user-specific fails
      return await this.contentBasedFiltering(currentProduct);
    }
  }

  // Collaborative Filtering: "Users who viewed this also viewed"
  async collaborativeFiltering(currentProduct, userId) {
    try {
      console.log(`🤝 Running collaborative filtering for user: ${userId}`);

      // Find users who viewed the current product (excluding null userIds for better similarity)
      const usersWhoViewed = await BrowsingHistory.aggregate([
        { 
          $match: { 
            productId: currentProduct._id,
            userId: { $ne: null } // ✅ UPDATED: Only consider logged-in users for collaborative filtering
          } 
        },
        { 
          $group: { 
            _id: '$userId',
            viewCount: { $sum: 1 },
            lastViewed: { $max: '$viewedAt' }
          }
        },
        { $sort: { viewCount: -1, lastViewed: -1 } },
        { $limit: 50 } // Top 50 similar users
      ]);

      if (usersWhoViewed.length === 0) {
        console.log(`ℹ️ No similar users found for collaborative filtering`);
        return [];
      }

      const similarUserIds = usersWhoViewed.map(user => user._id);

      // ✅ UPDATED: Find products viewed by these users (handle null userId properly)
      const matchQuery = {
        userId: { $in: similarUserIds },
        productId: { $ne: currentProduct._id }
      };

      // If current user exists, exclude their history
      if (userId) {
        matchQuery.userId = { $in: similarUserIds, $ne: new mongoose.Types.ObjectId(userId) };
      }

      const collaborativeProducts = await BrowsingHistory.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$productId',
            viewerCount: { $addToSet: '$userId' },
            totalViews: { $sum: 1 },
            avgTimeSpent: { $avg: '$timeSpent' },
            wishlistAdds: { $sum: { $cond: ['$addedToWishlist', 1, 0] } },
            bagAdds: { $sum: { $cond: ['$addedToBag', 1, 0] } }
          }
        },
        {
          $addFields: {
            uniqueViewers: { $size: '$viewerCount' },
            engagementScore: {
              $add: [
                { $multiply: ['$totalViews', 0.3] },
                { $multiply: [{ $ifNull: ['$avgTimeSpent', 0] }, 0.2] }, // ✅ UPDATED: Handle null values
                { $multiply: ['$wishlistAdds', 0.25] },
                { $multiply: ['$bagAdds', 0.25] }
              ]
            }
          }
        },
        { $sort: { uniqueViewers: -1, engagementScore: -1 } },
        { $limit: 20 }
      ]);

      // Populate product details
      const productIds = collaborativeProducts.map(item => item._id);
      const products = await Product.find({ 
        _id: { $in: productIds },
        isActive: { $ne: false } // ✅ UPDATED: Handle missing isActive field
      }).lean();

      const result = products.map(product => {
        const stats = collaborativeProducts.find(
          item => item._id.toString() === product._id.toString()
        );
        return {
          product,
          score: Math.min((stats?.engagementScore || 0) / 100, 1), // ✅ UPDATED: Handle undefined stats
          reason: 'collaborative_filtering',
          metadata: {
            viewerCount: stats?.uniqueViewers || 0,
            totalViews: stats?.totalViews || 0
          }
        };
      });

      console.log(`🤝 Collaborative filtering found ${result.length} recommendations`);
      return result;

    } catch (error) {
      console.error('❌ Collaborative filtering error:', error);
      return [];
    }
  }

  // Content-Based Filtering: Similar products by attributes
  async contentBasedFiltering(currentProduct) {
    try {
      console.log(`📊 Running content-based filtering for product: ${currentProduct.name}`);

      const query = {
        _id: { $ne: currentProduct._id },
        isActive: { $ne: false } // ✅ UPDATED: Handle missing isActive field
      };

      // Primary filter: Same category
      if (currentProduct.category) {
        query.category = currentProduct.category;
      }

      // Price range filter (±30%)
      if (currentProduct.price && currentProduct.price > 0) {
        const priceRange = currentProduct.price * 0.3;
        query.price = {
          $gte: currentProduct.price - priceRange,
          $lte: currentProduct.price + priceRange
        };
      }

      const similarProducts = await Product.find(query)
        .limit(20)
        .lean();

      // Calculate similarity scores
      const result = similarProducts.map(product => ({
        product,
        score: similarityService.calculateProductSimilarity(currentProduct, product),
        reason: 'content_similarity'
      })).filter(item => item.score > 0.3) // Minimum similarity threshold
        .sort((a, b) => b.score - a.score);

      console.log(`📊 Content-based filtering found ${result.length} recommendations`);
      return result;

    } catch (error) {
      console.error('❌ Content-based filtering error:', error);
      return [];
    }
  }

  // Browsing History Based: Products from user's browsing patterns
  async browsingHistoryBased(currentProduct, userId) {
    try {
      if (!userId) {
        console.log(`ℹ️ Skipping browsing history recommendations for anonymous user`);
        return [];
      }

      console.log(`📚 Running browsing history-based filtering for user: ${userId}`);

      // Get user's recent browsing history (last 30 days)
      const recentHistory = await BrowsingHistory.find({
        userId: new mongoose.Types.ObjectId(userId), // ✅ UPDATED: Ensure ObjectId conversion
        productId: { $ne: currentProduct._id },
        viewedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      })
      .populate('productId')
      .sort({ viewedAt: -1 })
      .limit(50);

      if (recentHistory.length === 0) {
        console.log(`ℹ️ No recent browsing history found for user: ${userId}`);
        return [];
      }

      // Extract categories and brands from browsing history
      const categoryPreferences = new Map();
      const brandPreferences = new Map();

      recentHistory.forEach(history => {
        const product = history.productId;
        if (product?.category) {
          categoryPreferences.set(
            product.category.toString(),
            (categoryPreferences.get(product.category.toString()) || 0) + 1
          );
        }
        if (product?.brand) {
          brandPreferences.set(
            product.brand,
            (brandPreferences.get(product.brand) || 0) + 1
          );
        }
      });

      // Find products matching user preferences
      const preferredCategories = Array.from(categoryPreferences.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(entry => entry[0]);

      const preferredBrands = Array.from(brandPreferences.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(entry => entry[0]);

      if (preferredCategories.length === 0 && preferredBrands.length === 0) {
        console.log(`ℹ️ No clear preferences found in browsing history`);
        return [];
      }

      const historyBasedProducts = await Product.find({
        _id: { $ne: currentProduct._id },
        $or: [
          { category: { $in: preferredCategories } },
          { brand: { $in: preferredBrands } }
        ],
        isActive: { $ne: false } // ✅ UPDATED: Handle missing isActive field
      })
      .limit(15)
      .lean();

      const result = historyBasedProducts.map(product => {
        let score = 0;
        
        // Category preference score
        if (preferredCategories.includes(product.category?.toString())) {
          const categoryRank = preferredCategories.indexOf(product.category.toString());
          score += (3 - categoryRank) * 0.3; // Higher score for more preferred categories
        }

        // Brand preference score
        if (preferredBrands.includes(product.brand)) {
          const brandRank = preferredBrands.indexOf(product.brand);
          score += (5 - brandRank) * 0.2; // Higher score for more preferred brands
        }

        return {
          product,
          score: Math.min(score, 1),
          reason: 'user_behavior'
        };
      }).filter(item => item.score > 0);

      console.log(`📚 Browsing history-based filtering found ${result.length} recommendations`);
      return result;

    } catch (error) {
      console.error('❌ Browsing history based filtering error:', error);
      return [];
    }
  }

  // Wishlist Based: Products similar to user's wishlist items
  async wishlistBased(currentProduct, userId) {
    try {
      if (!userId) {
        console.log(`ℹ️ Skipping wishlist recommendations for anonymous user`);
        return [];
      }

      console.log(`💖 Running wishlist-based filtering for user: ${userId}`);

      const wishlistItems = await Wishlist.find({ userId: new mongoose.Types.ObjectId(userId) }) // ✅ UPDATED: Ensure ObjectId conversion
        .populate('productId')
        .limit(20);

      if (wishlistItems.length === 0) {
        console.log(`ℹ️ No wishlist items found for user: ${userId}`);
        return [];
      }

      // Get categories and price ranges from wishlist
      const wishlistCategories = new Set();
      let avgWishlistPrice = 0;
      let validPriceCount = 0;

      wishlistItems.forEach(item => {
        if (item.productId?.category) {
          wishlistCategories.add(item.productId.category.toString());
        }
        if (item.productId?.price && item.productId.price > 0) {
          avgWishlistPrice += item.productId.price;
          validPriceCount++;
        }
      });

      if (validPriceCount > 0) {
        avgWishlistPrice /= validPriceCount;
      } else {
        avgWishlistPrice = currentProduct.price || 1000; // Fallback price
      }

      // Find products similar to wishlist preferences
      const priceRange = avgWishlistPrice * 0.4; // ±40% of average wishlist price
      
      const query = {
        _id: { $ne: currentProduct._id },
        isActive: { $ne: false } // ✅ UPDATED: Handle missing isActive field
      };

      if (wishlistCategories.size > 0) {
        query.category = { $in: Array.from(wishlistCategories) };
      }

      if (avgWishlistPrice > 0) {
        query.price = {
          $gte: Math.max(avgWishlistPrice - priceRange, 0),
          $lte: avgWishlistPrice + priceRange
        };
      }

      const wishlistSimilarProducts = await Product.find(query)
        .limit(10)
        .lean();

      const result = wishlistSimilarProducts.map(product => ({
        product,
        score: 0.7, // Fixed score for wishlist-based recommendations
        reason: 'wishlist_pattern'
      }));

      console.log(`💖 Wishlist-based filtering found ${result.length} recommendations`);
      return result;

    } catch (error) {
      console.error('❌ Wishlist based filtering error:', error);
      return [];
    }
  }

  // Generic recommendations for non-logged users
  async generateGenericRecommendations(currentProduct, limit) {
    const recommendations = new Map();

    try {
      // 1. Same category products (60% weight)
      const categoryRecs = await this.contentBasedFiltering(currentProduct);
      this.addToRecommendations(recommendations, categoryRecs, 0.6);

      // 2. Popular products (40% weight)
      const popularRecs = await this.getPopularProducts(currentProduct, 10);
      this.addToRecommendations(recommendations, popularRecs, 0.4);

      return Array.from(recommendations.values())
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, limit);
    } catch (error) {
      console.error('❌ Error in generic recommendations:', error);
      return await this.getFallbackRecommendations(currentProduct._id, limit);
    }
  }

  // Helper method to add recommendations with weights
  addToRecommendations(recommendations, newRecs, weight) {
    newRecs.forEach(rec => {
      const productId = rec.product._id.toString();
      const weightedScore = rec.score * weight;
      
      if (recommendations.has(productId)) {
        const existing = recommendations.get(productId);
        existing.totalScore += weightedScore;
        existing.reasons.push(rec.reason);
      } else {
        recommendations.set(productId, {
          product: rec.product,
          totalScore: weightedScore,
          reasons: [rec.reason],
          metadata: rec.metadata || {}
        });
      }
    });
  }

  // Get popular products as fallback
  async getPopularProducts(currentProduct, limit) {
    try {
      const popularProducts = await Product.aggregate([
        {
          $match: {
            _id: { $ne: currentProduct._id },
            isActive: { $ne: false } // ✅ UPDATED: Handle missing isActive field
          }
        },
        {
          $addFields: {
            popularityScore: {
              $add: [
                { $multiply: [{ $ifNull: ['$rating', 0] }, 20] },
                { $multiply: [{ $ifNull: ['$ratingCount', 0] }, 2] },
                { $multiply: [{ $ifNull: ['$popularity', 0] }, 1] }
              ]
            }
          }
        },
        { $sort: { popularityScore: -1 } },
        { $limit: limit }
      ]);

      return popularProducts.map(product => ({
        product,
        score: 0.5, // Medium score for popular products
        reason: 'popularity'
      }));

    } catch (error) {
      console.error('❌ Popular products error:', error);
      return [];
    }
  }

  // Fallback recommendations
  async getFallbackRecommendations(productId, limit) {
    try {
      console.log(`🆘 Using fallback recommendations for product: ${productId}`);

      const currentProduct = await Product.findById(productId);
      if (!currentProduct) return [];

      const fallbackProducts = await Product.find({
        _id: { $ne: productId },
        category: currentProduct.category,
        isActive: { $ne: false } // ✅ UPDATED: Handle missing isActive field
      })
      .sort({ rating: -1, ratingCount: -1 })
      .limit(limit)
      .lean();

      return fallbackProducts.map(product => ({
        product,
        totalScore: 0.3, // Low score for fallback
        reasons: ['fallback'],
        metadata: {}
      }));

    } catch (error) {
      console.error('❌ Fallback recommendations error:', error);
      return [];
    }
  }

  // Cache management
  async getCachedRecommendations(productId, userId) {
    try {
      const cached = await ProductRecommendation.findOne({
        forProductId: productId,
        userId: userId || null,
        expiresAt: { $gt: new Date() }
      }).populate('recommendedProducts.productId');

      if (cached && cached.recommendedProducts) {
        return cached.recommendedProducts.map(rec => ({
          product: rec.productId,
          totalScore: rec.score,
          reasons: rec.reasons || [],
          metadata: {}
        }));
      }

      return null;
    } catch (error) {
      console.error('❌ Cache retrieval error:', error);
      return null;
    }
  }

  async cacheRecommendations(productId, userId, recommendations) {
    try {
      if (!recommendations || recommendations.length === 0) {
        console.log(`ℹ️ No recommendations to cache`);
        return;
      }

      const recommendedProducts = recommendations.map(rec => ({
        productId: rec.product._id,
        score: rec.totalScore || rec.score,
        reasons: rec.reasons || [rec.reason],
        weight: 1
      }));

      await ProductRecommendation.findOneAndUpdate(
        {
          forProductId: productId,
          userId: userId || null
        },
        {
          recommendedProducts,
          algorithm: userId ? 'hybrid' : 'generic',
          lastUpdated: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        },
        { upsert: true, new: true }
      );

      console.log(`💾 Cached ${recommendedProducts.length} recommendations`);
    } catch (error) {
      console.error('❌ Cache storage error:', error);
    }
  }

  // ✅ UPDATED: Track browsing history with better null handling
  async trackBrowsingHistory(userId, productId, sessionId, metadata = {}) {
    try {
      console.log(`📊 Tracking browsing history - User: ${userId || 'anonymous'}, Product: ${productId}, Session: ${sessionId}`);

      // ✅ UPDATED: Build query that handles null userId properly
      const recentViewQuery = {
        productId,
        sessionId,
        viewedAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) } // 30 minutes
      };

      // Add userId to query (can be null)
      recentViewQuery.userId = userId;

      const recentView = await BrowsingHistory.findOne(recentViewQuery);

      if (recentView) {
        // Update existing entry
        console.log(`📝 Updating existing browsing history entry`);
        return await BrowsingHistory.findByIdAndUpdate(recentView._id, {
          viewedAt: new Date(),
          timeSpent: Math.max(metadata.timeSpent || 0, recentView.timeSpent || 0),
          scrollDepth: Math.max(metadata.scrollDepth || 0, recentView.scrollDepth || 0),
          addedToWishlist: metadata.addedToWishlist || recentView.addedToWishlist,
          addedToBag: metadata.addedToBag || recentView.addedToBag,
          source: metadata.source || recentView.source,
          deviceInfo: metadata.deviceInfo || recentView.deviceInfo
        }, { new: true });
      } else {
        // Create new entry
        console.log(`📝 Creating new browsing history entry`);
        return await BrowsingHistory.create({
          userId: userId || null, // ✅ UPDATED: Explicitly handle null
          productId,
          sessionId,
          viewedAt: new Date(),
          timeSpent: metadata.timeSpent || 0,
          source: metadata.source || 'direct',
          deviceInfo: metadata.deviceInfo || '',
          scrollDepth: metadata.scrollDepth || 0,
          addedToWishlist: metadata.addedToWishlist || false,
          addedToBag: metadata.addedToBag || false
        });
      }
    } catch (error) {
      console.error('❌ Browsing history tracking error:', error);
      throw error;
    }
  }
}

module.exports = new RecommendationService();
