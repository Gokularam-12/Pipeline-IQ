const axios = require('axios');
const logger = require('../utils/logger');

async function sendSlackAlert(message) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url || url.includes('YOUR')) {
    logger.info(`[SLACK SKIPPED] ${message.text}`);
    return;
  }
  try {
    await axios.post(url, message);
    logger.info('Slack alert sent');
  } catch (err) {
    logger.error(`Slack alert failed: ${err.message}`);
  }
}

async function alertFlakyTest(repo, test, failRate) {
  await sendSlackAlert({
    text: `⚡ *PipelineIQ Prediction* — \`${test}\` is predicted to fail`,
    attachments: [{
      color: '#ff4444',
      fields: [
        { title: 'Repository', value: repo, short: true },
        { title: 'Fail Rate', value: `${failRate}%`, short: true },
        { title: 'Action', value: 'Investigate before next build', short: false }
      ]
    }]
  });
}

async function alertBuildFailure(build, analysis) {
  await sendSlackAlert({
    text: `🔴 *Build Failed* — ${build.repo} (${build.branch})`,
    attachments: [{
      color: '#ff4444',
      fields: [
        { title: 'Workflow', value: build.workflow, short: true },
        { title: 'Category', value: analysis.category, short: true },
        { title: 'Root Cause', value: analysis.rootCause, short: false },
        { title: 'Suggested Fix', value: analysis.fix, short: false }
      ]
    }]
  });
}

module.exports = { alertFlakyTest, alertBuildFailure };
