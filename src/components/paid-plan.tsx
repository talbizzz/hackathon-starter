"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PAID_PLAN, type PaidPlanContent } from "@/lib/paid-plan";

type PurchaseStatus = {
  configured: boolean;
  mode: "sandbox" | "live" | null;
  entitled: boolean;
  checkoutReady: boolean;
  latestOrder?: { orderId: string; status: string };
};

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: "no-store", ...options });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const messages: Record<string, string> = {
      ORDER_NOT_FOUND: "This checkout does not belong to this account. Sign in with the account you used to buy.",
      PAYMENT_MISMATCH: "We couldn’t verify this payment. Access stays locked; please keep your PayPal receipt.",
      SALES_PAUSED: "New purchases are currently paused. Existing purchases can still be recovered.",
      PAYMENTS_NOT_CONFIGURED: "Checkout is not available yet. No new payment has been requested.",
      PAYMENT_STORAGE_UNAVAILABLE: "We couldn’t save or retrieve your purchase. If PayPal shows a payment, check again here instead of paying twice.",
      PAYPAL_UNAVAILABLE: "PayPal did not confirm the request. If you already paid, check payment again here before trying a new purchase.",
      INVALID_ORIGIN: "Please open this page directly and try again.",
      RECOVER_PREVIOUS_ORDER: "An earlier payment is still being checked. Use Check payment / recover access before attempting another purchase.",
    };
    throw Object.assign(new Error(messages[body.error] || "We couldn’t check your purchase. Please try again."), { status: response.status });
  }
  return body as T;
}

function planText(plan: PaidPlanContent) {
  return [plan.title, plan.introduction, plan.budget,
    ...plan.steps.map((s) => `${s.time} — ${s.title}\n${s.detail}\n${s.cost}\n${s.address ?? ""}\n${s.mapUrl ?? ""}\n${s.sourceUrl ?? ""}`),
    `${plan.backup.title}\n${plan.backup.detail}\n${plan.backup.sourceUrl}`,
    ...plan.notes, `Venue facts checked ${plan.checkedAt}.`,
  ].join("\n\n");
}

