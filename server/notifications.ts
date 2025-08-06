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