import { Button } from "@/components/ui/button";
import { Calendar, PieChart, FileText, Target, User, Receipt } from "lucide-react";
import type { Screen } from "@/pages/home";

interface BottomNavigationProps {
  currentScreen: Screen;
  onScreenChange: (screen: Screen) => void;
}

export default function BottomNavigation({ currentScreen, onScreenChange }: BottomNavigationProps) {
  const navItems = [
    { id: "calendar" as const, label: "Calendar", icon: Calendar },
    { id: "dashboard" as const, label: "Dashboard", icon: PieChart },
    { id: "goals" as const, label: "Goals", icon: Target },
    { id: "profile" as const, label: "Profile", icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 px-4 py-2">
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
              className={`flex flex-col items-center space-y-1 p-2 ${
                isActive ? "text-primary" : "text-gray-400"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
