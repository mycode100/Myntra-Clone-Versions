import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Modal,
  Pressable,
  Dimensions,
  ActivityIndicator,
  StyleSheet as RNStyleSheet,
} from "react-native";
import { Address } from "@/types/product";
import { useAuth } from "@/context/AuthContext";
import {
  X,
  ChevronDown,
  ChevronUp,
  MapPin,
  Plus,
  Home,
  Edit2,
  Trash2,
  Star,
  MoreVertical,
} from "lucide-react-native";
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

interface AddressSelectionOverlayProps {
  visible: boolean;
  onClose: () => void;
  onSelectAddress: (addressId: string) => void;
  onAddNewAddress: () => void;
  onEditAddress: (address: Address) => void;
  selectedAddressId?: string | null;
}

const AddressSelectionOverlay: React.FC<AddressSelectionOverlayProps> = ({
  visible,
  onClose,
  onSelectAddress,
  onAddNewAddress,
  onEditAddress,
  selectedAddressId,
}) => {
  const {
    user,
    addresses,
    defaultAddressId,
    isRefreshingPreferences,
    refreshUserPreferences,
    setDefaultAddressWithSync,
    deleteAddressWithSync,
    isDeletingAddress,
    isSettingDefaultAddress
  } = useAuth();

  const [expanded, setExpanded] = useState(false);
  const [showActionsFor, setShowActionsFor] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  // ✅ ADD: Custom confirmation modal state
  const [confirmationModal, setConfirmationModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
  }>({
    visible: false,
    title: "",
    message: "",
    onConfirm: () => {},
    onCancel: () => {}
  });

  console.log("🔍 DEBUG: AddressSelectionOverlay render", {
    visible,
    addressCount: addresses.size,
    showActionsFor,
    isDeletingAddress: Array.from(isDeletingAddress),
    isSettingDefaultAddress
  });

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setIsOnline(state.isConnected ?? true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!visible) {
      setExpanded(false);
      setShowActionsFor(null);
      setConfirmationModal(prev => ({ ...prev, visible: false }));
    }
  }, [visible]);

  const addressArray = useMemo(() => {
    return Array.from(addresses.values()).sort((a, b) => {
      if (a.isDefault) return -1;
      if (b.isDefault) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [addresses]);

  const formatAddress = (address: Address): string => {
    const parts = [
      address.addressLine1,
      address.addressLine2,
      address.landmark,
      address.city,
      address.state,
      address.pincode,
    ].filter(Boolean);
    return parts.join(", ");
  };

  const handleAddressPress = async (address: Address) => {
    console.log("🔍 DEBUG: handleAddressPress called", { addressId: address._id, addressName: address.name });

    if (!user?._id) {
      setConfirmationModal({
        visible: true,
        title: "Authentication Error",
        message: "Please log in to continue.",
        onConfirm: () => setConfirmationModal(prev => ({...prev, visible: false}))
      });
      return;
    }

    if (!isOnline) {
      setConfirmationModal({
        visible: true,
        title: "No Internet Connection",
        message: "Please check your network connection and try again.",
        onConfirm: () => setConfirmationModal(prev => ({...prev, visible: false}))
      });
      return;
    }

    if (address.isDefault) {
      console.log("🔍 DEBUG: Address is already default, selecting and closing");
      onSelectAddress(address._id!);
      onClose();
    } else {
      try {
        console.log("🔍 DEBUG: Setting address as default...");
        const result = await setDefaultAddressWithSync(address._id!);

        if (result.success) {
          onSelectAddress(address._id!);
          onClose();
          setConfirmationModal({
            visible: true,
            title: "Success! ⭐",
            message: `${address.name} is now your default address`,
            onConfirm: () => setConfirmationModal(prev => ({...prev, visible: false}))
          });
        } else {
          const errorMessage = result.message || "Failed to set as default address";
          setConfirmationModal({
            visible: true,
            title: "Error",
            message: errorMessage,
            onConfirm: () => setConfirmationModal(prev => ({...prev, visible: false}))
          });
        }
      } catch (error: any) {
        console.error("Error setting default address:", error);
        setConfirmationModal({
          visible: true,
          title: "Error",
          message: "Failed to set as default address. Please try again.",
          onConfirm: () => setConfirmationModal(prev => ({...prev, visible: false}))
        });
      }
    }
  };

  // ✅ FIXED: Complete rewrite with custom modal - fixes mapping issue
  const handleDeleteAddress = (address: Address) => {
    console.log("🚀 DEBUG: handleDeleteAddress TRIGGERED!", {
      addressId: address._id,
      addressName: address.name,
      userId: user?._id,
      isOnline,
      timestamp: new Date().toISOString()
    });

    if (!user?._id) {
      console.log("❌ DEBUG: No user ID found");
      setConfirmationModal({
        visible: true,
        title: "Authentication Error",
        message: "Please log in to delete addresses.",
        onConfirm: () => setConfirmationModal(prev => ({...prev, visible: false}))
      });
      return;
    }

    if (!address._id) {
      console.log("❌ DEBUG: No address ID found");
      setConfirmationModal({
        visible: true,
        title: "Error",
        message: "Invalid address. Please refresh and try again.",
        onConfirm: () => setConfirmationModal(prev => ({...prev, visible: false}))
      });
      return;
    }

    if (!isOnline) {
      console.log("❌ DEBUG: Not online");
      setConfirmationModal({
        visible: true,
        title: "No Internet Connection",
        message: "Please check your network connection and try again.",
        onConfirm: () => setConfirmationModal(prev => ({...prev, visible: false}))
      });
      return;
    }

    console.log("✅ DEBUG: All validations passed, showing CUSTOM confirmation dialog");

    // ✅ FIXED: Use custom modal instead of Alert.alert
    setConfirmationModal({
      visible: true,
      title: "Delete Address",
      message: `Are you sure you want to delete "${address.name}"?\n\n${formatAddress(address)}\n\nThis action cannot be undone.`,
      onConfirm: async () => {
        console.log("🗑️ DEBUG: User confirmed delete, executing...");
        setConfirmationModal(prev => ({...prev, visible: false}));
        
        try {
          const result = await deleteAddressWithSync(address._id!);
          
          console.log("📝 DEBUG: Delete result:", { 
            success: result.success, 
            message: result.message 
          });

          if (result.success) {
            setConfirmationModal({
              visible: true,
              title: "Address Deleted! 🗑️",
              message: `"${address.name}" has been successfully removed from your addresses.`,
              onConfirm: () => {
                setConfirmationModal(prev => ({...prev, visible: false}));
                console.log("✅ DEBUG: Delete success, checking if should close overlay");
                if (addressArray.length <= 1) {
                  console.log("🚪 DEBUG: No addresses left, closing overlay");
                  onClose();
                }
              }
            });
          } else {
            console.log("❌ DEBUG: Delete failed:", result.message);
            const errorMessage = result.message || "Failed to delete address";
            setConfirmationModal({
              visible: true,
              title: "Delete Failed",
              message: errorMessage,
              onConfirm: () => setConfirmationModal(prev => ({...prev, visible: false}))
            });
          }
        } catch (error: any) {
          console.error("❌ DEBUG: Delete exception:", error);
          setConfirmationModal({
            visible: true,
            title: "Error",
            message: "An unexpected error occurred. Please try again.",
            onConfirm: () => setConfirmationModal(prev => ({...prev, visible: false}))
          });
        }
      },
      onCancel: () => {
        console.log("🚫 DEBUG: User cancelled delete");
        setConfirmationModal(prev => ({...prev, visible: false}));
      }
    });
  };

  const toggleActions = (addressId: string) => {
    console.log("🔍 DEBUG: toggleActions called", { addressId, currentShowActionsFor: showActionsFor });
    setShowActionsFor(showActionsFor === addressId ? null : addressId);
  };

  const renderAddressItem = ({ item, index }: { item: Address; index: number }) => {
    const isSelected = selectedAddressId === item._id || defaultAddressId === item._id;
    const isSettingThisDefault = isSettingDefaultAddress;
    const isDeleting = isDeletingAddress.has(item._id!);
    const showActions = showActionsFor === item._id;

    console.log("🔍 DEBUG: renderAddressItem", {
      addressId: item._id,
      addressName: item.name,
      isDeleting,
      showActions,
      isSettingThisDefault
    });

    return (
      <View
        style={[
          styles.addressItem,
          isSelected && styles.selectedAddress,
          index === addressArray.length - 1 && styles.lastAddressItem,
          showActions && styles.addressItemExpanded,
        ]}
      >
        <TouchableOpacity
          onPress={() => handleAddressPress(item)}
          activeOpacity={0.7}
          disabled={isDeleting || isSettingThisDefault}
          style={styles.addressContent}
        >
          <View style={styles.addressHeader}>
            <View style={styles.addressTitleContainer}>
              <Home size={16} color="#666" />
              <Text
                style={styles.addressName}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {item.name}
              </Text>
              {item.isDefault && (
                <View style={styles.defaultBadge}>
                  <Star size={10} color="#fff" fill="#fff" />
                  <Text style={styles.defaultBadgeText}>DEFAULT</Text>
                </View>
              )}
            </View>

            {isSettingThisDefault && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#ff3f6c" />
                <Text style={styles.loadingText}>Setting default...</Text>
              </View>
            )}
          </View>

          <View style={styles.addressDetails}>
            <View style={styles.addressRow}>
              <MapPin size={14} color="#999" />
              <Text style={styles.addressText} numberOfLines={2}>
                {formatAddress(item)}
              </Text>
            </View>
            <Text style={styles.addressPhone}>📞 {item.phone}</Text>
          </View>

          {!item.isDefault && !isSettingThisDefault && (
            <Text style={styles.tapToSetDefaultText}>
              Tap to set as default address
            </Text>
          )}
        </TouchableOpacity>

        {isDeleting && (
          <View style={styles.deletingOverlay}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.deletingText}>Deleting...</Text>
          </View>
        )}

        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.actionsButton}
            onPress={() => {
              console.log("🔍 DEBUG: Actions button pressed for:", item._id);
              toggleActions(item._id!);
            }}
            disabled={isDeleting}
            accessible
            accessibilityLabel="Address options"
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color="#ff3f6c" />
            ) : (
              <MoreVertical size={18} color="#666" />
            )}
          </TouchableOpacity>

          {showActions && !isDeleting && (
            <View style={styles.actionsMenu}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  console.log("🔍 DEBUG: Edit button pressed");
                  setShowActionsFor(null);
                  onEditAddress(item);
                }}
                accessible
                accessibilityLabel="Edit address"
              >
                <Edit2 size={16} color="#2196f3" />
                <Text style={[styles.actionButtonText, { color: "#2196f3" }]}>
                  Edit
                </Text>
              </TouchableOpacity>

              {/* ✅ FIXED: Pass the correct item directly */}
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  console.log("🚀 DEBUG: DELETE BUTTON PRESSED!", { 
                    addressId: item._id, 
                    addressName: item.name 
                  });
                  setShowActionsFor(null);
                  handleDeleteAddress(item); // ✅ Pass item directly
                }}
                accessible
                accessibilityLabel="Delete address"
              >
                <Trash2 size={16} color="#f44336" />
                <Text style={[styles.actionButtonText, { color: "#f44336" }]}>
                  Delete
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  const EmptyAddressState = () => (
    <View style={styles.emptyContainer}>
      <MapPin size={48} color="#ccc" />
      <Text style={styles.emptyTitle}>No Addresses Found</Text>
      <Text style={styles.emptySubtitle}>
        Add your first delivery address to get started
      </Text>
      <TouchableOpacity
        style={styles.addFirstAddressButton}
        onPress={() => {
          onClose();
          onAddNewAddress();
        }}
        activeOpacity={0.8}
      >
        <Plus size={20} color="#fff" />
        <Text style={styles.addFirstAddressText}>Add Address</Text>
      </TouchableOpacity>
    </View>
  );

  const NetworkStatusBar = () => {
    if (isOnline) return null;
    
    return (
      <View style={styles.networkStatusBar}>
        <Text style={styles.networkStatusText}>
          📶 No internet connection. Some features may not work.
        </Text>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
      hardwareAccelerated
      statusBarTranslucent
    >
      <Pressable
        style={styles.backdrop}
        onPress={() => {
          setShowActionsFor(null);
          onClose();
        }}
      />

      <View style={styles.container}>
        <NetworkStatusBar />
        
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <MapPin size={20} color="#ff3f6c" />
            <Text style={styles.headerTitle}>Select Delivery Address</Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              setShowActionsFor(null);
              onClose();
            }}
            style={styles.closeButton}
          >
            <X size={24} color="#333" />
          </TouchableOpacity>
        </View>

        {isRefreshingPreferences ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ff3f6c" />
            <Text style={styles.loadingText}>Loading addresses...</Text>
          </View>
        ) : addressArray.length === 0 ? (
          <EmptyAddressState />
        ) : (
          <>
            <View style={styles.instructionsContainer}>
              <Text style={styles.instructionsText}>
                💡 Tap any address to set it as default, or use options menu to edit/delete
              </Text>
            </View>

            <FlatList
              data={expanded ? addressArray : addressArray.slice(0, 2)}
              keyExtractor={(item) => item._id!}
              renderItem={renderAddressItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              extraData={[
                defaultAddressId,
                selectedAddressId,
                isSettingDefaultAddress,
                showActionsFor,
                isDeletingAddress,
              ]}
            />

            {addressArray.length > 2 && (
              <TouchableOpacity
                style={styles.expandButton}
                onPress={() => {
                  setExpanded(!expanded);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.expandButtonText}>
                  {expanded
                    ? "Show Less"
                    : `Show All ${addressArray.length} Addresses`}
                </Text>
                {expanded ? (
                  <ChevronUp size={20} color="#ff3f6c" />
                ) : (
                  <ChevronDown size={20} color="#ff3f6c" />
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.addNewButton}
              onPress={() => {
                setShowActionsFor(null);
                onClose();
                onAddNewAddress();
              }}
              activeOpacity={0.8}
            >
              <Plus size={20} color="#ff3f6c" />
              <Text style={styles.addNewButtonText}>Add New Address</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* ✅ ADD: Custom Confirmation Modal */}
      <Modal
        visible={confirmationModal.visible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setConfirmationModal(prev => ({...prev, visible: false}))}
      >
        <View style={confirmationStyles.backdrop}>
          <View style={confirmationStyles.container}>
            <Text style={confirmationStyles.title}>{confirmationModal.title}</Text>
            <Text style={confirmationStyles.message}>{confirmationModal.message}</Text>
            
            <View style={confirmationStyles.buttons}>
              {confirmationModal.onCancel && (
                <TouchableOpacity
                  style={[confirmationStyles.button, confirmationStyles.cancelButton]}
                  onPress={confirmationModal.onCancel}
                >
                  <Text style={confirmationStyles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                style={[confirmationStyles.button, confirmationStyles.confirmButton]}
                onPress={confirmationModal.onConfirm}
              >
                <Text style={confirmationStyles.confirmText}>
                  {confirmationModal.title.includes("Delete") ? "Delete" : "OK"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

// Complete styles with confirmation modal styles
const styles = RNStyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: screenHeight * 0.8,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  networkStatusBar: {
    backgroundColor: "#ff9800",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  networkStatusText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    marginLeft: 8,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#f8f9fa",
  },
  instructionsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#f0f8ff",
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#2196f3",
  },
  instructionsText: {
    fontSize: 12,
    color: "#1976d2",
    fontWeight: "500",
    textAlign: "center",
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
    fontWeight: "500",
  },
  listContent: {
    paddingHorizontal: 20,
  },
  addressItem: {
    backgroundColor: "#fff",
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e8e8e8",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    overflow: "hidden",
    position: "relative",
  },
  addressItemExpanded: {
    borderColor: "#ff3f6c",
    shadowOpacity: 0.1,
    elevation: 4,
  },
  selectedAddress: {
    borderColor: "#ff3f6c",
    backgroundColor: "#fff4f6",
    borderWidth: 2,
  },
  lastAddressItem: {
    marginBottom: 8,
  },
  addressContent: {
    padding: 16,
  },
  addressHeader: {
    marginBottom: 12,
    paddingRight: 48,
  },
  addressTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
  },
  addressName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginLeft: 8,
    flexShrink: 1,
    marginRight: 8,
  },
  defaultBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ff3f6c",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    flexShrink: 0,
  },
  defaultBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  addressDetails: {
    gap: 8,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    marginLeft: 8,
  },
  addressPhone: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
  tapToSetDefaultText: {
    fontSize: 12,
    color: "#2196f3",
    fontWeight: "500",
    marginTop: 8,
    textAlign: "center",
    fontStyle: "italic",
  },
  deletingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(244, 67, 54, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    flexDirection: "row",
    zIndex: 100,
  },
  deletingText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  actionsContainer: {
    position: "relative",
  },
  actionsButton: {
    position: "absolute",
    top: -60,
    right: 16,
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#f8f9fa",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  actionsMenu: {
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    gap: 24,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#f8f9fa",
    minWidth: 100,
    justifyContent: "center",
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  expandButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
    marginHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  expandButtonText: {
    fontSize: 16,
    color: "#ff3f6c",
    fontWeight: "600",
    marginRight: 8,
  },
  addNewButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#ff3f6c",
    borderStyle: "dashed",
    paddingVertical: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
  },
  addNewButtonText: {
    color: "#ff3f6c",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  addFirstAddressButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ff3f6c",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  addFirstAddressText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
});

// ✅ ADD: Custom confirmation modal styles
const confirmationStyles = RNStyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  container: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    maxWidth: 400,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
    marginBottom: 12,
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    color: "#666",
    lineHeight: 24,
    marginBottom: 24,
    textAlign: "center",
  },
  buttons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#f8f9fa",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  confirmButton: {
    backgroundColor: "#ff3f6c",
  },
  cancelText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "600",
  },
  confirmText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default AddressSelectionOverlay;
