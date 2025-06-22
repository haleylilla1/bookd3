import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as LocalStrategy } from "passport-local";
import { storage } from "./storage";

// Google OAuth Strategy
export function setupGoogleAuth() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.log('Google OAuth credentials not provided, skipping Google auth setup');
    return;
  }
  
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.REPLIT_DOMAINS 
      ? `https://${process.env.REPLIT_DOMAINS}/api/auth/google/callback`
      : "http://localhost:5000/api/auth/google/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const googleId = profile.id;
      const email = profile.emails?.[0]?.value;
      const firstName = profile.name?.givenName;
      const lastName = profile.name?.familyName;
      const profileImageUrl = profile.photos?.[0]?.value;
      
      // Check if user exists by Google ID
      let user = await storage.getUserByGoogleId(googleId);
      
      if (!user && email) {
        // Check if user exists by email (linking accounts)
        user = await storage.getUserByEmail(email);
        if (user) {
          // Link Google account to existing user
          user = await storage.updateUser(user.id, { googleId });
        }
      }
      
      if (!user) {
        // Create new user
        user = await storage.upsertUserByGoogleId(googleId, {
          email: email || '',
          firstName,
          lastName,
          profileImageUrl,
          name: `${firstName || ''} ${lastName || ''}`.trim() || 'New User',
          emailVerified: true, // Google emails are pre-verified
        });
      }
      
      // Log the authentication
      await storage.logAudit(user.id, 'LOGIN', 'users', user.id, null, null);
      
      return done(null, user);
    } catch (error) {
      console.error('Google auth error:', error);
      return done(error, false);
    }
  }));
}

// Local Strategy for email/password
export function setupLocalAuth() {
  passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password'
  },
  async (email, password, done) => {
    try {
      const user = await storage.validatePassword(email, password);
      
      if (!user) {
        return done(null, false, { message: 'Invalid email or password' });
      }
      
      if (!user.isActive) {
        return done(null, false, { message: 'Account is disabled' });
      }
      
      if (user.isDeleted) {
        return done(null, false, { message: 'Account not found' });
      }
      
      // Log the authentication
      await storage.logAudit(user.id, 'LOGIN', 'users', user.id, null, null);
      
      return done(null, user);
    } catch (error) {
      console.error('Local auth error:', error);
      return done(error, false);
    }
  }));
}

// Passport serialization
export function setupPassportSerialization() {
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user || false);
    } catch (error) {
      done(error, false);
    }
  });
}