import {
  spawn,
  spawnSync,
} from "node:child_process";
import {
  resolve,
} from "node:path";

const webRoot =
  resolve(
    new URL(
      ".",
      import.meta.url,
    ).pathname,
    "..",
  );

const repositoryRoot =
  resolve(
    webRoot,
    "..",
    "..",
  );

const intelligenceRoot =
  resolve(
    repositoryRoot,
    "services",
    "intelligence",
  );

const npmCommand =
  process.platform ===
  "win32"
    ? "npm.cmd"
    : "npm";

const npxCommand =
  process.platform ===
  "win32"
    ? "npx.cmd"
    : "npx";

function findPython() {
  if (
    process.platform ===
    "win32"
  ) {
    const launcher =
      spawnSync(
        "py",
        [
          "-3",
          "--version",
        ],
        {
          stdio: "ignore",
        },
      );

    if (
      launcher.status ===
      0
    ) {
      return {
        command: "py",
        prefix: ["-3"],
      };
    }
  }

  for (const command of [
    "python3",
    "python",
  ]) {
    const result =
      spawnSync(
        command,
        ["--version"],
        {
          stdio: "ignore",
        },
      );

    if (
      result.status ===
      0
    ) {
      return {
        command,
        prefix: [],
      };
    }
  }

  return null;
}

function runStep(
  name,
  command,
  args,
  cwd,
  env = {},
) {
  console.log(`\n=== ${name} ===`);

  const result =
    spawnSync(
      command,
      args,
      {
        cwd,
        env: {
          ...process.env,
          ...env,
        },
        encoding: "utf8",
        stdio: [
          "ignore",
          "pipe",
          "pipe",
        ],
      },
    );

  if (result.error) {
    console.error(
      result.error.message,
    );

    return {
      ok: false,
      detail:
        result.error.message,
    };
  }

  if (result.stdout) {
    process.stdout.write(
      result.stdout,
    );
  }

  if (result.stderr) {
    process.stderr.write(
      result.stderr,
    );
  }

  return {
    ok:
      result.status ===
      0,
    detail:
      `exit code ${result.status ?? "unknown"}`,
  };
}

function waitForHttp(
  url,
  name,
  timeoutMs,
) {
  const startedAt =
    Date.now();

  return new Promise(
    (resolvePromise, rejectPromise) => {
      const poll =
        async () => {
          try {
            const response =
              await fetch(
                url,
              );

            if (
              response.ok
            ) {
              resolvePromise();
              return;
            }
          } catch {
            // Processo ainda subindo.
          }

          if (
            Date.now() -
              startedAt >=
              timeoutMs
          ) {
            rejectPromise(
              new Error(
                `${name} não respondeu em ${timeoutMs} ms: ${url}`,
              ),
            );
            return;
          }

          setTimeout(
            poll,
            500,
          );
        };

      void poll();
    },
  );
}

function startService({
  name,
  command,
  args,
  cwd,
  env,
}) {
  console.log(
    `\n=== Iniciando ${name} ===`,
  );

  const child =
    spawn(
      command,
      args,
      {
        cwd,
        env: {
          ...process.env,
          ...env,
        },
        stdio: [
          "ignore",
          "pipe",
          "pipe",
        ],
      },
    );

  child.stdout.on(
    "data",
    (chunk) => {
      process.stdout.write(
        `[${name}] ${chunk}`,
      );
    },
  );

  child.stderr.on(
    "data",
    (chunk) => {
      process.stderr.write(
        `[${name}] ${chunk}`,
      );
    },
  );

  return child;
}

function stopService(
  child,
  name,
) {
  if (
    !child ||
    child.killed
  ) {
    return;
  }

  console.log(
    `\n=== Encerrando ${name} ===`,
  );

  if (
    process.platform ===
    "win32"
  ) {
    spawnSync(
      "taskkill",
      [
        "/pid",
        String(child.pid),
        "/t",
        "/f",
      ],
      {
        stdio: "ignore",
      },
    );
    return;
  }

  child.kill(
    "SIGTERM",
  );
}

const results = [];

const record = (
  name,
  result,
) => {
  results.push({
    name,
    ...result,
  });
};

