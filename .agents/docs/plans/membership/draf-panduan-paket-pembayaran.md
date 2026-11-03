# Draf panduan pengguna: paket, pembayaran, dan refund

Dibuat di Phase 07 (2026-11-03). **Jangan terbitkan sebelum go-live** (Phase 11): selama `BILLING_MODE=off`, pengguna tidak bisa membeli, jadi panduan publik di `docs/` belum boleh menyebutnya. Saat go-live:

1. Buat `docs/guides/plans.mdx` dari teks di bawah, sesuaikan dengan UI saat itu (cek label di kode `apps/web/src/features/billing/`), dan buat screenshot baru dengan data fiktif (aturan `docs/contributing/career-platform.mdx` → **Keep product guides current**).
2. Daftarkan `guides/plans` di grup **Account** pada `docs/docs.json`, sebelum `guides/exporting-your-data`.
3. Tautan `/guides/plans` di draf Phase 05 ([draf-panduan-rezumi-ai.md](draf-panduan-rezumi-ai.md)) langsung berfungsi setelah halaman ini ada.
4. Cocokkan ringkasan refund dengan kebijakan yang berlaku saat itu (`docs/legal/kebijakan-pengembalian-dana.mdx`); jangan tulis angka yang berbeda.

Panduan di `docs/` berbahasa Inggris, jadi teks siap tempel di bawah juga berbahasa Inggris. Harga tidak ditulis di panduan (bisa berubah); tunjuk halaman Paket dan halaman harga.

## `docs/guides/plans.mdx`

```mdx
---
title: "Plans and payments"
description: "Buy 30 days of Plus or Pro AI on the Rezumi website, finish or change an open payment, and find your receipts. Nothing renews on its own."
---

Rezumi has a Free plan and two paid passes, **Plus** and **Pro AI**. A pass is **30 days of access, paid once**. Nothing renews on its own, and when a pass ends your account returns to Free. Your documents are never locked or deleted: every resume and cover letter stays open to edit, share and download as a PDF.

See the [pricing on the home page](https://rezumi.app/#pricing) for what each plan includes and costs. Prices are final and shown in Indonesian Rupiah.

<Note>
  Passes are bought on the Rezumi website only. The Android app shows your plan and credits, and the iPhone app shows
  what your account can use.
</Note>

## Before you buy

- Use a registered account. A guest account first needs to [create an account](/guides/creating-an-account); your guest work moves with you.
- Verify your email address. The receipt is sent there. If the link expired, open **Settings → Plan** and select **Resend the link**.

## Buy a pass

<Steps>
  <Step title="Open Plan">Select your name at the bottom of the sidebar, then **Plan**.</Step>
  <Step title="Choose a pass">
    Under **Buy a pass**, select the button on Plus or Pro AI. It reads **Buy**, **Extend 30 days** when that pass is
    already running, or **Upgrade to Pro AI** while Plus runs.
  </Step>
  <Step title="Check the summary">
    The panel shows the price, that the pass lasts 30 days and doesn't renew, when it starts and ends if you pay now,
    and the refund policy in brief. Select **Continue to payment**.
  </Step>
  <Step title="Pay on Midtrans">
    Rezumi's payments run on Midtrans' secure payment page. Choose a method such as QRIS, e-wallet or bank transfer
    (virtual account) and pay.
  </Step>
  <Step title="Come back to Rezumi">
    After paying you return to Rezumi. The page checks the payment by itself and shows **Payment received** with your
    plan, until when it runs and any Rezumi AI credits.
  </Step>
</Steps>

## When your pass starts

- The pass starts when the payment is confirmed, not when you open the payment page.
- **Buying the same pass again** adds 30 days after the current one.
- **Upgrading from Plus to Pro AI** starts Pro AI now. The rest of your Plus time pauses and continues after Pro AI ends.
- **Buying Plus while Pro AI runs** queues Plus after Pro AI.

No paid day is lost. **Settings → Plan** shows what you have now and what comes next.

## Rezumi AI credits

Each Pro AI purchase adds 100 Rezumi AI credits as soon as the payment is confirmed. They're valid until the end of the 30 days you bought. See [Using AI](/guides/using-ai) for what each action costs.

## An unfinished payment

If you leave the payment page before paying, **Settings → Plan** shows that your payment isn't finished (for example **Your Pro AI payment isn't finished**), with the amount and the deadline. A payment stays open for 24 hours.

- **Continue payment** opens the same Midtrans page again. A virtual account can be paid any time before the deadline.
- **Change payment method** closes the old payment and opens a new one, so the same pass is never paid twice by mistake.

If the return page says **Waiting for your payment** after you paid, wait a moment: it updates by itself. You can also select **Check again** later. A payment made just before the deadline can take a few minutes to show.

## Receipts

Every payment is listed under **Payments** on the Plan page. Select **Receipt** to open it, then **Print or save as PDF**. The receipt shows the seller, the order number, when you paid, the plan and its access period, the method and the amount. It's also emailed to you.

Receipts are proof of payment, not tax invoices: the seller isn't registered for VAT, so no VAT is charged.

## Refunds

On a first purchase you can ask for a full refund within 7 days if you used no more than 10 Rezumi AI credits from it. Double payments and technical problems are always sorted out. Send your account email and the order number from the receipt to the address in [Contact & complaints](/legal/contact). The [refund policy](/legal/refund-policy) has the details.

When a refund is approved, the time and remaining credits from that payment are taken back. Your other passes and your documents stay as they are.
```

## Catatan untuk pemilik

- Halaman ini tidak menyebut harga agar tidak perlu diubah setiap harga berubah.
- Bila metode pembayaran di produksi berbeda (mis. hanya QRIS), ubah langkah **Pay on Midtrans** di panduan dan teks langkah "Bayar" di panel beli (`purchase-dialog.tsx`) sesuai metode yang benar-benar aktif.
- Bila nama menu di sidebar berubah, sesuaikan langkah **Open Plan**.
