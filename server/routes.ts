import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertGigSchema, insertGoalSchema, insertAllocationSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  const currentUserId = 1; // For MVP, we'll use a single user

  // Gigs routes
  app.get("/api/gigs", async (req, res) => {
    try {
      const gigs = await storage.getGigsByUser(currentUserId);
      res.json(gigs);
    } catch (error) {
      console.error("Failed to fetch gigs:", error);
      res.status(500).json({ message: "Failed to fetch gigs" });
    }
  });

  app.get("/api/gigs/date-range", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "Start date and end date are required" });
      }
      
      const gigs = await storage.getGigsByDateRange(currentUserId, startDate as string, endDate as string);
      res.json(gigs);
    } catch (error) {
      console.error("Failed to fetch gigs by date range:", error);
      res.status(500).json({ message: "Failed to fetch gigs by date range" });
    }
  });

  app.post("/api/gigs", async (req, res) => {
    try {
      const gigData = insertGigSchema.parse({ ...req.body, userId: currentUserId });
      const gig = await storage.createGig(gigData);
      res.status(201).json(gig);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation error creating gig:", error.errors);
        return res.status(400).json({ message: "Invalid gig data", errors: error.errors });
      }
      console.error("Failed to create gig:", error);
      res.status(500).json({ message: "Failed to create gig" });
    }
  });

  app.put("/api/gigs/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid gig ID" });
      }

      const updateData = { ...req.body };
      
      // Convert empty strings to null for numeric/decimal fields
      const numericFields = ['expectedPay', 'actualPay', 'tips', 'parkingExpense', 'otherExpenses', 'distanceMiles'];
      const integerFields = ['taxPercentage', 'mileage', 'travelTimeMinutes'];
      const arrayFields = ['parkingReceipts', 'otherExpenseReceipts'];
      
      numericFields.forEach(field => {
        if (updateData[field] === "") {
          updateData[field] = null;
        }
      });
      
      integerFields.forEach(field => {
        if (updateData[field] === "") {
          updateData[field] = null;
        }
      });
      
      // Ensure array fields are properly formatted
      arrayFields.forEach(field => {
        if (!updateData[field]) {
          updateData[field] = [];
        }
      });

      const gig = await storage.updateGig(id, updateData);
      
      if (!gig) {
        return res.status(404).json({ message: "Gig not found" });
      }
      
      res.json(gig);
    } catch (error) {
      console.error("Update gig error:", error);
      res.status(500).json({ message: "Failed to update gig" });
    }
  });

  app.delete("/api/gigs/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid gig ID" });
      }

      const deleted = await storage.deleteGig(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Gig not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Delete gig error:", error);
      res.status(500).json({ message: "Failed to delete gig" });
    }
  });

  // Goals routes
  app.get("/api/goals", async (req, res) => {
    try {
      const goals = await storage.getGoalsByUser(currentUserId);
      res.json(goals);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch goals" });
    }
  });

  app.post("/api/goals", async (req, res) => {
    try {
      const goalData = insertGoalSchema.parse({ ...req.body, userId: currentUserId });
      const goal = await storage.createGoal(goalData);
      res.status(201).json(goal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid goal data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create goal" });
    }
  });

  app.put("/api/goals/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid goal ID" });
      }

      const updateData = req.body;
      const goal = await storage.updateGoal(id, updateData);
      
      if (!goal) {
        return res.status(404).json({ message: "Goal not found" });
      }
      
      res.json(goal);
    } catch (error) {
      console.error("Update goal error:", error);
      res.status(500).json({ message: "Failed to update goal" });
    }
  });

  app.delete("/api/goals/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid goal ID" });
      }

      const deleted = await storage.deleteGoal(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Goal not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Delete goal error:", error);
      res.status(500).json({ message: "Failed to delete goal" });
    }
  });

  // Allocations routes
  app.get("/api/allocations", async (req, res) => {
    try {
      const allocations = await storage.getAllocationsByUser(currentUserId);
      res.json(allocations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch allocations" });
    }
  });

  app.get("/api/piggy-bank-total", async (req, res) => {
    try {
      const allocations = await storage.getAllocationsByUser(currentUserId);
      const piggyBankTotal = allocations
        .filter(a => a.allocationType === "piggy_bank")
        .reduce((sum, a) => sum + parseFloat(a.amount), 0);
      res.json(piggyBankTotal);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch piggy bank total" });
    }
  });

  app.post("/api/allocations", async (req, res) => {
    try {
      const allocationData = insertAllocationSchema.parse({ ...req.body, userId: currentUserId });
      const allocation = await storage.createAllocation(allocationData);
      
      // Update goal current amount if allocating to a goal
      if (allocation.goalId && allocation.allocationType === "goal") {
        const goal = await storage.getGoal(allocation.goalId);
        if (goal) {
          const newCurrentAmount = (parseFloat(goal.currentAmount || "0") + parseFloat(allocation.amount)).toString();
          await storage.updateGoal(allocation.goalId, { currentAmount: newCurrentAmount });
        }
      }
      
      res.status(201).json(allocation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid allocation data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create allocation" });
    }
  });

  app.put("/api/allocations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid allocation ID" });
      }

      const { amount } = req.body;
      
      if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return res.status(400).json({ message: "Valid positive amount is required" });
      }

      const allocation = await storage.updateAllocation(id, { amount });
      
      if (!allocation) {
        return res.status(404).json({ message: "Allocation not found" });
      }
      
      res.json(allocation);
    } catch (error) {
      console.error("Update allocation error:", error);
      res.status(500).json({ message: "Failed to update allocation" });
    }
  });

  app.delete("/api/allocations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid allocation ID" });
      }

      const deleted = await storage.deleteAllocation(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Allocation not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Delete allocation error:", error);
      res.status(500).json({ message: "Failed to delete allocation" });
    }
  });

  // Dashboard stats
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const gigs = await storage.getGigsByUser(currentUserId);
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
      
      const monthlyGigs = gigs.filter(gig => gig.date.startsWith(currentMonth));
      const completedGigs = monthlyGigs.filter(gig => gig.status === "completed");
      const upcomingGigs = gigs.filter(gig => gig.status === "upcoming");
      
      const totalEarnings = completedGigs.reduce((sum, gig) => 
        sum + parseFloat(gig.actualPay || "0"), 0);
      const totalTips = completedGigs.reduce((sum, gig) => 
        sum + parseFloat(gig.tips || "0"), 0);
      const totalExpenses = completedGigs.reduce((sum, gig) => 
        sum + parseFloat(gig.parkingExpense || "0") + 
             parseFloat(gig.otherExpenses || "0"), 0);
      
      // Client leaderboard
      const clientStats = new Map<string, { gigs: number, total: number }>();
      completedGigs.forEach(gig => {
        const client = gig.clientName;
        const current = clientStats.get(client) || { gigs: 0, total: 0 };
        clientStats.set(client, {
          gigs: current.gigs + 1,
          total: current.total + parseFloat(gig.actualPay || "0") + parseFloat(gig.tips || "0")
        });
      });
      
      const topClients = Array.from(clientStats.entries())
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      const totalEarningsWithTips = totalEarnings + totalTips;
      const avgPerGig = completedGigs.length > 0 ? totalEarningsWithTips / completedGigs.length : 0;
      
      // Use user's default tax percentage or fallback to 23%
      const user = await storage.getUser(currentUserId);
      const taxPercentage = (user?.defaultTaxPercentage || 23) / 100;
      const taxEstimate = totalEarnings * taxPercentage; // Only on actual pay, not tips

      // Calculate projected earnings from expected pay
      const projectedEarnings = upcomingGigs.reduce((total, gig) => {
        return total + parseFloat(gig.expectedPay || "0");
      }, 0);

      res.json({
        monthlyEarnings: Math.round(totalEarningsWithTips * 100) / 100,
        totalTips: Math.round(totalTips * 100) / 100,
        projectedEarnings: Math.round(projectedEarnings * 100) / 100,
        completedGigs: completedGigs.length,
        upcomingGigs: upcomingGigs.length,
        avgPerGig: Math.round(avgPerGig * 100) / 100,
        taxEstimate: Math.round(taxEstimate * 100) / 100,
        totalExpenses: Math.round(totalExpenses * 100) / 100,
        topClients,
        recentGigs: completedGigs.slice(-5).reverse()
      });
    } catch (error) {
      console.error("Dashboard stats error:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // User profile
  app.get("/api/user", async (req, res) => {
    try {
      const user = await storage.getUser(currentUserId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.put("/api/user", async (req, res) => {
    try {
      const updateData = req.body;
      const user = await storage.updateUser(currentUserId, updateData);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Period-specific goals
  app.get("/api/goals/period/:period/:date", async (req, res) => {
    try {
      const { period, date } = req.params;
      const targetDate = new Date(date);
      
      let goal;
      if (period === "weekly") {
        const startOfWeek = new Date(targetDate);
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Monday
        startOfWeek.setDate(diff);
        const weekStartDate = startOfWeek.toISOString().split('T')[0];
        goal = await storage.getWeeklyGoal(currentUserId, weekStartDate);
      } else if (period === "monthly") {
        const month = targetDate.getMonth() + 1;
        const year = targetDate.getFullYear();
        goal = await storage.getMonthlyGoal(currentUserId, month, year);
      } else if (period === "annual") {
        const year = targetDate.getFullYear();
        goal = await storage.getYearlyGoal(currentUserId, year);
      }
      
      res.json(goal || null);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch goal" });
    }
  });

  app.post("/api/goals/period/:period/:date", async (req, res) => {
    try {
      const { period, date } = req.params;
      const { goalAmount } = req.body;
      const targetDate = new Date(date);
      
      let goal;
      if (period === "weekly") {
        const startOfWeek = new Date(targetDate);
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Monday
        startOfWeek.setDate(diff);
        const weekStartDate = startOfWeek.toISOString().split('T')[0];
        goal = await storage.setWeeklyGoal(currentUserId, weekStartDate, goalAmount);
      } else if (period === "monthly") {
        const month = targetDate.getMonth() + 1;
        const year = targetDate.getFullYear();
        goal = await storage.setMonthlyGoal(currentUserId, month, year, goalAmount);
      } else if (period === "annual") {
        const year = targetDate.getFullYear();
        goal = await storage.setYearlyGoal(currentUserId, year, goalAmount);
      }
      
      res.json(goal);
    } catch (error) {
      res.status(500).json({ message: "Failed to set goal" });
    }
  });

  // Monthly report export routes
  app.get("/api/reports/monthly/excel", async (req, res) => {
    try {
      const { month, year } = req.query;
      const targetMonth = month ? parseInt(month as string) : new Date().getMonth() + 1;
      const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
      
      // Get monthly data
      const startDate = new Date(targetYear, targetMonth - 1, 1).toISOString().split('T')[0];
      const endDate = new Date(targetYear, targetMonth, 0).toISOString().split('T')[0];
      const gigs = await storage.getGigsByDateRange(currentUserId, startDate, endDate);
      const user = await storage.getUser(currentUserId);
      
      // Calculate totals
      const totalEarnings = gigs.reduce((sum, gig) => sum + parseFloat(gig.actualPay || '0'), 0);
      const totalTips = gigs.reduce((sum, gig) => sum + parseFloat(gig.tips || '0'), 0);
      const totalMileage = gigs.reduce((sum, gig) => sum + (gig.mileage || 0), 0);
      const totalExpenses = gigs.reduce((sum, gig) => sum + parseFloat(gig.parkingExpense || '0') + parseFloat(gig.otherExpenses || '0'), 0);
      
      // Create Excel workbook
      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();
      
      // Summary sheet
      const summaryData = [
        ['Monthly Report Summary'],
        ['Month/Year', `${targetMonth}/${targetYear}`],
        [''],
        ['Total Earnings', `$${totalEarnings.toFixed(2)}`],
        ['Total Tips', `$${totalTips.toFixed(2)}`],
        ['Total Mileage', `${totalMileage} miles`],
        ['Total Expenses', `$${totalExpenses.toFixed(2)}`],
        ['Net Income', `$${(totalEarnings - totalExpenses).toFixed(2)}`],
      ];
      
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
      
      // Detailed gigs sheet
      const gigsData = [
        ['Date', 'Client', 'Gig Type', 'Location', 'Earnings', 'Tips', 'Mileage', 'Expenses']
      ];
      
      gigs.forEach(gig => {
        const earnings = parseFloat(gig.actualPay || '0');
        const expenses = parseFloat(gig.parkingExpense || '0') + parseFloat(gig.otherExpenses || '0');
        
        gigsData.push([
          gig.date,
          gig.clientName,
          gig.gigType,
          gig.gigAddress || '',
          `$${earnings.toFixed(2)}`,
          `$${parseFloat(gig.tips || '0').toFixed(2)}`,
          (gig.mileage || 0).toString(),
          `$${expenses.toFixed(2)}`
        ]);
      });
      
      const gigsSheet = XLSX.utils.aoa_to_sheet(gigsData);
      XLSX.utils.book_append_sheet(workbook, gigsSheet, 'Gigs Detail');
      
      // Generate Excel buffer
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="monthly-report-${targetMonth}-${targetYear}.xlsx"`);
      res.send(excelBuffer);
      
    } catch (error) {
      console.error("Failed to generate Excel report:", error);
      res.status(500).json({ message: "Failed to generate Excel report" });
    }
  });

  app.get("/api/reports/monthly/pdf", async (req, res) => {
    try {
      const { month, year } = req.query;
      const targetMonth = month ? parseInt(month as string) : new Date().getMonth() + 1;
      const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
      
      // Get monthly data
      const startDate = new Date(targetYear, targetMonth - 1, 1).toISOString().split('T')[0];
      const endDate = new Date(targetYear, targetMonth, 0).toISOString().split('T')[0];
      const gigs = await storage.getGigsByDateRange(currentUserId, startDate, endDate);
      const user = await storage.getUser(currentUserId);
      
      // Calculate totals
      const totalEarnings = gigs.reduce((sum, gig) => sum + parseFloat(gig.actualPay || '0'), 0);
      const totalTips = gigs.reduce((sum, gig) => sum + parseFloat(gig.tips || '0'), 0);
      const totalMileage = gigs.reduce((sum, gig) => sum + (gig.mileage || 0), 0);
      const totalExpenses = gigs.reduce((sum, gig) => sum + parseFloat(gig.parkingExpense || '0') + parseFloat(gig.otherExpenses || '0'), 0);
      
      // Create PDF
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      
      const doc = new jsPDF();
      
      // Title
      doc.setFontSize(20);
      doc.text('Monthly Gig Report', 20, 20);
      
      // Report details
      doc.setFontSize(12);
      doc.text(`Month: ${new Date(targetYear, targetMonth - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`, 20, 35);
      doc.text(`Worker: ${user?.name || 'N/A'}`, 20, 45);
      
      // Summary section
      doc.setFontSize(14);
      doc.text('Summary', 20, 65);
      
      const summaryData = [
        ['Total Earnings', `$${totalEarnings.toFixed(2)}`],
        ['Total Tips', `$${totalTips.toFixed(2)}`],
        ['Total Mileage', `${totalMileage} miles`],
        ['Total Expenses', `$${totalExpenses.toFixed(2)}`],
        ['Net Income', `$${(totalEarnings - totalExpenses).toFixed(2)}`],
      ];
      
      autoTable(doc, {
        startY: 75,
        head: [['Category', 'Amount']],
        body: summaryData,
        theme: 'grid',
        headStyles: { fillColor: [66, 139, 202] }
      });
      
      // Gigs detail section
      if (gigs.length > 0) {
        doc.addPage();
        doc.setFontSize(14);
        doc.text('Gig Details', 20, 20);
        
        const gigsTableData = gigs.map(gig => [
          gig.date,
          gig.clientName,
          gig.gigType,
          gig.location || '',
          `$${parseFloat(gig.totalEarnings).toFixed(2)}`,
          `$${parseFloat(gig.tips || '0').toFixed(2)}`,
          gig.mileage || '0',
          `$${parseFloat(gig.expenses || '0').toFixed(2)}`
        ]);
        
        autoTable(doc, {
          startY: 30,
          head: [['Date', 'Client', 'Type', 'Location', 'Earnings', 'Tips', 'Miles', 'Expenses']],
          body: gigsTableData,
          theme: 'grid',
          headStyles: { fillColor: [66, 139, 202] },
          styles: { fontSize: 8 },
          columnStyles: {
            0: { cellWidth: 20 },
            1: { cellWidth: 25 },
            2: { cellWidth: 20 },
            3: { cellWidth: 25 },
            4: { cellWidth: 20 },
            5: { cellWidth: 15 },
            6: { cellWidth: 15 },
            7: { cellWidth: 20 }
          }
        });
      }
      
      const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="monthly-report-${targetMonth}-${targetYear}.pdf"`);
      res.send(pdfBuffer);
      
    } catch (error) {
      console.error("Failed to generate PDF report:", error);
      res.status(500).json({ message: "Failed to generate PDF report" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
