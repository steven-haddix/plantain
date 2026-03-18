import "dotenv/config";
import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config({ path: ".env.local", quiet: true });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not defined.");
}

const client = new Client({ connectionString });

async function main() {
  try {
    await client.connect();

    const { rows: nullEmailRows } = await client.query<{ count: string }>(`
      SELECT count(*)::text AS count
      FROM users
      WHERE email IS NULL OR btrim(email) = ''
    `);
    const { rows: duplicateRows } = await client.query<{
      count: string;
      normalized_email: string;
    }>(`
      SELECT lower(btrim(email)) AS normalized_email, count(*)::text AS count
      FROM users
      WHERE email IS NOT NULL AND btrim(email) <> ''
      GROUP BY lower(btrim(email))
      HAVING count(*) > 1
      ORDER BY count(*) DESC, normalized_email ASC
    `);
    const { rows: missingNameRows } = await client.query<{ count: string }>(`
      SELECT count(*)::text AS count
      FROM users
      WHERE name IS NULL OR btrim(name) = ''
    `);

    const nullEmailCount = Number.parseInt(nullEmailRows[0]?.count ?? "0", 10);
    const missingNameCount = Number.parseInt(
      missingNameRows[0]?.count ?? "0",
      10,
    );
    const duplicateEmails = duplicateRows.map((row) => ({
      email: row.normalized_email,
      count: Number.parseInt(row.count, 10),
    }));

    console.log(
      JSON.stringify(
        {
          nullEmailCount,
          duplicateEmailCount: duplicateEmails.length,
          duplicateEmails,
          missingNameCount,
        },
        null,
        2,
      ),
    );

    if (nullEmailCount > 0 || duplicateEmails.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await client.end();
  }
}

void main();
