// ============================================================
// PDF — Geração de PDF padrão (PDF 1.4) sem dependências externas.
// Embute o QR Code como imagem RGB + FlateDecode (zlib nativo).
// ============================================================
const zlib = require("zlib");

function escapePdf(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[\r\n]/g, " ");
}

// Converte a matriz do QR (de `qrcode`) em buffer RGB.
// moduleCount por `cell` px, com quiet zone (`quiet` módulos).
function qrToRgbBuffer(modules, moduleCount, cell, quiet) {
  const q = quiet;
  const sizePx = (moduleCount + q * 2) * cell;
  const buf = Buffer.alloc(sizePx * sizePx * 3, 255);
  for (let y = 0; y < moduleCount; y++) {
    for (let x = 0; x < moduleCount; x++) {
      if (!modules[y][x]) continue;
      for (let py = 0; py < cell; py++) {
        for (let px = 0; px < cell; px++) {
          const X = (x + q) * cell + px;
          const Y = (y + q) * cell + py;
          const off = (Y * sizePx + X) * 3;
          buf[off] = 0; buf[off + 1] = 0; buf[off + 2] = 0;
        }
      }
    }
  }
  return { buf, sizePx };
}

function buildQrPdf({ nome, url, modules, moduleCount }) {
  const cell = 12;
  const quiet = 4;
  const { buf, sizePx } = qrToRgbBuffer(modules, moduleCount, cell, quiet);
  const imageStream = zlib.deflateSync(buf);

  const title = escapePdf(nome || "CardápioGo");
  const subtitle = escapePdf(url || "");

  const qrSize = 360; // pontos
  const qrX = (595 - qrSize) / 2;
  const qrY = 300;

  const text =
    "BT /F1 28 Tf 297 700 Td (" + title + ") Tj ET\n" +
    "BT /F1 13 Tf 297 46 Td (" + subtitle + ") Tj ET\n" +
    "q " + qrSize + " 0 0 " + qrSize + " " + qrX + " " + qrY + " cm /Im0 Do Q\n";

  // Objetos PDF
  const objects = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");                                          // 1
  objects.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");                                  // 2
  objects.push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842]" +                        // 3
    " /Resources << /XObject << /Im0 5 0 R >> /Font << /F1 6 0 R >> >> /Contents 4 0 R >>");
  const textStream = Buffer.from(text, "latin1");
  objects.push("<< /Length " + textStream.length + " >>\nstream\n" + text + "endstream");     // 4
  // 5 = imagem (stream binária, tratada à parte)
  objects.push("<< /Type /XObject /Subtype /Image /Width " + sizePx + " /Height " + sizePx +
    " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length " + imageStream.length + " >>\nstream\n");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");                     // 6

  let pdfBuf = Buffer.from("%PDF-1.4\n", "latin1");
  const offsets = [];
  for (let i = 0; i < objects.length; i++) {
    const num = i + 1;
    offsets.push(pdfBuf.length);
    pdfBuf = Buffer.concat([pdfBuf, Buffer.from(num + " 0 obj\n", "latin1")]);
    if (num === 5) {
      pdfBuf = Buffer.concat([pdfBuf, Buffer.from(objects[4], "latin1"), imageStream, Buffer.from("\nendstream\n", "latin1")]);
    } else {
      pdfBuf = Buffer.concat([pdfBuf, Buffer.from(objects[i] + "\n", "latin1")]);
    }
    pdfBuf = Buffer.concat([pdfBuf, Buffer.from("endobj\n", "latin1")]);
  }

  const xrefPos = pdfBuf.length;
  let xref = "xref\n0 " + (objects.length + 1) + "\n0000000000 65535 f \n";
  for (const o of offsets) xref += String(o).padStart(10, "0") + " 00000 n \n";
  pdfBuf = Buffer.concat([
    pdfBuf,
    Buffer.from(xref + "trailer\n<< /Size " + (objects.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xrefPos + "\n%%EOF\n", "latin1"),
  ]);
  return pdfBuf;
}

module.exports = { buildQrPdf, qrToRgbBuffer };