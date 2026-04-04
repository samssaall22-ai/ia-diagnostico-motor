import Stripe from "stripe";

const STRIPE_API_VERSION = "2025-08-27.basil" as const;

function norm(s: string | undefined): string {
  return (s ?? "").trim();
}

export type VerifyDiagnosticSessionInput = {
  q: string;
  matricula?: string;
  kilometraje?: string;
  modelo?: string;
  imageKey?: string;
  /** true si el cliente envia archivo de imagen en POST */
  sendingImage: boolean;
};

/**
 * Comprueba que el Checkout Session existe, esta pagado y que los metadatos
 * coinciden con la peticion de diagnostico (evita reusar un pago para otra consulta).
 */
export async function verifyPaidDiagnosticSession(
  sessionId: string,
  input: VerifyDiagnosticSessionInput,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return { ok: false, reason: "stripe_not_configured" };
  }

  if (!sessionId.startsWith("cs_")) {
    return { ok: false, reason: "invalid_session_id" };
  }

  const stripe = new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION });

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return { ok: false, reason: "session_not_found" };
  }

  if (session.mode !== "payment") {
    return { ok: false, reason: "wrong_checkout_mode" };
  }

  if (session.payment_status !== "paid") {
    return { ok: false, reason: "not_paid" };
  }

  const md = session.metadata ?? {};
  const qMeta = norm(md.q);
  const qReq = norm(input.q).slice(0, 500);
  if (qMeta !== qReq) {
    return { ok: false, reason: "query_mismatch" };
  }

  if (norm(md.matricula) !== norm(input.matricula).slice(0, 100)) {
    return { ok: false, reason: "metadata_mismatch" };
  }
  if (norm(md.kilometraje) !== norm(input.kilometraje).slice(0, 100)) {
    return { ok: false, reason: "metadata_mismatch" };
  }
  if (norm(md.modelo) !== norm(input.modelo).slice(0, 150)) {
    return { ok: false, reason: "metadata_mismatch" };
  }

  const metaImageKey = norm(md.imageKey);
  if (metaImageKey) {
    if (!input.sendingImage) {
      return { ok: false, reason: "image_required_for_session" };
    }
    if (norm(input.imageKey) !== metaImageKey) {
      return { ok: false, reason: "image_key_mismatch" };
    }
  } else if (input.sendingImage) {
    return { ok: false, reason: "session_without_image" };
  }

  return { ok: true };
}
