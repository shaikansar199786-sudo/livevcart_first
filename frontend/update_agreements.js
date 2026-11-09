import React, { useState, useEffect, useMemo } from "react";
import { 
  Printer, Plus, Trash2, Edit3, ArrowLeft, Search, FileText, 
  ChevronDown, ChevronRight, Download, RotateCcw, Eye, Copy, 
  ExternalLink, Filter, BarChart2, Bookmark, Check, Layers, X
} from "lucide-react";
import { API_BASE_URL } from '../config';
import LivincartContract, { DEFAULT_BRANDS_LIST, DEFAULT_INTERIOR_INSTALLMENTS, type BrandItem, type InteriorInstallmentItem } from "./LivincartContract";
import LivincartFurnitureContract, { DEFAULT_FURNITURE_SCHEDULE, type FurniturePaymentStage } from "./LivincartFurnitureContract";
import { useAuth } from '../hooks/useAuth';
import QuoteTab from '../components/QuoteTab';

// Helper function to format date as dd-mm-yyyy or MMM DD, YYYY
const formatDisplayDate = (dStr: string) => {
  if (!dStr) return "-";
  try {
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dStr;
  }
};

const PRINT_CSS = `
@media print {
  @page { 
    size: A4 portrait; 
    margin: 20mm !important; 
  }

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
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
  }

  .print-area *, 
  [style*="background-color: #f5f5f5"], 
  [style*="background-color: rgb(245, 245, 245)"] {
    background-color: transparent !important;
    background: transparent !important;
    box-shadow: none !important;
  }

  .page {
    width: 100% !important;
    min-height: auto !important;
    margin: 0 !important;
    padding: 0 !important;
    box-shadow: none !important;
    page-break-after: avoid !important;
    break-after: avoid !important;
  }

  tr, td, th, p, li, h2, h3 {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
}
`;

function PrintStyles() {
  return <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />;
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
  str += (Number(n[1]) !== 0) ? (a[Number(n[1])] || b[Number(n[1][0])] + ' ' + a[Number(n[1][1])]) + 'Crore ' : '';
  str += (Number(n[2]) !== 0) ? (a[Number(n[2])] || b[Number(n[2][0])] + ' ' + a[Number(n[2][1])]) + 'Lakh ' : '';
  str += (Number(n[3]) !== 0) ? (a[Number(n[3])] || b[Number(n[3][0])] + ' ' + a[Number(n[3][1])]) + 'Thousand ' : '';
  str += (Number(n[4]) !== 0) ? (a[Number(n[4])] || b[Number(n[4][0])] + ' ' + a[Number(n[4][1])]) + 'Hundred ' : '';
  str += (Number(n[5]) !== 0) ? ((str !== '') ? 'and ' : '') + (a[Number(n[5])] || b[Number(n[5][0])] + ' ' + a[Number(n[5][1])]) : '';

  return str.trim() + " Rupees Only";
}

