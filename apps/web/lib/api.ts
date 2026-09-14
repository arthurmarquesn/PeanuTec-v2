import type {
  AnalysisRequest,
  AnalysisResult,
  CalendarEventsResponse,
  CalendarEventType,
  CalendarSummary,
  CurrentFieldSituation,
  FieldCropStageUpdateResponse,
  FieldInspectionRequest,
  FieldInspection,
  FieldInspectionsResponse,
  FieldOperationalContext,
  FieldRegistrationRequest,
  FieldTechnicalReport,
  Product,
  ProductRequest,
  ProductType,
  RankingResponse,
  RegisteredField,
  RegisteredFieldAnalysisResponse,
  ScopedInspectionRequest,
  ScopedInspectionResponse,
  SeasonMetrics,
  SeasonOverview,
  SprayApplication,
  SprayApplicationFormData,
  SprayApplicationsResponse,
  UpdateCropStagePayload,
} from "@/types/analysis";

import type {
  AuthUser,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
} from "@/types/auth";

import {
  getSupportedDiseasesResponse,
} from "@/lib/supported-diseases";

/* =========================================================
 * Internal types
 * ========================================================= */

type CalendarEventsParams = {
  start_date?: string;
  end_date?: string;
  field_id?: string;
  event_type?: CalendarEventType;
  product_type?: ProductType;
};

type ApiErrorDetail =
  | string
  | {
      msg?: string;
      loc?: string[];
    }[];

/* =========================================================
 * Error parser
 * ========================================================= */

async function parseApiError(
  response: Response,
): Promise<string> {
  try {
    const body =
      (await response.json()) as {
        detail?: ApiErrorDetail;
      };

    if (
      Array.isArray(
        body.detail,
      )
    ) {
      const message =
        body.detail
          .map(
            (item) =>
              item.msg,
          )
          .filter(Boolean)
          .join("; ");

      return (
        message ||
        "Revise os dados informados."
      );
    }

    if (
      typeof body.detail ===
      "string"
    ) {
      return body.detail;
    }
  } catch {
    return `Erro HTTP ${response.status}`;
  }

  return `Erro HTTP ${response.status}`;
}

/* =========================================================
 * Legacy Python request
 *
 * Mantido apenas para autenticação antiga enquanto o produto
 * ainda não possui autenticação própria no Next.
 * ========================================================= */

const LEGACY_AUTH_API_URL =
  process.env.NEXT_PUBLIC_LEGACY_AUTH_API_URL ??
  "http://127.0.0.1:8000";

async function requestPythonJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response =
    await fetch(
      `${LEGACY_AUTH_API_URL}${path}`,
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
    throw new Error(
      await parseApiError(
        response,
      ),
    );
  }

  return response.json() as Promise<T>;
}

/* =========================================================
 * Next request
 * ========================================================= */

async function requestNextJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response =
    await fetch(
      path,
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
    throw new Error(
      await parseApiError(
        response,
      ),
    );
  }

  return response.json() as Promise<T>;
}

/* =========================================================
 * Query string
 * ========================================================= */

function buildQueryString(
  params: Record<
    string,
    string | undefined
  >,
): string {
  const search =
    new URLSearchParams();

  Object.entries(
    params,
  ).forEach(
    ([key, value]) => {
      if (value) {
        search.set(
          key,
          value,
        );
      }
    },
  );

  return search.toString();
}

/* =========================================================
 * Intelligence
 *
 * PYTHON
 * ========================================================= */

export function getSupportedDiseases() {
  return Promise.resolve(
    getSupportedDiseasesResponse(),
  );
}

export function analyzeField(
  payload: AnalysisRequest,
) {
  return requestNextJson<AnalysisResult>(
    "/api/intelligence/analyze",
    {
      method: "POST",

      body:
        JSON.stringify(
          payload,
        ),
    },
  );
}

/* =========================================================
 * Fields
 *
 * NEXT V2
 * ========================================================= */

