// NodeJS script to create the icon components modules:
//   src/icons/icons.js
//   src/icons/plugin.js
//   src/icons/icons.d.ts
//
// Source is bootstrap-icons/icons

'use strict'

const fs = require('fs').promises
const path = require('path')
const _template = require('lodash/template')
const { pascalCase } = require('../src/utils/string')

const bootstrapIconsBase = path.dirname(require.resolve('bootstrap-icons/package.json'))
const bootstrapIconsDir = path.join(bootstrapIconsBase, 'icons/')
const bsIconsMetaFile = path.join(bootstrapIconsBase, 'package.json')

const bvBase = path.resolve(__dirname, '..')
const bvIconsBase = path.join(bvBase, 'src', 'icons')
const iconsFile = path.resolve(bvIconsBase, 'icons.js')
const pluginFile = path.resolve(bvIconsBase, 'plugin.js')
const typesFile = path.resolve(bvIconsBase, 'icons.d.ts')
const bvIconsPkgFile = path.resolve(bvIconsBase, 'package.json')

// --- Constants ---

// Bootstrap Icons package.json
const bsIconsPkg = require(bsIconsMetaFile)

// BootstrapVue icons package.json
const bvIconsPkg = require(bvIconsPkgFile)

if (bvIconsPkg.meta['bootstrap-icons-version'] === bsIconsPkg.version) {
  // Exit early of no changes in bootstrap-icons version
  // Should also test if `src/icons/helper/make-icons.js` has changed (i.e. new props)
  // console.log('  No changes detected in bootstrap-icons version')
  // Commented out until this build process is stabilized
  // exit 0
}

// Template for `src/icons/icons.js`
const iconsTemplateFn = _template(`// --- BEGIN AUTO-GENERATED FILE ---
//
// @IconsVersion: <%= version %>
// @Generated: <%= created %>
//
// This file is generated on each build. Do not edit this file!

/*!
 * BootstrapVue Icons, generated from Bootstrap Icons <%= version %>
 *
 * @link <%= homepage %>
 * @license <%= license %>
 * https://github.com/twbs/icons/blob/master/LICENSE.md
 */

import { makeIcon } from './helpers/make-icon'

// --- BootstrapVue custom icons ---

export const BIconBlank = /*#__PURE__*/ makeIcon('Blank', '')

// --- Bootstrap Icons ---
<% componentNames.forEach(component => { %>
// eslint-disable-next-line
export const <%= component %> = /*#__PURE__*/ makeIcon(
  '<%= icons[component].name %>',
  '<%= icons[component].content %>'
)
<% }) %>
// --- END AUTO-GENERATED FILE ---
`)

// Template for `src/icons/plugin.js`
const pluginTemplateFn = _template(`// --- BEGIN AUTO-GENERATED FILE ---
//
// @IconsVersion: <%= version %>
// @Generated: <%= created %>
//
// This file is generated on each build. Do not edit this file!

import { pluginFactoryNoConfig } from '../utils/plugins'

// Icon helper component
import { BIcon } from './icon'

// Icon stacking component
import { BIconstack } from './iconstack'

import {
  // BootstrapVue custom icons
  BIconBlank,
  // Bootstrap icons
  <%= componentNames.join(',\\n  ') %>
} from './icons'

// Icon component names for used in the docs
export const iconNames = [
  // BootstrapVue custom icon component names
  'BIconBlank',
  // Bootstrap icon component names
  <%= componentNames.map(n => ("'" + n + "'")).join(',\\n  ') %>
]

// Export the icons plugin
export const IconsPlugin = /*#__PURE__*/ pluginFactoryNoConfig({
  components: {
    // Icon helper component
    BIcon,
    // Icon stacking component
    BIconstack,
    // BootstrapVue custom icon components
    BIconBlank,
    // Bootstrap icon components
    <%= componentNames.join(',\\n    ') %>
  }
})

// Export the BootstrapVueIcons plugin installer
// Mainly for the stand-alone bootstrap-vue-icons.xxx.js builds
export const BootstrapVueIcons = /*#__PURE__*/ pluginFactoryNoConfig(
  { plugins: { IconsPlugin } },
  { NAME: 'BootstrapVueIcons' }
)

// --- END AUTO-GENERATED FILE ---
`)

