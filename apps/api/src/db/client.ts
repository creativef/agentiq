import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/missioncontrol';

// For migrations
const pool = postgres(connectionString, { max: 10 });

export const db = drizzle(pool);

// For migrations - we'll run them manually for now
export const migrationPool = postgres(connectionString, { max: 1 });
