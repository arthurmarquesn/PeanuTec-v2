import type {
  SupportedDisease,
  SupportedDiseasesResponse,
} from "@/types/analysis";

export const SUPPORTED_DISEASES: SupportedDisease[] = [
  {
    id: "Mancha-preta",
    name: "Mancha-preta",
    pathogen: "Cercosporidium personatum",
    status: "validated",
  },
  {
    id: "Mancha-castanha",
    name: "Mancha-castanha",
    pathogen: "Cercospora arachidicola",
    status: "validated",
  },
];

export const SUPPORTED_DISEASE_ALIASES:
  Record<string, string> = {
    "Mancha-preta":
      "Mancha-preta",

    "Mancha-preta do amendoim":
      "Mancha-preta",

    "Mancha-castanha":
      "Mancha-castanha",

    "Mancha-castanha do amendoim":
      "Mancha-castanha",
  };

export function getSupportedDiseasesResponse():
  SupportedDiseasesResponse {
  return {
    supported_diseases:
      SUPPORTED_DISEASES,
  };
}
