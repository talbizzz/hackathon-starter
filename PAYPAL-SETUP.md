# PayPal checkout and €3.99 plan setup

The implementation sells `kreuzberg-sunday` for **€3.99 EUR once**, then unlocks its digital itinerary after a server-verified PayPal capture. Browsing and group voting remain free. Buyers sign in so purchases can be recovered on another visit or device. They can copy the purchased itinerary for the friends joining their outing.

**The code is not a live checkout yet.** The deployment owner must supply credentials, apply the migration, configure the webhook and verify the deployed flow. `PAID_PLAN_SALES_ENABLED=false` is the safe default. The public PayPal.Me link is not used to establish purchases or grant access.

## 1. Configure a PayPal sandbox app

1. The owner of the receiving PayPal account signs in to [PayPal Developer](https://developer.paypal.com/dashboard/).
2. In **Apps & Credentials**, select **Sandbox** and create/select a REST app linked to a sandbox business account.
3. Copy that app's **Client ID** and **Secret** into the private environment below. Use the **merchant ID of that same sandbox business account**. The merchant ID is not a PayPal.Me handle or an email address.
4. Create/use a separate sandbox personal buyer account for testing. Do not test by charging the real seller account.
5. Add the webhook in step 3 and copy its ID. Sandbox and live credentials, merchant IDs and webhook IDs are different.

## 2. Set environment variables

Fill the ignored local `.env` or `.env.local` for development; `.env.local` takes precedence. Never commit either file or send secrets in chat. The tracked `.env.example` contains placeholders.

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Exact app origin, e.g. `https://your-app.example`; local development can use `http://localhost:3000` |
| `NEXT_PUBLIC_SUPABASE_URL` | The intended team's Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | That project's public/anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | That same project's server-only service-role key |
| `PAYPAL_ENV` | `sandbox` for testing; `live` only after verification |
| `PAYPAL_CLIENT_ID` | REST app client ID for the selected mode |
| `PAYPAL_CLIENT_SECRET` | REST app secret for the selected mode |
| `PAYPAL_MERCHANT_ID` | Receiving business account merchant ID for that mode |
| `PAYPAL_WEBHOOK_ID` | The ID generated when adding the webhook to that app |
| `PAID_PLAN_SALES_ENABLED` | `false` initially; `true` to enable new orders after setup |

Keep the app's existing PostHog/public variables configured too. Payment variables must **never** use a `NEXT_PUBLIC_` prefix. Both public Supabase keys and the server-only service key must belong to the same project. Live mode requires HTTPS for the app and database URLs.

For Cloudflare, set these at runtime using the team's existing deployment secret mechanism. The GitHub deploy workflow includes the new payment variables; create matching repository secrets. It also supplies `NEXT_PUBLIC_SITE_URL` at runtime, because PayPal needs the real return origin. Public variables still need to be present at build time. For `wrangler secret put`, use its interactive input; do not paste secrets into shell command arguments. `pnpm deploy` does not automatically upload values from `.env`.

## 3. Apply the database migration and register the webhook

Confirm the deployment's real Supabase project before changing it. Earlier project records identify the team project as `iyvypsiqdgryimwkenqb`; verify that with the deployment owner. It was not accessible through this session's connected Supabase account.

Apply the new migration through the team's normal migration process:

```text
supabase/migrations/20261121223805_paypal_paid_plan.sql
```

The repository's `pnpm db:push` applies **all pending migrations**. Review the pending list and target before using it; this branch also contains earlier launch-readiness changes. Do not use production as a disposable test database. The migration enables RLS and restricts payment writes/functions to the server role. Buyers may read only their own receipts. Keep those permissions intact.

In the **same PayPal REST app**, add this webhook URL after the endpoint is deployed:

```text
https://YOUR-APP-ORIGIN/api/paypal/webhook
```

Subscribe to:

- `PAYMENT.CAPTURE.COMPLETED`
- `PAYMENT.CAPTURE.REFUNDED`
- `PAYMENT.CAPTURE.REVERSED`

Set the resulting `PAYPAL_WEBHOOK_ID`, then redeploy/restart with that environment. A local-only HTTP server cannot receive PayPal webhooks: use an existing HTTPS preview deployment for the genuine sandbox integration. The listener verifies signatures via PayPal before trusting the event and rechecks the canonical order. Simulator notifications do not establish a genuine sandbox payment; PayPal's postback signature-verification endpoint does not support mock simulator events.

## 4. Test the entire sandbox flow

Use the actual deployed preview, sandbox seller app and separate sandbox buyer. Set sales enabled only on that sandbox deployment while testing.

1. Open `/plans/kreuzberg-sunday` in a fresh browser. The full paid itinerary must be absent.
2. Create/sign in to an app account. If email confirmation is enabled in Supabase, confirm the email, then return to sign in. Keep Supabase's Site URL/allowed redirects aligned with the real app origin.
3. Select **Pay €3.99 with PayPal**. Confirm the receiving sandbox merchant and **€3.99 EUR** on PayPal.
4. Approve and return. The app must verify the completed capture, unlock the itinerary and allow **Copy plan for your group**.
5. Reload, then sign in with the same app account in a different browser. Access must remain available without another payment.
6. With a different app account, open the paid-content API and reuse the first buyer's order ID. Both must be denied.
7. Cancel a new checkout. Test a failed/pending payment. These must not unlock anything.
8. Retry the return/capture request and resend a genuine completed webhook. There must be no duplicate charge or duplicate entitlement.
9. Refund the sandbox capture. After the verified refund event, a fresh request must deny access. Resending an older completed event must not restore it.
10. Test interrupted return/payment confirmation, then recover through **Check payment / recover access**. Never request a second payment merely because the first response was lost.

Record PayPal sandbox order/capture IDs and database results privately. Do not count sandbox orders, internal tests or browser mocks as customer revenue. The local evidence file `verification/paypal-evidence.txt` describes exactly which checks were possible in this session.

## 5. Enable live sales and start campaigns

After the sandbox flow passes:

1. Verify the actual deployed revision, seller identity/contact, consumer-facing purchase/delivery terms and the completed itinerary. Check venue facts again before publishing the offer. The current guide is in English and includes an outdoor transfer and a known lift limitation.
2. Create/select the **Live** REST app for the intended receiving business. Register its live webhook. Replace all sandbox PayPal values with the corresponding live values and set `PAYPAL_ENV=live`. Never reuse a sandbox merchant/webhook ID.
3. Deploy with sales still disabled; confirm the correct origin, database, runtime secrets and migration.
4. Enable `PAID_PLAN_SALES_ENABLED=true`. Verify the live checkout identifies the intended merchant and exact amount. Any real-money test requires the account owner's explicit approval; none was performed here.
5. Send campaigns directly to `/plans/kreuzberg-sunday`, with the same product, price and exclusions as the preview. Use the first genuine customer's confirmed capture and delivery to establish live success.

PayPal may hold a seller's proceeds; a completed payment is not proof that funds have reached the bank. Account/provider eligibility and production credentials remain the deployment owner's responsibility.

To pause new purchases, set `PAID_PLAN_SALES_ENABLED=false`. Leave the webhook, credentials and database available so existing purchases and refunds can still be reconciled. Do not roll back by dropping receipt tables or disabling verification.

## Read actual payment totals

The deployment owner can inspect receipts in the Supabase SQL editor:

```sql
select count(*) as completed_orders,
       count(distinct user_id) as paying_accounts,
       coalesce(sum(amount_cents), 0) / 100.0 as gross_eur
from public.paid_plan_receipts
where mode = 'live' and status = 'COMPLETED';
```

This reports currently completed, non-revoked live receipts. It excludes sandbox
orders and is not profit, bank payout or proof of distinct people. Fees, taxes
and refunds need their own reconciliation.

## Implementation map

| Path | Responsibility |
| --- | --- |
| `src/lib/paid-plan.ts` | Public product ID, fixed amount/currency and content type |
| `src/lib/paid-plan-content.ts` | Server-only original itinerary |
| `src/components/paid-plan.tsx` | Preview, checkout redirect, confirmation, recovery and copy flow |
| `src/app/api/paypal/orders` | Authenticated server-side creation |
| `src/app/api/paypal/capture` | Ownership and provider verification before access |
| `src/app/api/paypal/status` | Current account's purchase/configuration state |
| `src/app/api/paypal/plan` | Protected itinerary response |
| `src/app/api/paypal/webhook` | Verified provider notifications |
| `src/lib/paypal/` | Provider, receipt store, transaction rules and configuration |

The backend rejects price/product/merchant mismatches, keeps sandbox/live receipts separate, uses database transitions for idempotency and makes refund/reversal terminal for an order. Do not replace these controls with a `paid=true` query parameter, localStorage flag, PayPal.Me return URL or screenshot of a payment.

Official references: [PayPal Orders API](https://developer.paypal.com/api/orders/v2), [webhook verification](https://developer.paypal.com/api/rest/webhooks/rest/), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
