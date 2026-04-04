"use client";

import {
  AlertTriangle,
  Cog,
  Gauge,
  Toolbox,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { startStripeCheckout } from "@/lib/start-checkout";
import type { DiagnosticApiResponse } from "@/lib/diagnostic";
import { jsPDF } from "jspdf";
import { AnimatePresence, motion } from "framer-motion";
import Header from "@/app/components/Header";

type HistoryItem = {
  id: string;
  createdAt: string;
  matricula?: string;
  kilometraje?: string;
  modelo?: string;
  query: string;
  gravedad: number;
  diagnosticoShort: string;
};

const HISTORY_KEY = "diag_history_v1";

function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is HistoryItem => typeof x === "object" && x !== null);
  } catch {
    return [];
  }
}

function saveHistory(items: HistoryItem[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 10)));
}

function severityChipStyles(value: number) {
  if (value >= 8) return "border-red-500/40 bg-red-900/20 text-red-200";
  if (value >= 4) return "border-amber-500/40 bg-amber-900/20 text-amber-200";
  return "border-emerald-500/40 bg-emerald-900/20 text-emerald-200";
}

function severityCardBg(value: number) {
  if (value >= 8) return "bg-red-950/35 border-red-500/30";
  if (value >= 4) return "bg-amber-950/30 border-amber-500/30";
  return "bg-emerald-950/25 border-emerald-500/30";
}

