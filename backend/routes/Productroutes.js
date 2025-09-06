const express = require("express");
const Product = require("../models/Product");
const Category = require("../models/Category");
const router = express.Router();
const mongoose = require("mongoose");

// ============================================================================
// FIXED VERSION - PRODUCT ROUTES WITH SAFE DISCOUNT HANDLING
// ============================================================================

// ✅ FIXED: ADDED MISSING GET ALL PRODUCTS ROUTE WITH SAFE DISCOUNT CONVERSION
router.get("/", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search,
      categoryId,
      minPrice,
      maxPrice,
      brand,
      sizes,
      colors,
      rating,
      inStock = 'all',
      isNew,
      isFeatured
    } = req.query;

    // Build match query
    let matchQuery = {};

    // Search functionality
    if (search && search.trim()) {
      matchQuery.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { brand: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    // Category filter
    if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
      matchQuery.category = new mongoose.Types.ObjectId(categoryId);
    }

    // Price range filter
    if (minPrice || maxPrice) {
      matchQuery.price = {};
      if (minPrice) matchQuery.price.$gte = parseFloat(minPrice);
      if (maxPrice) matchQuery.price.$lte = parseFloat(maxPrice);
    }

    // Brand filter
    if (brand) {
      const brandArray = Array.isArray(brand) ? brand : brand.split(',');
      matchQuery.brand = { $in: brandArray };
    }

    // Sizes filter
    if (sizes) {
      const sizeArray = Array.isArray(sizes) ? sizes : sizes.split(',');
      matchQuery.sizes = { $in: sizeArray };
    }

    // Colors filter
    if (colors) {
      const colorArray = Array.isArray(colors) ? colors : colors.split(',');
      matchQuery.colors = { $in: colorArray };
    }

    // Rating filter
    if (rating) {
      matchQuery.rating = { $gte: parseFloat(rating) };
    }

    // Stock filter
    if (inStock === 'true') {
      matchQuery.stock = { $gt: 0 };
    } else if (inStock === 'false') {
      matchQuery.stock = { $lte: 0 };
    }

    // New products filter
    if (isNew === 'true') {
      matchQuery.isNew = true;
    }

    // Featured products filter
    if (isFeatured === 'true') {
      matchQuery.isFeatured = true;
    }

    // ✅ FIXED: Aggregation pipeline with SAFE discount handling
    const pipeline = [
      { $match: matchQuery },
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'categoryInfo'
        }
      },
      {
        $addFields: {
          categoryName: {
            $cond: {
              if: { $gt: [{ $size: '$categoryInfo' }, 0] },
              then: { $arrayElemAt: ['$categoryInfo.name', 0] },
              else: 'Unknown'
            }
          },
          isInStock: { $gt: ['$stock', 0] },
          hasDiscount: { 
            $and: [
              { $ne: ['$discount', null] },
              { $ne: ['$discount', ''] }
            ]
          },
          // ✅ FIXED: Safe discount number extraction
          discountPercentage: {
            $cond: {
              if: { 
                $and: [
                  { $ne: ['$discount', null] },
                  { $ne: ['$discount', ''] }
                ]
              },
              then: {
                $convert: {
                  input: {
                    $regexFind: {
                      input: { $toString: '$discount' },
                      regex: /\d+/  // Extract first number from discount string
                    }
                  },
                  to: 'double',
                  onError: 0,  // ✅ FIXED: Added onError handling
                  onNull: 0
                }
              },
              else: 0
            }
          }
        }
      },
      {
        $addFields: {
          // ✅ FIXED: Safe final price calculation
          finalPrice: {
            $cond: {
              if: { $gt: ['$discountPercentage', 0] },
              then: {
                $subtract: [
                  '$price',
                  { $multiply: ['$price', { $divide: ['$discountPercentage', 100] }] }
                ]
              },
              else: '$price'
            }
          }
        }
      },
      {
        $project: {
          categoryInfo: 0,
          discountPercentage: 0  // Remove helper field from output
        }
      },
      { $sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 } },
      { $skip: (parseInt(page) - 1) * parseInt(limit) },
      { $limit: parseInt(limit) }
    ];

    const products = await Product.aggregate(pipeline);

    // Get total count for pagination
    const totalCount = await Product.countDocuments(matchQuery);

    // Get filter statistics
    const stats = await Product.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          avgPrice: { $avg: '$price' },
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' },
          brands: { $addToSet: '$brand' },
          inStockCount: {
            $sum: { $cond: [{ $gt: ['$stock', 0] }, 1, 0] }
          },
          discountedCount: {
            $sum: { 
              $cond: [
                { 
                  $and: [
                    { $ne: ['$discount', null] },
                    { $ne: ['$discount', ''] }
                  ]
                }, 
                1, 
                0
              ]
            }
          }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: products,
      meta: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        hasNextPage: parseInt(page) * parseInt(limit) < totalCount,
        hasPrevPage: parseInt(page) > 1
      },
      filters: {
        applied: { search, categoryId, minPrice, maxPrice, brand, sizes, colors, rating, inStock, isNew, isFeatured },
        statistics: stats[0] || {}
      }
    });

  } catch (error) {
    console.error("Error fetching all products:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch products",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ FIXED: Get single product by ID with safe discount handling
router.get("/:productId", async (req, res) => {
  try {
    const { productId } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format"
      });
    }

    const product = await Product.findById(productId)
      .populate({
        path: 'category',
        select: 'name subcategory'
      });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    // ✅ FIXED: Safe discount percentage extraction
    let discountPercentage = 0;
    if (product.discount) {
      const match = product.discount.toString().match(/\d+/);
      discountPercentage = match ? parseInt(match[0]) : 0;
    }

    // Get related products
    const relatedProducts = await Product.find({
      category: product.category,
      _id: { $ne: product._id }
    })
    .select('name brand price images rating discount')
    .limit(4);

    // Add computed fields
    const enhancedProduct = {
      ...product.toObject(),
      isInStock: product.stock > 0,
      stockStatus: product.stock > 10 ? 'In Stock' : 
                   product.stock > 0 ? 'Low Stock' : 'Out of Stock',
      hasDiscount: Boolean(product.discount && discountPercentage > 0),
      discountPercentage,
      averageRating: product.rating || 0,
      totalReviews: product.ratingCount || 0,
      finalPrice: discountPercentage > 0 ? 
        Math.round(product.price - (product.price * (discountPercentage / 100))) : 
        product.price,
      savings: discountPercentage > 0 ? 
        Math.round(product.price * (discountPercentage / 100)) : 0,
      relatedProducts
    };

    res.status(200).json({
      success: true,
      data: enhancedProduct
    });

  } catch (error) {
    console.error("Error fetching product by ID:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch product",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ Keep all other routes as they were (category products, search, etc.)
// Just removing the problematic aggregation parts

// Get products by category
router.get("/category/:categoryId", async (req, res) => {
  try {
    const { categoryId } = req.params;
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      minPrice,
      maxPrice,
      brand,
      sizes,
      colors,
      rating,
      inStock = 'all'
    } = req.query;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID format"
      });
    }

    // Build match query
    let matchQuery = { 
      category: new mongoose.Types.ObjectId(categoryId)
    };

    // Add filters
    if (minPrice || maxPrice) {
      matchQuery.price = {};
      if (minPrice) matchQuery.price.$gte = parseFloat(minPrice);
      if (maxPrice) matchQuery.price.$lte = parseFloat(maxPrice);
    }

    if (brand) {
      const brandArray = Array.isArray(brand) ? brand : brand.split(',');
      matchQuery.brand = { $in: brandArray };
    }

    if (sizes) {
      const sizeArray = Array.isArray(sizes) ? sizes : sizes.split(',');
      matchQuery.sizes = { $in: sizeArray };
    }

    if (colors) {
      const colorArray = Array.isArray(colors) ? colors : colors.split(',');
      matchQuery.colors = { $in: colorArray };
    }

    if (rating) {
      matchQuery.rating = { $gte: parseFloat(rating) };
    }

    if (inStock === 'true') {
      matchQuery.stock = { $gt: 0 };
    } else if (inStock === 'false') {
      matchQuery.stock = { $lte: 0 };
    }

    // Simple find query instead of complex aggregation
    const products = await Product.find(matchQuery)
      .populate({
        path: 'category',
        select: 'name'
      })
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    // Get total count
    const totalCount = await Product.countDocuments(matchQuery);

    // Get category info
    const category = await Category.findById(categoryId);

    res.status(200).json({
      success: true,
      data: products,
      category: category || null,
      meta: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        hasNextPage: parseInt(page) * parseInt(limit) < totalCount,
        hasPrevPage: parseInt(page) > 1
      }
    });

  } catch (error) {
    console.error("Error fetching products by category:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch products",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Search products
router.get("/search/:query", async (req, res) => {
  try {
    const { query } = req.params;
    const {
      page = 1,
      limit = 20,
      sortBy = 'relevance',
      categoryId,
      minPrice,
      maxPrice,
      brand
    } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Search query must be at least 2 characters long"
      });
    }

    // Build match query
    let matchQuery = {
      $or: [
        { name: { $regex: query.trim(), $options: 'i' } },
        { brand: { $regex: query.trim(), $options: 'i' } },
        { description: { $regex: query.trim(), $options: 'i' } }
      ]
    };

    // Add filters
    if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
      matchQuery.category = new mongoose.Types.ObjectId(categoryId);
    }

    if (minPrice || maxPrice) {
      matchQuery.price = {};
      if (minPrice) matchQuery.price.$gte = parseFloat(minPrice);
      if (maxPrice) matchQuery.price.$lte = parseFloat(maxPrice);
    }

    if (brand) {
      matchQuery.brand = { $regex: brand, $options: 'i' };
    }

    // Simple find query for search
    const products = await Product.find(matchQuery)
      .populate({
        path: 'category',
        select: 'name'
      })
      .sort(sortBy === 'relevance' ? { rating: -1 } : { [sortBy]: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    // Get total count
    const totalCount = await Product.countDocuments(matchQuery);

    res.status(200).json({
      success: true,
      data: products,
      query: query.trim(),
      meta: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        hasNextPage: parseInt(page) * parseInt(limit) < totalCount,
        hasPrevPage: parseInt(page) > 1
      }
    });

  } catch (error) {
    console.error("Error searching products:", error);
    res.status(500).json({
      success: false,
      message: "Failed to search products",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
