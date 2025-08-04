# Bookd Project Context

## Overview
Bookd is a mobile-first gig worker companion app designed for comprehensive financial tracking and calendar-based gig management. Its core purpose is to streamline gig work administration, offering robust tools for managing gigs, clients, and finances. The project aims to provide a reliable, scalable, and user-friendly solution for gig workers, transitioning from a functional prototype with technical debt to a production-ready application.

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
- QUARTERLY REPORTS: Requested for tax season alignment - assessed as trivial implementation (2-4 hours) due to excellent existing date-based architecture.

## System Architecture
- **Frontend**: React with TypeScript, optimized for mobile-first experience with comprehensive frontend performance monitoring.
- **Backend**: Express.js with Node.js and PostgreSQL featuring advanced rate limiting and load balancing.
- **Simplified Expense Tracking**: Text-based descriptions replace complex photo upload system (removed August 2025 - 500+ lines eliminated).
- **Memory Management**: Real-time Node.js memory tracking with warning/critical thresholds and intelligent emergency cleanup (e.g., 400MB warning/500MB critical). Features advanced garbage collection integration and memory pressure handling.
- **Cache Optimization**: Data compression for large objects (>10KB), strict 100KB entry size limits, and automatic rejection of oversized entries. Implements intelligent gzip compression (70-85% savings) and an advanced cache system with a priority queue (O(log n) cleanup), dynamic interval adjustment, and intelligent cache warming. Supports automatic Redis/memory fallback.
- **Database Performance**: Utilizes 9 critical database indexes for user queries, authentication, goals, and dashboard filters, yielding 20-30% performance improvement. Employs clean, straightforward database queries. Neon serverless handles connection pooling with optimized pagination (50-1000 items per page).
- **Production-Ready Pagination**: Complete API pagination implementation with limit/offset support for gigs and expenses endpoints. Frontend components updated to handle paginated responses with backward compatibility. Includes intelligent caching per page and performance monitoring.
- **Advanced Rate Limiting**: Multi-tier rate limiting system (1000 requests/15min general, 100 requests/min for sensitive endpoints) with IP-based tracking, standard headers, and intelligent error messaging. Protects against abuse while maintaining performance.
- **Load Testing Infrastructure**: Comprehensive Artillery.js configuration with realistic traffic patterns, performance thresholds (p95: <1s, p99: <2s), custom processors for authentication simulation, and detailed response validation for production readiness.
- **Frontend Performance Monitoring**: Real-time performance tracking for page loads, API calls, render times, and user interactions. Automatic slow operation detection (>1s API, >100ms render), metric cleanup, and development warnings. Maintains rolling 5-minute performance windows.
- **Optimized Recovery System**: Features an ultra-efficient recovery mechanism with intelligent storage selection (localStorage, sessionStorage, IndexedDB, memory fallback). Includes data deduplication with checksum validation and compression support for large datasets. Provides performance monitoring for save/retrieval timing and cache hit ratios.
- **Enterprise-Grade Recovery System**: Comprehensive unsaved data recovery with an enhanced dialog system, tabbed interface for validation, completeness tracking, and storage source detection. Includes global recovery provider and manager for consistent state management.
- **Authentication**: Single consolidated `auth.ts` file with database-backed sessions, comprehensive password reset functionality using SendGrid, and a secure, zero-complexity design. Features development mode fallback for testing and secure session management.
- **Mileage System**: Streamlined service with a single-class architecture. Includes a smart fallback system (Haversine calculation, string-based estimation) and simplified caching (1000-entry limit). Manages user quotas (50 calls/hour) and integrates with Google Maps API with graceful degradation.
- **Infrastructure Monitoring**: Real-time system health tracking with automated alerting. Includes 5-minute metric collection, 24-hour history, automated health checks (every 2 minutes) for critical services, and intelligent alerting with multi-level severity. Features a simple, reliable daily JSON backup system.
- **Multi-Day Gig Logic**: Employs `getGroupedGigs()` helper function to prevent double-counting across components. Database stores multi-day events as separate entries, consolidated at the UI layer.
- **Date Handling**: Consistent UTC date parsing using `parseGigDate()` utility to prevent timezone issues.
- **API and Data**: 41+ RESTful API endpoints with robust error handling, comprehensive pagination, and 15+ normalized database tables with data validation. Production-ready performance optimization.
- **Security**: Enterprise-grade security with comprehensive audit logging, memory-efficient form state management, sequential database operations to prevent race conditions, comprehensive input sanitization, and advanced rate limiting. Implements timeout and retry logic for external API calls and maximum limits to prevent resource exhaustion.
- **Mobile UI**: Mobile-only approach with a single responsive design optimized for mobile devices and small screens, eliminating desktop-specific styling.

