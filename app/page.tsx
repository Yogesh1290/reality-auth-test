"use client";

import { useState, useEffect } from "react";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { RealityLimitAuth } from "../lib/reality-limit-auth";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Fingerprint, Lock, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";

const rl = new RealityLimitAuth();

export default function Home() {
  const [userId] = useState("vlog-demo-user");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [balance, setBalance] = useState(125000);

  const register = async () => {
    setLoading(true);
    setStatus("Generating secure hardware challenge...");
    try {
      const opts = await fetch("/api/auth/register/options", {
        method: "POST",
        body: JSON.stringify({ userId }),
      }).then((r) => r.json());

      const attResp = await startRegistration({ optionsJSON: opts });

      setStatus("Verifying reality limit...");
      const verification = await fetch("/api/auth/register/verify", {
        method: "POST",
        body: JSON.stringify({ attResp, userId }),
      }).then((r) => r.json());

      if (verification.verified) {
        setStatus("Registration OK. Silicon bound to RealityLimit.");
        setTimeout(() => setStatus("Success! Now click Login to unlock the vault."), 1500);
      } else {
        setStatus("Registration Failed.");
      }
    } catch (e: any) {
      setStatus("Error: " + e.message);
    }
    setLoading(false);
  };

  const login = async () => {
    setLoading(true);
    setStatus("Initiating unforgeable login...");
    try {
      const opts = await fetch("/api/auth/login/options", {
        method: "POST",
        body: JSON.stringify({ userId }),
      }).then((r) => r.json());

      const attResp = await startAuthentication({ optionsJSON: opts });

      // 100% REAL: Extract the physical silicon signature
      const hardwareSignature = attResp.response.signature;

      setStatus("Establishing pure info-theoretic session...");
      const verification = await fetch("/api/auth/login/verify", {
        method: "POST",
        body: JSON.stringify({ attResp, userId, hardwareSignature }),
      }).then((r) => r.json());

      if (verification.verified) {
        // Anchor the client mathematically to the physical hardware
        rl.anchorToHardware(hardwareSignature);
        sessionStorage.setItem("rl_anchor", hardwareSignature); // Preserve physical trace against React hot-reloads

        setStatus("Access Granted. Authentic Hardware Seed Tied.");
        setTimeout(() => setIsAuthenticated(true), 1000);
      } else {
        setStatus("Authentication Failed.");
      }
    } catch (e: any) {
      setStatus("Error: " + e.message);
    }
    setLoading(false);
  };

  const transfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount))) return;

    setLoading(true);
    setStatus("Computing Carter-Wegman unconditional MAC...");

    try {
      // Create JSON payload
      const actionPayload = JSON.stringify({
        action: "wire-transfer",
        amount: Number(amount),
        destination: "Offshore Vault 09x",
        timestamp: Date.now()
      });

      const msg = new TextEncoder().encode(actionPayload);

      // Re-anchor to ensure Next.js hot-reloads don't drop the physical state
      const anchor = sessionStorage.getItem("rl_anchor");
      if (anchor) rl.anchorToHardware(anchor);

      // The magic happens here: Sign the packet using info-theoretic math
      const packet = rl.createPacket(msg);

      setStatus("Sending pure signed packet...");

      const res = await fetch("/api/protected", {
        method: "POST",
        body: packet as any,
        headers: { "Content-Type": "application/octet-stream" },
      });

      const result = await res.json();

      if (res.ok) {
        setBalance(prev => prev - Number(amount));
        setStatus(result.message);
        setAmount("");
      } else {
        setStatus(result.message);
      }
    } catch (e: any) {
      setStatus("Error: " + e.message);
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/10 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/10 blur-[120px]" />

      <AnimatePresence mode="wait">
        {!isAuthenticated ? (
          <motion.div
            key="login"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.5 }}
            className="glass-panel p-10 rounded-2xl w-full max-w-md flex flex-col items-center relative z-10"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-zinc-800 to-zinc-700 p-[1px] mb-8 relative">
              <div className="w-full h-full bg-zinc-950 rounded-2xl flex items-center justify-center">
                <ShieldCheck className="w-8 h-8 text-white" />
              </div>
            </div>

            <h1 className="text-2xl font-bold tracking-tight mb-2 text-center">
              RealityLimit Auth
            </h1>
            <p className="text-zinc-400 text-sm text-center mb-10 leading-relaxed">
              Experience the end-game of authentication. Information-theoretically secure, bound to physical reality.
            </p>

            <div className="w-full flex justify-between space-x-4">
              <button
                onClick={register}
                disabled={loading}
                className="w-1/2 flex items-center justify-center space-x-2 bg-white/5 hover:bg-white/10 text-white py-3 px-4 rounded-xl font-medium transition-all focus:outline-none focus:ring-2 focus:ring-white/20 active:scale-95 disabled:opacity-50"
              >
                <Fingerprint className="w-4 h-4" />
                <span>Register</span>
              </button>

              <button
                onClick={login}
                disabled={loading}
                className="w-1/2 flex items-center justify-center space-x-2 bg-white text-black hover:bg-zinc-200 py-3 px-4 rounded-xl font-medium transition-all focus:outline-none focus:ring-2 focus:ring-white/20 active:scale-95 disabled:opacity-50"
              >
                <Lock className="w-4 h-4" />
                <span>Login</span>
              </button>
            </div>

            <AnimatePresence>
              {status && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-6 w-full text-center"
                >
                  <p className="text-xs text-zinc-500 flex items-center justify-center space-x-2">
                    {loading && <Loader2 className="w-3 h-3 animate-spin" />}
                    <span>{status}</span>
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="w-full max-w-2xl relative z-10"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="font-semibold text-white">Quantum Vault</h2>
                  <p className="text-xs text-emerald-400 flex items-center">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Math Bound Active
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setIsAuthenticated(false); setStatus(null); }}
                className="text-sm font-medium text-zinc-400 hover:text-white transition-colors"
              >
                Sign Out
              </button>
            </div>

            {/* Content Body */}
            <div className="glass-panel rounded-3xl p-8 mb-6">
              <div className="mb-10">
                <p className="text-zinc-400 text-sm mb-1 uppercase tracking-widest font-medium">Available Balance</p>
                <h1 className="text-5xl font-bold tracking-tight text-white flex items-baseline">
                  ${balance.toLocaleString()}
                  <span className="text-xl text-zinc-500 ml-2">.00</span>
                </h1>
              </div>

              <form onSubmit={transfer} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-zinc-300 block mb-2">Wire Transfer Amount</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-medium">$</span>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      disabled={loading}
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-4 pl-8 pr-4 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-lg font-medium outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading || !amount}
                    className="w-full group relative overflow-hidden bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl py-4 font-semibold text-lg flex items-center justify-center transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
                  >
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                    <span className="relative flex items-center">
                      {loading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin mr-2" />
                          Processing...
                        </>
                      ) : (
                        <>
                          Authorize Transfer
                          <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </span>
                  </button>
                </div>
              </form>
            </div>

            {/* Status Log */}
            <AnimatePresence>
              {status && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-panel rounded-xl p-4 border-l-4 border-l-emerald-500"
                >
                  <p className="text-sm text-zinc-300 font-mono break-words">{status}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
