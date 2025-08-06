import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { User, MapPin, Briefcase, Users, ArrowRight, ArrowLeft, CheckCircle, Eye } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AddressAutocomplete } from "@/components/address-autocomplete";

interface OnboardingFlowProps {
  isOpen: boolean;
  onComplete: () => void;
  onClose: () => void;
}

interface SetupData {
  name: string;
  homeAddress: string;
  gigTypes: string;
  clientName: string;
}

export function OnboardingFlow({ isOpen, onComplete, onClose }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [setupData, setSetupData] = useState<SetupData>({
    name: "",
    homeAddress: "",
    gigTypes: "",
    clientName: ""
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Phase 1: Setup steps
  const setupSteps = [
    {
      title: "Welcome to Bookd",
      icon: <User className="w-8 h-8 text-blue-500" />,
      field: "welcome",
      placeholder: "",
      description: "You've got gigs. We've got your back.\nKnow exactly what's coming in, what's going out, and what's yours to keep.",
      isWelcome: true
    },
    {
      title: "What's your name?",
      icon: <User className="w-8 h-8 text-blue-500" />,
      field: "name",
      placeholder: "Enter your full name",
      description: "We'll use this to personalize your experience and for your records."
    },
    {
      title: "What's your home address?", 
      icon: <MapPin className="w-8 h-8 text-green-500" />,
      field: "homeAddress",
      placeholder: "123 Main St, City, State",
      description: "We need this to calculate business mileage from home to your gigs for tax deductions."
    },
    {
      title: "What's your main type of gig work?",
      icon: <Briefcase className="w-8 h-8 text-purple-500" />,
      field: "gigTypes", 
      placeholder: "e.g., Food delivery or Rideshare or Photography",
      description: "Enter your primary gig type. You can add more later by going to your Profile."
    },
    {
      title: "What is one person or company you work with a lot?",
      icon: <Users className="w-8 h-8 text-orange-500" />,
      field: "clientName",
      placeholder: "Enter a client name",
      description: "This helps us set up your client tracking. You can add more later by going to your Profile."
    }
  ];

  // Phase 2: Feature tour steps  
  const tourSteps = [
    {
      title: "Track Your Work",
      icon: <CheckCircle className="w-8 h-8 text-green-500" />,
      content: (
        <div className="space-y-4">
          <p className="text-gray-600">
            Use the <strong>"Add Gig"</strong> and <strong>"Add Expense"</strong> buttons to track your work and business expenses.
          </p>
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-blue-700 text-sm">
              💡 <strong>Tip:</strong> Add gigs as soon as you accept them, and log expenses immediately so you don't forget!
            </p>
          </div>
        </div>
      )
    },
    {
      title: "Check Payment Status",
      icon: <Eye className="w-8 h-8 text-yellow-500" />,
      content: (
        <div className="space-y-4">
          <p className="text-gray-600">
            Scroll to <strong>"All Gigs"</strong> and click on the status bar to filter gigs.
          </p>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <p className="text-yellow-700 text-sm">
              💡 <strong>Tip:</strong> Check to see who hasn't paid you yet - never lose track of money owed to you!
            </p>
          </div>
        </div>
      )
    },
    {
      title: "Dashboard Insights",
      icon: <ArrowRight className="w-8 h-8 text-purple-500" />,
      content: (
        <div className="space-y-4">
          <p className="text-gray-600">
            Go to <strong>Dashboard</strong> and click on different cards to see breakdowns of your earnings and expenses.
          </p>
          <div className="bg-purple-50 p-4 rounded-lg">
            <p className="text-purple-700 text-sm">
              💡 <strong>Tip:</strong> Click on cards to see detailed breakdowns of your financial data!
            </p>
          </div>
        </div>
      )
    },
    {
      title: "Generate Reports",
      icon: <CheckCircle className="w-8 h-8 text-green-500" />,
      content: (
        <div className="space-y-4">
          <p className="text-gray-600">
            Click the big green button that says "Generate Reports" on the dashboard to create your income report - perfect for tax time or tracking your business performance.
          </p>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-green-700 text-sm">
              💡 <strong>You're all set!</strong> Start tracking your gigs and watch your tax deductions add up.
            </p>
          </div>
        </div>
      )
    }
  ];

  const allSteps = [...setupSteps, ...tourSteps];
  const isSetupPhase = currentStep < setupSteps.length;
  const currentStepData = allSteps[currentStep];

  const saveSetupMutation = useMutation({
    mutationFn: async (data: SetupData) => {
      const response = await apiRequest("POST", "/api/user/setup", data);
      if (!response.ok) {
        throw new Error("Failed to save setup data");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Setup Complete!",
        description: "Your profile has been set up successfully."
      });
    },
    onError: () => {
      toast({
        title: "Setup Error",
        description: "Failed to save your setup. Please try again.",
        variant: "destructive"
      });
    }
  });

  const nextStep = () => {
    // If we're at the end of setup phase (excluding welcome step), save data
    const actualDataSteps = setupSteps.filter(step => !(step as any).isWelcome);
    const lastDataStepIndex = setupSteps.findIndex((step, index) => 
      index === setupSteps.length - 1 && !(step as any).isWelcome
    ) || setupSteps.length - 1;
    
    if (currentStep === lastDataStepIndex) {
      saveSetupMutation.mutate(setupData);
    }
    
    if (currentStep < allSteps.length - 1) {
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

  const updateSetupData = (field: keyof SetupData, value: string) => {
    setSetupData(prev => ({ ...prev, [field]: value }));
  };

  const canProceed = () => {
    if (!isSetupPhase) return true;
    
    // Welcome step can always proceed
    if ((setupSteps[currentStep] as any).isWelcome) return true;
    
    const field = setupSteps[currentStep].field as keyof SetupData;
    return setupData[field].trim().length > 0;
  };

  const progress = ((currentStep + 1) / allSteps.length) * 100;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {currentStepData.icon}
            {currentStepData.title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <Progress value={progress} className="w-full" />
          
          <div className="min-h-[200px] space-y-4">
            {isSetupPhase ? (
              <>
                {(currentStepData as any).isWelcome ? (
                  <div className="text-center py-8">
                    <p className="text-lg md:text-xl leading-relaxed text-gray-700 font-medium">
                      {(currentStepData as any).description}
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-gray-600 text-sm">
                      {(currentStepData as any).description}
                    </p>
                    <div className="space-y-2">
                      {(currentStepData as any).field === "homeAddress" ? (
                        <AddressAutocomplete
                          label={currentStepData.title}
                          placeholder={(currentStepData as any).placeholder}
                          value={setupData.homeAddress}
                          onChange={(value) => updateSetupData("homeAddress", value)}
                          className="text-base"
                        />
                      ) : (
                        <>
                          <Label htmlFor={(currentStepData as any).field}>
                            {currentStepData.title}
                          </Label>
                          <Input
                            id={(currentStepData as any).field}
                            value={setupData[(currentStepData as any).field as keyof SetupData]}
                            onChange={(e) => updateSetupData((currentStepData as any).field as keyof SetupData, e.target.value)}
                            placeholder={(currentStepData as any).placeholder}
                            className="text-base"
                          />
                        </>
                      )}
                    </div>
                  </>
                )}
              </>
            ) : (
              (currentStepData as any).content
            )}
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
              {currentStep + 1} of {allSteps.length}
            </span>
            
            <Button
              onClick={nextStep}
              disabled={!canProceed() || saveSetupMutation.isPending}
              className="flex items-center gap-2"
            >
              {currentStep === allSteps.length - 1 ? "Finish" : "Next"}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}