record(
  "TypeScript",
  runStep(
    "TypeScript",
    npxCommand,
    [
      "tsc",
      "--noEmit",
    ],
    webRoot,
  ),
);

record(
  "ESLint",
  runStep(
    "ESLint",
    npmCommand,
    [
      "run",
      "lint",
    ],
    webRoot,
  ),
);

const python =
  findPython();

if (!python) {
  record(
    "pytest · Intelligence Service",
    {
      ok: false,
      detail:
        "Python 3 não foi encontrado no PATH/launcher.",
    },
  );
} else {
  record(
    "pytest · Intelligence Service",
    runStep(
      "pytest · Intelligence Service",
      python.command,
      [
        ...python.prefix,
        "-m",
        "pytest",
      ],
      intelligenceRoot,
    ),
  );
}

record(
  "Weather Cache · Vitest",
  runStep(
    "Weather Cache · Vitest",
    npmCommand,
    [
      "run",
      "test:weather",
    ],
    webRoot,
  ),
);

const webPort =
  Number(
    process.env.PEANUTEC_VALIDATION_WEB_PORT ??
      3100,
  );
const intelligencePort =
  Number(
    process.env.PEANUTEC_VALIDATION_INTELLIGENCE_PORT ??
      8101,
  );

let intelligenceProcess = null;
let webProcess = null;

try {
  const serviceUrl =
    `http://127.0.0.1:${intelligencePort}`;
  const webUrl =
    `http://127.0.0.1:${webPort}`;

  if (!python) {
    record(
      "Smoke · serviços",
      {
        ok: false,
        detail:
          "Smoke não iniciado porque o Python 3 é obrigatório para o Intelligence Service.",
      },
    );
  } else {
    intelligenceProcess =
      startService({
        name:
          "intelligence",
        command:
          python.command,
        args: [
          ...python.prefix,
          "-m",
          "uvicorn",
          "app.main:app",
          "--host",
          "127.0.0.1",
          "--port",
          String(
            intelligencePort,
          ),
        ],
        cwd:
          intelligenceRoot,
        env: {},
      });

    await waitForHttp(
      `${serviceUrl}/health`,
      "Intelligence Service",
      30_000,
    );

    webProcess =
      startService({
        name:
          "web",
        command:
          npmCommand,
        args: [
          "run",
          "dev",
          "--",
          "--hostname",
          "127.0.0.1",
          "--port",
          String(
            webPort,
          ),
        ],
        cwd:
          webRoot,
        env: {
          PEANUTEC_INTELLIGENCE_URL:
            serviceUrl,
          PEANUTEC_WEATHER_MODE:
            "fixture",
          NEXT_PUBLIC_DISABLE_AUTH:
            "true",
          PEANUTEC_WEB_URL:
            webUrl,
        },
      });

    await waitForHttp(
      `${webUrl}/`,
      "Next.js",
      90_000,
    );

    record(
      "Smoke · fluxos principais",
      runStep(
        "Smoke · fluxos principais",
        "node",
        [
          "scripts/smoke-main-flows.mjs",
        ],
        webRoot,
        {
          PEANUTEC_WEB_URL:
            webUrl,
          PEANUTEC_INTELLIGENCE_URL:
            serviceUrl,
          PEANUTEC_WEATHER_MODE:
            "fixture",
          NEXT_PUBLIC_DISABLE_AUTH:
            "true",
        },
      ),
    );
  }
} catch (error) {
  record(
    "Smoke · serviços",
    {
      ok: false,
      detail:
        error instanceof Error
          ? error.message
          : String(error),
    },
  );
} finally {
  stopService(
    webProcess,
    "web",
  );
  stopService(
    intelligenceProcess,
    "intelligence",
  );
}

console.log(
  "\n=== RELATÓRIO DE VALIDAÇÃO ===",
);

for (const result of results) {
  const status =
    result.ok
      ? "PASS"
      : "FAIL";

  console.log(
    `[${status}] ${result.name} — ${result.detail}`,
  );
}

const failures =
  results.filter(
    (result) =>
      !result.ok,
  );

if (failures.length > 0) {
  console.error(
    `\nValidação concluída com ${failures.length} etapa(s) em falha.`,
  );
  process.exitCode = 1;
} else {
  console.log(
    "\nValidação concluída com sucesso em todas as etapas.",
  );
}