export function PaidPlan({ returnOrderId, cancelled, salesEnabled }: {
  returnOrderId?: string; cancelled: boolean; salesEnabled: boolean;
}) {
  const [status, setStatus] = useState<PurchaseStatus | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [content, setContent] = useState<PaidPlanContent | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(cancelled ? "Checkout was cancelled. Your plan stays locked until payment is confirmed." : "");
  const [copied, setCopied] = useState(false);
  const [showCopy, setShowCopy] = useState(false);
  const lock = useRef(false);
  const returnPath = returnOrderId ? `${PAID_PLAN.path}?checkout=return&token=${encodeURIComponent(returnOrderId)}` : PAID_PLAN.path;

  const refresh = useCallback(async (checkOrder?: string) => {
    if (lock.current) return;
    lock.current = true;
    try {
      let current = await api<PurchaseStatus>("/api/paypal/status");
      setSignedOut(false);
      setStatus(current);
      const orderId = checkOrder || (!cancelled ? current.latestOrder?.orderId : undefined);
      if (!current.entitled && orderId && current.configured) {
        const result = await api<{ status: string; entitled: boolean }>("/api/paypal/capture", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId }),
        });
        current = { ...current, entitled: result.entitled };
        setStatus(current);
        if (!result.entitled) setNotice(result.status === "REVOKED"
          ? "This payment was refunded or reversed. Access is no longer active."
          : result.status === "FAILED"
          ? "Payment was declined or checkout expired. Your plan is still locked. You can start a new checkout."
          : "Payment is not confirmed yet. Your plan remains locked. Check again after completing PayPal checkout.");
      }
      if (current.entitled) {
        const plan = await api<PaidPlanContent>("/api/paypal/plan");
        setContent(plan);
        setNotice("Payment confirmed. Your plan is unlocked.");
        window.history.replaceState(null, "", PAID_PLAN.path);
      } else {
        setContent(null);
      }
    } catch (err) {
      setContent(null);
      if ((err as { status?: number }).status === 401) {
        setSignedOut(true);
        setStatus(null);
      } else setError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }, [cancelled]);

  // refresh changes state only after its asynchronous status request resolves.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh(returnOrderId); }, [refresh, returnOrderId]);

  function checkPayment() {
    if (lock.current) return;
    setBusy(true);
    setError("");
    void refresh(returnOrderId);
  }

  async function buy() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const order = await api<{ approvalUrl?: string; orderId?: string; entitled?: boolean; approved?: boolean }>("/api/paypal/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (order.entitled || (order.approved && order.orderId)) {
        lock.current = false;
        await refresh(order.approved ? order.orderId : undefined);
        return;
      }
      const url = new URL(order.approvalUrl ?? "");
      if (url.protocol !== "https:" || !["www.paypal.com", "www.sandbox.paypal.com"].includes(url.hostname)) throw new Error("Checkout could not be opened. Please try again.");
      window.location.assign(url.href);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout could not be opened.");
      setBusy(false);
      lock.current = false;
    }
  }

  async function copy() {
    if (!content) return;
    try { await navigator.clipboard.writeText(planText(content)); setCopied(true); }
    catch { setShowCopy(true); }
  }

  const button = "inline-flex min-h-12 items-center justify-center rounded-xl bg-neutral-950 px-6 py-3 font-semibold text-white transition hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-950 disabled:cursor-not-allowed disabled:opacity-50";
  return (
    <main className="mx-auto max-w-5xl px-5 pb-16 sm:px-8">
      <nav className="flex items-center justify-between gap-4 border-b border-neutral-200 py-5" aria-label="Plan navigation">
        <Link href="/" className="text-sm font-medium underline underline-offset-4">← Free discovery</Link>
        <span className="text-sm text-neutral-500">One plan. Your whole group.</span>
      </nav>
      <div className="grid gap-10 py-10 md:grid-cols-[1.4fr_1fr] md:py-16">
        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Kreuzberg · English-language guide</p>
          <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">Your Sunday,<br />already planned.</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-neutral-600">Local stories, an afternoon of art, and room to go at your own pace. A self-guided outing you can share with your friends.</p>
          <div className="mt-6 flex flex-wrap gap-2 text-sm">
            {["About 3 hours", "2–4 adults", "Museum stops + outdoor walk"].map((label) => <span key={label} className="rounded-full border border-neutral-300 px-3 py-1.5">{label}</span>)}
          </div>
          <div className="mt-8 border-l-2 border-neutral-900 pl-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">A stop to preview</p>
            <h2 className="mt-2 text-xl font-semibold">Start with the stories of Kreuzberg.</h2>
            <p className="mt-2 leading-relaxed text-neutral-600">FHXB Museum is a free first stop near Kottbusser Tor. Its official Sunday hours are 10:00–20:00. The museum currently reports a broken lift, so this is not a step-free route.</p>
            <a className="mt-3 inline-block text-sm underline underline-offset-4" href="https://www.fhxb-museum.de/besuch/besuch-planen" target="_blank" rel="noreferrer">Check the museum’s visitor information ↗</a>
          </div>
        </section>
        <aside className="self-start rounded-2xl border border-neutral-300 bg-neutral-50 p-6 sm:p-7" aria-label="Purchase this plan">
          <p className="text-sm font-medium">{PAID_PLAN.title}</p>
          <p className="mt-3 text-4xl font-semibold">€3.99 <span className="text-sm font-normal text-neutral-600">once per group</span></p>
          <ul className="mt-6 space-y-3 text-sm leading-relaxed">
            <li>✓ An ordered route and suggested timings</li>
            <li>✓ Venue costs, directions and official sources</li>
            <li>✓ A shorter, lower-cost alternative</li>
            <li>✓ Copy the plan for the friends joining you</li>
          </ul>
          <p className="mt-5 text-sm leading-relaxed text-neutral-600">Allow €14 venue admission per adult, plus the plan price. Food and transport are extra. No tickets, reservations or subscription are included. Facts checked 21 November 2026; recheck before visiting.</p>
          <div className="mt-6 space-y-3" aria-live="polite" aria-busy={busy}>
            {status?.mode === "sandbox" && <p className="rounded-lg bg-amber-100 p-3 text-sm font-medium text-amber-950">Test checkout — no live sale. Use a PayPal sandbox buyer.</p>}
            {busy ? <p className="py-3 text-sm">Checking your purchase…</p>
              : content ? <a href="#your-plan" className={button + " w-full"}>Open your purchased plan ↓</a>
              : signedOut ? <>
                {!salesEnabled && <p className="text-sm font-medium">Sales are opening soon. No payment is being taken.</p>}
                <Link className={button + " w-full"} href={`/login?next=${encodeURIComponent(returnPath)}`}>{salesEnabled ? "Sign in to buy · €3.99" : "Sign in to recover a purchase"}</Link>
                <p className="text-xs text-neutral-600">Your account keeps your purchase accessible when you return.</p>
              </> : <>
                <button className={button + " w-full"} disabled={!salesEnabled || !status?.checkoutReady} onClick={() => void buy()}>Pay €3.99 with PayPal</button>
                {(!salesEnabled || !status?.checkoutReady) && !error && <p className="text-sm">Checkout is not available yet. No payment is being taken.</p>}
              </>}
            {notice && <p className="rounded-lg bg-white p-3 text-sm" role="status">{notice}</p>}
            {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
            {!busy && !signedOut && !content && <button className="min-h-11 text-sm underline underline-offset-4" onClick={checkPayment}>Check payment / recover access</button>}
          </div>
        </aside>
      </div>
      {content && <section id="your-plan" className="scroll-mt-6 border-t border-neutral-200 pt-9">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-sm text-neutral-500">Purchased plan · saved to your account</p><h2 className="mt-1 text-3xl font-semibold tracking-tight">{content.title}</h2></div>
          <button onClick={() => void copy()} className={button}>{copied ? "Plan copied ✓" : "Copy plan for your group"}</button>
        </div>
        {showCopy && <label className="mt-5 block text-sm">Copy this text to your group chat<textarea readOnly value={planText(content)} onFocus={(e) => e.currentTarget.select()} className="mt-2 h-48 w-full rounded-lg border p-3" /></label>}
        <p className="mt-5 max-w-3xl leading-relaxed text-neutral-600">{content.introduction}</p>
        <p className="mt-4 rounded-xl bg-neutral-100 p-5 text-sm leading-relaxed">{content.budget}</p>
        <ol className="mt-8 space-y-8">
          {content.steps.map((step) => <li key={step.title} className="grid gap-3 border-b border-neutral-200 pb-8 sm:grid-cols-[8rem_1fr]">
            <p className="font-mono text-sm text-neutral-500">{step.time}</p>
            <div><h3 className="text-xl font-semibold">{step.title}</h3><p className="mt-3 leading-relaxed text-neutral-600">{step.detail}</p><p className="mt-3 text-sm font-medium">{step.cost}</p>{step.address && <p className="mt-2 text-sm">{step.address}</p>}
              <div className="mt-3 flex flex-wrap gap-5 text-sm">{step.mapUrl && <a href={step.mapUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4">Open directions ↗</a>}{step.sourceUrl && <a href={step.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4">Official visitor information ↗</a>}</div>
            </div>
          </li>)}
        </ol>
        <div className="mt-8 rounded-xl border border-neutral-300 p-6"><h3 className="text-xl font-semibold">{content.backup.title}</h3><p className="mt-3 leading-relaxed text-neutral-600">{content.backup.detail}</p><a href={content.backup.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm underline">Check the alternative ↗</a></div>
        <ul className="mt-6 list-disc space-y-2 pl-5 text-sm leading-relaxed text-neutral-600">{content.notes.map((note) => <li key={note}>{note}</li>)}</ul>
      </section>}
    </main>
  );
}
