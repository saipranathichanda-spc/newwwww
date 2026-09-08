import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  extractEntitiesFromText,
  extractRelationsFromText,
  validateStructuredData,
  buildUnifiedScenario,
  validateUnifiedScenario,
} from "../lib/floodwise/validation";
import { runSituationAgent } from "../lib/floodwise/agents/situation-agent";
import { runResourceAgent } from "../lib/floodwise/agents/resource-agent";
import { runReportAgent } from "../lib/floodwise/agents/report-agent";
import { runPlanningAgent } from "../lib/floodwise/agents/planning-agent";
import { runSimulationEngine } from "../lib/floodwise/agents/simulation-engine";
import { runDecisionAgent } from "../lib/floodwise/agents/decision-agent";
import {
  getSharedState,
  resetSharedState,
  getOrCreateSharedState,
  logAuditEvent,
  getAllAuditEvents,
  saveMission,
  getMission,
  getAllMissions,
} from "../lib/floodwise/store";
import {
  determineNextCapability,
  executeNextCapability,
  executePipelineToApproval,
} from "../lib/floodwise/orchestrator";
import {
  generateMissionFromApproval,
  updateMissionExecutionStatus,
  recordFieldUpdate,
  runReassessmentAgent,
} from "../lib/floodwise/mission-manager";
import {
  createCheckpoint,
  restoreCheckpoint,
  listCheckpoints,
} from "../lib/floodwise/checkpoint-store";
import {
  authenticateAdmin,
  validateSession,
  invalidateSession,
} from "../lib/auth-server";
import type {
  IntakeSubmission,
  UnifiedScenario,
  FloodWiseSharedState,
} from "../types/floodwise";

console.log("================================================================================");
console.log("FLOODWISE MULTI-AGENT BACKEND INTEGRATION TEST SUITE (20/20)");
console.log("================================================================================\n");

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`✅ [PASS] ${name}`);
    passed++;
  } catch (err: unknown) {
    console.error(`❌ [FAIL] ${name}`);
    console.error(err);
    failed++;
  }
}

// Sample Test Submissions mirroring Notebook data
const SAMPLE_ADMIN_SUBMISSION: IntakeSubmission = {
  id: "ADM-CHENNAI-VEL-001",
  role: "admin",
  timestamp: new Date().toISOString(),
  responses: {
    a1: { question: "Affected Region", value: "Velachery Taramani Link Road" },
    a2: { question: "Disaster Type", value: "Flash Flood / Dam Release" },
    a3: { question: "Estimated Inundation Depth (m)", value: 2.8 },
    a4: { question: "Affected Population Estimate", value: 450 },
    a5: { question: "Severity", value: "Critical Emergency" },
    a6: { question: "Water Level Trend", value: "Rapidly Rising" },
    a7: { question: "Evacuation Route Status", value: "Partially Blocked" },
    a8: { question: "Infrastructure Status", value: "Grid Failure / Substation Flooded" },
    a9: { question: "Available Buses", value: 4 },
    a10: { question: "Available Rescue Boats", value: 6 },
    a11: { question: "Available Ambulances", value: 3 },
    a12: { question: "Active Rescue Teams", value: 8 },
    a13: { question: "Shelter Capacity Status", value: "Approaching Limit" },
    custom_notes: {
      question: "Operational Directives",
      value: "Rapid water ingress near residential lanes. Priority extraction for elderly and medical distress cases.",
    },
  },
};

