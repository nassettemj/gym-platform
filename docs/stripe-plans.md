# Stripe plan field mapping

This document summarizes how `MembershipPlan` fields map to Stripe Products and Prices.

- `priceCents` → Stripe Price `unit_amount` (in the same currency).
- `billingKind`:
  - `SUBSCRIPTION` → Stripe Price with `type = "recurring"`.
  - `ONE_TIME` → Stripe Price with `type = "one_time"`.
- `billingInterval` / `intervalCount`:
  - Map to Stripe `price.recurring.interval` and `price.recurring.interval_count`.
- Usage / credits:
  - `usageKind = UNLIMITED` → no per-period quantity cap in Stripe; enforcement is done in-app.
  - `usageKind = LIMITED_CREDITS` and (`creditsPerPeriod`, `creditsPeriodUnit`) → application-enforced limits (e.g. 3 classes per week), independent of Stripe.
- Stripe identifiers:
  - `stripeProductId` → Stripe Product `id` associated with this plan.
  - `stripePriceId` → default Stripe Price `id` used when starting subscriptions or one-time purchases for this plan.

Subscriptions:
- `Subscription.stripeSubscriptionId` stores the Stripe Subscription `id`.

One-off purchases:
- `Order.stripePaymentIntentId` stores the related Stripe PaymentIntent `id`.

