const client = require('prom-client');

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const buildsTotal = new client.Counter({
  name: 'pipelineiq_builds_total',
  help: 'Total builds ingested',
  labelNames: ['repo', 'status'],
  registers: [register]
});

const flakyTestsGauge = new client.Gauge({
  name: 'pipelineiq_flaky_tests',
  help: 'Number of flaky tests detected',
  labelNames: ['repo'],
  registers: [register]
});

const llmLatency = new client.Histogram({
  name: 'pipelineiq_llm_latency_ms',
  help: 'LLM analysis latency in ms',
  buckets: [500, 1000, 2000, 5000, 10000],
  registers: [register]
});

const successRate = new client.Gauge({
  name: 'pipelineiq_success_rate',
  help: 'Build success rate percentage',
  labelNames: ['repo'],
  registers: [register]
});

module.exports = { register, buildsTotal, flakyTestsGauge, llmLatency, successRate };
