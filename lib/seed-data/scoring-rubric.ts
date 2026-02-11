/**
 * Universal scoring rubric for 8 dimensions × 5 score ranges.
 * Used by the scoring engine to evaluate websites 0-100.
 */

export const DIMENSIONS = [
  "clarity",
  "visual",
  "hierarchy",
  "trust",
  "conversion",
  "content",
  "mobile",
  "performance",
] as const;

export type DimensionKey = (typeof DIMENSIONS)[number];

export const SCORE_RANGES = ["0-20", "21-40", "41-60", "61-80", "81-100"] as const;

export interface RubricCriteria {
  indicators: string[];
  antipatterns: string[];
  description: string;
}

const clarityRubric: Record<string, RubricCriteria> = {
  "0-20": {
    description: "No clear value proposition, confusing navigation, no visible CTA",
    indicators: ["No identifiable value prop", "Confusing or missing navigation", "No CTA", "Visitor cannot determine what the business does in 10+ seconds"],
    antipatterns: ["Generic stock messaging", "Multiple competing CTAs", "Buried or missing contact"],
  },
  "21-40": {
    description: "Vague messaging, generic headlines, weak CTA",
    indicators: ["Vague or generic value statement", "Headlines could apply to any business", "Weak or passive CTA", "Unclear who the business serves"],
    antipatterns: ["'We do it all' with no specifics", "CTA below the fold only", "Jargon-heavy copy"],
  },
  "41-60": {
    description: "Basic clarity, identifiable service, visible CTA",
    indicators: ["Service or product is identifiable", "One clear primary CTA", "Basic headline present", "Audience somewhat clear"],
    antipatterns: ["Too much text above the fold", "Multiple CTAs competing", "Unclear next step"],
  },
  "61-80": {
    description: "Strong clarity, specific value prop, compelling CTA",
    indicators: ["Specific value proposition", "Clear audience", "Single compelling CTA", "Visitor knows what to do within 5 seconds"],
    antipatterns: ["Minor ambiguity in offer", "CTA could be more prominent"],
  },
  "81-100": {
    description: "Exceptional - instant understanding in <5 seconds, perfect CTA placement",
    indicators: ["Instant understanding", "Crystal-clear value prop", "Optimal CTA placement and copy", "Obvious next step"],
    antipatterns: [],
  },
};

const visualRubric: Record<string, RubricCriteria> = {
  "0-20": {
    description: "Dated, cluttered, or unprofessional appearance",
    indicators: ["Heavily dated design", "Cluttered layout", "Inconsistent or unprofessional visuals", "Poor color/typography choices"],
    antipatterns: ["Stock photo overload", "No clear visual hierarchy", "Broken or stretched images"],
  },
  "21-40": {
    description: "Generic or inconsistent visual quality",
    indicators: ["Generic template look", "Inconsistent spacing or alignment", "Weak typography hierarchy", "Colors feel arbitrary"],
    antipatterns: ["Too many fonts", "Low-quality images", "No brand consistency"],
  },
  "41-60": {
    description: "Acceptable visual quality, some consistency",
    indicators: ["Readable and organized", "Consistent fonts and colors", "Reasonable imagery", "Basic hierarchy"],
    antipatterns: ["Could feel more modern", "Some visual noise", "Generic imagery"],
  },
  "61-80": {
    description: "Modern, intentional, trustworthy visual design",
    indicators: ["Modern and clean", "Intentional color and type", "Strong imagery", "Clear visual hierarchy"],
    antipatterns: ["Minor inconsistencies", "One or two weak elements"],
  },
  "81-100": {
    description: "Exceptional visual quality - publication-grade",
    indicators: ["Publication-grade design", "Perfect hierarchy and spacing", "Memorable and on-brand", "Highly trustworthy appearance"],
    antipatterns: [],
  },
};

