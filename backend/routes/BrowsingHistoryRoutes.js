const express = require('express');
const router = express.Router();
const browsingHistoryController = require('../controllers/browsingHistoryController');

// ✅ BULLETPROOF middleware that never fails
const extractUserInfo = (req, res, next) => {
  try {
    const userId = req.body?.userId || 
                   req.params?.userId || 
                   req.query?.userId || 
                   req.headers['x-user-id'] || 
                   null;
    
    req.user = userId ? { id: userId, role: 'user' } : null;
    
    console.log('✅ Browsing Middleware - userId:', userId, 'req.user:', req.user);
    
    next();
  } catch (error) {
    console.error('❌ Browsing middleware error:', error);
    req.user = null;
    next();
  }
};

// ✅ Apply middleware to all routes
router.use(extractUserInfo);

// Public routes (work for anonymous users too)
router.post('/track', browsingHistoryController.trackBrowsingHistory);
router.get('/session/:sessionId', browsingHistoryController.getSessionBrowsingHistory);
router.get('/popular-products', browsingHistoryController.getPopularProducts);

// User-specific routes (work with userId in params)
router.get('/user/:userId', browsingHistoryController.getUserBrowsingHistory);
router.delete('/user/:userId/clear', browsingHistoryController.clearUserHistory);
router.put('/:historyId/update-engagement', browsingHistoryController.updateEngagementMetrics);

// Analytics routes (work for any user)
router.get('/product/:productId/analytics', browsingHistoryController.getProductAnalytics);

// ✅ CRITICAL: Export the router
module.exports = router;
