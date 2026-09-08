/**
 * FloodWise Mission Management & Reassessment Engine
 * Ported from Notebook Cells 64, 67, 80, 81, 87, 89.
 * Handles mission generation from human-approved plans, mission status transitions, field updates, and reassessments.
 */

import {
  FloodWiseSharedState,
  Mission,
  FieldUpdate,
  ReassessmentResult,
  DecisionTwinSnapshot,
} from "@/types/floodwise";
import { logAuditEvent, saveMission } from "./store";

/**
 * Generate an official mission from an approved or modified plan.
 * Mirrors Notebook Cell 64.
 */
export function generateMissionFromApproval(
  sharedState: FloodWiseSharedState,
  responsibleOfficer: string,
  operationalRationale: string
): Mission {
  const approval = sharedState.human_approval;
  if (!approval || (approval.status !== "APPROVED" && approval.status !== "MODIFIED")) {
    throw new Error("Mission cannot be generated without authorized human approval.");
  }

  const selectedPlanId = approval.selected_plan;
  const plans = sharedState.plans?.candidate_plans || [];
  const plan = plans.find((p) => p.plan_id === selectedPlanId) || plans[0];

  if (!plan) {
    throw new Error(`Approved plan "${selectedPlanId}" not found in candidate plans list.`);
  }

  const now = new Date().toISOString();
  const missionId = `MIS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

  const mission: Mission = {
    mission_id: missionId,
    scenario_id: sharedState.scenario.scenario_id,
    plan_id: plan.plan_id,
    status: "READY",
    objective: plan.objective,
    priority: plan.priority,
    tasks: [...plan.actions],
    required_resources: [...plan.resources_required],
    constraints: [...plan.constraints],
    risks: [...plan.risks],
    assumptions: [...plan.assumptions],
    responsible_officer: responsibleOfficer,
    created_at: now,
    updated_at: now,
    execution: {
      started: false,
      phase: "MOBILIZATION",
      progress: 0,
      completed: false,
    },
    audit_trail: [
      {
        status: "READY",
        timestamp: now,
        actor: responsibleOfficer,
        note: `Mission officially approved and generated. Rationale: ${operationalRationale}`,
      },
    ],
  };

  sharedState.mission = mission;
  sharedState.orchestrator_stage = "MISSION_GENERATED";
  saveMission(mission);

  logAuditEvent(
    "MISSION_GENERATED",
    responsibleOfficer,
    approval.officer_role,
    `Generated mission ${missionId} for plan ${plan.plan_id}`,
    { rationale: operationalRationale }
  );

  return mission;
}

/**
 * Advance or update mission operational status.
 * Mirrors Notebook Cells 67, 87.
 */
export function updateMissionExecutionStatus(
  sharedState: FloodWiseSharedState,
  status: "ACCEPTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "ABORTED",
  note = "",
  actor = "COMMANDER"
): Mission {
  const mission = sharedState.mission;
  if (!mission) {
    throw new Error("No active mission available to update.");
  }

  const now = new Date().toISOString();
  mission.status = status;
  mission.updated_at = now;

  if (!mission.execution) {
    mission.execution = {
      started: true,
      phase: "EVACUATION",
      progress: 0,
      completed: false,
    };
  }

  if (status === "ACCEPTED") {
    mission.execution.started = true;
    mission.execution.phase = "MOBILIZATION";
    mission.execution.progress = 15;
    sharedState.orchestrator_stage = "ACCEPTED";
  } else if (status === "IN_PROGRESS") {
    mission.execution.started = true;
    mission.execution.phase = "EVACUATION";
    mission.execution.progress = Math.min(90, Math.max(30, mission.execution.progress + 25));
    sharedState.orchestrator_stage = "IN_PROGRESS";
  } else if (status === "COMPLETED") {
    mission.execution.completed = true;
    mission.execution.phase = "COMPLETED";
    mission.execution.progress = 100;
    sharedState.orchestrator_stage = "COMPLETED";
  } else if (status === "ABORTED" || status === "CANCELLED") {
    mission.execution.completed = false;
    mission.execution.phase = "ABORTED";
    sharedState.orchestrator_stage = "ABORTED";
  }

  if (!mission.audit_trail) mission.audit_trail = [];
  mission.audit_trail.push({
    status,
    timestamp: now,
    actor,
    note,
  });

  saveMission(mission);
  logAuditEvent("MISSION_STATUS_UPDATED", actor, "COMMANDER", `Mission ${mission.mission_id} updated to ${status}. Note: ${note}`);

  return mission;
}

/**
 * Record a field update and update the Decision Twin & Reassessment Agent.
 * Mirrors Notebook Cells 80-85, 89.
 */
export function recordFieldUpdate(
  sharedState: FloodWiseSharedState,
  update: {
    status?: "ACCEPTED" | "IN_PROGRESS" | "COMPLETED" | "ABORTED";
    note: string;
    evacuated_people?: number | null;
    road_status?: "NORMAL" | "PARTIALLY_BLOCKED" | "BLOCKED" | null;
    resource_issue?: string | null;
    actor?: string;
  }
): { fieldUpdate: FieldUpdate; reassessment: ReassessmentResult } {
  const mission = sharedState.mission;
  const now = new Date().toISOString();
  const effectiveStatus = update.status || mission?.status || "IN_PROGRESS";

  const fieldUpdateRecord: FieldUpdate = {
    update_id: `UPD-${Date.now().toString(36).toUpperCase()}`,
    mission_id: mission?.mission_id || "MIS_DEFAULT",
    status: effectiveStatus as any,
    note: update.note,
    evacuated_people: update.evacuated_people,
    road_status: update.road_status,
    resource_issue: update.resource_issue,
    timestamp: now,
  };

  if (!sharedState.field_updates) {
    sharedState.field_updates = [];
  }
  sharedState.field_updates.push(fieldUpdateRecord);

  // Update Decision Twin inside scenario (Notebook Cell 81)
  const twin: DecisionTwinSnapshot = sharedState.scenario.decision_twin || {};
  if (effectiveStatus) twin.mission_status = effectiveStatus;
  if (update.evacuated_people !== undefined && update.evacuated_people !== null) {
    twin.evacuated_people = update.evacuated_people;
  }
  if (update.road_status) twin.road_status = update.road_status;
  if (update.resource_issue) twin.resource_issue = update.resource_issue;
  twin.latest_field_update = fieldUpdateRecord;
  sharedState.scenario.decision_twin = twin;

  // Mark state version bumped for orchestrator re-entry (Notebook Cell 82)
  sharedState.state_version = (sharedState.state_version || 0) + 1;
  sharedState.analysis_version = null;

  // Run Reassessment Agent (Notebook Cell 89)
  const reassessment = runReassessmentAgent(sharedState, fieldUpdateRecord);
  sharedState.reassessment = reassessment;

  logAuditEvent(
    "FIELD_UPDATE_RECORDED",
    update.actor || "FIELD_RESCUE_TEAM",
    "OPERATOR",
    `Field update: Road ${update.road_status || "UNCHANGED"}, evacuated: ${update.evacuated_people || 0}. Reassessment: ${reassessment.reassessment_status}`
  );

  return { fieldUpdate: fieldUpdateRecord, reassessment };
}

/**
 * Reassessment Agent
 * Mirrors Notebook Cell 89.
 */
export function runReassessmentAgent(
  sharedState: FloodWiseSharedState,
  latestUpdate: FieldUpdate
): ReassessmentResult {
  const road = latestUpdate.road_status || "";
  const issue = latestUpdate.resource_issue || "";

  let status: "REPLAN" | "MODIFY" | "CONTINUE" | "PAUSE" = "CONTINUE";
  let risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "MEDIUM";
  let action = "Continue current mission along designated corridor";

  if (road === "BLOCKED" || issue) {
    status = road === "BLOCKED" ? "REPLAN" : "MODIFY";
    risk = road === "BLOCKED" ? "CRITICAL" : "HIGH";
    action = road === "BLOCKED" ? "Select alternate evacuation route" : "Allocate additional evacuation transport";
  } else if (road === "PARTIALLY_BLOCKED") {
    status = "MODIFY";
    risk = "HIGH";
    action = "Use alternate radial route and continue evacuation";
  }

  const reasonText = road === "BLOCKED"
    ? `Evacuation route blocked (${latestUpdate.note || "corridor impassable"}); immediate replanning required.`
    : (road === "PARTIALLY_BLOCKED"
      ? `Evacuation route partially blocked (${latestUpdate.note || "reduced transit capacity"}); route modification required.`
      : (issue
        ? `Resource constraint detected (${issue}); allocation modification required.`
        : action));

  const reassessment: ReassessmentResult = {
    reassessment_status: status,
    risk_level: risk,
    mission_viable: status !== "REPLAN",
    changed_conditions: latestUpdate.note ? [latestUpdate.note] : ["Field observations received"],
    resource_concerns: issue ? [issue] : [],
    operational_impacts: road ? [road] : [],
    recommended_actions: [action],
    replanning_required: status === "REPLAN",
    reason: reasonText,
    confidence: "HIGH",
  };

  return reassessment;
}
