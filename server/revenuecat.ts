import axios from 'axios';

// RevenueCat Configuration
const REVENUECAT_API_URL = 'https://api.revenuecat.com/v1';

// For now, we'll use the secret key you provided
// Note: Normally we'd need both public and secret keys
const API_KEY = 'sk_JleBArnJYfZlijVcaCtAAYLCoDKKc';

export class RevenueCatService {
  private static headers = {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
    'X-Platform': 'web'
  };

  // Create or get customer (user)
  static async createCustomer(userId: string, email: string, attributes: any = {}) {
    try {
      const response = await axios.post(
        `${REVENUECAT_API_URL}/subscribers/${userId}`,
        {
          email,
          attributes: {
            '$email': email,
            '$displayName': attributes.name || '',
            'source': 'bookd_web',
            'userType': 'gig_worker',
            ...attributes
          }
        },
        { headers: this.headers }
      );

      console.log(`✅ RevenueCat customer created: ${userId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 409) {
        // Customer already exists, which is fine
        console.log(`✅ RevenueCat customer exists: ${userId}`);
        return await this.getCustomer(userId);
      }
      console.error('❌ RevenueCat customer creation failed:', error.response?.data || error.message);
      throw error;
    }
  }

  // Get customer information
  static async getCustomer(userId: string) {
    try {
      const response = await axios.get(
        `${REVENUECAT_API_URL}/subscribers/${userId}`,
        { headers: this.headers }
      );
      return response.data;
    } catch (error: any) {
      console.error('❌ RevenueCat get customer failed:', error.response?.data || error.message);
      throw error;
    }
  }

  // Create purchase (for subscription)
  static async createPurchase(userId: string, receiptData: any) {
    try {
      const response = await axios.post(
        `${REVENUECAT_API_URL}/subscribers/${userId}/receipts`,
        {
          fetch_token: receiptData.fetch_token,
          app_user_id: userId,
          attributes: {
            'purchase_source': 'bookd_web'
          }
        },
        { headers: this.headers }
      );

      console.log(`✅ RevenueCat purchase recorded: ${userId}`);
      return response.data;
    } catch (error: any) {
      console.error('❌ RevenueCat purchase failed:', error.response?.data || error.message);
      throw error;
    }
  }

  // Update customer attributes (for analytics)
  static async updateCustomerAttributes(userId: string, attributes: any) {
    try {
      const response = await axios.post(
        `${REVENUECAT_API_URL}/subscribers/${userId}/attributes`,
        {
          attributes: {
            ...attributes,
            'last_updated': new Date().toISOString()
          }
        },
        { headers: this.headers }
      );

      console.log(`✅ RevenueCat attributes updated: ${userId}`);
      return response.data;
    } catch (error: any) {
      console.error('❌ RevenueCat attribute update failed:', error.response?.data || error.message);
      throw error;
    }
  }

  // Check subscription status
  static async getSubscriptionStatus(userId: string) {
    try {
      const customer = await this.getCustomer(userId);
      
      if (!customer.subscriber) {
        return { 
          hasActiveSubscription: false, 
          subscriptions: [],
          entitlements: {}
        };
      }

      const subscriber = customer.subscriber;
      const activeSubscriptions = Object.keys(subscriber.subscriptions || {})
        .filter(key => {
          const sub = subscriber.subscriptions[key];
          return sub.expires_date && new Date(sub.expires_date) > new Date();
        });

      return {
        hasActiveSubscription: activeSubscriptions.length > 0,
        subscriptions: subscriber.subscriptions || {},
        entitlements: subscriber.entitlements || {},
        activeSubscriptions
      };
    } catch (error: any) {
      console.error('❌ RevenueCat subscription check failed:', error.response?.data || error.message);
      return { 
        hasActiveSubscription: false, 
        subscriptions: [],
        entitlements: {},
        error: error.message
      };
    }
  }

  // Track events for analytics
  static async trackEvent(userId: string, eventName: string, properties: any = {}) {
    try {
      await this.updateCustomerAttributes(userId, {
        [`event_${eventName}`]: new Date().toISOString(),
        [`event_${eventName}_properties`]: JSON.stringify(properties)
      });

      console.log(`✅ RevenueCat event tracked: ${eventName} for ${userId}`);
      return true;
    } catch (error: any) {
      console.error('❌ RevenueCat event tracking failed:', error.response?.data || error.message);
      return false;
    }
  }

  // Helper: Check if user has premium features
  static async hasPremiumAccess(userId: string): Promise<boolean> {
    try {
      const status = await this.getSubscriptionStatus(userId);
      return status.hasActiveSubscription;
    } catch (error) {
      console.error('❌ Premium access check failed:', error);
      return false; // Default to free access on error
    }
  }
}

export default RevenueCatService;