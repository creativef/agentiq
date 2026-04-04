     1|     1|import postgres from 'postgres';
     2|     2|
     3|     3|async function main() {
     4|     4|  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:***@localhost:5432/missioncontrol';
     5|     5|  const sql = postgres(connectionString, { max: 1 });
     6|     6|
     7|     7|  console.log("Creating tables...");
     8|     8|
     9|     9|  const tables = [
    10|    10|    [`users`, `
    11|    11|      CREATE TABLE IF NOT EXISTS users (
    12|    12|        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    13|    13|        email TEXT NOT NULL UNIQUE,
    14|    14|        password_hash TEXT NOT NULL,
    15|    15|        role TEXT NOT NULL DEFAULT 'OWNER',
    16|    16|        created_at TIMESTAMP DEFAULT NOW()
    17|    17|      )
    18|    18|    `],
    19|    19|    [`companies`, `
    20|    20|      CREATE TABLE IF NOT EXISTS companies (
    21|    21|        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    22|    22|        name TEXT NOT NULL,
    23|    23|        goal TEXT NOT NULL DEFAULT 'Default goal',
    24|    24|        created_at TIMESTAMP DEFAULT NOW()
    25|    25|      )
    26|    26|    `],
    27|    27|    [`company_members`, `
    28|    28|      CREATE TABLE IF NOT EXISTS company_members (
    29|    29|        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    30|    30|        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    31|    31|        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    32|    32|        role TEXT NOT NULL DEFAULT 'MEMBER',
    33|    33|        created_at TIMESTAMP DEFAULT NOW(),
    34|    34|        UNIQUE(company_id, user_id)
    35|    35|      )
    36|    36|    `],
    37|    37|    [`projects`, `
    38|    38|      CREATE TABLE IF NOT EXISTS projects (
    39|    39|        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    40|    40|        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    41|    41|        name TEXT NOT NULL,
    42|    42|        created_at TIMESTAMP DEFAULT NOW()
    43|    43|      )
    44|    44|    `],
    45|    45|    [`agents`, `
    46|    46|      CREATE TABLE IF NOT EXISTS agents (
    47|    47|        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    48|    48|        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    49|    49|        project_id UUID REFERENCES projects(id),
    50|    50|        name TEXT NOT NULL,
    51|    51|        role TEXT NOT NULL DEFAULT 'AGENT',
    52|    52|        status TEXT NOT NULL DEFAULT 'idle',
    53|    53|        last_heartbeat TIMESTAMP,
    54|    54|        cost_monthly INTEGER DEFAULT 0,
    55|    55|        budget_limit INTEGER,
    56|    56|        reports_to UUID REFERENCES agents(id),
    57|    57|        created_at TIMESTAMP DEFAULT NOW(),
    58|    58|        heartbeat_interval INTEGER DEFAULT 3600,
    59|    59|        platform TEXT,
    60|    60|        external_id TEXT
    61|    61|      )
    62|    62|    `],
    63|    63|    [`tasks`, `
    64|    64|      CREATE TABLE IF NOT EXISTS tasks (
    65|    65|        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    66|    66|        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    67|    67|        agent_id UUID REFERENCES agents(id),
    68|    68|        title TEXT NOT NULL,
    69|    69|        description TEXT,
    70|    70|        status TEXT NOT NULL DEFAULT 'todo',
    71|    71|        priority TEXT DEFAULT 'medium',
    72|    72|        created_at TIMESTAMP DEFAULT NOW(),
    73|    73|        due_date TIMESTAMP
    74|    74|      )
    75|    75|    `],
    76|    76|    [`events`, `
    77|    77|      CREATE TABLE IF NOT EXISTS events (
    78|    78|        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    79|    79|        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    80|    80|        project_id UUID REFERENCES projects(id),
    81|    81|        type TEXT NOT NULL,
    82|    82|        actor TEXT,
    83|    83|        description TEXT,
    84|    84|        metadata JSONB,
    85|    85|        created_at TIMESTAMP DEFAULT NOW()
    86|    86|      )
    87|    87|    `],
    88|    88|    [`connectors`, `
    89|    89|      CREATE TABLE IF NOT EXISTS connectors (
    90|    90|        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    91|    91|        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    92|    92|        platform TEXT NOT NULL,
    93|    93|        config JSONB,
    94|    94|        status TEXT NOT NULL DEFAULT 'active',
    95|    95|        created_at TIMESTAMP DEFAULT NOW()
    96|    96|      )
    97|    97|    `],
    98|    98|    [`goals`, `
    99|    99|      CREATE TABLE IF NOT EXISTS goals (
   100|   100|        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   101|   101|        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
   102|   102|        title TEXT NOT NULL,
   103|   103|        progress INTEGER DEFAULT 0,
   104|   104|        parent_id UUID REFERENCES goals(id),
   105|   105|        created_at TIMESTAMP DEFAULT NOW()
   106|   106|      )
   107|   107|    `],
   108|   108|    [`journal_entries`, `
   109|   109|      CREATE TABLE IF NOT EXISTS journal_entries (
   110|   110|        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   111|   111|        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
   112|   112|        user_id UUID REFERENCES users(id),
   113|   113|        content TEXT NOT NULL,
   114|   114|        created_at TIMESTAMP DEFAULT NOW()
   115|   115|      )
   116|   116|    `],
   117|   117|    [`audit_log`, `
   118|   118|      CREATE TABLE IF NOT EXISTS audit_log (
   119|   119|        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   120|   120|        user_id UUID REFERENCES users(id),
   121|   121|        email TEXT,
   122|   122|        company_id UUID REFERENCES companies(id),
   123|   123|        project_id UUID REFERENCES projects(id),
   124|   124|        method TEXT,
   125|   125|        path TEXT,
   126|   126|        status_code INTEGER,
   127|   127|        ip TEXT,
   128|   128|        user_agent TEXT,
   129|   129|        meta JSONB,
   130|   130|        created_at TIMESTAMP DEFAULT NOW()
   131|   131|      )
   132|   132|    `],
   133|   133|    [`calendar_events`, `
   134|   134|      CREATE TABLE IF NOT EXISTS calendar_events (
   135|   135|        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   136|   136|        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
   137|   137|        project_id UUID REFERENCES projects(id),
   138|   138|        agent_id UUID REFERENCES agents(id),
   139|   139|        title TEXT NOT NULL,
   140|   140|        description TEXT,
   141|   141|        start_time TIMESTAMP NOT NULL,
   142|   142|        end_time TIMESTAMP,
   143|   143|        all_day BOOLEAN DEFAULT false,
   144|   144|        type TEXT DEFAULT 'meeting',
   145|   145|        created_at TIMESTAMP DEFAULT NOW()
   146|   146|      )
   147|   147|    `],
   148|   148|    [`skills`, `
   149|   149|      CREATE TABLE IF NOT EXISTS skills (
   150|   150|        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   151|   151|        name TEXT NOT NULL,
   152|   152|        category TEXT NOT NULL,
   153|   153|        description TEXT,
   154|   154|        instructions TEXT NOT NULL,
   155|   155|        icon TEXT,
   156|   156|        created_at TIMESTAMP DEFAULT NOW()
   157|   157|      )
   158|   158|    `],
   159|   159|    [`agent_skills`, `
   160|   160|      CREATE TABLE IF NOT EXISTS agent_skills (
   161|   161|        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   162|   162|        agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
   163|   163|        skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
   164|   164|        custom_instructions TEXT,
   165|   165|        created_at TIMESTAMP DEFAULT NOW(),
   166|   166|        UNIQUE(agent_id, skill_id)
   167|   167|      )
   168|   168|    `],
   169|   169|  ];
   170|   170|
   171|   171|  for (const [name, stmt] of tables) {
   172|   172|    try {
   173|   173|      await sql.unsafe(stmt);
   174|   174|      console.log(`  [OK] ${name}`);
   175|   175|    } catch (e: any) {
   176|   176|      console.log(`  [SKIP] ${name}: ${e.message.split('\n')[0]}`);
   177|   177|    }
   178|   178|  }
   179|   179|
   180|   180|  // Add the reports_to column if table already exists
   181|   181|  try {
   182|   182|    await sql.unsafe(`ALTER TABLE agents ADD COLUMN IF NOT EXISTS reports_to UUID REFERENCES agents(id)`);
   183|   183|    console.log("  [OK] agents.reports_to");
   184|   184|  } catch (e: any) {
   185|   185|    console.log(`  [SKIP] reports_to column: ${e.message.split('\n')[0]}`);
   186|   186|  }
   187|   187|
   188|   188|  console.log("\nAll tables ready!");
   189|   189|
   190|   190|  // Add indexes on foreign keys and common query columns
   191|   191|  console.log("\nCreating indexes...");
   192|   192|  const indexes = [
   193|   193|    ['idx_agents_company_id', 'CREATE INDEX IF NOT EXISTS idx_agents_company_id ON agents(company_id)'],
   194|   194|    ['idx_agents_platform', 'CREATE INDEX IF NOT EXISTS idx_agents_platform ON agents(company_id, platform)'],
   195|   195|    ['idx_tasks_project_id', 'CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id)'],
   196|   196|    ['idx_tasks_status', 'CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(project_id, status)'],
   197|   197|    ['idx_events_company_id', 'CREATE INDEX IF NOT EXISTS idx_events_company_id ON events(company_id)'],
   198|   198|    ['idx_events_created', 'CREATE INDEX IF NOT EXISTS idx_events_created ON events(company_id, created_at DESC)'],
   199|   199|    ['idx_company_members_user', 'CREATE INDEX IF NOT EXISTS idx_company_members_user ON company_members(user_id)'],
   200|   200|    ['idx_projects_company_id', 'CREATE INDEX IF NOT EXISTS idx_projects_company_id ON projects(company_id)'],
   201|   201|    ['idx_connectors_company', 'CREATE INDEX IF NOT EXISTS idx_connectors_company ON connectors(company_id, platform)'],
   202|   202|    ['idx_goals_company_id', 'CREATE INDEX IF NOT EXISTS idx_goals_company_id ON goals(company_id)'],
   203|   203|    ['idx_agent_skills_agent_id', 'CREATE INDEX IF NOT EXISTS idx_agent_skills_agent_id ON agent_skills(agent_id)'],
   204|   204|    ['idx_agent_skills_skill_id', 'CREATE INDEX IF NOT EXISTS idx_agent_skills_skill_id ON agent_skills(skill_id)'],
   205|   205|    ['idx_skills_category', 'CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category)'],
   206|   206|    ['idx_agents_reports_to', 'CREATE INDEX IF NOT EXISTS idx_agents_reports_to ON agents(reports_to)'],
   207|   207|    ['idx_journal_company_id', 'CREATE INDEX IF NOT EXISTS idx_journal_company_id ON journal_entries(company_id)'],
   208|   208|  ];
   209|   209|
   210|   210|  for (const [name, stmt] of indexes) {
   211|   211|    try {
   212|   212|      await sql.unsafe(stmt);
   213|   213|      console.log(`  [OK] ${name}`);
   214|   214|    } catch (e: any) {
   215|   215|      console.log(`  [SKIP] ${name}: ${e.message.split('\n')[0]}`);
   216|   216|    }
   217|   217|  }
   218|   218|
   219|   219|  // Seed skill templates if none exist
   220|   220|  const skillCount = await sql.unsafe("SELECT COUNT(*) as cnt FROM skills");
   221|   221|  if (parseInt(skillCount[0].cnt) === 0) {
   222|   222|    console.log("\nSeeding skill templates...");
   223|   223|    const seedSkills = [
   224|   224|      { name: "Strategic Planning", category: "leadership", icon: "📊",
   225|   225|        description: "Business strategy and planning",
   226|   226|        instructions: "You are a strategic advisor. Think long-term. Identify risks and opportunities. Provide data-driven recommendations. Present clear, actionable plans with timelines." },
   227|   227|      { name: "Project Management", category: "operations", icon: "📋",
   228|   228|        description: "Coordination and delivery",
   229|   229|        instructions: "You are a project manager. Break work into actionable tasks. Track dependencies. Communicate blockers early. Optimize for team velocity." },
   230|   230|      { name: "Code Generation", category: "development", icon: "💻",
   231|   231|        description: "Write, review, and debug code",
   232|   232|        instructions: "You are a skilled developer. Write clean, tested, documented code. Follow best practices. Prefer simplicity over cleverness." },
   233|   233|      { name: "Research & Analysis", category: "analysis", icon: "🔍",
   234|   234|        description: "Market research and data analysis",
   235|   235|        instructions: "You are a research analyst. Gather data from reliable sources. Synthesize findings into clear, actionable insights. Always cite sources." },
   236|   236|      { name: "Content Writing", category: "content", icon: "📝",
   237|   237|        description: "Blog posts, documentation, and copy",
   238|   238|        instructions: "You are a senior content writer. Write clear, engaging, audience-appropriate content. Use active voice. Edit ruthlessly." },
   239|   239|    ];
   240|   240|
   241|   241|    for (const s of seedSkills) {
   242|   242|      try {
   243|   243|        await sql`INSERT INTO skills (id, name, category, description, instructions, icon) VALUES (${crypto.randomUUID()}, ${s.name}, ${s.category}, ${s.description}, ${s.instructions}, ${s.icon})`;
   244|   244|        console.log(`  [SEED] ${s.name}`);
   245|   245|      } catch (e: any) {
   246|   246|        console.log(`  [SKIP seed] ${s.name}: ${e.message.split('\n')[0]}`);
   247|   247|      }
   248|   248|    }
   249|   249|  } else {
   250|   250|    console.log("\nSkills already seeded, skipping.");
   251|   251|  }
   252|   252|
   253|   253|
   254|   254|  // Task Execution Engine Columns
   255|   255|  console.log("\nAdding task execution columns (safe for existing tables)...");
   256|   256|  const taskColumns = [
   257|   257|    ['tasks', 'exec_status', "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS exec_status TEXT DEFAULT 'idle'"],
   258|   258|    ['tasks', 'scheduled_at', "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP"],
   259|   259|    ['tasks', 'approver_role', "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS approver_role TEXT"],
   260|   260|    ['tasks', 'approval_status', "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS approval_status TEXT"],
   261|   261|    ['tasks', 'result', "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS result TEXT"],
   262|   262|  ];
   263|   263|
   264|   264|  for (const [tbl, col, stmt] of taskColumns) {
   265|   265|    try {
   266|   266|      await sql.unsafe(stmt);
   267|   267|      console.log(`  [OK] ${tbl}.${col}`);
   268|   268|    } catch (e: any) {
   269|   269|      console.log(`  [SKIP] ${tbl}.${col}: ${e.message.split('\n')[0]}`);
   270|   270|    }
   271|   271|  }
   272|   272|
   273|   273|  
   274|   274|  // Audit Log Table
   275|   275|  console.log("\nCreating audit_log table...");
   276|   276|  await sql.unsafe(`
   277|   277|    CREATE TABLE IF NOT EXISTS audit_log (
   278|   278|      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   279|   279|      user_id UUID REFERENCES users(id),
   280|   280|      email TEXT,
   281|   281|      method TEXT NOT NULL,
   282|   282|      path TEXT NOT NULL,
   283|   283|      status_code TEXT NOT NULL,
   284|   284|      ip TEXT,
   285|   285|      user_agent TEXT,
   286|   286|      meta TEXT,
   287|   287|      created_at TIMESTAMP DEFAULT NOW()
   288|   288|    )
   289|   289|  `);
   290|   290|  console.log("  [OK] audit_log");
   291|   291|
   292|   292|  // Agent Activity Log Table
   293|   293|  console.log("\nCreating agent_logs table...");
   294|   294|  await sql.unsafe(`
   295|   295|    CREATE TABLE IF NOT EXISTS agent_logs (
   296|   296|      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   297|   297|      agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
   298|   298|      task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
   299|   299|      level TEXT DEFAULT 'info',
   300|   300|      message TEXT NOT NULL,
   301|   301|      created_at TIMESTAMP DEFAULT NOW()
   302|   302|    )
   303|   303|  `);
   304|   304|  console.log("  [OK] agent_logs");
   305|   305|
   306|   306|  // Chat Messages Table
   307|   307|  console.log("\nCreating chat_messages table...");
   308|   308|  await sql.unsafe(`
   309|   309|    CREATE TABLE IF NOT EXISTS chat_messages (
   310|   310|      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   311|   311|      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
   312|   312|      agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
   313|   313|      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
   314|   314|      content TEXT NOT NULL,
   315|   315|      role TEXT DEFAULT 'user',
   316|   316|      created_at TIMESTAMP DEFAULT NOW()
   317|   317|    )
   318|   318|  `);
   319|   319|  console.log("  [OK] chat_messages");
   320|   320|
   321|   321|  // Files Table
   322|   322|  console.log("\nCreating files table...");
   323|   323|  await sql.unsafe(`
   324|   324|    CREATE TABLE IF NOT EXISTS files (
   325|   325|      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   326|   326|      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
   327|   327|      file_name TEXT NOT NULL,
   328|   328|      file_type TEXT,
   329|   329|      file_size INT,
   330|   330|      file_path TEXT NOT NULL,
   331|   331|      created_at TIMESTAMP DEFAULT NOW()
   332|   332|    )
   333|   333|  `);
   334|   334|  console.log("  [OK] files");
   335|   335|
   336|   336|
   337|  // Company Briefs Table
   338|  console.log("\nCreating company_briefs table...");
   339|  await sql.unsafe(`
   340|    CREATE TABLE IF NOT EXISTS company_briefs (
   341|      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   342|      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
   343|      vision TEXT NOT NULL,
   344|      market_context TEXT,
   345|      constraints TEXT,
   346|      priorities TEXT,
   347|      reporting_cadence TEXT DEFAULT 'daily',
   348|      created_by UUID NOT NULL,
   349|      status TEXT DEFAULT 'active',
   350|      created_at TIMESTAMP DEFAULT NOW(),
   351|      updated_at TIMESTAMP DEFAULT NOW()
   352|    )
   353|  `);
   354|  console.log("  [OK] company_briefs");
   355|
   356|  // CEO Decisions Table
   357|  console.log("\nCreating ceo_decisions table...");
   358|  await sql.unsafe(`
   359|    CREATE TABLE IF NOT EXISTS ceo_decisions (
   360|      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   361|      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
   362|      agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
   363|      decision TEXT NOT NULL,
   364|      reasoning TEXT,
   365|      action TEXT NOT NULL,
   366|      target_id UUID,
   367|      status TEXT DEFAULT 'pending',
   368|      created_at TIMESTAMP DEFAULT NOW()
   369|    )
   370|  `);
   371|  console.log("  [OK] ceo_decisions");
   372|
   373|  // Agent Performance Table
   374|  console.log("\nCreating agent_performance table...");
   375|  await sql.unsafe(`
   376|    CREATE TABLE IF NOT EXISTS agent_performance (
   377|      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   378|      agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
   379|      task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
   380|      score INT,
   381|      outcome TEXT,
   382|      notes TEXT,
   383|      flagged_by_ceo BOOLEAN DEFAULT false,
   384|      created_at TIMESTAMP DEFAULT NOW()
   385|    )
   386|  `);
   387|  console.log("  [OK] agent_performance");
   388|
   389|
  // Skill Bundles Table
  console.log("\nCreating skill_bundles table...");
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS skill_bundles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      description TEXT,
      bundle_skills JSONB NOT NULL,
      icon TEXT DEFAULT '📦',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log("  [OK] skill_bundles");

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
   390|   337|}
   391|   338|
   392|   339|main().catch(console.error);
   393|   340|