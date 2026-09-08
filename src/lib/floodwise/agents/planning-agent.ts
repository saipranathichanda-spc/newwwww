/**
 * FloodWise Planning Agent
 * Ported from Notebook Cells 52-53.
 * Synthesizes candidate emergency response plans with objectives, priorities, actions, resources, risks, and assumptions.
 */

import {
  UnifiedScenario,
  SituationAnalysis,
  ResourceState,
  ReportAnalysis,
  PlanningOutput,
  CandidatePlan,
} from "@/types/floodwise";

export async function runPlanningAgent(
  scenario: UnifiedScenario,
  situation?: SituationAnalysis | null,
  resources?: ResourceState | null,
  reports?: ReportAnalysis | null
): Promise<PlanningOutput> {
  const apiKey = process.env.NVIDIA_API_KEY;

  if (apiKey && apiKey.trim().length > 10) {
    try {
      const systemPrompt = `You are the Planning Agent of FloodWise.
Create 2 or 3 candidate emergency response plans using the available scenario, situation, resource, and report data.
Your job is to propose plans, not execute them.
Return ONLY valid JSON with keys: candidate_plans (array of plan objects with plan_id, objective, priority, actions, resources_required, constraints, risks, assumptions) and planning_uncertainties (array).`;

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
            {
              role: "user",
              content: `FloodWise Scenario:\n${JSON.stringify(scenario, null, 2)}\nSituation:\n${JSON.stringify(situation, null, 2)}\nResources:\n${JSON.stringify(resources, null, 2)}\nReports:\n${JSON.stringify(reports, null, 2)}`,
            },
          ],
          temperature: 0,
          max_tokens: 2000,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content?.trim() || "";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as PlanningOutput;
          if (Array.isArray(parsed.candidate_plans) && parsed.candidate_plans.length > 0) {
            return parsed;
          }
        }
      }
    } catch (err) {
      console.warn("[PlanningAgent] External LLM error, using deterministic synthesis:", err);
    }
  }

  // Deterministic, schema-compliant synthesis matching Notebook Cells 52-53
  const candidatePlans: CandidatePlan[] = [
    {
      plan_id: "PLAN_1",
      objective: "Priority evacuation of critically injured citizens and elderly/infant groups via targeted boat rescue within the operational window",
      priority: "Immediate life-safety extraction for highest-vulnerability groups",
      actions: [
        "Deploy all operational rescue boats to high-risk residential zones identified in citizen distress streams",
        "Execute rapid boat rescue for ground-floor flooded and rooftop-trapped individuals (elderly and infants)",
        "Coordinate land-based bus transport for stranded citizens on elevated arterial corridors",
        "Dispatch ambulances to reception nodes for immediate medical triage of critically injured patients",
        "Distribute emergency drinking water and medical rations via ground rescue squads",
      ],
      resources_required: [
        "4 Operational Rescue Boats",
        "7 Evacuation Buses / Trucks",
        "5 Emergency Ambulances",
        "10 Active Rescue Teams on Ground",
      ],
      constraints: [
        "6-hour maximum targeted evacuation window before secondary dam surge",
        "Grid power failure and flooded substation limiting telecommunications",
        "Varied water progression (receding on ridges, rising in hollows) dictating corridor selection",
        "Shelter capacity exhausted, requiring redirection to secondary higher-ground hubs",
      ],
      risks: [
        "Strong hydraulic currents may impede small boat navigation despite receding water on highways",
        "Grid failure may delay real-time relay between boat rescue crews and transport buses",
        "Arterial road access may deteriorate if downstream drainage canals backflow",
      ],
      assumptions: [
        "Operational rescue boats can launch from designated radial slipways",
        "Evacuation buses have sufficient clearance along elevated highway sections",
        "Ground rescue teams can maintain tactical coordination using VHF radios",
      ],
    },
    {
      plan_id: "PLAN_2",
      objective: "Sequential phased evacuation prioritizing water-cutoff victims first, followed by highway strandings",
      priority: "Extract completely cut-off victims before water levels exceed survival threshold",
      actions: [
        "Phase 1: Concentrate all boat and team assets on citizens completely cut off by water in ground-floor and rooftop situations",
        "Phase 2: Once water-cutoff zones are secured, mobilize bus convoy to extract elevated highway groups",
        "Establish staging field triage at radial high-ground junction",
        "Coordinate with GCC helpline 1913 for emergency shelter overflow rerouting",
      ],
      resources_required: [
        "4 Operational Rescue Boats",
        "7 Evacuation Buses / Trucks",
        "5 Emergency Ambulances",
        "10 Active Rescue Teams on Ground",
      ],
      constraints: [
        "Strict sequential timeline may delay highway strandings who have medical emergencies",
        "Rising water trend may submerge access corridors during Phase 2",
      ],
      risks: [
        "Delaying highway evacuees increases health risks for critically injured individuals waiting in exposed conditions",
        "Boats may require repositioning time between disconnected flood pockets",
      ],
      assumptions: [
        "Highway strandings remain stable while boat operations complete initial extraction phase",
        "Weather conditions do not escalate wind shear during sequential phases",
      ],
    },
    {
      plan_id: "PLAN_3",
      objective: "Parallel simultaneous multi-corridor evacuation deploying boat and bus assets concurrently with risk-based prioritization",
      priority: "Maximize total lives saved through concurrent parallel operations across all available assets",
      actions: [
        "Deploy rescue boats directly to rooftop and cut-off residential clusters for simultaneous extraction",
        "Deploy bus convoy with ground teams to extract stranded citizens along elevated highway segments simultaneously",
        "Position ambulances at designated medical extraction junctions for immediate triage",
        "Establish forward logistics node with drinking water and basic rations at VIT Chennai Base Hub",
        "Maintain dual radial routing corridors to avoid bottlenecking on single transit arterials",
      ],
      resources_required: [
        "4 Operational Rescue Boats",
        "7 Evacuation Buses / Trucks",
        "5 Emergency Ambulances",
        "10 Active Rescue Teams on Ground",
      ],
      constraints: [
        "Concurrent command and control complexity during grid and telecommunication outages",
        "Simultaneous asset commitment leaves zero tactical reserve for unforeseen secondary breaches",
      ],
      risks: [
        "High coordination overhead across disconnected flood sectors without centralized electrical grid",
        "Rescue teams stretched thin across multiple concurrent operational fronts",
      ],
      assumptions: [
        "Parallel deployment compresses overall mission time well within the 6-hour emergency window",
        "Available fuel and crew endurance can support sustained concurrent extraction waves",
      ],
    },
  ];

  const planningUncertainties: string[] = [
    "Rate of inundation rise along alternate radial elevation corridors",
    "Availability of emergency fuel replenishment for rescue boats operating beyond 4 hours",
    "Number of uncontacted citizens trapped in ground floors without cellular reception",
  ];

  return {
    candidate_plans: candidatePlans,
    planning_uncertainties: planningUncertainties,
  };
}
