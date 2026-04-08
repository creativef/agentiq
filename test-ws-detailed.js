const WebSocket = require('ws');

console.log('🔗 Starting WebSocket test...');
const ws = new WebSocket('ws://localhost:3000/ws/executions?companyId=test-company');

ws.on('open', () => {
  console.log('✅ Connected to WebSocket server');
  
  // Test creating a task
  setTimeout(() => {
    console.log('\n📝 Creating test task via API...');
    fetch('http://localhost:3000/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test Directory Listing',
        description: 'Use Hermes to list files in current directory',
        companyId: 'test-company'
      })
    })
    .then(res => {
      console.log(`📡 API Response status: ${res.status}`);
      return res.json();
    })
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
      console.error('❌ Failed to create task:', err.message);
    });
  }, 1000);
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    console.log(`\n📨 [${message.type}]`);
    
    if (message.event) {
      console.log(`   Event: ${message.event.type}`);
      console.log(`   Run ID: ${message.event.runId}`);
      console.log(`   Task ID: ${message.event.taskId}`);
      
      if (message.event.result) {
        console.log(`   Result: ${message.event.result.substring(0, 200)}...`);
      }
      if (message.event.error) {
        console.log(`   Error: ${message.event.error}`);
      }
    }
    
    if (message.type === 'execution_completed') {
      console.log('\n🎉 Task completed successfully!');
      console.log('Full result available in API server logs');
      setTimeout(() => process.exit(0), 1000);
    }
    
    if (message.type === 'execution_failed') {
      console.log('\n💥 Task failed');
      setTimeout(() => process.exit(1), 1000);
    }
  } catch (err) {
    console.log('📨 Raw message:', data.toString().substring(0, 200));
  }
});

ws.on('error', (err) => {
  console.error('❌ WebSocket error:', err);
});

ws.on('close', () => {
  console.log('🔌 WebSocket connection closed');
  process.exit(0);
});

// Timeout after 60 seconds
setTimeout(() => {
  console.log('\n⏰ Timeout after 60 seconds');
  process.exit(1);
}, 60000);