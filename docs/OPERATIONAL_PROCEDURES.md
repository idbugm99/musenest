# Universal Gallery System - Operational Procedures

## Overview

This document provides comprehensive operational procedures for maintaining, monitoring, and optimizing the Universal Gallery & Template Rebuild system in production. These procedures ensure system reliability, performance, and security.

## Daily Operations

### Morning System Health Check (30 minutes)

**Automated Health Dashboard Review:**
```bash
# Check overall system status
curl http://localhost:3000/api/production-monitoring/dashboard

# Review overnight alerts
curl "http://localhost:3000/api/production-monitoring/alerts?limit=20&since=24h"

# Verify backup completion
curl http://localhost:3000/api/backup-recovery/status

# Check active migrations
curl http://localhost:3000/api/theme-migrations?status=in_progress
```

**Key Metrics to Verify:**
- [ ] System uptime > 99.9%
- [ ] Average response time < 500ms
- [ ] Error rate < 2%
- [ ] Database connection pool < 80%
- [ ] Cache hit rate > 85%
- [ ] Backup completion within last 24h

**Action Items:**
- Document any anomalies in operational log
- Escalate critical issues immediately
- Review and acknowledge resolved alerts
- Plan day's maintenance activities

### Evening System Review (15 minutes)

**Performance Summary:**
```bash
# Daily performance report
curl "http://localhost:3000/api/production-monitoring/metrics?timeframe=24h&aggregation=avg"

# User activity summary
curl "http://localhost:3000/api/universal-gallery/analytics?period=daily"

# Resource utilization trends
curl "http://localhost:3000/api/production-monitoring/dashboard"
```

**End-of-Day Checklist:**
- [ ] All critical alerts resolved
- [ ] Backup verification completed
- [ ] Performance metrics within baselines  
- [ ] No failed migrations or deployments
- [ ] Security incidents logged and addressed

## Weekly Operations

### Monday: System Performance Review

**Performance Analysis (45 minutes):**

```bash
# Weekly performance trends
curl "http://localhost:3000/api/production-monitoring/performance-trends/response_time?timeframe=7d"

# Database performance review
mysql -e "
SELECT 
    TABLE_NAME,
    ROUND(((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024), 2) AS 'Size (MB)',
    TABLE_ROWS,
    ROUND((INDEX_LENGTH / (DATA_LENGTH + INDEX_LENGTH)) * 100, 2) AS 'Index Ratio %'
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'phoenix4ge_production'
ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC
LIMIT 20;
"

# Cache performance analysis  
redis-cli INFO stats | grep -E "(keyspace_hits|keyspace_misses|used_memory)"

# CDN performance check
curl -w "@curl-format.txt" -s -o /dev/null https://cdn.phoenix4ge.com/test-asset.jpg
```

**Action Items:**
- [ ] Identify performance bottlenecks
- [ ] Review slow database queries
- [ ] Optimize cache configurations
- [ ] Plan capacity adjustments
- [ ] Update performance baselines if needed

### Tuesday: Security & Compliance Review

**Security Audit (60 minutes):**

```bash
# Review authentication logs
grep "authentication" /var/log/phoenix4ge/app.log | tail -100

# Check for suspicious activities
mysql -e "
SELECT user_ip, COUNT(*) as attempts, MAX(attempted_at) as last_attempt
FROM failed_auth_attempts 
WHERE attempted_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY user_ip 
HAVING attempts > 10
ORDER BY attempts DESC;
"

# SSL certificate check
openssl s_client -connect phoenix4ge.com:443 -servername phoenix4ge.com 2>/dev/null | openssl x509 -noout -dates

# Dependency vulnerability scan
npm audit --audit-level moderate
```

**Security Checklist:**
- [ ] Review failed authentication attempts
- [ ] Check SSL certificate expiration (< 30 days)
- [ ] Update security patches if available
- [ ] Review user access permissions
- [ ] Validate backup encryption status
- [ ] Check for unauthorized API access

### Wednesday: Database Maintenance

**Database Optimization (90 minutes):**

```bash
# Database health check
mysql -e "SHOW ENGINE INNODB STATUS\G" | grep -A 20 "LATEST DETECTED DEADLOCK"

# Table optimization
mysql -e "
OPTIMIZE TABLE gallery_images, 
             universal_gallery_configs,
             theme_migrations,
             production_metrics,
             backup_records;
"

# Index analysis
mysql -e "
SELECT 
    s.table_name,
    s.index_name,
    s.cardinality,
    ROUND(s.cardinality / t.table_rows * 100, 2) AS selectivity
FROM information_schema.STATISTICS s
JOIN information_schema.TABLES t ON s.table_schema = t.table_schema 
    AND s.table_name = t.table_name
WHERE s.table_schema = 'phoenix4ge_production'
    AND s.cardinality IS NOT NULL
ORDER BY selectivity ASC;
"

# Backup integrity verification
curl -X POST http://localhost:3000/api/backup-recovery/verify/latest
```

