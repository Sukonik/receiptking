import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import { Button, Checkbox, ConfigProvider, DatePicker, Input, message, Progress, theme as antTheme } from "antd";
import {
  CameraOutlined, CheckOutlined, CloseOutlined, DeleteOutlined, FileExcelOutlined,
  FileDoneOutlined, FileImageOutlined, FilePdfOutlined, FileTextOutlined, FolderOpenOutlined, LockOutlined, PlusOutlined,
  PrinterOutlined, SafetyCertificateOutlined, SettingOutlined, WarningOutlined
} from "@ant-design/icons";
import dayjs from "dayjs";

const APP_VERSION = "1.3";
// The header and hero are static HTML (see index.html) so the first paint never waits for React. React owns the header's controls.
const topSlot = document.getElementById("top-slot");
topSlot.textContent = "";
const STORAGE_KEY = "receiptking-v1";
const STORAGE_SCHEMA = 2;
const UI_STORAGE_KEY = "receiptking-ui";
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const LOW_RES_EDGE = 600;

/* ---------- Lazy-loaded task libraries (nothing here loads at startup) ---------- */
const LIBS = {
  tesseract: "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js",
  xlsx: "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
  jspdf: "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js",
  autotable: "https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js"
};
const PDFJS_BASE = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/";
const libPromises = {};

function loadScript(key, test) {
  if (test()) return Promise.resolve();
  if (!libPromises[key]) {
    libPromises[key] = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = LIBS[key];
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        delete libPromises[key];
        script.remove();
        reject(new Error(`Could not download the ${key} tools. Check your connection and try again.`));
      };
      document.head.appendChild(script);
    });
  }
  return libPromises[key];
}
const loadTesseract = () => loadScript("tesseract", () => window.Tesseract);
const loadXlsx = () => loadScript("xlsx", () => window.XLSX);
async function loadPdfLib() {
  await loadScript("jspdf", () => window.jspdf?.jsPDF);
  await loadScript("autotable", () => window.jspdf?.jsPDF?.API?.autoTable);
}
let pdfjsPromise;
function loadPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import(`${PDFJS_BASE}pdf.min.mjs`).then(pdfjs => {
      pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}pdf.worker.min.mjs`;
      return pdfjs;
    }).catch(error => { pdfjsPromise = undefined; throw error; });
  }
  return pdfjsPromise;
}

/* ---------- Themes and appearance ---------- */
const emperorThemes = [
  { id: "emperor-tamarin", name: "Emperor Tamarin", primary: "#163F36", accent: "#D7F06B", bg: "#F6F7F2", surface: "#FFFFFF", text: "#18332B", darkBg: "#0D1F1A", darkSurface: "#172F28", darkText: "#EAF5ED" },
  { id: "squirrel-monkey", name: "Squirrel Monkey", primary: "#A95227", accent: "#F1B566", bg: "#FFF8F0", surface: "#FFFFFF", text: "#392414", darkBg: "#21160F", darkSurface: "#332216", darkText: "#F8E5C6" },
  { id: "capuchin-monkey", name: "Capuchin Monkey", primary: "#69503A", accent: "#D8AD79", bg: "#FAF5EC", surface: "#FFFFFF", text: "#30281F", darkBg: "#1E1A16", darkSurface: "#302820", darkText: "#F3E4CE" },
  { id: "three-toed-sloth", name: "Three-Toed Sloth", primary: "#506D58", accent: "#A9C39B", bg: "#F4F8F1", surface: "#FFFFFF", text: "#26372B", darkBg: "#18251D", darkSurface: "#25362B", darkText: "#E8F3E2" },
  { id: "toco-toucan", name: "Toco Toucan", primary: "#234F5C", accent: "#EAAE20", bg: "#F2F8F8", surface: "#FFFFFF", text: "#18363E", darkBg: "#101F25", darkSurface: "#1C3138", darkText: "#F9E8A5" },
  { id: "green-anaconda", name: "Green Anaconda", primary: "#176F61", accent: "#A4CC74", bg: "#F1F8F3", surface: "#FFFFFF", text: "#143C34", darkBg: "#0C2521", darkSurface: "#163A32", darkText: "#E2F2D6" },
  { id: "jaguar", name: "Jaguar", primary: "#86501E", accent: "#DDA94F", bg: "#FCF7EF", surface: "#FFFFFF", text: "#392711", darkBg: "#211B12", darkSurface: "#342719", darkText: "#F8E9CA" },
  { id: "capybara", name: "Capybara", primary: "#795B48", accent: "#C7A27C", bg: "#FAF5EE", surface: "#FFFFFF", text: "#35291F", darkBg: "#241D18", darkSurface: "#352A22", darkText: "#F2E5D6" }
];

const jungleIcons = [
  { name: "HackBerry", note: "Default app icon", file: "hackberry" },
  { name: "Sapote", note: "Warm woodland", file: "sapote" },
  { name: "GroundCherry", note: "Golden canopy", file: "groundcherry" },
  { name: "Fig", note: "Deep fruit grove", file: "fig" },
  { name: "TreeGrape", note: "Purple rainforest", file: "treegrape" },
  { name: "IceCreamBean", note: "Fresh green canopy", file: "icecreambean" }
];

function loadAppearance() {
  try {
    const saved = JSON.parse(localStorage.getItem(UI_STORAGE_KEY));
    return {
      theme: emperorThemes.some(item => item.id === saved?.theme) ? saved.theme : "emperor-tamarin",
      mode: ["light", "dark", "auto"].includes(saved?.mode) ? saved.mode : "auto",
      icon: jungleIcons.some(item => item.file === saved?.icon) ? saved.icon : "hackberry"
    };
  } catch (_) {
    return { theme: "emperor-tamarin", mode: "auto", icon: "hackberry" };
  }
}

/* ---------- Data helpers ---------- */
const today = dayjs();
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`);
const blankRow = () => ({ id: uid(), budgetCode: "", amount: "", reason: "", source: "Manual entry", ocr: false, note: "", fileKey: "" });
const hasContent = row => Boolean(row.budgetCode || row.amount || row.reason || row.fileKey);
const monthLabel = key => dayjs(`${key}-01`).format("MMMM YYYY");
const money = value => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function normalizeMoney(value) {
  const numeric = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function escapeCsv(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function defaultForm() {
  return {
    department: "Corporation Counsel",
    monthKey: today.format("YYYY-MM"),
    reportDate: today.format("YYYY-MM-DD"),
    signature: "",
    signatureDate: today.format("YYYY-MM-DD")
  };
}

// Schema 1 (v1.0 to v1.2) stored { form: { month: "November 2026" }, rows }. Schema 2 adds monthKey and OCR flags.
function loadDraft() {
  const fallback = { form: defaultForm(), rows: [blankRow()], restored: false };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== "object") return fallback;
    const form = { ...defaultForm(), ...(saved.form || {}) };
    if (!/^\d{4}-\d{2}$/.test(form.monthKey || "")) {
      const parsed = saved.form?.month ? new Date(`${saved.form.month} 1`) : null;
      form.monthKey = parsed && !Number.isNaN(parsed.getTime()) ? dayjs(parsed).format("YYYY-MM") : today.format("YYYY-MM");
    }
    delete form.month;
    const rows = (Array.isArray(saved.rows) ? saved.rows : []).map(row => ({ ...blankRow(), ...row, id: row.id || uid() }));
    return { form, rows: rows.length ? rows : [blankRow()], restored: rows.some(hasContent) };
  } catch (_) {
    return fallback;
  }
}

