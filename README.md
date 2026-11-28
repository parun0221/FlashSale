# Flash Sale Backend

Backend untuk skenario **flash sale**: stok terbatas diperebutkan ribuan pengguna dalam waktu bersamaan.
Tujuannya satu: **tidak ada overselling dan tidak ada pembelian ganda**, sambil tetap responsif di bawah beban.

**Stack:** Node.js · Express · PostgreSQL · Redis · BullMQ · Docker Compose · Jest · pino · Prometheus

> **Catatan:** proyek ini saya bangun untuk belajar dan sebagai portofolio. Setiap keputusan desain di bawah
> punya alasan, dan setiap klaim performa disertai cara mengulang pengukurannya.

## Perjalanan memperbaiki race condition

Proyek ini dibangun bertahap. Versi pertama sengaja ditulis dengan cara yang paling sederhana, lalu saya
membuktikan sendiri bahwa versi itu rusak, dan memperbaikinya.

| Versi | Skenario | Hasil | Penjelasan |
|---|---|---|---|
| 1. Naif: baca stok, putuskan di aplikasi, tulis stok | stok 10, 200 pembeli serentak | **201 order**, `remaining_stock` = 3 | Banyak request membaca stok yang sama sebelum ada yang menulis (*race condition*), dan penulisan nilai absolut saling menimpa (*lost update*) |
| 2. Transaksi + `UPDATE ... WHERE remaining_stock > 0` | stok 20, 200 pembeli serentak | **20 order**, `remaining_stock` = 0 | Keputusan dipindahkan ke dalam satu perintah SQL atomik, ditambah unique index agar satu user tidak bisa membeli dua kali |
| 3. Reservasi stok di Redis + antrean + worker | stok 20, 200 pembeli serentak | 20 × `202`, 180 × `409`, **20 order** di database | Request yang pasti gagal ditolak dalam milidetik tanpa menyentuh database |

Tangkapan layar tiap versi ada di [`docs/`](docs/): **[ISI: tambahkan 3 screenshot hasil verify:sale Anda]**.

## Arsitektur

```mermaid
flowchart LR
  C[Client] -->|"POST /api/sales/:id/orders"| A[API Express]
  A -->|"rate limit, idempotency key, reservasi stok"| R[(Redis)]
  A -->|"masukkan job"| Q[[Antrean BullMQ]]
  Q --- R
  W[Worker] -->|"ambil job"| Q
  W -->|"transaksi: simpan order dan kurangi stok"| P[(PostgreSQL)]
  A -->|"cache miss: baca jadwal dan produk"| P
```

Alur satu pembelian:

```mermaid
sequenceDiagram
  participant C as Client
  participant A as API
  participant R as Redis
  participant W as Worker
  participant P as PostgreSQL
  C->>A: POST /orders dengan Idempotency-Key
  A->>R: rate limit, klaim kunci, reservasi stok (Lua atomik)
  A->>R: masukkan job ke antrean
  A-->>C: 202 Accepted dan orderId
  W->>R: ambil job
  W->>P: transaksi: insert order dan UPDATE stok WHERE stok > 0
  C->>A: GET /orders/:id
  A-->>C: pending, confirmed, atau failed
```

**Tiga lapis pertahanan anti-oversell**, dari yang tercepat ke yang terakhir:

1. **Redis (Lua script atomik):** menolak pembeli ganda dan stok habis tanpa menyentuh database.
2. **`UPDATE ... WHERE remaining_stock > 0`:** database yang memutuskan, bukan aplikasi.
3. **Constraint `CHECK (remaining_stock >= 0)` dan unique index** `(sale_id, user_id)`: bila dua lapis di atas salah, database tetap menolak.

## Konsep yang diterapkan

