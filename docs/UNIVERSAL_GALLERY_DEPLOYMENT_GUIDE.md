# Universal Gallery & Template Rebuild - Production Deployment Guide

## Overview

This guide covers the complete deployment of the Universal Gallery & Template Rebuild system to production environments. The system is now enterprise-ready with comprehensive monitoring, automated backups, and disaster recovery capabilities.

## Prerequisites

### System Requirements
- Node.js 16+ 
- MySQL 8.0+ (tested with MySQL 9.3.0)
- Redis 6.0+ (for caching)
- Nginx (for reverse proxy and static assets)
- SSL/TLS certificates
- Backup storage (minimum 500GB recommended)

### Environment Variables
```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=phoenix4ge_prod
DB_PASSWORD=<secure_password>
DB_DATABASE=phoenix4ge_production

# Backup Configuration
BACKUP_PATH=/var/backups/phoenix4ge
BACKUP_SCHEDULE_ENABLED=true
BACKUP_FREQUENCY=daily
BACKUP_COMPRESSION=true
BACKUP_ENCRYPTION_KEY=<encryption_key>

# Monitoring & Alerting
ALERTS_EMAIL_ENABLED=true
SMTP_HOST=smtp.company.com
SMTP_PORT=587
SMTP_USER=alerts@phoenix4ge.com
SMTP_PASS=<smtp_password>
ALERT_TO_EMAIL=admin@phoenix4ge.com,devops@phoenix4ge.com

ALERTS_SLACK_ENABLED=true
SLACK_WEBHOOK_URL=<slack_webhook_url>
SLACK_ALERT_CHANNEL=#phoenix4ge-alerts

# Production Environment
NODE_ENV=production
PORT=3000
```

## Deployment Steps

### Step 1: Database Migration

Run all database migrations in sequence:

```bash
# Core Universal Gallery system
mysql -u root -p phoenix4ge_production < migrations/080_theme_migration_system.sql

# Production monitoring and alerting
mysql -u root -p phoenix4ge_production < migrations/081_production_monitoring_alerts.sql

# Backup and rollback system
mysql -u root -p phoenix4ge_production < migrations/082_backup_rollback_system.sql
```

Verify migrations:
```bash
mysql -u root -p phoenix4ge_production -e "SHOW TABLES LIKE '%theme%'; SHOW TABLES LIKE '%backup%'; SHOW TABLES LIKE '%alert%';"
```

### Step 2: Initialize System Services

Start the monitoring and backup services:

```bash
# Initialize backup system
curl -X POST http://localhost:3000/api/backup-recovery/schedules/start

# Start production monitoring
curl -X POST http://localhost:3000/api/production-monitoring/start

# Verify services
curl http://localhost:3000/api/backup-recovery/status
curl http://localhost:3000/api/production-monitoring/health
```

### Step 3: Create Initial Rollback Point

Create a rollback point before going live:

```bash
curl -X POST http://localhost:3000/api/backup-recovery/rollback-points \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Deployment Baseline",
    "description": "Initial rollback point for Universal Gallery system deployment",
    "createBefore": "deployment",
    "expiresInDays": 90
  }'
```

### Step 4: Theme System Verification

Test the theme system with existing themes:

```bash
# Test theme migration system
curl -X POST http://localhost:3000/api/theme-migrations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Validation Test",
    "sourceTheme": 3,
    "targetTheme": 17,
    "schedule": "immediate",
    "selectionStrategy": "canary"
  }'

# Monitor migration progress
curl http://localhost:3000/api/theme-migrations/dashboard/overview
```

### Step 5: Performance Baseline Setup

Establish performance baselines:

```bash
# The baselines are automatically inserted via migration 081
# Verify they exist:
mysql -u root -p phoenix4ge_production -e "SELECT * FROM performance_baselines WHERE is_active = TRUE;"
```

## System Configuration

### Admin Dashboard Access

The Universal Gallery system includes several admin dashboards:

1. **Theme Migration Dashboard**: `/admin/theme-migrations`
   - Progressive rollout management
   - A/B testing configuration
   - Migration monitoring and rollback

2. **Production Monitoring Dashboard**: `/admin/production-monitoring`
   - Real-time system health
   - Performance metrics visualization  
   - Alert management and resolution

3. **Universal Gallery Configuration**: `/admin/gallery-config`
   - Theme-agnostic gallery settings
   - Performance optimization controls
   - Analytics and reporting

### API Endpoints Summary

**Theme Migrations:**
- `GET /api/theme-migrations` - List migrations
- `POST /api/theme-migrations` - Start migration
- `POST /api/theme-migrations/:id/rollback` - Rollback migration
- `GET /api/theme-migrations/dashboard/overview` - Dashboard data

**Production Monitoring:**
- `GET /api/production-monitoring/health` - System health
- `GET /api/production-monitoring/metrics` - Performance metrics
- `GET /api/production-monitoring/alerts` - Alert management
- `POST /api/production-monitoring/test-alert` - Test alerting

**Backup & Recovery:**
- `POST /api/backup-recovery/backup` - Create backup
- `POST /api/backup-recovery/restore/:id` - Restore from backup
- `POST /api/backup-recovery/emergency-rollback` - Emergency recovery
- `GET /api/backup-recovery/rollback-points` - Available rollback points

## Monitoring & Alerting Setup

### Metric Collection

The system automatically collects:
- **System Metrics**: CPU, memory, disk usage
- **Database Metrics**: Query performance, connection pool
- **API Metrics**: Response times, error rates
- **Gallery Metrics**: Load times, cache hit rates
- **User Experience**: Core Web Vitals (LCP, FID, CLS)

### Alert Configuration

