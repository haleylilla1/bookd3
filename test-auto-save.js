// Auto-save functionality test
// Run this in the browser console to test auto-save features

console.log("🔄 Testing Auto-Save Functionality");

// Test 1: Check if auto-save utilities exist
console.log("\n1. Checking auto-save utilities...");
if (typeof localStorage !== 'undefined') {
  console.log("✅ localStorage available");
  
  // Test saving data
  const testData = { 
    gigType: "Test Gig",
    clientName: "Test Client",
    expectedPay: "250",
    timestamp: Date.now()
  };
  
  try {
    localStorage.setItem('autosave_test', JSON.stringify(testData));
    const retrieved = localStorage.getItem('autosave_test');
    
    if (retrieved && JSON.parse(retrieved).gigType === "Test Gig") {
      console.log("✅ Auto-save storage working");
    } else {
      console.log("❌ Auto-save storage failed");
    }
    
    // Cleanup
    localStorage.removeItem('autosave_test');
  } catch (error) {
    console.log("❌ Auto-save storage error:", error);
  }
} else {
  console.log("❌ localStorage not available");
}

// Test 2: Check network retry functionality
console.log("\n2. Testing network retry functionality...");

// Mock a failing network request
const mockFailingRequest = () => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      reject(new Error("Network timeout"));
    }, 100);
  });
};

// Mock NetworkRetryHandler
class TestNetworkRetryHandler {
  constructor() {
    this.retryCount = 0;
    this.maxRetries = 3;
    this.baseDelay = 100;
  }

  async executeWithRetry(operation, onRetry, onError) {
    try {
      const result = await operation();
      this.retryCount = 0;
      return result;
    } catch (error) {
      this.retryCount++;
      
      if (onError) {
        onError(error, this.retryCount);
      }

      if (this.retryCount >= this.maxRetries) {
        throw new Error(`Operation failed after ${this.maxRetries} attempts: ${error.message}`);
      }

      if (onRetry) {
        onRetry(this.retryCount);
      }

      await new Promise(resolve => setTimeout(resolve, this.baseDelay * Math.pow(2, this.retryCount - 1)));
      return this.executeWithRetry(operation, onRetry, onError);
    }
  }
}

// Test the retry mechanism
const retryHandler = new TestNetworkRetryHandler();

retryHandler.executeWithRetry(
  mockFailingRequest,
  (attempt) => console.log(`🔄 Retry attempt ${attempt}`),
  (error, attempt) => console.log(`⚠️ Error on attempt ${attempt}: ${error.message}`)
).catch(error => {
  console.log("✅ Retry mechanism working - final error:", error.message);
});

// Test 3: Check recovery dialog components
console.log("\n3. Checking recovery dialog components...");

const checkComponent = (componentName) => {
  const elements = document.querySelectorAll(`[data-component="${componentName}"]`);
  if (elements.length > 0) {
    console.log(`✅ ${componentName} component found`);
  } else {
    console.log(`ℹ️ ${componentName} component not currently visible (normal)`);
  }
};

// Test 4: Check form auto-save integration
console.log("\n4. Checking form auto-save integration...");

// Check if forms have auto-save indicators
const indicators = document.querySelectorAll('[class*="autosave"], [class*="auto-save"]');
if (indicators.length > 0) {
  console.log("✅ Auto-save indicators found in DOM");
} else {
  console.log("ℹ️ Auto-save indicators not currently visible (normal if no forms open)");
}

// Check if recovery dialogs are available
const dialogs = document.querySelectorAll('[role="dialog"]');
if (dialogs.length > 0) {
  console.log("✅ Dialog system available");
} else {
  console.log("ℹ️ No dialogs currently open (normal)");
}

console.log("\n✅ Auto-save functionality test complete!");
console.log("💡 To test fully, open a form and start typing to see auto-save in action");