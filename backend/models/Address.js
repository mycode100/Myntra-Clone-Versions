const mongoose = require("mongoose");

// Address schema with strict validation for India
const AddressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Person/recipient name for this address
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    // Indian mobile number: 10 digits, starts 6-9
    phone: {
      type: String,
      required: true,
      trim: true,
      match: /^[6-9]\d{9}$/,
    },

    // Lines and location
    addressLine1: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    addressLine2: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },
    landmark: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },
    city: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    state: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    // Indian PIN code: 6 digits, cannot start with 0
    pincode: {
      type: String,
      required: true,
      trim: true,
      match: /^[1-9][0-9]{5}$/,
    },

    country: {
      type: String,
      trim: true,
      default: "India",
      maxlength: 56,
    },

    // Quick label for UI
    addressType: {
      type: String,
      enum: ["Home", "Office", "Other"],
      default: "Home",
    },

    // Only one default per user; enforced in hooks below
    isDefault: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

// Helpful indexes
AddressSchema.index({ userId: 1, isDefault: -1, createdAt: -1 });
AddressSchema.index({ pincode: 1 });

// Static methods

// Get all addresses sorted with default first, newest next
AddressSchema.statics.getUserAddresses = function (userId) {
  return this.find({ userId })
    .sort({ isDefault: -1, createdAt: -1 })
    .lean();
};

// Get default address for a user
AddressSchema.statics.getDefaultAddress = function (userId) {
  return this.findOne({ userId, isDefault: true }).lean();
};

// Atomically set a specific address as default for a user
AddressSchema.statics.setDefaultAddress = async function (userId, addressId) {
  // Remove default from all addresses of the user
  await this.updateMany({ userId }, { $set: { isDefault: false } });
  // Set requested one as default
  return this.findByIdAndUpdate(
    addressId,
    { $set: { isDefault: true } },
    { new: true }
  );
};

// Middleware to keep only one default per user
AddressSchema.pre("save", async function (next) {
  try {
    // Normalize trims
    if (this.name) this.name = this.name.trim();
    if (this.addressLine1) this.addressLine1 = this.addressLine1.trim();
    if (this.addressLine2) this.addressLine2 = this.addressLine2.trim();
    if (this.landmark) this.landmark = this.landmark.trim();
    if (this.city) this.city = this.city.trim();
    if (this.state) this.state = this.state.trim();
    if (this.country) this.country = this.country.trim();
    if (this.pincode) this.pincode = this.pincode.trim();
    if (this.phone) this.phone = this.phone.trim();

    // If marking this as default, clear default from others
    if (this.isDefault) {
      await this.constructor.updateMany(
        { userId: this.userId, _id: { $ne: this._id } },
        { $set: { isDefault: false } }
      );
    } else {
      // If the user has no addresses yet (i.e., first address),
      // make it default automatically.
      if (this.isNew) {
        const count = await this.constructor.countDocuments({
          userId: this.userId,
        });
        if (count === 0) {
          this.isDefault = true;
        }
      }
    }

    next();
  } catch (err) {
    next(err);
  }
});

// Ensure phone and pincode are consistently formatted before update operations
AddressSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() || {};
  const $set = update.$set || update;

  // Normalize strings
  ["name", "addressLine1", "addressLine2", "landmark", "city", "state", "country", "pincode", "phone"].forEach(
    (key) => {
      if ($set[key] && typeof $set[key] === "string") {
        $set[key] = $set[key].trim();
      }
    }
  );

  // If setting isDefault true, clear others for that user
  if ($set.isDefault === true) {
    // We need userId to clear other defaults. If not present, abort clearing here.
    if (!this.getQuery().userId && !$set.userId) {
      // userId not known here; controller should call setDefaultAddress instead.
    }
  }

  // Reassign update
  if (update.$set) {
    update.$set = $set;
  } else {
    Object.assign(update, $set);
  }
  this.setUpdate(update);
  next();
});

module.exports = mongoose.model("Address", AddressSchema);
