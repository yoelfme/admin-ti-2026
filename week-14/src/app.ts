import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { pipelineRoute, stages } from './routes/pipeline.js'

const SHA = process.env.GIT_SHA ?? 'dev'
const startedAt = Date.now()

export const app = new Hono()

app.use('*', logger())

app.get('/', (c) =>
  c.html(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>CI/CD Showcase · ${SHA.slice(0, 7)}</title>
    <style>
      :root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, sans-serif; }
      body { max-width: 720px; margin: 3rem auto; padding: 0 1rem; line-height: 1.5; }
      h1 { margin-bottom: .25rem; }
      .sha { font-family: ui-monospace, monospace; opacity: .7; }
      ol { padding-left: 1.25rem; }
      li { margin: .75rem 0; }
      .tool { font-family: ui-monospace, monospace; font-size: .85em; opacity: .8; }
    </style>
  </head>
  <body>
    <h1>CI/CD Showcase</h1>
    <p class="sha">Running commit <code>${SHA}</code></p>
    <p>This page was rendered by the container that GitHub Actions just deployed to Hetzner.</p>
    <ol>
      ${stages
        .map(
          (s) =>
            `<li><strong>${s.name}</strong><br/>${s.description}<br/><span class="tool">${s.tool}</span></li>`,
        )
        .join('\n      ')}
    </ol>
    <p><a href="/api/pipeline">/api/pipeline</a> · <a href="/health">/health</a></p>
  </body>
</html>`,
  ),
)

app.get('/health', (c) =>
  c.json({
    status: 'ok',
    sha: SHA,
    uptime: Math.round((Date.now() - startedAt) / 1000),
  }),
)

app.route('/api/pipeline', pipelineRoute)
