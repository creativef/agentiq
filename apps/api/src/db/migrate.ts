import postgres from 'postgres';

async function main() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/missioncontrol';
  const sql = postgres(connectionString, { max: 1 });

  console.log("Creating tables...");

  const tables = [
    [`users`, `
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'OWNER',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `],
    [`companies`, `
      CREATE TABLE IF NOT EXISTS companies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        goal TEXT NOT NULL DEFAULT 'Building something amazing',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `],
    [`company_members`, `
      CREATE TABLE IF NOT EXISTS company_members (
        company_id UUID NOT NULL REFERENCES companies(id),
        user_id UUID NOT NULL REFERENCES users(id),
        role TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (company_id, user_id)
      )
    `],
    [`projects`, `
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES companies(id),
        name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `],
    [`agents`, `
      CREATE TABLE IF NOT EXISTS agents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES companies(id),
        project_id UUID REFERENCES projects(id),
        platform TEXT,
        external_id TEXT,
        name TEXT NOT NULL,
        role TEXT,
        status TEXT DEFAULT 'idle',
        heartbeat_interval INT,
        last_heartbeat TIMESTAMP,
        cost_monthly INT DEFAULT 0,
        budget_limit INT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `],
    [`tasks`, `
      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID REFERENCES projects(id),
        agent_id UUID REFERENCES agents(id),
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'backlog',
        priority TEXT DEFAULT 'medium',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `],
    [`events`, `
      CREATE TABLE IF NOT EXISTS events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID REFERENCES companies(id),
        project_id UUID REFERENCES projects(id),
        agent_id UUID REFERENCES agents(id),
        platform TEXT,
        type TEXT NOT NULL,
        payload TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `],
    [`connectors`, `
      CREATE TABLE IF NOT EXISTS connectors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES companies(id),
        platform TEXT NOT NULL,
        webhook_secret TEXT,
        api_key TEXT,
        api_url TEXT,
        enabled BOOLEAN DEFAULT true,
        config JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `],
    [`goals`, `
      CREATE TABLE IF NOT EXISTS goals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES companies(id),
        title TEXT NOT NULL,
        description TEXT,
        parent_id UUID,
        progress INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `],
    [`calendar_events`, `
      CREATE TABLE IF NOT EXISTS calendar_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES companies(id),
        title TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT,
        agenda TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `],
    [`chat_messages`, `
      CREATE TABLE IF NOT EXISTS chat_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES companies(id),
        user_id UUID REFERENCES users(id),
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `],
    [`journal_entries`, `
      CREATE TABLE IF NOT EXISTS journal_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES companies(id),
        user_id UUID REFERENCES users(id),
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `],
  ];

  for (const [name, stmt] of tables) {
    try {
      await sql.unsafe(stmt);
      console.log(`  [OK] ${name}`);
    } catch (e: any) {
      console.log(`  [SKIP] ${name}: ${e.message.split('\n')[0]}`);
    }
  }

  // Add platform/external_id columns to agents if they exist without them
  console.log("\nAdding columns to existing tables if needed...");
  const columnAdditions = [
    ['agents', 'platform', 'ALTER TABLE agents ADD COLUMN IF NOT EXISTS platform TEXT'],
    ['agents', 'external_id', 'ALTER TABLE agents ADD COLUMN IF NOT EXISTS external_id TEXT'],
    ['events', 'platform', 'ALTER TABLE events ADD COLUMN IF NOT EXISTS platform TEXT'],
  ];

  for (const [table, col, stmt] of columnAdditions) {
    try {
      await sql.unsafe(stmt);
      console.log(`  [OK] ${table}.${col}`);
    } catch (e: any) {
      if (e.message.includes('already')) {
        console.log(`  [SKIP] ${table}.${col}: already exists`);
      } else {
        console.log(`  [WARN] ${table}.${col}: ${e.message.split('\n')[0]}`);
      }
    }
  }

  console.log("\nAll tables and columns ready!");
  await sql.end();
}

main().catch(console.error);