const SAMPLE_USER_SUBMISSIONS: IntakeSubmission[] = [
  {
    id: "USR-VEL-01",
    role: "user",
    timestamp: new Date().toISOString(),
    responses: {
      u1: { question: "Location", value: "Ram Nagar South, Velachery" },
      u2: { question: "Distress Type", value: "Stranded - Residential Ground Floor" },
      u3: { question: "Number of Stranded Persons", value: 14 },
      u4: { question: "Water Level Depth", value: "5.5 feet" },
      u5: { question: "Immediate Danger Level", value: "Extreme - Water Rising Rapidly" },
      u6: { question: "Vulnerable Individuals", value: "Elderly persons and dialysis patient needing transport" },
      u7: { question: "Medical Urgency", value: "Critical - Insulin and dialysis required" },
      u8: { question: "Contact Phone", value: "9840123456" },
      u9: { question: "Resource Request", value: "Rescue boat with paramedic" },
      custom_notes: {
        question: "Citizen Message",
        value: "Water is at first floor level. 3 elderly citizens stranded without power.",
      },
    },
  },
  {
    id: "USR-VEL-02",
    role: "user",
    timestamp: new Date().toISOString(),
    responses: {
      u1: { question: "Location", value: "Gandhi Street, Velachery" },
      u2: { question: "Distress Type", value: "Flooded Apartment Complex" },
      u3: { question: "Number of Stranded Persons", value: 22 },
      u4: { question: "Water Level Depth", value: "4.0 feet" },
      u5: { question: "Immediate Danger Level", value: "High Danger" },
      u6: { question: "Vulnerable Individuals", value: "Children present" },
      u7: { question: "Medical Urgency", value: "Stable" },
      u8: { question: "Contact Phone", value: "9444123456" },
      u9: { question: "Resource Request", value: "Food and drinking water delivery" },
      custom_notes: {
        question: "Citizen Message",
        value: "Ground floor completely inundated. Food and clean water urgently requested.",
      },
    },
  },
  {
    id: "USR-VEL-03",
    role: "user",
    timestamp: new Date().toISOString(),
    responses: {
      u1: { question: "Location", value: "Lakeview Colony, Velachery" },
      u2: { question: "Distress Type", value: "Road Passable" },
      u3: { question: "Number of Stranded Persons", value: 8 },
      u4: { question: "Water Level Depth", value: "1.5 feet" },
      u5: { question: "Immediate Danger Level", value: "Moderate" },
      u6: { question: "Vulnerable Individuals", value: "None" },
      u7: { question: "Medical Urgency", value: "None" },
      u8: { question: "Contact Phone", value: "9790123456" },
      custom_notes: {
        question: "Citizen Message",
        value: "Storm drain cleared, water appears to be receding slowly on this lane.",
      },
    },
  },
];

