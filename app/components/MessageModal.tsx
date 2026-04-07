"use client";
import { useState } from "react";

interface Props {
  listingUrl: string;
  listingTitle: string;
  onClose: () => void;
}

export default function MessageModal({ listingUrl, listingTitle, onClose }: Props) {
  const [message, setMessage] = useState("Hi, is this still available?");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null);

  async function handleSend() {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/facebook/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingUrl, message }),
      });
      const data = await res.json();
      if (data.success) {
        setResult({ success: true });
      } else {
        setResult({ error: data.error ?? "Failed to send message" });
      }
    } catch {
      setResult({ error: "Failed to reach server" });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-100">Message Seller</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl leading-none">&times;</button>
        </div>

        <p className="text-sm text-gray-400 mb-4 line-clamp-2">{listingTitle}</p>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          className="w-full resize-none rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          placeholder="Type your message..."
          disabled={sending}
        />

        {result?.success && (
          <div className="mt-3 text-sm text-green-400 bg-green-900/30 border border-green-800 rounded-lg px-3 py-2">
            Message sent successfully!
          </div>
        )}
        {result?.error && (
          <div className="mt-3 text-sm text-red-300 bg-red-900/30 border border-red-800 rounded-lg px-3 py-2">
            {result.error}
          </div>
        )}

        <div className="flex gap-3 mt-4">
          <button
            onClick={handleSend}
            disabled={sending || !message.trim() || result?.success === true}
            className="flex-1 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sending ? "Sending..." : result?.success ? "Sent!" : "Send Message"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-gray-800 border border-gray-700 text-sm font-medium text-gray-300 rounded-xl hover:bg-gray-700 transition-colors"
          >
            {result?.success ? "Done" : "Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}
