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

### 🤖 AI-Powered Bulk Import
- Parse messy gig notes with OpenAI GPT-4o
- Automatic data extraction from unstructured text
- Review and edit parsed information before importing
- Confidence scoring for data accuracy
- Batch processing for historical gig data

### 📄 Professional Invoice Generation
- Customizable invoice templates
- PDF export with professional formatting
- Client and business information management
- Tax calculation and itemized billing
- Invoice history and tracking

## Technical Implementation

### Architecture
- **Frontend:** React with TypeScript (optimized with memoization and query caching)
- **Backend:** Express.js with Node.js (35+ RESTful endpoints)
- **Database:** PostgreSQL with Drizzle ORM (15+ normalized tables)
- **UI Framework:** Tailwind CSS with Shadcn/ui components (60+ reusable elements)
- **Authentication:** Multi-provider (Replit Auth, Google OAuth, email/password)
- **Session Management:** Secure cookie-based sessions with PostgreSQL storage
- **External APIs:** Google Maps Distance Matrix API, OpenAI GPT-4o for AI parsing
- **Performance:** Query caching, memoized calculations, retry logic, memory leak prevention

### Security & Compliance
- Bcrypt password hashing with salt rounds
- Comprehensive audit logging for all user actions
- GDPR-compliant data export functionality
- Secure session management with PostgreSQL storage
- Database integrity with foreign key constraints
- CORS-compliant API design
- Server-side external API calls for security
- TypeScript type safety and input validation
- Error boundaries and comprehensive error handling

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

## Latest Updates (June 20, 2025)

### Major Performance & Reliability Overhaul (TODAY)
- **Production-Ready Optimization**: Complete code quality improvements across all components
- **TypeScript Type Safety**: Fixed all type issues with proper interface implementations
- **Memory Management**: Eliminated potential memory leaks with proper cleanup patterns
- **Error Handling**: Comprehensive HTTP status checks and user-friendly error messages
- **Performance Enhancement**: Memoized calculations, query caching, and optimized mutations
- **Dark Mode Support**: Complete UI consistency across all pages and components
- **Accessibility**: ARIA labels, screen reader support, and proper form validation
- **AI Import System**: Robust bulk gig parsing with OpenAI GPT-4o integration

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

### Technical Excellence
- **Enterprise-Grade Security**: Multi-provider authentication with audit logging
- **Performance Optimization**: Query caching, memoization, and retry logic
- **Database Reliability**: 15+ normalized tables with comprehensive data integrity
- **API Robustness**: 35+ endpoints with proper error handling and validation

Giggy transforms chaotic gig work into organized, profitable career management with industry-leading mileage tracking capabilities and enterprise-grade reliability.