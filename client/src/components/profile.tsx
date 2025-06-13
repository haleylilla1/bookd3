import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { User, Plus, X, Percent, Save, Edit2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { User as UserType } from "@shared/schema";

export default function Profile() {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [editedTaxPercentage, setEditedTaxPercentage] = useState("");
  const [newGigType, setNewGigType] = useState("");
  const [isAddingGigType, setIsAddingGigType] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: user } = useQuery<UserType>({
    queryKey: ["/api/user"],
  });

  const updateUserMutation = useMutation({
    mutationFn: async (userData: Partial<UserType>) => {
      const response = await apiRequest("PUT", "/api/user", userData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Success",
        description: "Profile updated successfully!",
      });
      setIsEditing(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleStartEdit = () => {
    setIsEditing(true);
    setEditedName(user?.name || "");
    setEditedTaxPercentage(user?.defaultTaxPercentage?.toString() || "23");
  };

  const handleSave = () => {
    const taxPercentage = parseInt(editedTaxPercentage);
    if (isNaN(taxPercentage) || taxPercentage < 0 || taxPercentage > 100) {
      toast({
        title: "Invalid Tax Percentage",
        description: "Please enter a valid percentage between 0 and 100.",
        variant: "destructive",
      });
      return;
    }

    updateUserMutation.mutate({
      name: editedName,
      defaultTaxPercentage: taxPercentage,
    });
  };

  const handleAddGigType = () => {
    if (!newGigType.trim()) return;
    
    const currentTypes = user?.customGigTypes || [];
    if (currentTypes.includes(newGigType.trim())) {
      toast({
        title: "Duplicate Gig Type",
        description: "This gig type already exists.",
        variant: "destructive",
      });
      return;
    }

    updateUserMutation.mutate({
      customGigTypes: [...currentTypes, newGigType.trim()],
    });
    
    setNewGigType("");
    setIsAddingGigType(false);
  };

  const handleRemoveGigType = (gigTypeToRemove: string) => {
    const currentTypes = user?.customGigTypes || [];
    updateUserMutation.mutate({
      customGigTypes: currentTypes.filter(type => type !== gigTypeToRemove),
    });
  };

  if (!user) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
          <User className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
          <p className="text-gray-600">Manage your account settings</p>
        </div>
      </div>

      {/* Basic Information */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg">Basic Information</CardTitle>
          {!isEditing && (
            <Button variant="ghost" size="sm" onClick={handleStartEdit}>
              <Edit2 className="w-4 h-4" />
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {isEditing ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  placeholder="Enter your name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="taxPercentage">Default Tax Percentage</Label>
                <div className="relative">
                  <Input
                    id="taxPercentage"
                    type="number"
                    min="0"
                    max="100"
                    value={editedTaxPercentage}
                    onChange={(e) => setEditedTaxPercentage(e.target.value)}
                    placeholder="23"
                    className="pr-8"
                  />
                  <Percent className="w-4 h-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                </div>
                <p className="text-sm text-gray-600">
                  This percentage will be used as default for new gigs, but can be adjusted per gig.
                </p>
              </div>
              
              <div className="flex gap-2 pt-2">
                <Button onClick={handleSave} disabled={updateUserMutation.isPending}>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-3">
                <div>
                  <Label className="text-sm text-gray-600">Name</Label>
                  <p className="text-lg font-medium text-gray-900">{user.name}</p>
                </div>
                
                <div>
                  <Label className="text-sm text-gray-600">Email</Label>
                  <p className="text-gray-900">{user.email}</p>
                </div>
                
                <div>
                  <Label className="text-sm text-gray-600">Default Tax Percentage</Label>
                  <div className="flex items-center gap-2">
                    <p className="text-gray-900">{user.defaultTaxPercentage || 23}%</p>
                    <Badge variant="secondary" className="text-xs">
                      Applied to new gigs
                    </Badge>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Gig Types */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-lg">Your Gig Types</CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Custom gig types for faster entry when logging gigs
            </p>
          </div>
          <Dialog open={isAddingGigType} onOpenChange={setIsAddingGigType}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Type
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Add Gig Type</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="gigType">Gig Type Name</Label>
                  <Input
                    id="gigType"
                    value={newGigType}
                    onChange={(e) => setNewGigType(e.target.value)}
                    placeholder="e.g., Brand Ambassador, Event Staff..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleAddGigType();
                      }
                    }}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAddGigType} disabled={!newGigType.trim()}>
                    Add Type
                  </Button>
                  <Button variant="outline" onClick={() => setIsAddingGigType(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {user.customGigTypes && user.customGigTypes.length > 0 ? (
            <div className="space-y-2">
              {user.customGigTypes.map((gigType, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <span className="font-medium text-gray-900">{gigType}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveGigType(gigType)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Plus className="w-6 h-6 text-gray-400" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">No Gig Types Added</h4>
              <p className="text-gray-600 mb-4">
                Add your common gig types for faster entry when logging gigs.
              </p>
              <Button onClick={() => setIsAddingGigType(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Gig Type
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Account Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="p-4 bg-primary/5 rounded-lg">
              <p className="text-2xl font-bold text-primary">
                {user.customGigTypes?.length || 0}
              </p>
              <p className="text-sm text-gray-600">Gig Types</p>
            </div>
            <div className="p-4 bg-secondary/5 rounded-lg">
              <p className="text-2xl font-bold text-secondary">
                {user.defaultTaxPercentage || 23}%
              </p>
              <p className="text-sm text-gray-600">Default Tax Rate</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}