#!/bin/bash
echo "🚀 Starting AgentIQ Development Environment"
echo "=========================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop."
    exit 1
fi

echo "1️⃣ Stopping any existing containers..."
docker compose down

echo "2️⃣ Starting database and API server..."
docker compose up -d postgres app

echo "3️⃣ Waiting for API to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
        echo "✅ API server is ready on http://localhost:3000"
        break
    fi
    echo "   Waiting for API... ($i/30)"
    sleep 2
done

echo ""
echo "4️⃣ Starting Vite dev server (outside Docker for better HMR)..."
echo "   Open a NEW terminal and run:"
echo "   cd ~/agentiq/apps/web"
echo "   pnpm dev"
echo ""
echo "5️⃣ Or if you want Vite inside Docker (less responsive):"
echo "   docker compose exec app pnpm -C apps/web dev --host 0.0.0.0"
echo ""
echo "🎯 Once Vite is running:"
echo "   Dashboard: http://localhost:5173"
echo "   API: http://localhost:3000/api/health"
echo ""
echo "🔧 To check logs:"
echo "   docker compose logs -f app"
echo ""
echo "📋 To test WebSocket:"
echo "   curl -X POST http://localhost:3000/api/tasks \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"title\":\"Test\",\"description\":\"Test task\",\"companyId\":\"test\"}'"