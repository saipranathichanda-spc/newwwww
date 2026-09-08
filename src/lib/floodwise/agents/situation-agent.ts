/**
 * FloodWise Situation Agent
 * Ported from Notebook Cells 42-43.
 * Analyzes the emergency situation, affected people, risks, and uncertainties.
 */

import { UnifiedScenario, SituationAnalysis } from "@/types/floodwise";

export async function runSituationAgent(scenario: UnifiedScenario): Promise<SituationAnalysis> {
  const apiKey = process.env.NVIDIA_API_KEY;

  // Attempt live LLM invocation if server API key is provided
  if (apiKey && apiKey.trim().length > 10) {
    try {
      const systemPrompt = `You are the Situation Agent of FloodWise.
Analyze the validated FloodWise scenario.
Identify only:
- emergency situation
- affected area
- event
- severity
- risks
- affected/citizen reports
- resource mentions
- uncertainties

Do not recommend actions. Do not create plans. Do not allocate resources. Do not invent information.
Return ONLY valid JSON with keys: situation, affected_area, event, severity, risks, citizen_reports, resource_mentions, uncertainties.`;

      const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "nvidia/nemotron-3.5-lightning-30b-a3b",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `FloodWise Scenario:\n${JSON.stringify(scenario, null, 2)}` },
          ],
          temperature: 0,
          max_tokens: 1000,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content?.trim() || "";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as SituationAnalysis;
          if (parsed.situation && parsed.affected_area) {
            return parsed;
          }
        }
      }
    } catch (err) {
      console.warn("[SituationAgent] External LLM error, falling back to deterministic synthesis:", err);
    }
  }

  // Deterministic, schema-compliant synthesis matching Notebook Cell 43
  const admin = scenario.admin || {};
  const area = String(admin.a1 || "Central Riverside Zone, Chennai");
  const event = String(admin.a2 || "Flash Flood / Dam Release");
  const severity = String(admin.a5 || "Critical Emergency");
  const waterTrend = String(admin.a6 || "Rapidly Rising");
  const infraStatus = String(admin.a8 || "Grid Failure / Substation Flooded");
  const shelterStatus = String(admin.a13 || "Capacity Exhausted / Overflowing");

  const risks: string[] = [
    `Inundation water-level trend: ${waterTrend}`,
    `Critical infrastructure status: ${infraStatus}`,
    `Relief camp / shelter status: ${shelterStatus}`,
    "Elevated highway and rooftop strandings with dangerous flood currents",
    "Immediate danger to life for stranded citizens requiring urgent extraction",
  ];

  const citizenReportKeys = Object.keys(scenario.users || {});
  const citizenReportsSummary: string[] = citizenReportKeys.map((uId) => {
    const u = scenario.users[uId];
    return `[${uId}] ${u.u2 || "Stranded"} (${u.u3 || 1} people) - Status: ${u.u5 || "High danger"}`;
  });

  const resourceMentions: string[] = [
    "Boat / Evacuation Transport",
    "Evacuation Buses / Trucks",
    "Emergency Ambulances",
    "Active Rescue Teams on Ground",
    "Drinking Water & Food Supplies",
  ];

  const uncertainties: string[] = [
    "Conflicting water status: receding on elevated roads vs rapidly rising in residential sectors",
    "Grid failure impact on continuous communication and telecommunications telemetry",
    "Dangerous current conditions affecting small boat navigation",
    "True medical triage urgency beyond immediate self-reported distress counts",
  ];

  const situationSummary = `${event} in ${area}. Regional severity rated as ${severity} with ${waterTrend.toLowerCase()} water levels. Infrastructure reports indicate ${infraStatus.toLowerCase()} and relief shelter capacity is ${shelterStatus.toLowerCase()}. ${citizenReportKeys.length} citizen distress cluster(s) reported requiring prioritized life-safety extraction.`;

  return {
    situation: situationSummary,
    affected_area: area,
    event,
    severity,
    risks,
    citizen_reports: citizenReportsSummary,
    resource_mentions: resourceMentions,
    uncertainties,
  };
}
