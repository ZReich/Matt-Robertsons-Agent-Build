// Clears a stuck msgraph-email advisory lock held on a pgbouncer backend
// by terminating backends that hold the matching pg_locks entry.
import pg from "pg";

const lockKey = "msgraph-email";
const connStr = process.env.DIRECT_URL;
if (!connStr) {
  console.error("DIRECT_URL not set");
  process.exit(1);
}

const client = new pg.Client({ connectionString: connStr });
await client.connect();

const hash = await client.query(`SELECT hashtext($1)::bigint AS h`, [lockKey]);
const hashValue = hash.rows[0].h;

const locks = await client.query(
  `SELECT pid, granted FROM pg_locks WHERE locktype='advisory' AND objid = ($1::bigint & 2147483647)`,
  [hashValue],
);
console.log("pg_locks entries for msgraph-email:", locks.rows);

if (locks.rows.length === 0) {
  console.log("Lock is not held. Nothing to clear.");
} else {
  for (const row of locks.rows) {
    console.log(`terminating pid ${row.pid}...`);
    try {
      const res = await client.query(`SELECT pg_terminate_backend($1)`, [row.pid]);
      console.log(`  ->`, res.rows[0]);
    } catch (e) {
      console.log(`  error:`, e.message);
    }
  }
}

await client.end();
