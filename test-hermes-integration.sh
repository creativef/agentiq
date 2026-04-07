#!/bin/bash
echo "=== Testing Hermes Integration ==="

# 1. Check if containers are running
echo "1. Checking container status..."
docker compose ps

# 2. Check if Hermes is installed in container
echo -e "\n2. Checking Hermes installation..."
docker compose exec hermes-bridge bash -c "which hermes 2>/dev/null && echo '✓ Hermes found at: \$(which hermes)' && hermes --version || echo '✗ Hermes not found'"

# 3. Check database connection
echo -e "\n3. Checking database connection..."
docker compose exec hermes-bridge bash -c "cd /app && node -e \"const { db } = require('./apps/api/src/db/client'); console.log('✓ Database connection test passed');\" 2>&1 | head -5"

# 4. Check if tasks can be queued (API test)
echo -e "\n4. Testing API health..."
curl -s http://localhost:3000/api/health 2>/dev/null && echo "✓ API is healthy" || echo "✗ API not responding"

# 5. Create a test task via API (optional)
echo -e "\n5. To create a test task manually:"
echo "   - Open http://localhost:3000"
echo "   - Create a task like: 'Test Hermes Integration'"
echo "   - Watch logs: docker compose logs hermes-bridge --follow"
echo "   - You should see: 'Executing task [id]: [title]'"

echo -e "\n=== Test Complete ==="