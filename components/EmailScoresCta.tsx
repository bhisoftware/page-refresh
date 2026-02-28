"use client";

import { useState } from "react";

interface EmailScoresCtaProps {
  refreshId: string;
}

export function EmailScoresCta({ refreshId }: EmailScoresCtaProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("submitting");
    setErrorMsg("");

    try {
      const res = await fetch("/api/email-scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshId, email: email.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Something went wrong");
      }

      setStatus("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  };

  return (
    <div className="relative rounded-3xl bg-slate-900 p-12 text-center text-white overflow-hidden mb-10">
      {/* Decorative gradient accents */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: "-50%",
          left: "-20%",
          width: "60%",
          height: "120%",
          background: "radial-gradient(ellipse, rgba(79,70,229,0.2), transparent 60%)",
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: "-40%",
          right: "-15%",
          width: "50%",
          height: "100%",
          background: "radial-gradient(ellipse, rgba(6,182,212,0.15), transparent 60%)",
        }}
      />

      {status === "success" ? (
        <div className="relative z-10">
          <div className="text-4xl mb-3">&#10003;</div>
          <h3 className="text-2xl font-extrabold tracking-tight mb-2">
            Check your inbox
          </h3>
          <p className="text-slate-400 text-sm">
            We&apos;ll send your full scorecard breakdown to{" "}
            <span className="text-white font-medium">{email}</span>.
          </p>
        </div>
      ) : (
        <div className="relative z-10">
          <h3 className="text-2xl font-extrabold tracking-tight mb-2">
            Get your full scorecard
          </h3>
          <p className="text-slate-400 text-sm mb-7">
            Enter your email and we&apos;ll send you the complete dimension
            breakdown with actionable recommendations.
          </p>
          <form
            onSubmit={handleSubmit}
            className="flex max-w-md mx-auto"
          >
            <input
              type="email"
              required
              placeholder="you@company.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (status === "error") setStatus("idle");
              }}
              className="flex-1 px-5 py-3 bg-white/[0.06] border border-white/10 text-white
                         placeholder:text-slate-500 rounded-l-xl outline-none
                         focus:border-indigo-500 focus:bg-white/[0.08] transition-colors
                         text-sm font-medium"
            />
            <button
              type="submit"
              disabled={status === "submitting"}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold
                         rounded-r-xl text-sm whitespace-nowrap transition-all
                         shadow-[0_0_24px_rgba(79,70,229,0.4)]
                         hover:shadow-[0_0_32px_rgba(79,70,229,0.6)]
                         hover:-translate-y-0.5
                         disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {status === "submitting" ? "Sending..." : "Send My Results"}
            </button>
          </form>
          {status === "error" && errorMsg && (
            <p className="text-red-400 text-sm mt-3">{errorMsg}</p>
          )}
        </div>
      )}
    </div>
  );
}
