# Settle table — batch-settle multiple open orders per table

> On `/dashboard/orders`, a table (e.g. T1) can accumulate several OPEN orders. The manager/operator should clear them in one payment.
> Layered (UI → Actions → Services → Repositories → DB), TDD-first. No schema change.
> **Status: SHIPPED (2026-07-19). tsc + eslint clean; 408 tests green.**

## Locked decisions (confirmed 2026-07-19)
1. **Invoicing:** separate invoice per order (each order settles individually, keeps its own invoice number). One combined payment covers them.
2. **Payment:** full split-payment UI (multiple modes + tender/change), same as single settle — but for the table's combined total.
3. **Discount:** none in v1 (discount an individual order first if needed).
4. **UX:** group the **Open** tab by table; tables with 2+ open orders show `Settle table (N · ₹total)`. Singles / no-table orders keep the current per-order flow.

## Design
- **Combined total** = Σ each order's `computeBill(non-void lines)` grand total (no discount).
- **Payment allocation (waterfall):** pour the combined payments into each order's bill in turn, slicing a payment across orders when it spans a boundary. Each order ends fully paid; payment *modes* are preserved in aggregate for reporting. `tendered` is not stored per slice (change is shown in the dialog only).
- **Atomicity:** all orders settle in **one** `$transaction` (`settleManyOrders`) — invoice numbers assigned sequentially, all-or-nothing.

## Build order
1. Validator `settleTableSchema` ({ orderIds[], payments[] }). ✅ target
2. Repo: extract `settleWithinTx`; add `settleManyOrders(restaurantId, settlements[])` (one tx) + spec.
3. Service: `allocatePayments` (pure, tested) + `settleTable(ctx, {orderIds, payments})` + spec (PAYMENT_SHORT, NOT_OPEN, allocation).
4. Action: `settleTableAction` (withManagerValidation) + spec.
5. UI: shared `usePaymentEntry` hook + `PaymentEntryFields` (reused by single + table settle); `TableSettleDialog`; group Open tab by table in `orders-board.tsx`.
6. Validate (tsc + eslint + vitest), rebuild, update MEMORY.
