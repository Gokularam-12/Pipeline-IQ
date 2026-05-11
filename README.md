# PipelineIQ — CI/CD Intelligence & Failure Reasoning Engine

![Node.js](https://img.shields.io/badge/Node.js-20-green) ![Redis](https://img.shields.io/badge/Redis-7-red) ![Ollama](https://img.shields.io/badge/LLM-TinyLlama-purple) ![MCP](https://img.shields.io/badge/MCP-Agent-blue) ![Grafana](https://img.shields.io/badge/Grafana-Dashboard-orange)

> "CI pipelines generate thousands of failure events but zero intelligence. PipelineIQ is the first reasoning layer on top of your pipeline — it learns failure patterns, predicts flaky tests before they block your team, and explains root causes in plain English."

---

## What it does

- Ingests every GitHub Actions build event via webhook
- Clusters failure signatures and detects flaky tests automatically
- Predicts flaky tests before they block your next build
- Explains root causes in plain English using local LLM (Ollama + TinyLlama)
- Alerts your Slack channel before builds break
- MCP Agent — Claude/Cursor can query your pipeline in natural language

---

## Architecture
GitHub Actions → Webhook → Express API → Redis Queue
↓
Pattern Engine (flaky detection)
↓
LLM Service (Ollama/TinyLlama)
↓
Slack Alerts + MCP Agent
↓
Prometheus → Grafana Dashboard

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| API Server | Node.js + Express |
| Storage | Redis |
| LLM | Ollama + TinyLlama (local, no OpenAI) |
| MCP Agent | @modelcontextprotocol/sdk |
| Metrics | Prometheus + prom-client |
| Visualization | Grafana |
| Process Manager | PM2 |
| CI | GitHub Actions |
| Containers | Docker Compose |

---

## Quick Start

### 1. Clone and install
```bash
git clone https://github.com/Gokularam-12/Pipeline-IQ.git
cd Pipeline-IQ
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your values
```

### 3. Start Redis
```bash
sudo service redis-server start
```

### 4. Start Ollama
```bash
ollama serve &
ollama pull tinyllama
```

### 5. Start with PM2
```bash
pm2 start ecosystem.config.js
pm2 save
```

### 6. Start monitoring stack
```bash
docker compose up -d prometheus grafana
```

### 7. Seed demo data
```bash
node scripts/seed.js
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/metrics` | Prometheus metrics |
| POST | `/webhook/ingest` | Ingest build event |
| POST | `/webhook/github` | GitHub Actions webhook |
| GET | `/api/analytics/stats` | Overall stats |
| GET | `/api/analytics/:repo/builds` | Recent builds |
| GET | `/api/analytics/:repo/flaky` | Flaky tests |
| GET | `/api/analytics/:repo/analysis/:buildId` | LLM root cause analysis |

---

## MCP Agent — Claude Desktop Integration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pipelineiq": {
      "command": "node",
      "args": ["/path/to/Pipeline-IQ/mcp-server/index.js"],
      "env": {
        "API_URL": "http://localhost:3000"
      }
    }
  }
}
```

Then ask Claude:
- *"Why did the last build fail on org/backend-api?"*
- *"Which tests are flaky this week?"*
- *"Predict if main will break today?"*
- *"Ingest this build failure and analyze it"*

### MCP Tools

| Tool | Description |
|------|-------------|
| `get_build_status` | Recent builds and success rate |
| `get_flaky_tests` | Flaky tests with fail rates |
| `analyze_failure` | LLM root cause for a build |
| `ingest_build` | Push a build event and get analysis |
| `get_pipeline_health` | Overall system health |

---

## Monitoring

| Service | URL |
|---------|-----|
| PipelineIQ API | http://localhost:3000 |
| Grafana Dashboard | http://localhost:3002 |
| Prometheus | http://localhost:9090 |
| Ollama | http://localhost:11434 |

Grafana login: `admin` / `pipelineiq`

---

## Automation

- **PM2** — auto restart on crash, memory limits, log rotation
- **GitHub Actions** — CI runs health check + webhook test on every push
- **Cron healthcheck** — every 5 minutes checks API, Redis, Ollama
- **Smart fallback** — pattern-based LLM when Ollama is slow

---

## Demo Results
11 builds ingested
45% success rate detected
4 flaky tests identified
test_token_expiry → predicted to fail (3/3 recent runs)
Root cause: JWT clock skew between mock and crypto library
LLM category: timing | confidence: high

---

## Interview Pitch

> "CI pipelines are the most failure-rich environment in software delivery and the least reasoned about. PipelineIQ sits between GitHub Actions and your team, ingesting every build event, clustering failure signatures, and running a local LLM over raw logs to produce a two-sentence root cause in plain English. It also flags tests it predicts will fail before they block your next deployment. The MCP Agent means Claude can directly query your pipeline — no dashboard needed."

---

## Project Structure
pipelineiq/
├── src/
│   ├── index.js              # Express server
│   ├── routes/
│   │   ├── webhook.js        # GitHub Actions + manual ingest
│   │   ├── analytics.js      # Build stats + flaky tests
│   │   └── auth.js           # JWT auth
│   ├── services/
│   │   ├── ingestionService.js   # Store build events in Redis
│   │   ├── patternService.js     # Flaky test detection
│   │   ├── llmService.js         # Ollama LLM analysis
│   │   └── alertService.js       # Slack alerts
│   ├── middleware/
│   │   └── auth.js           # JWT middleware
│   └── utils/
│       ├── redis.js           # Redis client
│       ├── logger.js          # Winston logger
│       └── metrics.js         # Prometheus metrics
├── mcp-server/
│   └── index.js              # MCP Agent (5 tools)
├── scripts/
│   ├── seed.js               # Demo data seeder
│   └── healthcheck.sh        # Auto health check
├── docker/
│   ├── prometheus.yml        # Prometheus config
│   └── grafana-datasource.yml
├── .github/workflows/
│   └── ci.yml                # GitHub Actions CI
├── docker-compose.yml
├── ecosystem.config.js       # PM2 config
└── .env.example

