export interface HistoricalFloodEvent {
  year: number;
  name: string;
  rainfallMmRecorded: number;
  inundationProfile: string;
  vulnerableLocalities: string[];
  keyBreachesOrRivers: string[];
}

export interface HistoricalContextResult {
  events: HistoricalFloodEvent[];
  matchedEvent: HistoricalFloodEvent | null;
  localityRiskLevel: "VERY_HIGH" | "HIGH" | "MODERATE" | "LOW";
  matchFound: boolean;
  historicalInundationNotes: string;
  source: string;
  status: "HISTORICAL";
}

const CHENNAI_HISTORICAL_FLOODS: HistoricalFloodEvent[] = [
  {
    year: 2015,
    name: "2015 South India Floods (December 2015)",
    rainfallMmRecorded: 494, // 24-hour recorded record at Tambaram/Meenambakkam
    inundationProfile: "Catastrophic river basin overflow following Chembarambakkam reservoir release (29,000 cusecs) and Adyar/Cooum river breach.",
    vulnerableLocalities: [
      "velachery",
      "tambaram",
      "mudichur",
      "adyar",
      "kotturpuram",
      "saidapet",
      "guindy",
      "jafferkhanpet",
      "porur",
      "manapakkam",
      "perumbakkam",
      "vyasarpadi"
    ],
    keyBreachesOrRivers: ["Adyar River", "Chembarambakkam surplus canal", "Buckingham Canal", "Pallikaranai Marshland"]
  },
  {
    year: 2023,
    name: "Cyclone Michaung (December 2023)",
    rainfallMmRecorded: 468, // Severe rainfall over 48 hours
    inundationProfile: "Severe urban waterlogging and stormwater canal backflow due to storm surge and intense localized precipitation in South Chennai basins.",
    vulnerableLocalities: [
      "velachery",
      "pallikaranai",
      "perumbakkam",
      "madipakkam",
      "medavakkam",
      "sholinganallur",
      "omr",
      "korattur",
      "pattalam",
      "vyasarpadi",
      "perambur"
    ],
    keyBreachesOrRivers: ["South Buckingham Canal", "Pallikaranai drainage corridors", "Otteri Nullah", "Kosasthalaiyar basin"]
  },
  {
    year: 2021,
    name: "November 2021 Northeast Monsoon Depression",
    rainfallMmRecorded: 215,
    inundationProfile: "Prolonged low-pressure depression causing sub-surface saturation, inundating low-lying residential layouts and arterial underpasses.",
    vulnerableLocalities: [
      "t. nagar",
      "gn chetty road",
      "mambalam",
      "velachery",
      "pulianthope",
      "kolathur"
    ],
    keyBreachesOrRivers: ["Mambalam Canal", "Otteri Nullah"]
  }
];

export function getHistoricalFloodContext(placeName: string): HistoricalContextResult {
  const lower = placeName.toLowerCase();

  const matchedEvents = CHENNAI_HISTORICAL_FLOODS.filter((event) =>
    event.vulnerableLocalities.some((loc) => lower.includes(loc))
  );

  const matchedEvent = matchedEvents[0] ?? null;
  const isHighRiskLocality = matchedEvents.length >= 2;
  const isModerateRiskLocality = matchedEvents.length === 1;

  const localityRiskLevel: HistoricalContextResult["localityRiskLevel"] = isHighRiskLocality
    ? "VERY_HIGH"
    : isModerateRiskLocality
    ? "HIGH"
    : lower.includes("chennai") || lower.includes("vit")
    ? "MODERATE"
    : "LOW";

  const notes = matchedEvent
    ? `Historical record match: ${placeName} experienced severe inundation during ${matchedEvent.name} (${matchedEvent.rainfallMmRecorded}mm recorded). Primary factor: ${matchedEvent.inundationProfile}`
    : `No specific historical major breach recorded for ${placeName}. Baseline South India monsoon inundation thresholds apply.`;

  return {
    events: CHENNAI_HISTORICAL_FLOODS,
    matchedEvent,
    localityRiskLevel,
    matchFound: Boolean(matchedEvent),
    historicalInundationNotes: notes,
    source: "Greater Chennai Disaster History Archive (2015-2023 Flood Records)",
    status: "HISTORICAL"
  };
}
