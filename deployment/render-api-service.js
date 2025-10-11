/**
 * Render API Service
 *
 * Provides integration with Render.com's API for programmatic
 * environment variable updates and service management.
 *
 * API Documentation: https://api-docs.render.com/
 *
 * Usage:
 *   const RenderAPI = require('./services/render-api');
 *   const api = new RenderAPI(process.env.RENDER_API_KEY);
 *   await api.updateEnvVars(serviceId, { KEY: 'value' });
 */

const https = require('https');

class RenderAPI {
  /**
   * Create a new Render API client
   * @param {string} apiKey - Render API key
   */
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'api.render.com';
    this.version = 'v1';
  }

  /**
   * Make an authenticated API request to Render
   * @param {string} method - HTTP method (GET, POST, PUT, DELETE)
   * @param {string} path - API endpoint path
   * @param {Object|null} body - Request body (for POST/PUT)
   * @returns {Promise<Object>} API response
   */
  async request(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.baseUrl,
        port: 443,
        path: `/${this.version}${path}`,
        method: method,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const parsed = data ? JSON.parse(data) : {};

            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(
                `Render API error (${res.statusCode}): ${parsed.message || data}`
              ));
            }
          } catch (e) {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              // Success but no JSON response
              resolve({});
            } else {
              reject(new Error(`Failed to parse response: ${data}`));
            }
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });

      if (body) {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }

  /**
   * Get service details
   * @param {string} serviceId - Render service ID
   * @returns {Promise<Object>} Service details
   */
  async getService(serviceId) {
    return this.request('GET', `/services/${serviceId}`);
  }

  /**
   * List all services
   * @returns {Promise<Array>} List of services
   */
  async listServices() {
    return this.request('GET', '/services');
  }

  /**
   * Get environment variables for a service
   * @param {string} serviceId - Render service ID
   * @returns {Promise<Array>} List of environment variables
   */
  async getEnvVars(serviceId) {
    return this.request('GET', `/services/${serviceId}/env-vars`);
  }

  /**
   * Update environment variables for a service
   * @param {string} serviceId - Render service ID
   * @param {Object} envVars - Object with key-value pairs to update
   * @returns {Promise<Object>} Updated environment variables
   */
  async updateEnvVars(serviceId, envVars) {
    // Convert object to Render API format
    const envVarArray = Object.entries(envVars).map(([key, value]) => ({
      key,
      value: String(value)
    }));

    return this.request(
      'PUT',
      `/services/${serviceId}/env-vars`,
      envVarArray
    );
  }

  /**
   * Update a single environment variable
   * @param {string} serviceId - Render service ID
   * @param {string} key - Environment variable key
   * @param {string} value - Environment variable value
   * @returns {Promise<Object>} Updated environment variable
   */
  async updateEnvVar(serviceId, key, value) {
    return this.request(
      'PUT',
      `/services/${serviceId}/env-vars/${key}`,
      { value: String(value) }
    );
  }

  /**
   * Delete an environment variable
   * @param {string} serviceId - Render service ID
   * @param {string} key - Environment variable key to delete
   * @returns {Promise<Object>} Deletion confirmation
   */
  async deleteEnvVar(serviceId, key) {
    return this.request(
      'DELETE',
      `/services/${serviceId}/env-vars/${key}`
    );
  }

  /**
   * Restart a service
   * @param {string} serviceId - Render service ID
   * @returns {Promise<Object>} Restart confirmation
   */
  async restartService(serviceId) {
    return this.request(
      'POST',
      `/services/${serviceId}/restart`,
      {}
    );
  }

  /**
   * Suspend a service
   * @param {string} serviceId - Render service ID
   * @returns {Promise<Object>} Suspend confirmation
   */
  async suspendService(serviceId) {
    return this.request(
      'POST',
      `/services/${serviceId}/suspend`,
      {}
    );
  }

  /**
   * Resume a suspended service
   * @param {string} serviceId - Render service ID
   * @returns {Promise<Object>} Resume confirmation
   */
  async resumeService(serviceId) {
    return this.request(
      'POST',
      `/services/${serviceId}/resume`,
      {}
    );
  }

  /**
   * Get service logs
   * @param {string} serviceId - Render service ID
   * @param {Object} options - Log options (limit, startTime, endTime)
   * @returns {Promise<Array>} Service logs
   */
  async getLogs(serviceId, options = {}) {
    const queryParams = new URLSearchParams();

    if (options.limit) queryParams.append('limit', options.limit);
    if (options.startTime) queryParams.append('startTime', options.startTime);
    if (options.endTime) queryParams.append('endTime', options.endTime);

    const query = queryParams.toString();
    const path = `/services/${serviceId}/logs${query ? '?' + query : ''}`;

    return this.request('GET', path);
  }

  /**
   * Get service deploys
   * @param {string} serviceId - Render service ID
   * @returns {Promise<Array>} List of deploys
   */
  async getDeploys(serviceId) {
    return this.request('GET', `/services/${serviceId}/deploys`);
  }

  /**
   * Trigger a new deploy
   * @param {string} serviceId - Render service ID
   * @param {string} clearCache - Whether to clear build cache
   * @returns {Promise<Object>} Deploy details
   */
  async triggerDeploy(serviceId, clearCache = false) {
    return this.request(
      'POST',
      `/services/${serviceId}/deploys`,
      { clearCache }
    );
  }
}

/**
 * Helper function to detect if running on Render
 * @returns {boolean} True if running on Render
 */
function isRunningOnRender() {
  return !!(
    process.env.RENDER ||
    process.env.RENDER_SERVICE_ID ||
    process.env.RENDER_INSTANCE_ID
  );
}

/**
 * Get current service ID from Render environment
 * @returns {string|null} Service ID or null if not on Render
 */
function getCurrentServiceId() {
  return process.env.RENDER_SERVICE_ID || null;
}

/**
 * Create a Render API client from environment variables
 * @returns {RenderAPI|null} API client or null if not configured
 */
function createFromEnv() {
  const apiKey = process.env.RENDER_API_KEY;

  if (!apiKey) {
    console.warn('[Render API] No RENDER_API_KEY found in environment');
    return null;
  }

  return new RenderAPI(apiKey);
}

module.exports = RenderAPI;
module.exports.isRunningOnRender = isRunningOnRender;
module.exports.getCurrentServiceId = getCurrentServiceId;
module.exports.createFromEnv = createFromEnv;
