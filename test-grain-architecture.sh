#!/bin/bash

# Test script for the new Grain Architecture
# Tests the multi-cycle functionality

echo "🧪 Testing New Grain Architecture"
echo "=================================="
echo ""

# Configuration
API_URL="http://localhost:3000"
SIDECAR_URL="http://localhost:5174"

# Test user credentials (you'll need to register/login first)
# Replace with your actual JWT token
JWT_TOKEN="your-jwt-token-here"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "📋 Test Plan:"
echo "1. Check API health"
echo "2. Check Orleans sidecar health"
echo "3. Create first cycle"
echo "4. Get cycle state"
echo "5. Try to create second cycle (should fail - only 1 active)"
echo "6. Complete first cycle"
echo "7. Create second cycle (should succeed)"
echo "8. Verify multiple cycles exist"
echo ""

# Test 1: Check API health
echo "Test 1: Checking API health..."
if curl -s -f "$API_URL" > /dev/null 2>&1; then
  echo -e "${GREEN}✓ API is running${NC}"
else
  echo -e "${RED}✗ API is not responding${NC}"
  exit 1
fi

# Test 2: Check Orleans sidecar health
echo "Test 2: Checking Orleans sidecar health..."
if curl -s -f "$SIDECAR_URL" > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Orleans sidecar is running${NC}"
else
  echo -e "${RED}✗ Orleans sidecar is not responding${NC}"
  exit 1
fi

echo ""
echo -e "${YELLOW}⚠️  Manual testing required${NC}"
echo ""
echo "To complete the tests, you need to:"
echo "1. Register/Login to get a JWT token"
echo "2. Update this script with your JWT_TOKEN"
echo "3. Run the script again"
echo ""
echo "Or test manually with curl:"
echo ""
echo "# Create cycle"
echo "curl -X POST $API_URL/cycle \\"
echo "  -H 'Authorization: Bearer YOUR_TOKEN' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"startDate\": \"2024-01-01T10:00:00Z\", \"endDate\": \"2024-01-01T18:00:00Z\"}'"
echo ""
echo "# Get cycle state"
echo "curl -X GET $API_URL/cycle \\"
echo "  -H 'Authorization: Bearer YOUR_TOKEN'"
echo ""
echo "# Complete cycle"
echo "curl -X POST $API_URL/cycle/complete \\"
echo "  -H 'Authorization: Bearer YOUR_TOKEN' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"cycleId\": \"CYCLE_ID\", \"startDate\": \"2024-01-01T10:00:00Z\", \"endDate\": \"2024-01-01T18:00:00Z\"}'"
echo ""
echo "Expected behavior:"
echo "- ✅ First cycle should create successfully"
echo "- ✅ GET should return the active cycle"
echo "- ❌ Second POST should fail with 409 (cycle already in progress)"
echo "- ✅ After completing first cycle, second cycle should succeed"
echo ""
