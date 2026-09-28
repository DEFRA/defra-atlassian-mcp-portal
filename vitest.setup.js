// Default-on for tests: AI content visible. Tests that exercise the gated
// state (e.g. controller-gated.test.js) override this in their own beforeAll.
process.env.ATLASSIAN_MCP_URL = 'http://localhost:8086'

process.env.SESSION_COOKIE_PASSWORD = 'the-password-must-be-at-least-32-characters-long'
process.env.REDIS_USERNAME = 'user'
process.env.REDIS_PASSWORD = 'pass'
process.env.AUTH_PROVIDER = 'local'
process.env.ENTRA_TENANT_ID = 'fake-tenant-id'
process.env.ENTRA_CLIENT_ID = 'fake-client-id'
process.env.ENTRA_CLIENT_SECRET = 'fake-client-secret'
process.env.ENTRA_REDIRECT_HOST = 'http://localhost:3000'
