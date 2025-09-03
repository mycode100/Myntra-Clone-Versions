import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { Eye, EyeOff, Check } from "lucide-react-native";
import React from "react";
import { useAuth } from "@/context/AuthContext";
import AwesomeAlert from 'react-native-awesome-alerts';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isTablet = SCREEN_WIDTH >= 768;
const isMobile = SCREEN_WIDTH < 768;

interface FormData {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

interface AlertState {
  show: boolean;
  type: 'success' | 'error' | 'warning' | 'info' | 'loading';
  title: string;
  message: string;
  showConfirmButton?: boolean;
  showCancelButton?: boolean;
  confirmText?: string;
  cancelText?: string;
  onConfirmPressed?: () => void;
  onCancelPressed?: () => void;
}

export default function Signup() {
  const { Signup } = useAuth();
  const router = useRouter();
  
  // State management
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  
  const [formData, setFormData] = useState<FormData>({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  
  const [errors, setErrors] = useState<FormErrors>({});

  // Alert state
  const [alertState, setAlertState] = useState<AlertState>({
    show: false,
    type: 'info',
    title: '',
    message: '',
    showConfirmButton: true,
    showCancelButton: false,
    confirmText: 'OK',
    cancelText: 'Cancel'
  });

  // Alert helper functions
  const showAlert = (config: Partial<AlertState>) => {
    setAlertState(prev => ({
      ...prev,
      show: true,
      ...config
    }));
  };

  const hideAlert = () => {
    setAlertState(prev => ({ ...prev, show: false }));
  };

  const showSuccessAlert = (title: string, message: string, onConfirm?: () => void) => {
    showAlert({
      type: 'success',
      title,
      message,
      showConfirmButton: true,
      showCancelButton: false,
      confirmText: 'Get Started',
      onConfirmPressed: () => {
        hideAlert();
        onConfirm?.();
      }
    });
  };

  const showErrorAlert = (title: string, message: string) => {
    showAlert({
      type: 'error',
      title,
      message,
      showConfirmButton: true,
      showCancelButton: false,
      confirmText: 'Try Again',
      onConfirmPressed: hideAlert
    });
  };

  const showLoadingAlert = (message: string = 'Please wait...') => {
    showAlert({
      type: 'loading',
      title: 'Creating Account',
      message,
      showConfirmButton: false,
      showCancelButton: false
    });
  };

  const showValidationAlert = (message: string) => {
    showAlert({
      type: 'warning',
      title: 'Please Check Your Information',
      message,
      showConfirmButton: true,
      showCancelButton: false,
      confirmText: 'OK',
      onConfirmPressed: hideAlert
    });
  };

  const showTermsAlert = () => {
    showAlert({
      type: 'info',
      title: 'Terms & Conditions',
      message: 'Please read and accept our Terms of Service and Privacy Policy to continue with account creation.',
      showConfirmButton: true,
      showCancelButton: true,
      confirmText: 'View Terms',
      cancelText: 'Cancel',
      onConfirmPressed: () => {
        hideAlert();
        // Here you could navigate to terms page or show terms modal
      },
      onCancelPressed: hideAlert
    });
  };

  // Validation functions
  const validateName = (name: string): boolean => {
    return name.trim().length >= 2 && /^[a-zA-Z\s]+$/.test(name.trim());
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  const validatePassword = (password: string): boolean => {
    // At least 8 characters, one uppercase, one lowercase, one number
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Full name validation
    if (!formData.fullName.trim()) {
      newErrors.fullName = "Full name is required";
    } else if (!validateName(formData.fullName)) {
      newErrors.fullName = "Please enter a valid name (letters only, min 2 characters)";
    }

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!validateEmail(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (!validatePassword(formData.password)) {
      newErrors.password = "Password must be at least 8 characters with uppercase, lowercase, and number";
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords don't match";
    }

    // Terms agreement validation
    if (!agreeToTerms) {
      newErrors.general = "Please agree to the Terms of Service";
    }

    setErrors(newErrors);
    
    // Show validation alert if there are errors
    if (Object.keys(newErrors).length > 0) {
      const firstError = Object.values(newErrors)[0];
      if (firstError === "Please agree to the Terms of Service") {
        showTermsAlert();
      } else {
        showValidationAlert(firstError);
      }
      return false;
    }
    
    return true;
  };

  const handleSignup = async () => {
    // Clear previous errors
    setErrors({});
    
    // Validate form
    if (!validateForm()) {
      return;
    }

    try {
      setIsLoading(true);
      Keyboard.dismiss();
      
      // Show loading alert
      showLoadingAlert('Setting up your account...');
      
      // Call signup function
      await Signup(
        formData.fullName.trim(), 
        formData.email.trim().toLowerCase(), 
        formData.password
      );
      
      // Hide loading and show success
      hideAlert();
      
      showSuccessAlert(
        'Welcome to Myntra!',
        `Hi ${formData.fullName.split(' ')[0]}! Your account has been created successfully. Let's start your fashion journey!`,
        () => {
          // Success - navigate to tabs
          router.replace("/(tabs)");
        }
      );
      
    } catch (error: any) {
      console.error("Signup error:", error);
      hideAlert(); // Hide loading alert
      
      // Handle different types of errors with specific alerts
      let title = "Account Creation Failed";
      let message = "Please try again.";
      
      if (error.response?.status === 409) {
        title = "Email Already Exists";
        message = "An account with this email already exists. Try logging in instead or use a different email address.";
      } else if (error.response?.status === 400) {
        title = "Invalid Information";
        message = "Please check your information and make sure all fields are filled correctly.";
      } else if (error.response?.status >= 500) {
        title = "Server Error";
        message = "Our servers are experiencing issues. Please try again in a few moments.";
      } else if (!error.response) {
        title = "Connection Error";
        message = "Unable to connect to our servers. Please check your internet connection and try again.";
      } else if (error.message) {
        message = error.message;
      }
      
      showErrorAlert(title, message);
      setErrors({ general: message });
      
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginRedirect = () => {
    showAlert({
      type: 'info',
      title: 'Already Have an Account?',
      message: 'Great! Let\'s get you signed in to your existing account.',
      showConfirmButton: true,
      showCancelButton: true,
      confirmText: 'Login',
      cancelText: 'Cancel',
      onConfirmPressed: () => {
        hideAlert();
        router.push("/login");
      },
      onCancelPressed: hideAlert
    });
  };

  const updateFormData = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const clearGeneralError = () => {
    if (errors.general) {
      setErrors(prev => ({ ...prev, general: undefined }));
    }
  };

  const getPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[@$!%*?&]/.test(password)) strength++;
    return strength;
  };

  const passwordStrength = getPasswordStrength(formData.password);

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Image
          source={{
            uri: "https://images.pexels.com/photos/5632402/pexels-photo-5632402.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2",
          }}
          style={styles.backgroundImage}
        />

        <View style={styles.formContainer}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Join Myntra and discover amazing fashion
          </Text>

          {/* General Error Message - Keep as fallback */}
          {errors.general && (
            <View style={styles.errorContainer}>
              <Text style={styles.generalErrorText}>{errors.general}</Text>
            </View>
          )}

          {/* Full Name Input */}
          <View style={styles.inputGroup}>
            <TextInput
              style={[styles.input, errors.fullName && styles.inputError]}
              placeholder="Full Name"
              value={formData.fullName}
              onChangeText={(text) => updateFormData('fullName', text)}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              returnKeyType="next"
              editable={!isLoading}
            />
            {errors.fullName && (
              <Text style={styles.errorText}>{errors.fullName}</Text>
            )}
          </View>

          {/* Email Input */}
          <View style={styles.inputGroup}>
            <TextInput
              style={[styles.input, errors.email && styles.inputError]}
              placeholder="Email"
              value={formData.email}
              onChangeText={(text) => updateFormData('email', text)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              editable={!isLoading}
            />
            {errors.email && (
              <Text style={styles.errorText}>{errors.email}</Text>
            )}
          </View>

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <View style={[
              styles.passwordContainer,
              errors.password && styles.inputError
            ]}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Password"
                value={formData.password}
                onChangeText={(text) => updateFormData('password', text)}
                secureTextEntry={!showPassword}
                autoComplete="password-new"
                textContentType="newPassword"
                returnKeyType="next"
                editable={!isLoading}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                {showPassword ? (
                  <EyeOff size={isTablet ? 24 : 20} color="#666" />
                ) : (
                  <Eye size={isTablet ? 24 : 20} color="#666" />
                )}
              </TouchableOpacity>
            </View>
            
            {/* Password Strength Indicator */}
            {formData.password.length > 0 && (
              <View style={styles.passwordStrength}>
                <Text style={styles.strengthLabel}>Password strength: </Text>
                <View style={styles.strengthBars}>
                  {[1, 2, 3, 4].map((level) => (
                    <View
                      key={level}
                      style={[
                        styles.strengthBar,
                        passwordStrength >= level && styles.strengthBarActive,
                        passwordStrength >= 3 && level <= passwordStrength && styles.strengthBarGood,
                      ]}
                    />
                  ))}
                </View>
                <Text style={[
                  styles.strengthText,
                  passwordStrength >= 3 && styles.strengthTextGood
                ]}>
                  {passwordStrength < 2 ? 'Weak' : passwordStrength < 3 ? 'Fair' : 'Strong'}
                </Text>
              </View>
            )}
            
            {errors.password && (
              <Text style={styles.errorText}>{errors.password}</Text>
            )}
          </View>

          {/* Confirm Password Input */}
          <View style={styles.inputGroup}>
            <View style={[
              styles.passwordContainer,
              errors.confirmPassword && styles.inputError
            ]}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Confirm Password"
                value={formData.confirmPassword}
                onChangeText={(text) => updateFormData('confirmPassword', text)}
                secureTextEntry={!showConfirmPassword}
                autoComplete="password-new"
                textContentType="newPassword"
                returnKeyType="done"
                onSubmitEditing={handleSignup}
                editable={!isLoading}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={isLoading}
              >
                {showConfirmPassword ? (
                  <EyeOff size={isTablet ? 24 : 20} color="#666" />
                ) : (
                  <Eye size={isTablet ? 24 : 20} color="#666" />
                )}
              </TouchableOpacity>
            </View>
            {errors.confirmPassword && (
              <Text style={styles.errorText}>{errors.confirmPassword}</Text>
            )}
          </View>

          {/* Terms Agreement */}
          <TouchableOpacity
            style={styles.termsContainer}
            onPress={() => {
              setAgreeToTerms(!agreeToTerms);
              clearGeneralError();
            }}
            disabled={isLoading}
          >
            <View style={[styles.checkbox, agreeToTerms && styles.checkboxChecked]}>
              {agreeToTerms && <Check size={isTablet ? 16 : 14} color="#fff" />}
            </View>
            <Text style={styles.termsText}>
              I agree to the{" "}
              <Text style={styles.termsLink}>Terms of Service</Text>
              {" "}and{" "}
              <Text style={styles.termsLink}>Privacy Policy</Text>
            </Text>
          </TouchableOpacity>

          {/* Signup Button */}
          <TouchableOpacity
            style={[
              styles.button,
              isLoading && styles.buttonDisabled
            ]}
            onPress={handleSignup}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size={isTablet ? "large" : "small"} />
            ) : (
              <Text style={styles.buttonText}>SIGN UP</Text>
            )}
          </TouchableOpacity>

          {/* Login Link */}
          <TouchableOpacity
            style={styles.loginLink}
            onPress={handleLoginRedirect}
            disabled={isLoading}
          >
            <Text style={styles.loginText}>
              Already have an account?{" "}
              <Text style={styles.loginTextBold}>Login</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ✅ SWEET ALERT COMPONENT */}
      <AwesomeAlert
        show={alertState.show}
        showProgress={alertState.type === 'loading'}
        title={alertState.title}
        message={alertState.message}
        closeOnTouchOutside={alertState.type !== 'loading'}
        closeOnHardwareBackPress={alertState.type !== 'loading'}
        showCancelButton={alertState.showCancelButton}
        showConfirmButton={alertState.showConfirmButton}
        cancelText={alertState.cancelText}
        confirmText={alertState.confirmText}
        confirmButtonColor={
          alertState.type === 'success' ? '#4CAF50' :
          alertState.type === 'error' ? '#F44336' :
          alertState.type === 'warning' ? '#FF9800' :
          '#ff3f6c'
        }
        cancelButtonColor="#757575"
        onCancelPressed={alertState.onCancelPressed || hideAlert}
        onConfirmPressed={alertState.onConfirmPressed || hideAlert}
        titleStyle={styles.alertTitle}
        messageStyle={styles.alertMessage}
        contentContainerStyle={styles.alertContainer}
        overlayStyle={styles.alertOverlay}
        progressSize={`${isTablet ? 60 : 50}px`}
        progressColor="#ff3f6c"
        // Custom icons based on alert type
        customView={
          alertState.type === 'success' ? (
            <View style={styles.alertIconContainer}>
              <Text style={styles.successIcon}>🎉</Text>
            </View>
          ) : alertState.type === 'error' ? (
            <View style={styles.alertIconContainer}>
              <Text style={styles.errorIcon}>✕</Text>
            </View>
          ) : alertState.type === 'warning' ? (
            <View style={styles.alertIconContainer}>
              <Text style={styles.warningIcon}>⚠</Text>
            </View>
          ) : alertState.type === 'info' ? (
            <View style={styles.alertIconContainer}>
              <Text style={styles.infoIcon}>ℹ</Text>
            </View>
          ) : null
        }
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  backgroundImage: {
    width: "100%",
    height: isTablet ? 400 : isMobile ? 250 : 300,
    resizeMode: "cover",
  },
  formContainer: {
    flex: 1,
    padding: isTablet ? 40 : 20,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    marginTop: isTablet ? -50 : -30,
    borderTopLeftRadius: isTablet ? 40 : 30,
    borderTopRightRadius: isTablet ? 40 : 30,
    minHeight: isTablet ? 800 : 600,
    maxWidth: isTablet ? 600 : '100%',
    alignSelf: 'center',
    width: '100%',
  },
  title: {
    fontSize: isTablet ? 36 : 28,
    fontWeight: "bold",
    marginBottom: isTablet ? 15 : 10,
    color: "#3e3e3e",
    textAlign: "center",
  },
  subtitle: {
    fontSize: isTablet ? 20 : 16,
    color: "#666",
    marginBottom: isTablet ? 40 : 30,
    textAlign: "center",
    lineHeight: isTablet ? 28 : 22,
  },
  errorContainer: {
    backgroundColor: "#ffe6e6",
    padding: isTablet ? 16 : 12,
    borderRadius: isTablet ? 12 : 8,
    marginBottom: isTablet ? 20 : 15,
    borderLeftWidth: isTablet ? 6 : 4,
    borderLeftColor: "#ff3f6c",
  },
  generalErrorText: {
    color: "#cc0000",
    fontSize: isTablet ? 16 : 14,
    textAlign: "center",
  },
  inputGroup: {
    marginBottom: isTablet ? 20 : 15,
  },
  input: {
    backgroundColor: "#f5f5f5",
    padding: isTablet ? 20 : 15,
    borderRadius: isTablet ? 15 : 10,
    fontSize: isTablet ? 18 : 16,
    borderWidth: 1,
    borderColor: "transparent",
    minHeight: isTablet ? 56 : 48,
  },
  inputError: {
    borderColor: "#ff3f6c",
    backgroundColor: "#fff5f5",
  },
  errorText: {
    color: "#ff3f6c",
    fontSize: isTablet ? 14 : 12,
    marginTop: isTablet ? 8 : 5,
    marginLeft: isTablet ? 8 : 5,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: isTablet ? 15 : 10,
    borderWidth: 1,
    borderColor: "transparent",
    minHeight: isTablet ? 56 : 48,
  },
  passwordInput: {
    flex: 1,
    padding: isTablet ? 20 : 15,
    fontSize: isTablet ? 18 : 16,
  },
  eyeIcon: {
    padding: isTablet ? 20 : 15,
  },
  passwordStrength: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: isTablet ? 12 : 8,
    marginLeft: isTablet ? 8 : 5,
  },
  strengthLabel: {
    fontSize: isTablet ? 14 : 12,
    color: "#666",
    marginRight: isTablet ? 12 : 8,
  },
  strengthBars: {
    flexDirection: "row",
    marginRight: isTablet ? 12 : 8,
  },
  strengthBar: {
    width: isTablet ? 28 : 20,
    height: isTablet ? 6 : 4,
    backgroundColor: "#e0e0e0",
    marginRight: isTablet ? 4 : 2,
    borderRadius: isTablet ? 3 : 2,
  },
  strengthBarActive: {
    backgroundColor: "#ff9800",
  },
  strengthBarGood: {
    backgroundColor: "#4caf50",
  },
  strengthText: {
    fontSize: isTablet ? 14 : 12,
    color: "#ff9800",
  },
  strengthTextGood: {
    color: "#4caf50",
  },
  termsContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: isTablet ? 30 : 20,
    paddingHorizontal: isTablet ? 8 : 5,
  },
  checkbox: {
    width: isTablet ? 24 : 20,
    height: isTablet ? 24 : 20,
    borderWidth: 2,
    borderColor: "#ddd",
    borderRadius: isTablet ? 6 : 4,
    marginRight: isTablet ? 16 : 12,
    marginTop: isTablet ? 4 : 2,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: "#ff3f6c",
    borderColor: "#ff3f6c",
  },
  termsText: {
    flex: 1,
    fontSize: isTablet ? 16 : 14,
    color: "#666",
    lineHeight: isTablet ? 24 : 20,
  },
  termsLink: {
    color: "#ff3f6c",
    textDecorationLine: "underline",
    fontWeight: '500',
  },
  button: {
    backgroundColor: "#ff3f6c",
    padding: isTablet ? 20 : 15,
    borderRadius: isTablet ? 15 : 10,
    alignItems: "center",
    marginTop: isTablet ? 15 : 10,
    minHeight: isTablet ? 60 : 50,
    justifyContent: "center",
    shadowColor: "#ff3f6c",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonDisabled: {
    backgroundColor: "#ffb3c1",
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: "#fff",
    fontSize: isTablet ? 20 : 16,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  loginLink: {
    marginTop: isTablet ? 40 : 30,
    alignItems: "center",
    paddingVertical: isTablet ? 15 : 10,
  },
  loginText: {
    color: "#666",
    fontSize: isTablet ? 18 : 16,
    textAlign: "center",
  },
  loginTextBold: {
    color: "#ff3f6c",
    fontWeight: "bold",
  },
  // ✅ SWEET ALERT STYLES - Enhanced for mobile/tablet
  alertContainer: {
    borderRadius: isTablet ? 20 : 15,
    padding: isTablet ? 30 : 20,
    maxWidth: isTablet ? 500 : SCREEN_WIDTH * 0.9,
  },
  alertOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  alertTitle: {
    fontSize: isTablet ? 24 : 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: isTablet ? 15 : 10,
    color: '#333',
  },
  alertMessage: {
    fontSize: isTablet ? 18 : 16,
    textAlign: 'center',
    color: '#666',
    lineHeight: isTablet ? 26 : 22,
  },
  alertIconContainer: {
    alignItems: 'center',
    marginBottom: isTablet ? 20 : 15,
  },
  successIcon: {
    fontSize: isTablet ? 60 : 50,
    textAlign: 'center',
  },
  errorIcon: {
    fontSize: isTablet ? 60 : 50,
    color: '#F44336',
    fontWeight: 'bold',
  },
  warningIcon: {
    fontSize: isTablet ? 60 : 50,
    color: '#FF9800',
    fontWeight: 'bold',
  },
  infoIcon: {
    fontSize: isTablet ? 60 : 50,
    color: '#2196F3',
    fontWeight: 'bold',
  },
});
