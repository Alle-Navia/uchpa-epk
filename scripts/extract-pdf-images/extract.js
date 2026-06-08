/* Extrae todas las imágenes embebidas (XObject Image) de un PDF.
   Uso: node extract.js <pdfPath> <outDir>
   Soporta JPEG (DCTDecode), JPEG2000 (JPXDecode) y FlateDecode (PNG-like). */

const fs = require('fs');
const path = require('path');
const { PDFDocument, PDFRawStream, PDFName, PDFArray } = require('pdf-lib');
const zlib = require('zlib');

async function main() {
  const pdfPath = process.argv[2];
  const outDir = process.argv[3] || 'extracted';
  if (!pdfPath) {
    console.error('Uso: node extract.js <pdfPath> <outDir>');
    process.exit(1);
  }
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const pdfBytes = fs.readFileSync(pdfPath);
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

  let count = 0;
  for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;

    const dict = obj.dict;
    const subtypeRaw = dict.get(PDFName.of('Subtype'));
    if (!subtypeRaw) continue;
    const subtype = subtypeRaw.toString();
    if (subtype !== '/Image') continue;

    const widthRaw = dict.get(PDFName.of('Width'));
    const heightRaw = dict.get(PDFName.of('Height'));
    const width  = widthRaw  ? widthRaw.numberValue  : 0;
    const height = heightRaw ? heightRaw.numberValue : 0;

    let filterRaw = dict.get(PDFName.of('Filter'));
    let filters = [];
    if (filterRaw) {
      if (filterRaw instanceof PDFArray) {
        filters = filterRaw.array.map(f => f.toString());
      } else {
        filters = [filterRaw.toString()];
      }
    }

    let ext = 'bin';
    let bytes = obj.contents;
    if (filters.includes('/DCTDecode')) {
      ext = 'jpg';
    } else if (filters.includes('/JPXDecode')) {
      ext = 'jp2';
    } else if (filters.includes('/FlateDecode')) {
      // FlateDecode contains raw pixel data; we save the raw bytes for inspection
      // but most readers won't open it directly. Attempt inflate for size info.
      try {
        bytes = zlib.inflateSync(obj.contents);
        ext = 'raw';
      } catch (e) {
        ext = 'flate';
      }
    }

    const idxLabel = String(count).padStart(3, '0');
    const filename = `img_${idxLabel}_${width}x${height}.${ext}`;
    fs.writeFileSync(path.join(outDir, filename), bytes);
    console.log(`#${idxLabel}  ${width}x${height}  filters=[${filters.join(', ')}]  bytes=${bytes.length}  -> ${filename}`);
    count++;
  }

  console.log(`\nTotal imágenes extraídas: ${count}`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
