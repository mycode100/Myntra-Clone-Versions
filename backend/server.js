require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// ============================================================================
// FIXED ROUTE IMPORTS - Consistent naming and proper paths
// ============================================================================
const userrouter = require('./routes/Userroutes');
const categoryrouter = require('./routes/Categoryroutes');
const productrouter = require('./routes/Productroutes');
const Bagroutes = require('./routes/Bagroutes');
const Wishlistroutes = require('./routes/Wishlistroutes');
const OrderRoutes = require('./routes/OrderRoutes');
const CouponRoutes = require('./routes/Couponroutes');

// ✅ NEW: Import Address Routes
const AddressRoutes = require('./routes/AddressRoutes');

// ✅ NEW: Import Recommendation and Browsing History Routes
const recommendationRoutes = require('./routes/RecommendationRoutes');
const browsingHistoryRoutes = require('./routes/BrowsingHistoryRoutes');

// ✅ NEW: Import Coupon Rule Engine
const CouponRuleEngine = require('./couponRules');

// ✅ FIXED: Import seed function with proper path
const { seed } = require('./seed');

const app = express();

// ============================================================================
// ENHANCED MIDDLEWARE CONFIGURATION
// ============================================================================

// ✅ Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ✅ ENHANCED CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Allow all origins in development
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // Add your production domains here
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:8081', // Expo development
      'exp://localhost:8081',  // Expo development
      // Add your production URLs here
    ];
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all for now, restrict in production
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

// ✅ Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ============================================================================
// COUPON SYSTEM INITIALIZATION
// ============================================================================

// ✅ NEW: Initialize and validate coupon system
function initializeCouponSystem() {
  try {
    // ✅ UPDATED: Check if coupons.json exists in backend directory
    const couponsPath = path.join(__dirname, 'coupons.json');
    if (!fs.existsSync(couponsPath)) {
      console.warn('⚠️ coupons.json not found, creating empty coupons file');
      fs.writeFileSync(couponsPath, JSON.stringify({ coupons: [] }, null, 2));
    }

    // Test coupon rule engine
    const coupons = CouponRuleEngine.getAllCoupons();
    console.log(`🎟️ Coupon system initialized: ${coupons.length} coupons loaded`);
    
    const activeCoupons = CouponRuleEngine.getActiveCoupons();
    console.log(`✅ Active coupons: ${activeCoupons.length}`);

    return true;
  } catch (error) {
    console.error('❌ Coupon system initialization failed:', error.message);
    return false;
  }
}

// ============================================================================
// ROUTES CONFIGURATION
// ============================================================================

// ✅ Health check route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "✅ Myntra backend is working perfectly!",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: "1.0.0",
    features: {
      database: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
      coupons: "Enhanced system with threshold messaging",
      recommendations: "AI-powered product recommendations",
      browsingHistory: "User behavior tracking",
      addresses: "Multi-address management system",
      api: "Full e-commerce API"
    }
  });
});

// ✅ API status route
app.get("/api/status", (req, res) => {
  const couponStats = {
    total: 0,
    active: 0,
    expired: 0
  };

  try {
    const allCoupons = CouponRuleEngine.getAllCoupons();
    const activeCoupons = CouponRuleEngine.getActiveCoupons();
    const expiredCoupons = CouponRuleEngine.getExpiredCoupons();
    
    couponStats.total = allCoupons.length;
    couponStats.active = activeCoupons.length;
    couponStats.expired = expiredCoupons.length;
  } catch (error) {
    console.error('Error getting coupon stats:', error);
  }

  res.status(200).json({
    success: true,
    message: "API is running",
    database: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
    uptime: `${Math.floor(process.uptime())} seconds`,
    system: {
      memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
      cpu: process.cpuUsage(),
      platform: process.platform,
      nodeVersion: process.version
    },
    coupons: couponStats
  });
});

