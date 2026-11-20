import { VEHICLE_MODELS } from "@/lib/vehicle-images";

export const REGULAR_FLEET = [
  {
    name: "Regular Sedan",
    image: "/vehicle-images/regular-sedan.jpg",
    stock: true,
    description: "A straightforward choice for your airport transfer or journey across the city.",
  },
  {
    name: "Luxury Sedan",
    image: "/vehicle-images/luxury-sedan.jpg",
    stock: true,
    description: "A refined setting for business travel and occasions that call for a little more.",
  },
  {
    name: "Regular SUV",
    image: "/vehicle-images/chevrolet-suburban.jpg",
    stock: false,
    description: "Discuss your group and luggage needs for a journey with room for your plans.",
  },
  {
    name: "Luxury SUV",
    image: "/vehicle-images/cadillac-escalade-esv-2.jpg",
    stock: false,
    description: "An elevated SUV experience for executive journeys and special arrivals.",
  },
] as const;

// Named requests remain custom enquiries; category examples do not reclassify inventory.
const featuredSpecial = [
  "Rolls-Royce Ghost",
  "Mercedes-Benz Sprinter Jet Van",
  "Mercedes-Maybach GLS",
  "Mercedes-Maybach S-Class",
  "Rolls-Royce Cullinan",
  "Rolls-Royce Phantom",
];
export const SPECIAL_FLEET = VEHICLE_MODELS
  // Supplied GMC photo has visible dealership branding; retain the original in the asset library.
  .filter((model) => model.name !== "GMC Yukon XL Denali")
  .sort((a, b) => {
    const rank = (name: string) => {
      const index = featuredSpecial.indexOf(name);
      return index < 0 ? featuredSpecial.length : index;
    };
    return rank(a.name) - rank(b.name);
  });
export function fleetSelection(vehicle: unknown) {
  if (typeof vehicle !== "string") return undefined;
  if (REGULAR_FLEET.some((entry) => entry.name === vehicle)) return { vehicle, special: false };
  if (SPECIAL_FLEET.some((entry) => entry.name === vehicle)) return { vehicle, special: true };
  return undefined;
}
