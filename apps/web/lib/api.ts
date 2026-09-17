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
  LogoutResponse,
} from "@/types/auth";

import { getSupportedDiseasesResponse } from "@/lib/supported-diseases";

type CalendarEventsParams = {
  start_date?: string;
  end_date?: string;
  field_id?: string;
  event_type?: CalendarEventType;
  product_type?: ProductType;
};

type ApiErrorDetail = string | { msg?: string; loc?: string[] }[];

async function parseApiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: ApiErrorDetail };
    if (Array.isArray(body.detail)) {
      return body.detail.map((item) => item.msg).filter(Boolean).join("; ") || "Revise os dados informados.";
    }
    if (typeof body.detail === "string") return body.detail;
  } catch {
    return `Erro HTTP ${response.status}`;
  }
  return `Erro HTTP ${response.status}`;
}

async function requestNextJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response.json() as Promise<T>;
}

function buildQueryString(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  return search.toString();
}

export function getSupportedDiseases() {
  return Promise.resolve(getSupportedDiseasesResponse());
}

export function analyzeField(payload: AnalysisRequest) {
  return requestNextJson<AnalysisResult>("/api/intelligence/analyze", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getFields() {
  return requestNextJson<RegisteredField[]>("/api/fields");
}

export function getField(fieldId: string) {
  return requestNextJson<RegisteredField>(`/api/fields/${fieldId}`);
}

export function createField(payload: FieldRegistrationRequest) {
  return requestNextJson<RegisteredField>("/api/fields", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateField(fieldId: string, payload: FieldRegistrationRequest) {
  return requestNextJson<RegisteredField>(`/api/fields/${fieldId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteField(fieldId: string) {
  return requestNextJson<{ message: string; id: string }>(`/api/fields/${fieldId}`, {
    method: "DELETE",
  });
}

export function analyzeRegisteredField(fieldId: string) {
  return requestNextJson<RegisteredFieldAnalysisResponse>(`/api/fields/${fieldId}/analysis`, {
    method: "POST",
  });
}

export function getRegisteredFieldAnalysisHistory(fieldId: string) {
  return requestNextJson<RegisteredFieldAnalysisResponse>(`/api/fields/${fieldId}/analysis`);
}

export function getCurrentFieldSituation(fieldId: string) {
  return requestNextJson<CurrentFieldSituation>(`/api/fields/${fieldId}/situation`);
}

export function getFieldOperationalContext(fieldId: string) {
  return requestNextJson<FieldOperationalContext>(`/api/fields/${fieldId}/operational-context`);
}

export function updateFieldCropStage(fieldId: string, payload: UpdateCropStagePayload) {
  return requestNextJson<FieldCropStageUpdateResponse>(`/api/fields/${fieldId}/crop-stage`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function getFieldTechnicalReport(fieldId: string) {
  return requestNextJson<FieldTechnicalReport>(`/api/fields/${fieldId}/technical-report`);
}

export function getFieldTechnicalReportPdfUrl(fieldId: string) {
  return `/api/fields/${fieldId}/technical-report/pdf`;
}

export function getRanking() {
  return requestNextJson<RankingResponse>("/api/ranking");
}

export function getSeasonMetrics() {
  return requestNextJson<SeasonMetrics>("/api/season/metrics");
}

export function getSeasonOverview() {
  return requestNextJson<SeasonOverview>("/api/season/overview");
}

export function getFieldInspections(fieldId: string) {
  return requestNextJson<FieldInspectionsResponse>(`/api/fields/${fieldId}/inspections`);
}

export function createFieldInspection(fieldId: string, payload: FieldInspectionRequest) {
  return requestNextJson<FieldInspection>(`/api/fields/${fieldId}/inspections`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createScopedInspection(payload: ScopedInspectionRequest) {
  return requestNextJson<ScopedInspectionResponse>("/api/inspections", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getFieldSprayApplications(fieldId: string) {
  return requestNextJson<SprayApplicationsResponse>(`/api/fields/${fieldId}/sprays`);
}

export function createFieldSprayApplication(fieldId: string, payload: SprayApplicationFormData) {
  return requestNextJson<SprayApplication>(`/api/fields/${fieldId}/sprays`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getCalendarEvents(params: CalendarEventsParams = {}) {
  const query = buildQueryString(params);
  return requestNextJson<CalendarEventsResponse>(`/api/calendar/events${query ? `?${query}` : ""}`);
}

export function getCalendarSummary() {
  return requestNextJson<CalendarSummary>("/api/calendar/summary");
}

export async function exportCalendarExcel(params: CalendarEventsParams = {}): Promise<Blob> {
  const query = buildQueryString(params);
  const response = await fetch(`/api/calendar/export${query ? `?${query}` : ""}`, {
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.blob();
}

export function getProducts(activeOnly = false) {
  return requestNextJson<Product[]>(`/api/products${activeOnly ? "?active_only=true" : ""}`);
}

export function getProduct(productId: string) {
  return requestNextJson<Product>(`/api/products/${productId}`);
}

export function createProduct(payload: ProductRequest) {
  return requestNextJson<Product>("/api/products", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateProduct(productId: string, payload: ProductRequest) {
  return requestNextJson<Product>(`/api/products/${productId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deactivateProduct(productId: string) {
  return requestNextJson<Product>(`/api/products/${productId}`, {
    method: "DELETE",
  });
}

export function loginUser(payload: LoginRequest) {
  return requestNextJson<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function registerUser(payload: RegisterRequest) {
  return requestNextJson<AuthUser>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getCurrentUser() {
  return requestNextJson<{ user: AuthUser }>("/api/auth/me");
}

export function logoutUser() {
  return requestNextJson<LogoutResponse>("/api/auth/logout", {
    method: "POST",
  });
}
