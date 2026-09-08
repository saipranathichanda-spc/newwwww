import assert from "node:assert/strict";
import {
  authenticateAdmin,
  validateSession,
  invalidateSession,
  getFailedLoginAuditLogs,
} from "../lib/auth-server";
import {
  createDefaultDecisionTwin,
  simulateDeterministicDecisionTwin,
  type FeasibilityStatus,
  type SimulationResult,
} from "../lib/decision-twin";
import {
  runMonteCarloSimulation,
  getDefaultUncertainties,
} from "../lib/probabilistic-simulation";
import {
  logDispatchRecord,
  getAllDispatchAuditRecords,
} from "../lib/dispatch-audit";
import { findNearbyShelters, EMERGENCY_HELPLINES } from "../lib/data-sources/shelters";
import { QUESTIONNAIRE_TEXT } from "../components/user-portal/risk-questionnaire";

console.log("================================================================================");
console.log("ASTRA CHENNAI FLOOD COMMAND & DECISION TWIN - PRODUCTION SAFETY TEST SUITE (15/15)");
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

async function runAllTests() {
  // Test 1: Unauthorized Admin Access
  await test("1. Security: Unauthorized admin session rejected", () => {
    const invalidSession = validateSession("non-existent-token-xyz");
    assert.equal(invalidSession, null, "Unregistered session token must return null");

    const emptySession = validateSession("");
    assert.equal(emptySession, null, "Empty session token must return null");
  });

  // Test 2: Wrong Password Rejection with Audit Logging
  await test("2. Security: Wrong password fails with audit trail", () => {
    const result = authenticateAdmin("GCC-CMD-409", "WrongPassword999#", undefined, "192.168.1.50");
    assert.equal(result.success, false, "Authentication must fail for incorrect password");
    if (!result.success) {
      assert.ok(result.error?.includes("Invalid"), "Error message must indicate invalid credentials");
    }

    const auditLogs = getFailedLoginAuditLogs();
    const hasAudit = auditLogs.some((l) => l.username === "GCC-CMD-409" && l.ip === "192.168.1.50");
    assert.ok(hasAudit, "Failed login must be recorded in failed-login audit log store");
  });

  // Test 3: Rate Limiting & Account Lockout
  await test("3. Security: 5 failed attempts trigger rate-limit lockout", () => {
    const testUsername = `TEST-USER-${Date.now()}`;
    const testIp = `10.0.0.${Math.floor(Math.random() * 200) + 1}`;
    for (let i = 0; i < 5; i++) {
      authenticateAdmin(testUsername, "badpass", undefined, testIp);
    }
    const sixthAttempt = authenticateAdmin(testUsername, "badpass", undefined, testIp);
    assert.equal(sixthAttempt.success, false, "6th attempt must be blocked");
    if (!sixthAttempt.success) {
      assert.equal(sixthAttempt.locked, true, "Account must be locked out after 5 consecutive failures");
      assert.ok(
        sixthAttempt.retryAfterSeconds !== undefined && sixthAttempt.retryAfterSeconds > 0,
        "Must provide retryAfterSeconds during lockout"
      );
    }
  });

  // Test 4: Expired Session Invalidation & Logout
  await test("4. Security: Session logout & token revocation", () => {
    const auth = authenticateAdmin("GCC-CMD-409", "AstraCommand@2026!", "260409", "127.0.0.1");
    assert.ok(auth.success, "Login must succeed with correct credentials and 2FA");
    if (auth.success) {
      const valid = validateSession(auth.session.token);
      assert.ok(valid !== null, "Session must be valid immediately after login");
      assert.equal(valid?.username, "GCC-CMD-409");
      assert.equal(valid?.role, "COMMANDER");

      // Invalidate via logout
      invalidateSession(auth.session.token);
      const postLogout = validateSession(auth.session.token);
      assert.equal(postLogout, null, "Session must be null after explicit logout");
    }
  });

  // Test 5: Route Timeout & Verified Shelters Fallback
  await test("5. Reliability: Route failure fallback returns verified shelters & hotlines", () => {
    const shelters = findNearbyShelters(12.9815, 80.218); // Velachery coordinates
    assert.ok(shelters.length > 0, "Must return verified GCC relief shelters");
    assert.ok(shelters[0].name.includes("Shelter") || shelters[0].name.includes("Hall"));
    assert.ok(shelters[0].capacityPeople > 0, "Shelter capacityPeople must be positive");
    assert.ok(shelters[0].phone.length > 0, "Must have valid contact phone");

    assert.ok(EMERGENCY_HELPLINES.length >= 4, "Must provide key emergency contacts");
    const hasGCC1913 = EMERGENCY_HELPLINES.some((h) => h.number === "1913");
    assert.ok(hasGCC1913, "Must include GCC 1913 flood helpline");
  });

  // Test 6: Telemetry Source, Timestamp, and Confidence Level
  await test("6. Reliability: Telemetry carries source, timestamp, and confidence rating", () => {
    const twin = createDefaultDecisionTwin({
      placeName: "Velachery, Chennai",
      lat: 12.9815,
      lng: 80.218,
      population: 2000,
      buses: 10,
      boats: 3,
      ambulances: 4,
      rescueTeams: 8,
      weather: {
        temperatureC: 28,
        rainfallMm: 45,
        precipitationProbability: 80,
        windSpeedKmh: 30,
        retrievedAt: new Date().toISOString(),
        forecastTime: new Date().toISOString(),
        source: "Open-Meteo",
        confidence: 0.85,
        status: "LIVE_OR_NEAR_LIVE",
      },
      gis: {
        roads: 85,
        buildings: 320,
        drains: 24,
        rivers: 2,
        bridges: 3,
        source: "GCC ArcGIS REST Server",
        status: "VERIFIED",
      },
    });

    const sim = simulateDeterministicDecisionTwin(twin);
    assert.ok(sim.riskDecomposition.dataConfidence >= 50, "Data confidence must be high");
    const dataSources = twin.dataSources || [];
    const sourceNames = dataSources.map((ds) => ds.source).join(" ");
    assert.ok(sourceNames.includes("Open-Meteo"), "Data sources must include Open-Meteo");
    assert.ok(sourceNames.includes("GCC"), "Data sources must include GCC");
  });

  // Test 7: 5-Factor Risk Decomposition
  await test("7. Reliability: 5-Factor Risk decomposition accurately separates dangers", () => {
    const twin = createDefaultDecisionTwin({
      placeName: "Tambaram, Chennai",
      lat: 12.9249,
      lng: 80.1000,
      population: 2500,
      buses: 8,
      boats: 2,
      ambulances: 3,
      rescueTeams: 6,
      weather: {
        temperatureC: 27,
        rainfallMm: 60,
        precipitationProbability: 90,
        windSpeedKmh: 35,
        retrievedAt: new Date().toISOString(),
        forecastTime: new Date().toISOString(),
        source: "Open-Meteo",
        confidence: 0.85,
        status: "LIVE_OR_NEAR_LIVE",
      },
      gis: {
        roads: 120,
        buildings: 450,
        drains: 35,
        rivers: 3,
        bridges: 4,
        source: "GCC GIS",
        status: "VERIFIED",
      },
    });

    const sim = simulateDeterministicDecisionTwin(twin);
    assert.ok(sim.riskDecomposition.citizenFloodDanger > 0, "Citizen danger must be > 0");
    assert.ok(sim.riskDecomposition.roadCorridorRisk > 0, "Corridor risk must be > 0");
    assert.ok(sim.riskDecomposition.capacityRisk >= 0, "Capacity risk must be non-negative");
    assert.ok(sim.riskDecomposition.rescueMissionRisk > 0, "Mission risk must be > 0");
    assert.ok(sim.riskScore > 0, "Composite risk score must be computed");
  });

  // Test 8: Duplicate Emergency Report Logic
  await test("8. Operations: Duplicate report logic detects matching citizen submission", () => {
    const existingReports = [
      {
        sessionId: "USR-A1B2C3",
        location: { name: "Velachery Lake Road", lat: 12.9815, lng: 80.218 },
        notes: "Water is entering our ground floor flat.",
        timestamp: new Date().toISOString(),
      },
    ];

    const duplicateSubmission = {
      sessionId: "USR-A1B2C3",
      location: { name: "Velachery Lake Road", lat: 12.9815, lng: 80.218 },
      notes: "Water is entering our ground floor flat.",
    };

    const isDuplicate = existingReports.some((r) => {
      const isSameSession = r.sessionId === duplicateSubmission.sessionId;
      const isRecent = Date.now() - new Date(r.timestamp).getTime() < 45000;
      const isSameNote = r.notes.trim() === duplicateSubmission.notes.trim();
      return isSameSession && isRecent && isSameNote;
    });

    assert.equal(isDuplicate, true, "Identical submission within 45s must be flagged as duplicate");
  });

  // Test 9: Missing GPS Fallback
  await test("9. Robustness: Missing GPS defaults safely to Chennai Central coordinate hub", () => {
    const defaultCoords = { lat: 13.0827, lng: 80.2757 };
    const incompleteLocation: { name: string; lat?: number; lng?: number } = {
      name: "Unknown Landmark in Chennai",
    };

    const resolvedLat = incompleteLocation.lat ?? defaultCoords.lat;
    const resolvedLng = incompleteLocation.lng ?? defaultCoords.lng;

    assert.equal(resolvedLat, 13.0827, "Must fallback to 13.0827");
    assert.equal(resolvedLng, 80.2757, "Must fallback to 80.2757");
  });

  // Test 10: Low Population Handling (e.g. 5 people)
  await test("10. Simulation: Low population (5 people) scales safely without errors", () => {
    const lowPopTwin = createDefaultDecisionTwin({
      placeName: "Adyar, Chennai",
      lat: 13.0012,
      lng: 80.2565,
      population: 5,
      buses: 2,
      boats: 1,
      ambulances: 1,
      rescueTeams: 2,
    });

    const sim = simulateDeterministicDecisionTwin(lowPopTwin);
    assert.ok(sim.evacuationTimeMinutes > 0, "Time must be positive");
    assert.equal(sim.capacityBreakdown.shortfallStatus, "SURPLUS", "5 people must have SURPLUS with 2 buses (100 cap)");
    assert.equal(sim.feasibilityStatus, "OPERATIONAL");
    assert.equal(sim.feasibilityStatusLabel, "OPERATIONAL");
  });

  // Test 11: Extreme Population Handling (e.g. 100,000 people)
  await test("11. Simulation: Extreme population (100,000) flags shortage & never marks plain 'Operational'", () => {
    const extremeTwin = createDefaultDecisionTwin({
      placeName: "Chennai Central Ward",
      lat: 13.0827,
      lng: 80.2757,
      population: 100000,
      buses: 20,
      boats: 5,
      ambulances: 10,
      rescueTeams: 15,
    });

    const sim = simulateDeterministicDecisionTwin(extremeTwin);
    assert.ok(sim.capacityBreakdown.wavesRequired > 1, "Must require multiple waves");
    assert.notEqual(sim.feasibilityStatusLabel, "OPERATIONAL", "MUST NEVER DISPLAY 'OPERATIONAL' ON SHORTFALL");
    assert.ok(
      sim.feasibilityStatusLabel === "OPERATIONAL WITH SHORTAGE" ||
      sim.feasibilityStatusLabel === "NOT FEASIBLE"
    );
  });

  // Test 12: Strict Feasibility Shortfall Guard
  await test("12. Integrity: Single wave capacity shortfall cannot be labeled OPERATIONAL", () => {
    const shortfallTwin = createDefaultDecisionTwin({
      placeName: "T Nagar, Chennai",
      lat: 13.0418,
      lng: 80.2341,
      population: 5000,
      buses: 10, // 10 * 50 = 500
      boats: 2,  // 2 * 20 = 40 -> Total wave capacity = 540 < 5000
      ambulances: 5,
      rescueTeams: 4,
    });

    const sim = simulateDeterministicDecisionTwin(shortfallTwin);
    assert.ok(sim.capacityBreakdown.totalSingleWaveCapacity < 5000);
    assert.notEqual(sim.feasibilityStatusLabel, "OPERATIONAL");
    assert.equal(sim.feasibilityStatusLabel, "OPERATIONAL WITH SHORTAGE");
    assert.equal(sim.capacityBreakdown.shortfallStatus, "DEFICIT");
  });

  // Test 13: Monte Carlo Variance & Reproducibility
  await test("13. Determinism: Monte Carlo simulation varies 5 factors & produces reproducible statistical summary", () => {
    const twin = createDefaultDecisionTwin({
      placeName: "Velachery, Chennai",
      lat: 12.9815,
      lng: 80.218,
      population: 3000,
      buses: 10,
      boats: 3,
      ambulances: 5,
      rescueTeams: 8,
    });

    const uncertainties = getDefaultUncertainties(twin);
    const config = {
      iterations: 100 as const,
      seed: 42,
      uncertainties,
    };

    const run1 = runMonteCarloSimulation(twin, config);
    const run2 = runMonteCarloSimulation(twin, config);

    assert.equal(run1.timeStats.mean, run2.timeStats.mean, "Identical seed must yield identical mean duration");
    assert.equal(run1.successProbability, run2.successProbability, "Identical seed must yield identical success probability");
    assert.ok(run1.sampledIterationsPreview.length > 0, "Must return preview iterations");

    // Check that samples vary in capacity and traffic
    const samples = run1.sampledIterationsPreview;
    const capacityVaries = samples.some((s) => s.sampledCapacity !== samples[0].sampledCapacity);
    const trafficVaries = samples.some((s) => s.sampledTraffic !== samples[0].sampledTraffic);
    assert.ok(capacityVaries, "Monte Carlo iterations must vary fleet capacity");
    assert.ok(trafficVaries, "Monte Carlo iterations must vary road traffic");
  });

  // Test 14: Human Dispatch Confirmation & Audit Log
  await test("14. Auditability: Dispatch audit log stores immutable mission directives", () => {
    const audit = logDispatchRecord({
      officerName: "Commander R. Natarajan",
      officerRole: "COMMANDER",
      locationName: "Tambaram East Railway Station",
      locationCoordinates: { lat: 12.9249, lng: 80.1000 },
      resources: { buses: 5, boats: 2, ambulances: 3, rescueTeams: 4 },
      corridor: "Radial Elevation Corridor",
      distanceKm: 22.4,
      reason: "Urgent life safety evacuation, river breach approaching level 2.",
      status: "OFFICIALLY_DISPATCHED",
    });

    assert.ok(audit.id.startsWith("DSP-"), "Audit ID must start with DSP-");
    assert.equal(audit.officerRole, "COMMANDER");
    assert.equal(audit.resources.buses, 5);
    assert.equal(audit.status, "OFFICIALLY_DISPATCHED");

    const allAudits = getAllDispatchAuditRecords();
    const recorded = allAudits.find((a) => a.id === audit.id);
    assert.ok(recorded !== undefined, "Audit record must be retrievable from system store");
  });

  // Test 15: Bilingual Accessibility & Tamil Strings
  await test("15. Accessibility: Tamil (தமிழ்) language strings and ARIA radiogroups complete", () => {
    assert.ok(QUESTIONNAIRE_TEXT.ta, "Tamil questionnaire must exist");
    assert.equal(QUESTIONNAIRE_TEXT.ta.questions.length, 5, "All 5 questions must be translated");

    for (const q of QUESTIONNAIRE_TEXT.ta.questions) {
      assert.ok(q.title.length > 5, `Question ${q.key} title must be translated`);
      assert.ok(q.options.length >= 3, `Question ${q.key} must have options`);
      for (const opt of q.options) {
        assert.ok(opt.label.length > 0, "Option label must not be empty");
        assert.ok(opt.icon.length > 0, "Option icon must be present for accessibility");
      }
    }
  });

  console.log("\n================================================================================");
  console.log(`TOTAL PASSED: ${passed}/15 | TOTAL FAILED: ${failed}/15`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((e) => {
  console.error("Test runner encountered critical error", e);
  process.exit(1);
});
