const express = require('express');
const router = express.Router();
const recommendationController = require('../controllers/recommendationController');

// ✅ BULLETPROOF middleware that never fails
const extractUserInfo = (req, res, next) => {
  try {
    // Extract user ID from multiple sources
    const userId = req.body?.userId || 
                   req.params?.userId || 
                   req.query?.userId || 
                   req.headers['x-user-id'] || 
                   null;
    
    // ALWAYS set req.user (never leave it undefined)
    req.user = userId ? { id: userId } : null;
    
    console.log('✅ Auth Middleware - userId:', userId, 'req.user:', req.user);
    
    next();
  } catch (error) {
    console.error('❌ Middleware error:', error);
    req.user = null; // Safe fallback
    next();
  }
};

// Apply middleware to ALL routes
router.use(extractUserInfo);

// Routes
router.get('/product/:productId', recommendationController.getProductRecommendations);
router.post('/track-view', recommendationController.trackProductView);
router.get('/user-history', recommendationController.getUserBrowsingHistory);
router.delete('/clear-cache/:productId', recommendationController.clearRecommendationCache);

module.exports = router;
