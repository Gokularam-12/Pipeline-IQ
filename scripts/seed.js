require('dotenv').config();
const axios = require('axios');

const API = 'http://localhost:3000';

const builds = [
  { repo:'org/backend-api', branch:'main', status:'success', workflow:'CI Tests', commit:'a1b2c3', errorLog:'', failedTests:[] },
  { repo:'org/backend-api', branch:'main', status:'success', workflow:'CI Tests', commit:'d4e5f6', errorLog:'', failedTests:[] },
  { repo:'org/backend-api', branch:'feat/auth', status:'failure', workflow:'CI Tests', commit:'g7h8i9', errorLog:'FAILED test_token_expiry AssertionError token expired before TTL expected 3600 got 3598', failedTests:['test_token_expiry'] },
  { repo:'org/backend-api', branch:'main', status:'success', workflow:'CI Tests', commit:'j1k2l3', errorLog:'', failedTests:[] },
  { repo:'org/backend-api', branch:'feat/auth', status:'failure', workflow:'CI Tests', commit:'m4n5o6', errorLog:'FAILED test_token_expiry AssertionError token expired before TTL expected 3600 got 3598', failedTests:['test_token_expiry'] },
  { repo:'org/backend-api', branch:'fix/redis', status:'failure', workflow:'CI Tests', commit:'p7q8r9', errorLog:'FAILED test_redis_pool Error connect ECONNREFUSED 127.0.0.1:6379', failedTests:['test_redis_pool','test_cache_eviction'] },
  { repo:'org/backend-api', branch:'main', status:'success', workflow:'CI Tests', commit:'s1t2u3', errorLog:'', failedTests:[] },
  { repo:'org/backend-api', branch:'main', status:'failure', workflow:'CI Tests', commit:'v4w5x6', errorLog:'FAILED test_token_expiry AssertionError token expired before TTL expected 3600 got 3598', failedTests:['test_token_expiry'] },
  { repo:'org/backend-api', branch:'main', status:'success', workflow:'CI Tests', commit:'y7z8a9', errorLog:'', failedTests:[] },
  { repo:'org/backend-api', branch:'feat/payments', status:'failure', workflow:'CI Tests', commit:'b1c2d3', errorLog:'FAILED test_payment_retry AssertionError expected 3 retries got 2', failedTests:['test_payment_retry'] },
];

async function seed() {
  console.log('Seeding build events...');
  for (const build of builds) {
    try {
      const { data } = await axios.post(`${API}/webhook/ingest`, build);
      console.log(`✓ ${build.branch} ${build.status} → ${data.build.id.slice(0,8)} | ${data.analysis?.category || 'ok'}`);
    } catch (err) {
      console.error(`✗ ${err.message}`);
    }
  }
  console.log('\nDone! Run these to verify:');
  console.log(`curl ${API}/api/analytics/stats`);
  console.log(`curl ${API}/api/analytics/org%2Fbackend-api/flaky`);
}

seed();
