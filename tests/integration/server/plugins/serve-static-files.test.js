import fs from 'node:fs'
import path from 'node:path'
import { constants as statusCodes } from 'node:http2'

import { createServer } from '../../../../src/server/server.js'
import { config } from '../../../../src/config/config.js'

// The Vite manifest is build output (`.public/` is gitignored) and is required
// for this test to run — see `npm test`, which gates on `run-s lint build test:js`.
// Looking the asset up here (rather than hardcoding its content hash) means a
// rebuild that changes the hash doesn't break this test.
const FAVICON_SVG_SOURCE = 'node_modules/govuk-frontend/dist/govuk/assets/images/favicon.svg'

function getFaviconAssetUrl () {
  const manifestPath = path.join(config.get('root'), '.public/.vite/manifest.json')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

  return `${config.get('assetPath')}/${manifest[FAVICON_SVG_SOURCE].file}`
}

describe('serveStaticFiles', () => {
  let server

  describe('When secure context is disabled', () => {
    beforeEach(async () => {
      server = await createServer()
      await server.initialize()
    })

    afterEach(async () => {
      await server.stop({ timeout: 0 })
    })

    test('serves favicon at the expected path', async () => {
      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/favicon.ico'
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_NO_CONTENT)
    })

    test('serves assets from the public directory', async () => {
      const { statusCode } = await server.inject({
        method: 'GET',
        url: getFaviconAssetUrl()
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    })
  })
})
