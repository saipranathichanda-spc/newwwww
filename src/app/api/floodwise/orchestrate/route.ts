import { NextRequest, NextResponse } from "next/server";
import { getSharedState, resetSharedState } from "@/lib/floodwise/store";
import {
  determineNextCapability,
  executeNextCapability,
  executePipelineToApproval,
} from "@/lib/floodwise/orchestrator";

export async function GET() {
  const shared = getSharedState();
  const nextCapability = determineNextCapability(shared);

  return NextResponse.json({
    orchestratorStage: shared.orchestrator_stage,
    nextCapability,
    stateVersion: shared.state_version,
    analysisVersion: shared.analysis_version,
    stateChanged: (shared.state_version || 0) > (shared.analysis_version || 0),
    capabilitiesCompleted: {
      SITUATION_AGENT: shared.situation !== null,
      RESOURCE_AGENT: shared.resources !== null,
      REPORT_AGENT: shared.reports !== null,
      PLANNING_AGENT: shared.plans !== null,
      SIMULATION_ENGINE: shared.simulation !== null,
      DECISION_AGENT: shared.decision !== null,
      HUMAN_APPROVAL: shared.human_approval !== null,
      MISSION_GENERATED: shared.mission !== null,
    },
    scenario: shared.scenario,
    validation: shared.validation,
    situation: shared.situation,
    resources: shared.resources,
    reports: shared.reports,
    plans: shared.plans,
    simulation: shared.simulation,
    decision: shared.decision,
    human_approval: shared.human_approval,
    mission: shared.mission,
    field_updates: shared.field_updates,
    reassessment: shared.reassessment,
  });
}

export async function POST(request: NextRequest) {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // defaults to pipeline mode
  }

  const mode = body.mode || "pipeline";
  let shared = getSharedState();

  if (mode === "reset") {
    shared = resetSharedState();
    return NextResponse.json({
      success: true,
      message: "FloodWise shared state reset to initial scenario baseline.",
      sharedState: shared,
    });
  }

  if (mode === "next") {
    const stepResult = await executeNextCapability(shared);
    return NextResponse.json({
      success: true,
      mode: "single_step",
      stepResult,
      orchestratorStage: shared.orchestrator_stage,
      nextCapability: determineNextCapability(shared),
    });
  }

  // Default: Execute full agent pipeline up to Human Approval gate
  const pipelineResult = await executePipelineToApproval(shared);

  return NextResponse.json({
    success: true,
    mode: "pipeline_to_approval",
    completedSteps: pipelineResult.completedSteps,
    finalStage: pipelineResult.finalStage,
    decision: shared.decision,
    sharedState: {
      orchestratorStage: shared.orchestrator_stage,
      situation: shared.situation,
      resources: shared.resources,
      reports: shared.reports,
      plans: shared.plans,
      simulation: shared.simulation,
      decision: shared.decision,
    },
  });
}
