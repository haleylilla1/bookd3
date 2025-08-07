import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { User, Upload, FileText, Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { User as UserType } from "@shared/schema";

export default function BAProfile() {
  const [isEditing, setIsEditing] = useState(false);
  const [editedBio, setEditedBio] = useState("");
  const [newCity, setNewCity] = useState("");
  
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
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/user"], data);
      toast({
        title: "Success",
        description: "BA profile updated successfully!",
      });
      setIsEditing(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update BA profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleStartEdit = () => {
    setIsEditing(true);
    setEditedBio(user?.bio || "");
  };

  const handleSave = () => {
    updateUserMutation.mutate({
      bio: editedBio,
    });
  };

  const handleAddCity = () => {
    if (!newCity.trim()) {
      toast({
        title: "Missing City",
        description: "Please enter a city name.",
        variant: "destructive",
      });
      return;
    }
    
    const currentCities = user?.preferredCities || [];
    const trimmedCity = newCity.trim();
    
    if (currentCities.includes(trimmedCity)) {
      toast({
        title: "Duplicate City",
        description: "This city is already in your list.",
        variant: "destructive",
      });
      return;
    }

    updateUserMutation.mutate({
      preferredCities: [...currentCities, trimmedCity],
    });
    setNewCity("");
  };

  const handleRemoveCity = (cityToRemove: string) => {
    const currentCities = user?.preferredCities || [];
    updateUserMutation.mutate({
      preferredCities: currentCities.filter(city => city !== cityToRemove),
    });
  };

  if (!user) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <User className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">BA Profile</h1>
            <p className="text-gray-600">Your brand ambassador profile for emergency gigs</p>
          </div>
        </div>
        {!isEditing && (
          <Button onClick={handleStartEdit} className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Edit Profile
          </Button>
        )}
      </div>

      {/* Bio Section */}
      <Card>
        <CardHeader>
          <CardTitle>Bio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isEditing ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="bio">Tell agencies about your experience</Label>
                <Textarea
                  id="bio"
                  value={editedBio}
                  onChange={(e) => setEditedBio(e.target.value)}
                  placeholder="Describe your experience as a brand ambassador, skills, and what makes you great for events..."
                  rows={4}
                  className="text-base"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={updateUserMutation.isPending}>
                  Save Changes
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div>
              {user.bio ? (
                <p className="text-gray-700 leading-relaxed">{user.bio}</p>
              ) : (
                <p className="text-gray-500 italic">No bio added yet. Click "Edit Profile" to add your experience.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Headshots Section */}
      <Card>
        <CardHeader>
          <CardTitle>Headshots</CardTitle>
        </CardHeader>
        <CardContent>
          {user.headshotUrls && user.headshotUrls.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {user.headshotUrls.map((url, index) => (
                <div key={index} className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                  <img src={url} alt={`Headshot ${index + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No headshots uploaded yet</p>
              <Button className="mt-2" variant="outline">
                <Upload className="w-4 h-4 mr-2" />
                Upload Headshots
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resume Section */}
      <Card>
        <CardHeader>
          <CardTitle>Resume</CardTitle>
        </CardHeader>
        <CardContent>
          {user.resumeUrl ? (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <FileText className="w-8 h-8 text-primary" />
              <div className="flex-1">
                <p className="font-medium">Resume uploaded</p>
                <p className="text-sm text-gray-600">Ready to send to agencies</p>
              </div>
              <Button variant="outline" size="sm">
                Replace
              </Button>
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No resume uploaded yet</p>
              <Button className="mt-2" variant="outline">
                <Upload className="w-4 h-4 mr-2" />
                Upload Resume
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preferred Cities */}
      <Card>
        <CardHeader>
          <CardTitle>Preferred Cities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">Select cities where you want to receive emergency gig notifications</p>
          
          {/* Current Cities */}
          {user.preferredCities && user.preferredCities.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {user.preferredCities.map((city) => (
                <div key={city} className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full">
                  <span className="text-sm font-medium">{city}</span>
                  <button 
                    onClick={() => handleRemoveCity(city)}
                    className="text-primary hover:text-primary/80"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add New City */}
          <div className="flex gap-2">
            <Input
              value={newCity}
              onChange={(e) => setNewCity(e.target.value)}
              placeholder="Enter city name"
              className="text-base"
              onKeyPress={(e) => e.key === 'Enter' && handleAddCity()}
            />
            <Button onClick={handleAddCity} disabled={updateUserMutation.isPending}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Emergency Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Emergency Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Receive emergency gig alerts</p>
              <p className="text-sm text-gray-600">Get notified when new emergency gigs are posted in your preferred cities</p>
            </div>
            <Button 
              variant={user.emergencyNotifications ? "default" : "outline"}
              onClick={() => updateUserMutation.mutate({
                emergencyNotifications: !user.emergencyNotifications
              })}
            >
              {user.emergencyNotifications ? "Enabled" : "Disabled"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}