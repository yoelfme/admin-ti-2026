import { Hono } from 'hono'

export type Stage = {
  id: string
  name: string
  description: string
  tool: string
}

export const stages: Stage[] = [
  {
    id: 'install',
    name: 'Install dependencies',
    description: 'Restore the pnpm store from cache, then pnpm install --frozen-lockfile.',
    tool: 'pnpm/action-setup@v4 + actions/setup-node@v6',
  },
  {
    id: 'test',
    name: 'Run tests',
    description: 'Execute the Vitest suite against the Hono app via app.request().',
    tool: 'vitest run',
  },
  {
    id: 'build',
    name: 'Build Docker image',
    description: 'Multi-stage build on node:24-alpine, baking GIT_SHA at build time.',
    tool: 'docker/build-push-action@v5 (buildx)',
  },
  {
    id: 'push',
    name: 'Push image to GHCR',
    description: 'Authenticate with GITHUB_TOKEN and push tags latest + sha-<short>.',
    tool: 'docker/login-action@v3 + ghcr.io',
  },
  {
    id: 'deploy',
    name: 'Deploy to Hetzner',
    description: 'SSH into <your server IP> and run docker compose pull && up -d.',
    tool: 'appleboy/ssh-action@v1.0.3',
  },
  {
    id: 'smoke',
    name: 'Smoke test',
    description: 'Curl the public /health endpoint and verify it returns the new SHA.',
    tool: 'curl -fsS',
  }
]

export const pipelineRoute = new Hono().get('/', (c) => c.json({ stages }))
