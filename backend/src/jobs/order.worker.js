/**
 * Worker (consumer) pemroses order.
 *
 * TODO:
 *  - processor: panggil orderService.persistOrder; bila hasil bukan confirmed, lepas reservasi Redis
 *  - concurrency dari config
 *  - Backoff kustom dengan jitter
 *  - Event 'failed': bila percobaan habis, panggil markOrderFailed
 *  - Log dengan jobId + requestId
 */
