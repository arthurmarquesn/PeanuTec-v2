const baseUrl =
  process.env.PEANUTEC_WEB_URL ??
  "http://127.0.0.1:3000";

const today =
  new Date(
    Date.now() -
      24 * 60 * 60 * 1000,
  )
    .toISOString()
    .slice(0, 10);

async function requestJson(
  path,
  init,
) {
  const response =
    await fetch(
      `${baseUrl}${path}`,
      {
        ...init,
        headers: {
          "Content-Type":
            "application/json",
          ...init?.headers,
        },
      },
    );

  if (!response.ok) {
    const text =
      await response.text();

    throw new Error(
      `${init?.method ?? "GET"} ${path} -> ${response.status}: ${text}`,
    );
  }

  const contentType =
    response.headers.get(
      "content-type",
    ) ?? "";

  if (
    contentType.includes(
      "application/json",
    )
  ) {
    return response.json();
  }

  return {
    status:
      response.status,
    contentType,
    bytes:
      Number(
        response.headers.get(
          "content-length",
        ) ?? 0,
      ),
  };
}

async function requestStatus(
  path,
  init,
) {
  const response =
    await fetch(
      `${baseUrl}${path}`,
      init,
    );

  if (!response.ok) {
    const text =
      await response.text();

    throw new Error(
      `${init?.method ?? "GET"} ${path} -> ${response.status}: ${text}`,
    );
  }

  return response;
}

function assert(
  condition,
  message,
) {
  if (!condition) {
    throw new Error(
      message,
    );
  }
}

const temporaryFieldPayload = {
  nome:
    `Smoke Talhao ${Date.now()}`,
  cidade:
    "Tup\u00e3",
  cultura:
    "Amendoim",
  data_plantio:
    today,
  status_lavoura:
    "em_campo",
  doencas_monitoradas: [
    "Mancha-preta",
    "Mancha-castanha",
  ],
  previous_crop:
    "Soja",
  crop_rotation:
    true,
  peanut_repetition_years:
    1,
  had_disease_incidence:
    false,
  previous_diseases:
    null,
  disease_incidence_level:
    null,
  historical_pressure:
    "baixa",
  agronomic_history_notes:
    "Smoke test temporario",
};

let fieldId = null;

try {
  const created =
    await requestJson(
      "/api/fields",
      {
        method: "POST",
        body:
          JSON.stringify(
            temporaryFieldPayload,
          ),
      },
    );

  fieldId =
    created.id;

  assert(
    fieldId,
    "Field creation did not return an id.",
  );

  await requestJson(
    `/api/fields/${fieldId}`,
    {
      method: "PUT",
      body:
        JSON.stringify({
          ...temporaryFieldPayload,
          nome:
            `${temporaryFieldPayload.nome} Editado`,
        }),
    },
  );

  const fields =
    await requestJson(
      "/api/fields",
    );

  assert(
    fields.some(
      (field) =>
        field.id === fieldId,
    ),
    "Created field was not listed.",
  );

  await requestJson(
    `/api/fields/${fieldId}/inspections`,
    {
      method: "POST",
      body:
        JSON.stringify({
          disease:
            "Mancha-preta do amendoim",
          symptoms_found:
            false,
          visual_severity:
            "baixa",
          defoliation_level:
            "baixa",
          action_taken:
            "monitorar",
          notes:
            "Smoke test temporario",
          general_status:
            "boa",
          problem_distribution:
            "ausente",
          pests_found:
            false,
          pest_notes:
            null,
          weeds_found:
            false,
          weed_pressure:
            "nenhuma",
          soil_condition:
            "adequado",
          return_needed:
            false,
          return_days:
            null,
          observed_area:
            "Talhao temporario",
          responsible:
            "Smoke",
        }),
    },
  );

  const inspections =
    await requestJson(
      `/api/fields/${fieldId}/inspections`,
    );

  assert(
    inspections.total >= 1,
    "Inspection was not persisted.",
  );

  await requestJson(
    `/api/fields/${fieldId}/sprays`,
    {
      method: "POST",
      body:
        JSON.stringify({
          application_date:
            today,
          product_id:
            null,
          product:
            "Produto Smoke",
          product_type:
            "fungicida",
          target:
            "Mancha-preta",
          dose:
            "1 L/ha",
          responsible:
            "Smoke",
          planned_interval_days:
            12,
          notes:
            "Smoke test temporario",
          generate_reapplication:
            true,
          reapplication_interval_days:
            12,
          reapplication_date:
            null,
          reapplication_notes:
            "Retorno smoke",
        }),
    },
  );

  const sprays =
    await requestJson(
      `/api/fields/${fieldId}/sprays`,
    );

  assert(
    sprays.total >= 1,
    "Spray application was not persisted.",
  );

  await requestJson(
    "/api/calendar/events",
  );

  await requestJson(
    "/api/calendar/summary",
  );

  await requestJson(
    `/api/fields/${fieldId}/crop-stage`,
    {
      method: "PATCH",
      body:
        JSON.stringify({
          stage:
            "plantio",
          notes:
            "Smoke test temporario",
        }),
    },
  );

  const weather =
    await requestJson(
      `/api/fields/${fieldId}/weather`,
    );

  assert(
    weather.hourly_weather?.time?.length > 0,
    "Weather snapshot did not include hourly data.",
  );

  const analysis =
    await requestJson(
      `/api/fields/${fieldId}/analysis`,
      {
        method: "POST",
      },
    );

  assert(
    analysis.total_analyses === 2,
    "Two monitored diseases should produce two analyses.",
  );

  const history =
    await requestJson(
      `/api/fields/${fieldId}/analysis`,
    );

  assert(
    history.total_analyses >= 2,
    "Analysis history was not persisted.",
  );

  await requestJson(
    `/api/fields/${fieldId}/situation`,
  );

  await requestJson(
    `/api/fields/${fieldId}/operational-context`,
  );

  await requestJson(
    "/api/ranking",
  );

  await requestJson(
    "/api/season/metrics",
  );

  await requestJson(
    "/api/season/overview",
  );

  await requestJson(
    `/api/fields/${fieldId}/technical-report`,
  );

  const pdfResponse =
    await requestStatus(
      `/api/fields/${fieldId}/technical-report/pdf`,
    );

  assert(
    pdfResponse.headers
      .get("content-type")
      ?.includes("application/pdf"),
    "Technical report PDF did not return application/pdf.",
  );

  console.log(
    "PeanuTec main-flow smoke test passed.",
  );
} finally {
  if (fieldId) {
    await requestJson(
      `/api/fields/${fieldId}`,
      {
        method: "DELETE",
      },
    ).catch(
      (error) => {
        console.error(
          `Failed to remove temporary field ${fieldId}: ${error.message}`,
        );
      },
    );
  }
}
