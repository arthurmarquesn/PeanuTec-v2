export type SupportedDisease = {
  id: string;
  name: string;
  pathogen: string;
  status: "validated" | string;
};

export type SupportedDiseasesResponse = {
  supported_diseases: SupportedDisease[];
};

export type CropStatus =
  | "em_campo"
  | "pre_arranquio"
  | "arrancado"
  | "colhido";

export type CropStageValue =
  | "plantio"
  | "emergencia_estabelecimento"
  | "vegetativo"
  | "florescimento"
  | "enchimento_vagens"
  | "pre_arranquio"
  | "arranquio"
  | "colheita"
  | "pos_colheita";

export type UpdateCropStagePayload = {
  stage: CropStageValue | null;
  notes?: string | null;
};

export type DiseaseIncidenceLevel = "nenhuma" | "baixa" | "media" | "alta";

export type HistoricalPressure = "baixa" | "media" | "alta";

export type AnalysisRequest = {
  nome: string;
  cidade: string;
  latitude: number;
  longitude: number;
  data_plantio: string;
  cultura: string;
  doenca_alvo: string;
  status_lavoura: CropStatus;
};

export type AnalysisResult = {
  generated_at: string;
  field: {
    name: string;
    city: string;
    crop: string;
    crop_status: CropStatus | string;
    days_after_planting: number;
    crop_stage: string;
  };
  disease: string;
  pathogen: string;
  risk: {
    climate_index: number;
    agronomic_index: number;
    classification: string;
  };
  management_relevance: {
    status: string;
    description: string;
  };
  actions: string[];
};

export type FieldRegistrationRequest = {
  nome: string;
  cidade: string;
  cultura: string;
  data_plantio: string;
  status_lavoura: CropStatus;
  doencas_monitoradas: string[];
  previous_crop?: string | null;
  crop_rotation?: boolean | null;
  peanut_repetition_years?: number | null;
  had_disease_incidence?: boolean | null;
  previous_diseases?: string | string[] | null;
  disease_incidence_level?: DiseaseIncidenceLevel | null;
  historical_pressure?: HistoricalPressure | null;
  agronomic_history_notes?: string | null;
};

export type RegisteredField = FieldRegistrationRequest & {
  id: string;
  latitude: number;
  longitude: number;
};

export type RankingItem = {
  rank: number;
  field_id: string;
  field_name: string;
  city: string;
  crop_stage: string;
  disease: string;
  pathogen: string;
  risk_classification: string;
  climate_index: number;
  agronomic_index: number;
  agronomic_index_with_history?: number;
  historical_risk_bonus?: number;
  historical_risk_reasons?: string[];
  management_relevance: string;
  priority: string;
  priority_score?: number;
  priority_label?: string;
  confidence_score?: number;
  confidence_label?: string;
  main_reasons?: PriorityReason[];
  metrics?: AttentionPriorityMetrics;
  main_action: string | null;
  generated_at: string;
};

export type RankingResponse = {
  generated_at: string;
  total_fields: number;
  total_items: number;
  ranking: RankingItem[];
};

export type ProductMetric = {
  product_id: string | null;
  product: string;
  product_type: ProductType | string | null;
  applications_count: number;
};

export type ProductTypeMetric = {
  product_type: ProductType | string;
  applications_count: number;
};

export type FieldApplicationMetric = {
  field_id: string;
  field_name: string;
  applications_count: number;
};

export type TargetMetric = {
  target: string;
  applications_count: number;
};

export type MonthlyApplicationMetric = {
  month: string;
  applications_count: number;
};

export type SeasonMetrics = {
  summary: {
    total_fields: number;
    active_fields: number;
    total_spray_applications: number;
    total_products_used: number;
    average_planned_interval_days: number;
  };
  top_products: ProductMetric[];
  product_type_distribution: ProductTypeMetric[];
  top_fields_by_applications: FieldApplicationMetric[];
  top_targets: TargetMetric[];
  spray_applications_by_month: MonthlyApplicationMetric[];
};

export type SeasonOverviewSummary = {
  total_fields: number;
  active_fields: number;
  stable_fields: number;
  monitoring_fields: number;
  high_attention_fields: number;
  maximum_priority_fields: number;
  low_or_expired_defense_fields: number;
  fields_without_spray: number;
  fields_without_recent_inspection: number;
  average_estimated_defense_percent: number;
};

export type FieldStatusDistribution = {
  current_situation: string;
  situation_label: string;
  fields_count: number;
};

