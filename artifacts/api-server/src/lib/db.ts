import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  console.error("Unexpected database pool error:", err);
});

export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<T>> {
  const start = Date.now();
  const result = await pool.query<T>(text, params);
  const duration = Date.now() - start;
  if (duration > 1000) {
    console.warn(`Slow query (${duration}ms): ${text.slice(0, 100)}`);
  }
  return result;
}

export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function auditLog(
  userId: string | null,
  action: string,
  resource: string,
  details?: Record<string, any>,
  ipAddress?: string
): Promise<void> {
  await query(
    `INSERT INTO audit_logs (user_id, action, resource, details, ip_address)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, action, resource, details ? JSON.stringify(details) : null, ipAddress || null]
  );
}

export default pool;
