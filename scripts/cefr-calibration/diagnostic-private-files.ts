import { constants, closeSync, fstatSync, openSync, readSync } from 'node:fs'
const fail = (code: string): never => {
  throw new Error(`Invalid diagnostic execution: ${code}`)
}
export const privateBytes = (path: string, max: number): Buffer => {
  let fd: number | undefined
  try {
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW)
    const stat = fstatSync(fd)
    if (
      !stat.isFile() ||
      stat.mode & 0o077 ||
      stat.size > max ||
      (process.getuid && stat.uid !== process.getuid())
    )
      return fail('private_file_required')
    const buffer = Buffer.alloc(max + 1)
    let length = 0,
      size = 0
    do {
      size = readSync(fd, buffer, length, buffer.length - length, null)
      length += size
    } while (size && length <= max)
    if (length > max) return fail('file_bound')
    return buffer.subarray(0, length)
  } catch {
    return fail('private_file_required')
  } finally {
    if (fd !== undefined) closeSync(fd)
  }
}
