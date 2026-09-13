import { createRequire } from "node:module";
import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiRequire = createRequire(
  path.join(root, "artifacts/api-server/package.json"),
);
const { build } = apiRequire("esbuild");
const esbuildPluginPino = apiRequire("esbuild-plugin-pino");
const outputDir = path.join(root, ".vercel-api-build");
const functionDir = path.join(root, "api");

globalThis.require = apiRequire;

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

await build({
  entryPoints: [path.join(root, "artifacts/api-server/src/app.ts")],
  outdir: outputDir,
  entryNames: "[name]",
  platform: "node",
  bundle: true,
  format: "esm",
  sourcemap: false,
  logLevel: "info",
  external: [
    "*.node",
    "sharp",
    "better-sqlite3",
    "sqlite3",
    "canvas",
    "bcrypt",
    "argon2",
    "fsevents",
    "re2",
    "farmhash",
    "xxhash-addon",
    "bufferutil",
    "utf-8-validate",
    "ssh2",
    "cpu-features",
    "dtrace-provider",
    "isolated-vm",
    "lightningcss",
    "pg-native",
    "oracledb",
    "mongodb-client-encryption",
    "nodemailer",
    "handlebars",
    "knex",
    "typeorm",
    "protobufjs",
    "onnxruntime-node",
    "@tensorflow/*",
    "@swc/*",
    "pino-pretty",
  ],
  plugins: [esbuildPluginPino({ transports: ["pino-pretty"] })],
});

await rm(functionDir, { recursive: true, force: true });
await mkdir(functionDir, { recursive: true });
await cp(outputDir, functionDir, { recursive: true });
await cp(path.join(functionDir, "app.js"), path.join(functionDir, "index.js"));
await rm(path.join(functionDir, "app.js"));
await rm(outputDir, { recursive: true, force: true });