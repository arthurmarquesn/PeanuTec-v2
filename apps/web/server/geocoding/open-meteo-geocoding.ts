import "server-only";

const GEOCODING_URL =
  "https://geocoding-api.open-meteo.com/v1/search";

type OpenMeteoResult = {
  id?: number;
  name?: string;
  latitude?: number;
  longitude?: number;
  country?: string;
  country_code?: string;
  admin1?: string;
};

type OpenMeteoResponse = {
  results?: OpenMeteoResult[];
};

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export class GeocodingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeocodingError";
  }
}

export async function geocodeCity(
  city: string,
): Promise<Coordinates> {
  const normalizedCity =
    city.trim();

  if (!normalizedCity) {
    throw new GeocodingError(
      "Informe uma cidade.",
    );
  }

  const params =
    new URLSearchParams({
      name: normalizedCity,
      count: "1",
      language: "pt",
      format: "json",
    });

  let response: Response;

  try {
    response = await fetch(
      `${GEOCODING_URL}?${params.toString()}`,
      {
        cache: "no-store",
      },
    );
  } catch {
    throw new GeocodingError(
      "Não foi possível consultar as coordenadas da cidade.",
    );
  }

  if (!response.ok) {
    throw new GeocodingError(
      "O serviço de localização não respondeu corretamente.",
    );
  }

  const data =
    (await response.json()) as OpenMeteoResponse;

  const result =
    data.results?.[0];

  if (!result) {
    throw new GeocodingError(
      `Cidade não encontrada no geocoding: ${normalizedCity}`,
    );
  }

  if (
    typeof result.latitude !==
      "number" ||
    typeof result.longitude !==
      "number"
  ) {
    throw new GeocodingError(
      "O serviço de localização retornou coordenadas inválidas.",
    );
  }

  return {
    latitude:
      result.latitude,

    longitude:
      result.longitude,
  };
}