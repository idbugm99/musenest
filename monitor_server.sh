#!/bin/bash

# Phoenix4GE Server Monitor Script
# This script checks if the server is running and restarts it if needed
# Backup to PM2 monitoring

LOG_FILE="/home/ubuntu/phoenix4ge/monitor.log"
SERVER_URL="https://localhost:443/health"

# Function to log messages
log_message() {
    echo "$(date): $1" >> "$LOG_FILE"
}

# Check if PM2 is managing the process
pm2_status=$(pm2 jlist | jq -r '.[] | select(.name=="phoenix4ge") | .pm2_env.status' 2>/dev/null)

if [ "$pm2_status" = "online" ]; then
    # PM2 is managing and process is online
    log_message "Server is running under PM2 management"
    exit 0
elif [ "$pm2_status" = "stopped" ] || [ "$pm2_status" = "errored" ]; then
    # PM2 is managing but process is down
    log_message "PM2 process is $pm2_status, attempting restart"
    pm2 restart phoenix4ge
    sleep 10
    
    # Check if restart was successful
    new_status=$(pm2 jlist | jq -r '.[] | select(.name=="phoenix4ge") | .pm2_env.status' 2>/dev/null)
    if [ "$new_status" = "online" ]; then
        log_message "PM2 restart successful"
    else
        log_message "PM2 restart failed, status: $new_status"
    fi
else
    # PM2 is not managing the process, check if server is manually running
    if pgrep -f "node.*phoenix4ge\|npm.*start" > /dev/null; then
        log_message "Server running manually (not under PM2)"
    else
        # No server process found, start with PM2
        log_message "No server process found, starting with PM2"
        cd /home/ubuntu/phoenix4ge
        pm2 start ecosystem.config.js
        log_message "Server started with PM2"
    fi
fi