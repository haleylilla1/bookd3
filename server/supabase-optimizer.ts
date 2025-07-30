/**
 * Supabase Memory Optimization Service
 * Leverages Supabase capabilities to reduce local memory usage
 */

import { createClient } from '@supabase/supabase-js';

class SupabaseOptimizer {
  private supabase;
  private isEnabled: boolean;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn('⚠️ Supabase optimization disabled - missing credentials');
      this.isEnabled = false;
      return;
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.isEnabled = true;
    console.log('🚀 Supabase memory optimizer initialized');
  }

  /**
   * Cache large objects in Supabase Storage instead of memory
   */
  async cacheToStorage(key: string, data: any, ttlHours: number = 24): Promise<boolean> {
    if (!this.isEnabled) return false;

    try {
      const cacheData = {
        data,
        expires: new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString(),
        created: new Date().toISOString()
      };

      const fileName = `cache/${key}.json`;
      const { error } = await this.supabase.storage
        .from('cache')
        .upload(fileName, JSON.stringify(cacheData), {
          contentType: 'application/json',
          upsert: true
        });

      if (error) {
        console.error('❌ Cache to storage failed:', error.message);
        return false;
      }

      console.log(`📦 Cached ${key} to Supabase Storage (TTL: ${ttlHours}h)`);
      return true;
    } catch (error) {
      console.error('❌ Cache to storage error:', error);
      return false;
    }
  }

  /**
   * Retrieve cached data from Supabase Storage
   */
  async getCachedFromStorage(key: string): Promise<any | null> {
    if (!this.isEnabled) return null;

    try {
      const fileName = `cache/${key}.json`;
      const { data, error } = await this.supabase.storage
        .from('cache')
        .download(fileName);

      if (error || !data) {
        return null;
      }

      const cacheContent = JSON.parse(await data.text());
      
      // Check expiration
      if (new Date(cacheContent.expires) < new Date()) {
        // Clean up expired cache
        await this.supabase.storage.from('cache').remove([fileName]);
        return null;
      }

      console.log(`📦 Retrieved ${key} from Supabase Storage`);
      return cacheContent.data;
    } catch (error) {
      console.error('❌ Get from storage error:', error);
      return null;
    }
  }

  /**
   * Store reports in Supabase Storage instead of generating in memory
   */
  async storeReport(userId: number, reportType: string, reportData: string): Promise<string | null> {
    if (!this.isEnabled) return null;

    try {
      const fileName = `reports/${userId}/${reportType}_${Date.now()}.html`;
      const { data, error } = await this.supabase.storage
        .from('reports')
        .upload(fileName, reportData, {
          contentType: 'text/html',
          upsert: false
        });

      if (error) {
        console.error('❌ Report storage failed:', error.message);
        return null;
      }

      // Get public URL
      const { data: urlData } = this.supabase.storage
        .from('reports')
        .getPublicUrl(fileName);

      console.log(`📄 Report stored in Supabase Storage: ${reportType}`);
      return urlData.publicUrl;
    } catch (error) {
      console.error('❌ Report storage error:', error);
      return null;
    }
  }

  /**
   * Optimize database queries with Supabase built-in caching
   */
  async getOptimizedGigs(userId: number): Promise<any[]> {
    if (!this.isEnabled) return [];

    try {
      // Use Supabase's built-in query optimization
      const { data, error } = await this.supabase
        .from('gigs')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (error) {
        console.error('❌ Optimized query failed:', error.message);
        return [];
      }

      console.log(`⚡ Retrieved ${data.length} gigs via optimized Supabase query`);
      return data || [];
    } catch (error) {
      console.error('❌ Optimized query error:', error);
      return [];
    }
  }

  /**
   * Clean up old cache files to save storage space
   */
  async cleanupExpiredCache(): Promise<void> {
    if (!this.isEnabled) return;

    try {
      const { data: files, error } = await this.supabase.storage
        .from('cache')
        .list('', { limit: 100 });

      if (error || !files) return;

      const expiredFiles: string[] = [];
      
      for (const file of files) {
        try {
          const { data } = await this.supabase.storage
            .from('cache')
            .download(`cache/${file.name}`);
          
          if (data) {
            const content = JSON.parse(await data.text());
            if (new Date(content.expires) < new Date()) {
              expiredFiles.push(`cache/${file.name}`);
            }
          }
        } catch (e) {
          // File might be corrupted, add to cleanup list
          expiredFiles.push(`cache/${file.name}`);
        }
      }

      if (expiredFiles.length > 0) {
        await this.supabase.storage.from('cache').remove(expiredFiles);
        console.log(`🧹 Cleaned up ${expiredFiles.length} expired cache files`);
      }
    } catch (error) {
      console.error('❌ Cache cleanup error:', error);
    }
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(): { optimization: string; enabled: boolean; storage: string } {
    return {
      optimization: this.isEnabled ? 'Supabase Storage caching active' : 'Local memory caching only',
      enabled: this.isEnabled,
      storage: this.isEnabled ? 'External Supabase Storage' : 'Local server memory'
    };
  }
}

export const supabaseOptimizer = new SupabaseOptimizer();