Alerts are configured in the database via `performance_baselines` table:

```sql
-- Example: Modify CPU usage alert thresholds
UPDATE performance_baselines 
SET warning_threshold = 80.0, critical_threshold = 95.0 
WHERE metric_name = 'cpu_usage_percent';
```

### Health Check Endpoints

Monitor system health:
```bash
# Overall system health
curl http://localhost:3000/api/production-monitoring/health

# Specific component health
curl http://localhost:3000/api/production-monitoring/health?component=gallery_api
```

## Backup Strategy

### Automated Backups

The system runs:
- **Hourly incremental backups** (48-hour retention)
- **Daily full backups** (7-day retention)  
- **Weekly archive backups** (4-week retention)
- **Monthly long-term backups** (12-month retention)

### Manual Backup Creation

```bash
# Create full backup
curl -X POST http://localhost:3000/api/backup-recovery/backup \
  -H "Content-Type: application/json" \
  -d '{
    "type": "full",
    "reason": "Pre-maintenance backup",
    "compress": true
  }'

# Create configuration-only backup
curl -X POST http://localhost:3000/api/backup-recovery/backup \
  -H "Content-Type: application/json" \
  -d '{
    "type": "config_only", 
    "reason": "Before theme updates"
  }'
```

## Disaster Recovery Procedures

### Emergency Rollback

In case of system failure:

```bash
# Automated emergency rollback
curl -X POST http://localhost:3000/api/backup-recovery/emergency-rollback \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "System failure - automated recovery"
  }'
```

### Manual Restore

To restore from a specific backup:

```bash
# List available backups
curl http://localhost:3000/api/backup-recovery/backups

# Restore from specific backup
curl -X POST http://localhost:3000/api/backup-recovery/restore/backup_2024-08-15T10-30-00-000Z_abc123 \
  -H "Content-Type: application/json" \
  -d '{
    "components": ["database", "configuration"],
    "reason": "Restore after configuration issue"
  }'
```

## Performance Optimization

### Database Optimization

```sql
-- Add indexes for production workload
ALTER TABLE gallery_images ADD INDEX idx_model_theme_active (model_id, theme_id, is_active);
ALTER TABLE universal_gallery_configs ADD INDEX idx_theme_level (theme_id, config_level);
ALTER TABLE production_metrics ADD INDEX idx_category_time_value (metric_category, collected_at, metric_value);
```

### Caching Configuration

Configure Redis for production caching:

```bash
# Theme configuration cache (TTL: 1 hour)
redis-cli CONFIG SET maxmemory-policy allkeys-lru
redis-cli CONFIG SET maxmemory 2gb
```

### Static Asset Optimization

Configure Nginx for static assets:

```nginx
location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    gzip_static on;
}

location /themes/ {
    expires 30d;
    add_header Cache-Control "public";
}
```

## Security Considerations

### Access Control

- All admin dashboards require authentication
- API endpoints use role-based access control
- Backup encryption is enabled by default
- Database connections use SSL/TLS

### Audit Logging

The system logs all critical operations:
- Theme migrations and rollbacks
- Backup and restore operations
- Configuration changes
- Alert escalations

## Maintenance

### Weekly Tasks

1. **Backup Verification**
   ```bash
   curl -X POST http://localhost:3000/api/backup-recovery/verify/latest
   ```

2. **Performance Review**
   ```bash
   curl http://localhost:3000/api/production-monitoring/dashboard
   ```

3. **Alert History Review**
   ```bash
   curl "http://localhost:3000/api/production-monitoring/alerts?limit=100"
   ```

### Monthly Tasks

1. **Theme Performance Analysis**
2. **Backup Storage Cleanup**  
3. **Database Maintenance**
4. **Security Updates**

## Troubleshooting

### Common Issues

**Theme Migration Stuck**:
```bash
# Check migration status
curl http://localhost:3000/api/theme-migrations/dashboard/overview

# Force rollback if needed
curl -X POST http://localhost:3000/api/theme-migrations/{migration-id}/rollback
```

**Monitoring Service Down**:
```bash
# Restart monitoring
curl -X POST http://localhost:3000/api/production-monitoring/start

# Check service logs
tail -f logs/production-monitoring.log
```

**Backup Failures**:
```bash
# Check backup status
curl http://localhost:3000/api/backup-recovery/status

# Manual backup test
curl -X POST http://localhost:3000/api/backup-recovery/backup \
  -d '{"type": "config_only", "reason": "Test backup"}'
```

## Support & Documentation

### Log Locations
- Application logs: `/var/log/phoenix4ge/`
- Backup logs: `/var/backups/phoenix4ge/logs/`
- Migration logs: `/var/log/phoenix4ge/migrations/`

### Monitoring Dashboards
- System Health: `https://phoenix4ge.com/admin/production-monitoring`
- Theme Migrations: `https://phoenix4ge.com/admin/theme-migrations`
- Backup Status: `https://phoenix4ge.com/admin/backup-recovery`

### Emergency Contacts
- Primary: `admin@phoenix4ge.com`
- DevOps Team: `devops@phoenix4ge.com`
- Emergency: `+1-XXX-XXX-XXXX`

---

**Deployment Checklist:**
- [ ] Database migrations completed
- [ ] Environment variables configured  
- [ ] Services started and verified
- [ ] Initial rollback point created
- [ ] Theme system tested
- [ ] Monitoring alerts configured
- [ ] Backup schedule activated
- [ ] Performance baselines established
- [ ] Emergency procedures documented
- [ ] Team trained on new dashboards

The Universal Gallery & Template Rebuild system is now ready for production deployment with enterprise-grade reliability and comprehensive operational support.