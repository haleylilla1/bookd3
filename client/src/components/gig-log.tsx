import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit2, Trash2, Filter, Calendar, DollarSign, Clock } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Gig } from "@shared/schema";
import GotPaidDialog, { type GotPaidData } from "./got-paid-dialog";

export default function GigLog() {
  const [editingGig, setEditingGig] = useState<Gig | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [gotPaidGig, setGotPaidGig] = useState<Gig | null>(null);
  const [showGotPaidDialog, setShowGotPaidDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: gigsResponse, isLoading } = useQuery<{ gigs: Gig[], total: number }>({
    queryKey: ["/api/gigs"],
  });

  const gigs = gigsResponse?.gigs || [];

  const updateGigMutation = useMutation({
    mutationFn: async (gigData: { id: number; data: Partial<Gig> }) => {
      const response = await apiRequest("PUT", `/api/gigs/${gigData.id}`, gigData.data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gigs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Success",
        description: "Gig updated successfully!",
      });
      setEditingGig(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update gig. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteGigMutation = useMutation({
    mutationFn: async (gigId: number) => {
      await apiRequest("DELETE", `/api/gigs/${gigId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gigs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Success",
        description: "Gig deleted successfully!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete gig. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Filter and search gigs
  const filteredGigs = gigs
    .filter(gig => {
      if (filterStatus !== "all" && gig.status !== filterStatus) return false;
      if (searchQuery && !gig.clientName.toLowerCase().includes(searchQuery.toLowerCase()) && 
          !gig.gigType.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 border-green-200";
      case "pending_payment":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "upcoming":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "completed":
        return "Completed";
      case "pending_payment":
        return "Pending Payment";
      case "upcoming":
        return "Upcoming";
      default:
        return status;
    }
  };

  const handleEditGig = (gig: Gig) => {
    setEditingGig(gig);
  };

  // Handle "Got Paid" workflow
  const handleGotPaid = (gig: Gig) => {
    setGotPaidGig(gig);
    setShowGotPaidDialog(true);
  };

  // Mutation for "Got Paid" workflow
  const gotPaidMutation = useMutation({
    mutationFn: async ({ gigId, data }: { gigId: number; data: GotPaidData }) => {
      const response = await apiRequest("POST", `/api/gigs/${gigId}/got-paid`, data);
      if (!response.ok) {
        throw new Error("Failed to process payment");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gigs"] });
      toast({
        title: "Payment processed",
        description: "Tax-smart calculations have been saved.",
      });
      setShowGotPaidDialog(false);
      setGotPaidGig(null);
    },
    onError: (error: any) => {
      console.error("Got paid error:", error);
      toast({
        title: "Error processing payment",
        description: "Please try again or contact support.",
        variant: "destructive",
      });
    },
  });

  const handleSaveEdit = (updatedData: Partial<Gig>) => {
    if (!editingGig) return;

    // Prepare update payload with safe numeric parsing
    const updatePayload: any = {
      clientName: updatedData.clientName?.trim() || editingGig.clientName,
      gigType: updatedData.gigType?.trim() || editingGig.gigType,
      date: updatedData.date || editingGig.date,
      status: updatedData.status || editingGig.status,
      duties: updatedData.duties || null,
      paymentMethod: updatedData.paymentMethod || null,
    };
    
    // Safe numeric conversions
    const safeParseFloat = (value: any): string | null => {
      if (value === "" || value === null || value === undefined) return null;
      const parsed = parseFloat(String(value));
      return isNaN(parsed) ? null : parsed.toString();
    };
    
    updatePayload.expectedPay = safeParseFloat(updatedData.expectedPay);
    updatePayload.actualPay = safeParseFloat(updatedData.actualPay);
    updatePayload.tips = safeParseFloat(updatedData.tips);

    console.log("Saving gig edit:", updatePayload); // Debug log
    
    updateGigMutation.mutate({
      id: editingGig.id,
      data: updatePayload,
    });
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-gray-200 animate-pulse h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Gig Log</h2>
        <Badge variant="secondary" className="bg-primary/10 text-primary">
          {filteredGigs.length} gigs
        </Badge>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1">
          <Input
            placeholder="Search by client or gig type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-40">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="pending_payment">Pending Payment</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Gigs List */}
      <div className="space-y-3">
        {filteredGigs.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Gigs Found</h3>
              <p className="text-gray-600">
                {searchQuery || filterStatus !== "all" 
                  ? "No gigs match your current filters." 
                  : "You haven't logged any gigs yet."}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredGigs.map((gig) => (
            <Card key={gig.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{gig.clientName}</h3>
                    <Badge className={getStatusColor(gig.status)}>
                      {getStatusLabel(gig.status)}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-gray-600 mb-3">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatDate(gig.date)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {gig.gigType.replace("-", " ").replace(/\b\w/g, l => l.toUpperCase())}
                    </div>
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      {(() => {
                        const actualPay = gig.actualPay ? parseFloat(gig.actualPay) : 0;
                        const expectedPay = gig.expectedPay ? parseFloat(gig.expectedPay) : 0;
                        
                        if (actualPay > 0) {
                          return formatCurrency(actualPay);
                        } else if (expectedPay > 0) {
                          return `${formatCurrency(expectedPay)} (expected)`;
                        } else {
                          return "No pay set";
                        }
                      })()}
                    </div>
                  </div>

                  {gig.duties && (
                    <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                      {gig.duties}
                    </p>
                  )}

                  {/* Action Buttons - Mobile Optimized Layout */}
                  <div className="flex flex-col gap-2 pt-2">
                    {gig.status !== 'completed' && (
                      <div className="flex justify-center">
                        <Button
                          variant="default"
                          onClick={() => handleGotPaid(gig)}
                          className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 text-sm h-auto"
                        >
                          <DollarSign className="w-4 h-4 mr-1" />
                          Got Paid
                        </Button>
                      </div>
                    )}
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditGig(gig)}
                        className="flex items-center justify-center"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteGigMutation.mutate(gig.id)}
                        disabled={deleteGigMutation.isPending}
                        className="flex items-center justify-center"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Gig Dialog */}
      <Dialog open={!!editingGig} onOpenChange={() => setEditingGig(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Gig</DialogTitle>
          </DialogHeader>
          {editingGig && (
            <GigEditForm
              gig={editingGig}
              onSave={handleSaveEdit}
              onCancel={() => setEditingGig(null)}
              isLoading={updateGigMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Got Paid Dialog */}
      {gotPaidGig && (
        <GotPaidDialog
          isOpen={showGotPaidDialog}
          onClose={() => {
            setShowGotPaidDialog(false);
            setGotPaidGig(null);
          }}
          gig={gotPaidGig}
          onSave={async (data) => {
            return new Promise((resolve, reject) => {
              gotPaidMutation.mutate(
                { gigId: gotPaidGig.id, data }, 
                {
                  onSuccess: () => resolve(),
                  onError: (error) => reject(error)
                }
              );
            });
          }}
          isLoading={gotPaidMutation.isPending}
        />
      )}
    </div>
  );
}

interface GigEditFormProps {
  gig: Gig;
  onSave: (data: Partial<Gig>) => void;
  onCancel: () => void;
  isLoading: boolean;
}

function GigEditForm({ gig, onSave, onCancel, isLoading }: GigEditFormProps) {
  const { data: user } = useQuery({ queryKey: ["/api/user"] });
  
  const [formData, setFormData] = useState({
    clientName: gig.clientName,
    gigType: gig.gigType,
    date: gig.date,
    expectedPay: gig.expectedPay || "",
    actualPay: gig.actualPay || "",
    tips: gig.tips || "",
    status: gig.status,
    duties: gig.duties || "",
    paymentMethod: gig.paymentMethod || "",
    taxPercentage: (gig.taxPercentage !== null && gig.taxPercentage !== undefined) ? gig.taxPercentage : 23,
  });

  // Update tax percentage when user data loads
  useEffect(() => {
    if (user && (gig.taxPercentage === null || gig.taxPercentage === undefined)) {
      setFormData(prev => ({
        ...prev,
        taxPercentage: (user as any)?.defaultTaxPercentage || 23
      }));
    }
  }, [user, gig.taxPercentage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Client Name</label>
        <Input
          value={formData.clientName}
          onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Date</label>
        <Input
          type="date"
          value={formData.date}
          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Expected Pay</label>
          <Input
            type="number"
            value={formData.expectedPay}
            onChange={(e) => setFormData({ ...formData, expectedPay: e.target.value })}
            placeholder="250"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Actual Pay</label>
          <Input
            type="number"
            value={formData.actualPay}
            onChange={(e) => setFormData({ ...formData, actualPay: e.target.value })}
            placeholder="285"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Tips Earned</label>
          <Input
            type="number"
            value={formData.tips}
            onChange={(e) => setFormData({ ...formData, tips: e.target.value })}
            placeholder="25"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Tax Rate (%)</label>
          <Input
            type="number"
            step="0.1"
            min="0"
            max="50"
            value={formData.taxPercentage === 0 ? '' : formData.taxPercentage}
            onChange={(e) => {
              const value = e.target.value;
              // Allow empty string and valid numbers
              if (value === '') {
                setFormData({ ...formData, taxPercentage: 0 });
              } else {
                const parsed = parseFloat(value);
                if (!isNaN(parsed)) {
                  setFormData({ ...formData, taxPercentage: parsed });
                }
              }
            }}
            placeholder="23.0"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Status</label>
        <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="pending_payment">Pending Payment</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Duties</label>
        <textarea
          className="w-full p-2 border rounded-md resize-none h-20"
          value={formData.duties}
          onChange={(e) => setFormData({ ...formData, duties: e.target.value })}
          placeholder="Key duties and responsibilities..."
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}