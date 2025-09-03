const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../models/User");
const mongoose = require("mongoose");
// const { sendPasswordResetEmail } = require("../services/emailService");

const router = express.Router();

// ============================================================================
// INPUT VALIDATION HELPERS
// ============================================================================

const validateSignupInput = (fullName, email, password) => {
  const errors = [];
  if (!fullName || fullName.trim().length < 2) {
    errors.push("Full name must be at least 2 characters");
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("Please provide a valid email address");
  }
  if (!password || password.length < 6) {
    errors.push("Password must be at least 6 characters");
  }
  return errors;
};

const validateLoginInput = (email, password) => {
  const errors = [];
  if (!email || !email.trim()) {
    errors.push("Email is required");
  }
  if (!password || !password.trim()) {
    errors.push("Password is required");
  }
  return errors;
};

// ============================================================================
// ADMIN ROUTES
// ============================================================================

// GET ALL USERS (Admin functionality)
router.get("/", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search,
      startDate,
      endDate
    } = req.query;

    // Build query
    let query = {};
    
    // Search functionality
    if (search && search.trim()) {
      query.$or = [
        { fullName: { $regex: search.trim(), $options: 'i' } },
        { email: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Execute query with pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;
    const sortOrderNum = sortOrder.toLowerCase() === 'desc' ? -1 : 1;

    const users = await User.find(query)
      .select('-password -resetPasswordToken')
      .sort({ [sortBy]: sortOrderNum })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const totalCount = await User.countDocuments(query);

    // Add computed fields
    const enhancedUsers = users.map(user => ({
      ...user,
      accountAge: Math.floor((new Date() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24)),
      isNewUser: (new Date() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24) <= 7
    }));

    res.status(200).json({
      success: true,
      data: enhancedUsers,
      meta: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum),
        hasNextPage: pageNum * limitNum < totalCount,
        hasPrevPage: pageNum > 1
      },
      filters: {
        applied: { search, startDate, endDate, sortBy, sortOrder }
      }
    });

  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET USER BY ID
router.get("/:userid", async (req, res) => {
  try {
    const { userid } = req.params;
    const { includeStats = 'false' } = req.query;

    if (!mongoose.Types.ObjectId.isValid(userid)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }

    const user = await User.findById(userid)
      .select('-password -resetPasswordToken')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Add computed fields
    const enhancedUser = {
      ...user,
      accountAge: Math.floor((new Date() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24)),
      isNewUser: (new Date() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24) <= 7,
      lastSeen: user.updatedAt
    };

    // Add user statistics if requested
    if (includeStats === 'true') {
      try {
        const Order = mongoose.models.Order;
        const Wishlist = mongoose.models.Wishlist;
        const Bag = mongoose.models.Bag;

        const stats = {};

        if (Order) {
          const orderStats = await Order.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userid) } },
            {
              $group: {
                _id: null,
                totalOrders: { $sum: 1 },
                totalSpent: { $sum: '$pricing.total' },
                avgOrderValue: { $avg: '$pricing.total' },
                lastOrderDate: { $max: '$orderDate' }
              }
            }
          ]);
          stats.orders = orderStats[0] || { totalOrders: 0, totalSpent: 0, avgOrderValue: 0 };
        }

        if (Wishlist) {
          stats.wishlistItems = await Wishlist.countDocuments({ userId: userid });
        }

        if (Bag) {
          stats.bagItems = await Bag.countDocuments({ userId: userid, savedForLater: { $ne: true } });
        }

        enhancedUser.statistics = stats;
      } catch (statsError) {
        console.warn("Error fetching user statistics:", statsError);
        enhancedUser.statistics = { error: "Statistics unavailable" };
      }
    }

    res.status(200).json({
      success: true,
      data: enhancedUser
    });

  } catch (error) {
    console.error("Error fetching user by ID:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET USER PROFILE
router.get("/profile/:userid", async (req, res) => {
  try {
    const { userid } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userid)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }

    const user = await User.findById(userid)
      .select('fullName email createdAt updatedAt')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User profile not found"
      });
    }

    res.status(200).json({
      success: true,
      data: {
        ...user,
        memberSince: user.createdAt,
        profileCompleteness: 85
      }
    });

  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user profile",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// UPDATE USER PROFILE
