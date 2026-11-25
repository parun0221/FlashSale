/**
 * Test terpenting: tidak boleh ada oversell.
 *
 * TODO:
 *  - Butuh Postgres + Redis (docker-compose.dev.yml)
 *  - Skenario: 300 user serentak membeli stok 40
 *  - Assert: tepat 40 order confirmed, remaining_stock = 0, pembeli unik = 40
 *  - Assert: user yang sama tidak bisa membeli dua kali
 *  - Jalankan hanya bila RUN_INTEGRATION=1
 */
