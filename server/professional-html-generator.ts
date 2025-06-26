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

export async function generateProfessionalHTML(options: ReportOptions): Promise<string> {
  const data = await prepareReportData(options);
  const MILEAGE_RATE = 0.67; // 2024 IRS rate
  
  const parkingTotal = data.gigs.reduce((sum, g) => sum + parseFloat(g.parkingExpense || '0'), 0);
  const otherTotal = data.gigs.reduce((sum, g) => sum + parseFloat(g.otherExpenses || '0'), 0);
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Professional Freelancer Report - ${data.period}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; background: #f8f9fa; }
        .container { max-width: 800px; margin: 0 auto; padding: 20px; }
        .page { background: white; margin: 20px 0; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        
        /* Header Styles */
        .header { text-align: center; border-bottom: 3px solid #2c3e50; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { font-size: 28px; color: #2c3e50; margin-bottom: 10px; }
        .header h2 { font-size: 18px; color: #7f8c8d; margin-bottom: 5px; }
        
        /* Info Boxes */
        .info-box { border: 2px solid #3498db; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .info-box h3 { color: #2c3e50; margin-bottom: 15px; font-size: 16px; }
        .info-box p { margin-bottom: 8px; }
        
        .summary-box { border: 2px solid #27ae60; background: #f8fff8; }
        .tax-box { border: 2px solid #e74c3c; background: #fff8f8; }
        .expense-box { border: 2px solid #f39c12; background: #fff9f0; }
        
        /* Tables */
        .table-container { overflow-x: auto; margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; background: white; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f8f9fa; font-weight: bold; color: #2c3e50; }
        tr:nth-child(even) { background: #f8f9fa; }
        .total-row { background: #e8f4f8 !important; font-weight: bold; }
        
        /* Mobile Responsive */
        @media (max-width: 768px) {
            .container { padding: 10px; }
            .page { padding: 20px; margin: 10px 0; }
            .header h1 { font-size: 24px; }
            .header h2 { font-size: 16px; }
            table { font-size: 14px; }
            th, td { padding: 8px; }
        }
        
        /* Print Styles */
        @media print {
            body { background: white; }
            .page { box-shadow: none; margin: 0; page-break-after: always; }
            .page:last-child { page-break-after: auto; }
        }
        
        .section-title { color: #2c3e50; font-size: 20px; margin: 30px 0 15px 0; border-bottom: 2px solid #3498db; padding-bottom: 5px; }
        .highlight { color: #27ae60; font-weight: bold; }
        .tax-highlight { color: #e74c3c; font-weight: bold; }
        .note { font-style: italic; color: #7f8c8d; font-size: 14px; margin-top: 15px; }
        
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
        @media (max-width: 768px) { .grid { grid-template-columns: 1fr; } }
    </style>
</head>
<body>
    <div class="container">
        <!-- Cover Page - Matching Exact Format -->
        <div class="page">
            <div style="text-align: center; margin-bottom: 50px;">
                <h1 style="font-size: 32px; margin-bottom: 30px;">FREELANCER INCOME REPORT</h1>
                
                <div style="margin: 40px 0;">
                    <h2 style="font-size: 24px; margin: 20px 0;">${(data.user.firstName || '') + ' ' + (data.user.lastName || '') || 'Freelancer'}</h2>
                </div>
                
                <div style="margin: 40px 0;">
                    <h2 style="font-size: 20px; margin: 20px 0;">${data.period}</h2>
                </div>
                
                <div style="margin: 40px 0;">
                    <p style="font-size: 16px; margin: 20px 0;">Generated: ${new Date().toLocaleDateString()}</p>
                </div>
                
                ${data.user.email ? `
                <div style="margin: 40px 0;">
                    <p style="font-size: 16px; margin: 20px 0;">Contact: ${data.user.email}</p>
                </div>
                ` : ''}
            </div>
        </div>

        <!-- Income Summary Page - Matching Exact Format -->
        <div class="page">
            <h2 style="font-size: 24px; margin-bottom: 30px; text-align: center;">INCOME SUMMARY</h2>
            
            <div style="margin: 40px 0;">
                <table style="width: 100%; border-collapse: collapse; font-family: monospace;">
                    <thead>
                        <tr>
                            <th style="text-align: left; padding: 10px 0; border-bottom: 1px solid #333;">Date</th>
                            <th style="text-align: left; padding: 10px 0; border-bottom: 1px solid #333;">Source</th>
                            <th style="text-align: left; padding: 10px 0; border-bottom: 1px solid #333;">Type</th>
                            <th style="text-align: right; padding: 10px 0; border-bottom: 1px solid #333;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.gigs.map(gig => {
                          const actualPay = parseFloat(gig.actualPay || '0');
                          const tips = parseFloat(gig.tips || '0');
                          const total = actualPay + tips;
                          const dateStr = gig.date.includes(' - ') ? gig.date : new Date(gig.date).toLocaleDateString();
                          const source = gig.clientName || 'Direct Client';
                          const type = gig.gigType || 'Service';
                          
                          return `
                            <tr>
                                <td style="padding: 8px 0;">${dateStr}</td>
                                <td style="padding: 8px 0;">${source}</td>
                                <td style="padding: 8px 0;">${type}</td>
                                <td style="padding: 8px 0; text-align: right;">$${total.toFixed(2)}</td>
                            </tr>
                          `;
                        }).join('')}
                    </tbody>
                </table>
                
                <div style="margin-top: 40px; text-align: center;">
                    <p style="font-size: 18px; font-weight: bold;">TOTAL INCOME: $${data.totalIncome.toFixed(2)}</p>
                </div>
            </div>
        </div>

        <!-- Mileage Summary Page - Matching Exact Format -->
        <div class="page">
            <h2 style="font-size: 24px; margin-bottom: 30px; text-align: center;">MILEAGE SUMMARY</h2>
            
            ${data.gigs.some(g => parseFloat(g.mileage || '0') > 0) ? `
            <div style="margin: 40px 0;">
                <table style="width: 100%; border-collapse: collapse; font-family: monospace;">
                    <thead>
                        <tr>
                            <th style="text-align: left; padding: 10px 0; border-bottom: 1px solid #333;">Date</th>
                            <th style="text-align: left; padding: 10px 0; border-bottom: 1px solid #333;">Purpose</th>
                            <th style="text-align: right; padding: 10px 0; border-bottom: 1px solid #333;">Miles</th>
                            <th style="text-align: right; padding: 10px 0; border-bottom: 1px solid #333;">Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.gigs.filter(g => parseFloat(g.mileage || '0') > 0).map(gig => {
                          const miles = parseFloat(gig.mileage || '0');
                          const dateStr = gig.date.includes(' - ') ? gig.date : new Date(gig.date).toLocaleDateString();
                          const purpose = `${gig.eventName || 'Event'} (${gig.clientName || 'Client'})`;
                          const value = (miles * MILEAGE_RATE);
                          
                          return `
                            <tr>
                                <td style="padding: 8px 0;">${dateStr}</td>
                                <td style="padding: 8px 0;">${purpose}</td>
                                <td style="padding: 8px 0; text-align: right;">${Math.round(miles)}</td>
                                <td style="padding: 8px 0; text-align: right;">$${value.toFixed(2)}</td>
                            </tr>
                          `;
                        }).join('')}
                    </tbody>
                </table>
                
                <div style="margin-top: 40px;">
                    <p style="font-size: 18px; font-weight: bold; margin: 10px 0;">TOTAL MILEAGE: ${Math.round(data.totalMileage)} miles</p>
                    <p style="font-size: 18px; font-weight: bold; margin: 10px 0;">TOTAL MILEAGE VALUE: $${data.mileageValue.toFixed(2)}</p>
                </div>
            </div>
            ` : `
            <div style="text-align: center; margin: 40px 0;">
                <p style="font-size: 16px;">No mileage recorded for this period.</p>
            </div>
            `}
        </div>

        <!-- Summary Totals Page - Matching Exact Format -->
        <div class="page">
            <h2 style="font-size: 24px; margin-bottom: 30px; text-align: center;">SUMMARY TOTALS</h2>
            
            <div style="margin: 40px 0; font-size: 18px; line-height: 2;">
                <p><strong>Total Income: $${data.totalIncome.toFixed(2)}</strong></p>
                <p><strong>Total Expenses: $${data.totalExpenses.toFixed(2)}</strong></p>
                <p><strong>Total Mileage: ${Math.round(data.totalMileage)} miles</strong></p>
                <p><strong>Mileage Value: $${data.mileageValue.toFixed(2)}</strong></p>
                <p><strong>Net Income: $${data.netIncome.toFixed(2)}</strong></p>
            </div>
        </div>

        <!-- Tax Breakdown Per Gig Page -->
        <div class="page">
            <h2 style="font-size: 24px; margin-bottom: 30px; text-align: center;">TAX BREAKDOWN BY GIG</h2>
            
            <div style="margin: 40px 0;">
                <table style="width: 100%; border-collapse: collapse; font-family: monospace;">
                    <thead>
                        <tr>
                            <th style="text-align: left; padding: 10px 0; border-bottom: 1px solid #333;">Date</th>
                            <th style="text-align: left; padding: 10px 0; border-bottom: 1px solid #333;">Event</th>
                            <th style="text-align: right; padding: 10px 0; border-bottom: 1px solid #333;">Income</th>
                            <th style="text-align: right; padding: 10px 0; border-bottom: 1px solid #333;">Est. Tax (23%)</th>
                            <th style="text-align: right; padding: 10px 0; border-bottom: 1px solid #333;">After Tax</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.gigs.map(gig => {
                          const actualPay = parseFloat(gig.actualPay || '0');
                          const tips = parseFloat(gig.tips || '0');
                          const total = actualPay + tips;
                          const estimatedTax = total * 0.23;
                          const afterTax = total - estimatedTax;
                          const dateStr = gig.date.includes(' - ') ? gig.date : new Date(gig.date).toLocaleDateString();
                          const eventName = (gig.eventName || 'Event').substring(0, 20);
                          
                          return `
                            <tr>
                                <td style="padding: 8px 0;">${dateStr}</td>
                                <td style="padding: 8px 0;">${eventName}</td>
                                <td style="padding: 8px 0; text-align: right;">$${total.toFixed(2)}</td>
                                <td style="padding: 8px 0; text-align: right;">$${estimatedTax.toFixed(2)}</td>
                                <td style="padding: 8px 0; text-align: right;">$${afterTax.toFixed(2)}</td>
                            </tr>
                          `;
                        }).join('')}
                        <tr style="border-top: 2px solid #333; font-weight: bold;">
                            <td colspan="2" style="padding: 12px 0; font-weight: bold;">TOTALS:</td>
                            <td style="padding: 12px 0; text-align: right; font-weight: bold;">$${data.totalIncome.toFixed(2)}</td>
                            <td style="padding: 12px 0; text-align: right; font-weight: bold;">$${(data.totalIncome * 0.23).toFixed(2)}</td>
                            <td style="padding: 12px 0; text-align: right; font-weight: bold;">$${(data.totalIncome * 0.77).toFixed(2)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div style="margin: 30px 0; padding: 15px; background-color: #f0f8ff; border-left: 4px solid #4a90e2;">
                <p style="font-size: 14px; margin: 0;"><strong>Note:</strong> Tax estimates are calculated at 23% for planning purposes. Actual tax rates may vary based on total annual income, deductions, and filing status.</p>
            </div>
        </div>

        <!-- Tax Due Dates Page -->
        <div class="page">
            <h2 style="font-size: 24px; margin-bottom: 30px; text-align: center;">2025 ESTIMATED TAX PAYMENT DUE DATES</h2>
            
            <div style="margin: 40px 0; font-size: 16px; line-height: 2;">
                <p><strong>1st Quarter (Jan 1 - Mar 31): April 15, 2025</strong></p>
                <p><strong>2nd Quarter (Apr 1 - May 31): June 16, 2025</strong></p>
                <p><strong>3rd Quarter (June 1 - Aug 31): September 15, 2025</strong></p>
                <p><strong>4th Quarter (Sept 1 - Dec 31): January 15, 2026</strong></p>
            </div>
            
            <div style="margin: 40px 0; padding: 20px; border: 1px solid #ccc; background-color: #f9f9f9;">
                <p style="font-size: 14px; line-height: 1.5; margin: 0;">
                    <strong>Note:</strong> This report is for informational purposes only. 
                    Consult with a qualified tax professional for specific tax advice and filing requirements.
                </p>
            </div>
        </div>

        <!-- Expense Summary Page -->
        <div class="page">
            <h2 class="section-title">EXPENSE & MILEAGE SUMMARY</h2>
            
            <div class="info-box expense-box">
                <h3>EXPENSE TOTALS</h3>
                <div class="grid">
                    <div>
                        <p>Parking Expenses: $${parkingTotal.toFixed(2)}</p>
                        <p>Other Business Expenses: $${otherTotal.toFixed(2)}</p>
                        <p><strong>Total Direct Expenses: $${data.totalExpenses.toFixed(2)}</strong></p>
                    </div>
                    <div>
                        <p>Total Business Miles: ${data.totalMileage.toFixed(1)} miles</p>
                        <p>IRS Mileage Rate: $${MILEAGE_RATE}/mile</p>
                        <p><strong>Mileage Deduction: $${data.mileageValue.toFixed(2)}</strong></p>
                    </div>
                </div>
                <p style="margin-top: 15px; font-size: 18px;"><strong>TOTAL BUSINESS DEDUCTIONS: <span class="highlight">$${(data.totalExpenses + data.mileageValue).toFixed(2)}</span></strong></p>
            </div>
            
            ${data.gigs.some(g => parseFloat(g.mileage || '0') > 0) ? `
            <h3 style="margin-top: 30px;">MILEAGE LOG</h3>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Purpose</th>
                            <th>Miles</th>
                            <th>Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.gigs.filter(g => parseFloat(g.mileage || '0') > 0).map(gig => {
                          const miles = parseFloat(gig.mileage || '0');
                          const dateStr = gig.date.includes(' - ') ? gig.date : new Date(gig.date).toLocaleDateString();
                          const purpose = `${gig.eventName || 'Event'} - ${gig.clientName || 'Client'}`;
                          
                          return `
                            <tr>
                                <td>${dateStr}</td>
                                <td>${purpose}</td>
                                <td>${miles.toFixed(1)}</td>
                                <td>$${(miles * MILEAGE_RATE).toFixed(2)}</td>
                            </tr>
                          `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            ` : ''}
        </div>

        <!-- Receipts Page -->
        ${data.receipts.length > 0 ? `
        <div class="page">
            <h2 class="section-title">RECEIPTS & EXPENSE DOCUMENTATION</h2>
            
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Description</th>
                            <th>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.receipts.map(receipt => {
                          const dateStr = new Date(receipt.date).toLocaleDateString();
                          const type = receipt.type === 'parking' ? 'Parking' : 'Other';
                          const description = `${receipt.gigName} (${receipt.clientName})`;
                          
                          return `
                            <tr>
                                <td>${dateStr}</td>
                                <td>${type}</td>
                                <td>${description}</td>
                                <td>$${receipt.amount.toFixed(2)}</td>
                            </tr>
                          `;
                        }).join('')}
                        <tr class="total-row">
                            <td colspan="3"><strong>TOTAL RECEIPTS:</strong></td>
                            <td><strong>$${data.receipts.reduce((sum, r) => sum + r.amount, 0).toFixed(2)}</strong></td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div class="info-box">
                <h3>NOTES FOR TAX FILING</h3>
                <ul style="margin-left: 20px;">
                    <li>Keep all original receipts and documentation</li>
                    <li>Business expenses must be ordinary and necessary</li>
                    <li>Mileage calculated using IRS standard rate</li>
                    <li>Consult tax professional for proper categorization</li>
                </ul>
            </div>
        </div>
        ` : ''}
    </div>
</body>
</html>
  `;
}

async function prepareReportData(options: ReportOptions): Promise<ReportData> {
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
  const groupedGigs = groupMultiDayGigs(gigs);
  
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

  const MILEAGE_RATE = 0.67;
  const mileageValue = totalMileage * MILEAGE_RATE;
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

function groupMultiDayGigs(gigs: Gig[]): Gig[] {
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