import { Button } from "@/components/ui/button";
import { Calendar, PieChart, User } from "lucide-react";
import type { Screen } from "@/pages/home";

interface BottomNavigationProps {
  currentScreen: Screen;
  onScreenChange: (screen: Screen) => void;
}

export default function BottomNavigation({ currentScreen, onScreenChange }: BottomNavigationProps) {
  
  const navItems = [
    { id: "calendar" as const, label: "Calendar", icon: Calendar },
    { id: "dashboard" as const, label: "Dashboard", icon: PieChart },
    { id: "profile" as const, label: "Profile", icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 w-full bg-white border-t border-gray-200 px-2 py-2 z-50">
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
  );
}
