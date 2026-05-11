const redis = require('../utils/redis');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

async function storeBuildEvent(payload) {
  const id = uuidv4();
  const event = {
    id,
    repo: payload.repository?.full_name || payload.repo || 'unknown',
    branch: payload.ref?.replace('refs/heads/', '') || payload.branch || 'unknown',
    commit: payload.head_commit?.id || payload.commit || 'unknown',
    status: payload.status || 'unknown',
    duration: payload.duration || 0,
    workflow: payload.workflow || payload.workflow_run?.name || 'unknown',
    conclusion: payload.conclusion || payload.workflow_run?.conclusion || null,
    failedTests: payload.failedTests || [],
    errorLog: payload.errorLog || '',
    timestamp: Date.now()
  };

  // Store event
  await redis.hset(`build:${id}`, event);
  await redis.expire(`build:${id}`, 60 * 60 * 24 * 30); // 30 days

  // Push to repo timeline
  await redis.lpush(`repo:${event.repo}:builds`, id);
  await redis.ltrim(`repo:${event.repo}:builds`, 0, 499); // keep last 500

  // Track failed tests
  if (event.failedTests.length > 0) {
    for (const test of event.failedTests) {
      await redis.lpush(`test:${event.repo}:${test}:history`, event.status);
      await redis.ltrim(`test:${event.repo}:${test}:history`, 0, 49);
      await redis.sadd(`repo:${event.repo}:tests`, test);
    }
  }

  logger.info(`Stored build event ${id} for ${event.repo}`);
  return event;
}

async function getRecentBuilds(repo, limit = 20) {
  const ids = await redis.lrange(`repo:${repo}:builds`, 0, limit - 1);
  if (!ids.length) return [];
  const builds = await Promise.all(ids.map(id => redis.hgetall(`build:${id}`)));
  return builds.filter(Boolean);
}

module.exports = { storeBuildEvent, getRecentBuilds };
