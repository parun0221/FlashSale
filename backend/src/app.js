/**
 * Merakit aplikasi Express (TANPA app.listen).
 *
 * Dipisah dari server.js agar bisa dites dengan supertest tanpa membuka port.
 *
 * TODO:
 *  - Pasang middleware global dengan urutan: requestLogger, metrics, helmet, cors, express.json({ limit })
 *  - Mount system routes (/health, /ready, /metrics) di root
 *  - Mount routes API di /api (pasang rate limiter per IP sebelum routes)
 *  - Pasang notFound dan errorHandler paling akhir
 *  - module.exports = app
 */

const express = require('express');
const cors = require('cors');

const app = express();

const { notFound, errorHandler } = require('./middleware/error.middleware');

const requestLogger = require('./middleware/requestLogger.middleware');
const metricsMiddleware = require('./middleware/metrics.middleware');

app.use(requestLogger);
app.use(metricsMiddleware);
// ... route dan error handler seperti sebelumnya

app.use(cors());
app.use(express.json());


app.use('/', require('./routes/system.routes'));
app.use('/api', require('./routes'));

app.use(notFound);
app.use(errorHandler); 

// app.get("/", (req, res) => {
//   res.json({
//     success: true,
//     message: "Flash Sale API is running",
//   });
// });

module.exports = app;