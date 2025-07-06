/**
 * Unified tax calculation logic for dashboard and PDF consistency
 */

export interface TaxCalculationGig {
  actualPay: string | null;
  tips: string | null;
  taxPercentage: number | null;
}

export interface TaxCalculationUser {
  defaultTaxPercentage?: number | null;
}

/**
 * Calculate tax for a single gig using gross income
 * Preserves 0% tax rates for under-the-table payments
 */
export function calculateGigTax(
  gig: TaxCalculationGig, 
  user: TaxCalculationUser
): { income: number; taxRate: number; taxAmount: number } {
  const income = parseFloat(gig.actualPay || '0') + parseFloat(gig.tips || '0');
  
  // Only fallback to user default if tax percentage is null/undefined
  const taxRate = (gig.taxPercentage !== null && gig.taxPercentage !== undefined) 
    ? gig.taxPercentage 
    : (user.defaultTaxPercentage || 23);
  
  const taxAmount = income * (taxRate / 100);
  
  return { income, taxRate, taxAmount };
}

/**
 * Calculate total tax estimate for multiple gigs
 */
export function calculateTotalTaxEstimate(
  gigs: TaxCalculationGig[], 
  user: TaxCalculationUser
): number {
  return gigs.reduce((sum, gig) => {
    const { taxAmount } = calculateGigTax(gig, user);
    return sum + taxAmount;
  }, 0);
}