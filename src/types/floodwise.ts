/**
 * FloodWise Types & Domain Models
 * Ported and enhanced from Hackathon2.ipynb specification.
 */

export type FloodWiseRole = "admin" | "user" | "unknown";

export type OrchestratorStatus =
  | "RECEIVED"
  | "VALIDATED"
  | "SITUATION_ANALYZED"
  | "RESOURCES_ANALYZED"
  | "REPORTS_ANALYZED"
  | "PLANS_CREATED"
  | "SIMULATED"
  | "DECISION_RECOMMENDED"
  | "AWAITING_HUMAN_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "MISSION_GENERATED"
  | "ACCEPTED"
  | "STARTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "ABORTED";

export type SpecialistCapability =
  | "SITUATION_AGENT"
  | "RESOURCE_AGENT"
  | "REPORT_AGENT"
  | "PLANNING_AGENT"
  | "SIMULATION_ENGINE"
  | "DECISION_AGENT"
  | "HUMAN_APPROVAL"
  | null;

export type ValidationStatus = "VALID" | "NEEDS_REVIEW" | "INVALID";

export interface IntakeQuestionResponse {
  question: string;
  value: string | number | null | undefined;
}

export interface IntakeSubmission {
  id: string;
  role: FloodWiseRole;
  timestamp: string;
  responses: Record<string, IntakeQuestionResponse>;
  clientIp?: string;
}

export interface ExtractedEntity {
  text: string;
  label: "entity" | "quantity" | "action" | "condition" | "location" | "time" | string;
  score: number;
  start?: number;
  end?: number;
}

export interface ExtractedRelation {
  subject: string;
  object: string;
}

export interface UserNoteDetail {
  user_id: string;
  text: string;
  entities: ExtractedEntity[];
}

export interface StructuredFieldValidation {
  questionId: string;
  value: any;
  status: "VALID" | "INVALID";
  reason?: string;
}

export interface UnstructuredValidationResult {
  status: ValidationStatus;
  validEntities: ExtractedEntity[];
  reviewItems: Array<{ text: string; reason: string }>;
}

export interface ScenarioValidation {
  status: ValidationStatus;
  decisionReady: boolean;
  confirmed: string[];
  warnings: string[];
  issues: string[];
  structuredResults?: Record<string, StructuredFieldValidation[]>;
}

export interface DecisionTwinSnapshot {
  mission_status?: string;
  evacuated_people?: number;
  road_status?: "NORMAL" | "PARTIALLY_BLOCKED" | "BLOCKED";
  resource_issue?: string | null;
  latest_field_update?: FieldUpdate;
  [key: string]: any;
}

export interface UnifiedScenario {
  scenario_id: string;
  createdAt: string;
  updatedAt: string;
  admin: Record<string, any>;
  users: Record<string, Record<string, any>>;
  custom_notes: UserNoteDetail[];
  relations: Record<string, ExtractedRelation[]>;
  decision_twin?: DecisionTwinSnapshot;
}

export interface SituationAnalysis {
  situation: string;
  affected_area: string;
  event: string;
  severity: "Minor" | "Moderate" | "Severe" | "Critical Emergency" | string;
  risks: string[];
  citizen_reports: string[];
  resource_mentions: string[];
  uncertainties: string[];
}

export interface AvailableResource {
  resource_type: string;
  quantity: number;
  source: string;
}

export interface RequestedResource {
  resource_type: string;
  user_id: string;
}

export interface AllocatedResource {
  resource_type: string;
  quantity: number;
  allocated_to?: string;
}

export interface UnknownAvailabilityResource {
  resource_type: string;
  reason: string;
}

export interface ResourceUncertainty {
  resource_type: string;
  uncertainty: string;
}

export interface ResourceState {
  available_resources: AvailableResource[];
  requested_resources: RequestedResource[];
  allocated_resources: AllocatedResource[];
  resource_shortages: string[];
  unknown_availability: UnknownAvailabilityResource[];
  resource_uncertainties: ResourceUncertainty[];
  capacityFormulas?: {
    busCapacity: number;
    boatCapacity: number;
    ambulanceCapacity: number;
    rescueTeamCapacity: number;
  };
}

export interface ImportantReport {
  source: string;
  content: string;
  priority: "high" | "medium" | "low";
}