| Konsep | Implementasi | Status |
|---|---|---|
| Indexes | Index keyset pagination `(created_at DESC, id DESC)`, unique index pembeli | Selesai |
| Transactions & isolation | Insert order dan kurangi stok dalam satu transaksi (`READ COMMITTED` cukup karena kebenaran dijaga conditional update) | Selesai |
| Idempotency keys | Header `Idempotency-Key` wajib, klaim atomik `SET NX`, respons lama diputar ulang | Selesai |
| Connection pooling | Satu `pg.Pool` untuk seluruh proses, timeout koneksi dan query | Selesai |
| Caching & TTL | Cache-aside untuk jadwal sale dan produk, *single-flight* mencegah cache stampede, invalidasi berbasis versi | Selesai |
| Message queues | BullMQ (berbasis Redis), worker terpisah, job idempoten | Selesai (Kafka tidak dipakai, lihat keputusan desain) |
| Rate limiting | Token bucket berbasis Lua di Redis: per user (pembelian) dan per IP (login) | Selesai |
| Auth | JWT access token, password di-hash dengan bcrypt, role admin/user | Sebagian: belum ada refresh token dan OAuth2 |
| Pagination | Cursor (keyset) berpresisi mikrodetik, bukan `OFFSET` | Selesai |
| Timeouts & retries | Backoff eksponensial dengan jitter, retry koneksi saat startup, timeout di pool, Redis, dan server HTTP | Selesai |
| Logs, metrics, traces | Log JSON terstruktur (pino), metrik Prometheus di `/metrics`, `X-Request-Id` yang terbawa dari API sampai worker | Sebagian: korelasi id, bukan distributed tracing penuh |
| Docker | Dockerfile bertahap, user non-root, Compose dengan healthcheck | Selesai |

## Struktur folder

```
backend/
├── migrations/        # skema SQL, dijalankan berurutan
├── loadtest/          # skenario beban (rush.js)
├── docs/              # screenshot dan catatan pengukuran
├── src/
│   ├── config/        # env, logger, koneksi Postgres dan Redis (+ Lua script)
│   ├── routes/        # definisi endpoint
│   ├── controllers/   # lapisan HTTP saja
│   ├── services/      # logika bisnis
│   ├── repositories/  # satu-satunya tempat SQL ditulis
│   ├── models/        # pemetaan baris database ke JSON API
│   ├── middleware/    # auth, validasi, rate limit, idempotency, error, logging, metrics
│   ├── validators/    # skema Joi
│   ├── jobs/          # antrean dan worker
│   ├── utils/         # backoff, retry, pagination, cache, jwt, metrics
│   ├── scripts/       # migrate, pembuat data load test, verifikasi
│   ├── app.js         # merakit Express (tanpa listen)
│   ├── server.js      # entry point API
│   └── worker.js      # entry point worker
└── tests/             # unit dan integrasi
```

Aturan dependensi: `routes -> controllers -> services -> repositories -> database`. Lapisan hanya memanggil lapisan di bawahnya.

## Menjalankan

### Seluruh stack dengan Docker

```bash
cp .env.example .env        # isi JWT_ACCESS_SECRET dengan string acak minimal 16 karakter
docker compose up --build
```

API: <http://localhost:3000> · kesiapan: <http://localhost:3000/ready> · metrik: <http://localhost:3000/metrics>

Menghentikan: `docker compose down` (data tetap ada) atau `docker compose down -v` (menghapus data).

### Development lokal

```bash
npm install
cp .env.example .env
docker compose -f docker-compose.dev.yml up -d     # hanya Postgres dan Redis
npm run migrate
npm run dev            # terminal 1: API
npm run dev:worker     # terminal 2: worker
```

## Mencoba alur lengkap

Setelah stack berjalan, database masih kosong. Langkah di bawah membuat admin, produk, flash sale, lalu satu
pembelian dari awal sampai selesai. Contohnya memakai **PowerShell** (Windows) terhadap `http://localhost:3000`.
Pengguna macOS atau Linux dapat memakai [`docs/requests.http`](docs/requests.http) dengan ekstensi REST Client.

### 1. Buat admin

Endpoint `register` hanya membuat pengguna biasa. Ini disengaja: tidak ada endpoint publik yang bisa membuat admin.
Admin pertama dinaikkan lewat database.

