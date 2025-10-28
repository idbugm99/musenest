# Universal Gallery System - Quick Reference Guide

## 🚀 Quick Start Commands

### Development Setup
```bash
# Start development environment
npm run dev

# Run tests
npm test
npm run test:performance
npm run test:e2e

# Database migrations
npm run migrate
```

### Production Operations
```bash
# Create backup
curl -X POST /api/backup-recovery/backup -d '{"type":"full"}'

# Start theme migration
curl -X POST /api/theme-migrations -d '{"name":"Migration Test","sourceTheme":3,"targetTheme":17}'

# Check system health
curl /api/production-monitoring/health

# Emergency rollback
curl -X POST /api/backup-recovery/emergency-rollback
```

## 📊 Admin Dashboards

| Dashboard | URL | Purpose |
|-----------|-----|---------|
| **Theme Migration** | `/admin/theme-migrations` | Progressive rollouts and A/B testing |
| **Production Monitoring** | `/admin/production-monitoring` | Real-time system health and performance |
| **Gallery Configuration** | `/admin/gallery-config` | Universal gallery settings |
| **Backup Management** | `/admin/backup-recovery` | Backup status and recovery operations |

## 🔧 Key API Endpoints

### Theme Migrations
```bash
# List migrations
GET /api/theme-migrations

# Start migration
POST /api/theme-migrations
{
  "name": "Migration Name",
  "sourceTheme": 3,
  "targetTheme": 17,
  "selectionStrategy": "canary"
}

# Rollback migration
POST /api/theme-migrations/{id}/rollback

# Dashboard overview
GET /api/theme-migrations/dashboard/overview
```

### Production Monitoring
```bash
# System health
GET /api/production-monitoring/health

# Performance metrics
GET /api/production-monitoring/metrics?category=gallery&timeframe=24h

# Alert management
GET /api/production-monitoring/alerts?status=active

# Test alerting
POST /api/production-monitoring/test-alert
```

### Backup & Recovery
```bash
# Create backup
POST /api/backup-recovery/backup
{
  "type": "full",
  "reason": "Pre-deployment backup"
}

# List backups
GET /api/backup-recovery/backups

# Restore from backup
POST /api/backup-recovery/restore/{backupId}

# Create rollback point
POST /api/backup-recovery/rollback-points
{
  "name": "Rollback Point Name",
  "createBefore": "deployment"
}
```

## 📈 Performance Baselines

### Response Time Targets
- **Gallery Load**: < 1.5 seconds
- **API Response**: < 500ms
- **Database Query**: < 150ms
- **Image Load**: < 800ms

### Core Web Vitals
- **LCP**: < 2.5 seconds
- **FID**: < 100ms
- **CLS**: < 0.1

### System Resources
- **CPU Usage**: < 75% (warning at 90%)
- **Memory Usage**: < 80% (warning at 95%)
- **Disk Usage**: < 85% (warning at 95%)

## 🚨 Alert Thresholds

### Critical Alerts (Immediate Response)
- **Error Rate**: > 5%
- **Response Time**: > 3 seconds
- **System CPU**: > 95%
- **Database Down**: Connection failures
- **Backup Failure**: Failed scheduled backup

### Warning Alerts (Monitor Closely)
- **Error Rate**: > 2%
- **Response Time**: > 1 second
- **System CPU**: > 85%
- **Memory Usage**: > 90%
- **Cache Hit Rate**: < 70%

## 🔒 Security Checklist

### Regular Security Tasks
- [ ] Review admin access logs weekly
- [ ] Update dependencies monthly
- [ ] Rotate backup encryption keys quarterly
- [ ] Audit user permissions monthly
- [ ] Check for SQL injection vulnerabilities
- [ ] Validate input sanitization
- [ ] Monitor failed authentication attempts
- [ ] Review HTTPS certificate expiration

## 📋 Database Quick Reference

### Key Tables
```sql
-- Gallery configuration
universal_gallery_configs

-- Theme migrations
theme_migrations
user_theme_migrations

-- Monitoring
production_metrics
alert_history

-- Backup system
backup_records
rollback_points
```

### Useful Queries
```sql
-- Check active migrations
SELECT * FROM theme_migrations WHERE status = 'in_progress';

-- Recent performance metrics
SELECT * FROM production_metrics 
WHERE collected_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
ORDER BY collected_at DESC LIMIT 100;

-- Alert summary
SELECT severity, COUNT(*) as count 
FROM alert_history 
WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
GROUP BY severity;

-- Backup status
SELECT type, status, COUNT(*) as count
FROM backup_records 
WHERE created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY type, status;
```