function extractReceiptFields(text, filename) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const totalCandidates = [];
  lines.forEach((line, index) => {
    // Letter-spaced or split words ("G RAND TOTAL") still match once spaces are removed.
    const squashed = line.replace(/[^a-z]/gi, "").toLowerCase();
    const matches = line.match(/(?:\$\s*)?(\d{1,5}(?:,\d{3})*\s?\.\s?\d{2})(?!\d)/g) || [];
    matches.forEach(raw => {
      const value = normalizeMoney(raw.replace(/\s/g, ""));
      if (!(value > 0)) return;
      const score = (/grandtotal|amountdue|balancedue|totaldue|invoicetotal|ordertotal|total/.test(squashed) ? 10 : 0)
        + (/grandtotal|amountpaid/.test(squashed) ? 2 : 0)
        - (/subtotal|tax|change|saving|tip|cash|tender|roomservices|assessment/.test(squashed) ? 7 : 0)
        + value / 100000
        + index / 10000;
      totalCandidates.push({ value, score });
    });
  });
  totalCandidates.sort((a, b) => b.score - a.score || b.value - a.value);

  // A stated purpose beats a guessed vendor.
  const purposeLine = lines.find(line => /purpose\s*[:\-]?\s*\S/i.test(line));
  const purpose = purposeLine ? purposeLine.replace(/^.*?(business\s+)?purpose\s*[:\-]?\s*/i, "").replace(/\s*[-–]\s*sample\s*$/i, "").trim() : "";

  const skip = /receipt|invoice|date|time|cashier|order|transaction|welcome|thank|tel\b|phone|www\.|http|folio|guest|issued|sample|test|fictional|room|arrival|departure|page|statement|account|card|visa|authorization/i;
  const eligible = lines.filter(line => line.length >= 3 && line.length <= 48 && /[a-z]{3}/i.test(line) && !skip.test(line));
  const businessLine = eligible.find(line => /\b(hotel|inn|cafe|caf\u00e9|market|store|inc|llc|co|corp|restaurant|supply|supplies|hardware|pharmacy|depot|shop|grill|airlines?|taxi|parking|center)\b/i.test(line));
  const vendor = (businessLine || eligible[0] || filename.replace(/\.[^.]+$/, "")).replace(/\s+/g, " ");
  const titled = vendor === vendor.toUpperCase() ? vendor.toLowerCase().replace(/\b[a-z]/g, letter => letter.toUpperCase()) : vendor;

  return {
    amount: totalCandidates[0] ? totalCandidates[0].value.toFixed(2) : "",
    reason: purpose.length >= 6 ? purpose.charAt(0).toUpperCase() + purpose.slice(1) : `Purchase from ${titled}`
  };
}

/* ---------- Receipt intake: images and PDFs to an OCR-ready canvas ---------- */
const isPdf = file => file.type === "application/pdf" || /\.pdf$/i.test(file.name);
const isAccepted = file => /^image\/(png|jpe?g|webp|gif|bmp)/.test(file.type) || /\.(png|jpe?g|webp|gif|bmp|pdf)$/i.test(file.name) || isPdf(file);
const fileKeyOf = file => `${file.name}|${file.size}|${file.lastModified}`;

async function decodeImage(file) {
  if (window.createImageBitmap) {
    try { return await createImageBitmap(file); } catch (_) { /* fall back to <img> */ }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("unsupported-image")); };
    image.src = url;
  });
}

function drawToCanvas(source, width, height, { rotate = 0, filter = "" } = {}) {
  const canvas = document.createElement("canvas");
  const swap = rotate % 180 !== 0;
  canvas.width = swap ? height : width;
  canvas.height = swap ? width : height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (filter) ctx.filter = filter;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rotate * Math.PI / 180);
  ctx.drawImage(source, -width / 2, -height / 2, width, height);
  return canvas;
}

function makeImage(source, width, height, maxEdge, quality) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  return { url: drawToCanvas(source, w, h).toDataURL("image/jpeg", quality), w, h };
}

async function pdfPageText(page) {
  const content = await page.getTextContent();
  const lines = new Map();
  content.items.forEach(item => {
    if (!item.str?.trim()) return;
    const y = Math.round(item.transform[5] / 3);
    if (!lines.has(y)) lines.set(y, []);
    lines.get(y).push({ x: item.transform[4], text: item.str });
  });
  return [...lines.entries()].sort((a, b) => b[0] - a[0])
    .map(([, parts]) => parts.sort((a, b) => a.x - b.x).map(part => part.text).join(" ")).join("\n");
}

async function prepareReceipt(file) {
  if (isPdf(file)) {
    const pdfjs = await loadPdfJs();
    let pdf;
    try {
      pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    } catch (error) {
      if (error?.name === "PasswordException") throw new Error("This PDF is password protected. Remove the password, or enter the purchase manually.");
      throw new Error("This PDF could not be opened. It may be damaged. Enter the purchase manually.");
    }
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(2600 / Math.max(base.width, base.height), 1800 / base.width * 1.4);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    const text = await pdfPageText(page).catch(() => "");
    pdf.destroy?.();
    return {
      canvas, text: /\d+\.\d{2}/.test(text) && text.length > 30 ? text : "",
      full: makeImage(canvas, canvas.width, canvas.height, 2200, 0.9), thumb: makeImage(canvas, canvas.width, canvas.height, 220, 0.72),
      width: canvas.width, height: canvas.height
    };
  }

  let bitmap;
  try {
    bitmap = await decodeImage(file);
  } catch (_) {
    throw new Error("This image format is not supported by your browser. Use a JPG or PNG, or take the photo with the camera button.");
  }
  const width = bitmap.naturalWidth || bitmap.width;
  const height = bitmap.naturalHeight || bitmap.height;
  if (!width || !height) throw new Error("This image appears to be empty.");
  const longest = Math.max(width, height);
  const scale = longest > 2600 ? 2600 / longest : longest < 2400 ? Math.min(3, 2400 / longest) : 1;
  const canvas = drawToCanvas(bitmap, Math.round(width * scale), Math.round(height * scale), { filter: "grayscale(1) contrast(1.2)" });
  const full = makeImage(bitmap, width, height, 2200, 0.9);
  const thumb = makeImage(bitmap, width, height, 220, 0.72);
  bitmap.close?.();
  return { canvas, text: "", full, thumb, width, height };
}

/* ---------- Receipt Inbox storage (IndexedDB, this browser only) ---------- */
const DB_NAME = "receiptking-inbox";
const DB_STORE = "receipts";
let dbPromise;
function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error("IndexedDB unavailable")); return; }
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(DB_STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    dbPromise.catch(() => {});
  }
  return dbPromise;
}
async function dbRun(mode, run) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = run(db.transaction(DB_STORE, mode).objectStore(DB_STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
const dbPut = (id, value) => dbRun("readwrite", store => store.put(value, id)).catch(() => {});
const dbDelete = id => dbRun("readwrite", store => store.delete(id)).catch(() => {});
const dbGet = id => dbRun("readonly", store => store.get(id)).catch(() => undefined);
const dbKeys = () => dbRun("readonly", store => store.getAllKeys()).catch(() => []);

/* ---------- Receipt file output: PNG conversion and a small store-only ZIP writer ---------- */
const safeName = text => String(text).replace(/\.[^.]+$/, "").replace(/[^a-z0-9._ -]+/gi, "-").replace(/\s+/g, "-").slice(0, 60) || "receipt";
const canvasToBlob = (canvas, type, quality) => new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Could not create the image.")), type, quality));
function loadImageElement(url) {
  return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error("Could not read the receipt image.")); image.src = url; });
}
async function receiptPngBlob(receipt) {
  if (receipt.file && receipt.type === "image/png") return receipt.file;
  let source = null;
  let width = 0;
  let height = 0;
  if (receipt.file && receipt.kind === "image") {
    try { source = await decodeImage(receipt.file); width = source.naturalWidth || source.width; height = source.naturalHeight || source.height; } catch (_) { source = null; }
  }
  if (!source) { source = await loadImageElement(receipt.full.url); width = source.naturalWidth; height = source.naturalHeight; }
  const scale = Math.min(1, 4096 / Math.max(width, height));
  const blob = await canvasToBlob(drawToCanvas(source, Math.round(width * scale), Math.round(height * scale)), "image/png");
  source.close?.();
  return blob;
}
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; }
  return table;
})();
function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function makeZip(files) {
  const encoder = new TextEncoder();
  const now = new Date();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const parts = [];
  const central = [];
  let offset = 0;
  files.forEach(file => {
    const name = encoder.encode(file.name);
    const crc = crc32(file.data);
    const size = file.data.length;
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true);
    local.setUint16(10, time, true); local.setUint16(12, date, true); local.setUint32(14, crc, true);
    local.setUint32(18, size, true); local.setUint32(22, size, true); local.setUint16(26, name.length, true);
    parts.push(new Uint8Array(local.buffer), name, file.data);
    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true); entry.setUint16(4, 20, true); entry.setUint16(6, 20, true); entry.setUint16(8, 0x0800, true);
    entry.setUint16(12, time, true); entry.setUint16(14, date, true); entry.setUint32(16, crc, true);
    entry.setUint32(20, size, true); entry.setUint32(24, size, true); entry.setUint16(28, name.length, true); entry.setUint32(42, offset, true);
    central.push(new Uint8Array(entry.buffer), name);
    offset += 30 + name.length + size;
  });
  const directorySize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, directorySize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: "application/zip" });
}

