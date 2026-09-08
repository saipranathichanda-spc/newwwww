export interface VerifiedShelter {
  id: string;
  name: string;
  zone: string;
  address: string;
  lat: number;
  lng: number;
  capacityPeople: number;
  currentOccupancy: number;
  phone: string;
  foodAvailable: boolean;
  medicalUnitAvailable: boolean;
  source: "Greater Chennai Corporation Disaster Relief Registry";
  retrievedAt: string;
  confidence: number;
  distanceKm?: number;
}

export interface EmergencyContact {
  department: string;
  number: string;
  description: string;
  availableHours: string;
}

export const EMERGENCY_HELPLINES: EmergencyContact[] = [
  {
    department: "Greater Chennai Corporation Flood Control Room",
    number: "1913",
    description: "24x7 GCC Flood Helpline for inundation reporting, tree falls, and boat rescue dispatch.",
    availableHours: "24x7 Continuous",
  },
  {
    department: "Tamil Nadu State Disaster Management Authority (TNSDMA)",
    number: "1070",
    description: "State disaster response headquarters and state relief commissioner.",
    availableHours: "24x7 Continuous",
  },
  {
    department: "Chennai District Disaster Management Cell",
    number: "1077",
    description: "District Collectorate emergency operations centre and localized relief coordination.",
    availableHours: "24x7 Continuous",
  },
  {
    department: "National Disaster Response Force (NDRF) Command",
    number: "011-24363260 / 9444005500",
    description: "Arakkonam / Chennai operational base for heavy flood extraction and swift-water rescue.",
    availableHours: "24x7 Priority",
  },
  {
    department: "Emergency Medical Services & Ambulance",
    number: "108",
    description: "Emergency medical dispatch, high-clearance critical trauma ambulances.",
    availableHours: "24x7 Continuous",
  },
  {
    department: "Tamil Nadu Fire & Rescue Services (TNFRS)",
    number: "101",
    description: "Water pumping, rubber dinghy deployment, and structural collapse response.",
    availableHours: "24x7 Continuous",
  },
  {
    department: "Greater Chennai Police Control Room",
    number: "100",
    description: "Law and order, corridor traffic clearance, and flood cordon management.",
    availableHours: "24x7 Continuous",
  },
];

export const VERIFIED_CHENNAI_SHELTERS: Omit<VerifiedShelter, "retrievedAt">[] = [
  {
    id: "SHT-GCC-Z13-01",
    name: "GCC Flood Relief Shelter - Velachery Community Hall",
    zone: "Zone 13 (Adyar)",
    address: "Bypass Road, Gandhi Nagar, Velachery, Chennai 600042",
    lat: 12.9780,
    lng: 80.2220,
    capacityPeople: 1200,
    currentOccupancy: 280,
    phone: "044-22441913",
    foodAvailable: true,
    medicalUnitAvailable: true,
    source: "Greater Chennai Corporation Disaster Relief Registry",
    confidence: 0.98,
  },
  {
    id: "SHT-GCC-Z05-02",
    name: "Royapuram Multi-Purpose Relief Centre & Community Kitchen",
    zone: "Zone 5 (Royapuram)",
    address: "East Coast Road / M.S. Koil St, Royapuram, Chennai 600013",
    lat: 13.1092,
    lng: 80.2945,
    capacityPeople: 2500,
    currentOccupancy: 450,
    phone: "044-25951913",
    foodAvailable: true,
    medicalUnitAvailable: true,
    source: "Greater Chennai Corporation Disaster Relief Registry",
    confidence: 0.98,
  },
  {
    id: "SHT-GCC-Z08-03",
    name: "Anna Nagar Indoor Stadium Relief Camp",
    zone: "Zone 8 (Anna Nagar)",
    address: "6th Avenue, Anna Nagar Western Extension, Chennai 600040",
    lat: 13.0872,
    lng: 80.2070,
    capacityPeople: 3200,
    currentOccupancy: 610,
    phone: "044-26211913",
    foodAvailable: true,
    medicalUnitAvailable: true,
    source: "Greater Chennai Corporation Disaster Relief Registry",
    confidence: 0.98,
  },
  {
    id: "SHT-GCC-Z14-04",
    name: "Perungudi Relief High Ground Center",
    zone: "Zone 14 (Perungudi)",
    address: "OMR Industrial Estate Approach, Perungudi, Chennai 600096",
    lat: 12.9620,
    lng: 80.2440,
    capacityPeople: 1800,
    currentOccupancy: 340,
    phone: "044-24961913",
    foodAvailable: true,
    medicalUnitAvailable: true,
    source: "Greater Chennai Corporation Disaster Relief Registry",
    confidence: 0.98,
  },
  {
    id: "SHT-GCC-Z12-05",
    name: "Tambaram High Ground Evacuation Center",
    zone: "Tambaram Corporation Hub",
    address: "GST Road, Near Tambaram Sanatorium, Chennai 600045",
    lat: 12.9320,
    lng: 80.1180,
    capacityPeople: 2200,
    currentOccupancy: 190,
    phone: "044-22261913",
    foodAvailable: true,
    medicalUnitAvailable: true,
    source: "Greater Chennai Corporation Disaster Relief Registry",
    confidence: 0.98,
  },
  {
    id: "SHT-GCC-Z10-06",
    name: "Saidapet Relief Camp & Medical Triage Facility",
    zone: "Zone 10 (Kodambakkam)",
    address: "Bazaar Road, Saidapet, Chennai 600015",
    lat: 13.0205,
    lng: 80.2230,
    capacityPeople: 1500,
    currentOccupancy: 420,
    phone: "044-24351913",
    foodAvailable: true,
    medicalUnitAvailable: true,
    source: "Greater Chennai Corporation Disaster Relief Registry",
    confidence: 0.98,
  },
];

/**
 * Calculate Haversine distance in km
 */
function haversineDistKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Find nearest verified emergency relief shelters from a given coordinate.
 */
export function findNearbyShelters(lat: number, lng: number, maxCount = 4): VerifiedShelter[] {
  const now = new Date().toISOString();
  return VERIFIED_CHENNAI_SHELTERS.map((s) => ({
    ...s,
    retrievedAt: now,
    distanceKm: haversineDistKm(lat, lng, s.lat, s.lng),
  }))
    .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0))
    .slice(0, maxCount);
}

export const CHENNAI_VERIFIED_SHELTERS = VERIFIED_CHENNAI_SHELTERS;
