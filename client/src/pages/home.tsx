import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import CalendarView from "@/components/calendar-view";
import SimpleGigForm from "@/components/simple-gig-form";
import AddExpenseForm from "@/components/add-expense-form";
import Dashboard from "@/components/dashboard";
import Profile from "@/components/profile";
import BottomNavigation from "@/components/bottom-navigation";
import AppHeader from "@/components/app-header";
import DesktopSidebar from "@/components/desktop-sidebar";
import { useAuth } from "@/lib/replit-auth";
import { Button } from "@/components/ui/button";
import { Plus, Bell, Briefcase, Receipt } from "lucide-react";

export type Screen = "calendar" | "dashboard" | "profile" | "gig-form" | "expense-form" | "settings";

export default function Home() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("calendar");
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
      case "profile":
        return <Profile />;
      case "gig-form":
        return <SimpleGigForm onClose={() => setCurrentScreen("calendar")} />;
      case "expense-form":
        return <AddExpenseForm onClose={() => setCurrentScreen("calendar")} />;
      case "settings":
        return <Profile />; // Use Profile component for settings for now
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <DesktopSidebar currentScreen={currentScreen} onScreenChange={setCurrentScreen} />

      {/* Main Content Area */}
      <div className="lg:ml-64">
        {/* App Header - Hidden on desktop */}
        <div className="lg:hidden">
          <AppHeader currentScreen={currentScreen} onScreenChange={setCurrentScreen} />
        </div>

        {/* Main Content */}
        <main className="screen-content main-content-area">
          {renderScreen()}
        </main>

        {/* Floating Action Buttons - Hidden on desktop (buttons are in sidebar) */}
        {currentScreen !== "gig-form" && currentScreen !== "expense-form" && (
          <div className="fixed bottom-20 right-4 flex flex-col gap-3 lg:hidden">
            <Button
              onClick={() => setCurrentScreen("expense-form")}
              className="px-4 py-3 rounded-full shadow-lg hover:scale-105 transition-all duration-200 bg-green-600 hover:bg-green-700 text-white font-medium"
            >
              <Receipt className="w-4 h-4 mr-2" />
              Add Expense
            </Button>
            <Button
              onClick={() => setCurrentScreen("gig-form")}
              className="px-4 py-3 rounded-full shadow-lg hover:scale-105 transition-all duration-200 bg-primary hover:bg-primary/90 text-white font-medium"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Gig
            </Button>
          </div>
        )}

        {/* Bottom Navigation - Hidden on desktop */}
        <div className="lg:hidden">
          <BottomNavigation 
            currentScreen={currentScreen} 
            onScreenChange={setCurrentScreen} 
          />
        </div>
      </div>
    </div>
  );
}
