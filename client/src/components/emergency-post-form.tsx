import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function EmergencyPostForm() {
  const [formData, setFormData] = useState({
    agencyEmail: '',
    agencyName: '',
    contactEmail: '',
    eventName: '',
    eventDate: '',
    city: '',
    venue: '',
    roleDescription: '',
    payRate: '',
    urgency: 'ASAP'
  });

  const { toast } = useToast();

  const postGigMutation = useMutation({
    mutationFn: async (gigData: any) => {
      const response = await apiRequest("POST", "/api/emergency-gigs", gigData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Emergency Gig Posted!",
        description: "Brand ambassadors in your area will be notified immediately.",
      });
      // Reset form
      setFormData({
        agencyEmail: '',
        agencyName: '',
        contactEmail: '',
        eventName: '',
        eventDate: '',
        city: '',
        venue: '',
        roleDescription: '',
        payRate: '',
        urgency: 'ASAP'
      });
    },
    onError: () => {
      toast({
        title: "Posting Failed",
        description: "Failed to post emergency gig. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.agencyEmail || !formData.agencyName || !formData.contactEmail || 
        !formData.eventName || !formData.eventDate || !formData.city) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    // Convert date to proper format
    const eventDateTime = new Date(formData.eventDate).toISOString();
    
    postGigMutation.mutate({
      ...formData,
      eventDate: eventDateTime
    });
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-red-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Emergency BA Post</h1>
        <p className="text-gray-600 mb-4">
          Need brand ambassadors fast? Post your urgent need and get connected with available talent.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-800 mb-2">
            <DollarSign className="w-5 h-5" />
            <span className="font-medium">$5 per emergency post</span>
          </div>
          <p className="text-blue-700 text-sm">
            BAs receive instant notifications and send you their info directly via email.
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Post Emergency Gig</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Agency Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Agency Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="agencyName">Agency Name *</Label>
                  <Input
                    id="agencyName"
                    value={formData.agencyName}
                    onChange={(e) => handleInputChange('agencyName', e.target.value)}
                    placeholder="Your agency or company name"
                    className="text-base"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="agencyEmail">Agency Email *</Label>
                  <Input
                    id="agencyEmail"
                    type="email"
                    value={formData.agencyEmail}
                    onChange={(e) => handleInputChange('agencyEmail', e.target.value)}
                    placeholder="agency@company.com"
                    className="text-base"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="contactEmail">Contact Email for Responses *</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => handleInputChange('contactEmail', e.target.value)}
                  placeholder="Where BAs should send their applications"
                  className="text-base"
                  required
                />
                <p className="text-sm text-gray-600 mt-1">
                  BAs will email their resumes and headshots to this address
                </p>
              </div>
            </div>

            {/* Event Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Event Details</h3>
              
              <div>
                <Label htmlFor="eventName">Event Name *</Label>
                <Input
                  id="eventName"
                  value={formData.eventName}
                  onChange={(e) => handleInputChange('eventName', e.target.value)}
                  placeholder="Product launch, store opening, etc."
                  className="text-base"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="eventDate">Event Date & Time *</Label>
                  <Input
                    id="eventDate"
                    type="datetime-local"
                    value={formData.eventDate}
                    onChange={(e) => handleInputChange('eventDate', e.target.value)}
                    className="text-base"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="urgency">Urgency *</Label>
                  <Select value={formData.urgency} onValueChange={(value) => handleInputChange('urgency', value)}>
                    <SelectTrigger className="text-base">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ASAP">ASAP (within hours)</SelectItem>
                      <SelectItem value="Within 24hrs">Within 24 hours</SelectItem>
                      <SelectItem value="This Week">This Week</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    placeholder="New York, Los Angeles, etc."
                    className="text-base"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="venue">Venue (optional)</Label>
                  <Input
                    id="venue"
                    value={formData.venue}
                    onChange={(e) => handleInputChange('venue', e.target.value)}
                    placeholder="Mall, store, convention center"
                    className="text-base"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="payRate">Pay Rate (optional)</Label>
                <Input
                  id="payRate"
                  value={formData.payRate}
                  onChange={(e) => handleInputChange('payRate', e.target.value)}
                  placeholder="$25/hour, $200/day, etc."
                  className="text-base"
                />
              </div>

              <div>
                <Label htmlFor="roleDescription">Role Description (optional)</Label>
                <Textarea
                  id="roleDescription"
                  value={formData.roleDescription}
                  onChange={(e) => handleInputChange('roleDescription', e.target.value)}
                  placeholder="Describe what the BAs will be doing, requirements, dress code, etc."
                  rows={3}
                  className="text-base"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <Button 
                type="submit" 
                className="w-full text-lg py-6"
                disabled={postGigMutation.isPending}
              >
                {postGigMutation.isPending ? "Posting..." : "Post Emergency Gig - $5"}
              </Button>
              <p className="text-center text-sm text-gray-600 mt-2">
                Payment will be processed through RevenueCat
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}