export type DefenseDistribution = {
  defense_status: string;
  fields_count: number;
};

export type CriticalField = {
  field_id: string;
  field_name: string;
  current_situation: string;
  situation_label: string;
  main_disease: string | null;
  agronomic_index: number | null;
  estimated_defense_percent: number | null;
  defense_status: string | null;
  recommended_next_action: string;
};

export type OperationalAlert = {
  type: string;
  severity: string;
  title: string;
  description: string;
  field_id?: string;
  field_name?: string;
};

export type SeasonOverview = {
  summary: SeasonOverviewSummary;
  status_distribution: FieldStatusDistribution[];
  defense_distribution: DefenseDistribution[];
  critical_fields: CriticalField[];
  operational_alerts: OperationalAlert[];
  top_product: ProductMetric | null;
  top_target: TargetMetric | null;
  upcoming_calendar_events: CalendarEvent[];
};

export type RegisteredFieldAnalysisResponse = {
  field_id: string;
  field_name: string;
  city: string;
  total_analyses: number;
  analyses: AnalysisResult[];
};

export type RiskContext = {
  main_disease: string | null;
  risk_classification: string | null;
  agronomic_index: number | null;
  climate_index?: number | null;
};

export type SprayContext = {
  has_spray_record?: boolean;
  last_application_date?: string | null;
  product_id?: string | null;
  product?: string | null;
  product_type?: ProductType | string | null;
  product_default_defense_days?: number | null;
  defense_reference_days?: number | null;
  defense_reference_source?:
    | "intervalo_planejado"
    | "produto"
    | "fallback"
    | string
    | null;
  target?: string | null;
  dose?: string | null;
  planned_interval_days?: number | null;
  generate_reapplication?: boolean;
  reapplication_date?: string | null;
  days_until_reapplication?: number | null;
  estimated_defense_percent: number | null;
  defense_status: string | null;
  days_since_application: number | null;
  interval_status: SprayIntervalStatus | string | null;
  product_target_consistency?: string | null;
};

export type InspectionContext = {
  has_inspection_record: boolean;
  last_inspection_date?: string | null;
  inspected_at?: string | null;
  disease?: string | null;
  symptoms_found?: boolean | null;
  visual_severity?: string | null;
  defoliation_level?: string | null;
  action_taken?: string | null;
  general_status?: InspectionGeneralStatus | null;
  problem_distribution?: ProblemDistribution | null;
  pests_found?: boolean | null;
  pest_notes?: string | null;
  weeds_found?: boolean | null;
  weed_pressure?: InspectionLevel | null;
  soil_condition?: SoilCondition | null;
  return_needed?: boolean | null;
  return_days?: number | null;
  observed_area?: string | null;
  responsible?: string | null;
};

export type PriorityReason = {
  code: string;
  label: string;
  impact: string;
  points: number;
  description: string;
};

export type AttentionPriorityMetrics = {
  block_scores?: {
    defense: number;
    inspection: number;
    operational: number;
    history: number;
    risk: number;
  };
  defense?: Record<string, unknown>;
  inspection?: Record<string, unknown>;
  operational?: Record<string, unknown>;
  history?: Record<string, unknown>;
  risk?: Record<string, unknown>;
  confidence?: Record<string, unknown>;
};

export type CurrentFieldSituation = {
  field_id: string;
  field_name: string;
  generated_at?: string;
  current_situation: string;
  situation_label: string;
  summary: string;
  risk_context: RiskContext;
  spray_context: SprayContext;
  inspection_context: InspectionContext;
  recommended_next_action: string;
  reasons: string[];
  priority_score?: number;
  priority_label?: string;
  confidence_score?: number;
  confidence_label?: string;
  main_reasons?: PriorityReason[];
  metrics?: AttentionPriorityMetrics;
};

export type CropStageContext = {
  stage: string;
  label: string;
  source: "manual" | "estimated" | "missing" | string;
  days_after_planting: number | null;
  description: string;
  updated_at?: string | null;
  notes?: string | null;
};

export type FieldCropStageUpdateResponse = {
  field_id: string;
  manual_crop_stage: CropStageValue | null;
  crop_stage_updated_at: string | null;
  crop_stage_notes: string | null;
  crop_stage_context: CropStageContext;
};

export type WaterContext = {
  status: "sem_dados" | "adequado" | "atencao" | "critico" | string;
  label: string;
  latest_soil_condition: SoilCondition | string | null;
  is_sensitive_stage: boolean;
  main_reason: string;
  farmer_message: string;
};