const hierarchyRubric: Record<string, RubricCriteria> = {
  "0-20": {
    description: "No logical flow, impossible to scan",
    indicators: ["No clear flow", "Wall of text", "No headings or structure", "Random content order"],
    antipatterns: ["Everything same visual weight", "No sections", "Dense paragraphs only"],
  },
  "21-40": {
    description: "Weak structure, hard to scan",
    indicators: ["Some structure but weak", "Too much text per section", "Unclear section purposes", "Poor scanning order"],
    antipatterns: ["Long paragraphs", "Missing subheadings", "Buried key info"],
  },
  "41-60": {
    description: "Basic hierarchy, scannable",
    indicators: ["Headings present", "Sections identifiable", "Some bullet/list use", "Reasonable flow"],
    antipatterns: ["Some sections too long", "Hierarchy could be clearer", "Key info not always prominent"],
  },
  "61-80": {
    description: "Logical flow, easy to scan",
    indicators: ["Clear section flow", "Scannable headings and bullets", "Logical order", "Key info prominent"],
    antipatterns: ["Minor flow issues", "One section could be clearer"],
  },
  "81-100": {
    description: "Exceptional information hierarchy",
    indicators: ["Perfect scanning order", "Optimal chunking", "No cognitive load", "Every section has clear purpose"],
    antipatterns: [],
  },
};

const trustRubric: Record<string, RubricCriteria> = {
  "0-20": {
    description: "No trust signals, looks unestablished",
    indicators: ["No social proof", "No credentials or affiliations", "No clear business identity", "Feels anonymous or sketchy"],
    antipatterns: ["No about/team", "No contact details", "No reviews or testimonials"],
  },
  "21-40": {
    description: "Minimal trust signals",
    indicators: ["Very little social proof", "Generic or missing credentials", "Weak legitimacy signals", "No testimonials or case studies"],
    antipatterns: ["Stock testimonials", "No real names or photos", "Missing credentials"],
  },
  "41-60": {
    description: "Basic trust elements present",
    indicators: ["Some testimonials or reviews", "Contact info visible", "Basic about/team", "Reasonable legitimacy"],
    antipatterns: ["Could use more proof", "Credentials not prominent", "No third-party validation"],
  },
  "61-80": {
    description: "Strong trust and credibility",
    indicators: ["Clear social proof", "Credentials and affiliations", "Real testimonials with names", "Professional presence"],
    antipatterns: ["One area could be stronger", "Trust above fold could improve"],
  },
  "81-100": {
    description: "Exceptional trust - instant credibility",
    indicators: ["Trust proof above the fold", "Multiple proof types", "Industry credentials prominent", "Zero doubt about legitimacy"],
    antipatterns: [],
  },
};

const conversionRubric: Record<string, RubricCriteria> = {
  "0-20": {
    description: "No clear next step, high friction",
    indicators: ["No clear CTA", "High friction to act", "Unclear what to do", "No path to conversion"],
    antipatterns: ["Buried contact", "Multiple confusing options", "No urgency or reason to act"],
  },
  "21-40": {
    description: "Weak CTAs, high friction",
    indicators: ["Weak or passive CTAs", "Friction (too many steps, forms)", "Unclear next step", "CTA not compelling"],
    antipatterns: ["Generic 'Submit' or 'Click here'", "Long forms above the fold", "No benefit-focused CTA"],
  },
  "41-60": {
    description: "Visible CTA, moderate friction",
    indicators: ["CTA visible", "Reasonable friction", "Clear primary action", "Some benefit in CTA copy"],
    antipatterns: ["CTA could be stronger", "Form could be shorter", "Secondary CTAs compete"],
  },
  "61-80": {
    description: "Easy next step, clear CTA",
    indicators: ["Low-friction path", "Clear primary CTA", "Compelling CTA copy", "Obvious next step"],
    antipatterns: ["Minor friction", "One CTA could be clearer"],
  },
  "81-100": {
    description: "Exceptional conversion design - minimal friction",
    indicators: ["Minimal friction", "Perfect CTA placement and copy", "Single clear path", "Urgency and value in CTA"],
    antipatterns: [],
  },
};

const contentRubric: Record<string, RubricCriteria> = {
  "0-20": {
    description: "Unreadable, buzzword-heavy, or clearly not for humans",
    indicators: ["Heavy jargon or buzzwords", "Not written for humans", "Unclear or confusing copy", "No benefit focus"],
    antipatterns: ["Keyword stuffing", "Corporate speak", "No clear benefits"],
  },
  "21-40": {
    description: "Generic or weak content quality",
    indicators: ["Generic or filler copy", "Feature-focused not benefit-focused", "Some jargon", "Hard to skim"],
    antipatterns: ["'Leading provider' type claims", "Long paragraphs", "No differentiation"],
  },
  "41-60": {
    description: "Acceptable content, readable",
    indicators: ["Readable and mostly clear", "Some benefit focus", "Reasonable length", "Scannable in places"],
    antipatterns: ["Could be more compelling", "Some filler", "Headlines could be stronger"],
  },
  "61-80": {
    description: "Strong content - benefit-focused, scannable",
    indicators: ["Benefit-focused", "Scannable (bullets, short paragraphs)", "Clear and compelling", "Minimal jargon"],
    antipatterns: ["One section could be tighter", "Minor buzzwords"],
  },
  "81-100": {
    description: "Exceptional content - human, clear, compelling",
    indicators: ["Written for humans", "Zero filler", "Highly scannable", "Consistently benefit-focused and clear"],
    antipatterns: [],
  },
};

