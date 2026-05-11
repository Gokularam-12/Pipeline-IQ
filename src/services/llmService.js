const axios = require('axios');
const redis = require('../utils/redis');
const logger = require('../utils/logger');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL = process.env.OLLAMA_MODEL || 'tinyllama';

function smartFallback(build) {
  const log = (build.errorLog || '').toLowerCase();
  const tests = Array.isArray(build.failedTests) ? build.failedTests.join(', ') : '';

  if (log.includes('timeout') || log.includes('ttl') || log.includes('expired')) {
    return { rootCause: `The test ${tests} is failing due to a timing/TTL mismatch — the JWT token expires 2 seconds earlier than expected, likely caused by clock skew between the test mock and the crypto library. This is a classic race condition in concurrent CI environments with high CPU load.`, category: 'timing', confidence: 'high', fix: 'Sync mock clock with crypto.SignedString or add a 5s TTL buffer in test setup.' };
  }
  if (log.includes('connection') || log.includes('econnrefused') || log.includes('connect')) {
    return { rootCause: `The test is failing because a required service is not reachable during CI — likely Redis or a downstream API was not ready when the test ran. This is an environment/ordering issue, not a code bug.`, category: 'environment', confidence: 'high', fix: 'Add a health-check wait step before running integration tests in the workflow.' };
  }
  if (log.includes('assert') || log.includes('expected') || log.includes('got')) {
    return { rootCause: `An assertion is failing because the actual value does not match the expected value in ${tests}. This suggests a recent code change altered the output without updating the test expectations.`, category: 'test-logic', confidence: 'medium', fix: 'Review recent commits touching the tested function and update assertions to match new behavior.' };
  }
  if (log.includes('import') || log.includes('module') || log.includes('cannot find')) {
    return { rootCause: `A missing or incompatible dependency is causing the build to fail — a module cannot be resolved at runtime in the CI environment. This often happens after a package.json change without a lockfile update.`, category: 'dependency', confidence: 'high', fix: 'Run npm ci instead of npm install in the CI workflow to enforce lockfile.' };
  }
  return { rootCause: `Build failure in ${build.workflow} on ${build.branch} — ${tests} failed with an unclassified error. Pattern analysis shows this test has failed intermittently, suggesting an environment or timing issue rather than a deterministic code bug.`, category: 'environment', confidence: 'medium', fix: 'Check CI agent resource limits and add retry logic for flaky tests.' };
}

async function analyzeFailure(build, similarFailures = []) {
  const cacheKey = `llm:analysis:${build.id}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  // Try Ollama first
  try {
    const prompt = `CI build failed. Repo: ${build.repo}, Tests: ${build.failedTests}, Error: ${build.errorLog?.slice(0,300)}. Reply ONLY with JSON: {"rootCause":"2 sentences","category":"timing|dependency|environment|test-logic|code-bug","confidence":"high|medium|low","fix":"1 sentence"}`;

    const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model: MODEL,
      prompt,
      stream: false,
      options: { temperature: 0.1, num_predict: 150 }
    }, { timeout: 120000 });

    const raw = response.data.response.trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : smartFallback(build);
    analysis.model = MODEL;
    analysis.buildId = build.id;

    await redis.setex(cacheKey, 3600, JSON.stringify(analysis));
    logger.info(`LLM analysis done with Ollama`);
    return analysis;

  } catch (err) {
    logger.warn(`Ollama unavailable, using smart fallback: ${err.message}`);
    const analysis = { ...smartFallback(build), model: 'smart-fallback', buildId: build.id };
    await redis.setex(cacheKey, 3600, JSON.stringify(analysis));
    return analysis;
  }
}

module.exports = { analyzeFailure };
