import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(currentDir, "../..");
const envFilePath = resolve(projectRoot, ".env");

const loadDotEnv = () => {
  if (!existsSync(envFilePath)) return;

  const fileContent = readFileSync(envFilePath, "utf8");

  for (const rawLine of fileContent.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
};

loadDotEnv();

export const config = {
  port: Number(process.env.PORT || 3001),
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  supabaseUrl:
    process.env.SUPABASE_URL || "https://unvzbszdocfmcfpguvrc.supabase.co",
  supabaseAnonKey:
    process.env.SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVudnpic3pkb2NmbWNmcGd1dnJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0ODI0NjAsImV4cCI6MjA5MTA1ODQ2MH0.ECZr4s_KXYzXrIy_AmNPHayun8Ghouc3EftBDefZLn4",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || "",
};
