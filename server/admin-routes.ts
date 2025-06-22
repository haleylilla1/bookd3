import type { Express } from "express";
import { storage } from "./storage";

// Admin middleware - check if user is admin
const requireAdmin = async (req: any, res: any, next: any) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const user = await storage.getUser(req.user.id);
  // For now, check if user email is admin (you can modify this logic)
  if (!user || !user.email?.includes('admin') && user.email !== 'haleylilla@gmail.com') {
    return res.status(403).json({ message: 'Admin access required' });
  }

  next();
};

export function setupAdminRoutes(app: Express) {
  // Get all users with basic info
  app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const sanitizedUsers = users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        isActive: user.isActive,
        subscriptionStatus: user.subscriptionStatus,
        createdAt: user.createdAt,
        lastLogin: user.updatedAt
      }));
      res.json(sanitizedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  });

  // Get system statistics
  app.get('/api/admin/stats', requireAdmin, async (req, res) => {
    try {
      const stats = await storage.getSystemStats();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
      res.status(500).json({ message: 'Failed to fetch statistics' });
    }
  });

  // Get audit logs
  app.get('/api/admin/audit-logs', requireAdmin, async (req, res) => {
    try {
      const logs = await storage.getRecentAuditLogs(100);
      res.json(logs);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      res.status(500).json({ message: 'Failed to fetch audit logs' });
    }
  });

  // Get detailed user data
  app.get('/api/admin/user-data/:userId', requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const userData = await storage.getUserCompleteData(userId);
      res.json(userData);
    } catch (error) {
      console.error('Error fetching user data:', error);
      res.status(500).json({ message: 'Failed to fetch user data' });
    }
  });

  // Export single user data
  app.get('/api/admin/export-user/:userId', requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const userData = await storage.getUserExportData(userId);
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="user-${userId}-data.json"`);
      res.json(userData);
    } catch (error) {
      console.error('Error exporting user data:', error);
      res.status(500).json({ message: 'Failed to export user data' });
    }
  });

  // Create full system backup
  app.post('/api/admin/backup-all', requireAdmin, async (req, res) => {
    try {
      const backupData = await storage.createFullBackup();
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="giggy-backup-${new Date().toISOString().split('T')[0]}.json"`);
      res.json(backupData);
      
      // Log the backup creation
      await storage.logAudit(req.user.id, 'FULL_BACKUP', 'system', null, null, { timestamp: new Date() });
    } catch (error) {
      console.error('Error creating backup:', error);
      res.status(500).json({ message: 'Failed to create backup' });
    }
  });

  // Get user activity timeline
  app.get('/api/admin/user-activity/:userId', requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const activity = await storage.getUserActivity(userId);
      res.json(activity);
    } catch (error) {
      console.error('Error fetching user activity:', error);
      res.status(500).json({ message: 'Failed to fetch user activity' });
    }
  });

  // Emergency user data recovery
  app.post('/api/admin/recover-user/:userId', requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const recoveryResult = await storage.recoverUserData(userId);
      
      await storage.logAudit(req.user.id, 'DATA_RECOVERY', 'users', userId, null, recoveryResult);
      res.json({ message: 'User data recovery initiated', result: recoveryResult });
    } catch (error) {
      console.error('Error recovering user data:', error);
      res.status(500).json({ message: 'Failed to recover user data' });
    }
  });
}