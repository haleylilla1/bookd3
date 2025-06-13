import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import CalendarView from "@/components/calendar-view";
import GigForm from "@/components/gig-form";
import Dashboard from "@/components/dashboard";
import ResumeBuilder from "@/components/resume-builder";
import GoalTracker from "@/components/goal-tracker";
import Profile from "@/components/profile";
import BottomNavigation from "@/components/bottom-navigation";
import { Button } from "@/components/ui/button";
import { Plus, Bell, Briefcase } from "lucide-react";

export type Screen = "calendar" | "dashboard" | "resume" | "goals" | "profile" | "gig-form";

export default function Home() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("calendar");

  const { data: user } = useQuery({
    queryKey: ["/api/user"],
  });

  const renderScreen = () => {
    switch (currentScreen) {
      case "calendar":
        return <CalendarView />;
      case "dashboard":
        return <Dashboard />;
      case "resume":
        return <ResumeBuilder />;
      case "goals":
        return <GoalTracker />;
      case "gig-form":
        return <GigForm onClose={() => setCurrentScreen("calendar")} />;
      default:
        return <CalendarView />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Giggy</h1>
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="sm" className="relative p-2">
              <Bell className="w-5 h-5 text-gray-400" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-warning rounded-full"></span>
            </Button>
            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
              <span className="text-xs font-semibold text-gray-600">
                {user?.name?.charAt(0) || 'U'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="screen-content">
        {renderScreen()}
      </main>

      {/* Floating Action Button */}
      {currentScreen !== "gig-form" && (
        <Button
          onClick={() => setCurrentScreen("gig-form")}
          className="fixed bottom-20 right-4 w-14 h-14 rounded-full shadow-lg hover:scale-105 transition-all duration-200"
          size="icon"
        >
          <Plus className="w-6 h-6" />
        </Button>
      )}

      {/* Bottom Navigation */}
      <BottomNavigation 
        currentScreen={currentScreen} 
        onScreenChange={setCurrentScreen} 
      />
    </div>
  );
}
