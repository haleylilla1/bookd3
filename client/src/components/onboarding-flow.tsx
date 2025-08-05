import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, DollarSign, MapPin, Calendar, TrendingUp, ArrowRight, ArrowLeft } from "lucide-react";

interface OnboardingFlowProps {
  isOpen: boolean;
  onComplete: () => void;
  onClose: () => void;
}

export function OnboardingFlow({ isOpen, onComplete, onClose }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(0);
  
  const steps = [
    {
      title: "Welcome to Bookd!",
      icon: <CheckCircle className="w-8 h-8 text-green-500" />,
      content: (
        <div className="space-y-4">
          <p className="text-gray-600">
            Bookd helps gig workers like you track income and expenses to maximize tax deductions and keep more of what you earn.
          </p>
          <div className="bg-green-50 p-4 rounded-lg">
            <h4 className="font-semibold text-green-800 mb-2">What you'll learn:</h4>
            <ul className="space-y-1 text-green-700 text-sm">
              <li>• How to track gigs and payments</li>
              <li>• Automatic mileage calculation for tax deductions</li>
              <li>• Recording business expenses</li>
              <li>• Understanding your tax savings</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      title: "Track Every Gig",
      icon: <Calendar className="w-8 h-8 text-blue-500" />,
      content: (
        <div className="space-y-4">
          <p className="text-gray-600">
            Log each gig with details like date, location, and expected pay. This creates a complete record for tax time.
          </p>
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-800 mb-2">Pro Tip:</h4>
            <p className="text-blue-700 text-sm">
              Add gigs as soon as you accept them. The more detailed your records, the more deductions you can claim.
            </p>
          </div>
        </div>
      )
    },
    {
      title: "Automatic Mileage Tracking",
      icon: <MapPin className="w-8 h-8 text-purple-500" />,
      content: (
        <div className="space-y-4">
          <p className="text-gray-600">
            Bookd automatically calculates business mileage between your home and gig locations. 
            In 2024, that's <strong>$0.67 per mile</strong> you can deduct!
          </p>
          <div className="bg-purple-50 p-4 rounded-lg">
            <h4 className="font-semibold text-purple-800 mb-2">Example:</h4>
            <p className="text-purple-700 text-sm">
              A 20-mile roundtrip gig = $13.40 in tax deductions. Do 10 of those per week and that's $134 weekly in deductions!
            </p>
          </div>
        </div>
      )
    },
    {
      title: "Record Payments & Expenses",
      icon: <DollarSign className="w-8 h-8 text-green-500" />,
      content: (
        <div className="space-y-4">
          <p className="text-gray-600">
            Use the "Got Paid" button to record what you actually received, plus any business expenses like parking or supplies.
          </p>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <h4 className="font-semibold text-yellow-800 mb-2">Track These Expenses:</h4>
            <ul className="space-y-1 text-yellow-700 text-sm">
              <li>• Parking fees</li>
              <li>• Tolls</li>
              <li>• Equipment purchases</li>
              <li>• Phone bills (business portion)</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      title: "Maximize Your Tax Savings",
      icon: <TrendingUp className="w-8 h-8 text-green-500" />,
      content: (
        <div className="space-y-4">
          <p className="text-gray-600">
            Bookd tracks everything you need to reduce your tax bill. The average gig worker saves $2,000-$4,000 per year with proper record keeping.
          </p>
          <div className="bg-green-50 p-4 rounded-lg">
            <h4 className="font-semibold text-green-800 mb-2">Ready to start saving?</h4>
            <p className="text-green-700 text-sm">
              Let's add your first gig and start building your tax deduction record!
            </p>
          </div>
        </div>
      )
    }
  ];

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {steps[currentStep].icon}
            {steps[currentStep].title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <Progress value={progress} className="w-full" />
          
          <div className="min-h-[200px]">
            {steps[currentStep].content}
          </div>
          
          <div className="flex justify-between items-center pt-4">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 0}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            
            <span className="text-sm text-gray-500">
              {currentStep + 1} of {steps.length}
            </span>
            
            <Button
              onClick={nextStep}
              className="flex items-center gap-2"
            >
              {currentStep === steps.length - 1 ? "Get Started" : "Next"}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}