## 🛠️ Troubleshooting

### Theme Migration Issues
```bash
# Check migration status
curl /api/theme-migrations/dashboard/overview

# View migration details
curl /api/theme-migrations/{migration-id}

# Force rollback
curl -X POST /api/theme-migrations/{migration-id}/rollback

# Check migration logs
tail -f logs/theme-migrations.log
```

### Performance Issues
```bash
# Check system health
curl /api/production-monitoring/health

# View performance trends
curl "/api/production-monitoring/performance-trends/response_time?timeframe=1h"

# Check resource usage
curl "/api/production-monitoring/metrics?category=system&timeframe=1h"

# Review recent alerts
curl "/api/production-monitoring/alerts?limit=20"
```

### Backup Problems
```bash
# Check backup status
curl /api/backup-recovery/status

# Verify latest backup
curl -X POST /api/backup-recovery/verify/latest

# Create test backup
curl -X POST /api/backup-recovery/backup -d '{"type":"config_only","reason":"Test"}'

# Check backup logs
tail -f logs/backup-recovery.log
```

## 🔍 Monitoring Locations

### Log Files
```bash
# Application logs
tail -f logs/app.log

# Migration logs  
tail -f logs/theme-migrations.log

# Monitoring logs
tail -f logs/production-monitoring.log

# Backup logs
tail -f logs/backup-recovery.log

# Error logs
tail -f logs/error.log
```

### Health Check URLs
```bash
# Overall system health
curl http://localhost:3000/health

# Gallery system health
curl http://localhost:3000/api/universal-gallery/health

# Database connectivity
curl http://localhost:3000/api/production-monitoring/health?component=database

# Theme system status
curl http://localhost:3000/api/production-monitoring/health?component=theme_system
```

## ⚡ Performance Optimization

### Quick Performance Wins
```bash
# Clear all caches
redis-cli FLUSHDB

# Optimize database
mysql -e "OPTIMIZE TABLE gallery_images, universal_gallery_configs;"

# Regenerate thumbnails
curl -X POST /api/universal-gallery/regenerate-thumbnails

# Clear CDN cache
curl -X POST /api/cdn/purge-cache
```

### Resource Monitoring
```bash
# Check CPU usage
htop

# Check memory usage
free -h

# Check disk usage
df -h

# Check database connections
mysql -e "SHOW PROCESSLIST;"

# Check Redis memory
redis-cli INFO memory
```

## 📞 Emergency Contacts

### Escalation Path
1. **Level 1**: System Administrator (`admin@phoenix4ge.com`)
2. **Level 2**: DevOps Team (`devops@phoenix4ge.com`)  
3. **Level 3**: Development Team (`dev-team@phoenix4ge.com`)
4. **Level 4**: Emergency Hotline (`+1-XXX-XXX-XXXX`)

### Alert Channels
- **Slack**: `#phoenix4ge-alerts`
- **Email**: `alerts@phoenix4ge.com`
- **PagerDuty**: Critical alerts only
- **SMS**: Emergency escalation

## 📚 Documentation Links

- **Architecture Overview**: `/docs/UNIVERSAL_GALLERY_ARCHITECTURE.md`
- **Deployment Guide**: `/docs/UNIVERSAL_GALLERY_DEPLOYMENT_GUIDE.md`
- **API Documentation**: `/docs/api/`
- **Theme Development**: `/docs/THEME_DEVELOPMENT.md`
- **Performance Tuning**: `/docs/PERFORMANCE_TUNING.md`

## 🎯 Common Tasks

### Daily Operations
- [ ] Review overnight alerts
- [ ] Check backup completion
- [ ] Monitor system performance
- [ ] Verify migration progress

### Weekly Tasks
- [ ] Backup integrity verification
- [ ] Performance trend analysis
- [ ] Security log review
- [ ] Database maintenance

### Monthly Tasks
- [ ] Dependency updates
- [ ] Capacity planning review
- [ ] Disaster recovery testing
- [ ] Documentation updates

---

**Remember**: Always create a rollback point before making significant changes to production systems. When in doubt, use the emergency rollback feature to restore to the last known good state.