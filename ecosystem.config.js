module.exports = {
  apps: [
    {
      name: 'phoenix4ge',
      script: 'npm',
      args: 'start',
      cwd: '/home/ubuntu/phoenix4ge',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 443
      },
      error_file: '/home/ubuntu/phoenix4ge/logs/err.log',
      out_file: '/home/ubuntu/phoenix4ge/logs/out.log',
      log_file: '/home/ubuntu/phoenix4ge/logs/combined.log',
      time: true,
      merge_logs: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000
    }
  ]
};