/* Remove long thin rules (table borders, underlines, strike-through bars) that cut through text and confuse OCR. */
function removeRules(source) {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, 0, 0);
  const { width: W, height: H } = canvas;
  const image = ctx.getImageData(0, 0, W, H);
  const px = image.data;
  const dark = (x, y) => px[(y * W + x) * 4] < 140;
  const clear = (x, y) => { const i = (y * W + x) * 4; px[i] = px[i + 1] = px[i + 2] = 255; };
  const thin = Math.max(3, Math.round(Math.max(W, H) / 400));
  const minRunX = Math.round(W * 0.12);
  const minRunY = Math.round(H * 0.08);
  for (let y = thin + 1; y < H - thin - 1; y += 1) {
    let x = 0;
    while (x < W) {
      if (!dark(x, y)) { x += 1; continue; }
      let end = x;
      while (end < W && dark(end, y)) end += 1;
      if (end - x >= minRunX) {
        const mid = (x + end) >> 1;
        const q1 = x + ((end - x) >> 2);
        const q3 = x + (((end - x) * 3) >> 2);
        const isThin = [mid, q1, q3].every(px0 => !dark(px0, y - thin - 1) || !dark(px0, y + thin + 1));
        if (isThin) for (let cx = x; cx < end; cx += 1) for (let dy = -1; dy <= 1; dy += 1) if (y + dy >= 0 && y + dy < H) clear(cx, y + dy);
      }
      x = end;
    }
  }
  for (let x = thin + 1; x < W - thin - 1; x += 1) {
    let y = 0;
    while (y < H) {
      if (!dark(x, y)) { y += 1; continue; }
      let end = y;
      while (end < H && dark(x, end)) end += 1;
      if (end - y >= minRunY) {
        const mid = (y + end) >> 1;
        if (!dark(x - thin - 1, mid) || !dark(x + thin + 1, mid)) for (let cy = y; cy < end; cy += 1) for (let dx = -1; dx <= 1; dx += 1) if (x + dx >= 0 && x + dx < W) clear(x + dx, cy);
      }
      y = end;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function makeCancelToken() {
  const token = { cancelled: false, worker: null };
  token.promise = new Promise((_, reject) => {
    token.cancel = () => {
      token.cancelled = true;
      token.worker?.terminate?.();
      reject(new Error("cancelled"));
    };
  });
  token.promise.catch(() => {});
  token.guard = promise => Promise.race([promise, token.promise]);
  return token;
}

/* ---------- Appearance dialog behavior: focus trap, focus return, scroll lock ---------- */
function useDialogBehavior(open, onClose, panelRef, returnRef) {
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.classList.add("scroll-locked");
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
    const focusables = () => [...(panelRef.current?.querySelectorAll("button:not([disabled]), [href], input, [tabindex]:not([tabindex='-1'])") || [])];
    focusables()[0]?.focus();

    const onKey = event => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      else if (!panelRef.current?.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("scroll-locked");
      document.body.style.paddingRight = "";
      (returnRef.current || previous)?.focus?.();
    };
  }, [open]);
}

