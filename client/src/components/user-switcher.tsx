import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { UserIcon, PlusIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface UserSwitcherProps {
  currentUser: any;
  onUserChange: () => void;
}

export default function UserSwitcher({ currentUser, onUserChange }: UserSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [switchUserId, setSwitchUserId] = useState("");
  const { toast } = useToast();

  const handleCreateUser = async () => {
    // SECURITY: User creation disabled - must use proper authentication
    toast({
      title: "Security Notice", 
      description: "Account creation must go through proper authentication. Please use the login/register flow.",
      variant: "destructive"
    });
  };

  const handleSwitchUser = async () => {
    try {
      const userId = parseInt(switchUserId);
      const response = await fetch("/api/switch-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      });
      const data = await response.json();
      
      toast({
        title: "User Switched",
        description: `Switched to ${data.user.name}`
      });
      
      setSwitchUserId("");
      setIsOpen(false);
      onUserChange();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to switch user",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <UserIcon className="h-4 w-4" />
        <span>{currentUser?.name || "Unknown User"}</span>
      </div>
      
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm">
            Switch User
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>User Management</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Create New User</h4>
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Enter your name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="Enter your email"
                />
              </div>
              <Button 
                onClick={handleCreateUser}
                disabled={!newUserName.trim()}
                className="w-full"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Create User
              </Button>
            </div>

            <div className="border-t pt-4 space-y-3">
              <h4 className="text-sm font-medium">Switch to Existing User</h4>
              <div className="space-y-2">
                <Label htmlFor="userId">User ID</Label>
                <Input
                  id="userId"
                  value={switchUserId}
                  onChange={(e) => setSwitchUserId(e.target.value)}
                  placeholder="Enter user ID (e.g., 1, 2, 3)"
                  type="number"
                />
              </div>
              <Button 
                onClick={handleSwitchUser}
                disabled={!switchUserId.trim()}
                variant="outline"
                className="w-full"
              >
                Switch User
              </Button>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Current User:</strong> {currentUser?.name} (ID: {currentUser?.id})</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}