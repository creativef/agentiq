import postgres from 'postgres';

async function main() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:***@localhost:5432/missioncontrol';
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
        goal TEXT NOT NULL DEFAULT 'Default goal',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `],
    [`company_members`, `
      CREATE TABLE IF NOT EXISTS company_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'MEMBER',
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(company_id, user_id)
      )
    `],
    [`projects`, `
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `],
    [`agents`, `
      CREATE TABLE IF NOT EXISTS agents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        project_id UUID REFERENCES projects(id),
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'AGENT',
        status TEXT NOT NULL DEFAULT 'idle',
        last_heartbeat TIMESTAMP,
        cost_monthly INTEGER DEFAULT 0,
        budget_limit INTEGER,
        reports_to UUID REFERENCES agents(id),
        alt_reports_to UUID[],
        x_pos INT,
        y_pos INT,
        created_at TIMESTAMP DEFAULT NOW(),
        heartbeat_interval INTEGER DEFAULT 3600,
        platform TEXT,
        external_id TEXT
      )
    `],
    [`tasks`, `
      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        agent_id UUID REFERENCES agents(id),
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'todo',
        priority TEXT DEFAULT 'medium',
        created_at TIMESTAMP DEFAULT NOW(),
        due_date TIMESTAMP,
        exec_status TEXT DEFAULT 'idle',
        scheduled_at TIMESTAMP,
        approver_role TEXT,
        approval_status TEXT,
        result TEXT,
        assigned_by TEXT,
        x_pos INT,
        y_pos INT
      )
    `],
    [`events`, `
      CREATE TABLE IF NOT EXISTS events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        project_id UUID REFERENCES projects(id),
        type TEXT NOT NULL,
        actor TEXT,
        description TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `],
    [`connectors`, `
      CREATE TABLE IF NOT EXISTS connectors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        platform TEXT NOT NULL,
        config JSONB,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `],
    [`goals`, `
      CREATE TABLE IF NOT EXISTS goals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        progress INTEGER DEFAULT 0,
        parent_id UUID REFERENCES goals(id),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `],
    [`journal_entries`, `
      CREATE TABLE IF NOT EXISTS journal_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id),
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `],
    [`audit_log`, `
      CREATE TABLE IF NOT EXISTS audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        email TEXT,
        company_id UUID REFERENCES companies(id),
        project_id UUID REFERENCES projects(id),
        method TEXT,
        path TEXT,
        status_code INTEGER,
        ip TEXT,
        user_agent TEXT,
        meta JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `],
    [`calendar_events`, `
      CREATE TABLE IF NOT EXISTS calendar_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        project_id UUID REFERENCES projects(id),
        agent_id UUID REFERENCES agents(id),
        title TEXT NOT NULL,
        description TEXT,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP,
        all_day BOOLEAN DEFAULT false,
        type TEXT DEFAULT 'meeting',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `],
    [`skills`, `
      CREATE TABLE IF NOT EXISTS skills (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        instructions TEXT NOT NULL,
        icon TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `],
    [`agent_skills`, `
      CREATE TABLE IF NOT EXISTS agent_skills (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
        custom_instructions TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(agent_id, skill_id)
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

  // Add the reports_to column if table already exists
  try {
    await sql.unsafe(`ALTER TABLE agents ADD COLUMN IF NOT EXISTS reports_to UUID REFERENCES agents(id)`);
    console.log("  [OK] agents.reports_to");
  } catch (e: any) {
    console.log(`  [SKIP] reports_to column: ${e.message.split('\n')[0]}`);
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
    ['idx_agent_skills_agent_id', 'CREATE INDEX IF NOT EXISTS idx_agent_skills_agent_id ON agent_skills(agent_id)'],
    ['idx_agent_skills_skill_id', 'CREATE INDEX IF NOT EXISTS idx_agent_skills_skill_id ON agent_skills(skill_id)'],
    ['idx_skills_category', 'CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category)'],
    ['idx_agents_reports_to', 'CREATE INDEX IF NOT EXISTS idx_agents_reports_to ON agents(reports_to)'],
    ['idx_journal_company_id', 'CREATE INDEX IF NOT EXISTS idx_journal_company_id ON journal_entries(company_id)'],
  ];

  for (const [name, stmt] of indexes) {
    try {
      await sql.unsafe(stmt);
      console.log(`  [OK] ${name}`);
    } catch (e: any) {
      console.log(`  [SKIP] ${name}: ${e.message.split('\n')[0]}`);
    }
  }

  // Seed skill templates if none exist
  const skillCount = await sql.unsafe("SELECT COUNT(*) as cnt FROM skills");
  if (parseInt(skillCount[0].cnt) === 0) {
    console.log("\nSeeding skill templates...");
    const seedSkills = [
      { name: "Strategic Planning", category: "leadership", icon: "📊",
        description: "Business strategy and planning",
        instructions: "You are a strategic advisor. Think long-term. Identify risks and opportunities. Provide data-driven recommendations. Present clear, actionable plans with timelines." },
      { name: "Project Management", category: "operations", icon: "📋",
        description: "Coordination and delivery",
        instructions: "You are a project manager. Break work into actionable tasks. Track dependencies. Communicate blockers early. Optimize for team velocity." },
      { name: "Code Generation", category: "development", icon: "💻",
        description: "Write, review, and debug code",
        instructions: "You are a skilled developer. Write clean, tested, documented code. Follow best practices. Prefer simplicity over cleverness." },
      { name: "Research & Analysis", category: "analysis", icon: "🔍",
        description: "Market research and data analysis",
        instructions: "You are a research analyst. Gather data from reliable sources. Synthesize findings into clear, actionable insights. Always cite sources." },
      { name: "Content Writing", category: "content", icon: "📝",
        description: "Blog posts, documentation, and copy",
        instructions: "You are a senior content writer. Write clear, engaging, audience-appropriate content. Use active voice. Edit ruthlessly." },
    ];

    for (const s of seedSkills) {
      try {
        await sql`INSERT INTO skills (id, name, category, description, instructions, icon) VALUES (${crypto.randomUUID()}, ${s.name}, ${s.category}, ${s.description}, ${s.instructions}, ${s.icon})`;
        console.log(`  [SEED] ${s.name}`);
      } catch (e: any) {
        console.log(`  [SKIP seed] ${s.name}: ${e.message.split('\n')[0]}`);
      }
    }
  } else {
    console.log("\nSkills already seeded, skipping.");
  }


  // Task Execution Engine Columns
  console.log("\nAdding task execution columns (safe for existing tables)...");
  const taskColumns = [
    ['tasks', 'exec_status', "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS exec_status TEXT DEFAULT 'idle'"],
    ['tasks', 'scheduled_at', "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP"],
    ['tasks', 'approver_role', "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS approver_role TEXT"],
    ['tasks', 'approval_status', "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS approval_status TEXT"],
    ['tasks', 'result', "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS result TEXT"],
  ];

  for (const [tbl, col, stmt] of taskColumns) {
    try {
      await sql.unsafe(stmt);
      console.log(`  [OK] ${tbl}.${col}`);
    } catch (e: any) {
      console.log(`  [SKIP] ${tbl}.${col}: ${e.message.split('\n')[0]}`);
    }
  }

  
  // Audit Log Table
  console.log("\nCreating audit_log table...");
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id),
      email TEXT,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      status_code TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      meta TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log("  [OK] audit_log");

  // Agent Activity Log Table
  console.log("\nCreating agent_logs table...");
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS agent_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
      level TEXT DEFAULT 'info',
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log("  [OK] agent_logs");

  // Chat Messages Table
  console.log("\nCreating chat_messages table...");
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      content TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log("  [OK] chat_messages");

  // Files Table
  console.log("\nCreating files table...");
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS files (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      file_type TEXT,
      file_size INT,
      file_path TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log("  [OK] files");



  // LLM Providers Table
  console.log("\nCreating llm_providers table...");
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS llm_providers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      base_url TEXT,
      api_key TEXT,
      max_tokens INT DEFAULT 4000,
      temperature FLOAT DEFAULT 0.3,
      is_active BOOLEAN DEFAULT false,
      priority INT DEFAULT 0,
      last_used TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log("  [OK] llm_providers");

  // Company Briefs Table

  console.log("\nCreating company_briefs table...");
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS company_briefs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      vision TEXT NOT NULL,
      market_context TEXT,
      constraints TEXT,
      priorities TEXT,
      reporting_cadence TEXT DEFAULT 'daily',
      created_by UUID NOT NULL,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log("  [OK] company_briefs");

  // CEO Decisions Table
  console.log("\nCreating ceo_decisions table...");
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS ceo_decisions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
      decision TEXT NOT NULL,
      reasoning TEXT,
      action TEXT NOT NULL,
      target_id UUID,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log("  [OK] ceo_decisions");

  // Agent Performance Table
  console.log("\nCreating agent_performance table...");
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS agent_performance (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
      score INT,
      outcome TEXT,
      notes TEXT,
      flagged_by_ceo BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log("  [OK] agent_performance");


  // Skill Bundles — role-based skill collections
  console.log("\nCreating skill_bundles table...");
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS skill_bundles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      description TEXT,
      icon TEXT DEFAULT '📦',
      is_system BOOLEAN DEFAULT false,
      company_id UUID REFERENCES companies(id),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log("  [OK] skill_bundles");

  // Bundle Skills — join table linking bundles to individual skills
  console.log("\nCreating bundle_skills table...");
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS bundle_skills (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      bundle_id UUID NOT NULL REFERENCES skill_bundles(id) ON DELETE CASCADE,
      skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
      sort_order INTEGER DEFAULT 0,
      is_required BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(bundle_id, skill_id)
    )
  `);
  console.log("  [OK] bundle_skills");

  // Agent Bundles — tracks which bundles were assigned to which agents
  console.log("\nCreating agent_bundles table...");
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS agent_bundles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      agent_id UUID NOT NULL,
      bundle_id UUID NOT NULL,
      assigned_by TEXT,
      status TEXT DEFAULT 'active',
      assigned_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(agent_id, bundle_id)
    )
  `);
  console.log("  [OK] agent_bundles");

  // Audit Log Table
  console.log("\nCreating audit_log table...");
  try {
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        email TEXT,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        status_code TEXT NOT NULL,
        ip TEXT,
        user_agent TEXT,
        meta TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("  [OK] audit_log");
  } catch (e: any) {
    console.log(`  [SKIP] audit_log: ${e.message}`);
  }

  await sql.end();
}

main().catch(console.error);
