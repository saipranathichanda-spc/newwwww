export interface DispatchAuditRecord {
  id: string;
  timestamp: string;
  officerName: string;
  officerRole: string;
  locationName: string;
  locationCoordinates: { lat: number; lng: number };
  resources: {
    buses: number;
    boats: number;
    ambulances: number;
    rescueTeams: number;
  };
  corridor: string;
  distanceKm: number;
  reason: string;
  status: "OFFICIALLY_DISPATCHED" | "AUTHORIZATION_PENDING" | "CANCELLED";
}

const AUDIT_STORE: DispatchAuditRecord[] = [
  {
    id: "DSP-20260908-0101",
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    officerName: "Commander R. Natarajan",
    officerRole: "COMMANDER",
    locationName: "Velachery Low Basin",
    locationCoordinates: { lat: 12.9815, lng: 80.218 },
    resources: { buses: 10, boats: 4, ambulances: 3, rescueTeams: 12 },
    corridor: "Primary Radial Ring Bypass (Route 2)",
    distanceKm: 22.4,
    reason: "Severe lake bund breach risk; high ground staging corridor selected.",
    status: "OFFICIALLY_DISPATCHED",
  },
];

export function logDispatchRecord(record: Omit<DispatchAuditRecord, "id" | "timestamp">): DispatchAuditRecord {
  const newRecord: DispatchAuditRecord = {
    ...record,
    id: `DSP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    timestamp: new Date().toISOString(),
  };

  AUDIT_STORE.unshift(newRecord);
  if (AUDIT_STORE.length > 200) {
    AUDIT_STORE.pop();
  }
  return newRecord;
}

export function getAllDispatchAuditRecords(): DispatchAuditRecord[] {
  return [...AUDIT_STORE];
}