// ✅ NEW: Coupon system status route
app.get("/api/coupons/system-status", (req, res) => {
  try {
    const allCoupons = CouponRuleEngine.getAllCoupons();
    const activeCoupons = CouponRuleEngine.getActiveCoupons();
    const expiredCoupons = CouponRuleEngine.getExpiredCoupons();

    // Get coupon types breakdown
    const typeBreakdown = {};
    allCoupons.forEach(coupon => {
      const type = coupon.discountType || 'unknown';
      typeBreakdown[type] = (typeBreakdown[type] || 0) + 1;
    });

    res.status(200).json({
      success: true,
      message: "Coupon system status",
      statistics: {
        total: allCoupons.length,
        active: activeCoupons.length,
        expired: expiredCoupons.length,
        typeBreakdown,
        systemHealth: "Operational"
      },
      features: {
        thresholdMessaging: true,
        ruleEngine: true,
        dynamicValidation: true,
        usageTracking: true,
        multipleDiscountTypes: true
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Coupon system error",
      error: error.message
    });
  }
});

// ✅ Attach API routers with consistent paths
app.use("/api/user", userrouter);
app.use("/api/category", categoryrouter);
app.use("/api/product", productrouter);
app.use("/api/bag", Bagroutes);
app.use("/api/wishlist", Wishlistroutes);
app.use("/api/order", OrderRoutes);
app.use("/api/coupons", CouponRoutes);

// ✅ NEW: Add address routes
app.use("/api/address", AddressRoutes);

// ✅ NEW: Add recommendation and browsing history routes
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/browsing-history', browsingHistoryRoutes);

// ✅ Legacy routes (without /api prefix) for backward compatibility
app.use("/user", userrouter);
app.use("/category", categoryrouter);
app.use("/product", productrouter);
app.use("/bag", Bagroutes);
app.use("/wishlist", Wishlistroutes);
app.use("/order", OrderRoutes);
app.use("/coupons", CouponRoutes);

// ============================================================================
// ERROR HANDLING MIDDLEWARE
// ============================================================================

// ✅ Enhanced 404 Handler with updated routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    error: "Not Found",
    availableRoutes: {
      main: [
        "GET /",
        "GET /api/status"
      ],
      auth: [
        "POST /api/user/signup",
        "POST /api/user/login",
        "GET /api/user/profile/:id"
      ],
      products: [
        "GET /api/product",
        "GET /api/product/:id",
        "GET /api/category",
        "GET /api/category/:id"
      ],
      shopping: [
        "GET /api/bag/:userid",
        "POST /api/bag/add",
        "DELETE /api/bag/remove",
        "GET /api/wishlist/:userid",
        "POST /api/wishlist/add",
        "DELETE /api/wishlist/remove"
      ],
      orders: [
        "GET /api/order/user/:userid",
        "POST /api/order/create",
        "GET /api/order/:id"
      ],
      addresses: [
        "GET /api/address/user/:userId",
        "POST /api/address",
        "PUT /api/address/:addressId",
        "DELETE /api/address/:addressId",
        "PATCH /api/address/:addressId/default"
      ],
      coupons: [
        "GET /api/coupons/system-status",
        "GET /api/coupons/available/:userId",
        "POST /api/coupons/apply",
        "POST /api/coupons/remove",
        "POST /api/coupons/threshold-check",
        "POST /api/coupons/validate-applied"
      ],
      recommendations: [
        "GET /api/recommendations/product/:productId",
        "POST /api/recommendations/track-view",
        "GET /api/recommendations/user-history",
        "DELETE /api/recommendations/clear-cache/:productId"
      ],
      browsingHistory: [
        "POST /api/browsing-history/track",
        "GET /api/browsing-history/user/:userId",
        "GET /api/browsing-history/session/:sessionId",
        "GET /api/browsing-history/product/:productId/analytics",
        "DELETE /api/browsing-history/user/:userId/clear",
        "GET /api/browsing-history/popular-products"
      ]
    },
    documentation: "Contact your API administrator for detailed documentation"
  });
});

// ✅ Enhanced Global Error Handler with coupon-specific errors
app.use((error, req, res, next) => {
  console.error("❌ Global Error Handler:", error);
  
  // Coupon-specific errors
  if (error.message && error.message.includes('coupon')) {
    return res.status(400).json({
      success: false,
      message: "Coupon system error",
      error: error.message,
      type: "coupon_error"
    });
  }
  
  // Recommendation-specific errors
  if (error.message && error.message.includes('recommendation')) {
    return res.status(400).json({
      success: false,
      message: "Recommendation system error",
      error: error.message,
      type: "recommendation_error"
    });
  }
  
  // Mongoose validation error
  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map(err => err.message);
    return res.status(400).json({
      success: false,
      message: "Validation Error",
      errors,
      type: "validation_error"
    });
  }
  
  // Mongoose duplicate key error
  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "Duplicate entry error",
      error: "Resource already exists",
      type: "duplicate_error"
    });
  }
  
  // MongoDB connection error
  if (error.name === 'MongoError' || error.name === 'MongoServerError') {
    return res.status(500).json({
      success: false,
      message: "Database error",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      type: "database_error"
    });
  }

  // JSON parsing error
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON format",
      error: "Request body contains invalid JSON",
      type: "json_error"
    });
  }
  
  // Default error response
  res.status(error.status || 500).json({
    success: false,
    message: error.message || "Internal server error",
    error: process.env.NODE_ENV === 'development' ? error.stack : 'Internal server error',
    type: "server_error"
  });
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

