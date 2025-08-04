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

        {/* Test: Add basic HTML elements directly */}
        <div 
          id="test-nav"
          style={{
            position: 'fixed',
            bottom: '0px',
            left: '0px',
            right: '0px',
            height: '60px',
            backgroundColor: '#ffffff',
            borderTop: '2px solid #000000',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around'
          }}
        >
          <button 
            onClick={() => setCurrentScreen("calendar")}
            style={{
              padding: '8px 16px',
              backgroundColor: currentScreen === "calendar" ? '#6366f1' : '#ffffff',
              color: currentScreen === "calendar" ? '#ffffff' : '#000000',
              border: '1px solid #000000',
              borderRadius: '4px'
            }}
          >
            Calendar
          </button>
          <button 
            onClick={() => setCurrentScreen("dashboard")}
            style={{
              padding: '8px 16px',
              backgroundColor: currentScreen === "dashboard" ? '#6366f1' : '#ffffff',
              color: currentScreen === "dashboard" ? '#ffffff' : '#000000',
              border: '1px solid #000000',
              borderRadius: '4px'
            }}
          >
            Dashboard
          </button>
          <button 
            onClick={() => setCurrentScreen("profile")}
            style={{
              padding: '8px 16px',
              backgroundColor: currentScreen === "profile" ? '#6366f1' : '#ffffff',
              color: currentScreen === "profile" ? '#ffffff' : '#000000',
              border: '1px solid #000000',
              borderRadius: '4px'
            }}
          >
            Profile
          </button>
        </div>
        
        {/* Test: Add floating buttons directly */}
        <div 
          style={{
            position: 'fixed',
            bottom: '80px',
            right: '16px',
            zIndex: 999998,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <button 
            onClick={() => setCurrentScreen("expense-form")}
            style={{
              padding: '12px 16px',
              backgroundColor: '#c258d1',
              color: '#ffffff',
              border: 'none',
              borderRadius: '25px',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            Add Expense
          </button>
          <button 
            onClick={() => setCurrentScreen("gig-form")}
            style={{
              padding: '12px 16px',
              backgroundColor: '#6366f1',
              color: '#ffffff',
              border: 'none',
              borderRadius: '25px',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            Add Gig
          </button>
        </div>
      </div>
    </div>
  );
}
