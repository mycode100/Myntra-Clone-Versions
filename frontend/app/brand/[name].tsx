import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  FlatList,
  StyleSheet,
  Dimensions,
  Modal,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Search,
  Filter,
  Grid3X3,
  List,
  Star,
  Heart,
  ShoppingBag,
  Package,
  SortAsc,
  RotateCcw,
} from "lucide-react-native";

import {
  getProducts,
  addToWishlist,
  removeFromWishlist,
  addToBag,
  handleApiError,
  applyFiltersToProducts,
} from "@/utils/api";

import { 
  Product as OriginalProduct, 
  FilterState, 
  SortOption,
  getActiveFiltersCount,
  resetFilters,
  getSortLabel,
  SORT_OPTIONS,
} from "@/types/product";
import FilterModal from "@/components/FilterModal";
import SearchOverlay from "@/components/SearchOverlay";
import { useAuth } from "@/context/AuthContext";

// Get screen dimensions
const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;

// Extend Product type
type Product = OriginalProduct & { 
  id?: string;
  originalPrice?: number;
};

interface BrandDetailState {
  brandName: string;
  products: Product[];
  isLoading: boolean;
  error: string | null;
  refreshing: boolean;
}

// ✅ ProductCard Component
interface ProductCardProps {
  product: Product;
  layout: 'grid' | 'list';
  onPress: () => void;
  onWishlistPress?: () => void;
  onBagPress?: () => void;
  isInWishlist?: boolean;
  isInBag?: boolean;
}

