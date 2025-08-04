import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import CalendarView from "@/components/calendar-view";
import SimpleGigForm from "@/components/simple-gig-form";
import AddExpenseForm from "@/components/add-expense-form";
import Dashboard from "@/components/dashboard";
import Profile from "@/components/profile";
import BottomNavigation from "@/components/bottom-navigation";
import SimpleMobileNav from "@/components/simple-mobile-nav";
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

        {/* DEBUG: Test navigation rendering */}
        <div style={{ 
          position: 'fixed', 
          bottom: '0px', 
          left: '0px', 
          right: '0px', 
          backgroundColor: 'red', 
          height: '60px', 
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '18px'
        }}>
          DEBUG: NAVIGATION TEST
        </div>
        
        <div style={{ 
          position: 'fixed', 
          bottom: '80px', 
          right: '16px', 
          backgroundColor: 'blue', 
          padding: '20px', 
          zIndex: 9998,
          color: 'white'
        }}>
          DEBUG: BUTTONS TEST
        </div>
      </div>
    </div>
  );
}
