const express = require("express");
const Bag = require("../models/Bag");
const Order = require("../models/Order");
const Product = require("../models/Product");
const router = express.Router();
const mongoose = require("mongoose");

// ============================================================================
// ENHANCED ORDER ROUTES WITH PROFESSIONAL FEATURES & TRACKING
// ============================================================================

// ✅ Professional tracking number generator with carrier-specific formats
function generateTrackingInfo(carrier = null) {
  const carriers = [
    { name: "Delhivery", prefix: "DEL", length: 12 },
    { name: "Bluedart", prefix: "BD", length: 10 },
    { name: "Ecom Express", prefix: "ECE", length: 11 },
    { name: "XpressBees", prefix: "XPB", length: 10 },
    { name: "India Post", prefix: "IP", length: 13 },
    { name: "FedEx", prefix: "FDX", length: 12 },
    { name: "DHL", prefix: "DHL", length: 10 }
  ];

  const selectedCarrier = carrier ? 
    carriers.find(c => c.name === carrier) || carriers[0] : 
    carriers[Math.floor(Math.random() * carriers.length)];

  const statusOptions = ["Label Created", "Picked Up", "In Transit", "Out for Delivery"];
  const locations = [
    "Mumbai Distribution Center", "Delhi Hub", "Bangalore Facility", 
    "Hyderabad Warehouse", "Pune Center", "Chennai Hub", 
    "Kolkata Facility", "Gurgaon Warehouse"
  ];

  const randomStatus = statusOptions[Math.floor(Math.random() * statusOptions.length)];
  const randomLocation = locations[Math.floor(Math.random() * locations.length)];

  // Generate tracking number with carrier-specific format
  const randomDigits = Math.floor(Math.random() * Math.pow(10, selectedCarrier.length - selectedCarrier.prefix.length))
    .toString().padStart(selectedCarrier.length - selectedCarrier.prefix.length, '0');
  
  const trackingNumber = selectedCarrier.prefix + randomDigits;

  // Generate estimated delivery date (3-7 days from now)
  const deliveryDays = Math.floor(Math.random() * 5) + 3;
  const estimatedDelivery = new Date(Date.now() + deliveryDays * 24 * 60 * 60 * 1000);

  return {
    number: trackingNumber,
    carrier: selectedCarrier.name,
    estimatedDelivery,
    actualDelivery: null,
    currentLocation: randomLocation,
    status: randomStatus,
    timeline: [
      {
        status: "Order Placed",
        location: "Online Platform",
        timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        description: "Order has been placed successfully",
        updatedBy: "system"
      },
      {
        status: "Order Confirmed",
        location: "Warehouse",
        timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
        description: "Order confirmed and processing initiated",
        updatedBy: "system"
      },
      {
        status: randomStatus,
        location: randomLocation,
        timestamp: new Date(),
        description: `Package ${randomStatus.toLowerCase()} at ${randomLocation}`,
        updatedBy: "courier"
      }
    ],
    deliveryAttempts: 0,
    deliveryInstructions: '',
    recipientName: '',
    deliveryProof: ''
  };
}

