import jsPDF from 'jspdf';
import { storage } from './storage';
import type { User, Gig, Expense } from '@shared/schema';

interface ReportOptions {
  userId: number;
  period: 'monthly' | 'annual';
  year: number;
  month?: number;
}

interface ReportData {
  user: User;
  gigs: Gig[];
  expenses: Expense[];
  period: string;
  totalIncome: number;
  totalExpenses: number;
  totalMileage: number;
  mileageValue: number;
  netIncome: number;
  taxPercentage: number;
  estimatedTaxes: number;
  afterTaxIncome: number;
  receipts: ReceiptData[];
}

interface ReceiptData {
  date: string;
  type: 'parking' | 'other';
  amount: number;
  description: string;
  gigName: string;
  clientName: string;
}

export class ProfessionalPDFGenerator {
  private doc: jsPDF;
  private pageHeight: number = 280;
  private currentY: number = 20;
  private pageNumber: number = 1;
  private readonly MILEAGE_RATE = 0.67; // 2024 IRS rate

  constructor() {
    this.doc = new jsPDF();
  }

  async generateReport(options: ReportOptions): Promise<Buffer> {
    const data = await this.prepareReportData(options);
    
    // Page 1: Cover Page
    this.addCoverPage(data);
    
    // Page 2: Income Summary
    this.newPage();
    this.addIncomeSummary(data);
    
    // Page 3: Tax Breakdown & Estimates
    this.newPage();
    this.addTaxBreakdown(data);
    
    // Page 4: Expense & Mileage Summary
    this.newPage();
    this.addExpenseSummary(data);
    
    // Page 5+: Receipts Pages
    if (data.receipts.length > 0) {
      this.newPage();
      this.addReceiptsPages(data);
    }
    
    // Add page numbers to all pages
    this.addAllPageNumbers();
    
    return Buffer.from(this.doc.output('arraybuffer'));
  }

