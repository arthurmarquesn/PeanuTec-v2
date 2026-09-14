"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { loginUser } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await loginUser({ email, senha });
      localStorage.setItem("access_token", response.access_token);

      if (response.user) {
        localStorage.setItem("peanutec_user", JSON.stringify(response.user));
      }

      router.replace("/dashboard");
    } catch {
      setError("Nao foi possivel entrar. Confira email, senha e API.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-emerald-950 px-4 py-10 text-slate-950">
      <section className="w-full max-w-md rounded-md border border-white/10 bg-white p-6 shadow-2xl">
        <div>
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-emerald-100 text-2xl">
            🌱
          </div>
          <h1 className="mt-5 text-3xl font-semibold">PeanuTec</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Inteligencia fitossanitaria para lavouras de amendoim
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-7 grid gap-4">
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Email
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 rounded-md border border-slate-300 px-3 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              placeholder="arthur@peanutec.com"
            />
          </label>

          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Senha
            <input
              required
              type="password"
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              className="h-11 rounded-md border border-slate-300 px-3 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              placeholder="Sua senha"
            />
          </label>

          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 h-11 rounded-md bg-emerald-800 px-4 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSubmitting ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-600">
          Ainda nao tem conta?{" "}
          <Link
            href="/cadastro"
            className="font-semibold text-emerald-800 hover:text-emerald-950"
          >
            Criar conta
          </Link>
        </p>
      </section>
    </main>
  );
}
