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
    <main className="grid min-h-dvh bg-[#fff8fb] lg:grid-cols-[1.05fr_0.95fr]">
      <section className="hidden min-h-dvh items-end bg-gradient-to-br from-[#f6cddd] via-[#f9deea] to-[#fff4f8] p-10 lg:flex">
        <div className="max-w-xl pb-8">
          <p className="text-xs font-extrabold tracking-[0.24em] text-[#ad416f]">PECÁN TIGRE</p>
          <h1 className="mt-4 text-5xl font-extrabold tracking-[-0.045em] text-[#3e2833]">Stock preciso.<br />Operación simple.</h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-[#765562]">Un sistema pensado para preparar pedidos, controlar inventario y tomar decisiones rápidas sin depender de una computadora encendida.</p>
        </div>
      </section>

      <section className="flex min-h-dvh items-center justify-center p-5 sm:p-8">
        <div className="w-full max-w-[430px]">
          <div className="mb-8 lg:hidden">
            <p className="text-xs font-extrabold tracking-[0.22em] text-[#ad416f]">PECÁN TIGRE</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.035em] text-[#3e2833]">Gestión</h1>
          </div>

          <div className="rounded-[24px] border border-[#efd7e2] bg-white p-6 shadow-[0_18px_50px_rgba(91,40,63,0.08)] sm:p-8">
            <h2 className="text-2xl font-bold tracking-[-0.025em] text-[#3e2833]">Iniciar sesión</h2>
            <p className="mt-1 text-sm text-[#80616f]">Ingresá con tu usuario del equipo.</p>

            <form onSubmit={handleLogin} className="mt-7 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[#80616f]">Email</span>
                <input className="pt-input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[#80616f]">Contraseña</span>
                <input className="pt-input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </label>
              {error && <div className="rounded-xl bg-[#fbecef] px-3 py-2.5 text-sm font-semibold text-[#a94658]">{error}</div>}
              <button type="submit" disabled={loading} className="pt-button-primary w-full px-4 py-3 disabled:opacity-60">{loading ? "Ingresando…" : "Ingresar"}</button>
            </form>
            <Link href="/login/recuperar" className="mt-4 block text-center text-sm font-bold text-[#ad416f]">Olvidé mi contraseña</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
