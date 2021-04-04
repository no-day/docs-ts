/* eslint-disable */

import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as cp from 'child_process'
import * as http from 'http'
import { pipe } from 'fp-ts/function'

// ---------------------------------------------------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------------------------------------------------

const REPO_ROOT = path.join(__dirname, '..')

// ---------------------------------------------------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Reads a file and tries to parse it as JSON
 */
const readJson = (filePath: string): any => pipe(fs.readFileSync(filePath), (buffer) => buffer.toString(), JSON.parse)

/**
 * Creates a NPM project in a OS specific temporary directory. Initializes fields that are required by `docs-ts`
 * Returns the file system location of the project.
 */
const setupNpmProject = (): string => {
  console.log('Setup NPM project')

  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'project'))

  const pathPackageJson = path.join(cwd, 'package.json')

  pipe(
    {
      name: 'my-package',
      version: '1.0.0',
      homepage: 'my-homepage'
    },
    (json) => JSON.stringify(json, null, 2),
    (str) => fs.writeFileSync(pathPackageJson, str)
  )

  return cwd
}

/**
 * Creates some sample typescript files with some JS-Doc tags
 */
const setupSampleFiles = ({ cwd }: { cwd: string }): void => {
  const pathSrc = path.join(cwd, 'src')

  // Source dir
  fs.mkdirSync(pathSrc)

  // File 1
  fs.copyFileSync(path.join(__dirname, 'fixtures/file1.ts'), path.join(cwd, 'src/file1.ts'))

  // File 2
  fs.copyFileSync(path.join(__dirname, 'fixtures/file1.ts'), path.join(cwd, 'src/file2.ts'))
}

/**
 * Spawns jekyll from a local project that has docs-ts installed.
 * Resolves the promise with a canceller.
 */
const startJekyll = ({ cwd }: { cwd: string }): Promise<() => void> =>
  new Promise((resolve, reject) => {
    const projectName = 'docs-ts'

    const dockerProcess = cp.spawn(
      '/usr/local/bin/docker-compose',
      ['--project-name', projectName, '--file', 'node_modules/docs-ts/docker-compose.yml', 'up', '--build'],
      {
        cwd,
        env: { PWD: cwd }
      }
    )

    const canceller = () =>
      // docker ignores SIGTERM's, so we need to shut it down like so:
      cp.execSync(`docker stop ${projectName}_jekyll_1`)

    let logging = ''

    dockerProcess.stdout.on('data', (data) => {
      logging += data.toString()
      console.log(data.toString())
      if (/Server running\.\.\./.test(logging)) resolve(canceller)
    })

    dockerProcess.stderr.on('data', (data) => console.error(data.toString()))

    dockerProcess.on('error', reject)
  })

/**
 * Tries to fetch a remote resource. Returning the HTTP status code in a Promise.
 */
const fetchStatus = (url: string): Promise<number> =>
  new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        res.statusCode ? resolve(res.statusCode) : reject()
      })
      .on('error', reject)
  })

// ---------------------------------------------------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------------------------------------------------

describe('docs-ts end-to-end', () => {
  describe('install docs-ts as a dependency in a NPM project', () => {
    const cwd = setupNpmProject()

    cp.execSync(`npm install --include=dev ${REPO_ROOT}`, { cwd })

    it('exists in the package.json file', () => {
      expect(pipe(path.join(cwd, 'package.json'), readJson, (json) => json?.dependencies['docs-ts'])).toBeTruthy()
    })

    it('installs the `docs-ts` binary', () => {
      expect(fs.existsSync(path.join(cwd, 'node_modules/.bin/docs-ts'))).toBe(true)
    })

    it('the installed binary can be executed', () => {
      expect(() => cp.execSync('npx docs-ts', { cwd })).not.toThrow()
    })
  })

  describe('generate docs', () => {
    const cwd = setupNpmProject()

    setupSampleFiles({ cwd })

    cp.execSync(`npm install --include=dev ${REPO_ROOT}`, { cwd })
    cp.execSync(`npx docs-ts`, { cwd })

    it('produces a `docs` folder', () => {
      expect(fs.existsSync(path.join(cwd, 'docs'))).toBe(true)
    })
  })

  describe('run jekyll locally', () => {
    jest.setTimeout(5 * 60 * 1000)

    const cwd = setupNpmProject()

    setupSampleFiles({ cwd })

    cp.execSync(`npm install --include=dev ${REPO_ROOT}`, { cwd })
    cp.execSync(`npx docs-ts`, { cwd })
    cp.execSync('git init', { cwd })
    cp.execSync('git remote add origin https://github.com/group/name', { cwd })

    it('produces all docker files', () => {
      expect(fs.existsSync(path.join(cwd, 'node_modules/docs-ts/Dockerfile'))).toBe(true)
      expect(fs.existsSync(path.join(cwd, 'node_modules/docs-ts/docker-compose.yml'))).toBe(true)
    })

    it('serves the documentation via HTTP', async () => {
      const killJekyll = await startJekyll({ cwd })

      expect(await fetchStatus('http://0.0.0.0:4000/something-wrong.ts.html')).toBe(404)

      expect(await fetchStatus('http://0.0.0.0:4000/modules/file1.ts.html')).toBe(200)
      expect(await fetchStatus('http://0.0.0.0:4000/modules/file2.ts.html')).toBe(200)

      killJekyll()
    })
  })
})
