#!/bin/bash
echo "🍎 Starting AgentIQ on Mac (Apple Silicon)"
echo "=========================================="

# Check if we should use Docker or local
echo ""
echo "Choose setup method:"
echo "1) Docker Compose (recommended - everything in containers)"
echo "2) Local development (API in Docker, Vite on host)"
echo "3) Fix pnpm dependencies first"
read -p "Enter choice (1-3): " choice

case $choice in
  1)
    echo "🚀 Starting Docker Compose..."
    docker compose -f docker-compose.dev.yml up -d
    echo ""
    echo "✅ Services started:"
    echo "   API: http://localhost:3000"
    echo "   Web: http://localhost:5173"
    echo "   DB: localhost:5432"
    echo ""
    echo "📋 Check logs: docker compose -f docker-compose.dev.yml logs -f"
    ;;
    
  2)
    echo "🔧 Starting hybrid setup..."
    echo "1. Starting database and API in Docker..."
    docker compose -f docker-compose.dev.yml up -d postgres api
    
    echo "2. Waiting for API..."
    for i in {1..20}; do
      if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
        echo "✅ API ready at http://localhost:3000"
        break
      fi
      echo "   Waiting... ($i/20)"
      sleep 2
    done
    
    echo ""
    echo "3. Starting Vite on host machine..."
    echo "   Open a NEW terminal and run:"
    echo "   cd ~/agentiq/apps/web"
    echo "   npm install && npm run dev"
    echo ""
    echo "   Or if npm fails, try:"
    echo "   rm -rf node_modules package-lock.json && npm install"
    ;;
    
  3)
    echo "🔧 Fixing pnpm dependencies..."
    cd ~/agentiq
    
    echo "1. Cleaning up..."
    rm -rf node_modules pnpm-lock.yaml apps/web/node_modules
    
    echo "2. Reinstalling dependencies..."
    pnpm install --force
    
    echo "3. Testing Vite..."
    cd apps/web
    pnpm dev || {
      echo "❌ pnpm still failing. Trying npm..."
      rm -rf node_modules package-lock.json
      npm install
      npm run dev
    }
    ;;
    
  *)
    echo "❌ Invalid choice"
    ;;
esac

echo ""
echo "🎯 WebSocket should connect to: ws://localhost:5173/ws/executions"
echo "🔍 Check browser console for: '[WebSocket] Connected to execution server'"