import { storage } from './storage';

export async function generateHTMLPDF(
  userId: number,
  period: 'monthly' | 'annual',
  year: number,
  month?: number
): Promise<string> {
  try {
    console.log('Starting HTML PDF generation for user:', userId);
    
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

    // Generate HTML content that looks like a professional report
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Freelancer Income Report</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
            line-height: 1.6;
            color: #333;
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 2px solid #007bff;
        }
        .header h1 {
            color: #007bff;
            margin-bottom: 10px;
            font-size: 28px;
        }
        .header h2 {
            color: #666;
            margin-bottom: 5px;
            font-weight: normal;
            font-size: 18px;
        }
        .section {
            margin: 30px 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        .section h3 {
            color: #007bff;
            margin-bottom: 15px;
            font-size: 20px;
            border-bottom: 1px solid #dee2e6;
            padding-bottom: 5px;
        }
        .gig-item {
            margin: 15px 0;
            padding: 15px;
            background: white;
            border-radius: 5px;
            border-left: 4px solid #28a745;
        }
        .gig-date {
            font-weight: bold;
            color: #007bff;
        }
        .gig-details {
            margin: 5px 0;
            color: #666;
        }
        .gig-amount {
            font-weight: bold;
            color: #28a745;
            font-size: 16px;
        }
        .summary {
            background: #e9ecef;
            padding: 20px;
            border-radius: 8px;
            margin-top: 30px;
        }
        .summary-item {
            display: flex;
            justify-content: space-between;
            margin: 10px 0;
            padding: 8px 0;
            border-bottom: 1px solid #dee2e6;
        }
        .summary-item:last-child {
            border-bottom: none;
            font-weight: bold;
            font-size: 18px;
            color: #007bff;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #dee2e6;
            color: #666;
            font-size: 12px;
        }
        @media print {
            body { margin: 0; padding: 20px; }
            .section { break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>FREELANCER INCOME REPORT</h1>
        <h2>${user.name || 'Business Name'}</h2>
        <h2>${periodStr}</h2>
        <p>Generated: ${new Date().toLocaleDateString()}</p>
        ${user.email ? `<p>Contact: ${user.email}</p>` : ''}
    </div>

    <div class="section">
        <h3>💰 Income Summary</h3>
        ${completedGigs.length > 0 ? completedGigs.map(gig => {
          const actualPay = parseFloat(gig.actualPay || '0');
          const tips = parseFloat(gig.tips || '0');
          const gigTotal = actualPay + tips;
          
          // Safe date parsing
          let dateStr;
          try {
            if (gig.date.includes(' - ')) {
              dateStr = gig.date;
            } else {
              const gigDate = new Date(gig.date);
              dateStr = gigDate.toLocaleDateString();
            }
          } catch (e) {
            dateStr = gig.date || 'Date unavailable';
          }
          
          // Safe string escaping for HTML
          const htmlEscape = (str: string): string => {
            return str.replace(/[<>&"']/g, (char: string) => {
              const entities: Record<string, string> = { 
                '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' 
              };
              return entities[char] || char;
            });
          };
          
          const safeClientName = htmlEscape(gig.clientName || 'Direct Client');
          const safeGigType = htmlEscape(gig.gigType || 'Service');
          
          return `
            <div class="gig-item">
                <div class="gig-date">${dateStr}</div>
                <div class="gig-details">${safeClientName} - ${safeGigType}</div>
                <div class="gig-amount">$${gigTotal.toFixed(2)}</div>
            </div>
          `;
        }).join('') : '<p style="text-align: center; color: #666; margin: 20px 0;">No completed gigs found for this period.</p>'}
    </div>

    <div class="summary">
        <h3>📊 Summary Totals</h3>
        <div class="summary-item">
            <span>Total Income:</span>
            <span>$${totalIncome.toFixed(2)}</span>
        </div>
        <div class="summary-item">
            <span>Total Mileage:</span>
            <span>${totalMileage} miles</span>
        </div>
        <div class="summary-item">
            <span>Mileage Value (@ $0.67/mi):</span>
            <span>$${mileageValue.toFixed(2)}</span>
        </div>
        <div class="summary-item">
            <span>Net Income:</span>
            <span>$${(totalIncome - mileageValue).toFixed(2)}</span>
        </div>
    </div>

    <div class="footer">
        <p>This report is generated by Giggy for informational use only and does not constitute tax advice.</p>
        <p>Please consult with a qualified tax professional for tax planning and preparation.</p>
    </div>
</body>
</html>`;

    console.log('HTML PDF content generated successfully');
    return html;
    
  } catch (error) {
    console.error('HTML PDF generation error:', error);
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