const ProductCard: React.FC<ProductCardProps> = ({ 
  product, 
  layout, 
  onPress, 
  onWishlistPress,
  onBagPress,
  isInWishlist = false,
  isInBag = false
}) => {
  const cardStyle = layout === 'grid' ? styles.productCardGrid : styles.productCardList;
  const imageStyle = layout === 'grid' ? styles.productImage : styles.productImageList;
  const detailsStyle = layout === 'grid' ? styles.productDetails : [styles.productDetails, styles.productDetailsGrid];

  const formatPrice = (price: number) => {
    return `₹${price.toLocaleString()}`;
  };

  const calculateDiscount = (price: number, originalPrice?: number) => {
    if (!originalPrice || originalPrice <= price) return null;
    const discount = Math.round(((originalPrice - price) / originalPrice) * 100);
    return `${discount}% OFF`;
  };

  const renderRating = (rating: number, ratingCount?: number) => {
    return (
      <View style={styles.productRating}>
        <Star size={12} color="#ffb400" fill="#ffb400" />
        <Text style={styles.ratingText}>
          {rating.toFixed(1)} {ratingCount && `(${ratingCount})`}
        </Text>
      </View>
    );
  };

  return (
    <TouchableOpacity
      style={[styles.productCard, cardStyle]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: product.images?.[0] || 'https://via.placeholder.com/200' }}
        style={imageStyle}
        resizeMode="cover"
      />
      
      <View style={detailsStyle}>
        <Text style={styles.productBrand} numberOfLines={1}>
          {product.brand}
        </Text>
        <Text style={styles.productName} numberOfLines={2}>
          {product.name}
        </Text>
        
        <View style={styles.productPriceContainer}>
          <Text style={styles.productPrice}>
            {formatPrice(product.price)}
          </Text>
          {product.originalPrice && product.originalPrice > product.price && (
            <>
              <Text style={styles.productOriginalPrice}>
                {formatPrice(product.originalPrice)}
              </Text>
              <Text style={styles.productDiscount}>
                {calculateDiscount(product.price, product.originalPrice)}
              </Text>
            </>
          )}
        </View>

        {product.rating && renderRating(product.rating, product.ratingCount)}
        
        {layout === 'list' && (
          <View style={styles.productActions}>
            <TouchableOpacity
              style={[styles.actionButton, isInWishlist && styles.actionButtonActive]}
              onPress={onWishlistPress}
            >
              <Heart size={16} color={isInWishlist ? '#fff' : '#ff3f6c'} fill={isInWishlist ? '#fff' : 'none'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, isInBag && styles.actionButtonActive]}
              onPress={onBagPress}
            >
              <ShoppingBag size={16} color={isInBag ? '#fff' : '#ff3f6c'} fill={isInBag ? '#fff' : 'none'} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

export default function BrandDetails() {
  const { name } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  console.log("🔍 Brand name from params:", name);

  const [state, setState] = useState<BrandDetailState>({
    brandName: (name as string) || '',
    products: [],
    isLoading: true,
    error: null,
    refreshing: false,
  });

  const [filters, setFilters] = useState<FilterState>({
    sortBy: 'relevance',
    brands: [(name as string)]
  });

  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showSearchOverlay, setShowSearchOverlay] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [wishlistItems, setWishlistItems] = useState<Set<string>>(new Set());
  const [bagItems, setBagItems] = useState<Set<string>>(new Set());

  // Apply filters to products
  const filteredProducts = useMemo(() => {
    let filtered = [...state.products];
    filtered = applyFiltersToProducts(filtered, filters);
    return filtered;
  }, [state.products, filters]);

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    return getActiveFiltersCount(filters);
  }, [filters]);

  // Extract available filter options
  const availableOptions = useMemo(() => {
    const brands = new Set<string>();
    const colors = new Set<string>();
    const sizes = new Set<string>();
    let minPrice = Infinity;
    let maxPrice = 0;

    state.products.forEach(product => {
      if (product.brand) brands.add(product.brand);
      if (product.colors) product.colors.forEach(color => colors.add(color));
      if (product.sizes) product.sizes.forEach(size => sizes.add(size));
      if (product.price < minPrice) minPrice = product.price;
      if (product.price > maxPrice) maxPrice = product.price;
    });

    return {
      brands: Array.from(brands).sort(),
      colors: Array.from(colors).sort(),
      sizes: Array.from(sizes).sort(),
      priceRange: { min: minPrice === Infinity ? 0 : minPrice, max: maxPrice },
    };
  }, [state.products]);

  // Fetch brand products
  const fetchBrandProducts = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      if (!name) {
        throw new Error("Brand name is missing");
      }

      console.log("🔍 Fetching products for brand:", name);

      const productsResponse = await getProducts({ 
        limit: 100,
        brand: name as string
      });

      if (!productsResponse.success) {
        throw new Error(handleApiError(productsResponse.error));
      }

      // Filter products by brand name and add missing properties
      const brandProducts = (productsResponse.data || [])
        .filter((product: Product) => 
          product.brand?.toLowerCase() === (name as string).toLowerCase()
        )
        .map((product: Product) => {
          const productId = product._id || product.id || `temp-${Math.random()}`;
          
          return {
            ...product,
            _id: productId,
            id: productId,
            rating: product.rating || (3.5 + Math.random() * 1.5),
            ratingCount: product.ratingCount || Math.floor(Math.random() * 500) + 10,
            originalPrice: product.originalPrice || (product.price * (1.2 + Math.random() * 0.3)),
          };
        });

      console.log("🔍 Brand products found:", brandProducts.length);

      setState(prev => ({
        ...prev,
        products: brandProducts,
        isLoading: false,
      }));

    } catch (error: any) {
      console.error("❌ Error loading brand products:", error);
      setState(prev => ({
        ...prev,
        error: error.message || "Failed to load brand products",
        isLoading: false,
      }));
    }
  };

  useEffect(() => {
    if (name) {
      fetchBrandProducts();
    }
  }, [name]);

  // Handle filter application
  const handleApplyFilters = (newFilters: FilterState) => {
    setFilters(newFilters);
    setShowFilterModal(false);
  };

  // Reset filters
  const handleResetFilters = () => {
    const resetedFilters = resetFilters();
    setFilters({
      ...resetedFilters,
      brands: [(name as string)] // Keep brand filter
    });
  };

  // Handle sort change
  const handleSortChange = (sortBy: SortOption) => {
    const newFilters = { ...filters, sortBy };
    setFilters(newFilters);
    setShowSortModal(false);
  };

  const handleProductPress = (product: Product) => {
    const productId = product._id || product.id;
    console.log("🔍 Product pressed:", productId);
    
    if (!productId) {
      console.error("❌ Product missing ID:", product);
      return;
    }
    
    router.push(`/product/${productId}`);
  };

  // ✅ FIXED: Handle wishlist press with user._id
  const handleWishlistPress = async (product: Product) => {
    const productId = product._id || product.id;
    if (!productId || !user) return;

    try {
      if (wishlistItems.has(productId)) {
        await removeFromWishlist(productId);
        setWishlistItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(productId);
          return newSet;
        });
      } else {
        await addToWishlist(productId, user._id); // ✅ Use user._id
        setWishlistItems(prev => new Set(prev).add(productId));
      }
    } catch (error) {
      console.error('Error updating wishlist:', error);
    }
  };

  // ✅ FIXED: Handle bag press with user._id
  const handleBagPress = async (product: Product) => {
    const productId = product._id || product.id;
    if (!productId || !user) return;

    try {
      await addToBag(productId, user._id); // ✅ Use user._id
      setBagItems(prev => new Set(prev).add(productId));
    } catch (error) {
      console.error('Error adding to bag:', error);
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    setState(prev => ({ ...prev, refreshing: true }));
    fetchBrandProducts().finally(() => {
      setState(prev => ({ ...prev, refreshing: false }));
    });
  };

  // Handle search within brand
  const handleSearchComplete = (query: string, searchFilters?: FilterState) => {
    console.log('🔍 Brand search:', query, searchFilters);
    if (searchFilters) {
      setFilters({
        ...searchFilters,
        brands: [(name as string)] // Always keep brand filter
      });
    }
  };

  // Render sort modal
  const renderSortModal = () => (
    <Modal visible={showSortModal} transparent animationType="fade" onRequestClose={() => setShowSortModal(false)}>
      <TouchableOpacity 
        style={styles.sortModalOverlay} 
        activeOpacity={1} 
        onPress={() => setShowSortModal(false)}
      >
        <View style={styles.sortModalContent}>
          <Text style={styles.sortModalTitle}>Sort By</Text>
          {SORT_OPTIONS.map(option => (
            <TouchableOpacity
              key={option.value}
              style={[styles.sortOption, filters.sortBy === option.value && styles.sortOptionActive]}
              onPress={() => handleSortChange(option.value)}
              activeOpacity={0.7}
            >
              <Text style={[styles.sortOptionText, filters.sortBy === option.value && styles.sortOptionTextActive]}>
                {option.label}
              </Text>
              {option.icon && <Text style={styles.sortOptionIcon}>{option.icon}</Text>}
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );

  if (state.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff3f6c" />
        <Text style={styles.loadingText}>Loading {name} products...</Text>
      </View>
    );
  }

  if (state.error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Brand not found</Text>
        <Text style={styles.errorText}>{state.error}</Text>
        <TouchableOpacity 
          style={styles.retryButton} 
          onPress={fetchBrandProducts}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#333" />
        </TouchableOpacity>

        <View style={styles.headerTitle}>
          <Text style={styles.brandName}>{name}</Text>
          <Text style={styles.productCount}>
            {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => setShowSearchOverlay(true)}
          >
            <Search size={22} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter and Sort Controls */}
      <View style={styles.controlsContainer}>
        <View style={styles.controlsLeft}>
          <TouchableOpacity
            style={[styles.filterButton, activeFiltersCount > 0 && styles.filterButtonActive]}
            onPress={() => setShowFilterModal(true)}
            activeOpacity={0.7}
          >
            <Filter size={16} color={activeFiltersCount > 0 ? "#fff" : "#333"} />
            <Text style={[styles.filterButtonText, activeFiltersCount > 0 && styles.filterButtonTextActive]}>
              Filter{activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ''}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sortButton}
            onPress={() => setShowSortModal(true)}
            activeOpacity={0.7}
          >
            <SortAsc size={16} color="#333" />
            <Text style={styles.sortButtonText}>{getSortLabel(filters.sortBy || 'relevance')}</Text>
          </TouchableOpacity>

          {activeFiltersCount > 0 && (
            <TouchableOpacity
              style={styles.resetButton}
              onPress={handleResetFilters}
              activeOpacity={0.7}
            >
              <RotateCcw size={14} color="#ff3f6c" />
              <Text style={styles.resetButtonText}>Reset</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={styles.layoutToggleButton}
          onPress={() => setLayout(layout === 'grid' ? 'list' : 'grid')}
          activeOpacity={0.7}
        >
          {layout === 'grid' ? (
            <List size={20} color="#333" />
          ) : (
            <Grid3X3 size={20} color="#333" />
          )}
        </TouchableOpacity>
      </View>

      {/* Empty State or Product List */}
      {filteredProducts.length === 0 && !state.isLoading ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Package size={40} color="#ccc" />
          </View>
          <Text style={styles.emptyTitle}>No Products Found</Text>
          <Text style={styles.emptyText}>
            {state.products.length === 0 
              ? `We couldn't find any products for "${name}". Try browsing other brands or check back later.`
              : `No products match your current filters. Try adjusting your search criteria.`
            }
          </Text>
          {state.products.length === 0 ? (
            <TouchableOpacity 
              style={styles.exploreButton}
              onPress={() => router.push('/categories')}
            >
              <Text style={styles.exploreButtonText}>Explore Categories</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.exploreButton}
              onPress={handleResetFilters}
            >
              <Text style={styles.exploreButtonText}>Clear Filters</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item, index) => `${item._id || item.id}-${index}`}
          numColumns={layout === 'grid' ? 2 : 1}
          key={layout}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              layout={layout}
              onPress={() => handleProductPress(item)}
              onWishlistPress={() => handleWishlistPress(item)}
              onBagPress={() => handleBagPress(item)}
              isInWishlist={wishlistItems.has(item._id || item.id || '')}
              isInBag={bagItems.has(item._id || item.id || '')}
            />
          )}
          contentContainerStyle={styles.productsList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={state.refreshing}
              onRefresh={handleRefresh}
              colors={['#ff3f6c']}
            />
          }
        />
      )}

      {/* Filter Modal */}
      <FilterModal
        visible={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        onApply={handleApplyFilters}
        currentFilters={filters}
        categories={[]}
        brands={availableOptions.brands}
        priceRange={availableOptions.priceRange}
        totalProducts={filteredProducts.length}
        colors={availableOptions.colors}
        sizes={availableOptions.sizes}
        products={state.products}
      />

      {/* Search Overlay */}
      <SearchOverlay
        visible={showSearchOverlay}
        onClose={() => setShowSearchOverlay(false)}
        products={state.products}
        onProductPress={(productId: string) => {
          const product = state.products.find(p => p._id === productId || p.id === productId);
          if (product) handleProductPress(product);
        }}
        activeFilters={filters}
        onSearchComplete={handleSearchComplete}
        onApplyFilters={handleApplyFilters}
        availableBrands={availableOptions.brands}
        priceRange={availableOptions.priceRange}
        availableColors={availableOptions.colors}
        availableSizes={availableOptions.sizes}
        totalProducts={filteredProducts.length}
        onSortChange={handleSortChange}
      />

      {/* Sort Modal */}
      {renderSortModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  loadingText: {
    fontSize: isTablet ? 18 : 16,
    color: '#666',
    marginTop: 12,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  errorTitle: {
    fontSize: isTablet ? 24 : 20,
    fontWeight: '700',
    color: '#ff3f6c',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: isTablet ? 18 : 16,
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: '#ff3f6c',
    paddingVertical: isTablet ? 16 : 12,
    paddingHorizontal: isTablet ? 40 : 32,
    borderRadius: 30,
    elevation: 2,
    shadowColor: '#ff3f6c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: isTablet ? 18 : 16,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: isTablet ? 24 : 16,
    paddingVertical: isTablet ? 16 : 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  headerTitle: {
    flex: 1,
    marginHorizontal: 8,
  },
  brandName: {
    fontSize: isTablet ? 26 : 22,
    fontWeight: '700',
    color: '#333',
    textTransform: 'capitalize',
  },
  productCount: {
    color: '#666',
    fontSize: isTablet ? 16 : 14,
    marginTop: 4,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: isTablet ? 24 : 16,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  controlsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  filterButtonActive: {
    backgroundColor: '#ff3f6c',
    borderColor: '#ff3f6c',
  },
  filterButtonText: {
    fontSize: isTablet ? 14 : 12,
    color: '#333',
    fontWeight: '500',
    marginLeft: 6,
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sortButtonText: {
    fontSize: isTablet ? 14 : 12,
    color: '#333',
    fontWeight: '500',
    marginLeft: 6,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  resetButtonText: {
    fontSize: 12,
    color: '#ff3f6c',
    fontWeight: '500',
    marginLeft: 4,
  },
  layoutToggleButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  productsList: {
    paddingHorizontal: isTablet ? 20 : 16,
    paddingVertical: isTablet ? 16 : 12,
    backgroundColor: '#f8f9fa',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: isTablet ? 22 : 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: isTablet ? 16 : 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  exploreButton: {
    backgroundColor: '#ff3f6c',
    paddingVertical: isTablet ? 14 : 12,
    paddingHorizontal: isTablet ? 32 : 24,
    borderRadius: 25,
  },
  exploreButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: isTablet ? 16 : 14,
  },
  // Product card styles
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  productCardGrid: {
    width: (screenWidth - (isTablet ? 60 : 48)) / 2,
    marginHorizontal: (isTablet ? 4 : 2),
  },
  productCardList: {
    width: '100%',
    flexDirection: 'row',
  },
  productImage: {
    width: '100%',
    height: isTablet ? 200 : 160,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: '#f8f9fa',
  },
  productImageList: {
    width: isTablet ? 120 : 100,
    height: isTablet ? 120 : 100,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    backgroundColor: '#f8f9fa',
  },
  productDetails: {
    padding: isTablet ? 16 : 12,
  },
  productDetailsGrid: {
    flex: 1,
  },
  productBrand: {
    fontSize: isTablet ? 14 : 12,
    color: '#ff3f6c',
    fontWeight: '500',
    marginBottom: 4,
  },
  productName: {
    fontSize: isTablet ? 16 : 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  productPriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  productPrice: {
    fontSize: isTablet ? 18 : 16,
    fontWeight: '700',
    color: '#333',
    marginRight: 8,
  },
  productOriginalPrice: {
    fontSize: isTablet ? 14 : 12,
    color: '#999',
    textDecorationLine: 'line-through',
    marginRight: 8,
  },
  productDiscount: {
    fontSize: isTablet ? 12 : 10,
    color: '#4caf50',
    fontWeight: '600',
  },
  productRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: isTablet ? 12 : 10,
    color: '#666',
    marginLeft: 4,
  },
  productActions: {
    flexDirection: 'row',
    paddingHorizontal: isTablet ? 16 : 12,
    paddingBottom: isTablet ? 16 : 12,
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ff3f6c',
    backgroundColor: '#fff',
  },
  actionButtonActive: {
    backgroundColor: '#ff3f6c',
  },
  // Sort modal styles
  sortModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortModalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    minWidth: 200,
    maxWidth: 280,
    marginHorizontal: 20,
  },
  sortModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  sortOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  sortOptionActive: {
    backgroundColor: '#ff3f6c',
  },
  sortOptionText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  sortOptionTextActive: {
    color: '#fff',
  },
  sortOptionIcon: {
    fontSize: 16,
  },
});
