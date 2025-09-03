import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  Dimensions,
  Animated,
  FlatList,
  Switch,
} from 'react-native';
import {
  X,
  Filter,
  Search,
  Star,
  Check,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Tag,
  Palette,
  Ruler,
  TrendingUp,
  DollarSign,
} from 'lucide-react-native';

import {
  FilterState,
  Product,
  Category,
  PriceRange,
  PRICE_RANGES,
  SORT_OPTIONS,
  QUICK_FILTERS,
  FilterQuickAction,
  SortOption,
  getActiveFiltersCount,
  resetFilters,
  applyQuickFilter,
  getSortLabel,
} from '@/types/product';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isTablet = screenWidth >= 768;

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: FilterState) => void;
  currentFilters: FilterState;
  categories?: Category[];
  brands?: string[];
  priceRange?: PriceRange;
  totalProducts?: number;
  colors?: string[];
  sizes?: string[];
  products?: Product[]; // For extracting filter options
}

interface FilterSectionProps {
  title: string;
  icon: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  badge?: number;
}

const FilterSection: React.FC<FilterSectionProps> = ({
  title,
  icon,
  isExpanded,
  onToggle,
  children,
  badge,
}) => (
  <View style={styles.filterSection}>
    <TouchableOpacity
      style={styles.filterSectionHeader}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View style={styles.filterSectionTitle}>
        {icon}
        <Text style={styles.filterSectionText}>{title}</Text>
        {badge !== undefined && badge > 0 && (
          <View style={styles.filterBadge}>
            <Text style={styles.filterBadgeText}>{badge}</Text>
          </View>
        )}
      </View>
      {isExpanded ? (
        <ChevronUp size={20} color="#666" />
      ) : (
        <ChevronDown size={20} color="#666" />
      )}
    </TouchableOpacity>
    {isExpanded && <View style={styles.filterSectionContent}>{children}</View>}
  </View>
);

