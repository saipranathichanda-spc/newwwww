"use client";

export type RiskAnswers = {
  waterLevel: string;
  waterMovement: string;
  mobility: string;
  vulnerability: string;
  assistance: string;
};

interface RiskQuestionnaireProps {
  answers: RiskAnswers;
  onChange: (answers: RiskAnswers) => void;
}

export const DEFAULT_QUESTIONS = [
  {
    key: "waterLevel" as keyof RiskAnswers,
    title: "1. Current Water Level at Your Location",
    description: "What is the water depth immediately surrounding your building or road?",
    options: [
      { label: "Dry / Damp (< 5 cm)", value: "Dry / Damp (< 5 cm)", icon: "🟢" },
      { label: "Ankle level (5–15 cm)", value: "Ankle level (5-15 cm)", icon: "🟡" },
      { label: "Knee level (15–50 cm)", value: "Knee level (15-50 cm)", icon: "🟠" },
      { label: "Waist level or higher (> 50 cm)", value: "Waist level (> 50 cm)", icon: "🔴" },
    ],
  },
  {
    key: "waterMovement" as keyof RiskAnswers,
    title: "2. Water Flow Speed",
    description: "Is water actively moving or stagnant?",
    options: [
      { label: "Stagnant / Standing", value: "Still / Standing", icon: "💧" },
      { label: "Slowly flowing", value: "Slowly flowing", icon: "🌊" },
      { label: "Fast-flowing / Torrential", value: "Fast-flowing / Torrential", icon: "⚠️" },
    ],
  },
  {
    key: "mobility" as keyof RiskAnswers,
    title: "3. Planned Mode of Movement",
    description: "How are you intending to travel to your destination?",
    options: [
      { label: "Four-wheeler / SUV", value: "Four-wheeler / SUV", icon: "🚙" },
      { label: "Walking on foot", value: "Walking on foot", icon: "🚶" },
      { label: "Two-wheeler (Bike/Scooter)", value: "Two-wheeler", icon: "🛵" },
      { label: "Stranded / Awaiting rescue", value: "Awaiting rescue boat", icon: "🚤" },
    ],
  },
  {
    key: "vulnerability" as keyof RiskAnswers,
    title: "4. Vulnerable Individuals Present",
    description: "Are there individuals requiring special evacuation assistance?",
    options: [
      { label: "None / Fully able", value: "None", icon: "👤" },
      { label: "Elderly / Mobility impaired", value: "Elderly / Mobility impaired", icon: "🦯" },
      { label: "Infants / Children", value: "Infants / Children", icon: "👶" },
      { label: "Medical emergency / Critical", value: "Medical emergency", icon: "🏥" },
    ],
  },
  {
    key: "assistance" as keyof RiskAnswers,
    title: "5. Immediate Status & Needs",
    description: "What is your primary goal right now?",
    options: [
      { label: "Planning safe transit", value: "Planning route", icon: "🗺️" },
      { label: "Seeking relief shelter", value: "Need evacuation shelter", icon: "⛺" },
      { label: "Trapped / Water rising", value: "Trapped / Water rising", icon: "🆘" },
    ],
  },
];

export function RiskQuestionnaire({ answers, onChange }: RiskQuestionnaireProps) {
  function handleSelect(key: keyof RiskAnswers, value: string) {
    onChange({
      ...answers,
      [key]: value,
    });
  }

  return (
    <div className="space-y-5 rounded-2xl border border-[#2b4966] bg-[#0d1b2d] p-5 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[.14em] text-[#39d4b4]">EMERGENCY SAFETY ASSESSMENT</p>
          <h3 className="mt-1 text-xl font-semibold text-[#e6edf7]">Disaster & Risk Questions</h3>
        </div>
        <span className="rounded-full bg-[#113c3d] px-3 py-1 text-xs text-[#69e8d1]">
          Tailors Your Safe Route
        </span>
      </div>

      <div className="space-y-6 pt-2">
        {DEFAULT_QUESTIONS.map((q) => (
          <div key={q.key} className="space-y-2">
            <div>
              <p className="text-sm font-medium text-[#e6edf7]">{q.title}</p>
              <p className="text-xs text-[#9aabc1]">{q.description}</p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4">
              {q.options.map((opt) => {
                const isSelected = answers[q.key] === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(q.key, opt.value)}
                    className={`flex items-center gap-2.5 rounded-xl border p-3 text-left text-xs transition-all ${
                      isSelected
                        ? "border-[#39d4b4] bg-[#102d35] font-semibold text-[#69e8d1] shadow-md shadow-[#39d4b4]/10"
                        : "border-[#23354d] bg-[#07111f] text-[#b6c4d5] hover:border-[#39506e] hover:bg-[#10233a]"
                    }`}
                  >
                    <span className="text-base">{opt.icon}</span>
                    <span className="leading-tight">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
