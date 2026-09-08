"use client";

import { useState, useEffect } from "react";
import {
  FloodWiseSharedState,
  SpecialistCapability,
  OrchestratorStatus,
  CandidatePlan,
  PlanSimulationResult,
  PlanComparisonItem,
  FloodWiseCheckpoint,
  AuditEvent,
} from "@/types/floodwise";

export function FloodWisePanel() {
  const [sharedState, setSharedState] = useState<FloodWiseSharedState | null>(null);
  const [loading, setLoading] = useState(false);
  const [orchestrating, setOrchestrating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Human Approval states
  const [approvalAction, setApprovalAction] = useState<"APPROVE" | "MODIFY" | "REJECT">("APPROVE");
  const [selectedPlanToModify, setSelectedPlanToModify] = useState<string>("PLAN_1");
  const [operationalRationale, setOperationalRationale] = useState("");
  const [approvalSubmitting, setApprovalSubmitting] = useState(false);
  const [approvalError, setApprovalError] = useState("");
  const [approvalSuccess, setApprovalSuccess] = useState("");

  // Field Update simulator states
  const [fieldNote, setFieldNote] = useState("");
  const [fieldRoadStatus, setFieldRoadStatus] = useState<"NORMAL" | "PARTIALLY_BLOCKED" | "BLOCKED">("BLOCKED");
  const [fieldEvacuated, setFieldEvacuated] = useState(25);
  const [fieldResourceIssue, setFieldResourceIssue] = useState("Additional evacuation transport required");
  const [fieldUpdating, setFieldUpdating] = useState(false);

  // Checkpoints
  const [checkpoints, setCheckpoints] = useState<FloodWiseCheckpoint[]>([]);
  const [savingCheckpoint, setSavingCheckpoint] = useState(false);

  // Active view tabs
  const [activeTab, setActiveTab] = useState<
    "overview" | "specialists" | "plans-sim" | "approval" | "mission" | "field-reassess" | "checkpoints" | "audit"
  >("overview");

  // Fetch initial shared state
  useEffect(() => {
    fetchSharedState();
    fetchCheckpoints();
  }, []);

  async function fetchSharedState() {
    setLoading(true);
    try {
      const res = await fetch("/api/floodwise/orchestrate");
      if (res.ok) {
        const data = await res.json();
        setSharedState(data);
      } else {
        setErrorMessage("Failed to load FloodWise pipeline state.");
      }
    } catch {
      setErrorMessage("Network error while loading pipeline state.");
    } finally {
      setLoading(false);
    }
  }

  async function fetchCheckpoints() {
    try {
      const res = await fetch("/api/floodwise/checkpoint");
      if (res.ok) {
        const data = await res.json();
        setCheckpoints(data.checkpoints || []);
      }
    } catch {}
  }

  // Run full pipeline to human approval
  async function handleRunFullPipeline() {
    setOrchestrating(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const res = await fetch("/api/floodwise/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "pipeline" }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage(`Specialist agents evaluated! Pipeline now awaiting human approval.`);
        await fetchSharedState();
        setActiveTab("approval");
      } else {
        setErrorMessage(data.error || "Failed to execute pipeline.");
      }
    } catch {
      setErrorMessage("Network error during agent pipeline execution.");
    } finally {
      setOrchestrating(false);
    }
  }

  // Step next capability
  async function handleStepNext() {
    setOrchestrating(true);
    setErrorMessage("");
    try {
      const res = await fetch("/api/floodwise/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "next" }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage(`Executed capability: ${data.stepResult?.capability || "Completed"}`);
        await fetchSharedState();
      } else {
        setErrorMessage(data.error || "Failed to step capability.");
      }
    } catch {
      setErrorMessage("Network error stepping capability.");
    } finally {
      setOrchestrating(false);
    }
  }

  // Submit human approval
  async function handleSubmitApproval() {
    if (!operationalRationale.trim()) {
      setApprovalError("Please enter the operational reason.");
      return;
    }

    setApprovalSubmitting(true);
    setApprovalError("");
    setApprovalSuccess("");

    try {
      const res = await fetch("/api/floodwise/approval", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: approvalAction,
          selectedPlanId: approvalAction === "MODIFY" ? selectedPlanToModify : undefined,
          rationale: operationalRationale.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setApprovalSuccess(`Official authorization confirmed! Mission ${data.mission?.mission_id || "generated"}.`);
        setOperationalRationale("");
        await fetchSharedState();
        setActiveTab("mission");
      } else {
        setApprovalError(data.error || "Failed to authorize decision.");
      }
    } catch {
      setApprovalError("Network error while recording authorization.");
    } finally {
      setApprovalSubmitting(false);
    }
  }

  // Advance mission status
  async function handleUpdateMissionStatus(targetStatus: "ACCEPTED" | "IN_PROGRESS" | "COMPLETED" | "ABORTED") {
    setLoading(true);
    try {
      const res = await fetch("/api/floodwise/mission", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_status",
          status: targetStatus,
          note: `Officer advanced status to ${targetStatus}`,
        }),
      });
      if (res.ok) {
        await fetchSharedState();
      } else {
        const d = await res.json();
        setErrorMessage(d.error || "Failed to update mission status.");
      }
    } catch {
      setErrorMessage("Network error updating mission status.");
    } finally {
      setLoading(false);
    }
  }

  // Submit field update to trigger reassessment
  async function handleSubmitFieldUpdate() {
    setFieldUpdating(true);
    setErrorMessage("");
    try {
      const res = await fetch("/api/floodwise/mission", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "field_update",
          note: fieldNote || "Field reconnaissance report received",
          road_status: fieldRoadStatus,
          evacuated_people: fieldEvacuated,
          resource_issue: fieldResourceIssue,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage(`Field update logged! Reassessment recommendation: ${data.reassessment?.reassessment_status}`);
        await fetchSharedState();
        setActiveTab("field-reassess");
      } else {
        setErrorMessage(data.error || "Failed to record field update.");
      }
    } catch {
      setErrorMessage("Network error recording field update.");
    } finally {
      setFieldUpdating(false);
    }
  }

  // Save checkpoint
  async function handleSaveCheckpoint() {
    setSavingCheckpoint(true);
    try {
      const res = await fetch("/api/floodwise/checkpoint", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save" }),
      });
      if (res.ok) {
        setSuccessMessage("Safe JSON checkpoint saved successfully with cryptographic integrity checksum.");
        await fetchCheckpoints();
      }
    } catch {
      setErrorMessage("Failed to save checkpoint.");
    } finally {
      setSavingCheckpoint(false);
    }
  }

  // Restore checkpoint
  async function handleRestoreCheckpoint(checkpointId: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/floodwise/checkpoint", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore", checkpointId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage(`State restored to checkpoint ${checkpointId}.`);
        await fetchSharedState();
      } else {
        setErrorMessage(data.error || "Failed to restore checkpoint.");
      }
    } catch {
      setErrorMessage("Network error restoring checkpoint.");
    } finally {
      setLoading(false);
    }
  }

  if (!sharedState) {
    return (
      <div className="rounded-2xl border border-[#23354d] bg-[#0a1829] p-8 text-center text-white">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#39d4b4] border-t-transparent mb-3" />
        <p className="text-sm font-semibold">Connecting to FloodWise Autonomous Multi-Agent Engine…</p>
      </div>
    );
  }

  const stage = sharedState.orchestrator_stage;
  const decision = sharedState.decision;
  const plans = sharedState.plans?.candidate_plans || [];
  const simResults = sharedState.simulation?.plan_results || [];

  return (
    <div className="space-y-6">
      {/* Top Banner & Pipeline Controller */}
      <div className="rounded-2xl border border-[#23354d] bg-[#0a1829] p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#23354d] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[#39d4b4] animate-pulse" />
              <h2 className="text-xl font-bold tracking-tight text-white">
                FloodWise Multi-Agent Autonomous Command
              </h2>
            </div>
            <p className="mt-1 text-xs text-[#9aabc1]">
              Ported from Hackathon2.ipynb: Situation, Resource, Report, Planning, Simulation, and Decision agents with state-machine orchestration.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={orchestrating}
              onClick={handleRunFullPipeline}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#39d4b4] to-[#2db397] px-4 py-2 text-xs font-bold text-[#062019] shadow-lg shadow-[#39d4b4]/20 hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              ⚡ Run Full Agent Pipeline
            </button>
            <button
              type="button"
              disabled={orchestrating}
              onClick={handleStepNext}
              className="rounded-xl border border-[#39506e] bg-[#10233a] px-3.5 py-2 text-xs font-semibold text-[#e6edf7] hover:bg-[#1a3454] disabled:opacity-50"
            >
              ▶ Step Next Capability
            </button>
            <button
              type="button"
              disabled={savingCheckpoint}
              onClick={handleSaveCheckpoint}
              className="rounded-xl border border-[#39506e] bg-[#10233a] px-3.5 py-2 text-xs font-semibold text-[#39d4b4] hover:bg-[#1a3454]"
            >
              💾 Save Checkpoint
            </button>
          </div>
        </div>

        {/* State Machine Visual Progress Stepper */}
        <div className="mt-4 overflow-x-auto py-2">
          <div className="flex min-w-[720px] items-center justify-between gap-1 text-[11px]">
            {[
              { id: "VALIDATED", label: "Validated" },
              { id: "SITUATION_ANALYZED", label: "Situation" },
              { id: "RESOURCES_ANALYZED", label: "Resources" },
              { id: "REPORTS_ANALYZED", label: "Reports" },
              { id: "PLANS_CREATED", label: "Plans" },
              { id: "SIMULATED", label: "Simulation" },
              { id: "DECISION_RECOMMENDED", label: "Decision" },
              { id: "AWAITING_HUMAN_APPROVAL", label: "Approval" },
              { id: "MISSION_GENERATED", label: "Mission" },
              { id: "IN_PROGRESS", label: "Execution" },
              { id: "COMPLETED", label: "Completed" },
            ].map((st, idx) => {
              const isCurrent = stage === st.id;
              const isPassed = isCurrent; // progressive
              return (
                <div key={st.id} className="flex flex-1 items-center">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full font-mono text-[10px] font-bold transition-all ${
                      isCurrent
                        ? "bg-[#39d4b4] text-[#062019] ring-4 ring-[#39d4b4]/30"
                        : "bg-[#10233a] text-[#9aabc1] border border-[#23354d]"
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <span
                    className={`ml-1.5 font-medium ${
                      isCurrent ? "text-white font-bold" : "text-[#9aabc1]"
                    }`}
                  >
                    {st.label}
                  </span>
                  {idx < 10 && <div className="mx-1.5 h-0.5 flex-1 bg-[#1b2b40]" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Global Feedback Banners */}
        {errorMessage && (
          <div role="alert" className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">
            ⚠️ {errorMessage}
          </div>
        )}
        {successMessage && (
          <div role="status" className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-200">
            ✅ {successMessage}
          </div>
        )}
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#23354d] pb-2">
        {[
          { id: "overview", label: "📋 Scenario & Intake" },
          { id: "specialists", label: "🧠 Specialist Insights" },
          { id: "plans-sim", label: "📊 Candidate Plans & Simulation" },
          { id: "approval", label: "🛡️ Human Approval Gate" },
          { id: "mission", label: "🚀 Mission Execution" },
          { id: "field-reassess", label: "🔄 Field Updates & Reassessment" },
          { id: "checkpoints", label: "💾 Checkpoints" },
          { id: "audit", label: "📜 Audit Trail" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
              activeTab === tab.id
                ? "bg-[#39d4b4] text-[#062019] shadow-md shadow-[#39d4b4]/20"
                : "border border-[#23354d] bg-[#0d1b2d] text-[#9aabc1] hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW & INTAKE NORMALIZATION */}
      {activeTab === "overview" && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Admin Scenario Card */}
          <div className="rounded-2xl border border-[#23354d] bg-[#0d1b2d] p-5 shadow-lg">
            <h3 className="text-sm font-bold text-white mb-3">🏢 Unified Admin Scenario Inputs</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between border-b border-[#1b2b40] pb-1.5">
                <span className="text-[#9aabc1]">Location Code:</span>
                <span className="font-semibold text-white">{sharedState.scenario.admin.a1 || "Central Riverside Zone"}</span>
              </div>
              <div className="flex justify-between border-b border-[#1b2b40] pb-1.5">
                <span className="text-[#9aabc1]">Trigger Event:</span>
                <span className="font-semibold text-[#ff7d7d]">{sharedState.scenario.admin.a2 || "Flash Flood / Dam Release"}</span>
              </div>
              <div className="flex justify-between border-b border-[#1b2b40] pb-1.5">
                <span className="text-[#9aabc1]">Affected / Evac Population:</span>
                <span className="font-semibold text-white">{sharedState.scenario.admin.a3 || 2000} affected / {sharedState.scenario.admin.a4 || 797} urgent evac</span>
              </div>
              <div className="flex justify-between border-b border-[#1b2b40] pb-1.5">
                <span className="text-[#9aabc1]">Regional Severity:</span>
                <span className="font-bold text-red-400">{sharedState.scenario.admin.a5 || "Critical Emergency"}</span>
              </div>
              <div className="flex justify-between border-b border-[#1b2b40] pb-1.5">
                <span className="text-[#9aabc1]">Water-Level Trend:</span>
                <span className="font-semibold text-amber-300">{sharedState.scenario.admin.a6 || "Rapidly Rising"}</span>
              </div>
              <div className="flex justify-between border-b border-[#1b2b40] pb-1.5">
                <span className="text-[#9aabc1]">Major Road Network:</span>
                <span className="font-semibold text-white">{sharedState.scenario.admin.a7 || "Partially Submerged / Blocked"}</span>
              </div>
              <div className="flex justify-between border-b border-[#1b2b40] pb-1.5">
                <span className="text-[#9aabc1]">Available Fleet:</span>
                <span className="font-mono text-[#39d4b4]">
                  {sharedState.scenario.admin.a9 || 4} Boats · {sharedState.scenario.admin.a10 || 7} Buses · {sharedState.scenario.admin.a11 || 5} Ambulances · {sharedState.scenario.admin.a12 || 10} Teams
                </span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-[#9aabc1]">Relief Camp Capacity:</span>
                <span className="text-amber-400 font-semibold">{sharedState.scenario.admin.a13 || "Capacity Exhausted"}</span>
              </div>
            </div>
          </div>

          {/* Citizen Distress Stream & Relations */}
          <div className="rounded-2xl border border-[#23354d] bg-[#0d1b2d] p-5 shadow-lg space-y-4">
            <h3 className="text-sm font-bold text-white">👥 Citizen Distress Stream & NLP Normalization</h3>
            <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
              {Object.entries(sharedState.scenario.users || {}).map(([uId, uData]) => (
                <div key={uId} className="rounded-xl border border-[#1b2b40] bg-[#06101c] p-3 text-xs">
                  <div className="flex justify-between font-semibold text-white mb-1">
                    <span>{uData.u1 || uId}</span>
                    <span className="text-red-400 font-bold">{uData.u5 || "High danger"}</span>
                  </div>
                  <p className="text-[#9aabc1]">Status: {uData.u2} · Stranded: {uData.u3} persons</p>
                  <p className="text-[#39d4b4] mt-1">Need: {uData.u8 || "Emergency help"}</p>
                </div>
              ))}
            </div>

            {/* Semantic Relationships */}
            <div>
              <p className="text-[11px] font-bold text-[#69e8d1] uppercase mb-1.5">🔗 Extracted Semantic Relations</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(sharedState.scenario.relations || {}).flatMap(([uId, rels]) =>
                  rels.map((r, i) => (
                    <span key={`${uId}-${i}`} className="rounded-lg bg-[#10233a] border border-[#23354d] px-2.5 py-1 text-[11px] text-[#e6edf7]">
                      <b>{r.subject}</b> → <span className="text-[#39d4b4]">{r.object}</span>
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SPECIALIST AGENTS */}
      {activeTab === "specialists" && (
        <div className="grid gap-6 md:grid-cols-3">
          {/* Situation Agent Card */}
          <div className="rounded-2xl border border-[#23354d] bg-[#0d1b2d] p-5 shadow-lg space-y-3">
            <div className="flex items-center justify-between border-b border-[#1b2b40] pb-2">
              <span className="font-bold text-white text-xs">1. Situation Agent</span>
              <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-300">
                {sharedState.situation ? "ACTIVE" : "PENDING"}
              </span>
            </div>
            {sharedState.situation ? (
              <div className="space-y-2 text-xs">
                <p className="text-[#e6edf7] leading-relaxed">{sharedState.situation.situation}</p>
                <div>
                  <span className="font-semibold text-[#9aabc1]">Identified Risks:</span>
                  <ul className="mt-1 list-disc pl-4 text-red-300 space-y-1">
                    {sharedState.situation.risks.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#9aabc1]">Click 'Run Full Agent Pipeline' to execute situation analysis.</p>
            )}
          </div>

          {/* Resource Agent Card */}
          <div className="rounded-2xl border border-[#23354d] bg-[#0d1b2d] p-5 shadow-lg space-y-3">
            <div className="flex items-center justify-between border-b border-[#1b2b40] pb-2">
              <span className="font-bold text-white text-xs">2. Resource Agent</span>
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                {sharedState.resources ? "ACTIVE" : "PENDING"}
              </span>
            </div>
            {sharedState.resources ? (
              <div className="space-y-2 text-xs">
                <div>
                  <span className="font-semibold text-[#9aabc1]">Available Resources:</span>
                  <div className="mt-1 space-y-1">
                    {sharedState.resources.available_resources.map((res, i) => (
                      <div key={i} className="flex justify-between rounded bg-[#06101c] p-1.5">
                        <span className="text-white">{res.resource_type}</span>
                        <span className="font-bold text-[#39d4b4]">{res.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-[#1b2b40] bg-[#06101c] p-2.5 mt-2">
                  <p className="text-[10px] font-bold uppercase text-[#69e8d1] mb-1">Exact Capacity Formulas</p>
                  <p className="text-[#9aabc1] text-[11px]">Bus: 50 / unit · Boat: 20 / unit · Ambulance: 4 / unit · Team: 25 / unit</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#9aabc1]">Resource analysis not yet executed.</p>
            )}
          </div>

          {/* Report Agent Card */}
          <div className="rounded-2xl border border-[#23354d] bg-[#0d1b2d] p-5 shadow-lg space-y-3">
            <div className="flex items-center justify-between border-b border-[#1b2b40] pb-2">
              <span className="font-bold text-white text-xs">3. Report Agent</span>
              <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold text-purple-300">
                {sharedState.reports ? "ACTIVE" : "PENDING"}
              </span>
            </div>
            {sharedState.reports ? (
              <div className="space-y-2 text-xs">
                <div>
                  <span className="font-semibold text-[#9aabc1]">Confirmed Points:</span>
                  <ul className="mt-1 list-disc pl-4 text-[#e6edf7] space-y-1">
                    {sharedState.reports.confirmed_information.slice(0, 4).map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <span className="font-semibold text-amber-400">Identified Conflicts:</span>
                  <ul className="mt-1 list-disc pl-4 text-amber-200/90 space-y-1">
                    {sharedState.reports.conflicts.slice(0, 3).map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#9aabc1]">Report analysis not yet executed.</p>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: CANDIDATE PLANS & SIMULATION */}
      {activeTab === "plans-sim" && (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            {plans.map((plan) => {
              const sim = simResults.find((s) => s.plan_id === plan.plan_id);
              const isRecommended = decision?.recommended_plan === plan.plan_id;

              return (
                <div
                  key={plan.plan_id}
                  className={`rounded-2xl border p-5 shadow-xl transition-all ${
                    isRecommended
                      ? "border-[#39d4b4] bg-[#081e28]/90 ring-2 ring-[#39d4b4]/30"
                      : "border-[#23354d] bg-[#0d1b2d]"
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-[#1b2b40] pb-2 mb-3">
                    <span className="font-mono text-sm font-bold text-white">{plan.plan_id}</span>
                    {isRecommended && (
                      <span className="rounded-full bg-[#39d4b4] px-2 py-0.5 text-[10px] font-bold text-[#062019]">
                        🏆 AI RECOMMENDED
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-[#e6edf7] font-semibold leading-snug">{plan.objective}</p>
                  <p className="text-[11px] text-[#39d4b4] mt-1">Priority: {plan.priority}</p>

                  {/* Simulation Scorecard */}
                  {sim && (
                    <div className="my-3 rounded-xl border border-[#1b2b40] bg-[#06101c] p-3 text-xs space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-[#9aabc1]">Estimated Coverage:</span>
                        <span className="font-bold text-emerald-400">{sim.estimated_coverage_percent}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#9aabc1]">Shortages / Deficits:</span>
                        <span className="font-semibold text-white">{sim.resource_shortage_count}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#9aabc1]">Evacuation Waves:</span>
                        <span className="font-semibold text-white">{sim.evacuation_waves_required} wave(s)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#9aabc1]">Estimated Duration:</span>
                        <span className="font-mono text-white">~{sim.estimated_evacuation_minutes} min</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#9aabc1]">Risk Level:</span>
                        <span className={`font-bold ${sim.risk_level === "HIGH" ? "text-red-400" : "text-amber-400"}`}>
                          {sim.risk_level}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 text-[11px]">
                    <span className="font-semibold text-[#9aabc1]">Key Actions:</span>
                    <ul className="list-disc pl-4 text-[#9aabc1] space-y-1">
                      {plan.actions.slice(0, 3).map((act, idx) => (
                        <li key={idx}>{act}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Decision Agent Reasoning Card */}
          {decision && (
            <div className="rounded-2xl border border-[#39d4b4]/40 bg-[#071926] p-5 shadow-xl">
              <h3 className="text-sm font-bold text-[#39d4b4] mb-2">
                🤖 Decision Agent Evaluation & Operational Reason
              </h3>
              <p className="text-xs text-[#e6edf7] leading-relaxed">{decision.reason}</p>
              <div className="mt-4 flex flex-wrap gap-4 text-xs">
                <div>
                  <span className="text-[#9aabc1]">Decision Confidence:</span>
                  <span className="ml-2 font-bold text-emerald-400">{decision.confidence}</span>
                </div>
                <div>
                  <span className="text-[#9aabc1]">Identified Operational Risks:</span>
                  <span className="ml-2 text-red-300">{decision.decision_risks?.length || 0} factors cataloged</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: HUMAN APPROVAL GATE */}
      {activeTab === "approval" && (
        <div className="max-w-2xl mx-auto rounded-2xl border border-[#39d4b4]/50 bg-[#0a1829] p-6 shadow-2xl space-y-4">
          <div className="border-b border-[#23354d] pb-3">
            <h3 className="text-lg font-bold text-white">Authorized Officer Dispatch Confirmation</h3>
            <p className="text-xs text-[#9aabc1] mt-1">
              In accordance with disaster protocols, real-world deployment requires authenticated human authorization, officer role validation, and operational justification.
            </p>
          </div>

          {/* Action Selector */}
          <div>
            <label className="block text-xs font-semibold text-[#9aabc1] mb-1.5">Decision Action:</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "APPROVE", label: `1. Approve (${decision?.recommended_plan || "PLAN_3"})` },
                { id: "MODIFY", label: "2. Modify Plan" },
                { id: "REJECT", label: "3. Reject All" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setApprovalAction(opt.id as any)}
                  className={`rounded-xl p-2 text-xs font-bold transition border ${
                    approvalAction === opt.id
                      ? "border-[#39d4b4] bg-[#39d4b4]/20 text-[#39d4b4]"
                      : "border-[#23354d] bg-[#10233a] text-[#9aabc1] hover:text-white"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {approvalAction === "MODIFY" && (
            <div>
              <label className="block text-xs font-semibold text-[#9aabc1] mb-1">Select Alternate Plan to Approve:</label>
              <select
                value={selectedPlanToModify}
                onChange={(e) => setSelectedPlanToModify(e.target.value)}
                className="w-full rounded-xl border border-[#23354d] bg-[#07111f] p-2.5 text-xs text-white"
              >
                <option value="PLAN_1">PLAN_1 (Priority High-Risk Vulnerable Groups)</option>
                <option value="PLAN_2">PLAN_2 (Sequential Water-Cutoff First)</option>
                <option value="PLAN_3">PLAN_3 (Parallel Simultaneous Multi-Corridor)</option>
              </select>
            </div>
          )}

          {/* Operational Rationale Input */}
          <div>
            <label htmlFor="floodwise-rationale" className="block text-xs font-semibold text-[#9aabc1] mb-1">
              Operational Rationale & Authorization Reason <span className="text-red-400">*</span>:
            </label>
            <textarea
              id="floodwise-rationale"
              rows={3}
              value={operationalRationale}
              onChange={(e) => setOperationalRationale(e.target.value)}
              placeholder="State the operational reason for authorizing or modifying this plan (e.g. Inundation depth verified at 35cm; primary GST route cleared; 8 buses allocated)…"
              className="w-full rounded-xl border border-[#23354d] bg-[#07111f] p-3 text-xs text-white focus:border-[#39d4b4] focus:outline-none"
            />
          </div>

          {approvalError && (
            <div role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-2.5 text-xs text-red-200">
              ⚠️ {approvalError}
            </div>
          )}
          {approvalSuccess && (
            <div role="status" className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-2.5 text-xs text-emerald-200">
              ✅ {approvalSuccess}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={approvalSubmitting}
              onClick={handleSubmitApproval}
              className="rounded-xl bg-gradient-to-r from-[#39d4b4] to-[#2db397] px-5 py-2.5 text-xs font-bold text-[#062019] shadow-lg shadow-[#39d4b4]/20 hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              {approvalSubmitting ? "Recording Official Authorization…" : "Confirm Authorization & Generate Mission →"}
            </button>
          </div>
        </div>
      )}

      {/* TAB 5: MISSION EXECUTION */}
      {activeTab === "mission" && (
        <div className="rounded-2xl border border-[#23354d] bg-[#0d1b2d] p-6 shadow-xl space-y-6">
          {sharedState.mission ? (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1b2b40] pb-4">
                <div>
                  <span className="font-mono text-xs text-[#39d4b4] font-bold">{sharedState.mission.mission_id}</span>
                  <h3 className="text-base font-bold text-white mt-0.5">{sharedState.mission.objective}</h3>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    sharedState.mission.status === "COMPLETED"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-[#39d4b4]/20 text-[#39d4b4]"
                  }`}
                >
                  {sharedState.mission.status}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-[#9aabc1]">
                    Execution Phase: <b className="text-white">{sharedState.mission.execution?.phase || "MOBILIZATION"}</b>
                  </span>
                  <span className="font-bold text-[#39d4b4]">{sharedState.mission.execution?.progress || 0}% Complete</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#10233a]">
                  <div
                    className="h-full bg-gradient-to-r from-[#39d4b4] to-[#2db397] transition-all duration-500"
                    style={{ width: `${sharedState.mission.execution?.progress || 0}%` }}
                  />
                </div>
              </div>

              {/* Operational Action Controls */}
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={loading || sharedState.mission.status === "COMPLETED"}
                  onClick={() => handleUpdateMissionStatus("IN_PROGRESS")}
                  className="rounded-xl border border-[#39506e] bg-[#10233a] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1a3454]"
                >
                  🚨 Advance Evacuation Phase (+25%)
                </button>
                <button
                  type="button"
                  disabled={loading || sharedState.mission.status === "COMPLETED"}
                  onClick={() => handleUpdateMissionStatus("COMPLETED")}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500"
                >
                  ✅ Mark Mission Completed (100%)
                </button>
              </div>

              {/* Tasks List */}
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-[#1b2b40] bg-[#06101c] p-4 text-xs">
                  <span className="font-bold text-white">Authorized Operational Tasks:</span>
                  <ul className="mt-2 list-disc pl-4 text-[#9aabc1] space-y-1.5">
                    {sharedState.mission.tasks.map((t, idx) => (
                      <li key={idx}>{t}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-[#1b2b40] bg-[#06101c] p-4 text-xs">
                  <span className="font-bold text-white">Committed Rescue Resources:</span>
                  <ul className="mt-2 list-disc pl-4 text-[#39d4b4] space-y-1.5">
                    {sharedState.mission.required_resources.map((r, idx) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-[#9aabc1]">
              No active mission generated yet. Please run the pipeline and confirm human authorization.
            </div>
          )}
        </div>
      )}

      {/* TAB 6: FIELD UPDATES & REASSESSMENT */}
      {activeTab === "field-reassess" && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Field Update Injection Card */}
          <div className="rounded-2xl border border-[#23354d] bg-[#0d1b2d] p-5 shadow-lg space-y-4">
            <h3 className="text-sm font-bold text-white">📡 Inject Field Update & Telemetry Change</h3>
            <p className="text-xs text-[#9aabc1]">
              Simulate changing road conditions or resource shortages from the field to trigger automatic orchestrator reassessment.
            </p>

            <div>
              <label className="block text-xs font-semibold text-[#9aabc1] mb-1">Road Clearance Status:</label>
              <select
                value={fieldRoadStatus}
                onChange={(e) => setFieldRoadStatus(e.target.value as any)}
                className="w-full rounded-xl border border-[#23354d] bg-[#07111f] p-2 text-xs text-white"
              >
                <option value="NORMAL">Normal / Clear</option>
                <option value="PARTIALLY_BLOCKED">Partially Blocked (Slow Water)</option>
                <option value="BLOCKED">Blocked (Impassable Inundation)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#9aabc1] mb-1">Cumulative Evacuated People:</label>
              <input
                type="number"
                value={fieldEvacuated}
                onChange={(e) => setFieldEvacuated(Number(e.target.value))}
                className="w-full rounded-xl border border-[#23354d] bg-[#07111f] p-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#9aabc1] mb-1">Resource Issue (Optional):</label>
              <input
                type="text"
                value={fieldResourceIssue}
                onChange={(e) => setFieldResourceIssue(e.target.value)}
                className="w-full rounded-xl border border-[#23354d] bg-[#07111f] p-2 text-xs text-white"
                placeholder="e.g. Additional evacuation transport required"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#9aabc1] mb-1">Field Note:</label>
              <input
                type="text"
                value={fieldNote}
                onChange={(e) => setFieldNote(e.target.value)}
                className="w-full rounded-xl border border-[#23354d] bg-[#07111f] p-2 text-xs text-white"
                placeholder="e.g. Water level rising near radial bridge"
              />
            </div>

            <button
              type="button"
              disabled={fieldUpdating}
              onClick={handleSubmitFieldUpdate}
              className="w-full rounded-xl bg-[#39d4b4] p-2.5 text-xs font-bold text-[#062019] hover:bg-[#69e8d1]"
            >
              {fieldUpdating ? "Logging Update…" : "Submit Field Update & Reassess"}
            </button>
          </div>

          {/* Reassessment Output Card */}
          <div className="rounded-2xl border border-[#23354d] bg-[#0d1b2d] p-5 shadow-lg space-y-4">
            <h3 className="text-sm font-bold text-white">🔄 Reassessment Agent Evaluation</h3>
            {sharedState.reassessment ? (
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-[#1b2b40] pb-2">
                  <span className="text-[#9aabc1]">Reassessment Status:</span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 font-bold ${
                      sharedState.reassessment.reassessment_status === "REPLAN"
                        ? "bg-red-500/20 text-red-300"
                        : "bg-amber-500/20 text-amber-300"
                    }`}
                  >
                    {sharedState.reassessment.reassessment_status}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-[#9aabc1]">Risk Level:</span>
                  <span className="font-bold text-red-400">{sharedState.reassessment.risk_level}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-[#9aabc1]">Current Mission Viable:</span>
                  <span className="font-bold text-white">
                    {sharedState.reassessment.mission_viable ? "YES (With adjustments)" : "NO (Replanning required)"}
                  </span>
                </div>

                <div className="rounded-xl border border-[#1b2b40] bg-[#06101c] p-3">
                  <span className="font-bold text-[#39d4b4]">Recommended Operational Action:</span>
                  <p className="mt-1 text-white font-medium">
                    {sharedState.reassessment.recommended_actions?.[0] || sharedState.reassessment.reason}
                  </p>
                </div>

                <p className="text-[11px] text-[#9aabc1] italic">
                  Note: Reassessment does not autonomously alter real deployed missions without explicit human confirmation.
                </p>
              </div>
            ) : (
              <p className="text-xs text-[#9aabc1]">
                No field updates logged yet. Inject an update on the left to trigger the Reassessment Agent.
              </p>
            )}
          </div>
        </div>
      )}

      {/* TAB 7: CHECKPOINTS */}
      {activeTab === "checkpoints" && (
        <div className="rounded-2xl border border-[#23354d] bg-[#0d1b2d] p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-[#1b2b40] pb-3">
            <div>
              <h3 className="text-sm font-bold text-white">Safe JSON Checkpoints</h3>
              <p className="text-xs text-[#9aabc1]">
                Versioned snapshots with SHA-256 integrity verification (replaces Colab pickle).
              </p>
            </div>
            <button
              type="button"
              disabled={savingCheckpoint}
              onClick={handleSaveCheckpoint}
              className="rounded-xl bg-[#39d4b4] px-4 py-2 text-xs font-bold text-[#062019]"
            >
              + Create Snapshot
            </button>
          </div>

          <div className="space-y-2">
            {checkpoints.length > 0 ? (
              checkpoints.map((chk) => (
                <div key={chk.checkpoint_id} className="flex items-center justify-between rounded-xl border border-[#1b2b40] bg-[#06101c] p-3 text-xs">
                  <div>
                    <span className="font-mono font-bold text-white">{chk.checkpoint_id}</span>
                    <span className="ml-2 text-[#9aabc1]">Saved by {chk.saved_by} at {new Date(chk.saved_at).toLocaleTimeString()}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRestoreCheckpoint(chk.checkpoint_id)}
                    className="rounded-lg border border-[#39506e] bg-[#10233a] px-3 py-1.5 text-xs font-semibold text-[#39d4b4] hover:bg-[#1a3454]"
                  >
                    Restore
                  </button>
                </div>
              ))
            ) : (
              <p className="text-xs text-[#9aabc1]">No checkpoints saved yet.</p>
            )}
          </div>
        </div>
      )}

      {/* TAB 8: AUDIT TRAIL */}
      {activeTab === "audit" && (
        <div className="rounded-2xl border border-[#23354d] bg-[#0d1b2d] p-6 shadow-xl space-y-3">
          <h3 className="text-sm font-bold text-white border-b border-[#1b2b40] pb-2">
            Immutable Audit Trail & Event Timeline
          </h3>
          <div className="max-h-96 overflow-y-auto space-y-2 pr-1 text-xs">
            {(sharedState.audit_log || []).slice(0, 30).map((evt: AuditEvent) => (
              <div key={evt.event_id} className="rounded-xl border border-[#1b2b40] bg-[#06101c] p-3">
                <div className="flex justify-between font-mono text-[11px] text-[#9aabc1] mb-1">
                  <span className="text-[#39d4b4] font-bold">{evt.action}</span>
                  <span>{new Date(evt.timestamp).toLocaleTimeString()}</span>
                </div>
                <p className="text-[#e6edf7]">{evt.details}</p>
                <span className="text-[10px] text-[#69e8d1]">Actor: {evt.actor} ({evt.role || "SYSTEM"})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
