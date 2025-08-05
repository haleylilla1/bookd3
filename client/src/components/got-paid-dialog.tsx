import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Calculator, Receipt, CheckCircle, ArrowRight, ArrowLeft, Plus, X, Navigation, MapPin, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { apiRequest } from "@/lib/queryClient";
import type { Gig } from "@shared/schema";

interface GotPaidDialogProps {
  gig: Gig;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: GotPaidData) => Promise<void>;
}

export interface GotPaidData {
  totalReceived: number;
  mileage: number;
  parkingSpent: number;
  parkingReimbursed: number;
  paymentMethod?: string;
  taxPercentage: number;
}

export default function GotPaidDialog({ gig, isOpen, onClose, onSave }: GotPaidDialogProps) {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  
  // Mileage calculation state
  const [startingAddress, setStartingAddress] = useState("");
  const [endingAddress, setEndingAddress] = useState("");
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [isPerDay, setIsPerDay] = useState(false);
  const [isCalculatingMileage, setIsCalculatingMileage] = useState(false);
  const [mileageError, setMileageError] = useState<string | null>(null);

  // Handle iOS dialog behavior
  React.useEffect(() => {
    if (isOpen) {
      // Import and use iOS fixes dynamically to avoid SSR issues
      import("../lib/ios-fixes").then(({ IOSMobileFixes }) => {
        IOSMobileFixes.handleDialogOpen();
      });
    } else {
      import("../lib/ios-fixes").then(({ IOSMobileFixes }) => {
        IOSMobileFixes.handleDialogClose();
      });
    }
  }, [isOpen]);

  // Fetch user data for default tax percentage
  React.useEffect(() => {
    if (isOpen) {
      fetch('/api/user')
        .then(res => res.json())
        .then(userData => setUser(userData))
        .catch(err => console.error('Error fetching user:', err));
    }
  }, [isOpen]);

  const [formData, setFormData] = useState<GotPaidData>({
    totalReceived: parseFloat(gig.expectedPay || "0"),
    mileage: gig.mileage || 0,
    parkingSpent: parseFloat(gig.parkingExpense || "0"),
    parkingReimbursed: gig.parkingReimbursed ? parseFloat(gig.parkingExpense || "0") : 0,
    paymentMethod: gig.paymentMethod || "",
    taxPercentage: gig.taxPercentage || 25,
  });

  // Update tax percentage and addresses when user data loads
  React.useEffect(() => {
    if (user?.defaultTaxPercentage && !gig.taxPercentage) {
      setFormData(prev => ({ ...prev, taxPercentage: user.defaultTaxPercentage }));
    }
    if (user?.homeAddress) {
      setStartingAddress(user.homeAddress);
    }
    if (gig.gigAddress) {
      setEndingAddress(gig.gigAddress);
    }
  }, [user, gig.taxPercentage, gig.gigAddress]);

  // Calculate mileage using Google Maps API
  const calculateMileage = async () => {
    if (!startingAddress || !endingAddress) return;

    setIsCalculatingMileage(true);
    setMileageError(null);

    try {
      const response = await apiRequest('POST', '/api/calculate-distance', {
        startAddress: startingAddress,
        endAddress: endingAddress,
        roundTrip: isRoundTrip
      });

      const data = await response.json();
      
      if (data.status === 'success' && data.distanceMiles) {
        let miles = Math.ceil(data.distanceMiles); // Round up for tax purposes
        
        // For multi-day gigs, multiply by number of days (already accounting for roundtrip)
        if (gig.isMultiDay && isPerDay) {
          const dayCount = calculateDayCount();
          miles = miles * dayCount;
        }
        
        setFormData(prev => ({ ...prev, mileage: miles }));
        setMileageError(null);
      } else {
        setMileageError(data.error || "Unable to calculate distance");
      }
    } catch (error) {
      setMileageError("Failed to calculate mileage. Please enter manually.");
    } finally {
      setIsCalculatingMileage(false);
    }
  };

  // Calculate number of days for multi-day gigs
  const calculateDayCount = () => {
    if (!gig.isMultiDay || !gig.startDate || !gig.endDate) return 1;
    
    const start = new Date(gig.startDate + 'T00:00:00');
    const end = new Date(gig.endDate + 'T00:00:00');
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end dates
    
    return Math.max(1, diffDays);
  };

  // Simplified tax calculations - separate taxable income from business deductions
  const mileageDeduction = formData.mileage * 0.655; // 2024 IRS standard mileage rate
  const calculations = {
    taxableIncome: formData.totalReceived - formData.parkingReimbursed,
    businessDeductions: (formData.parkingSpent - formData.parkingReimbursed) + mileageDeduction,
    mileageDeduction
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await onSave(formData);
      onClose();
      setStep(1);
    } catch (error) {
      console.error("Error saving got paid data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const nextStep = () => setStep(prev => Math.min(prev + 1, 5));
  const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

  const stepTitles = [
    "Total Payment",
    "Mileage Tracking", 
    "Parking Expenses",
    "Tax Rate & Payment",
    "Review & Confirm"
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Got Paid: {gig.eventName}
          </DialogTitle>
          <DialogDescription>
            Step {step} of 5: {stepTitles[step - 1]}
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="flex gap-2 mb-6 flex-shrink-0">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`flex-1 h-2 rounded ${
                i + 1 <= step ? "bg-green-500" : "bg-gray-200"
              }`}
            />
          ))}
        </div>

        {/* Content area */}
        <div className="space-y-4 pb-24">

        {/* Step 1: Total Payment */}
        {step === 1 && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">How much did you receive total?</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-sm text-gray-600">
                    Expected pay: {formatCurrency(parseFloat(gig.expectedPay || "0"))}
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.totalReceived}
                    onChange={(e) => setFormData({ ...formData, totalReceived: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    className="text-lg"
                  />
                  <p className="text-sm text-gray-500">
                    Enter the total amount you received from the client, including any reimbursements.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 2: Mileage Tracking */}
        {step === 2 && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Navigation className="w-5 h-5" />
                  Mileage Tracking
                </CardTitle>
                <p className="text-sm text-gray-600">
                  Calculate miles driven for tax deductions ({formatCurrency(formData.mileage * 0.655)} at $0.655/mile)
                  {gig.isMultiDay && <span className="block mt-1 text-xs text-blue-600">Multi-day gig: Select "Calculate for each day" to multiply by {calculateDayCount()} days</span>}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Address inputs */}
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Starting address</label>
                    <AddressAutocomplete
                      label=""
                      value={startingAddress}
                      onChange={setStartingAddress}
                      placeholder="Enter starting address"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Destination address</label>
                    <AddressAutocomplete
                      label=""
                      value={endingAddress}
                      onChange={setEndingAddress}
                      placeholder="Enter gig location"
                    />
                  </div>
                </div>

                {/* Trip options */}
                <div className="space-y-4 bg-gray-50 p-4 rounded-lg border">
                  <h4 className="font-medium text-sm text-gray-700">Trip Options</h4>
                  
                  <div className="flex items-start space-x-3 p-3 border-2 border-gray-200 rounded-lg hover:border-blue-300 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      id="roundTrip"
                      checked={isRoundTrip}
                      onChange={(e) => setIsRoundTrip(e.target.checked)}
                      className="w-5 h-5 mt-0.5 rounded border-2 border-gray-400 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                    />
                    <div className="flex-1">
                      <label htmlFor="roundTrip" className="text-sm font-medium cursor-pointer text-gray-900">
                        Round trip (doubles the distance)
                      </label>
                      <p className="text-xs text-gray-600 mt-1">
                        Check this if you need to return to your starting point
                      </p>
                    </div>
                  </div>
                  
                  {gig.isMultiDay && (
                    <div className="flex items-start space-x-3 p-3 border-2 border-gray-200 rounded-lg hover:border-blue-300 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        id="perDay"
                        checked={isPerDay}
                        onChange={(e) => setIsPerDay(e.target.checked)}
                        className="w-5 h-5 mt-0.5 rounded border-2 border-gray-400 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                      />
                      <div className="flex-1">
                        <label htmlFor="perDay" className="text-sm font-medium cursor-pointer text-gray-900">
                          Calculate for each day (×{calculateDayCount()} days)
                        </label>
                        <div className="text-xs text-gray-600 mt-1">
                          {isRoundTrip ? `= ${calculateDayCount()} roundtrips total` : `= ${calculateDayCount()} one-way trips total`}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {!gig.isMultiDay && (
                    <p className="text-xs text-gray-500">
                      For multi-day gigs, you'll also see a "per day" calculation option.
                    </p>
                  )}
                </div>

                {/* Calculate button */}
                <Button
                  type="button"
                  onClick={calculateMileage}
                  disabled={!startingAddress || !endingAddress || isCalculatingMileage}
                  className="w-full"
                >
                  {isCalculatingMileage ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Calculating...
                    </>
                  ) : (
                    <>
                      <Calculator className="w-4 h-4 mr-2" />
                      Calculate Mileage
                    </>
                  )}
                </Button>

                {/* Error display */}
                {mileageError && (
                  <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
                    {mileageError}
                  </div>
                )}

                {/* Manual mileage input */}
                <div>
                  <label className="block text-sm font-medium mb-1">Total miles (or enter manually)</label>
                  <Input
                    type="number"
                    value={formData.mileage}
                    onChange={(e) => setFormData({ ...formData, mileage: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>

                {/* Deduction preview */}
                {formData.mileage > 0 && (
                  <Badge variant="secondary" className="bg-green-50 text-green-700">
                    <Calculator className="w-3 h-3 mr-1" />
                    Tax deduction: {formatCurrency(formData.mileage * 0.655)} ({formData.mileage} miles × $0.655)
                  </Badge>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 3: Parking Expenses */}
        {step === 3 && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Receipt className="w-5 h-5" />
                  Parking Expenses
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Amount you spent on parking</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.parkingSpent}
                    onChange={(e) => setFormData({ ...formData, parkingSpent: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Amount reimbursed by client</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.parkingReimbursed}
                    onChange={(e) => setFormData({ ...formData, parkingReimbursed: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                  />
                </div>
                {formData.parkingSpent - formData.parkingReimbursed > 0 && (
                  <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                    Business deduction: {formatCurrency(formData.parkingSpent - formData.parkingReimbursed)}
                  </Badge>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 4: Tax Rate & Payment Method */}
        {step === 4 && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calculator className="w-5 h-5" />
                  Tax Rate
                </CardTitle>
                <p className="text-sm text-gray-600">Set your tax rate for this gig</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Tax percentage</label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={formData.taxPercentage.toString()}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "") {
                          setFormData({ ...formData, taxPercentage: 0 });
                        } else if (/^\d+$/.test(value)) {
                          const numValue = parseInt(value);
                          if (numValue >= 0 && numValue <= 50) {
                            setFormData({ ...formData, taxPercentage: numValue });
                          }
                        }
                      }}
                      onFocus={(e) => e.target.select()}
                      className="w-20"
                      placeholder="Enter %"
                    />
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Your default is {user?.defaultTaxPercentage || 25}%. You can adjust for this specific gig.
                  </p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="text-sm text-gray-600">Estimated tax amount:</div>
                  <div className="font-bold text-blue-700">
                    {formatCurrency(calculations.taxableIncome * (formData.taxPercentage / 100))}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Based on taxable income only (deductions tracked separately)
                  </div>
                </div>

                {/* Payment Method */}
                <div className="pt-4 border-t">
                  <label className="block text-sm font-medium mb-2">How did you get paid? (optional)</label>
                  <Select
                    value={formData.paymentMethod}
                    onValueChange={(value) => setFormData({ ...formData, paymentMethod: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="check">Check</SelectItem>
                      <SelectItem value="direct_deposit">Direct Deposit</SelectItem>
                      <SelectItem value="venmo">Venmo</SelectItem>
                      <SelectItem value="paypal">PayPal</SelectItem>
                      <SelectItem value="zelle">Zelle</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 5: Summary & Confirmation */}
        {step === 5 && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calculator className="w-5 h-5" />
                  Tax Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Income Summary */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Total Received:</span>
                    <div className="font-semibold">{formatCurrency(formData.totalReceived)}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Reimbursements:</span>
                    <div className="font-semibold">{formatCurrency(formData.parkingReimbursed)}</div>
                  </div>
                  <div className="col-span-2 pt-2 border-t">
                    <span className="text-gray-600">Taxable Income:</span>
                    <div className="text-lg font-bold text-green-600">{formatCurrency(calculations.taxableIncome)}</div>
                  </div>
                </div>

                {/* Tax Estimate */}
                <div className="p-3 bg-green-50 rounded-lg">
                  <div className="text-sm text-gray-600">Estimated tax ({formData.taxPercentage}%):</div>
                  <div className="text-lg font-bold text-green-700">
                    {formatCurrency(calculations.taxableIncome * (formData.taxPercentage / 100))}
                  </div>
                </div>

                {/* Business Deductions (Informational) */}
                {calculations.businessDeductions > 0 && (
                  <div className="p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                    <div className="text-sm font-medium text-blue-800 mb-2">Potential Business Deductions:</div>
                    <div className="text-lg font-bold text-blue-700 mb-2">{formatCurrency(calculations.businessDeductions)}</div>
                    <div className="text-xs text-blue-600 space-y-1">
                      {formData.mileage > 0 && (
                        <div>• Mileage: {formData.mileage} miles × $0.655 = {formatCurrency(calculations.mileageDeduction)}</div>
                      )}
                      {formData.parkingSpent - formData.parkingReimbursed > 0 && (
                        <div>• Parking: {formatCurrency(formData.parkingSpent - formData.parkingReimbursed)}</div>
                      )}
                      <div className="text-xs text-blue-500 mt-2 italic">Track these for tax filing - not included in tax estimate above</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center pt-4 border-t bg-white sticky bottom-0">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={step === 1}
            className="flex items-center gap-2 min-h-12 px-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          
          {step < 5 ? (
            <Button 
              onClick={nextStep} 
              className="flex items-center gap-2 min-h-12 px-6 bg-primary hover:bg-primary/90"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button 
              onClick={handleSave}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700 flex items-center gap-2 min-h-12 px-6"
            >
              <CheckCircle className="w-4 h-4" />
              {isLoading ? "Saving..." : "Confirm Payment"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}