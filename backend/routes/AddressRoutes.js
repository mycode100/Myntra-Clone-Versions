const express = require("express");
const {
  getUserAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getDefaultAddress
} = require("../controllers/addressController");

const router = express.Router();

// ============================================================================
// ADDRESS ROUTES - REST API ENDPOINTS
// ============================================================================

// GET /api/address/user/:userId - Get all addresses for a user
router.get("/user/:userId", getUserAddresses);

// GET /api/address/user/:userId/default - Get default address for a user
router.get("/user/:userId/default", getDefaultAddress);

// POST /api/address - Create a new address
router.post("/", createAddress);

// PUT /api/address/:addressId - Update an existing address
router.put("/:addressId", updateAddress);

// DELETE /api/address/:addressId - Delete an address
router.delete("/:addressId", deleteAddress);

// PATCH /api/address/:addressId/default - Set an address as default
router.patch("/:addressId/default", setDefaultAddress);

module.exports = router;
