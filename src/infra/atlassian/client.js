import { config } from '../../config/config.js'

/**
 * AtlassianMcpError - Error class for unexpected Atlassian MCP API responses
 */
class AtlassianMcpError extends Error {
  constructor (message, statusCode) {
    super(message)
    this.name = 'AtlassianMcpError'
    this.statusCode = statusCode
  }

  static fromResponse (method, path, response) {
    const message =
      `Atlassian API ${method} ${path} ` +
      `failed: ${response.status} ${response.statusText}`

    return new AtlassianMcpError(message, response.status)
  }
}

/**
 * RequestOptions - Options for the request function
 * @typedef {Object} RequestOptions
 * @property {string} [method] - The HTTP method (default: 'GET')
 * @property {Object<string, any>?} [body] - The request body
 * @property {string} [userId] - The user ID for authentication
 * @property {Object<string, string>?} [headers] - Additional headers
 * @property {number[]} [expected] - List of expected non-ok status codes that should be returned as {ok:false} rather than thrown
 */

class AtlassianClient {
  /**
   * Create a new Atlassian API client
   * @param {string} [baseUrl] - The base URL for the API (defaults to config)
   */
  constructor (baseUrl) {
    this.baseUrl = baseUrl || config.get('atlassianMcp.url')
  }

  /**
   * Make an HTTP request to the Atlassian MCP API
   *
   * @param {string} path - The API endpoint path
   * @param {RequestOptions} [options] - The request options
   * @returns {Promise<{ok: boolean, status: number, data: any}>} - The response object
   * @throws {AtlassianMcpError} - When response is not ok and status is not in expected list
   */
  async request (path, options = {}) {
    const method = options.method || 'GET'
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        'X-User-Id': options.userId,
        ...options.headers
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    })

    let data = null
    try {
      data = await response.json()
    } catch {
      data = null
    }

    if (response.ok) {
      return { ok: true, status: response.status, data }
    }

    const expected = options.expected || []

    if (expected.includes(response.status)) {
      return { ok: false, status: response.status, data: null }
    }

    throw AtlassianMcpError.fromResponse(method, path, response)
  }
}

const atlassianClient = new AtlassianClient()

export {
  AtlassianClient,
  AtlassianMcpError,
  atlassianClient
}
