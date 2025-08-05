# Bookd Backup & Recovery Procedures

## Overview
This document outlines the comprehensive backup and recovery procedures for the Bookd application, including database backups, user data export functionality, and emergency recovery protocols.

## Database Backup Strategy

### Automated Backups
- **Neon Database**: Automatic backups handled by Neon serverless infrastructure
- **Point-in-time Recovery**: Available through Neon console for the past 7 days (Hobby tier)
- **Branch Creation**: Database branches can be created from any point in time for testing/recovery

### Manual Backup Procedures
1. **Developer Access**: Use Neon console to create manual snapshots
2. **Production Backup**: Database branches created before major deployments
3. **Schema Migrations**: Always backup before running `npm run db:push`

### Backup Retention Policy
- **Automated**: 7 days point-in-time recovery (Neon free tier)
- **Manual Snapshots**: Created before major releases
- **User Exports**: Stored locally by users, cleaned up after 10 files per user

## User Data Export Functionality

### Export Options Available to Users

#### 1. JSON Export (`/api/backup/export`)
```json
{
  "user": {
    "id": 123,
    "name": "John Doe",
    "email": "john@example.com",
    "homeAddress": "123 Main St",
    "password": "[REDACTED]"
  },
  "gigs": [...],
  "expenses": [...],
  "goals": [...],
  "exportDate": "2025-08-05T03:00:00.000Z",
  "version": "1.0"
}
```

#### 2. Complete Backup Archive (`/api/backup/download`)
- **Format**: ZIP archive
- **Contents**: 
  - `backup.json` - Complete user data
  - `metadata.json` - Export information and record counts
- **Security**: Password-protected (future enhancement)

#### 3. Backup Information (`/api/backup/info`)
- Total backup files created
- Storage usage statistics  
- Oldest backup date

### Data Included in Exports
✅ **Included:**
- User profile information
- All gig records with payment status
- Business expenses and categories
- Income goals and progress
- Tax preferences and settings
- Business address and contact info

❌ **Excluded for Security:**
- Password hashes
- Session tokens
- Authentication provider IDs
- Internal system metadata

## Recovery Procedures

### User-Initiated Recovery

#### Self-Service Data Export
1. **Access**: Profile → Data Export section
2. **JSON Export**: Immediate download of readable data
3. **Backup Archive**: Complete compressed backup
4. **Verification**: Users can validate exported data integrity

#### Data Migration Process
1. User exports data from old account
2. Creates new account if needed
3. **Manual Process**: Contact support for data restoration
4. **Future Enhancement**: Self-service import functionality

### Emergency Recovery Procedures

#### Database Recovery (Developer/Admin Only)

##### Point-in-Time Recovery
```bash
# Through Neon Console:
1. Access Neon Dashboard
2. Select target database
3. Navigate to "Branches" 
4. Create branch from specific timestamp
5. Update DATABASE_URL to point to recovery branch
6. Verify data integrity
7. Switch production traffic to recovered database
```

##### Schema Recovery
```bash
# If schema corruption occurs:
1. npm run db:push --force  # Reset schema to match code
2. Restore from Neon backup if data loss occurred
3. Run data validation scripts
4. Update application with corrected schema
```

#### Application Recovery

##### Server Recovery
```bash
# If application server fails:
1. Check Replit deployment status
2. Restart workflow if needed
3. Verify database connectivity
4. Check environment variables
5. Review error logs in Sentry
```

##### Data Consistency Recovery
```typescript
// If data inconsistencies detected:
import { backupManager } from './server/backup';

// 1. Create emergency backup
const backup = await backupManager.createUserBackup(userId);

// 2. Validate data integrity  
const validation = await backupManager.validateBackup(backup);

// 3. Restore if needed (DANGEROUS - Admin only)
if (!validation.valid) {
  console.log("Validation errors:", validation.errors);
  // Manual intervention required
}
```

### Recovery Testing Procedures

#### Monthly Recovery Drills
1. **Export Test**: Verify all export endpoints function correctly
2. **Data Validation**: Check exported data completeness
3. **Import Simulation**: Test data restoration process
4. **Performance Check**: Measure backup/export times

#### Disaster Recovery Testing
1. **Database Branch**: Create test recovery from backup
2. **Application Deploy**: Deploy to test environment with recovered data
3. **Functionality Test**: Verify all features work with recovered data
4. **User Acceptance**: Test critical user flows

## Monitoring and Alerting

### Backup Health Monitoring
- **Endpoint**: `/api/backup/info` - Monitor backup creation success
- **Metrics**: Track export request frequency and success rates
- **Alerts**: Notify if backup creation fails repeatedly

### Data Integrity Monitoring
- **Validation**: Regular data integrity checks during exports
- **Consistency**: Cross-reference gig totals with expense records
- **Anomalies**: Alert on unusual data patterns during export

## Security Considerations

### Data Protection
- **Transit**: All backup endpoints require authentication
- **Storage**: Exported files contain sensitive financial data
- **Retention**: Local cleanup of old backup files (10 file limit)
- **Access**: Only authenticated users can export their own data

### Privacy Compliance
- **GDPR Ready**: Users can export all their personal data
- **Data Minimization**: Only necessary data included in exports
- **Right to Portability**: Full data export in machine-readable format
- **Anonymization**: Sensitive fields redacted in exports

## Troubleshooting Common Issues

### Export Failures
```bash
# If exports fail:
1. Check disk space in /backups directory
2. Verify database connectivity  
3. Check user permissions
4. Review error logs in Sentry
5. Test with minimal data set
```

### Performance Issues
```bash
# If exports are slow:
1. Check database query performance
2. Implement pagination for large datasets
3. Add compression to reduce file sizes
4. Consider async export with email delivery
```

### Data Corruption
```bash
# If exported data is corrupted:
1. Validate backup data integrity
2. Check database indexes and constraints
3. Review data transformation logic
4. Test with known good data set
```

## Contact Information

### Emergency Contacts
- **Database Issues**: Neon Support (for infrastructure)
- **Application Issues**: Review Sentry alerts and logs
- **User Data Issues**: Internal escalation process

### Documentation Updates
This document should be updated whenever:
- New backup features are added
- Recovery procedures change
- Database schema modifications occur
- Security requirements change

---

**Last Updated**: August 5, 2025  
**Version**: 1.0  
**Next Review**: September 5, 2025