/**
 * FloodWise Persistent State Store
 * Manages intake submissions, unified scenario states, active missions, field updates, and audit logs.
 */

import {
  IntakeSubmission,
  UnifiedScenario,
  FloodWiseSharedState,
  Mission,
  FieldUpdate,
  AuditEvent,
  FloodWiseCheckpoint,
  ReassessmentResult,
} from "@/types/floodwise";
import { buildUnifiedScenario, validateUnifiedScenario } from "./validation";

// In-memory runtime cache
let currentScenario: UnifiedScenario | null = null;
let currentSharedState: FloodWiseSharedState | null = null;
const SUBMISSIONS: IntakeSubmission[] = [];
const MISSIONS = new Map<string, Mission>();
const AUDIT_EVENTS: AuditEvent[] = [];
const CHECKPOINTS = new Map<string, FloodWiseCheckpoint>();

/**
 * Log an auditable event with timestamp, actor, role, and action details.
 */
export function logAuditEvent(
  action: string,
  actor: string,
  role?: string,
  details = "",
  metadata?: Record<string, any>
): AuditEvent {
  const event: AuditEvent = {
    event_id: `EVT-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    action,
    actor,
    role,
    details,
    metadata,
  };

  AUDIT_EVENTS.unshift(event);
  if (AUDIT_EVENTS.length > 1000) {
    AUDIT_EVENTS.pop();
  }

  return event;
}

export function getAllAuditEvents(): AuditEvent[] {
  return [...AUDIT_EVENTS];
}

/**
 * Record a new citizen or admin submission.
 */
export function recordIntakeSubmission(submission: IntakeSubmission): IntakeSubmission {
  SUBMISSIONS.unshift(submission);
  logAuditEvent(
    "INTAKE_RECEIVED",
    submission.role.toUpperCase(),
    submission.role,
    `Received submission ${submission.id} with ${Object.keys(submission.responses || {}).length} response fields`
  );
  return submission;
}

export function getAllSubmissions(): IntakeSubmission[] {
  return [...SUBMISSIONS];
}

export function getSubmissionsByRole(role: "admin" | "user"): IntakeSubmission[] {
  return SUBMISSIONS.filter((s) => s.role === role);
}

export function getLatestSubmission(role: "admin" | "user"): IntakeSubmission | null {
  return SUBMISSIONS.find((s) => s.role === role) || null;
}

/**
 * Initialize or get active shared state.
 */
export function getOrCreateSharedState(): FloodWiseSharedState {
  if (currentSharedState) {
    return currentSharedState;
  }

  // Check if we have intake data to build from
  const adminLatest = getLatestSubmission("admin");
  const userSubs = getSubmissionsByRole("user");

  if (!currentScenario) {
    if (adminLatest || userSubs.length > 0) {
      currentScenario = buildUnifiedScenario("SCN001", adminLatest, userSubs);
    } else {
      // Default baseline scenario from Notebook Cell 27
      currentScenario = {
        scenario_id: "SCN001",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        admin: {
          a1: "Central Riverside Zone, Chennai",
          a2: "Flash Flood / Dam Release",
          a3: 2000,
          a4: 797,
          a5: "Critical Emergency",
          a6: "Rapidly Rising",
          a7: "Partially Submerged / Blocked",
          a8: "Grid Failure / Substation Flooded",
          a9: 4,
          a10: 7,
          a11: 5,
          a12: 10,
          a13: "Capacity Exhausted / Overflowing",
          a14: "Maximize Total Lives Saved",
          a15: "Within 6 Hours",
          a16: "Elderly, Infants & Medical Patients First",
          custom_notes: "We are required to save most of the people within the radial elevation corridor.",
        },
        users: {
          user_01_velachery: {
            u1: "Velachery Junction, Chennai",
            u2: "Stranded on elevated highway",
            u3: 78,
            u4: "Critically Injured / Medical Emergency",
            u5: "High - Immediate danger to life",
            u6: "Receding",
            u7: "Unsure / Dangerous current",
            u8: "Drinking Water & Food Supplies",
            custom_notes: "Need emergency food and medical assistance for injured victims.",
          },
          user_02_adyar: {
            u1: "Adyar Low Basin, Chennai",
            u2: "Water entering ground floor",
            u3: 3,
            u4: "Elderly or Infants Present",
            u5: "High - Immediate danger to life",
            u6: "Rising Quickly",
            u7: "No, completely cut off by water",
            u8: "Boat / Evacuation Transport",
            custom_notes: "Water rising fast, elderly grandfather cannot walk through flood current.",
          },
          user_03_tambaram: {
            u1: "Tambaram East Canal, Chennai",
            u2: "Trapped on rooftop / upper floor",
            u3: 5,
            u4: "Elderly or Infants Present",
            u5: "High - Immediate danger to life",
            u6: "Rising Quickly",
            u7: "Unsure / Dangerous current",
            u8: "Drinking Water & Food Supplies",
            custom_notes: "Trapped on rooftop with infants, water level nearing 1.5 meters.",
          },
        },
        custom_notes: [
          {
            user_id: "user_01_velachery",
            text: "Need emergency food and medical assistance for injured victims.",
            entities: [
              { text: "need", label: "condition", score: 0.71 },
              { text: "food", label: "condition", score: 0.704 },
            ],
          },
          {
            user_id: "user_02_adyar",
            text: "Water rising fast, elderly grandfather cannot walk through flood current.",
            entities: [
              { text: "very", label: "condition", score: 0.915 },
              { text: "hard", label: "condition", score: 0.958 },
              { text: "situation", label: "condition", score: 0.969 },
            ],
          },
        ],
        relations: {
          user_01_velachery: [{ subject: "need", object: "food" }],
          user_02_adyar: [],
          user_03_tambaram: [{ subject: "need", object: "water" }],
        },
        decision_twin: {},
      };
    }
  }

  const validation = validateUnifiedScenario(currentScenario);

  currentSharedState = {
    scenario: currentScenario,
    validation,
    situation: null,
    resources: null,
    reports: null,
    plans: null,
    simulation: null,
    decision: null,
    human_approval: null,
    mission: null,
    field_updates: [],
    reassessment: null,
    state_version: 1,
    analysis_version: null,
    orchestrator_stage: "VALIDATED",
    audit_log: getAllAuditEvents(),
  };

  return currentSharedState;
}

export function getSharedState(): FloodWiseSharedState {
  return getOrCreateSharedState();
}

export function updateSharedState(updater: (state: FloodWiseSharedState) => void): FloodWiseSharedState {
  const state = getOrCreateSharedState();
  updater(state);
  return state;
}

export function resetSharedState(): FloodWiseSharedState {
  currentScenario = null;
  currentSharedState = null;
  return getOrCreateSharedState();
}

/**
 * Missions
 */
export function saveMission(mission: Mission): Mission {
  MISSIONS.set(mission.mission_id, mission);
  logAuditEvent("MISSION_SAVED", mission.responsible_officer || "COMMANDER", "COMMANDER", `Mission ${mission.mission_id} saved in state ${mission.status}`);
  return mission;
}

export function getMission(missionId: string): Mission | null {
  return MISSIONS.get(missionId) || null;
}

export function getAllMissions(): Mission[] {
  return Array.from(MISSIONS.values());
}

/**
 * Checkpoints
 */
export function saveCheckpointRecord(checkpoint: FloodWiseCheckpoint): FloodWiseCheckpoint {
  CHECKPOINTS.set(checkpoint.checkpoint_id, checkpoint);
  logAuditEvent("CHECKPOINT_SAVED", checkpoint.saved_by, "ADMIN", `Saved checkpoint ${checkpoint.checkpoint_id} (Version ${checkpoint.version})`);
  return checkpoint;
}

export function getCheckpointRecord(checkpointId: string): FloodWiseCheckpoint | null {
  return CHECKPOINTS.get(checkpointId) || null;
}

export function getAllCheckpoints(): FloodWiseCheckpoint[] {
  return Array.from(CHECKPOINTS.values()).sort(
    (a, b) => new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime()
  );
}
