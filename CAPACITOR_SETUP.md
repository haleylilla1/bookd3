# Capacitor iOS Setup for Bookd

## Overview
Capacitor will create a native iOS wrapper around your existing web app, allowing it to run natively on iOS devices while maintaining all current functionality.

## What's Been Set Up

### 1. Capacitor Dependencies Installed
- `@capacitor/core` - Core Capacitor functionality
- `@capacitor/cli` - Command line tools
- `@capacitor/ios` - iOS platform support
- `@capacitor/app` - App lifecycle management
- `@capacitor/haptics` - Native haptic feedback
- `@capacitor/keyboard` - Keyboard handling
- `@capacitor/status-bar` - Status bar control

### 2. Configuration Created
- **App ID**: `com.bookd.app` (you can change this)
- **App Name**: `Bookd`
- **Build Directory**: `dist` (matches your Vite build)
- **iOS Optimizations**: Auto content inset, white background

## Next Steps (After Apple Developer Approval)

### 1. Initialize Capacitor
```bash
npx cap init
```

### 2. Build Web App
```bash
npm run build
```

### 3. Add iOS Platform
```bash
npx cap add ios
```

### 4. Sync Web Assets
```bash
npx cap sync ios
```

### 5. Open in Xcode
```bash
npx cap open ios
```

## Development Workflow

### For Web Development (Current)
- Continue using `npm run dev` as usual
- Your web app remains completely unchanged
- Social media sharing works exactly as before

### For iOS Testing (After Setup)
- Build web app: `npm run build`
- Sync to iOS: `npx cap sync ios`
- Test in Xcode simulator or device

## App Store Preparation

### Required Assets (Create These)
- **App Icon**: 1024x1024px PNG (required for App Store)
- **Launch Screen**: iOS launch screen assets
- **Screenshots**: iPhone and iPad screenshots for App Store listing

### Bundle Configuration
- **Bundle ID**: `com.bookd.app` (or your preferred unique identifier)
- **Version**: Will sync with your package.json version
- **Build Number**: Auto-incremented by Xcode

## Key Benefits

### No Web App Disruption
- Your current web app continues working exactly as is
- No changes to your development workflow
- Social media campaigns can proceed normally

### Native iOS Features
- Push notifications (when you add them)
- Native keyboard handling
- Haptic feedback for better UX
- Native status bar control
- App Store distribution

### Single Codebase
- One React/TypeScript codebase for both web and iOS
- Shared business logic and UI components
- Easy maintenance and updates

## File Structure After Setup
```
your-project/
├── ios/                    # iOS project (auto-generated)
│   ├── App/
│   ├── Bookd.xcodeproj/
│   └── ...
├── dist/                   # Web build output
├── src/                    # Your React app (unchanged)
├── capacitor.config.ts     # Capacitor configuration
└── package.json           # Updated with Capacitor scripts
```

## Timeline Estimate
- **Capacitor Setup**: 1-2 hours
- **iOS Asset Creation**: 2-4 hours  
- **Xcode Configuration**: 1-2 hours
- **Testing & Debugging**: 4-6 hours
- **App Store Submission**: 1-2 hours

**Total**: 2-3 days of focused work

## Notes
- Capacitor is production-ready and used by major apps
- Your web app performance will be maintained
- iOS app will feel native to users
- Easy to add native plugins later (camera, notifications, etc.)

Ready to proceed once your Apple Developer Account is approved!