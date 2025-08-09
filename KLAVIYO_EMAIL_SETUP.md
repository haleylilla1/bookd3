# Klaviyo Email Template Setup Guide

## Overview
Your app is now configured to send events to Klaviyo that trigger automated email templates. Here's how to set up the email templates in your Klaviyo dashboard.

## 🚀 Quick Setup Steps

### 1. Access Your Klaviyo Dashboard
- Go to [klaviyo.com](https://klaviyo.com) and log into your account
- Navigate to **Flows** in the left sidebar

### 2. Create Welcome Email Flow
**Trigger Event:** `User Signup`

**Template Properties Available:**
- `{{ event.source }}` - "bookd_app"
- `{{ event.signupMethod }}` - "email"
- `{{ person.firstName }}` - User's name
- `{{ person.userType }}` - "gig_worker"
- `{{ person.signupDate }}` - ISO date string

**Sample Welcome Email:**
```
Subject: Welcome to Bookd! Your gig finances just got easier 💰

Hi {{ person.firstName|default:"there" }},

Welcome to Bookd! You're now part of a community of smart gig workers who take control of their finances.

Here's what you can do right away:
✅ Track your first gig
✅ Log expenses for tax deductions  
✅ Set monthly earning goals
✅ Generate reports for tax time

Questions? Just reply to this email.

Happy gigging!
The Bookd Team
```

### 3. Create Gig Reminder Flow
**Trigger Event:** `Gig Reminder Due`

**Template Properties:**
- `{{ event.gigTitle }}` - Gig name
- `{{ event.gigDate }}` - Gig date
- `{{ event.gigClient }}` - Client name
- `{{ event.gigLocation }}` - Location
- `{{ event.gigTime }}` - Time

**Sample Reminder Email:**
```
Subject: Tomorrow's Gig: {{ event.gigTitle }}

Hi {{ person.firstName }},

Just a friendly reminder about your gig tomorrow:

🎯 **{{ event.gigTitle }}**
📅 {{ event.gigDate }}
⏰ {{ event.gigTime }}
📍 {{ event.gigLocation }}
👥 Client: {{ event.gigClient }}

Break a leg! Remember to track any expenses.
```

### 4. Create Payment Reminder Flow
**Trigger Event:** `Payment Reminder Due`

**Template Properties:**
- `{{ event.gigTitle }}` - Gig name
- `{{ event.gigDate }}` - When gig happened
- `{{ event.gigClient }}` - Client name
- `{{ event.expectedAmount }}` - Expected payment
- `{{ event.daysSinceGig }}` - Days since gig

**Sample Payment Reminder:**
```
Subject: Don't forget to track payment from {{ event.gigClient }}

Hi {{ person.firstName }},

It's been {{ event.daysSinceGig }} days since your gig "{{ event.gigTitle }}" with {{ event.gigClient }}.

Have you received payment yet? Don't forget to:
✅ Mark the gig as "Paid" in Bookd
✅ Record the actual amount received
✅ Log any reimbursed expenses

This keeps your financial tracking accurate for tax time!
```

### 5. Create Emergency Opportunity Flow
**Trigger Event:** `Emergency Opportunity Available`

**Template Properties:**
- `{{ event.opportunityTitle }}` - Opportunity name
- `{{ event.city }}` - City
- `{{ event.urgency }}` - Urgency level
- `{{ event.payRate }}` - Pay rate
- `{{ event.startDate }}` - Start date
- `{{ event.agency }}` - Agency name
- `{{ event.applicationDeadline }}` - Deadline

### 6. Create Weekly Summary Flow
**Trigger Event:** `Weekly Earnings Summary`

**Template Properties:**
- `{{ event.weeklyEarnings }}` - Total earnings
- `{{ event.gigCount }}` - Number of gigs
- `{{ event.topClient }}` - Most frequent client
- `{{ event.averagePerGig }}` - Average per gig
- `{{ event.weekStartDate }}` - Week start
- `{{ event.weekEndDate }}` - Week end

## 📧 Email Template Best Practices

### Mobile Optimization
- Keep subject lines under 50 characters
- Use single-column layouts
- Large, tappable buttons
- Clear, scannable content

### Personalization
- Always use `{{ person.firstName|default:"there" }}`
- Reference specific gig details when available
- Include relevant financial data

### Call-to-Action
- Direct users back to the app: "Open Bookd App"
- Use tracking links: `https://app.bookd.tools/?utm_source=klaviyo&utm_campaign=gig_reminder`

## 🎯 Segmentation Ideas

### User Segments to Create:
1. **New Users** (signupDate within 7 days)
2. **Active Giggers** (totalGigs > 5)
3. **High Earners** (totalEarnings > $5000)
4. **Brand Ambassadors** (preferredGigTypes contains "Brand Ambassador")
5. **Onboarding Incomplete** (onboardingCompleted = false)

### Targeted Campaigns:
- **New User Series:** Welcome, how-to guides, first gig celebration
- **Re-engagement:** For users who haven't logged gigs in 2+ weeks  
- **Tax Season:** Quarterly reports, deduction tips
- **Feature Announcements:** New features, mobile app launch

## 🔧 Technical Notes

### Event Frequency:
- **User Signup:** Once per user
- **Gig Reminder:** Daily (for next-day gigs)
- **Payment Reminder:** Weekly (for unpaid gigs 3+ days old)
- **Emergency Opportunities:** As needed
- **Weekly Summary:** Every Monday

### Klaviyo Integration Status:
✅ Events are being sent from your app
✅ User profiles are being created/updated
✅ Custom properties are being tracked
⏳ Email templates need to be created in Klaviyo dashboard

## 📞 Next Steps

1. **Create the flows above in your Klaviyo dashboard**
2. **Test with your own email address**
3. **Monitor delivery rates and engagement**
4. **A/B test subject lines and content**
5. **Set up SMS versions for higher engagement**

Your users will start receiving automated emails as soon as you create these flows in Klaviyo!