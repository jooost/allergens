import { cn } from "../lib/utils.js";

// Short display label for each EU-14 allergen code
const LABELS: Record<string, string> = {
  GLUTEN:    "Glu",
  CRUST:     "Cru",
  EGGS:      "Egg",
  FISH:      "Fsh",
  PEANUTS:   "Pnt",
  SOY:       "Soy",
  MILK:      "Mlk",
  NUTS:      "Nut",
  CELERY:    "Cel",
  MUSTARD:   "Mus",
  SESAME:    "Ses",
  SULPHITES: "Sul",
  LUPIN:     "Lup",
  MOLLUSCS:  "Mol",
};

// Consistent colour per allergen — maps to Tailwind colour classes
const COLOURS: Record<string, { bg: string; text: string; ring: string }> = {
  GLUTEN:    { bg: "bg-amber-500",  text: "text-white",      ring: "ring-amber-500"  },
  CRUST:     { bg: "bg-orange-500", text: "text-white",      ring: "ring-orange-500" },
  EGGS:      { bg: "bg-yellow-400", text: "text-yellow-900", ring: "ring-yellow-400" },
  FISH:      { bg: "bg-blue-500",   text: "text-white",      ring: "ring-blue-500"   },
  PEANUTS:   { bg: "bg-lime-600",   text: "text-white",      ring: "ring-lime-600"   },
  SOY:       { bg: "bg-green-600",  text: "text-white",      ring: "ring-green-600"  },
  MILK:      { bg: "bg-sky-400",    text: "text-white",      ring: "ring-sky-400"    },
  NUTS:      { bg: "bg-brown-500",  text: "text-white",      ring: "ring-stone-500"  },
  CELERY:    { bg: "bg-emerald-500",text: "text-white",      ring: "ring-emerald-500"},
  MUSTARD:   { bg: "bg-yellow-600", text: "text-white",      ring: "ring-yellow-600" },
  SESAME:    { bg: "bg-stone-500",  text: "text-white",      ring: "ring-stone-500"  },
  SULPHITES: { bg: "bg-purple-500", text: "text-white",      ring: "ring-purple-500" },
  LUPIN:     { bg: "bg-pink-500",   text: "text-white",      ring: "ring-pink-500"   },
  MOLLUSCS:  { bg: "bg-teal-500",   text: "text-white",      ring: "ring-teal-500"   },
};

const DEFAULT_COLOUR = { bg: "bg-gray-400", text: "text-white", ring: "ring-gray-400" };

interface AllergenPillProps {
  code: string;
  presence: "Contains" | "MayContain";
  highlighted?: boolean;
  dimmed?: boolean;
}

export function AllergenPill({ code, presence, highlighted = false, dimmed = false }: AllergenPillProps) {
  const label = LABELS[code] ?? code.slice(0, 3);
  const colour = COLOURS[code] ?? DEFAULT_COLOUR;

  return (
    <span
      title={`${code} — ${presence === "Contains" ? "Contains" : "May Contain"}`}
      className={cn(
        "inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none ring-1 transition-opacity",
        colour.bg, colour.text, colour.ring,
        highlighted && "ring-2 scale-110",
        dimmed && "opacity-30",
      )}
    >
      {label}
    </span>
  );
}
