import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Script } from 'node:vm'
import http from 'node:http'
import { execFileSync } from 'node:child_process'

// Visual-only fixture: real component source/global CSS; no server action executes.
const root = fileURLToPath(new URL('../../../../', import.meta.url))
const output = realpathSync(process.argv[2])
assert.equal(
  output,
  join(root, 'reports/shared-dictionary-cefr/d10-r4-repair-20261002')
)
const revision = process.argv[3] ?? 'working-tree'
assert(revision === 'working-tree' || /^[0-9a-f]{7,40}$/.test(revision))
const readSource = path =>
  revision === 'working-tree'
    ? readFileSync(path, 'utf8')
    : execFileSync('git', ['show', `${revision}:${relative(root, path)}`], {
        cwd: root,
        encoding: 'utf8',
      })
const require = createRequire(join(root, 'apps/web/package.json'))
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const ts = require('typescript')
const postcss = require('postcss')
const tailwind = require('@tailwindcss/postcss')
const paths = [
  'starter-pack/StarterPackImport',
  'sharing/SharedCollectionImport',
  'sharing/CollectionSharingPanel',
]
let actionState = null
let pending = false
const blockedAction = () => {
  throw new Error('Visual fixture cannot execute actions')
}
const load = relative => {
  const path = join(root, 'apps/web/src/features', `${relative}.tsx`)
  const compiled = ts.transpileModule(readSource(path), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: path,
  }).outputText
  const exports = {}
  const fixtureRequire = name => {
    if (name === 'next/link')
      return {
        default: props => React.createElement('a', props, props.children),
      }
    if (name === 'react')
      return {
        ...React,
        useActionState: (_action, initial) => [
          actionState ?? initial,
          blockedAction,
          pending,
        ],
      }
    if (name === './actions')
      return {
        importStarterPack: blockedAction,
        importSharedCollection: blockedAction,
        updateCollectionSharing: blockedAction,
      }
    if (name === './form-state')
      return {
        INITIAL_STARTER_PACK_IMPORT_STATE: { status: 'idle', message: null },
        INITIAL_SHARED_COLLECTION_IMPORT_STATE: {
          status: 'idle',
          message: null,
        },
      }
    if (name === './starter-pack-domain')
      return {
        NEW_STARTER_PACK_COLLECTION_ID: '__new_starter_pack_collection__',
      }
    assert(
      ['next/link', 'react/jsx-runtime'].includes(name),
      `Unexpected fixture dependency: ${name}`
    )
    return require(name)
  }
  new Script('(function(require,exports){' + compiled + '\n})', {
    filename: path,
  }).runInThisContext()(fixtureRequire, exports)
  return Object.values(exports)[0]
}
const [StarterPackImport, SharedCollectionImport, CollectionSharingPanel] =
  paths.map(load)
