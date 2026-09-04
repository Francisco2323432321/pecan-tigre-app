"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function RecoverPage(){
  const [email,setEmail]=useState(""); const [message,setMessage]=useState(""); const [error,setError]=useState(""); const [loading,setLoading]=useState(false);
  async function submit(e:FormEvent){e.preventDefault();setLoading(true);setError("");setMessage("");const supabase=createClient();const redirectTo=`${window.location.origin}/auth/update-password`;const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo});if(error)setError(error.message);else setMessage("Si el email existe, Supabase enviará el enlace para crear una nueva contraseña.");setLoading(false)}
  return <main className="flex min-h-dvh items-center justify-center bg-[#fff8fb] p-5"><div className="w-full max-w-[430px] rounded-[24px] border border-[#efd7e2] bg-white p-6 shadow-[0_18px_50px_rgba(91,40,63,0.08)] sm:p-8"><p className="text-xs font-extrabold tracking-[0.22em] text-[#ad416f]">PECÁN TIGRE</p><h1 className="mt-3 text-2xl font-extrabold text-[#3e2833]">Recuperar contraseña</h1><p className="mt-1 text-sm text-[#80616f]">Te enviaremos un enlace de recuperación al correo de tu usuario.</p><form onSubmit={submit} className="mt-6 space-y-4"><label className="block"><span className="pt-label">Email</span><input className="pt-input" type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" /></label>{error&&<div className="rounded-xl bg-[#fbecef] px-3 py-2.5 text-sm font-semibold text-[#a94658]">{error}</div>}{message&&<div className="rounded-xl bg-[#eef7f2] px-3 py-2.5 text-sm font-semibold text-[#36785b]">{message}</div>}<button disabled={loading} className="pt-button-primary w-full px-4">{loading?"Enviando…":"Enviar enlace"}</button></form><Link href="/login" className="mt-4 block text-center text-sm font-bold text-[#ad416f]">Volver al login</Link></div></main>
}
