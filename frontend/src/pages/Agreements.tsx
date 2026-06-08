import { useState, useEffect } from "react";
import { Printer } from "lucide-react";

import Arch from "./Arch";
import Interior from "./Interior";
import ArchInterior from "./ArchInterior";
import EleganceInterior from "./EleganceInterior";

// Helper function to format date as dd-mm-yyyy
const getCurrentDateDDMMYYYY = () => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return `${day}-${month}-${year}`;
};

/* ───────── PRINT CSS ───────── */
const PRINT_CSS = `
@media print {
  @page { size: A4 portrait; margin: 0; }

  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .no-print { display: none !important; }

  .print-area {
    display: block !important;
    width: 100% !important;
    background: #fff !important;
  }

  .page {
    width: 100% !important;
    min-height: 290mm !important;
    margin: 0 !important;
    page-break-after: always;
  }

  .page:last-child {
    page-break-after: auto;
  }
}
`;

function PrintStyles() {
  return (
    <style dangerouslySetInnerHTML={{
      __html: `
      ${PRINT_CSS}
      @media (max-width: 1024px) {
        #agreement-container {
          flex-direction: column !important;
          padding: 10px !important;
        }
        #agreement-sidebar {
          width: 100% !important;
          max-height: 500px !important;
          position: relative !important;
          top: 0 !important;
          margin-bottom: 20px !important;
          overflow-y: auto !important;
        }
        .print-area {
          width: 100% !important;
          padding: 0 !important;
        }
      }
    ` }} />
  );
}

function convertNumberToWords(price: string | number): string {
  if (!price) return "";
  const num = parseInt(price.toString().replace(/,/g, '').replace(/[^\d]/g, ''), 10);
  if (isNaN(num)) return "";
  if (num === 0) return "Zero";

  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ',
    'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ',
    'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  let numStr = num.toString();
  if (numStr.length > 9) return "overflow";
  let n = ('000000000' + numStr).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return "";

  let str = '';
  str += (Number(n[1]) != 0) ? (a[Number(n[1])] || b[Number(n[1][0])] + ' ' + a[Number(n[1][1])]) + 'Crore ' : '';
  str += (Number(n[2]) != 0) ? (a[Number(n[2])] || b[Number(n[2][0])] + ' ' + a[Number(n[2][1])]) + 'Lakh ' : '';
  str += (Number(n[3]) != 0) ? (a[Number(n[3])] || b[Number(n[3][0])] + ' ' + a[Number(n[3][1])]) + 'Thousand ' : '';
  str += (Number(n[4]) != 0) ? (a[Number(n[4])] || b[Number(n[4][0])] + ' ' + a[Number(n[4][1])]) + 'Hundred ' : '';
  str += (Number(n[5]) != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[Number(n[5][0])] + ' ' + a[Number(n[5][1])]) : '';

  return str.trim() + " Only";
}

