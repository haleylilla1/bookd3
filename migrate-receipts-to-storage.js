#!/usr/bin/env node

// Migration script to move receipt images from database to Supabase Storage
import { Pool } from 'pg';
import { createClient } from '@supabase/supabase-js';

const DATABASE_URL = process.env.DATABASE_URL;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!DATABASE_URL || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function migrateReceiptsToStorage() {
  console.log('🚀 RECEIPT MIGRATION TO SUPABASE STORAGE');
  console.log('==========================================');
  
  try {
    // 1. Create receipts bucket if it doesn't exist
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    const receiptsBucket = buckets?.find(bucket => bucket.name === 'receipts');
    
    if (!receiptsBucket) {
      console.log('📦 Creating receipts bucket...');
      const { error } = await supabase.storage.createBucket('receipts', {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        fileSizeLimit: 10485760 // 10MB limit per file
      });
      
      if (error) {
        console.error('❌ Failed to create bucket:', error);
      } else {
        console.log('✅ Receipts bucket created');
      }
    }

    // 2. Find gigs with receipt data
    const { rows: gigsWithReceipts } = await pool.query(`
      SELECT id, user_id, event_name, parking_receipts, other_expense_receipts
      FROM gigs 
      WHERE (parking_receipts IS NOT NULL AND array_length(parking_receipts, 1) > 0)
         OR (other_expense_receipts IS NOT NULL AND array_length(other_expense_receipts, 1) > 0)
      ORDER BY user_id, id
    `);

    console.log(`📊 Found ${gigsWithReceipts.length} gigs with receipt data`);
    
    let migratedGigs = 0;
    let totalUploaded = 0;
    let totalSizeSaved = 0;

    for (const gig of gigsWithReceipts) {
      console.log(`\n📋 Processing Gig ${gig.id}: ${gig.event_name} (User ${gig.user_id})`);
      
      const parkingUrls = [];
      const otherUrls = [];

      // Process parking receipts
      if (gig.parking_receipts && gig.parking_receipts.length > 0) {
        console.log(`   📸 Migrating ${gig.parking_receipts.length} parking receipts...`);
        
        for (let i = 0; i < gig.parking_receipts.length; i++) {
          const receiptData = gig.parking_receipts[i];
          
          if (receiptData && receiptData.startsWith('data:image/')) {
            try {
              const originalSize = receiptData.length;
              totalSizeSaved += originalSize;
              
              // Upload to Supabase Storage
              const url = await uploadReceiptToStorage(
                gig.user_id,
                gig.id,
                'parking',
                receiptData,
                `parking_receipt_${i + 1}.jpg`
              );
              
              parkingUrls.push(url);
              totalUploaded++;
              
              console.log(`   ✅ Uploaded parking receipt ${i + 1} (${Math.round(originalSize/1024)}KB)`);
              
              // Small delay to prevent rate limiting
              await new Promise(resolve => setTimeout(resolve, 200));
            } catch (error) {
              console.error(`   ❌ Failed to upload parking receipt ${i + 1}:`, error.message);
            }
          }
        }
      }

      // Process other expense receipts
      if (gig.other_expense_receipts && gig.other_expense_receipts.length > 0) {
        console.log(`   📸 Migrating ${gig.other_expense_receipts.length} other receipts...`);
        
        for (let i = 0; i < gig.other_expense_receipts.length; i++) {
          const receiptData = gig.other_expense_receipts[i];
          
          if (receiptData && receiptData.startsWith('data:image/')) {
            try {
              const originalSize = receiptData.length;
              totalSizeSaved += originalSize;
              
              // Upload to Supabase Storage
              const url = await uploadReceiptToStorage(
                gig.user_id,
                gig.id,
                'other',
                receiptData,
                `other_receipt_${i + 1}.jpg`
              );
              
              otherUrls.push(url);
              totalUploaded++;
              
              console.log(`   ✅ Uploaded other receipt ${i + 1} (${Math.round(originalSize/1024)}KB)`);
              
              // Small delay to prevent rate limiting
              await new Promise(resolve => setTimeout(resolve, 200));
            } catch (error) {
              console.error(`   ❌ Failed to upload other receipt ${i + 1}:`, error.message);
            }
          }
        }
      }

      // Update database with URLs instead of base64 data
      await pool.query(`
        UPDATE gigs 
        SET parking_receipts = $1,
            other_expense_receipts = $2
        WHERE id = $3
      `, [
        parkingUrls.length > 0 ? parkingUrls : null,
        otherUrls.length > 0 ? otherUrls : null,
        gig.id
      ]);

      migratedGigs++;
      console.log(`   ✅ Updated gig ${gig.id} with ${parkingUrls.length + otherUrls.length} storage URLs`);
    }

    console.log('\n🎉 MIGRATION COMPLETE!');
    console.log('======================');
    console.log(`📊 Gigs migrated: ${migratedGigs}`);
    console.log(`📤 Total files uploaded: ${totalUploaded}`);
    console.log(`💾 Database size reduced: ${Math.round(totalSizeSaved / 1024 / 1024)}MB`);
    console.log(`☁️  Files now in Supabase Storage with CDN delivery`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await pool.end();
  }
}

async function uploadReceiptToStorage(userId, gigId, receiptType, imageData, fileName) {
  // Convert base64 to buffer
  const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');
  
  // Create organized file path
  const timestamp = Date.now();
  const extension = fileName.split('.').pop() || 'jpg';
  const filePath = `user_${userId}/gig_${gigId}/${receiptType}/receipt_${timestamp}.${extension}`;
  
  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from('receipts')
    .upload(filePath, buffer, {
      contentType: getContentType(extension),
      upsert: false
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('receipts')
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}

function getContentType(extension) {
  const types = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg', 
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif'
  };
  return types[extension.toLowerCase()] || 'image/jpeg';
}

// Run migration
migrateReceiptsToStorage().catch(console.error);