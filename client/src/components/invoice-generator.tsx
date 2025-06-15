import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Download, Plus, Trash2, FileText, Save, History, Eye } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Gig, User, Invoice } from "@shared/schema";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface InvoiceItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface InvoiceData {
  invoiceNumber: string;
  date: string;
  dueDate: string;
  businessName: string;
  businessAddress: string;
  businessEmail: string;
  businessPhone: string;
  clientName: string;
  clientAddress: string;
  clientEmail: string;
  items: InvoiceItem[];
  notes: string;
  taxRate: number;
}

export default function InvoiceGenerator() {
  const { data: gigs = [] } = useQuery<Gig[]>({
    queryKey: ["/api/gigs"],
  });

  const { data: user } = useQuery<User>({
    queryKey: ["/api/user"],
  });

  const { data: savedInvoices = [] } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const saveInvoiceMutation = useMutation({
    mutationFn: async (invoiceData: any) => {
      const response = await apiRequest("POST", "/api/invoices", invoiceData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({
        title: "Invoice Saved",
        description: "Your invoice has been saved successfully!"
      });
      // Generate new invoice number for next invoice
      setInvoice(prev => ({
        ...prev,
        invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
        clientName: "",
        clientAddress: "",
        clientEmail: "",
        items: [{ description: "", quantity: 1, rate: 0, amount: 0 }],
        notes: "Thank you for your business!"
      }));
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save invoice. Please try again.",
        variant: "destructive"
      });
    }
  });

  const deleteInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: number) => {
      await apiRequest("DELETE", `/api/invoices/${invoiceId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({
        title: "Invoice Deleted",
        description: "Invoice has been deleted successfully."
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete invoice.",
        variant: "destructive"
      });
    }
  });

  const [invoice, setInvoice] = useState<InvoiceData>(() => ({
    invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
    date: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    businessName: user?.businessName || user?.name || "Your Business Name",
    businessAddress: user?.businessAddress || "123 Business St\nCity, State 12345",
    businessEmail: user?.businessEmail || user?.email || "hello@yourbusiness.com",
    businessPhone: user?.businessPhone || user?.phone || "(555) 123-4567",
    clientName: "",
    clientAddress: "",
    clientEmail: "",
    items: [{ description: "", quantity: 1, rate: 0, amount: 0 }],
    notes: "Thank you for your business!",
    taxRate: user?.defaultTaxPercentage || 0
  }));

  // Update invoice when user data loads
  useEffect(() => {
    if (user) {
      setInvoice(prev => ({
        ...prev,
        businessName: user.businessName || user.name || prev.businessName,
        businessAddress: user.businessAddress || prev.businessAddress,
        businessEmail: user.businessEmail || user.email || prev.businessEmail,
        businessPhone: user.businessPhone || user.phone || prev.businessPhone,
        taxRate: user.defaultTaxPercentage || prev.taxRate
      }));
    }
  }, [user]);

  const addItem = () => {
    setInvoice(prev => ({
      ...prev,
      items: [...prev.items, { description: "", quantity: 1, rate: 0, amount: 0 }]
    }));
  };

  const removeItem = (index: number) => {
    setInvoice(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    setInvoice(prev => ({
      ...prev,
      items: prev.items.map((item, i) => {
        if (i === index) {
          const updatedItem = { ...item, [field]: value };
          if (field === 'quantity' || field === 'rate') {
            updatedItem.amount = updatedItem.quantity * updatedItem.rate;
          }
          return updatedItem;
        }
        return item;
      })
    }));
  };

  const populateFromGig = (gigId: string) => {
    const gig = gigs.find(g => g.id.toString() === gigId);
    if (gig) {
      setInvoice(prev => ({
        ...prev,
        clientName: gig.clientName || "",
        items: [{
          description: `${gig.gigType} - ${gig.eventName || 'Service'}`,
          quantity: 1,
          rate: parseFloat(gig.expectedPay || gig.actualPay || "0"),
          amount: parseFloat(gig.expectedPay || gig.actualPay || "0")
        }]
      }));
    }
  };

  const subtotal = invoice.items.reduce((sum, item) => sum + item.amount, 0);
  const taxAmount = subtotal * (invoice.taxRate / 100);
  const total = subtotal + taxAmount;

  const saveInvoice = () => {
    const invoiceToSave = {
      invoiceNumber: invoice.invoiceNumber,
      clientName: invoice.clientName,
      clientEmail: invoice.clientEmail,
      clientAddress: invoice.clientAddress,
      businessName: invoice.businessName,
      businessAddress: invoice.businessAddress,
      businessEmail: invoice.businessEmail,
      businessPhone: invoice.businessPhone,
      invoiceDate: invoice.date,
      dueDate: invoice.dueDate,
      items: invoice.items,
      subtotal: subtotal.toString(),
      taxRate: invoice.taxRate.toString(),
      taxAmount: taxAmount.toString(),
      total: total.toString(),
      notes: invoice.notes,
      status: "draft"
    };
    
    saveInvoiceMutation.mutate(invoiceToSave);
  };

  const loadInvoice = (savedInvoice: Invoice) => {
    setInvoice({
      invoiceNumber: savedInvoice.invoiceNumber,
      date: savedInvoice.invoiceDate,
      dueDate: savedInvoice.dueDate,
      businessName: savedInvoice.businessName,
      businessAddress: savedInvoice.businessAddress || "",
      businessEmail: savedInvoice.businessEmail || "",
      businessPhone: savedInvoice.businessPhone || "",
      clientName: savedInvoice.clientName,
      clientAddress: savedInvoice.clientAddress || "",
      clientEmail: savedInvoice.clientEmail || "",
      items: Array.isArray(savedInvoice.items) ? savedInvoice.items : [{ description: "", quantity: 1, rate: 0, amount: 0 }],
      notes: savedInvoice.notes || "",
      taxRate: parseFloat(savedInvoice.taxRate?.toString() || "0")
    });
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('INVOICE', 20, 30);
    
    // Invoice details
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Invoice #: ${invoice.invoiceNumber}`, 150, 30);
    doc.text(`Date: ${formatDate(invoice.date)}`, 150, 35);
    doc.text(`Due Date: ${formatDate(invoice.dueDate)}`, 150, 40);
    
    // Business info
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('FROM:', 20, 50);
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.businessName, 20, 55);
    const businessLines = invoice.businessAddress.split('\n');
    businessLines.forEach((line, i) => {
      doc.text(line, 20, 60 + (i * 5));
    });
    doc.text(invoice.businessEmail, 20, 60 + (businessLines.length * 5));
    doc.text(invoice.businessPhone, 20, 65 + (businessLines.length * 5));
    
    // Client info
    doc.setFont('helvetica', 'bold');
    doc.text('TO:', 20, 85 + (businessLines.length * 5));
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.clientName, 20, 90 + (businessLines.length * 5));
    if (invoice.clientAddress) {
      const clientLines = invoice.clientAddress.split('\n');
      clientLines.forEach((line, i) => {
        doc.text(line, 20, 95 + (businessLines.length * 5) + (i * 5));
      });
    }
    if (invoice.clientEmail) {
      doc.text(invoice.clientEmail, 20, 100 + (businessLines.length * 5));
    }
    
    // Items table
    const tableData = invoice.items.map(item => [
      item.description,
      item.quantity.toString(),
      formatCurrency(item.rate),
      formatCurrency(item.amount)
    ]);
    
    autoTable(doc, {
      startY: 120,
      head: [['Description', 'Qty', 'Rate', 'Amount']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 10 },
      headStyles: { fillColor: [41, 128, 185] }
    });
    
    // Totals
    const finalY = doc.internal.pageSize.height - 80;
    doc.text(`Subtotal: ${formatCurrency(subtotal)}`, 150, finalY);
    if (invoice.taxRate > 0) {
      doc.text(`Tax (${invoice.taxRate}%): ${formatCurrency(taxAmount)}`, 150, finalY + 5);
    }
    doc.setFont('helvetica', 'bold');
    doc.text(`Total: ${formatCurrency(total)}`, 150, finalY + (invoice.taxRate > 0 ? 10 : 5));
    
    // Notes
    if (invoice.notes) {
      doc.setFont('helvetica', 'normal');
      doc.text('Notes:', 20, finalY + 20);
      doc.text(invoice.notes, 20, finalY + 25);
    }
    
    doc.save(`Invoice-${invoice.invoiceNumber}.pdf`);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Invoice Generator</h1>
      </div>

      <Tabs defaultValue="create" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="create" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Create Invoice
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Invoice History ({savedInvoices.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-6">
          <div className="flex gap-2 mb-4">
            <Button onClick={generatePDF} className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Download PDF
            </Button>
            <Button 
              onClick={saveInvoice} 
              disabled={saveInvoiceMutation.isPending}
              className="flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saveInvoiceMutation.isPending ? "Saving..." : "Save Invoice"}
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Invoice Form */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Invoice Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="invoiceNumber">Invoice Number</Label>
                      <Input
                        id="invoiceNumber"
                        value={invoice.invoiceNumber}
                        onChange={(e) => setInvoice(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="date">Date</Label>
                      <Input
                        id="date"
                        type="date"
                        value={invoice.date}
                        onChange={(e) => setInvoice(prev => ({ ...prev, date: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="dueDate">Due Date</Label>
                    <Input
                      id="dueDate"
                      type="date"
                      value={invoice.dueDate}
                      onChange={(e) => setInvoice(prev => ({ ...prev, dueDate: e.target.value }))}
                    />
                  </div>
              <div>
                <Label>Auto-fill from Gig</Label>
                <Select onValueChange={populateFromGig}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a gig to auto-fill" />
                  </SelectTrigger>
                  <SelectContent>
                    {gigs.map(gig => (
                      <SelectItem key={gig.id} value={gig.id.toString()}>
                        {gig.gigType} - {gig.clientName || 'No client'} - {formatCurrency(parseFloat(gig.expectedPay || gig.actualPay || "0"))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Business Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="businessName">Business Name</Label>
                <Input
                  id="businessName"
                  value={invoice.businessName}
                  onChange={(e) => setInvoice(prev => ({ ...prev, businessName: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="businessAddress">Address</Label>
                <Textarea
                  id="businessAddress"
                  value={invoice.businessAddress}
                  onChange={(e) => setInvoice(prev => ({ ...prev, businessAddress: e.target.value }))}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="businessEmail">Email</Label>
                  <Input
                    id="businessEmail"
                    type="email"
                    value={invoice.businessEmail}
                    onChange={(e) => setInvoice(prev => ({ ...prev, businessEmail: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="businessPhone">Phone</Label>
                  <Input
                    id="businessPhone"
                    value={invoice.businessPhone}
                    onChange={(e) => setInvoice(prev => ({ ...prev, businessPhone: e.target.value }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Client Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="clientName">Client Name</Label>
                <Input
                  id="clientName"
                  value={invoice.clientName}
                  onChange={(e) => setInvoice(prev => ({ ...prev, clientName: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="clientAddress">Address</Label>
                <Textarea
                  id="clientAddress"
                  value={invoice.clientAddress}
                  onChange={(e) => setInvoice(prev => ({ ...prev, clientAddress: e.target.value }))}
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="clientEmail">Email</Label>
                <Input
                  id="clientEmail"
                  type="email"
                  value={invoice.clientEmail}
                  onChange={(e) => setInvoice(prev => ({ ...prev, clientEmail: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Invoice Preview */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Invoice Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {invoice.items.map((item, index) => (
                <div key={index} className="p-4 border rounded-lg space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Item {index + 1}</span>
                    {invoice.items.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input
                      value={item.description}
                      onChange={(e) => updateItem(index, 'description', e.target.value)}
                      placeholder="Service description"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label>Qty</Label>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label>Rate</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.rate}
                        onChange={(e) => updateItem(index, 'rate', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label>Amount</Label>
                      <Input value={formatCurrency(item.amount)} readOnly />
                    </div>
                  </div>
                </div>
              ))}
              <Button onClick={addItem} variant="outline" className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div>
                <Label htmlFor="taxRate">Tax Rate (%)</Label>
                <Input
                  id="taxRate"
                  type="number"
                  step="0.01"
                  value={invoice.taxRate}
                  onChange={(e) => setInvoice(prev => ({ ...prev, taxRate: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              {invoice.taxRate > 0 && (
                <div className="flex justify-between">
                  <span>Tax ({invoice.taxRate}%):</span>
                  <span>{formatCurrency(taxAmount)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Total:</span>
                <span>{formatCurrency(total)}</span>
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={invoice.notes}
                  onChange={(e) => setInvoice(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                />
              </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <div className="grid gap-4">
            {savedInvoices.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No saved invoices</h3>
                  <p className="text-gray-500">Create and save your first invoice to see it here.</p>
                </CardContent>
              </Card>
            ) : (
              savedInvoices.map((savedInvoice) => (
                <Card key={savedInvoice.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-2">
                          <h3 className="text-lg font-medium text-gray-900">
                            {savedInvoice.invoiceNumber}
                          </h3>
                          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                            {savedInvoice.status || 'Draft'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Client:</span>
                            <br />
                            {savedInvoice.clientName}
                          </div>
                          <div>
                            <span className="font-medium">Date:</span>
                            <br />
                            {formatDate(savedInvoice.invoiceDate)}
                          </div>
                          <div>
                            <span className="font-medium">Due:</span>
                            <br />
                            {formatDate(savedInvoice.dueDate)}
                          </div>
                          <div>
                            <span className="font-medium">Total:</span>
                            <br />
                            <span className="text-lg font-semibold text-green-600">
                              {formatCurrency(parseFloat(savedInvoice.total || "0"))}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => loadInvoice(savedInvoice)}
                          className="flex items-center gap-1"
                        >
                          <Eye className="w-4 h-4" />
                          Load
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteInvoiceMutation.mutate(savedInvoice.id)}
                          disabled={deleteInvoiceMutation.isPending}
                          className="flex items-center gap-1 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}