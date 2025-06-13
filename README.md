# Gig Management Platform

A comprehensive financial and career management platform designed specifically for gig workers.

## Features

- **Gig Tracking**: Calendar-driven logging system for all your gigs
- **Goal Management**: Set and track monthly, weekly, and yearly earnings goals
- **Analytics Dashboard**: Real-time earnings and performance insights
- **Tax Estimation**: Built-in tax calculation and expense tracking
- **Resume Builder**: Professional development tools
- **Mobile Responsive**: Works seamlessly on all devices

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **Backend**: Express.js, Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **UI Components**: Shadcn/ui

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up your database:
   ```bash
   npm run db:push
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Secret key for session management

## Project Structure

```
├── client/          # React frontend
├── server/          # Express backend
├── shared/          # Shared types and schemas
└── package.json     # Dependencies and scripts
```

## Deployment

This application is designed to be deployed on Replit with automatic database provisioning.