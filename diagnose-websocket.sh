#!/bin/bash
echo "🔍 WebSocket Connection Diagnostic Tool"
echo "========================================"

echo ""
echo "1️⃣ Checking what's running on port 3000..."
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✅ API server is running on port 3000"
    curl -s http://localhost:3000/api/health | jq -r '.status' 2>/dev/null || curl -s http://localhost:3000/api/health
else
    echo "❌ No API server on port 3000"
fi

echo ""
echo "2️⃣ Checking what's running on port 5173..."
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "✅ Something is running on port 5173 (likely Vite)"
    # Try to get Vite's default page
    curl -s -I http://localhost:5173 | head -1
else
    echo "❌ Nothing running on port 5173"
fi

echo ""
echo "3️⃣ Testing Vite proxy to API..."
if curl -s http://localhost:5173/api/health > /dev/null 2>&1; then
    echo "✅ Vite proxy to /api is working"
    curl -s http://localhost:5173/api/health | jq -r '.status' 2>/dev/null || curl -s http://localhost:5173/api/health
else
    echo "❌ Vite proxy to /api is NOT working"
fi

echo ""
echo "4️⃣ Testing WebSocket directly..."
echo "   Trying direct connection to ws://localhost:3000..."
timeout 3 websocat -v ws://localhost:3000/ws/executions 2>&1 | head -5 || echo "   Direct WebSocket connection failed"

echo ""
echo "5️⃣ Testing WebSocket through Vite proxy..."
echo "   Trying connection to ws://localhost:5173..."
timeout 3 websocat -v ws://localhost:5173/ws/executions 2>&1 | head -5 || echo "   Proxy WebSocket connection failed"

echo ""
echo "6️⃣ Checking Docker containers..."
if command -v docker > /dev/null 2>&1; then
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(agentiq|3000|5173)" || echo "   No relevant Docker containers found"
else
    echo "   Docker not installed"
fi

echo ""
echo "7️⃣ Checking processes..."
echo "   Port 3000:"
lsof -i :3000 2>/dev/null || echo "     Nothing listening on port 3000"
echo "   Port 5173:"
lsof -i :5173 2>/dev/null || echo "     Nothing listening on port 5173"

echo ""
echo "========================================"
echo "🎯 Most likely issue:"
echo "   - API server not running on port 3000"
echo "   - OR Vite not configured to proxy WebSocket"
echo "   - OR Docker Compose not started"
echo ""
echo "💡 Solution:"
echo "   1. Run: docker compose up -d"
echo "   2. Check: docker compose logs api"
echo "   3. Verify API is running: curl http://localhost:3000/api/health"