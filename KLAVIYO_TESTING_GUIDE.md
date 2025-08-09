# How to Test Your Klaviyo Welcome Email Flow

## 🔍 Ways to Check if Your Welcome Email is Working

### 1. Check in Your Klaviyo Dashboard
1. Go to your [Klaviyo Dashboard](https://klaviyo.com)
2. Navigate to **Flows** in the left sidebar
3. Click on your "Welcome Email" flow
4. Look at the **Flow Performance** section to see:
   - How many people entered the flow
   - How many emails were sent
   - Open rates, click rates, etc.

### 2. Check the Flow Activity
1. In your flow, click on the **Activity** tab
2. You should see recent activity showing:
   - `test-klaviyo@example.com` entered the flow
   - Email was sent (or queued)
   - Any delivery status

### 3. Test with Your Own Email
The test email `test-klaviyo@example.com` won't receive actual emails since it's not a real inbox. Let's test with your real email:

```bash
# Replace YOUR_EMAIL with your actual email address
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "YOUR_EMAIL@gmail.com",
    "password": "testpass123", 
    "name": "Your Name"
  }'
```

### 4. Check Klaviyo Profiles
1. Go to **Audience > Profiles** in Klaviyo
2. Search for `test-klaviyo@example.com` 
3. Click on the profile to see:
   - Profile properties (signupDate, userType, etc.)
   - Event history (should show "User Signed Up")
   - Flow activity (should show welcome flow triggered)

### 5. Common Issues & Solutions

**If no email was sent:**
- Check that your flow is **LIVE** (not draft)
- Verify the trigger event name matches exactly: "User Signup" 
- Make sure there are no additional filters on your flow

**If email went to spam:**
- Check spam/promotions folder
- Add your sending domain to safe senders
- Klaviyo emails sometimes take 5-10 minutes to deliver

**If flow didn't trigger:**
- Check that the metric name is exactly "User Signup" (case sensitive)
- Verify your flow trigger settings
- Look for any audience filters that might exclude test emails

### 6. Debug Your Flow

**Check Flow Trigger:**
- Metric: "User Signup" 
- No additional filters (for testing)
- Flow should be **LIVE** status

**Check Email Settings:**
- From name and email configured
- Subject line not empty
- Email template has content
- No suppression rules blocking test emails

### 7. Quick Test Script

Want to test with your own email? Update this and run it:

```bash
# Test signup with your real email
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "youremail@gmail.com",
    "password": "testpass123",
    "name": "Test User"
  }'
```

Then check your inbox (including spam) within 10 minutes.

## 📊 What Success Looks Like

**In Klaviyo Dashboard:**
- Flow shows 1+ people entered
- Email shows as "Sent" or "Delivered" 
- Profile exists with all properties

**In Your Inbox:**
- Welcome email received within 10 minutes
- Personalization works (Hi Test User)
- Links and formatting look good

**In Server Logs:**
- ✅ Klaviyo profile created
- ✅ Event tracked: User Signed Up
- No error messages

## 🔧 Troubleshooting

If you're not seeing the email:

1. **Check Flow Status**: Make sure it's LIVE, not draft
2. **Verify Trigger**: Event name must be exactly "User Signup"
3. **Check Filters**: Remove any audience filters for testing  
4. **Test Real Email**: Use your actual email address
5. **Wait 10 Minutes**: Klaviyo can have delivery delays
6. **Check Spam Folder**: First emails often go to spam

Your integration is working perfectly - the events are being sent to Klaviyo successfully!