import { spawn, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const webRoot = resolve(scriptDir, "..");
const repositoryRoot = resolve(webRoot, "..", "..");
const intelligenceRoot = resolve(repositoryRoot, "services", "intelligence");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const useNpmShell = process.platform === "win32";

function run(command, args, cwd, env = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env: { ...process.env, ...env },
    encoding: "utf8",
    shell: useNpmShell && (command === npmCommand || command === npxCommand),
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return {
    ok: !result.error && result.status === 0,
    detail: result.error?.message ?? `exit code ${result.status ?? "unknown"}`,
  };
}

function pythonCommand() {
  if (process.platform === "win32") {
    const launcher = spawnSync("py", ["-3", "--version"], { stdio: "ignore" });
    if (launcher.status === 0) return { command: "py", prefix: ["-3"] };
  }
  for (const command of ["python3", "python"]) {
    if (spawnSync(command, ["--version"], { stdio: "ignore" }).status === 0) {
      return { command, prefix: [] };
    }
  }
  return null;
}

function venvPython() {
  return process.platform === "win32"
    ? resolve(intelligenceRoot, ".venv", "Scripts", "python.exe")
    : resolve(intelligenceRoot, ".venv", "bin", "python");
}

function ensureVenv(base) {
  const python = venvPython();
  if (spawnSync(python, ["--version"], { stdio: "ignore" }).status !== 0) {
    const created = run(base.command, [...base.prefix, "-m", "venv", ".venv"], intelligenceRoot);
    if (!created.ok) return { ok: false, detail: "Não foi possível criar o .venv do Intelligence Service." };
  }
  const dependencies = spawnSync(python, ["-c", "import pytest, requests, fastapi, uvicorn"], { stdio: "ignore" });
  if (dependencies.status !== 0) {
    const installed = run(python, ["-m", "pip", "install", "-r", "requirements.txt"], intelligenceRoot);
    if (!installed.ok) return { ok: false, detail: "Não foi possível instalar requirements.txt do Intelligence Service." };
  }
  return { ok: true, python };
}

function startService(name, command, args, cwd, env) {
  console.log(`\n=== Iniciando ${name} ===`);
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    shell: process.platform === "win32" && command === npmCommand,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => process.stdout.write(`[${name}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${name}] ${chunk}`));
  return child;
}

async function waitFor(url, name, timeoutMs, child) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (child.exitCode !== null) throw new Error(`${name} encerrou antes de responder (exit code ${child.exitCode}).`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // still starting
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw new Error(`${name} não respondeu em ${timeoutMs} ms: ${url}`);
}

function stopService(child, name) {
  if (!child || child.exitCode !== null || child.killed) return;
  console.log(`\n=== Encerrando ${name} ===`);
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
  } else {
    child.kill("SIGTERM");
  }
}

const results = [];
const record = (name, result) => results.push({ name, ...result });

record("Prisma · generate", run(npxCommand, ["prisma", "generate"], webRoot));
record("Prisma · migrations", run(npxCommand, ["prisma", "migrate", "deploy"], webRoot));
record("TypeScript", run(npxCommand, ["tsc", "--noEmit"], webRoot));
record("ESLint", run(npmCommand, ["run", "lint"], webRoot));
record("Auth · Vitest", run(npxCommand, ["vitest", "run", "tests/auth/auth.service.test.ts"], webRoot));

const basePython = pythonCommand();
let python = null;
if (!basePython) {
  record("pytest · Intelligence Service", { ok: false, detail: "Python 3 não foi encontrado." });
} else {
  const environment = ensureVenv(basePython);
  if (!environment.ok) record("pytest · Intelligence Service", environment);
  else {
    python = environment.python;
    record("pytest · Intelligence Service", run(python, ["-m", "pytest"], intelligenceRoot));
  }
}

record("Weather Cache · Vitest", run(npmCommand, ["run", "test:weather"], webRoot));

const webPort = Number(process.env.PEANUTEC_VALIDATION_WEB_PORT ?? 3100);
const intelligencePort = Number(process.env.PEANUTEC_VALIDATION_INTELLIGENCE_PORT ?? 8101);
const smokeEmail = process.env.PEANUTEC_SMOKE_EMAIL ?? "smoke@peanutec.local";
const smokePassword = process.env.PEANUTEC_SMOKE_PASSWORD ?? "SmokeValidation!123";

let intelligenceProcess = null;
let webProcess = null;
try {
  if (!python) {
    record("Smoke · serviços", { ok: false, detail: "Smoke não iniciado sem Python." });
    record("Smoke · fluxos principais", { ok: false, detail: "Smoke não executado sem Python." });
  } else {
    const serviceUrl = `http://127.0.0.1:${intelligencePort}`;
    const webUrl = `http://127.0.0.1:${webPort}`;
    intelligenceProcess = startService("intelligence", python, ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", String(intelligencePort)], intelligenceRoot, {});
    await waitFor(`${serviceUrl}/health`, "Intelligence Service", 30_000, intelligenceProcess);

    webProcess = startService(
      "web",
      npmCommand,
      ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(webPort)],
      webRoot,
      {
        PEANUTEC_INTELLIGENCE_URL: serviceUrl,
        PEANUTEC_WEATHER_MODE: "fixture",
        PEANUTEC_WEB_URL: webUrl,
        PEANUTEC_SMOKE_EMAIL: smokeEmail,
        PEANUTEC_SMOKE_PASSWORD: smokePassword,
      },
    );
    await waitFor(`${webUrl}/`, "Next.js", 90_000, webProcess);

    record(
      "Smoke · fluxos principais",
      run("node", ["scripts/smoke-main-flows.mjs"], webRoot, {
        PEANUTEC_WEB_URL: webUrl,
        PEANUTEC_INTELLIGENCE_URL: serviceUrl,
        PEANUTEC_WEATHER_MODE: "fixture",
        PEANUTEC_SMOKE_EMAIL: smokeEmail,
        PEANUTEC_SMOKE_PASSWORD: smokePassword,
      }),
    );
  }
} catch (error) {
  record("Smoke · serviços", { ok: false, detail: error instanceof Error ? error.message : String(error) });
  record("Smoke · fluxos principais", { ok: false, detail: "Smoke não executado após falha na inicialização." });
} finally {
  stopService(webProcess, "web");
  stopService(intelligenceProcess, "intelligence");
}

console.log("\n=== RELATÓRIO DE VALIDAÇÃO ===");
for (const result of results) console.log(`[${result.ok ? "PASS" : "FAIL"}] ${result.name} — ${result.detail}`);
const failures = results.filter((result) => !result.ok);
if (failures.length) {
  console.error(`\nValidação concluída com ${failures.length} etapa(s) em falha.`);
  process.exitCode = 1;
} else {
  console.log("\nValidação concluída com sucesso em todas as etapas.");
}
