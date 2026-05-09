# Week 14: CI/CD Showcase — Hono on Hetzner via GitHub Actions

A tiny Node.js + [Hono](https://hono.dev) application whose **only job is to make the CI/CD pipeline visible**. Every push to `main` runs install → test → build → push → deploy → smoke-test, ending with a fresh container running on a Hetzner VPS at `<your server IP>`.

The interesting part is the pipeline, not the app. The app exists so we have something concrete to ship.

---

## Architecture

```mermaid
flowchart LR
    Dev[Developer]
    subgraph gh [GitHub]
        Repo[(Repository)]
        Runner[Actions runner ubuntu-latest]
        GHCR[(ghcr.io image registry)]
    end
    subgraph hetzner [Hetzner VPS <your server IP>]
        Compose[docker compose]
        Container[week14-app container]
    end
    Browser[Browser]

    Dev -->|git push| Repo
    Repo -->|trigger workflow| Runner
    Runner -->|docker push| GHCR
    Runner -->|ssh + compose pull| Compose
    Compose -->|pulls image| GHCR
    Compose --> Container
    Browser -->|"http://<your server IP>/"| Container
```

| Component | Role |
|-----------|------|
| **GitHub repo** | Source of truth; `push` to `main` is the deploy trigger. |
| **Actions runner** | Ephemeral Ubuntu VM that runs the three pipeline jobs. |
| **GHCR** (`ghcr.io`) | Stores the built image. Authenticated with the built-in `GITHUB_TOKEN`. |
| **Hetzner VPS** | Runs `docker compose` from `/opt/week-14/compose.yml`. Exposes port `80`. |
| **`week14-app`** | The Hono container, listening on `:3000`, mapped to host `:80`. |

---

## The pipeline

```mermaid
flowchart LR
    Push([push to main]) --> Install[npm ci]
    Install --> Test[vitest run]
    Test --> Build[docker buildx build]
    Build --> PushImg[push tags to ghcr.io]
    PushImg --> SSH[ssh to <your server IP>]
    SSH --> Pull[docker compose pull]
    Pull --> Up[docker compose up -d]
    Up --> Smoke[curl /health]
    Smoke --> Done([green check])
```

### Actors and order

```mermaid
sequenceDiagram
    autonumber
    participant Dev as Developer
    participant GH as GitHub
    participant R as Actions runner
    participant Reg as ghcr.io
    participant Srv as Hetzner <your server IP>

    Dev->>GH: git push origin main
    GH->>R: dispatch workflow ci-cd.yml
    R->>R: npm ci + npm test
    R->>R: docker buildx build (GIT_SHA baked in)
    R->>Reg: docker push :latest, :sha-abc1234
    R->>Srv: ssh deploy@<your server IP>
    Srv->>Reg: docker compose pull
    Reg-->>Srv: image layers
    Srv->>Srv: docker compose up -d (rolls container)
    R->>Srv: curl http://<your server IP>/health
    Srv-->>R: {"status":"ok","sha":"abc1234..."}
    R-->>GH: job success
```

### Container lifecycle on the host

```mermaid
stateDiagram-v2
    [*] --> Pulling: compose pull
    Pulling --> Starting: compose up -d
    Starting --> Healthy: HEALTHCHECK passes
    Starting --> Failed: HEALTHCHECK fails 3x
    Healthy --> Pulling: next deploy
    Failed --> Starting: restart unless-stopped
    Healthy --> [*]: docker compose down
```

---

## Per-stage breakdown

| Stage | What runs | Action / tool |
|-------|-----------|---------------|
| **Install** | Restore cache, then `pnpm install --frozen-lockfile` | [`pnpm/action-setup@v4`](https://github.com/pnpm/action-setup) + [`actions/setup-node@v6`](https://github.com/actions/setup-node) with `cache: pnpm` |
| **Test** | `pnpm test` → Vitest hits the Hono app via `app.request()` (no network) | `vitest@^4` |
| **Build** | Multi-stage Docker build on `node:24-alpine`, baking `GIT_SHA` as `ENV` | [`docker/build-push-action@v5`](https://github.com/docker/build-push-action) + `setup-buildx-action@v3` |
| **Tag** | Compute `latest` and `sha-<short>` | [`docker/metadata-action@v5`](https://github.com/docker/metadata-action) |
| **Push** | Authenticate against GHCR with `GITHUB_TOKEN`, push both tags | [`docker/login-action@v3`](https://github.com/docker/login-action) |
| **Deploy** | SSH into the VPS, `docker compose pull && up -d --remove-orphans`, prune old images | [`appleboy/ssh-action@v1.0.3`](https://github.com/appleboy/ssh-action) |
| **Smoke** | Loop `curl http://<your server IP>/health` up to 10× | `curl` |

PRs run only **Install + Test**. The `build-and-push` and `deploy` jobs are gated by `github.event_name == 'push' && github.ref == 'refs/heads/main'`.

---

## Required repository secrets

| Secret | Purpose | Example |
|--------|---------|---------|
| `SSH_HOST` | Hetzner box address | `<your server IP>` |
| `SSH_USER` | SSH user with `docker` group | `deploy` |
| `SSH_PRIVATE_KEY` | ed25519 private key matching `~/.ssh/authorized_keys` on the server | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `SSH_PORT` | SSH port | `22` |

`GITHUB_TOKEN` is provided automatically — no manual secret needed for GHCR.

---

## Server prerequisites (one-time setup on `<your server IP>`)

```bash
# 1. Install Docker Engine + Compose v2 (Debian/Ubuntu)
curl -fsSL https://get.docker.com | sh

# 2. Create a deploy user and add to the docker group
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG docker deploy

# 3. Authorize the CI public key
sudo -u deploy mkdir -p /home/deploy/.ssh
sudo -u deploy tee /home/deploy/.ssh/authorized_keys < ci-deploy.pub
sudo chmod 600 /home/deploy/.ssh/authorized_keys

# 4. Drop the production compose file
sudo mkdir -p /opt/week-14
sudo cp compose.yml /opt/week-14/compose.yml
sudo chown -R deploy:deploy /opt/week-14

# 5. Make the GHCR package public, OR pre-login on the host:
#    echo $PAT | docker login ghcr.io -u <user> --password-stdin
```

After that, every push to `main` redeploys automatically.

---

## Local quick start

```bash
cd week-14
pnpm install
pnpm test           # vitest run
pnpm dev            # tsx watch on :3000
```

Then visit:

- <http://localhost:3000/> — the rendered showcase page
- <http://localhost:3000/health> — JSON health
- <http://localhost:3000/api/pipeline> — JSON list of stages

### Reproduce the production image locally

```bash
docker build --build-arg GIT_SHA=$(git rev-parse HEAD) -t week-14 .
docker run --rm -p 3000:3000 week-14
curl -s localhost:3000/health
```

---

## Project layout

| Path | Purpose |
|------|---------|
| [`src/app.ts`](src/app.ts) | Hono app: `/`, `/health`, `/api/pipeline` |
| [`src/index.ts`](src/index.ts) | Boots `@hono/node-server` on `:3000` |
| [`src/routes/pipeline.ts`](src/routes/pipeline.ts) | Pipeline-stage data + JSON route |
| [`test/app.test.ts`](test/app.test.ts) | Vitest using `app.request()` |
| [`Dockerfile`](Dockerfile) | Multi-stage `node:24-alpine` build, healthcheck, non-root |
| [`compose.yml`](compose.yml) | Production compose (lives at `/opt/week-14/compose.yml` on the VPS) |
| [`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml) | The pipeline being showcased |

---

## Stack versions (May 2026)

| Layer | Version |
|------|---------|
| Node.js (Active LTS) | 24 |
| Hono | ^4.6 |
| `@hono/node-server` | ^1.13 |
| Vitest | ^4.1 |
| TypeScript | ^5.7 |
| `actions/checkout` | v6 |
| `actions/setup-node` | v6 |
| `docker/login-action` | v3 |
| `docker/metadata-action` | v5 |
| `docker/build-push-action` | v5 |
| `appleboy/ssh-action` | v1.0.3 |
