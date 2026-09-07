export type IncidentSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type IncidentStatus = "PENDING" | "ACKNOWLEDGED" | "DISPATCHED" | "RESOLVED";

export type CitizenReport = {
  id: string;
  sessionId: string;
  timestamp: string;
  location: {
    name: string;
    lat: number;
    lng: number;
  };
  destination?: {
    name: string;
    lat: number;
    lng: number;
  };
  distanceKm?: number;
  travelMinutes?: number;
  riskScore?: number;
  routeSafetyStatus?: "SAFE_CORRIDOR" | "MODERATE_RISK" | "HIGH_RISK";
  routeGeometry?: [number, number][];
  hazards?: Array<{ kmMarker: number; label: string }>;
  highRiskAreas?: string[];
  nearbyHospitals?: Array<{ name: string; distanceKm: number | null; travelMinutes: number | null }>;
  answers?: {
    waterLevel?: string;
    waterMovement?: string;
    mobility?: string;
    vulnerability?: string;
    assistance?: string;
  };
  waterLevel: string;
  waterMovement: string;
  peopleCount: number;
  needsEvacuation: boolean;
  hasMedicalEmergency: boolean;
  notes: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
};

// Seed with realistic demo incidents in Chennai with route context
const initialReports: CitizenReport[] = [
  {
    id: "REP-CHN-801",
    sessionId: "user-session-demo-1",
    timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    location: {
      name: "Velachery Main Road, near Lake View",
      lat: 12.9815,
      lng: 80.218,
    },
    destination: {
      name: "Chennai Central Railway Station (Elevated Hub)",
      lat: 13.0827,
      lng: 80.2757,
    },
    distanceKm: 18.4,
    travelMinutes: 38,
    riskScore: 68,
    routeSafetyStatus: "MODERATE_RISK",
    routeGeometry: [
      [80.218, 12.9815],
      [80.224, 12.995],
      [80.231, 13.015],
      [80.252, 13.048],
      [80.2757, 13.0827],
    ],
    hazards: [
      { kmMarker: 2.1, label: "Velachery Lake overflow onto 100-ft bypass road" },
      { kmMarker: 7.4, label: "Adyar River bridge approach slow movement" },
    ],
    highRiskAreas: ["Velachery low-lying lake basin", "Adyar flood corridor"],
    nearbyHospitals: [
      { name: "Apollo Speciality Hospital OMR", distanceKm: 3.2, travelMinutes: 8 },
      { name: "Fortis Malar Hospital Adyar", distanceKm: 5.8, travelMinutes: 14 },
    ],
    answers: {
      waterLevel: "Knee level (15-50 cm)",
      waterMovement: "Slowly flowing",
      mobility: "Four-wheeler / SUV",
      vulnerability: "Elderly resident (age 78)",
      assistance: "Evacuation route guidance",
    },
    waterLevel: "Knee level (15-50 cm)",
    waterMovement: "Slowly flowing",
    peopleCount: 4,
    needsEvacuation: true,
    hasMedicalEmergency: false,
    notes: "Ground floor flooded. Water rising toward living room. Need safe exit guidance before dark.",
    severity: "HIGH",
    status: "ACKNOWLEDGED",
  },
  {
    id: "REP-CHN-802",
    sessionId: "user-session-demo-2",
    timestamp: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
    location: {
      name: "Perumbakkam Global Hospital Road",
      lat: 12.8982,
      lng: 80.1912,
    },
    destination: {
      name: "Gleneagles Health City Emergency Center",
      lat: 12.898,
      lng: 80.1915,
    },
    distanceKm: 2.8,
    travelMinutes: 25,
    riskScore: 92,
    routeSafetyStatus: "HIGH_RISK",
    routeGeometry: [
      [80.1912, 12.8982],
      [80.1913, 12.8981],
      [80.1915, 12.898],
    ],
    hazards: [
      { kmMarker: 0.5, label: "Perumbakkam marsh overflow exceeding 1.2 meters depth" },
    ],
    highRiskAreas: ["Perumbakkam wetland drainage zone"],
    nearbyHospitals: [
      { name: "Gleneagles Health City", distanceKm: 0.3, travelMinutes: 5 },
    ],
    answers: {
      waterLevel: "Waist level (> 50 cm)",
      waterMovement: "Fast-flowing / Torrential",
      mobility: "Stranded (Cannot move safely)",
      vulnerability: "Dialysis patient requiring urgent treatment",
      assistance: "Immediate rescue / boat required",
    },
    waterLevel: "Waist level (> 50 cm)",
    waterMovement: "Fast-flowing / Torrential",
    peopleCount: 6,
    needsEvacuation: true,
    hasMedicalEmergency: true,
    notes: "Elderly resident requires dialysis today. Water current too swift for private vehicles. Urgent rescue boat required.",
    severity: "CRITICAL",
    status: "DISPATCHED",
  },
];

let reports: CitizenReport[] = [...initialReports];

export function getAllReports(): CitizenReport[] {
  return [...reports].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function createReport(data: Omit<CitizenReport, "id" | "timestamp" | "status">): CitizenReport {
  const newReport: CitizenReport = {
    ...data,
    id: `REP-CHN-${Math.floor(1000 + Math.random() * 9000)}`,
    timestamp: new Date().toISOString(),
    status: "PENDING",
  };
  reports.unshift(newReport);
  return newReport;
}

export function updateReportStatus(id: string, status: IncidentStatus): CitizenReport | null {
  const index = reports.findIndex((r) => r.id === id);
  if (index === -1) return null;
  reports[index] = { ...reports[index], status };
  return reports[index];
}
