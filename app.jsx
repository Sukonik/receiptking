import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import { Button, Checkbox, ConfigProvider, DatePicker, Input, message, Progress, theme as antTheme } from "antd";
import {
  CameraOutlined, CheckOutlined, CloseOutlined, DeleteOutlined, FileExcelOutlined,
  FilePdfOutlined, FileTextOutlined, FolderOpenOutlined, LockOutlined, PlusOutlined,
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
const hasContent = row => Boolean(row.budgetCode || row.amount || row.reason);
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
    const matches = line.match(/(?:\$\s*)?(\d{1,5}(?:,\d{3})*\.\d{2})/g) || [];
    matches.forEach(raw => {
      const value = normalizeMoney(raw);
      const score = (/grand\s*total|amount\s*due|balance\s*due|total/i.test(line) ? 10 : 0)
        - (/subtotal|sub-total|tax|change|saving|tip|cash|tend/i.test(line) ? 7 : 0)
        + value / 100000
        + index / 10000;
      totalCandidates.push({ value, score });
    });
  });
  totalCandidates.sort((a, b) => b.score - a.score || b.value - a.value);

  const vendor = lines.find(line =>
    line.length >= 3 && line.length <= 48 && /[a-z]{3}/i.test(line) &&
    !/receipt|invoice|date|time|cashier|order|transaction|welcome|thank|tel|phone|www\.|http/i.test(line)
  ) || filename.replace(/\.[^.]+$/, "");

  return {
    amount: totalCandidates[0]?.value ? totalCandidates[0].value.toFixed(2) : "",
    reason: vendor ? `Purchase from ${vendor.replace(/\s+/g, " ")}` : ""
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

function makePreview(source, width, height) {
  const scale = Math.min(1, 1400 / Math.max(width, height));
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  return { url: drawToCanvas(source, w, h).toDataURL("image/jpeg", 0.8), w, h };
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
      preview: makePreview(canvas, canvas.width, canvas.height), width: canvas.width, height: canvas.height
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
  const scale = longest > 2400 ? 2400 / longest : longest < 1400 ? Math.min(2, 1400 / longest) : 1;
  const canvas = drawToCanvas(bitmap, Math.round(width * scale), Math.round(height * scale), { filter: "grayscale(1) contrast(1.2)" });
  const preview = makePreview(bitmap, width, height);
  bitmap.close?.();
  return { canvas, text: "", preview, width, height };
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
  const [previews, setPreviews] = useState({});
  const [scan, setScan] = useState({ active: false, progress: 0, file: "", status: "", index: 0, total: 0 });
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState("");
  const [attachImages, setAttachImages] = useState(true);
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
  const attachable = filled.filter(row => previews[row.id]);

  function updateForm(field, value) { setForm(current => ({ ...current, [field]: value })); }
  function updateRow(id, field, value) { setRows(current => current.map(row => row.id === id ? { ...row, [field]: value } : row)); }
  function addRow() { setRows(current => [...current, blankRow()]); }
  function removeRow(id) {
    setRows(current => current.length === 1 ? [blankRow()] : current.filter(item => item.id !== id));
    setPreviews(current => { const next = { ...current }; delete next[id]; return next; });
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
          setPreviews(current => ({ ...current, [row.id]: prepared.preview }));

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
            let result = await token.guard(worker.recognize(prepared.canvas));
            if (result.data.confidence < 45) {
              setStatus({ status: "Trying rotated views", progress: 50 });
              for (const rotate of [90, 270]) {
                const turned = drawToCanvas(prepared.canvas, prepared.canvas.width, prepared.canvas.height, { rotate });
                const attempt = await token.guard(worker.recognize(turned));
                if (attempt.data.confidence > result.data.confidence + 5) result = attempt;
              }
            }
            text = result.data.text;
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

  async function runExport(kind) {
    if (busy) return;
    if (kind !== "print" && !checkBeforeExport()) return;
    if (kind === "print") { window.print(); return; }
    setBusy(kind);
    const key = "export-loading";
    try {
      const data = buildData();
      if (kind === "csv") {
        const headers = Object.keys(data[0]);
        const csv = [headers, ...data.map(Object.values)].map(row => row.map(escapeCsv).join(",")).join("\r\n");
        download(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), `ReceiptKing-${stamp()}.csv`);
      } else if (kind === "xlsx") {
        if (!window.XLSX) message.loading({ content: "Loading Excel tools...", key, duration: 0 });
        await loadXlsx();
        const book = XLSX.utils.book_new();
        const sheet = XLSX.utils.json_to_sheet(data);
        sheet["!cols"] = [6, 22, 17, 14, 18, 12, 42, 24, 22, 16].map(wch => ({ wch }));
        XLSX.utils.book_append_sheet(book, sheet, "Purchasing Import");
        XLSX.writeFile(book, `ReceiptKing-${stamp()}.xlsx`);
      } else {
        if (!window.jspdf?.jsPDF?.API?.autoTable) message.loading({ content: "Loading PDF tools...", key, duration: 0 });
        await loadPdfLib();
        buildPdf(data);
      }
      message.destroy(key);
      message.success({ content: `${kind === "xlsx" ? "Excel" : kind.toUpperCase()} file created.`, duration: 2.5 });
    } catch (error) {
      console.error(error);
      message.destroy(key);
      message.error(error.message || "The export could not be created. Please try again.");
    } finally {
      setBusy("");
    }
  }

  function buildPdf(data) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const reportTotal = data.reduce((sum, row) => sum + row.Amount, 0);

    doc.setFillColor(22, 63, 54);
    doc.rect(0, 0, pageWidth, 74, "F");
    doc.setTextColor(215, 240, 107);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("ReceiptKing", 38, 34);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("CITY CREDIT CARD EXPENSE FORM", 38, 54);

    doc.setTextColor(25, 53, 46);
    doc.setFont("helvetica", "bold");
    doc.text(`Department: ${form.department || ""}`, 38, 100);
    doc.text(`Month: ${monthLabel(form.monthKey)}`, 300, 100);
    doc.text(`Today's Date: ${form.reportDate || ""}`, 525, 100);

    doc.autoTable({
      startY: 120,
      head: [["#", "Budget Code", "Amount", "Reason for Purchase", "Source Receipt"]],
      body: data.map(row => [row.Line, row["Budget Code"], `$${money(row.Amount)}`, row["Reason for Purchase"], row["Source Receipt"]]),
      theme: "grid",
      headStyles: { fillColor: [22, 63, 54], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [246, 247, 242] },
      styles: { font: "helvetica", fontSize: 9, cellPadding: 6, lineColor: [223, 229, 223] },
      columnStyles: { 0: { cellWidth: 34, halign: "center" }, 1: { cellWidth: 120 }, 2: { cellWidth: 82, halign: "right" }, 3: { cellWidth: 260 }, 4: { cellWidth: 150 } }
    });

    let y = doc.lastAutoTable.finalY + 24;
    if (y > pageHeight - 110) { doc.addPage(); y = 60; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`Report Total: $${money(reportTotal)}`, 38, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Signature / Printed Name: ${form.signature || ""}`, 38, y + 34);
    doc.text(`Date: ${form.signatureDate || ""}`, 420, y + 34);
    doc.setTextColor(109, 120, 115);
    doc.setFontSize(8);
    doc.text("OCR assists with data entry. Staff remain responsible for reviewing purchasing records.", 38, pageHeight - 26);

    if (attachImages) {
      filled.forEach((row, index) => {
        const preview = previews[row.id];
        if (!preview) return;
        doc.addPage();
        doc.setTextColor(25, 53, 46);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(`Line ${index + 1} receipt: ${row.source}`, 38, 40);
        const boxW = pageWidth - 76;
        const boxH = pageHeight - 90;
        const ratio = Math.min(boxW / preview.w, boxH / preview.h);
        const w = preview.w * ratio;
        const h = preview.h * ratio;
        doc.addImage(preview.url, "JPEG", (pageWidth - w) / 2, 56, w, h);
      });
    }
    doc.save(`ReceiptKing-${stamp()}.pdf`);
  }

  const exportButtons = (compact = false) => <>
    <Button type="primary" icon={<FilePdfOutlined />} loading={busy === "pdf"} onClick={() => runExport("pdf")} aria-label="Export PDF">{compact ? "PDF" : "PDF"}</Button>
    <Button icon={<FileExcelOutlined />} loading={busy === "xlsx"} onClick={() => runExport("xlsx")} aria-label="Export Excel">Excel</Button>
    <Button icon={<FileTextOutlined />} loading={busy === "csv"} onClick={() => runExport("csv")} aria-label="Export CSV">CSV</Button>
    {!compact && <Button icon={<PrinterOutlined />} onClick={() => runExport("print")}>Print</Button>}
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

          <div className="print-header">
            <strong>City credit card expense form</strong>
            <span>Department: {form.department}</span><span>Month: {monthLabel(form.monthKey)}</span><span>Today's Date: {form.reportDate}</span>
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
                    const preview = previews[row.id];
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
                          {preview && <button type="button" className="thumb" aria-label={`View receipt image ${row.source}`} onClick={() => setViewer({ url: preview.url, name: row.source })}><img src={preview.url} alt="" width="36" height="46" /></button>}
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
                {attachable.length > 0 && <Checkbox className="attach-toggle" checked={attachImages} onChange={e => setAttachImages(e.target.checked)}>Attach {attachable.length} receipt {attachable.length === 1 ? "image" : "images"} to the PDF</Checkbox>}
                {showErrors && (validation.count > 0 || validation.empty) && <div className="issue-summary" role="alert"><WarningOutlined aria-hidden="true" /> {validation.empty ? "Add at least one purchase." : `${validation.count} ${validation.count === 1 ? "item needs" : "items need"} attention. Fix the highlighted fields to export.`}</div>}
                <div className="export-row">{exportButtons()}</div>
              </div>
            </section>
          </div>
        </main>

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
