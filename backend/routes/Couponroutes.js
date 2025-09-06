const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Coupon = require('../models/Coupon');
const Bag = require('../models/Bag');
const CouponRuleEngine = require('../couponRules');

// ✅ HELPER FUNCTION: Safe cart total calculation
const calculateSafeCartTotal = (userBagItems) => {
  return userBagItems
    .filter(item => item.productId && item.productId.price != null) // Filter out null productId
    .reduce((sum, item) => sum + (item.productId.price * item.quantity), 0);
};

// ✅ HELPER FUNCTION: Safe cart state preparation
const prepareSafeCartState = (userBagItems) => {
  const validItems = userBagItems.filter(item => item.productId && item.productId.price != null);
  const cartTotal = calculateSafeCartTotal(userBagItems);
  
  return {
    total: cartTotal,
    items: validItems.map(item => ({
      id: item.productId._id,
      price: item.productId.price,
      quantity: item.quantity,
      category: item.productId.category ? item.productId.category.toString() : null
    }))
  };
};

// ✅ FIXED: Route to apply a coupon code
router.post('/apply', async (req, res) => {
    console.log('🎟️ Apply coupon request:', req.body);
    const { couponCode, userId } = req.body;

    if (!couponCode || !userId) {
        return res.status(400).json({ success: false, message: 'Coupon code and userId are required.' });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: 'Invalid userId format.' });
    }

    try {
        const userBagItems = await Bag.find({ userId: userId, savedForLater: false }).populate({
            path: 'productId',
            select: 'price category',
            populate: {
                path: 'category',
                select: '_id'
            }
        });

        if (userBagItems.length === 0) {
            return res.status(404).json({ success: false, message: 'Your bag is empty.' });
        }

        // ✅ FIXED: Use safe calculation
        const cartTotal = calculateSafeCartTotal(userBagItems);

        if (cartTotal === 0) {
            return res.status(400).json({ success: false, message: 'Cart has no valid items with prices.' });
        }

        const jsonCoupon = CouponRuleEngine.getAllCoupons().find(c => c.name === couponCode.toUpperCase());
        
        if (jsonCoupon) {
            const cartState = prepareSafeCartState(userBagItems);
            const validation = CouponRuleEngine.validateCoupon(jsonCoupon, cartState);
            
            if (!validation.isValid) {
                return res.status(400).json({ 
                    success: false, 
                    message: validation.reasons[0], 
                    errors: validation.reasons 
                });
            }

            const discountAmount = validation.discountAmount;

            await Bag.updateMany(
                { userId: userId, savedForLater: false },
                { $set: { appliedCoupon: jsonCoupon.id, discountAmount: discountAmount } }
            );

            CouponRuleEngine.incrementUsageCount(jsonCoupon.id);

            return res.status(200).json({
                success: true,
                message: 'Coupon applied successfully!',
                couponCode: jsonCoupon.name,
                discountAmount: discountAmount,
                cartTotal: cartTotal,
                newTotal: cartTotal - discountAmount,
                couponId: jsonCoupon.id
            });
        }

        // Fallback to MongoDB coupon system...
        const { valid, errors, coupon } = await Coupon.findValidCoupon(couponCode, userId, userBagItems, cartTotal);

        if (!valid) {
            return res.status(400).json({ success: false, message: errors[0], errors: errors });
        }

        const discountAmount = coupon.calculateDiscount(cartTotal, userBagItems);

        await Bag.updateMany(
            { userId: userId, savedForLater: false },
            { $set: { appliedCoupon: coupon._id, discountAmount: discountAmount } }
        );

        await Coupon.updateOne({ _id: coupon._id }, { $inc: { used: 1 } });

        res.status(200).json({
            success: true,
            message: 'Coupon applied successfully!',
            couponCode: coupon.code,
            discountAmount: discountAmount,
            cartTotal: cartTotal,
            newTotal: cartTotal - discountAmount,
            couponId: coupon._id
        });

    } catch (error) {
        console.error('❌ Error applying coupon:', error);
        res.status(500).json({ success: false, message: 'Server error occurred.' });
    }
});

// ✅ EXISTING: Route to remove a coupon code
router.post('/remove', async (req, res) => {
    console.log('🗑️ Remove coupon request:', req.body);
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ success: false, message: 'userId is required.' });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: 'Invalid userId format.' });
    }

    try {
        const bagWithCoupon = await Bag.findOne({ 
            userId: userId, 
            savedForLater: false, 
            appliedCoupon: { $exists: true, $ne: null } 
        });

        await Bag.updateMany(
            { userId: userId, savedForLater: false },
            { $unset: { appliedCoupon: "", discountAmount: "" } }
        );

        if (bagWithCoupon && bagWithCoupon.appliedCoupon) {
            const jsonCoupon = CouponRuleEngine.getCouponById(bagWithCoupon.appliedCoupon.toString());
            if (jsonCoupon) {
                CouponRuleEngine.decrementUsageCount(bagWithCoupon.appliedCoupon.toString());
            } else {
                await Coupon.updateOne(
                    { _id: bagWithCoupon.appliedCoupon },
                    { $inc: { used: -1 } }
                );
            }
        }
        
        res.status(200).json({
            success: true,
            message: 'Coupon removed successfully!',
            discountAmount: 0
        });

    } catch (error) {
        console.error('❌ Error removing coupon:', error);
        res.status(500).json({ success: false, message: 'Server error occurred.' });
    }
});

