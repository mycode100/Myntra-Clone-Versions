class SimilarityService {

  // Calculate product similarity score (0-1)
  calculateProductSimilarity(product1, product2) {
    try {
      // ✅ ADDED: Input validation
      if (!product1 || !product2) {
        console.warn('⚠️ Invalid products provided to similarity calculation');
        return 0;
      }

      if (product1._id && product2._id && product1._id.toString() === product2._id.toString()) {
        return 0; // Same product = no similarity for recommendations
      }

      let totalScore = 0;
      let totalWeight = 0;

      // Category similarity (40% weight)
      const categoryWeight = 0.4;
      const categoryScore = this.categorySimilarity(product1, product2);
      totalScore += categoryScore * categoryWeight;
      totalWeight += categoryWeight;

      // Brand similarity (20% weight)
      const brandWeight = 0.2;
      const brandScore = this.brandSimilarity(product1, product2);
      totalScore += brandScore * brandWeight;
      totalWeight += brandWeight;

      // Price similarity (25% weight)
      const priceWeight = 0.25;
      const priceScore = this.priceSimilarity(product1, product2);
      totalScore += priceScore * priceWeight;
      totalWeight += priceWeight;

      // Rating similarity (15% weight)
      const ratingWeight = 0.15;
      const ratingScore = this.ratingSimilarity(product1, product2);
      totalScore += ratingScore * ratingWeight;
      totalWeight += ratingWeight;

      const finalScore = totalWeight > 0 ? totalScore / totalWeight : 0;
      
      // ✅ ADDED: Debug logging for very low or high similarity scores
      if (finalScore > 0.8) {
        console.log(`🎯 High similarity (${finalScore.toFixed(3)}) between "${product1.name}" and "${product2.name}"`);
      }

      return Math.max(0, Math.min(1, finalScore)); // ✅ ADDED: Ensure score is within 0-1 range

    } catch (error) {
      console.error('❌ Error calculating product similarity:', error);
      return 0;
    }
  }

  categorySimilarity(product1, product2) {
    try {
      if (!product1.category || !product2.category) return 0;
      
      // ✅ ENHANCED: Convert to string and handle ObjectId comparisons
      const cat1 = product1.category.toString().toLowerCase().trim();
      const cat2 = product2.category.toString().toLowerCase().trim();
      
      // Exact category match
      if (cat1 === cat2) {
        return 1.0;
      }

      // ✅ ENHANCED: Subcategory match with better handling
      if (product1.subcategory && product2.subcategory) {
        const subcat1 = product1.subcategory.toString().toLowerCase().trim();
        const subcat2 = product2.subcategory.toString().toLowerCase().trim();
        
        if (subcat1 === subcat2) {
          return 0.8;
        }
      }

      // ✅ NEW: Partial category name match (for related categories)
      if (cat1.includes(cat2) || cat2.includes(cat1)) {
        return 0.3;
      }

      return 0;

    } catch (error) {
      console.error('❌ Error in category similarity:', error);
      return 0;
    }
  }

  brandSimilarity(product1, product2) {
    try {
      if (!product1.brand || !product2.brand) return 0;
      
      const brand1 = product1.brand.toString().toLowerCase().trim();
      const brand2 = product2.brand.toString().toLowerCase().trim();
      
      // ✅ ENHANCED: Exact brand match
      if (brand1 === brand2) {
        return 1.0;
      }

      // ✅ NEW: Partial brand match (for brand variations like "Nike" vs "Nike Sport")
      if (brand1.includes(brand2) || brand2.includes(brand1)) {
        return 0.7;
      }

      // ✅ NEW: Similar brand names (basic similarity)
      const similarity = this.textSimilarity(brand1, brand2);
      if (similarity > 0.8) {
        return 0.5; // Similar brand names get moderate similarity
      }

      return 0;

    } catch (error) {
      console.error('❌ Error in brand similarity:', error);
      return 0;
    }
  }

  priceSimilarity(product1, product2) {
    try {
      // ✅ ENHANCED: Better price validation
      const price1 = parseFloat(product1.price) || 0;
      const price2 = parseFloat(product2.price) || 0;
      
      if (price1 <= 0 || price2 <= 0) return 0;
      
      const priceDiff = Math.abs(price1 - price2);
      const avgPrice = (price1 + price2) / 2;
      
      // ✅ FIXED: Handle division by zero
      if (avgPrice === 0) return price1 === price2 ? 1.0 : 0;
      
      // ✅ ENHANCED: More sophisticated price similarity calculation
      const relativeDistance = priceDiff / avgPrice;
      
      // Products within 10% price range get high similarity
      if (relativeDistance <= 0.1) return 1.0;
      
      // Products within 25% price range get good similarity
      if (relativeDistance <= 0.25) return 0.8;
      
      // Products within 50% price range get moderate similarity
      if (relativeDistance <= 0.5) return 0.5;
      
      // Products within 100% price range get low similarity
      if (relativeDistance <= 1.0) return 0.2;
      
      return 0; // Products with more than 100% price difference get no similarity

    } catch (error) {
      console.error('❌ Error in price similarity:', error);
      return 0;
    }
  }

  ratingSimilarity(product1, product2) {
    try {
      const rating1 = parseFloat(product1.rating) || 0;
      const rating2 = parseFloat(product2.rating) || 0;
      
      // ✅ ENHANCED: Handle edge cases
      if (rating1 <= 0 && rating2 <= 0) return 0.5; // Both unrated = neutral similarity
      if (rating1 <= 0 || rating2 <= 0) return 0.3; // One unrated = lower similarity
      
      const ratingDiff = Math.abs(rating1 - rating2);
      
      // ✅ ENHANCED: More nuanced rating similarity
      if (ratingDiff <= 0.2) return 1.0; // Very close ratings
      if (ratingDiff <= 0.5) return 0.8;  // Close ratings
      if (ratingDiff <= 1.0) return 0.6;  // Somewhat close ratings
      if (ratingDiff <= 1.5) return 0.4;  // Different ratings
      if (ratingDiff <= 2.0) return 0.2;  // Very different ratings
      
      return 0; // Completely different ratings

    } catch (error) {
      console.error('❌ Error in rating similarity:', error);
      return 0;
    }
  }

  // ✅ ENHANCED: Text similarity for product names/descriptions
  textSimilarity(text1, text2) {
    try {
      if (!text1 || !text2) return 0;
      
      const str1 = text1.toString().toLowerCase().trim();
      const str2 = text2.toString().toLowerCase().trim();
      
      if (str1 === str2) return 1.0;
      if (str1.length === 0 || str2.length === 0) return 0;
      
      // ✅ ENHANCED: Multiple similarity methods
      
      // 1. Word overlap similarity (existing method)
      const words1 = str1.split(/\W+/).filter(w => w.length > 2);
      const words2 = str2.split(/\W+/).filter(w => w.length > 2);
      
      if (words1.length === 0 && words2.length === 0) return 1.0;
      if (words1.length === 0 || words2.length === 0) return 0;
      
      const intersection = words1.filter(word => words2.includes(word));
      const union = [...new Set([...words1, ...words2])];
      
      const jaccardSimilarity = union.length > 0 ? intersection.length / union.length : 0;
      
      // 2. ✅ NEW: Substring similarity
      const substringMatch = str1.includes(str2) || str2.includes(str1) ? 0.3 : 0;
      
      // 3. ✅ NEW: Length-normalized edit distance (simplified)
      const maxLength = Math.max(str1.length, str2.length);
      const minLength = Math.min(str1.length, str2.length);
      const lengthSimilarity = maxLength > 0 ? minLength / maxLength : 0;
      
      // Combine similarities with weights
      const finalSimilarity = (
        jaccardSimilarity * 0.7 +
        substringMatch * 0.2 +
        lengthSimilarity * 0.1
      );
      
      return Math.max(0, Math.min(1, finalSimilarity));

    } catch (error) {
      console.error('❌ Error in text similarity:', error);
      return 0;
    }
  }

  // ✅ NEW: Calculate color similarity (if products have color attributes)
  colorSimilarity(product1, product2) {
    try {
      if (!product1.colors || !product2.colors) return 0;
      
      const colors1 = Array.isArray(product1.colors) ? product1.colors : [product1.colors];
      const colors2 = Array.isArray(product2.colors) ? product2.colors : [product2.colors];
      
      if (colors1.length === 0 || colors2.length === 0) return 0;
      
      // Normalize color names
      const normalizedColors1 = colors1.map(c => c.toString().toLowerCase().trim());
      const normalizedColors2 = colors2.map(c => c.toString().toLowerCase().trim());
      
      // Find common colors
      const commonColors = normalizedColors1.filter(c => normalizedColors2.includes(c));
      const totalUniqueColors = [...new Set([...normalizedColors1, ...normalizedColors2])].length;
      
      return totalUniqueColors > 0 ? commonColors.length / totalUniqueColors : 0;

    } catch (error) {
      console.error('❌ Error in color similarity:', error);
      return 0;
    }
  }

  // ✅ NEW: Calculate size compatibility (if products have size attributes)
  sizeSimilarity(product1, product2) {
    try {
      if (!product1.sizes || !product2.sizes) return 0;
      
      const sizes1 = Array.isArray(product1.sizes) ? product1.sizes : [product1.sizes];
      const sizes2 = Array.isArray(product2.sizes) ? product2.sizes : [product2.sizes];
      
      if (sizes1.length === 0 || sizes2.length === 0) return 0;
      
      // Normalize size names
      const normalizedSizes1 = sizes1.map(s => s.toString().toLowerCase().trim());
      const normalizedSizes2 = sizes2.map(s => s.toString().toLowerCase().trim());
      
      // Find common sizes
      const commonSizes = normalizedSizes1.filter(s => normalizedSizes2.includes(s));
      const totalUniqueSizes = [...new Set([...normalizedSizes1, ...normalizedSizes2])].length;
      
      return totalUniqueSizes > 0 ? commonSizes.length / totalUniqueSizes : 0;

    } catch (error) {
      console.error('❌ Error in size similarity:', error);
      return 0;
    }
  }

  // ✅ NEW: Enhanced product similarity with additional attributes
  calculateEnhancedProductSimilarity(product1, product2) {
    try {
      const baseSimilarity = this.calculateProductSimilarity(product1, product2);
      
      // Add bonus similarity for additional attributes
      let bonusScore = 0;
      let bonusWeight = 0;
      
      // Color similarity bonus (5% weight)
      const colorScore = this.colorSimilarity(product1, product2);
      if (colorScore > 0) {
        bonusScore += colorScore * 0.05;
        bonusWeight += 0.05;
      }
      
      // Size similarity bonus (5% weight)
      const sizeScore = this.sizeSimilarity(product1, product2);
      if (sizeScore > 0) {
        bonusScore += sizeScore * 0.05;
        bonusWeight += 0.05;
      }
      
      // Text similarity bonus (10% weight)
      if (product1.name && product2.name) {
        const nameScore = this.textSimilarity(product1.name, product2.name);
        if (nameScore > 0.3) { // Only if significant name similarity
          bonusScore += nameScore * 0.1;
          bonusWeight += 0.1;
        }
      }
      
      // Combine base similarity with bonus
      const totalWeight = 1 + bonusWeight;
      const enhancedSimilarity = (baseSimilarity + bonusScore) / totalWeight;
      
      return Math.max(0, Math.min(1, enhancedSimilarity));

    } catch (error) {
      console.error('❌ Error in enhanced product similarity:', error);
      return this.calculateProductSimilarity(product1, product2); // Fallback to base similarity
    }
  }
}

module.exports = new SimilarityService();