**Database Maintenance Tasks:**
- [ ] Analyze slow query log
- [ ] Update table statistics
- [ ] Review and optimize indexes
- [ ] Clean up old log tables
- [ ] Verify foreign key constraints
- [ ] Check table fragmentation levels

### Thursday: Backup & Disaster Recovery Testing

**Backup Verification (120 minutes):**

```bash
# List recent backups
curl http://localhost:3000/api/backup-recovery/backups?limit=10

# Test backup restoration (staging environment)
curl -X POST http://staging.phoenix4ge.com/api/backup-recovery/restore/{latest-backup-id} \
  -d '{"components": ["configuration"], "reason": "Weekly DR test"}'

# Verify restored data integrity
curl http://staging.phoenix4ge.com/api/universal-gallery/health

# Document recovery time
echo "Recovery test completed: $(date)" >> /var/log/phoenix4ge/dr-tests.log
```

**DR Testing Checklist:**
- [ ] Test configuration restore
- [ ] Verify database restoration
- [ ] Test file system recovery
- [ ] Validate system functionality post-restore
- [ ] Document recovery time objectives (RTO)
- [ ] Update disaster recovery procedures if needed

### Friday: Capacity Planning & Analytics

**Capacity Analysis (60 minutes):**

```bash
# Resource utilization trends
curl "http://localhost:3000/api/production-monitoring/metrics?category=system&timeframe=7d"

# Storage usage analysis
df -h | grep -E "(upload|backup|cache)"

# Network utilization
iftop -t -s 300 > /tmp/network-usage.txt

# User growth analysis
mysql -e "
SELECT 
    DATE(created_at) as date,
    COUNT(*) as new_users,
    SUM(COUNT(*)) OVER (ORDER BY DATE(created_at)) as cumulative
FROM users 
WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY DATE(created_at)
ORDER BY date;
"
```

**Capacity Planning Tasks:**
- [ ] Review storage growth trends
- [ ] Analyze CPU and memory utilization
- [ ] Plan for upcoming traffic spikes
- [ ] Review CDN usage and costs
- [ ] Update capacity forecasting models

## Monthly Operations

### First Monday: Infrastructure Review

**Infrastructure Assessment (3 hours):**

1. **Server Health Analysis:**
   - Review server performance metrics
   - Check for hardware issues or warnings
   - Update server software and security patches
   - Review load balancer configurations

2. **Network Performance:**
   - Analyze CDN performance and costs
   - Review DNS resolution times
   - Check SSL/TLS configurations
   - Validate firewall rules and security groups

3. **Cost Optimization:**
   - Review cloud infrastructure costs
   - Identify unused or underutilized resources
   - Optimize auto-scaling policies
   - Evaluate reserved instance opportunities

### Second Monday: Security Deep Dive

**Comprehensive Security Review (4 hours):**

1. **Vulnerability Assessment:**
   ```bash
   # Run comprehensive security scan
   nmap -sV -sC phoenix4ge.com
   
   # Check for SQL injection vulnerabilities
   sqlmap -u "http://phoenix4ge.com/api/gallery/search?q=test" --batch
   
   # Web application security scan
   nikto -h https://phoenix4ge.com -Format htm -output security-scan.html
   ```

2. **Access Control Review:**
   - Audit user permissions and roles
   - Review API key usage and rotation
   - Check administrative access logs
   - Validate two-factor authentication usage

3. **Compliance Verification:**
   - Review GDPR compliance measures
   - Check data retention policies
   - Verify encryption standards
   - Update security documentation

### Third Monday: Performance Optimization

**Performance Deep Dive (4 hours):**

1. **Application Performance:**
   - Profile critical code paths
   - Analyze database query performance
   - Review caching effectiveness
   - Optimize asset loading strategies

2. **Infrastructure Performance:**
   - Review auto-scaling effectiveness
   - Analyze load distribution
   - Optimize database configurations
   - Review CDN cache hit rates

3. **User Experience Analysis:**
   - Review Core Web Vitals trends
   - Analyze user journey performance
   - Identify mobile-specific issues
   - Test from various global locations

### Fourth Monday: Documentation & Process Review

**Process Improvement (2 hours):**

1. **Documentation Updates:**
   - Review and update operational procedures
   - Update architecture diagrams
   - Refresh troubleshooting guides
   - Update emergency contact information

2. **Process Optimization:**
   - Review incident response times
   - Analyze recurring issues and solutions
   - Update monitoring and alerting rules
   - Review and improve automation scripts

## Quarterly Operations

### Quarter-End Review (Full Day)

**Comprehensive System Assessment:**

1. **Performance Review (2 hours):**
   - Quarterly performance report generation
   - Trend analysis and forecasting
   - Benchmark comparison with previous quarters
   - Performance goal assessment and adjustment

