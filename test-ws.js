const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3000/ws/executions?companyId=test-company');

ws.on('open', () => {
  console.log('✅ Connected to WebSocket server');
  
  // Test creating a task
  setTimeout(() => {
    console.log('📝 Creating test task...');
    fetch('http://localhost:3000/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test Hermes Integration',
        description: 'List files in /tmp directory',
        companyId: 'test-company'
      })
    })
    .then(res => res.json())
    .then(data => {
      console.log(`📦 Task created: ${data.task.id}`);
      console.log(`🚀 Execution run: ${data.run.id}`);
      
      // Subscribe to this specific run
      ws.send(JSON.stringify({
        type: 'subscribe',
        runId: data.run.id
      }));
      console.log(`📤 Subscribed to run ${data.run.id}`);
    })
    .catch(err => {
      console.error('❌ Failed to create task:', err);
    });
  }, 1000);
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    console.log(`📨 [${message.type}]`, message);
    
    if (message.type === 'execution_completed') {
      console.log('🎉 Task completed successfully!');
      console.log('Result:', message.result);
      process.exit(0);
    }
    
    if (message.type === 'execution_failed') {
      console.log('💥 Task failed:', message.error);
      process.exit(1);
    }
  } catch (err) {
    console.log('📨 Raw message:', data.toString());
  }
});

ws.on('error', (err) => {
  console.error('❌ WebSocket error:', err);
});

ws.on('close', () => {
  console.log('🔌 WebSocket connection closed');
  process.exit(0);
});

// Timeout after 30 seconds
setTimeout(() => {
  console.log('⏰ Timeout after 30 seconds');
  process.exit(1);
}, 30000);