const collection = { id: 'visual-collection', name: 'Visual fixture' }
const entry = {
  entry: {
    entryId: 'visual-word',
    dutchLemma: 'kompas',
    article: 'het',
    partOfSpeech: 'noun',
    translations: { en: ['compass'], ru: [] },
  },
  isDuplicate: false,
  duplicateCollectionName: null,
}
const starter = {
  canCreateCollection: false,
  collections: [collection],
  entries: [entry],
  packId: 'visual-official',
  packTitle: 'Visual official pack',
  packVersion: '1.0.0',
}
const shared = {
  collectionName: 'Visual shared',
  collections: [collection],
  shareToken: 'visual-only',
  words: [
    {
      id: 'visual-word',
      dutchLemma: 'kompas',
      article: 'het',
      partOfSpeech: 'noun',
      translation: 'compass',
      isDuplicate: false,
      duplicateCollectionName: null,
    },
  ],
}
const success = {
  status: 'success',
  collectionId: collection.id,
  collectionName: collection.name,
  importedCount: 1,
  message: 'Visual fixture success',
}
const privateState = {
  isShared: false,
  message: null,
  shareUrl: null,
  status: 'idle',
}
const publishedState = {
  ...privateState,
  isShared: true,
  shareUrl: 'http://127.0.0.1:55400/visual-only',
}
const scenarios = [
  ['official-enabled', StarterPackImport, starter],
  [
    'official-duplicates',
    StarterPackImport,
    { ...starter, entries: [{ ...entry, isDuplicate: true }] },
  ],
  [
    'official-readonly-no-target',
    StarterPackImport,
    { ...starter, collections: [] },
  ],
  ['official-pending', StarterPackImport, starter, null, true],
  [
    'bundled-enabled',
    StarterPackImport,
    { ...starter, packId: 'visual-bundled', packTitle: 'Visual bundled' },
  ],
  [
    'bundled-duplicates',
    StarterPackImport,
    {
      ...starter,
      packId: 'visual-bundled',
      entries: [{ ...entry, isDuplicate: true }],
    },
  ],
  ['shared-enabled', SharedCollectionImport, shared],
  [
    'shared-duplicates',
    SharedCollectionImport,
    { ...shared, words: [{ ...shared.words[0], isDuplicate: true }] },
  ],
  ['shared-no-target', SharedCollectionImport, { ...shared, collections: [] }],
  ['shared-pending', SharedCollectionImport, shared, null, true],
  ['official-success', StarterPackImport, starter, success],
  ['shared-success', SharedCollectionImport, shared, success],
  [
    'sharing-private',
    CollectionSharingPanel,
    { collectionId: collection.id, initialState: privateState },
  ],
  [
    'sharing-private-pending',
    CollectionSharingPanel,
    { collectionId: collection.id, initialState: privateState },
    null,
    true,
  ],
  [
    'sharing-published',
    CollectionSharingPanel,
    { collectionId: collection.id, initialState: publishedState },
  ],
  [
    'sharing-published-pending',
    CollectionSharingPanel,
    { collectionId: collection.id, initialState: publishedState },
    null,
    true,
  ],
]
const markup = scenarios
  .map(([name, Component, props, state, isPending]) => {
    actionState = state ?? null
    pending = isPending ?? false
    return `<section data-scenario="${name}"><h2>${name}</h2>${renderToStaticMarkup(React.createElement(Component, props))}</section>`
  })
  .join('\n')
const cssPath = join(root, 'apps/web/src/app/globals.css')
const css = await postcss([tailwind({ base: join(root, 'apps/web') })]).process(
  readSource(cssPath),
  { from: cssPath }
)
mkdirSync(output, { recursive: true })
writeFileSync(join(output, 'fixture.css'), css.css)
writeFileSync(
  join(output, 'fixture.html'),
  `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><title>D10 contrast fixture</title></head><body><main style="max-width:960px;margin:24px auto;padding:16px"><h1>D10 action contrast</h1>${markup}</main></body></html>`
)
if (process.argv.includes('--generate-only')) process.exit(0)
const server = http.createServer((request, response) => {
  const name =
    request.url === '/fixture.css'
      ? 'fixture.css'
      : request.url === '/'
        ? 'fixture.html'
        : null
  if (!name || request.method !== 'GET') {
    response.writeHead(404)
    response.end()
    return
  }
  response.writeHead(200, {
    'content-type': name.endsWith('.css') ? 'text/css' : 'text/html',
    'cache-control': 'no-store',
  })
  response.end(readFileSync(join(output, name)))
})
server.listen(55400, '127.0.0.1', () => {
  writeFileSync(
    join(output, 'fixture-runner.json'),
    JSON.stringify({
      pid: process.pid,
      port: 55400,
      scenarios: scenarios.length,
      startedAt: new Date().toISOString(),
    })
  )
  console.log(
    'Read-only D10 contrast fixture listening on 127.0.0.1:55400; 16 source-rendered states, no backend.'
  )
})
process.on('SIGTERM', () => server.close())
