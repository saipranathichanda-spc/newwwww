/**
 * FloodWise Orchestrator & State Machine
 * Ported from Notebook Cells 37, 39, 41, 86.
 * Coordinates specialist capabilities, detects state changes, prevents infinite loops, and enforces human approval gates.
 */

import {
  FloodWiseSharedState,
  OrchestratorStatus,
} from "@/types/floodwise";
import { runSituationAgent } from "./agents/situation-agent";
import { runResourceAgent } from "./agents/resource-agent";
import { runReportAgent } from "./agents/report-agent";
import { runPlanningAgent } from "./agents/planning-agent";
import { runSimulationEngine } from "./agents/simulation-engine";
import { runDecisionAgent } from "./agents/decision-agent";
import { logAuditEvent } from "./store";

export type SpecialistCapability =
  | "SITUATION_AGENT"
  | "RESOURCE_AGENT"
  | "REPORT_AGENT"
  | "PLANNING_AGENT"
  | "SIMULATION_ENGINE"
  | "DECISION_AGENT"
  | "HUMAN_APPROVAL"
  | null;

/**
 * Determine the next specialist capability required.
 * Mirrors Notebook Cell 37.
 */
export function determineNextCapability(sharedState: FloodWiseSharedState): SpecialistCapability {
  const stateVersion = sharedState.state_version || 0;
  const analysisVersion = sharedState.analysis_version || 0;
  const stateChanged = stateVersion > analysisVersion;

  // If a field update changed state, decide which agent must reassess first
  if (stateChanged && sharedState.field_updates && sharedState.field_updates.length > 0) {
    const latestUpdate = sharedState.field_updates[sharedState.field_updates.length - 1];

    if (latestUpdate.road_status || latestUpdate.note?.toLowerCase().includes("road") || latestUpdate.note?.toLowerCase().includes("water")) {
      return "SITUATION_AGENT";
    }

    if (latestUpdate.resource_issue || latestUpdate.note?.toLowerCase().includes("transport") || latestUpdate.note?.toLowerCase().includes("boat")) {
      return "RESOURCE_AGENT";
    }

    return "PLANNING_AGENT";
  }

  // Standard progressive priority execution order
  if (!sharedState.situation) return "SITUATION_AGENT";
  if (!sharedState.resources) return "RESOURCE_AGENT";
  if (!sharedState.reports) return "REPORT_AGENT";
  if (!sharedState.plans) return "PLANNING_AGENT";
  if (!sharedState.simulation) return "SIMULATION_ENGINE";
  if (!sharedState.decision) return "DECISION_AGENT";
  if (!sharedState.human_approval || sharedState.human_approval.status === "AWAITING_APPROVAL") return "HUMAN_APPROVAL";

  return null;
}

/**
 * Execute a single next step in the pipeline.
 * Mirrors Notebook Cell 39.
 */
export async function executeNextCapability(sharedState: FloodWiseSharedState): Promise<{
  capability: SpecialistCapability;
  orchestratorStatus: OrchestratorStatus;
  result: any;
}> {
  const nextCapability = determineNextCapability(sharedState);

  if (!nextCapability) {
    return {
      capability: null,
      orchestratorStatus: sharedState.orchestrator_stage,
      result: "Pipeline fully up to date.",
    };
  }

  let result: any = null;

  switch (nextCapability) {
    case "SITUATION_AGENT":
      result = await runSituationAgent(sharedState.scenario);
      sharedState.situation = result;
      sharedState.orchestrator_stage = "SITUATION_ANALYZED";
      logAuditEvent("SITUATION_ANALYZED", "SITUATION_AGENT", "SYSTEM", "Completed emergency situation analysis");
      break;

    case "RESOURCE_AGENT":
      result = await runResourceAgent(sharedState.scenario);
      sharedState.resources = result;
      sharedState.orchestrator_stage = "RESOURCES_ANALYZED";
      logAuditEvent("RESOURCES_ANALYZED", "RESOURCE_AGENT", "SYSTEM", "Completed resource availability and request analysis");
      break;

    case "REPORT_AGENT":
      result = await runReportAgent(sharedState.scenario, sharedState.situation, sharedState.resources);
      sharedState.reports = result;
      sharedState.orchestrator_stage = "REPORTS_ANALYZED";
      logAuditEvent("REPORTS_ANALYZED", "REPORT_AGENT", "SYSTEM", "Completed citizen distress reports synthesis");
      break;

    case "PLANNING_AGENT":
      result = await runPlanningAgent(sharedState.scenario, sharedState.situation, sharedState.resources, sharedState.reports);
      sharedState.plans = result;
      sharedState.orchestrator_stage = "PLANS_CREATED";
      logAuditEvent("PLANS_CREATED", "PLANNING_AGENT", "SYSTEM", `Generated ${result.candidate_plans.length} candidate emergency response plans`);
      break;

    case "SIMULATION_ENGINE":
      result = runSimulationEngine(sharedState.scenario, sharedState.situation, sharedState.resources, sharedState.plans);
      sharedState.simulation = result;
      sharedState.orchestrator_stage = "SIMULATED";
      logAuditEvent("SIMULATED", "SIMULATION_ENGINE", "SYSTEM", "Completed multi-factor scenario simulation of candidate plans");
      break;

    case "DECISION_AGENT":
      result = await runDecisionAgent(
        sharedState.scenario,
        sharedState.situation,
        sharedState.resources,
        sharedState.reports,
        sharedState.plans,
        sharedState.simulation
      );
      sharedState.decision = result;
      sharedState.orchestrator_stage = "DECISION_RECOMMENDED";
      sharedState.analysis_version = sharedState.state_version;
      logAuditEvent("DECISION_RECOMMENDED", "DECISION_AGENT", "SYSTEM", `Recommended plan: ${result.recommended_plan} with confidence ${result.confidence}`);
      break;

    case "HUMAN_APPROVAL":
      sharedState.orchestrator_stage = "AWAITING_HUMAN_APPROVAL";
      result = { status: "AWAITING_APPROVAL", message: "Awaiting human officer operational rationale and authorization." };
      break;
  }

  return {
    capability: nextCapability,
    orchestratorStatus: sharedState.orchestrator_stage,
    result,
  };
}

/**
 * Execute all capabilities until the pipeline pauses at the human approval gate.
 */
export async function executePipelineToApproval(sharedState: FloodWiseSharedState): Promise<{
  completedSteps: SpecialistCapability[];
  finalStage: OrchestratorStatus;
  decision: any;
}> {
  const completedSteps: SpecialistCapability[] = [];
  let maxLoopGuard = 0;

  while (maxLoopGuard < 15) {
    maxLoopGuard++;
    const nextCap = determineNextCapability(sharedState);
    if (!nextCap || nextCap === "HUMAN_APPROVAL") {
      sharedState.orchestrator_stage = "AWAITING_HUMAN_APPROVAL";
      break;
    }

    const { capability } = await executeNextCapability(sharedState);
    if (capability) {
      completedSteps.push(capability);
    }
  }

  return {
    completedSteps,
    finalStage: sharedState.orchestrator_stage,
    decision: sharedState.decision,
  };
}
