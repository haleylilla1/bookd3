import { Calendar, LayoutDashboard, User, FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Screen } from "@/pages/home";

interface DesktopSidebarProps {
  currentScreen: Screen;
  onScreenChange: (screen: Screen) => void;
}

export default function DesktopSidebar({ currentScreen, onScreenChange }: DesktopSidebarProps) {
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
      id: "resume" as Screen,
      icon: FileText,
      label: "Resume",
    },
    {
      id: "profile" as Screen,
      icon: User,
      label: "Profile",
    },
  ];

  return (
    <div className="hidden lg:flex flex-col w-64 bg-white border-r border-gray-200 h-screen fixed left-0 top-0 z-10">
      {/* Logo/Header */}
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900">Bookd</h1>
        <p className="text-sm text-gray-500 mt-1">Work different</p>
      </div>

      {/* Add Gig Button */}
      <div className="p-4 border-b border-gray-200">
        <Button
          onClick={() => onScreenChange("gig-form")}
          className="w-full bg-primary hover:bg-primary/90 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Gig
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

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        <p className="text-xs text-gray-500 text-center">
          Desktop Version
        </p>
      </div>
    </div>
  );
}