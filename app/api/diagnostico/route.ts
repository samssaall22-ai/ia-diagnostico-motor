import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";
import {
  parseAiDiagnostic,
  type DiagnosticApiResponse,
} from "@/lib/diagnostic";
import { verifyPaidDiagnosticSession } from "@/lib/stripe-verify-session";

const GROQ_MODEL = "llama-3.1-8b-instant";
const GROQ_VISION_MODEL = "llama-3.2-11b-vision-preview";

type DiagnosticInput = {
  query: string;
  matricula?: string;
  kilometraje?: string;
  modelo?: string;
  imageDataUrl?: string;
};

function buildPrompt(input: DiagnosticInput) {
  const metaLines = [
    input.matricula ? `- Matricula: ${input.matricula}` : null,
    input.kilometraje ? `- Kilometraje: ${input.kilometraje}` : null,
    input.modelo ? `- Modelo: ${input.modelo}` : null,
  ].filter(Boolean);

  const metaBlock = metaLines.length ? metaLines.join("\n") : "- (sin datos adicionales)";
  const hasImage = Boolean(input.imageDataUrl);

  return `
Actua como JEFE DE TALLER / ingeniero de diagnostico automotriz senior (España).
Tono: tecnico de taller, directo, profesional, sin rodeos.

Reglas criticas:
- Bajo ningun concepto uses las palabras "IA", "inteligencia artificial", "modelo", "algoritmo" ni similares en tu respuesta.
  Debes hablar como un software de diagnosis profesional conectado a la centralita del vehiculo (ECU) y a una base de datos tecnica.
- Debes ser audaz y especifico cuando haya señales fuertes: si los sintomas apuntan a averias graves (p.ej. junta de culata, turbo roto, segmentos pegados, inyectores agarrotados, EGR atascada), debes decirlo directamente como "Posible ..." o "Alta sospecha de ...".
- No ignores sintomas clave. Ejemplos:
  - Pasta blanca tipo "mayonesa" + consumo de refrigerante + humo blanco persistente/calenton => junta de culata / fisura de culata (alta sospecha).
  - Falta de empuje + humo azul/negro + silbido + consumo de aceite => turbo con holgura / fuga en admision (sospecha alta).
  - Consumo alto de aceite + humo azul al retener + compresion baja => segmentos pegados / desgaste cilindro (sospecha media-alta).
- Estilo del campo "Diagnostico" (obligatorio):
  - Debe ser UN SOLO PARRAFO coherente, fluido y humano (no frases sueltas).
  - Debe usar conectores logicos como: "Tras analizar...", "Debido a esto...", "En consecuencia...", "Por lo tanto...", "Adicionalmente...", "Por todo ello...".
  - Debe seguir SIEMPRE esta estructura narrativa:
    1) Confirmacion de sintomas detectados en la descripcion del cliente (sin repetirlos mas adelante).
    2) Explicacion tecnica de causa raiz (por que ocurre el fenomeno).
    3) Conclusion clara y especifica con el nombre de la averia mecanica comun.
  - La conclusion debe incluir literalmente una formula clara del tipo:
    "Todo apunta de forma inequivoca a un posible fallo de <averia>."
  - Prohibido escribir frases genericas tipo "El sistema afectado es...".
    En su lugar, usa: "Tras analizar los parametros introducidos, observamos una clara anomalia en ...".
- Prohibido repetir ideas o sintomas: si un sintoma clave (como consumo de refrigerante, humo o vibraciones) ya se ha mencionado una vez, no lo repitas de nuevo con otras palabras. Vincula siempre el sintoma directamente con la causa mas probable (p.ej. junta de culata) sin rodeos.
- El parrafo de "Diagnostico" debe ser aproximadamente un 50% mas corto que una explicacion extensa habitual: muy conciso, directo y estrictamente tecnico.
- No uses terminologia anglosajona (evita "misfire", "fuel trims", etc.); usa terminos de taller en español.
- No inventes datos no soportados por la consulta, pero SI puedes priorizar la causa mas probable cuando los sintomas son consistentes. Si faltan datos, indica exactamente que medicion o prueba falta.
- Devuelve SOLO JSON valido (sin markdown, sin texto adicional).

Datos del vehiculo (si disponibles):
${metaBlock}

Consulta del usuario: "${input.query}"

${hasImage ? "Adicionalmente, has recibido una imagen (JPG/PNG). Interpretala de forma prudente para apoyar el diagnostico (p.ej. manchas, emulsiones, humo, testigos en cuadro, fugas). Si la imagen no aporta informacion diagnostica suficiente, indicalo de forma breve dentro del diagnostico, sin inventar." : ""}

Responde exactamente con este esquema:
{
  "Diagnostico": "un solo parrafo con conectores y estructura narrativa; termina con el nombre de la averia en formato 'Todo apunta de forma inequivoca a un posible fallo de ...'.",
  "Gravedad (1-10)": numero entre 1 y 10,
  "Piezas necesarias": ["componente o consumible 1", "componente o consumible 2"],
  "Pruebas recomendadas": ["paso tecnico 1", "paso tecnico 2", "paso tecnico 3"],
  "Coste estimado": "rango aproximado en EUR"
}
`;
}