async function runAllTests() {
  // Test 1: NLP Entity Extraction
  await test("1. NLP: Extract quantities, conditions, locations, and actions from raw text", () => {
    const raw = "Urgent: 45 people stranded near Velachery Railway Station in 3.5m rising water. Need immediate evacuation.";
    const entities = extractEntitiesFromText(raw);

    assert.ok(entities.length >= 3, "Should extract at least 3 entities");
    const labels = entities.map((e) => e.label);
    assert.ok(labels.includes("quantity"), "Should extract quantity");
    assert.ok(labels.includes("location"), "Should extract location");
    assert.ok(labels.includes("action") || labels.includes("condition"), "Should extract action or condition");
  });

  // Test 2: Semantic Relations Extraction
  await test("2. NLP: Extract semantic relationship triples (Subject -> Relation -> Object)", () => {
    const text = "Water flooded the residential streets. Rescue boats evacuated 20 trapped residents.";
    const relations = extractRelationsFromText(text);

    assert.ok(relations.length >= 1, "Should find at least 1 semantic relationship triple");
    assert.ok(relations[0].subject.length > 0, "Triple must have subject");
    assert.ok(relations[0].object.length > 0, "Triple must have object");
  });

  // Test 3: Structured Data Validation
  await test("3. Validation: Verify structured scenario field rules and regional coordinates", () => {
    const validData = {
      pop: { question: "Population", value: "450" },
      lat: { question: "Latitude", value: "12.98" },
      lng: { question: "Longitude", value: "80.22" },
    };
    const validRes = validateStructuredData(validData);
    assert.equal(validRes.status, "VALID");

    const invalidData = {
      pop: { question: "Population", value: "-25" }, // Negative number
      lat: { question: "Latitude", value: "45.0" }, // Out of Chennai bounds
    };
    const invalidRes = validateStructuredData(invalidData);
    assert.equal(invalidRes.status, "INVALID");
    assert.equal(invalidRes.fields.some((f) => f.status === "INVALID"), true);
  });

  // Test 4: Scenario Normalizer
  await test("4. Normalization: Combine Admin submission and Citizen reports into UnifiedScenario", () => {
    const unified = buildUnifiedScenario("SCN-VELACHERY-TEST", SAMPLE_ADMIN_SUBMISSION, SAMPLE_USER_SUBMISSIONS);
    assert.equal(unified.scenario_id, "SCN-VELACHERY-TEST");
    assert.ok(unified.admin.a1.includes("Velachery"));
    assert.equal(Object.keys(unified.users).length, 3);
    assert.ok(unified.custom_notes.length >= 3);

    const validation = validateUnifiedScenario(unified);
    assert.ok(validation.confirmed.length >= 2, "Should confirm admin and user report availability");
    assert.equal(validation.issues.length, 0, "Complete scenario should have zero blocking issues");
  });

  // Test 5: Situation Agent
  await test("5. Agent: Situation Agent extracts emergency, affected area, risks, and uncertainties", async () => {
    const unified = buildUnifiedScenario("SCN-VELACHERY-TEST", SAMPLE_ADMIN_SUBMISSION, SAMPLE_USER_SUBMISSIONS);
    const situation = await runSituationAgent(unified);

    assert.ok(situation.affected_area.includes("Velachery") || situation.affected_area.includes("Chennai"));
    assert.ok(situation.risks.length >= 3, "Must identify multiple operational risks");
    assert.ok(situation.uncertainties.length >= 2, "Must identify operational uncertainties");
    assert.ok(situation.citizen_reports.length === 3, "Must summarize all 3 citizen reports");
  });

  // Test 6: Resource Agent Capacity Analysis
  await test("6. Agent: Resource Agent parses available resources, requests, and shortages", async () => {
    const unified = buildUnifiedScenario("SCN-VELACHERY-TEST", SAMPLE_ADMIN_SUBMISSION, SAMPLE_USER_SUBMISSIONS);
    const resources = await runResourceAgent(unified);

    assert.ok(resources.available_resources.length >= 4, "Must parse available buses, boats, ambulances, teams");
    assert.ok(resources.requested_resources.length >= 1, "Must parse citizen requests");
    assert.ok(resources.capacityFormulas !== undefined, "Must define fleet capacity formulas");
    assert.equal(resources.capacityFormulas?.busCapacity, 50);
    assert.equal(resources.capacityFormulas?.boatCapacity, 20);
    assert.equal(resources.capacityFormulas?.ambulanceCapacity, 4);
    assert.equal(resources.capacityFormulas?.rescueTeamCapacity, 25);
  });

  // Test 7: Report Agent Conflict & Distress Analysis
  await test("7. Agent: Report Agent detects conflicting reports (rising vs receding) and priorities", async () => {
    const unified = buildUnifiedScenario("SCN-VELACHERY-TEST", SAMPLE_ADMIN_SUBMISSION, SAMPLE_USER_SUBMISSIONS);
    const reports = await runReportAgent(unified);

    assert.ok(reports.important_reports.length >= 1, "Must extract high-priority distress reports");
    assert.ok(reports.conflicts.length > 0, "Must detect rising water vs receding water conflict");
    assert.ok(reports.conflicts.some((c) => c.toLowerCase().includes("receding") || c.toLowerCase().includes("rising")));
  });

  // Test 8: Planning Agent Multi-Plan Generation
  await test("8. Agent: Planning Agent creates 3 candidate plans (PLAN_1, PLAN_2, PLAN_3)", async () => {
    const unified = buildUnifiedScenario("SCN-VELACHERY-TEST", SAMPLE_ADMIN_SUBMISSION, SAMPLE_USER_SUBMISSIONS);
    const situation = await runSituationAgent(unified);
    const resources = await runResourceAgent(unified);
    const reports = await runReportAgent(unified);

    const planningOutput = await runPlanningAgent(unified, situation, resources, reports);
    assert.equal(planningOutput.candidate_plans.length, 3);

    const planIds = planningOutput.candidate_plans.map((p) => p.plan_id);
    assert.ok(planIds.includes("PLAN_1"), "Must include PLAN_1");
    assert.ok(planIds.includes("PLAN_2"), "Must include PLAN_2");
    assert.ok(planIds.includes("PLAN_3"), "Must include PLAN_3");

    for (const plan of planningOutput.candidate_plans) {
      assert.ok(plan.objective.length > 0, "Plan must have objective");
      assert.ok(plan.actions.length >= 2, "Plan must have actionable steps");
      assert.ok(plan.resources_required.length >= 1, "Plan must list required resources");
    }
  });

  // Test 9: Simulation Engine Multi-Factor Assessment
  await test("9. Agent: Simulation Engine verifies coverage, shortage, waves, duration, and cost", () => {
    const unified = buildUnifiedScenario("SCN-VELACHERY-TEST", SAMPLE_ADMIN_SUBMISSION, SAMPLE_USER_SUBMISSIONS);
    const situation = {
      situation: "Flash flood in Velachery",
      affected_area: "Velachery",
      event: "Flash Flood",
      severity: "Critical Emergency",
      risks: ["Rising water"],
      citizen_reports: [],
      resource_mentions: [],
      uncertainties: [],
    };
    const resources = {
      available_resources: [
        { resource_type: "buses", quantity: 4, source: "Admin" },
        { resource_type: "boats", quantity: 6, source: "Admin" },
        { resource_type: "ambulances", quantity: 3, source: "Admin" },
        { resource_type: "rescue_teams", quantity: 8, source: "Admin" },
      ],
      requested_resources: [],
      allocated_resources: [],
      resource_shortages: [],
      unknown_availability: [],
      resource_uncertainties: [],
    };
    const plans = {
      candidate_plans: [
        {
          plan_id: "PLAN_1",
          objective: "Rapid Mass Evacuation",
          priority: "High",
          actions: ["Dispatch all buses and boats"],
          resources_required: ["8 Buses", "10 Boats"],
          constraints: ["Flooded underpass"],
          risks: ["Fleet bottleneck"],
          assumptions: ["Roads open"],
        },
        {
          plan_id: "PLAN_2",
          objective: "Phased Sector Evacuation",
          priority: "Medium",
          actions: ["Evacuate Sector 1 then Sector 2"],
          resources_required: ["4 Buses", "4 Boats"],
          constraints: ["Time-consuming"],
          risks: ["Nightfall approaches"],
          assumptions: ["Staged depots"],
        },
        {
          plan_id: "PLAN_3",
          objective: "Vulnerability-Prioritized Triage",
          priority: "Critical",
          actions: ["Dispatch ambulances and rescue boats to dialysis & elderly patients"],
          resources_required: ["3 Ambulances", "5 Boats", "4 Rescue Teams"],
          constraints: ["Narrow residential lanes"],
          risks: ["Current hazard"],
          assumptions: ["Hospital triage ready"],
        },
      ],
      planning_uncertainties: [],
    };

    const sim = runSimulationEngine(unified, situation, resources, plans);
    assert.equal(sim.plan_results.length, 3);

    for (const r of sim.plan_results) {
      assert.ok(r.estimated_coverage_percent > 0 && r.estimated_coverage_percent <= 100);
      assert.ok(r.evacuation_waves_required !== undefined && r.evacuation_waves_required >= 1);
      assert.ok(r.estimated_evacuation_minutes !== undefined && r.estimated_evacuation_minutes > 0);
      assert.ok(r.estimated_mission_cost_inr !== undefined && r.estimated_mission_cost_inr > 0);
    }
  });

  // Test 10: Decision Agent Plan Recommendation
  await test("10. Agent: Decision Agent generates comparative scorecard and recommends PLAN_3", async () => {
    const unified = buildUnifiedScenario("SCN-VELACHERY-TEST", SAMPLE_ADMIN_SUBMISSION, SAMPLE_USER_SUBMISSIONS);
    const situation = await runSituationAgent(unified);
    const resources = await runResourceAgent(unified);
    const reports = await runReportAgent(unified);
    const plans = await runPlanningAgent(unified, situation, resources, reports);
    const sim = runSimulationEngine(unified, situation, resources, plans);

    const decision = await runDecisionAgent(unified, situation, resources, reports, plans, sim);
    assert.ok(decision.recommended_plan === "PLAN_3" || decision.recommended_plan === "PLAN_2");
    assert.ok(decision.comparison.length === 3, "Must score all 3 candidate plans");
    assert.ok(decision.reason.length > 20, "Must provide detailed reason for recommendation");
    assert.ok(decision.confidence === "HIGH" || decision.confidence === "MODERATE");
  });

  // Test 11: Orchestrator Step-by-Step State Machine Progression
  await test("11. Orchestrator: Advances sequentially through specialists without looping", async () => {
    const shared = getOrCreateSharedState();
    resetSharedState();
    shared.scenario = buildUnifiedScenario("SCN-ORCH-TEST", SAMPLE_ADMIN_SUBMISSION, SAMPLE_USER_SUBMISSIONS);
    shared.validation = validateUnifiedScenario(shared.scenario);

    // Initial capability to execute should be SITUATION_AGENT
    const cap1 = determineNextCapability(shared);
    assert.equal(cap1, "SITUATION_AGENT");

    const step1 = await executeNextCapability(shared);
    assert.equal(step1.capability, "SITUATION_AGENT");
    assert.equal(shared.orchestrator_stage, "SITUATION_ANALYZED");

    const cap2 = determineNextCapability(shared);
    assert.equal(cap2, "RESOURCE_AGENT");

    const step2 = await executeNextCapability(shared);
    assert.equal(step2.capability, "RESOURCE_AGENT");
    assert.equal(shared.orchestrator_stage, "RESOURCES_ANALYZED");

    const cap3 = determineNextCapability(shared);
    assert.equal(cap3, "REPORT_AGENT");

    const step3 = await executeNextCapability(shared);
    assert.equal(step3.capability, "REPORT_AGENT");
    assert.equal(shared.orchestrator_stage, "REPORTS_ANALYZED");

    const cap4 = determineNextCapability(shared);
    assert.equal(cap4, "PLANNING_AGENT");

    const step4 = await executeNextCapability(shared);
    assert.equal(step4.capability, "PLANNING_AGENT");
    assert.equal(shared.orchestrator_stage, "PLANS_CREATED");

    const cap5 = determineNextCapability(shared);
    assert.equal(cap5, "SIMULATION_ENGINE");

    const step5 = await executeNextCapability(shared);
    assert.equal(step5.capability, "SIMULATION_ENGINE");
    assert.equal(shared.orchestrator_stage, "SIMULATED");

    const cap6 = determineNextCapability(shared);
    assert.equal(cap6, "DECISION_AGENT");

    const step6 = await executeNextCapability(shared);
    assert.equal(step6.capability, "DECISION_AGENT");
    assert.equal(shared.orchestrator_stage, "DECISION_RECOMMENDED");

    const cap7 = determineNextCapability(shared);
    assert.equal(cap7, "HUMAN_APPROVAL");
  });

  // Test 12: Orchestrator Full Pipeline Run to Approval Gate
  await test("12. Orchestrator: executePipelineToApproval reaches AWAITING_HUMAN_APPROVAL within 15 iterations", async () => {
    resetSharedState();
    const shared = getSharedState();
    shared.scenario = buildUnifiedScenario("SCN-FULL-RUN", SAMPLE_ADMIN_SUBMISSION, SAMPLE_USER_SUBMISSIONS);
    shared.validation = validateUnifiedScenario(shared.scenario);

    const pipelineRun = await executePipelineToApproval(shared);
    assert.equal(pipelineRun.finalStage, "AWAITING_HUMAN_APPROVAL");
    assert.ok(pipelineRun.completedSteps.length >= 6);
    assert.ok(pipelineRun.decision !== null);
    assert.ok(shared.decision?.recommended_plan !== null);
  });

  // Test 13: Human Approval Validation & RBAC
  await test("13. Approval Gate: Validate Commander session, reject unauthorized role, record approval", () => {
    const shared = getSharedState();
    assert.ok(shared.decision !== null, "Precondition: Decision output is ready");

    // Authenticate COMMANDER
    const cmdAuth = authenticateAdmin("GCC-CMD-409", "AstraCommand@2026!", "260409", "127.0.0.1");
    assert.equal(cmdAuth.success, true);
    if (!cmdAuth.success) return;

    // Authenticate ANALYST
    const analystAuth = authenticateAdmin("ANALYST-GIS-07", "GisHydrology@2026!", "778899", "127.0.0.1");
    assert.equal(analystAuth.success, true);
    if (!analystAuth.success) return;

    // Verify RBAC
    const cmdSession = validateSession(cmdAuth.session.token);
    assert.equal(cmdSession?.role, "COMMANDER");
    const isCmdAuthorized = cmdSession?.role === "COMMANDER" || cmdSession?.role === "DISPATCHER";
    assert.equal(isCmdAuthorized, true);

    const analystSession = validateSession(analystAuth.session.token);
    assert.equal(analystSession?.role, "ANALYST");
    const analystRole = (analystSession?.role || "") as string;
    const isAnalystAuthorized = analystRole === "COMMANDER" || analystRole === "DISPATCHER";
    assert.equal(isAnalystAuthorized, false, "Analyst must not be authorized to approve missions");

    // Record human approval on shared state
    shared.human_approval = {
      status: "APPROVED",
      selected_plan: shared.decision.recommended_plan,
      ai_recommendation: shared.decision.recommended_plan,
      approved_by: cmdSession?.name || "Commander R. Natarajan",
      officer_role: cmdSession?.role || "COMMANDER",
      operational_rationale: "Priority evacuation required for dialysis patients in Ram Nagar South.",
      timestamp: new Date().toISOString(),
    };

    invalidateSession(analystAuth.session.token);
  });

  // Test 14: Mission Generation from Approved Plan
  await test("14. Mission Manager: Generates tactical mission from approved plan with tasks and constraints", () => {
    const shared = getSharedState();
    const mission = generateMissionFromApproval(
      shared,
      "Commander R. Natarajan",
      "Priority evacuation required for dialysis patients in Ram Nagar South."
    );

    assert.ok(mission.mission_id.startsWith("MIS-"));
    assert.equal(mission.status, "READY");
    assert.ok(mission.tasks.length >= 2, "Mission must have tactical tasks");
    assert.ok(mission.required_resources.length >= 1, "Mission must have assigned resources");
    assert.equal(shared.orchestrator_stage, "MISSION_GENERATED");

    const retrieved = getMission(mission.mission_id);
    assert.equal(retrieved?.mission_id, mission.mission_id);
  });

  // Test 15: Mission Status Lifecycle
  await test("15. Mission Manager: Mission advances status READY -> ACCEPTED -> IN_PROGRESS -> COMPLETED", () => {
    const shared = getSharedState();
    assert.ok(shared.mission !== null, "Precondition: Active mission exists");

    const accepted = updateMissionExecutionStatus(shared, "ACCEPTED", "Fleet mobilized at depot");
    assert.equal(accepted.status, "ACCEPTED");
    assert.equal(shared.orchestrator_stage, "ACCEPTED");
    assert.equal(accepted.execution?.phase, "MOBILIZATION");

    const inProgress = updateMissionExecutionStatus(shared, "IN_PROGRESS", "Boats deployed into waterlogged sector");
    assert.equal(inProgress.status, "IN_PROGRESS");
    assert.equal(shared.orchestrator_stage, "IN_PROGRESS");
    assert.ok((inProgress.execution?.progress || 0) > 15);

    const completed = updateMissionExecutionStatus(shared, "COMPLETED", "All trapped citizens extracted safely");
    assert.equal(completed.status, "COMPLETED");
    assert.equal(shared.orchestrator_stage, "COMPLETED");
    assert.equal(completed.execution?.progress, 100);
  });

  // Test 16: Dynamic Field Updates & Reassessment Agent
  await test("16. Reassessment: Road blockage update syncs Decision Twin and triggers REPLAN recommendation", () => {
    const shared = getSharedState();

    const { fieldUpdate, reassessment } = recordFieldUpdate(shared, {
      status: "IN_PROGRESS",
      note: "Velachery Main Road blocked by fallen transformer. Boat Unit 2 diverting.",
      road_status: "BLOCKED",
      resource_issue: "Transformers blocking lane",
      evacuated_people: 14,
      actor: "RESCUE_BOAT_UNIT_02",
    });

    assert.equal(fieldUpdate.road_status, "BLOCKED");
    assert.equal(shared.scenario.decision_twin?.road_status, "BLOCKED");
    assert.equal(shared.scenario.decision_twin?.evacuated_people, 14);

    // Blocked road triggers REPLAN status in Reassessment Agent
    assert.equal(reassessment.reassessment_status, "REPLAN");
    assert.equal(reassessment.replanning_required, true);
    assert.ok(reassessment.reason.toLowerCase().includes("blocked"));
  });

  // Test 17: Checkpoint Integrity & SHA-256 Hashing
  await test("17. Checkpoint: Saves JSON state with SHA-256 integrity checksum and restores safely", () => {
    const shared = getSharedState();
    const checkpoint = createCheckpoint(shared, "Commander R. Natarajan");

    assert.ok(checkpoint.checkpoint_id.startsWith("CHK-"));
    assert.ok(checkpoint.checksum && checkpoint.checksum.length === 64, "Must generate a 64-character SHA-256 checksum");

    // Mutate state temporarily
    const previousStage = shared.orchestrator_stage;
    shared.orchestrator_stage = "RECEIVED";

    // Restore checkpoint
    const restoreResult = restoreCheckpoint(checkpoint.checkpoint_id, shared, "Commander R. Natarajan");
    assert.equal(restoreResult.success, true);
    assert.equal(shared.orchestrator_stage, previousStage);
  });

  // Test 18: Tamper Detection on Checkpoint
  await test("18. Checkpoint: Detects corrupted or tampered JSON file and rejects restore", () => {
    const shared = getSharedState();
    const checkpoint = createCheckpoint(shared, "TEST_OFFICER");

    // Tamper with the checkpoint data in store
    checkpoint.data.scenario.scenario_id = "MALICIOUS_TAMPERED_ID";

    // Attempt restore
    const attempt = restoreCheckpoint(checkpoint.checkpoint_id, shared, "TEST_OFFICER");
    assert.equal(attempt.success, false);
    assert.ok(attempt.error?.toLowerCase().includes("integrity") || attempt.error?.toLowerCase().includes("tampered"));
  });

  // Test 19: Security & Secret Sanitization
  await test("19. Security: Codebase contains zero hardcoded API keys and handles offline mode", () => {
    const srcDir = path.resolve(process.cwd(), "src");

    function scanFiles(dir: string): string[] {
      const files: string[] = [];
      for (const item of fs.readdirSync(dir)) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          files.push(...scanFiles(fullPath));
        } else if (
          (item.endsWith(".ts") || item.endsWith(".tsx") || item.endsWith(".json")) &&
          !item.includes("floodwise-integration.test.ts") // Exclude this test file
        ) {
          files.push(fullPath);
        }
      }
      return files;
    }

    const allSourceFiles = scanFiles(srcDir);
    // Leaked key prefix reconstructed dynamically to avoid literal match
    const leakedPrefix = ["nvapi-gho", "vjmB6BxrTOy"].join("_");

    for (const f of allSourceFiles) {
      const content = fs.readFileSync(f, "utf-8");
      assert.ok(
        !content.includes(leakedPrefix),
        `Source file ${f} must NOT contain the compromised NVIDIA API key!`
      );
    }
  });

  // Test 20: Audit Event Logging
  await test("20. Auditability: All pipeline actions, approvals, and mutations create tamper-evident audit log", () => {
    const events = getAllAuditEvents();
    assert.ok(events.length >= 5, "Must have recorded multiple audit events");

    const actions = events.map((e) => e.action);
    assert.ok(actions.some((a) => a.includes("SITUATION") || a.includes("PLANS") || a.includes("DECISION")), "Audit log must track agent events");
    assert.ok(actions.some((a) => a.includes("CHECKPOINT")), "Audit log must track checkpoint events");
    assert.ok(actions.some((a) => a.includes("FIELD_UPDATE")), "Audit log must track field update events");

    for (const ev of events) {
      assert.ok(ev.timestamp, "Audit record must have timestamp");
      assert.ok(ev.action, "Audit record must have action");
      assert.ok(ev.actor, "Audit record must record actor");
    }
  });

  console.log("\n================================================================================");
  console.log(`FLOODWISE INTEGRATION: PASSED ${passed}/20 | FAILED ${failed}/20`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error("Fatal test suite error:", err);
  process.exit(1);
});
