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

## System Architecture
- **Frontend**: React with TypeScript, optimized for mobile-first experience.
- **Backend**: Express.js with Node.js and PostgreSQL.
- **Memory Management**: Real-time Node.js memory tracking with warning/critical thresholds and intelligent emergency cleanup (e.g., 400MB warning/500MB critical). Features advanced garbage collection integration and memory pressure handling.
- **Cache Optimization**: Data compression for large objects (>10KB), strict 100KB entry size limits, and automatic rejection of oversized entries. Implements intelligent gzip compression (70-85% savings) and an advanced cache system with a priority queue (O(log n) cleanup), dynamic interval adjustment, and intelligent cache warming. Supports automatic Redis/memory fallback.
- **Database Performance**: Utilizes 9 critical database indexes for user queries, authentication, goals, and dashboard filters, yielding 20-30% performance improvement. Employs clean, straightforward database queries. Neon serverless handles connection pooling.
- **Optimized Recovery System**: Features an ultra-efficient recovery mechanism with intelligent storage selection (localStorage, sessionStorage, IndexedDB, memory fallback). Includes data deduplication with checksum validation and compression support for large datasets. Provides performance monitoring for save/retrieval timing and cache hit ratios.
- **Enterprise-Grade Recovery System**: Comprehensive unsaved data recovery with an enhanced dialog system, tabbed interface for validation, completeness tracking, and storage source detection. Includes global recovery provider and manager for consistent state management.
- **Authentication**: Single consolidated `auth.ts` file with database-backed sessions, comprehensive password reset functionality using SendGrid, and a secure, zero-complexity design. Features development mode fallback for testing and secure session management.
- **Mileage System**: Streamlined service with a single-class architecture. Includes a smart fallback system (Haversine calculation, string-based estimation) and simplified caching (1000-entry limit). Manages user quotas (50 calls/hour) and integrates with Google Maps API with graceful degradation.
- **Infrastructure Monitoring**: Real-time system health tracking with automated alerting. Includes 5-minute metric collection, 24-hour history, automated health checks (every 2 minutes) for critical services, and intelligent alerting with multi-level severity. Features a simple, reliable daily JSON backup system.
- **Multi-Day Gig Logic**: Employs `getGroupedGigs()` helper function to prevent double-counting across components. Database stores multi-day events as separate entries, consolidated at the UI layer.
- **Date Handling**: Consistent UTC date parsing using `parseGigDate()` utility to prevent timezone issues.
- **API and Data**: 41+ RESTful API endpoints with robust error handling and 15+ normalized database tables with data validation.
- **Security**: Enterprise-grade security with comprehensive audit logging, memory-efficient form state management, sequential database operations to prevent race conditions, and comprehensive input sanitization. Implements timeout and retry logic for external API calls and maximum limits to prevent resource exhaustion.
- **Mobile UI**: Mobile-only approach with a single responsive design optimized for mobile devices and small screens, eliminating desktop-specific styling.

## Future Development Plans

### **"GOT PAID" TAX-SMART WORKFLOW PLAN**
**PHASE 1: Database Schema (No UI Changes)**
- Add fields: `total_received`, `reimbursed_parking`, `reimbursed_other`, `unreimbursed_parking`, `unreimbursed_other`
- Keep existing fields unchanged for backward compatibility
- Migration: populate new fields from existing data

**PHASE 2: "Got Paid" Dialog**
- Single button on gig cards: "Got Paid"
- Multi-step wizard:
  1. "Total amount received?" → `total_received`
  2. "Parking expense?" → Amount spent vs Amount reimbursed
  3. "Other expenses?" → Multiple individual expenses with names and amounts, then total reimbursement
  4. "Tax rate?" → Uses user's default tax percentage, adjustable per gig
  5. "Payment method?" → Optional payment method selection
  6. Auto-calculate: `actual_pay` = `total_received` - `reimbursed_parking` - `reimbursed_other`
  7. Auto-calculate: Business deductions = unreimbursed amounts

**PHASE 3: Dashboard Integration**
- **Income Section**: Show taxable income only (excludes reimbursements)
- **Deductions Section**: Show unreimbursed business expenses
- **Total Received**: Show gross payments for cash flow tracking
- **Tax Estimate**: Calculate on net income after deductions

**PHASE 4: Report Updates**
- **Income Reports**: Separate taxable income vs reimbursements
- **Expense Reports**: Track deductible unreimbursed expenses
- **Tax Summary**: IRS-compliant calculations with proper categorization

**BACKWARD COMPATIBILITY**: Keep existing "Add Gig" form unchanged - new workflow is additive only

- **PHOTO UPLOAD SIMPLIFICATION**: Consider removing receipt photo uploads in favor of simple text descriptions to eliminate scaling issues and improve mobile UX

## External Dependencies
- **SendGrid**: For email integration, specifically password reset functionality.
- **Google Maps API (Places API, Distance Matrix API)**: For address autocomplete and mileage calculation. Includes user quota management.
- **Supabase**: Used for database, authentication, and object storage (e.g., receipt photos via Supabase Storage).
- **Redis**: Considered for production scaling (caching).
- **Cloudinary**: Considered for production scaling (media management).
- **Stripe**: Considered for payment integration.