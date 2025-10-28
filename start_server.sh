#!/bin/bash

# Phoenix4ge Server Startup Script
# This script ensures proper environment setup for the server

# Set the working directory
cd /home/ubuntu/phoenix4ge

# Load variables from .env if present (so app and this shell share the same values)
if [ -f ./.env ]; then
set -a
. ./.env
set +a
fi

# Load environment variables
export NODE_ENV=production
export PORT=443

# Set other environment variables from .env file
export DB_HOST=localhost
export DB_USER=root
export DB_PASSWORD=root_password
export DB_DATABASE=phoenix4ge
export DB_NAME=phoenix4ge
export DB_PORT=3306

# JWT Configuration
export JWT_SECRET=your_super_secret_jwt_key_here
export JWT_EXPIRES_IN=7d

# File Upload Configuration
export UPLOAD_DIR=./public/uploads
export MAX_FILE_SIZE=5242880

# SMTP Configuration
export SMTP_HOST=localhost
export SMTP_PORT=587
export SMTP_USER=
export SMTP_PASS=
export FROM_EMAIL=admin@musenest.com
export ADMIN_EMAIL=admin@musenest.com

# Security
export BCRYPT_ROUNDS=12
export RATE_LIMIT_WINDOW=15
export RATE_LIMIT_MAX=1000

# API Key
export VENICE_AI_KEY=nyRgEN6chARf7Ok1T1sw6FI9_CCVLIhgAGmM3wSXV4

# Telnyx SMS Configuration (loaded from .env)

# Start the server with proper logging
echo "$(date): Starting Phoenix4ge server..." >> /home/ubuntu/phoenix4ge/server_startup.log
npm start >> /home/ubuntu/phoenix4ge/server_startup.log 2>&1
