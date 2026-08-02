"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

/**
 * Persistent banner shown while a staff member is in an agent (proxy) session,
 * acting as a customer. "Exit" logs out of the proxy session.
 */
export default function AgentBanner() {
  const { user, logout } = useAuth();
  const [agent, setAgent] = useState<{ label: string; email: string } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("signfuture.agent");
      setAgent(raw ? JSON.parse(raw) : null);
    } catch {
      setAgent(null);
    }
  }, [user]);

  if (!user || !agent) return null;

  return (
    <div className="agent-banner">
      <span>
        🔐 Agent mode — <strong>{agent.label}</strong> acting as <strong>{user.email}</strong>. Orders are flagged 代理下单.
      </span>
      <button type="button" onClick={logout}>Exit agent mode</button>
    </div>
  );
}
