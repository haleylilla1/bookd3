import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { 
  Upload, 
  Wand2, 
  CheckCircle, 
  AlertCircle, 
  Edit3, 
  Download,
  FileText,
  Calendar,
  DollarSign,
  Building
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const importFormSchema = z.object({
  rawText: z.string().min(10, "Please enter your gig notes (at least 10 characters)"),
});

type ImportFormData = z.infer<typeof importFormSchema>;

interface ParsedGig {
  id: string;
  originalText: string;
  confidence: 'high' | 'medium' | 'low';
  extractedData: {
    eventName?: string;
    clientName?: string;
    startDate?: string;
    endDate?: string;
    expectedPay?: string;
    actualPay?: string;
    gigType?: string;
    location?: string;
    duties?: string;
    notes?: string;
  };
  selected: boolean;
  userEdited: boolean;
}

interface BulkGigImportProps {
  onClose: () => void;
}

export default function BulkGigImport({ onClose }: BulkGigImportProps) {
  const [step, setStep] = useState<'input' | 'processing' | 'review' | 'importing' | 'complete'>('input');
  const [parsedGigs, setParsedGigs] = useState<ParsedGig[]>([]);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [importResults, setImportResults] = useState<{ imported: number; skipped: number; errors: string[] }>({
    imported: 0,
    skipped: 0,
    errors: []
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ImportFormData>({
    resolver: zodResolver(importFormSchema),
    defaultValues: {
      rawText: "",
    },
  });

  // Example data for user guidance
  const exampleText = `3/15/23 - ABC Catering gig - $150
Bartended at XYZ Corp event March 20th, paid $200
Brand ambassador for Tech Startup:
Date: 4/1/2023
Client: Tech Startup Inc
Pay: $300
Hours: 6 hours

Johnson wedding - April 15 - $250 catering
May 5th promotional event at Mall, $180`;

  const parseTextMutation = useMutation({
    mutationFn: async (text: string) => {
      return apiRequest("POST", "/api/gigs/parse-bulk", { text });
    },
    onSuccess: (data: any) => {
      const parsed = data.parsedGigs.map((gig: any, index: number) => ({
        ...gig,
        id: `gig-${index}`,
        selected: true,
        userEdited: false,
      }));
      setParsedGigs(parsed);
      setProcessingProgress(100);
      setStep('review');
    },
    onError: (error) => {
      toast({
        title: "Parsing Failed",
        description: "Could not parse your gig notes. Please try again or contact support.",
        variant: "destructive",
      });
      setStep('input');
    },
  });

  const importGigsMutation = useMutation({
    mutationFn: async (gigs: ParsedGig[]) => {
      const selectedGigs = gigs.filter(g => g.selected);
      return apiRequest("POST", "/api/gigs/bulk-import", { gigs: selectedGigs });
    },
    onSuccess: (data: any) => {
      setImportResults(data);
      queryClient.invalidateQueries({ queryKey: ["/api/gigs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setStep('complete');
      toast({
        title: "Import Complete!",
        description: `Successfully imported ${data.imported} gigs.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Import Failed",
        description: "Some gigs could not be imported. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ImportFormData) => {
    setStep('processing');
    setProcessingProgress(0);
    
    // Simulate processing progress
    const progressInterval = setInterval(() => {
      setProcessingProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 10;
      });
    }, 300);

    parseTextMutation.mutate(data.rawText);
  };

  const handleGigEdit = (gigId: string, field: string, value: string) => {
    setParsedGigs(prev => prev.map(gig => 
      gig.id === gigId 
        ? { 
            ...gig, 
            extractedData: { ...gig.extractedData, [field]: value },
            userEdited: true
          }
        : gig
    ));
  };

  const handleGigToggle = (gigId: string) => {
    setParsedGigs(prev => prev.map(gig => 
      gig.id === gigId ? { ...gig, selected: !gig.selected } : gig
    ));
  };

  const handleSelectAll = () => {
    const allSelected = parsedGigs.every(g => g.selected);
    setParsedGigs(prev => prev.map(gig => ({ ...gig, selected: !allSelected })));
  };

  const handleImport = () => {
    setStep('importing');
    importGigsMutation.mutate(parsedGigs);
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getConfidenceIcon = (confidence: string) => {
    switch (confidence) {
      case 'high': return <CheckCircle className="w-4 h-4" />;
      case 'medium': return <AlertCircle className="w-4 h-4" />;
      case 'low': return <AlertCircle className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  if (step === 'input') {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Import Past Gigs
            </CardTitle>
            <p className="text-sm text-gray-600">
              Paste your messy gig notes below and we'll organize them into your Giggy logbook
            </p>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="rawText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Your Gig Notes</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder={`Paste your gig notes here. For example:\n\n${exampleText}`}
                          className="min-h-[300px] font-mono text-sm"
                          {...field} 
                        />
                      </FormControl>
                      <div className="text-xs text-gray-500">
                        Our AI can handle various formats: dates, client names, payments, locations, and duties
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">Tips for Best Results:</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Include dates, client names, and payment amounts when possible</li>
                    <li>• Separate different gigs with line breaks</li>
                    <li>• Don't worry about formatting - our AI handles messy notes</li>
                    <li>• Include any details you remember (location, duties, hours)</li>
                  </ul>
                </div>

                <div className="flex gap-3">
                  <Button 
                    type="submit" 
                    disabled={parseTextMutation.isPending}
                    className="flex items-center gap-2"
                  >
                    <Wand2 className="w-4 h-4" />
                    {parseTextMutation.isPending ? "Processing..." : "Parse Gigs with AI"}
                  </Button>
                  <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'processing') {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 animate-spin" />
              Processing Your Gigs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={processingProgress} className="w-full" />
            <p className="text-sm text-gray-600 text-center">
              Our AI is analyzing your notes and extracting gig information...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'review') {
    const selectedCount = parsedGigs.filter(g => g.selected).length;
    
    return (
      <div className="max-w-6xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Edit3 className="w-5 h-5" />
              Review & Edit Parsed Gigs
            </CardTitle>
            <p className="text-sm text-gray-600">
              Review the extracted information and make any necessary corrections before importing
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                >
                  {parsedGigs.every(g => g.selected) ? 'Deselect All' : 'Select All'}
                </Button>
                <span className="text-sm text-gray-600">
                  {selectedCount} of {parsedGigs.length} gigs selected
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('input')}>
                  Back to Edit
                </Button>
                <Button 
                  onClick={handleImport}
                  disabled={selectedCount === 0}
                  className="flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Import {selectedCount} Gigs
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {parsedGigs.map((gig) => (
                <Card key={gig.id} className={gig.selected ? 'ring-2 ring-blue-200' : 'opacity-75'}>
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-4">
                      <Checkbox
                        checked={gig.selected}
                        onCheckedChange={() => handleGigToggle(gig.id)}
                        className="mt-1"
                      />
                      
                      <div className="flex-1 space-y-4">
                        {/* Original text and confidence */}
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className={getConfidenceColor(gig.confidence)}>
                                {getConfidenceIcon(gig.confidence)}
                                {gig.confidence} confidence
                              </Badge>
                              {gig.userEdited && (
                                <Badge variant="outline">
                                  <Edit3 className="w-3 h-3 mr-1" />
                                  Edited
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                              <strong>Original:</strong> {gig.originalText}
                            </div>
                          </div>
                        </div>

                        {/* Key Information - Always Visible */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                          <div>
                            <label className="text-xs font-medium text-gray-700 flex items-center gap-1 mb-1">
                              <Building className="w-3 h-3" />
                              Client Name *
                            </label>
                            <Input
                              value={gig.extractedData.clientName || ''}
                              onChange={(e) => handleGigEdit(gig.id, 'clientName', e.target.value)}
                              placeholder="Required - Client or company name"
                              className={`${!gig.extractedData.clientName ? 'border-red-300 focus:border-red-500' : ''}`}
                            />
                          </div>

                          <div>
                            <label className="text-xs font-medium text-gray-700 flex items-center gap-1 mb-1">
                              <Calendar className="w-3 h-3" />
                              Date *
                            </label>
                            <Input
                              type="date"
                              value={gig.extractedData.startDate || ''}
                              onChange={(e) => handleGigEdit(gig.id, 'startDate', e.target.value)}
                              className={`${!gig.extractedData.startDate ? 'border-red-300 focus:border-red-500' : ''}`}
                            />
                          </div>

                          <div>
                            <label className="text-xs font-medium text-gray-700 flex items-center gap-1 mb-1">
                              <DollarSign className="w-3 h-3" />
                              Payment Amount
                            </label>
                            <Input
                              value={gig.extractedData.actualPay || ''}
                              onChange={(e) => handleGigEdit(gig.id, 'actualPay', e.target.value)}
                              placeholder="Amount earned"
                            />
                          </div>
                        </div>

                        {/* Additional Details - Expandable */}
                        <details className="group">
                          <summary className="cursor-pointer text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                            <span>Additional Details</span>
                            <span className="text-xs text-gray-500 group-open:hidden">(click to expand)</span>
                          </summary>
                          
                          <div className="space-y-4 mt-4 p-4 bg-blue-50 rounded-lg">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="text-xs font-medium text-gray-700 flex items-center gap-1 mb-1">
                                  <FileText className="w-3 h-3" />
                                  Event Name
                                </label>
                                <Input
                                  value={gig.extractedData.eventName || ''}
                                  onChange={(e) => handleGigEdit(gig.id, 'eventName', e.target.value)}
                                  placeholder="Name or description of the event"
                                />
                              </div>

                              <div>
                                <label className="text-xs font-medium text-gray-700 mb-1">Gig Type</label>
                                <Select
                                  value={gig.extractedData.gigType || ''}
                                  onValueChange={(value) => handleGigEdit(gig.id, 'gigType', value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select gig type..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Brand Ambassador">Brand Ambassador</SelectItem>
                                    <SelectItem value="Catering">Catering</SelectItem>
                                    <SelectItem value="Bartending">Bartending</SelectItem>
                                    <SelectItem value="Event Staff">Event Staff</SelectItem>
                                    <SelectItem value="Promotional">Promotional</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="md:col-span-2">
                                <label className="text-xs font-medium text-gray-700 mb-1">Location</label>
                                <Input
                                  value={gig.extractedData.location || ''}
                                  onChange={(e) => handleGigEdit(gig.id, 'location', e.target.value)}
                                  placeholder="Event venue or address"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="text-xs font-medium text-gray-700 mb-1">Job Duties</label>
                              <Textarea
                                value={gig.extractedData.duties || ''}
                                onChange={(e) => handleGigEdit(gig.id, 'duties', e.target.value)}
                                placeholder="What did you do at this gig? (serving, greeting customers, setup, etc.)"
                                className="h-24"
                              />
                            </div>

                            <div>
                              <label className="text-xs font-medium text-gray-700 mb-1">Additional Notes</label>
                              <Textarea
                                value={gig.extractedData.notes || ''}
                                onChange={(e) => handleGigEdit(gig.id, 'notes', e.target.value)}
                                placeholder="Any other details about this gig"
                                className="h-20"
                              />
                            </div>
                          </div>
                        </details>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'importing') {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="w-5 h-5 animate-bounce" />
              Importing Your Gigs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={100} className="w-full" />
            <p className="text-sm text-gray-600 text-center">
              Adding your gigs to Giggy and updating your dashboard...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'complete') {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle className="w-5 h-5" />
              Import Complete!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-green-50 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-700">{importResults.imported}</div>
                  <div className="text-sm text-green-600">Gigs Imported</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-600">{importResults.skipped}</div>
                  <div className="text-sm text-gray-500">Skipped</div>
                </div>
              </div>
            </div>

            {importResults.errors.length > 0 && (
              <div className="bg-red-50 rounded-lg p-4">
                <h4 className="font-medium text-red-800 mb-2">Issues:</h4>
                <ul className="text-sm text-red-700 space-y-1">
                  {importResults.errors.map((error, i) => (
                    <li key={i}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <Button onClick={onClose}>
                View Dashboard
              </Button>
              <Button variant="outline" onClick={() => setStep('input')}>
                Import More Gigs
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}