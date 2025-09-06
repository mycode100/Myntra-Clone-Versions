const Address = require("../models/Address");
const mongoose = require("mongoose");

// ============================================================================
// ADDRESS CONTROLLER - CRUD OPERATIONS WITH VALIDATION
// ============================================================================

// Get all addresses for a user
exports.getUserAddresses = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }

    const addresses = await Address.getUserAddresses(userId);
    const defaultAddress = addresses.find(addr => addr.isDefault) || null;

    res.status(200).json({
      success: true,
      data: addresses,
      meta: {
        total: addresses.length,
        defaultAddress: defaultAddress,
        hasDefault: !!defaultAddress
      }
    });

  } catch (error) {
    console.error("Error fetching addresses:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch addresses",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Create new address
exports.createAddress = async (req, res) => {
  try {
    const addressData = req.body;

    // Validate required fields
    const requiredFields = ['userId', 'name', 'phone', 'addressLine1', 'city', 'state', 'pincode'];
    for (const field of requiredFields) {
      if (!addressData[field] || addressData[field].toString().trim() === '') {
        return res.status(400).json({
          success: false,
          message: `${field} is required`
        });
      }
    }

    // Validate ObjectId format for userId
    if (!mongoose.Types.ObjectId.isValid(addressData.userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }

    // Additional validation for phone and pincode patterns
    const phoneRegex = /^[6-9]\d{9}$/;
    const pincodeRegex = /^[1-9][0-9]{5}$/;

    if (!phoneRegex.test(addressData.phone.toString().trim())) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number. Please provide a valid 10-digit Indian mobile number"
      });
    }

    if (!pincodeRegex.test(addressData.pincode.toString().trim())) {
      return res.status(400).json({
        success: false,
        message: "Invalid pincode. Please provide a valid 6-digit Indian pincode"
      });
    }

    // Check if this is the user's first address or explicitly set as default
    const existingCount = await Address.countDocuments({ userId: addressData.userId });
    if (existingCount === 0 || addressData.isDefault === true) {
      // If first address or explicitly setting as default, clear others
      if (addressData.isDefault === true) {
        await Address.updateMany({ userId: addressData.userId }, { isDefault: false });
      }
      addressData.isDefault = true;
    }

    const newAddress = new Address(addressData);
    const savedAddress = await newAddress.save();

    res.status(201).json({
      success: true,
      message: "Address created successfully",
      data: savedAddress
    });

  } catch (error) {
    console.error("Error creating address:", error);

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: "Invalid address data",
        errors
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Duplicate address entry"
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to create address",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Update existing address
exports.updateAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const updateData = req.body;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(addressId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid address ID format"
      });
    }

    // Find the address first to get userId for default handling
    const existingAddress = await Address.findById(addressId);
    if (!existingAddress) {
      return res.status(404).json({
        success: false,
        message: "Address not found"
      });
    }

    // Validate phone and pincode if provided
    if (updateData.phone) {
      const phoneRegex = /^[6-9]\d{9}$/;
      if (!phoneRegex.test(updateData.phone.toString().trim())) {
        return res.status(400).json({
          success: false,
          message: "Invalid phone number format"
        });
      }
    }

    if (updateData.pincode) {
      const pincodeRegex = /^[1-9][0-9]{5}$/;
      if (!pincodeRegex.test(updateData.pincode.toString().trim())) {
        return res.status(400).json({
          success: false,
          message: "Invalid pincode format"
        });
      }
    }

    // If setting as default, use the static method to handle atomically
    if (updateData.isDefault === true) {
      await Address.setDefaultAddress(existingAddress.userId, addressId);
      // Remove isDefault from updateData since it's handled above
      delete updateData.isDefault;
    }

    const updatedAddress = await Address.findByIdAndUpdate(
      addressId,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Address updated successfully",
      data: updatedAddress
    });

  } catch (error) {
    console.error("Error updating address:", error);

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: "Invalid update data",
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update address",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Delete address
exports.deleteAddress = async (req, res) => {
  try {
    const { addressId } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(addressId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid address ID format"
      });
    }

    const address = await Address.findById(addressId);
    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found"
      });
    }

    const wasDefault = address.isDefault;
    const userId = address.userId;

    // Delete the address
    await Address.findByIdAndDelete(addressId);

    // If deleted address was default, set another as default
    if (wasDefault) {
      const nextAddress = await Address.findOne({ 
        userId: userId, 
        _id: { $ne: addressId } 
      });
      
      if (nextAddress) {
        nextAddress.isDefault = true;
        await nextAddress.save();
      }
    }

    res.status(200).json({
      success: true,
      message: "Address deleted successfully",
      data: {
        deletedAddressId: addressId,
        wasDefault: wasDefault
      }
    });

  } catch (error) {
    console.error("Error deleting address:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete address",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Set default address
exports.setDefaultAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const { userId } = req.body;

    // Validate ObjectId formats
    if (!mongoose.Types.ObjectId.isValid(addressId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid address ID format"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }

    // Verify the address exists and belongs to the user
    const address = await Address.findOne({ _id: addressId, userId: userId });
    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found or doesn't belong to this user"
      });
    }

    const updatedAddress = await Address.setDefaultAddress(userId, addressId);

    res.status(200).json({
      success: true,
      message: "Default address updated successfully",
      data: updatedAddress
    });

  } catch (error) {
    console.error("Error setting default address:", error);
    res.status(500).json({
      success: false,
      message: "Failed to set default address",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get default address for a user
exports.getDefaultAddress = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }

    const defaultAddress = await Address.getDefaultAddress(userId);

    res.status(200).json({
      success: true,
      data: defaultAddress,
      message: defaultAddress ? "Default address found" : "No default address set"
    });

  } catch (error) {
    console.error("Error fetching default address:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch default address",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};
