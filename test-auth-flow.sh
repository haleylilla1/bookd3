#!/bin/bash

# Authentication Flow Testing Script
# Run this before ANY authentication changes

echo "🔧 Testing Authentication Flow..."
echo "=================================="

# Test 1: Login
echo "1. Testing login..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"haleylilla@gmail.com","password":"your_password"}' \
  -c cookies.txt)

echo "Login response: $LOGIN_RESPONSE"

# Test 2: User data access
echo "2. Testing user data access..."
USER_RESPONSE=$(curl -s -X GET http://localhost:5000/api/user \
  -b cookies.txt)

echo "User response: $USER_RESPONSE"

# Test 3: Gig data access
echo "3. Testing gig data access..."
GIGS_RESPONSE=$(curl -s -X GET http://localhost:5000/api/gigs \
  -b cookies.txt)

echo "Gigs response: $GIGS_RESPONSE"

# Test 4: Check for errors
echo "4. Checking for authentication errors..."
if [[ $USER_RESPONSE == *"Invalid session"* ]]; then
  echo "❌ AUTHENTICATION FAILURE: User endpoint returning 'Invalid session'"
  exit 1
fi

if [[ $GIGS_RESPONSE == *"Invalid session"* ]]; then
  echo "❌ AUTHENTICATION FAILURE: Gigs endpoint returning 'Invalid session'"
  exit 1
fi

echo "✅ All authentication tests passed!"
echo "✅ Safe to deploy authentication changes"

# Cleanup
rm -f cookies.txt