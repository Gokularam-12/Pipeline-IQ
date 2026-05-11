const express = require('express');
const router = express.Router();
const { getRecentBuilds } = require('../services/ingestionService');
const { analyzeFlakyTests } = require('../services/patternService');
const { analyzeFailure } = require('../services/llmService');
const redis = require('../utils/redis');

// GET /api/analytics/stats
router.get('/stats', async (req, res) => {
  try {
    const keys = await redis.keys('build:*');
    res.json({
      totalBuilds: keys.length,
      redisConnected: true,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/:repo/builds
router.get('/:repo/builds', async (req, res) => {
  try {
    const repo = req.params.repo;
    const builds = await getRecentBuilds(repo, 20);
    const total = builds.length;
    const passed = builds.filter(b => b.status === 'success').length;
    const failed = builds.filter(b => b.status === 'failure').length;
    const successRate = total ? Math.round((passed / total) * 100) : 0;
    res.json({ repo, total, passed, failed, successRate, builds });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/:repo/flaky
router.get('/:repo/flaky', async (req, res) => {
  try {
    const flaky = await analyzeFlakyTests(req.params.repo);
    res.json({ repo: req.params.repo, flaky });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/:repo/analysis/:buildId
router.get('/:repo/analysis/:buildId', async (req, res) => {
  try {
    const build = await redis.hgetall(`build:${req.params.buildId}`);
    if (!build) return res.status(404).json({ error: 'Build not found' });
    const analysis = await analyzeFailure(build);
    res.json({ build, analysis });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
