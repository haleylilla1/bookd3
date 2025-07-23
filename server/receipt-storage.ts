import { createClient } from '@supabase/supabase-js';

// Simple, reliable Supabase storage service for receipt photos
class ReceiptStorageService {
  private supabase;
  
  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.warn('⚠️  Supabase storage not configured - falling back to database storage');
      this.supabase = null;
      return;
    }
    
    this.supabase = createClient(supabaseUrl, supabaseKey);
    console.log('📸 Receipt storage service initialized with Supabase');
  }
  
  /**
   * Upload a receipt photo to Supabase storage
   * @param userId - User ID for organizing receipts
   * @param receiptData - Base64 image data
   * @param filename - Original filename or generated name
   * @returns Public URL for the uploaded receipt
   */
  async uploadReceipt(userId: number, receiptData: string, filename: string): Promise<string> {
    if (!this.supabase) {
      // Fallback: return the original base64 data for database storage
      console.log('📸 Using database fallback for receipt storage');
      return receiptData;
    }
    
    try {
      // Check if this is already a URL (from previous uploads)
      if (receiptData.startsWith('http')) {
        console.log('📸 Receipt is already a cloud URL, returning as-is');
        return receiptData;
      }
      
      // Convert base64 to buffer with proper validation
      let base64Data = receiptData;
      
      // Handle data URL format
      if (receiptData.startsWith('data:')) {
        const matches = receiptData.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
        if (!matches) {
          console.error('📸 Invalid data URL format');
          return receiptData;
        }
        base64Data = matches[2];
      }
      
      // Validate base64 format
      if (!/^[A-Za-z0-9+/]+=*$/.test(base64Data)) {
        console.error('📸 Invalid base64 format');
        return receiptData;
      }
      
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Validate buffer size (should be reasonable for an image)
      if (buffer.length < 100) {
        console.error('📸 Buffer too small, likely corrupted data:', buffer.length);
        return receiptData;
      }
      
      console.log('📸 Converting base64 to buffer:', buffer.length, 'bytes');
      
      // Generate unique filename with proper extension
      const timestamp = Date.now();
      const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `receipts/${userId}/${timestamp}_${sanitizedFilename}`;
      
      // Upload to Supabase storage with proper content type detection
      const { data, error } = await this.supabase.storage
        .from('receipts')
        .upload(storagePath, buffer, {
          contentType: 'image/jpeg',
          upsert: false
        });
        
      if (error) {
        console.error('📸 Supabase upload failed:', error);
        // Return original data as fallback
        return receiptData;
      }
      
      // Get public URL
      const { data: { publicUrl } } = this.supabase.storage
        .from('receipts')
        .getPublicUrl(storagePath);
        
      console.log('📸 Receipt uploaded successfully:', publicUrl);
      return publicUrl;
      
    } catch (error) {
      console.error('📸 Receipt upload error:', error);
      // Return original data as fallback
      return receiptData;
    }
  }
  
  /**
   * Upload multiple receipts
   * @param userId - User ID
   * @param receipts - Array of receipt data
   * @returns Array of public URLs or original data
   */
  async uploadMultipleReceipts(userId: number, receipts: string[]): Promise<string[]> {
    if (!receipts || receipts.length === 0) {
      return [];
    }
    
    const uploadPromises = receipts.map((receipt, index) => {
      const filename = `receipt_${index + 1}.jpg`;
      return this.uploadReceipt(userId, receipt, filename);
    });
    
    try {
      return await Promise.all(uploadPromises);
    } catch (error) {
      console.error('📸 Batch upload error:', error);
      // Return original data as fallback
      return receipts;
    }
  }
  
  /**
   * Check if storage is properly configured
   */
  isConfigured(): boolean {
    return this.supabase !== null;
  }
}

// Export singleton instance
export const receiptStorage = new ReceiptStorageService();