const express = require('express');
const mongoose = require('mongoose');
const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');

const router = express.Router();

// ============================================================================
// ENHANCED WISHLIST ROUTES WITH PROFESSIONAL FEATURES
// ============================================================================

// ✅ POST - Add product to wishlist
router.post('/', async (req, res) => {
  try {
    const { userId, productId, priority = 'medium', notes = '', priceAlertEnabled = false } = req.body;

    // Validate required fields
    if (!userId || !productId) {
      return res.status(400).json({
        success: false,
        message: 'userId and productId are required'
      });
    }

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid userId or productId format'
      });
    }

    // Check if product exists
    const product = await Product.findById(productId).select('price name brand');
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if item already exists in wishlist
    const existingItem = await Wishlist.findOne({ userId, productId });
    if (existingItem) {
      return res.status(409).json({
        success: false,
        message: 'Product already in wishlist',
        data: existingItem
      });
    }

    // Create new wishlist item
    const wishlistData = {
      userId,
      productId,
      priority,
      notes: notes.trim(),
      priceAlertEnabled,
      originalPrice: product.price
    };

    const newItem = new Wishlist(wishlistData);
    await newItem.save();

    // Populate product details for response
    const populatedItem = await Wishlist.findById(newItem._id).populate({
      path: 'productId',
      select: 'name brand price discount images rating ratingCount isNew isFeatured'
    });

    res.status(201).json({
      success: true,
      message: 'Product added to wishlist successfully',
      data: populatedItem
    });

  } catch (error) {
    console.error('Error adding to wishlist:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Product already exists in wishlist'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to add product to wishlist',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ GET - Get user's wishlist with advanced options
router.get('/:userid', async (req, res) => {
  try {
    const { userid } = req.params;
    const {
      page = 1,
      limit = 20,
      sortBy = 'addedAt',
      sortOrder = 'desc',
      priority,
      search,
      priceRange,
      includeStats = 'false'
    } = req.query;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(userid)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    // Build query options
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;
    const sortOrderNum = sortOrder.toLowerCase() === 'desc' ? -1 : 1;

    // Build base query
    let query = { userId: userid };
    if (priority) query.priority = priority;

    // Get wishlist items with population
    let wishlistItems = await Wishlist.find(query)
      .populate({
        path: 'productId',
        select: 'name brand price discount images rating ratingCount isNew isFeatured'
      })
      .sort({ [sortBy]: sortOrderNum })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Apply search filter if provided
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      wishlistItems = wishlistItems.filter(item => 
        item.productId && (
          searchRegex.test(item.productId.name) ||
          searchRegex.test(item.productId.brand)
        )
      );
    }

    // Apply price range filter if provided
    if (priceRange) {
      const [minPrice, maxPrice] = priceRange.split('-').map(Number);
      if (!isNaN(minPrice) && !isNaN(maxPrice)) {
        wishlistItems = wishlistItems.filter(item => 
          item.productId && 
          item.productId.price >= minPrice && 
          item.productId.price <= maxPrice
        );
      }
    }

    // Remove items with null productId (deleted products)
    wishlistItems = wishlistItems.filter(item => item.productId);

    // Get total count for pagination
    const totalCount = await Wishlist.countDocuments({ userId: userid });

    // Prepare response
    const response = {
      success: true,
      data: wishlistItems,
      meta: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum),
        hasNextPage: pageNum * limitNum < totalCount,
        hasPrevPage: pageNum > 1,
        showing: `${skip + 1}-${Math.min(skip + limitNum, totalCount)} of ${totalCount}`
      },
      filters: {
        applied: { priority, search, priceRange, sortBy, sortOrder },
        totalItems: wishlistItems.length
      }
    };

    // Add statistics if requested
    if (includeStats === 'true') {
      const stats = await Wishlist.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userid) } },
        {
          $lookup: {
            from: 'products',
            localField: 'productId',
            foreignField: '_id',
            as: 'product'
          }
        },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
        { $match: { product: { $ne: null } } },
        {
          $group: {
            _id: null,
            totalItems: { $sum: 1 },
            totalValue: { $sum: '$product.price' },
            avgPrice: { $avg: '$product.price' },
            priorityBreakdown: { $push: '$priority' },
            brandsCount: { $addToSet: '$product.brand' },
            oldestItem: { $min: '$addedAt' },
            newestItem: { $max: '$addedAt' }
          }
        }
      ]);

      if (stats.length > 0) {
        const stat = stats[0];
        response.statistics = {
          totalItems: stat.totalItems,
          totalValue: Math.round(stat.totalValue),
          averagePrice: Math.round(stat.avgPrice),
          uniqueBrands: stat.brandsCount.length,
          oldestItemDays: Math.floor((new Date() - stat.oldestItem) / (1000 * 60 * 60 * 24)),
          priorityBreakdown: {
            high: stat.priorityBreakdown.filter(p => p === 'high').length,
            medium: stat.priorityBreakdown.filter(p => p === 'medium').length,
            low: stat.priorityBreakdown.filter(p => p === 'low').length
          }
        };
      }
    }

    res.status(200).json(response);

  } catch (error) {
    console.error('Error fetching wishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch wishlist',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ DELETE - Remove item from wishlist by item ID
router.delete('/:itemid', async (req, res) => {
  try {
    const { itemid } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(itemid)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid item ID format'
      });
    }

    // Find and delete the item
    const deletedItem = await Wishlist.findByIdAndDelete(itemid)
      .populate({
        path: 'productId',
        select: 'name brand'
      });

    if (!deletedItem) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist item not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Item removed from wishlist successfully',
      data: {
        removedItem: {
          _id: deletedItem._id,
          productName: deletedItem.productId?.name || 'Unknown Product',
          productBrand: deletedItem.productId?.brand || 'Unknown Brand',
          removedAt: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    console.error('Error removing from wishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove item from wishlist',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ NEW: Remove by product ID (frontend-friendly)
router.delete('/user/:userid/product/:productid', async (req, res) => {
  try {
    const { userid, productid } = req.params;

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(userid) || !mongoose.Types.ObjectId.isValid(productid)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID or product ID format'
      });
    }

    // Find and delete the item
    const deletedItem = await Wishlist.findOneAndDelete({
      userId: userid,
      productId: productid
    }).populate({
      path: 'productId',
      select: 'name brand'
    });

    if (!deletedItem) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist item not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Item removed from wishlist successfully',
      data: {
        removedItem: {
          _id: deletedItem._id,
          productName: deletedItem.productId?.name || 'Unknown Product',
          productBrand: deletedItem.productId?.brand || 'Unknown Brand',
          removedAt: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    console.error('Error removing from wishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove item from wishlist',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ NEW: Check if product is in user's wishlist
router.get('/check/:userid/:productid', async (req, res) => {
  try {
    const { userid, productid } = req.params;

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(userid) || !mongoose.Types.ObjectId.isValid(productid)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID or product ID format'
      });
    }

    const wishlistItem = await Wishlist.findOne({
      userId: userid,
      productId: productid
    });

    res.status(200).json({
      success: true,
      data: {
        isInWishlist: !!wishlistItem,
        wishlistItemId: wishlistItem?._id || null,
        addedAt: wishlistItem?.addedAt || null
      }
    });

  } catch (error) {
    console.error('Error checking wishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check wishlist status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ NEW: Clear entire wishlist for user
router.delete('/user/:userid/clear', async (req, res) => {
  try {
    const { userid } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(userid)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    const result = await Wishlist.deleteMany({ userId: userid });

    res.status(200).json({
      success: true,
      message: `Cleared ${result.deletedCount} items from wishlist`,
      data: {
        deletedCount: result.deletedCount,
        clearedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error clearing wishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear wishlist',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
