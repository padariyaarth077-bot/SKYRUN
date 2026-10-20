export const VEHICLE_IMAGES = [
  {
    label: "Cadillac Escalade ESV 1",
    path: "/vehicle-images/cadillac-escalade-esv-1.jpg",
  },
  {
    label: "Cadillac Escalade ESV 2",
    path: "/vehicle-images/cadillac-escalade-esv-2.jpg",
  },
  {
    label: "chevrolet suburban",
    path: "/vehicle-images/chevrolet-suburban.jpg",
  },
  {
    label: "Executive shuttle & Sprinter configurations",
    path: "/vehicle-images/executive-shuttle-sprinter-configurations.jpg",
  },
  {
    label: "Ford Expedition MAX Platinum",
    path: "/vehicle-images/ford-expedition-max-platinum.jpg",
  },
  {
    label: "GMC Yukon XL Denali",
    path: "/vehicle-images/gmc-yukon-xl-denali.webp",
  },
  {
    label: "Lincoln Navigator L",
    path: "/vehicle-images/lincoln-navigator-l.jpg",
  },
  {
    label: "Mercedes-Benz Sprinter Executive Van",
    path: "/vehicle-images/mercedes-benz-sprinter-executive-van.jpg",
  },
  {
    label: "Mercedes-Benz Sprinter Jet Van",
    path: "/vehicle-images/mercedes-benz-sprinter-jet-van.jpg",
  },
  {
    label: "Mercedes-Maybach GLS",
    path: "/vehicle-images/mercedes-maybach-gls.jpg",
  },
  {
    label: "Mercedes-Maybach S-Class",
    path: "/vehicle-images/mercedes-maybach-s-class.jpg",
  },
  {
    label: "Rolls-Royce Cullinan",
    path: "/vehicle-images/rolls-royce-cullinan.jpg",
  },
  {
    label: "Rolls-Royce Ghost",
    path: "/vehicle-images/rolls-royce-ghost.jpg",
  },
  {
    label: "Rolls-Royce Phantom",
    path: "/vehicle-images/rolls-royce-phantom.jpg",
  },
] as const;

export function knownVehicleImage(path: string | null) {
  return VEHICLE_IMAGES.some((image) => image.path === path) ? path : null;
}

// Photo numbers identify alternate views, never a count of owned cars.
const modelNames: Record<string, string> = {
  "Cadillac Escalade ESV 1": "Cadillac Escalade ESV",
  "Cadillac Escalade ESV 2": "Cadillac Escalade ESV",
  "chevrolet suburban": "Chevrolet Suburban",
};
const modelPhotos = new Map<string, (typeof VEHICLE_IMAGES)[number][]>();
for (const image of VEHICLE_IMAGES) {
  const name = modelNames[image.label] ?? image.label;
  modelPhotos.set(name, [...(modelPhotos.get(name) ?? []), image]);
}
export const VEHICLE_MODELS = [...modelPhotos].map(([name, photos]) => ({ name, photos }));
