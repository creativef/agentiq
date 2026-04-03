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
        reports_to UUID REFERENCES agents(id),
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
    [`audit_log`, `
      CREATE TABLE IF NOT EXISTS audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT,
        user_email TEXT,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        status_code TEXT NOT NULL,
        resource_type TEXT,
        resource_id TEXT,
        user_agent TEXT,
        ip TEXT,
        message TEXT,
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

  console.log("\nAll tables ready!");

  // Add indexes on foreign keys and common query columns
  console.log("\nCreating indexes...");
  const indexes = [
    ['idx_agents_company_id', 'CREATE INDEX IF NOT EXISTS idx_agents_company_id ON agents(company_id)'],
    ['idx_agents_platform', 'CREATE INDEX IF NOT EXISTS idx_agents_platform ON agents(company_id, platform)'],
    ['idx_tasks_project_id', 'CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id)'],
    ['idx_tasks_status', 'CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(project_id, status)'],
    ['idx_events_company_id', 'CREATE INDEX IF NOT EXISTS idx_events_company_id ON events(company_id)'],
    ['idx_events_created', 'CREATE INDEX IF NOT EXISTS idx_events_created ON events(company_id, created_at DESC)'],
    ['idx_company_members_user', 'CREATE INDEX IF NOT EXISTS idx_company_members_user ON company_members(user_id)'],
    ['idx_projects_company_id', 'CREATE INDEX IF NOT EXISTS idx_projects_company_id ON projects(company_id)'],
    ['idx_connectors_company', 'CREATE INDEX IF NOT EXISTS idx_connectors_company ON connectors(company_id, platform)'],
    ['idx_goals_company_id', 'CREATE INDEX IF NOT EXISTS idx_goals_company_id ON goals(company_id)'],
  ];

  for (const [name, stmt] of indexes) {
    try {
      await sql.unsafe(stmt);
      console.log(`  [OK] ${name}`);
    } catch (e: any) {
      console.log(`  [SKIP] ${name}: ${e.message.split('\n')[0]}`);
    }
  console.log("\nSeeding skill templates...");
  const seedSkills = [
    { name: 'Code Generation', category: 'development', icon: '💻',
      description: 'Write, review, and debug code',
      instructions: 'You are a skilled software engineer. Write clean, tested, documented code. Follow best practices and design patterns. Prefer simplicity over cleverness. Add comments explaining non-obvious logic.' },
    { name: 'Research & Analysis', category: 'analysis', icon: '🔍',
      description: 'Market research and data analysis',
      instructions: 'You are a research analyst. Gather data from reliable sources. Synthesize findings into clear, actionable insights. Always cite your sources. Flag uncertainty when data is incomplete.' },
  // Seed skill templates if none exist
  await db.select({ count: sql`count(*)` }).from(skills).then(rows => {
    const checkSkills = rows;
    return checkSkills;
  }).then(async (checkSkills) => {
    if (parseInt(checkSkills[0].count) > 0) return;
    console.log("\nSeeding skill templates...");
    const seedSkills = [
      { id: "strategic_planning", name: "Strategic Planning", category: "leadership", icon: "📊",
        description: "Business strategy and planning",
        instructions: "You are a strategic advisor. Think long-term. Identify risks and opportunities. Provide data-driven recommendations. Present clear, actionable plans with timelines." },
      { id: "project_management", name: "Project Management", category: "operations", icon: "📋",
        description: "Coordination and delivery",
        instructions: "You are a project manager. Break work into actionable tasks. Track dependencies. Communicate blockers early. Optimize for team velocity." },
      { id: "code_generation", name: "Code Generation", category: "development", icon: "💻",
        description: "Write, review, and debug code",
        instructions: "You are a skilled software developer. Write clean, tested, documented code. Follow best practices and design patterns. Prefer simplicity over cleverness." },
      { id: "research_analysis", name: "Research & Analysis", category: "analysis", icon: "🔍",
        description: "Market research and data analysis",
        instructions: "You are a research analyst. Gather data from reliable sources. Synthesize findings into clear, actionable insights. Always cite sources. Flag uncertainty." },
      { id: "content_writing", name: "Content Writing", category: "content", icon: "📝",
        description: "Blog posts, documentation, and copy",
        instructions: "You are a senior content writer. Write clear, engaging, audience-appropriate content. Use active voice. Edit ruthlessly. Match the brand voice and tone." },
    ];

    for (const s of seedSkills) {
      try {
        await sql`INSERT INTO skills (id, name, category, description, instructions, icon) VALUES (${crypto.randomUUID()}, ${s.name}, ${s.category}, ${s.description}, ${s.instructions}, ${s.icon})`;
        console.log(`  [SEED] ${s.name}`);
      } catch (e: any) {
        console.log(`  [SKIP seed] ${s.name}: ${e.message.split('\n')[0]}`);
      }
    }
  });

  await sql.end();
}

main().catch(console.error);
