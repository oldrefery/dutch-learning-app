// Compile only the real operator and its local pure dependencies for the owned
// SQLite child. No package installation, database substitution or network access.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const output = process.argv[2]
  ? resolve(process.argv[2])
  : join(
      root,
      'reports/shared-dictionary-cefr/d13a6-following-rollback-20261011/transpiled'
    )
mkdirSync(output, { recursive: true })
writeFileSync(join(output, 'package.json'), '{"type":"commonjs"}\n')
const seen = new Set()
function compile(path) {
  if (seen.has(path)) return
  seen.add(path)
  const name = relative(root, path)
  if (name.startsWith('..'))
    throw new Error('Fixture dependency outside repository')
  const target = join(output, name.replace(/\.ts$/, '.js'))
  mkdirSync(dirname(target), { recursive: true })
  let code = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: path,
  }).outputText
  for (const match of code.matchAll(/require\("([^"\n]+)"\)/g)) {
    const id = match[1]
    const dependency =
      id === '@woordenaar/domain'
        ? join(root, 'packages/domain/src/index.ts')
        : id.startsWith('.')
          ? resolve(dirname(path), `${id}.ts`)
          : null
    if (!dependency) throw new Error(`Unsupported fixture dependency: ${id}`)
    compile(dependency)
    if (id === '@woordenaar/domain') {
      const emitted = relative(
        dirname(target),
        join(output, 'packages/domain/src/index.js')
      ).replaceAll('\\', '/')
      code = code.replaceAll(
        `require("${id}")`,
        `require(${JSON.stringify(emitted.startsWith('.') ? emitted : `./${emitted}`)})`
      )
    }
  }
  writeFileSync(target, code)
}
compile(join(root, 'scripts/shared-dictionary/following-rollback.sqlite.ts'))
process.stdout.write(
  JSON.stringify({
    compiled_sources: seen.size,
    entry: join(
      output,
      'scripts/shared-dictionary/following-rollback.sqlite.js'
    ),
  }) + '\n'
)
