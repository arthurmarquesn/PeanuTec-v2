"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { registerUser } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await registerUser({ nome, email, senha });
      router.replace("/login");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível criar a conta.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-emerald-950 px-4 py-10 text-slate-950">
      <section className="w-full max-w-md rounded-md border border-white/10 bg-white p-6 shadow-2xl">
        <div>
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-emerald-100 text-2xl">🌱</div>
          <h1 className="mt-5 text-3xl font-semibold">Criar conta</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Acesse o PeanuTec para acompanhar a safra e as prioridades de manejo.</p>
        </div>
        <form onSubmit={handleSubmit} className="mt-7 grid gap-4">
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Nome
            <input required value={nome} onChange={(event) => setNome(event.target.value)} className="h-11 rounded-md border border-slate-300 px-3 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100" placeholder="Seu nome" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Email
            <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 rounded-md border border-slate-300 px-3 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100" placeholder="voce@peanutec.com" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Senha
            <input required minLength={8} type="password" value={senha} onChange={(event) => setSenha(event.target.value)} className="h-11 rounded-md border border-slate-300 px-3 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100" placeholder="Mínimo de 8 caracteres" />
          </label>
          {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800">{error}</div> : null}
          <button type="submit" disabled={isSubmitting} className="mt-2 h-11 rounded-md bg-emerald-800 px-4 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-slate-300">
            {isSubmitting ? "Criando..." : "Criar conta"}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-slate-600">
          Já tem conta?{" "}
          <Link href="/login" className="font-semibold text-emerald-800 hover:text-emerald-950">Entrar</Link>
        </p>
      </section>
    </main>
  );
}
