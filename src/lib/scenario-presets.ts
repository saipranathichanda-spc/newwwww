export interface VerifiedDestination {
  id: string;
  name: string;
  type: "SHELTER" | "HOSPITAL" | "TRANSIT_HUB";
  lat: number;
  lng: number;
  capacityEstimated: number;
  description: string;
  isVerified: boolean;
}

export interface ScenarioPreset {
  id: string;
  label: string;
  locationName: string;
  coords: { lat: number; lng: number };
  hazard: {
    type: "Flood";
    severity: "CRITICAL" | "HIGH" | "MEDIUM";
    description: string;
    waterLevelEstimate: string;
    waterMovementEstimate: string;
  };
  defaultPopulation: number;
  defaultResources: {
    buses: number;
    boats: number;
    ambulances: number;
    rescueTeams: number;
    budget: number;
  };
  defaultPriorities: {
    safety: number;
    speed: number;
    cost: number;
    coverage: number;
    reliability: number;
  };
  verifiedDestinations: VerifiedDestination[];
  contextSummary: string;
}

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: "velachery-flood",
    label: "Velachery Flood",
    locationName: "Velachery, Chennai",
    coords: { lat: 12.9815, lng: 80.2180 },
    hazard: {
      type: "Flood",
      severity: "CRITICAL",
      description: "Severe urban flooding around Velachery Lake and Vijayanagar Junction. Stormwater drains backflowing toward residential streets.",
      waterLevelEstimate: "Knee to Waist level (35–60 cm)",
      waterMovementEstimate: "Slowly flowing toward Pallikaranai canal"
    },
    defaultPopulation: 3500,
    defaultResources: {
      buses: 10,
      boats: 3,
      ambulances: 5,
      rescueTeams: 20,
      budget: 600000
    },
    defaultPriorities: {
      safety: 60,
      speed: 30,
      cost: 10,
      coverage: 0,
      reliability: 0
    },
    verifiedDestinations: [
      {
        id: "velachery-shelter",
        name: "GCC Flood Relief Shelter (Velachery High Ground)",
        type: "SHELTER",
        lat: 12.9780,
        lng: 80.2220,
        capacityEstimated: 1200,
        description: "Elevated municipal community hall designated as high-ground primary evacuation center.",
        isVerified: true
      },
      {
        id: "gleneagles-center",
        name: "Gleneagles Health City Emergency Center",
        type: "HOSPITAL",
        lat: 12.8982,
        lng: 80.1912,
        capacityEstimated: 350,
        description: "Tertiary critical care and trauma center for acute medical evacuations.",
        isVerified: true
      },
      {
        id: "guindy-hub",
        name: "Guindy Elevated Transit & Relief Staging",
        type: "TRANSIT_HUB",
        lat: 13.0067,
        lng: 80.2026,
        capacityEstimated: 2500,
        description: "Dry multimodal transit corridor with direct road access to airport and highway bypasses.",
        isVerified: true
      }
    ],
    contextSummary: "Velachery basin: Low-lying catchment historically inundated during 2015 & 2023 monsoons. High priority for shallow-draft boat staging."
  },
  {
    id: "central-flood",
    label: "Chennai Central Flood",
    locationName: "Chennai Central",
    coords: { lat: 13.0827, lng: 80.2757 },
    hazard: {
      type: "Flood",
      severity: "HIGH",
      description: "Cooum river surge and Buckingham canal overflow encroaching upon Evening Bazaar and railway access roads.",
      waterLevelEstimate: "Ankle to Knee level (15–40 cm)",
      waterMovementEstimate: "Stagnant / canal backflow"
    },
    defaultPopulation: 5000,
    defaultResources: {
      buses: 12,
      boats: 2,
      ambulances: 6,
      rescueTeams: 25,
      budget: 800000
    },
    defaultPriorities: {
      safety: 50,
      speed: 40,
      cost: 10,
      coverage: 0,
      reliability: 0
    },
    verifiedDestinations: [
      {
        id: "central-concourse",
        name: "Chennai Central Elevated Railway Concourse Hub",
        type: "TRANSIT_HUB",
        lat: 13.0827,
        lng: 80.2757,
        capacityEstimated: 4000,
        description: "Upper elevated concourse unaffected by street-level waterlogging; primary transit refuge.",
        isVerified: true
      },
      {
        id: "rajiv-gandhi-hospital",
        name: "Rajiv Gandhi Government General Hospital",
        type: "HOSPITAL",
        lat: 13.0799,
        lng: 80.2796,
        capacityEstimated: 1500,
        description: "Main state medical emergency facility located adjacent to Central station.",
        isVerified: true
      },
      {
        id: "ripon-staging",
        name: "Ripon Building Emergency Disaster Desk",
        type: "SHELTER",
        lat: 13.0825,
        lng: 80.2730,
        capacityEstimated: 1000,
        description: "Greater Chennai Corporation headquarters operations center.",
        isVerified: true
      }
    ],
    contextSummary: "Chennai Central: High-density passenger junction. Rapid multi-wave bus throughput required to clear stranded commuters."
  },
  {
    id: "tambaram-flood",
    label: "Tambaram Flood",
    locationName: "Tambaram, Chennai",
    coords: { lat: 12.9249, lng: 80.1000 },
    hazard: {
      type: "Flood",
      severity: "HIGH",
      description: "Adyar river headwater overflow and Mudichur lake bund breaches. Submergence of arterial link roads.",
      waterLevelEstimate: "Knee to Waist level (25–55 cm)",
      waterMovementEstimate: "Active torrential current near lake surplus weir"
    },
    defaultPopulation: 4200,
    defaultResources: {
      buses: 8,
      boats: 4,
      ambulances: 4,
      rescueTeams: 18,
      budget: 650000
    },
    defaultPriorities: {
      safety: 70,
      speed: 20,
      cost: 10,
      coverage: 0,
      reliability: 0
    },
    verifiedDestinations: [
      {
        id: "tambaram-sanatorium-shelter",
        name: "Tambaram High Ground Evacuation Center",
        type: "SHELTER",
        lat: 12.9320,
        lng: 80.1150,
        capacityEstimated: 1800,
        description: "Elevated municipal relief camp equipped with power backup and food kitchens.",
        isVerified: true
      },
      {
        id: "chromepet-hospital",
        name: "Chromepet Government Hospital Emergency Ward",
        type: "HOSPITAL",
        lat: 12.9515,
        lng: 80.1410,
        capacityEstimated: 400,
        description: "Sub-district healthcare center for primary triage.",
        isVerified: true
      },
      {
        id: "hindu-mission-hospital",
        name: "Hindu Mission Hospital Emergency Trauma Care",
        type: "HOSPITAL",
        lat: 12.9260,
        lng: 80.1190,
        capacityEstimated: 300,
        description: "Private multispecialty hospital with operational ICU units.",
        isVerified: true
      }
    ],
    contextSummary: "Tambaram / Mudichur: Upstream flood plain. Rapid water velocity necessitates rescue boats before bus embarkation."
  },
  {
    id: "madipakkam-flood",
    label: "Madipakkam Flood",
    locationName: "Madipakkam, Chennai",
    coords: { lat: 12.9623, lng: 80.1986 },
    hazard: {
      type: "Flood",
      severity: "MEDIUM",
      description: "Localized street waterlogging due to flat topography and lack of subsurface stormwater outlets.",
      waterLevelEstimate: "Ankle to Knee level (15–30 cm)",
      waterMovementEstimate: "Stagnant waterlogging"
    },
    defaultPopulation: 2800,
    defaultResources: {
      buses: 7,
      boats: 2,
      ambulances: 3,
      rescueTeams: 14,
      budget: 500000
    },
    defaultPriorities: {
      safety: 55,
      speed: 35,
      cost: 10,
      coverage: 0,
      reliability: 0
    },
    verifiedDestinations: [
      {
        id: "velachery-high-shelter",
        name: "GCC Flood Relief Shelter (Velachery High Ground)",
        type: "SHELTER",
        lat: 12.9780,
        lng: 80.2220,
        capacityEstimated: 1200,
        description: "Closest elevated shelter with dry approach from Inner Ring Road.",
        isVerified: true
      }
    ],
    contextSummary: "Madipakkam: Waterlogging primarily impedes low-clearance vehicles. High-axle buses operate safely on main thoroughfares."
  },
  {
    id: "guindy-flood",
    label: "Guindy Flood",
    locationName: "Guindy, Chennai",
    coords: { lat: 13.0067, lng: 80.2026 },
    hazard: {
      type: "Flood",
      severity: "MEDIUM",
      description: "Adyar river bridge approach waterlogging and Kathipara junction drainage overflow.",
      waterLevelEstimate: "Ankle level (10–25 cm)",
      waterMovementEstimate: "Flowing toward Adyar River mouth"
    },
    defaultPopulation: 2500,
    defaultResources: {
      buses: 8,
      boats: 1,
      ambulances: 4,
      rescueTeams: 15,
      budget: 450000
    },
    defaultPriorities: {
      safety: 45,
      speed: 45,
      cost: 10,
      coverage: 0,
      reliability: 0
    },
    verifiedDestinations: [
      {
        id: "guindy-assembly",
        name: "Guindy Industrial Estate High Assembly Ground",
        type: "SHELTER",
        lat: 13.0110,
        lng: 80.2080,
        capacityEstimated: 2000,
        description: "Wide elevated industrial apron with dry staging capacity.",
        isVerified: true
      }
    ],
    contextSummary: "Guindy: Critical traffic nexus connecting Central and South Chennai. Maintaining Kathipara bypass corridor is vital."
  }
];

