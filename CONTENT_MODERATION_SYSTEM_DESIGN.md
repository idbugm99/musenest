# phoenix4ge Content Moderation System Design
**Version 1.0** | **Date: July 29, 2025**

## Overview

This document defines the comprehensive content moderation system for phoenix4ge, designed to automatically screen, categorize, and manage user-uploaded images across different content tiers while maintaining strict legal compliance and audit trails.

## Core Principles

1. **Zero Tolerance for CSAM**: Child Sexual Abuse Material is the highest legal priority
2. **Universal Screening**: Every uploaded image undergoes automated analysis
3. **Complete Audit Trail**: Every decision is logged with responsible party
4. **Tiered Content Access**: Automatic routing based on content appropriateness
5. **Human Oversight**: AI + Human hybrid approach for edge cases

## System Architecture

### Primary Content Tiers
- **Public Gallery**: Strictest rules, no nudity, general audience appropriate
- **Private Content**: Moderate rules, some nudity allowed with blur
- **Paysite Content**: Least restrictive, adult content permitted
- **Rejected**: Content not suitable for any tier
- **Flagged**: Requires human review before placement

## Image Upload Flow

### Phase 1: Initial Upload
```
User Upload → File Validation → Duplicate Check → Analysis Queue
```

**Actions:**
1. Generate unique `image_id` and `analysis_id`
2. Store metadata: `model_id`, `slug`, `original_filename`, `file_hash`
3. Create record in `image_moderation_queue` with status: `uploaded`
4. Queue for AI analysis

### Phase 2: Automated Analysis
```
Analysis Queue → MediaPipe + NudeNet → Keyword Detection → Risk Assessment
```

**AI Analysis Components:**
1. **MediaPipe Pose Analysis**: Body positioning, age indicators, pose metrics
2. **NudeNet Body Part Detection**: Anatomical content identification
3. **Keyword Generation**: Standardized descriptors based on detected content
4. **Risk Scoring**: Combined confidence scores and rule evaluation

### Phase 3: Automated Decision Tree

#### Critical Priority: Child Safety
```
IF potential_minor_flag = TRUE:
    → Status: flagged
    → Priority: CRITICAL_CHILD_SAFETY
    → Requires: Human review + age verification
    → Action: Immediate quarantine
```

#### High Priority: Explicit Content
```
IF genitalia + face detected:
    → Status: flagged
    → Priority: HIGH_RISK_AGE_UNCERTAIN
    → Requires: Human review + age verification
    → Action: Quarantine pending review
```

#### Standard Content Routing
```
IF meets public_gallery rules:
    → Status: ai_approved
    → Approved_for_tiers: ["public_gallery", "private_content", "paysite"]
    → Action: Auto-publish to public

ELIF meets private_content rules:
    → Status: ai_approved
    → Approved_for_tiers: ["private_content", "paysite"]
    → Action: Auto-publish to private (with blur if required)

ELIF meets paysite_content rules:
    → Status: ai_approved
    → Approved_for_tiers: ["paysite"]
    → Action: Auto-publish to paysite only

ELSE:
    → Status: flagged
    → Priority: MEDIUM_RISK
    → Requires: Human review
    → Action: Hold for manual review
```

### Phase 4: Human Review Process

**Review Queue Priority:**
1. `CRITICAL_CHILD_SAFETY` - Immediate review required
2. `HIGH_RISK_AGE_UNCERTAIN` - 24-hour review SLA
3. `MEDIUM_RISK` - 72-hour review SLA
4. `LOW_RISK` - 7-day review SLA

**Review Actions:**
- **Approve**: Assign to appropriate tier(s)
- **Reject**: Move to rejected status with reason
- **Age Verify**: Request additional documentation
- **Escalate**: Refer to senior moderator or legal team

## Content Reporting System

### User-Initiated Reports

**Report Categories:**
1. **Child Safety Concern**: Suspected underage individual
2. **Non-Consensual Content**: Revenge porn, deepfakes
3. **Identity Theft**: Catfish/stolen photos
4. **Trademark Violation**: Unauthorized commercial use
5. **Platform Policy Violation**: Other rule violations

### Report Processing Flow

```
Report Submitted → Automated Triage → Human Investigation → Resolution
```

**Triage Logic:**
- **Child Safety**: Immediate quarantine + priority review
- **Non-Consensual**: 24-hour quarantine + legal review
- **Identity Theft**: 72-hour investigation period
- **Other**: Standard review queue

### Evidence Collection
- Reporter contact information
- Specific content URLs/image IDs
- Supporting documentation (if applicable)
- Automated screenshot/backup of reported content

## Database Schema Integration

### Core Tables
- `image_moderation_queue`: Main tracking table
- `pose_metrics` + `nudenet_analysis_summary`: AI analysis results
- `ai_image_descriptions`: Generated content descriptions
- `body_part_allowances`: Configurable tier rules
- `content_reports`: User-submitted reports
- `moderation_appeals`: Challenge/review requests

