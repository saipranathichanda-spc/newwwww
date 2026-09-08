/**
 * FloodWise Safe Checkpointing System
 * Ported from Notebook Cells 70-75.
 * Replaces Colab pickle with schema-validated, versioned JSON checkpoint records and SHA-256 integrity verification.
 */

import crypto from "crypto";
import { FloodWiseCheckpoint, FloodWiseSharedState } from "@/types/floodwise";
import { saveCheckpointRecord, getCheckpointRecord, getAllCheckpoints, logAuditEvent } from "./store";

function computeChecksum(data: any): string {
  const json = JSON.stringify(data);
  return crypto.createHash("sha256").update(json).digest("hex");
}

/**
 * Save a safe versioned checkpoint snapshot of current FloodWise state.
 * Mirrors Notebook Cell 70.
 */
export function createCheckpoint(
  sharedState: FloodWiseSharedState,
  savedBy = "OFFICER"
): FloodWiseCheckpoint {
  const now = new Date().toISOString();
  const version = (sharedState.state_version || 1);
  const checkpointId = `CHK-${Date.now().toString(36).toUpperCase()}-V${version}`;

  const snapshotData = {
    scenario: JSON.parse(JSON.stringify(sharedState.scenario)),
    validation: JSON.parse(JSON.stringify(sharedState.validation)),
    shared_state: JSON.parse(JSON.stringify(sharedState)),
  };

  const checksum = computeChecksum(snapshotData);

  const checkpoint: FloodWiseCheckpoint = {
    checkpoint_id: checkpointId,
    scenario_id: sharedState.scenario.scenario_id,
    version,
    saved_at: now,
    saved_by: savedBy,
    data: snapshotData,
    checksum,
  };

  saveCheckpointRecord(checkpoint);
  logAuditEvent("CHECKPOINT_CREATED", savedBy, "COMMANDER", `Created versioned state checkpoint ${checkpointId} (V${version})`);

  return checkpoint;
}

/**
 * Restore state from a verified checkpoint.
 * Mirrors Notebook Cell 73.
 */
export function restoreCheckpoint(
  checkpointId: string,
  targetSharedState: FloodWiseSharedState,
  restoredBy = "OFFICER"
): { success: boolean; error?: string; checkpoint?: FloodWiseCheckpoint } {
  const checkpoint = getCheckpointRecord(checkpointId);
  if (!checkpoint) {
    return { success: false, error: `Checkpoint "${checkpointId}" not found.` };
  }

  // Verify integrity
  if (checkpoint.checksum) {
    const computed = computeChecksum(checkpoint.data);
    if (computed !== checkpoint.checksum) {
      logAuditEvent("CHECKPOINT_CORRUPTION_DETECTED", restoredBy, "SECURITY", `Checksum mismatch on checkpoint ${checkpointId}`);
      return { success: false, error: "Checkpoint integrity verification failed: corrupt or tampered data." };
    }
  }

  const restored = checkpoint.data.shared_state;

  // Restore fields into active shared state
  targetSharedState.scenario = restored.scenario;
  targetSharedState.validation = restored.validation;
  targetSharedState.situation = restored.situation;
  targetSharedState.resources = restored.resources;
  targetSharedState.reports = restored.reports;
  targetSharedState.plans = restored.plans;
  targetSharedState.simulation = restored.simulation;
  targetSharedState.decision = restored.decision;
  targetSharedState.human_approval = restored.human_approval;
  targetSharedState.mission = restored.mission;
  targetSharedState.field_updates = restored.field_updates || [];
  targetSharedState.reassessment = restored.reassessment || null;
  targetSharedState.state_version = restored.state_version;
  targetSharedState.analysis_version = restored.analysis_version;
  targetSharedState.orchestrator_stage = restored.orchestrator_stage;

  logAuditEvent("CHECKPOINT_RESTORED", restoredBy, "COMMANDER", `Restored state to checkpoint ${checkpointId} (Version ${checkpoint.version})`);

  return { success: true, checkpoint };
}

export function listCheckpoints(): FloodWiseCheckpoint[] {
  return getAllCheckpoints();
}
