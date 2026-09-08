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
  lang?: "en" | "ta";
}

export const QUESTIONNAIRE_TEXT = {
  en: {
    headerSub: "EMERGENCY SAFETY ASSESSMENT",
    headerTitle: "Disaster & Risk Questions",
    badge: "Tailors Your Safe Route",
    questions: [
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
    ],
  },
  ta: {
    headerSub: "அவசர பாதுகாப்பு மதிப்பீடு",
    headerTitle: "வெள்ளப் பாதிப்பு மற்றும் அபாயக் கேள்விகள்",
    badge: "பாதுகாப்பான பாதையைத் தேர்ந்தெடுக்கிறது",
    questions: [
      {
        key: "waterLevel" as keyof RiskAnswers,
        title: "1. உங்கள் பகுதியில் வெள்ள நீர்மட்டம்",
        description: "உங்கள் கட்டடம் அல்லது சாலையைச் சுற்றியுள்ள நீர் ஆழம் என்ன?",
        options: [
          { label: "வறண்டது / லேசான ஈரம் (< 5 செ.மீ)", value: "Dry / Damp (< 5 cm)", icon: "🟢" },
          { label: "கணுக்கால் அளவு (5–15 செ.மீ)", value: "Ankle level (5-15 cm)", icon: "🟡" },
          { label: "முழங்கால் அளவு (15–50 செ.மீ)", value: "Knee level (15-50 cm)", icon: "🟠" },
          { label: "இடுப்பளவு அல்லது அதற்கு மேல் (> 50 செ.மீ)", value: "Waist level (> 50 cm)", icon: "🔴" },
        ],
      },
      {
        key: "waterMovement" as keyof RiskAnswers,
        title: "2. வெள்ள நீர் பாயும் வேகம்",
        description: "நீர் தேங்கி நிற்கிறதா அல்லது வேகமாக பாய்கிறதா?",
        options: [
          { label: "தேங்கி நிற்கும் நீர்", value: "Still / Standing", icon: "💧" },
          { label: "மெதுவாக பாயும் நீர்", value: "Slowly flowing", icon: "🌊" },
          { label: "வேகமாக பாயும் தீவிர வெள்ளம்", value: "Fast-flowing / Torrential", icon: "⚠️" },
        ],
      },
      {
        key: "mobility" as keyof RiskAnswers,
        title: "3. பயண முறை / வாகனம்",
        description: "நீங்கள் எந்த வழியில் வெளியேற திட்டமிடுகிறீர்கள்?",
        options: [
          { label: "நான்கு சக்கர வாகனம் / கார்", value: "Four-wheeler / SUV", icon: "🚙" },
          { label: "நடைபயணமாக செல்லுதல்", value: "Walking on foot", icon: "🚶" },
          { label: "இரு சக்கர வாகனம்", value: "Two-wheeler", icon: "🛵" },
          { label: "சிக்கியுள்ளோம் / மீட்பு படகு தேவை", value: "Awaiting rescue boat", icon: "🚤" },
        ],
      },
      {
        key: "vulnerability" as keyof RiskAnswers,
        title: "4. உடன் உள்ள விசேஷ உதவி தேவைப்படுவோர்",
        description: "சிறப்பு மீட்பு அல்லது மருத்துவ உதவி தேவைப்படுவோர் உள்ளனரா?",
        options: [
          { label: "எவருமில்லை / ஆரோக்கியமாக உள்ளோம்", value: "None", icon: "👤" },
          { label: "முதியவர்கள் / மாற்றுத்திறனாளிகள்", value: "Elderly / Mobility impaired", icon: "🦯" },
          { label: "கைக்குழந்தைகள் / சிறுவர்கள்", value: "Infants / Children", icon: "👶" },
          { label: "அவசர மருத்துவ உதவி தேவைப்படுவோர்", value: "Medical emergency", icon: "🏥" },
        ],
      },
      {
        key: "assistance" as keyof RiskAnswers,
        title: "5. தற்போதைய உடனடி தேவை",
        description: "உங்களின் முதன்மையான தேவை என்ன?",
        options: [
          { label: "பாதுகாப்பான வழித்தடம் அறிதல்", value: "Planning route", icon: "🗺️" },
          { label: "நிவாரண முகாம் தேவை", value: "Need evacuation shelter", icon: "⛺" },
          { label: "வெள்ளத்தில் சிக்கியுள்ளோம் / உதவி தேவை", value: "Trapped / Water rising", icon: "🆘" },
        ],
      },
    ],
  },
};

export const DEFAULT_QUESTIONS = QUESTIONNAIRE_TEXT.en.questions;

export function RiskQuestionnaire({ answers, onChange, lang = "en" }: RiskQuestionnaireProps) {
  const content = QUESTIONNAIRE_TEXT[lang] || QUESTIONNAIRE_TEXT.en;

  function handleSelect(key: keyof RiskAnswers, value: string) {
    onChange({
      ...answers,
      [key]: value,
    });
  }

  return (
    <div className="space-y-5 rounded-2xl border border-[#2b4966] bg-[#0d1b2d] p-5 md:p-6" aria-label="Risk Assessment Questionnaire">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[.14em] text-[#39d4b4]">{content.headerSub}</p>
          <h3 className="mt-1 text-xl font-semibold text-[#e6edf7]">{content.headerTitle}</h3>
        </div>
        <span className="rounded-full bg-[#113c3d] px-3 py-1 text-xs text-[#69e8d1]">
          {content.badge}
        </span>
      </div>

      <div className="space-y-6 pt-2">
        {content.questions.map((q) => (
          <div key={q.key} className="space-y-2">
            <div>
              <p className="text-sm font-medium text-[#e6edf7]">{q.title}</p>
              <p className="text-xs text-[#9aabc1]">{q.description}</p>
            </div>
            <div
              role="radiogroup"
              aria-label={q.title}
              className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4"
            >
              {q.options.map((opt) => {
                const isSelected = answers[q.key] === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => handleSelect(q.key, opt.value)}
                    className={`flex items-center gap-2.5 rounded-xl border p-3 text-left text-xs transition-all focus:outline-none focus:ring-2 focus:ring-[#39d4b4] ${
                      isSelected
                        ? "border-[#39d4b4] bg-[#102d35] font-semibold text-[#69e8d1] shadow-md shadow-[#39d4b4]/10"
                        : "border-[#23354d] bg-[#07111f] text-[#b6c4d5] hover:border-[#39506e] hover:bg-[#10233a]"
                    }`}
                  >
                    <span className="text-base" aria-hidden="true">{opt.icon}</span>
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