```powershell
$b = 'http://localhost:3000/api'

Invoke-RestMethod -Method Post -Uri "$b/auth/register" -ContentType 'application/json' -Body (@{ name='Admin'; email='admin@example.com'; password='password123' } | ConvertTo-Json) | Out-Null

docker compose exec postgres psql -U flashsale -d flashsale -c "UPDATE users SET role='admin' WHERE email='admin@example.com'"
```

Pada development lokal (hanya `docker-compose.dev.yml` yang menyala), tambahkan `-f docker-compose.dev.yml`
setelah `docker compose`.

### 2. Login sebagai admin, lalu buat produk dan flash sale

Role disimpan di dalam token saat login, jadi **login harus dilakukan setelah** role diubah menjadi admin.

```powershell
$login = Invoke-RestMethod -Method Post -Uri "$b/auth/login" -ContentType 'application/json' -Body (@{ email='admin@example.com'; password='password123' } | ConvertTo-Json)
$h = @{ Authorization = "Bearer $($login.data.accessToken)" }

$prod = Invoke-RestMethod -Method Post -Uri "$b/products" -Headers $h -ContentType 'application/json' -Body (@{ name='PS5 Flash'; priceCents=100000 } | ConvertTo-Json)

$sale = Invoke-RestMethod -Method Post -Uri "$b/sales" -Headers $h -ContentType 'application/json' -Body (@{
  productId = $prod.data.id; salePriceCents = 50000; totalStock = 20
  startsAt = (Get-Date).AddMinutes(-1).ToUniversalTime().ToString('o')
  endsAt   = (Get-Date).AddHours(1).ToUniversalTime().ToString('o')
} | ConvertTo-Json)

$saleId = $sale.data.id
$saleId
```

Sale ini sedang berjalan (mulai satu menit lalu, berakhir satu jam lagi) dengan stok 20. Ubah `totalStock` untuk skenario lain.
Access token berlaku 15 menit. Bila kedaluwarsa, jalankan ulang dua baris `$login` dan `$h`.

### 3. Beli sebagai pengguna biasa

```powershell
$buyer = Invoke-RestMethod -Method Post -Uri "$b/auth/register" -ContentType 'application/json' -Body (@{ name='Budi'; email='budi@example.com'; password='password123' } | ConvertTo-Json)
$hb = @{ Authorization = "Bearer $($buyer.data.accessToken)" }

# beli: header Idempotency-Key wajib. Balasan 202: pesanan diterima, belum tentu selesai.
$order = Invoke-RestMethod -Method Post -Uri "$b/sales/$saleId/orders" -Headers ($hb + @{ 'Idempotency-Key' = 'beli-pertama' })
$order.data                       # status: pending, beserta orderId

# beberapa detik kemudian, worker sudah menyimpan order ke database
Start-Sleep 2
(Invoke-RestMethod "$b/orders/$($order.data.orderId)" -Headers $hb).data      # status: confirmed
```

Coba juga kasus-kasus ini untuk melihat perlindungannya bekerja:

```powershell
# kunci yang sama: respons yang sama (orderId identik), tidak ada order baru
(Invoke-RestMethod -Method Post -Uri "$b/sales/$saleId/orders" -Headers ($hb + @{ 'Idempotency-Key' = 'beli-pertama' })).data

# kunci berbeda, pengguna yang sama: ditolak 409 "already purchased"
try { Invoke-RestMethod -Method Post -Uri "$b/sales/$saleId/orders" -Headers ($hb + @{ 'Idempotency-Key' = 'beli-kedua' }) } catch { $_.ErrorDetails.Message }

# tanpa Idempotency-Key: ditolak 400
try { Invoke-RestMethod -Method Post -Uri "$b/sales/$saleId/orders" -Headers $hb } catch { $_.ErrorDetails.Message }
```

### 4. Lihat metrik

```powershell
(Invoke-WebRequest http://localhost:3000/metrics -UseBasicParsing).Content -split "`n" |
  Select-String "flashsale_orders_total|orders_queue_jobs|cache_requests_total"