export function getFields() {
  return requestNextJson<
    RegisteredField[]
  >(
    "/api/fields",
  );
}

export function getField(
  fieldId: string,
) {
  return requestNextJson<RegisteredField>(
    `/api/fields/${fieldId}`,
  );
}

export function createField(
  payload:
    FieldRegistrationRequest,
) {
  return requestNextJson<RegisteredField>(
    "/api/fields",
    {
      method: "POST",

      body:
        JSON.stringify(
          payload,
        ),
    },
  );
}

export function updateField(
  fieldId: string,
  payload:
    FieldRegistrationRequest,
) {
  return requestNextJson<RegisteredField>(
    `/api/fields/${fieldId}`,
    {
      method: "PUT",

      body:
        JSON.stringify(
          payload,
        ),
    },
  );
}

export function deleteField(
  fieldId: string,
) {
  return requestNextJson<{
    message: string;
    id: string;
  }>(
    `/api/fields/${fieldId}`,
    {
      method: "DELETE",
    },
  );
}

/* =========================================================
 * Analysis
 *
 * NEXT owns persistence.
 * PYTHON performs intelligence.
 * ========================================================= */

export function analyzeRegisteredField(
  fieldId: string,
) {
  return requestNextJson<RegisteredFieldAnalysisResponse>(
    `/api/fields/${fieldId}/analysis`,
    {
      method: "POST",
    },
  );
}

export function getRegisteredFieldAnalysisHistory(
  fieldId: string,
) {
  return requestNextJson<RegisteredFieldAnalysisResponse>(
    `/api/fields/${fieldId}/analysis`,
  );
}

/* =========================================================
 * Current situation
 *
 * NEXT V2
 * ========================================================= */

export function getCurrentFieldSituation(
  fieldId: string,
) {
  return requestNextJson<CurrentFieldSituation>(
    `/api/fields/${fieldId}/situation`,
  );
}

/* =========================================================
 * Operational context
 *
 * NEXT V2
 * ========================================================= */

export function getFieldOperationalContext(
  fieldId: string,
) {
  return requestNextJson<FieldOperationalContext>(
    `/api/fields/${fieldId}/operational-context`,
  );
}

/* =========================================================
 * Crop stage
 *
 * NEXT V2
 * ========================================================= */

export function updateFieldCropStage(
  fieldId: string,
  payload:
    UpdateCropStagePayload,
) {
  return requestNextJson<FieldCropStageUpdateResponse>(
    `/api/fields/${fieldId}/crop-stage`,
    {
      method: "PATCH",

      body:
        JSON.stringify(
          payload,
        ),
    },
  );
}

/* =========================================================
 * Technical report
 *
 * NEXT V2
 * ========================================================= */

export function getFieldTechnicalReport(
  fieldId: string,
) {
  return requestNextJson<FieldTechnicalReport>(
    `/api/fields/${fieldId}/technical-report`,
  );
}

export function getFieldTechnicalReportPdfUrl(
  fieldId: string,
) {
  return `/api/fields/${fieldId}/technical-report/pdf`;
}

/* =========================================================
 * Ranking
 *
 * NEXT V2
 * ========================================================= */

export function getRanking() {
  return requestNextJson<RankingResponse>(
    "/api/ranking",
  );
}

/* =========================================================
 * Season
 *
 * NEXT V2
 * ========================================================= */

export function getSeasonMetrics() {
  return requestNextJson<SeasonMetrics>(
    "/api/season/metrics",
  );
}

export function getSeasonOverview() {
  return requestNextJson<SeasonOverview>(
    "/api/season/overview",
  );
}

/* =========================================================
 * Inspections
 *
 * NEXT V2
 * ========================================================= */

export function getFieldInspections(
  fieldId: string,
) {
  return requestNextJson<FieldInspectionsResponse>(
    `/api/fields/${fieldId}/inspections`,
  );
}

