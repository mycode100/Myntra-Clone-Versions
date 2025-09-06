import { ApiResponse, Address } from '@/types/product';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

// ✅ DEBUG: Log API configuration on startup
console.log('🔧 ADDRESS API CONFIG:');
console.log('🔧 API_BASE_URL:', API_BASE_URL);
console.log('🔧 NEXT_PUBLIC_BACKEND_URL:', process.env.NEXT_PUBLIC_BACKEND_URL);

// ============================================================================
// GENERIC API CALL HELPER
// ============================================================================

async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`;
  const method = options?.method || 'GET';

  console.log(`🔗 ${method} API Call Starting:`, url);
  console.log('🔗 Request Options:', {
    method,
    headers: options?.headers,
    body: options?.body ? 'Present' : 'None'
  });

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    console.log(`📥 ${method} Response Received:`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      url: response.url
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`❌ ${method} Error Response Body:`, errorText);

      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        if (errorText) {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        }
      } catch {
        errorMessage = errorText || errorMessage;
      }

      throw new Error(errorMessage);
    }

    // ✅ Handle successful response
    const responseText = await response.text();
    if (!responseText) {
      // Empty response (common for DELETE)
      return {
        success: true,
        data: {} as T,
        message: `${method} operation completed successfully`
      };
    }

    const data = JSON.parse(responseText);
    console.log(`✅ ${method} Parsed Response:`, data);
    return data;

  } catch (error) {
    console.error(`💥 ${method} API Call Failed:`, {
      url,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        statusCode: error instanceof Error && 'status' in error ? (error as any).status : 500
      }
    };
  }
}

// ============================================================================
// ADDRESS CRUD OPERATIONS
// ============================================================================

export const getUserAddresses = async (userId: string): Promise<ApiResponse<Address[]>> => {
  console.log('👥 getUserAddresses called with userId:', userId);
  if (!userId) {
    return { success: false, error: { message: 'User ID is required' } };
  }
  return apiCall<Address[]>(`/api/address/user/${userId}`);
};

export const getDefaultAddress = async (userId: string): Promise<ApiResponse<Address>> => {
  console.log('⭐ getDefaultAddress called with userId:', userId);
  if (!userId) {
    return { success: false, error: { message: 'User ID is required' } };
  }
  return apiCall<Address>(`/api/address/user/${userId}/default`);
};

export const createAddress = async (addressData: Partial<Address> & { userId: string }): Promise<ApiResponse<Address>> => {
  console.log('➕ createAddress called with data:', addressData);

  const requiredFields = ['userId', 'name', 'phone', 'addressLine1', 'city', 'state', 'pincode'];
  for (const field of requiredFields) {
    if (!addressData[field as keyof typeof addressData]) {
      return { success: false, error: { message: `${field} is required` } };
    }
  }

  return apiCall<Address>('/api/address', {
    method: 'POST',
    body: JSON.stringify(addressData),
  });
};

export const updateAddress = async (addressId: string, updateData: Partial<Address>): Promise<ApiResponse<Address>> => {
  console.log('✏️ updateAddress called:', { addressId, updateData });
  if (!addressId) {
    return { success: false, error: { message: 'Address ID is required' } };
  }
  return apiCall<Address>(`/api/address/${addressId}`, {
    method: 'PUT',
    body: JSON.stringify(updateData),
  });
};

export const deleteAddress = async (addressId: string): Promise<ApiResponse<any>> => {
  console.log('🗑️ DELETE called with addressId:', addressId);
  if (!addressId) {
    return { success: false, error: { message: 'Address ID is required' } };
  }
  return apiCall<any>(`/api/address/${addressId}`, { method: 'DELETE' });
};

export const setDefaultAddress = async (addressId: string, userId: string): Promise<ApiResponse<Address>> => {
  console.log('⭐ setDefaultAddress called:', { addressId, userId });
  if (!addressId || !userId) {
    return { success: false, error: { message: 'Address ID and User ID are required' } };
  }
  return apiCall<Address>(`/api/address/${addressId}/default`, {
    method: 'PATCH',
    body: JSON.stringify({ userId }),
  });
};

// ============================================================================
// UTILITIES
// ============================================================================

export const validatePhoneNumber = (phone: string) => {
  const regex = /^[6-9]\d{9}$/;
  return { valid: regex.test(phone), message: regex.test(phone) ? undefined : 'Invalid phone number' };
};

export const validatePincode = (pincode: string) => {
  const regex = /^[1-9][0-9]{5}$/;
  return { valid: regex.test(pincode), message: regex.test(pincode) ? undefined : 'Invalid pincode' };
};

export const formatAddressForDisplay = (address: Address): string => {
  const parts = [address.addressLine1, address.addressLine2, address.landmark, address.city, address.state, address.pincode].filter(Boolean);
  return parts.join(', ');
};

export const isAddressComplete = (address: Partial<Address>): boolean => {
  const requiredFields = ['name', 'phone', 'addressLine1', 'city', 'state', 'pincode'];
  return requiredFields.every(field => address[field as keyof Address]);
};

export const handleAddressApiError = (error: any): string => {
  if (error?.error?.message) return error.error.message;
  if (error?.message) return error.message;
  if (typeof error === 'string') return error;
  return 'Something went wrong. Please try again.';
};

export const retryAddressApiCall = async <T>(
  apiFunction: () => Promise<ApiResponse<T>>,
  maxRetries = 3,
  delay = 1000
): Promise<ApiResponse<T>> => {
  let lastError: ApiResponse<T> = { success: false, error: { message: 'Unknown error' } };
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await apiFunction();
      if (result.success) return result;
      lastError = result;
    } catch (e: any) {
      lastError = { success: false, error: { message: e.message || 'Unknown error' } };
    }
    await new Promise(res => setTimeout(res, delay * attempt));
  }
  return lastError;
};

// ✅ Simplified connectivity test
export const testApiConnectivity = async () => {
  console.log('🧪 Testing API connectivity...');
  const results: any = { base: false, health: false, address: false };
  try {
    const health = await fetch(`${API_BASE_URL}/api/health`).catch(() => null);
    results.health = !!health?.ok;
    const addr = await fetch(`${API_BASE_URL}/api/address`).catch(() => null);
    results.address = !!addr;
  } catch (e) {
    console.error('🧪 Connectivity test error:', e);
  }
  console.log('🧪 Test results:', results);
  return results;
};
