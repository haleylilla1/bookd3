# Bookd Project Context

## Overview
Bookd is a mobile-first gig worker companion app designed for comprehensive financial tracking and calendar-based gig management. Its core purpose is to streamline gig work administration, offering robust tools for managing gigs, clients, and finances. The project aims to provide a reliable, scalable, and user-friendly solution for gig workers, transitioning from a functional prototype to a production-ready application. Key capabilities include gig and client management, financial tracking, and tax-smart workflows. The business vision is to empower gig workers with efficient financial administration, addressing a critical market need for reliable and scalable solutions.

## User Preferences
- Focus on mobile-first experience optimization
- Prioritize authentication reliability for user onboarding
- Maintain simple, clean interface design
- CRITICAL: Prevent authentication changes from affecting existing users' data access
- Require comprehensive testing before any authentication modifications
- PREFER SIMPLE SOLUTIONS: Choose simple, reliable implementations over complex feature-rich ones
- NEVER BUILD OVER-ENGINEERED GARBAGE: Always choose the simplest solution that works. Avoid complex abstractions, fake metrics, and unnecessary layers
- DETAILED PLANNING: User requests extremely detailed hour-by-hour breakdowns for development tasks
- PRODUCTION FOCUS: Prioritize production readiness with comprehensive testing and monitoring
- SCALING PRIORITY: User confirmed app works well currently and needs it ready for 1000 people
- THIRD-PARTY SERVICES: Open to using external services like Supabase, Redis, Cloudinary for production scaling
- PAYMENT INTEGRATION: Considering Stripe payments with either Replit Auth (MVP) or Supabase (scale phase)
- RECEIPT UPLOAD SIMPLIFICATION: Only camera and upload buttons needed - remove file chooser option for cleaner mobile experience
- TAX PHILOSOPHY: Gig workers should pay appropriate taxes on their income during the year, then get money back through deductions at tax time. Tax estimates calculated on full taxable income, business deductions tracked separately for filing.

## System Architecture
- **Frontend**: React with TypeScript, optimized for mobile-first experience.
- **Backend**: Express.js with Node.js and PostgreSQL.
- **UI/UX Decisions**: Mobile-only approach with a single responsive design optimized for mobile devices and small screens. Simplified expense tracking uses text-based descriptions instead of photo uploads. Comprehensive iOS Safari zoom prevention implemented with global 16px font size enforcement on inputs, enhanced HTML meta tags, and MutationObserver monitoring. Mobile touch optimization includes `touch-manipulation` CSS, 12px height inputs, and base text sizing.
- **Technical Implementations**:
    - **Memory Management**: Real-time Node.js memory tracking with warning/critical thresholds and intelligent emergency cleanup.
    - **Cache Optimization**: Data compression for large objects, strict 100KB entry size limits, automatic rejection of oversized entries, intelligent gzip compression, and an advanced cache system with priority queue, dynamic interval adjustment, and intelligent cache warming. Supports automatic Redis/memory fallback.
    - **Database Performance**: Utilizes 9 critical database indexes for user queries, authentication, goals, and dashboard filters. Neon serverless handles connection pooling with optimized pagination (50-1000 items per page).
    - **Pagination**: Complete API pagination implementation with limit/offset support for gigs and expenses endpoints. Frontend components handle paginated responses with backward compatibility.
    - **Rate Limiting**: Multi-tier rate limiting system (1000 requests/15min general, 100 requests/min for sensitive endpoints) with IP-based tracking.
    - **Load Testing**: Artillery.js configuration with realistic traffic patterns and performance thresholds.
    - **Frontend Performance Monitoring**: Real-time performance tracking for page loads, API calls, render times, and user interactions.
    - **Recovery System**: Ultra-efficient recovery mechanism with intelligent storage selection (localStorage, sessionStorage, IndexedDB, memory fallback). Includes data deduplication with checksum validation and compression support.
    - **Authentication**: Single consolidated `auth.ts` file with database-backed sessions, comprehensive password reset functionality, and secure session management.
    - **Mileage System**: Streamlined service with single-class architecture, smart fallback system (Haversine calculation, string-based estimation), and simplified caching. Integrates with Google Maps API.
    - **Infrastructure Monitoring**: Real-time system health tracking with automated alerting, 5-minute metric collection, and 24-hour history.
    - **Multi-Day Gig Logic**: Employs `getGroupedGigs()` helper function to prevent double-counting across components.
    - **Date Handling**: Consistent UTC date parsing using `parseGigDate()` utility.
    - **API and Data**: 41+ RESTful API endpoints with robust error handling, comprehensive pagination, and 15+ normalized database tables with data validation.
    - **Security**: Enterprise-grade security with comprehensive audit logging, memory-efficient form state management, sequential database operations to prevent race conditions, comprehensive input sanitization, and advanced rate limiting. Implements timeout and retry logic for external API calls and maximum limits.
    - **"Got Paid" Workflow**: New additive workflow for tracking income and expenses with fields for `total_received`, `reimbursed_parking`, `reimbursed_other`, `unreimbursed_parking`, `unreimbursed_other`. Automatically calculates actual pay and business deductions. Integrates with dashboard and report updates.
    - **Quarterly Reports**: Planned implementation to include `TimePeriod` type update, quarter navigation/display logic, and UI button addition, leveraging existing date-based architecture for tax season planning.
    - **Technical Debt Fixes**: Centralized form schemas, reusable form components, unified error handling, and standardized date input components.
    - **Error Monitoring**: Comprehensive Sentry integration for both frontend and backend error tracking, performance monitoring, user context tracking, and API error categorization. Includes smart error filtering, authentication event tracking, source maps upload automation, release tracking, and production-ready configuration. Successfully tested and verified working.
    - **Uptime Monitoring**: Health check endpoints implemented for UptimeRobot monitoring including basic server health (`/health`), database connectivity (`/api/health/database`), authentication system (`/api/health/auth`), and core functionality (`/api/health/core`) checks. Free plan configured for development, Solo plan recommended for production deployment.

## External Dependencies
- **SendGrid**: Email integration for password reset.
- **Google Maps API (Places API, Distance Matrix API)**: Address autocomplete and mileage calculation.
- **Supabase**: Database, authentication.
- **Sentry**: Error monitoring and performance tracking for production reliability.
- **Redis**: Considered for caching.
- **Cloudinary**: Considered for media management.
- **Stripe**: Considered for payment integration.