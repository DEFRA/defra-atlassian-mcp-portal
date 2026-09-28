import { fileURLToPath } from 'node:url'

import { describe, test, expect, afterEach, vi } from 'vitest'

import { createAssetPathResolver } from '../../../../src/server/plugins/asset-path.js'

// A real manifest on disk, in the shape `vite build` writes, so nothing here
// has to mock `node:fs`.
const manifestPath = fileURLToPath(new URL('../../../fixtures/vite-manifest.json', import.meta.url))
const missingManifestPath = fileURLToPath(new URL('../../../fixtures/no-such-manifest.json', import.meta.url))

describe('createAssetPathResolver', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('resolves a source path to the content-hashed file Vite built', () => {
    const getAssetPath = createAssetPathResolver({ manifestPath, assetPath: '/public' })

    expect(getAssetPath('src/client/stylesheets/application.scss')).toBe(
      '/public/assets/applicationCss-hc2psTaB.css'
    )
  })

  test('serves the requested path unchanged when the manifest has no entry for it', () => {
    const getAssetPath = createAssetPathResolver({ manifestPath, assetPath: '/public' })

    expect(getAssetPath('src/client/images/unknown.png')).toBe(
      '/public/src/client/images/unknown.png'
    )
  })

  test('resolves a manifest entry written as a bare string', () => {
    const getAssetPath = createAssetPathResolver({ manifestPath, assetPath: '/public' })

    expect(getAssetPath('application.js')).toBe('/public/javascripts/application.abc123.js')
  })

  test('warns and serves unhashed paths when the manifest is missing outside production', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const getAssetPath = createAssetPathResolver({
      manifestPath: missingManifestPath,
      assetPath: '/public',
      isProduction: false
    })

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Vite manifest file not found')
    )
    expect(getAssetPath('src/client/javascripts/application.js')).toBe(
      '/public/src/client/javascripts/application.js'
    )
  })

  test('throws when the manifest is missing in production', () => {
    expect(() =>
      createAssetPathResolver({
        manifestPath: missingManifestPath,
        assetPath: '/public',
        isProduction: true
      })
    ).toThrow(/Vite manifest file not found at .*no-such-manifest\.json/)
  })
})
