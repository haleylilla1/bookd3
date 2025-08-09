import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function TermsOfService() {
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
          <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
          <p className="text-gray-600 mb-8">
            Effective Date: August 9, 2025 • Last Updated: August 9, 2025
          </p>

          <div className="prose prose-gray max-w-none">
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing or using Bookd (the "Service"), you agree to be bound by these Terms of Service ("Terms"). 
              If you do not agree to these Terms, do not use the Service.
            </p>

            <h2>2. Description of Service</h2>
            <p>Bookd is a financial management platform designed for gig workers and freelancers to:</p>
            <ul>
              <li>Track gigs and manage schedules</li>
              <li>Record expenses and income</li>
              <li>Calculate mileage and tax deductions</li>
              <li>Generate financial reports</li>
              <li>Set and monitor financial goals</li>
            </ul>

            <h2>3. Eligibility</h2>
            <p>
              You must be at least 18 years old to use Bookd. By using the Service, you represent that you meet 
              this age requirement and have the legal authority to enter into these Terms.
            </p>

            <h2>4. User Accounts</h2>
            <p>To use Bookd, you must create an account with accurate information. You are responsible for:</p>
            <ul>
              <li>Maintaining the confidentiality of your login credentials</li>
              <li>All activities that occur under your account</li>
              <li>Notifying us immediately of any unauthorized use</li>
            </ul>

            <h2>5. Subscription Plans and Billing</h2>
            
            <h3>5.1 Subscription Plans</h3>
            <p>Bookd offers multiple subscription tiers:</p>
            <ul>
              <li><strong>Trial</strong>: Free 7-day trial with limited features</li>
              <li><strong>Pro</strong>: $9.99/month with full features</li>
              <li><strong>Premium</strong>: $19.99/month with advanced features</li>
            </ul>

            <h3>5.2 Billing Terms</h3>
            <ul>
              <li>Subscriptions are billed monthly or annually in advance</li>
              <li>All fees are non-refundable except as required by law</li>
              <li>Prices may change with 30 days' notice</li>
              <li>Subscriptions auto-renew unless cancelled</li>
            </ul>

            <h2>6. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul>
              <li>Use the Service for any illegal activities</li>
              <li>Input false or misleading information</li>
              <li>Attempt to gain unauthorized access to the Service</li>
              <li>Interfere with the Service's operation</li>
              <li>Use the Service to harass or harm others</li>
              <li>Violate any applicable laws or regulations</li>
            </ul>

            <h2>7. User Content and Data</h2>
            <p>
              You retain ownership of all data you input into Bookd. You grant us a limited license to use your 
              data solely to provide the Service. You are responsible for the accuracy of all information you provide.
            </p>

            <h2>8. Tax and Financial Disclaimer</h2>
            
            <div className="bg-yellow-50 p-6 rounded-lg my-6">
              <h3 className="text-lg font-semibold mb-2 text-yellow-800">Important Disclaimer</h3>
              <p className="text-yellow-700">
                <strong>Bookd provides tools for organizing financial information but does not provide tax, legal, or financial advice.</strong>
              </p>
            </div>

            <p>Always consult qualified professionals for:</p>
            <ul>
              <li>Tax preparation and filing</li>
              <li>Legal compliance matters</li>
              <li>Financial planning decisions</li>
            </ul>

            <p>You are solely responsible for:</p>
            <ul>
              <li>Accurately reporting your income and expenses</li>
              <li>Complying with all tax obligations</li>
              <li>Maintaining proper business records</li>
              <li>Understanding applicable laws and regulations</li>
            </ul>

            <h2>9. Limitation of Liability</h2>
            <p>
              THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. TO THE MAXIMUM EXTENT PERMITTED BY LAW, 
              OUR LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID FOR THE SERVICE IN THE 12 MONTHS PRECEDING THE CLAIM.
            </p>

            <p>WE ARE NOT LIABLE FOR:</p>
            <ul>
              <li>Lost profits or business opportunities</li>
              <li>Data loss or corruption</li>
              <li>Third-party actions or failures</li>
              <li>Tax penalties or legal consequences</li>
            </ul>

            <h2>10. Termination</h2>
            <p>
              You may terminate your account at any time. We may terminate your account if you violate these Terms, 
              engage in fraudulent activity, or fail to pay subscription fees.
            </p>

            <h2>11. Changes to Terms</h2>
            <p>
              We may modify these Terms at any time. Significant changes will be communicated through email notification, 
              in-app notification, or website posting. Continued use constitutes acceptance of new Terms.
            </p>

            <h2>12. Contact Information</h2>
            <p>For questions about these Terms of Service, contact us:</p>
            <ul>
              <li><strong>Email</strong>: legal@bookd.tools</li>
              <li><strong>Website</strong>: bookd.tools</li>
            </ul>

            <div className="bg-blue-50 p-6 rounded-lg mt-8">
              <h3 className="text-lg font-semibold mb-2">Questions?</h3>
              <p className="text-sm text-gray-700">
                If you have any questions about these Terms of Service or need clarification 
                on any provision, please contact our support team at legal@bookd.tools.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}