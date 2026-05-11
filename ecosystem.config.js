module.exports = {
  apps: [
    {
      name: 'pipelineiq-api',
      script: 'src/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: 'logs/api-error.log',
      out_file: 'logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'pipelineiq-mcp',
      script: 'mcp-server/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production'
      },
      error_file: 'logs/mcp-error.log',
      out_file: 'logs/mcp-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
};