// ✅ FIXED: Get available coupons for user
router.get('/available/:userId', async (req, res) => {
    console.log('📋 Get available coupons request for userId:', req.params.userId);
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: 'Invalid userId format.' });
    }

    try {
        const userBagItems = await Bag.find({ userId, savedForLater: false }).populate('productId');
        
        // ✅ FIXED: Use safe calculation
        const cartTotal = calculateSafeCartTotal(userBagItems);
        console.log('🛒 Safe cart total:', cartTotal, 'Items:', userBagItems.length);

        const cartState = prepareSafeCartState(userBagItems);
        console.log('🎯 Safe cart state prepared:', cartState);

        try {
            const availableCoupons = CouponRuleEngine.getActiveCoupons();
            const expiredCoupons = CouponRuleEngine.getExpiredCoupons();

            console.log('✅ Found coupons - Available:', availableCoupons.length, 'Expired:', expiredCoupons.length);

            const formattedAvailable = availableCoupons.map(coupon => {
                try {
                    return CouponRuleEngine.formatCouponForDisplay(coupon, cartState);
                } catch (formatError) {
                    console.error('❌ Error formatting coupon:', coupon.id, formatError);
                    return {
                        ...coupon,
                        isApplicable: false,
                        reasons: ['Error validating coupon']
                    };
                }
            });

            const formattedExpired = expiredCoupons.map(coupon => {
                try {
                    return CouponRuleEngine.formatCouponForDisplay(coupon);
                } catch (formatError) {
                    console.error('❌ Error formatting expired coupon:', coupon.id, formatError);
                    return coupon;
                }
            });

            res.status(200).json({
                success: true,
                data: {
                    availableCoupons: formattedAvailable,
                    expiredCoupons: formattedExpired,
                    cartTotal
                }
            });

        } catch (couponError) {
            console.error('❌ Error loading coupons:', couponError);
            res.status(200).json({
                success: true,
                data: {
                    availableCoupons: [],
                    expiredCoupons: [],
                    cartTotal
                }
            });
        }

    } catch (error) {
        console.error('❌ Error fetching available coupons:', error);
        res.status(500).json({ success: false, message: 'Server error occurred.' });
    }
});

// ✅ FIXED: Get threshold suggestions for user
router.post('/threshold-check', async (req, res) => {
    console.log('🎯 Threshold check request:', req.body);
    const { userId } = req.body;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: 'Valid userId is required.' });
    }

    try {
        const userBagItems = await Bag.find({ userId, savedForLater: false }).populate('productId');
        
        // ✅ FIXED: Use safe calculation
        const cartTotal = calculateSafeCartTotal(userBagItems);
        console.log('🛒 Threshold check - Safe cart total:', cartTotal);

        const cartState = prepareSafeCartState(userBagItems);

        let suggestion = null;
        try {
            suggestion = CouponRuleEngine.getBestThresholdSuggestion(cartState);
            console.log('💡 Threshold suggestion:', suggestion ? 'Found' : 'None');
        } catch (thresholdError) {
            console.error('❌ Error getting threshold suggestion:', thresholdError);
        }

        res.status(200).json({
            success: true,
            data: {
                cartTotal,
                suggestion: suggestion ? {
                    coupon: suggestion.coupon,
                    amountNeeded: suggestion.amountNeeded,
                    potentialSavings: suggestion.potentialSavings
                } : null
            }
        });

    } catch (error) {
        console.error('❌ Error checking threshold:', error);
        res.status(500).json({ success: false, message: 'Server error occurred.' });
    }
});

// ✅ FIXED: Validate cart changes against applied coupon
router.post('/validate-applied', async (req, res) => {
    console.log('🔍 Validate applied coupon request:', req.body);
    const { userId } = req.body;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: 'Valid userId is required.' });
    }

    try {
        const bagWithCoupon = await Bag.findOne({ 
            userId, 
            savedForLater: false, 
            appliedCoupon: { $exists: true, $ne: null } 
        });

        if (!bagWithCoupon || !bagWithCoupon.appliedCoupon) {
            return res.status(200).json({
                success: true,
                data: {
                    isValid: true,
                    message: 'No coupon applied'
                }
            });
        }

        const userBagItems = await Bag.find({ userId, savedForLater: false }).populate('productId');
        
        // ✅ FIXED: Use safe calculation
        const cartTotal = calculateSafeCartTotal(userBagItems);
        const cartState = prepareSafeCartState(userBagItems);

        const appliedCoupon = CouponRuleEngine.getCouponById(bagWithCoupon.appliedCoupon.toString());
        
        if (!appliedCoupon) {
            await Bag.updateMany(
                { userId, savedForLater: false },
                { $unset: { appliedCoupon: "", discountAmount: "" } }
            );

            return res.status(200).json({
                success: true,
                data: {
                    isValid: false,
                    shouldRemove: true,
                    reason: 'Applied coupon no longer exists'
                }
            });
        }

        const validation = CouponRuleEngine.validateCoupon(appliedCoupon, cartState);

        if (!validation.isValid) {
            await Bag.updateMany(
                { userId, savedForLater: false },
                { $unset: { appliedCoupon: "", discountAmount: "" } }
            );

            CouponRuleEngine.decrementUsageCount(appliedCoupon.id);
        }

        res.status(200).json({
            success: true,
            data: {
                isValid: validation.isValid,
                shouldRemove: !validation.isValid,
                reason: validation.reasons ? validation.reasons.join(', ') : '',
                newDiscount: validation.discountAmount || 0
            }
        });

    } catch (error) {
        console.error('❌ Error validating applied coupon:', error);
        res.status(500).json({ success: false, message: 'Server error occurred.' });
    }
});

module.exports = router;
