import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Keyboard,
} from "react-native";
import { useRouter } from "expo-router";
import React from "react";
import { Eye, EyeOff } from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import AwesomeAlert from 'react-native-awesome-alerts';

interface FormErrors {
  email?: string;
  password?: string;
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

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  
  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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
      confirmText: 'Continue',
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
      title: 'Logging In',
      message,
      showConfirmButton: false,
      showCancelButton: false
    });
  };

  const showValidationAlert = (message: string) => {
    showAlert({
      type: 'warning',
      title: 'Validation Error',
      message,
      showConfirmButton: true,
      showCancelButton: false,
      confirmText: 'OK',
      onConfirmPressed: hideAlert
    });
  };

  // Validation functions
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Email validation
    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!validateEmail(email)) {
      newErrors.email = "Please enter a valid email address";
    }

    // Password validation
    if (!password.trim()) {
      newErrors.password = "Password is required";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    setErrors(newErrors);
    
    // Show validation alert if there are errors
    if (Object.keys(newErrors).length > 0) {
      const firstError = Object.values(newErrors)[0];
      showValidationAlert(firstError);
      return false;
    }
    
    return true;
  };

  const handleLogin = async () => {
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
      showLoadingAlert('Verifying your credentials...');
      
      await login(email.trim(), password);
      
      // Hide loading and show success
      hideAlert();
      
      showSuccessAlert(
        'Welcome Back!',
        'Login successful! Redirecting to your dashboard...',
        () => {
          // Success - navigate to home
          router.replace("/(tabs)");
        }
      );
      
    } catch (error: any) {
      console.error("Login error:", error);
      hideAlert(); // Hide loading alert
      
      // Handle different types of errors with specific alerts
      let title = "Login Failed";
      let message = "Please try again.";
      
      if (error.response?.status === 401) {
        title = "Invalid Credentials";
        message = "The email or password you entered is incorrect. Please check and try again.";
      } else if (error.response?.status === 429) {
        title = "Too Many Attempts";
        message = "You've made too many login attempts. Please wait a few minutes before trying again.";
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

  const handleForgotPassword = () => {
    showAlert({
      type: 'info',
      title: 'Forgot Password?',
      message: 'You will be redirected to the password reset page where you can recover your account.',
      showConfirmButton: true,
      showCancelButton: true,
      confirmText: 'Continue',
      cancelText: 'Cancel',
      onConfirmPressed: () => {
        hideAlert();
        router.push("/forgot-password");
      },
      onCancelPressed: hideAlert
    });
  };

  const handleSignupRedirect = () => {
    showAlert({
      type: 'info',
      title: 'Create New Account',
      message: "Don't have an account yet? Join thousands of happy customers and start your shopping journey with us!",
      showConfirmButton: true,
      showCancelButton: true,
      confirmText: 'Sign Up',
      cancelText: 'Cancel',
      onConfirmPressed: () => {
        hideAlert();
        router.push("/signup");
      },
      onCancelPressed: hideAlert
    });
  };

  const clearError = (field: keyof FormErrors) => {
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Image
          source={{
            uri: "https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=2070&auto=format&fit=crop",
          }}
          style={styles.backgroundImage}
          defaultSource={{ uri: 'https://via.placeholder.com/400x300' }}
        />
        
        <View style={styles.formContainer}>
          <Text style={styles.title}>Welcome to Myntra</Text>
          <Text style={styles.subtitle}>Login to continue shopping</Text>
          
          {/* General Error Message - Keep as fallback */}
          {errors.general && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errors.general}</Text>
            </View>
          )}
          
          {/* Email Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.input,
                errors.email && styles.inputError
              ]}
              placeholder="Email"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                clearError('email');
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              editable={!isLoading}
            />
            {errors.email && (
              <Text style={styles.fieldErrorText}>{errors.email}</Text>
            )}
          </View>
          
          {/* Password Input */}
          <View style={styles.inputContainer}>
            <View style={[
              styles.passwordContainer,
              errors.password && styles.inputError
            ]}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Password"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  clearError('password');
                }}
                secureTextEntry={!showPassword}
                autoComplete="password"
                textContentType="password"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                editable={!isLoading}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                {showPassword ? (
                  <EyeOff size={20} color="#666" />
                ) : (
                  <Eye size={20} color="#666" />
                )}
              </TouchableOpacity>
            </View>
            {errors.password && (
              <Text style={styles.fieldErrorText}>{errors.password}</Text>
            )}
          </View>

          {/* Forgot Password */}
          <TouchableOpacity 
            style={styles.forgotPassword}
            onPress={handleForgotPassword}
            disabled={isLoading}
          >
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Login Button */}
          <TouchableOpacity
            style={[
              styles.button,
              isLoading && styles.buttonDisabled
            ]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.buttonText}>LOGIN</Text>
            )}
          </TouchableOpacity>

          {/* Sign Up Link */}
          <TouchableOpacity
            style={styles.signupLink}
            onPress={handleSignupRedirect}
            disabled={isLoading}
          >
            <Text style={styles.signupText}>
              Don't have an account? <Text style={styles.signupTextBold}>Sign Up</Text>
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
        progressSize={`${50}`}
        progressColor="#ff3f6c"
        // Custom icons based on alert type
        customView={
          alertState.type === 'success' ? (
            <View style={styles.alertIconContainer}>
              <Text style={styles.successIcon}>✓</Text>
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
    flexGrow: 1,
  },
  backgroundImage: {
    width: "100%",
    height: 300,
    resizeMode: "cover",
  },
  formContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    marginTop: -30,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    minHeight: 400,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#3e3e3e",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 30,
    textAlign: "center",
  },
  errorContainer: {
    backgroundColor: "#ffe6e6",
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: "#ff3f6c",
  },
  errorText: {
    color: "#cc0000",
    fontSize: 14,
    textAlign: "center",
  },
  inputContainer: {
    marginBottom: 15,
  },
  input: {
    backgroundColor: "#f5f5f5",
    padding: 15,
    borderRadius: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "transparent",
  },
  inputError: {
    borderColor: "#ff3f6c",
    backgroundColor: "#fff5f5",
  },
  fieldErrorText: {
    color: "#ff3f6c",
    fontSize: 12,
    marginTop: 5,
    marginLeft: 5,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  passwordInput: {
    flex: 1,
    padding: 15,
    fontSize: 16,
  },
  eyeIcon: {
    padding: 15,
  },
  forgotPassword: {
    alignSelf: "flex-end",
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: "#ff3f6c",
    fontSize: 14,
  },
  button: {
    backgroundColor: "#ff3f6c",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
    minHeight: 50,
    justifyContent: "center",
  },
  buttonDisabled: {
    backgroundColor: "#ffb3c1",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  signupLink: {
    marginTop: 30,
    alignItems: "center",
  },
  signupText: {
    color: "#666",
    fontSize: 16,
  },
  signupTextBold: {
    color: "#ff3f6c",
    fontWeight: "bold",
  },
  // ✅ SWEET ALERT STYLES
  alertContainer: {
    borderRadius: 15,
    padding: 20,
  },
  alertOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  alertMessage: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    lineHeight: 22,
  },
  alertIconContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  successIcon: {
    fontSize: 50,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  errorIcon: {
    fontSize: 50,
    color: '#F44336',
    fontWeight: 'bold',
  },
  warningIcon: {
    fontSize: 50,
    color: '#FF9800',
    fontWeight: 'bold',
  },
  infoIcon: {
    fontSize: 50,
    color: '#2196F3',
    fontWeight: 'bold',
  },
});