// ✅ Enhanced order creation with comprehensive validation
router.post("/create/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { 
      shippingAddress, 
      billingAddress,
      paymentMethod = 'COD',
      paymentGateway,
      customerNotes = '',
      deliveryPreferences = {},
      coupons = [],
      analytics = {}
    } = req.body;

    // Validate required fields
    if (!userId || !shippingAddress || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "userId, shippingAddress, and paymentMethod are required"
      });
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }

    // Validate shipping address
    const requiredAddressFields = ['fullName', 'phone', 'addressLine1', 'city', 'state', 'pincode'];
    for (const field of requiredAddressFields) {
      if (!shippingAddress[field] || shippingAddress[field].trim() === '') {
        return res.status(400).json({
          success: false,
          message: `Shipping address ${field} is required`
        });
      }
    }

    // Validate phone number (Indian format)
    if (!/^[6-9]\d{9}$/.test(shippingAddress.phone)) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number format. Please provide a valid 10-digit Indian mobile number"
      });
    }

    // Validate pincode (Indian format)
    if (!/^[1-9][0-9]{5}$/.test(shippingAddress.pincode)) {
      return res.status(400).json({
        success: false,
        message: "Invalid pincode format. Please provide a valid 6-digit Indian pincode"
      });
    }

    // Get user's bag items
    const bagItems = await Bag.find({ userId, savedForLater: { $ne: true } })
      .populate({
        path: 'productId',
        select: 'name brand price discount images description stock'
      });

    if (bagItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No items in the bag to create order"
      });
    }

    // Validate stock availability for all items
    const stockIssues = [];
    for (const bagItem of bagItems) {
      if (!bagItem.productId) {
        stockIssues.push({
          itemId: bagItem._id,
          issue: "Product no longer available"
        });
        continue;
      }

      if (bagItem.productId.stock !== undefined && bagItem.productId.stock < bagItem.quantity) {
        stockIssues.push({
          itemId: bagItem._id,
          productName: bagItem.productId.name,
          availableStock: bagItem.productId.stock,
          requestedQuantity: bagItem.quantity,
          issue: "Insufficient stock"
        });
      }
    }

    if (stockIssues.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Some items have stock issues",
        stockIssues
      });
    }

    // Filter out items with null productId
    const validBagItems = bagItems.filter(item => item.productId);

    // Transform bag items to order items with product snapshots
    const orderItems = validBagItems.map(item => ({
      productId: item.productId._id,
      productSnapshot: {
        name: item.productId.name,
        brand: item.productId.brand,
        images: item.productId.images || [],
        description: item.productId.description || ''
      },
      size: item.size,
      color: item.color,
      price: item.productId.price,
      quantity: item.quantity,
      discount: {
        percentage: 0,
        amount: 0,
        code: item.discountWhenAdded || ''
      },
      status: 'Processing'
    }));

    // Calculate pricing breakdown
    const subtotal = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Apply coupons if provided
    let totalDiscount = 0;
    const appliedCoupons = [];
    
    for (const coupon of coupons) {
      if (coupon.type === 'percentage') {
        const discountAmount = (subtotal * coupon.discount) / 100;
        totalDiscount += discountAmount;
        appliedCoupons.push({
          code: coupon.code,
          discount: discountAmount,
          type: 'percentage'
        });
      } else if (coupon.type === 'fixed') {
        totalDiscount += coupon.discount;
        appliedCoupons.push({
          code: coupon.code,
          discount: coupon.discount,
          type: 'fixed'
        });
      }
    }

    // Calculate shipping and tax
    const discountedSubtotal = Math.max(0, subtotal - totalDiscount);
    const shipping = discountedSubtotal > 499 ? 0 : 99;
    const tax = Math.round(discountedSubtotal * 0.05); // 5% tax
    const finalTotal = discountedSubtotal + shipping + tax;

    // Generate tracking information
    const trackingInfo = generateTrackingInfo();

    // Create order data
    const orderData = {
      orderId: Order.generateOrderId(),
      userId,
      items: orderItems,
      status: 'Pending',
      orderDate: new Date(),
      pricing: {
        subtotal,
        discount: totalDiscount,
        shipping,
        tax,
        total: finalTotal
      },
      coupons: appliedCoupons,
      shippingAddress: {
        ...shippingAddress,
        country: shippingAddress.country || 'India'
      },
      billingAddress: billingAddress || shippingAddress,
      payment: {
        method: paymentMethod,
        status: paymentMethod === 'COD' ? 'Pending' : 'Completed',
        paymentGateway: paymentGateway || null,
        paidAmount: paymentMethod === 'COD' ? 0 : finalTotal,
        paymentDate: paymentMethod === 'COD' ? null : new Date()
      },
      tracking: trackingInfo,
      customerNotes: customerNotes.trim(),
      deliveryPreferences: {
        timeSlot: deliveryPreferences.timeSlot || 'Anytime',
        instructions: deliveryPreferences.instructions || '',
        requireSignature: deliveryPreferences.requireSignature || false,
        allowPartialDelivery: deliveryPreferences.allowPartialDelivery !== false
      },
      analytics: {
        sourceChannel: analytics.sourceChannel || 'mobile_app',
        campaign: analytics.campaign || '',
        referrer: analytics.referrer || '',
        deviceInfo: analytics.deviceInfo || ''
      }
    };

    // Create and save the order
    const newOrder = new Order(orderData);
    const savedOrder = await newOrder.save();

    // Update order status to confirmed
    await savedOrder.updateStatus('Confirmed', 'Warehouse', 'Order confirmed and ready for processing');

    // Clear user's bag after successful order creation
    await Bag.clearUserBag(userId);

    // Update product stock (optional - based on your inventory management)
    for (const item of orderItems) {
      await Product.findByIdAndUpdate(
        item.productId,
        { $inc: { stock: -item.quantity } },
        { new: true }
      );
    }

    // Populate the saved order for response
    const populatedOrder = await Order.findById(savedOrder._id)
      .populate({
        path: 'items.productId',
        select: 'name brand images price discount rating'
      });

    res.status(201).json({
      success: true,
      message: "Order placed successfully",
      data: {
        order: populatedOrder,
        estimatedDelivery: trackingInfo.estimatedDelivery,
        trackingNumber: trackingInfo.number,
        nextSteps: [
          "You will receive an SMS/email confirmation shortly",
          "Track your order using the tracking number provided",
          "Your order will be delivered within the estimated timeframe"
        ]
      }
    });

  } catch (error) {
    console.error("Error creating order:", error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: "Invalid order data",
        details: Object.values(error.errors).map(err => err.message)
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to create order",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ Enhanced GET user orders with advanced filtering
router.get("/user/:userid", async (req, res) => {
  try {
    const { userid } = req.params;
    const {
      status,
      page = 1,
      limit = 10,
      sortBy = 'orderDate',
      sortOrder = 'desc',
      startDate,
      endDate,
      search,
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

    const options = {
      status,
      limit: limitNum,
      skip,
      sortBy,
      sortOrder: sortOrderNum,
      startDate,
      endDate
    };

    // Get orders with advanced filtering
    let orders = await Order.getUserOrders(userid, options);

    // Apply search filter if provided
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      orders = orders.filter(order => 
        order.orderId.match(searchRegex) ||
        order.items.some(item => 
          item.productId && (
            searchRegex.test(item.productId.name) ||
            searchRegex.test(item.productId.brand)
          )
        ) ||
        (order.tracking && searchRegex.test(order.tracking.number))
      );
    }

    // Get total count for pagination
    let countQuery = { userId: userid };
    if (status) countQuery.status = status;
    if (startDate || endDate) {
      countQuery.orderDate = {};
      if (startDate) countQuery.orderDate.$gte = new Date(startDate);
      if (endDate) countQuery.orderDate.$lte = new Date(endDate);
    }

    const totalCount = await Order.countDocuments(countQuery);

    // Enhance orders with computed fields
    const enhancedOrders = orders.map(order => ({
      ...order,
      canBeCancelled: order.canBeCancelled,
      canBeReturned: order.canBeReturned,
      isDelivered: order.isDelivered,
      itemCount: order.itemCount,
      daysSinceOrder: Math.floor((new Date() - new Date(order.orderDate)) / (1000 * 60 * 60 * 24)),
      estimatedDaysRemaining: order.tracking?.estimatedDelivery ? 
        Math.max(0, Math.ceil((new Date(order.tracking.estimatedDelivery) - new Date()) / (1000 * 60 * 60 * 24))) : 
        null
    }));

    // Prepare response
    const response = {
      success: true,
      data: enhancedOrders,
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
        applied: { status, search, startDate, endDate, sortBy, sortOrder },
        totalResults: orders.length
      }
    };

    // Add statistics if requested
    if (includeStats === 'true') {
      const stats = await Order.getOrderStats(userid);
      if (stats.length > 0) {
        const stat = stats[0];
        
        // Process status breakdown
        const statusBreakdown = stat.statusBreakdown.reduce((acc, status) => {
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {});

        response.statistics = {
          totalOrders: stat.totalOrders,
          totalSpent: Math.round(stat.totalSpent),
          averageOrderValue: Math.round(stat.avgOrderValue),
          statusBreakdown,
          lifetimeValue: Math.round(stat.totalSpent),
          orderFrequency: stat.totalOrders > 1 ? 
            Math.round((new Date() - new Date(orders[orders.length - 1]?.orderDate)) / (1000 * 60 * 60 * 24) / stat.totalOrders) : 
            null
        };
      }
    }

    res.status(200).json(response);

  } catch (error) {
    console.error("Error fetching user orders:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ NEW: Get single order details
router.get("/:orderid", async (req, res) => {
  try {
    const { orderid } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(orderid)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID format"
      });
    }

    const order = await Order.findById(orderid)
      .populate({
        path: 'items.productId',
        select: 'name brand images price discount rating ratingCount stock'
      });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Add computed fields
    const enhancedOrder = {
      ...order.toObject(),
      canBeCancelled: order.canBeCancelled,
      canBeReturned: order.canBeReturned,
      isDelivered: order.isDelivered,
      itemCount: order.itemCount,
      daysSinceOrder: Math.floor((new Date() - new Date(order.orderDate)) / (1000 * 60 * 60 * 24)),
      estimatedDaysRemaining: order.tracking?.estimatedDelivery ? 
        Math.max(0, Math.ceil((new Date(order.tracking.estimatedDelivery) - new Date()) / (1000 * 60 * 60 * 24))) : 
        null
    };

    res.status(200).json({
      success: true,
      data: enhancedOrder
    });

  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order details",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ NEW: Update order status (admin functionality)
router.patch("/:orderid/status", async (req, res) => {
  try {
    const { orderid } = req.params;
    const { status, location = '', description = '', updatedBy = 'admin' } = req.body;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(orderid)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID format"
      });
    }

    // Validate status
    const validStatuses = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned', 'Refunded'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
        validStatuses
      });
    }

    const order = await Order.findById(orderid);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Update order status using model method
    await order.updateStatus(status, location, description);

    // Special handling for delivered status
    if (status === 'Delivered') {
      order.actualDeliveryDate = new Date();
      if (order.tracking) {
        order.tracking.actualDelivery = new Date();
        order.tracking.status = 'Delivered';
      }
      await order.save();
    }

    res.status(200).json({
      success: true,
      message: `Order status updated to ${status}`,
      data: {
        orderId: order.orderId,
        previousStatus: order.status,
        newStatus: status,
        updatedAt: new Date().toISOString(),
        trackingTimeline: order.tracking?.timeline || []
      }
    });

  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update order status",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ NEW: Cancel order
router.patch("/:orderid/cancel", async (req, res) => {
  try {
    const { orderid } = req.params;
    const { reason = 'Customer request', refundAmount } = req.body;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(orderid)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID format"
      });
    }

    const order = await Order.findById(orderid);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Check if order can be cancelled
    if (!order.canBeCancelled) {
      return res.status(400).json({
        success: false,
        message: "This order cannot be cancelled",
        currentStatus: order.status
      });
    }

    // Cancel order using model method
    await order.cancelOrder(reason);

    // Process refund if payment was already made
    if (order.payment.status === 'Completed' && refundAmount) {
      await order.processRefund(refundAmount);
    }

    // Restore product stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(
        item.productId,
        { $inc: { stock: item.quantity } }
      );
    }

    res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      data: {
        orderId: order.orderId,
        cancelledAt: new Date().toISOString(),
        reason,
        refundStatus: order.payment.status,
        refundAmount: order.payment.refundAmount || 0
      }
    });

  } catch (error) {
    console.error("Error cancelling order:", error);
    
    if (error.message.includes('cannot be cancelled')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to cancel order",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ NEW: Track order by tracking number
router.get("/track/:trackingnumber", async (req, res) => {
  try {
    const { trackingnumber } = req.params;

    const order = await Order.findOne({ 'tracking.number': trackingnumber })
      .select('orderId status tracking shippingAddress items')
      .populate({
        path: 'items.productId',
        select: 'name brand images'
      });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Tracking number not found"
      });
    }

    res.status(200).json({
      success: true,
      data: {
        orderId: order.orderId,
        status: order.status,
        tracking: order.tracking,
        shippingAddress: {
          city: order.shippingAddress.city,
          state: order.shippingAddress.state,
          pincode: order.shippingAddress.pincode
        },
        itemCount: order.items.length,
        estimatedDelivery: order.tracking?.estimatedDelivery,
        lastUpdate: order.tracking?.timeline[order.tracking.timeline.length - 1]
      }
    });

  } catch (error) {
    console.error("Error tracking order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to track order",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ FIXED: Get order analytics/dashboard data
router.get("/analytics/:userid", async (req, res) => {
  try {
    const { userid } = req.params;
    const { timeframe = '30' } = req.query; // days

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(userid)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }

    const days = parseInt(timeframe);
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const analytics = await Order.aggregate([
      { 
        $match: { 
          userId: new mongoose.Types.ObjectId(userid), // ✅ FIXED: Added 'new'
          orderDate: { $gte: startDate }
        } 
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: '$pricing.total' },
          avgOrderValue: { $avg: '$pricing.total' },
          statusBreakdown: { $push: '$status' },
          monthlySpend: {
            $push: {
              month: { $month: '$orderDate' },
              year: { $year: '$orderDate' },
              amount: '$pricing.total'
            }
          },
          recentOrders: { $push: '$$ROOT' }
        }
      }
    ]);

    if (analytics.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          totalOrders: 0,
          totalSpent: 0,
          avgOrderValue: 0,
          statusBreakdown: {},
          monthlyTrend: [],
          recentActivity: []
        }
      });
    }

    const data = analytics[0];
    
    // Process status breakdown
    const statusBreakdown = data.statusBreakdown.reduce((acc, status) => {
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    // Process monthly trend
    const monthlyTrend = data.monthlySpend.reduce((acc, item) => {
      const key = `${item.year}-${item.month.toString().padStart(2, '0')}`;
      acc[key] = (acc[key] || 0) + item.amount;
      return acc;
    }, {});

    // Get recent activity (last 5 orders)
    const recentActivity = data.recentOrders
      .sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate))
      .slice(0, 5)
      .map(order => ({
        orderId: order.orderId,
        status: order.status,
        total: order.pricing.total,
        itemCount: order.items.length,
        orderDate: order.orderDate
      }));

    res.status(200).json({
      success: true,
      data: {
        timeframe: `Last ${days} days`,
        totalOrders: data.totalOrders,
        totalSpent: Math.round(data.totalSpent),
        avgOrderValue: Math.round(data.avgOrderValue),
        statusBreakdown,
        monthlyTrend: Object.entries(monthlyTrend).map(([month, amount]) => ({
          month,
          amount: Math.round(amount)
        })),
        recentActivity
      }
    });

  } catch (error) {
    console.error("Error fetching order analytics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order analytics",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
