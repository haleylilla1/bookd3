import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, Upload, X, FileImage, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ReceiptUploadProps {
  label: string;
  receipts: string[];
  onReceiptsChange: (receipts: string[]) => void;
  maxFiles?: number;
}

export default function ReceiptUpload({ 
  label, 
  receipts, 
  onReceiptsChange, 
  maxFiles = 5 
}: ReceiptUploadProps) {
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      if ((receipts || []).length >= maxFiles) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          onReceiptsChange([...(receipts || []), result]);
        }
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    event.target.value = '';
  };

  const removeReceipt = (index: number) => {
    const newReceipts = (receipts || []).filter((_, i) => i !== index);
    onReceiptsChange(newReceipts);
  };

  const openCamera = () => {
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  };

  const openFileSelector = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium">{label}</label>
      
      {/* Upload Controls */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={openCamera}
          disabled={(receipts || []).length >= maxFiles}
          className="flex items-center gap-2"
        >
          <Camera className="w-4 h-4" />
          Camera
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={openFileSelector}
          disabled={(receipts || []).length >= maxFiles}
          className="flex items-center gap-2"
        >
          <Upload className="w-4 h-4" />
          Upload
        </Button>
        {(receipts || []).length > 0 && (
          <Badge variant="secondary">
            {(receipts || []).length}/{maxFiles} photos
          </Badge>
        )}
      </div>

      {/* Hidden file inputs */}
      <Input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileUpload}
        className="hidden"
      />
      <Input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Receipt Thumbnails */}
      {(receipts || []).length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {(receipts || []).map((receipt, index) => (
            <Card key={index} className="relative">
              <CardContent className="p-2">
                <div className="relative aspect-square">
                  <img
                    src={receipt}
                    alt={`Receipt ${index + 1}`}
                    className="w-full h-full object-cover rounded"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-20 transition-all rounded flex items-center justify-center opacity-0 hover:opacity-100">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setPreviewImage(receipt)}
                      className="mr-1"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => removeReceipt(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-1 text-xs text-gray-500 text-center">
                  Receipt {index + 1}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {(receipts || []).length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center">
            <FileImage className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-500">No receipt photos uploaded</p>
            <p className="text-xs text-gray-400 mt-1">
              Upload photos of receipts for this expense category
            </p>
          </CardContent>
        </Card>
      )}

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Receipt Preview</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <div className="max-h-[70vh] overflow-auto">
              <img
                src={previewImage}
                alt="Receipt preview"
                className="w-full h-auto"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}