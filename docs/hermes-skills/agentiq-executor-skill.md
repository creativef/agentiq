---
name: agentiq-executor
description: Execute tasks for AgentIQ Mission Control and report results back
version: 1.0.0
platforms: [linux, macos]
metadata:
  hermes:
    tags: [agentiq, mission-control, task-execution, callback]
    category: devops
requires_toolsets: [terminal, web, file]

# AgentIQ Executor Skill
# This skill enables Hermes to execute tasks for AgentIQ Mission Control

## Purpose
When Hermes receives a task from AgentIQ, it should:
1. Execute the task using available tools
2. Report progress via HTTP callbacks
3. Send final result back to AgentIQ

## Task Format
AgentIQ sends tasks in this format:
```
TASK: [Task Title]
DESCRIPTION: [Task Description]
COMPANY: [Company ID]
AGENT: [Agent Name] (optional)
CALLBACK_URL: [URL to report results]
```

## Execution Protocol

### 1. Acknowledge Task Start
When you receive a task, first acknowledge it:
```bash
curl -X POST "${CALLBACK_URL}/events" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${HERMES_INGEST_TOKEN}" \
  -d '{"level": "info", "message": "Hermes started executing task: [Task Title]"}'
```

### 2. Execute the Task
Use Hermes tools to complete the task. Common patterns:
- **Terminal commands**: For system operations
- **File operations**: For code changes
- **Web requests**: For API interactions
- **Skills**: Load relevant skills if mentioned

### 3. Report Progress
For long-running tasks, send periodic updates:
```bash
curl -X POST "${CALLBACK_URL}/events" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${HERMES_INGEST_TOKEN}" \
  -d '{"level": "info", "message": "Progress: [what you're doing]", "meta": {"step": "[step name]"}}'
```

### 4. Report Final Result
When task is complete:
```bash
curl -X POST "${CALLBACK_URL}/result" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${HERMES_INGEST_TOKEN}" \
  -d '{"status": "completed", "result": "[task output summary]"}'
```

If task fails:
```bash
curl -X POST "${CALLBACK_URL}/result" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${HERMES_INGEST_TOKEN}" \
  -d '{"status": "failed", "error": "[error message]"}'
```

## Environment Variables
- `HERMES_INGEST_TOKEN`: Authentication token for callback API
- `AGENTIQ_API_URL`: Base URL for AgentIQ API (default: http://localhost:3000)

## Example Task Execution

**Task received:**
```
TASK: Deploy application
DESCRIPTION: Deploy the web application to production
COMPANY: acme-corp
AGENT: DevOps Engineer
CALLBACK_URL: http://localhost:3000/api/executions/run-123
```

**Hermes execution steps:**
1. Acknowledge start
2. Check current deployment status
3. Run deployment commands
4. Verify deployment
5. Report success

**Commands:**
```bash
# 1. Acknowledge
curl -X POST "http://localhost:3000/api/executions/run-123/events" \
  -H "Authorization: Bearer $HERMES_INGEST_TOKEN" \
  -d '{"level": "info", "message": "Starting deployment"}'

# 2. Execute deployment
git pull origin main
docker-compose build
docker-compose up -d

# 3. Verify
curl -f http://localhost:8080/health

# 4. Report success
curl -X POST "http://localhost:3000/api/executions/run-123/result" \
  -H "Authorization: Bearer $HERMES_INGEST_TOKEN" \
  -d '{"status": "completed", "result": "Deployment successful. Application running on port 8080."}'
```

## Common Task Types

### 1. Code Changes
- Modify files using `patch` or `write_file`
- Run tests
- Commit changes

### 2. System Operations
- Install packages
- Configure services
- Monitor resources

### 3. Data Operations
- Database migrations
- Data imports/exports
- Report generation

### 4. API Integrations
- Call external APIs
- Webhook setup
- Data synchronization

## Error Handling
- Always include error details in failure reports
- Retry transient failures (network issues)
- Mark permanent failures clearly
- Include suggestions for manual resolution

## Best Practices
1. **Be verbose**: Report each major step
2. **Include context**: Mention which files/tools you used
3. **Verify results**: Check that your changes worked
4. **Clean up**: Remove temporary files/resources
5. **Document**: Explain what you did and why

## Notes
- AgentIQ is the control plane, Hermes is the execution plane
- Hermes should focus on execution, not decision-making
- Report results in a format AgentIQ can parse and display
- Keep callback messages concise but informative