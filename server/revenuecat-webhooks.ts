import crypto from 'crypto';
import { Request, Response } from 'express';
import { storage } from './storage';
import RevenueCatService from './revenuecat';

// RevenueCat webhook event types
interface RevenueCatWebhookEvent {
  event: {
    type: string;
    id: string;
    app_id: string;
    app_user_id: string;
    original_app_user_id: string;
    aliases: string[];
    original_transaction_id: string;
    product_id: string;
    period_type: string;
    purchased_at_ms: number;
    expiration_at_ms: number | null;
    environment: string;
    entitlement_id: string | null;
    entitlement_ids: string[];
    presented_offering_id: string | null;
    transaction_id: string;
    is_family_share: boolean;
    country_code: string;
    app_version: string;
    currency: string;
    price: number;
    price_in_purchased_currency: number;
    subscriber_attributes: Record<string, any>;
    store: string;
    takehome_percentage: number;
    offer_code: string | null;
    tax_percentage: number;
    commission_percentage: number;
  };
  api_version: string;
}

export class RevenueCatWebhookHandler {
  private static WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET || 'your-webhook-secret';

  // Verify webhook signature
  static verifyWebhookSignature(payload: string, signature: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.WEBHOOK_SECRET)
        .update(payload)
        .digest('hex');
      
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      console.error('❌ Webhook signature verification failed:', error);
      return false;
    }
  }

  // Handle subscription events
  static async handleWebhookEvent(event: RevenueCatWebhookEvent): Promise<void> {
    try {
      const { type, app_user_id, product_id, expiration_at_ms, purchased_at_ms } = event.event;
      const userId = parseInt(app_user_id);

      if (isNaN(userId)) {
        console.error('❌ Invalid user ID from webhook:', app_user_id);
        return;
      }

      console.log(`🔔 RevenueCat webhook: ${type} for user ${userId}, product: ${product_id}`);

      // Get user from database
      const user = await storage.getUser(userId);
      if (!user) {
        console.error('❌ User not found for webhook event:', userId);
        return;
      }

      // Map product IDs to subscription tiers
      const tierMapping: Record<string, string> = {
        'pro_monthly': 'pro',
        'premium_monthly': 'premium',
        'pro_annual': 'pro',
        'premium_annual': 'premium'
      };

      let subscriptionTier = tierMapping[product_id] || 'trial';
      let subscriptionStatus = 'trial';
      let expiresAt: Date | null = null;

      // Handle different event types
      switch (type) {
        case 'INITIAL_PURCHASE':
        case 'RENEWAL':
        case 'PRODUCT_CHANGE':
          subscriptionStatus = 'active';
          if (expiration_at_ms) {
            expiresAt = new Date(expiration_at_ms);
          }
          console.log(`✅ Subscription activated: ${subscriptionTier} for user ${userId}`);
          break;

        case 'CANCELLATION':
          subscriptionStatus = 'cancelled';
          if (expiration_at_ms) {
            expiresAt = new Date(expiration_at_ms);
          }
          console.log(`⚠️ Subscription cancelled: ${subscriptionTier} for user ${userId}`);
          break;

        case 'EXPIRATION':
          subscriptionStatus = 'expired';
          subscriptionTier = 'trial';
          expiresAt = null;
          console.log(`❌ Subscription expired for user ${userId}`);
          break;

        case 'BILLING_ISSUE':
          subscriptionStatus = 'past_due';
          console.log(`⚠️ Billing issue for user ${userId}`);
          break;

        default:
          console.log(`ℹ️ Unhandled webhook event type: ${type}`);
          return;
      }

      // Update user subscription in database
      await storage.updateUser(userId, {
        subscriptionTier,
        subscriptionStatus,
        subscriptionExpiresAt: expiresAt
      });

      // Update RevenueCat customer attributes
      await RevenueCatService.updateCustomerAttributes(userId.toString(), {
        subscription_tier: subscriptionTier,
        subscription_status: subscriptionStatus,
        last_webhook_event: type,
        webhook_processed_at: new Date().toISOString()
      });

      console.log(`✅ Subscription updated: ${userId} → ${subscriptionStatus} (${subscriptionTier})`);
    } catch (error) {
      console.error('❌ Webhook event processing failed:', error);
      throw error;
    }
  }

  // Express middleware for webhook endpoint
  static async handleWebhookRequest(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.headers['authorization'] as string;
      const payload = JSON.stringify(req.body);

      // Verify webhook signature (skip in development)
      if (process.env.NODE_ENV === 'production' && signature) {
        const isValid = this.verifyWebhookSignature(payload, signature);
        if (!isValid) {
          console.error('❌ Invalid webhook signature');
          res.status(401).json({ error: 'Invalid signature' });
          return;
        }
      }

      // Process the webhook event
      await this.handleWebhookEvent(req.body);

      res.status(200).json({ success: true, message: 'Webhook processed successfully' });
    } catch (error) {
      console.error('❌ Webhook processing error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  // Test webhook functionality
  static async testWebhook(userId: number, eventType: string = 'INITIAL_PURCHASE'): Promise<boolean> {
    try {
      const mockEvent: RevenueCatWebhookEvent = {
        event: {
          type: eventType,
          id: 'test-event-' + Date.now(),
          app_id: 'bookd-app',
          app_user_id: userId.toString(),
          original_app_user_id: userId.toString(),
          aliases: [],
          original_transaction_id: 'test-transaction',
          product_id: 'pro_monthly',
          period_type: 'NORMAL',
          purchased_at_ms: Date.now(),
          expiration_at_ms: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days
          environment: 'SANDBOX',
          entitlement_id: 'pro_access',
          entitlement_ids: ['pro_access'],
          presented_offering_id: 'default',
          transaction_id: 'test-transaction-' + Date.now(),
          is_family_share: false,
          country_code: 'US',
          app_version: '1.0.0',
          currency: 'USD',
          price: 9.99,
          price_in_purchased_currency: 9.99,
          subscriber_attributes: {},
          store: 'WEB',
          takehome_percentage: 85,
          offer_code: null,
          tax_percentage: 0,
          commission_percentage: 15
        },
        api_version: '1.0'
      };

      await this.handleWebhookEvent(mockEvent);
      console.log(`✅ Test webhook processed successfully for user ${userId}`);
      return true;
    } catch (error) {
      console.error('❌ Test webhook failed:', error);
      return false;
    }
  }
}

export default RevenueCatWebhookHandler;