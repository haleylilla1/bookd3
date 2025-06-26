import { storage } from './storage';

export async function generateSimplePDF(userId: number, period: string, year: number, month?: number): Promise<Buffer> {
  try {
    // Import jsPDF with proper Node.js handling
    let jsPDF;
    try {
      const jsPDFModule = await import('jspdf');
      jsPDF = jsPDFModule.default || jsPDFModule.jsPDF || jsPDFModule;
    } catch (importError) {
      console.log('Trying alternative jsPDF import...');
      jsPDF = require('jspdf').jsPDF || require('jspdf');
    }
    
    await import('jspdf-autotable');
    
    const doc = new jsPDF();
    
    // Get user
    const user = await storage.getUser(userId);
    if (!user) throw new Error('User not found');

    // Calculate date range
    const startDate = period === 'monthly' 
      ? new Date(year, month! - 1, 1)
      : new Date(year, 0, 1);
    
    const endDate = period === 'monthly'
      ? new Date(year, month!, 0)
      : new Date(year, 11, 31);

    // Get gigs
    const allGigs = await storage.getGigsByDateRange(
      userId,
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );
    
    const completedGigs = allGigs.filter(g => g.status === 'completed');

    // Cover page
    doc.setFontSize(20);
    doc.text('FREELANCER INCOME REPORT', 105, 40, { align: 'center' });
    
    doc.setFontSize(14);
    doc.text(user.name || 'Business Name', 105, 60, { align: 'center' });
    
    const periodText = period === 'monthly' 
      ? `${new Date(year, month! - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
      : `${year} Annual Report`;
    
    doc.text(periodText, 105, 80, { align: 'center' });
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 105, 100, { align: 'center' });
    
    if (user.email) {
      doc.text(`Contact: ${user.email}`, 105, 120, { align: 'center' });
    }

    // Add new page for data
    doc.addPage();
    
    // Income summary
    doc.setFontSize(16);
    doc.text('INCOME SUMMARY', 20, 30);
    
    const incomeData = completedGigs.map(gig => [
      new Date(gig.date).toLocaleDateString(),
      gig.clientName || 'Direct Client',
      gig.gigType || 'Service',
      `$${(parseFloat(gig.actualPay || '0') + parseFloat(gig.tips || '0')).toFixed(2)}`
    ]);

    const totalIncome = completedGigs.reduce((sum, gig) => {
      return sum + parseFloat(gig.actualPay || '0') + parseFloat(gig.tips || '0');
    }, 0);

    (doc as any).autoTable({
      head: [['Date', 'Source', 'Type', 'Amount']],
      body: incomeData,
      startY: 40,
      foot: [['', '', 'TOTAL', `$${totalIncome.toFixed(2)}`]]
    });

    // Mileage summary
    doc.addPage();
    doc.setFontSize(16);
    doc.text('MILEAGE SUMMARY', 20, 30);
    
    const mileageGigs = completedGigs.filter(gig => gig.mileage && gig.mileage > 0);
    const mileageData = mileageGigs.map(gig => [
      new Date(gig.date).toLocaleDateString(),
      `${gig.eventName || 'Gig'} (${gig.clientName || 'Client'})`,
      gig.mileage?.toString() || '0',
      '$0.67/mi',
      `$${((gig.mileage || 0) * 0.67).toFixed(2)}`
    ]);

    const totalMileage = mileageGigs.reduce((sum, gig) => sum + (gig.mileage || 0), 0);
    const totalMileageValue = totalMileage * 0.67;

    (doc as any).autoTable({
      head: [['Date', 'Purpose', 'Miles', 'Rate', 'Value']],
      body: mileageData,
      startY: 40,
      foot: [['', 'TOTAL', totalMileage.toString(), '', `$${totalMileageValue.toFixed(2)}`]]
    });

    // Summary totals
    doc.addPage();
    doc.setFontSize(16);
    doc.text('SUMMARY TOTALS', 20, 30);
    
    const expenses = completedGigs.reduce((sum, gig) => {
      return sum + parseFloat(gig.parkingExpense || '0') + parseFloat(gig.otherExpenses || '0');
    }, 0);

    const summaryData = [
      ['Total Income', `$${totalIncome.toFixed(2)}`],
      ['Total Expenses', `$${expenses.toFixed(2)}`],
      ['Total Mileage', `${totalMileage} miles`],
      ['Mileage Value', `$${totalMileageValue.toFixed(2)}`],
      ['Net Income', `$${(totalIncome - expenses - totalMileageValue).toFixed(2)}`]
    ];

    (doc as any).autoTable({
      head: [['Category', 'Total']],
      body: summaryData,
      startY: 40
    });

    return Buffer.from(doc.output('arraybuffer'));
    
  } catch (error) {
    console.error('PDF generation error:', error);
    throw error;
  }
}