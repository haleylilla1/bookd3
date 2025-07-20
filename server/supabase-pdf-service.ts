/**
 * Supabase-Powered PDF Service - Enterprise Grade Report Generation
 * Eliminates dual PDF generator confusion with single, reliable system
 */

import { createClient } from '@supabase/supabase-js';
import { jsPDF } from 'jspdf';
import { storage } from './storage';
import type { User, Gig, Expense } from '@shared/schema';

interface ReportRequest {
  userId: number;
  period: 'monthly' | 'annual';
  year: number;
  month?: number;
  format: 'professional' | 'simple' | 'mobile';
  language?: 'en' | 'es';
}

interface ReportData {
  user: User;
  gigs: Gig[];
  expenses: Expense[];
  summary: ReportSummary;
  metadata: ReportMetadata;
}

interface ReportSummary {
  totalIncome: number;
  totalExpenses: number;
  totalMileage: number;
  mileageValue: number;
  netIncome: number;
  estimatedTaxes: number;
  afterTaxIncome: number;
  completedGigs: number;
  upcomingGigs: number;
}

interface ReportMetadata {
  period: string;
  generatedAt: string;
  version: string;
  userId: number;
  reportId: string;
}

interface CachedReport {
  id: string;
  user_id: number;
  report_type: string;
  period: string;
  year: number;
  month?: number;
  pdf_url?: string;
  html_content?: string;
  metadata: any;
  created_at: string;
  expires_at: string;
}

