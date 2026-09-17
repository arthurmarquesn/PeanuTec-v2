const baseUrl = process.env.PEANUTEC_WEB_URL ?? "http://127.0.0.1:3000";
const smokeEmail = process.env.PEANUTEC_SMOKE_EMAIL ?? "smoke@peanutec.local";
const smokePassword = process.env.PEANUTEC_SMOKE_PASSWORD ?? "SmokeValidation!123";
const today = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

let sessionCookie = null;

function extractSessionCookie(response) {
  const candidates = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie") ?? ""];
  for (const value of candidates) {
    const match = /(?:^|,\s*)peanutec_session=([^;,]+)/.exec(value);
    if (match) return `peanutec_session=${match[1]}`;
  }
  return null;
}

async function authRequest(path, body) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function ensureAuthenticated() {
  let response = await authRequest("/api/auth/login", {
    email: smokeEmail,
    senha: smokePassword,
  });

  if (response.status === 401) {
    const registerResponse = await authRequest("/api/auth/register", {
      nome: "Smoke Validation",
      email: smokeEmail,
      senha: smokePassword,
    });

    if (![201, 409].includes(registerResponse.status)) {
      throw new Error(`POST /api/auth/register -> ${registerResponse.status}: ${await registerResponse.text()}`);
    }

    response = await authRequest("/api/auth/login", {
      email: smokeEmail,
      senha: smokePassword,
    });
  }

  if (!response.ok) {
    throw new Error(`POST /api/auth/login -> ${response.status}: ${await response.text()}`);
  }

  sessionCookie = extractSessionCookie(response);
  if (!sessionCookie) throw new Error("Login did not issue peanutec_session cookie.");

  const me = await requestJson("/api/auth/me");
  assert(me.user?.email === smokeEmail, "Authenticated user does not match smoke account.");
}

async function requestJson(path, init = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(sessionCookie ? { Cookie: sessionCookie } : {}),
    ...init.headers,
  };

  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${init.method ?? "GET"} ${path} -> ${response.status}: ${text}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  return contentType.includes("application/json")
    ? response.json()
    : { status: response.status, contentType, bytes: Number(response.headers.get("content-length") ?? 0) };
}

async function requestStatus(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(sessionCookie ? { Cookie: sessionCookie } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${init.method ?? "GET"} ${path} -> ${response.status}: ${text}`);
  }
  return response;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const temporaryFieldPayload = {
  nome: `Smoke Talhao ${Date.now()}`,
  cidade: "Tupã",
  cultura: "Amendoim",
  data_plantio: today,
  status_lavoura: "em_campo",
  doencas_monitoradas: ["Mancha-preta", "Mancha-castanha"],
  previous_crop: "Soja",
  crop_rotation: true,
  peanut_repetition_years: 1,
  had_disease_incidence: false,
  previous_diseases: null,
  disease_incidence_level: null,
  historical_pressure: "baixa",
  agronomic_history_notes: "Smoke test temporario",
};

let fieldId = null;

try {
  await ensureAuthenticated();

  const created = await requestJson("/api/fields", {
    method: "POST",
    body: JSON.stringify(temporaryFieldPayload),
  });
  fieldId = created.id;
  assert(fieldId, "Field creation did not return an id.");

  await requestJson(`/api/fields/${fieldId}`, {
    method: "PUT",
    body: JSON.stringify({ ...temporaryFieldPayload, nome: `${temporaryFieldPayload.nome} Editado` }),
  });

  const fields = await requestJson("/api/fields");
  assert(fields.some((field) => field.id === fieldId), "Created field was not listed.");

  await requestJson(`/api/fields/${fieldId}/inspections`, {
    method: "POST",
    body: JSON.stringify({
      disease: "Mancha-preta do amendoim",
      symptoms_found: false,
      visual_severity: "baixa",
      defoliation_level: "baixa",
      action_taken: "monitorar",
      notes: "Smoke test temporario",
      general_status: "boa",
      problem_distribution: "ausente",
      pests_found: false,
      pest_notes: null,
      weeds_found: false,
      weed_pressure: "nenhuma",
      soil_condition: "adequado",
      return_needed: false,
      return_days: null,
      observed_area: "Talhao temporario",
      responsible: "Smoke",
    }),
  });

  const inspections = await requestJson(`/api/fields/${fieldId}/inspections`);
  assert(inspections.total >= 1, "Inspection was not persisted.");

  await requestJson(`/api/fields/${fieldId}/sprays`, {
    method: "POST",
    body: JSON.stringify({
      application_date: today,
      product_id: null,
      product: "Produto Smoke",
      product_type: "fungicida",
      target: "Mancha-preta",
      dose: "1 L/ha",
      responsible: "Smoke",
      planned_interval_days: 12,
      notes: "Smoke test temporario",
      generate_reapplication: true,
      reapplication_interval_days: 12,
      reapplication_date: null,
      reapplication_notes: "Retorno smoke",
    }),
  });

  const sprays = await requestJson(`/api/fields/${fieldId}/sprays`);
  assert(sprays.total >= 1, "Spray application was not persisted.");

  await requestJson("/api/calendar/events");
  await requestJson("/api/calendar/summary");

  await requestJson(`/api/fields/${fieldId}/crop-stage`, {
    method: "PATCH",
    body: JSON.stringify({ stage: "plantio", notes: "Smoke test temporario" }),
  });

  const weather = await requestJson(`/api/fields/${fieldId}/weather`);
  assert(weather.hourly_weather?.time?.length > 0, "Weather snapshot did not include hourly data.");

  const analysis = await requestJson(`/api/fields/${fieldId}/analysis`, { method: "POST" });
  assert(analysis.total_analyses === 2, "Two monitored diseases should produce two analyses.");

  const history = await requestJson(`/api/fields/${fieldId}/analysis`);
  assert(history.total_analyses >= 2, "Analysis history was not persisted.");

  await requestJson(`/api/fields/${fieldId}/situation`);
  await requestJson(`/api/fields/${fieldId}/operational-context`);
  await requestJson("/api/ranking");
  await requestJson("/api/season/metrics");
  await requestJson("/api/season/overview");
  await requestJson(`/api/fields/${fieldId}/technical-report`);

  const pdfResponse = await requestStatus(`/api/fields/${fieldId}/technical-report/pdf`);
  assert(pdfResponse.headers.get("content-type")?.includes("application/pdf"), "Technical report PDF did not return application/pdf.");

  console.log("PeanuTec main-flow smoke test passed.");
} finally {
  if (fieldId) {
    await requestJson(`/api/fields/${fieldId}`, { method: "DELETE" }).catch((error) => {
      console.error(`Failed to remove temporary field ${fieldId}: ${error.message}`);
    });
  }

  if (sessionCookie) {
    await requestJson("/api/auth/logout", { method: "POST" }).catch((error) => {
      console.error(`Failed to logout smoke session: ${error.message}`);
    });
  }
}
