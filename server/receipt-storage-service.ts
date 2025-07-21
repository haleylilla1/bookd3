import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

export class ReceiptStorageService {
  private static bucketName = 'receipts';

  /**
   * Upload receipt image to Supabase Storage
   * @param userId - User ID for organizing files
   * @param gigId - Gig ID for organizing files  
   * @param receiptType - 'parking' or 'other'
   * @param imageData - Base64 image data
   * @param fileName - Original filename
   */
  static async uploadReceipt(
    userId: number, 
    gigId: number, 
    receiptType: 'parking' | 'other',
    imageData: string,
    fileName: string
  ): Promise<{ url: string; path: string }> {
    try {
      // Convert base64 to buffer
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Create organized file path: user_123/gig_456/parking/receipt_001.jpg
      const timestamp = Date.now();
      const extension = fileName.split('.').pop() || 'jpg';
      const filePath = `user_${userId}/gig_${gigId}/${receiptType}/receipt_${timestamp}.${extension}`;
      
      console.log(`📤 Uploading receipt: ${filePath} (${Math.round(buffer.length/1024)}KB)`);
      
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .upload(filePath, buffer, {
          contentType: this.getContentType(extension),
          upsert: false
        });

      if (error) {
        console.error('❌ Receipt upload failed:', error);
        throw new Error(`Receipt upload failed: ${error.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(this.bucketName)
        .getPublicUrl(filePath);

      console.log(`✅ Receipt uploaded successfully: ${urlData.publicUrl}`);

      return {
        url: urlData.publicUrl,
        path: filePath
      };
    } catch (error) {
      console.error('❌ Receipt storage error:', error);
      throw error;
    }
  }

  /**
   * Delete receipt from storage
   */
  static async deleteReceipt(filePath: string): Promise<void> {
    try {
      const { error } = await supabase.storage
        .from(this.bucketName)
        .remove([filePath]);

      if (error) {
        console.error('❌ Receipt deletion failed:', error);
        throw new Error(`Receipt deletion failed: ${error.message}`);
      }

      console.log(`🗑️ Receipt deleted: ${filePath}`);
    } catch (error) {
      console.error('❌ Receipt deletion error:', error);
      throw error;
    }
  }

  /**
   * Migrate existing base64 receipts to Supabase Storage
   */
  static async migrateReceiptData(
    userId: number,
    gigId: number, 
    receiptType: 'parking' | 'other',
    base64Receipts: string[]
  ): Promise<string[]> {
    const uploadedUrls: string[] = [];

    for (let i = 0; i < base64Receipts.length; i++) {
      try {
        const base64Data = base64Receipts[i];
        if (base64Data && base64Data.startsWith('data:image/')) {
          const { url } = await this.uploadReceipt(
            userId,
            gigId,
            receiptType,
            base64Data,
            `${receiptType}_receipt_${i + 1}.jpg`
          );
          uploadedUrls.push(url);
          
          // Add small delay to prevent rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(`❌ Failed to migrate receipt ${i + 1}:`, error);
        // Continue with other receipts even if one fails
      }
    }

    return uploadedUrls;
  }

  /**
   * Get all receipts for a gig
   */
  static async getGigReceipts(userId: number, gigId: number): Promise<{
    parking: string[];
    other: string[];
  }> {
    try {
      const { data: files, error } = await supabase.storage
        .from(this.bucketName)
        .list(`user_${userId}/gig_${gigId}`, {
          limit: 100
        });

      if (error) {
        console.error('❌ Failed to list receipts:', error);
        return { parking: [], other: [] };
      }

      const parkingReceipts: string[] = [];
      const otherReceipts: string[] = [];

      for (const folder of files || []) {
        if (folder.name === 'parking' || folder.name === 'other') {
          const { data: receiptFiles } = await supabase.storage
            .from(this.bucketName)
            .list(`user_${userId}/gig_${gigId}/${folder.name}`);

          const urls = receiptFiles?.map(file => {
            const { data: urlData } = supabase.storage
              .from(this.bucketName)
              .getPublicUrl(`user_${userId}/gig_${gigId}/${folder.name}/${file.name}`);
            return urlData.publicUrl;
          }) || [];

          if (folder.name === 'parking') {
            parkingReceipts.push(...urls);
          } else {
            otherReceipts.push(...urls);
          }
        }
      }

      return {
        parking: parkingReceipts,
        other: otherReceipts
      };
    } catch (error) {
      console.error('❌ Failed to get gig receipts:', error);
      return { parking: [], other: [] };
    }
  }

  /**
   * Clean up receipts for deleted gig
   */
  static async cleanupGigReceipts(userId: number, gigId: number): Promise<void> {
    try {
      const { data: files, error } = await supabase.storage
        .from(this.bucketName)
        .list(`user_${userId}/gig_${gigId}`, {
          limit: 1000
        });

      if (error || !files) return;

      const filesToDelete = files.map(file => `user_${userId}/gig_${gigId}/${file.name}`);
      
      if (filesToDelete.length > 0) {
        await supabase.storage.from(this.bucketName).remove(filesToDelete);
        console.log(`🗑️ Cleaned up ${filesToDelete.length} receipt files for gig ${gigId}`);
      }
    } catch (error) {
      console.error('❌ Failed to cleanup gig receipts:', error);
    }
  }

  private static getContentType(extension: string): string {
    const types: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg', 
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif'
    };
    return types[extension.toLowerCase()] || 'image/jpeg';
  }

  /**
   * Get storage usage statistics for a user
   */
  static async getUserStorageStats(userId: number): Promise<{
    totalFiles: number;
    totalSizeBytes: number;
    totalSizeMB: number;
  }> {
    try {
      const { data: files, error } = await supabase.storage
        .from(this.bucketName)
        .list(`user_${userId}`, {
          limit: 10000
        });

      if (error || !files) {
        return { totalFiles: 0, totalSizeBytes: 0, totalSizeMB: 0 };
      }

      const totalFiles = files.length;
      const totalSizeBytes = files.reduce((sum, file) => sum + (file.metadata?.size || 0), 0);
      const totalSizeMB = Math.round(totalSizeBytes / 1024 / 1024 * 100) / 100;

      return {
        totalFiles,
        totalSizeBytes,
        totalSizeMB
      };
    } catch (error) {
      console.error('❌ Failed to get storage stats:', error);
      return { totalFiles: 0, totalSizeBytes: 0, totalSizeMB: 0 };
    }
  }
}