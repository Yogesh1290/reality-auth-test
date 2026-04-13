"use client";

import { useState, useEffect } from "react";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { executeProtectedAction } from "@realitylimit/core/browser";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Fingerprint, Lock, ArrowRight, Loader2, CheckCircle2, Smartphone, Trash2, Key, PlusCircle } from "lucide-react";

type Device = { credentialID: string; deviceName: string; registeredAt: string | null; counter: number };

export default function Home() {
  const [userId, setUserId] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [balance, setBalance] = useState(125000);

  // Device management state
  const [devices, setDevices] = useState<Device[]>([]);
  const [hasRecoveryCode, setHasRecoveryCode] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [showDevicePanel, setShowDevicePanel] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState("");
  const [recoveryInput, setRecoveryInput] = useState("");
  const [showRecovery, setShowRecovery] = useState(false);

  const register = async () => {
    // FIX: Force Mobile virtual keyboards (iOS Safari) to close immediately.
    // If the keyboard animates down exactly when the fetch resolves, Apple blocks WebAuthn with "document is not focused"!
    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
    }

    if (!userId) {
        setStatus("Please enter a User ID first.");
        return;
    }
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
    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
    }

    if (!userId) {
        setStatus("Please enter your User ID first.");
        return;
    }
    setLoading(true);
    setStatus("Initiating unforgeable login...");
    try {
      const opts = await fetch("/api/auth/login/options", {
        method: "POST",
        body: JSON.stringify({ userId }),
      }).then((r) => r.json());

      const attResp = await startAuthentication({ optionsJSON: opts });

      setStatus("Establishing pure Info-Theoretic session...");
      const verification = await fetch("/api/auth/login/verify", {
        method: "POST",
        body: JSON.stringify({ attResp, userId }),
      }).then((r) => r.json());

      if (verification.verified) {
        setStatus("Access Granted. Authentic Hardware Tied.");
        // Load real balance from DB
        const balData = await fetch(`/api/auth/balance?userId=${userId}`).then(r => r.json());
        if (balData.balance !== undefined) setBalance(balData.balance);
        setTimeout(() => setIsAuthenticated(true), 1000);
      } else {
        setStatus("Authentication Failed.");
      }
    } catch (e: any) {
      setStatus("Error: " + e.message);
    }
    setLoading(false);
  };

  const loadDevices = async () => {
    const data = await fetch(`/api/auth/devices/list?userId=${userId}`).then(r => r.json());
    if (data.devices) {
      setDevices(data.devices);
      setHasRecoveryCode(data.hasRecoveryCode);
    }
  };

  const addDevice = async () => {
    if (!newDeviceName) { setStatus("Enter a name for the new device first."); return; }
    setLoading(true);
    setStatus("Preparing new device registration...");
    try {
      const opts = await fetch("/api/auth/devices/add/options", {
        method: "POST", body: JSON.stringify({ userId, deviceName: newDeviceName })
      }).then(r => r.json());
      const attResp = await startRegistration({ optionsJSON: opts });
      const result = await fetch("/api/auth/devices/add/verify", {
        method: "POST", body: JSON.stringify({ userId, attResp, deviceName: newDeviceName })
      }).then(r => r.json());
      if (result.verified) {
        setStatus(`✅ ${result.message}`);
        setNewDeviceName("");
        await loadDevices();
      } else {
        setStatus("Device registration failed: " + result.error);
      }
    } catch (e: any) { setStatus("Error: " + e.message); }
    setLoading(false);
  };

  const removeDevice = async (credentialID: string, deviceName: string) => {
    if (!confirm(`Remove "${deviceName}"? Make sure you have another device registered.`)) return;
    setLoading(true);
    setStatus(`Removing ${deviceName}...`);
    try {
      const result = await fetch("/api/auth/devices/remove", {
        method: "DELETE", body: JSON.stringify({ userId, credentialID })
      }).then(r => r.json());
      if (result.verified) {
        setStatus(`✅ ${result.message}`);
        await loadDevices();
      } else {
        setStatus("Error: " + result.error);
      }
    } catch (e: any) { setStatus("Error: " + e.message); }
    setLoading(false);
  };

  const generateRecovery = async () => {
    setLoading(true);
    setStatus("Generating recovery code...");
    try {
      const result = await fetch("/api/auth/recovery/generate", {
        method: "POST", body: JSON.stringify({ userId })
      }).then(r => r.json());
      if (result.recoveryCode) {
        setRecoveryCode(result.recoveryCode);
        setHasRecoveryCode(true);
        setStatus("✅ Recovery code generated. Save it securely — it will not be shown again.");
      }
    } catch (e: any) { setStatus("Error: " + e.message); }
    setLoading(false);
  };

  const useRecoveryCode = async () => {
    if (!recoveryInput) return;
    setLoading(true);
    setStatus("Verifying recovery code...");
    try {
      const opts = await fetch("/api/auth/recovery/verify", {
        method: "POST", body: JSON.stringify({ userId, recoveryCode: recoveryInput, deviceName: "Recovered Device" })
      }).then(r => r.json());
      if (opts.error) { setStatus("❌ " + opts.error); setLoading(false); return; }
      setStatus("Recovery code valid! Complete biometric registration on this device...");
      const attResp = await startRegistration({ optionsJSON: opts });
      const result = await fetch("/api/auth/devices/add/verify", {
        method: "POST", body: JSON.stringify({ userId, attResp, deviceName: "Recovered Device" })
      }).then(r => r.json());
      if (result.verified) {
        setStatus("✅ Recovery complete! New device registered. Recovery code invalidated.");
        setShowRecovery(false);
        setRecoveryInput("");
        setIsAuthenticated(true);
      } else {
        setStatus("Error: " + result.error);
      }
    } catch (e: any) { setStatus("Error: " + e.message); }
    setLoading(false);
  };

  const transfer = async (e: React.FormEvent) => {

    e.preventDefault();
    if (!amount || isNaN(Number(amount))) return;

    setLoading(true);
    setStatus("Initiating Physical Transaction Handshake...");

    try {
      const intent = {
        action: "wire-transfer",
        amount: Number(amount),
        destination: "Offshore Vault 09x",
        timestamp: Date.now()
      };

      // 1. Fetch the Intent Options from backend
      const opts = await fetch("/api/protected/options", {
        method: "POST",
        body: JSON.stringify({ userId, intent }),
      }).then((r) => r.json());

      // 2. Trigger the OS Physical Hardware natively using the SDK 
      // (This inherently protects against Safari bug and OS focus issues)
      const attResp = await executeProtectedAction(opts);

      setStatus("Sending pure physically-signed packet...");

      const res = await fetch("/api/protected/verify", {
        method: "POST",
        body: JSON.stringify({ attResp, userId })
      });

      const result = await res.json();

      if (result.verified) {
        setBalance(result.newBalance);  // Use server-confirmed balance
        setStatus(result.message);
        setAmount("");
      } else {
        setStatus(result.error || "Transaction Failed");
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
            <p className="text-zinc-400 text-sm text-center mb-8 leading-relaxed">
              Experience the end-game of authentication. Information-theoretically secure, bound to physical reality.
            </p>

            <div className="w-full mb-6">
                <input 
                    type="text" 
                    value={userId} 
                    onChange={(e) => setUserId(e.target.value)} 
                    placeholder="Enter your Username"
                    disabled={loading}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium text-center"
                />
            </div>

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

            <button
              onClick={() => setShowRecovery(!showRecovery)}
              className="mt-4 text-xs text-zinc-600 hover:text-zinc-400 transition-colors flex items-center space-x-1"
            >
              <Key className="w-3 h-3" />
              <span>Lost your device? Use recovery code</span>
            </button>

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
                  className="glass-panel rounded-xl p-4 border-l-4 border-l-emerald-500 mb-6"
                >
                  <p className="text-sm text-zinc-300 font-mono break-words">{status}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Device Management Panel */}
            <div className="glass-panel rounded-3xl p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Smartphone className="w-5 h-5 text-zinc-400" />
                  <h3 className="text-white font-semibold">Device Management</h3>
                </div>
                <button
                  onClick={() => { setShowDevicePanel(!showDevicePanel); if (!showDevicePanel) loadDevices(); }}
                  className="text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  {showDevicePanel ? "Hide" : "Manage Devices"}
                </button>
              </div>

              <AnimatePresence>
                {showDevicePanel && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-5 overflow-hidden">

                    {/* Registered Devices List */}
                    <div>
                      <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3">Registered Devices</p>
                      {devices.length === 0 ? (
                        <p className="text-zinc-500 text-sm">Loading...</p>
                      ) : (
                        <div className="space-y-2">
                          {devices.map((device) => (
                            <div key={device.credentialID} className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3">
                              <div className="flex items-center space-x-3">
                                <Smartphone className="w-4 h-4 text-emerald-400" />
                                <div>
                                  <p className="text-white text-sm font-medium">{device.deviceName}</p>
                                  <p className="text-zinc-500 text-xs">
                                    {device.registeredAt ? new Date(device.registeredAt).toLocaleDateString() : "Unknown date"}
                                    {" · "}Counter: {device.counter}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => removeDevice(device.credentialID, device.deviceName)}
                                disabled={loading || devices.length <= 1}
                                className="text-red-400 hover:text-red-300 disabled:text-zinc-700 transition-colors"
                                title={devices.length <= 1 ? "Cannot remove last device" : "Remove device"}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Add New Device */}
                    <div>
                      <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3">Add Another Device</p>
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={newDeviceName}
                          onChange={(e) => setNewDeviceName(e.target.value)}
                          placeholder="Device name (e.g. MacBook)"
                          className="flex-1 bg-black/40 border border-white/10 rounded-xl py-2 px-4 text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        />
                        <button
                          onClick={addDevice}
                          disabled={loading}
                          className="flex items-center space-x-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                        >
                          <PlusCircle className="w-4 h-4" />
                          <span>Register</span>
                        </button>
                      </div>
                    </div>

                    {/* Recovery Code */}
                    <div>
                      <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3">Recovery Code</p>
                      {recoveryCode ? (
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                          <p className="text-yellow-400 text-xs mb-2 font-medium">⚠️ Save this code NOW — it will not be shown again:</p>
                          <p className="text-white font-mono text-lg tracking-widest select-all">{recoveryCode}</p>
                          <button onClick={() => setRecoveryCode(null)} className="text-xs text-zinc-500 hover:text-zinc-300 mt-2 transition-colors">I've saved it</button>
                        </div>
                      ) : (
                        <button
                          onClick={generateRecovery}
                          disabled={loading}
                          className="flex items-center space-x-2 bg-white/5 hover:bg-white/10 text-zinc-300 px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                        >
                          <Key className="w-4 h-4" />
                          <span>{hasRecoveryCode ? "Regenerate Recovery Code" : "Generate Recovery Code"}</span>
                        </button>
                      )}
                      {hasRecoveryCode && !recoveryCode && (
                        <p className="text-xs text-emerald-500 mt-2 flex items-center"><CheckCircle2 className="w-3 h-3 mr-1" />Recovery code is set</p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* Recovery Flow (shown on login screen) */}
        <AnimatePresence>
          {showRecovery && !isAuthenticated && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="glass-panel p-8 rounded-2xl w-full max-w-md mt-4 relative z-10"
            >
              <h2 className="text-white font-semibold mb-2 flex items-center space-x-2"><Key className="w-4 h-4 text-yellow-400" /><span>Account Recovery</span></h2>
              <p className="text-zinc-500 text-xs mb-4">Enter your recovery code to register a new device.</p>
              <input
                type="text"
                value={recoveryInput}
                onChange={(e) => setRecoveryInput(e.target.value)}
                placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white font-mono placeholder:text-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/50 mb-3"
              />
              <div className="flex space-x-2">
                <button onClick={useRecoveryCode} disabled={loading || !recoveryInput} className="flex-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Verify & Register New Device"}
                </button>
                <button onClick={() => setShowRecovery(false)} className="text-zinc-500 hover:text-white px-3 text-sm transition-colors">Cancel</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </AnimatePresence>
    </main>
  );
}