```

Untuk menyerbu sale ini dengan ribuan pembeli sekaligus, lihat bagian [Benchmark](#benchmark).

## Endpoint

| Method | Path | Auth | Keterangan |
|---|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | | Pembatas ketat per IP (anti brute force) |
| GET | `/api/auth/me` | user | Profil pengguna |
| GET | `/api/products`, `/api/products/:id` | | Cursor pagination: `?limit=&cursor=` |
| POST, PATCH | `/api/products`, `/api/products/:id` | admin | |
| POST | `/api/sales` | admin | Membuat sale dan menginisialisasi stok di Redis |
| GET | `/api/sales/:id` | | Detail sale dengan sisa stok dari database |
| POST | `/api/sales/:id/orders` | user | Header `Idempotency-Key` wajib. Balasan `202` |
| GET | `/api/orders/:id` | user | `status`: `pending`, `confirmed`, atau `failed` |
| GET | `/health`, `/ready`, `/metrics` | | Liveness, readiness (Postgres dan Redis), Prometheus |

Kode status pada pembelian: `202` diterima, `409` stok habis / sudah pernah membeli / sale belum mulai atau sudah selesai,
`429` terlalu banyak request (dengan header `Retry-After`), `400` tanpa `Idempotency-Key`, `401` tanpa token.

Contoh request ada di [`docs/requests.http`](docs/requests.http).

## Pengujian

```bash
npm test                    # unit test, tanpa dependensi eksternal
npm run test:integration    # butuh Postgres dan Redis: alur pembelian, idempotency, rate limit, cache, auth
```

Tes integrasi yang paling penting: **100 pembeli serentak memperebutkan 20 stok, hasilnya harus persis 20 order**,
tanpa pembeli ganda dan dengan `remaining_stock` = 0. Hasil terakhir: **[ISI: jumlah tes lolos dari output Jest Anda]**.

Saya juga memverifikasi bahwa tes memang bisa gagal: dengan sengaja menghapus reservasi stok dari kode, tes serbuan
dan tes pembeli ganda gagal seperti seharusnya.

## Benchmark

Metode: satu percobaan pembelian per user dari satu mesin ke stack Docker Compose, pada sale baru untuk setiap
pengulangan, lalu `npm run verify:sale` memeriksa konsistensi (stok, jumlah order, pembeli unik).

Sale baru dibuat dengan langkah 2 pada bagian [Mencoba alur lengkap](#mencoba-alur-lengkap), dengan `totalStock`
sesuai skenario (misalnya 100). Skrip beban mengakses database langsung untuk membuat user, sehingga pada stack Docker
Compose ia diarahkan ke port Postgres yang dibuka (5434).

PowerShell:

```powershell
$env:DATABASE_URL = 'postgres://flashsale:flashsale@localhost:5434/flashsale'
npm run load:users -- 2000                      # membuat 2000 user dan loadtest/tokens.json
$env:CONCURRENCY = 200; $env:LABEL = '2000 user, stok 100'
node loadtest/rush.js <sale-id>
Start-Sleep 5                                   # beri waktu worker menghabiskan antrean
npm run verify:sale -- <sale-id>
Remove-Item Env:DATABASE_URL
```

bash (macOS/Linux):

```bash
export DATABASE_URL=postgres://flashsale:flashsale@localhost:5434/flashsale
npm run load:users -- 2000
CONCURRENCY=200 LABEL="2000 user, stok 100" node loadtest/rush.js <sale-id>
sleep 5
npm run verify:sale -- <sale-id>
unset DATABASE_URL
```

Token hasil `load:users` berlaku 15 menit. Jalankan ulang perintah itu bila tokennya sudah kedaluwarsa.

**Lingkungan pengukuran:** **[ISI: CPU, RAM, sistem operasi, versi Docker, jumlah CPU dan RAM yang dialokasikan ke Docker Desktop]**

Hasil (median dari 3 kali percobaan, setiap kali pada sale baru):

| Skenario | Request | 202 | 409 | 429 | p50 | p95 | p99 | req/detik |
|---|---|---|---|---|---|---|---|---|
| **[ISI: tempel baris dari output rush.js]** | | | | | | | | |

Konsistensi setelah tiap percobaan (`verify:sale`): **[ISI: contoh, "OK pada 3 dari 3 percobaan, 0 oversell"]**.

Pengaruh cache pada jadwal sale: **[ISI: hasil pembacaan tabel `flash_sales` sebelum dan sesudah cache, atau rasio hit dari `cache_requests_total`]**.

> Angka dari satu laptop bukan angka production. Nilai utamanya adalah perbandingan antar versi di mesin yang sama
> dan bukti bahwa tidak ada oversell, bukan throughput absolut.

## Keputusan desain

- **Redis di depan, PostgreSQL sebagai sumber kebenaran.** Redis menyaring lonjakan request. Angka yang final dan
  tahan lama tetap ada di database.
- **Pembelian asinkron lewat antrean.** Lonjakan request tidak langsung menjadi lonjakan transaksi database. Konsekuensinya
  klien menerima `202` dan harus mengecek status di `GET /orders/:id`.
- **Stok tidak pernah di-cache untuk pengambilan keputusan.** Yang di-cache hanya data yang jarang berubah (jadwal,
  harga, produk), dengan TTL pendek. Perubahan jadwal sale butuh sampai 60 detik untuk berlaku.
- **`READ COMMITTED` sudah cukup.** Kebenaran dijaga oleh conditional atomic update dan constraint, bukan oleh isolation
  level yang lebih tinggi.
- **Rate limiter fail-open, idempotency fail-closed.** Bila Redis bermasalah, request umum tetap dilayani (menolak semua
  pembeli karena pembatas laju bermasalah lebih merugikan). Tetapi pembelian ditolak, karena tanpa pengecekan kunci
  idempotensi, respons bisa tidak konsisten.
- **BullMQ, bukan Kafka.** Kebutuhan di sini adalah antrean tugas dengan retry, backoff, dan status per job, yang sudah
  tersedia di BullMQ tanpa infrastruktur tambahan. Kafka lebih cocok sebagai jalur event untuk banyak konsumen.
- **Cursor pagination, bukan `OFFSET`.** Kecepatan konstan di halaman berapa pun, dan tidak ada baris terlewat atau dobel
  saat data bertambah.
- **Harga disimpan sebagai integer (`price_cents`) dan disalin ke order** (*snapshot*), sehingga perubahan harga atau
  sale di kemudian hari tidak mengubah riwayat pembelian.
- **Tanpa ORM.** SQL ditulis langsung agar index, locking, dan transaksi terlihat jelas.

## Batasan yang diketahui

Daftar ini jujur dan sengaja saya tulis:

- **Reservasi di Redis dan data di database bisa tidak sinkron** bila job hilang di antara keduanya (misalnya Redis
  di-reset saat masih ada job menunggu). Saya mengalaminya sendiri saat pengujian. Mitigasi saat ini: stok di Redis
  diisi ulang dari database bila kuncinya hilang, dan Redis dijalankan dengan `appendonly` di Docker Compose.
  Penyelesaian yang benar adalah pekerjaan rekonsiliasi berkala yang membandingkan keduanya.
- Status `failed` hanya disimpan 24 jam di Redis (sesuai pengaturan retensi job), tidak di database.
- Belum ada batas waktu reservasi untuk skenario pembayaran (stok ditahan lalu dilepas bila tidak dibayar).
- Belum ada refresh token dan OAuth2.
- Metrik worker belum terekspos (hanya API).
- Satu instance Redis adalah titik kegagalan tunggal.

## Pengembangan lanjutan

Pekerjaan rekonsiliasi Redis dan database, penyimpanan status order yang gagal di database, refresh token,
endpoint metrik di worker, dead-letter queue dan dashboard antrean, OpenTelemetry untuk tracing penuh, event
`order.confirmed` ke Kafka untuk konsumen lain (notifikasi, analitik), dan CI di GitHub Actions.

## Yang saya pelajari

**[ISI dengan kata-kata Anda sendiri, 3 sampai 5 kalimat. Contoh arah: bagaimana rasanya melihat 201 order untuk
stok 10, kenapa keputusan harus dipindahkan ke database, apa yang mengejutkan dari antrean dan retry.]**
