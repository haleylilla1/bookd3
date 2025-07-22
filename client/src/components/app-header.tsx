import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useSupabaseProxyAuth";
import { 
  User, 
  Settings, 
  Download, 
  LogOut, 
  Crown,
  Calendar,
  Target,
  BarChart3
} from "lucide-react";

interface AppHeaderProps {
  currentScreen: string;
  onScreenChange: (screen: any) => void;
}

export default function AppHeader({ currentScreen, onScreenChange }: AppHeaderProps) {
  const { user, signOutMutation } = useAuth();
  const [, setLocation] = useLocation();

  if (!user) return null;

  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getSubscriptionBadge = () => {
    // No subscription tiers in Supabase proxy auth yet
    return null;
  };

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Logo and Navigation */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm"> </span>
            </div>
            <span className="font-bold text-xl text-gray-900">bookd</span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            <Button
              variant={currentScreen === 'dashboard' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onScreenChange('dashboard')}
              className="gap-2"
            >
              <BarChart3 className="w-4 h-4" />
              Dashboard
            </Button>
            <Button
              variant={currentScreen === 'calendar' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onScreenChange('calendar')}
              className="gap-2"
            >
              <Calendar className="w-4 h-4" />
              Calendar
            </Button>


          </nav>
        </div>

        {/* User Menu */}
        <div className="flex items-center gap-3">
          {getSubscriptionBadge()}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={undefined} alt={user.name || user.email} />
                  <AvatarFallback className="bg-blue-100 text-blue-700">
                    {getInitials(user.name || user.email)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user.name || user.email}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              <DropdownMenuItem onClick={() => setLocation('/profile')}>
                <User className="mr-2 h-4 w-4" />
                <span>Profile Settings</span>
              </DropdownMenuItem>
              
              <DropdownMenuItem onClick={() => onScreenChange('settings')}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              <DropdownMenuItem disabled>
                <Download className="mr-2 h-4 w-4" />
                <span>Export Data (Coming Soon)</span>
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              <DropdownMenuItem onClick={() => signOutMutation.mutate()} disabled={signOutMutation.isPending}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>{signOutMutation.isPending ? 'Signing out...' : 'Sign out'}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}