export function getScenarioPreset(idOrPlace: string): ScenarioPreset | undefined {
  const lower = idOrPlace.toLowerCase();
  return (
    SCENARIO_PRESETS.find((p) => p.id === lower) ||
    SCENARIO_PRESETS.find((p) => lower.includes(p.locationName.toLowerCase()) || p.locationName.toLowerCase().includes(lower)) ||
    SCENARIO_PRESETS.find((p) => lower.includes(p.label.toLowerCase()))
  );
}

export function resolveBestDestination(
  preset: ScenarioPreset,
  priorities: { safety: number; speed: number; cost: number }
): { destination: VerifiedDestination | null; rationale: string } {
  if (!preset.verifiedDestinations || preset.verifiedDestinations.length === 0) {
    return {
      destination: null,
      rationale: "No verified evacuation destination available."
    };
  }

  // If safety is highest priority, prioritize dedicated SHELTER high ground
  if (priorities.safety >= priorities.speed && priorities.safety >= priorities.cost) {
    const shelter = preset.verifiedDestinations.find((d) => d.type === "SHELTER") || preset.verifiedDestinations[0];
    return {
      destination: shelter,
      rationale: `Selected ${shelter.name} as primary destination to maximize flood elevation and safety margin (${shelter.description}).`
    };
  }

  // If speed is highest priority, prioritize closest TRANSIT_HUB or fastest corridor
  if (priorities.speed > priorities.safety) {
    const transit = preset.verifiedDestinations.find((d) => d.type === "TRANSIT_HUB") || preset.verifiedDestinations[0];
    return {
      destination: transit,
      rationale: `Selected ${transit.name} to expedite passenger staging and multi-wave vehicle turnaround.`
    };
  }

  // Default: first verified destination
  const def = preset.verifiedDestinations[0];
  return {
    destination: def,
    rationale: `Selected verified ${def.type.toLowerCase()} destination: ${def.name}.`
  };
}
