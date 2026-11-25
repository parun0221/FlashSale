// Skenario k6: ribuan user menyerbu satu flash sale.
//
// TODO:
//  - Baca tokens.json dengan SharedArray
//  - Executor 'shared-iterations': satu percobaan per user
//  - POST /api/sales/:id/orders dengan header Idempotency-Key unik per percobaan
//  - Counter custom: accepted (202), sold_out (409), rate_limited (429), unexpected (lainnya)
//  - Threshold: p(95) latency dan unexpected == 0
//  - Setelah selesai jalankan `npm run verify:sale -- <saleId>`
