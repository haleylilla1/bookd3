import { Calendar, LayoutDashboard, User, FileText, Plus, LogOut, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Screen } from "@/pages/home";
import { useAuth } from "@/hooks/useAuth";

interface DesktopSidebarProps {
  currentScreen: Screen;
  onScreenChange: (screen: Screen) => void;
}

export default function DesktopSidebar({ currentScreen, onScreenChange }: DesktopSidebarProps) {
  const { logout, user } = useAuth();
  const navItems = [
    {
      id: "calendar" as Screen,
      icon: Calendar,
      label: "Calendar",
    },
    {
      id: "dashboard" as Screen,
      icon: LayoutDashboard,
      label: "Dashboard",
    },
    {
      id: "profile" as Screen,
      icon: User,
      label: "Profile",
    },
  ];

  return (
    <div className="hidden lg:flex flex-col w-64 bg-white border-r border-gray-200 h-screen fixed left-0 top-0 desktop-sidebar">
      {/* Logo/Header */}
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900">Bookd</h1>
        <p className="text-sm text-gray-500 mt-1">Work different</p>
      </div>

      {/* Add Buttons */}
      <div className="p-4 border-b border-gray-200 space-y-2">
        <Button
          onClick={() => onScreenChange("gig-form")}
          className="w-full bg-primary hover:bg-primary/90 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Gig
        </Button>
        <Button
          onClick={() => onScreenChange("expense-form")}
          className="w-full bg-green-600 hover:bg-green-700 text-white"
        >
          <Receipt className="w-4 h-4 mr-2" />
          Add Expense
        </Button>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-4 py-6">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = currentScreen === item.id;
            
            return (
              <li key={item.id}>
                <button
                  onClick={() => onScreenChange(item.id)}
                  className={`w-full flex items-center px-4 py-3 rounded-lg text-left transition-colors ${
                    isActive
                      ? "bg-primary text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <IconComponent className="w-5 h-5 mr-3" />
                  <span className="font-medium">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer with user info and logout */}
      <div className="p-4 border-t border-gray-200 space-y-3">
        {user && (
          <div className="text-sm">
            <p className="font-medium text-gray-900 truncate">{user.name}</p>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
          </div>
        )}
        
        <Button
          onClick={() => logout()}
          variant="ghost"
          size="sm" 
          className="w-full justify-start text-gray-700 hover:text-red-600 hover:bg-red-50"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
        
        <p className="text-xs text-gray-400 text-center">
          Desktop Version
        </p>
      </div>
    </div>
  );
}