const FilterModal: React.FC<FilterModalProps> = ({
  visible,
  onClose,
  onApply,
  currentFilters,
  categories = [],
  brands = [],
  priceRange,
  totalProducts = 0,
  colors = [],
  sizes = [],
  products = [],
}) => {
  const [filters, setFilters] = useState<FilterState>(currentFilters);
  const [searchBrand, setSearchBrand] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    quickFilters: true,
    price: false,
    brands: false,
    rating: false,
    colors: false,
    sizes: false,
    sort: false,
    special: false,
  });

  const [fadeAnim] = useState(new Animated.Value(0));

  // Update filters when currentFilters change
  useEffect(() => {
    setFilters(currentFilters);
  }, [currentFilters]);

  // Animation for modal
  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  // Extract available options from products
  const availableOptions = useMemo(() => {
    const extractedBrands = new Set<string>();
    const extractedColors = new Set<string>();
    const extractedSizes = new Set<string>();
    let minPrice = Infinity;
    let maxPrice = 0;

    products.forEach(product => {
      if (product.brand) extractedBrands.add(product.brand);
      if (product.colors) product.colors.forEach(color => extractedColors.add(color));
      if (product.sizes) product.sizes.forEach(size => extractedSizes.add(size));
      if (product.price < minPrice) minPrice = product.price;
      if (product.price > maxPrice) maxPrice = product.price;
    });

    return {
      brands: Array.from(extractedBrands).sort(),
      colors: Array.from(extractedColors).sort(),
      sizes: Array.from(extractedSizes).sort(),
      priceRange: { min: minPrice === Infinity ? 0 : minPrice, max: maxPrice },
    };
  }, [products]);

  // Use provided options or extracted options
  const finalBrands = brands.length > 0 ? brands : availableOptions.brands;
  const finalColors = colors.length > 0 ? colors : availableOptions.colors;
  const finalSizes = sizes.length > 0 ? sizes : availableOptions.sizes;
  const finalPriceRange = priceRange || availableOptions.priceRange;

  // Filtered brands based on search
  const filteredBrands = useMemo(() => {
    if (!searchBrand.trim()) return finalBrands;
    return finalBrands.filter(brand =>
      brand.toLowerCase().includes(searchBrand.toLowerCase())
    );
  }, [finalBrands, searchBrand]);

  // Count active filters per section
  const sectionBadges = useMemo(() => {
    return {
      price: (filters.priceMin || filters.priceMax) ? 1 : 0,
      brands: filters.brands?.length || 0,
      rating: filters.rating ? 1 : 0,
      colors: filters.colors?.length || 0,
      sizes: filters.sizes?.length || 0,
      sort: (filters.sortBy && filters.sortBy !== 'relevance') ? 1 : 0,
      special: (filters.isNew ? 1 : 0) + (filters.isBestseller ? 1 : 0) + (filters.inStock ? 1 : 0) + (filters.discount ? 1 : 0),
    };
  }, [filters]);

  const totalActiveFilters = getActiveFiltersCount(filters);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const toggleArrayFilter = (
    key: 'brands' | 'colors' | 'sizes',
    value: string,
    currentArray: string[] | undefined
  ) => {
    const array = currentArray || [];
    const newArray = array.includes(value)
      ? array.filter(item => item !== value)
      : [...array, value];
    
    updateFilter(key, newArray.length > 0 ? newArray : undefined);
  };

  const handleQuickFilter = (quickFilter: FilterQuickAction) => {
    const newFilters = applyQuickFilter(filters, quickFilter);
    setFilters(newFilters);
  };

  const handleReset = () => {
    setFilters(resetFilters());
    setSearchBrand('');
  };

  const handleApply = () => {
    onApply(filters);
    onClose();
  };

  const renderQuickFilters = () => (
    <View style={styles.quickFiltersContainer}>
      {QUICK_FILTERS.map(quickFilter => {
        const isActive = Object.entries(quickFilter.filters).every(([key, value]) => {
          const filterKey = key as keyof FilterState;
          return filters[filterKey] === value;
        });

        return (
          <TouchableOpacity
            key={quickFilter.id}
            style={[styles.quickFilterChip, isActive && styles.quickFilterChipActive]}
            onPress={() => handleQuickFilter(quickFilter)}
            activeOpacity={0.7}
          >
            <Text style={styles.quickFilterIcon}>{quickFilter.icon}</Text>
            <Text style={[styles.quickFilterText, isActive && styles.quickFilterTextActive]}>
              {quickFilter.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderPriceFilter = () => (
    <View style={styles.priceContainer}>
      <Text style={styles.subSectionTitle}>Price Range</Text>
      <View style={styles.priceRangeContainer}>
        {PRICE_RANGES.map((range, index) => {
          const isSelected = 
            (filters.priceMin === range.min || (range.min === 0 && !filters.priceMin)) &&
            (filters.priceMax === range.max || (range.max === Infinity && !filters.priceMax));

          return (
            <TouchableOpacity
              key={index}
              style={[styles.priceRangeChip, isSelected && styles.priceRangeChipActive]}
              onPress={() => {
                updateFilter('priceMin', range.min === 0 ? undefined : range.min);
                updateFilter('priceMax', range.max === Infinity ? undefined : range.max);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.priceRangeText, isSelected && styles.priceRangeTextActive]}>
                {range.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.customPriceContainer}>
        <Text style={styles.customPriceLabel}>Custom Range</Text>
        <View style={styles.customPriceInputs}>
          <TextInput
            style={styles.priceInput}
            placeholder="Min"
            placeholderTextColor="#999"
            value={filters.priceMin?.toString() || ''}
            onChangeText={(text) => {
              const value = parseInt(text) || undefined;
              updateFilter('priceMin', value);
            }}
            keyboardType="numeric"
          />
          <Text style={styles.priceSeparator}>to</Text>
          <TextInput
            style={styles.priceInput}
            placeholder="Max"
            placeholderTextColor="#999"
            value={filters.priceMax?.toString() || ''}
            onChangeText={(text) => {
              const value = parseInt(text) || undefined;
              updateFilter('priceMax', value);
            }}
            keyboardType="numeric"
          />
        </View>
      </View>
    </View>
  );

  const renderBrandFilter = () => (
    <View style={styles.brandContainer}>
      <View style={styles.brandSearchContainer}>
        <Search size={16} color="#666" />
        <TextInput
          style={styles.brandSearchInput}
          placeholder="Search brands..."
          placeholderTextColor="#999"
          value={searchBrand}
          onChangeText={setSearchBrand}
        />
      </View>
      
      <FlatList
        data={filteredBrands}
        keyExtractor={(item) => item}
        renderItem={({ item }) => {
          const isSelected = filters.brands?.includes(item) || false;
          return (
            <TouchableOpacity
              style={styles.brandItem}
              onPress={() => toggleArrayFilter('brands', item, filters.brands)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                {isSelected && <Check size={14} color="#fff" />}
              </View>
              <Text style={styles.brandText}>{item}</Text>
            </TouchableOpacity>
          );
        }}
        style={styles.brandList}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      />
    </View>
  );

  const renderRatingFilter = () => (
    <View style={styles.ratingContainer}>
      {[4, 3, 2, 1].map(rating => {
        const isSelected = filters.rating === rating;
        return (
          <TouchableOpacity
            key={rating}
            style={[styles.ratingItem, isSelected && styles.ratingItemActive]}
            onPress={() => updateFilter('rating', isSelected ? undefined : rating)}
            activeOpacity={0.7}
          >
            <View style={styles.ratingStars}>
              {[1, 2, 3, 4, 5].map(star => (
                <Star
                  key={star}
                  size={16}
                  color={star <= rating ? '#ffb400' : '#ddd'}
                  fill={star <= rating ? '#ffb400' : 'none'}
                />
              ))}
            </View>
            <Text style={styles.ratingText}>{rating}+ stars</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderColorFilter = () => (
    <View style={styles.colorContainer}>
      <FlatList
        data={finalColors}
        keyExtractor={(item) => item}
        numColumns={4}
        renderItem={({ item }) => {
          const isSelected = filters.colors?.includes(item) || false;
          return (
            <TouchableOpacity
              style={[styles.colorChip, isSelected && styles.colorChipActive]}
              onPress={() => toggleArrayFilter('colors', item, filters.colors)}
              activeOpacity={0.7}
            >
              <Text style={[styles.colorText, isSelected && styles.colorTextActive]}>
                {item}
              </Text>
            </TouchableOpacity>
          );
        }}
        nestedScrollEnabled
      />
    </View>
  );

  const renderSizeFilter = () => (
    <View style={styles.sizeContainer}>
      <FlatList
        data={finalSizes}
        keyExtractor={(item) => item}
        numColumns={4}
        renderItem={({ item }) => {
          const isSelected = filters.sizes?.includes(item) || false;
          return (
            <TouchableOpacity
              style={[styles.sizeChip, isSelected && styles.sizeChipActive]}
              onPress={() => toggleArrayFilter('sizes', item, filters.sizes)}
              activeOpacity={0.7}
            >
              <Text style={[styles.sizeText, isSelected && styles.sizeTextActive]}>
                {item}
              </Text>
            </TouchableOpacity>
          );
        }}
        nestedScrollEnabled
      />
    </View>
  );

  const renderSortFilter = () => (
    <View style={styles.sortContainer}>
      {SORT_OPTIONS.map(option => {
        const isSelected = filters.sortBy === option.value;
        return (
          <TouchableOpacity
            key={option.value}
            style={[styles.sortItem, isSelected && styles.sortItemActive]}
            onPress={() => updateFilter('sortBy', option.value)}
            activeOpacity={0.7}
          >
            <View style={[styles.radioButton, isSelected && styles.radioButtonActive]}>
              {isSelected && <View style={styles.radioButtonInner} />}
            </View>
            <Text style={styles.sortLabel}>{option.label}</Text>
            {option.icon && <Text style={styles.sortIcon}>{option.icon}</Text>}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderSpecialFilter = () => (
    <View style={styles.specialContainer}>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>New Arrivals</Text>
        <Switch
          value={filters.isNew || false}
          onValueChange={(value) => updateFilter('isNew', value || undefined)}
          trackColor={{ false: '#ddd', true: '#ff3f6c' }}
          thumbColor="#fff"
        />
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Bestsellers</Text>
        <Switch
          value={filters.isBestseller || false}
          onValueChange={(value) => updateFilter('isBestseller', value || undefined)}
          trackColor={{ false: '#ddd', true: '#ff3f6c' }}
          thumbColor="#fff"
        />
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>In Stock Only</Text>
        <Switch
          value={filters.inStock || false}
          onValueChange={(value) => updateFilter('inStock', value || undefined)}
          trackColor={{ false: '#ddd', true: '#ff3f6c' }}
          thumbColor="#fff"
        />
      </View>

      <View style={styles.discountContainer}>
        <Text style={styles.discountLabel}>Minimum Discount</Text>
        <View style={styles.discountOptions}>
          {[10, 20, 30, 50].map(discount => {
            const isSelected = filters.discount === discount;
            return (
              <TouchableOpacity
                key={discount}
                style={[styles.discountChip, isSelected && styles.discountChipActive]}
                onPress={() => updateFilter('discount', isSelected ? undefined : discount)}
                activeOpacity={0.7}
              >
                <Text style={[styles.discountText, isSelected && styles.discountTextActive]}>
                  {discount}%+
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        
        <Animated.View
          style={[
            styles.modal,
            {
              opacity: fadeAnim,
              transform: [
                {
                  translateY: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [screenHeight, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Filter size={24} color="#333" />
              <Text style={styles.headerTitle}>Filters</Text>
              {totalActiveFilters > 0 && (
                <View style={styles.headerBadge}>
                  <Text style={styles.headerBadgeText}>{totalActiveFilters}</Text>
                </View>
              )}
            </View>
            
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.resetButton}
                onPress={handleReset}
                activeOpacity={0.7}
              >
                <RotateCcw size={18} color="#ff3f6c" />
                <Text style={styles.resetButtonText}>Reset</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <X size={24} color="#333" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Content */}
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Quick Filters */}
            <FilterSection
              title="Quick Filters"
              icon={<TrendingUp size={20} color="#ff3f6c" />}
              isExpanded={expandedSections.quickFilters}
              onToggle={() => toggleSection('quickFilters')}
            >
              {renderQuickFilters()}
            </FilterSection>

            {/* Sort */}
            <FilterSection
              title="Sort By"
              icon={<TrendingUp size={20} color="#666" />}
              isExpanded={expandedSections.sort}
              onToggle={() => toggleSection('sort')}
              badge={sectionBadges.sort}
            >
              {renderSortFilter()}
            </FilterSection>

            {/* Price */}
            <FilterSection
              title="Price Range"
              icon={<DollarSign size={20} color="#666" />}
              isExpanded={expandedSections.price}
              onToggle={() => toggleSection('price')}
              badge={sectionBadges.price}
            >
              {renderPriceFilter()}
            </FilterSection>

            {/* Brands */}
            {finalBrands.length > 0 && (
              <FilterSection
                title="Brands"
                icon={<Tag size={20} color="#666" />}
                isExpanded={expandedSections.brands}
                onToggle={() => toggleSection('brands')}
                badge={sectionBadges.brands}
              >
                {renderBrandFilter()}
              </FilterSection>
            )}

            {/* Rating */}
            <FilterSection
              title="Customer Rating"
              icon={<Star size={20} color="#666" />}
              isExpanded={expandedSections.rating}
              onToggle={() => toggleSection('rating')}
              badge={sectionBadges.rating}
            >
              {renderRatingFilter()}
            </FilterSection>

            {/* Colors */}
            {finalColors.length > 0 && (
              <FilterSection
                title="Colors"
                icon={<Palette size={20} color="#666" />}
                isExpanded={expandedSections.colors}
                onToggle={() => toggleSection('colors')}
                badge={sectionBadges.colors}
              >
                {renderColorFilter()}
              </FilterSection>
            )}

            {/* Sizes */}
            {finalSizes.length > 0 && (
              <FilterSection
                title="Sizes"
                icon={<Ruler size={20} color="#666" />}
                isExpanded={expandedSections.sizes}
                onToggle={() => toggleSection('sizes')}
                badge={sectionBadges.sizes}
              >
                {renderSizeFilter()}
              </FilterSection>
            )}

            {/* Special Filters */}
            <FilterSection
              title="Special Filters"
              icon={<Filter size={20} color="#666" />}
              isExpanded={expandedSections.special}
              onToggle={() => toggleSection('special')}
              badge={sectionBadges.special}
            >
              {renderSpecialFilter()}
            </FilterSection>

            <View style={{ height: 100 }} />
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <View style={styles.footerInfo}>
              <Text style={styles.resultCount}>
                {totalProducts} product{totalProducts !== 1 ? 's' : ''} found
              </Text>
              {totalActiveFilters > 0 && (
                <Text style={styles.filterCount}>
                  {totalActiveFilters} filter{totalActiveFilters !== 1 ? 's' : ''} applied
                </Text>
              )}
            </View>
            
            <TouchableOpacity
              style={styles.applyButton}
              onPress={handleApply}
              activeOpacity={0.8}
            >
              <Text style={styles.applyButtonText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: screenHeight * 0.9,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: isTablet ? 24 : 20,
    paddingVertical: isTablet ? 20 : 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: isTablet ? 22 : 20,
    fontWeight: '700',
    color: '#333',
    marginLeft: 12,
  },
  headerBadge: {
    backgroundColor: '#ff3f6c',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  headerBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f8f9fa',
    marginRight: 12,
  },
  resetButtonText: {
    color: '#ff3f6c',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: isTablet ? 24 : 20,
  },
  filterSection: {
    marginVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  filterSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  filterSectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  filterSectionText: {
    fontSize: isTablet ? 18 : 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
  },
  filterBadge: {
    backgroundColor: '#ff3f6c',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  filterSectionContent: {
    paddingBottom: 16,
  },
  
  // Quick Filters
  quickFiltersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  quickFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  quickFilterChipActive: {
    backgroundColor: '#ff3f6c',
    borderColor: '#ff3f6c',
  },
  quickFilterIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  quickFilterText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  quickFilterTextActive: {
    color: '#fff',
  },

  // Price Filter
  priceContainer: {},
  subSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  priceRangeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  priceRangeChip: {
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  priceRangeChipActive: {
    backgroundColor: '#ff3f6c',
    borderColor: '#ff3f6c',
  },
  priceRangeText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  priceRangeTextActive: {
    color: '#fff',
  },
  customPriceContainer: {
    marginTop: 8,
  },
  customPriceLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  customPriceInputs: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',
  },
  priceSeparator: {
    marginHorizontal: 12,
    fontSize: 14,
    color: '#666',
  },

  // Brand Filter
  brandContainer: {},
  brandSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  brandSearchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingLeft: 8,
    fontSize: 16,
    color: '#333',
  },
  brandList: {
    maxHeight: 200,
  },
  brandItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 4,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: '#ff3f6c',
    borderColor: '#ff3f6c',
  },
  brandText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },

  // Rating Filter
  ratingContainer: {},
  ratingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f8f9fa',
  },
  ratingItemActive: {
    backgroundColor: '#ff3f6c',
  },
  ratingStars: {
    flexDirection: 'row',
    marginRight: 8,
  },
  ratingText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },

  // Color Filter
  colorContainer: {},
  colorChip: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingVertical: 10,
    marginHorizontal: 4,
    marginVertical: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  colorChipActive: {
    backgroundColor: '#ff3f6c',
    borderColor: '#ff3f6c',
  },
  colorText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  colorTextActive: {
    color: '#fff',
  },

  // Size Filter
  sizeContainer: {},
  sizeChip: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingVertical: 10,
    marginHorizontal: 4,
    marginVertical: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  sizeChipActive: {
    backgroundColor: '#ff3f6c',
    borderColor: '#ff3f6c',
  },
  sizeText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  sizeTextActive: {
    color: '#fff',
  },

  // Sort Filter
  sortContainer: {},
  sortItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f8f9fa',
  },
  sortItemActive: {
    backgroundColor: '#ff3f6c',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ddd',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonActive: {
    borderColor: '#fff',
  },
  radioButtonInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  sortLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    flex: 1,
  },
  sortIcon: {
    fontSize: 16,
  },

  // Special Filter
  specialContainer: {},
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  switchLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  discountContainer: {
    marginTop: 16,
  },
  discountLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  discountOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  discountChip: {
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  discountChipActive: {
    backgroundColor: '#ff3f6c',
    borderColor: '#ff3f6c',
  },
  discountText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  discountTextActive: {
    color: '#fff',
  },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: isTablet ? 24 : 20,
    paddingVertical: isTablet ? 20 : 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  footerInfo: {
    flex: 1,
  },
  resultCount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  filterCount: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  applyButton: {
    backgroundColor: '#ff3f6c',
    borderRadius: 25,
    paddingHorizontal: isTablet ? 32 : 24,
    paddingVertical: isTablet ? 16 : 12,
    elevation: 2,
    shadowColor: '#ff3f6c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  applyButtonText: {
    color: '#fff',
    fontSize: isTablet ? 18 : 16,
    fontWeight: '700',
  },
});

export default FilterModal;
