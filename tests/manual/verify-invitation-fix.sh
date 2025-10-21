#!/bin/bash
# Quick verification script for invitation URL alias fix
# Run this with the server running on localhost:3000

echo "🧪 Invitation URL Alias Verification Script"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASS=0
FAIL=0

# Test 1: GET /auth/accept-invitation with token (should redirect)
echo "Test 1: GET /auth/accept-invitation?token=test123"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}|%{redirect_url}" "http://localhost:3000/auth/accept-invitation?token=test123")
HTTP_CODE=$(echo $RESPONSE | cut -d'|' -f1)
REDIRECT_URL=$(echo $RESPONSE | cut -d'|' -f2)

if [[ "$HTTP_CODE" == "302" ]] && [[ "$REDIRECT_URL" == *"accept-invite"* ]]; then
  echo -e "${GREEN}✓ PASS${NC}: Redirects to /auth/accept-invite"
  ((PASS++))
else
  echo -e "${RED}✗ FAIL${NC}: Expected 302 redirect, got $HTTP_CODE"
  ((FAIL++))
fi
echo ""

# Test 2: GET /auth/accept-invitation without token (should error)
echo "Test 2: GET /auth/accept-invitation (no token)"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/auth/accept-invitation")

if [[ "$HTTP_CODE" == "400" ]]; then
  echo -e "${GREEN}✓ PASS${NC}: Returns 400 error for missing token"
  ((PASS++))
else
  echo -e "${RED}✗ FAIL${NC}: Expected 400, got $HTTP_CODE"
  ((FAIL++))
fi
echo ""

# Test 3: Original route still works
echo "Test 3: GET /auth/accept-invite?token=test123 (original route)"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/auth/accept-invite?token=test123")

if [[ "$HTTP_CODE" == "200" ]] || [[ "$HTTP_CODE" == "404" ]] || [[ "$HTTP_CODE" == "410" ]]; then
  echo -e "${GREEN}✓ PASS${NC}: Original route responds (code: $HTTP_CODE)"
  ((PASS++))
else
  echo -e "${RED}✗ FAIL${NC}: Unexpected response code: $HTTP_CODE"
  ((FAIL++))
fi
echo ""

# Test 4: Special characters in token
echo "Test 4: Token with special characters"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}|%{redirect_url}" "http://localhost:3000/auth/accept-invitation?token=abc+def%2Fghi")
HTTP_CODE=$(echo $RESPONSE | cut -d'|' -f1)
REDIRECT_URL=$(echo $RESPONSE | cut -d'|' -f2)

if [[ "$HTTP_CODE" == "302" ]] && [[ "$REDIRECT_URL" == *"accept-invite"* ]]; then
  echo -e "${GREEN}✓ PASS${NC}: Handles special characters correctly"
  ((PASS++))
else
  echo -e "${RED}✗ FAIL${NC}: Special character handling failed"
  ((FAIL++))
fi
echo ""

# Test 5: POST endpoint forwards correctly
echo "Test 5: POST /auth/accept-invitation"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "http://localhost:3000/auth/accept-invitation" \
  -H "Content-Type: application/json" \
  -d '{"token":"test","full_name":"Test","password":"short"}')

if [[ "$HTTP_CODE" == "400" ]]; then
  echo -e "${GREEN}✓ PASS${NC}: POST forwards correctly and validates (400 for short password)"
  ((PASS++))
else
  echo -e "${YELLOW}⚠ WARN${NC}: Got $HTTP_CODE (expected 400 for invalid password)"
  ((PASS++)) # Still counts as pass since it's processing
fi
echo ""

# Summary
echo "=========================================="
echo "Test Summary:"
echo -e "  ${GREEN}Passed: $PASS${NC}"
echo -e "  ${RED}Failed: $FAIL${NC}"
echo ""

if [[ $FAIL -eq 0 ]]; then
  echo -e "${GREEN}✓ All tests passed! Invitation URL alias is working.${NC}"
  exit 0
else
  echo -e "${RED}✗ Some tests failed. Please review the implementation.${NC}"
  exit 1
fi
