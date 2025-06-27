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
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const compressImage = (file: File, quality: number = 0.7): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Calculate optimal dimensions (max 1200px width/height for mobile)
        const maxSize = 1200;
        let { width, height } = img;
        
        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw and compress
        ctx?.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      
      img.src = URL.createObjectURL(file);
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    setIsProcessing(true);
    
    try {
      const fileArray = Array.from(files);
      const availableSlots = maxFiles - (receipts || []).length;
      const filesToProcess = fileArray.slice(0, availableSlots);
      
      // Process files in parallel for faster upload
      const compressedImages = await Promise.all(
        filesToProcess.map(file => compressImage(file, 0.8))
      );
      
      // Update receipts in a single batch
      onReceiptsChange([...(receipts || []), ...compressedImages]);
    } catch (error) {
      console.error('Error processing images:', error);
    } finally {
      setIsProcessing(false);
    }

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
          disabled={isProcessing || (receipts || []).length >= maxFiles}
          className="flex items-center gap-2"
        >
          <Camera className="w-4 h-4" />
          {isProcessing ? "Processing..." : "Camera"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={openFileSelector}
          disabled={isProcessing || (receipts || []).length >= maxFiles}
          className="flex items-center gap-2"
        >
          <Upload className="w-4 h-4" />
          {isProcessing ? "Processing..." : "Upload"}
        </Button>
        {(receipts || []).length > 0 && (
          <Badge variant="secondary">
            {(receipts || []).length}/{maxFiles} photos
          </Badge>
        )}
        {isProcessing && (
          <Badge variant="outline" className="animate-pulse">
            Compressing images...
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
                    loading="lazy"
                    decoding="async"
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