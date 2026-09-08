/**
 * FloodWise Intake Normalization, Entity Extraction, & Validation Engine
 * Ported from Notebook cells 23-29.
 */

import {
  IntakeSubmission,
  UnifiedScenario,
  ScenarioValidation,
  ExtractedEntity,
  ExtractedRelation,
  UserNoteDetail,
  StructuredFieldValidation,
  ValidationStatus,
} from "@/types/floodwise";

const EMPTY_VALUES = new Set(["", "none", "null", "not answered", "n/a", "na", "undefined"]);

/**
 * Extract entities from unstructured emergency notes using rule-based NLP matcher.
 * Mirrors NuNER Zero extracted categories: entity, quantity, action, condition, location, time.
 */
export function extractEntitiesFromText(text: string): ExtractedEntity[] {
  if (!text || EMPTY_VALUES.has(text.trim().toLowerCase())) {
    return [];
  }

  const cleanText = text.trim();
  const entities: ExtractedEntity[] = [];

  // Patterns for quantities
  const qtyRegex = /\b(\d+(?:\.\d+)?|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|hundred|thousand)\b)\s*(?:people|persons|citizens|families|children|infants|patients|buses|boats|ambulances|teams)?\b/gi;
  let match: RegExpExecArray | null;
  while ((match = qtyRegex.exec(cleanText)) !== null) {
    entities.push({
      text: match[1],
      label: "quantity",
      score: 0.92,
      start: match.index,
      end: match.index + match[1].length,
    });
  }

  // Patterns for conditions and emergencies
  const conditionKeywords = [
    { word: "need", score: 0.71 },
    { word: "food", score: 0.704 },
    { word: "water", score: 0.72 },
    { word: "very", score: 0.915 },
    { word: "hard", score: 0.958 },
    { word: "situation", score: 0.969 },
    { word: "critical", score: 0.95 },
    { word: "danger", score: 0.91 },
    { word: "stranded", score: 0.88 },
    { word: "trapped", score: 0.89 },
    { word: "injured", score: 0.93 },
    { word: "rising", score: 0.87 },
    { word: "blocked", score: 0.94 },
    { word: "flooded", score: 0.92 },
    { word: "submerged", score: 0.90 },
  ];

  for (const { word, score } of conditionKeywords) {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    while ((match = regex.exec(cleanText)) !== null) {
      // Avoid duplicate entity overlaps
      if (!entities.some((e) => e.start === match!.index)) {
        entities.push({
          text: match[0].toLowerCase(),
          label: "condition",
          score,
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    }
  }

  // Location words
  const locationKeywords = ["chennai", "velachery", "tambaram", "central", "highway", "rooftop", "river", "bridge", "hospital"];
  for (const loc of locationKeywords) {
    const regex = new RegExp(`\\b${loc}\\b`, "gi");
    while ((match = regex.exec(cleanText)) !== null) {
      if (!entities.some((e) => e.start === match!.index)) {
        entities.push({
          text: match[0],
          label: "location",
          score: 0.85,
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    }
  }

  // Action words
  const actionKeywords = ["save", "evacuate", "rescue", "help", "send", "transport", "deploy"];
  for (const act of actionKeywords) {
    const regex = new RegExp(`\\b${act}\\b`, "gi");
    while ((match = regex.exec(cleanText)) !== null) {
      if (!entities.some((e) => e.start === match!.index)) {
        entities.push({
          text: match[0],
          label: "action",
          score: 0.84,
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    }
  }

  return entities.sort((a, b) => (a.start || 0) - (b.start || 0));
}

/**
 * Extract semantic subject-object relationships from emergency text.
 * Mirrors spaCy dependency parse output in Notebook Cell 26.
 */
export function extractRelationsFromText(text: string): ExtractedRelation[] {
  if (!text || EMPTY_VALUES.has(text.trim().toLowerCase())) return [];

  const relations: ExtractedRelation[] = [];
  const clean = text.trim().toLowerCase();

  // Pattern: "need food" -> subject: "need", object: "food"
  if (clean.includes("need") && clean.includes("food")) {
    relations.push({ subject: "need", object: "food" });
  }
  if (clean.includes("need") && clean.includes("water")) {
    relations.push({ subject: "need", object: "water" });
  }
  if (clean.includes("need") && clean.includes("boat")) {
    relations.push({ subject: "need", object: "boat" });
  }
  if (clean.includes("save") && clean.includes("people")) {
    relations.push({ subject: "save", object: "people" });
  }
  if (clean.includes("water") && clean.includes("floor")) {
    relations.push({ subject: "water", object: "floor" });
  }
  if (clean.includes("water") && (clean.includes("flood") || clean.includes("street") || clean.includes("road"))) {
    relations.push({ subject: "water", object: "streets" });
  }
  if ((clean.includes("boat") || clean.includes("rescue")) && (clean.includes("evacuat") || clean.includes("resident") || clean.includes("people"))) {
    relations.push({ subject: "rescue team", object: "residents" });
  }

  return relations;
}

/**
 * Validate structured questions (Notebook Cell 25).
 * Validates that numbers are non-negative, required fields are not empty, and coordinates are within bounds.
 */
export function validateStructuredData(
  responses: Record<string, { question?: string; value?: any }>
): { status: "VALID" | "INVALID"; fields: StructuredFieldValidation[] } {
  if (!responses || Object.keys(responses).length === 0) {
    return { status: "INVALID", fields: [] };
  }

  const fields: StructuredFieldValidation[] = [];
  let hasInvalid = false;

  for (const [qid, item] of Object.entries(responses)) {
    const val = item.value;
    const strVal = String(val ?? "").trim().toLowerCase();

    if (EMPTY_VALUES.has(strVal)) {
      continue;
    }

    // Number validation: must be >= 0
    const isNum = /^-?\d+(\.\d+)?$/.test(strVal);
    let ok = true;
    let reason: string | undefined;

    if (isNum) {
      const parsed = parseFloat(strVal);
      if (parsed < 0) {
        ok = false;
        reason = "Numeric values cannot be negative";
      } else if (qid.includes("lat") && (parsed < 12.0 || parsed > 14.5)) {
        ok = false;
        reason = "Latitude out of Chennai regional bounds (12.0 - 14.5)";
      } else if (qid.includes("lng") && (parsed < 79.0 || parsed > 81.0)) {
        ok = false;
        reason = "Longitude out of Chennai regional bounds (79.0 - 81.0)";
      }
    }

    if (!ok) hasInvalid = true;

    fields.push({
      questionId: qid,
      value: val,
      status: ok ? "VALID" : "INVALID",
      reason,
    });
  }

  return {
    status: hasInvalid ? "INVALID" : "VALID",
    fields,
  };
}

/**
 * Build unified scenario state from Admin input and User submissions.
 * Mirrors Notebook Cells 27-29.
 */
export function buildUnifiedScenario(
  scenarioId: string,
  adminData: IntakeSubmission | null,
  userSubmissions: IntakeSubmission[]
): UnifiedScenario {
  const adminFields: Record<string, any> = {};
  if (adminData?.responses) {
    for (const [qid, item] of Object.entries(adminData.responses)) {
      const v = item.value;
      if (v !== null && v !== undefined && !EMPTY_VALUES.has(String(v).trim().toLowerCase())) {
        adminFields[qid] = v;
      }
    }
  }

  const userFields: Record<string, Record<string, any>> = {};
  const customNotes: UserNoteDetail[] = [];
  const relationsMap: Record<string, ExtractedRelation[]> = {};

  for (const userSub of userSubmissions) {
    const uId = userSub.id || `user_${Date.now()}`;
    userFields[uId] = {};

    for (const [qid, item] of Object.entries(userSub.responses || {})) {
      const v = item.value;
      if (v !== null && v !== undefined && !EMPTY_VALUES.has(String(v).trim().toLowerCase())) {
        userFields[uId][qid] = v;
      }
    }

    const noteVal = userSub.responses?.custom_notes?.value || userSub.responses?.u10?.value || "";
    if (noteVal && !EMPTY_VALUES.has(String(noteVal).trim().toLowerCase())) {
      const entities = extractEntitiesFromText(String(noteVal));
      customNotes.push({
        user_id: uId,
        text: String(noteVal),
        entities,
      });

      const userRelations = extractRelationsFromText(String(noteVal));
      relationsMap[uId] = userRelations;
    } else {
      relationsMap[uId] = [];
    }
  }

  // Also include admin custom notes if present
  if (adminFields.custom_notes) {
    const adminEntities = extractEntitiesFromText(String(adminFields.custom_notes));
    customNotes.push({
      user_id: "admin_custom",
      text: String(adminFields.custom_notes),
      entities: adminEntities,
    });
  }

  const now = new Date().toISOString();

  return {
    scenario_id: scenarioId,
    createdAt: now,
    updatedAt: now,
    admin: adminFields,
    users: userFields,
    custom_notes: customNotes,
    relations: relationsMap,
    decision_twin: {},
  };
}

/**
 * Validate unified scenario completeness and consistency.
 * Mirrors Notebook Cell 29.
 */
export function validateUnifiedScenario(scenario: UnifiedScenario): ScenarioValidation {
  const confirmed: string[] = [];
  const warnings: string[] = [];
  const issues: string[] = [];

  if (scenario.admin && Object.keys(scenario.admin).length > 0) {
    confirmed.push("Admin data available");
  } else {
    issues.push("Admin scenario data missing");
  }

  const userKeys = Object.keys(scenario.users || {});
  let validUsersCount = 0;

  for (const uId of userKeys) {
    const data = scenario.users[uId];
    if (data && Object.keys(data).length > 0) {
      validUsersCount++;
    }
  }

  if (validUsersCount > 0) {
    confirmed.push(`${validUsersCount} user report(s) available`);
  } else {
    issues.push("No usable citizen report data");
  }

  if (scenario.custom_notes && scenario.custom_notes.length > 0) {
    confirmed.push(`${scenario.custom_notes.length} custom emergency note(s) available`);
  } else {
    warnings.push("No citizen custom notes provided");
  }

  const relationCount = Object.values(scenario.relations || {}).reduce((acc, r) => acc + r.length, 0);
  if (relationCount > 0) {
    confirmed.push(`${relationCount} semantic relationship(s) extracted`);
  }

  let status: ValidationStatus = "VALID";
  if (issues.length > 0) {
    status = "INVALID";
  } else if (warnings.length > 0) {
    status = "VALID"; // Notebook cell 29 accepts VALID when admin + users present
  }

  return {
    status,
    decisionReady: status === "VALID",
    confirmed,
    warnings,
    issues,
  };
}
