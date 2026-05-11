const redis = require('../utils/redis');
const logger = require('../utils/logger');

const FLAKY_THRESHOLD = parseInt(process.env.FLAKY_THRESHOLD || '20');
const PREDICT_FAILS = parseInt(process.env.PREDICT_FAILS || '3');
const PREDICT_WINDOW = parseInt(process.env.PREDICT_WINDOW || '10');

async function analyzeFlakyTests(repo) {
  const tests = await redis.smembers(`repo:${repo}:tests`);
  const results = [];

  for (const test of tests) {
    const history = await redis.lrange(`test:${repo}:${test}:history`, 0, PREDICT_WINDOW - 1);
    if (!history.length) continue;

    const fails = history.filter(s => s === 'failure' || s === 'failed').length;
    const total = history.length;
    const failRate = Math.round((fails / total) * 100);

    const recentFails = history.slice(0, PREDICT_FAILS).filter(s => s === 'failure' || s === 'failed').length;
    const predicted = recentFails >= PREDICT_FAILS;

    if (failRate >= FLAKY_THRESHOLD || predicted) {
      results.push({
        test,
        failRate,
        totalRuns: total,
        recentFails,
        predicted,
        severity: failRate >= 50 ? 'critical' : 'warning'
      });

      // Store in flaky set with score = failRate
      await redis.zadd(`repo:${repo}:flaky`, failRate, test);
    }
  }

  results.sort((a, b) => b.failRate - a.failRate);
  logger.info(`Analyzed ${tests.length} tests for ${repo}, ${results.length} flaky`);
  return results;
}

async function getFailureSignature(repo, errorLog) {
  // Hash the error signature for clustering
  const lines = errorLog.split('\n').filter(l => l.includes('Error') || l.includes('FAILED') || l.includes('assert'));
  return lines.slice(0, 3).join('|').toLowerCase().replace(/[0-9a-f]{8,}/g, 'HASH');
}

async function getSimilarFailures(repo, signature, limit = 5) {
  const ids = await redis.lrange(`repo:${repo}:builds`, 0, 99);
  const similar = [];

  for (const id of ids) {
    const build = await redis.hgetall(`build:${id}`);
    if (!build || build.status === 'success') continue;
    if (build.errorLog) {
      const sig = await getFailureSignature(repo, build.errorLog);
      if (sig === signature) {
        similar.push(build);
        if (similar.length >= limit) break;
      }
    }
  }
  return similar;
}

module.exports = { analyzeFlakyTests, getFailureSignature, getSimilarFailures };
