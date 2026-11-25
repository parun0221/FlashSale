/**
 * Entry point proses worker (terpisah dari API).
 *
 * Dijalankan sebagai proses/container sendiri agar bisa di-scale terpisah dari API.
 *
 * TODO:
 *  - Sambungkan Postgres dan Redis dengan retry
 *  - Jalankan startOrderWorker()
 *  - Graceful shutdown: tunggu job yang sedang berjalan selesai (worker.close)
 */
