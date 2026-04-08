#!/bin/bash

echo "=== Hermes Standalone Integration Test ==="
echo "Testing Hermes CLI integration without full AgentIQ stack"
echo ""

# Test 1: Basic Hermes functionality
echo "1. Testing Hermes CLI basic commands..."
hermes --version
if [ $? -eq 0 ]; then
    echo "✓ Hermes CLI is working"
else
    echo "✗ Hermes CLI not working"
    exit 1
fi

# Test 2: Create a simple test prompt
echo -e "\n2. Creating test prompt..."
cat > /tmp/test-hermes-prompt.txt << 'EOF'
You are Hermes, the autonomous AI brain of AgentIQ Mission Control.

COMPANY CONTEXT: You are working for Test Company
TASK: Test Hermes Integration
DESCRIPTION: Please run a simple command to verify Hermes can execute tasks. Run 'ls -la /tmp' and show the output.

Execute this task using your available tools and skills.
Show your work with tool calls.
When finished, provide a clear summary of what was accomplished.
EOF

echo "Test prompt created at /tmp/test-hermes-prompt.txt"

# Test 3: Run Hermes with the test prompt
echo -e "\n3. Running Hermes with test prompt (timeout: 30 seconds)..."
echo "Command: hermes chat -Q -q \"\$(cat /tmp/test-hermes-prompt.txt)\" --source tool --max-turns 5"
echo ""

timeout 30 hermes chat -Q -q "$(cat /tmp/test-hermes-prompt.txt)" --source tool --max-turns 5 2>&1 | tee /tmp/hermes-test-output.txt

if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo -e "\n✓ Hermes executed successfully"
    
    # Check if Hermes actually ran commands
    if grep -q "ls -la" /tmp/hermes-test-output.txt || grep -q "terminal" /tmp/hermes-test-output.txt; then
        echo "✓ Hermes used terminal tools"
    else
        echo "⚠ Hermes didn't use terminal tools (might be thinking instead of executing)"
    fi
    
    echo -e "\nOutput summary:"
    tail -20 /tmp/hermes-test-output.txt
else
    echo -e "\n✗ Hermes execution failed or timed out"
    echo "Last 10 lines of output:"
    tail -10 /tmp/hermes-test-output.txt
fi

# Test 4: Test Hermes with a specific skill
echo -e "\n4. Testing Hermes with a specific skill..."
cat > /tmp/test-skill-prompt.txt << 'EOF'
You are Hermes, the autonomous AI brain of AgentIQ Mission Control.

COMPANY CONTEXT: You are working for Test Company
TASK: Test Hermes Skills Integration
DESCRIPTION: Use the 'github-pr-workflow' skill to check if we can access GitHub skills.

First, list available skills to see if github-pr-workflow is available.
Then, if it's available, load it and show what it does.

Execute this task using your available tools and skills.
Show your work with tool calls.
EOF

echo -e "\nRunning Hermes with skill test (timeout: 20 seconds)..."
timeout 20 hermes chat -Q -q "$(cat /tmp/test-skill-prompt.txt)" --source tool --max-turns 3 2>&1 | tee /tmp/hermes-skill-test.txt

if grep -q "github-pr-workflow" /tmp/hermes-skill-test.txt || grep -q "skills_list" /tmp/hermes-skill-test.txt; then
    echo "✓ Hermes can access skills system"
else
    echo "⚠ Hermes didn't show skills access (might need different approach)"
fi

# Cleanup
rm -f /tmp/test-hermes-prompt.txt /tmp/test-skill-prompt.txt

echo -e "\n=== Test Complete ==="
echo ""
echo "Summary:"
echo "1. Hermes CLI: $(hermes --version 2>/dev/null | head -1 || echo 'Not found')"
echo "2. Basic execution: $(if [ -f /tmp/hermes-test-output.txt ] && tail -5 /tmp/hermes-test-output.txt | grep -q -E '(completed|finished|done)'; then echo '✓ Works'; else echo '⚠ Needs verification'; fi)"
echo "3. Skills access: $(if grep -q 'skills' /tmp/hermes-skill-test.txt 2>/dev/null; then echo '✓ Available'; else echo '⚠ Not tested'; fi)"
echo ""
echo "Next steps for AgentIQ integration:"
echo "1. Ensure database is running (PostgreSQL)"
echo "2. Start AgentIQ API: cd ~/agentiq/apps/api && npm run dev"
echo "3. Start Hermes Bridge: cd ~/agentiq/apps/api && npx tsx src/cli/hermes-bridge-service.ts"
echo "4. Visit http://localhost:3000 and create tasks"
echo ""
echo "Log files:"
echo "  Basic test: /tmp/hermes-test-output.txt"
echo "  Skill test: /tmp/hermes-skill-test.txt"