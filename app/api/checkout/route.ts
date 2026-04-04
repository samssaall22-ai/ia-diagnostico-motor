import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

type CheckoutPayload = {
  q: string;
  matricula?: string;
  kilometraje?: string;
  modelo?: string;
  imageKey?: string;
};

/**
 * URL publica del sitio para success_url / cancel_url.
 * En Vercel: define NEXT_PUBLIC_APP_URL=https://tu-dominio.com (recomendado) o usa VERCEL_URL automatico.
 * En local: sin esas vars, se usa Origin / Host del request.
 */
function getBaseUrl(req: NextRequest): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "");
    return `https://${host}`;
  }

  const origin = req.headers.get("origin");
  if (origin) return origin.replace(/\/$/, "");

  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CheckoutPayload;
    const query = (body.q ?? "").trim();
    if (!query) {
      return NextResponse.json({ error: "Falta la consulta tecnica." }, { status: 400 });
    }

    // Claves live/test desde .env.local (Vercel: Environment Variables del proyecto)
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const priceId = process.env.STRIPE_PRICE_ID;
    if (!secretKey || !priceId) {
      return NextResponse.json(
        { error: "Stripe no esta configurado en variables de entorno." },
        { status: 500 },
      );
    }

    const stripe = new Stripe(secretKey, { apiVersion: "2025-08-27.basil" });
    const baseUrl = getBaseUrl(request);

    const params = new URLSearchParams();
    params.set("q", query);
    if (body.matricula?.trim()) params.set("matricula", body.matricula.trim());
    if (body.kilometraje?.trim()) params.set("kilometraje", body.kilometraje.trim());
    if (body.modelo?.trim()) params.set("modelo", body.modelo.trim());
    if (body.imageKey?.trim()) params.set("imageKey", body.imageKey.trim());

    const successUrl = `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}&${params.toString()}`;
    const cancelParams = new URLSearchParams(params);
    cancelParams.set("cancelled", "1");
    const cancelUrl = `${baseUrl}/diagnostico?${cancelParams.toString()}`;

    // Cobro unico (ej. 2,99 EUR en el Price del Dashboard) — no usar "subscription"
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        q: query.slice(0, 500),
        matricula: (body.matricula ?? "").slice(0, 100),
        kilometraje: (body.kilometraje ?? "").slice(0, 100),
        modelo: (body.modelo ?? "").slice(0, 150),
        imageKey: (body.imageKey ?? "").slice(0, 120),
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: unknown) {
    console.error("Error API /api/checkout:", error);
    const message = error instanceof Error ? error.message : "No se pudo iniciar Stripe Checkout.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

