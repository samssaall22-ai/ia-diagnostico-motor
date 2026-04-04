import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Globe, MessageCircle, X, Wrench } from "lucide-react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AutoPrecision Pro",
  description: "Plataforma web de diagnosis técnica de coches con informes profesionales.",
  icons: {
    icon: "/icon",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="flex-1">{children}</div>

        <footer className="mt-10 border-t border-[#1f2a3d] bg-[#090b10]">
          <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-xl">
                <div className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-200">
                  <Wrench className="h-4 w-4 text-blue-400" />
                  AutoPrecision Pro
                </div>
                <p className="text-sm leading-relaxed text-slate-400">
                  AVISO LEGAL: Este informe ha sido generado mediante algoritmos de análisis técnico.
                  Los resultados son orientativos y no constituyen una certificación mecánica oficial.
                  AutoPrecision Pro no se hace responsable de daños derivados del uso de esta
                  información. Es obligatorio que un mecánico profesional titulado verifique
                  físicamente el vehículo antes de cualquier reparación.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:items-end">
                <div className="inline-flex items-center gap-3">
                  <a
                    href="#"
                    aria-label="Red social"
                    className="rounded-lg border border-[#1f2a3d] bg-[#11151f]/60 p-2 text-slate-300 transition hover:border-blue-500"
                  >
                    <Globe className="h-4 w-4" />
                  </a>
                  <a
                    href="#"
                    aria-label="Contacto"
                    className="rounded-lg border border-[#1f2a3d] bg-[#11151f]/60 p-2 text-slate-300 transition hover:border-blue-500"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </a>
                  <a
                    href="#"
                    aria-label="Social X"
                    className="rounded-lg border border-[#1f2a3d] bg-[#11151f]/60 p-2 text-slate-300 transition hover:border-blue-500"
                  >
                    <X className="h-4 w-4" />
                  </a>
                </div>
                <div className="text-xs font-medium text-slate-500">
                  © 2026 Sebastià - Lead Engineer
                </div>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