function DiagnosticoContent() {
  const params = useSearchParams();
  const query = (params.get("q") ?? "").trim();
  const matricula = (params.get("matricula") ?? "").trim();
  const kilometraje = (params.get("kilometraje") ?? "").trim();
  const modelo = (params.get("modelo") ?? "").trim();
  const imageKey = (params.get("imageKey") ?? "").trim();
  const sessionId = (params.get("session_id") ?? "").trim();
  const cancelled = params.get("cancelled") === "1";
  const hasQuery = query.length > 0;
  const needsPayment = hasQuery && !sessionId;

  const goToCheckout = useCallback(() => {
    void startStripeCheckout({
      q: query,
      matricula: matricula || undefined,
      kilometraje: kilometraje || undefined,
      modelo: modelo || undefined,
      imageKey: imageKey || undefined,
    });
  }, [query, matricula, kilometraje, modelo, imageKey]);
  const [imageMeta, setImageMeta] = useState<{
    type: string;
    base64: string;
    name?: string;
  } | null>(null);

  useEffect(() => {
    if (!imageKey) return;
    try {
      const raw = sessionStorage.getItem(imageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        type?: string;
        base64?: string;
        name?: string;
      };
      if (typeof parsed.base64 === "string" && parsed.base64.length > 0) {
        setImageMeta({
          type: typeof parsed.type === "string" ? parsed.type : "image/jpeg",
          base64: parsed.base64,
          name: parsed.name,
        });
      }
    } catch {
      // ignore
    }
  }, [imageKey]);

  const swrKey =
    !hasQuery || !sessionId
      ? null
      : imageMeta
        ? (["diagnostico-post", sessionId, query, matricula, kilometraje, modelo, imageKey] as const)
        : (["diagnostico-get", sessionId, query, matricula, kilometraje, modelo] as const);

  const { data, isLoading, error } = useSWR<DiagnosticApiResponse>(
    swrKey,
    async () => {
      if (!hasQuery) throw new Error("Falta consulta.");
      if (!sessionId) throw new Error("Falta confirmacion de pago.");

      async function readErrorMessage(response: Response): Promise<string> {
        let msg = "No se pudo obtener diagnostico.";
        try {
          const j = (await response.json()) as { error?: string };
          if (typeof j.error === "string" && j.error.length > 0) msg = j.error;
        } catch {
          /* ignore */
        }
        return msg;
      }

      if (imageMeta) {
        const fd = new FormData();
        fd.set("q", query);
        fd.set("session_id", sessionId);
        if (matricula) fd.set("matricula", matricula);
        if (kilometraje) fd.set("kilometraje", kilometraje);
        if (modelo) fd.set("modelo", modelo);
        if (imageKey) fd.set("imageKey", imageKey);

        const byteChars = atob(imageMeta.base64);
        const bytes = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i += 1) bytes[i] = byteChars.charCodeAt(i);
        const file = new File([bytes], imageMeta.name ?? "imagen.jpg", { type: imageMeta.type });
        fd.set("image", file);

        const response = await fetch("/api/diagnostico", {
          method: "POST",
          body: fd,
          cache: "no-store",
        });
        if (!response.ok) throw new Error(await readErrorMessage(response));
        return (await response.json()) as DiagnosticApiResponse;
      }

      const usp = new URLSearchParams({ q: query, session_id: sessionId });
      if (matricula) usp.set("matricula", matricula);
      if (kilometraje) usp.set("kilometraje", kilometraje);
      if (modelo) usp.set("modelo", modelo);

      const response = await fetch(`/api/diagnostico?${usp.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(await readErrorMessage(response));
      return (await response.json()) as DiagnosticApiResponse;
    },
  );

  const severityClass = useMemo(
    () => severityChipStyles(data?.gravedad ?? 1),
    [data?.gravedad],
  );
  const severityCardClass = useMemo(
    () => severityCardBg(data?.gravedad ?? 1),
    [data?.gravedad],
  );

  const canDownload = !needsPayment && !isLoading && !error && hasQuery && !!data;
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  useEffect(() => {
    if (!data) return;
    const initial: Record<string, boolean> = {};
    data.pruebasRecomendadas.forEach((p) => {
      initial[p] = checked[p] ?? false;
    });
    setChecked(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.pruebasRecomendadas?.join("|")]);

  useEffect(() => {
    if (!data || !hasQuery || isLoading || error) return;

    const item: HistoryItem = {
      id: `${Date.now()}`,
      createdAt: new Date().toISOString(),
      matricula: matricula || undefined,
      kilometraje: kilometraje || undefined,
      modelo: modelo || undefined,
      query,
      gravedad: data.gravedad,
      diagnosticoShort: data.diagnostico.slice(0, 120),
    };

    setHistory((prev) => {
      const next = [item, ...prev].slice(0, 10);
      saveHistory(next);
      return next;
    });
  }, [data, error, hasQuery, isLoading, kilometraje, matricula, modelo, query]);

  function downloadPdf() {
    if (!data) return;

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const maxWidth = pageWidth - margin * 2;

    let y = 18;

    const addSectionTitle = (title: string) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(title, margin, y);
      y += 7;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
    };

    const addParagraph = (text: string) => {
      const lines = doc.splitTextToSize(text, maxWidth);
      lines.forEach((line: string) => {
        if (y > pageHeight - margin) {
          doc.addPage();
          y = 18;
        }
        doc.text(line, margin, y);
        y += 5.5;
      });
      y += 2;
    };

    const addList = (items: string[]) => {
      items.forEach((item) => {
        const bullet = `- ${item}`;
        const lines = doc.splitTextToSize(bullet, maxWidth);
        lines.forEach((line: string) => {
          if (y > pageHeight - margin) {
            doc.addPage();
            y = 18;
          }
          doc.text(line, margin, y);
          y += 5.5;
        });
      });
      y += 2;
    };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("REPORTE TÉCNICO DE MOTOR", pageWidth / 2, y, {
      align: "center",
    });
    y += 10;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, margin, y);
    y += 10;

    addSectionTitle("Identificacion del vehiculo");
    addParagraph(
      [
        matricula ? `Matricula: ${matricula}` : null,
        modelo ? `Modelo: ${modelo}` : null,
        kilometraje ? `Kilometraje: ${kilometraje}` : null,
      ]
        .filter(Boolean)
        .join(" | ") || "Sin datos aportados.",
    );

    addSectionTitle("Datos de entrada");
    addParagraph(query);

    addSectionTitle("Diagnóstico");
    addParagraph(data.diagnostico);

    addSectionTitle("Piezas necesarias");
    addList(data.piezasNecesarias);

    addSectionTitle("Pruebas recomendadas");
    addList(data.pruebasRecomendadas);

    addSectionTitle("Coste estimado");
    addParagraph(data.costeEstimado);

    if (y > pageHeight - margin - 14) {
      doc.addPage();
      y = 18;
    }

    const idCode = Math.random().toString(36).slice(2, 10).toUpperCase();

    y += 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(
      `ID de Informe: ${idCode} | Generado por el Sistema Experto AutoPrecision Pro`,
      margin,
      y,
    );

    y += 5;
    const legalText =
      "AVISO LEGAL: Este informe ha sido generado mediante algoritmos de análisis técnico. " +
      "Los resultados son orientativos y no constituyen una certificación mecánica oficial. " +
      "AutoPrecision Pro no se hace responsable de daños derivados del uso de esta información. " +
      "Es obligatorio que un mecánico profesional titulado verifique físicamente el vehículo antes de cualquier reparación.";

    const addSmallParagraph = (text: string) => {
      const lines = doc.splitTextToSize(text, maxWidth);
      lines.forEach((line: string) => {
        if (y > pageHeight - margin) {
          doc.addPage();
          y = 18;
        }
        doc.text(line, margin, y);
        y += 4;
      });
      y += 2;
    };

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    addSmallParagraph(legalText);

    doc.save("reporte-tecnico-motor.pdf");
  }

  return (
    <main className="min-h-screen bg-[#090b10] px-4 py-8 sm:px-6 lg:px-8">
      <Header />
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link
            href="/"
            className="rounded-lg border border-[#27344c] bg-[#11151f] px-3 py-2 text-sm text-slate-300 transition hover:border-blue-500"
          >
            Volver al buscador
          </Link>
          <span className="rounded-full border border-[#1f2a3d] bg-[#11151f] px-3 py-1 text-xs text-slate-400">
            {needsPayment ? "Pago pendiente" : "Diagnostico generado"}
          </span>
        </div>

        <section className="tech-panel mb-6 rounded-2xl p-6">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-900/20 px-3 py-1 text-xs font-medium text-blue-300">
            <Cog className="h-3.5 w-3.5" />
            Informe de Diagnosis Técnica
          </div>

          {needsPayment && (
            <div className="rounded-xl border border-amber-500/35 bg-amber-950/25 p-5">
              <h2 className="mb-2 text-lg font-semibold text-amber-100">
                Informe completo tras pago seguro
              </h2>
              {cancelled && (
                <p className="mb-3 text-sm text-amber-200/90">
                  El pago fue cancelado. Puedes volver a intentarlo cuando quieras.
                </p>
              )}
              <p className="mb-4 text-sm text-slate-300">
                El diagnostico tecnico completo, el PDF y el checklist solo se generan despues de
                confirmar el pago unico con Stripe (el importe acordado en checkout).
              </p>
              <button
                type="button"
                onClick={goToCheckout}
                className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-blue-700 px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 sm:w-auto"
              >
                Ir a la pasarela de pago (Stripe)
              </button>
            </div>
          )}

          {!needsPayment && isLoading && (
            <p className="text-slate-300">
              Verificando pago con Stripe... Consultando base de datos tecnica...
              Generando reporte pericial...
            </p>
          )}

          {!hasQuery && <p className="text-red-300">No se ha recibido una consulta.</p>}
          {!needsPayment && error && !isLoading && hasQuery && (
            <div className="space-y-3">
              <p className="text-red-300">{error.message}</p>
              <button
                type="button"
                onClick={goToCheckout}
                className="inline-flex rounded-xl border border-blue-500/50 bg-blue-950/40 px-4 py-2 text-sm font-semibold text-blue-200 transition hover:border-blue-400"
              >
                Volver a la pasarela de pago
              </button>
            </div>
          )}

          <AnimatePresence mode="wait">
            {!needsPayment && !isLoading && !error && hasQuery && data && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              >
                <h1 className="mb-3 text-2xl font-semibold text-slate-100 sm:text-3xl">
                  {data.diagnostico}
                </h1>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div
                  className={`rounded-2xl border p-4 ${severityCardClass} backdrop-blur`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-xs font-semibold tracking-wide text-slate-200">
                      GRAVEDAD
                    </div>
                    <div
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold ${severityClass}`}
                    >
                      <ShieldAlert className="h-4 w-4" />
                      {data.gravedad}/10
                    </div>
                  </div>
                  <p className="text-sm text-slate-300">
                    Escala orientativa de riesgo tecnico-operativo (1 bajo, 10 critico).
                  </p>
                </div>

                <div className="rounded-2xl border border-[#1f2a3d] bg-[#0b1019]/60 p-4 backdrop-blur">
                  <div className="mb-2 text-xs font-semibold tracking-wide text-slate-200">
                    VEHICULO
                  </div>
                  <p className="text-sm text-slate-300">
                    {modelo || "Modelo: (no indicado)"}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    {matricula ? `Matricula: ${matricula}` : "Matricula: (no indicada)"}
                    {kilometraje ? ` · Kilometraje: ${kilometraje}` : ""}
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <button
                  type="button"
                  onClick={downloadPdf}
                  disabled={!canDownload}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  Descargar Informe Técnico (PDF)
                </button>
              </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-2xl border border-[#1f2a3d] bg-[#11151f]/70 p-5 shadow-[0_0_0_1px_rgba(31,42,61,0.35),0_24px_70px_-55px_rgba(59,130,246,0.35)] backdrop-blur">
            <Gauge className="mb-3 h-5 w-5 text-blue-400" />
            <h2 className="mb-1 font-semibold text-slate-100">Entrada</h2>
            <p className="text-sm text-slate-400">
              {query || "Sin texto. Introduce un sintoma o codigo OBD-II."}
            </p>
          </article>

          <article className="rounded-2xl border border-[#1f2a3d] bg-[#11151f]/70 p-5 shadow-[0_0_0_1px_rgba(31,42,61,0.35),0_24px_70px_-55px_rgba(59,130,246,0.35)] backdrop-blur">
            <Wrench className="mb-3 h-5 w-5 text-emerald-400" />
            <h2 className="mb-1 font-semibold text-slate-100">Piezas necesarias</h2>
            {!needsPayment && !isLoading && !error && data ? (
              <ul className="space-y-1 text-sm text-slate-400">
                {data.piezasNecesarias.map((pieza) => (
                  <li key={pieza}>- {pieza}</li>
                ))}
              </ul>
            ) : needsPayment ? (
              <p className="text-sm text-slate-500">Disponible tras completar el pago.</p>
            ) : (
              <p className="text-sm text-slate-400">Esperando resultado...</p>
            )}
          </article>

          <article className="rounded-2xl border border-[#1f2a3d] bg-[#11151f]/70 p-5 shadow-[0_0_0_1px_rgba(31,42,61,0.35),0_24px_70px_-55px_rgba(59,130,246,0.35)] backdrop-blur">
            <Toolbox className="mb-3 h-5 w-5 text-sky-400" />
            <h2 className="mb-1 font-semibold text-slate-100">
              Pruebas recomendadas
            </h2>
            {!needsPayment && !isLoading && !error && data ? (
              <div className="space-y-2">
                {data.pruebasRecomendadas.map((paso) => (
                  <label
                    key={paso}
                    className="flex cursor-pointer items-start gap-2 rounded-lg border border-[#1f2a3d] bg-[#0b1019]/50 p-2 text-sm text-slate-300"
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-sky-500"
                      checked={Boolean(checked[paso])}
                      onChange={(e) =>
                        setChecked((prev) => ({ ...prev, [paso]: e.target.checked }))
                      }
                    />
                    <span className={checked[paso] ? "line-through text-slate-500" : ""}>
                      {paso}
                    </span>
                  </label>
                ))}
              </div>
            ) : needsPayment ? (
              <p className="text-sm text-slate-500">Disponible tras completar el pago.</p>
            ) : (
              <p className="text-sm text-slate-400">Esperando resultado...</p>
            )}
          </article>

          <article className="rounded-2xl border border-[#1f2a3d] bg-[#11151f]/70 p-5 shadow-[0_0_0_1px_rgba(31,42,61,0.35),0_24px_70px_-55px_rgba(59,130,246,0.35)] backdrop-blur">
            <AlertTriangle className="mb-3 h-5 w-5 text-amber-400" />
            <h2 className="mb-1 font-semibold text-slate-100">Coste estimado</h2>
            <p className="text-sm text-slate-400">
              {!needsPayment && !isLoading && !error && data
                ? data.costeEstimado
                : needsPayment
                  ? "Disponible tras el pago."
                  : "Calculando..."}
            </p>
          </article>
        </section>

        <section className="tech-panel mt-6 rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold tracking-wide text-slate-100">
              Historial de Diagnosis
            </h2>
            <button
              type="button"
              onClick={() => {
                saveHistory([]);
                setHistory([]);
              }}
              className="rounded-lg border border-[#1f2a3d] bg-[#11151f] px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-blue-500"
            >
              Limpiar
            </button>
          </div>

          {history.length === 0 ? (
            <p className="text-sm text-slate-400">
              Sin registros aun. Los ultimos informes se guardaran en este navegador.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {history.map((h) => (
                <Link
                  key={h.id}
                  href={`/diagnostico?${new URLSearchParams({
                    q: h.query,
                    ...(h.matricula ? { matricula: h.matricula } : {}),
                    ...(h.kilometraje ? { kilometraje: h.kilometraje } : {}),
                    ...(h.modelo ? { modelo: h.modelo } : {}),
                  }).toString()}`}
                  className="rounded-xl border border-[#1f2a3d] bg-[#11151f]/70 p-4 transition hover:border-blue-500"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-slate-200">
                      {h.matricula || "Sin matricula"}
                    </div>
                    <div className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${severityChipStyles(h.gravedad)}`}>
                      {h.gravedad}/10
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">
                    {new Date(h.createdAt).toLocaleString()}
                    {h.modelo ? ` · ${h.modelo}` : ""}
                  </div>
                  <div className="mt-2 text-sm text-slate-300">
                    {h.diagnosticoShort}
                    {h.diagnosticoShort.length >= 120 ? "…" : ""}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default function DiagnosticoPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#090b10] px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl rounded-2xl border border-[#27344c] bg-[#11151f]/90 p-6 text-slate-300">
            Cargando diagnostico...
          </div>
        </main>
      }
    >
      <DiagnosticoContent />
    </Suspense>
  );
}