export interface ReportAnalysis {
  important_reports: ImportantReport[];
  confirmed_information: string[];
  conflicts: string[];
  missing_information: string[];
  report_uncertainties: string[];
}

export interface CandidatePlan {
  plan_id: string;
  objective: string;
  priority: string;
  actions: string[];
  resources_required: string[];
  constraints: string[];
  risks: string[];
  assumptions: string[];
}

export interface PlanningOutput {
  candidate_plans: CandidatePlan[];
  planning_uncertainties: string[];
}

export interface PlanSimulationResult {
  plan_id: string;
  estimated_coverage_percent: number;
  required_resource_count: number;
  resource_shortage_count: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  feasible: boolean;
  evacuation_waves_required?: number;
  estimated_evacuation_minutes?: number;
  estimated_mission_cost_inr?: number;
}

export interface SimulationOutput {
  scenario_id: string;
  plan_results: PlanSimulationResult[];
  simulation_type: "scenario_based" | "probabilistic_monte_carlo";
  assumptions: string[];
  confidenceRating?: number;
}

export interface PlanComparisonItem {
  plan_id: string;
  score: number;
  strengths: string[];
  weaknesses: string[];
}

export interface DecisionOutput {
  recommended_plan: string | null;
  reason: string;
  comparison: PlanComparisonItem[];
  decision_risks: string[];
  confidence: "LOW" | "MODERATE" | "HIGH" | string;
}

export interface HumanApproval {
  status: "APPROVED" | "MODIFIED" | "REJECTED" | "AWAITING_APPROVAL";
  selected_plan: string | null;
  ai_recommendation: string | null;
  approved_by: string;
  officer_role: string;
  operational_rationale: string;
  timestamp: string;
}

export interface MissionExecutionState {
  started: boolean;
  phase: "MOBILIZATION" | "EVACUATION" | "EXTRACTION" | "COMPLETED" | "ABORTED";
  progress: number;
  completed: boolean;
}

export interface Mission {
  mission_id: string;
  scenario_id: string;
  plan_id: string;
  status: "READY" | "ACCEPTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "ABORTED";
  objective: string;
  priority: string;
  tasks: string[];
  required_resources: string[];
  constraints: string[];
  risks: string[];
  assumptions: string[];
  responsible_officer?: string;
  created_at: string;
  updated_at: string;
  execution?: MissionExecutionState;
  audit_trail?: Array<{ status: string; timestamp: string; note?: string; actor?: string }>;
}

export interface FieldUpdate {
  update_id?: string;
  mission_id: string;
  status: "ACCEPTED" | "IN_PROGRESS" | "COMPLETED" | "ABORTED";
  note: string;
  evacuated_people?: number | null;
  road_status?: "NORMAL" | "PARTIALLY_BLOCKED" | "BLOCKED" | null;
  resource_issue?: string | null;
  timestamp?: string;
}

export interface ReassessmentResult {
  reassessment_status: "REPLAN" | "MODIFY" | "CONTINUE" | "PAUSE";
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  mission_viable: boolean;
  changed_conditions: string[];
  resource_concerns: string[];
  operational_impacts: string[];
  recommended_actions: string[];
  replanning_required: boolean;
  reason: string;
  confidence: "LOW" | "MEDIUM" | "HIGH";
}

export interface FloodWiseSharedState {
  scenario: UnifiedScenario;
  validation: ScenarioValidation;
  situation: SituationAnalysis | null;
  resources: ResourceState | null;
  reports: ReportAnalysis | null;
  plans: PlanningOutput | null;
  simulation: SimulationOutput | null;
  decision: DecisionOutput | null;
  human_approval: HumanApproval | null;
  mission: Mission | null;
  execution?: any;
  field_updates: FieldUpdate[];
  reassessment?: ReassessmentResult | null;
  state_version: number;
  analysis_version: number | null;
  orchestrator_stage: OrchestratorStatus;
  audit_log: AuditEvent[];
}

export interface AuditEvent {
  event_id: string;
  timestamp: string;
  action: string;
  actor: string;
  role?: string;
  details: string;
  metadata?: Record<string, any>;
}

export interface FloodWiseCheckpoint {
  checkpoint_id: string;
  scenario_id: string;
  version: number;
  saved_at: string;
  saved_by: string;
  data: {
    scenario: UnifiedScenario;
    validation: ScenarioValidation;
    shared_state: FloodWiseSharedState;
  };
  checksum?: string;
}
