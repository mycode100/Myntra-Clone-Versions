const express = require("express");
const Category = require("../models/Category");
const Product = require("../models/Product");
const router = express.Router();
const mongoose = require("mongoose");

// ============================================================================
// FIXED VERSION - CATEGORY ROUTES WITH PROPER ObjectId USAGE
// ============================================================================

// ✅ FIXED: Get all categories with enhanced aggregation and proper error handling
router.get("/", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = 'name',
      sortOrder = 'asc',
      search,
      includeStats = 'false',
      minProducts = 0
    } = req.query;

    // Build base query
    let matchQuery = {};
    if (search && search.trim()) {
      matchQuery.name = { $regex: search.trim(), $options: 'i' };
    }

    // ✅ FIXED: Enhanced aggregation with proper error handling
    const pipeline = [
      { $match: matchQuery },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: 'category', // ✅ Changed from 'categoryId' to 'category'
          as: 'products'
        }
      },
      {
        $addFields: {
          productCount: { $size: '$products' },
          // ✅ FIXED: Safe conversion with error handling
          averagePrice: {
            $cond: {
              if: { $gt: [{ $size: '$products' }, 0] },
              then: {
                $divide: [
                  {
                    $sum: {
                      $map: {
                        input: '$products',
                        as: 'product',
                        in: {
                          $convert: {
                            input: '$$product.price',
                            to: 'double',
                            onError: 0,  // ✅ Added error handling
                            onNull: 0    // ✅ Added null handling
                          }
                        }
                      }
                    }
                  },
                  { $size: '$products' }
                ]
              },
              else: 0
            }
          },
          // ✅ FIXED: Safe rating calculation
          averageRating: {
            $cond: {
              if: { $gt: [{ $size: '$products' }, 0] },
              then: {
                $divide: [
                  {
                    $sum: {
                      $map: {
                        input: '$products',
                        as: 'product',
                        in: {
                          $convert: {
                            input: '$$product.rating',
                            to: 'double',
                            onError: 0,  // ✅ Added error handling
                            onNull: 0    // ✅ Added null handling
                          }
                        }
                      }
                    }
                  },
                  { $size: '$products' }
                ]
              },
              else: 0
            }
          },
          // ✅ FIXED: Safe min/max price calculation
          minPrice: {
            $cond: {
              if: { $gt: [{ $size: '$products' }, 0] },
              then: {
                $min: {
                  $map: {
                    input: '$products',
                    as: 'product',
                    in: {
                      $convert: {
                        input: '$$product.price',
                        to: 'double',
                        onError: 999999,  // ✅ High value for min calculation
                        onNull: 999999
                      }
                    }
                  }
                }
              },
              else: 0
            }
          },
          maxPrice: {
            $cond: {
              if: { $gt: [{ $size: '$products' }, 0] },
              then: {
                $max: {
                  $map: {
                    input: '$products',
                    as: 'product',
                    in: {
                      $convert: {
                        input: '$$product.price',
                        to: 'double',
                        onError: 0,  // ✅ Low value for max calculation
                        onNull: 0
                      }
                    }
                  }
                }
              },
              else: 0
            }
          },
          // ✅ FIXED: Safe brand extraction
          topBrands: {
            $slice: [
              {
                $reduce: {
                  input: '$products',
                  initialValue: [],
                  in: {
                    $setUnion: [
                      '$$value',
                      [{
                        $cond: {
                          if: { $ne: ['$$this.brand', null] },
                          then: '$$this.brand',
                          else: '$$REMOVE'
                        }
                      }]
                    ]
                  }
                }
              },
              5
            ]
          },
          hasDiscount: {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: '$products',
                    cond: { 
                      $and: [
                        { $ne: ['$$this.discount', null] },
                        { $ne: ['$$this.discount', ''] }
                      ]
                    }
                  }
                }
              },
              0
            ]
          }
        }
      },
      // Filter by minimum products if specified
      ...(minProducts > 0 ? [{ $match: { productCount: { $gte: parseInt(minProducts) } } }] : []),
      // Remove products array from final output for performance
      {
        $project: {
          products: 0
        }
      },
      // Sort
      { $sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 } },
      // Pagination
      { $skip: (parseInt(page) - 1) * parseInt(limit) },
      { $limit: parseInt(limit) }
    ];

    const categories = await Category.aggregate(pipeline);

    // Get total count for pagination
    const totalCount = await Category.countDocuments(matchQuery);

    // Prepare response
    const response = {
      success: true,
      data: categories,
      meta: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        hasNextPage: parseInt(page) * parseInt(limit) < totalCount,
        hasPrevPage: parseInt(page) > 1
      }
    };

    // Add statistics if requested
    if (includeStats === 'true') {
      const statsResult = await Category.aggregate([
        { $match: matchQuery },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: 'category', // ✅ Fixed field name
            as: 'products'
          }
        },
        {
          $group: {
            _id: null,
            totalCategories: { $sum: 1 },
            totalProducts: { $sum: { $size: '$products' } },
            avgProductsPerCategory: { $avg: { $size: '$products' } },
            categoriesWithProducts: {
              $sum: {
                $cond: [{ $gt: [{ $size: '$products' }, 0] }, 1, 0]
              }
            }
          }
        }
      ]);

      if (statsResult.length > 0) {
        response.statistics = {
          totalCategories: statsResult[0].totalCategories,
          totalProducts: statsResult[0].totalProducts,
          avgProductsPerCategory: Math.round(statsResult[0].avgProductsPerCategory),
          categoriesWithProducts: statsResult[0].categoriesWithProducts,
          emptyCategories: statsResult[0].totalCategories - statsResult[0].categoriesWithProducts
        };
      }
    }

    res.status(200).json(response);

  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ FIXED: Get single category with safe aggregation and proper ObjectId
