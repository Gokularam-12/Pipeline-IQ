const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { storeBuildEvent } = require('../services/ingestionService');
const { analyzeFlakyTests, getFailureSignature, getSimilarFailures } = require('../services/patternService');
const { analyzeFailure } = require('../services/llmService');
const { alertBuildFailure, alertFlakyTest } = require('../services/alertService');
const logger = require('../utils/logger');

function verifySignature(req) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  const sig = req.headers['x-hub-signature-256'];
  if (!sig) return true; // skip in dev
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(JSON.stringify(req.body)).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

// GitHub Actions webhook
router.post('/github', async (req, res) => {
  if (!verifySignature(req)) return res.status(401).json({ error: 'Invalid signature' });

  const event = req.headers['x-github-event'];
  const payload = req.body;

  // Handle workflow_run events
  if (event === 'workflow_run' || payload.workflow_run) {
    const run = payload.workflow_run || payload;
    const buildPayload = {
      repo: payload.repository?.full_name || run.repository?.full_name,
      branch: run.head_branch,
      commit: run.head_sha,
      status: run.conclusion === 'success' ? 'success' : 'failure',
      workflow: run.name,
      conclusion: run.conclusion,
      duration: run.run_started_at ? Date.now() - new Date(run.run_started_at).getTime() : 0,
      errorLog: payload.errorLog || '',
      failedTests: payload.failedTests || []
    };

    const build = await storeBuildEvent(buildPayload);

    // Run analysis on failures
    if (build.status === 'failure') {
      const sig = await getFailureSignature(build.repo, build.errorLog);
      const similar = await getSimilarFailures(build.repo, sig);
      const analysis = await analyzeFailure(build, similar);

      await alertBuildFailure(build, analysis);

      // Check flaky tests
      const flaky = await analyzeFlakyTests(build.repo);
      for (const f of flaky.filter(t => t.predicted)) {
        await alertFlakyTest(build.repo, f.test, f.failRate);
      }

      return res.json({ received: true, buildId: build.id, analysis });
    }

    return res.json({ received: true, buildId: build.id });
  }

  res.json({ received: true, event });
});

// Manual build event (for testing)
router.post('/ingest', async (req, res) => {
  try {
    const build = await storeBuildEvent(req.body);

    if (build.status === 'failure') {
      const sig = await getFailureSignature(build.repo, build.errorLog);
      const similar = await getSimilarFailures(build.repo, sig);
      const analysis = await analyzeFailure(build, similar);
      return res.json({ build, analysis });
    }

    res.json({ build });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
