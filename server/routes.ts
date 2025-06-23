import type { Express } from "express";
import { createServer, type Server } from "http";
import path from "path";
import { storage } from "./storage";
import { 
  insertGigSchema, 
  insertGoalSchema, 
  insertAllocationSchema, 
  insertInvoiceSchema,
  insertExpenseSchema,
  insertBudgetSchema,
  insertExpenseCategorySchema 
} from "@shared/schema";
import { z } from "zod";
import { setupAuthRoutes } from "./auth-routes";
import { isAuthenticated } from "./replitAuth";
import { db } from "./db";
import { count, gte } from "drizzle-orm";
import { users } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Admin dashboard routes (high priority)
  app.get('/admin', (req, res) => {
    res.redirect(301, '/api/admin/dashboard');
  });

  app.get('/api/admin/dashboard', (req, res) => {
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
    `;
    
    res.setHeader('Content-Type', 'text/html');
    res.send(adminHtml);
  });

  // Setup authentication routes first
  const requireAuth = setupAuthRoutes(app);
  
  // Simple session-based user switching for existing functionality
  let currentUserId = 1; // Default user

  // Helper function to get current user ID from session or auth
  const getCurrentUserId = (req: any) => {
    if (req.isAuthenticated && req.isAuthenticated()) {
      return req.user.id;
    }
    return currentUserId;
  };

  // Helper function to get current user
  const getCurrentUser = async (req?: any) => {
    const userId = req ? getCurrentUserId(req) : currentUserId;
    return await storage.getUser(userId);
  };

  // User switching endpoint for testing
  app.post("/api/switch-user", async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId || typeof userId !== "number") {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      currentUserId = userId;
      res.json({ message: "User switched successfully", user });
    } catch (error) {
      console.error("Switch user error:", error);
      res.status(500).json({ message: "Failed to switch user" });
    }
  });

  // Get current user (fallback for existing functionality)
  app.get("/api/user", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Update user profile
  app.put("/api/user", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const { name, email, homeAddress, defaultTaxPercentage } = req.body;
      
      const updatedUser = await storage.updateUser(userId, {
        name,
        email,
        homeAddress,
        defaultTaxPercentage,
      });
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Gig routes
  app.get("/api/gigs", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const gigs = await storage.getGigsByUser(userId);
      res.json(gigs);
    } catch (error) {
      console.error("Get gigs error:", error);
      res.status(500).json({ message: "Failed to fetch gigs" });
    }
  });

  app.get("/api/gigs/date-range", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "Start date and end date are required" });
      }
      
      const gigs = await storage.getGigsByDateRange(userId, startDate as string, endDate as string);
      res.json(gigs);
    } catch (error) {
      console.error("Get gigs by date range error:", error);
      res.status(500).json({ message: "Failed to fetch gigs by date range" });
    }
  });

  // Distance calculation endpoint
  app.post("/api/calculate-distance", async (req, res) => {
    try {
      const { origin, destination } = req.body;
      
      if (!origin || !destination) {
        return res.status(400).json({ error: "Origin and destination are required" });
      }

      const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY;
      
      if (!apiKey) {
        return res.status(500).json({ error: "Google Maps API key not configured" });
      }

      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&units=imperial&key=${apiKey}`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK') {
        return res.status(500).json({ error: `Google Maps API error: ${data.status}` });
      }

      const element = data.rows[0]?.elements[0];
      
      if (!element || element.status !== 'OK') {
        return res.status(500).json({ error: 'Could not calculate distance between addresses' });
      }

      // Convert meters to miles (1 meter = 0.000621371 miles)
      const distanceMiles = Math.round((element.distance.value * 0.000621371) * 100) / 100;
      
      // Convert seconds to minutes
      const travelTimeMinutes = Math.round(element.duration.value / 60);

      res.json({
        distanceMiles,
        travelTimeMinutes,
        status: 'success'
      });
    } catch (error) {
      console.error("Distance calculation error:", error);
      res.status(500).json({ error: "Failed to calculate distance" });
    }
  });

  // AI-powered gig parsing endpoint
  app.post("/api/gigs/parse-bulk", async (req, res) => {
    try {
      const { text } = req.body;
      const userId = getCurrentUserId(req);
      
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: "Text input is required" });
      }

      // Basic validation
      if (text.length < 10) {
        return res.status(400).json({ error: "Please provide more detailed gig notes (at least 10 characters)" });
      }

      if (text.length > 10000) {
        return res.status(400).json({ error: "Text too long. Please break it into smaller chunks (max 10,000 characters)" });
      }

      const apiKey = process.env.OPENAI_API_KEY;
      
      if (!apiKey) {
        return res.status(500).json({ error: "OpenAI API key not configured" });
      }

      // Get user's custom gig types from profile
      const user = await storage.getUser(userId);
      const userGigTypes = user?.customGigTypes || [];
      const availableTypes = userGigTypes.length > 0 ? userGigTypes : ["Other"];

      const systemPrompt = `You are a data extraction specialist for gig worker records. Parse messy gig notes and extract structured data.

Extract individual gigs from the text and return a JSON array. For each gig, extract these fields when available:
- eventName: Name of the event or brief description
- clientName: Company, person, or organization that hired them
- startDate: Date in YYYY-MM-DD format (infer year if missing, assume 2025 as current year)
- endDate: End date if different from start date
- expectedPay: Expected payment amount (numbers only, no currency symbols)
- actualPay: Actual payment received (numbers only, no currency symbols) 
- gigType: Must be one of these EXACT types: ${availableTypes.map(type => `"${type}"`).join(", ")}
- location: Venue, address, or general location
- duties: What they did at the gig
- notes: Any additional details

CRITICAL: For gigType, you MUST ONLY use these EXACT values: ${availableTypes.join(", ")}

MATCHING RULES:
- ANY photography work = "Photo Assistant" 
- ANY promotional/brand/marketing work = "Brand Ambassador"
- ANY research/survey work = "Market Research"
- If none match perfectly = "Other"

DO NOT use any other gigType values. These are the only allowed values: ${availableTypes.join(", ")}

Also assign a confidence level:
- "high": Clear, unambiguous data extraction
- "medium": Some interpretation required but reasonably confident
- "low": Significant ambiguity or missing critical information

Return JSON in this exact format:
{
  "parsedGigs": [
    {
      "originalText": "original text segment",
      "confidence": "high|medium|low",
      "extractedData": {
        "eventName": "string or null",
        "clientName": "string or null",
        "startDate": "YYYY-MM-DD or null",
        "endDate": "YYYY-MM-DD or null",
        "expectedPay": "number as string or null",
        "actualPay": "number as string or null", 
        "gigType": "string or null",
        "location": "string or null",
        "duties": "string or null",
        "notes": "string or null"
      }
    }
  ]
}

Be VERY generous in extracting gigs:
- Extract ANY date you can find, even if approximate
- Save ANY payment amount mentioned, even if uncertain
- Use ANY client/company name mentioned, even if unclear
- Create entries even with minimal information - better to save incomplete data than skip it
- If there's any indication of separate work events, create separate entries
- When in doubt, include the gig rather than skip it`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`OpenAI API error ${response.status}:`, errorText);
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      const aiResponse = await response.json();
      console.log("OpenAI response:", JSON.stringify(aiResponse, null, 2));
      
      if (!aiResponse.choices || !aiResponse.choices[0] || !aiResponse.choices[0].message) {
        throw new Error("Invalid OpenAI response structure");
      }

      const content = aiResponse.choices[0].message.content;
      if (!content) {
        throw new Error("Empty response from OpenAI");
      }

      const parsedResult = JSON.parse(content);
      res.json(parsedResult);
    } catch (error) {
      console.error("Gig parsing error:", error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // More specific error messages
      if (errorMessage.includes('OpenAI API error')) {
        res.status(500).json({ error: "OpenAI service error. Please try again." });
      } else if (errorMessage.includes('JSON')) {
        res.status(500).json({ error: "AI response format error. Please try again." });
      } else {
        res.status(500).json({ error: "Failed to parse gig data. Please try again." });
      }
    }
  });

  // Bulk gig import endpoint
  app.post("/api/gigs/bulk-import", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const { gigs } = req.body;

      if (!Array.isArray(gigs)) {
        return res.status(400).json({ error: "Gigs array is required" });
      }

      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const gigData of gigs) {
        try {
          const { extractedData } = gigData;
          
          // Only require a date - everything else can be empty/placeholder
          if (!extractedData.startDate) {
            errors.push(`Skipped gig: Missing date information`);
            skipped++;
            continue;
          }

          // Create gig object matching the required schema
          const gigToCreate = {
            userId,
            date: extractedData.startDate,
            gigType: extractedData.gigType || "Other",
            eventName: extractedData.eventName || "Imported Gig",
            clientName: extractedData.clientName || "Unknown Client",
            gigAddress: extractedData.location || "",
            expectedPay: extractedData.expectedPay || extractedData.actualPay || "0",
            actualPay: extractedData.actualPay || extractedData.expectedPay || "0",
            paymentMethod: "Cash",
            duties: extractedData.duties || "",
            taxPercentage: 23,
            mileage: 0, // Integer field, not string
            notes: extractedData.notes || `Imported from bulk upload: ${gigData.originalText}`,
            status: "completed" as const,
            tips: "0",
            parkingExpense: "0",
            parkingReceipts: [],
            otherExpenses: "0",
            otherExpenseReceipts: [],
          };

          await storage.createGig(gigToCreate);
          imported++;
        } catch (error) {
          console.error("Error importing individual gig:", error);
          const { extractedData } = gigData;
          errors.push(`Failed to import gig from: ${gigData.originalText.substring(0, 50)}...`);
          skipped++;
        }
      }

      res.json({
        imported,
        skipped,
        errors,
      });
    } catch (error) {
      console.error("Bulk import error:", error);
      res.status(500).json({ error: "Failed to import gigs" });
    }
  });

  app.post("/api/gigs", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const gigData = insertGigSchema.parse({ ...req.body, userId });
      const gig = await storage.createGig(gigData);
      res.json(gig);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid gig data", errors: error.errors });
      }
      console.error("Create gig error:", error);
      res.status(500).json({ message: "Failed to create gig" });
    }
  });

  app.put("/api/gigs/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const gigData = insertGigSchema.partial().parse(req.body);
      const gig = await storage.updateGig(id, gigData);
      if (!gig) {
        return res.status(404).json({ message: "Gig not found" });
      }
      res.json(gig);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid gig data", errors: error.errors });
      }
      console.error("Update gig error:", error);
      res.status(500).json({ message: "Failed to update gig" });
    }
  });

  app.delete("/api/gigs/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteGig(id);
      if (!success) {
        return res.status(404).json({ message: "Gig not found" });
      }
      res.json({ message: "Gig deleted successfully" });
    } catch (error) {
      console.error("Delete gig error:", error);
      res.status(500).json({ message: "Failed to delete gig" });
    }
  });

  // Goals routes
  app.get("/api/goals", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const goals = await storage.getGoalsByUser(userId);
      res.json(goals);
    } catch (error) {
      console.error("Get goals error:", error);
      res.status(500).json({ message: "Failed to fetch goals" });
    }
  });

  app.post("/api/goals", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const goalData = insertGoalSchema.parse({ ...req.body, userId });
      const goal = await storage.createGoal(goalData);
      res.json(goal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid goal data", errors: error.errors });
      }
      console.error("Create goal error:", error);
      res.status(500).json({ message: "Failed to create goal" });
    }
  });

  app.put("/api/goals/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const goalData = insertGoalSchema.partial().parse(req.body);
      const goal = await storage.updateGoal(id, goalData);
      if (!goal) {
        return res.status(404).json({ message: "Goal not found" });
      }
      res.json(goal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid goal data", errors: error.errors });
      }
      console.error("Update goal error:", error);
      res.status(500).json({ message: "Failed to update goal" });
    }
  });

  app.delete("/api/goals/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteGoal(id);
      if (!success) {
        return res.status(404).json({ message: "Goal not found" });
      }
      res.json({ message: "Goal deleted successfully" });
    } catch (error) {
      console.error("Delete goal error:", error);
      res.status(500).json({ message: "Failed to delete goal" });
    }
  });

  // Allocations routes
  app.get("/api/allocations", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const allocations = await storage.getAllocationsByUser(userId);
      res.json(allocations);
    } catch (error) {
      console.error("Get allocations error:", error);
      res.status(500).json({ message: "Failed to fetch allocations" });
    }
  });

  app.get("/api/allocations/gig/:gigId", async (req, res) => {
    try {
      const gigId = parseInt(req.params.gigId);
      const allocations = await storage.getAllocationsByGig(gigId);
      res.json(allocations);
    } catch (error) {
      console.error("Get allocations by gig error:", error);
      res.status(500).json({ message: "Failed to fetch allocations by gig" });
    }
  });

  app.get("/api/allocations/goal/:goalId", async (req, res) => {
    try {
      const goalId = parseInt(req.params.goalId);
      const allocations = await storage.getAllocationsByGoal(goalId);
      res.json(allocations);
    } catch (error) {
      console.error("Get allocations by goal error:", error);
      res.status(500).json({ message: "Failed to fetch allocations by goal" });
    }
  });

  app.post("/api/allocations", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const allocationData = insertAllocationSchema.parse({ ...req.body, userId });
      const allocation = await storage.createAllocation(allocationData);
      res.json(allocation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid allocation data", errors: error.errors });
      }
      console.error("Create allocation error:", error);
      res.status(500).json({ message: "Failed to create allocation" });
    }
  });

  app.put("/api/allocations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const allocationData = insertAllocationSchema.partial().parse(req.body);
      const allocation = await storage.updateAllocation(id, allocationData);
      if (!allocation) {
        return res.status(404).json({ message: "Allocation not found" });
      }
      res.json(allocation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid allocation data", errors: error.errors });
      }
      console.error("Update allocation error:", error);
      res.status(500).json({ message: "Failed to update allocation" });
    }
  });

  app.delete("/api/allocations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteAllocation(id);
      if (!success) {
        return res.status(404).json({ message: "Allocation not found" });
      }
      res.json({ message: "Allocation deleted successfully" });
    } catch (error) {
      console.error("Delete allocation error:", error);
      res.status(500).json({ message: "Failed to delete allocation" });
    }
  });

  // Period Goals routes
  app.get("/api/goals/period/monthly/:date", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const date = new Date(req.params.date);
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      
      const goal = await storage.getMonthlyGoal(userId, month, year);
      res.json(goal || null);
    } catch (error) {
      console.error("Get monthly goal error:", error);
      res.status(500).json({ message: "Failed to fetch monthly goal" });
    }
  });

  app.post("/api/goals/period/monthly", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const { month, year, goalAmount } = req.body;
      
      if (!month || !year || !goalAmount) {
        return res.status(400).json({ message: "Month, year, and goal amount are required" });
      }
      
      const goal = await storage.setMonthlyGoal(userId, month, year, goalAmount);
      res.json(goal);
    } catch (error) {
      console.error("Set monthly goal error:", error);
      res.status(500).json({ message: "Failed to set monthly goal" });
    }
  });

  app.get("/api/goals/period/weekly/:weekStartDate", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const weekStartDate = req.params.weekStartDate;
      
      const goal = await storage.getWeeklyGoal(userId, weekStartDate);
      res.json(goal || null);
    } catch (error) {
      console.error("Get weekly goal error:", error);
      res.status(500).json({ message: "Failed to fetch weekly goal" });
    }
  });

  app.post("/api/goals/period/weekly", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const { weekStartDate, goalAmount } = req.body;
      
      if (!weekStartDate || !goalAmount) {
        return res.status(400).json({ message: "Week start date and goal amount are required" });
      }
      
      const goal = await storage.setWeeklyGoal(userId, weekStartDate, goalAmount);
      res.json(goal);
    } catch (error) {
      console.error("Set weekly goal error:", error);
      res.status(500).json({ message: "Failed to set weekly goal" });
    }
  });

  app.get("/api/goals/period/yearly/:year", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const year = parseInt(req.params.year);
      
      const goal = await storage.getYearlyGoal(userId, year);
      res.json(goal || null);
    } catch (error) {
      console.error("Get yearly goal error:", error);
      res.status(500).json({ message: "Failed to fetch yearly goal" });
    }
  });

  app.post("/api/goals/period/yearly", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const { year, goalAmount } = req.body;
      
      if (!year || !goalAmount) {
        return res.status(400).json({ message: "Year and goal amount are required" });
      }
      
      const goal = await storage.setYearlyGoal(userId, year, goalAmount);
      res.json(goal);
    } catch (error) {
      console.error("Set yearly goal error:", error);
      res.status(500).json({ message: "Failed to set yearly goal" });
    }
  });

  // Dashboard stats
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const gigs = await storage.getGigsByUser(userId);
      
      const monthlyEarnings = gigs
        .filter(gig => {
          const gigDate = new Date(gig.date);
          const now = new Date();
          return gigDate.getMonth() === now.getMonth() && 
                 gigDate.getFullYear() === now.getFullYear();
        })
        .reduce((sum, gig) => {
          const pay = parseFloat(String(gig.actualPay || gig.expectedPay || "0"));
          return sum + (isNaN(pay) ? 0 : pay);
        }, 0);

      const totalTips = gigs.reduce((sum, gig) => {
        const tips = parseFloat(String(gig.tips || "0"));
        return sum + (isNaN(tips) ? 0 : tips);
      }, 0);
      
      const totalEarnings = gigs.reduce((sum, gig) => {
        const pay = parseFloat(String(gig.actualPay || gig.expectedPay || "0"));
        const tips = parseFloat(String(gig.tips || "0"));
        return sum + (isNaN(pay) ? 0 : pay) + (isNaN(tips) ? 0 : tips);
      }, 0);
      const totalGigs = gigs.length;
      
      const averageEarningsPerGig = totalGigs > 0 ? totalEarnings / totalGigs : 0;

      res.json({
        monthlyEarnings,
        totalTips,
        totalEarnings,
        totalGigs,
        averageEarningsPerGig
      });
    } catch (error) {
      console.error("Get dashboard stats error:", error);
      res.status(500).json({ message: "Failed to fetch dashboard statistics" });
    }
  });

  // Invoices routes
  app.get("/api/invoices", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const invoices = await storage.getInvoicesByUser(userId);
      res.json(invoices);
    } catch (error) {
      console.error("Get invoices error:", error);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  app.post("/api/invoices", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const invoiceData = insertInvoiceSchema.parse({ ...req.body, userId });
      const invoice = await storage.createInvoice(invoiceData);
      res.json(invoice);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid invoice data", errors: error.errors });
      }
      console.error("Create invoice error:", error);
      res.status(500).json({ message: "Failed to create invoice" });
    }
  });

  app.put("/api/invoices/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const invoiceData = insertInvoiceSchema.partial().parse(req.body);
      const invoice = await storage.updateInvoice(id, invoiceData);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid invoice data", errors: error.errors });
      }
      console.error("Update invoice error:", error);
      res.status(500).json({ message: "Failed to update invoice" });
    }
  });

  app.delete("/api/invoices/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteInvoice(id);
      if (!success) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json({ message: "Invoice deleted successfully" });
    } catch (error) {
      console.error("Delete invoice error:", error);
      res.status(500).json({ message: "Failed to delete invoice" });
    }
  });

  // Expenses routes
  app.get("/api/expenses", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const expenses = await storage.getExpensesByUser(userId);
      res.json(expenses);
    } catch (error) {
      console.error("Get expenses error:", error);
      res.status(500).json({ message: "Failed to fetch expenses" });
    }
  });

  app.get("/api/expenses/date-range", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "Start date and end date are required" });
      }
      
      const expenses = await storage.getExpensesByDateRange(userId, startDate as string, endDate as string);
      res.json(expenses);
    } catch (error) {
      console.error("Get expenses by date range error:", error);
      res.status(500).json({ message: "Failed to fetch expenses by date range" });
    }
  });

  app.post("/api/expenses", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const expenseData = insertExpenseSchema.parse({ ...req.body, userId });
      const expense = await storage.createExpense(expenseData);
      res.json(expense);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid expense data", errors: error.errors });
      }
      console.error("Create expense error:", error);
      res.status(500).json({ message: "Failed to create expense" });
    }
  });

  app.put("/api/expenses/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const expenseData = insertExpenseSchema.partial().parse(req.body);
      const expense = await storage.updateExpense(id, expenseData);
      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }
      res.json(expense);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid expense data", errors: error.errors });
      }
      console.error("Update expense error:", error);
      res.status(500).json({ message: "Failed to update expense" });
    }
  });

  app.delete("/api/expenses/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteExpense(id);
      if (!success) {
        return res.status(404).json({ message: "Expense not found" });
      }
      res.json({ message: "Expense deleted successfully" });
    } catch (error) {
      console.error("Delete expense error:", error);
      res.status(500).json({ message: "Failed to delete expense" });
    }
  });

  // Budgets routes
  app.get("/api/budgets", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const budgets = await storage.getBudgetsByUser(userId);
      res.json(budgets);
    } catch (error) {
      console.error("Get budgets error:", error);
      res.status(500).json({ message: "Failed to fetch budgets" });
    }
  });

  app.get("/api/budgets/month/:month/:year", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const month = parseInt(req.params.month);
      const year = parseInt(req.params.year);
      
      const budgets = await storage.getBudgetsByMonth(userId, month, year);
      res.json(budgets);
    } catch (error) {
      console.error("Get budgets by month error:", error);
      res.status(500).json({ message: "Failed to fetch budgets by month" });
    }
  });

  app.post("/api/budgets", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const budgetData = insertBudgetSchema.parse({ ...req.body, userId });
      const budget = await storage.createBudget(budgetData);
      res.json(budget);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid budget data", errors: error.errors });
      }
      console.error("Create budget error:", error);
      res.status(500).json({ message: "Failed to create budget" });
    }
  });

  app.put("/api/budgets/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const budgetData = insertBudgetSchema.partial().parse(req.body);
      const budget = await storage.updateBudget(id, budgetData);
      if (!budget) {
        return res.status(404).json({ message: "Budget not found" });
      }
      res.json(budget);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid budget data", errors: error.errors });
      }
      console.error("Update budget error:", error);
      res.status(500).json({ message: "Failed to update budget" });
    }
  });

  app.delete("/api/budgets/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteBudget(id);
      if (!success) {
        return res.status(404).json({ message: "Budget not found" });
      }
      res.json({ message: "Budget deleted successfully" });
    } catch (error) {
      console.error("Delete budget error:", error);
      res.status(500).json({ message: "Failed to delete budget" });
    }
  });

  // Expense Categories routes
  app.get("/api/expense-categories", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const categories = await storage.getExpenseCategoriesByUser(userId);
      res.json(categories);
    } catch (error) {
      console.error("Get expense categories error:", error);
      res.status(500).json({ message: "Failed to fetch expense categories" });
    }
  });

  app.post("/api/expense-categories", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const categoryData = insertExpenseCategorySchema.parse({ ...req.body, userId });
      const category = await storage.createExpenseCategory(categoryData);
      res.json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid category data", errors: error.errors });
      }
      console.error("Create expense category error:", error);
      res.status(500).json({ message: "Failed to create expense category" });
    }
  });

  app.put("/api/expense-categories/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const categoryData = insertExpenseCategorySchema.partial().parse(req.body);
      const category = await storage.updateExpenseCategory(id, categoryData);
      if (!category) {
        return res.status(404).json({ message: "Expense category not found" });
      }
      res.json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid category data", errors: error.errors });
      }
      console.error("Update expense category error:", error);
      res.status(500).json({ message: "Failed to update expense category" });
    }
  });

  app.delete("/api/expense-categories/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteExpenseCategory(id);
      if (!success) {
        return res.status(404).json({ message: "Expense category not found" });
      }
      res.json({ message: "Expense category deleted successfully" });
    } catch (error) {
      console.error("Delete expense category error:", error);
      res.status(500).json({ message: "Failed to delete expense category" });
    }
  });

  // Distance calculation endpoint using Google Maps API
  app.post("/api/calculate-distance", async (req, res) => {
    try {
      const { origin, destination } = req.body;

      if (!origin || !destination) {
        return res.status(400).json({ error: "Origin and destination are required" });
      }

      const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Google Maps API key not configured" });
      }

      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&units=imperial&key=${apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK') {
        return res.status(400).json({ error: "Failed to calculate distance" });
      }

      const element = data.rows[0]?.elements[0];
      if (element?.status !== 'OK') {
        return res.status(400).json({ error: "Could not find route between addresses" });
      }

      // Extract distance in miles
      const distanceText = element.distance.text;
      const distanceValue = parseFloat(distanceText.replace(/[^\d.]/g, ''));

      res.json({
        distance: distanceValue,
        duration: element.duration.text,
        distanceText: element.distance.text
      });

    } catch (error) {
      console.error("Distance calculation error:", error);
      res.status(500).json({ error: "Failed to calculate distance" });
    }
  });

  // Simple monitoring endpoints
  app.get('/api/monitor/stats', async (req, res) => {
    try {
      const [userCount] = await db.select({ count: count() }).from(users);
      const [activeCount] = await db.select({ count: count() })
        .from(users)
        .where(gte(users.updatedAt, new Date(Date.now() - 24 * 60 * 60 * 1000)));
      
      res.json({
        totalUsers: userCount.count,
        activeToday: activeCount.count,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Monitor stats error:', error);
      res.status(500).json({ error: 'Failed to get stats' });
    }
  });

  app.get('/api/monitor/export/:userId', async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const exportData = {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
          isActive: user.isActive
        },
        exportedAt: new Date().toISOString()
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="user-${userId}-export.json"`);
      res.json(exportData);
      
      await storage.logAudit(userId, 'DATA_EXPORT', 'users', userId, null, { exported_by: 'admin' });
      
    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({ error: 'Export failed' });
    }
  });

  // Admin support endpoints for user troubleshooting
  app.get('/api/admin/lookup/:email', async (req, res) => {
    try {
      const email = req.params.email;
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        message: `User found - ID: ${user.id}`
      });
    } catch (error) {
      console.error('Email lookup error:', error);
      res.status(500).json({ error: 'Failed to lookup user by email' });
    }
  });

  app.get('/api/admin/user/:userId', async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const gigs = await storage.getGigsByUser(userId);
      const goals = await storage.getGoalsByUser(userId);
      
      res.json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
          isActive: user.isActive,
          onboardingCompleted: user.onboardingCompleted
        },
        summary: {
          totalGigs: gigs.length,
          totalGoals: goals.length,
          lastActivity: user.updatedAt
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Admin user lookup error:', error);
      res.status(500).json({ error: 'Failed to fetch user data' });
    }
  });

  app.get('/api/admin/user/:userId/gigs', async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const gigs = await storage.getGigsByUser(userId);
      
      res.json({
        userId: userId,
        totalGigs: gigs.length,
        gigs: gigs.map(gig => ({
          id: gig.id,
          eventName: gig.eventName,
          clientName: gig.clientName,
          date: gig.date,
          status: gig.status,
          expectedPay: gig.expectedPay,
          actualPay: gig.actualPay,
          createdAt: gig.createdAt
        })),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Admin gigs lookup error:', error);
      res.status(500).json({ error: 'Failed to fetch user gigs' });
    }
  });

  app.get('/api/admin/users', async (req, res) => {
    try {
      const usersList = await db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        createdAt: users.createdAt,
        isActive: users.isActive,
        onboardingCompleted: users.onboardingCompleted
      }).from(users);
      
      res.json({
        users: usersList,
        total: usersList.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Admin users list error:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  app.get('/api/monitor/health', async (req, res) => {
    try {
      await db.select({ test: count() }).from(users).limit(1);
      res.json({ 
        status: 'healthy',
        database: 'connected',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ 
        status: 'unhealthy',
        database: 'disconnected',
        timestamp: new Date().toISOString()
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}