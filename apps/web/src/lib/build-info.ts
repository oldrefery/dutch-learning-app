import 'server-only'

import webPackage from '../../package.json'

export interface WebBuildInfo {
  branch: string | null
  commitSha: string | null
  environment: string
  framework: string
  host: string
  version: string
}

export const getWebBuildInfo = (): WebBuildInfo => ({
  branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
  commitSha: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
  environment: process.env.VERCEL_ENV ?? 'local',
  framework: `Next.js ${webPackage.dependencies.next}`,
  host: process.env.VERCEL_URL ?? 'localhost:3000',
  version: webPackage.version,
})
