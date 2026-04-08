# Hermes Bridge Deployment Guide

## 🚀 Complete Docker Deployment

This guide explains how to deploy the complete AgentIQ + Hermes Bridge system with WebSocket real-time updates.

## 📦 Architecture

```
Docker Compose:
├── postgres:5432      # PostgreSQL database
├── app:3000           # AgentIQ API + WebSocket server + Frontend
└── hermes-bridge      # Hermes execution engine
```

## 🔧 Prerequisites

1. **Docker** and **Docker Compose** installed
2. **Git** to clone/pull the repository
3. **Ports available**: 3000 (API), 5173 (Frontend dev), 5432 (PostgreSQL)

## 🚀 Quick Start

```bash
# 1. Clone/pull the repository
git clone https://github.com/creativef/agentiq.git
cd agentiq

# 2. Start all services
docker compose up -d

# 3. View logs
docker compose logs -f

# 4. Access the application
#    Dashboard: http://localhost:3000
#    Frontend dev: http://localhost:5173
```

## 📊 Service Details

### **PostgreSQL** (`postgres:5432`)
- Database: `missioncontrol`
- User: `postgres`
- Password: `postgres`
- Volume: `pgdata` (persistent storage)

### **AgentIQ App** (`app:3000`)
- API server with WebSocket support
- React frontend (Vite dev server)
- Auto-migrates database on startup
- WebSocket endpoint: `ws://localhost:3000/ws/executions`

### **Hermes Bridge** (`hermes-bridge`)
- Continuous Hermes execution service
- Polls for queued tasks every 5 seconds
- Reports progress via WebSocket
- Auto-retries failed tasks (3 attempts)

## 🔍 Verification Steps

After starting services, verify everything is working:

```bash
# 1. Check all containers are running
docker compose ps

# 2. Check API health
curl http://localhost:3000/api/health

# 3. Check Hermes Bridge logs
docker compose logs hermes-bridge --tail=20

# 4. Test WebSocket connection (install websocat first)
# brew install websocat  # macOS
# apt install websocat   # Ubuntu
websocat ws://localhost:3000/ws/executions
```

## 🎯 Testing the Integration

### **Method 1: Via Web Interface**
1. Open http://localhost:3000
2. Go to Task Board
3. Create a new task (e.g., "List files in /tmp")
4. Assign to an agent or leave unassigned
5. Click "Execute" button
6. Watch real-time updates in the UI

### **Method 2: Via API**
```bash
# Create a test task
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Hermes Integration",
    "description": "Run ls -la to verify Hermes works",
    "priority": "medium",
    "status": "ready",
    "execStatus": "queued"
  }'

# Monitor execution runs
curl http://localhost:3000/api/executions
```

## 🔧 Troubleshooting

### **Hermes CLI not found in container**
```bash
# Enter the hermes-bridge container
docker compose exec hermes-bridge bash

# Install Hermes manually
pip install hermes-agent --break-system-packages
hermes --version
```

### **Database connection issues**
```bash
# Check if PostgreSQL is running
docker compose ps postgres

# Check database logs
docker compose logs postgres

# Test database connection from app container
docker compose exec app node -e "
const { db } = require('./apps/api/src/db/client');
console.log('Database connection OK');
"
```

### **WebSocket not connecting**
```bash
# Check if WebSocket server is running
docker compose exec app netstat -tlnp | grep :3000

# Check server logs for WebSocket initialization
docker compose logs app | grep -i websocket
```

## 🛠️ Development Workflow

### **Local Development (Mac)**
```bash
# 1. Pull latest changes
cd ~/agentiq
git pull origin main

# 2. Rebuild containers if needed
docker compose build

# 3. Restart services
docker compose up -d

# 4. View logs
docker compose logs -f
```

### **Server Deployment**
```bash
# 1. SSH to server
ssh user@server

# 2. Navigate to project
cd ~/agentiq

# 3. Pull latest changes
git pull origin main

# 4. Restart services
docker compose down
docker compose up -d --build

# 5. Verify deployment
docker compose ps
curl http://localhost:3000/api/health
```

## 📈 Monitoring

### **Key Logs to Watch**
```bash
# Real-time logs
docker compose logs -f

# API logs only
docker compose logs app -f

# Hermes Bridge logs only  
docker compose logs hermes-bridge -f

# Database logs
docker compose logs postgres -f
```

### **Performance Metrics**
- **Task queue**: Check `executionRuns` table for queued tasks
- **Execution time**: Monitor `startedAt` vs `finishedAt` in logs
- **Error rate**: Watch for failed executions in bridge logs
- **WebSocket connections**: Check server logs for client connections

## 🔄 Update Process

When new features are added:

```bash
# 1. Pull latest code
git pull origin main

# 2. Rebuild affected containers
docker compose build app hermes-bridge

# 3. Restart services
docker compose up -d

# 4. Run database migrations (if any)
docker compose exec app node apps/api/src/db/migrate.ts
```

## 🎯 Success Indicators

✅ **Green connection dot** in Task Board (WebSocket connected)  
✅ **Tasks execute** when "Execute" button clicked  
✅ **Real-time updates** appear in UI during execution  
✅ **Execution results** stored in database and displayed  
✅ **Hermes Bridge logs** show task processing  
✅ **WebSocket messages** flow between bridge and UI  

## 📞 Support

If issues persist:
1. Check all service logs: `docker compose logs`
2. Verify database is accessible from containers
3. Ensure Hermes CLI is installed in hermes-bridge container
4. Check WebSocket connection from browser DevTools

## 🚀 Next Steps After Deployment

1. **Create test companies and projects** in the UI
2. **Set up agents** with specific roles
3. **Create complex tasks** that use Hermes skills
4. **Monitor execution patterns** and optimize
5. **Scale horizontally** by adding more hermes-bridge containers if needed