export class SupabasePDFService {
  private supabase;
  private readonly MILEAGE_RATE = 0.67; // 2025 IRS rate
  private readonly CACHE_DURATION_HOURS = 24; // Cache reports for 24 hours
  
  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing - please configure environment variables');
    }
    
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Main entry point - generates or retrieves cached report
   */
  async generateReport(request: ReportRequest): Promise<{ 
    success: boolean; 
    data?: Buffer | string; 
    url?: string;
    cached?: boolean;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      console.log('🎯 SUPABASE PDF: Starting report generation', request);
      
      // Check for cached report first
      const cached = await this.getCachedReport(request);
      if (cached && !this.isExpired(cached.expires_at)) {
        console.log('⚡ SUPABASE PDF: Using cached report');
        
        // Log cache hit
        await this.logGenerationAttempt({
          userId: request.userId,
          reportType: request.format,
          period: request.period,
          year: request.year,
          month: request.month,
          generationStatus: 'cached',
          generationTimeMs: Date.now() - startTime,
          cachedUsed: true,
          requestMetadata: request,
          systemMetadata: {
            cacheHit: true,
            cachedAt: cached.created_at,
            expiresAt: cached.expires_at
          }
        });
        
        if (cached.pdf_url) {
          return { success: true, url: cached.pdf_url, cached: true };
        } else if (cached.html_content) {
          return { success: true, data: cached.html_content, cached: true };
        }
      }
      
      // Generate fresh report
      const reportData = await this.prepareReportData(request);
      
      let result;
      if (request.format === 'mobile' || this.isMobileUserAgent()) {
        result = await this.generateHTMLReport(request, reportData);
      } else {
        result = await this.generatePDFReport(request, reportData);
      }

      // Log generation attempt
      if (result.success) {
        await this.logGenerationAttempt({
          userId: request.userId,
          reportType: request.format,
          period: request.period,
          year: request.year,
          month: request.month,
          generationStatus: 'success',
          generationTimeMs: Date.now() - startTime,
          fileSizeBytes: result.data ? (typeof result.data === 'string' ? result.data.length : result.data.length) : undefined,
          requestMetadata: request,
          systemMetadata: {
            hasUrl: !!result.url,
            hasData: !!result.data,
            dataType: typeof result.data,
            generationType: request.format === 'mobile' ? 'HTML' : 'PDF'
          }
        });
      } else {
        await this.logGenerationAttempt({
          userId: request.userId,
          reportType: request.format,
          period: request.period,
          year: request.year,
          month: request.month,
          generationStatus: 'failed',
          errorMessage: result.error,
          generationTimeMs: Date.now() - startTime,
          requestMetadata: request
        });
      }

      return result;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('🚨 SUPABASE PDF: Generation failed', error);
      
      // Log critical failure
      await this.logGenerationAttempt({
        userId: request.userId,
        reportType: request.format,
        period: request.period,
        year: request.year,
        month: request.month,
        generationStatus: 'failed',
        errorMessage,
        generationTimeMs: Date.now() - startTime,
        requestMetadata: request,
        systemMetadata: {
          errorType: error instanceof Error ? error.constructor.name : 'Unknown',
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Bulletproof PDF generation with Supabase storage
   */
  private async generatePDFReport(request: ReportRequest, data: ReportData): Promise<{
    success: boolean;
    data?: Buffer;
    url?: string;
    error?: string;
  }> {
    try {
      console.log('📄 SUPABASE PDF: Generating PDF document');
      
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        putOnlyUsedFonts: true,
        floatPrecision: 2
      });

      // Generate PDF content based on format
      if (request.format === 'professional') {
        await this.addProfessionalContent(doc, data);
      } else {
        await this.addSimpleContent(doc, data);
      }

      // Generate PDF buffer
      const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
      
      // Upload to Supabase Storage
      const fileName = this.generateFileName(request, 'pdf');
      const uploadResult = await this.uploadToSupabase(fileName, pdfBuffer, 'application/pdf');
      
      if (uploadResult.success && uploadResult.url) {
        // Cache the report metadata
        await this.cacheReport(request, data.metadata, uploadResult.url, null);
        
        console.log('✅ SUPABASE PDF: Generated and uploaded successfully');
        return {
          success: true,
          data: pdfBuffer,
          url: uploadResult.url
        };
      } else {
        throw new Error('Failed to upload PDF to Supabase Storage');
      }
      
    } catch (error) {
      console.error('🚨 SUPABASE PDF: PDF generation failed', error);
      // Fallback to HTML
      return await this.generateHTMLReport(request, data);
    }
  }

  /**
   * HTML report generation with Supabase caching
   */
  private async generateHTMLReport(request: ReportRequest, data: ReportData): Promise<{
    success: boolean;
    data?: string;
    error?: string;
  }> {
    try {
      console.log('🌐 SUPABASE PDF: Generating HTML report');
      
      const htmlContent = this.generateHTMLContent(data, request.format);
      
      // Cache the HTML report
      await this.cacheReport(request, data.metadata, null, htmlContent);
      
      console.log('✅ SUPABASE PDF: HTML report generated and cached');
      return {
        success: true,
        data: htmlContent
      };
      
    } catch (error) {
      console.error('🚨 SUPABASE PDF: HTML generation failed', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'HTML generation failed'
      };
    }
  }

  /**
   * Professional PDF content generation
   */
  private async addProfessionalContent(doc: jsPDF, data: ReportData): Promise<void> {
    let currentY = 20;
    
    // Cover Page
    doc.setFontSize(24);
    doc.text('Professional Income Report', 20, currentY);
    currentY += 15;
    
    doc.setFontSize(16);
    doc.text(`${data.metadata.period}`, 20, currentY);
    currentY += 10;
    
    doc.setFontSize(12);
    doc.text(`Generated for: ${data.user.email}`, 20, currentY);
    currentY += 5;
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, currentY);
    
    // New Page - Income Summary
    doc.addPage();
    currentY = 20;
    
    doc.setFontSize(18);
    doc.text('Income Summary', 20, currentY);
    currentY += 15;
    
    doc.setFontSize(12);
    doc.text(`Total Income: $${data.summary.totalIncome.toFixed(2)}`, 20, currentY);
    currentY += 7;
    doc.text(`Total Expenses: $${data.summary.totalExpenses.toFixed(2)}`, 20, currentY);
    currentY += 7;
    doc.text(`Net Income: $${data.summary.netIncome.toFixed(2)}`, 20, currentY);
    currentY += 7;
    doc.text(`Estimated Taxes: $${data.summary.estimatedTaxes.toFixed(2)}`, 20, currentY);
    currentY += 7;
    doc.text(`After-Tax Income: $${data.summary.afterTaxIncome.toFixed(2)}`, 20, currentY);
    
    // Gig Details
    if (data.gigs.length > 0) {
      currentY += 20;
      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }
      
      doc.setFontSize(16);
      doc.text('Gig Details', 20, currentY);
      currentY += 10;
      
      doc.setFontSize(10);
      data.gigs.slice(0, 15).forEach(gig => {
        if (currentY > 270) {
          doc.addPage();
          currentY = 20;
        }
        
        const gigDate = new Date(gig.date).toLocaleDateString();
        const amount = parseFloat(String(gig.actualPay || gig.expectedPay || 0));
        doc.text(`${gigDate} - ${gig.clientName} - $${amount.toFixed(2)}`, 20, currentY);
        currentY += 5;
      });
    }
  }

  /**
   * Simple PDF content generation
   */
  private async addSimpleContent(doc: jsPDF, data: ReportData): Promise<void> {
    let currentY = 20;
    
    doc.setFontSize(20);
    doc.text('Income Report', 20, currentY);
    currentY += 15;
    
    doc.setFontSize(14);
    doc.text(`${data.metadata.period}`, 20, currentY);
    currentY += 15;
    
    doc.setFontSize(12);
    doc.text(`Total Income: $${data.summary.totalIncome.toFixed(2)}`, 20, currentY);
    currentY += 8;
    doc.text(`Total Expenses: $${data.summary.totalExpenses.toFixed(2)}`, 20, currentY);
    currentY += 8;
    doc.text(`Net Income: $${data.summary.netIncome.toFixed(2)}`, 20, currentY);
    currentY += 8;
    doc.text(`Completed Gigs: ${data.summary.completedGigs}`, 20, currentY);
    currentY += 8;
    doc.text(`Total Mileage: ${data.summary.totalMileage.toFixed(1)} miles`, 20, currentY);
  }

  /**
   * Comprehensive HTML content generation using professional generator logic
   */
  private async generateHTMLContent(data: ReportData, format: string): Promise<string> {
    const isProfessional = format === 'professional';
    
    // Prepare comprehensive report data like professional generators
    const user = data.user || {};
    const gigs = Array.isArray(data.gigs) ? data.gigs : [];
    const completedGigs = gigs.filter(g => g && (g.status === 'completed' || parseFloat(String(g.actualPay || 0)) > 0));
    
    // Group multi-day gigs for correct calculations
    const groupedGigs = this.groupMultiDayGigs(completedGigs);
    
    // Calculate comprehensive totals
    const totalIncome = groupedGigs.reduce((sum, gig) => {
      const actualPay = parseFloat(String(gig.actualPay || gig.expectedPay || 0));
      const tips = parseFloat(String(gig.tips || 0));
      return sum + actualPay + tips;
    }, 0);
    
    const totalMileage = gigs.reduce((sum, gig) => sum + (parseFloat(String(gig.mileage || 0))), 0);
    const mileageValue = totalMileage * this.MILEAGE_RATE;
    
    // Get expense data
    const expenses = await this.getExpenseData(data.user?.id || 0, data);
    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    
    const netIncome = totalIncome - totalExpenses - mileageValue;
    
    // Calculate individual gig taxes
    const estimatedTaxes = groupedGigs.reduce((sum, gig) => {
      const gigIncome = parseFloat(String(gig.actualPay || gig.expectedPay || 0)) + parseFloat(String(gig.tips || 0));
      const gigTaxRate = parseFloat(String(gig.taxPercentage || data.user?.defaultTaxPercentage || 0));
      return sum + (gigIncome * (gigTaxRate / 100));
    }, 0);
    
    // Generate tax breakdown HTML
    const taxEstimatesRows = groupedGigs.map(gig => {
      const gigIncome = parseFloat(String(gig.actualPay || gig.expectedPay || 0)) + parseFloat(String(gig.tips || 0));
      const gigTaxRate = parseFloat(String(gig.taxPercentage || data.user?.defaultTaxPercentage || 0));
      const gigTaxes = gigIncome * (gigTaxRate / 100);
      const eventName = String(gig.eventName || 'Unnamed Event').substring(0, 25);
      
      return `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e9ecef;">${eventName}</td>
          <td style="padding: 12px; text-align: right; border-bottom: 1px solid #e9ecef;">$${gigIncome.toFixed(2)}</td>
          <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e9ecef;">${gigTaxRate.toFixed(0)}%</td>
          <td style="padding: 12px; text-align: right; border-bottom: 1px solid #e9ecef;">$${gigTaxes.toFixed(2)}</td>
        </tr>
      `;
    }).join('');
    
    const period = data.metadata?.period || 'Report Period';
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Freelancer Income Report - ${period}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: #f8f9fa;
        }
        .page {
            background: white;
            border-radius: 8px;
            padding: 40px;
            margin-bottom: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            page-break-after: always;
        }
        .page:last-child { page-break-after: auto; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e9ecef; }
        th { background: #f8f9fa; font-weight: 600; color: #495057; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .highlight { color: #27ae60; font-weight: bold; }
        .tax-highlight { color: #e74c3c; font-weight: bold; }
        .total-row { background: #e8f4f8; font-weight: bold; border-top: 2px solid #333; }
        @media print {
            body { background: white; }
            .page { box-shadow: none; margin-bottom: 0; }
        }
    </style>
</head>
<body>
    <!-- Cover Page -->
    <div class="page">
        <div style="text-align: center;">
            <h1 style="font-size: 32px; margin-bottom: 30px;">FREELANCER INCOME REPORT</h1>
            <h2 style="font-size: 24px; margin: 20px 0;">${(user.firstName || '') + ' ' + (user.lastName || '') || 'Freelancer'}</h2>
            <h3 style="font-size: 20px; margin: 20px 0;">${period}</h3>
            <p style="font-size: 16px; margin: 20px 0;">Generated: ${new Date().toLocaleDateString()}</p>
            ${user.email ? `<p style="font-size: 16px; margin: 20px 0;">Contact: ${user.email}</p>` : ''}
            
            <!-- Executive Summary Box -->
            <div style="margin-top: 40px; border: 2px solid #333; border-radius: 8px; padding: 30px; text-align: left;">
                <h3 style="text-align: center; margin-bottom: 20px;">EXECUTIVE SUMMARY</h3>
                <p><strong>Total Gigs Completed:</strong> ${groupedGigs.length}</p>
                <p><strong>Gross Income:</strong> $${totalIncome.toFixed(2)}</p>
                <p><strong>Business Expenses:</strong> $${(totalExpenses + mileageValue).toFixed(2)}</p>
                <p><strong>Net Income:</strong> $${netIncome.toFixed(2)}</p>
                <p><strong>Estimated Taxes:</strong> $${estimatedTaxes.toFixed(2)}</p>
                <p><strong>After-Tax Income:</strong> $${(netIncome - estimatedTaxes).toFixed(2)}</p>
            </div>
        </div>
    </div>

    <!-- Income Summary Page -->
    <div class="page">
        <h2 style="font-size: 24px; margin-bottom: 30px; text-align: center;">INCOME SUMMARY</h2>
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Source</th>
                    <th>Type</th>
                    <th class="text-right">Amount</th>
                </tr>
            </thead>
            <tbody>
                ${groupedGigs.map(gig => {
                  const actualPay = parseFloat(String(gig.actualPay || gig.expectedPay || 0));
                  const tips = parseFloat(String(gig.tips || 0));
                  const total = actualPay + tips;
                  const dateStr = String(gig.date).includes(' - ') ? gig.date : new Date(gig.date).toLocaleDateString();
                  const source = gig.clientName || 'Direct Client';
                  const type = gig.gigType || 'Service';
                  
                  return `
                    <tr>
                        <td>${dateStr}</td>
                        <td>${source}</td>
                        <td>${type}</td>
                        <td class="text-right">$${total.toFixed(2)}</td>
                    </tr>
                  `;
                }).join('')}
                <tr class="total-row">
                    <td colspan="3"><strong>TOTAL INCOME</strong></td>
                    <td class="text-right"><strong>$${totalIncome.toFixed(2)}</strong></td>
                </tr>
            </tbody>
        </table>
    </div>

    <!-- Detailed Tax Estimates by Gig Page -->
    <div class="page">
        <h2 style="font-size: 24px; margin-bottom: 30px; text-align: center;">DETAILED TAX ESTIMATES BY GIG</h2>
        <table>
            <thead>
                <tr>
                    <th>Gig</th>
                    <th class="text-right">Income</th>
                    <th class="text-center">Tax Rate</th>
                    <th class="text-right">Tax Estimate</th>
                </tr>
            </thead>
            <tbody>
                ${taxEstimatesRows}
                <tr class="total-row">
                    <td><strong>TOTAL</strong></td>
                    <td class="text-right"><strong>$${totalIncome.toFixed(2)}</strong></td>
                    <td class="text-center">-</td>
                    <td class="text-right tax-highlight"><strong>$${estimatedTaxes.toFixed(2)}</strong></td>
                </tr>
            </tbody>
        </table>
        
        <div style="margin: 30px 0; padding: 20px; background-color: #f0f8ff; border-left: 4px solid #4a90e2;">
            <p><strong>Calculation Method:</strong> For each gig, taxes are calculated using the gig's individual tax rate applied to gross income. 
            Income includes actual pay and tips. These are taxes on gross income before business expense deductions.</p>
        </div>

        <!-- Tax Due Dates -->
        <div style="margin-top: 40px;">
            <h3>2025 TAX PAYMENT DUE DATES:</h3>
            <ul style="list-style-type: disc; margin-left: 30px;">
                <li>Q1 2025: April 15, 2025</li>
                <li>Q2 2025: June 16, 2025</li>
                <li>Q3 2025: September 15, 2025</li>
                <li>Q4 2025: January 15, 2026</li>
            </ul>
        </div>
    </div>

    <!-- Mileage Summary Page -->
    <div class="page">
        <h2 style="font-size: 24px; margin-bottom: 30px; text-align: center;">MILEAGE SUMMARY</h2>
        <p style="margin-bottom: 20px;">Business mileage calculated at IRS standard rate of $${this.MILEAGE_RATE}/mile for ${new Date().getFullYear()}.</p>
        
        ${gigs.some(g => parseFloat(String(g.mileage || 0)) > 0) ? `
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Purpose</th>
                    <th class="text-right">Miles</th>
                    <th class="text-right">Value</th>
                </tr>
            </thead>
            <tbody>
                ${gigs.filter(g => parseFloat(String(g.mileage || 0)) > 0).map(gig => {
                  const miles = parseFloat(String(gig.mileage || 0));
                  const dateStr = String(gig.date).includes(' - ') ? gig.date : new Date(gig.date).toLocaleDateString();
                  const purpose = gig.eventName + ' (' + gig.clientName + ')';
                  const value = miles * this.MILEAGE_RATE;
                  
                  return `
                    <tr>
                        <td>${dateStr}</td>
                        <td>${purpose}</td>
                        <td class="text-right">${Math.round(miles)}</td>
                        <td class="text-right">$${value.toFixed(2)}</td>
                    </tr>
                  `;
                }).join('')}
                <tr class="total-row">
                    <td colspan="2"><strong>TOTAL MILEAGE</strong></td>
                    <td class="text-right"><strong>${Math.round(totalMileage)} miles</strong></td>
                    <td class="text-right"><strong>$${mileageValue.toFixed(2)}</strong></td>
                </tr>
            </tbody>
        </table>
        ` : `
        <div style="text-align: center; margin: 40px 0;">
            <p>No mileage recorded for this period.</p>
        </div>
        `}
    </div>

    <!-- Business Expenses & Receipts Page -->
    <div class="page">
        <h2 style="font-size: 24px; margin-bottom: 30px; text-align: center;">BUSINESS EXPENSES & RECEIPTS</h2>
        
        <div style="text-align: center; padding: 60px 20px; color: #666;">
            <h3>No Expenses Found</h3>
            <p>No business expenses were recorded for this period.</p>
        </div>
    </div>

    <!-- Summary Totals Page -->
    <div class="page">
        <h2 style="font-size: 24px; margin-bottom: 30px; text-align: center;">SUMMARY TOTALS</h2>
        
        <div style="font-size: 18px; line-height: 2;">
            <p><strong>Total Income: $${totalIncome.toFixed(2)}</strong></p>
            <p><strong>Total Expenses: $${totalExpenses.toFixed(2)}</strong></p>
            <p><strong>Total Mileage: ${Math.round(totalMileage)} miles</strong></p>
            <p><strong>Mileage Value: $${mileageValue.toFixed(2)}</strong></p>
            <p><strong>Net Income: $${netIncome.toFixed(2)}</strong></p>
            <p><strong>Estimated Taxes: $${estimatedTaxes.toFixed(2)}</strong></p>
            <p><strong>After-Tax Income: $${(netIncome - estimatedTaxes).toFixed(2)}</strong></p>
        </div>
        
        <div style="margin-top: 40px; padding: 20px; background-color: #f0f8ff; border-left: 4px solid #4a90e2;">
            <p style="font-style: italic;">This report is generated for tax preparation purposes. Please consult with a tax professional for filing requirements.</p>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Data preparation with multi-day gig handling
   */
  private async prepareReportData(request: ReportRequest): Promise<ReportData> {
    console.log('📊 SUPABASE PDF: Preparing report data');
    
    const user = await storage.getUser(request.userId);
    if (!user) throw new Error('User not found');

    // Calculate date range
    let startDate: Date, endDate: Date;
    if (request.period === 'monthly' && request.month) {
      startDate = new Date(request.year, request.month - 1, 1);
      endDate = new Date(request.year, request.month, 0);
    } else {
      startDate = new Date(request.year, 0, 1);
      endDate = new Date(request.year, 11, 31);
    }

    // Get data using existing storage methods
    const allGigs = await storage.getGigsByDateRange(
      request.userId,
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    // Apply multi-day gig grouping logic (same as dashboard)
    const groupedGigs = this.groupMultiDayGigs(allGigs);
    const expenses = []; // TODO: Add expense support when needed

    // Calculate summary
    const summary = this.calculateSummary(groupedGigs, expenses, user);
    
    const metadata: ReportMetadata = {
      period: request.period === 'monthly' ? 
        `${this.getMonthName(request.month || 1)} ${request.year}` : 
        `Year ${request.year}`,
      reportId: `${request.userId}-${request.period}-${request.year}-${request.month || 'annual'}`,
      generatedAt: new Date().toISOString(),
      userId: request.userId,
      totalGigs: groupedGigs.length,
      dateRange: { start: startDate.toISOString(), end: endDate.toISOString() }
    };

    return {
      user,
      gigs: groupedGigs,
      expenses,
      summary,
      metadata
    };
  }

  /**
   * Group multi-day gigs to prevent double counting
   */
  private groupMultiDayGigs(gigs: any[]): any[] {
    const groups = new Map();
    const result: any[] = [];
    
    for (const gig of gigs) {
      const gigId = gig.multiDayId || gig.id;
      const gigKey = `${gigId}-${gig.eventName}-${gig.clientName}`;
      
      if (groups.has(gigKey)) {
        const existing = groups.get(gigKey);
        existing.endDate = gig.date;
        existing.date = `${existing.startDate} - ${gig.date}`;
      } else {
        const groupedGig = { ...gig };
        groupedGig.startDate = gig.date;
        groupedGig.endDate = gig.date;
        groups.set(gigKey, groupedGig);
        result.push(groupedGig);
      }
    }
    
    return result;
  }

  /**
   * Calculate comprehensive summary statistics
   */
  private calculateSummary(gigs: any[], expenses: any[], user: any): any {
    const totalIncome = gigs.reduce((sum, gig) => {
      const actualPay = parseFloat(String(gig.actualPay || gig.expectedPay || 0));
      const tips = parseFloat(String(gig.tips || 0));
      return sum + actualPay + tips;
    }, 0);

    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const totalMileage = gigs.reduce((sum, gig) => sum + parseFloat(String(gig.mileage || 0)), 0);
    const mileageValue = totalMileage * this.MILEAGE_RATE;
    const netIncome = totalIncome - totalExpenses - mileageValue;

    const estimatedTaxes = gigs.reduce((sum, gig) => {
      const gigIncome = parseFloat(String(gig.actualPay || gig.expectedPay || 0)) + parseFloat(String(gig.tips || 0));
      const taxRate = parseFloat(String(gig.taxPercentage || user?.defaultTaxPercentage || 0));
      return sum + (gigIncome * (taxRate / 100));
    }, 0);

    return {
      totalIncome,
      totalExpenses,
      totalMileage,
      mileageValue,
      netIncome,
      estimatedTaxes,
      afterTaxIncome: netIncome - estimatedTaxes,
      completedGigs: gigs.length,
      avgGigIncome: gigs.length > 0 ? totalIncome / gigs.length : 0
    };
  }

  /**
   * Get expense data (placeholder for future implementation)
   */
  private async getExpenseData(userId: number, data: any): Promise<any[]> {
    // For now, return empty array - can be enhanced when expense tracking is added
    return [];
  }

  /**
   * Get month name from number
   */
  private getMonthName(month: number): string {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1] || 'Unknown';
  }

  /**
   * Check if user agent is mobile
   */
  private isMobileUserAgent(): boolean {
    // Simple mobile detection - can be enhanced
    return false; // Default to desktop for now
  }

  /**
   * Summary calculations
   */
  private calculateSummary(gigs: Gig[], expenses: Expense[], user: User): ReportSummary {
    const completedGigs = gigs.filter(g => g.status === 'completed' || g.status === 'pending payment');
    const upcomingGigs = gigs.filter(g => g.status === 'upcoming' || g.status === 'confirmed');
    
    const totalIncome = completedGigs.reduce((sum, gig) => {
      const amount = parseFloat(String(gig.actualPay || gig.expectedPay || 0));
      return sum + amount;
    }, 0);

    const totalExpenses = expenses.reduce((sum, expense) => {
      return sum + parseFloat(String(expense.amount || 0));
    }, 0);

    const totalMileage = completedGigs.reduce((sum, gig) => {
      return sum + parseFloat(String(gig.mileage || 0));
    }, 0);

    const mileageValue = totalMileage * this.MILEAGE_RATE;
    const netIncome = totalIncome - totalExpenses - mileageValue;
    
    const userTaxRate = parseFloat(String(user.defaultTaxPercentage || 0)) / 100;
    const estimatedTaxes = totalIncome * userTaxRate;
    const afterTaxIncome = netIncome - estimatedTaxes;

    return {
      totalIncome,
      totalExpenses,
      totalMileage,
      mileageValue,
      netIncome,
      estimatedTaxes,
      afterTaxIncome,
      completedGigs: completedGigs.length,
      upcomingGigs: upcomingGigs.length
    };
  }

  /**
   * Supabase Storage integration with audit logging
   */
  private async uploadToSupabase(fileName: string, data: Buffer, contentType: string): Promise<{
    success: boolean;
    url?: string;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      console.log('📤 SUPABASE UPLOAD: Starting upload', { fileName, size: data.length, contentType });
      
      const { data: uploadData, error } = await this.supabase.storage
        .from('reports')
        .upload(`reports/${fileName}`, data, {
          contentType,
          cacheControl: '86400', // 24 hours cache
          upsert: true
        });

      if (error) throw error;

      const { data: urlData } = this.supabase.storage
        .from('reports')
        .getPublicUrl(`reports/${fileName}`);

      const uploadTime = Date.now() - startTime;
      console.log('✅ SUPABASE UPLOAD: Success', { 
        fileName, 
        url: urlData.publicUrl,
        uploadTime: `${uploadTime}ms`,
        size: `${(data.length / 1024).toFixed(1)}KB`
      });

      // Log successful upload
      await this.logGenerationAttempt({
        userId: -1, // Will be set by caller
        reportType: 'upload',
        period: 'system',
        year: new Date().getFullYear(),
        generationStatus: 'success',
        generationTimeMs: uploadTime,
        fileSizeBytes: data.length,
        systemMetadata: {
          fileName,
          publicUrl: urlData.publicUrl,
          contentType,
          uploadDuration: uploadTime
        }
      });

      return {
        success: true,
        url: urlData.publicUrl
      };
    } catch (error) {
      const uploadTime = Date.now() - startTime;
      console.error('🚨 SUPABASE UPLOAD: Failed', { fileName, error, uploadTime: `${uploadTime}ms` });
      
      // Log failed upload
      await this.logGenerationAttempt({
        userId: -1,
        reportType: 'upload',
        period: 'system', 
        year: new Date().getFullYear(),
        generationStatus: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Upload failed',
        generationTimeMs: uploadTime,
        systemMetadata: {
          fileName,
          errorType: error instanceof Error ? error.constructor.name : 'Unknown',
          uploadDuration: uploadTime
        }
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }

  /**
   * Comprehensive audit logging for all generation attempts
   */
  private async logGenerationAttempt(logData: {
    userId: number;
    reportType: string;
    period: string;
    year: number;
    month?: number;
    generationStatus: 'success' | 'failed' | 'cached';
    errorMessage?: string;
    generationTimeMs?: number;
    fileSizeBytes?: number;
    cachedUsed?: boolean;
    requestMetadata?: any;
    systemMetadata?: any;
  }): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('report_generation_log')
        .insert({
          user_id: logData.userId,
          report_type: logData.reportType,
          period: logData.period,
          year: logData.year,
          month: logData.month,
          generation_status: logData.generationStatus,
          error_message: logData.errorMessage,
          generation_time_ms: logData.generationTimeMs,
          file_size_bytes: logData.fileSizeBytes,
          cached_used: logData.cachedUsed || false,
          request_metadata: logData.requestMetadata || {},
          system_metadata: logData.systemMetadata || {}
        });

      if (error) {
        console.error('⚠️ AUDIT LOG: Failed to log generation attempt', error);
      } else {
        console.log('📊 AUDIT LOG: Generation attempt logged', {
          user: logData.userId,
          type: logData.reportType,
          status: logData.generationStatus,
          time: logData.generationTimeMs ? `${logData.generationTimeMs}ms` : 'N/A'
        });
      }
    } catch (error) {
      console.error('🚨 AUDIT LOG: Critical logging failure', error);
    }
  }

  /**
   * Report caching in Supabase
   */
  private async cacheReport(
    request: ReportRequest, 
    metadata: ReportMetadata, 
    pdfUrl: string | null, 
    htmlContent: string | null
  ): Promise<void> {
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.CACHE_DURATION_HOURS);

      const { error } = await this.supabase
        .from('cached_reports')
        .upsert({
          id: metadata.reportId,
          user_id: request.userId,
          report_type: request.format,
          period: request.period,
          year: request.year,
          month: request.month,
          pdf_url: pdfUrl,
          html_content: htmlContent,
          metadata: metadata,
          expires_at: expiresAt.toISOString()
        });

      if (error) {
        console.error('⚠️ SUPABASE PDF: Cache save failed', error);
      } else {
        console.log('💾 SUPABASE PDF: Report cached successfully');
      }
    } catch (error) {
      console.error('🚨 SUPABASE PDF: Cache error', error);
    }
  }

  private async getCachedReport(request: ReportRequest): Promise<CachedReport | null> {
    try {
      const reportId = this.generateReportId(request);
      
      const { data, error } = await this.supabase
        .from('cached_reports')
        .select('*')
        .eq('id', reportId)
        .single();

      if (error || !data) return null;
      
      return data as CachedReport;
    } catch (error) {
      console.error('🚨 SUPABASE PDF: Cache retrieval failed', error);
      return null;
    }
  }

  /**
   * Utility methods
   */
  private generateReportId(request: ReportRequest): string {
    const base = `${request.userId}-${request.period}-${request.year}`;
    const monthPart = request.month ? `-${request.month}` : '';
    const formatPart = `-${request.format}`;
    return `${base}${monthPart}${formatPart}`;
  }

  private generateFileName(request: ReportRequest, extension: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const userPrefix = `user-${request.userId}`;
    const periodPrefix = request.period === 'monthly' && request.month 
      ? `${request.year}-${String(request.month).padStart(2, '0')}`
      : `${request.year}`;
    const formatSuffix = request.format === 'professional' ? 'pro' : request.format;
    
    return `${userPrefix}_${periodPrefix}_${formatSuffix}_${timestamp}.${extension}`;
  }

  private isExpired(expiresAt: string): boolean {
    return new Date(expiresAt) < new Date();
  }

  private isMobileUserAgent(): boolean {
    // This would typically check req.headers['user-agent'] but we'll handle it in the route
    return false;
  }

  /**
   * Cleanup expired reports
   */
  async cleanupExpiredReports(): Promise<{ cleaned: number; errors: number }> {
    try {
      const { data, error } = await this.supabase
        .from('cached_reports')
        .delete()
        .lt('expires_at', new Date().toISOString());

      if (error) throw error;

      const cleaned = Array.isArray(data) ? data.length : 0;
      console.log(`🧹 SUPABASE PDF: Cleaned ${cleaned} expired reports`);
      
      return { cleaned, errors: 0 };
    } catch (error) {
      console.error('🚨 SUPABASE PDF: Cleanup failed', error);
      return { cleaned: 0, errors: 1 };
    }
  }
}

// Export singleton instance
export const supabasePDFService = new SupabasePDFService();