export default function Agreements() {
  const { user } = useAuth();
  const [agreements, setAgreements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isListView, setIsListView] = useState(true);
  const [editingId, setEditingId] = useState<any>(null);

  // Accordion Section States matching reference UI
  const [isFiltersOpen, setIsFiltersOpen] = useState(true);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isGraphOpen, setIsGraphOpen] = useState(false);

  // Expanded Table Rows State
  const [expandedRows, setExpandedRows] = useState<{ [key: string]: boolean }>({});
  const [selectedRows, setSelectedRows] = useState<{ [key: string]: boolean }>({});
  const [previewAgreement, setPreviewAgreement] = useState<any>(null);

  // Filters State
  const [agreementTypeFilter, setAgreementTypeFilter] = useState("Active Agreement");
  const [statusFilter, setStatusFilter] = useState("All");
  const [clientFilter, setClientFilter] = useState("All");
  const [contactFilter, setContactFilter] = useState("All");
  const [dateRangeFilter, setDateRangeFilter] = useState("All");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);

  /* ── Form Fields for Agreement Generator ── */
  const [refId, setRefId] = useState("PR_2026_009/01");
  const [projectType, setProjectType] = useState("Interior Design");
  const [title, setTitle] = useState("Mr.");
  const [clientName, setClientName] = useState("K Ranjit Kumar");
  const [address, setAddress] = useState("10-79/7/2, GF-104, AMMUS GREEN VALLEY, SAGAR NAGAR, ENDADA, Visakhapatnam – 530045");
  const [feeAmount, setFeeAmount] = useState("9,70,097");
  const [feeWords, setFeeWords] = useState("Nine Lakhs Seventy Thousand Ninety-Seven Rupees Only");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [place, setPlace] = useState("Visakhapatnam");
  const [status, setStatus] = useState("Created");
  const [includeQuotation, setIncludeQuotation] = useState(true);
  const [includeContract, setIncludeContract] = useState(true);
  const [includeHandover, setIncludeHandover] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState<"general" | "custom">("general");

  /* ── Interior Contract Editable Clauses & Brand Table States ── */
  const [convenienceFeeNote, setConvenienceFeeNote] = useState("Note: A non-refundable Convenience fee of 2% (including GST) on payment amount may be levied on certain modes of payment including Credit card /Debit card/Net Banking/Wallet/Etc.");
  const [deliveryInstallationNote, setDeliveryInstallationNote] = useState("Note: Back panel shall be Livincart Aquashield-MDF for all carcasses in any core material other than BWP (Boiling water proof) Ply. For all carcass with BWP (Boiling water proof) Ply as core material; the back panel (wherever applicable) is to be Ply.");
  const [cancellationMinAmount, setCancellationMinAmount] = useState("1,50,000");
  const [bookingScenarioDate, setBookingScenarioDate] = useState("29th October, 2025 onwards");
  const [installmentsList, setInstallmentsList] = useState<InteriorInstallmentItem[]>(DEFAULT_INTERIOR_INSTALLMENTS);

  const handleInstallmentChange = (index: number, val: string) => {
    setInstallmentsList(prev => prev.map((item, i) => i === index ? { ...item, description: val } : item));
  };

  const handleAddInstallmentRow = () => {
    const nextNum = installmentsList.length + 1;
    const letter = String.fromCharCode(96 + nextNum);
    setInstallmentsList(prev => [...prev, { label: `${nextNum}th Installment (${letter})`, description: `${nextNum}th Installment – description...` }]);
  };

  const handleDeleteInstallmentRow = (index: number) => {
    setInstallmentsList(prev => prev.filter((_, i) => i !== index));
  };

  const [brandsList, setBrandsList] = useState<BrandItem[]>(DEFAULT_BRANDS_LIST);

  const handleBrandChange = (index: number, field: 'category' | 'brands', val: string) => {
    setBrandsList(prev => prev.map((item, i) => i === index ? { ...item, [field]: val } : item));
  };

  const handleAddBrandRow = () => {
    setBrandsList(prev => [...prev, { category: "New Category", brands: "Brand Names" }]);
  };

  /* ── Furniture Contract Editable Payment Schedule State ── */
  const [furniturePaymentSchedule, setFurniturePaymentSchedule] = useState<FurniturePaymentStage[]>(DEFAULT_FURNITURE_SCHEDULE);

  const handleFurnitureStageChange = (index: number, field: 'stage' | 'percentage', val: string) => {
    setFurniturePaymentSchedule(prev => prev.map((item, i) => i === index ? { ...item, [field]: val } : item));
  };

  const handleAddFurnitureStageRow = () => {
    setFurniturePaymentSchedule(prev => [...prev, { stage: "New Milestone", percentage: "0%" }]);
  };

  const handleDeleteFurnitureStageRow = (index: number) => {
    setFurniturePaymentSchedule(prev => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    fetchAgreements();
  }, []);

  const fetchAgreements = async () => {
    setLoading(true);
    try {
      // Fetch both saved agreements and active projects so sales manager entries automatically reflect!
      const [agRes, projRes] = await Promise.all([
        fetch(`${API_BASE_URL}/agreements`).then(r => r.json()).catch(() => ({ success: false, data: [] })),
        fetch(`${API_BASE_URL}/projects`).then(r => r.json()).catch(() => ({ success: false, data: [] }))
      ]);

      const savedAgreements = agRes.success ? (agRes.data || []) : [];
      const projects = projRes.success ? (projRes.data || []) : [];

      const existingRefIds = new Set(savedAgreements.map((a: any) => a.ref_id));
      
      // Transform projects added by Sales into automatic agreement records
      const projectAgreements = projects.map((p: any) => {
        const refCode = p.project_code || `PR_${p.project_id}`;
        if (!existingRefIds.has(refCode)) {
          return {
            id: `proj_${p.project_id}`,
            isFromProject: true,
            project_id: p.project_id,
            ref_id: refCode,
            client_name: p.client_name || p.project_name || 'Client',
            address: p.site_address || 'Visakhapatnam',
            contract_value: parseFloat(p.total_budget || 0).toLocaleString(),
            contract_value_words: convertNumberToWords(p.total_budget || 0),
            date: p.start_date || (p.created_at ? p.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
            place: 'Visakhapatnam',
            status: p.status === 'completed' ? 'Signed' : (p.status || 'Created'),
            payment_date: '-'
          };
        }
        return null;
      }).filter(Boolean);

      setAgreements([...savedAgreements, ...projectAgreements]);
    } catch (err) {
      console.error("Error fetching agreements:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFeeAmountChange = (val: string) => {
    setFeeAmount(val);
    const words = convertNumberToWords(val);
    if (words && words !== "overflow") setFeeWords(words);
  };

  const handlePrint = () => window.print();

  const resetForm = () => {
    setEditingId(null);
    setRefId("PR_2026_" + Math.floor(100 + Math.random() * 900) + "/01");
    setTitle("Mr.");
    setClientName("");
    setAddress("");
    setFeeAmount("");
    setFeeWords("");
    setDate(new Date().toISOString().split("T")[0]);
    setPlace("Visakhapatnam");
    setStatus("Created");
  };

  const resetFilters = () => {
    setStatusFilter("All");
    setClientFilter("All");
    setContactFilter("All");
    setDateRangeFilter("All");
    setAgreementTypeFilter("Active Agreement");
  };

  const handleSave = async (statusVal = "Created") => {
    if (!clientName || !address || !feeAmount) {
      alert("Please fill all mandatory fields (Client Name, Address, Contract Value)");
      return;
    }
    
    try {
      const payload = {
        id: typeof editingId === 'number' ? editingId : undefined,
        ref_id: refId,
        client_name: `${title} ${clientName}`.trim(),
        address: address,
        contract_value: feeAmount,
        contract_value_words: feeWords,
        date: date,
        place: place,
        status: statusVal
      };

      const res = await fetch(`${API_BASE_URL}/agreements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (json.success) {
        alert(json.message);
        fetchAgreements();
        setIsListView(true);
        resetForm();
      } else {
        alert("Error: " + json.message);
      }
    } catch (err) {
      console.error("Error saving agreement:", err);
      alert("Failed to save agreement");
    }
  };

  const handleEdit = (ag: any) => {
    setEditingId(ag.id);
    setRefId(ag.ref_id || `PR_${ag.id}`);
    
    const nameStr = ag.client_name || "";
    const titleMatch = nameStr.match(/^(Mr\.|Ms\.|Mrs\.|Miss)\s+(.*)$/);
    if (titleMatch) {
      setTitle(titleMatch[1]);
      setClientName(titleMatch[2]);
    } else {
      setTitle("Mr.");
      setClientName(nameStr);
    }
    
    setAddress(ag.address || "");
    setFeeAmount(ag.contract_value || "");
    setFeeWords(ag.contract_value_words || convertNumberToWords(ag.contract_value));
    setDate(ag.date || new Date().toISOString().split("T")[0]);
    setPlace(ag.place || "Visakhapatnam");
    setStatus(ag.status || "Created");
    setIsListView(false);
  };

  const handleCopy = (ag: any) => {
    resetForm();
    setRefId(`PR_2026_${Math.floor(100 + Math.random() * 900)}/01`);
    setClientName(`${ag.client_name} (Copy)`);
    setAddress(ag.address);
    setFeeAmount(ag.contract_value);
    setFeeWords(ag.contract_value_words);
    setDate(new Date().toISOString().split("T")[0]);
    setIsListView(false);
  };

  const handleDelete = async (id: any) => {
    if (!confirm("Are you sure you want to delete this agreement?")) return;
    if (typeof id === 'string' && id.startsWith('proj_')) {
      alert("This item is automatically linked from Sales Projects. Delete it in Projects tab.");
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/agreements/${id}`, {
        method: "DELETE"
      });
      const json = await res.json();
      if (json.success) {
        alert(json.message);
        fetchAgreements();
      } else {
        alert("Error: " + json.message);
      }
    } catch (err) {
      console.error("Error deleting agreement:", err);
      alert("Failed to delete agreement");
    }
  };

  const handlePrintRow = (ag: any) => {
    handleEdit(ag);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const toggleRowExpand = (id: string | number) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSelectAll = () => {
    if (Object.keys(selectedRows).length === filteredAgreements.length) {
      setSelectedRows({});
    } else {
      const allSel: { [key: string]: boolean } = {};
      filteredAgreements.forEach(ag => { allSel[ag.id] = true; });
      setSelectedRows(allSel);
    }
  };

  const toggleSelectRow = (id: string | number) => {
    setSelectedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Filter Logic
  const filteredAgreements = agreements.filter(ag => {
    const matchesStatus = statusFilter === "All" || (ag.status || 'Created').toLowerCase() === statusFilter.toLowerCase();
    const matchesClient = clientFilter === "All" || ag.client_name === clientFilter;
    return matchesStatus && matchesClient;
  });

  // Unique clients for dropdown
  const uniqueClients = Array.from(new Set(agreements.map(a => a.client_name))).filter(Boolean);

  // Pagination calculation
  const totalRecords = filteredAgreements.length;
  const totalPages = Math.ceil(totalRecords / rowsPerPage) || 1;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedAgreements = filteredAgreements.slice(startIndex, startIndex + rowsPerPage);

  // Export handlers
  const handleExportCSV = () => {
    const headers = ["Date", "Ref Number", "Client Name", "Contract Value", "Status", "Place", "Address"];
    const rows = filteredAgreements.map(a => [
      a.date, a.ref_id, `"${a.client_name}"`, `"${a.contract_value}"`, a.status, `"${a.place}"`, `"${a.address}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Agreements_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowDownloadDropdown(false);
  };

  const activeProjectObj = useMemo(() => {
    const currentAg = agreements.find(a => a.id === editingId || a.ref_id === refId);
    const fullClientName = `${title ? title + ' ' : ''}${clientName}`.trim();
    const pId = currentAg?.project_id || currentAg?.lead_id || (refId && refId.includes('PR_') ? refId.replace('PR_', '') : (refId && refId !== 'standalone' ? refId : fullClientName));
    return {
      project_id: pId,
      project_name: `${fullClientName} Quotation`,
      client_name: fullClientName,
      site_address: address,
      total_budget: feeAmount,
      manual_client_id: refId
    };
  }, [editingId, refId, title, clientName, address, feeAmount, agreements]);

  const renderTemplate = (
    typeVal = projectType,
    cName = `${title ? title + ' ' : ''}${clientName}`.trim(),
    dVal = date,
    valAmt = feeAmount,
    wordsVal = feeWords,
    addrVal = address,
    rId = refId,
    incHandover = includeHandover,
    incQuotation = includeQuotation,
    incContract = includeContract
  ) => {
    return (
      <div className="merged-package-wrapper print-area">
        <style>{`
          /* Force ALL background colors to print in Agreement PDF */
          .agreements-print-preview,
          .agreements-print-preview * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          .agreements-print-preview .no-print,
          .agreements-print-preview .btn-action,
          .agreements-print-preview .summary-actions,
          .agreements-print-preview button,
          .agreements-print-preview .sidebar-card,
          .agreements-print-preview [class*="switch-toggle"],
          .agreements-print-preview .quote-header-card > div:last-child {
            display: none !important;
          }

          .agreements-print-preview .accordion-header {
            display: flex !important;
            visibility: visible !important;
            pointer-events: none !important;
            cursor: default !important;
          }

          .agreements-print-preview .print-only,
          .agreements-print-preview .print-running-footer {
            display: block !important;
            visibility: visible !important;
          }

          .agreements-print-preview input,
          .agreements-print-preview select,
          .agreements-print-preview textarea {
            border: none !important;
            background: transparent !important;
            box-shadow: none !important;
            pointer-events: none !important;
            color: #0f172a !important;
            font-weight: 700 !important;
            padding: 0 !important;
            margin: 0 !important;
            outline: none !important;
            appearance: none !important;
            -webkit-appearance: none !important;
            font-size: inherit !important;
          }

          .agreements-print-preview .quote-container {
            background: #ffffff !important;
            padding: 0 !important;
            min-height: auto !important;
          }

          .agreements-print-preview .accordion-content,
          .agreements-print-preview .section-card,
          .agreements-print-preview .subsection-wrapper {
            display: block !important;
            visibility: visible !important;
            box-shadow: none !important;
            border-color: #cbd5e1 !important;
          }

          @media screen {
            .merged-package-wrapper {
              background-color: #ffffff !important;
              padding: 0 !important;
              margin: 0 !important;
              border-radius: 0 !important;
              box-sizing: border-box !important;
              width: 100% !important;
            }

            .agreements-print-preview {
              position: relative !important;
              max-width: 100% !important;
              width: 100% !important;
              margin: 0 auto 20px auto !important;
              padding: 0 !important;
              background: #ffffff !important;
              border: none !important;
              border-radius: 0 !important;
              box-shadow: none !important;
              box-sizing: border-box !important;
              overflow-x: hidden !important;
            }

            .agreements-print-preview .print-running-footer {
              position: relative !important;
              bottom: auto !important;
              left: auto !important;
              right: auto !important;
              width: 100% !important;
              margin-top: 24px !important;
              clear: both !important;
              border-top: 1px solid #cbd5e1 !important;
            }

            .agreements-print-preview * {
              max-width: 100% !important;
              box-sizing: border-box !important;
            }

            .agreements-print-preview .page-break-cover,
            .agreements-print-preview .page-break-project-info,
            .agreements-print-preview .page-break-modules-summary,
            .agreements-print-preview .page-break-section {
              min-height: auto !important;
              height: auto !important;
              display: block !important;
              box-sizing: border-box !important;
            }

            .agreements-print-preview .item-grid {
              display: flex !important;
              flex-wrap: wrap !important;
              gap: 8px !important;
            }

            .agreements-print-preview table {
              width: 100% !important;
              table-layout: fixed !important;
              word-wrap: break-word !important;
            }

            .agreements-print-preview th,
            .agreements-print-preview td {
              word-break: break-word !important;
              overflow-wrap: break-word !important;
            }
          }

          @media print {
            .merged-package-wrapper {
              background: #ffffff !important;
              padding: 0 !important;
              margin: 0 !important;
              position: relative !important;
              display: block !important;
              box-shadow: none !important;
              width: 100% !important;
              max-width: 100% !important;
            }

            .agreements-print-preview {
              max-width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              border: none !important;
              box-shadow: none !important;
              background: #ffffff !important;
              display: block !important;
              visibility: visible !important;
              position: relative !important;
            }

            /* Make all content inside agreements-print-preview visible and strip shadows */
            .agreements-print-preview,
            .agreements-print-preview * {
              visibility: visible !important;
              box-shadow: none !important;
              border-radius: 0 !important;
            }

            /* Force page breaks exactly like the Quote PDF */
            .agreements-print-preview .page-break-cover {
              page-break-after: always !important;
              break-after: page !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              display: flex !important;
              flex-direction: column !important;
              justify-content: space-between !important;
              align-items: center !important;
              min-height: 270mm !important;
              box-sizing: border-box !important;
              width: 100% !important;
            }

            .agreements-print-preview .page-break-project-info,
            .agreements-print-preview .page-break-modules-summary,
            .agreements-print-preview .page-break-section,
            .agreements-print-preview .page-break-summary,
            .agreements-print-preview [class*="page-break"] {
              page-break-after: always !important;
              break-after: page !important;
              page-break-inside: auto !important;
              break-inside: auto !important;
              display: block !important;
              min-height: 265mm !important;
              padding-left: 0 !important;
              padding-right: 0 !important;
              padding-bottom: 60px !important;
              margin-left: 0 !important;
              margin-right: 0 !important;
              box-sizing: border-box !important;
              width: 100% !important;
              position: relative !important;
              box-shadow: none !important;
            }

            .agreements-print-preview table tr {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }

            .agreements-print-preview .print-running-footer {
              position: absolute !important;
              bottom: 12px !important;
              left: 0 !important;
              right: 0 !important;
              width: 100% !important;
              display: block !important;
              box-shadow: none !important;
            }

            /* Ensure quote tab root inside agreement prints in sequence without overlapping */
            .agreements-print-preview .quote-tab-root {
              position: relative !important;
              display: block !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: visible !important;
              box-shadow: none !important;
            }

            .agreements-print-preview .quote-container {
              display: block !important;
              visibility: visible !important;
              position: relative !important;
              top: auto !important;
              left: auto !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              box-shadow: none !important;
              border-radius: 0 !important;
            }
          }
        `}</style>

        {/* 1. OFFICIAL READ-ONLY QUOTATION PRINT PDF VIEW FROM QUOTES PAGE (http://localhost:5173/quotes) */}
        {incQuotation && (() => {
          const matchedAg = agreements.find(a => a.ref_id === rId || (a.client_name && cName && a.client_name.toLowerCase().trim() === cName.toLowerCase().trim()));
          const resolvedProjId = matchedAg?.project_id || matchedAg?.lead_id || (rId && rId !== 'standalone' ? rId : cName);
          return (
            <div className="agreements-print-preview" style={{ pageBreakAfter: (incContract || incHandover) ? "always" : "auto", breakAfter: (incContract || incHandover) ? "page" : "auto", marginBottom: "30px" }}>
              <QuoteTab
                project={{
                  project_id: resolvedProjId,
                  project_name: `${cName} Quotation`,
                  client_name: cName,
                  site_address: addrVal,
                  total_budget: valAmt,
                  manual_client_id: rId
                }}
                user={user}
                isReadOnly={true}
                hideSave={true}
                isAgreementPdfView={true}
              />
            </div>
          );
        })()}

        {/* 2. WORKS CONTRACT AGREEMENT (IF SELECTED) */}
        {incContract && (
          <div>
            {typeVal === "Furniture Design" ? (
              <LivincartFurnitureContract
                clientName={cName}
                date={formatDisplayDate(dVal)}
                contractValue={valAmt}
                contractValueWords={wordsVal || convertNumberToWords(valAmt)}
                address={addrVal}
                refId={rId}
                includeHandover={incHandover}
                furniturePaymentSchedule={furniturePaymentSchedule}
              />
            ) : (
              <LivincartContract
                clientName={cName}
                date={formatDisplayDate(dVal)}
                contractValue={valAmt}
                contractValueWords={wordsVal || convertNumberToWords(valAmt)}
                address={addrVal}
                refId={rId}
                includeHandover={incHandover}
                convenienceFeeNote={convenienceFeeNote}
                deliveryInstallationNote={deliveryInstallationNote}
                cancellationMinAmount={cancellationMinAmount}
                bookingScenarioDate={bookingScenarioDate}
                installmentsList={installmentsList}
                brandsList={brandsList}
              />
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ backgroundColor: "#f8fafc", minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif", color: "#1e293b" }}>
      <PrintStyles />

      {/* TOP HEADER */}
      <div className="no-print" style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "16px 32px",
        backgroundColor: "#ffffff",
        borderBottom: "1px solid #e2e8f0",
        boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <FileText size={24} color="#253b50" />
          <div>
            <h1 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 800, color: "#0f172a" }}>
              Agreements & Works Contracts
            </h1>
            <span style={{ fontSize: "0.8rem", color: "#64748b" }}>Manage proposals, client contracts, and live sales leads</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          {isListView ? (
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "10px 18px", backgroundColor: "#253b50", color: "white",
                border: "none", borderRadius: "8px", fontWeight: 700, fontSize: "0.88rem",
                cursor: "pointer", boxShadow: "0 2px 6px rgba(37,59,80,0.2)"
              }}
            >
              <Plus size={18} /> Create New Agreement
            </button>
          ) : (
            <button
              onClick={() => { setIsListView(true); resetForm(); }}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "10px 18px", backgroundColor: "#ffffff", color: "#334155",
                border: "1px solid #cbd5e1", borderRadius: "8px", fontWeight: 700, fontSize: "0.88rem",
                cursor: "pointer"
              }}
            >
              <ArrowLeft size={18} /> Back to Dashboard
            </button>
          )}
        </div>
      </div>

      {isListView ? (
        /* =========================================================================
           MODE 1: DASHBOARD LIST VIEW (MATCHING USER REFERENCE IMAGE EXACTLY)
           ========================================================================= */
        <div className="no-print" style={{ padding: "24px 32px", maxWidth: "100%", margin: "0 auto" }}>

          {/* 1. COLLAPSIBLE FILTERS BAR CARD */}
          <div style={{
            backgroundColor: "#ffffff",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
            padding: "14px 20px",
            marginBottom: "16px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
                {/* Active Agreement Dropdown Pill */}
                <div style={{ position: "relative" }}>
                  <select
                    value={agreementTypeFilter}
                    onChange={(e) => setAgreementTypeFilter(e.target.value)}
                    style={{
                      appearance: "none",
                      padding: "8px 32px 8px 14px",
                      borderRadius: "8px",
                      border: "1.5px solid #a855f7",
                      backgroundColor: "#ffffff",
                      color: "#7e22ce",
                      fontWeight: 700,
                      fontSize: "0.88rem",
                      cursor: "pointer",
                      outline: "none"
                    }}
                  >
                    <option value="Active Agreement">Active Agreement</option>
                    <option value="Active Quotation">Active Quotation</option>
                    <option value="Draft Agreements">Draft Agreements</option>
                    <option value="Archived Contracts">Archived Contracts</option>
                  </select>
                  <ChevronDown size={16} color="#7e22ce" style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                </div>

                {/* Filter Pills */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  {/* Status Filter */}
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{
                      padding: "7px 14px", borderRadius: "20px", border: "1px solid #cbd5e1",
                      backgroundColor: "#ffffff", color: "#334155", fontWeight: 600, fontSize: "0.82rem",
                      cursor: "pointer", outline: "none"
                    }}
                  >
                    <option value="All">Status: All</option>
                    <option value="Created">Status: Created</option>
                    <option value="Draft">Status: Draft</option>
                    <option value="Signed">Status: Signed</option>
                    <option value="Active">Status: Active</option>
                  </select>

                  {/* Client Filter */}
                  <select
                    value={clientFilter}
                    onChange={(e) => setClientFilter(e.target.value)}
                    style={{
                      padding: "7px 14px", borderRadius: "20px", border: "1px solid #cbd5e1",
                      backgroundColor: "#ffffff", color: "#334155", fontWeight: 600, fontSize: "0.82rem",
                      cursor: "pointer", outline: "none"
                    }}
                  >
                    <option value="All">Client: All</option>
                    {uniqueClients.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>

                  {/* Contact Filter */}
                  <select
                    value={contactFilter}
                    onChange={(e) => setContactFilter(e.target.value)}
                    style={{
                      padding: "7px 14px", borderRadius: "20px", border: "1px solid #cbd5e1",
                      backgroundColor: "#ffffff", color: "#334155", fontWeight: 600, fontSize: "0.82rem",
                      cursor: "pointer", outline: "none"
                    }}
                  >
                    <option value="All">Contact: All</option>
                  </select>

                  {/* Date Range Filter */}
                  <select
                    value={dateRangeFilter}
                    onChange={(e) => setDateRangeFilter(e.target.value)}
                    style={{
                      padding: "7px 14px", borderRadius: "20px", border: "1px solid #cbd5e1",
                      backgroundColor: "#ffffff", color: "#334155", fontWeight: 600, fontSize: "0.82rem",
                      cursor: "pointer", outline: "none"
                    }}
                  >
                    <option value="All">Date Range: All</option>
                    <option value="7days">Last 7 Days</option>
                    <option value="thisMonth">This Month</option>
                    <option value="thisYear">This Year</option>
                  </select>
                </div>
              </div>

              {/* Right Action Buttons */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <button
                  onClick={resetFilters}
                  style={{
                    display: "flex", alignItems: "center", gap: "6px",
                    padding: "7px 14px", backgroundColor: "transparent", border: "none",
                    color: "#64748b", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer"
                  }}
                >
                  <RotateCcw size={14} /> Reset
                </button>
                <button
                  style={{
                    display: "flex", alignItems: "center", gap: "6px",
                    padding: "7px 14px", backgroundColor: "#ffffff", border: "1px solid #cbd5e1",
                    borderRadius: "8px", color: "#64748b", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer"
                  }}
                >
                  <Bookmark size={14} /> Save as Report <ChevronDown size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* 2. COLLAPSIBLE AGREEMENT SUMMARY BAR */}
          <div style={{
            backgroundColor: "#ffffff",
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
            marginBottom: "12px",
            overflow: "hidden"
          }}>
            <div
              onClick={() => setIsSummaryOpen(!isSummaryOpen)}
              style={{
                padding: "14px 20px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                cursor: "pointer",
                fontWeight: 800,
                fontSize: "0.95rem",
                color: "#1e293b",
                userSelect: "none"
              }}
            >
              {isSummaryOpen ? <ChevronDown size={18} color="#475569" /> : <ChevronRight size={18} color="#475569" />}
              <span>Agreement Summary</span>
            </div>
            {isSummaryOpen && (
              <div style={{ padding: "20px", borderTop: "1px solid #f1f5f9", backgroundColor: "#fafafa" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                  <div style={{ padding: "16px", backgroundColor: "#ffffff", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                    <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>Total Agreements</div>
                    <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#0f172a", marginTop: "4px" }}>{totalRecords}</div>
                  </div>
                  <div style={{ padding: "16px", backgroundColor: "#ffffff", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                    <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>Active / Created</div>
                    <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#0284c7", marginTop: "4px" }}>
                      {agreements.filter(a => a.status === 'Created' || a.status === 'Active' || !a.status).length}
                    </div>
                  </div>
                  <div style={{ padding: "16px", backgroundColor: "#ffffff", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                    <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>Signed Contracts</div>
                    <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#16a34a", marginTop: "4px" }}>
                      {agreements.filter(a => a.status === 'Signed').length}
                    </div>
                  </div>
                  <div style={{ padding: "16px", backgroundColor: "#ffffff", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                    <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>Total Value</div>
                    <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#7c3aed", marginTop: "4px" }}>
                      ₹{agreements.reduce((sum, a) => sum + (parseFloat(String(a.contract_value || 0).replace(/,/g, '')) || 0), 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 3. COLLAPSIBLE AGREEMENT GRAPH BAR */}
          <div style={{
            backgroundColor: "#ffffff",
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
            marginBottom: "20px",
            overflow: "hidden"
          }}>
            <div
              onClick={() => setIsGraphOpen(!isGraphOpen)}
              style={{
                padding: "14px 20px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                cursor: "pointer",
                fontWeight: 800,
                fontSize: "0.95rem",
                color: "#1e293b",
                userSelect: "none"
              }}
            >
              {isGraphOpen ? <ChevronDown size={18} color="#475569" /> : <ChevronRight size={18} color="#475569" />}
              <span>Agreement Graph</span>
            </div>
            {isGraphOpen && (
              <div style={{ padding: "30px", borderTop: "1px solid #f1f5f9", textAlign: "center", color: "#64748b" }}>
                <BarChart2 size={48} style={{ opacity: 0.4, margin: "0 auto 10px" }} />
                <div>Agreement trends graph visualization area</div>
              </div>
            )}
          </div>

          {/* 4. PAGINATION & DOWNLOAD BAR */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "16px" }}>
            <div style={{ fontSize: "0.88rem", color: "#64748b", fontWeight: 600 }}>
              Showing <strong style={{ color: "#0f172a" }}>{totalRecords === 0 ? 0 : startIndex + 1}</strong> to <strong style={{ color: "#0f172a" }}>{Math.min(startIndex + rowsPerPage, totalRecords)}</strong> of <strong style={{ color: "#0f172a" }}>{totalRecords}</strong> Agreements
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              {/* Rows Per Page */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", color: "#475569", fontWeight: 600 }}>
                <span>Rows/Page</span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                  style={{
                    padding: "6px 12px", borderRadius: "6px", border: "1px solid #cbd5e1",
                    backgroundColor: "#ffffff", fontWeight: 700, fontSize: "0.85rem", outline: "none", cursor: "pointer"
                  }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>

              {/* Download As Dropdown */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setShowDownloadDropdown(!showDownloadDropdown)}
                  style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    padding: "7px 14px", backgroundColor: "#ffffff", border: "1px solid #cbd5e1",
                    borderRadius: "8px", color: "#475569", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer"
                  }}
                >
                  <Download size={15} /> Download As <ChevronDown size={14} />
                </button>
                {showDownloadDropdown && (
                  <div style={{
                    position: "absolute", right: 0, top: "100%", marginTop: "6px",
                    backgroundColor: "#ffffff", borderRadius: "8px", border: "1px solid #e2e8f0",
                    boxShadow: "0 10px 25px rgba(0,0,0,0.1)", zIndex: 50, minWidth: "160px", overflow: "hidden"
                  }}>
                    <button onClick={handleExportCSV} style={{ width: "100%", padding: "10px 14px", border: "none", background: "transparent", textAlign: "left", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem", color: "#334155" }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                      Export CSV / Excel
                    </button>
                    <button onClick={() => { setShowDownloadDropdown(false); window.print(); }} style={{ width: "100%", padding: "10px 14px", border: "none", background: "transparent", textAlign: "left", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem", color: "#334155" }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                      Print All PDF
                    </button>
                  </div>
                )}
              </div>

              {/* View Layout Toggle Icons */}
              <div style={{ display: "flex", gap: "4px", backgroundColor: "#ffffff", padding: "4px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                <button style={{ border: "none", background: "#f1f5f9", borderRadius: "6px", padding: "6px", cursor: "pointer" }} title="Table View">
                  <Layers size={16} color="#0f172a" />
                </button>
              </div>
            </div>
          </div>

          {/* 5. MAIN AGREEMENTS DATA TABLE (MATCHING REFERENCE UI) */}
          <div style={{
            backgroundColor: "#ffffff",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
            overflow: "hidden"
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.88rem" }}>
              <thead>
                <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1.5px solid #e2e8f0", color: "#64748b", fontWeight: 700 }}>
                  <th style={{ padding: "14px 16px", width: "40px", textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={Object.keys(selectedRows).length > 0 && Object.keys(selectedRows).length === filteredAgreements.length}
                      onChange={toggleSelectAll}
                      style={{ cursor: "pointer", width: "16px", height: "16px" }}
                    />
                  </th>
                  <th style={{ padding: "14px 16px", color: "#475569" }}>
                    Date <span style={{ fontSize: "11px", color: "#94a3b8" }}>↓↑</span>
                  </th>
                  <th style={{ padding: "14px 16px", color: "#475569" }}>
                    + Expand Line Items
                  </th>
                  <th style={{ padding: "14px 16px", color: "#475569" }}>
                    Agreement # <span style={{ fontSize: "11px", color: "#94a3b8" }}>↓↑</span>
                  </th>
                  <th style={{ padding: "14px 16px", color: "#475569" }}>
                    Quoted To / Client
                  </th>
                  <th style={{ padding: "14px 16px", color: "#475569" }}>
                    Amount <span style={{ fontSize: "11px", color: "#94a3b8" }}>↓↑</span>
                  </th>
                  <th style={{ padding: "14px 16px", color: "#475569" }}>
                    Status
                  </th>
                  <th style={{ padding: "14px 16px", color: "#475569" }}>
                    Payment Date <span style={{ fontSize: "11px", color: "#94a3b8" }}>↓↑</span>
                  </th>
                  <th style={{ padding: "14px 16px", textAlign: "right", color: "#475569" }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                      Loading agreements...
                    </td>
                  </tr>
                ) : paginatedAgreements.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", padding: "50px 20px", color: "#64748b" }}>
                      <FileText size={48} style={{ margin: "0 auto 12px", display: "block", opacity: 0.3 }} />
                      <div style={{ fontWeight: 700, fontSize: "1rem", color: "#334155" }}>No Agreements Found</div>
                      <div style={{ fontSize: "0.85rem", marginTop: "4px" }}>Click "Create New Agreement" or add a sales lead to populate this list.</div>
                    </td>
                  </tr>
                ) : (
                  paginatedAgreements.map((ag, idx) => {
                    const isExpanded = !!expandedRows[ag.id];
                    const isSelected = !!selectedRows[ag.id];

                    return (
                      <React.Fragment key={ag.id}>
                        <tr style={{
                          borderBottom: isExpanded ? "none" : "1px solid #f1f5f9",
                          backgroundColor: isSelected ? "#f0f9ff" : (idx % 2 === 1 ? "#fafafa" : "#ffffff"),
                          transition: "background-color 0.15s"
                        }}>
                          {/* 1. Checkbox */}
                          <td style={{ padding: "14px 16px", textAlign: "center" }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectRow(ag.id)}
                              style={{ cursor: "pointer", width: "16px", height: "16px" }}
                            />
                          </td>

                          {/* 2. Date */}
                          <td style={{ padding: "14px 16px", color: "#475569", fontWeight: 600 }}>
                            {formatDisplayDate(ag.date)}
                          </td>

                          {/* 3. + Expand Line Items */}
                          <td style={{ padding: "14px 16px" }}>
                            <button
                              onClick={() => toggleRowExpand(ag.id)}
                              style={{
                                background: "transparent", border: "none", cursor: "pointer",
                                fontSize: "1.1rem", fontWeight: 800, color: "#64748b", padding: "2px 8px"
                              }}
                              title="Expand / Collapse Details"
                            >
                              {isExpanded ? "−" : "+"}
                            </button>
                          </td>

                          {/* 4. Agreement / Ref # */}
                          <td style={{ padding: "14px 16px", fontWeight: 800, color: "#0f172a", letterSpacing: "0.3px" }}>
                            {ag.ref_id || `AGR-${ag.id}`}
                          </td>

                          {/* 5. Quoted To / Client */}
                          <td style={{ padding: "14px 16px", fontWeight: 700, color: "#334155" }}>
                            {ag.client_name}
                            {ag.isFromProject && (
                              <span style={{ fontSize: "0.7rem", backgroundColor: "#eff6ff", color: "#2563eb", padding: "2px 6px", borderRadius: "4px", marginLeft: "8px", fontWeight: 700 }}>
                                Live Sales Lead
                              </span>
                            )}
                          </td>

                          {/* 6. Amount */}
                          <td style={{ padding: "14px 16px", fontWeight: 800, color: "#0f172a" }}>
                            ₹{parseFloat(String(ag.contract_value || 0).replace(/,/g, '')).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          {/* 7. Status Badge matching reference image */}
                          <td style={{ padding: "14px 16px" }}>
                            <span style={{
                              padding: "4px 14px",
                              borderRadius: "20px",
                              fontSize: "0.78rem",
                              fontWeight: 800,
                              display: "inline-block",
                              backgroundColor: (ag.status === 'Signed' || ag.status === 'completed') ? '#dcfce7' : ((ag.status === 'Active') ? '#dbeafe' : '#fef3c7'),
                              color: (ag.status === 'Signed' || ag.status === 'completed') ? '#15803d' : ((ag.status === 'Active') ? '#1d4ed8' : '#d97706')
                            }}>
                              {ag.status || 'Created'}
                            </span>
                          </td>

                          {/* 8. Payment Date */}
                          <td style={{ padding: "14px 16px", color: "#64748b" }}>
                            {ag.payment_date || "-"}
                          </td>

                          {/* 9. Actions matching reference UI icons */}
                          <td style={{ padding: "14px 16px", textAlign: "right" }}>
                            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "6px" }}>
                              {/* View Preview */}
                              <button
                                onClick={() => setPreviewAgreement(ag)}
                                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748b", padding: "4px", borderRadius: "4px" }}
                                title="Quick Preview"
                              >
                                <Eye size={16} />
                              </button>

                              {/* Open Contract Editor */}
                              <button
                                onClick={() => handleEdit(ag)}
                                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748b", padding: "4px", borderRadius: "4px" }}
                                title="Open Agreement Contract"
                              >
                                <ExternalLink size={16} />
                              </button>

                              {/* Edit */}
                              <button
                                onClick={() => handleEdit(ag)}
                                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#253b50", padding: "4px", borderRadius: "4px" }}
                                title="Edit Agreement"
                              >
                                <Edit3 size={16} />
                              </button>

                              {/* Copy / Duplicate */}
                              <button
                                onClick={() => handleCopy(ag)}
                                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748b", padding: "4px", borderRadius: "4px" }}
                                title="Duplicate Agreement"
                              >
                                <Copy size={16} />
                              </button>

                              {/* Delete */}
                              {user?.role !== 'sales' && (
                                <button
                                  onClick={() => handleDelete(ag.id)}
                                  style={{ background: "transparent", border: "none", cursor: "pointer", color: "#ef4444", padding: "4px", borderRadius: "4px" }}
                                  title="Delete Agreement"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Inline Line Items Expansion */}
                        {isExpanded && (
                          <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                            <td colSpan={9} style={{ padding: "16px 24px" }}>
                              <div style={{ backgroundColor: "#ffffff", padding: "16px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                                <div style={{ fontWeight: 800, fontSize: "0.9rem", color: "#0f172a", marginBottom: "8px" }}>
                                  Agreement Contract Summary Details:
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", fontSize: "0.85rem", color: "#475569" }}>
                                  <div><strong>Client Address:</strong> {ag.address || "N/A"}</div>
                                  <div><strong>Place of Execution:</strong> {ag.place || "Visakhapatnam"}</div>
                                  <div><strong>Contract Value in Words:</strong> {ag.contract_value_words || convertNumberToWords(ag.contract_value)}</div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* Bottom Pagination Bar */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "14px 20px", backgroundColor: "#ffffff", borderTop: "1px solid #e2e8f0"
            }}>
              <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
                Page {currentPage} of {totalPages}
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  style={{
                    padding: "6px 14px", borderRadius: "6px", border: "1px solid #cbd5e1",
                    backgroundColor: currentPage === 1 ? "#f1f5f9" : "#ffffff",
                    color: currentPage === 1 ? "#94a3b8" : "#334155",
                    cursor: currentPage === 1 ? "not-allowed" : "pointer", fontWeight: 600
                  }}
                >
                  Previous
                </button>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  style={{
                    padding: "6px 14px", borderRadius: "6px", border: "1px solid #cbd5e1",
                    backgroundColor: currentPage >= totalPages ? "#f1f5f9" : "#ffffff",
                    color: currentPage >= totalPages ? "#94a3b8" : "#334155",
                    cursor: currentPage >= totalPages ? "not-allowed" : "pointer", fontWeight: 600
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* =========================================================================
           MODE 2: AGREEMENT FORM & CONTRACT PREVIEW GENERATOR
           ========================================================================= */
        <div style={{ padding: "24px 32px" }} id="agreement-container">
          <div className="no-print" style={{
            backgroundColor: "#ffffff",
            borderRadius: "12px",
            padding: "24px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.05)",
            marginBottom: "24px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: "1.5px solid #f1f5f9", paddingBottom: "16px" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "#0f172a" }}>
                  {editingId ? "Edit Works Contract Agreement" : "Generate Works Contract Agreement"}
                </h2>
                <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "#64748b" }}>Fill in the details below to generate the agreement contract</p>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={() => handleSave("Draft")} style={{ padding: "9px 16px", borderRadius: "8px", backgroundColor: "#64748b", color: "#ffffff", border: "none", fontWeight: 700, cursor: "pointer" }}>
                  Save Draft
                </button>
                <button onClick={() => handleSave("Signed")} style={{ padding: "9px 16px", borderRadius: "8px", backgroundColor: "#16a34a", color: "#ffffff", border: "none", fontWeight: 700, cursor: "pointer" }}>
                  Mark Signed
                </button>
                <button onClick={() => { handleSave(status); handlePrint(); }} style={{ padding: "9px 16px", borderRadius: "8px", backgroundColor: "#fca311", color: "#ffffff", border: "none", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Printer size={16} /> Save & Print Contract PDF
                </button>
              </div>
            </div>

            {/* FORM NAVIGATION TABS */}
            <div style={{ display: "flex", gap: "12px", borderBottom: "2px solid #e2e8f0", marginBottom: "20px" }}>
              <button
                onClick={() => setActiveFormTab("general")}
                style={{
                  padding: "10px 18px",
                  border: "none",
                  background: "transparent",
                  borderBottom: activeFormTab === "general" ? "3px solid #253b50" : "3px solid transparent",
                  fontWeight: 800,
                  fontSize: "0.9rem",
                  color: activeFormTab === "general" ? "#253b50" : "#64748b",
                  cursor: "pointer"
                }}
              >
                1. General Details & Package Documents
              </button>
              <button
                onClick={() => setActiveFormTab("custom")}
                style={{
                  padding: "10px 18px",
                  border: "none",
                  background: "transparent",
                  borderBottom: activeFormTab === "custom" ? "3px solid #253b50" : "3px solid transparent",
                  fontWeight: 800,
                  fontSize: "0.9rem",
                  color: activeFormTab === "custom" ? "#253b50" : "#64748b",
                  cursor: "pointer"
                }}
              >
                2. Edit Works Contract Agreement
              </button>
            </div>

            {activeFormTab === "general" ? (
              <div>
                {/* SELECT AGREEMENT PACKAGE TYPE DROPDOWN SELECTOR */}
                <div style={{ marginBottom: "20px", padding: "14px 16px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 800, color: "#0f172a", marginBottom: "6px" }}>
                    Select Agreement Package Type:
                  </label>
                  <select
                    value={projectType}
                    onChange={(e) => setProjectType(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.9rem",
                      backgroundColor: "#ffffff",
                      fontWeight: 700,
                      color: "#0f172a",
                      outline: "none"
                    }}
                  >
                    <option value="Interior Design">Interior Agreement (Works Contract & Interior Handover PDF)</option>
                    <option value="Furniture Design">Furniture Agreement (Works Contract & Furniture Handover PDF)</option>
                  </select>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "20px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Date</label>
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem" }} />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Place of Execution</label>
                    <input value={place} onChange={(e) => setPlace(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem" }} />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Agreement / Ref Number</label>
                    <input value={refId} onChange={(e) => setRefId(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem" }} />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Project Type</label>
                    <select value={projectType} onChange={(e) => setProjectType(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem", backgroundColor: "#fff", fontWeight: 700 }}>
                      <option value="Interior Design">Interior Design</option>
                      <option value="Furniture Design">Furniture Design</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Client Name</label>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <select value={title} onChange={(e) => setTitle(e.target.value)} style={{ padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem", width: "80px" }}>
                        <option value="Mr.">Mr.</option>
                        <option value="Ms.">Ms.</option>
                        <option value="Mrs.">Mrs.</option>
                        <option value="Miss">Miss</option>
                      </select>
                      <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="First and Last Name" style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem" }} />
                    </div>
                  </div>

                  <div style={{ gridColumn: "span 2" }}>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Project / Site Address</label>
                    <input value={address} onChange={(e) => setAddress(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem" }} />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Contract Value (₹)</label>
                    <input value={feeAmount} onChange={(e) => handleFeeAmountChange(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem" }} />
                  </div>

                  <div style={{ gridColumn: "span 2" }}>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Amount in Words</label>
                    <textarea rows={2} value={feeWords} onChange={(e) => setFeeWords(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem", resize: "vertical" }} />
                  </div>
                </div>

                {/* INCLUDED DOCUMENTS CHECKBOXES */}
                <div style={{ padding: "16px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 800, color: "#0f172a", marginBottom: "10px" }}>
                    Include Documents in Print / PDF Package:
                  </label>
                  <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: 700, fontSize: "0.88rem", color: "#334155" }}>
                      <input type="checkbox" checked={includeQuotation} onChange={(e) => setIncludeQuotation(e.target.checked)} style={{ width: "18px", height: "18px" }} />
                      Include Quotation (Quote PDF from Quotes Page)
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: 700, fontSize: "0.88rem", color: "#334155" }}>
                      <input type="checkbox" checked={includeContract} onChange={(e) => setIncludeContract(e.target.checked)} style={{ width: "18px", height: "18px" }} />
                      Include Works Contract (Agreement Terms)
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: 700, fontSize: "0.88rem", color: "#334155" }}>
                      <input type="checkbox" checked={includeHandover} onChange={(e) => setIncludeHandover(e.target.checked)} style={{ width: "18px", height: "18px" }} />
                      Include Handover PDF (Handover Terms & Guidelines)
                    </label>
                  </div>
                </div>
              </div>
            ) : (
              /* TAB 2: EDIT WORKS CONTRACT AGREEMENT CUSTOM CLAUSES */
              <div>
                <h3 style={{ margin: "0 0 14px 0", fontSize: "1.05rem", fontWeight: 800, color: "#0f172a" }}>
                  Edit Works Contract Agreement — Custom Clauses & Payment Milestones
                </h3>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Convenience Fee Note</label>
                    <textarea rows={3} value={convenienceFeeNote} onChange={(e) => setConvenienceFeeNote(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.85rem", resize: "vertical" }} />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Delivery & Installation Back Panel Note</label>
                    <textarea rows={3} value={deliveryInstallationNote} onChange={(e) => setDeliveryInstallationNote(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.85rem", resize: "vertical" }} />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Cancellation Minimum Amount (₹)</label>
                    <input value={cancellationMinAmount} onChange={(e) => setCancellationMinAmount(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem" }} />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Booking Scenario Date</label>
                    <input value={bookingScenarioDate} onChange={(e) => setBookingScenarioDate(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem" }} />
                  </div>
                </div>

                {/* INSTALLMENT SCHEDULE EDITOR */}
                {projectType !== "Furniture Design" ? (
                  <div style={{ marginBottom: "24px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "#0f172a" }}>Edit Installment Payment Schedule</h4>
                      <button onClick={handleAddInstallmentRow} style={{ padding: "6px 12px", borderRadius: "6px", backgroundColor: "#253b50", color: "#ffffff", border: "none", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
                        <Plus size={14} /> Add Installment Stage
                      </button>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {installmentsList.map((inst, idx) => (
                        <div key={idx} style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                          <span style={{ fontWeight: 800, fontSize: "0.82rem", color: "#475569", width: "160px", flexShrink: 0 }}>{inst.label}</span>
                          <input value={inst.description} onChange={(e) => handleInstallmentChange(idx, e.target.value)} style={{ flex: 1, padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.85rem" }} />
                          <button onClick={() => handleDeleteInstallmentRow(idx)} style={{ color: "#ef4444", background: "none", border: "none", cursor: "pointer", padding: "4px" }} title="Delete Row">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* FURNITURE PAYMENT SCHEDULE EDITOR */
                  <div style={{ marginBottom: "24px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "#0f172a" }}>Edit Furniture Payment Schedule</h4>
                      <button onClick={handleAddFurnitureStageRow} style={{ padding: "6px 12px", borderRadius: "6px", backgroundColor: "#253b50", color: "#ffffff", border: "none", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
                        <Plus size={14} /> Add Payment Stage
                      </button>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {furniturePaymentSchedule.map((stg, idx) => (
                        <div key={idx} style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                          <input value={stg.stage} onChange={(e) => handleFurnitureStageChange(idx, 'stage', e.target.value)} style={{ flex: 1, padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.85rem" }} />
                          <input value={stg.percentage} onChange={(e) => handleFurnitureStageChange(idx, 'percentage', e.target.value)} style={{ width: "100px", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.85rem" }} />
                          <button onClick={() => handleDeleteFurnitureStageRow(idx)} style={{ color: "#ef4444", background: "none", border: "none", cursor: "pointer", padding: "4px" }} title="Delete Row">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* BRAND SPECIFICATIONS TABLE EDITOR */}
                {projectType !== "Furniture Design" && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "#0f172a" }}>Edit Brand Specifications Table</h4>
                      <button onClick={handleAddBrandRow} style={{ padding: "6px 12px", borderRadius: "6px", backgroundColor: "#253b50", color: "#ffffff", border: "none", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
                        <Plus size={14} /> Add Brand Category
                      </button>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {brandsList.map((b, idx) => (
                        <div key={idx} style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                          <input value={b.category} onChange={(e) => handleBrandChange(idx, 'category', e.target.value)} style={{ width: "200px", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.85rem", fontWeight: 700 }} />
                          <input value={b.brands} onChange={(e) => handleBrandChange(idx, 'brands', e.target.value)} style={{ flex: 1, padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.85rem" }} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* CONTRACT PREVIEW AREA */}
          <div className="print-area" style={{ backgroundColor: "#ffffff", borderRadius: "12px", padding: "20px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
            {renderTemplate()}
          </div>
        </div>
      )}

      {/* QUICK PREVIEW MODAL */}
      {previewAgreement && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", justifyContent: "center", alignItems: "center", padding: "20px" }}>
          <div style={{ backgroundColor: "#ffffff", borderRadius: "12px", width: "90%", maxWidth: "800px", maxHeight: "90vh", overflow: "auto", padding: "24px", position: "relative" }}>
            <button onClick={() => setPreviewAgreement(null)} style={{ position: "absolute", top: "16px", right: "16px", border: "none", background: "transparent", cursor: "pointer", color: "#64748b" }}>
              <X size={24} />
            </button>
            <h3 style={{ margin: "0 0 16px 0", fontSize: "1.2rem", fontWeight: 800, color: "#0f172a" }}>Agreement Details — {previewAgreement.ref_id}</h3>
            <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "16px" }}>
              <LivincartContract
                clientName={previewAgreement.client_name}
                date={formatDisplayDate(previewAgreement.date)}
                contractValue={previewAgreement.contract_value}
                contractValueWords={previewAgreement.contract_value_words || convertNumberToWords(previewAgreement.contract_value)}
                address={previewAgreement.address}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
