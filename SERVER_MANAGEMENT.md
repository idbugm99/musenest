# Phoenix4GE Server Management Guide

## Overview
The Phoenix4GE server is now managed by PM2 (Process Manager 2) for robust process monitoring, automatic restarts, and system integration.

## Current Setup

### 1. PM2 Process Manager
- **Service**: PM2 manages the server process with automatic restart capabilities
- **Config File**: `/home/ubuntu/phoenix4ge/ecosystem.config.js`
- **Auto-start**: Configured to start automatically on system boot via systemd
- **Logging**: All logs are stored in `/home/ubuntu/phoenix4ge/logs/`

### 2. Backup Monitoring
- **Script**: `/home/ubuntu/phoenix4ge/monitor_server.sh`
- **Schedule**: Runs every 5 minutes via cron
- **Function**: Monitors PM2 status and restarts if needed

## Daily Management Commands

### Check Server Status
```bash
pm2 status
pm2 monit          # Real-time monitoring
```

### Start/Stop/Restart Server
```bash
pm2 start phoenix4ge
pm2 stop phoenix4ge
pm2 restart phoenix4ge
pm2 reload phoenix4ge    # Zero-downtime reload
```

### View Logs
```bash
pm2 logs phoenix4ge      # Real-time logs
pm2 logs phoenix4ge --lines 100  # Last 100 lines
pm2 flush               # Clear all logs
```

### View Specific Log Files
```bash
tail -f /home/ubuntu/phoenix4ge/logs/out.log       # Application output
tail -f /home/ubuntu/phoenix4ge/logs/err.log       # Error logs
tail -f /home/ubuntu/phoenix4ge/logs/combined.log  # Combined logs
tail -f /home/ubuntu/phoenix4ge/monitor.log        # Monitor script logs
```

## System Integration

### Auto-Startup Configuration
- **SystemD Service**: `pm2-ubuntu.service`
- **Status**: `sudo systemctl status pm2-ubuntu`
- **Control**: `sudo systemctl start/stop/restart pm2-ubuntu`

### Cron Jobs
```bash
crontab -l  # View current user cron jobs
```
Current: Monitor script runs every 5 minutes

## Troubleshooting

### Server Won't Start
1. Check PM2 status: `pm2 status`
2. Check PM2 logs: `pm2 logs phoenix4ge`
3. Check system resources: `htop` or `free -h`
4. Check port availability: `sudo netstat -tlnp | grep 443`

### PM2 Not Working
1. Restart PM2 daemon: `pm2 kill && pm2 resurrect`
2. Check systemd service: `sudo systemctl status pm2-ubuntu`
3. Restart systemd service: `sudo systemctl restart pm2-ubuntu`

### Complete Reset
```bash
pm2 stop phoenix4ge
pm2 delete phoenix4ge
pm2 start ecosystem.config.js
pm2 save
```

## Configuration Files

### `/home/ubuntu/phoenix4ge/ecosystem.config.js`
PM2 application configuration including:
- Process name and script
- Environment variables
- Restart policies
- Logging configuration
- Memory limits

### `/home/ubuntu/phoenix4ge/monitor_server.sh`
Backup monitoring script that:
- Checks PM2 process status
- Attempts restarts if needed
- Logs all activities
- Runs every 5 minutes via cron

## Monitoring & Alerts

### Real-time Monitoring
```bash
pm2 monit  # Interactive dashboard
pm2 plus   # Web-based monitoring (optional)
```

### Log Monitoring
```bash
# Monitor for errors
tail -f /home/ubuntu/phoenix4ge/logs/err.log

# Monitor restart attempts
tail -f /home/ubuntu/phoenix4ge/monitor.log

# Monitor server startup
tail -f /home/ubuntu/phoenix4ge/server_startup.log
```

## Security & Best Practices

1. **Regular Log Rotation**: PM2 handles this automatically
2. **Resource Monitoring**: Monitor memory usage via `pm2 monit`
3. **Update Strategy**: Always test updates in staging first
4. **Backup**: The ecosystem.config.js and monitor script should be backed up

## Migration from Old Setup

The previous setup used:
- ~~`@reboot` cron job~~ (removed)
- ~~`start_server.sh`~~ (replaced by PM2 ecosystem config)
- ~~Manual startup only~~ (now has continuous monitoring)

## Emergency Contacts & Resources

- **PM2 Documentation**: https://pm2.keymetrics.io/docs/
- **Log Location**: `/home/ubuntu/phoenix4ge/logs/`
- **Config Location**: `/home/ubuntu/phoenix4ge/ecosystem.config.js`
- **Monitor Script**: `/home/ubuntu/phoenix4ge/monitor_server.sh`