export function createFieldInspection(
  fieldId: string,
  payload:
    FieldInspectionRequest,
) {
  return requestNextJson<FieldInspection>(
    `/api/fields/${fieldId}/inspections`,
    {
      method: "POST",

      body:
        JSON.stringify(
          payload,
        ),
    },
  );
}

export function createScopedInspection(
  payload:
    ScopedInspectionRequest,
) {
  return requestNextJson<ScopedInspectionResponse>(
    "/api/inspections",
    {
      method: "POST",

      body:
        JSON.stringify(
          payload,
        ),
    },
  );
}

/* =========================================================
 * Spray applications
 *
 * NEXT V2
 * ========================================================= */

export function getFieldSprayApplications(
  fieldId: string,
) {
  return requestNextJson<SprayApplicationsResponse>(
    `/api/fields/${fieldId}/sprays`,
  );
}

export function createFieldSprayApplication(
  fieldId: string,
  payload:
    SprayApplicationFormData,
) {
  return requestNextJson<SprayApplication>(
    `/api/fields/${fieldId}/sprays`,
    {
      method: "POST",

      body:
        JSON.stringify(
          payload,
        ),
    },
  );
}

/* =========================================================
 * Calendar
 *
 * NEXT V2
 * ========================================================= */

export function getCalendarEvents(
  params:
    CalendarEventsParams = {},
) {
  const query =
    buildQueryString(
      params,
    );

  return requestNextJson<CalendarEventsResponse>(
    `/api/calendar/events${
      query
        ? `?${query}`
        : ""
    }`,
  );
}

export function getCalendarSummary() {
  return requestNextJson<CalendarSummary>(
    "/api/calendar/summary",
  );
}

export async function exportCalendarExcel(
  params:
    CalendarEventsParams = {},
): Promise<Blob> {
  const query =
    buildQueryString(
      params,
    );

  const response =
    await fetch(
      `/api/calendar/export${
        query
          ? `?${query}`
          : ""
      }`,
    );

  if (!response.ok) {
    throw new Error(
      await parseApiError(
        response,
      ),
    );
  }

  return response.blob();
}

/* =========================================================
 * Products
 *
 * NEXT V2
 * ========================================================= */

export function getProducts(
  activeOnly = false,
) {
  return requestNextJson<
    Product[]
  >(
    `/api/products${
      activeOnly
        ? "?active_only=true"
        : ""
    }`,
  );
}

export function getProduct(
  productId: string,
) {
  return requestNextJson<Product>(
    `/api/products/${productId}`,
  );
}

export function createProduct(
  payload:
    ProductRequest,
) {
  return requestNextJson<Product>(
    "/api/products",
    {
      method: "POST",

      body:
        JSON.stringify(
          payload,
        ),
    },
  );
}

export function updateProduct(
  productId: string,
  payload:
    ProductRequest,
) {
  return requestNextJson<Product>(
    `/api/products/${productId}`,
    {
      method: "PUT",

      body:
        JSON.stringify(
          payload,
        ),
    },
  );
}

export function deactivateProduct(
  productId: string,
) {
  return requestNextJson<Product>(
    `/api/products/${productId}`,
    {
      method: "DELETE",
    },
  );
}

/* =========================================================
 * Authentication
 *
 * PYTHON legacy temporarily
 * ========================================================= */

export function loginUser(
  payload:
    LoginRequest,
) {
  return requestPythonJson<LoginResponse>(
    "/auth/login",
    {
      method: "POST",

      body:
        JSON.stringify(
          payload,
        ),
    },
  );
}

export function registerUser(
  payload:
    RegisterRequest,
) {
  return requestPythonJson<AuthUser>(
    "/auth/register",
    {
      method: "POST",

      body:
        JSON.stringify(
          payload,
        ),
    },
  );
}

export function getCurrentUser(
  token: string,
) {
  return requestPythonJson<AuthUser>(
    "/auth/me",
    {
      headers: {
        Authorization:
          `Bearer ${token}`,
      },
    },
  );
}
