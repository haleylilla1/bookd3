import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SimpleLanding() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
      <div className="container mx-auto px-4 max-w-md">
        <Card className="border-0 shadow-xl">
          <CardHeader className="text-center pb-6">
            <div className="mb-4">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Giggy</h1>
              <p className="text-sm text-gray-500">Work different.</p>
            </div>
            <CardTitle className="text-xl">Welcome to Giggy</CardTitle>
            <p className="text-sm text-gray-600">
              Track your gig work earnings and expenses
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              size="lg" 
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={() => window.location.href = "/login"}
            >
              Get Started
            </Button>
            
            <div className="text-center">
              <p className="text-sm text-gray-500">
                Already have an account?{" "}
                <button 
                  onClick={() => window.location.href = "/login"}
                  className="text-blue-600 hover:underline font-medium"
                >
                  Sign in
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}