// Template for `src/icons/icons.d.ts`
const typesTemplateFn = _template(`// --- BEGIN AUTO-GENERATED FILE ---
//
// @IconsVersion: <%= version %>
// @Generated: <%= created %>
//
// This file is generated on each build. Do not edit this file!

import Vue from 'vue'
import { BvComponent } from '../'

// --- BootstrapVue custom icons ---

export declare class BIconBlank extends BvComponent {}

// --- Bootstrap Icons ---
<% componentNames.forEach(component => { %>
export declare class <%= component %> extends BvComponent {}
<% }) %>
// --- END AUTO-GENERATED FILE ---
`)

// --- Utility methods ---

// Parses a single SVG File
const processFile = (file, data) =>
  new Promise((resolve, reject) => {
    file = path.join(bootstrapIconsDir, file)
    if (path.extname(file) !== '.svg') {
      resolve()
      return
    }
    const name = pascalCase(path.basename(file, '.svg'))
    const componentName = `BIcon${name}`

    fs.readFile(file, 'utf8')
      .then(svg => {
        const content = svg
          // Remove <svg ...> and </svg>
          .replace(/<svg[^>]+>/i, '')
          .replace(/<\/svg>/i, '')
          // Remove whitespace between elements
          .replace(/>\s+</g, '><')
          // Fix broken stroke colors in some components
          // Might be fixed in 1.0.0-alpha3 release
          .replace(' stroke="#000"', ' stroke="currentColor"')
          // Remove leading/trailing whitespace
          .trim()
        // Add to the iconsData object
        data.icons[componentName] = { name, content }
        data.componentNames.push(componentName)
        // Resolve
        resolve()
      })
      .catch(error => reject(error))
  })

// Method to generate the updated `package.json` content
const updatePkgMeta = data => {
  // Create a semi-deep clone of the current `package.json`
  const newPkg = { ...bvIconsPkg, meta: { ...bvIconsPkg.meta } }
  // Grab current component entries array and filter out auto-generated entries
  const metaComponents = bvIconsPkg.meta.components.filter(c => !c['auto-gen'])
  // Grab the props definition array from `BIcon` and filter out `icon` prop
  const iconProps = metaComponents
    .find(m => m.component === 'BIcon')
    .props.filter(p => p.prop !== 'icon')
  // Build the icon component entries
  const iconMeta = data.componentNames.map(name => {
    return {
      component: name,
      'auto-gen': `bootstrap-icons ${data.version}`,
      props: iconProps
    }
  })
  // Update the package components meta info
  newPkg.meta.components = [...metaComponents, ...iconMeta]
  // Update the bootstrap-icons-version reference
  newPkg.meta['bootstrap-icons-version'] = data.version
  // Return the updated `package.json` as a json string
  return `${JSON.stringify(newPkg, null, 2)}\n`
}

// --- Main process ---
const main = async () => {
  // Information needed in the templates
  const today = new Date()
  const data = {
    version: bsIconsPkg.version,
    license: bsIconsPkg.license,
    homepage: bsIconsPkg.homepage,
    created: today.toISOString(),
    componentNames: [],
    icons: {}
  }

  console.log(`  Reading SVGs from bootstrap-icons version ${data.version}`)

  // Read in the list of SVG Files
  const files = await fs.readdir(bootstrapIconsDir)

  // Process the SVG Data for all files
  await Promise.all(files.map(file => processFile(file, data)))

  // Sort the icon component names
  data.componentNames = data.componentNames.sort()

  console.log(`  Read ${data.componentNames.length} SVGs...`)

  // Write out the files
  console.log('  Creating icon components...')
  await fs.writeFile(iconsFile, iconsTemplateFn(data), 'utf8')
  console.log(`  Wrote to ${iconsFile}`)
  console.log('  Creating icon plugin...')
  await fs.writeFile(pluginFile, pluginTemplateFn(data), 'utf8')
  console.log(`  Wrote to ${pluginFile}`)
  console.log('  Creating type declarations...')
  await fs.writeFile(typesFile, typesTemplateFn(data), 'utf8')
  console.log(`  Wrote to ${typesFile}`)
  console.log('  Updating icons meta info...')
  await fs.writeFile(bvIconsPkgFile, updatePkgMeta(data), 'utf8')
  console.log(`  Wrote to ${bvIconsPkgFile}`)
}

main()