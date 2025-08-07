import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, DollarSign, AlertTriangle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { EmergencyGig } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

export default function EmergencyFeed() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: emergencyGigs = [], isLoading } = useQuery<EmergencyGig[]>({
    queryKey: ["/api/emergency-gigs"],
  });

  const applyMutation = useMutation({
    mutationFn: async (gigId: number) => {
      const response = await apiRequest("POST", `/api/emergency-gigs/${gigId}/apply`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Application Sent!",
        description: "Your information has been sent to the agency.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/emergency-gigs"] });
    },
    onError: () => {
      toast({
        title: "Application Failed",
        description: "Failed to apply to this gig. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'ASAP': return 'bg-red-100 text-red-800 border-red-200';
      case 'Within 24hrs': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'This Week': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-red-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Emergency Gigs</h1>
          <p className="text-gray-600">Apply to urgent and last minute brand ambassador opportunities posted by agencies. COMING SOON.</p>
        </div>
      </div>
      {/* Emergency Gigs Feed */}
      <div className="space-y-4">
        {emergencyGigs.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Emergency Gigs</h3>
              <p className="text-gray-600">
                All caught up! We'll notify you when new emergency gigs are posted in your preferred cities.
              </p>
            </CardContent>
          </Card>
        ) : (
          emergencyGigs.map((gig) => (
            <Card key={gig.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={getUrgencyColor(gig.urgency)}>
                        {gig.urgency}
                      </Badge>
                      {gig.status === 'filled' && (
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          Position Filled
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-xl">{gig.eventName}</CardTitle>
                    <p className="text-gray-600">{gig.agencyName}</p>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Event Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">
                      {new Date(gig.eventDate).toLocaleDateString()} at{' '}
                      {new Date(gig.eventDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm">{gig.city}{gig.venue && `, ${gig.venue}`}</span>
                  </div>
                  
                  {gig.payRate && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <DollarSign className="w-4 h-4" />
                      <span className="text-sm">{gig.payRate}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">
                      Posted {formatDistanceToNow(new Date(gig.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>

                {/* Role Description */}
                {gig.roleDescription && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-1">Role Description</h4>
                    <p className="text-gray-700 text-sm">{gig.roleDescription}</p>
                  </div>
                )}

                {/* Action Button */}
                <div className="pt-2">
                  {gig.status === 'filled' ? (
                    <Button variant="outline" disabled className="w-full">
                      Position Filled
                    </Button>
                  ) : (
                    <Button 
                      onClick={() => applyMutation.mutate(gig.id)}
                      disabled={applyMutation.isPending}
                      className="w-full"
                    >
                      {applyMutation.isPending ? "Applying..." : "Apply Now"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}