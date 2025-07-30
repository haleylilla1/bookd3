import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/replit-auth";

interface BasicGigFormProps {
  onClose: () => void;
}

export default function BasicGigForm({ onClose }: BasicGigFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    gigType: "",
    eventName: "",
    clientName: "",
    startDate: "",
    expectedPay: "",
    status: "upcoming"
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("🔄 Basic form submission started");
    
    if (!user?.id) {
      toast({
        title: "Error",
        description: "Please log in first",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const gigData = {
        userId: user.id,
        date: formData.startDate,
        startDate: formData.startDate,
        endDate: formData.startDate,
        isMultiDay: false,
        multiDayGroupId: null,
        gigType: formData.gigType,
        eventName: formData.eventName,
        clientName: formData.clientName,
        expectedPay: formData.expectedPay || "0",
        actualPay: "0",
        tips: "0",
        paymentMethod: "cash",
        status: formData.status,
        duties: null,
        taxPercentage: 23,
        mileage: 0,
        notes: null,
        parkingExpense: "0",
        parkingReceipts: [],
        parkingReimbursed: false,
        otherExpenses: "0",
        otherExpenseReceipts: [],
        otherExpensesReimbursed: false,
      };

      console.log("📤 Creating basic gig:", gigData);
      
      const response = await apiRequest("POST", "/api/gigs", gigData);
      console.log("✅ Basic gig created successfully");

      toast({
        title: "Success",
        description: "Gig created successfully!"
      });
      
      onClose();
    } catch (error) {
      console.error("🚨 Basic form error:", error);
      toast({
        title: "Error",
        description: "Failed to create gig",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Add Basic Gig</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <Label htmlFor="gigType">Gig Type *</Label>
            <Input
              id="gigType"
              value={formData.gigType}
              onChange={(e) => setFormData({ ...formData, gigType: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="eventName">Event Name *</Label>
            <Input
              id="eventName"
              value={formData.eventName}
              onChange={(e) => setFormData({ ...formData, eventName: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="clientName">Client Name</Label>
            <Input
              id="clientName"
              value={formData.clientName}
              onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="startDate">Date *</Label>
            <Input
              id="startDate"
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="expectedPay">Expected Pay</Label>
            <Input
              id="expectedPay"
              type="number"
              value={formData.expectedPay}
              onChange={(e) => setFormData({ ...formData, expectedPay: e.target.value })}
              placeholder="0"
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating..." : "Create Gig"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}