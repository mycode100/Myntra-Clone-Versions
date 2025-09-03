// Helper function to format API errors consistently
const handleApiError = (error) => {
  if (typeof error === 'string') {
    return error;
  }
  
  if (error.message) {
    return error.message;
  }
  
  if (error.error && error.error.message) {
    return error.error.message;
  }
  
  // Default error message
  return 'An unexpected error occurred';
};

// Helper function to send success response
const sendSuccessResponse = (res, data, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  });
};

// Helper function to send error response
const sendErrorResponse = (res, error, statusCode = 500) => {
  return res.status(statusCode).json({
    success: false,
    error: {
      message: handleApiError(error)
    },
    timestamp: new Date().toISOString()
  });
};

// Helper function to validate required fields
const validateRequiredFields = (body, requiredFields) => {
  const missingFields = [];
  
  for (const field of requiredFields) {
    if (!body[field] || body[field] === '') {
      missingFields.push(field);
    }
  }
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }
  
  return true;
};

// Helper function to sanitize user input
const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return input.trim().replace(/[<>]/g, '');
  }
  return input;
};

module.exports = {
  handleApiError,
  sendSuccessResponse,
  sendErrorResponse,
  validateRequiredFields,
  sanitizeInput
};
