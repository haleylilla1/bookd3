import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Calculator, Receipt, CheckCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { Gig } from "@shared/schema";

interface GotPaidDialogProps {
  gig: Gig;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: GotPaidData) => Promise<void>;
}

export interface GotPaidData {
  totalReceived: number;
  parkingSpent: number;
  parkingReimbursed: number;
  otherSpent: number;
  otherReimbursed: number;
  paymentMethod?: string;
}

export default function GotPaidDialog({ gig, isOpen, onClose, onSave }: GotPaidDialogProps) {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<GotPaidData>({
    totalReceived: parseFloat(gig.expectedPay || "0"),
    parkingSpent: parseFloat(gig.parkingExpense || "0"),
    parkingReimbursed: gig.parkingReimbursed ? parseFloat(gig.parkingExpense || "0") : 0,
    otherSpent: parseFloat(gig.otherExpenses || "0"),
    otherReimbursed: gig.otherExpensesReimbursed ? parseFloat(gig.otherExpenses || "0") : 0,
    paymentMethod: gig.paymentMethod || "",
  });

  // Tax-smart calculations
  const calculations = {
    taxableIncome: formData.totalReceived - formData.parkingReimbursed - formData.otherReimbursed,
    businessDeductions: (formData.parkingSpent - formData.parkingReimbursed) + (formData.otherSpent - formData.otherReimbursed),
    get netTaxableIncome() {
      return this.taxableIncome - this.businessDeductions;
    }
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
    "Parking Expenses", 
    "Other Expenses",
    "Payment Method",
    "Review & Confirm"
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Got Paid: {gig.eventName}
          </DialogTitle>
          <DialogDescription>
            Step {step} of 5: {stepTitles[step - 1]}
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="flex gap-2 mb-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={`flex-1 h-2 rounded ${
                i + 1 <= step ? "bg-green-500" : "bg-gray-200"
              }`}
            />
          ))}
        </div>

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

        {/* Step 2: Parking Expenses */}
        {step === 2 && (
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

        {/* Step 3: Other Expenses */}
        {step === 3 && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Receipt className="w-5 h-5" />
                  Other Expenses
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Amount you spent on other expenses</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.otherSpent}
                    onChange={(e) => setFormData({ ...formData, otherSpent: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-gray-500 mt-1">Materials, food, supplies, etc.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Amount reimbursed by client</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.otherReimbursed}
                    onChange={(e) => setFormData({ ...formData, otherReimbursed: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                  />
                </div>
                {formData.otherSpent - formData.otherReimbursed > 0 && (
                  <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                    Business deduction: {formatCurrency(formData.otherSpent - formData.otherReimbursed)}
                  </Badge>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 4: Payment Method */}
        {step === 4 && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">How did you get paid?</CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={formData.paymentMethod}
                  onValueChange={(value) => setFormData({ ...formData, paymentMethod: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method (optional)" />
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
                <p className="text-sm text-gray-500 mt-2">
                  This helps track payment methods for your records.
                </p>
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
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Total Received:</span>
                    <div className="font-semibold">{formatCurrency(formData.totalReceived)}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Reimbursements:</span>
                    <div className="font-semibold">{formatCurrency(formData.parkingReimbursed + formData.otherReimbursed)}</div>
                  </div>
                  <div className="col-span-2 pt-2 border-t">
                    <span className="text-gray-600">Taxable Income:</span>
                    <div className="text-lg font-bold text-green-600">{formatCurrency(calculations.taxableIncome)}</div>
                  </div>
                  {calculations.businessDeductions > 0 && (
                    <div className="col-span-2">
                      <span className="text-gray-600">Business Deductions:</span>
                      <div className="font-semibold text-blue-600">{formatCurrency(calculations.businessDeductions)}</div>
                    </div>
                  )}
                </div>
                <div className="mt-4 p-3 bg-green-50 rounded-lg">
                  <div className="text-sm text-gray-600">Estimated tax (25%):</div>
                  <div className="text-lg font-bold text-green-700">
                    {formatCurrency(calculations.netTaxableIncome * 0.25)}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={step === 1}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          
          {step < 5 ? (
            <Button onClick={nextStep} className="flex items-center gap-2">
              Next
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button 
              onClick={handleSave}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700 flex items-center gap-2"
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