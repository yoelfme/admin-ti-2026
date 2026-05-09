import { describe, it, expect } from 'vitest'
import { app } from '../src/app.js'

describe('hono app', () => {
  it('GET /health returns ok', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { status: string; sha: string; uptime: number }
    expect(body.status).toBe('ok')
    expect(typeof body.sha).toBe('string')
    expect(body.uptime).toBeGreaterThanOrEqual(0)
  })

  it('GET /api/pipeline returns the six pipeline stages', async () => {
    const res = await app.request('/api/pipeline')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { stages: { id: string }[] }
    expect(body.stages.map((s) => s.id)).toEqual([
      'install',
      'test',
      'build',
      'push',
      'deploy',
      'smoke',
    ])
  })

  it('GET / renders HTML with the commit SHA', async () => {
    const res = await app.request('/')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/text\/html/)
    const text = await res.text()
    expect(text).toContain('CI/CD Showcase')
    expect(text).toContain('Build Docker image')
  })
})