### Key Relationships
```
image_moderation_queue.analysis_id → pose_metrics.analysis_id
image_moderation_queue.id → content_reports.image_id
image_moderation_queue.approved_by_user_id → users.id
```

## Legal Compliance Framework

### CSAM Prevention (Highest Priority)
- **Immediate Action**: Any potential minor + explicit content = instant quarantine
- **Zero Tolerance**: No appeals process for confirmed CSAM
- **Legal Reporting**: Automatic NCMEC reporting pipeline (US) + equivalent international
- **Evidence Preservation**: Secure storage for law enforcement cooperation
- **Staff Training**: Regular updates on identification techniques

### Secondary Legal Concerns
1. **DMCA Compliance**: Copyright takedown procedures
2. **GDPR/Privacy**: Right to deletion vs. legal evidence preservation
3. **Platform Liability**: Safe harbor protections through diligent moderation
4. **Age Verification**: Documentation requirements for borderline cases

## Edge Case Handling

### Technical Edge Cases
- **Analysis Failures**: Manual review queue for unprocessable images
- **False Positives**: Appeal process for incorrectly flagged content
- **System Downtime**: Fail-safe to human review during AI outages
- **Bulk Uploads**: Rate limiting and priority queuing

### Business Edge Cases
- **Model Disputes**: Process for creators to challenge decisions
- **Retroactive Policy Changes**: Grandfather clauses vs. retroactive enforcement
- **Cross-Platform Content**: Handling content that appears on multiple sites
- **Seasonal Variations**: Holiday/event-specific rule adjustments

### Operational Edge Cases
- **Staff Turnover**: Knowledge transfer and consistency maintenance
- **Escalation Chains**: Clear hierarchy for complex decisions
- **International Content**: Jurisdiction-specific rule variations
- **High-Profile Cases**: Media attention and crisis management

## Performance Metrics & KPIs

### Accuracy Metrics
- **False Positive Rate**: AI incorrectly flagging safe content
- **False Negative Rate**: AI missing problematic content
- **Human Override Rate**: % of AI decisions reversed by humans
- **Appeal Success Rate**: % of user challenges upheld

### Efficiency Metrics
- **Processing Time**: Average time from upload to decision
- **Queue Depth**: Backlog of content awaiting review
- **SLA Compliance**: Meeting review timeframes
- **Resource Utilization**: AI vs. human review ratios

### Safety Metrics
- **CSAM Detection Rate**: Effectiveness of child safety measures
- **Report Response Time**: Speed of addressing user reports
- **Escalation Rate**: % of cases requiring senior review
- **Legal Incident Rate**: Compliance issues or violations

## Implementation Phases

### Phase 1: Core Infrastructure (Immediate)
- Database schema implementation
- Basic AI analysis pipeline
- Manual review queue interface
- Essential audit logging

### Phase 2: Advanced Features (Month 2)
- Automated tier routing
- User reporting system
- Appeal/challenge process
- Performance monitoring dashboard

### Phase 3: Optimization (Month 3)
- Machine learning improvements
- Bulk processing capabilities
- Advanced analytics and reporting
- Integration with legal compliance tools

### Phase 4: Scale & Enhance (Ongoing)
- Multi-region deployment
- Advanced fraud detection
- Real-time monitoring and alerting
- Continuous model training and improvement

## Risk Assessment Matrix

| Risk Type | Probability | Impact | Mitigation |
|-----------|-------------|---------|------------|
| CSAM Upload | Low | Critical | Immediate AI detection + human review |
| False Positive Surge | Medium | High | Appeal process + AI model retraining |
| System Overload | Medium | Medium | Auto-scaling + priority queuing |
| Legal Challenge | Low | High | Comprehensive documentation + legal review |
| Data Breach | Low | Critical | Encryption + access controls + audit logs |

## Contact & Escalation

### Internal Escalation Chain
1. **Level 1**: AI Automated Processing
2. **Level 2**: Standard Human Moderators
3. **Level 3**: Senior Moderation Team
4. **Level 4**: Legal/Compliance Team
5. **Level 5**: Executive Leadership

### External Reporting
- **NCMEC**: CyberTipline for CSAM (US)
- **Local Law Enforcement**: Jurisdiction-specific reporting
- **Platform Partners**: Cross-platform abuse reporting
- **Legal Counsel**: Complex cases requiring legal guidance

---

## Document Control
- **Author**: Claude AI Assistant
- **Review Cycle**: Quarterly
- **Next Review**: October 29, 2025
- **Distribution**: Development Team, Legal Team, Executive Team
- **Classification**: Internal Use Only

---

*This document serves as the foundational design for phoenix4ge's content moderation system. All implementation decisions should reference and align with these principles and procedures.*