export type HistoricalMemoryContext = {
  has_history: boolean;
  pressure_level: HistoricalPressure | DiseaseIncidenceLevel | "sem_dados" | string;
  recurrent_diseases: string[];
  rotation_attention: boolean;
  summary: string;
  attention_points: string[];
};

export type FieldObservationContext = {
  has_recent_inspection: boolean;
  latest_inspection_date: string | null;
  symptoms_found: boolean | null;
  pests_found: boolean | null;
  weeds_found: boolean | null;
  return_needed: boolean | null;
  summary: string;
  attention_points: string[];
};

export type ApplicationResponseContext = {
  has_spray: boolean;
  latest_spray_date: string | null;
  latest_product: string | null;
  has_inspection_after_spray: boolean;
  status:
    | "sem_aplicacao"
    | "resposta_nao_verificada"
    | "verificada_por_inspecao"
    | string;
  farmer_message: string;
};

export type DataQualityContext = {
  score: number;
  label: "baixa" | "media" | "alta" | string;
  missing_items: string[];
  summary: string;
};

export type FarmerSummaryContext = {
  headline: string;
  main_points: string[];
  suggested_follow_up: string[];
};

export type FieldOperationalContext = {
  field: {
    id: string;
    nome: string;
    name: string;
    cidade: string;
    city: string;
    cultura: string;
    crop: string;
    data_plantio: string | null;
    planting_date: string | null;
    status_lavoura: CropStatus | string | null;
    crop_status: CropStatus | string | null;
    doencas_monitoradas: string[] | null;
    monitored_diseases: string[] | null;
  };
  crop_stage_context: CropStageContext;
  water_context: WaterContext;
  historical_memory: HistoricalMemoryContext;
  field_observation_context: FieldObservationContext;
  application_response_context: ApplicationResponseContext;
  data_quality_context: DataQualityContext;
  farmer_summary: FarmerSummaryContext;
  generated_at: string;
  safety_note: string;
};

export type InspectionDisease =
  | "Mancha-preta do amendoim"
  | "Mancha-castanha do amendoim";

export type InspectionLevel = "nenhuma" | "baixa" | "media" | "alta";

export type InspectionGeneralStatus = "boa" | "regular" | "atencao" | "critica";

export type ProblemDistribution =
  | "ausente"
  | "localizado"
  | "reboleiras"
  | "espalhado"
  | "generalizado";

export type SoilCondition =
  | "seco"
  | "adequado"
  | "umido"
  | "encharcado"
  | "compactado"
  | "nao_avaliado";

export type InspectionAction =
  | "nenhuma"
  | "monitorar"
  | "consultar_responsavel"
  | "manejo_realizado";

export type FieldInspectionRequest = {
  disease: InspectionDisease;
  symptoms_found: boolean;
  visual_severity: InspectionLevel;
  defoliation_level: InspectionLevel;
  action_taken: InspectionAction;
  notes: string;
  general_status?: InspectionGeneralStatus | null;
  problem_distribution?: ProblemDistribution | null;
  pests_found?: boolean | null;
  pest_notes?: string | null;
  weeds_found?: boolean | null;
  weed_pressure?: InspectionLevel | null;
  soil_condition?: SoilCondition | null;
  return_needed?: boolean | null;
  return_days?: number | null;
  observed_area?: string | null;
  responsible?: string | null;
};

export type FieldInspection = FieldInspectionRequest & {
  id: string;
  field_id: string;
  field_name: string;
  inspected_at: string;
  created_at: string;
};

export type FieldInspectionsResponse = {
  field_id: string;
  field_name: string;
  total: number;
  inspections: FieldInspection[];
};

export type InspectionScope = "selected" | "all";

export type ScopedInspectionRequest = Omit<
  FieldInspectionRequest,
  "action_taken"
> & {
  scope: InspectionScope;
  field_ids: string[];
  action_taken: string;
};

export type ScopedInspection = Omit<FieldInspection, "action_taken"> & {
  action_taken: string;
};

export type ScopedInspectionResponse = {
  scope: InspectionScope;
  created_count: number;
  field_ids: string[];
  inspections: ScopedInspection[];
};

export type SprayIntervalStatus = "em_dia" | "atencao" | "atrasado";

