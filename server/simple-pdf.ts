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
    
    const totalIncome = completedGigs.reduce((sum, gig) => {
      return sum + parseFloat(gig.actualPay || '0') + parseFloat(gig.tips || '0');
    }, 0);

    // Manual table for income
    doc.setFontSize(10);
    let yPos = 50;
    
    // Table headers
    doc.setFont('helvetica', 'bold');
    doc.text('Date', 20, yPos);
    doc.text('Source', 60, yPos);
    doc.text('Type', 100, yPos);
    doc.text('Amount', 150, yPos);
    yPos += 10;
    
    // Table rows
    doc.setFont('helvetica', 'normal');
    completedGigs.forEach(gig => {
      const amount = parseFloat(gig.actualPay || '0') + parseFloat(gig.tips || '0');
      if (amount > 0) {
        doc.text(new Date(gig.date).toLocaleDateString(), 20, yPos);
        doc.text(gig.clientName || 'Direct Client', 60, yPos);
        doc.text(gig.gigType || 'Service', 100, yPos);
        doc.text(`$${amount.toFixed(2)}`, 150, yPos);
        yPos += 8;
        
        if (yPos > 270) {
          doc.addPage();
          yPos = 30;
          // Re-add headers
          doc.setFont('helvetica', 'bold');
          doc.text('Date', 20, yPos);
          doc.text('Source', 60, yPos);
          doc.text('Type', 100, yPos);
          doc.text('Amount', 150, yPos);
          yPos += 10;
          doc.setFont('helvetica', 'normal');
        }
      }
    });
    
    // Total
    yPos += 10;
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL INCOME: $${totalIncome.toFixed(2)}`, 20, yPos);

    // Mileage summary
    doc.addPage();
    doc.setFontSize(16);
    doc.text('MILEAGE SUMMARY', 20, 30);
    
    const mileageGigs = completedGigs.filter(gig => gig.mileage && gig.mileage > 0);
    const totalMileage = mileageGigs.reduce((sum, gig) => sum + (gig.mileage || 0), 0);
    const totalMileageValue = totalMileage * 0.67;

    // Manual mileage table
    doc.setFontSize(10);
    yPos = 50;
    
    // Table headers
    doc.setFont('helvetica', 'bold');
    doc.text('Date', 20, yPos);
    doc.text('Purpose', 60, yPos);
    doc.text('Miles', 120, yPos);
    doc.text('Value', 150, yPos);
    yPos += 10;
    
    // Table rows
    doc.setFont('helvetica', 'normal');
    mileageGigs.forEach(gig => {
      const value = (gig.mileage || 0) * 0.67;
      doc.text(new Date(gig.date).toLocaleDateString(), 20, yPos);
      doc.text(`${gig.eventName || 'Gig'} (${gig.clientName || 'Client'})`.substring(0, 25), 60, yPos);
      doc.text((gig.mileage || 0).toString(), 120, yPos);
      doc.text(`$${value.toFixed(2)}`, 150, yPos);
      yPos += 8;
      
      if (yPos > 270) {
        doc.addPage();
        yPos = 30;
        // Re-add headers
        doc.setFont('helvetica', 'bold');
        doc.text('Date', 20, yPos);
        doc.text('Purpose', 60, yPos);
        doc.text('Miles', 120, yPos);
        doc.text('Value', 150, yPos);
        yPos += 10;
        doc.setFont('helvetica', 'normal');
      }
    });
    
    // Mileage total
    yPos += 10;
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL MILEAGE: ${totalMileage} miles`, 20, yPos);
    yPos += 8;
    doc.text(`TOTAL MILEAGE VALUE: $${totalMileageValue.toFixed(2)}`, 20, yPos);

    // Summary totals
    doc.addPage();
    doc.setFontSize(16);
    doc.text('SUMMARY TOTALS', 20, 30);
    
    const expenses = completedGigs.reduce((sum, gig) => {
      return sum + parseFloat(gig.parkingExpense || '0') + parseFloat(gig.otherExpenses || '0');
    }, 0);

    doc.setFontSize(12);
    yPos = 50;
    doc.text(`Total Income: $${totalIncome.toFixed(2)}`, 20, yPos);
    yPos += 15;
    doc.text(`Total Expenses: $${expenses.toFixed(2)}`, 20, yPos);
    yPos += 15;
    doc.text(`Total Mileage: ${totalMileage} miles`, 20, yPos);
    yPos += 15;
    doc.text(`Mileage Value: $${totalMileageValue.toFixed(2)}`, 20, yPos);
    yPos += 15;
    doc.setFont('helvetica', 'bold');
    doc.text(`Net Income: $${(totalIncome - expenses - totalMileageValue).toFixed(2)}`, 20, yPos);

    return Buffer.from(doc.output('arraybuffer'));
    
  } catch (error) {
    console.error('PDF generation error:', error);
    throw error;
  }
}