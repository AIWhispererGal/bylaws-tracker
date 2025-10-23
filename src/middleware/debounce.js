/**
 * Request Debouncing Middleware
 * Prevents duplicate form submissions by caching recent requests
 */

// Simple in-memory cache for request deduplication
const requestCache = new Map();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of requestCache.entries()) {
    if (now - value.timestamp > 300000) { // 5 minutes
      requestCache.delete(key);
    }
  }
}, 300000);

/**
 * Debounce middleware to prevent duplicate POST requests
 * Uses in-memory cache with 10-second window
 */
function debounceMiddleware(req, res, next) {
  // Only apply to POST requests
  if (req.method !== 'POST') {
    return next();
  }

  // Create unique key from user + org name
  // CRITICAL: Use session ID or IP for anonymous users (userId doesn't exist during setup)
  const sessionIdentifier = req.session?.userId || req.session?.id || req.ip || 'anon';
  const orgName = req.body.organization_name || 'unknown';
  const key = `${sessionIdentifier}-${orgName}`;
  console.log('[DEBOUNCE] Generated key:', key, '(userId:', req.session?.userId, 'sessionId:', req.session?.id, 'ip:', req.ip, ')');
  const cached = requestCache.get(key);

  if (cached && Date.now() - cached.timestamp < 10000) {
    // Request within 10 seconds - likely duplicate
    console.log(`[DEBOUNCE] Duplicate request detected for key: ${key}`);
    console.log(`[DEBOUNCE] Returning cached response from ${Date.now() - cached.timestamp}ms ago`);
    return res.json(cached.response);
  }

  // Intercept res.json to cache the response
  const originalJson = res.json.bind(res);
  res.json = function(data) {
    if (data.success) {
      // Only cache successful responses
      requestCache.set(key, {
        response: data,
        timestamp: Date.now()
      });
      console.log(`[DEBOUNCE] Cached response for key: ${key}`);
    }
    return originalJson(data);
  };

  next();
}

/**
 * Clear debounce cache (useful for testing)
 */
function clearDebounceCache() {
  requestCache.clear();
  console.log('[DEBOUNCE] Cache cleared');
}

module.exports = {
  debounceMiddleware,
  clearDebounceCache
};
