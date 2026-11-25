// Pemakaian: node loadtest/double-click.js <saleId>
// Memakai tokens[1] karena tokens[0] sudah membeli di sale yang sama pada uji sebelumnya.
// Ganti ke sale baru bila ingin memakai user lain.
const tokens = require('./tokens.json');
const saleId = process.argv[2];
const key = `double-click-${Date.now()}`;

const send = () =>
  fetch(`http://localhost:3000/api/sales/${saleId}/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokens[1]}`, 'Idempotency-Key': key },
  }).then(async (r) => {
    const body = await r.json();
    return {
      status: r.status,
      replay: r.headers.get('idempotent-replay'),
      orderId: body.data?.id,
      message: body.message,
    };
  });

(async () => {
  console.log('Ronde 1: lima request serentak');
  console.table(await Promise.all(Array.from({ length: 5 }, send)));

  await new Promise((r) => setTimeout(r, 500)); // beri waktu request pertama selesai

  console.log('Ronde 2: lima request lagi dengan kunci yang sama');
  console.table(await Promise.all(Array.from({ length: 5 }, send)));
})();