const PORT = process.env.PORT || 5000;

// ✅ Enhanced MongoDB connection with better error handling
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(async () => {
  console.log("🎯 MongoDB connected successfully ✅");
  console.log(`📍 Database: ${mongoose.connection.name}`);
  
  // ✅ NEW: Initialize coupon system
  console.log("🎟️ Initializing coupon system...");
  const couponSystemReady = initializeCouponSystem();
  if (couponSystemReady) {
    console.log("🎟️ Coupon system initialized successfully ✅");
  } else {
    console.warn("⚠️ Coupon system initialization failed, but server will continue");
  }
  
  // ✅ FIXED: Safe seed execution with error handling
  try {
    if (typeof seed === 'function') {
      console.log("🌱 Starting database seeding...");
      await seed();
      console.log("🌱 Database seeding completed successfully ✅");
    } else {
      console.log("⚠️ Seed function not available, skipping seeding");
    }
  } catch (seedError) {
    console.error("❌ Database seeding failed:", seedError.message);
    // Don't exit process, continue without seeding
  }
  
  // Start the server
  app.listen(PORT, () => {
    console.log("\n" + "=".repeat(60));
    console.log(`🚀 Myntra E-commerce Backend Server`);
    console.log("=".repeat(60));
    console.log(`🌐 Local: http://localhost:${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 API Base: http://localhost:${PORT}/api`);
    console.log(`🎟️ Coupon System: ${couponSystemReady ? 'Active' : 'Limited'}`);
    console.log(`🤖 Recommendations: AI-Powered Product Suggestions`);
    console.log(`📈 Analytics: User Behavior Tracking`);
    console.log(`📍 Address Management: Multi-address CRUD System`);
    console.log(`💾 Database: ${mongoose.connection.name}`);
    console.log("=".repeat(60));
    console.log("📋 Available Endpoints:");
    console.log("   • Health Check: GET /");
    console.log("   • API Status: GET /api/status");
    console.log("   • Coupon Status: GET /api/coupons/system-status");
    console.log("   • Products: GET /api/product");
    console.log("   • Categories: GET /api/category");
    console.log("   • User Auth: POST /api/user/login");
    console.log("   • Shopping Bag: GET /api/bag/:userId");
    console.log("   • Wishlist: GET /api/wishlist/:userId");
    console.log("   • Apply Coupon: POST /api/coupons/apply");
    console.log("   • Available Coupons: GET /api/coupons/available/:userId");
    console.log("   • Product Recommendations: GET /api/recommendations/product/:productId");
    console.log("   • Track Browsing: POST /api/browsing-history/track");
    console.log("   • Popular Products: GET /api/browsing-history/popular-products");
    console.log("   • Address Management: GET /api/address/user/:userId");
    console.log("   • Create Address: POST /api/address");
    console.log("   • Set Default Address: PATCH /api/address/:addressId/default");
    console.log("=".repeat(60));
    console.log("✅ Server startup completed successfully!");
    console.log("=".repeat(60) + "\n");
  });
})
.catch((err) => {
  console.error('❌ MongoDB connection failed:', err.message);
  console.error('💡 Please check your MONGO_URI in .env file');
  process.exit(1);
});

// ============================================================================
// GRACEFUL SHUTDOWN HANDLERS
// ============================================================================

// ✅ Handle process termination gracefully
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT. Shutting down gracefully...');
  
  try {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('📴 MongoDB connection closed');
    
    console.log('✅ Graceful shutdown completed');
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
  }
  
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM. Shutting down gracefully...');
  
  try {
    await mongoose.connection.close();
    console.log('📴 MongoDB connection closed');
  } catch (error) {
    console.error('❌ Error closing MongoDB:', error);
  }
  
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit process in production, just log the error
  if (process.env.NODE_ENV === 'production') {
    console.error('🔧 Application will continue running');
  }
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  
  // Graceful shutdown on uncaught exception
  mongoose.connection.close(() => {
    console.log('📴 MongoDB connection closed due to uncaught exception');
    process.exit(1);
  });
});

// ✅ NEW: Log memory usage periodically in development
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const memUsageMB = {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024)
    };
    console.log(`📊 Memory Usage: ${memUsageMB.heapUsed}MB / ${memUsageMB.heapTotal}MB (RSS: ${memUsageMB.rss}MB)`);
  }, 300000); // Every 5 minutes
}

module.exports = app;
