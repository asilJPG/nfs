import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/** Loads .env.local / .env into process.env so scripts share the app's config. */
export function loadEnv(): void {
  for (const file of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const match = /^\s*([\w.-]+)\s*=\s*(.*)?\s*$/.exec(line);
      if (!match || line.trimStart().startsWith("#")) continue;
      const [, key, rawValue = ""] = match;
      if (process.env[key] !== undefined) continue;
      process.env[key] = rawValue.replace(/^(['"])(.*)\1$/, "$2");
    }
  }
}

export function arg(name: string, fallback?: string): string {
  const prefix = `--${name}=`;
  const hit = process.argv.find((value) => value.startsWith(prefix));
  if (hit) return hit.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0 && process.argv[index + 1] && !process.argv[index + 1].startsWith("--")) {
    return process.argv[index + 1];
  }
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required argument --${name}`);
}

export function masterKey(): Buffer {
  const hex = process.env.NFC_MASTER_KEY;
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("NFC_MASTER_KEY must be set to 32 bytes of hex in .env.local");
  }
  return Buffer.from(hex, "hex");
}
