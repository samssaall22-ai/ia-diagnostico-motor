import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "");

export type StartCheckoutPayload = {
  q: string;
  matricula?: string;
  kilometraje?: string;
  modelo?: string;
  imageKey?: string;
};

/**
 * Crea sesion de Checkout y redirige al Hosted Checkout de Stripe.
 * Devuelve false si hubo error (ya mostrado con alert).
 */
export async function startStripeCheckout(payload: StartCheckoutPayload): Promise<boolean> {
  const response = await fetch("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      q: payload.q.trim(),
      matricula: payload.matricula?.trim() || undefined,
      kilometraje: payload.kilometraje?.trim() || undefined,
      modelo: payload.modelo?.trim() || undefined,
      imageKey: payload.imageKey?.trim() || undefined,
    }),
  });

  if (!response.ok) {
    alert("No se pudo iniciar el pago. Revisa la configuracion de Stripe.");
    return false;
  }

  const data = (await response.json()) as {
    sessionId?: string;
    url?: string | null;
    error?: string;
  };

  if (!data.sessionId && !data.url) {
    alert(data.error ?? "No se pudo crear la sesion de pago.");
    return false;
  }

  if (data.url) {
    window.location.href = data.url;
    return true;
  }

  const stripe = await stripePromise;
  if (!stripe || !data.sessionId) {
    alert("No se pudo cargar Stripe.js.");
    return false;
  }

  const anyStripe = stripe as unknown as {
    redirectToCheckout?: (args: { sessionId: string }) => Promise<{ error?: { message?: string } }>;
  };
  const result = await anyStripe.redirectToCheckout?.({ sessionId: data.sessionId });
  if (result?.error?.message) {
    alert(result.error.message);
    return false;
  }

  return true;
}
