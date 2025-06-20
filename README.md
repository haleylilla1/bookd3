# Giggy - The #1 Gig Worker Companion App

**Tagline:** Work different.

## About Giggy

Giggy is purpose-built for live-service gig workers—brand ambassadors, freelance catering staff, bartenders, and event professionals. Unlike generic gig or budgeting apps, Giggy simplifies the unique challenges of event-based freelance work.

## Vision & Goal

To become the #1 companion app for live-service gig workers by simplifying gig tracking, payment monitoring, tax preparation, and income goal setting.

## Target Users

Freelance workers in live events including:
- Brand ambassadors
- Catering staff
- Bartenders
- Event coordinators
- Promotional staff
- Freelance servers

These professionals need to log spontaneous, varied income with minimal friction and no missed details.

## Core Value Proposition

Giggy lets gig workers:
- **Log gigs in seconds** with pre-filled data and smart defaults
- **Track pay, expenses, and mileage** with comprehensive financial monitoring
- **Prepare for taxes** with automatic tax percentage calculations and expense categorization
- **Auto-generate resume data** from logged gig duties and client relationships
- **Visualize earnings and progress** toward financial goals with real-time dashboards

## Key Features

### 👤 User Profile & Smart Defaults (NEW)
- **Default Home Address** - Automatically populates mileage tracking starting point
- **Custom Tax Percentage** - Personalized tax rate (0-50%) for all new gigs
- **Profile Settings Page** - Centralized user preference management
- **Auto-population Logic** - Smart form defaults while maintaining editability
- **Seamless Navigation** - Easy access via user menu with back navigation

### 📱 Calendar View
- Monthly calendar grid showing all scheduled gigs
- Color-coded gig status indicators
- Enhanced "Add Gig" button (improved from circle icon)
- Quick gig entry from any date
- Visual overview of work schedule

### 📝 Comprehensive Gig Entry
- Lightning-fast gig logging (under 1 minute)
- Auto-complete for recurring clients
- Expected vs. actual payment tracking
- Expense categorization (parking, clothing, travel)
- **Advanced Mileage Tracking** with Google Maps integration
  - Starting and ending address fields
  - Multiple stops support with waypoint management
  - Real-time distance and travel time calculation
  - Round-trip toggle for return journey calculation
  - Manual override option when needed
- Professional duty descriptions for resume building

### 📊 Smart Dashboard
- Weekly, monthly, and annual income summaries
- Top client leaderboards
- Total gigs completed tracking
- Tax withholding suggestions (default 23%)
- Goal progress visualization
- Real-time earnings analytics

### 📄 Professional Resume Builder
- Automatic compilation of gig experiences
- Professional template formatting
- Include/exclude toggle for each gig
- PDF export functionality
- Client and duty highlighting

### 🎯 Goal-Based Allocation System
- Visual earnings allocation to savings goals
- Rent, savings, and emergency fund tracking
- Progress bars for each financial objective
- Smart suggestions for unallocated funds

## Technical Implementation

### Architecture
- **Frontend:** React with TypeScript
- **Backend:** Express.js with Node.js
- **Database:** PostgreSQL with Drizzle ORM
- **UI Framework:** Tailwind CSS with Shadcn/ui components
- **Authentication:** Multi-provider (Google OAuth + email/password)
- **Session Management:** Secure cookie-based sessions
- **External APIs:** Google Maps Distance Matrix API for mileage calculation

### Security & Compliance
- Bcrypt password hashing
- Audit logging for all user actions
- GDPR-compliant data export
- Secure session management
- PostgreSQL data integrity
- CORS-compliant API design
- Server-side external API calls for security

## Business Model

### Subscription Tiers
- **Free Trial:** 30-day full access for new users
- **Premium:** $2.99/month for full feature access
- **Free Tier:** Limited functionality after trial expires

### Future Enhancements
- Bank account synchronization for payment confirmation
- Enhanced aesthetics and user experience
- Email communication system
- CPA-ready export formats
- Advanced analytics and reporting

## Development Philosophy

**Keep it SUPER SIMPLE**
- Each gig entry takes less than 1 minute
- Autofill fields wherever possible
- Intuitive navigation and minimal friction
- Mobile-first responsive design
- Clean, professional interface

## Getting Started

1. Sign up for a free 30-day trial
2. **Set up your profile with default home address and tax percentage**
3. Start logging gigs with the enhanced quick-entry form
4. **Use advanced mileage tracking for accurate tax deductions**
5. Track your progress toward financial goals
6. Export professional resumes and tax documents

## Latest Updates (June 2025)

### Enhanced Mileage Tracking System
- **Real-world accuracy**: Google Maps integration calculates actual driving distances
- **Multi-stop routes**: Add waypoints for complex delivery or event routes
- **Round-trip calculation**: Automatically double distance for return journeys
- **Tax-ready logs**: Professional mileage records for tax deduction purposes

### Profile-Based Automation
- **Smart defaults**: Set home address once, auto-populate all future gigs
- **Custom tax rates**: Personalize tax percentage (0-50%) based on your situation
- **Editable flexibility**: Override defaults when starting from different locations
- **Time-saving workflow**: Maintains sub-1-minute gig entry with enhanced features

Giggy transforms chaotic gig work into organized, profitable career management with industry-leading mileage tracking capabilities.