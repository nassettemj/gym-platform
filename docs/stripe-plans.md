# Stripe plan and member mapping

This document summarizes how `MembershipPlan`, `Member`, and related models map to Stripe objects.

## Currency

- The application is **EUR-only** for Stripe payments.
- `STRIPE_CURRENCY` environment variable must be set to `eur`.
- All Stripe Prices and PaymentIntents **must** use `currency = STRIPE_CURRENCY` (`eur`).

## MembershipPlan → Product & Price

- `priceCents` → Stripe Price `unit_amount` (always in EUR).
- `billingKind`:
  - `SUBSCRIPTION` → Stripe Price with `type = "recurring"`.
  - `ONE_TIME` → Stripe Price with `type = "one_time"` (no `recurring` block).
- `billingInterval` / `intervalCount`:
  - Map to Stripe `price.recurring.interval` and `price.recurring.interval_count`.
- Usage / credits:
  - `usageKind = UNLIMITED` → no per-period quantity cap in Stripe; enforcement is done in-app.
  - `usageKind = LIMITED_CREDITS` and (`creditsPerPeriod`, `creditsPeriodUnit`) → application-enforced limits (e.g. 3 classes per week), independent of Stripe.
- Stripe identifiers:
  - `stripeProductId` → Stripe Product `id` associated with this plan.
  - `stripePriceId` → default Stripe Price `id` used when starting subscriptions or one-time purchases for this plan.

## Member and Gym → Customers and accounts

- `Member.stripeCustomerId` → Stripe Customer `id` for the paying member.
  - Created lazily via `ensureMemberStripeCustomer(memberId)` when a paid flow is started.
  - Populated from `Member.firstName`, `Member.lastName`, and `Member.email` if present.
- `Gym.stripeCustomerId` → Stripe Customer `id` for the gym (used for platform/gym-level billing, not member payments).

## Subscriptions and orders

- `Subscription.stripeSubscriptionId` → Stripe Subscription `id` (for future online subscription flows).
- `Order.stripePaymentIntentId` → Stripe PaymentIntent `id` for one-off purchases.

## Implementation review checklist

Before enabling live Stripe flows, verify:

- **Schema**
  - `Member` has a nullable `stripeCustomerId` field.
  - `MembershipPlan` has `stripeProductId` and `stripePriceId`.
  - `Subscription` has `stripeSubscriptionId`.
  - `Order` has `stripePaymentIntentId`.
- **Configuration**
  - `STRIPE_SECRET_KEY` is set in the environment (no hard-coding in code).
  - `STRIPE_CURRENCY=eur` is set and used consistently.
- **Helpers and flows**
  - `ensureMemberStripeCustomer(memberId)` is used in any flow that needs a paying member.
  - Plan creation creates Stripe Products/Prices in EUR and stores `stripeProductId` / `stripePriceId`.
  - Subscription creation uses `member.stripeCustomerId` + plan `stripePriceId` when Stripe subscriptions are wired.
  - One-off payments use `member.stripeCustomerId` and `STRIPE_CURRENCY` when creating PaymentIntents or Checkout Sessions.

