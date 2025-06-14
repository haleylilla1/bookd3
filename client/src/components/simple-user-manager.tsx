import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, LogIn } from "lucide-react";

interface SimpleUserManagerProps {
  currentUser: any;
  onUserChange: () => void;
}

export default function SimpleUserManager({ currentUser, onUserChange }: SimpleUserManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [switchUserId, setSwitchUserId] = useState("");
  const { toast } = useToast();

  const handleCreateUser = async () => {
    try {
      const response = await fetch("/api/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newUserName || "New User",
          email: `${newUserName.toLowerCase().replace(/\s+/g, '')}@example.com`
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Account Created",
          description: `Welcome ${data.user.name}! You can now start tracking your gigs.`
        });
        
        setNewUserName("");
        setIsOpen(false);
        onUserChange();
      } else {
        throw new Error("Failed to create user");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create new account",
        variant: "destructive"
      });
    }
  };

  const handleSwitchToUser = async (userId: number) => {
    try {
      const response = await fetch("/api/switch-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      });
      
      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Switched Account",
          description: `Now viewing ${data.user.name}'s data`
        });
        
        setIsOpen(false);
        onUserChange();
      } else {
        throw new Error("Failed to switch user");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to switch account",
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Users className="w-4 h-4" />
          <span className="hidden sm:inline">Multi-User</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>User Management</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="text-sm text-gray-600">
            Current user: <strong>{currentUser?.name || "User 1"}</strong>
          </div>
          
          {/* Create New User */}
          <div className="space-y-3">
            <h3 className="font-medium flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create New Account
            </h3>
            <div className="space-y-2">
              <Label htmlFor="newUserName">Name</Label>
              <Input
                id="newUserName"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="Enter name (e.g., Sarah)"
              />
            </div>
            <Button onClick={handleCreateUser} className="w-full">
              Create Account
            </Button>
          </div>

          {/* Quick Switch */}
          <div className="space-y-3">
            <h3 className="font-medium flex items-center gap-2">
              <LogIn className="w-4 h-4" />
              Quick Switch
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant="outline" 
                onClick={() => handleSwitchToUser(1)}
                disabled={currentUser?.id === 1}
              >
                User 1 (Haley)
              </Button>
              <Button 
                variant="outline" 
                onClick={() => handleSwitchToUser(2)}
                disabled={currentUser?.id === 2}
              >
                User 2
              </Button>
            </div>
          </div>

          <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded">
            <strong>For Testing:</strong> Create a new account for your friend so she can test the app with her own data separate from yours.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}