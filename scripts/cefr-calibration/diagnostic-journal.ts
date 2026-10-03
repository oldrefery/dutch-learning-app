import { randomUUID } from 'node:crypto'
import {
  closeSync,
  fsyncSync,
  lstatSync,
  openSync,
  realpathSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join, resolve, sep } from 'node:path'
import type { DiagnosticExecution } from './diagnostic-execution.ts'
import { privateBytes } from './diagnostic-private-files.ts'

const fail = (): never => {
  throw new Error('Invalid diagnostic execution: journal_binding')
}
export const validateJournalPath = (path: string, runDir: string): string => {
  const resolved = resolve(path)
  const physicalPath = join(realpathSync(dirname(resolved)), basename(resolved))
  const physicalRun = join(realpathSync(dirname(runDir)), basename(runDir))
  const parent = lstatSync(dirname(resolved))
  if (
    resolved !== path ||
    physicalPath === physicalRun ||
    physicalPath.startsWith(`${physicalRun}${sep}`) ||
    !parent.isDirectory() ||
    parent.mode & 0o022 ||
    (process.getuid && parent.uid !== process.getuid())
  )
    return fail()
  return resolved
}
const fileIdentity = (path: string, directory: boolean) => {
  const stat = lstatSync(path)
  if (
    (directory ? !stat.isDirectory() : !stat.isFile()) ||
    stat.mode & 0o077 ||
    (process.getuid && stat.uid !== process.getuid())
  )
    return fail()
  return { dev: stat.dev, ino: stat.ino, birthtime_ms: stat.birthtimeMs }
}
const identity = (execution: DiagnosticExecution) => ({
  namespace: 'dictionary-cefr-journal-binding-v1',
  execution_sha256: execution.sha256,
  run_id: execution.runId,
  run_dir: execution.runDir,
  directory: fileIdentity(execution.runDir, true),
  database: fileIdentity(join(execution.runDir, 'diagnostic.sqlite'), false),
})
const readBinding = (execution: DiagnosticExecution): string => {
  const raw: unknown = JSON.parse(
    privateBytes(execution.journalBindingPath, 4096).toString('utf8')
  )
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail()
  const { nonce, ...bound } = raw as Record<string, unknown>
  if (
    typeof nonce !== 'string' ||
    !/^[a-f0-9-]{36}$/.test(nonce) ||
    JSON.stringify(bound) !== JSON.stringify(identity(execution))
  )
    return fail()
  return nonce
}
export const assertJournalBinding = (
  execution: DiagnosticExecution,
  nonce: string
): void => {
  if (readBinding(execution) !== nonce) fail()
}
// The immutable consumption record lives outside the run directory. Missing,
// truncated or replaced journals cannot silently mint another spending allowance.
export const bindJournal = (
  execution: DiagnosticExecution
): { created: boolean; nonce: string } => {
  validateJournalPath(execution.journalBindingPath, execution.runDir)
  const binding = identity(execution)
  let fd: number
  try {
    fd = openSync(execution.journalBindingPath, 'wx', 0o600)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    return { created: false, nonce: readBinding(execution) }
  }
  const nonce = randomUUID()
  try {
    writeFileSync(fd, JSON.stringify({ ...binding, nonce }))
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
  const directory = openSync(dirname(execution.journalBindingPath), 'r')
  try {
    fsyncSync(directory)
  } finally {
    closeSync(directory)
  }
  return { created: true, nonce }
}
