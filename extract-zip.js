import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Try to read the zip file as binary data and examine its contents
try {
  const zipPath = path.join(__dirname, 'attached_assets', 'BookdPlatform_1752380236162.zip');
  const zipData = fs.readFileSync(zipPath);
  
  console.log('Zip file size:', zipData.length, 'bytes');
  console.log('First 100 bytes (hex):', zipData.slice(0, 100).toString('hex'));
  
  // Look for file entries in the zip structure
  const zipString = zipData.toString('ascii');
  
  // Parse basic ZIP structure
  console.log('Looking for file entries in ZIP...');
  
  // Search for common file extensions
  const fileTypes = ['.pdf', '.ts', '.js', '.json', '.md', '.txt'];
  
  fileTypes.forEach(ext => {
    const regex = new RegExp(`\\w+${ext.replace('.', '\\.')}`, 'gi');
    const matches = zipString.match(regex);
    if (matches) {
      console.log(`Found ${ext} files:`, matches.slice(0, 5)); // Show first 5 matches
    }
  });
  
  // Look for specific keywords related to PDF generation
  const keywords = [
    'professional-pdf',
    'mobile-pdf', 
    'generateReport',
    'addCoverPage',
    'addIncomeSummary',
    'addTaxBreakdown',
    'addMileageLog',
    'addReceipts',
    'addSummaryTotals'
  ];
  
  keywords.forEach(keyword => {
    if (zipString.includes(keyword)) {
      console.log('Found keyword:', keyword);
    }
  });
  
  // Try to extract readable text for the first few KB
  const readableText = zipData.toString('utf8', 0, Math.min(10000, zipData.length));
  console.log('First readable text snippet:');
  console.log(readableText.substring(0, 500).replace(/[\x00-\x1F\x7F-\x9F]/g, ' '));
  
  // Look for PDF signature anywhere in the file  
  const pdfSignature = Buffer.from('%PDF', 'ascii');
  let pdfIndex = zipData.indexOf(pdfSignature);
  
  if (pdfIndex !== -1) {
    console.log('Found PDF signature at index:', pdfIndex);
  } else {
    console.log('No PDF signature found in zip file');
  }
  
} catch (error) {
  console.error('Error reading zip file:', error.message);
}