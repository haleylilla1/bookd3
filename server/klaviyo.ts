import { ApiKeySession, ProfilesApi, EventsApi } from 'klaviyo-api';

if (!process.env.KLAVIYO_PRIVATE_API_KEY) {
  console.error("KLAVIYO_PRIVATE_API_KEY environment variable must be set");
}

const session = new ApiKeySession(process.env.KLAVIYO_PRIVATE_API_KEY || '');
const profilesApi = new ProfilesApi(session);
const eventsApi = new EventsApi(session);

interface UserProfile {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  organization?: string;
  location?: {
    address1?: string;
    city?: string;
    region?: string;
    country?: string;
    zip?: string;
  };
  properties?: Record<string, any>;
}

interface GigWorkerProperties {
  signupDate: string;
  subscriptionTier: string;
  homeAddress?: string;
  primaryGigTypes?: string[];
  preferredClients?: string[];
  totalEarnings?: number;
  totalGigs?: number;
  totalExpenses?: number;
  onboardingCompleted?: boolean;
  lastLogin?: string;
}

export class KlaviyoService {
  
  // Create or update user profile
  static async createOrUpdateProfile(profile: UserProfile): Promise<boolean> {
    if (!process.env.KLAVIYO_PRIVATE_API_KEY) {
      console.log("Klaviyo not configured, skipping profile creation");
      return false;
    }

    try {
      const [firstName, ...lastNameParts] = (profile.firstName || '').split(' ');
      const lastName = lastNameParts.join(' ') || profile.lastName || '';

      const profileData = {
        data: {
          type: 'profile' as const,
          attributes: {
            email: profile.email,
            firstName: firstName || undefined,
            lastName: lastName || undefined,
            phone: profile.phone,
            organization: profile.organization,
            location: profile.location,
            properties: profile.properties || {}
          }
        }
      };

      await profilesApi.createProfile(profileData);
      console.log(`Klaviyo profile created/updated for ${profile.email}`);
      return true;
    } catch (error) {
      console.error('Klaviyo profile creation failed:', error);
      return false;
    }
  }

  // Track user events (gig created, payment received, etc.)
  static async trackEvent(
    email: string, 
    eventName: string, 
    properties: Record<string, any> = {},
    userProperties: Record<string, any> = {}
  ): Promise<boolean> {
    if (!process.env.KLAVIYO_PRIVATE_API_KEY) {
      console.log("Klaviyo not configured, skipping event tracking");
      return false;
    }

    try {
      const eventData = {
        data: {
          type: 'event' as const,
          attributes: {
            profile: {
              data: {
                type: 'profile' as const,
                attributes: {
                  email,
                  properties: userProperties
                }
              }
            },
            metric: {
              data: {
                type: 'metric' as const,
                attributes: {
                  name: eventName
                }
              }
            },
            properties,
            time: new Date()
          }
        }
      };

      await eventsApi.createEvent(eventData);
      console.log(`Klaviyo event tracked: ${eventName} for ${email}`);
      return true;
    } catch (error) {
      console.error('Klaviyo event tracking failed:', error);
      return false;
    }
  }

  // Specialized methods for gig worker events
  static async trackUserSignup(email: string, name: string, properties: GigWorkerProperties): Promise<boolean> {
    const [firstName, ...rest] = name.split(' ');
    const lastName = rest.join(' ');

    // Create profile
    const profileSuccess = await this.createOrUpdateProfile({
      email,
      firstName,
      lastName,
      properties: {
        ...properties,
        user_type: 'gig_worker',
        platform: 'bookd_app'
      }
    });

    // Track signup event
    const eventSuccess = await this.trackEvent(
      email,
      'User Signed Up',
      {
        signup_source: 'bookd_app',
        subscription_tier: properties.subscriptionTier,
        signup_date: properties.signupDate
      },
      { user_type: 'gig_worker' }
    );

    return profileSuccess && eventSuccess;
  }

  static async trackOnboardingCompleted(
    email: string, 
    onboardingData: {
      homeAddress: string;
      gigTypes: string[];
      preferredClients: string[];
    }
  ): Promise<boolean> {
    // Update profile with onboarding data
    await this.createOrUpdateProfile({
      email,
      properties: {
        onboarding_completed: true,
        home_address: onboardingData.homeAddress,
        primary_gig_types: onboardingData.gigTypes,
        preferred_clients: onboardingData.preferredClients,
        onboarding_completed_date: new Date().toISOString()
      }
    });

    // Track onboarding completion event
    return await this.trackEvent(
      email,
      'Onboarding Completed',
      {
        home_address: onboardingData.homeAddress,
        gig_types: onboardingData.gigTypes,
        preferred_clients: onboardingData.preferredClients,
        completion_date: new Date().toISOString()
      }
    );
  }

  static async trackGigCreated(
    email: string,
    gigData: {
      eventName: string;
      expectedPay: number;
      gigType: string;
      date: string;
    }
  ): Promise<boolean> {
    return await this.trackEvent(
      email,
      'Gig Created',
      {
        gig_name: gigData.eventName,
        expected_pay: gigData.expectedPay,
        gig_type: gigData.gigType,
        gig_date: gigData.date,
        created_at: new Date().toISOString()
      }
    );
  }

  static async trackPaymentReceived(
    email: string,
    paymentData: {
      amount: number;
      gigName: string;
      paymentDate: string;
    }
  ): Promise<boolean> {
    return await this.trackEvent(
      email,
      'Payment Received',
      {
        amount: paymentData.amount,
        gig_name: paymentData.gigName,
        payment_date: paymentData.paymentDate,
        received_at: new Date().toISOString()
      }
    );
  }

  static async trackExpenseAdded(
    email: string,
    expenseData: {
      amount: number;
      category: string;
      description: string;
    }
  ): Promise<boolean> {
    return await this.trackEvent(
      email,
      'Expense Added',
      {
        amount: expenseData.amount,
        category: expenseData.category,
        description: expenseData.description,
        added_at: new Date().toISOString()
      }
    );
  }

  static async trackSupportRequest(
    email: string,
    supportData: {
      subject: string;
      category: string;
      urgency: string;
    }
  ): Promise<boolean> {
    return await this.trackEvent(
      email,
      'Support Request Submitted',
      {
        subject: supportData.subject,
        category: supportData.category,
        urgency: supportData.urgency,
        submitted_at: new Date().toISOString()
      }
    );
  }

  // Update user properties (for profile enrichment)
  static async updateUserProperties(email: string, properties: Record<string, any>): Promise<boolean> {
    return await this.createOrUpdateProfile({
      email,
      properties
    });
  }
}