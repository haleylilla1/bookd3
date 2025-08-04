// Artillery.js load testing processor
// Custom logic for handling authentication and request processing

module.exports = {
  // Set up virtual user session data
  setUserContext: function(requestParams, context, next) {
    // Simulate different user IDs for load testing
    context.vars.userId = Math.floor(Math.random() * 100) + 1;
    context.vars.testSession = `test-session-${context.vars.userId}`;
    return next();
  },

  // Log response times for analysis
  logResponse: function(requestParams, response, context, next) {
    if (response.statusCode >= 400) {
      console.log(`❌ Error ${response.statusCode} for ${requestParams.url}`);
    } else if (response.timings && response.timings.response > 1000) {
      console.log(`🐌 Slow response: ${requestParams.url} took ${response.timings.response}ms`);
    }
    return next();
  },

  // Test pagination parameters
  setPaginationParams: function(requestParams, context, next) {
    const limits = [10, 25, 50, 100];
    const offsets = [0, 10, 25, 50, 100];
    
    context.vars.limit = limits[Math.floor(Math.random() * limits.length)];
    context.vars.offset = offsets[Math.floor(Math.random() * offsets.length)];
    
    return next();
  },

  // Validate response structure for paginated endpoints
  validatePaginatedResponse: function(requestParams, response, context, next) {
    if (response.statusCode === 200) {
      try {
        const data = JSON.parse(response.body);
        
        // Check if response has pagination structure
        if (requestParams.url.includes('/api/gigs') || requestParams.url.includes('/api/expenses')) {
          if (!data.hasOwnProperty('total') || !Array.isArray(data.gigs || data.expenses)) {
            console.log(`⚠️ Invalid pagination structure for ${requestParams.url}`);
          }
        }
      } catch (e) {
        console.log(`⚠️ Invalid JSON response for ${requestParams.url}`);
      }
    }
    return next();
  }
};