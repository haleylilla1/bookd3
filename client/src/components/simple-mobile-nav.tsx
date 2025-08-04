import { Button } from "@/components/ui/button";
import { Calendar, PieChart, User, Plus, Receipt } from "lucide-react";
import type { Screen } from "@/pages/home";

interface SimpleMobileNavProps {
  currentScreen: Screen;
  onScreenChange: (screen: Screen) => void;
}

export default function SimpleMobileNav({ currentScreen, onScreenChange }: SimpleMobileNavProps) {
  console.log('SimpleMobileNav rendering with currentScreen:', currentScreen);
  
  const navItems = [
    { id: "calendar" as const, label: "Calendar", icon: Calendar },
    { id: "dashboard" as const, label: "Dashboard", icon: PieChart },
    { id: "profile" as const, label: "Profile", icon: User },
  ];

  return (
    <>
      {console.log('Rendering SimpleMobileNav navigation elements')}
      {/* Bottom Navigation */}
      <nav 
        style={{ 
          position: 'fixed',
          bottom: '0px',
          left: '0px',
          right: '0px',
          width: '100%',
          backgroundColor: 'red', // Temporarily red to make it visible
          borderTop: '1px solid #e5e7eb',
          padding: '8px',
          zIndex: 9999,
          display: 'block !important',
          height: '60px'
        }}
      >
        <div className="flex items-center justify-around">
          {navItems.map((item) => {
            const isActive = currentScreen === item.id;
            const Icon = item.icon;
            
            return (
              <Button
                key={item.id}
                variant="ghost"
                size="sm"
                onClick={() => onScreenChange(item.id)}
                className={`flex flex-col items-center space-y-1 p-1 ${
                  isActive ? "text-primary" : "text-gray-400"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-xs font-medium">{item.label}</span>
              </Button>
            );
          })}
        </div>
      </nav>

      {/* Floating Action Buttons */}
      {currentScreen !== "gig-form" && currentScreen !== "expense-form" && (
        <div 
          style={{ 
            position: 'fixed',
            bottom: '80px', 
            right: '16px',
            zIndex: 9998,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            backgroundColor: 'blue',
            padding: '10px'
          }}
        >
          <Button
            onClick={() => onScreenChange("expense-form")}
            className="px-4 py-3 rounded-full shadow-lg hover:scale-105 transition-all duration-200 bg-[#c258d1] hover:bg-green-700 text-white font-medium"
          >
            <Receipt className="w-4 h-4 mr-2" />
            Add Expense
          </Button>
          <Button
            onClick={() => onScreenChange("gig-form")}
            className="px-4 py-3 rounded-full shadow-lg hover:scale-105 transition-all duration-200 bg-primary hover:bg-primary/90 text-white font-medium"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Gig
          </Button>
        </div>
      )}
    </>
  );
}