export type DiagnosticApiResponse = {
  diagnostico: string;
  gravedad: number;
  piezasNecesarias: string[];
  pruebasRecomendadas: string[];
  costeEstimado: string;
};

type MockRule = {
  keywords: string[];
  diagnostico: string;
  gravedad: number;
  piezasNecesarias: string[];
  pruebasRecomendadas: string[];
  costeEstimado: string;
};

const MOCK_RULES: MockRule[] = [
  {
    keywords: ["p0300", "misfire", "tirones", "falla encendido"],
    diagnostico:
      "Fallo de encendido intermitente. Probable desgaste en bujias o bobinas y posible inyeccion irregular.",
    gravedad: 8,
    piezasNecesarias: ["Juego de bujias", "Bobina de encendido", "Limpieza de inyectores"],
    pruebasRecomendadas: [
      "Medir resistencia de bujias y bobinas con polímetro y comparar con especificaciones",
      "Inspeccionar y registrar fallos por cilindro (freeze frame) para acotar el componente",
      "Comprobar presión de combustible (rail/retorno) y caudal de inyección",
      "Verificar fugas de vacío y estado de cables/conectores"
    ],
    costeEstimado: "180 - 520 EUR",
  },
  {
    keywords: ["p0420", "catalizador", "emisiones", "huele mal"],
    diagnostico:
      "Eficiencia baja del catalizador o lectura incorrecta de sonda lambda en el escape.",
    gravedad: 6,
    piezasNecesarias: ["Sonda lambda", "Catalizador (si aplica)", "Juntas de escape"],
    pruebasRecomendadas: [
      "Comparar lecturas de sondas lambda (antes/despues) en oscilación y tiempo de respuesta",
      "Comprobar fugas en escape (juntas, sonda) y humo/olor por estanqueidad",
      "Verificar posibles fallos de mezcla (fuel trims) que afecten la eficiencia del catalizador",
      "Revisar presión y funcionamiento del sistema de EVAP/PCV si hay consumos anómalos"
    ],
    costeEstimado: "220 - 1100 EUR",
  },
  {
    keywords: ["humo blanco", "refrigerante", "calienta", "junta culata"],
    diagnostico:
      "Posible fuga interna de refrigerante por junta de culata o microfisura en culata.",
    gravedad: 9,
    piezasNecesarias: ["Kit junta culata", "Tornilleria culata", "Liquido refrigerante"],
    pruebasRecomendadas: [
      "Realizar prueba de presión del circuito de refrigeración y localizar pérdida",
      "Comprobar CO2 en refrigerante (ensayo de junta) y presiones al calentar",
      "Medir consumo y compresión por cilindro (test de compresión o leak-down)",
      "Inspeccionar emulsión en aceite y variación de nivel en ciclos térmicos"
    ],
    costeEstimado: "900 - 2400 EUR",
  },
  {
    keywords: ["vibracion", "frenar", "frenos", "discos"],
    diagnostico:
      "Vibracion asociada a discos de freno alabeados o desgaste irregular en pastillas.",
    gravedad: 5,
    piezasNecesarias: ["Discos de freno", "Pastillas de freno", "Equilibrado ruedas"],
    pruebasRecomendadas: [
      "Inspeccionar discos con reloj comparador y medir alabeo (runout)",
      "Revisar apriete de tornilleria y estado de cubos/rodamientos",
      "Comprobar equilibrado dinámico y desgaste irregular de neumáticos",
      "Verificar holguras en suspensión y silentblocks (prueba visual y de juego)"
    ],
    costeEstimado: "160 - 650 EUR",
  },
];

function clampSeverity(value: number): number {
  if (!Number.isFinite(value)) return 5;
  return Math.max(1, Math.min(10, Math.round(value)));
}

export function createMockDiagnostic(query: string): DiagnosticApiResponse {
  const q = query.toLowerCase().trim();
  const matchedRule = MOCK_RULES.find((rule) =>
    rule.keywords.some((keyword) => q.includes(keyword)),
  );

  if (!matchedRule) {
    return {
      diagnostico:
        "Anomalia no concluyente con la descripcion actual. Se recomienda escaneo OBD-II y revision de mantenimiento basico.",
      gravedad: 4,
      piezasNecesarias: ["Escaneo OBD-II", "Filtro de aire", "Revision bateria"],
      pruebasRecomendadas: [
        "Realizar escaneo OBD-II completo y revisar códigos permanentes y pendientes",
        "Inspeccionar filtro de aire y estado de batería/conexiones",
        "Comprobar niveles (aceite, refrigerante) y funcionamiento de sensores básicos",
      ],
      costeEstimado: "60 - 220 EUR",
    };
  }

  return {
    diagnostico: matchedRule.diagnostico,
    gravedad: clampSeverity(matchedRule.gravedad),
    piezasNecesarias: matchedRule.piezasNecesarias,
    pruebasRecomendadas: matchedRule.pruebasRecomendadas,
    costeEstimado: matchedRule.costeEstimado,
  };
}

export function parseAiDiagnostic(raw: string): DiagnosticApiResponse {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("No se pudo parsear la respuesta JSON del modelo.");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Formato JSON invalido devuelto por IA.");
  }

  const obj = parsed as Record<string, unknown>;
  const diagnostico =
    typeof obj.Diagnostico === "string"
      ? obj.Diagnostico
      : typeof obj.diagnostico === "string"
        ? obj.diagnostico
        : "";
  const gravedadRaw =
    typeof obj["Gravedad (1-10)"] === "number"
      ? obj["Gravedad (1-10)"]
      : typeof obj.gravedad === "number"
        ? obj.gravedad
        : NaN;
  const piezasRaw =
    Array.isArray(obj["Piezas necesarias"])
      ? obj["Piezas necesarias"]
      : Array.isArray(obj.piezasNecesarias)
        ? obj.piezasNecesarias
        : [];
  const pruebasRaw =
    Array.isArray(obj["Pruebas recomendadas"])
      ? obj["Pruebas recomendadas"]
      : Array.isArray(obj.pruebasRecomendadas)
        ? obj.pruebasRecomendadas
        : [];
  const costeEstimado =
    typeof obj["Coste estimado"] === "string"
      ? obj["Coste estimado"]
      : typeof obj.costeEstimado === "string"
        ? obj.costeEstimado
        : "";

  const piezasNecesarias = piezasRaw.filter(
    (item): item is string => typeof item === "string",
  );
  const pruebasRecomendadas = pruebasRaw.filter(
    (item): item is string => typeof item === "string",
  );

  if (
    !diagnostico ||
    !costeEstimado ||
    piezasNecesarias.length === 0 ||
    pruebasRecomendadas.length === 0
  ) {
    throw new Error("Faltan campos requeridos en la respuesta IA.");
  }

  return {
    diagnostico,
    gravedad: clampSeverity(gravedadRaw),
    piezasNecesarias,
    pruebasRecomendadas,
    costeEstimado,
  };
}