function App() {
  const [appearance, setAppearance] = useState(loadAppearance);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.("(prefers-color-scheme: dark)").matches || false);
  const draft = useMemo(loadDraft, []);
  const [form, setForm] = useState(draft.form);
  const [rows, setRows] = useState(draft.rows);
  const [receipts, setReceipts] = useState({});
  const [deselected, setDeselected] = useState(() => new Set());
  const [printJob, setPrintJob] = useState({ kind: "", n: 0 });
  const [scan, setScan] = useState({ active: false, progress: 0, file: "", status: "", index: 0, total: 0 });
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState("");
  const [dragging, setDragging] = useState(false);
  const [viewer, setViewer] = useState(null);
  const viewerRef = useRef(null);
  useEffect(() => { if (viewer && viewerRef.current && !viewerRef.current.open) viewerRef.current.showModal(); }, [viewer]);

  const panelRef = useRef(null);
  const triggerRef = useRef(null);
  const rowsRef = useRef(rows);
  const scanTokenRef = useRef(null);
  const dragDepth = useRef(0);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  rowsRef.current = rows;

  const activeTheme = emperorThemes.find(item => item.id === appearance.theme) || emperorThemes[0];
  const activeIcon = jungleIcons.find(item => item.file === appearance.icon) || jungleIcons[0];
  const isDark = appearance.mode === "dark" || (appearance.mode === "auto" && systemDark);

  const closeAppearance = useCallback(() => setAppearanceOpen(false), []);
  useDialogBehavior(appearanceOpen, closeAppearance, panelRef, triggerRef);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return undefined;
    const onChange = event => setSystemDark(event.matches);
    media.addEventListener?.("change", onChange);
    return () => media.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = activeTheme.id;
    root.dataset.mode = isDark ? "dark" : "light";
    const paint = {
      "--ink": isDark ? activeTheme.darkText : activeTheme.text,
      "--forest": activeTheme.primary,
      "--forest-2": activeTheme.primary,
      "--lime": activeTheme.accent,
      "--cream": isDark ? activeTheme.darkBg : activeTheme.bg,
      "--paper": isDark ? activeTheme.darkSurface : activeTheme.surface,
      "--brand-text": isDark ? activeTheme.accent : activeTheme.primary,
      "--muted": isDark ? "#BDCBC5" : "#55615C",
      "--line": isDark ? "rgba(255,255,255,.18)" : "rgba(25,53,46,.16)",
      "--danger": isDark ? "#FF9C93" : "#B3261E"
    };
    Object.entries(paint).forEach(([name, value]) => root.style.setProperty(name, value));
    // The saved palette is replayed by a tiny script in index.html before first paint, so there is no theme flash.
    try { localStorage.setItem(UI_STORAGE_KEY, JSON.stringify({ ...appearance, paint, dark: isDark })); } catch (_) {}
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", isDark ? activeTheme.darkBg : activeTheme.primary);
    const iconBase = `assets/brand/icons/${activeIcon.file}/`;
    document.getElementById("favicon32")?.setAttribute("href", `${iconBase}favicon-32.png`);
    document.getElementById("appleIcon")?.setAttribute("href", `${iconBase}apple-touch-icon.png`);
  }, [appearance, activeTheme, activeIcon, isDark]);

  useEffect(() => {
    const seal = document.getElementById("heroSeal");
    if (seal) { seal.src = `assets/brand/jungle/${activeIcon.file}.webp`; seal.alt = `${activeIcon.name} jungle seal`; }
  }, [activeIcon]);

  useEffect(() => {
    document.getElementById("hero")?.classList.toggle("hero--compact", draft.restored);
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: STORAGE_SCHEMA, form, rows })); } catch (_) {}
  }, [form, rows]);

  // Restore saved receipt images for the lines in this draft, and drop images whose lines are gone.
  useEffect(() => {
    let alive = true;
    (async () => {
      const ids = new Set(draft.rows.map(row => row.id));
      const restored = {};
      for (const id of ids) {
        const record = await dbGet(id);
        if (record) restored[id] = record;
      }
      (await dbKeys()).forEach(key => { if (!ids.has(key)) dbDelete(key); });
      if (alive && Object.keys(restored).length) setReceipts(current => ({ ...restored, ...current }));
    })();
    return () => { alive = false; };
  }, []);

  const filled = useMemo(() => rows.filter(hasContent), [rows]);
  const total = useMemo(() => filled.reduce((sum, row) => sum + normalizeMoney(row.amount), 0), [filled]);

  /* Inline validation: shown beside fields once the user tries to export. */
  const validation = useMemo(() => {
    const rowErrors = {};
    let count = 0;
    filled.forEach(row => {
      const errors = {};
      if (!row.budgetCode.trim()) errors.budgetCode = "Enter the Budget Code";
      if (!(normalizeMoney(row.amount) > 0)) errors.amount = "Enter an amount";
      if (!row.reason.trim()) errors.reason = "Enter the reason for purchase";
      if (row.ocr) errors.ocr = "Confirm the OCR values";
      if (Object.keys(errors).length) { rowErrors[row.id] = errors; count += Object.keys(errors).length; }
    });
    const formErrors = {};
    if (!form.department.trim()) formErrors.department = "Enter the department";
    if (!form.signature.trim()) formErrors.signature = "Enter a signature or printed name";
    count += Object.keys(formErrors).length;
    const empty = filled.length === 0;
    return { rowErrors, formErrors, count, empty };
  }, [filled, form]);
  const show = showErrors ? validation : { rowErrors: {}, formErrors: {}, count: 0, empty: false };
  const inbox = useMemo(() => filled.map((row, index) => ({ row, line: index + 1, receipt: receipts[row.id] })).filter(item => item.receipt), [filled, receipts]);
  const chosen = inbox.filter(item => !deselected.has(item.row.id));

  function updateForm(field, value) { setForm(current => ({ ...current, [field]: value })); }
  function updateRow(id, field, value) { setRows(current => current.map(row => row.id === id ? { ...row, [field]: value } : row)); }
  function addRow() { setRows(current => [...current, blankRow()]); }
  function removeRow(id) {
    setRows(current => current.length === 1 ? [blankRow()] : current.filter(item => item.id !== id));
    setReceipts(current => { const next = { ...current }; delete next[id]; return next; });
    dbDelete(id);
  }

  /* ---------- Import queue ---------- */
  const processFiles = useCallback(async incoming => {
    const files = [...incoming];
    if (!files.length) return;
    if (scanTokenRef.current) { message.info("An import is already running. Cancel it or wait for it to finish."); return; }

    const queue = [];
    files.forEach(file => {
      if (!isAccepted(file)) message.error(`${file.name}: use a PDF, PNG, JPG, WebP, GIF, or BMP file.`);
      else if (file.size > MAX_FILE_BYTES) message.error(`${file.name} is larger than 25 MB. Use a smaller scan or photo.`);
      else if (file.size === 0) message.error(`${file.name} is empty.`);
      else queue.push(file);
    });
    if (!queue.length) return;

    const token = makeCancelToken();
    scanTokenRef.current = token;
    let worker = null;
    let imported = 0;
    let manual = 0;
    let lastId = null;
    const seen = new Set(rowsRef.current.map(row => row.fileKey).filter(Boolean));
    const setStatus = (patch) => setScan(current => ({ ...current, ...patch }));

    try {
      for (let index = 0; index < queue.length; index += 1) {
        const file = queue[index];
        const base = { active: true, file: file.name, index: index + 1, total: queue.length, progress: 3 };
        setStatus({ ...base, status: "Preparing receipt" });
        const key = fileKeyOf(file);
        const row = { ...blankRow(), source: file.name, fileKey: key };
        const notes = [];
        if (seen.has(key)) notes.push("Possible duplicate: this file was already imported.");
        seen.add(key);

        try {
          if (isPdf(file)) setStatus({ status: "Opening PDF" });
          const prepared = await token.guard(prepareReceipt(file));
          if (Math.min(prepared.width, prepared.height) < LOW_RES_EDGE) notes.push("Low resolution. Double-check the amount.");
          const record = { name: file.name, type: file.type, kind: isPdf(file) ? "pdf" : "image", file, full: prepared.full, thumb: prepared.thumb };
          setReceipts(current => ({ ...current, [row.id]: record }));
          dbPut(row.id, record);

          let text = prepared.text;
          if (!text) {
            setStatus({ status: "Loading text reader", progress: 6 });
            await token.guard(loadTesseract());
            if (!worker) {
              worker = await token.guard(Tesseract.createWorker("eng", 1, {
                logger: event => {
                  if (event.status === "recognizing text") setStatus({ progress: Math.max(8, Math.round(event.progress * 100)), status: "Reading receipt text" });
                  else if (/loading|initializ/.test(event.status)) setStatus({ status: "Preparing text reader" });
                }
              }));
              token.worker = worker;
            }
            const ocrCanvas = prepared.canvas;
            let result = await token.guard(worker.recognize(ocrCanvas));
            text = result.data.text;
            if (result.data.confidence < 45) {
              setStatus({ status: "Trying rotated views", progress: 50 });
              for (const rotate of [90, 270]) {
                const turned = drawToCanvas(ocrCanvas, ocrCanvas.width, ocrCanvas.height, { rotate });
                const attempt = await token.guard(worker.recognize(turned));
                if (attempt.data.confidence > result.data.confidence + 5) { result = attempt; text = attempt.data.text; }
              }
            }
            if (!extractReceiptFields(text, file.name).amount) {
              // Second pass for stylized or ruled layouts: strip table lines and strike-through bars, then read text blocks independently.
              setStatus({ status: "Taking a closer look", progress: 60 });
              await token.guard(worker.setParameters({ tessedit_pageseg_mode: "11" }));
              const sparse = await token.guard(worker.recognize(removeRules(ocrCanvas)));
              await token.guard(worker.setParameters({ tessedit_pageseg_mode: "3" }));
              text = `${text}\n${sparse.data.text}`;
            }
          } else {
            setStatus({ status: "Read PDF text", progress: 100 });
          }

          const extracted = extractReceiptFields(text, file.name);
          if (!extracted.amount) notes.push("No total found. Enter the amount from the receipt.");
          Object.assign(row, { amount: extracted.amount, reason: extracted.reason, ocr: Boolean(extracted.amount || extracted.reason) });
          if (!text.trim()) notes.push("No readable text. Enter the purchase manually.");
        } catch (error) {
          if (token.cancelled) throw error;
          console.warn("Receipt could not be read:", error);
          notes.push(error.message && !/^(Failed|Error)/.test(error.message) ? error.message : "Could not read this file. Enter the purchase manually.");
        }

        if (!row.amount) manual += 1;
        row.note = notes.join(" ");
        setRows(current => {
          const emptyIndex = current.findIndex(item => !hasContent(item) && item.source === "Manual entry");
          if (emptyIndex >= 0) return current.map((item, i) => i === emptyIndex ? { ...row } : item);
          return [...current, row];
        });
        lastId = row.id;
        imported += 1;
      }
      setScan({ active: false, progress: 100, file: "", status: `${imported} ${imported === 1 ? "receipt" : "receipts"} ready for review`, index: 0, total: 0 });
      if (manual) message.warning(`${imported} ${imported === 1 ? "receipt" : "receipts"} added. ${manual} could not be read automatically, so enter ${manual === 1 ? "it" : "them"} manually.`);
      else message.success(`${imported} ${imported === 1 ? "receipt" : "receipts"} imported. Review each amount, reason, and budget code.`);
      requestAnimationFrame(() => document.getElementById(`row-${lastId}`)?.scrollIntoView({ block: "center", behavior: "smooth" }));
    } catch (error) {
      if (token.cancelled) {
        setScan({ active: false, progress: 0, file: "", status: imported ? `Stopped. ${imported} imported.` : "Import cancelled", index: 0, total: 0 });
      } else {
        console.error(error);
        setScan({ active: false, progress: 0, file: "", status: "Import failed", index: 0, total: 0 });
        message.error(error.message || "Import failed. You can still enter purchases manually.");
      }
    } finally {
      scanTokenRef.current = null;
      if (worker) worker.terminate().catch?.(() => {});
    }
  }, []);

  const cancelScan = () => scanTokenRef.current?.cancel();

  // Drag a file anywhere onto the page, or paste a screenshot with Ctrl/Cmd+V.
  useEffect(() => {
    const hasFiles = event => [...(event.dataTransfer?.types || [])].includes("Files");
    const onEnter = event => { if (hasFiles(event)) { dragDepth.current += 1; setDragging(true); } };
    const onOver = event => { if (hasFiles(event)) event.preventDefault(); };
    const onLeave = event => { if (hasFiles(event)) { dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false); } };
    const onDrop = event => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      processFiles(event.dataTransfer.files);
    };
    const onPaste = event => {
      const files = [...(event.clipboardData?.files || [])];
      if (!files.length) return;
      event.preventDefault();
      processFiles(files.map((file, i) => file.name && file.name !== "image.png" ? file : new File([file], `Pasted screenshot ${dayjs().format("HHmmss")}-${i + 1}.${(file.type.split("/")[1] || "png").replace("jpeg", "jpg")}`, { type: file.type, lastModified: Date.now() })));
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("paste", onPaste);
    };
  }, [processFiles]);

  function onPicked(event) {
    const files = [...event.target.files];
    event.target.value = "";
    processFiles(files);
  }

  /* ---------- Exports ---------- */
  function buildData() {
    return filled.map((row, index) => ({
      "Line": index + 1,
      "Department": form.department,
      "Month": monthLabel(form.monthKey),
      "Today's Date": form.reportDate,
      "Budget Code": row.budgetCode,
      "Amount": normalizeMoney(row.amount),
      "Reason for Purchase": row.reason,
      "Source Receipt": row.source,
      "Signature": form.signature,
      "Signature Date": form.signatureDate
    }));
  }

  function checkBeforeExport() {
    setShowErrors(true);
    if (validation.empty) { message.warning("Add at least one purchase before exporting."); return false; }
    if (validation.count) {
      message.warning(`${validation.count} ${validation.count === 1 ? "item needs" : "items need"} attention before export.`);
      requestAnimationFrame(() => {
        const target = document.querySelector('[aria-invalid="true"], .confirm-needed button');
        target?.scrollIntoView({ block: "center" });
        target?.focus({ preventScroll: true });
      });
      return false;
    }
    return true;
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  const stamp = () => dayjs().format("YYYY-MM-DD");
  const FOREST = [22, 63, 54];
  const GREY = [109, 120, 115];

  function addFooters(doc) {
    const pages = doc.getNumberOfPages();
    for (let page = 1; page <= pages; page += 1) {
      doc.setPage(page);
      const w = doc.internal.pageSize.getWidth();
      const h = doc.internal.pageSize.getHeight();
      doc.setDrawColor(223, 229, 223);
      doc.setLineWidth(0.5);
      doc.line(40, h - 42, w - 40, h - 42);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...GREY);
      doc.text("ReceiptKing. OCR assists with data entry; staff remain responsible for reviewing purchasing records.", 40, h - 28);
      doc.text(`Page ${page} of ${pages}`, w - 40, h - 28, { align: "right" });
    }
  }

  function drawReportPage(doc, data) {
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 40;
    const reportTotal = data.reduce((sum, row) => sum + row.Amount, 0);

    doc.setTextColor(...FOREST);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("City Credit Card Expense Form", M, 54);
    doc.setFontSize(9);
    doc.setTextColor(...GREY);
    doc.text("Prepared with ReceiptKing", W - M, 54, { align: "right" });
    doc.setDrawColor(...FOREST);
    doc.setLineWidth(1.5);
    doc.line(M, 66, W - M, 66);

    [["DEPARTMENT", form.department, M], ["MONTH", monthLabel(form.monthKey), 300], ["TODAY'S DATE", form.reportDate, 430]].forEach(([label, value, x]) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...GREY);
      doc.text(label, x, 88);
      doc.setFontSize(11);
      doc.setTextColor(25, 53, 46);
      doc.text(String(value || ""), x, 104);
    });

    doc.autoTable({
      startY: 124,
      margin: { left: M, right: M, bottom: 64 },
      head: [["#", "Budget Code", "Amount", "Reason for Purchase", "Source Receipt"]],
      body: data.map(row => [row.Line, row["Budget Code"], `$${money(row.Amount)}`, row["Reason for Purchase"], row["Source Receipt"]]),
      theme: "plain",
      showHead: "everyPage",
      headStyles: { fillColor: FOREST, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5 },
      bodyStyles: { textColor: [25, 53, 46], valign: "top" },
      alternateRowStyles: { fillColor: [246, 247, 242] },
      styles: { font: "helvetica", fontSize: 9, cellPadding: { top: 6, bottom: 6, left: 6, right: 6 }, lineColor: [223, 229, 223], lineWidth: { bottom: 0.5 }, overflow: "linebreak" },
      columnStyles: { 0: { cellWidth: 24, halign: "center" }, 1: { cellWidth: 92 }, 2: { cellWidth: 72, halign: "right" }, 3: { cellWidth: "auto" }, 4: { cellWidth: 118 } },
      didParseCell: hook => { if (hook.section === "head" && hook.column.index === 2) hook.cell.styles.halign = "right"; },
      rowPageBreak: "avoid"
    });

    let y = doc.lastAutoTable.finalY + 16;
    if (y > H - 230) { doc.addPage(); y = 64; }
    doc.setFillColor(246, 247, 242);
    doc.setDrawColor(223, 229, 223);
    doc.setLineWidth(0.5);
    doc.roundedRect(W - M - 210, y, 210, 34, 4, 4, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...GREY);
    doc.text("REPORT TOTAL", W - M - 198, y + 21);
    doc.setFontSize(14);
    doc.setTextColor(...FOREST);
    doc.text(`$${money(reportTotal)}`, W - M - 12, y + 22, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...GREY);
    doc.text(`${data.length} ${data.length === 1 ? "line" : "lines"}`, M, y + 21);

    y += 92;
    doc.setDrawColor(25, 53, 46);
    doc.setLineWidth(0.8);
    doc.line(M, y, M + 300, y);
    doc.line(M + 340, y, W - M, y);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(13);
    doc.setTextColor(25, 53, 46);
    doc.text(form.signature || "", M + 4, y - 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(form.signatureDate || "", M + 344, y - 6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...GREY);
    doc.text("SIGNATURE / PRINTED NAME", M, y + 13);
    doc.text("DATE", M + 340, y + 13);
  }

  function addReceiptPage(doc, item, position, count) {
    const image = item.receipt.full;
    doc.addPage("letter", image.w > image.h * 1.15 ? "landscape" : "portrait");
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 40;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...FOREST);
    doc.text(`Receipt ${position} of ${count}  ·  Line ${item.line}`, M, 46);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...GREY);
    const detail = [item.receipt.name, item.row.amount ? `$${money(normalizeMoney(item.row.amount))}` : "", item.row.reason].filter(Boolean).join("  ·  ");
    doc.text(doc.splitTextToSize(detail, W - M * 2).slice(0, 2), M, 62);
    const boxW = W - M * 2;
    const boxH = H - 84 - 56;
    const ratio = Math.min(boxW / image.w, boxH / image.h);
    const w = image.w * ratio;
    const h = image.h * ratio;
    doc.setDrawColor(223, 229, 223);
    doc.rect((W - w) / 2 - 0.5, 84 - 0.5, w + 1, h + 1);
    doc.addImage(image.url, "JPEG", (W - w) / 2, 84, w, h, undefined, "FAST");
  }

  async function runTask(label, task) {
    const key = "export-loading";
    setBusy(label);
    try {
      await task(key);
      message.destroy(key);
    } catch (error) {
      console.error(error);
      message.destroy(key);
      message.error(error.message || "The file could not be created. Please try again.");
    } finally {
      setBusy("");
    }
  }

  function startPrint(kind) { setPrintJob({ kind, n: Date.now() }); }

  async function runExport(kind) {
    if (busy) return;
    if (kind === "print") { if (validation.empty) { message.warning("Add at least one purchase before printing."); return; } startPrint("report"); return; }
    if (!checkBeforeExport()) return;
    await runTask(kind, async key => {
      const data = buildData();
      if (kind === "csv") {
        const headers = Object.keys(data[0]);
        const csv = [headers, ...data.map(Object.values)].map(row => row.map(escapeCsv).join(",")).join("\r\n");
        download(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), `ReceiptKing-Report-${stamp()}.csv`);
      } else if (kind === "xlsx") {
        if (!window.XLSX) message.loading({ content: "Loading Excel tools...", key, duration: 0 });
        await loadXlsx();
        const book = XLSX.utils.book_new();
        const sheet = XLSX.utils.json_to_sheet(data);
        sheet["!cols"] = [6, 22, 17, 14, 18, 12, 42, 24, 22, 16].map(wch => ({ wch }));
        data.forEach((_, i) => { const cell = sheet[XLSX.utils.encode_cell({ r: i + 1, c: 5 })]; if (cell) cell.z = "$#,##0.00"; });
        sheet["!autofilter"] = { ref: sheet["!ref"] };
        XLSX.utils.book_append_sheet(book, sheet, "Purchasing Import");
        const summary = XLSX.utils.aoa_to_sheet([
          ["City Credit Card Expense Form"], [],
          ["Department", form.department], ["Month", monthLabel(form.monthKey)], ["Today's Date", form.reportDate],
          ["Lines", data.length], ["Report Total", total], [],
          ["Signature / Printed Name", form.signature], ["Date", form.signatureDate]
        ]);
        summary["!cols"] = [{ wch: 28 }, { wch: 30 }];
        summary.B7.z = "$#,##0.00";
        XLSX.utils.book_append_sheet(book, summary, "Summary");
        XLSX.writeFile(book, `ReceiptKing-Report-${stamp()}.xlsx`);
      } else {
        if (!window.jspdf?.jsPDF?.API?.autoTable) message.loading({ content: "Loading PDF tools...", key, duration: 0 });
        await loadPdfLib();
        const doc = new window.jspdf.jsPDF({ unit: "pt", format: "letter" });
        drawReportPage(doc, data);
        addFooters(doc);
        doc.save(`ReceiptKing-Report-${stamp()}.pdf`);
      }
      message.success({ content: `${kind === "xlsx" ? "Excel" : kind.toUpperCase()} report created.`, duration: 2.5 });
    });
  }

  async function runReceipts(kind) {
    if (busy) return;
    if (!chosen.length) { message.warning("Select at least one receipt first."); return; }
    if (kind === "print") { startPrint("receipts"); return; }
    if (kind === "combined" && !checkBeforeExport()) return;
    await runTask(`r-${kind}`, async key => {
      if (kind === "png") {
        message.loading({ content: "Preparing images...", key, duration: 0 });
        const files = [];
        for (const item of chosen) files.push({ name: `Line-${item.line}-${safeName(item.receipt.name)}.png`, blob: await receiptPngBlob(item.receipt) });
        if (files.length === 1) download(files[0].blob, files[0].name);
        else download(makeZip(await Promise.all(files.map(async file => ({ name: file.name, data: new Uint8Array(await file.blob.arrayBuffer()) })))), `ReceiptKing-Receipts-${stamp()}.zip`);
        message.success({ content: files.length === 1 ? "Receipt PNG created." : `${files.length} receipt PNGs saved as a ZIP.`, duration: 2.5 });
        return;
      }
      if (!window.jspdf?.jsPDF?.API?.autoTable) message.loading({ content: "Loading PDF tools...", key, duration: 0 });
      await loadPdfLib();
      const doc = new window.jspdf.jsPDF({ unit: "pt", format: "letter" });
      if (kind === "combined") drawReportPage(doc, buildData());
      chosen.forEach((item, i) => addReceiptPage(doc, item, i + 1, chosen.length));
      if (kind !== "combined") doc.deletePage(1);
      addFooters(doc);
      doc.save(`ReceiptKing-${kind === "combined" ? "Report-and-Receipts" : "Receipts"}-${stamp()}.pdf`);
      message.success({ content: kind === "combined" ? "Combined report and receipts PDF created." : "Receipts PDF created.", duration: 2.5 });
    });
  }

  // Print renders a dedicated, clean print sheet (see styles.css), then cleans up afterwards.
  useEffect(() => {
    if (!printJob.kind) return undefined;
    document.body.dataset.print = printJob.kind;
    const finish = () => { delete document.body.dataset.print; setPrintJob({ kind: "", n: 0 }); };
    window.addEventListener("afterprint", finish, { once: true });
    const timer = setTimeout(() => window.print(), 250);
    return () => { clearTimeout(timer); window.removeEventListener("afterprint", finish); };
  }, [printJob]);

  const toggleReceipt = id => setDeselected(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const toggleAll = () => setDeselected(chosen.length === inbox.length ? new Set(inbox.map(item => item.row.id)) : new Set());

  const exportButtons = (compact = false) => <>
    <Button type="primary" icon={<FilePdfOutlined />} loading={busy === "pdf"} onClick={() => runExport("pdf")} aria-label="Download report as PDF">PDF</Button>
    <Button icon={<FileExcelOutlined />} loading={busy === "xlsx"} onClick={() => runExport("xlsx")} aria-label="Download report as Excel">Excel</Button>
    <Button icon={<FileTextOutlined />} loading={busy === "csv"} onClick={() => runExport("csv")} aria-label="Download report as CSV">CSV</Button>
    {!compact && <Button icon={<PrinterOutlined />} onClick={() => runExport("print")} aria-label="Print report">Print</Button>}
  </>;

  const errorText = (id, text) => text ? <div className="field-error" id={id} role="alert"><WarningOutlined aria-hidden="true" /> {text}</div> : null;

  return (
    <ConfigProvider theme={{
      algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
      token: {
        colorPrimary: activeTheme.primary,
        colorInfo: activeTheme.primary,
        colorSuccess: activeTheme.primary,
        colorError: isDark ? "#FF9C93" : "#B3261E",
        colorBgContainer: isDark ? activeTheme.darkSurface : activeTheme.surface,
        colorText: isDark ? activeTheme.darkText : activeTheme.text,
        colorBorder: isDark ? "rgba(255,255,255,.22)" : "rgba(25,53,46,.22)",
        borderRadius: 10,
        fontFamily: '"DM Sans", system-ui, sans-serif',
        controlHeight: 44
      }
    }}>
      <div className="app-shell">
        <a className="skip-link" href="#report">Skip to the report form</a>
        {createPortal(<header className="topbar">
          <div className="brand">
            <img src={`assets/brand/jungle/${activeIcon.file}.webp`} alt={`ReceiptKing ${activeIcon.name} app icon`} width="48" height="48" />
            <div className="brand-name">ReceiptKing</div>
          </div>
          <div className="topbar-actions">
            <div className="privacy-pill"><LockOutlined /><span>Local browser processing</span></div>
            <button className="mode-quick" type="button" aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"} title="Light / dark" onClick={() => setAppearance(current => ({ ...current, mode: isDark ? "light" : "dark" }))}>{isDark ? "☀️" : "🌙"}</button>
            <button ref={triggerRef} className="appearance-trigger" type="button" aria-haspopup="dialog" aria-expanded={appearanceOpen} aria-controls="appearance-panel" aria-label={`Appearance: ${activeTheme.name}`} onClick={() => setAppearanceOpen(open => !open)}>
              <span className="theme-dot" style={{ background: activeTheme.primary }} aria-hidden="true" />
              <span className="trigger-label">{activeTheme.name}</span>
              <SettingOutlined />
            </button>
          </div>
        </header>, topSlot)}

        {appearanceOpen && <>
          <button className="appearance-scrim" type="button" tabIndex={-1} aria-hidden="true" onClick={closeAppearance} />
          <section ref={panelRef} className="appearance-panel" id="appearance-panel" role="dialog" aria-modal="true" aria-labelledby="appearance-title">
            <div className="sheet-grab" aria-hidden="true" />
            <div className="appearance-head">
              <div><span className="eyebrow">Emperor UI system</span><h2 id="appearance-title">Appearance</h2></div>
              <button className="icon-close" type="button" aria-label="Close appearance menu" onClick={closeAppearance}><CloseOutlined /></button>
            </div>

            <div className="appearance-group">
              <h3>Mode</h3>
              <div className="mode-switch" role="group" aria-label="Color mode">
                {[{ id: "light", label: "☀️ Light" }, { id: "dark", label: "🌙 Dark" }, { id: "auto", label: "Auto" }].map(mode => (
                  <button key={mode.id} type="button" aria-pressed={appearance.mode === mode.id} onClick={() => setAppearance(current => ({ ...current, mode: mode.id }))}>{mode.label}</button>
                ))}
              </div>
            </div>

            <div className="appearance-group">
              <h3>Color theme</h3>
              <div className="theme-options" role="group" aria-label="Emperor UI color theme">
                {emperorThemes.map(item => (
                  <button key={item.id} type="button" className="theme-option" aria-pressed={appearance.theme === item.id} onClick={() => setAppearance(current => ({ ...current, theme: item.id }))}>
                    <span className="theme-swatch" style={{ "--swatch-primary": item.primary, "--swatch-accent": item.accent }} aria-hidden="true" />
                    <span>{item.name}</span>
                    {appearance.theme === item.id && <CheckOutlined aria-hidden="true" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="appearance-group">
              <h3>Jungle app icon <em>saved separately</em></h3>
              <div className="icon-options" role="group" aria-label="Jungle app icon">
                {jungleIcons.map(item => (
                  <button key={item.file} type="button" className="icon-option" aria-pressed={appearance.icon === item.file} onClick={() => { setAppearance(current => ({ ...current, icon: item.file })); message.success({ content: `${item.name} icon selected`, duration: 1.5 }); }}>
                    <img src={`assets/brand/jungle/${item.file}.webp`} alt="" width="62" height="62" loading="lazy" />
                    <span>{item.name}</span>
                    {item.file === "hackberry" && <small>Default</small>}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </>}

        {dragging && <div className="drop-overlay" aria-hidden="true"><div><CameraOutlined /><strong>Drop receipts to import</strong><span>PNG, JPG, WebP, or PDF</span></div></div>}

        <main className="workspace" id="report">
          <div className="section-head">
            <div><h2>City credit card expense form</h2><p>Based on the current Long Beach purchasing template.</p></div>
            <span className="chip">v{APP_VERSION}</span>
          </div>

          <div className="workspace-grid">
            <aside className="left-rail">
              <div className="panel panel-pad">
                <div className="panel-title"><h3>Report details</h3><span className="step-number">1</span></div>
                <div className="field-grid">
                  <div className="wide">
                    <label className="form-label" htmlFor="department">Department</label>
                    <Input id="department" value={form.department} status={show.formErrors.department ? "error" : ""} aria-invalid={Boolean(show.formErrors.department)} aria-describedby={show.formErrors.department ? "err-department" : undefined} onChange={e => updateForm("department", e.target.value)} />
                    {errorText("err-department", show.formErrors.department)}
                  </div>
                  <div>
                    <label className="form-label" htmlFor="month">Month</label>
                    <DatePicker id="month" picker="month" format="MMMM YYYY" allowClear={false} value={dayjs(`${form.monthKey}-01`)} onChange={date => date && updateForm("monthKey", date.format("YYYY-MM"))} style={{ width: "100%" }} />
                  </div>
                  <div>
                    <label className="form-label" htmlFor="reportDate">Today's Date</label>
                    <DatePicker id="reportDate" allowClear={false} value={dayjs(form.reportDate)} onChange={date => date && updateForm("reportDate", date.format("YYYY-MM-DD"))} style={{ width: "100%" }} />
                  </div>
                </div>
              </div>

              <div className="panel panel-pad" style={{ marginTop: 20 }}>
                <div className="panel-title"><h3>Import receipt</h3><span className="step-number">2</span></div>
                <input ref={fileInputRef} type="file" hidden multiple accept="image/*,application/pdf,.pdf" onChange={onPicked} />
                <input ref={cameraInputRef} type="file" hidden accept="image/*" capture="environment" onChange={onPicked} />
                <div className={`dropzone${scan.active ? " is-busy" : ""}`}>
                  <div className="upload-icon"><CameraOutlined /></div>
                  <p className="upload-title">Scan, drop, or paste receipts</p>
                  <p className="upload-hint">Photos, screenshots, and PDFs. You can select several at once.</p>
                  <div className="import-actions">
                    <Button className="btn-camera" type="primary" size="large" icon={<CameraOutlined />} disabled={scan.active} onClick={() => cameraInputRef.current?.click()}>Scan with camera</Button>
                    <Button size="large" icon={<FolderOpenOutlined />} disabled={scan.active} onClick={() => fileInputRef.current?.click()}>Choose files</Button>
                  </div>
                  <p className="upload-tip"><kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>V</kbd> pastes a screenshot. Drag files anywhere on this page.</p>
                </div>
                <div className="scan-status" role="status" aria-live="polite">
                  {scan.active ? <>
                    <div className="scan-line"><strong>{scan.status}</strong><Button size="small" danger onClick={cancelScan}>Cancel</Button></div>
                    <Progress percent={scan.progress} size="small" showInfo={false} />
                    <div className="scan-meta">{scan.total > 1 ? `Receipt ${scan.index} of ${scan.total}: ` : ""}{scan.file}</div>
                  </> : scan.status ? <strong>{scan.status}</strong> : null}
                </div>
                <div className="security-note"><SafetyCertificateOutlined style={{ marginTop: 2 }} /><span>Files are processed in your browser and are not uploaded to a ReceiptKing server. OCR only suggests values. You confirm each one.</span></div>
              </div>
            </aside>

            <section>
              <div className="panel ledger-panel">
                <div className="ledger-toolbar">
                  <div><h3>Purchases</h3><div className="row-count">{rows.length} {rows.length === 1 ? "line" : "lines"} in this report</div></div>
                  <Button icon={<PlusOutlined />} onClick={addRow}>Add line</Button>
                </div>
                <div className="ledger-head" aria-hidden="true"><span>#</span><span>Budget Code</span><span>Amount</span><span>Reason for Purchase</span><span /></div>
                <ul className="ledger">
                  {rows.map((row, index) => {
                    const errors = show.rowErrors[row.id] || {};
                    const receipt = receipts[row.id];
                    return <li className={`ledger-row${errors.ocr || errors.budgetCode || errors.amount || errors.reason ? " has-error" : ""}`} id={`row-${row.id}`} key={row.id}>
                      <div className="row-index"><span className="row-badge">{index + 1}</span><span className="row-word">Line {index + 1}</span></div>
                      <div className="cell cell-code">
                        <label className="cell-label" htmlFor={`code-${row.id}`}>Budget Code</label>
                        <Input id={`code-${row.id}`} value={row.budgetCode} placeholder="Enter code" status={errors.budgetCode ? "error" : ""} aria-invalid={Boolean(errors.budgetCode)} aria-describedby={errors.budgetCode ? `err-code-${row.id}` : undefined} onChange={e => updateRow(row.id, "budgetCode", e.target.value)} />
                        {errorText(`err-code-${row.id}`, errors.budgetCode)}
                      </div>
                      <div className="cell cell-amount">
                        <label className="cell-label" htmlFor={`amount-${row.id}`}>Amount</label>
                        <Input id={`amount-${row.id}`} prefix="$" inputMode="decimal" value={row.amount} placeholder="0.00" status={errors.amount ? "error" : ""} aria-invalid={Boolean(errors.amount)} aria-describedby={errors.amount ? `err-amount-${row.id}` : undefined} onChange={e => updateRow(row.id, "amount", e.target.value)} />
                        {errorText(`err-amount-${row.id}`, errors.amount)}
                      </div>
                      <div className="cell cell-reason">
                        <label className="cell-label" htmlFor={`reason-${row.id}`}>Reason for Purchase</label>
                        <Input.TextArea id={`reason-${row.id}`} autoSize={{ minRows: 1, maxRows: 4 }} value={row.reason} placeholder="Business reason for purchase" status={errors.reason ? "error" : ""} aria-invalid={Boolean(errors.reason)} aria-describedby={errors.reason ? `err-reason-${row.id}` : undefined} onChange={e => updateRow(row.id, "reason", e.target.value)} />
                        {errorText(`err-reason-${row.id}`, errors.reason)}
                        <div className="source-line">
                          {receipt && <button type="button" className="thumb" aria-label={`View receipt image ${row.source}`} onClick={() => setViewer({ url: receipt.full.url, name: row.source })}><img src={receipt.thumb.url} alt="" width="36" height="46" /></button>}
                          <div className="source-text">
                            <span className="scan-meta" title={row.source}>{row.source}</span>
                            {row.ocr && <span className={`confirm-needed${errors.ocr ? " is-error" : ""}`}><span className="chip chip--warn">OCR suggestion</span><Button size="small" type="link" icon={<CheckOutlined />} onClick={() => updateRow(row.id, "ocr", false)}>Confirm values</Button></span>}
                            {row.note && <span className="row-note"><WarningOutlined aria-hidden="true" /> {row.note}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="cell cell-del"><Button type="text" danger icon={<DeleteOutlined />} aria-label={`Delete line ${index + 1}`} onClick={() => removeRow(row.id)} /></div>
                    </li>;
                  })}
                </ul>
                <div className="summary-bar"><div><div className="summary-label">Report total</div><div className="summary-total">${money(total)}</div></div><div className="summary-label">Review all OCR values before submission</div></div>
              </div>

              <div className="panel panel-pad approval-card">
                <div className="panel-title"><h3>Approval and export</h3><span className="step-number">3</span></div>
                <div className="approval-grid">
                  <div>
                    <label className="form-label" htmlFor="signature">Signature / Printed Name</label>
                    <Input id="signature" value={form.signature} placeholder="Enter name" status={show.formErrors.signature ? "error" : ""} aria-invalid={Boolean(show.formErrors.signature)} aria-describedby={show.formErrors.signature ? "err-signature" : undefined} onChange={e => updateForm("signature", e.target.value)} />
                    {errorText("err-signature", show.formErrors.signature)}
                  </div>
                  <div>
                    <label className="form-label" htmlFor="signatureDate">Date</label>
                    <DatePicker id="signatureDate" allowClear={false} value={dayjs(form.signatureDate)} onChange={date => date && updateForm("signatureDate", date.format("YYYY-MM-DD"))} style={{ width: "100%" }} />
                  </div>
                </div>
                {validation.empty
                  ? <div className="export-status" role="status">Add a purchase to enable export.</div>
                  : validation.count === 0
                    ? <div className="export-status is-ready" role="status"><CheckOutlined aria-hidden="true" /> Ready to export. {filled.length} {filled.length === 1 ? "line" : "lines"}, total ${money(total)}.</div>
                    : <div className={`export-status${showErrors ? " is-error" : ""}`} role={showErrors ? "alert" : "status"}><WarningOutlined aria-hidden="true" /> {validation.count} {validation.count === 1 ? "item needs" : "items need"} attention before export{showErrors ? ". Fix the highlighted fields." : "."}</div>}
                <div className="export-group">
                  <span className="export-label">Download report</span>
                  <div className="export-row">{exportButtons()}</div>
                </div>
              </div>

              <div className="panel panel-pad inbox" id="inbox">
                <div className="panel-title">
                  <div><h3>Receipt Inbox</h3><div className="row-count">{inbox.length === 0 ? "No receipts yet" : `${chosen.length} of ${inbox.length} selected`}</div></div>
                  {inbox.length > 1 && <Button type="link" onClick={toggleAll}>{chosen.length === inbox.length ? "Clear" : "Select all"}</Button>}
                </div>
                {inbox.length === 0
                  ? <div className="inbox-empty">Scanned and uploaded receipts collect here, so you can download or print the originals together with the report.</div>
                  : <ul className="inbox-grid">
                    {inbox.map(item => <li key={item.row.id} className={`inbox-card${deselected.has(item.row.id) ? " is-off" : ""}`}>
                      <Checkbox checked={!deselected.has(item.row.id)} onChange={() => toggleReceipt(item.row.id)} aria-label={`Include receipt for line ${item.line}`} />
                      <button type="button" className="thumb thumb--lg" aria-label={`View receipt image ${item.receipt.name}`} onClick={() => setViewer({ url: item.receipt.full.url, name: item.receipt.name })}><img src={item.receipt.thumb.url} alt="" /></button>
                      <div className="inbox-meta"><strong>Line {item.line}{item.row.amount ? ` · $${money(normalizeMoney(item.row.amount))}` : ""}</strong><span title={item.receipt.name}>{item.receipt.name}</span></div>
                    </li>)}
                  </ul>}
                <div className="export-group">
                  <span className="export-label">Download receipts</span>
                  <div className="export-row inbox-actions">
                    <Button type="primary" icon={<FileDoneOutlined />} disabled={!chosen.length} loading={busy === "r-combined"} onClick={() => runReceipts("combined")} aria-label="Download combined report and receipts PDF" title="Report and selected receipts in one PDF">Combined</Button>
                    <Button icon={<FilePdfOutlined />} disabled={!chosen.length} loading={busy === "r-pdf"} onClick={() => runReceipts("pdf")} aria-label="Download receipts PDF" title="Selected receipts in one PDF">PDF</Button>
                    <Button icon={<FileImageOutlined />} disabled={!chosen.length} loading={busy === "r-png"} onClick={() => runReceipts("png")} aria-label="Download receipt PNG images" title="Original receipt images as PNG (a ZIP when several)">PNG</Button>
                    <Button icon={<PrinterOutlined />} disabled={!chosen.length} onClick={() => runReceipts("print")} aria-label="Print receipts" title="Print the selected receipts">Print</Button>
                  </div>
                </div>
                <p className="inbox-note">Combined adds the signed report in front of the receipts. Receipts stay in this browser only.</p>
              </div>
            </section>
          </div>
        </main>

        {!validation.empty && <div className="print-sheet print-report">
          <div className="ps-head"><h1>City Credit Card Expense Form</h1><span>Prepared with ReceiptKing</span></div>
          <dl className="ps-meta"><div><dt>Department</dt><dd>{form.department}</dd></div><div><dt>Month</dt><dd>{monthLabel(form.monthKey)}</dd></div><div><dt>Today's Date</dt><dd>{form.reportDate}</dd></div></dl>
          <table className="ps-table">
            <thead><tr><th className="c">#</th><th className="code">Budget Code</th><th className="r">Amount</th><th>Reason for Purchase</th><th className="src">Source Receipt</th></tr></thead>
            <tbody>{filled.map((row, index) => <tr key={row.id}><td className="c">{index + 1}</td><td className="code">{row.budgetCode}</td><td className="r">${money(normalizeMoney(row.amount))}</td><td>{row.reason}</td><td className="src">{row.source}</td></tr>)}</tbody>
          </table>
          <div className="ps-total"><span>{filled.length} {filled.length === 1 ? "line" : "lines"}</span><strong>Report total <em>${money(total)}</em></strong></div>
          <div className="ps-sign"><div><span className="ps-line">{form.signature}</span><small>Signature / Printed Name</small></div><div><span className="ps-line">{form.signatureDate}</span><small>Date</small></div></div>
          <p className="ps-foot">OCR assists with data entry; staff remain responsible for reviewing purchasing records.</p>
        </div>}
        {printJob.kind === "receipts" && <div className="print-sheet print-receipts">
          {chosen.map((item, i) => <figure className="ps-receipt" key={item.row.id}>
            <figcaption><strong>Receipt {i + 1} of {chosen.length} · Line {item.line}</strong><span>{[item.receipt.name, item.row.amount ? `$${money(normalizeMoney(item.row.amount))}` : "", item.row.reason].filter(Boolean).join(" · ")}</span></figcaption>
            <img src={item.receipt.full.url} alt="" />
          </figure>)}
        </div>}

        {filled.length > 0 && <div className="export-dock" role="region" aria-label="Quick export">
          <div className="dock-total"><span>Total</span><strong>${money(total)}</strong></div>
          <div className="dock-actions">{exportButtons(true)}</div>
        </div>}

        <footer className="footer"><strong>ReceiptKing v{APP_VERSION}</strong><span>Emperor UI system</span><span>OCR assists with data entry. Staff remain responsible for reviewing purchasing records.</span></footer>

        <dialog ref={viewerRef} className="viewer" aria-label={viewer ? `Receipt image ${viewer.name}` : "Receipt image"} onClose={() => setViewer(null)} onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
          {viewer && <>
            <div className="viewer-head"><strong>{viewer.name}</strong><button className="icon-close" type="button" aria-label="Close receipt image" onClick={() => viewerRef.current?.close()}><CloseOutlined /></button></div>
            <img className="viewer-image" src={viewer.url} alt={`Receipt image ${viewer.name}`} />
          </>}
        </dialog>
      </div>
    </ConfigProvider>
  );
}

createRoot(document.getElementById("root")).render(<App />);
