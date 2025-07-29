import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
// Using simplified unified auth system

const app = express();

// Admin routes - highest priority, before ALL middleware
app.get('/admin', (req, res) => {
  res.redirect(301, '/api/admin/dashboard');
});

app.get('/api/admin/dashboard', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Giggy Admin Dashboard</title>
    <style>
        body { font-family: system-ui; margin: 20px; background: #f8fafc; line-height: 1.6; }
        .container { max-width: 1000px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); padding: 30px; }
        h1 { color: #1e40af; font-size: 2.5rem; margin-bottom: 10px; border-bottom: 3px solid #3b82f6; padding-bottom: 10px; }
        h2 { color: #1f2937; font-size: 1.5rem; margin-top: 30px; margin-bottom: 15px; border-left: 4px solid #10b981; padding-left: 15px; }
        .stats-section { background: #f0f9ff; border: 2px solid #0ea5e9; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .stat-item { font-size: 18px; margin: 8px 0; font-weight: 600; }
        .stat-number { color: #0ea5e9; font-size: 24px; font-weight: 700; }
        .user-card { background: #fafafa; border: 1px solid #e5e7eb; border-radius: 6px; padding: 15px; margin: 10px 0; font-family: monospace; }
        .user-id { font-size: 20px; font-weight: 700; color: #1e40af; background: #eff6ff; padding: 5px 10px; border-radius: 4px; display: inline-block; margin-bottom: 8px; }
        .user-name { font-size: 16px; font-weight: 600; color: #111827; margin: 5px 0; }
        .user-email { font-size: 14px; color: #6b7280; margin: 5px 0; }
        .user-date { font-size: 13px; color: #9ca3af; margin: 5px 0; }
        .user-status { display: inline-block; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; margin: 5px 0; }
        .status-active { background: #dcfce7; color: #166534; }
        .status-inactive { background: #fee2e2; color: #991b1b; }
        .actions { margin-top: 10px; }
        .action-btn { background: #3b82f6; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; margin-right: 8px; font-size: 12px; font-weight: 500; }
        .action-btn:hover { background: #2563eb; }
        .export-btn { background: #f59e0b; }
        .export-btn:hover { background: #d97706; }
        .refresh-btn { background: #10b981; color: white; border: none; padding: 12px 20px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600; margin: 20px 0; }
        .refresh-btn:hover { background: #059669; }
        .loading { color: #6b7280; font-style: italic; padding: 20px; text-align: center; }
        .error { color: #dc2626; background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; padding: 15px; margin: 10px 0; }
        .last-updated { color: #6b7280; font-size: 13px; font-style: italic; text-align: right; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Giggy Admin Dashboard</h1>
        
        <div class="stats-section">
            <h2>System Overview</h2>
            <div class="stat-item">Total Users: <span class="stat-number" id="totalUsers">Loading...</span></div>
            <div class="stat-item">Active Today: <span class="stat-number" id="activeToday">Loading...</span></div>
            <div class="stat-item">System Status: <span class="stat-number" id="systemStatus">Checking...</span></div>
            <div class="last-updated" id="lastUpdated">Last updated: Never</div>
        </div>

        <button class="refresh-btn" onclick="loadData()">Refresh All Data</button>

        <h2>All Registered Users</h2>
        <div id="usersContainer">
            <div class="loading">Loading user information...</div>
        </div>
    </div>

    <script>
        async function loadStats() {
            try {
                const response = await fetch('/api/monitor/stats');
                const stats = await response.json();
                
                document.getElementById('totalUsers').textContent = stats.totalUsers || 'N/A';
                document.getElementById('activeToday').textContent = stats.activeToday || '0';
                
                const healthResponse = await fetch('/api/monitor/health');
                const health = await healthResponse.json();
                document.getElementById('systemStatus').textContent = health.status === 'healthy' ? 'Healthy' : 'Issues';
                
                document.getElementById('lastUpdated').textContent = 'Last updated: ' + new Date().toLocaleTimeString();
            } catch (error) {
                console.error('Failed to load stats:', error);
                document.getElementById('totalUsers').textContent = 'Error';
                document.getElementById('activeToday').textContent = 'Error';
                document.getElementById('systemStatus').textContent = 'Error';
            }
        }

        async function loadUsers() {
            const container = document.getElementById('usersContainer');
            
            try {
                container.innerHTML = '<div class="loading">Loading user information...</div>';
                
                const response = await fetch('/api/admin/users');
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || 'Failed to fetch users');
                }
                
                let usersHtml = '';
                
                data.users.forEach(user => {
                    usersHtml += \`
                        <div class="user-card">
                            <div class="user-id">User ID: #\${user.id}</div>
                            <div class="user-name">Name: \${user.name || 'No name'}</div>
                            <div class="user-email">Email: \${user.email || 'No email'}</div>
                            <div class="user-date">Created: \${user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { 
                                weekday: 'short',
                                year: 'numeric', 
                                month: 'short', 
                                day: 'numeric' 
                            }) : 'Unknown'}</div>
                            <span class="user-status \${user.isActive ? 'status-active' : 'status-inactive'}">
                                \${user.isActive ? 'Active Account' : 'Inactive Account'}
                            </span>
                            <div class="actions">
                                <button class="action-btn" onclick="viewUser(\${user.id})">View Details</button>
                                <button class="action-btn export-btn" onclick="exportUser(\${user.id})">Export Data</button>
                            </div>
                        </div>
                    \`;
                });
                
                if (usersHtml === '') {
                    usersHtml = '<div class="error">No users found in the system.</div>';
                }
                
                container.innerHTML = usersHtml;
                
            } catch (error) {
                container.innerHTML = '<div class="error">Failed to load users: ' + error.message + '</div>';
            }
        }

        async function viewUser(userId) {
            try {
                const response = await fetch('/api/admin/user/' + userId);
                const data = await response.json();
                
                if (response.ok) {
                    const details = 'USER DETAILS - ID: ' + data.user.id + '\\n\\n' +
                        'Name: ' + (data.user.name || 'No name') + '\\n' +
                        'Email: ' + (data.user.email || 'No email') + '\\n' +
                        'Created: ' + (data.user.createdAt ? new Date(data.user.createdAt).toLocaleString() : 'Unknown') + '\\n' +
                        'Status: ' + (data.user.isActive ? 'Active' : 'Inactive') + '\\n' +
                        'Onboarding: ' + (data.user.onboardingCompleted ? 'Complete' : 'Pending') + '\\n\\n' +
                        'DATA SUMMARY:\\n' +
                        '• Total Gigs: ' + (data.summary.totalGigs || 0) + '\\n' +
                        '• Total Goals: ' + (data.summary.totalGoals || 0) + '\\n' +
                        '• Last Activity: ' + (data.summary.lastActivity ? new Date(data.summary.lastActivity).toLocaleString() : 'Never');
                    
                    alert(details);
                } else {
                    alert('Failed to fetch user details: ' + (data.error || 'Unknown error'));
                }
            } catch (error) {
                alert('Error fetching user details: ' + error.message);
            }
        }

        async function exportUser(userId) {
            try {
                const response = await fetch('/api/monitor/export/' + userId);
                const data = await response.json();
                
                if (response.ok) {
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'user-' + userId + '-export-' + new Date().toISOString().split('T')[0] + '.json';
                    a.click();
                    window.URL.revokeObjectURL(url);
                    
                    alert('User data exported successfully!');
                } else {
                    alert('Failed to export user data: ' + (data.error || 'Unknown error'));
                }
            } catch (error) {
                alert('Error exporting user data: ' + error.message);
            }
        }

        async function loadData() {
            await Promise.all([loadStats(), loadUsers()]);
        }

        // Load data immediately and set up auto-refresh
        loadData();
        setInterval(loadStats, 30000); // Refresh stats every 30 seconds
    </script>
</body>
</html>
  `);
});

// Admin route middleware (backup - must be before body parsing for priority)
app.use((req, res, next) => {
  const path = req.path || req.url;
  
  if (path === '/admin' || path.endsWith('/admin')) {
    return res.redirect(301, '/api/admin/dashboard');
  }
  
  if (path === '/api/admin/dashboard' || path.endsWith('/api/admin/dashboard')) {
    const adminHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Giggy Admin Dashboard</title>
    <style>
        body { font-family: system-ui; margin: 20px; background: #f8fafc; line-height: 1.6; }
        .container { max-width: 1000px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); padding: 30px; }
        h1 { color: #1e40af; font-size: 2.5rem; margin-bottom: 10px; border-bottom: 3px solid #3b82f6; padding-bottom: 10px; }
        h2 { color: #1f2937; font-size: 1.5rem; margin-top: 30px; margin-bottom: 15px; border-left: 4px solid #10b981; padding-left: 15px; }
        .stats-section { background: #f0f9ff; border: 2px solid #0ea5e9; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .stat-item { font-size: 18px; margin: 8px 0; font-weight: 600; }
        .stat-number { color: #0ea5e9; font-size: 24px; font-weight: 700; }
        .user-card { background: #fafafa; border: 1px solid #e5e7eb; border-radius: 6px; padding: 15px; margin: 10px 0; font-family: monospace; }
        .user-id { font-size: 20px; font-weight: 700; color: #1e40af; background: #eff6ff; padding: 5px 10px; border-radius: 4px; display: inline-block; margin-bottom: 8px; }
        .user-name { font-size: 16px; font-weight: 600; color: #111827; margin: 5px 0; }
        .user-email { font-size: 14px; color: #6b7280; margin: 5px 0; }
        .user-date { font-size: 13px; color: #9ca3af; margin: 5px 0; }
        .user-status { display: inline-block; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; margin: 5px 0; }
        .status-active { background: #dcfce7; color: #166534; }
        .status-inactive { background: #fee2e2; color: #991b1b; }
        .actions { margin-top: 10px; }
        .action-btn { background: #3b82f6; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; margin-right: 8px; font-size: 12px; font-weight: 500; }
        .action-btn:hover { background: #2563eb; }
        .export-btn { background: #f59e0b; }
        .export-btn:hover { background: #d97706; }
        .refresh-btn { background: #10b981; color: white; border: none; padding: 12px 20px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600; margin: 20px 0; }
        .refresh-btn:hover { background: #059669; }
        .loading { color: #6b7280; font-style: italic; padding: 20px; text-align: center; }
        .error { color: #dc2626; background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; padding: 15px; margin: 10px 0; }
        .last-updated { color: #6b7280; font-size: 13px; font-style: italic; text-align: right; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Giggy Admin Dashboard</h1>
        
        <div class="stats-section">
            <h2>System Overview</h2>
            <div class="stat-item">Total Users: <span class="stat-number" id="totalUsers">-</span></div>
            <div class="stat-item">Active Today: <span class="stat-number" id="activeToday">-</span></div>
            <div class="stat-item">System Status: <span class="stat-number" id="systemStatus">-</span></div>
            <div class="last-updated" id="lastUpdated">Last updated: Never</div>
        </div>

        <button class="refresh-btn" onclick="loadData()">Refresh All Data</button>

        <h2>All Registered Users</h2>
        <div id="usersContainer">
            <div class="loading">Loading user information...</div>
        </div>
    </div>

    <script>
        async function loadStats() {
            try {
                const response = await fetch('/api/monitor/stats');
                const stats = await response.json();
                
                document.getElementById('totalUsers').textContent = stats.totalUsers;
                document.getElementById('activeToday').textContent = stats.activeToday;
                
                const healthResponse = await fetch('/api/monitor/health');
                const health = await healthResponse.json();
                document.getElementById('systemStatus').textContent = health.status === 'healthy' ? 'Healthy' : 'Issues';
                
                document.getElementById('lastUpdated').textContent = 'Last updated: ' + new Date().toLocaleTimeString();
            } catch (error) {
                console.error('Failed to load stats:', error);
            }
        }

        async function loadUsers() {
            const container = document.getElementById('usersContainer');
            
            try {
                container.innerHTML = '<div class="loading">Loading user information...</div>';
                
                const response = await fetch('/api/admin/users');
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || 'Failed to fetch users');
                }
                
                let usersHtml = '';
                
                data.users.forEach(user => {
                    usersHtml += \`
                        <div class="user-card">
                            <div class="user-id">User ID: #\${user.id}</div>
                            <div class="user-name">Name: \${user.name}</div>
                            <div class="user-email">Email: \${user.email}</div>
                            <div class="user-date">Created: \${new Date(user.createdAt).toLocaleDateString('en-US', { 
                                weekday: 'short',
                                year: 'numeric', 
                                month: 'short', 
                                day: 'numeric' 
                            })}</div>
                            <span class="user-status \${user.isActive ? 'status-active' : 'status-inactive'}">
                                \${user.isActive ? 'Active Account' : 'Inactive Account'}
                            </span>
                            <div class="actions">
                                <button class="action-btn" onclick="viewUser(\${user.id})">View Details</button>
                                <button class="action-btn export-btn" onclick="exportUser(\${user.id})">Export Data</button>
                            </div>
                        </div>
                    \`;
                });
                
                container.innerHTML = usersHtml;
                
            } catch (error) {
                container.innerHTML = '<div class="error">Failed to load users: ' + error.message + '</div>';
            }
        }

        async function viewUser(userId) {
            try {
                const response = await fetch('/api/admin/user/' + userId);
                const data = await response.json();
                
                if (response.ok) {
                    const details = 'USER DETAILS - ID: ' + data.user.id + '\\n\\n' +
                        'Name: ' + data.user.name + '\\n' +
                        'Email: ' + data.user.email + '\\n' +
                        'Created: ' + new Date(data.user.createdAt).toLocaleString() + '\\n' +
                        'Status: ' + (data.user.isActive ? 'Active' : 'Inactive') + '\\n' +
                        'Onboarding: ' + (data.user.onboardingCompleted ? 'Complete' : 'Pending') + '\\n\\n' +
                        'DATA SUMMARY:\\n' +
                        '• Total Gigs: ' + data.summary.totalGigs + '\\n' +
                        '• Total Goals: ' + data.summary.totalGoals + '\\n' +
                        '• Last Activity: ' + new Date(data.summary.lastActivity).toLocaleString();
                    
                    alert(details);
                } else {
                    alert('Failed to fetch user details');
                }
            } catch (error) {
                alert('Error fetching user details');
            }
        }

        async function exportUser(userId) {
            try {
                const response = await fetch('/api/monitor/export/' + userId);
                const data = await response.json();
                
                if (response.ok) {
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'user-' + userId + '-export-' + new Date().toISOString().split('T')[0] + '.json';
                    a.click();
                    window.URL.revokeObjectURL(url);
                    
                    alert('User data exported successfully!');
                } else {
                    alert('Failed to export user data');
                }
            } catch (error) {
                alert('Error exporting user data');
            }
        }

        async function loadData() {
            await Promise.all([loadStats(), loadUsers()]);
        }

        loadData();
        setInterval(loadStats, 30000);
    </script>
</body>
</html>
    `;
    
    res.setHeader('Content-Type', 'text/html');
    return res.send(adminHtml);
  }
  
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Authentication system
// Auth setup moved to routes for better control

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    const server = await registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      
      log(`Error: ${message}`, "error");
      res.status(status).json({ message });
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Serve the app on the configured port
    // Port 5000 for development, process.env.PORT for production
    const port = process.env.PORT || 5000;
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`serving on port ${port}`);
    });
  } catch (error) {
    log(`Failed to start server: ${error}`, "error");
    process.exit(1);
  }
})();