  private async prepareReportData(options: ReportOptions): Promise<ReportData> {
    const user = await storage.getUser(options.userId);
    if (!user) throw new Error('User not found');

    // Calculate date range
    let startDate: string, endDate: string;
    if (options.period === 'monthly' && options.month) {
      startDate = `${options.year}-${options.month.toString().padStart(2, '0')}-01`;
      const nextMonth = options.month === 12 ? 1 : options.month + 1;
      const nextYear = options.month === 12 ? options.year + 1 : options.year;
      endDate = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`;
    } else {
      startDate = `${options.year}-01-01`;
      endDate = `${options.year + 1}-01-01`;
    }

    // Get data
    const gigs = await storage.getGigsByDateRange(options.userId, startDate, endDate);
    const expenses = await storage.getExpensesByDateRange(options.userId, startDate, endDate);
    
    // Group multi-day gigs to prevent double counting
    const groupedGigs = this.groupMultiDayGigs(gigs);
    
    // Filter completed gigs for income calculations
    const completedGigs = groupedGigs.filter(g => g.status === 'completed' || g.actualPay);
    
    // Calculate totals
    const totalIncome = completedGigs.reduce((sum, gig) => {
      const actualPay = parseFloat(gig.actualPay || '0');
      const tips = parseFloat(gig.tips || '0');
      return sum + actualPay + tips;
    }, 0);

    const totalExpenses = completedGigs.reduce((sum, gig) => {
      const parking = parseFloat(gig.parkingExpense || '0');
      const other = parseFloat(gig.otherExpenses || '0');
      return sum + parking + other;
    }, 0);

    const totalMileage = completedGigs.reduce((sum, gig) => {
      return sum + (parseFloat(gig.mileage || '0'));
    }, 0);

    const mileageValue = totalMileage * this.MILEAGE_RATE;
    const netIncome = totalIncome - totalExpenses - mileageValue;
    
    // Tax calculations
    const taxPercentage = parseFloat(user.defaultTaxPercentage || '23');
    const estimatedTaxes = netIncome * (taxPercentage / 100);
    const afterTaxIncome = netIncome - estimatedTaxes;

    // Prepare receipts data
    const receipts: ReceiptData[] = [];
    completedGigs.forEach(gig => {
      if (parseFloat(gig.parkingExpense || '0') > 0) {
        receipts.push({
          date: gig.date,
          type: 'parking',
          amount: parseFloat(gig.parkingExpense || '0'),
          description: 'Parking expense',
          gigName: gig.eventName || 'Unnamed Event',
          clientName: gig.clientName || 'Direct Client'
        });
      }
      if (parseFloat(gig.otherExpenses || '0') > 0) {
        receipts.push({
          date: gig.date,
          type: 'other',
          amount: parseFloat(gig.otherExpenses || '0'),
          description: gig.expenseDescription || 'Other business expense',
          gigName: gig.eventName || 'Unnamed Event',
          clientName: gig.clientName || 'Direct Client'
        });
      }
    });

    const periodStr = options.period === 'monthly' && options.month 
      ? `${new Date(options.year, options.month - 1).toLocaleString('default', { month: 'long' })} ${options.year}`
      : `${options.year}`;

    return {
      user,
      gigs: completedGigs,
      expenses,
      period: periodStr,
      totalIncome,
      totalExpenses,
      totalMileage,
      mileageValue,
      netIncome,
      taxPercentage,
      estimatedTaxes,
      afterTaxIncome,
      receipts: receipts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    };
  }

  private groupMultiDayGigs(gigs: Gig[]): Gig[] {
    const grouped: Gig[] = [];
    const processed = new Set<number>();

    for (const gig of gigs) {
      if (processed.has(gig.id)) continue;

      const multiDayGroup = gigs.filter(g => 
        g.eventName === gig.eventName && 
        g.clientName === gig.clientName &&
        g.actualPay === gig.actualPay &&
        Math.abs(new Date(g.date).getTime() - new Date(gig.date).getTime()) <= 7 * 24 * 60 * 60 * 1000
      );

      if (multiDayGroup.length > 1) {
        // Create consolidated gig entry
        const dates = multiDayGroup.map(g => new Date(g.date)).sort((a, b) => a.getTime() - b.getTime());
        const startDate = dates[0].toLocaleDateString();
        const endDate = dates[dates.length - 1].toLocaleDateString();
        
        const consolidatedGig = {
          ...gig,
          date: `${startDate} - ${endDate}`,
          mileage: multiDayGroup.reduce((sum, g) => sum + parseFloat(g.mileage || '0'), 0).toString(),
          parkingExpense: multiDayGroup.reduce((sum, g) => sum + parseFloat(g.parkingExpense || '0'), 0).toString(),
          otherExpenses: multiDayGroup.reduce((sum, g) => sum + parseFloat(g.otherExpenses || '0'), 0).toString()
        };
        
        grouped.push(consolidatedGig);
        multiDayGroup.forEach(g => processed.add(g.id));
      } else {
        grouped.push(gig);
        processed.add(gig.id);
      }
    }

    return grouped;
  }

  private addCoverPage(data: ReportData): void {
    this.currentY = 40;
    
    // Title
    this.doc.setFontSize(24);
    this.doc.setFont('helvetica', 'bold');
    this.addCenterLine('FREELANCER INCOME REPORT', 24, true);
    
    this.addSpacing(10);
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'normal');
    this.addCenterLine(data.period, 16);
    
    this.addSpacing(30);
    
    // User Information Box
    this.doc.setDrawColor(0, 0, 0);
    this.doc.rect(20, this.currentY, 170, 60);
    
    this.currentY += 15;
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.addLine('FREELANCER INFORMATION', 14, true);
    
    this.addSpacing(5);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'normal');
    this.addLine(`Name: ${data.user.firstName || ''} ${data.user.lastName || ''}`.trim() || 'N/A');
    this.addLine(`Email: ${data.user.email || 'N/A'}`);
    this.addLine(`Report Period: ${data.period}`);
    this.addLine(`Generated: ${new Date().toLocaleDateString()}`);
    
    this.currentY += 30;
    
    // Summary Box
    this.doc.rect(20, this.currentY, 170, 80);
    
    this.currentY += 15;
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.addLine('EXECUTIVE SUMMARY', 14, true);
    
    this.addSpacing(5);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'normal');
    this.addLine(`Total Gigs Completed: ${data.gigs.length}`);
    this.addLine(`Gross Income: $${data.totalIncome.toFixed(2)}`);
    this.addLine(`Business Expenses: $${(data.totalExpenses + data.mileageValue).toFixed(2)}`);
    this.addLine(`Net Income: $${data.netIncome.toFixed(2)}`);
    this.addLine(`Estimated Taxes (${data.taxPercentage}%): $${data.estimatedTaxes.toFixed(2)}`);
    this.addLine(`After-Tax Income: $${data.afterTaxIncome.toFixed(2)}`);
    
    this.addSpacing(30);
    
    // Footer note
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'italic');
    this.addCenterLine('This report is generated for tax preparation purposes.');
    this.addCenterLine('Please consult with a tax professional for filing requirements.');
  }

  private addIncomeSummary(data: ReportData): void {
    this.currentY = 20;
    
    // Header
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.addLine('INCOME SUMMARY', 18, true);
    
    this.addSpacing(10);
    
    // Table header
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bold');
    
    // Draw table header
    this.doc.rect(20, this.currentY, 170, 12);
    this.doc.line(20, this.currentY + 12, 190, this.currentY + 12);
    
    this.currentY += 8;
    this.doc.text('Date', 25, this.currentY);
    this.doc.text('Client/Event', 60, this.currentY);
    this.doc.text('Base Pay', 120, this.currentY);
    this.doc.text('Tips', 145, this.currentY);
    this.doc.text('Total', 170, this.currentY);
    
    this.currentY += 8;
    
    // Table rows
    this.doc.setFont('helvetica', 'normal');
    let rowY = this.currentY;
    
    data.gigs.forEach((gig, index) => {
      if (rowY > 250) {
        this.newPage();
        rowY = this.currentY;
      }
      
      const actualPay = parseFloat(gig.actualPay || '0');
      const tips = parseFloat(gig.tips || '0');
      const total = actualPay + tips;
      
      // Alternate row background
      if (index % 2 === 0) {
        this.doc.setFillColor(245, 245, 245);
        this.doc.rect(20, rowY - 4, 170, 12, 'F');
      }
      
      const dateStr = gig.date.includes(' - ') ? gig.date : new Date(gig.date).toLocaleDateString();
      const eventName = (gig.eventName || 'Unnamed Event').substring(0, 25);
      
      this.doc.text(dateStr, 25, rowY + 4);
      this.doc.text(eventName, 60, rowY + 4);
      this.doc.text(`$${actualPay.toFixed(2)}`, 120, rowY + 4);
      this.doc.text(`$${tips.toFixed(2)}`, 145, rowY + 4);
      this.doc.text(`$${total.toFixed(2)}`, 170, rowY + 4);
      
      rowY += 12;
    });
    
    // Total row
    rowY += 5;
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFillColor(200, 200, 200);
    this.doc.rect(20, rowY - 4, 170, 12, 'F');
    
    this.doc.text('TOTAL INCOME:', 60, rowY + 4);
    this.doc.text(`$${data.totalIncome.toFixed(2)}`, 170, rowY + 4);
  }

  private addTaxBreakdown(data: ReportData): void {
    this.currentY = 20;
    
    // Header
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.addLine('TAX BREAKDOWN & ESTIMATES', 18, true);
    
    this.addSpacing(15);
    
    // Tax Calculation Box
    this.doc.setDrawColor(0, 0, 0);
    this.doc.rect(20, this.currentY, 170, 120);
    
    this.currentY += 15;
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.addLine('TAX CALCULATION BREAKDOWN', 14, true);
    
    this.addSpacing(10);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'normal');
    
    // Income section
    this.addLine('INCOME:');
    this.addLine(`  Gross Income: $${data.totalIncome.toFixed(2)}`);
    
    this.addSpacing(5);
    this.addLine('DEDUCTIONS:');
    this.addLine(`  Business Expenses: $${data.totalExpenses.toFixed(2)}`);
    this.addLine(`  Mileage Deduction (${data.totalMileage} mi): $${data.mileageValue.toFixed(2)}`);
    this.addLine(`  Total Deductions: $${(data.totalExpenses + data.mileageValue).toFixed(2)}`);
    
    this.addSpacing(5);
    this.doc.setFont('helvetica', 'bold');
    this.addLine(`NET TAXABLE INCOME: $${data.netIncome.toFixed(2)}`);
    
    this.addSpacing(5);
    this.doc.setFont('helvetica', 'normal');
    this.addLine('TAX ESTIMATES:');
    this.addLine(`  Tax Rate: ${data.taxPercentage}%`);
    this.addLine(`  Estimated Federal/State Taxes: $${data.estimatedTaxes.toFixed(2)}`);
    
    this.addSpacing(5);
    this.doc.setFont('helvetica', 'bold');
    this.addLine(`AFTER-TAX INCOME: $${data.afterTaxIncome.toFixed(2)}`);
    
    this.currentY += 25;
    
    // Quarterly estimates box
    this.doc.rect(20, this.currentY, 170, 60);
    
    this.currentY += 15;
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.addLine('QUARTERLY TAX ESTIMATES', 14, true);
    
    this.addSpacing(8);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'normal');
    
    const quarterlyEstimate = data.estimatedTaxes / 4;
    this.addLine(`Recommended quarterly payment: $${quarterlyEstimate.toFixed(2)}`);
    this.addLine('Due dates: Jan 15, Apr 15, Jun 15, Sep 15');
    
    this.addSpacing(5);
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'italic');
    this.addLine('Note: These are estimates. Consult a tax professional for accurate calculations.');
  }

  private addExpenseSummary(data: ReportData): void {
    this.currentY = 20;
    
    // Header
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.addLine('EXPENSE & MILEAGE SUMMARY', 18, true);
    
    this.addSpacing(15);
    
    // Expense totals
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.addLine('EXPENSE TOTALS:', 14, true);
    
    this.addSpacing(8);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'normal');
    this.addLine(`Parking Expenses: $${data.gigs.reduce((sum, g) => sum + parseFloat(g.parkingExpense || '0'), 0).toFixed(2)}`);
    this.addLine(`Other Business Expenses: $${data.gigs.reduce((sum, g) => sum + parseFloat(g.otherExpenses || '0'), 0).toFixed(2)}`);
    this.addLine(`Total Direct Expenses: $${data.totalExpenses.toFixed(2)}`);
    
    this.addSpacing(10);
    this.doc.setFont('helvetica', 'bold');
    this.addLine('MILEAGE SUMMARY:', 14, true);
    
    this.addSpacing(8);
    this.doc.setFont('helvetica', 'normal');
    this.addLine(`Total Business Miles: ${data.totalMileage.toFixed(1)} miles`);
    this.addLine(`IRS Mileage Rate: $${this.MILEAGE_RATE}/mile`);
    this.addLine(`Total Mileage Deduction: $${data.mileageValue.toFixed(2)}`);
    
    this.addSpacing(15);
    this.doc.setFont('helvetica', 'bold');
    this.addLine(`TOTAL BUSINESS DEDUCTIONS: $${(data.totalExpenses + data.mileageValue).toFixed(2)}`, 14, true);
    
    this.addSpacing(20);
    
    // Mileage log table header
    if (data.gigs.some(g => parseFloat(g.mileage || '0') > 0)) {
      this.doc.setFontSize(14);
      this.doc.setFont('helvetica', 'bold');
      this.addLine('MILEAGE LOG:', 14, true);
      
      this.addSpacing(10);
      
      // Table header
      this.doc.setFontSize(10);
      this.doc.rect(20, this.currentY, 170, 12);
      
      this.currentY += 8;
      this.doc.text('Date', 25, this.currentY);
      this.doc.text('Purpose', 60, this.currentY);
      this.doc.text('Miles', 150, this.currentY);
      this.doc.text('Value', 175, this.currentY);
      
      this.currentY += 8;
      
      // Mileage entries
      this.doc.setFont('helvetica', 'normal');
      data.gigs.forEach((gig, index) => {
        const miles = parseFloat(gig.mileage || '0');
        if (miles > 0) {
          if (this.currentY > 250) {
            this.newPage();
            this.currentY += 15;
          }
          
          if (index % 2 === 0) {
            this.doc.setFillColor(245, 245, 245);
            this.doc.rect(20, this.currentY - 4, 170, 12, 'F');
          }
          
          const dateStr = gig.date.includes(' - ') ? gig.date : new Date(gig.date).toLocaleDateString();
          const purpose = `${gig.eventName || 'Event'} - ${gig.clientName || 'Client'}`.substring(0, 30);
          
          this.doc.text(dateStr, 25, this.currentY + 4);
          this.doc.text(purpose, 60, this.currentY + 4);
          this.doc.text(miles.toFixed(1), 150, this.currentY + 4);
          this.doc.text(`$${(miles * this.MILEAGE_RATE).toFixed(2)}`, 175, this.currentY + 4);
          
          this.currentY += 12;
        }
      });
    }
  }

  private addReceiptsPages(data: ReportData): void {
    this.currentY = 20;
    
    // Header
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.addLine('RECEIPTS & EXPENSE DOCUMENTATION', 18, true);
    
    this.addSpacing(15);
    
    if (data.receipts.length === 0) {
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'normal');
      this.addCenterLine('No receipts recorded for this period.');
      return;
    }
    
    // Receipts table header
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bold');
    this.doc.rect(20, this.currentY, 170, 12);
    
    this.currentY += 8;
    this.doc.text('Date', 25, this.currentY);
    this.doc.text('Type', 50, this.currentY);
    this.doc.text('Description', 80, this.currentY);
    this.doc.text('Amount', 165, this.currentY);
    
    this.currentY += 8;
    
    // Receipt entries
    this.doc.setFont('helvetica', 'normal');
    let receiptTotal = 0;
    
    data.receipts.forEach((receipt, index) => {
      if (this.currentY > 250) {
        this.newPage();
        this.currentY += 15;
      }
      
      if (index % 2 === 0) {
        this.doc.setFillColor(245, 245, 245);
        this.doc.rect(20, this.currentY - 4, 170, 12, 'F');
      }
      
      const dateStr = new Date(receipt.date).toLocaleDateString();
      const type = receipt.type === 'parking' ? 'Parking' : 'Other';
      const description = `${receipt.gigName} (${receipt.clientName})`.substring(0, 35);
      
      this.doc.text(dateStr, 25, this.currentY + 4);
      this.doc.text(type, 50, this.currentY + 4);
      this.doc.text(description, 80, this.currentY + 4);
      this.doc.text(`$${receipt.amount.toFixed(2)}`, 165, this.currentY + 4);
      
      receiptTotal += receipt.amount;
      this.currentY += 12;
    });
    
    // Total row
    this.currentY += 5;
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFillColor(200, 200, 200);
    this.doc.rect(20, this.currentY - 4, 170, 12, 'F');
    
    this.doc.text('TOTAL RECEIPTS:', 80, this.currentY + 4);
    this.doc.text(`$${receiptTotal.toFixed(2)}`, 165, this.currentY + 4);
    
    this.addSpacing(20);
    
    // Notes section
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.addLine('NOTES FOR TAX FILING:', 12, true);
    
    this.addSpacing(8);
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.addLine('• Keep all original receipts and documentation');
    this.addLine('• Business expenses must be ordinary and necessary');
    this.addLine('• Mileage calculated using IRS standard rate');
    this.addLine('• Consult tax professional for proper categorization');
  }

  private addLine(text: string, fontSize: number = 10, isBold: boolean = false): void {
    this.doc.setFontSize(fontSize);
    this.doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    this.doc.text(text, 25, this.currentY);
    this.currentY += fontSize * 0.5 + 2;
  }

  private addCenterLine(text: string, fontSize: number = 10, isBold: boolean = false): void {
    this.doc.setFontSize(fontSize);
    this.doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    const textWidth = this.doc.getTextWidth(text);
    const x = (210 - textWidth) / 2;
    this.doc.text(text, x, this.currentY);
    this.currentY += fontSize * 0.5 + 2;
  }

  private addSpacing(space: number = 10): void {
    this.currentY += space;
  }

  private newPage(): void {
    this.doc.addPage();
    this.currentY = 20;
    this.pageNumber++;
  }

  private addAllPageNumbers(): void {
    const totalPages = this.pageNumber;
    
    for (let i = 1; i <= totalPages; i++) {
      this.doc.setPage(i);
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(`Page ${i} of ${totalPages}`, 180, 285);
    }
  }
}

export async function generateProfessionalPDF(options: ReportOptions): Promise<Buffer> {
  const generator = new ProfessionalPDFGenerator();
  return await generator.generateReport(options);
}