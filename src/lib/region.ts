const REGION_KEY = "wesaw.region";

export const REGIONS: { code: string; name: string }[] = [
  { code: "AE", name: "United Arab Emirates" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "QA", name: "Qatar" },
  { code: "KW", name: "Kuwait" },
  { code: "BH", name: "Bahrain" },
  { code: "OM", name: "Oman" },
  { code: "JO", name: "Jordan" },
  { code: "LB", name: "Lebanon" },
  { code: "EG", name: "Egypt" },
  { code: "MA", name: "Morocco" },
  { code: "ZA", name: "South Africa" },
  { code: "NG", name: "Nigeria" },
  { code: "KE", name: "Kenya" },
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "IE", name: "Ireland" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "PT", name: "Portugal" },
  { code: "NL", name: "Netherlands" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },
  { code: "PL", name: "Poland" },
  { code: "TR", name: "Türkiye" },
  { code: "IN", name: "India" },
  { code: "PK", name: "Pakistan" },
  { code: "BD", name: "Bangladesh" },
  { code: "LK", name: "Sri Lanka" },
  { code: "SG", name: "Singapore" },
  { code: "MY", name: "Malaysia" },
  { code: "ID", name: "Indonesia" },
  { code: "PH", name: "Philippines" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "AR", name: "Argentina" },
];

export function regionName(code: string): string {
  return REGIONS.find((region) => region.code === code)?.name ?? code;
}

function detectRegion(): string {
  const match = navigator.language?.toUpperCase().match(/-([A-Z]{2})$/);
  return match ? match[1] : "US";
}

export function getRegion(): string {
  try {
    const stored = localStorage.getItem(REGION_KEY);
    if (stored) return stored;
  } catch {
    console.warn("Could not read the region preference.");
  }
  return detectRegion();
}

export function hasRegionChoice(): boolean {
  try {
    return localStorage.getItem(REGION_KEY) != null;
  } catch {
    return false;
  }
}

export function setRegion(code: string) {
  try {
    localStorage.setItem(REGION_KEY, code);
  } catch {
    console.warn("Could not persist the region preference.");
  }
}