export type SprayApplicationFormData = {
  application_date?: string | null;
  product_id?: string | null;
  product: string;
  product_type?: ProductType | null;
  target: string;
  dose: string;
  responsible: string;
  planned_interval_days: number;
  notes: string;
  generate_reapplication?: boolean;
  reapplication_interval_days?: number | null;
  reapplication_date?: string | null;
  reapplication_notes?: string | null;
};

export type SprayApplication = SprayApplicationFormData & {
  id: string;
  field_id: string;
  field_name: string;
  application_date: string;
  days_since_application: number;
  interval_status: SprayIntervalStatus;
  created_at: string;
};

export type SprayApplicationsResponse = {
  field_id: string;
  field_name: string;
  total: number;
  spray_applications: SprayApplication[];
};

export type FieldTechnicalReportInspection = {
  id: string;
  field_id: string;
  field_name: string;
  disease: string;
  symptoms_found: boolean;
  visual_severity: InspectionLevel | string;
  defoliation_level: InspectionLevel | string;
  action_taken: InspectionAction | string;
  notes: string;
  inspected_at: string;
  general_status?: InspectionGeneralStatus | null;
  problem_distribution?: ProblemDistribution | null;
  pests_found?: boolean | null;
  pest_notes?: string | null;
  weeds_found?: boolean | null;
  weed_pressure?: InspectionLevel | null;
  soil_condition?: SoilCondition | null;
  return_needed?: boolean | null;
  return_days?: number | null;
  observed_area?: string | null;
  responsible?: string | null;
};

export type FieldTechnicalReportSprayApplication = {
  id: string;
  field_id: string;
  field_name: string;
  product: string;
  target: string;
  dose: string;
  responsible: string;
  planned_interval_days: number | null;
  notes: string;
  application_date: string;
  days_since_application: number;
  interval_status: SprayIntervalStatus | string;
};

export type FieldTechnicalReportInspectionSummary = {
  total: number;
  latest_date: string | null;
  symptoms_found_count: number;
  return_needed_count: number;
  last_responsible: string | null;
  last_general_status: InspectionGeneralStatus | string | null;
  last_problem_distribution: ProblemDistribution | string | null;
};

export type FieldTechnicalReportSpraySummary = {
  total: number;
  latest_date: string | null;
  last_product: string | null;
  last_target: string | null;
  last_interval_status: SprayIntervalStatus | string | null;
  days_since_last_application: number | null;
};

export type FieldTechnicalReportTimelineItem = {
  type: "inspection" | "spray" | "planting";
  date: string;
  title: string;
  description: string;
  metadata: Record<string, string | number | boolean | null | undefined>;
};

export type FieldTechnicalReport = {
  field: RegisteredField;
  current_situation: CurrentFieldSituation;
  latest_inspection: FieldTechnicalReportInspection | null;
  latest_spray_application: FieldTechnicalReportSprayApplication | null;
  inspections_summary: FieldTechnicalReportInspectionSummary;
  spray_summary: FieldTechnicalReportSpraySummary;
  timeline: FieldTechnicalReportTimelineItem[];
  generated_at: string;
  safety_note: string;
};

export type ProductType =
  | "fungicida"
  | "inseticida"
  | "acaricida"
  | "herbicida"
  | "outro";

export type ProductRequest = {
  name: string;
  product_type: ProductType;
  active_ingredient?: string | null;
  main_target?: string | null;
  default_defense_days?: number | null;
  notes?: string | null;
  is_active?: boolean;
};

export type Product = ProductRequest & {
  id: string;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type CalendarEventType =
  | "pulverizacao"
  | "inspecao"
  | "monitoramento"
  | "reaplicacao_prevista"
  | "observacao";

export type CalendarColorKey =
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "gray"
  | "red";

export type CalendarEventStatus = "realizado" | "previsto" | "informativo" | string;

export type CalendarEvent = {
  id: string;
  event_type: CalendarEventType;
  title: string;
  field_id: string | null;
  field_name: string | null;
  date: string;
  end_date: string;
  product: string;
  product_type: string | null;
  target: string;
  planned_interval_days: number | null;
  notes: string;
  color_key: CalendarColorKey;
  status: CalendarEventStatus;
  source_type: string | null;
  source_id: string | null;
  created_at: string;
};

export type CalendarEventsResponse = {
  total: number;
  events: CalendarEvent[];
};

export type CalendarSummary = {
  active_fields: number;
  events_count: number;
  spray_events_count: number;
  inspection_events_count: number;
  upcoming_attention_count: number;
  fields_without_recent_inspection: number;
};