2. **Financial Analysis (1 hour):**
   - Infrastructure cost analysis
   - ROI calculation for system improvements
   - Budget planning for next quarter
   - Cost optimization recommendations

3. **Technology Review (2 hours):**
   - Evaluate new technologies and tools
   - Plan technology upgrades and migrations
   - Review technical debt and prioritize fixes
   - Update technology roadmap

4. **Team & Process Review (1 hour):**
   - Team performance and skills assessment
   - Process effectiveness evaluation
   - Training needs identification
   - Tool and workflow optimization

5. **Strategic Planning (2 hours):**
   - Review business objectives alignment
   - Update operational goals and KPIs
   - Plan major initiatives for next quarter
   - Risk assessment and mitigation planning

## Emergency Procedures

### Incident Response

**Severity Levels:**

**CRITICAL (P0) - Immediate Response Required:**
- Complete system outage
- Data corruption or loss
- Security breach or unauthorized access
- Payment system failures

**HIGH (P1) - Response within 1 hour:**
- Significant performance degradation (>50%)
- Partial system functionality loss
- Failed backups
- SSL certificate expiration

**MEDIUM (P2) - Response within 4 hours:**
- Minor performance issues
- Non-critical feature failures
- Monitoring alert system issues
- Theme migration failures

**LOW (P3) - Response within 24 hours:**
- Documentation issues
- Minor UI/UX problems
- Non-urgent optimization opportunities
- Cosmetic issues

### Emergency Response Procedures

**Critical Incident Response (P0):**

1. **Immediate Actions (0-5 minutes):**
   ```bash
   # Enable maintenance mode
   curl -X POST http://localhost:3000/api/system/maintenance-mode
   
   # Check system status
   curl http://localhost:3000/api/production-monitoring/health
   
   # Alert incident commander
   curl -X POST http://localhost:3000/api/alerts/emergency \
     -d '{"incident_type": "P0", "description": "System outage"}'
   ```

2. **Assessment (5-15 minutes):**
   - Identify affected systems and users
   - Determine root cause analysis approach
   - Estimate impact and recovery time
   - Communicate with stakeholders

3. **Recovery Actions (15+ minutes):**
   ```bash
   # Emergency rollback if needed
   curl -X POST http://localhost:3000/api/backup-recovery/emergency-rollback
   
   # System health verification
   curl http://localhost:3000/api/production-monitoring/health
   
   # Disable maintenance mode when stable
   curl -X DELETE http://localhost:3000/api/system/maintenance-mode
   ```

### Communication Protocols

**Internal Communication:**
- **P0**: Immediate Slack alert + SMS to on-call engineer
- **P1**: Slack alert + Email to team leads
- **P2**: Slack alert during business hours
- **P3**: Weekly summary report

**External Communication:**
- **P0**: Status page update + customer email within 30 minutes
- **P1**: Status page update within 2 hours
- **P2**: Internal tracking only
- **P3**: No external communication required

## Maintenance Windows

### Scheduled Maintenance

**Weekly Maintenance Window:**
- **Time**: Sundays 2:00 AM - 4:00 AM UTC
- **Duration**: 2 hours maximum
- **Activities**: 
  - Database maintenance and optimization
  - Security updates and patches
  - Performance tuning
  - Backup verification

**Monthly Maintenance Window:**
- **Time**: First Sunday 1:00 AM - 6:00 AM UTC
- **Duration**: 5 hours maximum
- **Activities**:
  - Major system updates
  - Infrastructure changes
  - Disaster recovery testing
  - Capacity scaling

### Emergency Maintenance

**Criteria for Emergency Maintenance:**
- Critical security vulnerabilities
- System stability issues
- Data integrity concerns
- Compliance requirements

**Emergency Maintenance Process:**
1. Risk assessment and approval from system owner
2. Notification to stakeholders (minimum 2 hours notice)
3. Rollback plan preparation and validation
4. Maintenance execution with monitoring
5. Post-maintenance verification and communication

## Key Performance Indicators (KPIs)

### System Reliability
- **Uptime**: Target 99.99%
- **Mean Time to Recovery (MTTR)**: < 15 minutes for P0 incidents
- **Mean Time Between Failures (MTBF)**: > 720 hours

### Performance Metrics
- **Average Response Time**: < 300ms
- **95th Percentile Response Time**: < 1000ms
- **Error Rate**: < 0.5%
- **Throughput**: > 1000 requests per second

### Operational Metrics
- **Backup Success Rate**: 100%
- **Security Incident Count**: 0 per month
- **Planned vs Unplanned Downtime Ratio**: 90/10

### Business Impact Metrics
- **User Satisfaction Score**: > 95%
- **Feature Adoption Rate**: > 80% within 30 days
- **Cost per Transaction**: Decreasing trend

---

These operational procedures ensure the Universal Gallery system maintains high availability, performance, and security standards while supporting business objectives and user satisfaction.