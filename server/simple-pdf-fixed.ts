import jsPDF from 'jspdf';
import { storage } from './storage';

export async function generateSimplePDF(
  userId: number,
  period: 'monthly' | 'annual',
  year: number,
  month?: number
): Promise<Buffer> {
  try {
    console.log('Starting simple PDF generation for user:', userId);
    
    // Initialize PDF with standard settings
    const doc = new jsPDF();

    // Get report data with multi-day gig grouping
    const startDate = period === 'monthly' 
      ? new Date(year, month! - 1, 1)
      : new Date(year, 0, 1);
    
    const endDate = period === 'monthly'
      ? new Date(year, month!, 0)
      : new Date(year, 11, 31);

    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const allGigs = await storage.getGigsByDateRange(
      userId,
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    // Apply same multi-day grouping logic as dashboard
    const groupedGigs = groupMultiDayGigs(allGigs);
    const completedGigs = groupedGigs.filter(g => g.status === 'completed');

    console.log('Gigs processed:', { 
      total: allGigs.length,
      grouped: groupedGigs.length,
      completed: completedGigs.length 
    });

    // Calculate totals
    const totalIncome = completedGigs.reduce((sum, gig) => {
      const actualPay = parseFloat(gig.actualPay || '0');
      const tips = parseFloat(gig.tips || '0');
      return sum + actualPay + tips;
    }, 0);

    const totalMileage = completedGigs.reduce((sum, gig) => sum + (gig.mileage || 0), 0);
    const mileageValue = totalMileage * 0.67;

    const periodStr = period === 'monthly' 
      ? `${new Date(year, month! - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
      : `${year} Annual Report`;

    // Create PDF content
    let yPos = 30;
    
    // Title page
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('FREELANCER INCOME REPORT', 105, yPos, { align: 'center' });
    
    yPos += 20;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text(user.name || 'Business Name', 105, yPos, { align: 'center' });
    
    yPos += 15;
    doc.setFontSize(12);
    doc.text(periodStr, 105, yPos, { align: 'center' });
    
    yPos += 15;
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 105, yPos, { align: 'center' });
    
    if (user.email) {
      yPos += 15;
      doc.text(`Contact: ${user.email}`, 105, yPos, { align: 'center' });
    }

    // Content page
    doc.addPage();
    yPos = 20;

    // Income Summary
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('INCOME SUMMARY', 20, yPos);
    yPos += 15;
    
    completedGigs.forEach(gig => {
      const gigTotal = parseFloat(gig.actualPay || '0') + parseFloat(gig.tips || '0');
      
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      const dateStr = gig.date.includes(' - ') ? gig.date : new Date(gig.date).toLocaleDateString();
      doc.text(dateStr, 20, yPos);
      yPos += 5;
      
      doc.text(`${gig.clientName || 'Direct Client'} - ${gig.gigType || 'Service'}`, 25, yPos);
      yPos += 5;
      
      doc.text(`Amount: $${gigTotal.toFixed(2)}`, 25, yPos);
      yPos += 10;
    });
    
    yPos += 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL INCOME: $${totalIncome.toFixed(2)}`, 20, yPos);
    
    // Summary page
    doc.addPage();
    yPos = 20;
    
    doc.setFontSize(16);
    doc.text('SUMMARY TOTALS', 20, yPos);
    yPos += 25;
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Income: $${totalIncome.toFixed(2)}`, 20, yPos);
    yPos += 12;
    doc.text(`Total Mileage: ${totalMileage} miles`, 20, yPos);
    yPos += 12;
    doc.text(`Mileage Value: $${mileageValue.toFixed(2)}`, 20, yPos);
    yPos += 15;
    
    doc.setFont('helvetica', 'bold');
    const netIncome = totalIncome - mileageValue;
    doc.text(`NET INCOME: $${netIncome.toFixed(2)}`, 20, yPos);

    console.log('PDF content created successfully');
    
    // Generate PDF buffer
    const pdfOutput = doc.output('arraybuffer');
    return Buffer.from(pdfOutput);
    
  } catch (error) {
    console.error('Simple PDF generation error:', error);
    throw new Error(`PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function groupMultiDayGigs(gigs: any[]): any[] {
  const parseGigDate = (dateStr: string) => new Date(dateStr + 'T00:00:00.000Z');
  const sortedGigs = [...gigs].sort((a, b) => parseGigDate(a.date).getTime() - parseGigDate(b.date).getTime());
  const grouped: any[] = [];
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
      // Multi-day gig - use first entry's amounts (same as dashboard logic)
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