const mobileRubric: Record<string, RubricCriteria> = {
  "0-20": {
    description: "Broken or unusable on mobile",
    indicators: ["Broken layout on mobile", "Unreadable text", "Tiny tap targets", "Horizontal scroll or cut-off content"],
    antipatterns: ["Desktop-only design", "No mobile consideration", "Images not responsive"],
  },
  "21-40": {
    description: "Poor mobile experience",
    indicators: ["Significant mobile issues", "Small text or buttons", "Cramped layout", "Key actions hard to use"],
    antipatterns: ["Not responsive", "Forms difficult on mobile", "CTA hard to tap"],
  },
  "41-60": {
    description: "Basic mobile usability",
    indicators: ["Responsive layout", "Readable text", "Acceptable tap targets", "Main content accessible"],
    antipatterns: ["Could be more mobile-first", "Some elements small", "Spacing could improve"],
  },
  "61-80": {
    description: "Good mobile experience",
    indicators: ["Mobile-friendly", "Comfortable reading and tapping", "Good spacing", "Key actions easy"],
    antipatterns: ["Minor mobile tweaks possible", "One flow could be smoother"],
  },
  "81-100": {
    description: "Exceptional mobile experience",
    indicators: ["Mobile-first or perfectly adapted", "Optimal touch targets and spacing", "No friction on small screens", "Feels native to mobile"],
    antipatterns: [],
  },
};

const performanceRubric: Record<string, RubricCriteria> = {
  "0-20": {
    description: "Slow, broken, or insecure",
    indicators: ["Very slow load", "Broken links or images", "Security issues (no HTTPS)", "Obvious technical problems"],
    antipatterns: ["No SSL", "Heavy unoptimized assets", "Errors in console"],
  },
  "21-40": {
    description: "Notable technical or performance issues",
    indicators: ["Slow loading", "Some broken elements", "Missing meta or basics", "Poor core web vitals"],
    antipatterns: ["Large images", "No lazy loading", "Missing alt text"],
  },
  "41-60": {
    description: "Acceptable performance and technical baseline",
    indicators: ["Reasonable load time", "HTTPS", "Most elements work", "Basic meta tags"],
    antipatterns: ["Could be faster", "Some optimization missing", "Minor technical debt"],
  },
  "61-80": {
    description: "Good performance and technical quality",
    indicators: ["Fast load", "Secure", "No broken elements", "Good practices (meta, alt, etc.)"],
    antipatterns: ["Could be optimized further", "One or two minor issues"],
  },
  "81-100": {
    description: "Exceptional - fast, secure, no issues",
    indicators: ["Very fast", "Fully secure", "Zero broken elements", "Best practices throughout"],
    antipatterns: [],
  },
};

export const RUBRIC_BY_DIMENSION: Record<DimensionKey, Record<string, RubricCriteria>> = {
  clarity: clarityRubric,
  visual: visualRubric,
  hierarchy: hierarchyRubric,
  trust: trustRubric,
  conversion: conversionRubric,
  content: contentRubric,
  mobile: mobileRubric,
  performance: performanceRubric,
};

export function getRubricEntries(): Array<{
  dimension: string;
  scoreRange: string;
  criteria: RubricCriteria;
}> {
  const entries: Array<{ dimension: string; scoreRange: string; criteria: RubricCriteria }> = [];
  for (const dimension of DIMENSIONS) {
    const rubric = RUBRIC_BY_DIMENSION[dimension];
    for (const scoreRange of SCORE_RANGES) {
      entries.push({
        dimension,
        scoreRange,
        criteria: rubric[scoreRange],
      });
    }
  }
  return entries;
}
