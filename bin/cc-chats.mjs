#!/usr/bin/env node
import { spawn } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageDir = resolve(__dirname, '..')
const require = createRequire(import.meta.url)
const nextBin = require.resolve('next/dist/bin/next')

const args = process.argv.slice(2)
const portIdx = args.findIndex((a) => a === '--port' || a === '-p')
const port = portIdx !== -1 ? args[portIdx + 1] : '3000'

console.log(`Starting cc-chats on http://localhost:${port}`)

const child = spawn(process.execPath, [nextBin, 'start', '--port', port], {
  cwd: packageDir,
  stdio: 'inherit',
})

child.on('exit', (code) => process.exit(code ?? 1))
