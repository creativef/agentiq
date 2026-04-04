     1|import postgres from 'postgres';
     2|
     3|async function main() {
     4|  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:***@localhost:5432/missioncontrol';
     5|  const sql = postgres(connectionString, { max: 1 });
     6|
     7|  console.log("Creating tables...");
     8|
     9|  const tables = [
    10|    [`users`, `
    11|      CREATE TABLE IF NOT EXISTS users (
    12|        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    13|        email TEXT NOT NULL UNIQUE,
    14|        password_hash TEXT NOT NULL,
    15|        role TEXT NOT NULL DEFAULT 'OWNER',
    16|        created_at TIMESTAMP DEFAULT NOW()
    17|      )
    18|    `],
    19|    [`companies`, `
    20|      CREATE TABLE IF NOT EXISTS companies (
    21|        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    22|        name TEXT NOT NULL,
    23|        goal TEXT NOT NULL DEFAULT 'Building something amazing',
    24|        created_at TIMESTAMP DEFAULT NOW()
    25|      )
    26|    `],
    27|    [`company_members`, `
    28|      CREATE TABLE IF NOT EXISTS company_members (
    29|        company_id UUID NOT NULL REFERENCES companies(id),
    30|        user_id UUID NOT NULL REFERENCES users(id),
    31|        role TEXT NOT NULL,
    32|        created_at TIMESTAMP DEFAULT NOW(),
    33|        PRIMARY KEY (company_id, user_id)
    34|      )
    35|    `],
    36|    [`projects`, `
    37|      CREATE TABLE IF NOT EXISTS projects (
    38|        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    39|        company_id UUID NOT NULL REFERENCES companies(id),
    40|        name TEXT NOT NULL,
    41|        created_at TIMESTAMP DEFAULT NOW()
    42|      )
    43|    `],
    44|    [`agents`, `
    45|      CREATE TABLE IF NOT EXISTS agents (
    46|        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    47|        company_id UUID NOT NULL REFERENCES companies(id),
    48|        project_id UUID REFERENCES projects(id),
    49|        platform TEXT,
    50|        external_id TEXT,
    51|        name TEXT NOT NULL,
    52|        role TEXT,
    53|        status TEXT DEFAULT 'idle',
    54|        heartbeat_interval INT,
    55|        last_heartbeat TIMESTAMP,
    56|        cost_monthly INT DEFAULT 0,
    57|        budget_limit INT,
    58|        reports_to UUID REFERENCES agents(id),
    59|        created_at TIMESTAMP DEFAULT NOW()
    60|      )
    61|    `],
    62|    [`tasks`, `
    63|      CREATE TABLE IF NOT EXISTS tasks (
    64|        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    65|        project_id UUID REFERENCES projects(id),
    66|        agent_id UUID REFERENCES agents(id),
    67|        title TEXT NOT NULL,
    68|        description TEXT,
    69|        status TEXT DEFAULT 'backlog',
    70|        priority TEXT DEFAULT 'medium',
    71|        created_at TIMESTAMP DEFAULT NOW()
    72|      )
    73|    `],
    74|    [`events`, `
    75|      CREATE TABLE IF NOT EXISTS events (
    76|        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    77|        company_id UUID REFERENCES companies(id),
    78|        project_id UUID REFERENCES projects(id),
    79|        agent_id UUID REFERENCES agents(id),
    80|        platform TEXT,
    81|        type TEXT NOT NULL,
    82|        payload TEXT,
    83|        created_at TIMESTAMP DEFAULT NOW()
    84|      )
    85|    `],
    86|    [`connectors`, `
    87|      CREATE TABLE IF NOT EXISTS connectors (
    88|        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    89|        company_id UUID NOT NULL REFERENCES companies(id),
    90|        platform TEXT NOT NULL,
    91|        webhook_secret TEXT,
    92|        api_key TEXT,
    93|        api_url TEXT,
    94|        enabled BOOLEAN DEFAULT true,
    95|        config JSONB,
    96|        created_at TIMESTAMP DEFAULT NOW()
    97|      )
    98|    `],
    99|    [`goals`, `
   100|      CREATE TABLE IF NOT EXISTS goals (
   101|        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   102|        company_id UUID NOT NULL REFERENCES companies(id),
   103|        title TEXT NOT NULL,
   104|        description TEXT,
   105|        parent_id UUID,
   106|        progress INT DEFAULT 0,
   107|        created_at TIMESTAMP DEFAULT NOW()
   108|      )
   109|    `],
   110|    [`calendar_events`, `
   111|      CREATE TABLE IF NOT EXISTS calendar_events (
   112|        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   113|        company_id UUID NOT NULL REFERENCES companies(id),
   114|        title TEXT NOT NULL,
   115|        date TEXT NOT NULL,
   116|        time TEXT,
   117|        agenda TEXT,
   118|        created_at TIMESTAMP DEFAULT NOW()
   119|      )
   120|    `],
   121|    [`chat_messages`, `
   122|      CREATE TABLE IF NOT EXISTS chat_messages (
   123|        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   124|        company_id UUID NOT NULL REFERENCES companies(id),
   125|        user_id UUID REFERENCES users(id),
   126|        role TEXT NOT NULL,
   127|        content TEXT NOT NULL,
   128|        created_at TIMESTAMP DEFAULT NOW()
   129|      )
   130|    `],
   131|    [`journal_entries`, `
   132|      CREATE TABLE IF NOT EXISTS journal_entries (
   133|        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   134|        company_id UUID NOT NULL REFERENCES companies(id),
   135|        user_id UUID REFERENCES users(id),
   136|        content TEXT NOT NULL,
   137|        created_at TIMESTAMP DEFAULT NOW()
   138|      )
   139|    `],
   140|    [`audit_log`, `
   141|      CREATE TABLE IF NOT EXISTS audit_log (
   142|        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   143|        user_id TEXT,
   144|        user_email TEXT,
   145|        method TEXT NOT NULL,
   146|        path TEXT NOT NULL,
   147|        status_code TEXT NOT NULL,
   148|        resource_type TEXT,
   149|        resource_id TEXT,
   150|        user_agent TEXT,
   151|        ip TEXT,
   152|        message TEXT,
   153|        created_at TIMESTAMP DEFAULT NOW()
   154|      )
   155|    `],
   156|  ];
   157|
   158|  for (const [name, stmt] of tables) {
   159|    try {
   160|      await sql.unsafe(stmt);
   161|      console.log(`  [OK] ${name}`);
   162|    } catch (e: any) {
   163|      console.log(`  [SKIP] ${name}: ${e.message.split('\n')[0]}`);
   164|    }
   165|  }
   166|
   167|  // Add platform/external_id columns to agents if they exist without them
   168|  console.log("\nAdding columns to existing tables if needed...");
   169|  const columnAdditions = [
   170|    ['agents', 'platform', 'ALTER TABLE agents ADD COLUMN IF NOT EXISTS platform TEXT'],
   171|    ['agents', 'external_id', 'ALTER TABLE agents ADD COLUMN IF NOT EXISTS external_id TEXT'],
   172|    ['events', 'platform', 'ALTER TABLE events ADD COLUMN IF NOT EXISTS platform TEXT'],
   173|  ];
   174|
   175|  for (const [table, col, stmt] of columnAdditions) {
   176|    try {
   177|      await sql.unsafe(stmt);
   178|      console.log(`  [OK] ${table}.${col}`);
   179|    } catch (e: any) {
   180|      if (e.message.includes('already')) {
   181|        console.log(`  [SKIP] ${table}.${col}: already exists`);
   182|      } else {
   183|        console.log(`  [WARN] ${table}.${col}: ${e.message.split('\n')[0]}`);
   184|      }
   185|    }
   186|  }
   187|
   188|  console.log("\nAll tables ready!");
   189|
   190|  // Add indexes on foreign keys and common query columns
   191|  console.log("\nCreating indexes...");
   192|  const indexes = [
   193|    ['idx_agents_company_id', 'CREATE INDEX IF NOT EXISTS idx_agents_company_id ON agents(company_id)'],
   194|    ['idx_agents_platform', 'CREATE INDEX IF NOT EXISTS idx_agents_platform ON agents(company_id, platform)'],
   195|    ['idx_tasks_project_id', 'CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id)'],
   196|    ['idx_tasks_status', 'CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(project_id, status)'],
   197|    ['idx_events_company_id', 'CREATE INDEX IF NOT EXISTS idx_events_company_id ON events(company_id)'],
   198|    ['idx_events_created', 'CREATE INDEX IF NOT EXISTS idx_events_created ON events(company_id, created_at DESC)'],
   199|    ['idx_company_members_user', 'CREATE INDEX IF NOT EXISTS idx_company_members_user ON company_members(user_id)'],
   200|    ['idx_projects_company_id', 'CREATE INDEX IF NOT EXISTS idx_projects_company_id ON projects(company_id)'],
   201|    ['idx_connectors_company', 'CREATE INDEX IF NOT EXISTS idx_connectors_company ON connectors(company_id, platform)'],
   202|    ['idx_goals_company_id', 'CREATE INDEX IF NOT EXISTS idx_goals_company_id ON goals(company_id)'],
   203|  ];
   204|
   205|  for (const [name, stmt] of indexes) {
   206|    try {
   207|      await sql.unsafe(stmt);
   208|      console.log(`  [OK] ${name}`);
   209|    } catch (e: any) {
   210|      console.log(`  [SKIP] ${name}: ${e.message.split('\n')[0]}`);
   211|    }
   212|  console.log("\nSeeding skill templates...");
   213|  const seedSkills = [
   214|    { name: 'Code Generation', category: 'development', icon: '💻',
   215|      description: 'Write, review, and debug code',
   216|      instructions: 'You are a skilled software engineer. Write clean, tested, documented code. Follow best practices and design patterns. Prefer simplicity over cleverness. Add comments explaining non-obvious logic.' },
   217|    { name: 'Research & Analysis', category: 'analysis', icon: '🔍',
   218|      description: 'Market research and data analysis',
   219|      instructions: 'You are a research analyst. Gather data from reliable sources. Synthesize findings into clear, actionable insights. Always cite your sources. Flag uncertainty when data is incomplete.' },
   220|  // Seed skill templates if none exist
   221|  await db.select({ count: sql`count(*)` }).from(skills).then(rows => {
   222|    const checkSkills = rows;
   223|    return checkSkills;
   224|  }).then(async (checkSkills) => {
   225|    if (parseInt(checkSkills[0].count) > 0) return;
   226|    console.log("\nSeeding skill templates...");
   227|    const seedSkills = [
   228|      { id: "strategic_planning", name: "Strategic Planning", category: "leadership", icon: "📊",
   229|        description: "Business strategy and planning",
   230|        instructions: "You are a strategic advisor. Think long-term. Identify risks and opportunities. Provide data-driven recommendations. Present clear, actionable plans with timelines." },
   231|      { id: "project_management", name: "Project Management", category: "operations", icon: "📋",
   232|        description: "Coordination and delivery",
   233|        instructions: "You are a project manager. Break work into actionable tasks. Track dependencies. Communicate blockers early. Optimize for team velocity." },
   234|      { id: "code_generation", name: "Code Generation", category: "development", icon: "💻",
   235|        description: "Write, review, and debug code",
   236|        instructions: "You are a skilled software developer. Write clean, tested, documented code. Follow best practices and design patterns. Prefer simplicity over cleverness." },
   237|      { id: "research_analysis", name: "Research & Analysis", category: "analysis", icon: "🔍",
   238|        description: "Market research and data analysis",
   239|        instructions: "You are a research analyst. Gather data from reliable sources. Synthesize findings into clear, actionable insights. Always cite sources. Flag uncertainty." },
   240|      { id: "content_writing", name: "Content Writing", category: "content", icon: "📝",
   241|        description: "Blog posts, documentation, and copy",
   242|        instructions: "You are a senior content writer. Write clear, engaging, audience-appropriate content. Use active voice. Edit ruthlessly. Match the brand voice and tone." },
   243|    ];
   244|
   245|    for (const s of seedSkills) {
   246|      try {
   247|        await sql`INSERT INTO skills (id, name, category, description, instructions, icon) VALUES (${crypto.randomUUID()}, ${s.name}, ${s.category}, ${s.description}, ${s.instructions}, ${s.icon})`;
   248|        console.log(`  [SEED] ${s.name}`);
   249|      } catch (e: any) {
   250|        console.log(`  [SKIP seed] ${s.name}: ${e.message.split('\n')[0]}`);
   251|      }
   252|    }
   253|  });
   254|
   255|  await sql.end();
   256|}
   257|
   258|main().catch(console.error);
   259|