router.put("/:userid", async (req, res) => {
  try {
    const { userid } = req.params;
    const { fullName, email } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userid)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }

    // Validate input
    const errors = [];
    if (fullName && fullName.trim().length < 2) {
      errors.push("Full name must be at least 2 characters");
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push("Please provide a valid email address");
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors
      });
    }

    // Build update object
    const updateData = {};
    if (fullName) updateData.fullName = fullName.trim();
    if (email) updateData.email = email.toLowerCase().trim();

    // Check if email already exists
    if (email) {
      const existingUser = await User.findOne({
        email: email.toLowerCase().trim(),
        _id: { $ne: userid }
      });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: "Email already exists"
        });
      }
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      userid,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -resetPasswordToken');

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: updatedUser
    });

  } catch (error) {
    console.error("Error updating user profile:", error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: Object.values(error.errors).map(err => err.message)
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update profile",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ============================================================================
// AUTHENTICATION ROUTES (MAIN ONES FOR FRONTEND)
// ============================================================================

// ✅ FIXED SIGNUP - Now sends fullName instead of name
router.post("/signup", async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
    const validationErrors = validateSignupInput(fullName, email, password);
    
    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        success: false,
        message: "Validation failed", 
        errors: validationErrors 
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(409).json({ 
        success: false,
        message: "User already exists with this email" 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = new User({
      fullName: fullName.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
    });

    await user.save();

    // ✅ FIXED: Send fullName instead of name to match frontend expectation
    const userData = {
      _id: user._id,
      fullName: user.fullName,  // ✅ Changed from 'name' to 'fullName'
      email: user.email,
      createdAt: user.createdAt
    };

    res.status(201).json({ 
      success: true,
      message: "User created successfully", 
      data: userData 
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ 
      success: false,
      message: "Internal server error" 
    });
  }
});

// ✅ FIXED LOGIN - Now sends fullName instead of name
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const validationErrors = validateLoginInput(email, password);
    
    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        success: false,
        message: "Validation failed", 
        errors: validationErrors 
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: "Invalid email or password" 
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false,
        message: "Invalid email or password" 
      });
    }

    // ✅ FIXED: Send fullName instead of name to match frontend expectation
    const userData = {
      _id: user._id,
      fullName: user.fullName,  // ✅ Changed from 'name' to 'fullName'
      email: user.email,
      lastLogin: new Date()
    };

    res.status(200).json({ 
      success: true,
      message: "Login successful", 
      data: userData 
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ 
      success: false,
      message: "Internal server error" 
    });
  }
});

// FORGOT PASSWORD
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ 
        success: false,
        message: "Email is required" 
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(200).json({
        success: true,
        message: "If an account with that email exists, we've sent a password reset link.",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpiry;
    await user.save();

    try {
      // Email service integration (optional)
      // await sendPasswordResetEmail(email, resetToken);
      console.log(`Reset email would be sent to ${email} with token: ${resetToken}`);
    } catch (emailError) {
      console.error("Failed to send reset email:", emailError);
    }

    res.status(200).json({
      success: true,
      message: "If an account with that email exists, we've sent a password reset link.",
      ...(process.env.NODE_ENV === "development" && { resetToken }),
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ 
      success: false,
      message: "Internal server error" 
    });
  }
});

// RESET PASSWORD
router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ 
        success: false,
        message: "Token and new password are required" 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false,
        message: "Password must be at least 6 characters" 
      });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid or expired reset token" 
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    user.password = hashedPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;

    await user.save();

    res.status(200).json({ 
      success: true,
      message: "Password reset successful" 
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ 
      success: false,
      message: "Internal server error" 
    });
  }
});

module.exports = router;
