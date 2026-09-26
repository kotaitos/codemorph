import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer, type ServerResponse } from "node:http";
import { dirname, extname, join, resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const dbPath = process.env.CODEMORPH_DB;
const port = Number(process.env.CODEMORPH_PORT ?? "4173");
const publicDir = join(dirname(fileURLToPath(import.meta.url)), "public");

type Row = Record<string, unknown>;

function openDatabase(): DatabaseSync | null {
  if (!dbPath || !existsSync(dbPath)) return null;
  try {
    const db = new DatabaseSync(dbPath, { readOnly: true });
    const version = db
      .prepare("SELECT value FROM metadata WHERE key = 'schema_version'")
      .get() as { value: string } | undefined;
    if (version?.value !== "2")
      throw new Error("unsupported database schema; run analyze again");
    return db;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}

function query(
  db: DatabaseSync | null,
  sql: string,
  ...parameters: (string | number)[]
): Row[] {
  return db ? (db.prepare(sql).all(...parameters) as Row[]) : [];
}

async function staticFile(
  pathname: string,
  response: ServerResponse,
): Promise<void> {
  let relative: string;
  try {
    relative = decodeURIComponent(pathname).replace(/^\/+/, "");
  } catch {
    response.writeHead(400).end();
    return;
  }
  const target = resolve(publicDir, relative || "index.html");
  if (target !== publicDir && !target.startsWith(publicDir + sep)) {
    response.writeHead(403).end();
    return;
  }
  let file = target;
  try {
    if (!(await stat(file)).isFile()) throw new Error("not a file");
  } catch {
    file = join(publicDir, "index.html");
  }
  const types: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
  };
  try {
    response.writeHead(200, {
      "content-type": types[extname(file)] ?? "application/octet-stream",
      "x-content-type-options": "nosniff",
    });
    response.end(await readFile(file));
  } catch {
    response.writeHead(404).end();
  }
}

if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("invalid port");

createServer(async (request, response) => {
  if (request.method !== "GET") {
    json(response, 405, { error: "method not allowed" });
    return;
  }
  const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
  if (!pathname.startsWith("/api/")) {
    await staticFile(pathname, response);
    return;
  }
  try {
    const db = openDatabase();
    try {
      if (pathname === "/api/summary") {
        const summary = db
          ? (db
              .prepare(
                "SELECT (SELECT COUNT(*) FROM documents) AS documents, (SELECT COUNT(*) FROM tokens) AS tokens, (SELECT COALESCE(SUM(frequency), 0) FROM tokens) AS occurrences",
              )
              .get() as Row)
          : { documents: 0, tokens: 0, occurrences: 0 };
        json(response, 200, {
          ...summary,
          analyzed: db !== null,
          sources: query(
            db,
            "SELECT kind, COUNT(*) AS count FROM documents GROUP BY kind ORDER BY count DESC, kind",
          ),
        });
      } else if (pathname === "/api/map") {
        json(response, 200, {
          tokens: query(
            db,
            "SELECT id, surface, language, normal, frequency, tfidf, x, y, marked FROM tokens ORDER BY id",
          ),
        });
      } else if (/^\/api\/tokens\/\d+$/.test(pathname)) {
        const id = Number(pathname.split("/").at(-1));
        const token = query(db, "SELECT * FROM tokens WHERE id = ?", id)[0];
        if (!token) {
          json(response, 404, { error: "token not found" });
        } else {
          json(response, 200, {
            token,
            similar: query(
              db,
              "SELECT t.id, t.surface, t.language, s.score FROM similarities s JOIN tokens t ON t.id = s.other_id WHERE s.token_id = ? ORDER BY s.score DESC",
              id,
            ),
            variants: query(
              db,
              "SELECT id, surface, language FROM tokens WHERE normal = ? AND language = ? AND id != ? ORDER BY frequency DESC",
              token.normal as string,
              token.language as string,
              id,
            ),
            cooccurring: query(
              db,
              "SELECT t.id, t.surface, t.language, c.count FROM cooccurrences c JOIN tokens t ON t.id = c.other_id WHERE c.token_id = ? ORDER BY c.count DESC LIMIT 30",
              id,
            ),
            occurrences: query(
              db,
              "SELECT o.rowid AS id, d.path, d.kind, o.line, o.snippet FROM occurrences o JOIN documents d ON d.id = o.document_id WHERE o.token_id = ? ORDER BY d.path, o.line LIMIT 100",
              id,
            ),
          });
        }
      } else {
        json(response, 404, { error: "not found" });
      }
    } finally {
      db?.close();
    }
  } catch (error) {
    console.error(error);
    json(response, 500, { error: (error as Error).message });
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Word Map: http://127.0.0.1:${port}`);
});
