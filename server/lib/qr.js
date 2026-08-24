// ============================================================
// QR — Geração de QR Code (PNG e PDF).
// ============================================================
const QRCode = require("qrcode");
const { buildQrPdf } = require("./pdf");

function toModules2D(text) {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const bit = qr.modules;
  const n = bit.size;
  const m2 = [];
  if (bit.data && typeof bit.data.length === "number" && bit.data.length >= n * n) {
    for (let y = 0; y < n; y++) {
      const row = [];
      for (let x = 0; x < n; x++) {
        row.push(!!bit.data[y * n + x]);
      }
      m2.push(row);
    }
  }
  return { modules: m2, moduleCount: n };
}

async function qrPngBuffer(text, size = 400) {
  return QRCode.toBuffer(text, {
    errorCorrectionLevel: "M",
    width: size,
    margin: 2,
  });
}

function qrPdfBuffer({ nome, url, text }) {
  const { modules, moduleCount } = toModules2D(text);
  return buildQrPdf({ nome, url, modules, moduleCount });
}

module.exports = { qrPngBuffer, qrPdfBuffer, toModules2D };