import sgMail from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  console.error("SENDGRID_API_KEY environment variable must be set");
} else {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

interface NewUserNotificationData {
  name: string;
  email: string;
  signupDate: string;
  onboardingData?: {
    homeAddress?: string;
    customGigTypes?: string[];
    preferredClients?: string[];
    businessInfo?: any;
  };
}

export async function sendNewUserNotification(userData: NewUserNotificationData): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    console.log("SendGrid not configured, skipping user notification");
    return false;
  }

  try {
    const emailContent = `
      <h2>New User Signup - Bookd App</h2>
      
      <h3>User Details:</h3>
      <ul>
        <li><strong>Name:</strong> ${userData.name}</li>
        <li><strong>Email:</strong> ${userData.email}</li>
        <li><strong>Signup Date:</strong> ${userData.signupDate}</li>
      </ul>

      ${userData.onboardingData ? `
      <h3>Onboarding Information:</h3>
      <ul>
        ${userData.onboardingData.homeAddress ? `<li><strong>Home Address:</strong> ${userData.onboardingData.homeAddress}</li>` : ''}
        ${userData.onboardingData.customGigTypes ? `<li><strong>Gig Types:</strong> ${userData.onboardingData.customGigTypes.join(', ')}</li>` : ''}
        ${userData.onboardingData.preferredClients ? `<li><strong>Preferred Clients:</strong> ${userData.onboardingData.preferredClients.join(', ')}</li>` : ''}
      </ul>
      ` : ''}

      <p><small>This notification was sent automatically from your Bookd application.</small></p>
    `;

    const msg = {
      to: 'haleylilla@gmail.com', // Your email address
      from: 'haleylilla@gmail.com', // Use your verified email as sender
      subject: `New User Signup: ${userData.name}`,
      html: emailContent,
    };

    await sgMail.send(msg);
    console.log('New user notification sent successfully');
    return true;
  } catch (error) {
    console.error('Failed to send new user notification:', error);
    return false;
  }
}

export async function sendUserUpdateNotification(
  userEmail: string, 
  updateType: string, 
  updateData: any
): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    return false;
  }

  try {
    const emailContent = `
      <h2>User Update - Bookd App</h2>
      
      <h3>Update Details:</h3>
      <ul>
        <li><strong>User:</strong> ${userEmail}</li>
        <li><strong>Update Type:</strong> ${updateType}</li>
        <li><strong>Date:</strong> ${new Date().toISOString()}</li>
      </ul>

      <h3>Update Data:</h3>
      <pre>${JSON.stringify(updateData, null, 2)}</pre>

      <p><small>This notification was sent automatically from your Bookd application.</small></p>
    `;

    const msg = {
      to: 'haleylilla@gmail.com',
      from: 'haleylilla@gmail.com', // Use your verified email as sender
      subject: `User Update: ${updateType} - ${userEmail}`,
      html: emailContent,
    };

    await sgMail.send(msg);
    return true;
  } catch (error) {
    console.error('Failed to send user update notification:', error);
    return false;
  }
}

interface SupportMessage {
  userName: string;
  userEmail: string;
  subject: string;
  category: string;
  urgency: string;
  message: string;
  userContext: {
    subscriptionTier?: string;
    signupDate?: string;
    lastLogin?: string;
  };
}

export async function sendSupportMessage(data: SupportMessage): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    console.log("SendGrid not configured, support message not sent");
    return false;
  }

  try {
    const urgencyEmoji = {
      low: '🟢',
      medium: '🟡', 
      high: '🔴'
    }[data.urgency] || '🟡';

    const categoryDisplay = {
      bug: 'Bug Report',
      feature: 'Feature Request', 
      account: 'Account Issue',
      billing: 'Billing Question',
      general: 'General Question'
    }[data.category] || data.category;

    const emailContent = `
      <h2>${urgencyEmoji} Support Request - Bookd App</h2>
      
      <h3>Request Details:</h3>
      <ul>
        <li><strong>From:</strong> ${data.userName} (${data.userEmail})</li>
        <li><strong>Category:</strong> ${categoryDisplay}</li>
        <li><strong>Urgency:</strong> ${data.urgency.toUpperCase()}</li>
        <li><strong>Subject:</strong> ${data.subject}</li>
        <li><strong>Date:</strong> ${new Date().toISOString()}</li>
      </ul>

      <h3>User Context:</h3>
      <ul>
        <li><strong>Subscription:</strong> ${data.userContext.subscriptionTier || 'Unknown'}</li>
        <li><strong>Signup Date:</strong> ${data.userContext.signupDate || 'Unknown'}</li>
        <li><strong>Last Login:</strong> ${data.userContext.lastLogin || 'Unknown'}</li>
      </ul>

      <h3>Message:</h3>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; white-space: pre-wrap;">${data.message}</div>

      <hr style="margin: 20px 0;">
      <p><strong>Reply directly to this email to respond to the user.</strong></p>
      <p><small>This support request was sent automatically from your Bookd application.</small></p>
    `;

    const msg = {
      to: 'haleylilla@gmail.com',
      from: 'haleylilla@gmail.com',
      replyTo: data.userEmail, // Allows you to reply directly to the user
      subject: `${urgencyEmoji} Support: ${data.subject} - ${data.userName}`,
      html: emailContent,
    };

    await sgMail.send(msg);
    console.log('Support message sent successfully');
    return true;
  } catch (error) {
    console.error('Failed to send support message:', error);
    return false;
  }
}