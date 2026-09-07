"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    const next = new URLSearchParams(window.location.search).get("next") || "/";
    router.replace(next);
    router.refresh();
  }

  return (
    <main className="grid min-h-dvh overflow-hidden bg-[#fff9fc] lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden min-h-dvh items-end overflow-hidden border-r border-[#eed5e0] bg-[#4b2d3a] p-10 lg:flex xl:p-14">
        <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-[#d25b8b]/25 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-[28rem] w-[28rem] rounded-full bg-[#efb3cb]/16 blur-3xl" />
        <div className="absolute inset-8 rounded-[34px] border border-white/8" />
        <div className="relative max-w-xl pb-8">
          <div className="inline-flex rounded-[20px] bg-white p-3.5 shadow-[0_16px_40px_rgba(23,12,18,.18)]">
            <img src="/brand/logo.svg" alt="Pecán Tigre" className="h-12 w-44 object-contain object-left" />
          </div>
          <p className="mt-9 text-[10px] font-black uppercase tracking-[0.2em] text-[#efb4cc]">Gestión integral</p>
          <h1 className="mt-3 text-5xl font-black leading-[1.02] tracking-[-0.055em] text-white xl:text-6xl">Todo el negocio,<br />más simple.</h1>
          <p className="mt-5 max-w-lg text-[15px] font-medium leading-7 text-white/65">Productos, stock, compras, ventas y finanzas en un solo lugar. Diseñado para trabajar rápido desde computadora o celular.</p>
          <div className="mt-8 flex gap-2 text-[10px] font-black uppercase tracking-[.08em] text-white/60"><span className="rounded-full bg-white/8 px-3 py-2">Stock</span><span className="rounded-full bg-white/8 px-3 py-2">Ventas</span><span className="rounded-full bg-white/8 px-3 py-2">Compras</span></div>
        </div>
      </section>

      <section className="relative flex min-h-dvh items-center justify-center p-5 sm:p-8">
        <div className="absolute right-[-8rem] top-[-8rem] h-80 w-80 rounded-full bg-[#f4c7d9]/30 blur-3xl lg:hidden" />
        <div className="relative w-full max-w-[430px]">
          <div className="mb-7 lg:hidden">
            <img src="/brand/logo.svg" alt="Pecán Tigre" className="h-12 w-44 object-contain object-left" />
            <p className="mt-3 text-[10px] font-black uppercase tracking-[.18em] text-[#aa416d]">Panel operativo</p>
          </div>

          <div className="rounded-[28px] border border-[#ecd5df] bg-white/95 p-6 shadow-[0_24px_70px_rgba(76,39,55,0.10)] backdrop-blur sm:p-8">
            <div className="mb-7">
              <p className="text-[10px] font-black uppercase tracking-[.15em] text-[#af4773]">Bienvenido</p>
              <h2 className="mt-1.5 text-[28px] font-black tracking-[-0.045em] text-[#39262f]">Iniciar sesión</h2>
              <p className="mt-1.5 text-sm font-medium text-[#7c626e]">Ingresá con tu usuario del equipo.</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <label className="block">
                <span className="pt-label">Email</span>
                <input className="pt-input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" />
              </label>
              <label className="block">
                <span className="pt-label">Contraseña</span>
                <input className="pt-input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </label>
              {error && <div className="rounded-[14px] border border-[#efc7cf] bg-[#fff3f5] px-3.5 py-3 text-sm font-semibold text-[#a94658]">{error}</div>}
              <button type="submit" disabled={loading} className="pt-button-primary w-full px-4 py-3">{loading ? "Ingresando…" : "Ingresar"}</button>
            </form>
            <Link href="/login/recuperar" className="mt-4 block text-center text-xs font-black text-[#a7406b] hover:underline">Olvidé mi contraseña</Link>
          </div>
          <p className="mt-5 text-center text-[10px] font-semibold text-[#a58b96]">Pecán Tigre · Gestión interna</p>
        </div>
      </section>
    </main>
  );
}
