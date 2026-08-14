// Server-side mirror of the mobile client's allergy phrase list. When Phase 1
// promotes allergies to a first-class `Order.allergies: string[]`, this helper
// stops being used \u2014 the field carries the same labels.

const PATTERNS: readonly { label: string; regex: RegExp }[] = [
  { label: "PEANUT ALLERGY", regex: /\b(peanut|nut)s?\b/i },
  {
    label: "GLUTEN INTOLERANT",
    regex: /\b(gluten|wheat|gluten-free|celiac)\b/i,
  },
  { label: "DAIRY ALLERGY", regex: /\b(dairy|lactose|milk allergy)\b/i },
  { label: "EGG ALLERGY", regex: /\begg allergy\b|\ballergic to eggs?\b/i },
  {
    label: "SHELLFISH ALLERGY",
    regex: /\b(shellfish|prawn|shrimp) allergy\b/i,
  },
  { label: "JAIN", regex: /\bjain\b/i },
  {
    label: "NO ONION/GARLIC",
    regex: /\b(no onion|no garlic|onion.free|garlic.free)\b/i,
  },
];

export const detectAllergiesInText = (
  text: string | null | undefined,
): string[] => {
  if (!text) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of PATTERNS) {
    if (!seen.has(p.label) && p.regex.test(text)) {
      seen.add(p.label);
      out.push(p.label);
    }
  }
  return out;
};
