/**
 * Registry metrik Prometheus.
 *
 * TODO:
 *  - collectDefaultMetrics
 *  - Histogram durasi HTTP
 *  - Counter hasil percobaan pembelian (accepted, sold_out, duplicate, ...)
 */

const client = require('prom-client');
const { getOrderQueue } = require('../jobs/queue');

const register = new client.Registry();
client.collectDefaultMetrics({ register }); // CPU, memori, event loop lag, dll

// Histogram: berapa lama request, dikelompokkan per rute dan status
const httpDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Durasi request HTTP',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

// Counter: hanya naik. Hasil setiap percobaan pembelian.
const ordersTotal = new client.Counter({
  name: 'flashsale_orders_total',
  help: 'Hasil percobaan pembelian flash sale',
  labelNames: ['result'], // accepted | sold_out | duplicate | not_started | ended
  registers: [register],
});

// Gauge: nilai yang naik-turun. Dibaca langsung dari BullMQ setiap kali /metrics diakses.
new client.Gauge({
  name: 'orders_queue_jobs',
  help: 'Jumlah job di antrean per status',
  labelNames: ['state'],
  registers: [register],
  async collect() {
    try {
      const counts = await getOrderQueue().getJobCounts('wait', 'active', 'delayed', 'failed');
      for (const [state, n] of Object.entries(counts)) this.set({ state }, n);
    } catch {
      /* Redis bermasalah: lewati, jangan sampai /metrics ikut error */
    }
  },
});

module.exports = { register, httpDuration, ordersTotal };