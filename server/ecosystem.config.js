module.exports = {
  apps: [{
    name: 'mev-server',
    script: './dist/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '2G',
    env: {
      NODE_ENV: 'production'
    },
    
    // 日志配置
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    
    // 进程管理配置
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000,
    
    // 监控配置
    pmx: true,
  }]
}; 