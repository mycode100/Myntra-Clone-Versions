import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { Address } from "@/types/product";
import { useAuth } from "@/context/AuthContext";
import { 
  X, 
  Save, 
  MapPin, 
  User, 
  Phone, 
  Home,
  Building,
  Navigation,
  Trash2,
  Star
} from "lucide-react-native";
import { validatePhoneNumber, validatePincode } from "@/utils/addressApi";

const { height: screenHeight } = Dimensions.get("window");

interface AddressManagementOverlayProps {
  visible: boolean;
  onClose: () => void;
  editingAddress?: Address | null;
  onSuccess?: (address: Address) => void;
}

interface FormData {
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

interface FormErrors {
  name?: string;
  phone?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

const AddressManagementOverlay: React.FC<AddressManagementOverlayProps> = ({
  visible,
  onClose,
  editingAddress,
  onSuccess
}) => {
  const { 
    user,
    createAddressWithSync,
    updateAddressWithSync,
    deleteAddressWithSync,
    setDefaultAddressWithSync,
    isAddingAddress,
    isUpdatingAddress,
    isDeletingAddress,
    isSettingDefaultAddress
  } = useAuth();

  const [formData, setFormData] = useState<FormData>({
    name: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    landmark: "",
    city: "",
    state: "",
    pincode: "",
    isDefault: false,
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = !!editingAddress;
  
  // ✅ FIXED: Safer processing state check
  const isProcessing = isAddingAddress || 
    (editingAddress?._id && isUpdatingAddress.has(editingAddress._id)) || 
    (editingAddress?._id && isDeletingAddress.has(editingAddress._id)) ||
    isSettingDefaultAddress ||
    isSubmitting;

  // Initialize form data when editing
  useEffect(() => {
    if (editingAddress && visible) {
      setFormData({
        name: editingAddress.name || "",
        phone: editingAddress.phone || "",
        addressLine1: editingAddress.addressLine1 || "",
        addressLine2: editingAddress.addressLine2 || "",
        landmark: editingAddress.landmark || "",
        city: editingAddress.city || "",
        state: editingAddress.state || "",
        pincode: editingAddress.pincode || "",
        isDefault: editingAddress.isDefault || false,
      });
      setErrors({});
    } else if (!editingAddress && visible) {
      // Reset form for new address
      setFormData({
        name: "",
        phone: "",
        addressLine1: "",
        addressLine2: "",
        landmark: "",
        city: "",
        state: "",
        pincode: "",
        isDefault: false,
      });
      setErrors({});
    }
  }, [editingAddress, visible]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    } else if (formData.name.trim().length < 2) {
      newErrors.name = "Name must be at least 2 characters";
    }

    const phoneValidation = validatePhoneNumber(formData.phone);
    if (!phoneValidation.valid) {
      newErrors.phone = phoneValidation.message;
    }

    if (!formData.addressLine1.trim()) {
      newErrors.addressLine1 = "Address line 1 is required";
    }

    if (!formData.city.trim()) {
      newErrors.city = "City is required";
    }

    if (!formData.state.trim()) {
      newErrors.state = "State is required";
    }

    const pincodeValidation = validatePincode(formData.pincode);
    if (!pincodeValidation.valid) {
      newErrors.pincode = pincodeValidation.message;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ✅ UPDATED: Enhanced CREATE operation with better error handling
  const handleCreate = async () => {
    if (!user) {
      Alert.alert("Error", "Please login to add address");
      return;
    }

    if (!validateForm()) {
      Alert.alert("Validation Error", "Please fix the errors and try again");
      return;
    }

    setIsSubmitting(true);

    try {
      // Create new address using the sync function
      const result = await createAddressWithSync(formData);
      
      if (result.success && result.data) {
        // Success: Show confirmation and auto-close
        Alert.alert(
          "Success! 🎉", 
          "Address saved successfully!", 
          [
            { 
              text: "OK", 
              onPress: () => {
                // Trigger success callback with the new address data
                if (onSuccess && result.data) {
                  onSuccess(result.data);
                }
                // Auto-close the overlay
                onClose();
              }
            }
          ]
        );
      } else {
        // Handle API errors with user-friendly messages
        const errorMessage = result.message || "Failed to save address. Please try again.";
        Alert.alert("Unable to Save", errorMessage);
      }
    } catch (error) {
      // Handle unexpected errors
      console.error("Error creating address:", error);
      Alert.alert(
        "Something Went Wrong", 
        "We couldn't save your address. Please check your connection and try again.",
        [
          { text: "Retry", onPress: handleCreate },
          { text: "Cancel", style: "cancel" }
        ]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ FIXED: UPDATE Operation with null checks
  const handleUpdate = async () => {
    // ✅ Add null check for editingAddress
    if (!editingAddress || !editingAddress._id) {
      Alert.alert("Error", "Invalid address data. Please try again.");
      return;
    }

    if (!validateForm()) {
      Alert.alert("Validation Error", "Please fix the errors and try again");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await updateAddressWithSync(editingAddress._id, formData);
      
      if (result.success) {
        Alert.alert(
          "Success! 🎉", 
          "Address updated successfully!", 
          [
            { 
              text: "OK", 
              onPress: () => {
                // ✅ Create updated address object safely
                const updatedAddress: Address = { ...editingAddress, ...formData };
                if (onSuccess) {
                  onSuccess(updatedAddress);
                }
                onClose();
              }
            }
          ]
        );
      } else {
        const errorMessage = result.message || "Failed to update address. Please try again.";
        Alert.alert("Unable to Update", errorMessage);
      }
    } catch (error) {
      console.error("Error updating address:", error);
      Alert.alert(
        "Something Went Wrong",
        "We couldn't update your address. Please check your connection and try again.",
        [
          { text: "Retry", onPress: handleUpdate },
          { text: "Cancel", style: "cancel" }
        ]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ FIXED: DELETE Operation with null checks
  const handleDelete = async () => {
    // ✅ Add null check for editingAddress
    if (!editingAddress || !editingAddress._id) {
      Alert.alert("Error", "Invalid address data. Please try again.");
      return;
    }

    Alert.alert(
      "Delete Address",
      `Are you sure you want to delete "${editingAddress.name}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              const result = await deleteAddressWithSync(editingAddress._id!);
              
              if (result.success) {
                Alert.alert(
                  "Deleted! 🗑️", 
                  "Address deleted successfully!", 
                  [
                    { text: "OK", onPress: onClose }
                  ]
                );
              } else {
                const errorMessage = result.message || "Failed to delete address. Please try again.";
                Alert.alert("Unable to Delete", errorMessage);
              }
            } catch (error) {
              console.error("Error deleting address:", error);
              Alert.alert(
                "Something Went Wrong",
                "We couldn't delete your address. Please try again."
              );
            }
          }
        }
      ]
    );
  };

  // ✅ FIXED: SET DEFAULT Operation with null checks
  const handleSetDefault = async () => {
    // ✅ Add null check for editingAddress
    if (!editingAddress || !editingAddress._id || formData.isDefault) {
      return;
    }

    try {
      const result = await setDefaultAddressWithSync(editingAddress._id);
      
      if (result.success) {
        setFormData(prev => ({ ...prev, isDefault: true }));
        Alert.alert("Success! ⭐", "Address set as default!");
      } else {
        const errorMessage = result.message || "Failed to set as default. Please try again.";
        Alert.alert("Unable to Set Default", errorMessage);
      }
    } catch (error) {
      console.error("Error setting default address:", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
    }
  };

  const handleSave = () => {
    if (isEditing) {
      handleUpdate();
    } else {
      handleCreate();
    }
  };

  const updateFormData = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleClose = () => {
    if (isProcessing) return; // Prevent closing during operations
    onClose();
  };

  const renderInput = (
    label: string,
    field: keyof FormData,
    placeholder: string,
    icon: React.ReactNode,
    options?: {
      multiline?: boolean;
      maxLength?: number;
      keyboardType?: "default" | "numeric" | "phone-pad";
    }
  ) => {
    const hasError = !!errors[field as keyof FormErrors];
    
    return (
      <View style={styles.inputGroup}>
        <View style={styles.labelRow}>
          {icon}
          <Text style={styles.inputLabel}>{label}</Text>
          {(field === "name" || field === "phone" || field === "addressLine1" || 
            field === "city" || field === "state" || field === "pincode") && (
            <Text style={styles.requiredStar}>*</Text>
          )}
        </View>
        
        <TextInput
          style={[
            styles.textInput,
            hasError && styles.textInputError,
            options?.multiline && styles.textInputMultiline
          ]}
          value={formData[field] as string}
          onChangeText={(value) => updateFormData(field, value)}
          placeholder={placeholder}
          placeholderTextColor="#999"
          multiline={options?.multiline}
          numberOfLines={options?.multiline ? 3 : 1}
          maxLength={options?.maxLength}
          keyboardType={options?.keyboardType || "default"}
          editable={!isProcessing}
        />
        
        {hasError && (
          <Text style={styles.errorText}>
            {errors[field as keyof FormErrors]}
          </Text>
        )}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
      hardwareAccelerated
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.backdrop} />
        
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <MapPin size={20} color="#ff3f6c" />
              <Text style={styles.headerTitle}>
                {isEditing ? "Edit Address" : "Add New Address"}
              </Text>
            </View>
            <View style={styles.headerActions}>
              {/* ✅ FIXED: Proper null checks for header actions */}
              {isEditing && editingAddress && (
                <>
                  {!formData.isDefault && (
                    <TouchableOpacity
                      onPress={handleSetDefault}
                      style={styles.setDefaultHeaderButton}
                      disabled={isProcessing}
                      accessible
                      accessibilityLabel="Set as default address"
                    >
                      {isSettingDefaultAddress ? (
                        <ActivityIndicator size="small" color="#ff3f6c" />
                      ) : (
                        <Star size={18} color="#ff3f6c" />
                      )}
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity
                    onPress={handleDelete}
                    style={styles.deleteHeaderButton}
                    disabled={isProcessing}
                    accessible
                    accessibilityLabel="Delete address"
                  >
                    {editingAddress._id && isDeletingAddress.has(editingAddress._id) ? (
                      <ActivityIndicator size="small" color="#ff4444" />
                    ) : (
                      <Trash2 size={18} color="#ff4444" />
                    )}
                  </TouchableOpacity>
                </>
              )}
              
              <TouchableOpacity
                onPress={handleClose}
                style={styles.closeButton}
                disabled={isProcessing}
                accessible
                accessibilityLabel="Close"
              >
                <X size={24} color="#333" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Form */}
          <ScrollView
            style={styles.form}
            contentContainerStyle={styles.formContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Personal Info Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Personal Information</Text>
              
              {renderInput(
                "Full Name",
                "name",
                "Enter your full name",
                <User size={16} color="#666" />,
                { maxLength: 100 }
              )}
              
              {renderInput(
                "Phone Number",
                "phone",
                "Enter 10-digit mobile number",
                <Phone size={16} color="#666" />,
                { keyboardType: "phone-pad", maxLength: 10 }
              )}
            </View>

            {/* Address Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Address Details</Text>
              
              {renderInput(
                "Address Line 1",
                "addressLine1",
                "House/Flat/Building No., Street",
                <Home size={16} color="#666" />,
                { maxLength: 200 }
              )}
              
              {renderInput(
                "Address Line 2",
                "addressLine2",
                "Area, Sector, Locality (Optional)",
                <Building size={16} color="#666" />,
                { maxLength: 200 }
              )}
              
              {renderInput(
                "Landmark",
                "landmark",
                "Near famous place (Optional)",
                <Navigation size={16} color="#666" />,
                { maxLength: 100 }
              )}

              <View style={styles.row}>
                <View style={styles.halfWidth}>
                  {renderInput(
                    "City",
                    "city",
                    "City name",
                    <MapPin size={16} color="#666" />,
                    { maxLength: 50 }
                  )}
                </View>
                
                <View style={styles.halfWidth}>
                  {renderInput(
                    "State",
                    "state",
                    "State name",
                    <MapPin size={16} color="#666" />,
                    { maxLength: 50 }
                  )}
                </View>
              </View>

              {renderInput(
                "Pincode",
                "pincode",
                "6-digit pincode",
                <Navigation size={16} color="#666" />,
                { keyboardType: "numeric", maxLength: 6 }
              )}
            </View>

            {/* Default Address Toggle - Only for new addresses or non-default addresses */}
            {(!isEditing || !formData.isDefault) && (
              <View style={styles.section}>
                <TouchableOpacity
                  style={styles.defaultToggle}
                  onPress={() => updateFormData("isDefault", !formData.isDefault)}
                  disabled={isProcessing}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.checkbox,
                    formData.isDefault && styles.checkboxChecked
                  ]}>
                    {formData.isDefault && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.defaultToggleText}>
                    Set as default address
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Show default badge for existing default addresses */}
            {isEditing && formData.isDefault && (
              <View style={styles.section}>
                <View style={styles.defaultAddressBadge}>
                  <Star size={16} color="#ff3f6c" />
                  <Text style={styles.defaultAddressText}>This is your default address</Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              disabled={isProcessing}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.saveButton, isProcessing && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={isProcessing}
              activeOpacity={0.7}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Save size={16} color="#fff" />
                  <Text style={styles.saveButtonText}>
                    {isEditing ? "Update" : "Save"} Address
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: screenHeight * 0.9,
    marginTop: screenHeight * 0.1,
    flex: 1,
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  setDefaultHeaderButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#fff4f6",
  },
  deleteHeaderButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#fef2f2",
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#f8f9fa",
  },
  form: {
    flex: 1,
  },
  formContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginLeft: 8,
    flex: 1,
  },
  requiredStar: {
    color: "#ff3f6c",
    fontSize: 14,
    fontWeight: "700",
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#333",
    backgroundColor: "#fff",
  },
  textInputError: {
    borderColor: "#ff3f6c",
    backgroundColor: "#fff4f6",
  },
  textInputMultiline: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  errorText: {
    color: "#ff3f6c",
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  defaultToggle: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: "#ff3f6c",
    borderColor: "#ff3f6c",
  },
  checkmark: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  defaultToggleText: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
  defaultAddressBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff4f6",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ff3f6c",
  },
  defaultAddressText: {
    color: "#ff3f6c",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  footer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
  },
  saveButton: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ff3f6c",
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default AddressManagementOverlay;
