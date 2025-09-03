import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet, Dimensions } from 'react-native';
import { Eye, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Product } from '@/types/product';

const { width: screenWidth } = Dimensions.get('window');

interface RecentlyViewedCarouselProps {
  products: Product[];
  onWishlistPress?: (productId: string) => void;
}

export const RecentlyViewedCarousel: React.FC<RecentlyViewedCarouselProps> = ({
  products,
  onWishlistPress
}) => {
  const router = useRouter();

  if (products.length === 0) return null;

  const handleProductPress = (productId: string) => {
    router.push(`/product/${productId}`);
  };

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleContainer}>
          <Eye size={20} color="#ff3f6c" />
          <Text style={styles.sectionTitle}>RECENTLY VIEWED</Text>
        </View>
        <TouchableOpacity style={styles.viewAll}>
          <Text style={styles.viewAllText}>View All</Text>
          <ChevronRight size={16} color="#ff3f6c" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
      >
        {products.map((product) => (
          <TouchableOpacity
            key={product._id}
            style={styles.productCard}
            onPress={() => handleProductPress(product._id)}
            activeOpacity={0.8}
          >
            <Image
              source={{ uri: product.images?.[0] }}
              style={styles.productImage}
              resizeMode="cover"
            />
            
            <View style={styles.productInfo}>
              <Text style={styles.brandName} numberOfLines={1}>
                {product.brand}
              </Text>
              <Text style={styles.productName} numberOfLines={2}>
                {product.name}
              </Text>
              <Text style={styles.price}>₹{product.price}</Text>
              {product.rating && (
                <Text style={styles.rating}>⭐ {product.rating.toFixed(1)}</Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    backgroundColor: '#fff',
    paddingVertical: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginLeft: 8,
    letterSpacing: 0.5,
  },
  viewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  viewAllText: {
    fontSize: 12,
    color: '#ff3f6c',
    fontWeight: '600',
    marginRight: 4,
  },
  scrollContainer: {
    paddingLeft: 16,
    paddingRight: 8,
  },
  productCard: {
    width: 160,
    marginRight: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  productImage: {
    width: '100%',
    height: 200,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: '#f8fafc',
  },
  productInfo: {
    padding: 12,
  },
  brandName: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  productName: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 6,
  },
  price: {
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '700',
    marginBottom: 4,
  },
  rating: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
});
