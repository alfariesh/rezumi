# Draf panduan pengguna: langganan, pembayaran, dan refund

Dibuat di Phase 07 (2026-11-03), ditulis ulang untuk langganan di Phase 12 (2026-11-05) dan untuk Dodo Payments di Phase 13 (2026-11-10). **Jangan terbitkan sebelum go-live** (Phase 11): selama `BILLING_MODE=off`, pengguna tidak bisa berlangganan, jadi panduan publik di `docs/` belum boleh menyebutnya. Saat go-live:

1. Buat `docs/guides/plans.mdx` dari teks di bawah, sesuaikan dengan UI saat itu (cek label di kode `apps/web/src/features/billing/`), dan buat screenshot baru dengan data fiktif (aturan `docs/contributing/career-platform.mdx` → **Keep product guides current**).
2. Daftarkan `guides/plans` di grup **Account** pada `docs/docs.json`, sebelum `guides/exporting-your-data`.
3. Tautan `/guides/plans` di draf Phase 05 ([draf-panduan-rezumi-ai.md](draf-panduan-rezumi-ai.md)) langsung berfungsi setelah halaman ini ada; ubah "per purchase" di draf itu menjadi "every month".
4. Cocokkan ringkasan refund dengan kebijakan yang berlaku saat itu (`docs/legal/kebijakan-pengembalian-dana.mdx`); jangan tulis angka yang berbeda.

Panduan di `docs/` berbahasa Inggris. Harga tidak ditulis di panduan (bisa berubah); tunjuk halaman Paket dan halaman harga.

## `docs/guides/plans.mdx`

```mdx
---
title: "Plans and payments"
description: "Subscribe to Plus or Pro AI monthly or yearly on the Rezumi website, change or cancel it, and find your invoices."
---

Rezumi has a Free plan and two paid plans, **Plus** and **Pro AI**. Each is a **subscription, billed monthly or yearly**, that renews until you cancel. Cancel any time: you keep the plan until the end of the period you paid for, and nothing more is charged. When a plan ends your account returns to Free. Your documents are never locked or deleted: every resume and cover letter stays open to edit, share and download as a PDF.

See the [pricing on the home page](https://rezumi.app/#pricing) for what each plan includes and costs. Prices are in US dollars, or in Rupiah for visitors from Indonesia, and are before tax: the checkout adds the tax for where you live and shows the total before you pay.

<Tip>
  Your first Plus subscription starts with **7 days free**. You add a card at checkout, but nothing is charged until the
  trial ends; Dodo Payments emails you a reminder a few days before. Cancel during the trial and you pay nothing.
</Tip>

<Note>
  Subscriptions are bought on the Rezumi website only. The Android app shows your plan and credits, and the iPhone app
  shows what your account can use.
</Note>

## Before you subscribe

- Use a registered account. A guest account first needs to [create an account](/guides/creating-an-account); your guest work moves with you.
- Verify your email address. Dodo Payments sends your receipts and invoices there. If the link expired, open **Settings → Plan** and select **Resend the link**.

## Subscribe

<Steps>
  <Step title="Open Plan">Select your name at the bottom of the sidebar, then **Plan**.</Step>
  <Step title="Choose monthly or yearly">
    Under **Subscribe**, pick **Monthly** or **Yearly**. Yearly costs less per month.
  </Step>
  <Step title="Choose a plan">
    Select **Try Plus free** (or **Get Plus** once you've had a subscription) or **Get Pro AI**.
  </Step>
  <Step title="Check the summary">
    The panel shows the price, how often it renews, the Rezumi AI credits that come with Pro AI, how to cancel, and the
    refund policy in brief. Select **Continue to checkout**.
  </Step>
  <Step title="Pay on Dodo Payments">
    Rezumi's subscriptions are sold by Dodo Payments, our merchant of record, on its secure checkout. Pay with a debit
    or credit card, Apple Pay or Google Pay.
  </Step>
  <Step title="Come back to Rezumi">
    After paying you return to Rezumi. The page checks the payment by itself and shows **Payment received** with your
    plan, when it renews and any Rezumi AI credits.
  </Step>
</Steps>

## Change your plan

- **Upgrade** (Plus to Pro AI, or monthly to yearly): select **Upgrade to Pro AI** or **Switch to yearly**, then **Upgrade now**. The new plan starts at once and the difference for the rest of the current period is charged to your saved payment method. During the free trial, upgrading ends the trial: this month is charged today, then the difference.
- **Switch down** (Pro AI to Plus, or yearly to monthly): select **Switch to Plus** or **Switch to monthly**, then **Change at renewal**. Your current plan stays until the next renewal; nothing is charged now.

## Cancel or keep your subscription

- Select **Cancel subscription** under **Your plan**. You keep the plan until the date shown, and nothing more is charged.
- Changed your mind before that date? Select **Keep subscription**.

## Payment method, invoices and billing details

Select **Billing and invoices** under **Your plan** to open the billing portal of Dodo Payments, already signed in. There you can update your card, download invoices and receipts, and change billing details. Each paid row under **Payments** also has an **Invoice** button.

If a renewal payment fails, Dodo Payments emails you and may try again. Your plan pauses until the payment goes through; update your card in **Billing and invoices** to restore it.

## Rezumi AI credits

Pro AI includes Rezumi AI credits every month, yearly subscriptions included. Credits left at the end of a month don't carry over. See [Rezumi AI](/guides/rezumi-ai).

## Refunds

Within 7 days of your first charge (for a Plus trial, the charge when the trial ends) you can ask for a full refund if you used no more than 10 Rezumi AI credits from it. Double payments and technical problems are always sorted out. Refunds go back to the original payment method. See the [Refund policy](/legal/refund-policy).

## If you delete your account

Deleting your account ends the subscription at once, without an automatic refund. Download what you need first.
```
