require('dotenv').config({ path: '../.env' });
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:3000';

const server = new Server(
  { name: 'pipelineiq', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'get_build_status',
      description: 'Get recent builds and success rate for a repository',
      inputSchema: {
        type: 'object',
        properties: {
          repo: { type: 'string', description: 'Repository name e.g. org/backend-api' }
        },
        required: ['repo']
      }
    },
    {
      name: 'get_flaky_tests',
      description: 'Get flaky tests detected for a repository with fail rates',
      inputSchema: {
        type: 'object',
        properties: {
          repo: { type: 'string', description: 'Repository name' }
        },
        required: ['repo']
      }
    },
    {
      name: 'analyze_failure',
      description: 'Get LLM root cause analysis for a specific build failure',
      inputSchema: {
        type: 'object',
        properties: {
          repo: { type: 'string', description: 'Repository name' },
          buildId: { type: 'string', description: 'Build ID to analyze' }
        },
        required: ['repo', 'buildId']
      }
    },
    {
      name: 'ingest_build',
      description: 'Ingest a new build event and get instant analysis',
      inputSchema: {
        type: 'object',
        properties: {
          repo: { type: 'string' },
          branch: { type: 'string' },
          status: { type: 'string', enum: ['success', 'failure'] },
          workflow: { type: 'string' },
          errorLog: { type: 'string' },
          failedTests: { type: 'array', items: { type: 'string' } }
        },
        required: ['repo', 'branch', 'status', 'workflow']
      }
    },
    {
      name: 'get_pipeline_health',
      description: 'Get overall pipeline health stats across all builds',
      inputSchema: { type: 'object', properties: {} }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'get_build_status') {
      const { data } = await axios.get(`${API_URL}/api/analytics/${encodeURIComponent(args.repo)}/builds`);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            repo: args.repo,
            successRate: `${data.successRate}%`,
            total: data.total,
            passed: data.passed,
            failed: data.failed,
            recentBuilds: data.builds?.slice(0, 5).map(b => ({
              id: b.id,
              branch: b.branch,
              status: b.status,
              workflow: b.workflow,
              time: new Date(parseInt(b.timestamp)).toISOString()
            }))
          }, null, 2)
        }]
      };
    }

    if (name === 'get_flaky_tests') {
      const { data } = await axios.get(`${API_URL}/api/analytics/${encodeURIComponent(args.repo)}/flaky`);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            repo: args.repo,
            flakyCount: data.flaky?.length || 0,
            tests: data.flaky?.map(t => ({
              name: t.test,
              failRate: `${t.failRate}%`,
              severity: t.severity,
              predicted: t.predicted
            }))
          }, null, 2)
        }]
      };
    }

    if (name === 'analyze_failure') {
      const { data } = await axios.get(`${API_URL}/api/analytics/${encodeURIComponent(args.repo)}/analysis/${args.buildId}`);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            buildId: args.buildId,
            rootCause: data.analysis?.rootCause,
            category: data.analysis?.category,
            confidence: data.analysis?.confidence,
            fix: data.analysis?.fix,
            model: data.analysis?.model
          }, null, 2)
        }]
      };
    }

    if (name === 'ingest_build') {
      const { data } = await axios.post(`${API_URL}/webhook/ingest`, args);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            buildId: data.build?.id,
            status: data.build?.status,
            rootCause: data.analysis?.rootCause,
            category: data.analysis?.category,
            fix: data.analysis?.fix
          }, null, 2)
        }]
      };
    }

    if (name === 'get_pipeline_health') {
      const { data } = await axios.get(`${API_URL}/api/analytics/stats`);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            totalBuilds: data.totalBuilds,
            redisConnected: data.redisConnected,
            uptime: `${Math.round(data.uptime)}s`,
            timestamp: data.timestamp
          }, null, 2)
        }]
      };
    }

    return { content: [{ type: 'text', text: `Unknown tool: ${name}` }] };

  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error: ${err.message}` }],
      isError: true
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('PipelineIQ MCP Server running');
}

main().catch(console.error);
