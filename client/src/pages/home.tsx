import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import CalendarView from "@/components/calendar-view";
import GigForm from "@/components/gig-form";
import Dashboard from "@/components/dashboard";
import ResumeBuilder from "@/components/resume-builder";
import GoalTracker from "@/components/goal-tracker";
import Profile from "@/components/profile";
import InvoiceGenerator from "@/components/invoice-generator";
import BottomNavigation from "@/components/bottom-navigation";
import AppHeader from "@/components/app-header";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Plus, Bell, Briefcase } from "lucide-react";

export type Screen = "calendar" | "dashboard" | "resume" | "goals" | "profile" | "gig-form" | "invoices" | "settings";

export default function Home() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("dashboard");
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const handleUserChange = () => {
    // Refresh all data when user changes
    queryClient.invalidateQueries();
  };

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
      case "profile":
        return <Profile />;
      case "gig-form":
        return <GigForm onClose={() => setCurrentScreen("calendar")} />;
      case "invoices":
        return <InvoiceGenerator />;
      case "settings":
        return <Profile />; // Use Profile component for settings for now
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* App Header */}
      <AppHeader currentScreen={currentScreen} onScreenChange={setCurrentScreen} />

      {/* Main Content */}
      <main className="screen-content">
        {renderScreen()}
      </main>

      {/* Floating Action Button */}
      {currentScreen !== "gig-form" && (
        <Button
          onClick={() => setCurrentScreen("gig-form")}
          className="fixed bottom-20 right-4 px-4 py-3 rounded-full shadow-lg hover:scale-105 transition-all duration-200 bg-primary hover:bg-primary/90 text-white font-medium"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Gig
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