export default function Agreements() {
  const [templateType, setTemplateType] = useState("arch_interior");

  /* ── Standard agreement fields ── */
  const [refId, setRefId]             = useState("PR_2026_009/01");
  const [title, setTitle]             = useState("Mr.");
  const [clientName, setClientName]   = useState("");
  const [address, setAddress]         = useState("");
  const [feeAmount, setFeeAmount]     = useState("");
  const [date, setDate]               = useState(getCurrentDateDDMMYYYY());
  const [place, setPlace]             = useState("");
  const [paymentStages, setPaymentStages] = useState([
    { stage: "Retainer",  description: "On appointment/ Signing of the agreement/ Acceptance of the offer",   percentage: "10%" },
    { stage: "Stage 1",   description: "On finalization of basic plans, floor plans and elevation",             percentage: "20%" },
    { stage: "Stage 2",   description: "On preparation of working drawings for, commencement of work",         percentage: "10%" },
    { stage: "Stage 3",   description: "On commencement of construction work at site or within 6 months of Stage 2, whichever is earlier", percentage: "10%" },
    { stage: "Stage 4",   description: "Finalisation of Interior design concept and specifications",            percentage: "20%" },
    { stage: "Stage 5",   description: "Preparation of working drawings for interior works",                   percentage: "10%" },
    { stage: "Stage 6",   description: "On completion of wood works",                                          percentage: "10%" },
    { stage: "Stage 7",   description: "On Completion of the project",                                         percentage: "10%" },
  ]);

  /* ── Elegance Interior-specific fields ── */
  const [eleganceClientName, setEleganceClientName]   = useState("Mrs Kinnera");
  const [eleganceDate, setEleganceDate]               = useState(getCurrentDateDDMMYYYY());
  const [contractValue, setContractValue]             = useState("42,18,130");
  const [contractValueWords, setContractValueWords]   = useState("Forty Two Lakhs Eighteen Thousand One Hundred and Thirty");
  const [completionDays, setCompletionDays]           = useState("120");

  /* Auto-compute words from numeric value */
  const handleContractValueChange = (val: string) => {
    setContractValue(val);
    const words = convertNumberToWords(val);
    if (words && words !== "overflow") setContractValueWords(words);
  };

  const handleStageChange = (index: number, field: string, value: string) => {
    const updatedStages = [...paymentStages];
    updatedStages[index][field] = value;
    setPaymentStages(updatedStages);
  };

  const addStage = () => setPaymentStages([...paymentStages, { stage: "", description: "", percentage: "" }]);

  const removeStage = (index: number) => setPaymentStages(paymentStages.filter((_, i) => i !== index));

  const handlePrint = () => window.print();

  const calculateTotalPercentage = () =>
    paymentStages.reduce((acc, stage) => {
      const val = parseFloat(stage.percentage.replace('%', '')) || 0;
      return acc + val;
    }, 0);

  const renderTemplate = () => {
    if (templateType === "elegance_interior") {
      return (
        <EleganceInterior
          clientName={eleganceClientName}
          date={eleganceDate}
          contractValue={contractValue}
          contractValueWords={contractValueWords}
          completionDays={completionDays}
        />
      );
    }

    const totalPercentage = calculateTotalPercentage();
    const salutation = title === "Mr." ? "Sir" : "Madam";
    const feeWords = convertNumberToWords(feeAmount);
    const displayFee = feeWords ? `Rs. ${feeAmount}/- (Rupees ${feeWords})` : feeAmount;
    const fullClientName = `${title} ${clientName}`.trim();

    const props = {
      clientName: fullClientName,
      salutation,
      refId,
      address,
      feeAmount: displayFee,
      date,
      place,
      paymentStages,
      totalPercentage: totalPercentage + "%"
    };

    switch (templateType) {
      case "interior_only":       return <Interior {...props} />;
      case "arch_consultation":   return <Arch {...props} />;
      case "arch_interior":       return <ArchInterior {...props} />;
      default:                    return <div>No Template</div>;
    }
  };

  const isElegance = templateType === "elegance_interior";

  return (
    <>
      <PrintStyles />

      {/* HEADER */}
      <div className="no-print" style={styles.header}>
        <h2>Invoices</h2>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={styles.topBtn}>Accounts</button>
          <button style={{ ...styles.topBtn, color: "red" }}>Log Out</button>
        </div>
      </div>

      {/* MAIN LAYOUT */}
      <div style={styles.container} id="agreement-container">

        {/* LEFT SIDEBAR FORM */}
        <div className="no-print" style={styles.sidebar} id="agreement-sidebar">
          <h2 style={styles.title}>Proposal Generator</h2>
          <p style={styles.subtitle}>Select consultation type and fill details</p>

          <div style={styles.form}>

            {/* Consultation Type */}
            <div style={styles.group}>
              <label>Consultation Type</label>
              <select style={styles.input} value={templateType} onChange={(e) => setTemplateType(e.target.value)}>
                <option value="interior_only">Interior Design</option>
                <option value="arch_consultation">Arch Consultation</option>
                <option value="arch_interior">Architecture + Interior</option>
                <option value="elegance_interior">Elegance Interior Designing</option>
              </select>
            </div>

            {/* ── ELEGANCE INTERIOR FIELDS ── */}
            {isElegance ? (
              <>
                <div style={styles.group}>
                  <label>Date</label>
                  <input style={styles.input} type="text" value={eleganceDate}
                    onChange={(e) => setEleganceDate(e.target.value)}
                    placeholder="dd-mm-yyyy" />
                </div>

                <div style={styles.group}>
                  <label>Client Name</label>
                  <input style={styles.input} value={eleganceClientName}
                    onChange={(e) => setEleganceClientName(e.target.value)}
                    placeholder="e.g. Mrs Kinnera" />
                </div>

                <div style={styles.group}>
                  <label>Contract Value (₹) — Numbers only</label>
                  <input style={styles.input} type="text" value={contractValue}
                    onChange={(e) => handleContractValueChange(e.target.value)}
                    placeholder="e.g. 4218130" />
                </div>

                <div style={styles.group}>
                  <label>Amount in Words</label>
                  <textarea
                    style={{ ...styles.input, minHeight: 70, fontFamily: "inherit", resize: "vertical" }}
                    value={contractValueWords}
                    onChange={(e) => setContractValueWords(e.target.value)}
                    placeholder="Auto-filled from value above, or type manually"
                  />
                </div>

                <div style={styles.group}>
                  <label>Completion Period (Days)</label>
                  <input style={styles.input} type="number" value={completionDays}
                    onChange={(e) => setCompletionDays(e.target.value)}
                    min={1} />
                </div>
              </>
            ) : (
              /* ── STANDARD FIELDS ── */
              <>
                <div style={styles.group}>
                  <label>Date</label>
                  <input style={styles.input} type="text" value={date}
                    onChange={(e) => setDate(e.target.value)}
                    placeholder="dd-mm-yyyy" />
                </div>

                <div style={styles.group}>
                  <label>Place</label>
                  <input style={styles.input} value={place}
                    onChange={(e) => setPlace(e.target.value)} />
                </div>

                <div style={styles.group}>
                  <label>Ref Number</label>
                  <input style={styles.input} value={refId}
                    onChange={(e) => setRefId(e.target.value)} />
                </div>

                <div style={styles.group}>
                  <label>Client Name</label>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <select style={{ ...styles.input, width: "90px" }} value={title}
                      onChange={(e) => setTitle(e.target.value)}>
                      <option value="Mr.">Mr.</option>
                      <option value="Ms.">Ms.</option>
                      <option value="Mrs.">Mrs.</option>
                      <option value="Miss">Miss</option>
                    </select>
                    <input style={{ ...styles.input, flex: 1 }} value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="First and Last Name" />
                  </div>
                </div>

                <div style={styles.group}>
                  <label>Project / Address</label>
                  <input style={styles.input} value={address}
                    onChange={(e) => setAddress(e.target.value)} />
                </div>

                <div style={styles.group}>
                  <label>Professional Fees</label>
                  <input style={styles.input} type="text" value={feeAmount}
                    onChange={(e) => setFeeAmount(e.target.value)} />
                </div>

                <div style={{ marginTop: '10px' }}>
                  <label style={{ fontWeight: 'bold', fontSize: '14px' }}>Payment Schedule</label>
                  {paymentStages.map((stage, index) => (
                    <div key={index} style={{ marginBottom: '15px', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600 }}>Stage {index + 1}</span>
                        <button onClick={() => removeStage(index)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer', fontSize: '12px' }}>Remove</button>
                      </div>
                      <input style={{ ...styles.input, marginBottom: '5px', width: '100%', boxSizing: 'border-box' }}
                        placeholder="Stage Name" value={stage.stage}
                        onChange={(e) => handleStageChange(index, 'stage', e.target.value)} />
                      <textarea style={{ ...styles.input, marginBottom: '5px', width: '100%', minHeight: '60px', fontFamily: 'inherit', boxSizing: 'border-box' }}
                        placeholder="Description" value={stage.description}
                        onChange={(e) => handleStageChange(index, 'description', e.target.value)} />
                      <input style={{ ...styles.input, width: '100%', boxSizing: 'border-box' }}
                        placeholder="Percentage (e.g. 10%)" value={stage.percentage}
                        onChange={(e) => handleStageChange(index, 'percentage', e.target.value)} />
                    </div>
                  ))}
                  <button onClick={addStage} style={{ ...styles.topBtn, width: '100%', marginTop: '5px', backgroundColor: '#f8fafc' }}>
                    + Add Stage
                  </button>
                </div>
              </>
            )}
          </div>

          <button onClick={handlePrint} style={styles.printBtn}>
            <Printer size={16} /> Print / Save PDF
          </button>
        </div>

        {/* RIGHT PREVIEW */}
        <div className="print-area" style={styles.preview}>
          {renderTemplate()}
        </div>
      </div>
    </>
  );
}

/* ───────── STYLES ───────── */
const styles = {
  header: {
    display: "flex",
    justifyContent: "space-between",
    padding: "14px 20px",
    borderBottom: "1px solid #e5e7eb",
    background: "#fff"
  },
  topBtn: {
    padding: "6px 12px",
    borderRadius: "20px",
    border: "1px solid #cbd5e1",
    background: "#fff",
    cursor: "pointer"
  },
  container: {
    display: "flex",
    gap: "20px",
    padding: "20px",
    alignItems: "flex-start",
    minHeight: "100vh"
  },
  sidebar: {
    width: "340px",
    flexShrink: 0,
    background: "#ffffff",
    padding: "20px",
    borderRadius: "12px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
    maxHeight: "calc(100vh - 160px)",
    overflowY: "auto" as const,
    position: "sticky" as const,
    top: "20px"
  },
  title: { margin: 0, fontSize: "20px", fontWeight: "700" },
  subtitle: { fontSize: "13px", color: "#64748b", marginBottom: "15px" },
  form: { display: "flex", flexDirection: "column" as const, gap: "14px" },
  group: { display: "flex", flexDirection: "column" as const, gap: "6px", fontSize: "13px" },
  row: { display: "flex", gap: "10px" },
  input: {
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    fontSize: "14px",
    outline: "none"
  },
  printBtn: {
    marginTop: "15px",
    padding: "12px",
    borderRadius: "10px",
    background: "#1e293b",
    color: "#fff",
    border: "none",
    fontWeight: "600",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    width: "100%"
  },
  preview: {
    flex: 1,
    padding: "20px",
    borderRadius: "12px",
    overflow: "auto"
  }
};