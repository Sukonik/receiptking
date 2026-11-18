const { useEffect, useMemo, useState } = React;
const {
  Button, ConfigProvider, DatePicker, Input, message, Progress, Space, Tag, Upload
} = antd;
const {
  CloudUploadOutlined, DeleteOutlined, FileExcelOutlined, FilePdfOutlined, FileTextOutlined,
  LockOutlined, PlusOutlined, PrinterOutlined, SafetyCertificateOutlined
} = icons;

const STORAGE_KEY = "receiptking-v1";

const today = dayjs();
const blankRow = () => ({ id: crypto.randomUUID(), budgetCode: "", amount: "", reason: "", source: "Manual entry" });

function normalizeMoney(value) {
  const numeric = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function escapeCsv(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function extractReceiptFields(text, filename) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const totalCandidates = [];
  lines.forEach((line, index) => {
    const matches = line.match(/(?:\$\s*)?(\d{1,5}(?:,\d{3})*\.\d{2})/g) || [];
    matches.forEach(raw => {
      const value = normalizeMoney(raw);
      const score = (/grand\s*total|amount\s*due|total/i.test(line) ? 10 : 0)
        - (/subtotal|tax|change|saving/i.test(line) ? 7 : 0)
        + value / 100000
        + index / 10000;
      totalCandidates.push({ value, score });
    });
  });
  totalCandidates.sort((a, b) => b.score - a.score || b.value - a.value);

  const vendor = lines.find(line =>
    line.length >= 3 && line.length <= 48 && /[a-z]/i.test(line) &&
    !/receipt|invoice|date|time|cashier|order|transaction|welcome/i.test(line)
  ) || filename.replace(/\.[^.]+$/, "");

  return {
    amount: totalCandidates[0]?.value ? totalCandidates[0].value.toFixed(2) : "",
    reason: vendor ? `Purchase from ${vendor.replace(/\s+/g, " ")}` : "",
    rawText: text
  };
}

async function fileToOcrSource(file) {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const pdfjs = await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.min.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.mjs";
    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjs.getDocument({ data: bytes }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    return canvas;
  }
  return file;
}

function App() {
  const [form, setForm] = useState({
    department: "Corporation Counsel",
    month: today.format("MMMM YYYY"),
    reportDate: today.format("YYYY-MM-DD"),
    signature: "",
    signatureDate: today.format("YYYY-MM-DD")
  });
  const [rows, setRows] = useState([blankRow()]);
  const [scan, setScan] = useState({ active: false, progress: 0, file: "", status: "Ready" });

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved?.form) setForm(saved.form);
      if (Array.isArray(saved?.rows) && saved.rows.length) setRows(saved.rows);
    } catch (_) {}
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ form, rows }));
  }, [form, rows]);

  const total = useMemo(() => rows.reduce((sum, row) => sum + normalizeMoney(row.amount), 0), [rows]);

  function updateForm(field, value) {
    setForm(current => ({ ...current, [field]: value }));
  }

  function updateRow(id, field, value) {
    setRows(current => current.map(row => row.id === id ? { ...row, [field]: value } : row));
  }

  function addRow(prefill = {}) {
    setRows(current => [...current, { ...blankRow(), ...prefill }]);
  }

  async function processReceipt(file) {
    const accepted = /image\/(png|jpeg|webp)|application\/pdf/.test(file.type) || /\.(png|jpe?g|webp|pdf)$/i.test(file.name);
    if (!accepted) {
      message.error("Use a PDF, PNG, JPG, or WebP receipt.");
      return Upload.LIST_IGNORE;
    }
    setScan({ active: true, progress: 4, file: file.name, status: "Preparing receipt" });
    try {
      const source = await fileToOcrSource(file);
      const result = await Tesseract.recognize(source, "eng", {
        logger: event => {
          if (event.status === "recognizing text") {
            setScan(current => ({ ...current, progress: Math.round(event.progress * 100), status: "Reading receipt text" }));
          }
        }
      });
      const extracted = extractReceiptFields(result.data.text, file.name);
      setRows(current => {
        const prefill = { amount: extracted.amount, reason: extracted.reason, source: file.name };
        const emptyIndex = current.findIndex(row => !row.budgetCode && !row.amount && !row.reason);
        if (emptyIndex >= 0) return current.map((row, index) => index === emptyIndex ? { ...row, ...prefill } : row);
        return [...current, { ...blankRow(), ...prefill }];
      });
      setScan({ active: false, progress: 100, file: file.name, status: "Imported for review" });
      message.success("Receipt imported. Review the amount, reason, and budget code.");
    } catch (error) {
      console.error(error);
      setScan({ active: false, progress: 0, file: file.name, status: "Could not read receipt" });
      message.error("OCR could not read this receipt. You can still enter it manually.");
    }
    return false;
  }

  function exportRows() {
    return rows.filter(row => row.budgetCode || row.amount || row.reason).map((row, index) => ({
      "Line": index + 1,
      "Department": form.department,
      "Month": form.month,
      "Today's Date": form.reportDate,
      "Budget Code": row.budgetCode,
      "Amount": normalizeMoney(row.amount),
      "Reason for Purchase": row.reason,
      "Source Receipt": row.source,
      "Signature": form.signature,
      "Signature Date": form.signatureDate
    }));
  }

  function validateExport() {
    const data = exportRows();
    if (!data.length) {
      message.warning("Add at least one purchase before exporting.");
      return null;
    }
    if (!form.department || !form.month) {
      message.warning("Department and month are required.");
      return null;
    }
    return data;
  }

  function exportCsv() {
    const data = validateExport();
    if (!data) return;
    const headers = Object.keys(data[0]);
    const csv = [headers, ...data.map(Object.values)].map(row => row.map(escapeCsv).join(",")).join("\n");
    download(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }), `ReceiptKing-${dayjs().format("YYYY-MM-DD")}.csv`);
  }

  function exportXlsx() {
    const data = validateExport();
    if (!data) return;
    const book = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(data);
    sheet["!cols"] = [6, 22, 17, 14, 18, 12, 42, 24, 22, 16].map(wch => ({ wch }));
    XLSX.utils.book_append_sheet(book, sheet, "Purchasing Import");
    XLSX.writeFile(book, `ReceiptKing-${dayjs().format("YYYY-MM-DD")}.xlsx`);
  }

  function exportPdf() {
    const data = validateExport();
    if (!data) return;
    if (!window.jspdf?.jsPDF) {
      message.error("The PDF exporter could not load. Please refresh and try again.");
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const reportTotal = data.reduce((sum, row) => sum + normalizeMoney(row.Amount), 0);

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
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Department: ${form.department || ""}`, 38, 100);
    doc.text(`Month: ${form.month || ""}`, 300, 100);
    doc.text(`Today's Date: ${form.reportDate || ""}`, 525, 100);

    doc.autoTable({
      startY: 120,
      head: [["#", "Budget Code", "Amount", "Reason for Purchase", "Source Receipt"]],
      body: data.map(row => [
        row.Line,
        row["Budget Code"],
        `$${normalizeMoney(row.Amount).toFixed(2)}`,
        row["Reason for Purchase"],
        row["Source Receipt"]
      ]),
      theme: "grid",
      headStyles: { fillColor: [22, 63, 54], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [246, 247, 242] },
      styles: { font: "helvetica", fontSize: 9, cellPadding: 6, lineColor: [223, 229, 223] },
      columnStyles: {
        0: { cellWidth: 34, halign: "center" },
        1: { cellWidth: 120 },
        2: { cellWidth: 82, halign: "right" },
        3: { cellWidth: 260 },
        4: { cellWidth: 150 }
      }
    });

    const finalY = doc.lastAutoTable.finalY + 24;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`Report Total: $${reportTotal.toFixed(2)}`, 38, finalY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Signature / Printed Name: ${form.signature || ""}`, 38, finalY + 34);
    doc.text(`Date: ${form.signatureDate || ""}`, 420, finalY + 34);

    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setTextColor(109, 120, 115);
    doc.setFontSize(8);
    doc.text("OCR assists with data entry. Staff remain responsible for reviewing purchasing records.", 38, pageHeight - 26);
    doc.save(`ReceiptKing-${dayjs().format("YYYY-MM-DD")}.pdf`);
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <ConfigProvider theme={{ token: {
      colorPrimary: "#163f36", colorInfo: "#225b4e", colorSuccess: "#4f7a55",
      borderRadius: 10, fontFamily: '"DM Sans", system-ui, sans-serif', controlHeight: 42
    } }}>
      <div className="app-shell">
        <header className="topbar">
          <div className="brand">
            <img src="favicon.svg" alt="ReceiptKing Emperor Tamarin mark" />
            <div><div className="brand-name">ReceiptKing</div><div className="brand-note">Emperor UI · Purchasing organized</div></div>
          </div>
          <div className="privacy-pill"><LockOutlined /><span>Local browser processing</span></div>
        </header>

        <section className="hero">
          <div>
            <div className="eyebrow">Emperor UI · Receipt automation, built simply</div>
            <h1>From receipt pile to <span>clean records.</span></h1>
            <p>Upload a receipt, review the OCR results, add the City budget code, and export a purchasing-ready spreadsheet without retyping every line.</p>
            <div className="feature-row">
              <div className="feature-chip">PDF + image OCR</div>
              <div className="feature-chip">Excel + CSV exports</div>
              <div className="feature-chip">No account required</div>
            </div>
          </div>
          <div className="monkey-card" aria-label="Emperor Tamarin brand panel">
            <div className="monkey-scene"><img src="favicon.svg" alt="Emperor Tamarin mascot" /></div>
            <div className="monkey-caption">
              <div><strong>The little king of receipts.</strong><span>Fast intake. Human review. Clean handoff.</span></div>
              <div className="crown-number">01</div>
            </div>
          </div>
        </section>

        <main className="workspace">
          <div className="section-head">
            <div><h2>City credit card expense form</h2><p>Based on the current Long Beach purchasing template.</p></div>
            <Tag color="green">Version 1</Tag>
          </div>

          <div className="workspace-grid">
            <aside className="left-rail">
              <div className="panel panel-pad">
                <div className="panel-title"><h3>Report details</h3><span className="step-number">1</span></div>
                <div className="field-grid">
                  <label className="wide"><span className="form-label">Department</span><Input value={form.department} onChange={e => updateForm("department", e.target.value)} /></label>
                  <label><span className="form-label">Month</span><DatePicker picker="month" format="MMMM YYYY" value={dayjs(form.month, "MMMM YYYY")} onChange={date => updateForm("month", date?.format("MMMM YYYY") || "")} style={{ width: "100%" }} /></label>
                  <label><span className="form-label">Today's Date</span><DatePicker value={dayjs(form.reportDate)} onChange={date => updateForm("reportDate", date?.format("YYYY-MM-DD") || "")} style={{ width: "100%" }} /></label>
                </div>
              </div>

              <div className="panel panel-pad" style={{ marginTop: 20 }}>
                <div className="panel-title"><h3>Import receipt</h3><span className="step-number">2</span></div>
                <Upload.Dragger className="upload-zone" accept=".pdf,.png,.jpg,.jpeg,.webp" showUploadList={false} beforeUpload={processReceipt} disabled={scan.active}>
                  <div className="upload-icon"><CloudUploadOutlined /></div>
                  <p className="upload-title">Drop or choose a receipt</p>
                  <p className="upload-hint">PDF, PNG, JPG, or WebP. OCR suggests the amount and purchase reason for your review.</p>
                </Upload.Dragger>
                {(scan.active || scan.file) && <div className="scan-status"><strong>{scan.status}</strong><Progress percent={scan.progress} size="small" showInfo={scan.active} /><div className="scan-meta">{scan.file}</div></div>}
                <div className="security-note"><SafetyCertificateOutlined style={{ marginTop: 2 }} /><span>Version 1 processes files in your browser. Receipt images are not saved to a ReceiptKing server.</span></div>
              </div>
            </aside>

            <section>
              <div className="panel ledger-panel">
                <div className="ledger-toolbar">
                  <div><h3>Purchases</h3><div className="row-count">{rows.length} {rows.length === 1 ? "line" : "lines"} in this report</div></div>
                  <Button icon={<PlusOutlined />} onClick={() => addRow()}>Add line</Button>
                </div>
                <div className="table-wrap">
                  <table className="ledger-table">
                    <thead><tr><th>#</th><th>Budget Code</th><th>Amount</th><th>Reason for Purchase</th><th></th></tr></thead>
                    <tbody>
                      {rows.map((row, index) => <tr key={row.id}>
                        <td className="row-index">{index + 1}</td>
                        <td className="code-col"><Input value={row.budgetCode} placeholder="Enter code" onChange={e => updateRow(row.id, "budgetCode", e.target.value)} /></td>
                        <td className="amount-col"><Input prefix="$" inputMode="decimal" value={row.amount} placeholder="0.00" onChange={e => updateRow(row.id, "amount", e.target.value)} /></td>
                        <td><Input.TextArea autoSize={{ minRows: 1, maxRows: 4 }} value={row.reason} placeholder="Business reason for purchase" onChange={e => updateRow(row.id, "reason", e.target.value)} /><div className="scan-meta" style={{ marginTop: 5 }}>{row.source}</div></td>
                        <td className="action-col"><Button type="text" danger icon={<DeleteOutlined />} aria-label={`Delete line ${index + 1}`} onClick={() => setRows(current => current.length === 1 ? [blankRow()] : current.filter(item => item.id !== row.id))} /></td>
                      </tr>)}
                    </tbody>
                  </table>
                </div>
                <div className="summary-bar"><div><div className="summary-label">Report total</div><div className="summary-total">${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div></div><div className="summary-label">Review all OCR values before submission</div></div>
              </div>

              <div className="panel panel-pad approval-card">
                <div className="panel-title"><h3>Approval and export</h3><span className="step-number">3</span></div>
                <div className="approval-grid">
                  <label><span className="form-label">Signature / Printed Name</span><Input value={form.signature} placeholder="Enter name" onChange={e => updateForm("signature", e.target.value)} /></label>
                  <label><span className="form-label">Date</span><DatePicker value={dayjs(form.signatureDate)} onChange={date => updateForm("signatureDate", date?.format("YYYY-MM-DD") || "")} style={{ width: "100%" }} /></label>
                  <div className="export-row">
                    <Button type="primary" icon={<FilePdfOutlined />} onClick={exportPdf}>PDF</Button>
                    <Button icon={<FileExcelOutlined />} onClick={exportXlsx}>Excel</Button>
                    <Button icon={<FileTextOutlined />} onClick={exportCsv}>CSV</Button>
                    <Button icon={<PrinterOutlined />} onClick={() => window.print()}>Print</Button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </main>
        <footer className="footer">ReceiptKing v1 · OCR assists with data entry, but staff remain responsible for reviewing purchasing records.</footer>
      </div>
    </ConfigProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