router.get("/:categoryId", async (req, res) => {
  try {
    const { categoryId } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID format"
      });
    }

    // ✅ FIXED: Safe aggregation for single category with proper ObjectId
    const pipeline = [
      { 
        $match: { 
          _id: new mongoose.Types.ObjectId(categoryId) // ✅ FIXED: Added 'new'
        } 
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: 'category', // ✅ Fixed field name
          as: 'products'
        }
      },
      {
        $addFields: {
          productCount: { $size: '$products' },
          // ✅ FIXED: All calculations with proper error handling
          averagePrice: {
            $cond: {
              if: { $gt: [{ $size: '$products' }, 0] },
              then: {
                $divide: [
                  {
                    $sum: {
                      $map: {
                        input: '$products',
                        as: 'product',
                        in: {
                          $convert: {
                            input: '$$product.price',
                            to: 'double',
                            onError: 0,
                            onNull: 0
                          }
                        }
                      }
                    }
                  },
                  { $size: '$products' }
                ]
              },
              else: 0
            }
          },
          minPrice: {
            $cond: {
              if: { $gt: [{ $size: '$products' }, 0] },
              then: {
                $min: {
                  $map: {
                    input: '$products',
                    as: 'product',
                    in: {
                      $convert: {
                        input: '$$product.price',
                        to: 'double',
                        onError: 999999,
                        onNull: 999999
                      }
                    }
                  }
                }
              },
              else: 0
            }
          },
          maxPrice: {
            $cond: {
              if: { $gt: [{ $size: '$products' }, 0] },
              then: {
                $max: {
                  $map: {
                    input: '$products',
                    as: 'product',
                    in: {
                      $convert: {
                        input: '$$product.price',
                        to: 'double',
                        onError: 0,
                        onNull: 0
                      }
                    }
                  }
                }
              },
              else: 0
            }
          }
        }
      },
      {
        $project: {
          products: 0  // Remove products array for performance
        }
      }
    ];

    const result = await Category.aggregate(pipeline);

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    res.status(200).json({
      success: true,
      data: result[0]
    });

  } catch (error) {
    console.error("Error fetching category:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch category",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ FIXED: Get products by category with proper ObjectId
router.get("/:categoryId/products", async (req, res) => {
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
      category: new mongoose.Types.ObjectId(categoryId) // ✅ FIXED: Added 'new'
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

    if (inStock === 'true') {
      matchQuery.stock = { $gt: 0 };
    } else if (inStock === 'false') {
      matchQuery.stock = { $lte: 0 };
    }

    // ✅ FIXED: Aggregation pipeline with proper ObjectId usage
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
          }
        }
      },
      {
        $project: {
          categoryInfo: 0
        }
      },
      { $sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 } },
      { $skip: (parseInt(page) - 1) * parseInt(limit) },
      { $limit: parseInt(limit) }
    ];

    const products = await Product.aggregate(pipeline);

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

// ✅ ENHANCED: Create new category
router.post("/", async (req, res) => {
  try {
    const { name, description, image, isActive = true } = req.body;

    // Validate required fields
    if (!name || !description) {
      return res.status(400).json({
        success: false,
        message: "Name and description are required"
      });
    }

    // Check if category already exists
    const existingCategory = await Category.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') } 
    });

    if (existingCategory) {
      return res.status(409).json({
        success: false,
        message: "Category with this name already exists"
      });
    }

    const newCategory = new Category({
      name: name.trim(),
      description: description.trim(),
      image: image?.trim() || '',
      isActive
    });

    const savedCategory = await newCategory.save();

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: savedCategory
    });

  } catch (error) {
    console.error("Error creating category:", error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: "Invalid category data",
        details: Object.values(error.errors).map(err => err.message)
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to create category",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ FIXED: Update category with proper ObjectId validation
router.put("/:categoryId", async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { name, description, image, isActive } = req.body;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID format"
      });
    }

    // Build update object
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (image !== undefined) updateData.image = image.trim();
    if (isActive !== undefined) updateData.isActive = isActive;

    // Check if name already exists (if name is being updated)
    if (name) {
      const existingCategory = await Category.findOne({ 
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        _id: { $ne: categoryId }
      });

      if (existingCategory) {
        return res.status(409).json({
          success: false,
          message: "Category with this name already exists"
        });
      }
    }

    const updatedCategory = await Category.findByIdAndUpdate(
      categoryId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedCategory) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: updatedCategory
    });

  } catch (error) {
    console.error("Error updating category:", error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: "Invalid category data",
        details: Object.values(error.errors).map(err => err.message)
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update category",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ FIXED: Delete category with proper ObjectId validation
router.delete("/:categoryId", async (req, res) => {
  try {
    const { categoryId } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID format"
      });
    }

    // Check if category has products
    const productCount = await Product.countDocuments({ category: categoryId });
    
    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category. It has ${productCount} products. Please move or delete products first.`,
        productCount
      });
    }

    const deletedCategory = await Category.findByIdAndDelete(categoryId);

    if (!deletedCategory) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Category deleted successfully",
      data: {
        deletedCategory: {
          _id: deletedCategory._id,
          name: deletedCategory.name,
          deletedAt: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete category",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