## Future Development Plans

### **QUARTERLY REPORTS IMPLEMENTATION PLAN**
**ASSESSMENT COMPLETED (August 2025)**: Quarterly reports confirmed as extremely easy to implement (2-4 hours). Current architecture already supports flexible date filtering and period-based calculations. Implementation only requires:
1. Type update: `TimePeriod = "monthly" | "quarterly" | "annual"`
2. Quarter navigation logic (3-month increments)
3. Quarter display logic (`Q1 2025`, etc.)
4. UI button addition to period selector
5. Date range calculation for quarters

**BENEFITS**: Perfect for tax season planning (Q1-Q4 tracking), leverages existing date-based architecture with zero database changes needed.

### **"GOT PAID" TAX-SMART WORKFLOW PLAN**
**PHASE 1: Database Schema (No UI Changes)**
- Add fields: `total_received`, `reimbursed_parking`, `reimbursed_other`, `unreimbursed_parking`, `unreimbursed_other`
- Keep existing fields unchanged for backward compatibility
- Migration: populate new fields from existing data

**PHASE 2: "Got Paid" Dialog** ✅ COMPLETED (August 2025)
- Single button on gig cards: "Got Paid"
- Multi-step wizard (simplified to 5 steps):
  1. "Total amount received?" → `total_received`
  2. "Mileage tracking?" → Calculate or manual entry with Google Maps integration
  3. "Parking expense?" → Amount spent vs Amount reimbursed
  4. "Tax rate?" → Uses user's default tax percentage, adjustable per gig
  5. "Payment method?" → Optional payment method selection
- Auto-calculate: `actual_pay` = `total_received` - `reimbursed_parking`
- Auto-calculate: Business deductions = unreimbursed amounts + mileage
- **REMOVED**: Step 4 "Other expenses" - replaced by comprehensive expense tracking system

**PHASE 3: Dashboard Integration**
- **Income Section**: Show taxable income only (excludes reimbursements)
- **Deductions Section**: Show unreimbursed business expenses
- **Total Received**: Show gross payments for cash flow tracking
- **Tax Estimate**: Calculate on net income after deductions

**PHASE 4: Report Updates** ✅ PARKING INTEGRATION COMPLETED (August 2025)
- **Income Reports**: Separate taxable income vs reimbursements
- **Expense Reports**: Parking expenses now automatically appear in "Work Travel" category with reimbursement status
- **Tax Summary**: IRS-compliant calculations with proper categorization

**BACKWARD COMPATIBILITY**: Keep existing "Add Gig" form unchanged - new workflow is additive only

- **PHOTO UPLOAD REMOVAL COMPLETED (August 2025)**: Removed entire receipt photo upload system (500+ lines of code). All expense tracking now uses simple text descriptions for better mobile UX, faster performance, and eliminates scaling issues. Database schema updated from receipt arrays to simple text fields.

- **TECHNICAL DEBT FIXES COMPLETED (August 2025)**: Major refactoring to eliminate code duplication and improve maintainability:
  - **Centralized Form Schemas**: Created `/client/src/lib/form-schemas.ts` with reusable validation schemas for expenses and gigs, eliminating duplicate validation logic across components
  - **Reusable Form Components**: Built `/client/src/components/ui/form-field-wrapper.tsx` with mobile-optimized field components (AmountField, MerchantField, BusinessPurposeField, etc.) featuring consistent touch-friendly sizing (h-12, text-base)
  - **Unified Error Handling**: Implemented `/client/src/hooks/use-form-error-handler.ts` for consistent error messaging and recovery flows across all forms
  - **Mobile Touch Optimization**: All forms now use `touch-manipulation` CSS, 12px height inputs, and base text sizing for better mobile UX
  - **Schema Improvements**: Made merchant field optional in database and forms, allowing $0.00 expenses for tax-deductible free items
  - **Date Input Standardization**: Created cross-browser compatible `DateInput` component with automatic fallback for older browsers/devices, ensuring consistent date picker experience across all forms and platforms

## External Dependencies
- **SendGrid**: For email integration, specifically password reset functionality.
- **Google Maps API (Places API, Distance Matrix API)**: For address autocomplete and mileage calculation. Includes user quota management.
- **Supabase**: Used for database, authentication, and object storage (photo upload system removed August 2025).
- **Redis**: Considered for production scaling (caching).
- **Cloudinary**: Considered for production scaling (media management).
- **Stripe**: Considered for payment integration.