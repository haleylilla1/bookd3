import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Plus, X, Percent, Save, Edit2, Tags, Trash2, DollarSign, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { User as UserType, ExpenseCategory } from "@shared/schema";

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
  
  // Category management state
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newSubcategory, setNewSubcategory] = useState("");
  const [selectedCategoryForSub, setSelectedCategoryForSub] = useState<number | null>(null);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [isAddingSubcategory, setIsAddingSubcategory] = useState(false);
  const [editingDefaults, setEditingDefaults] = useState<number | null>(null);
  const [defaultAmounts, setDefaultAmounts] = useState<Record<string, { amount: string; type: "constant" | "variable" }>>({});
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: user } = useQuery<UserType>({
    queryKey: ["/api/user"],
  });

  const { data: categories = [] } = useQuery<ExpenseCategory[]>({
    queryKey: ["/api/expense-categories"],
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

  // Category management mutations
  const addCategoryMutation = useMutation({
    mutationFn: async (categoryData: { name: string; subcategories: string[] }) => {
      return await apiRequest("/api/expense-categories", "POST", categoryData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expense-categories"] });
      toast({
        title: "Category Added",
        description: "New expense category has been created.",
      });
      setNewCategoryName("");
      setIsAddingCategory(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add category. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, ...updateData }: { id: number; subcategories?: string[]; subcategoryDefaults?: Record<string, { amount: string; type: "constant" | "variable" }> }) => {
      return await apiRequest(`/api/expense-categories/${id}`, "PATCH", updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expense-categories"] });
      toast({
        title: "Category Updated",
        description: "Subcategories have been updated.",
      });
      setNewSubcategory("");
      setSelectedCategoryForSub(null);
      setIsAddingSubcategory(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update category. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/expense-categories/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expense-categories"] });
      toast({
        title: "Category Deleted",
        description: "Expense category has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete category. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    
    const categoryExists = categories.some(cat => 
      cat.name.toLowerCase() === newCategoryName.trim().toLowerCase()
    );
    
    if (categoryExists) {
      toast({
        title: "Duplicate Category",
        description: "This category already exists.",
        variant: "destructive",
      });
      return;
    }

    addCategoryMutation.mutate({
      name: newCategoryName.trim(),
      subcategories: []
    });
  };

  const handleAddSubcategory = () => {
    if (!newSubcategory.trim() || !selectedCategoryForSub) return;
    
    const category = categories.find(cat => cat.id === selectedCategoryForSub);
    if (!category) return;

    const currentSubs = category.subcategories || [];
    if (currentSubs.includes(newSubcategory.trim())) {
      toast({
        title: "Duplicate Subcategory",
        description: "This subcategory already exists.",
        variant: "destructive",
      });
      return;
    }

    updateCategoryMutation.mutate({
      id: selectedCategoryForSub,
      subcategories: [...currentSubs, newSubcategory.trim()]
    });
  };

  const handleUpdateDefaults = (categoryId: number) => {
    updateCategoryMutation.mutate({
      id: categoryId,
      subcategoryDefaults: defaultAmounts
    } as any);
    setEditingDefaults(null);
    setDefaultAmounts({});
  };

  const startEditingDefaults = (category: ExpenseCategory) => {
    setEditingDefaults(category.id);
    const defaults = category.subcategoryDefaults as Record<string, { amount: string; type: "constant" | "variable" }> || {};
    setDefaultAmounts(defaults);
  };

  const handleRemoveSubcategory = (categoryId: number, subcategoryToRemove: string) => {
    const category = categories.find(cat => cat.id === categoryId);
    if (!category) return;

    const updatedSubs = (category.subcategories || []).filter(sub => sub !== subcategoryToRemove);
    updateCategoryMutation.mutate({
      id: categoryId,
      subcategories: updatedSubs
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
                  This percentage will be used as default for new gigs and invoices.
                </p>
              </div>

              {/* Business Information Section */}
              <div className="pt-4 border-t">
                <h3 className="text-md font-semibold mb-4">Business Information</h3>
                <p className="text-sm text-gray-600 mb-4">
                  These details will automatically populate in your invoices.
                </p>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="businessName">Business Name</Label>
                    <Input
                      id="businessName"
                      value={editedBusinessName}
                      onChange={(e) => setEditedBusinessName(e.target.value)}
                      placeholder="Your Business or Professional Name"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="businessAddress">Business Address</Label>
                    <Input
                      id="businessAddress"
                      value={editedBusinessAddress}
                      onChange={(e) => setEditedBusinessAddress(e.target.value)}
                      placeholder="123 Business St, City, State 12345"
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
                        placeholder="hello@yourbusiness.com"
                      />
                    </div>
                  </div>
                </div>
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
                  <Label className="text-sm text-gray-600">Home Address</Label>
                  <p className="text-gray-900">{user.homeAddress || "Not set"}</p>
                  {user.homeAddress && (
                    <p className="text-xs text-gray-500 mt-1">
                      Used for distance calculations to gig locations
                    </p>
                  )}
                </div>
                
                <div>
                  <Label className="text-sm text-gray-600">Default Tax Percentage</Label>
                  <div className="flex items-center gap-2">
                    <p className="text-gray-900">{user.defaultTaxPercentage || 23}%</p>
                    <Badge variant="secondary" className="text-xs">
                      Applied to new gigs & invoices
                    </Badge>
                  </div>
                </div>

                {/* Business Information Display */}
                <div className="pt-4 border-t">
                  <Label className="text-sm text-gray-600 font-medium">Business Information</Label>
                  <div className="mt-2 space-y-2">
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
                        Auto-populates in invoice generator
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

      {/* Budget Categories */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-lg">Budget Categories</CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Customize expense categories and subcategories for budget tracking
            </p>
          </div>
          <Dialog open={isAddingCategory} onOpenChange={setIsAddingCategory}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Category
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Add Budget Category</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="categoryName">Category Name</Label>
                  <Input
                    id="categoryName"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="e.g., Housing, Transportation"
                    onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={handleAddCategory} 
                    disabled={!newCategoryName.trim() || addCategoryMutation.isPending}
                    className="flex-1"
                  >
                    {addCategoryMutation.isPending ? "Adding..." : "Add Category"}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setNewCategoryName("");
                      setIsAddingCategory(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {categories.length > 0 ? (
            <div className="space-y-4">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="p-4 border border-gray-200 rounded-lg"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Tags className="w-4 h-4 text-gray-500" />
                      <span className="font-medium text-gray-900">{category.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {(category.subcategories || []).length} subcategories
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Dialog 
                        open={isAddingSubcategory && selectedCategoryForSub === category.id} 
                        onOpenChange={(open) => {
                          setIsAddingSubcategory(open);
                          if (open) setSelectedCategoryForSub(category.id);
                          else setSelectedCategoryForSub(null);
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Plus className="w-3 h-3 mr-1" />
                            Add Sub
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-sm">
                          <DialogHeader>
                            <DialogTitle>Add Subcategory to {category.name}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="subcategoryName">Subcategory Name</Label>
                              <Input
                                id="subcategoryName"
                                value={newSubcategory}
                                onChange={(e) => setNewSubcategory(e.target.value)}
                                placeholder="e.g., Rent, Utilities"
                                onKeyPress={(e) => e.key === 'Enter' && handleAddSubcategory()}
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button 
                                onClick={handleAddSubcategory} 
                                disabled={!newSubcategory.trim() || updateCategoryMutation.isPending}
                                className="flex-1"
                              >
                                {updateCategoryMutation.isPending ? "Adding..." : "Add"}
                              </Button>
                              <Button 
                                variant="outline" 
                                onClick={() => {
                                  setNewSubcategory("");
                                  setSelectedCategoryForSub(null);
                                  setIsAddingSubcategory(false);
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEditingDefaults(category)}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        <DollarSign className="w-3 h-3 mr-1" />
                        Set Budgets
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteCategoryMutation.mutate(category.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  
                  {category.subcategories && category.subcategories.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {category.subcategories.map((subcategory, index) => {
                          const defaults = category.subcategoryDefaults as Record<string, { amount: string; type: "constant" | "variable" }> || {};
                          const subcategoryDefault = defaults[subcategory];
                          
                          return (
                            <div
                              key={index}
                              className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-sm"
                            >
                              <span>{subcategory}</span>
                              {subcategoryDefault && (
                                <Badge variant="outline" className="text-xs ml-1">
                                  ${subcategoryDefault.amount} ({subcategoryDefault.type})
                                </Badge>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveSubcategory(category.id, subcategory)}
                                className="h-4 w-4 p-0 text-gray-500 hover:text-red-600"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Simplified budget defaults interface */}
                      {editingDefaults === category.id && (
                        <div className="mt-4 p-3 border rounded-lg bg-blue-50">
                          <div className="flex items-center justify-between mb-3">
                            <h5 className="font-medium text-gray-900">Budget Defaults</h5>
                            <div className="flex gap-2">
                              <Button 
                                onClick={() => handleUpdateDefaults(category.id)}
                                disabled={updateCategoryMutation.isPending}
                                size="sm"
                              >
                                Save
                              </Button>
                              <Button 
                                variant="outline"
                                onClick={() => {
                                  setEditingDefaults(null);
                                  setDefaultAmounts({});
                                }}
                                size="sm"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {category.subcategories.map((subcategory, index) => {
                              const currentDefault = defaultAmounts[subcategory] || { amount: "", type: "variable" };
                              return (
                                <div key={index} className="flex items-center gap-3 p-2 bg-white rounded border">
                                  <div className="flex-1 text-sm font-medium">{subcategory}</div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-500">$</span>
                                    <Input
                                      type="number"
                                      placeholder="0"
                                      value={currentDefault.amount}
                                      onChange={(e) => setDefaultAmounts({
                                        ...defaultAmounts,
                                        [subcategory]: {
                                          ...defaultAmounts[subcategory],
                                          amount: e.target.value,
                                          type: defaultAmounts[subcategory]?.type || "variable"
                                        }
                                      })}
                                      className="w-20 h-8 text-sm"
                                    />
                                    <Select
                                      value={currentDefault.type}
                                      onValueChange={(value: "constant" | "variable") => setDefaultAmounts({
                                        ...defaultAmounts,
                                        [subcategory]: {
                                          ...defaultAmounts[subcategory],
                                          amount: defaultAmounts[subcategory]?.amount || "",
                                          type: value
                                        }
                                      })}
                                    >
                                      <SelectTrigger className="w-24 h-8 text-sm">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="constant">Fixed</SelectItem>
                                        <SelectItem value="variable">Variable</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            Fixed amounts (like rent) stay the same monthly. Variable amounts can be adjusted each month.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Tags className="w-6 h-6 text-gray-400" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">No Categories Added</h4>
              <p className="text-gray-600 mb-4">
                Create custom categories to organize your expenses and budgets.
              </p>
              <Button onClick={() => setIsAddingCategory(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Category
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