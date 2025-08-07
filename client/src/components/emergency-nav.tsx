import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLocation } from "wouter";
import { AlertTriangle, Briefcase, Calendar, PlusCircle } from "lucide-react";

export default function EmergencyNavCard() {
  const [, setLocation] = useLocation();

  return (
    <Card className="bg-gradient-to-r from-red-50 to-orange-50 border-red-200">
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">Emergency BA</h3>
            <p className="text-sm text-gray-600">Brand ambassador opportunities</p>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-2">
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => setLocation('/ba-profile')}
            className="flex flex-col items-center gap-1 h-auto py-2"
          >
            <Briefcase className="w-4 h-4" />
            <span className="text-xs">BA Profile</span>
          </Button>
          
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => setLocation('/emergency-feed')}
            className="flex flex-col items-center gap-1 h-auto py-2"
          >
            <Calendar className="w-4 h-4" />
            <span className="text-xs">Find Gigs</span>
          </Button>
          
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => setLocation('/emergency-post')}
            className="flex flex-col items-center gap-1 h-auto py-2"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="text-xs">Post Gig</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}