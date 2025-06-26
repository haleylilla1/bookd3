const jsPDF = require('jspdf');
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

export async function generateMobilePDF(options: ReportOptions): Promise<Buffer> {
  try {
    console.log('Starting mobile PDF generation for user:', options.userId);
    
    // Initialize jsPDF with mobile-optimized settings
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const reportData = await prepareReportData(options);
    console.log('Report data prepared:', { 
      gigsCount: reportData.gigs.length, 
      totalIncome: reportData.totalIncome 
    });

    let currentY = 30;
    
    // Add cover page
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('FREELANCER INCOME REPORT', 105, currentY, { align: 'center' });
    
    currentY += 20;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text(reportData.user.name || 'Business Name', 105, currentY, { align: 'center' });
    
    currentY += 15;
    doc.setFontSize(12);
    doc.text(reportData.period, 105, currentY, { align: 'center' });
    
    currentY += 15;
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 105, currentY, { align: 'center' });
    
    if (reportData.user.email) {
      currentY += 15;
      doc.text(`Contact: ${reportData.user.email}`, 105, currentY, { align: 'center' });
    }

    // Add new page for content
    doc.addPage();
    currentY = 20;

    // Income Summary
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('INCOME SUMMARY', 20, currentY);
    currentY += 10;
    
    let totalIncome = 0;
    reportData.gigs.forEach(gig => {
      const gigTotal = parseFloat(gig.actualPay || '0') + parseFloat(gig.tips || '0');
      totalIncome += gigTotal;
      
      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      const dateStr = gig.date.includes(' - ') ? gig.date : new Date(gig.date).toLocaleDateString();
      doc.text(`${dateStr}`, 20, currentY);
      currentY += 5;
      
      doc.text(`  ${gig.clientName || 'Direct Client'} - ${gig.gigType || 'Service'}`, 20, currentY);
      currentY += 5;
      
      doc.text(`  Amount: $${gigTotal.toFixed(2)}`, 20, currentY);
      currentY += 8;
    });
    
    currentY += 5;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL INCOME: $${totalIncome.toFixed(2)}`, 20, currentY);
    
    // Add summary page
    doc.addPage();
    currentY = 20;
    
    doc.setFontSize(16);
    doc.text('SUMMARY TOTALS', 20, currentY);
    currentY += 20;
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Income: $${reportData.totalIncome.toFixed(2)}`, 20, currentY);
    currentY += 10;
    doc.text(`Total Expenses: $${reportData.totalExpenses.toFixed(2)}`, 20, currentY);
    currentY += 10;
    doc.text(`Total Mileage: ${reportData.totalMileage} miles`, 20, currentY);
    currentY += 10;
    doc.text(`Mileage Value: $${reportData.mileageValue.toFixed(2)}`, 20, currentY);
    currentY += 15;
    
    doc.setFont('helvetica', 'bold');
    doc.text(`NET INCOME: $${reportData.netIncome.toFixed(2)}`, 20, currentY);

    console.log('Mobile PDF generated successfully');
    
    // Return PDF buffer
    return Buffer.from(doc.output('arraybuffer'));
    
  } catch (error) {
    console.error('Mobile PDF generation error:', error);
    
    // Create simple fallback PDF
    try {
      const errorDoc = new jsPDF();
      errorDoc.setFontSize(16);
      errorDoc.text('PDF Generation Error', 20, 30);
      errorDoc.setFontSize(12);
      errorDoc.text('Unable to generate detailed report at this time.', 20, 50);
      errorDoc.text('Please try again later or contact support.', 20, 70);
      
      return Buffer.from(errorDoc.output('arraybuffer'));
    } catch (fallbackError) {
      console.error('Fallback PDF generation failed:', fallbackError);
      throw new Error('PDF generation completely failed');
    }
  }
}

async function prepareReportData(options: ReportOptions): Promise<ReportData> {
  const user = await storage.getUser(options.userId);
  if (!user) throw new Error('User not found');

  const startDate = options.period === 'monthly' 
    ? new Date(options.year, options.month! - 1, 1)
    : new Date(options.year, 0, 1);
  
  const endDate = options.period === 'monthly'
    ? new Date(options.year, options.month!, 0)
    : new Date(options.year, 11, 31);

  // Get gigs and apply multi-day grouping logic (same as dashboard)
  const allGigs = await storage.getGigsByDateRange(
    options.userId,
    startDate.toISOString().split('T')[0],
    endDate.toISOString().split('T')[0]
  );

  // Group multi-day gigs to prevent double-counting
  const groupedGigs = groupMultiDayGigs(allGigs);
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

function groupMultiDayGigs(gigs: Gig[]): Gig[] {
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