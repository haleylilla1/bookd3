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
  reimbursed: boolean;
  receipts: string[]; // Array of receipt photo URLs/base64 strings
}

export async function generateProfessionalHTML(options: ReportOptions): Promise<string> {
  // MEMORY MANAGEMENT: Clear any large variables and force garbage collection at start
  if (global.gc) {
    global.gc();
  }
  
  // Validate input parameters with defaults (outside try block)
  const safeOptions = {
    userId: options.userId || 0,
    period: (options.period === 'monthly' || options.period === 'annual') ? options.period : 'monthly',
    year: options.year || new Date().getFullYear(),
    month: options.month || new Date().getMonth() + 1
  };

  try {
    console.log('🚀 MEMORY OPTIMIZED: Starting HTML report generation for user:', options.userId);
    
    console.log('📊 Using safe options:', safeOptions);
    
    // Get user data with error handling
    const user = await storage.getUser(safeOptions.userId);
    if (!user) {
      console.error('❌ User not found for ID:', safeOptions.userId);
      throw new Error(`User not found: ${safeOptions.userId}`);
    }
    
    console.log('✅ User found:', user.email);
    
    // Prepare report data with comprehensive error handling
    const data = await prepareReportDataSafe(safeOptions);
    console.log('📈 Report data prepared, gigs:', data.gigs?.length || 0);
    
    const MILEAGE_RATE = 0.67; // 2024 IRS rate
    
    // Filter to completed gigs only with safe handling
    const allGigs = Array.isArray(data.gigs) ? data.gigs : [];
    const completedGigs = allGigs.filter(g => g && (g.status === 'completed' || g.actualPay));
    console.log('💰 Completed gigs found:', completedGigs.length);
    
    // Generate tax breakdown table with bulletproof logic
    const groupedGigs = groupMultiDayGigsSafe(completedGigs);
    const taxEstimatesRows = groupedGigs.map((gig, index) => {
      try {
        const actualPay = safeParseFloat(gig.actualPay);
        const tips = safeParseFloat(gig.tips);
        const gigIncome = actualPay + tips;
        
        const gigTaxRate = (gig.taxPercentage !== null && gig.taxPercentage !== undefined) 
          ? Number(gig.taxPercentage) 
          : (user.defaultTaxPercentage || 23);
        const gigTaxes = gigIncome * (gigTaxRate / 100);
        
        return `
          <tr style="background-color: ${index % 2 === 0 ? '#fff' : '#f8f9fa'};">
              <td style="padding: 12px; border-bottom: 1px solid #ddd;">${escapeHtml(gig.eventName || 'Unnamed Event')}</td>
              <td style="padding: 12px; text-align: right; border-bottom: 1px solid #ddd;">$${gigIncome.toFixed(2)}</td>
              <td style="padding: 12px; text-align: center; border-bottom: 1px solid #ddd;">${gigTaxRate}%</td>
              <td style="padding: 12px; text-align: right; border-bottom: 1px solid #ddd; font-weight: bold; color: #d63384;">$${gigTaxes.toFixed(2)}</td>
          </tr>
        `;
      } catch (error) {
        console.warn('⚠️ Error processing gig for tax table:', error);
        return `
          <tr style="background-color: ${index % 2 === 0 ? '#fff' : '#f8f9fa'};">
              <td style="padding: 12px; border-bottom: 1px solid #ddd;">Processing Error</td>
              <td style="padding: 12px; text-align: right; border-bottom: 1px solid #ddd;">$0.00</td>
              <td style="padding: 12px; text-align: center; border-bottom: 1px solid #ddd;">0%</td>
              <td style="padding: 12px; text-align: right; border-bottom: 1px solid #ddd; font-weight: bold; color: #d63384;">$0.00</td>
          </tr>
        `;
      }
    }).join('');
    
    // Ultra-safe calculation with comprehensive error handling
    const parkingTotal = allGigs.reduce((sum, g) => {
      try {
        const expense = safeParseFloat(g.parkingExpense);
        return sum + expense;
      } catch {
        return sum;
      }
    }, 0);
    
    const otherTotal = allGigs.reduce((sum, g) => {
      try {
        const expense = safeParseFloat(g.otherExpenses);
        return sum + expense;
      } catch {
        return sum;
      }
    }, 0);
  
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
                          // Handle date ranges for multi-day gigs - fix timezone issues
                          const dateStr = gig.date.includes(' - ') 
                            ? gig.date.split(' - ').map(d => new Date(d + 'T00:00:00').toLocaleDateString()).join(' - ')
                            : new Date(gig.date + 'T00:00:00').toLocaleDateString();
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
            
            ${data.gigs.some(g => parseFloat(String(g.mileage || 0)) > 0) ? `
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
                        ${data.gigs.filter(g => (parseInt(String(g.mileage || 0)) || 0) > 0).map(gig => {
                          const miles = parseInt(String(gig.mileage || 0)) || 0;
                          // Handle date ranges for multi-day gigs - fix timezone issues
                          const dateStr = gig.date.includes(' - ') 
                            ? gig.date.split(' - ').map(d => new Date(d + 'T00:00:00').toLocaleDateString()).join(' - ')
                            : new Date(gig.date + 'T00:00:00').toLocaleDateString();
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



        <!-- Detailed Tax Estimates Page -->
        <div class="page">
            <h2 style="font-size: 24px; margin-bottom: 30px; text-align: center;">DETAILED TAX ESTIMATES BY GIG</h2>
            
            <div style="margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background-color: #f8f9fa;">
                            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #333; font-weight: bold;">Gig</th>
                            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #333; font-weight: bold;">Income</th>
                            <th style="padding: 12px; text-align: center; border-bottom: 2px solid #333; font-weight: bold;">Tax Rate</th>
                            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #333; font-weight: bold;">Tax Estimate</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${taxEstimatesRows}
                        
                        <!-- Total Row -->
                        <tr style="background-color: #e8f4f8; font-weight: bold; border-top: 2px solid #333;">
                            <td style="padding: 15px; border-bottom: 2px solid #333;">TOTAL</td>
                            <td style="padding: 15px; text-align: right; border-bottom: 2px solid #333;">$${data.totalIncome.toFixed(2)}</td>
                            <td style="padding: 15px; text-align: center; border-bottom: 2px solid #333;">-</td>
                            <td style="padding: 15px; text-align: right; border-bottom: 2px solid #333; color: #d63384;">$${data.estimatedTaxes.toFixed(2)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div style="margin: 30px 0; padding: 20px; background-color: #f0f8ff; border-left: 4px solid #4a90e2;">
                <p style="font-size: 14px; margin: 0; line-height: 1.5;">
                    <strong>Calculation Method:</strong> For each gig, taxes are calculated using the gig's individual tax rate applied to gross income. 
                    Income includes actual pay and tips. Each gig uses its individual tax rate setting. These are taxes on gross income before business expense deductions.
                </p>
            </div>
        </div>

        <!-- Expense Receipts Page -->
        <div class="page">
            <h2 style="font-size: 24px; margin-bottom: 30px; text-align: center;">BUSINESS EXPENSES & RECEIPTS</h2>
            
            ${data.receipts.length > 0 ? `
                <div style="margin: 20px 0;">
                    ${data.receipts.map(receipt => `
                        <div style="margin-bottom: 30px; border: 1px solid #ddd; border-radius: 8px; padding: 20px; background-color: ${receipt.reimbursed ? '#f8f9fa' : '#fff'};">
                            <!-- Receipt Header -->
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #eee;">
                                <div>
                                    <h3 style="margin: 0 0 5px 0; font-size: 18px; color: #333;">${receipt.gigName}</h3>
                                    <p style="margin: 0; color: #666; font-size: 14px;">Client: ${receipt.clientName}</p>
                                    <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">Date: ${new Date(receipt.date).toLocaleDateString()}</p>
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-size: 20px; font-weight: bold; color: #198754;">$${receipt.amount.toFixed(2)}</div>
                                    <div style="font-size: 12px; text-transform: uppercase; color: #666; margin-top: 5px;">${receipt.type === 'parking' ? 'Parking' : 'Other'} Expense</div>
                                    ${receipt.reimbursed ? 
                                        '<div style="background-color: #d1ecf1; color: #0c5460; padding: 3px 8px; border-radius: 12px; font-size: 11px; margin-top: 5px; display: inline-block;">✓ REIMBURSED</div>' : 
                                        '<div style="background-color: #fff3cd; color: #856404; padding: 3px 8px; border-radius: 12px; font-size: 11px; margin-top: 5px; display: inline-block;">TAX DEDUCTIBLE</div>'
                                    }
                                </div>
                            </div>
                            
                            <!-- Receipt Photos -->
                            ${receipt.receipts.length > 0 ? `
                                <div style="margin-top: 15px;">
                                    <h4 style="font-size: 14px; color: #666; margin-bottom: 10px;">Receipt Photos:</h4>
                                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                                        ${receipt.receipts.map((receiptImg, index) => `
                                            <div style="border: 1px solid #ddd; border-radius: 6px; overflow: hidden; background-color: #f8f9fa;">
                                                <img src="${receiptImg}" alt="Receipt ${index + 1}" style="width: 100%; height: 200px; object-fit: cover; display: block;" />
                                                <div style="padding: 8px; text-align: center; font-size: 12px; color: #666;">Receipt ${index + 1}</div>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : `
                                <div style="padding: 20px; text-align: center; background-color: #f8f9fa; border-radius: 6px; color: #666;">
                                    <p style="margin: 0; font-style: italic;">No receipt photos uploaded for this expense</p>
                                </div>
                            `}
                        </div>
                    `).join('')}
                </div>
                
                <!-- Summary -->
                <div style="margin-top: 40px; padding: 20px; background-color: #f0f8ff; border-left: 4px solid #4a90e2;">
                    <h3 style="margin: 0 0 15px 0; font-size: 16px;">Receipt Summary</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 14px;">
                        <div>
                            <strong>Total Expenses:</strong> $${data.receipts.reduce((sum, r) => sum + r.amount, 0).toFixed(2)}
                        </div>
                        <div>
                            <strong>Reimbursed Amount:</strong> $${data.receipts.filter(r => r.reimbursed).reduce((sum, r) => sum + r.amount, 0).toFixed(2)}
                        </div>
                        <div>
                            <strong>Tax Deductible:</strong> $${data.receipts.filter(r => !r.reimbursed).reduce((sum, r) => sum + r.amount, 0).toFixed(2)}
                        </div>
                        <div>
                            <strong>Total Receipts:</strong> ${data.receipts.length} items
                        </div>
                    </div>
                </div>
            ` : `
                <div style="text-align: center; padding: 60px 20px; color: #666;">
                    <h3 style="margin-bottom: 15px;">No Expenses Found</h3>
                    <p>No business expenses were recorded for this period.</p>
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
                <p><strong>Estimated Taxes: $${data.estimatedTaxes.toFixed(2)}</strong></p>
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
    </div>
</body>
</html>
  `;
  } catch (error) {
    console.error('❌ Critical error in HTML generation:', error);
    
    // Return bulletproof fallback HTML report
    return generateFallbackReport(safeOptions || options, error);
  }
}

// Helper functions for bulletproof HTML generation
function safeParseFloat(value: any): number {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = parseFloat(String(value));
  return isNaN(parsed) ? 0 : parsed;
}

function escapeHtml(text: string): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function groupMultiDayGigsSafe(gigs: any[]): any[] {
  try {
    return groupMultiDayGigs(gigs);
  } catch (error) {
    console.warn('⚠️ Error grouping multi-day gigs, using individual gigs:', error);
    return Array.isArray(gigs) ? gigs : [];
  }
}

async function prepareReportDataSafe(options: ReportOptions): Promise<ReportData> {
  try {
    return await prepareReportData(options);
  } catch (error) {
    console.error('❌ Error preparing report data:', error);
    // Return fallback data
    const user = await storage.getUser(options.userId);
    return {
      user: user || { email: 'Unknown User', defaultTaxPercentage: 23 } as any,
      gigs: [],
      expenses: [],
      period: 'Report Period',
      totalIncome: 0,
      totalExpenses: 0,
      totalMileage: 0,
      mileageValue: 0,
      netIncome: 0,
      taxPercentage: 23,
      estimatedTaxes: 0,
      afterTaxIncome: 0,
      receipts: []
    };
  }
}

function generateFallbackReport(options: ReportOptions, error: any): string {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Report Generation Issue</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; background: #f8f9fa; }
            .container { background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { text-align: center; margin-bottom: 30px; }
            .error { color: #dc3545; margin: 20px 0; }
            .info { background: #e7f3ff; padding: 20px; border-radius: 5px; margin: 20px 0; }
            .button { background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Report Generation Notice</h1>
                <p>We encountered an issue generating your professional report.</p>
            </div>
            
            <div class="info">
                <h3>What happened?</h3>
                <p>The report generation system experienced a temporary issue. This is typically due to:</p>
                <ul>
                    <li>Database connectivity issues</li>
                    <li>Data processing errors</li>
                    <li>System maintenance</li>
                </ul>
            </div>
            
            <div class="info">
                <h3>What can you do?</h3>
                <ol>
                    <li>Wait a few minutes and try again</li>
                    <li>Refresh the dashboard and generate the report again</li>
                    <li>Check that you have completed gigs for the selected period</li>
                    <li>Contact support if the issue persists</li>
                </ol>
            </div>
            
            <div style="text-align: center; margin-top: 40px;">
                <a href="javascript:window.close()" class="button">Close Window</a>
                <a href="/" class="button" style="margin-left: 10px;">Return to Dashboard</a>
            </div>
            
            ${process.env.NODE_ENV === 'development' ? `
              <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 5px; font-size: 12px;">
                <strong>Debug Info:</strong><br>
                User ID: ${options.userId}<br>
                Period: ${options.period}<br>
                Year: ${options.year}<br>
                Month: ${options.month || 'N/A'}<br>
                Error: ${errorMessage}<br>
                Timestamp: ${new Date().toISOString()}
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
    return sum + (parseInt(String(gig.mileage || 0)) || 0);
  }, 0);

  const MILEAGE_RATE = 0.67;
  const mileageValue = totalMileage * MILEAGE_RATE;
  const netIncome = totalIncome - totalExpenses - mileageValue;
  
  // Calculate tax estimates using same logic as dashboard
  const estimatedTaxes = completedGigs.reduce((sum, gig) => {
    const gigIncome = parseFloat(gig.actualPay || '0') + parseFloat(gig.tips || '0');
    const gigTaxRate = (gig.taxPercentage !== null && gig.taxPercentage !== undefined) 
      ? gig.taxPercentage 
      : (user.defaultTaxPercentage || 23);
    return sum + (gigIncome * gigTaxRate / 100);
  }, 0);
  
  // Use user's default tax percentage for display (individual rates used in calculation)
  const taxPercentage = user.defaultTaxPercentage || 23;
  const afterTaxIncome = netIncome - estimatedTaxes;

  // Prepare receipts data with photos and reimbursement status
  const receipts: ReceiptData[] = [];
  
  completedGigs.forEach(gig => {
    // Add parking expenses (check both expense amount and receipt existence)
    const parkingAmount = parseFloat(gig.parkingExpense || '0');
    const parkingReceipts = Array.isArray((gig as any).parking_receipts) ? (gig as any).parking_receipts : [];
    
    if (parkingAmount > 0 || parkingReceipts.length > 0) {
      receipts.push({
        date: gig.date,
        type: 'parking' as const,
        amount: parkingAmount,
        description: parkingAmount > 0 ? 'Parking expense' : 'Parking receipt (no expense recorded)',
        gigName: gig.eventName || 'Unnamed Event',
        clientName: gig.clientName || 'Direct Client',
        reimbursed: Boolean((gig as any).parking_reimbursed),
        receipts: parkingReceipts
      });
    }
    
    // Add other expenses (check both expense amount and receipt existence)  
    const otherAmount = parseFloat(gig.otherExpenses || '0');
    const otherReceipts = Array.isArray((gig as any).other_expense_receipts) ? (gig as any).other_expense_receipts : [];
    
    // SPECIAL CASE: Check if parking_receipts exist but are stored under "other expenses" category
    const specialParkingReceipts = Array.isArray((gig as any).parking_receipts) ? (gig as any).parking_receipts : [];
    const allOtherReceipts = [...otherReceipts, ...specialParkingReceipts];
    
    if (otherAmount > 0 || allOtherReceipts.length > 0) {
      receipts.push({
        date: gig.date,
        type: 'other' as const,
        amount: otherAmount,
        description: otherAmount > 0 ? 'Other business expense' : 'Business expense receipt',
        gigName: gig.eventName || 'Unnamed Event',
        clientName: gig.clientName || 'Direct Client',
        reimbursed: Boolean((gig as any).other_expenses_reimbursed),
        receipts: allOtherReceipts
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
      // Multi-day gig - Use only first entry's amount (same as dashboard logic)
      grouped.push({
        ...similarGigs[0], // Use first entry data completely
        date: `${similarGigs[0].date} - ${similarGigs[similarGigs.length - 1].date}`
      });
    } else {
      grouped.push(currentGig);
    }
  }
  
  return grouped;
}