import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const envPath = path.join(rootDir, ".env");
const firebaseConfigFields = {
  apiKey: "FIREBASE_API_KEY",
  authDomain: "FIREBASE_AUTH_DOMAIN",
  projectId: "FIREBASE_PROJECT_ID",
  storageBucket: "FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "FIREBASE_MESSAGING_SENDER_ID",
  appId: "FIREBASE_APP_ID",
  measurementId: "FIREBASE_MEASUREMENT_ID",
  databaseURL: "FIREBASE_DATABASE_URL",
};

function parseEnv(source) {
  const env = {};

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

async function loadEnv() {
  try {
    return parseEnv(await readFile(envPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

function buildFirebaseConfig(env) {
  return Object.fromEntries(
    Object.entries(firebaseConfigFields).map(([configKey, envKey]) => [
      configKey,
      env[envKey] || "",
    ]),
  );
}

async function buildUserscript(inputName, outputName, firebaseConfig) {
  const inputPath = path.join(rootDir, "src", inputName);
  const outputPath = path.join(rootDir, outputName);
  const source = await readFile(inputPath, "utf8");
  const output = source.replace(
    "__DEFAULT_FIREBASE_CONFIG__",
    JSON.stringify(firebaseConfig, null, 8),
  );

  if (output === source) {
    throw new Error(`Build token not found in ${inputName}`);
  }

  await writeFile(outputPath, output, "utf8");
  console.log(`Built ${outputName}`);
}

const env = await loadEnv();
const firebaseConfig = buildFirebaseConfig(env);

await buildUserscript("host.user.js", "host.user.js", firebaseConfig);
await buildUserscript("guest.user.js", "guest.user.js", firebaseConfig);