async function getAiDiagnostic(input: DiagnosticInput): Promise<DiagnosticApiResponse> {
  try {
    // Next.js carga automaticamente .env.local y lo expone via process.env en el servidor.
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY no definida en .env.local");
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const prompt = buildPrompt(input);

    const userContent = input.imageDataUrl
      ? [
          { type: "text" as const, text: prompt },
          { type: "image_url" as const, image_url: { url: input.imageDataUrl } },
        ]
      : prompt;

    const completion = await groq.chat.completions.create({
      model: input.imageDataUrl ? GROQ_VISION_MODEL : GROQ_MODEL,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content:
            "Eres especialista en diagnostico de vehiculos ligeros. Responde solo JSON valido y con terminologia tecnica profesional.",
        },
        { role: "user", content: userContent },
      ],
    });

    const content = completion.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("Groq devolvio una respuesta vacia.");
    }

    const parsed = parseAiDiagnostic(content);
    return parsed;
  } catch (error) {
    console.error("Error Groq diagnostico:", error);
    throw error;
  }
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const query = sp.get("q")?.trim() ?? "";
  const sessionId = sp.get("session_id")?.trim() ?? "";

  if (!query) {
    return NextResponse.json(
      { error: "Falta el parametro q en la consulta." },
      { status: 400 },
    );
  }

  if (!sessionId) {
    return NextResponse.json(
      { error: "Se requiere un pago completado. Vuelve al inicio e inicia el checkout.", code: "payment_required" },
      { status: 402 },
    );
  }

  const matricula = sp.get("matricula")?.trim() || undefined;
  const kilometraje = sp.get("kilometraje")?.trim() || undefined;
  const modelo = sp.get("modelo")?.trim() || undefined;

  const gate = await verifyPaidDiagnosticSession(sessionId, {
    q: query,
    matricula,
    kilometraje,
    modelo,
    sendingImage: false,
  });
  if (!gate.ok) {
    return NextResponse.json(
      { error: "El pago no es valido o no coincide con esta consulta.", code: gate.reason },
      { status: 403 },
    );
  }

  try {
    const result = await getAiDiagnostic({ query, matricula, kilometraje, modelo });
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Error API /api/diagnostico:", error);
    const message =
      error instanceof Error ? error.message : "Error inesperado en diagnostico tecnico.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();

    const query = String(form.get("q") ?? "").trim();
    if (!query) {
      return NextResponse.json(
        { error: "Falta el campo q en el formulario." },
        { status: 400 },
      );
    }

    const sessionId = String(form.get("session_id") ?? "").trim();
    if (!sessionId) {
      return NextResponse.json(
        { error: "Se requiere un pago completado. Vuelve al inicio e inicia el checkout.", code: "payment_required" },
        { status: 402 },
      );
    }

    const matricula = String(form.get("matricula") ?? "").trim() || undefined;
    const kilometraje = String(form.get("kilometraje") ?? "").trim() || undefined;
    const modelo = String(form.get("modelo") ?? "").trim() || undefined;
    const imageKey = String(form.get("imageKey") ?? "").trim() || undefined;

    const image = form.get("image");
    let imageDataUrl: string | undefined;

    if (image instanceof File && image.size > 0) {
      const mime = image.type || "image/jpeg";
      if (mime !== "image/jpeg" && mime !== "image/png") {
        return NextResponse.json(
          { error: "Formato de imagen no soportado. Usa JPG o PNG." },
          { status: 400 },
        );
      }

      const ab = await image.arrayBuffer();
      const base64 = Buffer.from(ab).toString("base64");
      imageDataUrl = `data:${mime};base64,${base64}`;
    }

    const gate = await verifyPaidDiagnosticSession(sessionId, {
      q: query,
      matricula,
      kilometraje,
      modelo,
      imageKey,
      sendingImage: Boolean(imageDataUrl),
    });
    if (!gate.ok) {
      return NextResponse.json(
        { error: "El pago no es valido o no coincide con esta consulta.", code: gate.reason },
        { status: 403 },
      );
    }

    const result = await getAiDiagnostic({
      query,
      matricula,
      kilometraje,
      modelo,
      imageDataUrl,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Error API /api/diagnostico (POST):", error);
    const message =
      error instanceof Error ? error.message : "Error inesperado en diagnostico tecnico.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
