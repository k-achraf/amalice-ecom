import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { brotliCompressSync, gzipSync, constants } from 'node:zlib'

// The rrweb session recorder (@rrweb/record, UMD build, defines window.rrwebRecord). It is NOT part of the
// page: client.js injects it only after the visitor first interacts (or after a few seconds), so it never
// competes with first paint. Served from this server, pre-compressed once, cached forever under a hashed URL.
const SOURCE = readFileSync(join(__dirname, '..', 'node_modules', '@rrweb', 'record', 'dist', 'record.umd.min.cjs'))

const hash = createHash('sha1').update(SOURCE).digest('hex').slice(0, 10)

export const RECORDER_PATH = '/rr.js'
export const RECORDER_URL = `${RECORDER_PATH}?v=${hash}`

export const recorder = {
  identity: SOURCE,
  br: brotliCompressSync(SOURCE, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }),
  gzip: gzipSync(SOURCE, { level: 9 })
}
