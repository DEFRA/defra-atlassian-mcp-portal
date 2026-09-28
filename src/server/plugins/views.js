import path from 'node:path'
import fs from 'node:fs'

import hapiVision from '@hapi/vision'
import nunjucks from 'nunjucks'

import { config } from '../../config/config.js'
import { productDisplay, orderedProducts } from '../../constants/products.js'
import { spaceStatusDisplay, unknownSpaceStatusDisplay } from '../../constants/space-statuses.js'

const nunjucksEnvironment = nunjucks.configure(
  [
    'node_modules/govuk-frontend/dist',
    path.join(config.get('root'), './src/pages')
  ],
  {
    autoescape: true,
    throwOnUndefined: false,
    trimBlocks: true,
    lstripBlocks: true
  }
)

// Register common display constants as Nunjucks globals so templates and
// component macros (e.g. status-tag.njk) can access consistent labels and
// classes without importing JS in every template.
nunjucksEnvironment.addGlobal('spaceStatusDisplay', spaceStatusDisplay)
nunjucksEnvironment.addGlobal('unknownSpaceStatusDisplay', unknownSpaceStatusDisplay)
nunjucksEnvironment.addGlobal('productDisplay', productDisplay)
nunjucksEnvironment.addGlobal('orderedProducts', orderedProducts)

function loadManifest () {
  const manifestPath = path.join(
    config.get('root'),
    '.public/.vite/manifest.json'
  )

  if (!fs.existsSync(manifestPath)) {
    if (config.get('env') === 'production') {
      throw new Error(`Vite manifest file not found at ${manifestPath}`)
    }

    console.warn(`Vite manifest file not found at ${manifestPath}. Asset paths may not be resolved correctly.`)

    return {}
  }

  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
}

const aceSlackChannel = config.get('aceSlackChannel')
const assetPath = config.get('assetPath')
const serviceName = config.get('serviceName')

const viteManifest = loadManifest()

const viewPlugin = {
  plugin: hapiVision,
  options: {
    engines: {
      njk: {
        compile (src, options) {
          const template = nunjucks.compile(src, options.environment)

          return (context) => template.render(context)
        }
      }
    },
    compileOptions: {
      environment: nunjucksEnvironment
    },
    relativeTo: config.get('root'),
    path: 'src/pages',
    isCached: config.get('env') === 'production',
    context: (request) => ({
      assetPath: `${assetPath}/assets`,
      getAssetPath (asset) {
        const manifestEntry = viteManifest?.[asset]

        const viteAsset = typeof manifestEntry === 'object'
          ? manifestEntry?.file
          : manifestEntry

        return `${assetPath}/${viteAsset ?? asset}`
      },
      serviceName,
      // Blankie generates nonces when configured with generateNonces: true.
      // `blankie.nonces` is an object like { script, style }, but the template
      // expects the script nonce string itself.
      cspNonce: request?.plugins?.blankie?.nonces?.script,
      aceSlackChannel,
      isAuthenticated: Boolean(request?.auth?.isAuthenticated),
      userDisplayName: request?.auth?.credentials?.profile?.displayName ?? null,
      userEmail: request?.auth?.credentials?.profile?.email ?? null,
      currentUrl: request?.path ?? null
    })
  }
}

export { viewPlugin }
