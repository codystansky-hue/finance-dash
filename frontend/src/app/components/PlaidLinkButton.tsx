"use client";
import { useCallback, useEffect, useState } from "react";
import { usePlaidLink, PlaidLinkOptions, PlaidLinkOnSuccess } from "react-plaid-link";

const API = "/api/backend";

interface Props {
  onSuccess: () => void;
}

export default function PlaidLinkButton({ onSuccess }: Props) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/plaid/create-link-token`, { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (data.link_token) setLinkToken(data.link_token);
        else setError(data.detail ?? "Failed to create link token");
      })
      .catch(() => setError("Backend unreachable"));
  }, []);

  const handleSuccess = useCallback<PlaidLinkOnSuccess>(
    async (public_token, metadata) => {
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
      onSuccess();
    },
    [onSuccess]
  );

  const config: PlaidLinkOptions = {
    token: linkToken ?? "",
    onSuccess: handleSuccess,
  };

  const { open, ready } = usePlaidLink(config);

  if (error) {
    return (
      <div className="text-sm text-red-500 bg-red-50 border border-red-200 rounded p-3">
        {error}
      </div>
    );
  }

  return (
    <button
      onClick={() => open()}
      disabled={!ready || !linkToken}
      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
    >
      {linkToken ? "Connect a Bank" : "Loading…"}
    </button>
  );
}
