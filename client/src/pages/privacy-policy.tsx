import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function PrivacyPolicy() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/")}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to App
          </Button>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-gray-600 mb-8">
            Effective Date: August 9, 2025 • Last Updated: August 9, 2025
          </p>

          <div className="prose prose-gray max-w-none">
            <h2>1. Introduction</h2>
            <p>
              Bookd ("we," "our," or "us") respects your privacy and is committed to protecting your personal information. 
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our 
              mobile application and web service (the "Service").
            </p>

            <h2>2. Information We Collect</h2>
            
            <h3>2.1 Information You Provide Directly</h3>
            <ul>
              <li><strong>Account Information</strong>: Name, email address, password</li>
              <li><strong>Profile Information</strong>: Home address, business details, tax preferences</li>
              <li><strong>Gig Data</strong>: Event details, client information, payment amounts, dates</li>
              <li><strong>Expense Information</strong>: Business expenses, receipts, mileage tracking</li>
              <li><strong>Financial Goals</strong>: Income targets and savings objectives</li>
            </ul>

            <h3>2.2 Information Collected Automatically</h3>
            <ul>
              <li><strong>Usage Data</strong>: App interactions, feature usage, session duration</li>
              <li><strong>Device Information</strong>: Device type, operating system, app version</li>
              <li><strong>Location Data</strong>: GPS coordinates for mileage calculation (when permitted)</li>
              <li><strong>Error Data</strong>: Crash reports and performance analytics</li>
            </ul>

            <h2>3. How We Use Your Information</h2>
            
            <h3>3.1 Core App Functionality</h3>
            <ul>
              <li>Provide gig tracking and financial management services</li>
              <li>Calculate mileage and generate tax reports</li>
              <li>Manage your subscription and billing</li>
              <li>Sync data across your devices</li>
            </ul>

            <h3>3.2 Communication</h3>
            <ul>
              <li>Send important account notifications</li>
              <li>Provide customer support</li>
              <li>Share product updates (with your consent)</li>
            </ul>

            <h2>4. Information Sharing and Disclosure</h2>
            
            <h3>4.1 Third-Party Service Providers</h3>
            <p>We share your information with trusted service providers who help us operate our Service:</p>
            <ul>
              <li><strong>RevenueCat</strong>: Subscription management and analytics</li>
              <li><strong>Sentry</strong>: Error monitoring and crash reporting</li>
              <li><strong>Klaviyo</strong>: Email marketing and user analytics (with consent)</li>
              <li><strong>SendGrid</strong>: Transactional email delivery</li>
              <li><strong>Google Maps</strong>: Address validation and mileage calculation</li>
              <li><strong>Neon Database</strong>: Secure data storage</li>
            </ul>

            <h2>5. Your Privacy Rights</h2>
            
            <h3>5.1 Access and Control</h3>
            <p>You have the right to:</p>
            <ul>
              <li>Access your personal information</li>
              <li>Update or correct your data</li>
              <li>Delete your account and data</li>
              <li>Export your data in a portable format</li>
              <li>Opt out of marketing communications</li>
            </ul>

            <h2>6. Data Security</h2>
            <p>
              We implement industry-standard security measures including encryption of data in transit and at rest, 
              secure authentication and session management, regular security audits, and limited access controls.
            </p>

            <h2>7. Children's Privacy</h2>
            <p>
              Bookd is not intended for children under 13. We do not knowingly collect personal information from 
              children under 13. If we become aware that we have collected such information, we will delete it immediately.
            </p>

            <h2>8. Changes to This Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of significant changes by 
              posting the updated policy in the app, sending an email notification, or displaying a prominent notice.
            </p>

            <h2>9. Contact Information</h2>
            <p>If you have questions about this Privacy Policy or our privacy practices, contact us:</p>
            <ul>
              <li><strong>Email</strong>: privacy@bookd.tools</li>
              <li><strong>Website</strong>: bookd.tools</li>
            </ul>

            <div className="bg-blue-50 p-6 rounded-lg mt-8">
              <h3 className="text-lg font-semibold mb-2">Your Rights</h3>
              <p className="text-sm text-gray-700">
                You can manage your privacy settings and data within the Bookd app. 
                To request data deletion or export, or if you have any privacy concerns, 
                please contact us at privacy@bookd.tools.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}