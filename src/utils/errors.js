/**
 * Custom error class for workflow operations
 */
class WorkflowError extends Error {
  constructor(message, code, statusCode = 500, details = {}) {
    super(message);
    this.name = 'WorkflowError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Standardized error handler for workflow routes
 * Sanitizes errors in production and logs full details
 */
function handleError(error, req, res) {
  // Log full error details for debugging
  console.error('Workflow error occurred:', {
    message: error.message,
    code: error.code || 'UNKNOWN',
    stack: error.stack,
    userId: req.session?.userId,
    organizationId: req.session?.organizationId,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Determine status code
  const statusCode = error.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  // Send sanitized response
  res.status(statusCode).json({
    success: false,
    error: isProduction && statusCode === 500
      ? 'An error occurred while processing your request. Please try again.'
      : error.message,
    code: error.code || 'INTERNAL_ERROR'
  });
}

module.exports = { WorkflowError, handleError };
