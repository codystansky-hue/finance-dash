"use client";
import { useEffect, useState, useCallback } from "react";
import { usePlaidLink } from "react-plaid-link";

const API = "/api/backend";

export default function OAuthReturn() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const receivedRedirectUri = typeof window !== "undefined" ? window.location.href : "";

  useEffect(() => {
    // Re-fetch a link token to reinitialize Plaid Link for the OAuth return
    fetch(`${API}/plaid/create-link-token`, { method: "POST" })
      .then(r => r.json())
      .then(d => { if (d.link_token) setLinkToken(d.link_token); });
  }, []);

  const onSuccess = useCallback(async (public_token: string, metadata: any) => {
    const institution = metadata.institution;
    await fetch(`${API}/plaid/exchange-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        public_token,
        institution_id: institution?.institution_id ?? "",
        institution_name: institution?.name ?? "Unknown",
      }),
    });
    window.location.href = "/";
  }, []);

  const config = {
    token: linkToken ?? "",
    receivedRedirectUri,
    onSuccess,
  };

  const { open, ready } = usePlaidLink(config);

  useEffect(() => {
    if (ready) open();
  }, [ready, open]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <p className="text-gray-600 text-lg">Completing bank connection…</p>
        <p className="text-gray-400 text-sm mt-2">You'll be redirected back to your dashboard.</p>
      </div>
    </div>
  );
}
