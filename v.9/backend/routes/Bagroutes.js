const express = require("express");
const Bag = require("../models/Bag");
const Product = require("../models/Product");
const Wishlist = require("../models/Wishlist"); // NEW: Import Wishlist model
const router = express.Router();
const mongoose = require("mongoose");

// ============================================================================
// ENHANCED BAG/CART ROUTES WITH PROFESSIONAL FEATURES
// ============================================================================

// ✅ Enhanced POST - Add item to bag with advanced validation and wishlist logic
router.post("/", async (req, res) => {
  try {
    const {
      userId,
      productId,
      size = 'M',
      color = '',
      quantity = 1,
      addedFrom = 'product_page'
    } = req.body;

    // Validate required fields
    if (!userId || !productId) {
      return res.status(400).json({
        success: false,
        message: "userId and productId are required"
      });
    }

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId or productId format"
      });
    }

    // Validate quantity
    if (quantity < 1 || quantity > 10) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be between 1 and 10"
      });
    }

    // Check if product exists and get current details
    const product = await Product.findById(productId).select(
      'name brand price discount images stock sizes colors isNew isFeatured'
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    // Check stock availability
    if (product.stock !== undefined && product.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.stock} items available in stock`,
        availableStock: product.stock
      });
    }

    // Validate size if product has specific sizes
    if (product.sizes && product.sizes.length > 0 && !product.sizes.includes(size)) {
      return res.status(400).json({
        success: false,
        message: "Selected size not available for this product",
        availableSizes: product.sizes
      });
    }

    // Validate color if product has specific colors
    if (color && product.colors && product.colors.length > 0 && !product.colors.includes(color)) {
      return res.status(400).json({
        success: false,
        message: "Selected color not available for this product",
        availableColors: product.colors
      });
    }

    // Check if same item (product + size + color) already exists in bag
    const existingItem = await Bag.findByUserAndProduct(userId, productId, size, color);
    
    if (existingItem) {
      // Update quantity of existing item
      const newQuantity = Math.min(existingItem.quantity + quantity, 10);
      
      if (newQuantity > 10) {
        return res.status(400).json({
          success: false,
          message: "Cannot add more items. Maximum quantity per item is 10",
          currentQuantity: existingItem.quantity
        });
      }

      existingItem.quantity = newQuantity;
      const updatedItem = await existingItem.save();

      // Populate product details for response
      const populatedItem = await Bag.findById(updatedItem._id)
        .populate({
          path: 'productId',
          select: 'name brand price discount images rating ratingCount stock'
        });

      return res.status(200).json({
        success: true,
        message: "Item quantity updated in bag",
        data: populatedItem,
        action: 'updated'
      });
    }

    // Create new bag item
    const bagData = {
      userId,
      productId,
      size: size.trim(),
      color: color.trim(),
      quantity,
      priceWhenAdded: product.price,
      discountWhenAdded: product.discount || '',
      addedFrom,
      savedForLater: false
    };

    const newBagItem = new Bag(bagData);
    const savedItem = await newBagItem.save();

    // NEW: Automatically remove the item from the wishlist
    await Wishlist.findOneAndDelete({ userId: userId, productId: productId });

    // Populate product details for response
    const populatedItem = await Bag.findById(savedItem._id)
      .populate({
        path: 'productId',
        select: 'name brand price discount images rating ratingCount stock'
      });

    res.status(201).json({
      success: true,
      message: "Product added to bag successfully and removed from wishlist if it existed",
      data: populatedItem,
      action: 'added'
    });

  } catch (error) {
    console.error("Error adding to bag:", error);
    
    // Handle specific mongoose errors
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Item with same specifications already exists in bag"
      });
    }

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: "Invalid data provided",
        details: Object.values(error.errors).map(err => err.message)
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to add product to bag",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ FIXED: Enhanced GET - Get user's bag with corrected MongoDB queries
router.get("/:userid", async (req, res) => {
  try {
    const { userid } = req.params;
    const {
      includeSaved = 'false',
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      includeStats = 'false'
    } = req.query;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(userid)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }

    // Build query options
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;
    const sortOrderNum = sortOrder.toLowerCase() === 'desc' ? -1 : 1;

    // ✅ FIXED: Corrected MongoDB query syntax
    let bagItems = await Bag.find({ userId: userid, savedForLater: false })
      .populate({
        path: 'productId',
        select: 'name brand price discount images rating ratingCount stock colors sizes isNew isFeatured category',
        // ✅ FIXED: Use proper field-condition syntax instead of top-level $ne
        match: { _id: { $exists: true } }
      })
      .populate({
        path: 'appliedCoupon',
        select: 'code description discount_type discount_value'
      })
      .sort({ [sortBy]: sortOrderNum })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Remove items with null productId (deleted products)
    bagItems = bagItems.filter(item => item.productId);

    // Check for price changes and stock issues
    const itemsWithUpdates = bagItems.map(item => {
      const bagItem = { ...item };
      
      if (item.productId) {
        // Check if price changed
        bagItem.priceChanged = item.priceWhenAdded !== item.productId.price;
        bagItem.currentPrice = item.productId.price;
        bagItem.priceDifference = item.productId.price - item.priceWhenAdded;
        
        // Check stock availability
        bagItem.inStock = !item.productId.stock || item.productId.stock >= item.quantity;
        bagItem.availableStock = item.productId.stock;
        
        // Check if size/color still available
        bagItem.sizeAvailable = !item.productId.sizes ||
          item.productId.sizes.length === 0 ||
          item.productId.sizes.includes(item.size);
        bagItem.colorAvailable = !item.color ||
          !item.productId.colors ||
          item.productId.colors.length === 0 ||
          item.productId.colors.includes(item.color);
      }
      
      return bagItem;
    });

    // Calculate totals
    const totals = {
      itemCount: bagItems.length,
      totalQuantity: bagItems.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: bagItems.reduce((sum, item) =>
        sum + (item.quantity * (item.productId?.price || item.priceWhenAdded)), 0
      ),
      originalTotal: bagItems.reduce((sum, item) =>
        sum + (item.quantity * item.priceWhenAdded), 0
      ),
      savings: 0,
      outOfStockItems: itemsWithUpdates.filter(item => !item.inStock).length,
      priceChangedItems: itemsWithUpdates.filter(item => item.priceChanged).length
    };

    totals.savings = totals.originalTotal - totals.subtotal;

    // ✅ FIXED: Apply coupon discount with proper query syntax
    const bagWithCoupon = await Bag.findOne({ 
      userId: userid, 
      appliedCoupon: { $exists: true, $ne: null } 
    }).populate('appliedCoupon');
    
    const couponDiscount = bagWithCoupon && bagWithCoupon.appliedCoupon ? bagWithCoupon.discountAmount : 0;
    
    let finalTotalAfterDiscount = totals.subtotal - couponDiscount;
    if (finalTotalAfterDiscount < 0) finalTotalAfterDiscount = 0;

    // Estimated shipping and tax (can be made dynamic)
    const shipping = finalTotalAfterDiscount > 499 ? 0 : 99;
    const tax = Math.round(finalTotalAfterDiscount * 0.05); // 5% tax
    const finalTotalWithShippingAndTax = finalTotalAfterDiscount + shipping + tax;

    // Get total count for pagination
    const totalCount = await Bag.getUserBagCount(userid, includeSaved === 'true');

    // Prepare comprehensive response
    const response = {
      success: true,
      data: itemsWithUpdates,
      totals: {
        ...totals,
        shipping,
        tax,
        couponDiscount: Math.round(couponDiscount),
        finalTotal: Math.round(finalTotalWithShippingAndTax)
      },
      meta: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum),
        hasNextPage: pageNum * limitNum < totalCount,
        hasPrevPage: pageNum > 1,
        includeSaved: includeSaved === 'true'
      },
      alerts: {
        hasOutOfStockItems: totals.outOfStockItems > 0,
        hasPriceChanges: totals.priceChangedItems > 0,
        freeShippingEligible: finalTotalAfterDiscount > 499,
        freeShippingRemaining: Math.max(0, 499 - finalTotalAfterDiscount),
        couponApplied: !!bagWithCoupon
      }
    };

    if (bagWithCoupon) {
      response.coupon = {
        code: bagWithCoupon.appliedCoupon.code,
        description: bagWithCoupon.appliedCoupon.description,
        discount_value: bagWithCoupon.appliedCoupon.discount_value,
        discount_type: bagWithCoupon.appliedCoupon.discount_type,
        couponDiscount: couponDiscount
      };
    }

    // ✅ FIXED: Add detailed statistics with corrected aggregate syntax
    if (includeStats === 'true') {
      const stats = await Bag.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userid), savedForLater: false } },
        {
          $lookup: {
            from: 'products',
            localField: 'productId',
            foreignField: '_id',
            as: 'product'
          }
        },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
        { $match: { product: { $exists: true } } },
        {
          $group: {
            _id: null,
            totalItems: { $sum: 1 },
            totalQuantity: { $sum: '$quantity' },
            uniqueBrands: { $addToSet: '$product.brand' },
            avgItemPrice: { $avg: '$product.price' },
            oldestItem: { $min: '$createdAt' },
            newestItem: { $max: '$createdAt' },
            sizeBreakdown: { $push: '$size' },
            sourceBreakdown: { $push: '$addedFrom' }
          }
        }
      ]);

      if (stats.length > 0) {
        const stat = stats[0];
        response.statistics = {
          uniqueBrands: stat.uniqueBrands.length,
          averageItemPrice: Math.round(stat.avgItemPrice),
          oldestItemDays: Math.floor((new Date() - stat.oldestItem) / (1000 * 60 * 60 * 24)),
          sizeBreakdown: stat.sizeBreakdown.reduce((acc, size) => {
            acc[size] = (acc[size] || 0) + 1;
            return acc;
          }, {}),
          sourceBreakdown: stat.sourceBreakdown.reduce((acc, source) => {
            acc[source] = (acc[source] || 0) + 1;
            return acc;
          }, {})
        };
      }
    }

    res.status(200).json(response);

  } catch (error) {
    console.error("Error fetching bag:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bag",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ Enhanced PUT - Update item quantity in bag
router.put("/:itemid/quantity", async (req, res) => {
  try {
    const { itemid } = req.params;
    const { quantity } = req.body;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(itemid)) {
      return res.status(400).json({
        success: false,
        message: "Invalid item ID format"
      });
    }

    // Validate quantity
    if (!quantity || quantity < 1 || quantity > 10) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be between 1 and 10"
      });
    }

    // Find the bag item
    const bagItem = await Bag.findById(itemid).populate({
      path: 'productId',
      select: 'name brand stock'
    });

    if (!bagItem) {
      return res.status(404).json({
        success: false,
        message: "Bag item not found"
      });
    }

    if (!bagItem.productId) {
      return res.status(404).json({
        success: false,
        message: "Product no longer available"
      });
    }

    // Check stock availability
    if (bagItem.productId.stock !== undefined && bagItem.productId.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${bagItem.productId.stock} items available in stock`,
        availableStock: bagItem.productId.stock,
        currentQuantity: bagItem.quantity
      });
    }

    // Update quantity
    bagItem.quantity = quantity;
    await bagItem.save();

    // Get updated item with product details
    const updatedItem = await Bag.findById(itemid).populate({
      path: 'productId',
      select: 'name brand price discount images rating stock'
    });

    res.status(200).json({
      success: true,
      message: "Quantity updated successfully",
      data: updatedItem,
      previousQuantity: bagItem.quantity,
      newQuantity: quantity
    });

  } catch (error) {
    console.error("Error updating quantity:", error);
    
    if (error.message.includes('Quantity must be between')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update quantity",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ Enhanced DELETE - Remove item from bag
router.delete("/:itemid", async (req, res) => {
  try {
    const { itemid } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(itemid)) {
      return res.status(400).json({
        success: false,
        message: "Invalid item ID format"
      });
    }

    // Find and delete the item
    const deletedItem = await Bag.findByIdAndDelete(itemid)
      .populate({
        path: 'productId',
        select: 'name brand price images'
      });

    if (!deletedItem) {
      return res.status(404).json({
        success: false,
        message: "Bag item not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Item removed from bag successfully",
      data: {
        removedItem: {
          _id: deletedItem._id,
          productName: deletedItem.productId?.name || 'Unknown Product',
          productBrand: deletedItem.productId?.brand || 'Unknown Brand',
          quantity: deletedItem.quantity,
          size: deletedItem.size,
          color: deletedItem.color,
          removedAt: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    console.error("Error removing from bag:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove item from bag",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ NEW: Move item to saved for later
router.patch("/:itemid/save", async (req, res) => {
  try {
    const { itemid } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(itemid)) {
      return res.status(400).json({
        success: false,
        message: "Invalid item ID format"
      });
    }

    const bagItem = await Bag.findById(itemid);
    
    if (!bagItem) {
      return res.status(404).json({
        success: false,
        message: "Bag item not found"
      });
    }

    // Move to saved for later
    bagItem.savedForLater = true;
    bagItem.savedAt = new Date();
    await bagItem.save();

    // Get updated item with product details
    const updatedItem = await Bag.findById(itemid).populate({
      path: 'productId',
      select: 'name brand price discount images'
    });

    res.status(200).json({
      success: true,
      message: "Item moved to saved for later",
      data: updatedItem
    });

  } catch (error) {
    console.error("Error saving item for later:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save item for later",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ NEW: Move item back to bag from saved
router.patch("/:itemid/move-to-bag", async (req, res) => {
  try {
    const { itemid } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(itemid)) {
      return res.status(400).json({
        success: false,
        message: "Invalid item ID format"
      });
    }

    const bagItem = await Bag.findById(itemid);
    
    if (!bagItem) {
      return res.status(404).json({
        success: false,
        message: "Saved item not found"
      });
    }

    // Move back to bag
    bagItem.savedForLater = false;
    bagItem.savedAt = null;
    await bagItem.save();

    // Get updated item with product details
    const updatedItem = await Bag.findById(itemid).populate({
      path: 'productId',
      select: 'name brand price discount images stock'
    });

    res.status(200).json({
      success: true,
      message: "Item moved back to bag",
      data: updatedItem
    });

  } catch (error) {
    console.error("Error moving item to bag:", error);
    res.status(500).json({
      success: false,
      message: "Failed to move item to bag",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ NEW: Get saved for later items
router.get("/:userid/saved", async (req, res) => {
  try {
    const { userid } = req.params;
    const {
      page = 1,
      limit = 20,
      sortBy = 'savedAt',
      sortOrder = 'desc'
    } = req.query;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(userid)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;
    const sortOrderNum = sortOrder.toLowerCase() === 'desc' ? -1 : 1;

    const savedItems = await Bag.find({ 
      userId: userid, 
      savedForLater: true 
    })
      .populate({
        path: 'productId',
        select: 'name brand price discount images rating ratingCount stock',
        match: { _id: { $exists: true } }
      })
      .sort({ [sortBy]: sortOrderNum })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Filter out items with null productId
    const validSavedItems = savedItems.filter(item => item.productId);

    // Get total count
    const totalCount = await Bag.countDocuments({
      userId: userid,
      savedForLater: true
    });

    res.status(200).json({
      success: true,
      data: validSavedItems,
      meta: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum),
        hasNextPage: pageNum * limitNum < totalCount,
        hasPrevPage: pageNum > 1
      }
    });

  } catch (error) {
    console.error("Error fetching saved items:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch saved items",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ NEW: Clear entire bag for user
router.delete("/user/:userid/clear", async (req, res) => {
  try {
    const { userid } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(userid)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }

    const result = await Bag.deleteMany({ 
      userId: userid, 
      savedForLater: false 
    });

    res.status(200).json({
      success: true,
      message: `Cleared ${result.deletedCount} items from bag`,
      data: {
        deletedCount: result.deletedCount,
        clearedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error("Error clearing bag:", error);
    res.status(500).json({
      success: false,
      message: "Failed to clear bag",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ FIXED: Get bag summary/totals with corrected queries
router.get("/:userid/summary", async (req, res) => {
  try {
    const { userid } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(userid)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }

    const [itemCount, bagItems] = await Promise.all([
      Bag.countDocuments({ userId: userid, savedForLater: false }),
      Bag.find({ userId: userid, savedForLater: false })
        .populate({
          path: 'productId',
          select: 'price',
          match: { _id: { $exists: true } }
        })
        .lean()
    ]);
    
    // Filter valid items and calculate total
    const validBagItems = bagItems.filter(item => item.productId);
    const bagTotal = validBagItems.reduce((sum, item) => sum + (item.quantity * item.productId.price), 0);
    
    const savedCount = await Bag.countDocuments({ userId: userid, savedForLater: true });

    // ✅ FIXED: Apply coupon discount with proper query syntax
    const bagWithCoupon = await Bag.findOne({ 
      userId: userid, 
      appliedCoupon: { $exists: true, $ne: null } 
    }).populate('appliedCoupon');
    
    const couponDiscount = bagWithCoupon && bagWithCoupon.appliedCoupon ? bagWithCoupon.discountAmount : 0;
    
    let finalTotalAfterDiscount = bagTotal - couponDiscount;
    if (finalTotalAfterDiscount < 0) finalTotalAfterDiscount = 0;

    // Calculate shipping and tax
    const shipping = finalTotalAfterDiscount > 499 ? 0 : 99;
    const tax = Math.round(finalTotalAfterDiscount * 0.05);
    const finalTotal = finalTotalAfterDiscount + shipping + tax;

    res.status(200).json({
      success: true,
      data: {
        itemCount,
        savedItemCount: savedCount,
        subtotal: Math.round(bagTotal),
        couponDiscount: Math.round(couponDiscount),
        shipping,
        tax,
        total: Math.round(finalTotal),
        freeShippingEligible: finalTotalAfterDiscount > 499,
        freeShippingRemaining: Math.max(0, 499 - finalTotalAfterDiscount),
        couponApplied: !!bagWithCoupon
      }
    });

  } catch (error) {
    console.error("Error fetching bag summary:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bag summary",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ FIXED: Apply coupon to bag route with corrected queries
router.post('/apply-coupon', async (req, res) => {
  try {
    const { userId, couponCode } = req.body;
    
    if (!userId || !couponCode) {
      return res.status(400).json({ success: false, message: 'User ID and coupon code are required.' });
    }
    
    // Find all non-saved bag items for the user
    const bagItems = await Bag.find({ userId: userId, savedForLater: false }).populate({
      path: 'productId',
      select: 'price category',
      populate: {
        path: 'category',
        select: '_id'
      }
    });
    
    if (bagItems.length === 0) {
      return res.status(404).json({ success: false, message: 'Your bag is empty.' });
    }

    const bagTotal = bagItems.reduce((sum, item) => sum + (item.quantity * item.productId.price), 0);

    // Find and validate the coupon using the static method from CouponRoutes
    const Coupon = require('../models/Coupon');
    const { valid, errors, coupon } = await Coupon.findValidCoupon(couponCode, userId, bagItems, bagTotal);

    if (!valid) {
      return res.status(400).json({ success: false, message: errors[0], errors: errors });
    }

    // Calculate the discount
    const discountAmount = coupon.calculateDiscount(bagTotal, bagItems);

    // Apply coupon to all non-saved bag items
    await Bag.updateMany(
      { userId: userId, savedForLater: false },
      { $set: { appliedCoupon: coupon._id, discountAmount: discountAmount } }
    );

    res.status(200).json({
      success: true,
      message: 'Coupon applied successfully!',
      couponCode: coupon.code,
      discountAmount: discountAmount,
      cartTotal: bagTotal,
      newTotal: bagTotal - discountAmount,
      couponId: coupon._id
    });

  } catch (error) {
    console.error("Error applying coupon:", error);
    res.status(500).json({ success: false, message: 'Server error occurred.' });
  }
});

// ✅ FIXED: Remove coupon from bag route  
router.post('/remove-coupon', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required.' });
    }
    
    // Remove coupon from all non-saved bag items
    await Bag.updateMany(
      { userId: userId, savedForLater: false },
      { $unset: { appliedCoupon: "", discountAmount: "" } }
    );

    res.status(200).json({
      success: true,
      message: 'Coupon removed successfully!',
    });

  } catch (error) {
    console.error("Error removing coupon:", error);
    res.status(500).json({ success: false, message: 'Server error occurred.' });
  }
});

module.exports = router;
