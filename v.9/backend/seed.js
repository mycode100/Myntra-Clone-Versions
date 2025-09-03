const fs = require('fs');
const path = require('path');
const Product = require('./models/Product');
const Category = require('./models/Category');

const unwrapId = (id) => {
  if (typeof id === 'string') return id;
  if (id && id.$oid) return id.$oid;
  if (Array.isArray(id) && id.length > 0) return unwrapId(id[0]);
  return id;
};

async function seed() {
  try {
    // 1. Remove old data
    await Product.deleteMany({});
    await Category.deleteMany({});

    // 2. Read category and product JSON
    const categoriesData = JSON.parse(fs.readFileSync(path.join(__dirname, 'category.json'), 'utf-8'));
    const productsData  = JSON.parse(fs.readFileSync(path.join(__dirname, 'product.json'), 'utf-8'));

    // 3. Insert categories
    const insertedCategories = await Category.insertMany(categoriesData);
    const categoryMap = {};
    insertedCategories.forEach(cat => {
      categoryMap[cat.name.trim().toLowerCase()] = cat._id;
    });

    // 4. Prepare products with proper category references
    const productsToInsert = productsData.map(product => {
      const categoryName = product.categoryName?.trim().toLowerCase();
      return {
        ...product,
        category: categoryName && categoryMap[categoryName] ? categoryMap[categoryName] : null,
      };
    });

    // 5. Insert products
    const insertedProducts = await Product.insertMany(productsToInsert);

    // 6. Update each category with an array of its products' IDs
    const categoryProductsMap = {};
    insertedProducts.forEach(prod => {
      if (prod.category) {
        if (!categoryProductsMap[prod.category]) categoryProductsMap[prod.category] = [];
        categoryProductsMap[prod.category].push(prod._id);
      }
    });

    // 7. Save the updated product arrays in each category
    await Promise.all(
      Object.entries(categoryProductsMap).map(([catId, prodIds]) => {
        return Category.findByIdAndUpdate(catId, { productId: prodIds.map(unwrapId) });
      })
    );

    console.log('🌱 Database seeded:');
    console.log(`   Categories: ${insertedCategories.length}`);
    console.log(`   Products:   ${insertedProducts.length}`);
  } catch (error) {
    console.error('Seeding error:', error);
    throw error;
  }
}

module.exports = { seed };
