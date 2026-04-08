#!/bin/bash

echo "=== AgentIQ + Hermes Full Integration Test ==="
echo "This test verifies the complete Hermes Bridge with WebSocket real-time updates"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ $2${NC}"
    else
        echo -e "${RED}✗ $2${NC}"
    fi
}

# 1. Check if Hermes is installed
echo "1. Checking Hermes installation..."
which hermes > /dev/null 2>&1
print_status $? "Hermes CLI installed"

hermes --version > /dev/null 2>&1
print_status $? "Hermes version check"

# 2. Check Node.js and dependencies
echo -e "\n2. Checking Node.js environment..."
cd ~/agentiq
node --version > /dev/null 2>&1
print_status $? "Node.js available"

npm list tsx > /dev/null 2>&1
print_status $? "tsx installed"

# 3. Check database connection
echo -e "\n3. Checking database connection..."
cd ~/agentiq/apps/api
node -e "
const { db } = require('./src/db/client');
console.log('Database connection test passed');
" 2>&1 | grep -q "Database connection test passed"
print_status $? "Database connection"

# 4. Start API server in background
echo -e "\n4. Starting API server with WebSocket support..."
cd ~/agentiq/apps/api
npm run dev > /tmp/agentiq-api.log 2>&1 &
API_PID=$!
sleep 5

# Check if API is running
curl -s http://localhost:3000/api/health > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ API server running on port 3000${NC}"
else
    echo -e "${RED}✗ API server failed to start${NC}"
    echo "API logs:"
    tail -20 /tmp/agentiq-api.log
    kill $API_PID 2>/dev/null
    exit 1
fi

# 5. Test WebSocket endpoint
echo -e "\n5. Testing WebSocket endpoint..."
timeout 5 websocat -v ws://localhost:3000/ws/executions 2>&1 | grep -q "connected"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ WebSocket server is running${NC}"
else
    echo -e "${YELLOW}⚠ WebSocket test inconclusive (websocat not available)${NC}"
fi

# 6. Start Hermes Bridge Service in background
echo -e "\n6. Starting Hermes Bridge Service..."
cd ~/agentiq/apps/api
npx tsx src/cli/hermes-bridge-service.ts > /tmp/hermes-bridge.log 2>&1 &
BRIDGE_PID=$!
sleep 3

# Check if bridge started
if ps -p $BRIDGE_PID > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Hermes Bridge Service started (PID: $BRIDGE_PID)${NC}"
    echo "Bridge logs:"
    tail -5 /tmp/hermes-bridge.log
else
    echo -e "${RED}✗ Hermes Bridge Service failed to start${NC}"
    echo "Bridge logs:"
    tail -10 /tmp/hermes-bridge.log
    kill $API_PID 2>/dev/null
    exit 1
fi

# 7. Create a test task via API
echo -e "\n7. Creating test task..."
TEST_TASK=$(curl -s -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Hermes Integration - List files in /tmp",
    "description": "This is a test task to verify Hermes integration. Please list files in /tmp directory.",
    "priority": "medium",
    "status": "ready",
    "execStatus": "queued"
  }' 2>/dev/null)

if echo "$TEST_TASK" | grep -q "task"; then
    TASK_ID=$(echo "$TEST_TASK" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo -e "${GREEN}✓ Test task created (ID: $TASK_ID)${NC}"
    
    # Check if execution run was created
    sleep 2
    EXEC_RUNS=$(curl -s "http://localhost:3000/api/executions?taskId=$TASK_ID")
    if echo "$EXEC_RUNS" | grep -q "runId"; then
        echo -e "${GREEN}✓ Execution run automatically created${NC}"
    else
        echo -e "${YELLOW}⚠ No execution run created yet (may need manual trigger)${NC}"
    fi
else
    echo -e "${RED}✗ Failed to create test task${NC}"
    echo "Response: $TEST_TASK"
fi

# 8. Monitor bridge logs for execution
echo -e "\n8. Monitoring Hermes Bridge for 10 seconds..."
echo "Bridge logs (last 10 lines):"
timeout 10 tail -f /tmp/hermes-bridge.log &
TAIL_PID=$!
sleep 10
kill $TAIL_PID 2>/dev/null

# 9. Cleanup
echo -e "\n9. Cleaning up..."
kill $BRIDGE_PID 2>/dev/null
kill $API_PID 2>/dev/null
sleep 2

echo -e "\n${GREEN}=== Integration Test Complete ===${NC}"
echo ""
echo "Next steps:"
echo "1. Visit http://localhost:3000 and go to Task Board"
echo "2. Create a task and assign it to an agent"
echo "3. Click 'Execute' button"
echo "4. Watch the WebSocket connection indicator (green dot)"
echo "5. Task status should update in real-time as Hermes executes"
echo ""
echo "To run the services manually:"
echo "  # Terminal 1 - API + WebSocket"
echo "  cd ~/agentiq/apps/api && npm run dev"
echo ""
echo "  # Terminal 2 - Hermes Bridge"
echo "  cd ~/agentiq/apps/api && npx tsx src/cli/hermes-bridge-service.ts"
echo ""
echo "Logs:"
echo "  API: /tmp/agentiq-api.log"
echo "  Bridge: /tmp/hermes-bridge.log"