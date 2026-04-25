"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Check, Loader2 } from "lucide-react";

type Status = "idle" | "loading" | "success" | "error";

export function WaitlistForm({
  placeholder = "you@domain.com",
  buttonLabel = "Get Early Access",
  source = "hero",
  compact = false,
}: {
  placeholder?: string;
  buttonLabel?: string;
  source?: string;
  compact?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "loading" || status === "success") return;
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setStatus("error");
        setMessage(data?.error ?? "Something went wrong.");
        return;
      }
      setStatus("success");
      setMessage(
        data.duplicate
          ? "You're already on the list — welcome back."
          : "You're in. Check your inbox."
      );
      setEmail("");
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className={`w-full ${compact ? "max-w-md" : "max-w-xl"}`}
      noValidate
    >
      <motion.div
        animate={
          status === "success"
            ? {
                boxShadow: [
                  "0 0 0 0 rgba(62,243,162,0)",
                  "0 0 0 1px rgba(62,243,162,0.5), 0 0 40px -5px rgba(62,243,162,0.5)",
                  "0 0 0 1px rgba(62,243,162,0.3), 0 0 24px -8px rgba(62,243,162,0.3)",
                ],
              }
            : {}
        }
        transition={{ duration: 0.8 }}
        className="relative flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] p-1.5 backdrop-blur-md transition-all focus-within:border-accent-green/40 focus-within:shadow-[0_0_30px_-5px_rgba(62,243,162,0.4)]"
      >
        <input
          type="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === "error" || status === "success") {
              setStatus("idle");
              setMessage("");
            }
          }}
          placeholder={placeholder}
          aria-label="Email address"
          disabled={status === "loading" || status === "success"}
          className="flex-1 bg-transparent px-4 py-2.5 text-[15px] text-white placeholder:text-white/35 focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={status === "loading" || status === "success"}
          className="group relative inline-flex items-center gap-1.5 rounded-full bg-accent-gradient px-5 py-2.5 text-[14px] font-semibold text-black transition-all hover:shadow-[0_0_30px_-5px_rgba(62,243,162,0.6)] disabled:opacity-70"
        >
          <AnimatePresence mode="wait" initial={false}>
            {status === "loading" ? (
              <motion.span
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1.5"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Joining</span>
              </motion.span>
            ) : status === "success" ? (
              <motion.span
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1.5"
              >
                <Check className="h-4 w-4" />
                <span>Joined</span>
              </motion.span>
            ) : (
              <motion.span
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1.5"
              >
                <span>{buttonLabel}</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </motion.div>

      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`mt-2.5 px-1 text-[13px] ${
              status === "error" ? "text-red-400/90" : "text-accent-green/90"
            }`}
          >
            {message}
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}
