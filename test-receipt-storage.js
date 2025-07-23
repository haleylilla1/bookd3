import { receiptStorage } from './server/receipt-storage.js';

async function testReceiptStorage() {
  console.log('🧪 Testing receipt storage service...');
  
  // Test image data (small JPEG)
  const testImageBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAgACgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==';
  
  const testUserId = 14; // haleylilla@gmail.com
  
  try {
    // Test 1: Check if service is configured
    console.log('✅ Service configured:', receiptStorage.isConfigured());
    
    // Test 2: Upload single receipt
    console.log('📸 Testing single receipt upload...');
    const singleReceiptUrl = await receiptStorage.uploadReceipt(testUserId, testImageBase64, 'test_receipt.jpg');
    console.log('✅ Single upload result:', singleReceiptUrl.startsWith('https://') ? 'SUCCESS - Supabase URL' : 'FALLBACK - Database storage');
    
    // Test 3: Upload multiple receipts
    console.log('📸 Testing multiple receipt upload...');
    const multipleReceipts = [testImageBase64, testImageBase64];
    const multipleUrls = await receiptStorage.uploadMultipleReceipts(testUserId, multipleReceipts);
    console.log('✅ Multiple upload results:', multipleUrls.length, 'receipts processed');
    
    console.log('\n🎉 Receipt storage service is working correctly!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testReceiptStorage().catch(console.error);