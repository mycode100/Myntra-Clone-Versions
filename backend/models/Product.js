const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {
    name: String,
    brand: String,
    price: Number,
    discount: String,
    description: String,
    sizes: [String],
    images: [String],
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" }, // related category
    rating: Number // ✅ Add if using in filter
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", ProductSchema);
