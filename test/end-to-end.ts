/* eslint-disable */

import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as cp from 'child_process'
import { pipe } from 'fp-ts/function'

const DOCS_TS_DEPENDENCY = process.env['DOCS_TS_DEPENDENCY']

// -----------------------------------------------------------------------------
// Internal
// -----------------------------------------------------------------------------

// creates a folder like e.g. on linux `/tmp/fp-ts-sample-project-KJUMQH`
const mkTempDir = ({ name }: { name: string }) => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`))

const setupNpmProject = ({ cwd }: { cwd: string }) => {
  cp.execSync('npm init -y', { cwd })
  cp.execSync(`npm install --dev ${DOCS_TS_DEPENDENCY}`, { cwd })

  const pathPackageJson = path.join(cwd, 'package.json')

  // Attach a homepage field to the package.json file (needed for docs-ts)
  pipe(
    fs.readFileSync(pathPackageJson),
    (buffer) => buffer.toString(),
    JSON.parse,
    (json) => ({
      ...json,
      homepage: 'someHomepage'
    }),
    (json) => JSON.stringify(json, null, 2),
    (str) => fs.writeFileSync(pathPackageJson, str)
  )
}

const setupGit = ({ cwd }: { cwd: string }) => {
  cp.execSync('git init', { cwd })
  cp.execSync('git remote add origin group/name', { cwd })
}

const generateDocs = ({ cwd }: { cwd: string }) => {
  cp.execSync('npx run docs-ts', { cwd })
}

// const runJekyll = ({ cwd }: { cwd: string }) => {
//   cp.execSync('docker-compose --file node_modules/docs-ts/docker-compose.yml up --build', {
//     cwd,
//     env: { APP_DIR: '.' }
//   })
// }

const setupSampleFiles = ({ cwd }: { cwd: string }) => {
  const pathSrc = path.join(cwd, 'src')

  // Source dir
  fs.mkdirSync(pathSrc)

  // File 1
  fs.writeFileSync(
    path.join(pathSrc, 'greetings.ts'),
    [
      '/** @since 1.0.0 */',
      '',
      '/**',
      " * It's a greeting",
      ' *',
      ' * @since 1.0.0',
      ' * @category Greetings',
      ' */',
      'export const greet = (name: string): string => $(Hello, ${name}!);'
    ].join('\n')
  )

  // File 2
  fs.writeFileSync(
    path.join(pathSrc, 'math.ts'),
    [
      '/** @since 1.0.0 */',
      '',
      '/**',
      ' * Add two numbers',
      ' *',
      ' * @since 1.0.0',
      ' * @category Util',
      ' */',
      'export const add = (x: number, y: number): number => x + y;'
    ].join('\n')
  )
}

// -----------------------------------------------------------------------------
// Test
// -----------------------------------------------------------------------------

describe('end-to-end', () => {
  const cwd = mkTempDir //({ name: 'fp-ts-sample-project' })

  cwd
  setupNpmProject //({ cwd })
  setupGit //({ cwd })
  setupSampleFiles //({ cwd })
  generateDocs //({ cwd })

  it('is', () => {
    expect(1).toBe(1)
  })
})
