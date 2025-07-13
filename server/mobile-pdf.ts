import jsPDF from 'jspdf';
import { storage } from './storage';
import type { Gig, Expense, User } from '@shared/schema';

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
}

export class MobilePDFGenerator {
  private doc: jsPDF;
  private pageHeight: number = 280;
  private currentY: number = 20;
  private pageNumber: number = 1;

  constructor() {
    // Initialize with mobile-optimized settings
    this.doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      putOnlyUsedFonts: true,
      floatPrecision: 2
    });
  }

  async generateReport(options: ReportOptions): Promise<Buffer> {
    try {
      const reportData = await this.prepareReportData(options);
      
      this.addCoverPage(reportData);
      this.newPage();
      
      this.addIncomeSummary(reportData);
      this.newPage();
      
      this.addExpenseSummary(reportData);
      this.newPage();
      
      this.addMileageLog(reportData);
      this.newPage();
      
      this.addSummaryTotals(reportData);
      
      // Add page numbers to all pages
      this.addAllPageNumbers();

      
      // Use 'uint8array' output for better mobile compatibility
      const pdfOutput = this.doc.output('arraybuffer');
      return Buffer.from(pdfOutput);
    } catch (error) {
      
      // Fallback: Create a simple error PDF
      try {
        const errorDoc = new jsPDF();
        errorDoc.setFontSize(16);
        errorDoc.text('PDF Generation Error', 20, 30);
        errorDoc.setFontSize(12);
        errorDoc.text('Unable to generate detailed report at this time.', 20, 50);
        errorDoc.text('Please try again later or contact support.', 20, 70);
        
        return Buffer.from(errorDoc.output('arraybuffer'));
      } catch (fallbackError) {
        throw new Error('PDF generation completely failed');
      }
    }
  }

  private async prepareReportData(options: ReportOptions): Promise<ReportData> {
    const user = await storage.getUser(options.userId);
    if (!user) throw new Error('User not found');

    const startDate = options.period === 'monthly' 
      ? new Date(options.year, options.month! - 1, 1)
      : new Date(options.year, 0, 1);
    
    const endDate = options.period === 'monthly'
      ? new Date(options.year, options.month!, 0)
      : new Date(options.year, 11, 31);

    // Apply multi-day gig grouping logic (same as dashboard)
    const allGigs = await storage.getGigsByDateRange(
      options.userId,
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    // Group multi-day gigs to prevent double-counting
    const groupedGigs = this.groupMultiDayGigs(allGigs);
    const completedGigs = groupedGigs.filter(g => g.status === 'completed');

    const expenses = await storage.getExpensesByDateRange(
      options.userId,
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    // Calculate totals using grouped gigs
    const totalIncome = completedGigs.reduce((sum, gig) => {
      const actualPay = parseFloat(gig.actualPay || '0');
      const tips = parseFloat(gig.tips || '0');
      return sum + actualPay + tips;
    }, 0);

    const totalExpenses = expenses.reduce((sum, expense) => {
      return sum + parseFloat(expense.amount || '0');
    }, 0);

    const gigExpenses = completedGigs.reduce((sum, gig) => {
      const parking = parseFloat(gig.parkingExpense || '0');
      const other = parseFloat(gig.otherExpenses || '0');
      return sum + parking + other;
    }, 0);

    const totalMileage = completedGigs.reduce((sum, gig) => sum + (gig.mileage || 0), 0);
    const mileageValue = totalMileage * 0.67; // Standard mileage rate

    const netIncome = totalIncome - (totalExpenses + gigExpenses + mileageValue);

    const periodStr = options.period === 'monthly' 
      ? `${new Date(options.year, options.month! - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
      : `${options.year} Annual Report`;

    return {
      user,
      gigs: completedGigs,
      expenses,
      period: periodStr,
      totalIncome,
      totalExpenses: totalExpenses + gigExpenses,
      totalMileage,
      mileageValue,
      netIncome
    };
  }

  private groupMultiDayGigs(gigs: Gig[]): Gig[] {
    const parseGigDate = (dateStr: string) => new Date(dateStr + 'T00:00:00.000Z');
    const sortedGigs = [...gigs].sort((a, b) => parseGigDate(a.date).getTime() - parseGigDate(b.date).getTime());
    const grouped: Gig[] = [];
    const processed = new Set<number>();
    
    for (let i = 0; i < sortedGigs.length; i++) {
      if (processed.has(sortedGigs[i].id)) continue;
      
      const currentGig = sortedGigs[i];
      const similarGigs = [currentGig];
      processed.add(currentGig.id);
      
      for (let j = i + 1; j < sortedGigs.length; j++) {
        const nextGig = sortedGigs[j];
        if (processed.has(nextGig.id)) continue;
        
        const lastGigDate = parseGigDate(similarGigs[similarGigs.length - 1].date);
        const nextDate = parseGigDate(nextGig.date);
        const dayDiff = (nextDate.getTime() - lastGigDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (nextGig.eventName === currentGig.eventName &&
            nextGig.clientName === currentGig.clientName &&
            nextGig.gigType === currentGig.gigType &&
            dayDiff > 0 && dayDiff <= 7) {
          similarGigs.push(nextGig);
          processed.add(nextGig.id);
        }
      }
      
      if (similarGigs.length > 1) {
        // Multi-day gig - use first entry's amounts (don't sum)
        grouped.push({
          ...similarGigs[0],
          date: `${similarGigs[0].date} - ${similarGigs[similarGigs.length - 1].date}`
        });
      } else {
        grouped.push(currentGig);
      }
    }
    
    return grouped;
  }

  private addLine(text: string, fontSize: number = 10, isBold: boolean = false): void {
    if (this.currentY > this.pageHeight) {
      this.newPage();
    }
    
    this.doc.setFontSize(fontSize);
    this.doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    this.doc.text(text, 20, this.currentY);
    this.currentY += fontSize / 2 + 4;
  }

  private addCenterLine(text: string, fontSize: number = 10, isBold: boolean = false): void {
    if (this.currentY > this.pageHeight) {
      this.newPage();
    }
    
    this.doc.setFontSize(fontSize);
    this.doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    this.doc.text(text, 105, this.currentY, { align: 'center' });
    this.currentY += fontSize / 2 + 4;
  }

  private addSpacing(space: number = 10): void {
    this.currentY += space;
  }

  private newPage(): void {
    this.doc.addPage();
    this.currentY = 20;
    this.pageNumber++;
  }

  private addCoverPage(data: ReportData): void {
    this.currentY = 60;
    this.addCenterLine('FREELANCER INCOME REPORT', 24, true);
    this.addSpacing(10);
    this.addCenterLine(data.user.name || 'Business Name', 18, false);
    this.addSpacing(10);
    this.addCenterLine(data.period, 14, false);
    this.addSpacing(10);
    this.addCenterLine(`Generated: ${new Date().toLocaleDateString()}`, 12, false);
    
    if (data.user.email) {
      this.addSpacing(10);
      this.addCenterLine(`Contact: ${data.user.email}`, 12, false);
    }

    this.currentY = 240;
    this.addCenterLine('This report is generated by Giggy for informational use only', 10, false);
    this.addCenterLine('and does not constitute tax advice.', 10, false);
  }

  private addIncomeSummary(data: ReportData): void {
    this.addLine('INCOME SUMMARY', 16, true);
    this.addSpacing(5);
    
    let totalIncome = 0;
    data.gigs.forEach(gig => {
      const gigTotal = parseFloat(gig.actualPay || '0') + parseFloat(gig.tips || '0');
      totalIncome += gigTotal;
      
      const dateRange = gig.date.includes(' - ') ? gig.date : new Date(gig.date).toLocaleDateString();
      this.addLine(`${dateRange}`, 10, false);
      this.addLine(`  ${gig.clientName || 'Direct Client'} - ${gig.gigType || 'Service'}`, 9, false);
      this.addLine(`  Amount: $${gigTotal.toFixed(2)}`, 9, false);
      this.addSpacing(3);
    });
    
    this.addSpacing(5);
    this.addLine(`TOTAL INCOME: $${totalIncome.toFixed(2)}`, 12, true);
  }

  private addExpenseSummary(data: ReportData): void {
    this.addLine('EXPENSE SUMMARY', 16, true);
    this.addSpacing(5);
    
    let totalExpenses = 0;
    
    // Regular expenses
    data.expenses.forEach(expense => {
      const amount = parseFloat(expense.amount || '0');
      totalExpenses += amount;
      
      this.addLine(`${new Date(expense.date).toLocaleDateString()}`, 10, false);
      this.addLine(`  ${expense.category || 'Business'} - ${expense.description || 'Expense'}`, 9, false);
      this.addLine(`  Amount: $${amount.toFixed(2)}`, 9, false);
      this.addSpacing(3);
    });

    // Gig-related expenses
    data.gigs.forEach(gig => {
      const parking = parseFloat(gig.parkingExpense || '0');
      const other = parseFloat(gig.otherExpenses || '0');
      
      if (parking > 0) {
        totalExpenses += parking;
        const dateRange = gig.date.includes(' - ') ? gig.date : new Date(gig.date).toLocaleDateString();
        this.addLine(`${dateRange}`, 10, false);
        this.addLine(`  Parking - ${gig.eventName || 'Gig'}`, 9, false);
        this.addLine(`  Amount: $${parking.toFixed(2)}`, 9, false);
        this.addSpacing(3);
      }
      
      if (other > 0) {
        totalExpenses += other;
        const dateRange = gig.date.includes(' - ') ? gig.date : new Date(gig.date).toLocaleDateString();
        this.addLine(`${dateRange}`, 10, false);
        this.addLine(`  Other - ${gig.eventName || 'Gig'}`, 9, false);
        this.addLine(`  Amount: $${other.toFixed(2)}`, 9, false);
        this.addSpacing(3);
      }
    });
    
    this.addSpacing(5);
    this.addLine(`TOTAL EXPENSES: $${totalExpenses.toFixed(2)}`, 12, true);
  }

  private addMileageLog(data: ReportData): void {
    this.addLine('MILEAGE LOG', 16, true);
    this.addSpacing(5);
    
    let totalMileage = 0;
    let totalValue = 0;
    
    data.gigs
      .filter(gig => gig.mileage && gig.mileage > 0)
      .forEach(gig => {
        const miles = gig.mileage || 0;
        const value = miles * 0.67;
        totalMileage += miles;
        totalValue += value;
        
        const dateRange = gig.date.includes(' - ') ? gig.date : new Date(gig.date).toLocaleDateString();
        this.addLine(`${dateRange}`, 10, false);
        this.addLine(`  ${gig.eventName || 'Gig'} (${gig.clientName || 'Client'})`, 9, false);
        this.addLine(`  Miles: ${miles} @ $0.67/mi = $${value.toFixed(2)}`, 9, false);
        this.addSpacing(3);
      });
    
    this.addSpacing(5);
    this.addLine(`TOTAL MILEAGE: ${totalMileage} miles`, 12, true);
    this.addLine(`TOTAL VALUE: $${totalValue.toFixed(2)}`, 12, true);
  }

  private addSummaryTotals(data: ReportData): void {
    this.addLine('SUMMARY TOTALS', 16, true);
    this.addSpacing(10);
    
    this.addLine(`Total Income: $${data.totalIncome.toFixed(2)}`, 12, false);
    this.addSpacing(5);
    this.addLine(`Total Expenses: $${data.totalExpenses.toFixed(2)}`, 12, false);
    this.addSpacing(5);
    this.addLine(`Total Mileage: ${data.totalMileage} miles`, 12, false);
    this.addSpacing(5);
    this.addLine(`Mileage Value: $${data.mileageValue.toFixed(2)}`, 12, false);
    this.addSpacing(10);
    this.addLine(`NET INCOME: $${data.netIncome.toFixed(2)}`, 14, true);
  }

  private addAllPageNumbers(): void {
    const pageCount = this.doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);
      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(`Page ${i} of ${pageCount}`, 195, 285, { align: 'right' });
    }
  }
}