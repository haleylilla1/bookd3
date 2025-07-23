import { createClient } from '@supabase/supabase-js';

async function setupSupabaseStorage() {
  console.log('🔧 Setting up Supabase storage for receipt photos...');
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials. Please add:');
    console.error('   - SUPABASE_URL');
    console.error('   - SUPABASE_SERVICE_ROLE_KEY');
    return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // 1. Create the receipts storage bucket
    console.log('📦 Creating receipts storage bucket...');
    const { data: bucket, error: bucketError } = await supabase.storage.createBucket('receipts', {
      public: true,
      fileSizeLimit: 10485760, // 10MB limit
      allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    });
    
    if (bucketError && !bucketError.message.includes('already exists')) {
      console.error('❌ Failed to create bucket:', bucketError);
      return;
    }
    
    if (bucketError && bucketError.message.includes('already exists')) {
      console.log('✅ Receipts bucket already exists');
    } else {
      console.log('✅ Receipts bucket created successfully');
    }
    
    // 2. Set up Row Level Security policies
    console.log('🔒 Setting up storage policies...');
    
    // Policy to allow users to upload their own receipts
    const insertPolicy = `
      CREATE POLICY "Users can upload their own receipts" 
      ON storage.objects FOR INSERT 
      WITH CHECK (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
    `;
    
    // Policy to allow users to view their own receipts
    const selectPolicy = `
      CREATE POLICY "Users can view their own receipts" 
      ON storage.objects FOR SELECT 
      USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
    `;
    
    // Since we don't have auth.uid() in our setup, we'll make it public for now
    // In a production app with proper auth, you'd use the policies above
    
    console.log('⚠️  Setting up public read access (development mode)');
    
    // 3. Test the storage service
    console.log('🧪 Testing receipt storage service...');
    
    // Test upload with a small base64 image
    const testImageBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAgACgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==';
    
    const base64Data = testImageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    const testPath = `receipts/test/test_receipt_${Date.now()}.jpg`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(testPath, buffer, {
        contentType: 'image/jpeg',
        upsert: false
      });
    
    if (uploadError) {
      console.error('❌ Test upload failed:', uploadError);
      return;
    }
    
    console.log('✅ Test upload successful:', uploadData);
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('receipts')
      .getPublicUrl(testPath);
    
    console.log('✅ Public URL generated:', publicUrl);
    
    // Clean up test file
    await supabase.storage.from('receipts').remove([testPath]);
    console.log('🧹 Test file cleaned up');
    
    console.log('\n🎉 Supabase receipt storage setup complete!');
    console.log('📸 Receipt storage service is ready for use');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

// Run setup
setupSupabaseStorage().catch(console.error);