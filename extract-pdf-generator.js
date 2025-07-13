import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

try {
  const zipPath = path.join(__dirname, 'attached_assets', 'BookdPlatform_1752380236162.zip');
  const zipData = fs.readFileSync(zipPath);
  
  // Look for the professional-pdf-generator.ts file in the zip
  const zipString = zipData.toString('binary');
  
  // Find the professional-pdf-generator.ts file
  const searchText = 'professional-pdf-generator.ts';
  const fileIndex = zipString.indexOf(searchText);
  
  if (fileIndex !== -1) {
    console.log('Found professional-pdf-generator.ts at index:', fileIndex);
    
    // Try to extract the content after the filename
    // Look for TypeScript/JavaScript code patterns
    const startPatterns = [
      'import {',
      'export class',
      'interface ',
      'function '
    ];
    
    let contentStart = -1;
    for (let i = fileIndex; i < zipString.length - 1000; i++) {
      const chunk = zipString.substring(i, i + 100);
      for (const pattern of startPatterns) {
        if (chunk.includes(pattern)) {
          contentStart = i;
          break;
        }
      }
      if (contentStart !== -1) break;
    }
    
    if (contentStart !== -1) {
      // Extract a reasonable chunk of code
      const codeContent = zipString.substring(contentStart, contentStart + 50000);
      
      // Clean up the content - remove binary data and keep readable text
      const cleanContent = codeContent.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\xFF]/g, '');
      
      // Look for key methods and structure
      const methods = [
        'addCoverPage',
        'addIncomeSummary', 
        'addTaxBreakdown',
        'addDetailedTaxEstimatesByGig',
        'addMileageLog',
        'addReceiptsPages',
        'addSummaryTotals'
      ];
      
      console.log('Professional PDF Generator Code Structure:');
      console.log('=====================================');
      
      methods.forEach(method => {
        const methodIndex = cleanContent.indexOf(method);
        if (methodIndex !== -1) {
          console.log(`\n--- ${method} ---`);
          // Extract the method and surrounding context
          const methodContent = cleanContent.substring(methodIndex, methodIndex + 2000);
          const lines = methodContent.split('\n').slice(0, 30); // First 30 lines
          console.log(lines.join('\n'));
          console.log('...\n');
        }
      });
      
      // Save the extracted content
      fs.writeFileSync('./extracted-pdf-generator.txt', cleanContent);
      console.log('Full content saved to extracted-pdf-generator.txt');
      
    } else {
      console.log('Could not find code content after filename');
    }
  } else {
    console.log('professional-pdf-generator.ts not found in zip');
  }
  
} catch (error) {
  console.error('Error:', error.message);
}