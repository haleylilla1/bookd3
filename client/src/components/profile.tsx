import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { User, Plus, X, Percent, Edit2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { User as UserType } from "@shared/schema";

export default function Profile() {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [editedTaxPercentage, setEditedTaxPercentage] = useState("");
  const [editedHomeAddress, setEditedHomeAddress] = useState("");
  const [editedBusinessName, setEditedBusinessName] = useState("");
  const [editedBusinessAddress, setEditedBusinessAddress] = useState("");
  const [editedBusinessPhone, setEditedBusinessPhone] = useState("");
  const [editedBusinessEmail, setEditedBusinessEmail] = useState("");
  const [newGigType, setNewGigType] = useState("");
  const [isAddingGigType, setIsAddingGigType] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: user } = useQuery<UserType>({
    queryKey: ["/api/user"],
  });

  // Initialize form fields when user data loads
  useEffect(() => {
    if (user && !isEditing) {
      // Pre-populate form fields with current user data for better UX
    }
  }, [user, isEditing]);

  const updateUserMutation = useMutation({
    mutationFn: async (userData: Partial<UserType>) => {
      const response = await apiRequest("PUT", "/api/user", userData);
      return response.json();
    },
    onSuccess: async (data) => {
      console.log("🔄 User update successful, data returned:", data);
      
      // Clear React Query cache for user data
      queryClient.removeQueries({ queryKey: ["/api/user"] });
      
      // Force immediate refetch of user data
      await queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      
      // Set the updated data directly in cache to ensure immediate UI update
      queryClient.setQueryData(["/api/user"], data);
      
      console.log("✅ Cache updated with new user data:", data);
      
      toast({
        title: "Success",
        description: "Successfully added to your profile!",
      });
      setIsEditing(false);
      setNewGigType("");
      setIsAddingGigType(false);
    },
    onError: (error) => {
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
    setEditedHomeAddress(user?.homeAddress || "");
    setEditedBusinessName(user?.businessName || "");
    setEditedBusinessAddress(user?.businessAddress || "");
    setEditedBusinessPhone(user?.businessPhone || "");
    setEditedBusinessEmail(user?.businessEmail || "");
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
      homeAddress: editedHomeAddress,
      businessName: editedBusinessName,
      businessAddress: editedBusinessAddress,
      businessPhone: editedBusinessPhone,
      businessEmail: editedBusinessEmail,
    });
  };

  const handleAddGigType = () => {
    if (!newGigType.trim()) {
      toast({
        title: "Missing Gig Type",
        description: "Please enter a gig type name.",
        variant: "destructive",
      });
      return;
    }
    
    const currentTypes = user?.customGigTypes || [];
    const trimmedType = newGigType.trim();
    
    if (currentTypes.includes(trimmedType)) {
      toast({
        title: "Duplicate Gig Type",
        description: "This gig type already exists.",
        variant: "destructive",
      });
      return;
    }

    // Add new gig type to user's custom list
    
    updateUserMutation.mutate({
      customGigTypes: [...currentTypes, trimmedType],
    });
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
                <Label htmlFor="homeAddress">Home Address</Label>
                <Input
                  id="homeAddress"
                  value={editedHomeAddress}
                  onChange={(e) => setEditedHomeAddress(e.target.value)}
                  placeholder="Enter your home address"
                />
                <p className="text-sm text-gray-600">
                  Used to calculate distances and mileage to gig locations.
                </p>
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
                  This percentage will be used as default for new gigs.
                </p>
              </div>

              {/* Business Information Section */}
              <div className="pt-4 border-t">
                <h3 className="text-md font-semibold mb-4">Business Information</h3>
                <p className="text-sm text-gray-600 mb-4">
                  These details will be used for your tax reports.
                </p>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="businessName">Business Name</Label>
                    <Input
                      id="businessName"
                      value={editedBusinessName}
                      onChange={(e) => setEditedBusinessName(e.target.value)}
                      placeholder="Your business or freelance name"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="businessAddress">Business Address</Label>
                    <Input
                      id="businessAddress"
                      value={editedBusinessAddress}
                      onChange={(e) => setEditedBusinessAddress(e.target.value)}
                      placeholder="Business address for tax reports"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="businessPhone">Business Phone</Label>
                      <Input
                        id="businessPhone"
                        value={editedBusinessPhone}
                        onChange={(e) => setEditedBusinessPhone(e.target.value)}
                        placeholder="(555) 123-4567"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="businessEmail">Business Email</Label>
                      <Input
                        id="businessEmail"
                        type="email"
                        value={editedBusinessEmail}
                        onChange={(e) => setEditedBusinessEmail(e.target.value)}
                        placeholder="business@example.com"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleSave} disabled={updateUserMutation.isPending}>
                  {updateUserMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-gray-500">Name</Label>
                    <p className="text-gray-900 font-medium">{user.name || "Not set"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Default Tax Rate</Label>
                    <p className="text-gray-900 font-medium">{user.defaultTaxPercentage || 23}%</p>
                  </div>
                </div>
                
                <div>
                  <Label className="text-xs text-gray-500">Home Address</Label>
                  <p className="text-gray-900">{user.homeAddress || "Not set"}</p>
                  {user.homeAddress && (
                    <p className="text-xs text-gray-500 mt-1">
                      Used for mileage calculations
                    </p>
                  )}
                </div>

                {/* Business Information Display */}
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-900">Business Information</h4>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs text-gray-500">Business Name</Label>
                      <p className="text-gray-900">{user.businessName || "Not set"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Business Address</Label>
                      <p className="text-gray-900">{user.businessAddress || "Not set"}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-gray-500">Business Phone</Label>
                        <p className="text-gray-900">{user.businessPhone || "Not set"}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Business Email</Label>
                        <p className="text-gray-900">{user.businessEmail || "Not set"}</p>
                      </div>
                    </div>
                    {(user.businessName || user.businessAddress || user.businessPhone || user.businessEmail) && (
                      <p className="text-xs text-gray-500 mt-1">
                        Used in tax reports
                      </p>
                    )}
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
            <DialogContent className="max-w-sm mx-4">
              <DialogHeader>
                <DialogTitle>Add Gig Type</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Gig Type Name</label>
                  <input
                    type="text"
                    value={newGigType}
                    onChange={(e) => setNewGigType(e.target.value)}
                    placeholder="e.g., Brand Ambassador, Event Staff..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleAddGigType();
                      }
                    }}
                    disabled={updateUserMutation.isPending}
                    style={{
                      width: '100%',
                      height: '48px',
                      fontSize: '16px',
                      padding: '12px 16px',
                      border: '2px solid #d1d5db',
                      borderRadius: '6px',
                      backgroundColor: '#ffffff',
                      color: '#000000',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={handleAddGigType} 
                    disabled={!newGigType.trim() || updateUserMutation.isPending}
                    className="flex-1"
                  >
                    {updateUserMutation.isPending ? "Adding..." : "Add Type"}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setIsAddingGigType(false);
                      setNewGigType("");
                    }}
                    disabled={updateUserMutation.isPending}
                    className="flex-1"
                  >
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
    </div>
  );
}