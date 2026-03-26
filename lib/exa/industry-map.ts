export type IndustrySlug =
  | "accounting"
  | "legal"
  | "medical"
  | "dental"
  | "real_estate"
  | "financial_advisory"
  | "insurance"
  | "consulting"
  | "construction"
  | "retail"
  | "restaurant"
  | "generic";

export interface IndustryBenchmarkQueries {
  trustSignals: string;
  trustSummaryPrompt: string;
  visualHierarchy: string;
  visualSummaryPrompt: string;
}

export const INDUSTRY_BENCHMARK_QUERIES: Record<IndustrySlug, IndustryBenchmarkQueries> = {
  accounting: {
    trustSignals: "top accounting firm website trust signals credentials certifications 2025",
    trustSummaryPrompt: "What trust signals do top accounting firm websites use? List specific elements and patterns.",
    visualHierarchy: "best accounting firm website design layout visual hierarchy 2025",
    visualSummaryPrompt: "What visual hierarchy and layout patterns do top accounting firm websites use?",
  },
  legal: {
    trustSignals: "top law firm website trust signals bar certifications testimonials 2025",
    trustSummaryPrompt: "What trust signals do top law firm websites use? List specific elements.",
    visualHierarchy: "best law firm website design layout conversion 2025",
    visualSummaryPrompt: "What visual hierarchy and layout patterns do top law firm websites use?",
  },
  medical: {
    trustSignals: "best medical practice website trust signals credentials patient reviews 2025",
    trustSummaryPrompt: "What trust signals do top medical practice websites use?",
    visualHierarchy: "top medical clinic website design layout UX 2025",
    visualSummaryPrompt: "What visual hierarchy and layout patterns do top medical websites use?",
  },
  dental: {
    trustSignals: "top dental practice website trust signals reviews credentials 2025",
    trustSummaryPrompt: "What trust signals do top dental practice websites use?",
    visualHierarchy: "best dental website design layout conversion 2025",
    visualSummaryPrompt: "What visual hierarchy and layout patterns do top dental websites use?",
  },
  real_estate: {
    trustSignals: "top real estate agent website trust signals reviews credentials 2025",
    trustSummaryPrompt: "What trust signals do top real estate websites use?",
    visualHierarchy: "best real estate website design layout lead generation 2025",
    visualSummaryPrompt: "What visual hierarchy and layout patterns do top real estate websites use?",
  },
  financial_advisory: {
    trustSignals: "top financial advisor website trust signals SEC credentials reviews 2025",
    trustSummaryPrompt: "What trust signals do top financial advisor websites use?",
    visualHierarchy: "best financial advisor website design layout conversion 2025",
    visualSummaryPrompt: "What visual hierarchy and layout patterns do top financial advisor websites use?",
  },
  insurance: {
    trustSignals: "top insurance agency website trust signals reviews credentials 2025",
    trustSummaryPrompt: "What trust signals do top insurance agency websites use?",
    visualHierarchy: "best insurance website design layout conversion 2025",
    visualSummaryPrompt: "What visual hierarchy and layout patterns do top insurance websites use?",
  },
  consulting: {
    trustSignals: "top consulting firm website trust signals case studies credentials 2025",
    trustSummaryPrompt: "What trust signals do top consulting firm websites use?",
    visualHierarchy: "best consulting website design layout visual hierarchy 2025",
    visualSummaryPrompt: "What visual hierarchy and layout patterns do top consulting websites use?",
  },
  construction: {
    trustSignals: "top construction company website trust signals licenses reviews 2025",
    trustSummaryPrompt: "What trust signals do top construction company websites use?",
    visualHierarchy: "best construction company website design layout 2025",
    visualSummaryPrompt: "What visual hierarchy and layout patterns do top construction websites use?",
  },
  retail: {
    trustSignals: "top retail website trust signals reviews security badges 2025",
    trustSummaryPrompt: "What trust signals do top retail websites use?",
    visualHierarchy: "best retail website design layout conversion optimization 2025",
    visualSummaryPrompt: "What visual hierarchy and layout patterns do top retail websites use?",
  },
  restaurant: {
    trustSignals: "top restaurant website trust signals reviews awards 2025",
    trustSummaryPrompt: "What trust signals do top restaurant websites use?",
    visualHierarchy: "best restaurant website design layout UX 2025",
    visualSummaryPrompt: "What visual hierarchy and layout patterns do top restaurant websites use?",
  },
  generic: {
    trustSignals: "professional services website trust signals best practices 2025",
    trustSummaryPrompt: "What trust signals do top professional services websites use?",
    visualHierarchy: "professional services website design layout best practices 2025",
    visualSummaryPrompt: "What visual hierarchy and layout patterns do top professional services websites use?",
  },
};

export function normalizeIndustrySlug(rawIndustry: string): IndustrySlug {
  const lower = rawIndustry.toLowerCase();
  if (lower.includes("account") || lower.includes("cpa") || lower.includes("bookkeep")) return "accounting";
  if (lower.includes("law") || lower.includes("legal") || lower.includes("attorney") || lower.includes("solicitor")) return "legal";
  if (lower.includes("medical") || lower.includes("doctor") || lower.includes("clinic") || lower.includes("physician")) return "medical";
  if (lower.includes("dental") || lower.includes("dentist") || lower.includes("orthodon")) return "dental";
  if (lower.includes("real estate") || lower.includes("realtor") || lower.includes("realty")) return "real_estate";
  if (lower.includes("financial") || lower.includes("wealth") || lower.includes("invest") || lower.includes("advisor")) return "financial_advisory";
  if (lower.includes("insurance") || lower.includes("insur")) return "insurance";
  if (lower.includes("consult")) return "consulting";
  if (lower.includes("construct") || lower.includes("contractor") || lower.includes("build")) return "construction";
  if (lower.includes("retail") || lower.includes("shop") || lower.includes("store")) return "retail";
  if (lower.includes("restaurant") || lower.includes("dining") || lower.includes("cafe") || lower.includes("food")) return "restaurant";
  return "generic";
}
