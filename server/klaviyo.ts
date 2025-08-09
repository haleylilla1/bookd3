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

  // Send password reset email via Klaviyo (when template is set up)
  static async sendPasswordResetEmail(email: string, resetToken: string): Promise<boolean> {
    // For now, just track the event - email templates would need to be set up in Klaviyo dashboard
    // This is a future enhancement that requires creating email templates in Klaviyo
    await this.trackEvent(email, 'Password Reset Email Requested', {
      reset_token: resetToken,
      reset_url: `${process.env.NODE_ENV === 'production' || process.env.REPLIT_DEPLOYMENT === '1' ? 'https://app.bookd.tools' : 'http://localhost:5000'}/?reset_token=${resetToken}`,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour from now
    });
    
    console.log('Password reset tracked in Klaviyo - email template integration pending');
    return false; // Return false to indicate email wasn't actually sent via Klaviyo yet
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

  // EMAIL AUTOMATION TRIGGERS FOR TEMPLATES
  // ========================================

  // Enhanced signup tracking with welcome email trigger
  static async trackUserSignupWithWelcomeEmail(email: string, userData: any): Promise<boolean> {
    if (!process.env.KLAVIYO_PRIVATE_API_KEY) {
      console.log("Klaviyo not configured, skipping signup tracking");
      return false;
    }

    try {
      // Create enhanced profile for segmentation
      await this.createOrUpdateProfile({
        email,
        firstName: userData.name || '',
        properties: {
          signupDate: new Date().toISOString(),
          source: 'bookd_app',
          userType: 'gig_worker',
          subscriptionTier: userData.subscriptionTier || 'trial',
          onboardingCompleted: false,
          totalGigs: 0,
          totalEarnings: 0,
          homeCity: userData.homeAddress ? this.extractCity(userData.homeAddress) : '',
          preferredGigTypes: userData.customGigTypes || [],
          signupMethod: userData.signupMethod || 'email'
        }
      });

      // Track "User Signup" event to trigger welcome email flow
      const eventSuccess = await this.trackEvent(
        email,
        'User Signup',
        {
          source: 'bookd_app',
          signupMethod: userData.signupMethod || 'email',
          timestamp: new Date().toISOString(),
          userAgent: userData.userAgent || '',
          referrer: userData.referrer || 'direct'
        }
      );

      if (eventSuccess) {
        console.log(`✅ Klaviyo: Welcome email sequence triggered for ${email}`);
      }
      
      return eventSuccess;
    } catch (error) {
      console.error('❌ Klaviyo signup tracking failed:', error);
      return false;
    }
  }

  // Trigger gig reminder emails
  static async triggerGigReminderEmail(email: string, gigData: any): Promise<boolean> {
    return await this.trackEvent(
      email,
      'Gig Reminder Due',
      {
        gigTitle: gigData.title,
        gigDate: gigData.date,
        gigClient: gigData.client,
        gigLocation: gigData.location,
        gigTime: gigData.time || 'TBD',
        reminderType: 'next_day',
        timestamp: new Date().toISOString()
      }
    );
  }

  // Trigger payment reminder emails
  static async triggerPaymentReminderEmail(email: string, gigData: any): Promise<boolean> {
    return await this.trackEvent(
      email,
      'Payment Reminder Due',
      {
        gigTitle: gigData.title,
        gigDate: gigData.date,
        gigClient: gigData.client,
        expectedAmount: gigData.expectedAmount || 'TBD',
        daysSinceGig: this.calculateDaysSince(gigData.date),
        timestamp: new Date().toISOString()
      }
    );
  }

  // Trigger emergency opportunity emails
  static async triggerEmergencyOpportunityEmail(email: string, opportunityData: any): Promise<boolean> {
    return await this.trackEvent(
      email,
      'Emergency Opportunity Available',
      {
        opportunityTitle: opportunityData.title,
        city: opportunityData.city,
        urgency: opportunityData.urgency || 'high',
        payRate: opportunityData.payRate || 'TBD',
        startDate: opportunityData.startDate,
        agency: opportunityData.agency,
        applicationDeadline: opportunityData.deadline || 'ASAP',
        timestamp: new Date().toISOString()
      }
    );
  }

  // Trigger weekly earnings summary emails
  static async triggerWeeklyEarningsSummary(email: string, summaryData: any): Promise<boolean> {
    return await this.trackEvent(
      email,
      'Weekly Earnings Summary',
      {
        weeklyEarnings: summaryData.totalEarnings,
        gigCount: summaryData.gigCount,
        topClient: summaryData.topClient || 'Various',
        averagePerGig: summaryData.averagePerGig,
        weekStartDate: summaryData.weekStartDate,
        weekEndDate: summaryData.weekEndDate,
        timestamp: new Date().toISOString()
      }
    );
  }

  // Helper methods
  private static extractCity(address: string): string {
    try {
      const parts = address.split(',');
      return parts.length >= 2 ? parts[1].trim() : '';
    } catch {
      return '';
    }
  }

  private static calculateDaysSince(dateString: string): number {
    try {
      const gigDate = new Date(dateString);
      const today = new Date();
      const diffTime = Math.abs(today.getTime() - gigDate.getTime());
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } catch {
      return 0;
    }
  }
}