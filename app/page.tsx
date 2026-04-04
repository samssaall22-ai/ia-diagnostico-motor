"use client";

import { AlertTriangle, Camera, Search, Settings, Wrench } from "lucide-react";
import { FileText, Target, Zap } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import Header from "@/app/components/Header";
import { startStripeCheckout } from "@/lib/start-checkout";

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [matricula, setMatricula] = useState("");
  const [kilometraje, setKilometraje] = useState("");
  const [modelo, setModelo] = useState("");
  const [q, setQ] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);

  const hasRequired = useMemo(() => q.trim().length > 0, [q]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasRequired) return;

    let imageKey: string | null = null;
    if (imageFile) {
      const buf = await imageFile.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i]!);
      }
      const base64 = btoa(binary);
      imageKey = `diag_img_${Date.now()}`;
      sessionStorage.setItem(
        imageKey,
        JSON.stringify({
          name: imageFile.name,
          type: imageFile.type || "image/jpeg",
          base64,
        }),
      );
    }

    await startStripeCheckout({
      q: q.trim(),
      matricula: matricula.trim() || undefined,
      kilometraje: kilometraje.trim() || undefined,
      modelo: modelo.trim() || undefined,
      imageKey: imageKey || undefined,
    });
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#090b10]">
      <div className="grid-overlay pointer-events-none absolute inset-0" />

      <main className="relative mx-auto flex w-full max-w-6xl flex-col px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-14">
          <div className="tech-panel mb-6 rounded-2xl p-5">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-700/40 bg-blue-900/20 px-3 py-1 text-xs font-medium text-blue-300">
              <Zap className="h-3.5 w-3.5" />
              Diagnóstico técnico de alta precisión
            </div>

            <h1 className="mb-3 max-w-4xl text-3xl font-semibold leading-tight text-slate-100 sm:text-4xl lg:text-5xl">
              El futuro de la diagnosis mecánica
            </h1>

            <p className="mb-6 max-w-2xl text-sm text-slate-400 sm:text-base">
              Introduce la matrícula, kilometraje y síntomas del vehículo. Si lo deseas, adjunta una imagen
              para afinar el análisis y genera un informe PDF listo para taller.
            </p>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-[#1f2a3d] bg-[#11151f]/60 p-4 backdrop-blur">
                <div className="mb-2 inline-flex items-center gap-2 text-blue-300">
                  <Zap className="h-5 w-5" />
                  <span className="text-sm font-semibold">Rapidez</span>
                </div>
                <p className="text-sm text-slate-400">
                  Respuesta inmediata con priorización de hipótesis probables.
                </p>
              </div>

              <div className="rounded-xl border border-[#1f2a3d] bg-[#11151f]/60 p-4 backdrop-blur">
                <div className="mb-2 inline-flex items-center gap-2 text-emerald-300">
                  <Target className="h-5 w-5" />
                  <span className="text-sm font-semibold">Precisión</span>
                </div>
                <p className="text-sm text-slate-400">
                  Diagnóstico con terminología de taller y pruebas verificables.
                </p>
              </div>

              <div className="rounded-xl border border-[#1f2a3d] bg-[#11151f]/60 p-4 backdrop-blur">
                <div className="mb-2 inline-flex items-center gap-2 text-sky-300">
                  <FileText className="h-5 w-5" />
                  <span className="text-sm font-semibold">Informes PDF</span>
                </div>
                <p className="text-sm text-slate-400">
                  Reporte pericial con piezas y checklist de pruebas para taller.
                </p>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <Header />
          </div>

          <form
            onSubmit={handleSubmit}
            className="tech-panel w-full max-w-4xl rounded-2xl p-3 sm:p-4"
          >
            <div className="mb-3 grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  Matricula
                </label>
                <input
                  value={matricula}
                  onChange={(e) => setMatricula(e.target.value)}
                  placeholder="1234 ABC"
                  className="h-11 w-full rounded-xl border border-[#31415f] bg-[#0b1019] px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  Kilometraje
                </label>
                <input
                  value={kilometraje}
                  onChange={(e) => setKilometraje(e.target.value)}
                  placeholder="185000"
                  inputMode="numeric"
                  className="h-11 w-full rounded-xl border border-[#31415f] bg-[#0b1019] px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  Modelo del Vehiculo
                </label>
                <input
                  value={modelo}
                  onChange={(e) => setModelo(e.target.value)}
                  placeholder="Ford Focus 1.6 TDCi 2012"
                  className="h-11 w-full rounded-xl border border-[#31415f] bg-[#0b1019] px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-blue-500"
                />
              </div>
            </div>

            <label htmlFor="q" className="sr-only">
              Busqueda de sintomas o codigo
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                <input
                  id="q"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  required
                  placeholder="¿Que le pasa a tu coche? Describe el ruido o introduce el codigo de error"
                  className="h-14 w-full rounded-xl border border-[#31415f] bg-[#0b1019] pl-11 pr-4 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-blue-500 sm:text-base"
                />
              </div>

              <div className="relative flex items-start justify-end sm:items-center">
                <div className="group relative">
                  <button
                    type="button"
                    className="inline-flex h-14 w-14 items-center justify-center rounded-xl border border-[#31415f] bg-[#0b1019] text-slate-200 transition hover:border-blue-500"
                    aria-label="Ayuda"
                  >
                    ?
                  </button>
                  <div
                    className="pointer-events-none absolute right-0 top-full z-20 hidden w-72 rounded-lg border border-[#1f2a3d] bg-[#11151f]/95 p-3 text-xs text-slate-300 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)] group-hover:block"
                  >
                    <div className="mb-1 font-semibold text-slate-100">
                      Cómo introducir los síntomas
                    </div>
                    <div className="space-y-1">
                      <p>• Indica cuándo aparece (en frío, al acelerar, en ralentí).</p>
                      <p>• Describe el ruido/olor y si hay testigo en cuadro.</p>
                      <p>• Si tienes códigos OBD-II, inclúyelos (ej. P0300, P0420).</p>
                      <p>• Una foto del escape/depósitos ayuda si aplica.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex h-14 items-center justify-center gap-2 rounded-xl border border-[#31415f] bg-[#0b1019] px-4 text-sm font-semibold text-slate-100 transition hover:border-blue-500 sm:px-5"
                >
                  <Camera className="h-5 w-5 text-slate-300" />
                  {imageFile ? "Imagen cargada" : "Subir imagen"}
                </button>
                <button
                  type="submit"
                  className="h-14 rounded-xl bg-gradient-to-r from-blue-500 to-blue-700 px-6 text-sm font-semibold text-white transition hover:brightness-110 sm:text-base"
                >
                  Generar diagnosis
                </button>
              </div>
            </div>
          </form>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <article className="rounded-2xl border border-[#1f2a3d] bg-[#11151f]/90 p-5">
            <div className="mb-3 inline-flex rounded-lg bg-blue-900/30 p-2 text-blue-400">
              <Wrench className="h-5 w-5" />
            </div>
            <h2 className="mb-2 text-lg font-semibold text-slate-100">
              Sintomas mecanicos
            </h2>
            <p className="text-sm text-slate-400">
              Golpeteos, ruidos metalicos, perdida de potencia y vibraciones.
            </p>
          </article>

          <article className="rounded-2xl border border-[#1f2a3d] bg-[#11151f]/90 p-5">
            <div className="mb-3 inline-flex rounded-lg bg-emerald-900/30 p-2 text-emerald-400">
              <Settings className="h-5 w-5" />
            </div>
            <h2 className="mb-2 text-lg font-semibold text-slate-100">
              Codigos OBD-II
            </h2>
            <p className="text-sm text-slate-400">
              Interpreta codigos como P0300, P0420 o P0171 en segundos.
            </p>
          </article>

          <article className="rounded-2xl border border-[#1f2a3d] bg-[#11151f]/90 p-5 sm:col-span-2 lg:col-span-1">
            <div className="mb-3 inline-flex rounded-lg bg-amber-900/30 p-2 text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h2 className="mb-2 text-lg font-semibold text-slate-100">
              Riesgo y urgencia
            </h2>
            <p className="text-sm text-slate-400">
              Priorizamos el nivel de riesgo para saber si puedes circular o
              detenerte.
            </p>
          </article>
        </section>
      </main>
    </div>
  );
}
