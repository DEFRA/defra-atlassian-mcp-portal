import fs from 'node:fs'

function createAssetPathResolver ({
  manifestPath,
  assetPath,
  isProduction = false
}) {
  if (!fs.existsSync(manifestPath)) {
    if (isProduction) {
      throw new Error(`Vite manifest file not found at ${manifestPath}`)
    }

    console.warn(`Vite manifest file not found at ${manifestPath}. Asset paths may not be resolved correctly.`)

    return (asset) => `${assetPath}/${asset}`
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

  return (asset) => {
    const manifestEntry = manifest[asset]
    const viteAsset = typeof manifestEntry === 'object'
      ? manifestEntry?.file
      : manifestEntry

    return `${assetPath}/${viteAsset ?? asset}`
  }
}

export {
  createAssetPathResolver
}
