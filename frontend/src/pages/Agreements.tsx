import React, { useState, useEffect, useMemo } from "react";
import ReactDOMServer from "react-dom/server";
import {
  Printer, Plus, Minus, Trash2, Edit3, ArrowLeft, Search, FileText,
  ChevronDown, ChevronRight, Download, RotateCcw, Eye, Copy,
  ExternalLink, Filter, BarChart2, Bookmark, Check, Layers, X,
  Share2, Mail, Send, Paperclip, Unlock, CheckCircle2, Loader2, PenTool
} from "lucide-react";
import { API_BASE_URL } from '../config';
import { ClientSignatureModal } from '../components/ClientSignatureModal';
import LivincartContract, { DEFAULT_BRANDS_LIST, DEFAULT_INTERIOR_INSTALLMENTS, type BrandItem, type InteriorInstallmentItem } from "./LivincartContract";
import LivincartFurnitureContract, { DEFAULT_FURNITURE_SCHEDULE, type FurniturePaymentStage } from "./LivincartFurnitureContract";
import { useAuth } from '../hooks/useAuth';
import QuoteTab from '../components/QuoteTab';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import { mergePdfBase64Array } from '../utils/pdfMerger';
import { LOGO_BASE64 } from '../assets/logoBase64';
import { buildOfficial4PageHtml } from '../utils/quotePdfHtmlBuilder';

// Helper function to parse dates safely without timezone shifts
const parseLocalDate = (rawDate: string | null | undefined): Date | null => {
  if (!rawDate) return null;
  const s = String(rawDate).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }
  const dt = new Date(rawDate);
  return isNaN(dt.getTime()) ? null : dt;
};

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

const computeSqft = (widthStr?: any, heightStr?: any, depthStr?: any, mode?: string) => {
  const w = parseFloat(widthStr || '0') || 0;
  const h = parseFloat(heightStr || '0') || 0;
  const d = parseFloat(depthStr || '0') || 0;
  if (w > 0 && h > 0) {
    if (d > 0) {
      return (w * h * d) / 27000000;
    }
    return (w * h) / 90000;
  }
  return 0;
};

const PRINT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

.merged-package-wrapper, .merged-package-wrapper *,
.agreements-contract-wrapper, .agreements-contract-wrapper *,
.agreements-print-preview, .agreements-print-preview *,
.print-area, .print-area * {
  font-family: "Inter", "Segoe UI", Arial, Helvetica, sans-serif !important;
  line-height: 1.55 !important;
  box-sizing: border-box !important;
  word-wrap: break-word !important;
  overflow-wrap: break-word !important;
}

.agreements-print-preview table th,
.agreements-print-preview table td {
  line-height: normal !important;
}

.agreements-contract-wrapper .page, .print-area .page {
  width: 100% !important;
  max-width: 100% !important;
  padding: 0 !important;
  margin: 0 !important;
  box-shadow: none !important;
  border: none !important;
  box-sizing: border-box !important;
}

.agreements-quotation-wrapper {
  margin: 0 auto 30px auto;
  width: 100%;
}

@media screen {
  .agreements-print-preview .page-wrap,
  .agreements-print-preview .page-wrap-last {
    margin: 0 auto 28px auto !important;
    background-color: #ffffff !important;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08) !important;
    border: 1px solid #e2e8f0 !important;
    border-radius: 8px !important;
    max-width: 794px !important;
    box-sizing: border-box !important;
  }
}

@media print {
  @page { 
    size: A4 portrait; 
    margin: 20mm 25mm 20mm 25mm !important; 
  }

  html, body, #root {
    background-color: #ffffff !important;
    background: #ffffff !important;
  }

  html, body {
    margin: 0 !important;
    padding: 0 !important;
  }

  .no-print { display: none !important; }

  .print-area, .merged-package-wrapper, .agreements-print-preview, .agreements-contract-wrapper, .contract-wrapper {
    display: block !important;
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 auto !important;
    padding: 0 !important;
    background: #ffffff !important;
    background-color: #ffffff !important;
    box-shadow: none !important;
    border: none !important;
  }

  .agreements-print-preview .page-wrap,
  .agreements-print-preview .page-wrap-last {
    margin: 0 auto !important;
    padding-left: 12px !important;
    padding-right: 12px !important;
    box-shadow: none !important;
    border: none !important;
    border-radius: 0 !important;
    page-break-after: always !important;
    break-after: page !important;
  }

  .page, .contract-document, .agreements-contract-wrapper .page {
    width: 100% !important;
    max-width: 100% !important;
    min-height: auto !important;
    margin: 0 auto !important;
    padding-left: 12px !important;
    padding-right: 12px !important;
    border: none !important;
    box-shadow: none !important;
    page-break-after: avoid !important;
    break-after: avoid !important;
  }

  tr, td, th, p, li, h2, h3 {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }

  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
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

export const isPlaceholderOrTestData = (str: string): boolean => {
  if (!str) return true;
  const s = str.trim().toLowerCase();
  const testPatterns = [
    'cluld', 'cluld test', 'placeholder', 'dummy', 'xxxx', 'asdf', 'fake', '______', 'mr. cluld', 'mr cluld'
  ];
  if (s.length < 2) return true;
  return testPatterns.some(pat => s === pat);
};

export default function Agreements() {
  const { user } = useAuth();
  const isAdmin = Boolean(
    user && (
      String(user.role || '').toLowerCase().includes('admin') ||
      String(user.role || '').toLowerCase() === 'owner' ||
      user.is_admin === 1 ||
      user.is_admin === true
    )
  );
  const [agreements, setAgreements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isListView, setIsListView] = useState(true);
  const [editingId, setEditingId] = useState<any>(null);

  // Accordion Section States matching reference UI
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isGraphOpen, setIsGraphOpen] = useState(false);

  // Expanded Table Rows State
  const SHOW_EXPAND_COLUMN = false;
  const [expandedRows, setExpandedRows] = useState<{ [key: string]: boolean }>({});
  const [selectedRows, setSelectedRows] = useState<{ [key: string]: boolean }>({});
  const [previewAgreement, setPreviewAgreement] = useState<any>(null);

  // Raw Loaded Lists for Auto Lookup
  const [allQuotesList, setAllQuotesList] = useState<any[]>([]);
  const [allProjectsList, setAllProjectsList] = useState<any[]>([]);
  const [orderConvertedQuotesList, setOrderConvertedQuotesList] = useState<any[]>([]);
  const [orderConvertedProjectsList, setOrderConvertedProjectsList] = useState<any[]>([]);

  // Actively Linked Quotation Data and Quotation History (Versions)
  const [quoteHistory, setQuoteHistory] = useState<any[]>([]);
  const [activeQuoteData, setActiveQuoteData] = useState<any | null>(null);
  const [loadingQuoteDetails, setLoadingQuoteDetails] = useState<boolean>(false);

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [agreementTypeFilter, setAgreementTypeFilter] = useState("Active Agreement");
  const [statusFilter, setStatusFilter] = useState("All");
  const [clientFilter, setClientFilter] = useState("All");
  const [contactFilter, setContactFilter] = useState("All");
  const [projectIdFilter, setProjectIdFilter] = useState("All");
  const [projectTypeFilter, setProjectTypeFilter] = useState("All");
  const [dateRangeFilter, setDateRangeFilter] = useState("All Time");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);

  /* ── Share Email Modal State ── */
  const [shareModalAgreement, setShareModalAgreement] = useState<any | null>(null);
  const [shareIncludeQuote, setShareIncludeQuote] = useState<boolean>(true);
  const [shareIncludeAgreement, setShareIncludeAgreement] = useState<boolean>(true);
  const [shareIncludeHandover, setShareIncludeHandover] = useState<boolean>(false);
  const [isAgreementSigned, setIsAgreementSigned] = useState<boolean>(false);
  const [shareSending, setShareSending] = useState<boolean>(false);
  const [shareEmailForm, setShareEmailForm] = useState({ to: '', subject: '', content: '' });
  const [sharePreviewPdfModal, setSharePreviewPdfModal] = useState<boolean>(false);

  /* ── Acknowledgement State ── */
  const [ackSendingId, setAckSendingId] = useState<string | number | null>(null);
  const [clientSignature, setClientSignature] = useState("");
  const [showSigModal, setShowSigModal] = useState(false);
  const [sigModalAgreement, setSigModalAgreement] = useState<any | null>(null);

  const openShareModal = (ag: any, options?: { onlyHandover?: boolean }) => {
    // Resolve client signature from agreement object, linked project, or component state
    let resolvedSig = ag?.client_signature || ag?.client_sign || '';
    if (!resolvedSig && (ag?.project_id || ag?.ref_id)) {
      const proj = allProjectsList.find((p: any) =>
        String(p.project_id) === String(ag.project_id) ||
        String(p.id) === String(ag.project_id) ||
        String(p.project_code) === String(ag.ref_id)
      );
      if (proj?.client_signature) resolvedSig = proj.client_signature;
    }
    if (!resolvedSig && clientSignature) {
      resolvedSig = clientSignature;
    }

    const agWithSig = { ...ag, client_signature: resolvedSig };
    setShareModalAgreement(agWithSig);
    if (resolvedSig) {
      setClientSignature(resolvedSig);
    }

    // Also fetch fresh from database if ag has an id and resolvedSig was empty
    if (!resolvedSig && ag?.id) {
      fetch(`${API_BASE_URL}/agreements/${ag.id}`)
        .then(r => r.json())
        .then(res => {
          if (res?.data?.client_signature) {
            setClientSignature(res.data.client_signature);
            setShareModalAgreement((prev: any) => prev ? { ...prev, client_signature: res.data.client_signature } : prev);
          }
        })
        .catch(() => {});
    }

    const statusLower = String(ag?.status || '').toLowerCase().trim();
    const isSigned = statusLower === 'signed' || statusLower === 'approved' || statusLower === 'order_converted' || statusLower === 'completed' || statusLower === 'deal_done' || ag?.is_signed === 1 || ag?.is_signed === true;

    setIsAgreementSigned(isSigned);

    const isHandoverEligible = statusLower === 'completed' || ag?.project_stage === 'handover' || ag?.stage5_paid === 1 || ag?.is_100_percent_paid === 1;

    if (options?.onlyHandover) {
      if (!isHandoverEligible) {
        alert('🔒 Handover Document is locked: Project requires 100% full payment (Stage 5 milestone) before Handover can be shared.');
        return;
      }
      setShareIncludeQuote(false);
      setShareIncludeAgreement(false);
      setShareIncludeHandover(true);
    } else {
      setShareIncludeQuote(true);
      setShareIncludeAgreement(true);
      setShareIncludeHandover(false);
    }

    const cName = ag.client_name || 'Valued Client';
    const cEmail = ag.client_email || `${cName.toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com`;
    const valStr = (ag.contract_value && ag.contract_value !== '0' && ag.contract_value !== '₹0') ? ag.contract_value : '1,18,000';
    setShareEmailForm({
      to: cEmail,
      subject: options?.onlyHandover
        ? `Final Handover Terms & Guidelines for ${cName} - Livincart`
        : `Official Project Documents for ${cName} - Livincart`,
      content: options?.onlyHandover
        ? `Dear ${cName},\n\nCongratulations on reaching the final handover milestone of your project with Livincart!\n\nPlease find attached the official Final Project Handover Document (Handover Terms & Guidelines) for your review and records.\n\nAgreement Reference: ${ag.ref_id || 'N/A'}\n\nWe thank you for placing your trust in Livincart and wish you all the best in your new space!\n\nWarm regards,\nLivincart Team`
        : `Dear ${cName},\n\nThank you for choosing Livincart!\n\nPlease find attached the official project document package for your project.\n\nAgreement Reference: ${ag.ref_id || 'N/A'}\nContract Value: ₹${valStr}\n\nPlease review the attached document package. Contact us if you have any questions.\n\nWarm regards,\nLivincart Team`
    });

    const pTarget = ag?.project_id || ag?.project_code || ag?.ref_id || ag?.client_name;
    const qTarget = ag?.quote_id || (String(ag?.id || '').startsWith('quote_') ? ag.id.replace('quote_', '') : undefined);
    if (pTarget || qTarget) {
      fetchQuoteDetailsAndHistory(pTarget, qTarget);
    }
  };

  // Guaranteed fallback helper for PDF generation when backend Puppeteer is offline
  const extractSectionsFromQuote = (q: any) => {
    if (!q) return [];
    let rawSections: any = q.sections || q.quote_data?.sections || [];
    
    if (typeof rawSections === 'string') {
      try {
        rawSections = JSON.parse(rawSections);
      } catch (e) {}
    }
    
    if ((!rawSections || !Array.isArray(rawSections) || rawSections.length === 0) && q.extra_data) {
      try {
        const parsed = typeof q.extra_data === 'string' ? JSON.parse(q.extra_data) : q.extra_data;
        if (parsed?.sections) {
          let sec = parsed.sections;
          if (typeof sec === 'string') {
            try { sec = JSON.parse(sec); } catch (e) {}
          }
          if (Array.isArray(sec)) rawSections = sec;
        }
      } catch (e) { }
    }

    if ((!rawSections || !Array.isArray(rawSections) || rawSections.length === 0) && (q.items || q.quote_items)) {
      let items = q.items || q.quote_items;
      if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch(e) {}
      }
      if (Array.isArray(items) && items.length > 0) {
        rawSections = [{ section_name: 'Scope Particulars', items: items }];
      }
    }

    const parsedSections = Array.isArray(rawSections) ? rawSections.map((s: any) => {
      let items = s.items || [];
      if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch (e) {}
      }
      return { ...s, items: Array.isArray(items) ? items : [] };
    }) : [];

    return parsedSections;
  };

  const getOrGenerateFallbackPdf = async (title: string, refId: string | number, preferElemId?: string, quoteData?: any): Promise<string> => {
    // 1. Data loading completion check & multi-tier fallback fetch if quote sections are missing
    if (title === 'Quotation' && (!quoteData || !quoteData.sections || quoteData.sections.length === 0)) {
      try {
        const pId = shareModalAgreement?.project_id || shareModalAgreement?.lead_id || projectIdInput;
        const qId = shareModalAgreement?.quote_id || selectedQuoteId;
        
        let fetched: any = null;
        if (qId && String(qId).trim().length > 0) {
          const cleanQId = String(qId).replace('quote_', '');
          const directRes = await fetch(`${API_BASE_URL}/quotes/${cleanQId}`).then(r => r.json()).catch(() => null);
          if (directRes?.data || directRes?.sections) {
            fetched = directRes?.data || directRes;
          }
        }

        if (!fetched && pId) {
          const qRes = await fetch(`${API_BASE_URL}/quotes/latest?project_id=${encodeURIComponent(pId)}`).then(r => r.json()).catch(() => null);
          if (qRes?.data || qRes?.sections) {
            fetched = qRes?.data || qRes;
          }
        }

        if (!fetched) {
          const cName = shareModalAgreement?.client_name || '';
          if (cName) {
            const qRes = await fetch(`${API_BASE_URL}/quotes/latest?client_name=${encodeURIComponent(cName)}`).then(r => r.json()).catch(() => null);
            if (qRes?.data || qRes?.sections) {
              fetched = qRes?.data || qRes;
            }
          }
        }

        if (fetched) {
          quoteData = fetched;
        }
      } catch (e) { }
    }

    // Scroll window to top so html2canvas captures 100% full top element without scroll offset shifts
    window.scrollTo(0, 0);

    // 0. Live DOM direct capture if visible on page (exact 1-to-1 match with Save & Print Contract PDF)
    let liveElem: HTMLElement | null = null;
    if (preferElemId) {
      liveElem = (document.getElementById(preferElemId) || document.querySelector('.' + preferElemId)) as HTMLElement;
    }
    if (!liveElem) {
      if (title === 'Quotation') {
        liveElem = document.querySelector('.agreements-print-preview') as HTMLElement;
      } else if (title.includes('Agreement') || title.includes('Contract')) {
        liveElem = document.querySelector('.agreements-contract-wrapper') as HTMLElement;
      }
    }

    if (liveElem) {
      console.log(`[PDF CAPTURE] Found live DOM element for "${title}"! Capturing exact print view element directly...`);
      try {
        if ((document as any).fonts && (document as any).fonts.ready) {
          await (document as any).fonts.ready;
        }
        await new Promise(resolve => setTimeout(resolve, 200));

        const opt: any = {
          margin: [8, 10, 8, 10],
          filename: `${title}_${refId}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, logging: false, scrollX: 0, scrollY: 0, backgroundColor: '#ffffff' },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'] }
        };
        const pdfBase64 = await html2pdf().set(opt).from(liveElem).outputPdf('datauristring');
        if (pdfBase64 && pdfBase64.length > 1000) {
          return pdfBase64;
        }
      } catch (err) {
        console.warn(`[PDF CAPTURE] Live element capture fallback to tempDiv:`, err);
      }
    }

    let elem: HTMLElement | null = null;

    const tempDiv = document.createElement('div');
    tempDiv.id = 'pdf-render-temp-container';
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '0px';
    tempDiv.style.top = '0px';
    tempDiv.style.zIndex = '999999';
    tempDiv.style.width = '794px';
    tempDiv.style.minHeight = '1120px';
    tempDiv.style.padding = '42px 48px';
    tempDiv.style.backgroundColor = '#ffffff';
    tempDiv.style.color = '#0f172a';
    tempDiv.style.fontFamily = "'Inter', 'Segoe UI', Arial, sans-serif";
    tempDiv.style.boxSizing = 'border-box';
    tempDiv.style.visibility = 'visible';
    tempDiv.style.opacity = '1';
    tempDiv.style.overflow = 'visible';

    const clientName = (shareModalAgreement?.client_name || quoteData?.client_name || quoteData?.subtitle || 'Valued Client').replace(/^(mr\.?|ms\.?|mrs\.?|miss\.?|dr\.?)\s+/i, '').trim();
    const rawAmt = parseFloat(String(quoteData?.total_amount || shareModalAgreement?.contract_value || shareModalAgreement?.total_amount || shareModalAgreement?.contract_amount || 0).replace(/[^0-9.]/g, '')) || 0;
    const grandTotalStr = rawAmt > 0 ? rawAmt.toLocaleString('en-IN') : '0';
    const execDate = new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });

    if (title === 'Quotation') {
      const qSections = extractSectionsFromQuote(quoteData);
      const quoteDataToUse = {
        ...quoteData,
        client_name: quoteData?.client_name || clientName || quoteData?.subtitle || 'Valued Client',
        subtitle: quoteData?.subtitle || clientName,
        quote_number: quoteData?.quote_number || (refId ? (String(refId).startsWith('QTN-') ? String(refId) : `QTN-${refId}`) : 'QTN-101'),
        project_id: quoteData?.project_id || (projectIdInput ? String(projectIdInput) : (refId ? `PR_${refId}` : 'PR_101')),
        project_code: quoteData?.project_code || projectIdInput || `PR_${refId}`,
        created_at: quoteData?.created_at || execDate,
        sections: qSections
      };
      tempDiv.innerHTML = buildOfficial4PageHtml(quoteDataToUse, (quoteDataToUse as any)?.hidden_fields || {});
    } else if (title.includes('Agreement') || title.includes('Contract')) {
      // Unpack extra_data if stored in quoteData or shareModalAgreement
      let extraFields: any = {};
      if (quoteData?.extra_data) {
        try {
          extraFields = typeof quoteData.extra_data === 'string' ? JSON.parse(quoteData.extra_data) : quoteData.extra_data;
        } catch (e) {}
      }
      if (shareModalAgreement?.extra_data) {
        try {
          const parsed = typeof shareModalAgreement.extra_data === 'string' ? JSON.parse(shareModalAgreement.extra_data) : shareModalAgreement.extra_data;
          extraFields = { ...parsed, ...extraFields };
        } catch (e) {}
      }

      const mergedData = { ...shareModalAgreement, ...extraFields, ...quoteData };

      const agClientName = mergedData.client_name || clientName || 'Valued Client';
      const agDate = mergedData.date || date || new Date().toISOString().split('T')[0];
      const agContractVal = mergedData.contract_value || feeAmount || '0';
      const agContractWords = mergedData.contract_value_words || feeWords || '';
      const agAddress = mergedData.address || address || '';
      const agRefId = mergedData.ref_id || refId || '';
      const agPlace = mergedData.place || place || 'Visakhapatnam';
      const agProjType = mergedData.project_type || projectType || 'Interior Design';
      const isFurn = agProjType === 'Furniture Design';

      const convNote = mergedData.convenience_fee_note !== undefined ? mergedData.convenience_fee_note : convenienceFeeNote;
      const delivNote = mergedData.delivery_installation_note !== undefined ? mergedData.delivery_installation_note : deliveryInstallationNote;
      const cancelAmt = mergedData.cancellation_min_amount !== undefined ? mergedData.cancellation_min_amount : cancellationMinAmount;
      const scenarioDate = mergedData.booking_scenario_date !== undefined ? mergedData.booking_scenario_date : bookingScenarioDate;
      const instList = (mergedData.installments_list && Array.isArray(mergedData.installments_list) && mergedData.installments_list.length > 0) ? mergedData.installments_list : installmentsList;
      const brList = (mergedData.brand_list || mergedData.brandsList) ? (mergedData.brand_list || mergedData.brandsList) : brandsList;
      const furnSchedule = mergedData.furniture_payment_schedule || furniturePaymentSchedule;

      if (isFurn) {
        tempDiv.innerHTML = ReactDOMServer.renderToString(
          <LivincartFurnitureContract
            clientName={agClientName}
            date={agDate}
            contractValue={agContractVal}
            contractValueWords={agContractWords}
            address={agAddress}
            refId={agRefId}
            place={agPlace}
            clientSignature={mergedData.client_signature || clientSignature || ''}
            includeContract={true}
            includeHandover={false}
            furniturePaymentSchedule={furnSchedule}
            convenienceFeeNote={convNote}
            deliveryInstallationNote={delivNote}
            cancellationMinAmount={cancelAmt}
            bookingScenarioDate={scenarioDate}
          />
        );
      } else {
        tempDiv.innerHTML = ReactDOMServer.renderToString(
          <LivincartContract
            clientName={agClientName}
            date={agDate}
            contractValue={agContractVal}
            contractValueWords={agContractWords}
            address={agAddress}
            refId={agRefId}
            clientSignature={mergedData.client_signature || clientSignature || ''}
            includeContract={true}
            includeHandover={false}
            convenienceFeeNote={convNote}
            deliveryInstallationNote={delivNote}
            cancellationMinAmount={cancelAmt}
            bookingScenarioDate={scenarioDate}
            installmentsList={instList}
            brandsList={brList}
          />
        );
      }
    } else {
      // Handover Terms & Guidelines
      tempDiv.innerHTML = `
        <div style="border-bottom: 3px solid #0c1527; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <img src="${LOGO_BASE64}" alt="Livincart Logo" style="height: 52px; max-width: 190px; object-fit: contain;" />
            <div>
              <h1 style="color: #0c1527; font-size: 22px; font-weight: 900; margin: 0;">LIVINCART ARCHITECTS & INTERIORS</h1>
              <p style="color: #64748b; font-size: 12px; margin: 3px 0 0 0; font-weight: 500;">Handover Terms & Guidelines — Ref #${refId}</p>
            </div>
          </div>
          <div style="text-align: right;">
            <span style="background-color: #0c1527; color: #ffffff; padding: 6px 14px; border-radius: 6px; font-weight: 800; font-size: 12px;">HANDOVER DOC</span>
          </div>
        </div>

        <div style="margin-bottom: 24px; padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 13px; color: #334155; display: flex; justify-content: space-between;">
          <div>
            <p style="margin: 0 0 6px 0;"><strong>Client Name:</strong> ${clientName}</p>
            <p style="margin: 0;"><strong>Project Ref:</strong> #${refId}</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0 0 6px 0;"><strong>Handover Date:</strong> ${execDate}</p>
            <p style="margin: 0;"><strong>Status:</strong> Final Site Handover</p>
          </div>
        </div>

        <h3 style="color: #0c1527; font-size: 14px; font-weight: 800; margin: 0 0 12px 0; text-transform: uppercase;">Handover Checklist & Maintenance Guidelines</h3>
        <div style="padding: 18px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 12px; color: #334155; line-height: 1.6; margin-bottom: 30px;">
          <p style="margin: 0 0 10px 0;"><strong>1. Inspection & Acceptance:</strong> The site has been inspected jointly by Livincart Project Manager and the Client. All installed joinery, finishes, and fixtures are handed over in prime condition.</p>
          <p style="margin: 0 0 10px 0;"><strong>2. Care & Maintenance:</strong> Clean laminate surfaces using soft micro-fiber cloths. Avoid abrasive chemicals or direct water contact on engineered wood edges.</p>
          <p style="margin: 0;"><strong>3. Hardware Warranty:</strong> Soft-close hinges and drawer channels carry manufacturer brand warranties. Contact Livincart support for service assistance.</p>
        </div>

        <div style="display: flex; justify-content: space-between; margin-top: 40px; border-top: 1px solid #cbd5e1; padding-top: 20px;">
          <div>
            <p style="margin: 0; font-size: 12px; font-weight: 700; color: #0c1527;">Client Acceptance Signature</p>
            <div style="height: 45px;"></div>
            <p style="margin: 0; font-size: 11px; color: #64748b;">${clientName}</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0; font-size: 12px; font-weight: 700; color: #0c1527;">Project Manager Signature</p>
            <div style="height: 45px;"></div>
            <p style="margin: 0; font-size: 11px; color: #64748b;">Livincart Site Execution Team</p>
          </div>
        </div>
      `;
    }

    document.body.appendChild(tempDiv);
    elem = tempDiv;

    try {
      if ((document as any).fonts && (document as any).fonts.ready) {
        await (document as any).fonts.ready;
      }
      await new Promise(resolve => setTimeout(resolve, 250));

      const opt: any = {
        margin: [8, 10, 8, 10],
        filename: `${title}_${refId}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, scrollX: 0, scrollY: 0, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] }
      };
      const pdfBase64 = await html2pdf().set(opt).from(elem).outputPdf('datauristring');
      if (tempDiv && tempDiv.parentNode) {
        tempDiv.parentNode.removeChild(tempDiv);
      }
      return pdfBase64 || '';
    } catch (err) {
      if (tempDiv && tempDiv.parentNode) {
        tempDiv.parentNode.removeChild(tempDiv);
      }
      console.error('Fallback PDF generation error:', err);
      return '';
    }
  };

  /* ── Send acknowledgement request email to client ── */
  const handleSendAckEmail = async (ag: any) => {
    const agId = ag.id;
    if (!agId) { alert('Agreement must be saved before sending acknowledgement email.'); return; }

    // Resolve client email from multiple possible fields / extra_data
    let clientEmail = ag.client_email || ag.email || '';
    if (!clientEmail && ag.extra_data) {
      try {
        const ed = typeof ag.extra_data === 'string' ? JSON.parse(ag.extra_data) : ag.extra_data;
        clientEmail = ed.client_email || ed.email || '';
      } catch { /* ignore */ }
    }
    if (!clientEmail) {
      clientEmail = window.prompt(
        `Enter the client email for "${ag.client_name}":`,
        ''
      ) || '';
    }
    if (!clientEmail || !clientEmail.includes('@')) {
      alert('A valid client email address is required to send the acknowledgement email.');
      return;
    }

    setAckSendingId(agId);
    try {
      const res = await fetch(`${API_BASE_URL}/agreements/send-ack-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agreement_id: agId,
          client_email: clientEmail,
          client_name: ag.client_name || '',
          ref_id: ag.ref_id || ''
        })
      }).then(r => r.json());

      if (res?.success) {
        alert(`✅ Acknowledgement email sent to ${clientEmail}`);
        // Reflect ack_email_sent_at locally so the admin can see it was sent
        setAgreements(prev => prev.map(item =>
          String(item.id) === String(agId)
            ? { ...item, ack_email_sent_at: new Date().toISOString() }
            : item
        ));
      } else {
        alert('❌ ' + (res?.message || 'Failed to send acknowledgement email'));
      }
    } catch (err: any) {
      alert('Error: ' + (err.message || 'Network error'));
    } finally {
      setAckSendingId(null);
    }
  };

  const handleSendShareEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareEmailForm.to.trim()) {
      alert('Please enter recipient email address');
      return;
    }
    if (!shareIncludeQuote && !shareIncludeAgreement && !shareIncludeHandover) {
      alert('Please select at least one document to include.');
      return;
    }
    setShareSending(true);

    try {
      // ── 1. VALIDATE QUOTATION MISMATCH IF INCLUDED ────────────────────────
      if (shareIncludeQuote) {
        const pId = shareModalAgreement?.project_id || shareModalAgreement?.lead_id || shareModalAgreement?.ref_id;
        const modalId = shareModalAgreement?.quote_id || shareModalAgreement?.id;
        let quoteObj: any = null;
        if (modalId && String(modalId).startsWith('quote_')) {
          const cleanQId = String(modalId).replace('quote_', '');
          const directRes = await fetch(`${API_BASE_URL}/quotes/${cleanQId}`).then(r => r.json()).catch(() => null);
          if (directRes?.data || directRes?.sections) quoteObj = directRes?.data || directRes;
        }
        if (!quoteObj) {
          const qRes = await fetch(`${API_BASE_URL}/quotes/latest?project_id=${encodeURIComponent(pId || '')}`).then(r => r.json()).catch(() => null);
          quoteObj = qRes?.data || qRes;
        }
        const agClient = String(shareModalAgreement?.client_name || '').replace(/^(mr\.?|ms\.?|mrs\.?|miss\.?|dr\.?)\s+/i, '').toLowerCase().trim();
        const qClient = String(quoteObj?.client_name || quoteObj?.subtitle || '').replace(/^(mr\.?|ms\.?|mrs\.?|miss\.?|dr\.?)\s+/i, '').toLowerCase().trim();
        const agAmount = Math.round(parseFloat(String(shareModalAgreement?.contract_value || 0).replace(/[^0-9.]/g, '')) || 0);
        const qAmount = Math.round(parseFloat(String(quoteObj?.total_amount || 0).replace(/[^0-9.]/g, '')) || 0);
        const isExplicitMismatch = quoteObj && (
          (agAmount > 0 && qAmount > 0 && Math.abs(agAmount - qAmount) > 500 && agClient !== qClient) ||
          (agClient && qClient && !agClient.includes(qClient) && !qClient.includes(agClient) && Math.abs(agAmount - qAmount) > 500)
        );
        if (isExplicitMismatch) {
          const agRef = String(shareModalAgreement?.ref_id || '').trim();
          const qRef = String(quoteObj?.quote_number || quoteObj?.ref_id || '').trim();
          alert(
            `🚫 CRITICAL BLOCK: Mismatched Quotation and Agreement!\n\n` +
            `Agreement: "${shareModalAgreement?.client_name || 'N/A'}" — ₹${agAmount.toLocaleString('en-IN')} (Ref: ${agRef || 'N/A'})\n` +
            `Quotation: "${quoteObj?.client_name || 'None Found'}" — ₹${qAmount.toLocaleString('en-IN')} (Ref: ${qRef || 'None'})\n\n` +
            `Email transmission BLOCKED.`
          );
          setShareSending(false);
          return;
        }
      }

      // ── 2. TARGET CAPTURE CONTAINER (.merged-package-wrapper) ─
      const captureContainer = document.getElementById('share-modal-pdf-capture');
      const wrapperElem = (captureContainer?.querySelector('.merged-package-wrapper') || document.querySelector('.merged-package-wrapper')) as HTMLElement | null;
      if (!wrapperElem) {
        alert('⚠️ Document preview container not found. Please try again.');
        setShareSending(false);
        return;
      }

      // 3. Extract populated document HTML for backend Dompdf vector rendering (Zero html2canvas overlapping issues)
      const rawHtmlPayload = wrapperElem.innerHTML;

      const selectedNames: string[] = [];
      if (shareIncludeQuote) selectedNames.push('Quote');
      if (shareIncludeAgreement) selectedNames.push('Agreement');
      if (shareIncludeHandover) selectedNames.push('Handover');
      const filename = selectedNames.length > 1
        ? `${selectedNames.join('_')}_Package_${shareModalAgreement?.ref_id || 'Document'}.pdf`
        : (shareIncludeQuote ? `Quotation_${shareModalAgreement?.ref_id || 'Quote'}.pdf` : (shareIncludeAgreement ? `Agreement_${shareModalAgreement?.ref_id || 'Document'}.pdf` : `Handover_Terms_${shareModalAgreement?.ref_id || 'Document'}.pdf`));

      const sendRes = await fetch(`${API_BASE_URL}/quotes/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...shareEmailForm,
          pdf_html: rawHtmlPayload,
          pdf_filename: filename,
          client_signature: shareModalAgreement?.client_signature || clientSignature || '',
          project_id: shareModalAgreement?.project_id || shareModalAgreement?.id || '',
          ref_id: shareModalAgreement?.ref_id || ''
        })
      }).then(r => r.json());

      if (sendRes?.success || sendRes?.status === 'success') {
        alert(sendRes.message || `Email sent successfully to ${shareEmailForm.to}!`);
        setShareModalAgreement(null);
      } else {
        alert(sendRes?.message || 'Failed to send email');
      }

    } catch (err: any) {
      alert('Error sending email: ' + (err.message || 'Error'));
    } finally {
      setShareSending(false);
    }
  };

  /* ── Form Fields for Agreement Generator ── */
  const [refId, setRefId] = useState("PR_2026_009/01");
  const [projectIdInput, setProjectIdInput] = useState("PR-101");
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | number | null>(null);
  const [projectType, setProjectType] = useState("Interior Design");
  const [title, setTitle] = useState("Mr.");
  const [clientName, setClientName] = useState("K Ranjit Kumar");
  const [address, setAddress] = useState("10-79/7/2, GF-104, AMMUS GREEN VALLEY, SAGAR NAGAR, ENDADA, Visakhapatnam – 530045");
  const [feeAmount, setFeeAmount] = useState("9,70,097");
  const [feeWords, setFeeWords] = useState("Nine Lakhs Seventy Thousand Ninety-Seven Rupees Only");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [place, setPlace] = useState("Visakhapatnam");
  const [status, setStatus] = useState("Draft");
  const [includeQuotation, setIncludeQuotation] = useState(true);
  const [includeContract, setIncludeContract] = useState(true);
  const [includeHandover, setIncludeHandover] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState<"general" | "custom">("general");

  /* ── Fetch Full Quotation Data & Versions History ── */
  const fetchQuoteDetailsAndHistory = async (projIdOrQuoteId: string | number, specificQuoteId?: string | number, clientNameOverride?: string) => {
    if (!projIdOrQuoteId && !specificQuoteId) return;
    setLoadingQuoteDetails(true);
    try {
      const cleanTarget = String(projIdOrQuoteId || '').trim();
      const numTarget = cleanTarget.replace(/\D/g, '');
      const effectiveClient = (clientNameOverride || clientName || '').trim();

      let historyList: any[] = [];
      if (cleanTarget) {
        const hRes = await fetch(`${API_BASE_URL}/quotes/history?project_id=${encodeURIComponent(cleanTarget)}`).then(r => r.json()).catch(() => null);
        if (hRes?.success && Array.isArray(hRes.data) && hRes.data.length > 0) {
          historyList = hRes.data;
        }
      }

      if (historyList.length === 0 && numTarget && numTarget !== cleanTarget) {
        const hRes2 = await fetch(`${API_BASE_URL}/quotes/history?project_id=${encodeURIComponent(numTarget)}`).then(r => r.json()).catch(() => null);
        if (hRes2?.success && Array.isArray(hRes2.data) && hRes2.data.length > 0) {
          historyList = hRes2.data;
        }
      }

      setQuoteHistory(historyList);

      let targetQ: any = null;
      if (specificQuoteId) {
        targetQ = historyList.find(q => String(q.quote_id) === String(specificQuoteId));
        if (!targetQ) {
          const cleanQId = String(specificQuoteId).replace(/^quote_/, '');
          const directQ = await fetch(`${API_BASE_URL}/quotes/${cleanQId}`).then(r => r.json()).catch(() => null);
          if (directQ?.data || directQ?.sections) {
            targetQ = directQ.data || directQ;
          }
        }
      }

      if (!targetQ && historyList.length > 0) {
        targetQ = historyList[0];
      }

      if (!targetQ && (cleanTarget || numTarget)) {
        const queryVal = cleanTarget || numTarget;
        const lRes = await fetch(`${API_BASE_URL}/quotes/latest?project_id=${encodeURIComponent(queryVal)}`).then(r => r.json()).catch(() => null);
        if (lRes?.data || lRes?.sections) {
          targetQ = lRes.data || lRes;
        }
      }

      if (!targetQ && effectiveClient) {
        const cRes = await fetch(`${API_BASE_URL}/quotes/latest?client_name=${encodeURIComponent(effectiveClient)}`).then(r => r.json()).catch(() => null);
        if (cRes?.data || cRes?.sections) {
          targetQ = cRes.data || cRes;
        }
      }

      // Guarantee targetQ has full sections and items loaded by directly fetching quote ID if sections are missing
      if (targetQ && (!targetQ.sections || !Array.isArray(targetQ.sections) || targetQ.sections.length === 0 || !targetQ.sections[0]?.items)) {
        const cleanQId = String(targetQ.quote_id || targetQ.id || '').replace(/^quote_/, '');
        if (cleanQId) {
          const direct = await fetch(`${API_BASE_URL}/quotes/${cleanQId}`).then(r => r.json()).catch(() => null);
          if (direct?.data?.sections || direct?.sections) {
            targetQ = direct.data || direct;
          }
        }
      }

      if (targetQ) {
        setActiveQuoteData(targetQ);
        if (targetQ.quote_id) {
          setSelectedQuoteId(targetQ.quote_id);
        }
        const qTotal = targetQ.total_amount || targetQ.final_amount || targetQ.net_amount;
        if (qTotal && Number(qTotal) > 0) {
          const numAmt = Math.round(Number(qTotal));
          setFeeAmount(String(numAmt));
          setFeeWords(convertNumberToWords(numAmt));
        }
      }
    } catch (err) {
      console.warn('Error fetching quote history in Agreements:', err);
    } finally {
      setLoadingQuoteDetails(false);
    }
  };

  const handleSelectQuoteVersion = async (quoteItem: any) => {
    if (!quoteItem) return;
    setLoadingQuoteDetails(true);
    try {
      let fullQuote = quoteItem;
      if (!fullQuote.sections || fullQuote.sections.length === 0) {
        const direct = await fetch(`${API_BASE_URL}/quotes/${quoteItem.quote_id}`).then(r => r.json()).catch(() => null);
        if (direct?.data || direct?.sections) {
          fullQuote = direct.data || direct;
        }
      }
      setActiveQuoteData(fullQuote);
      setSelectedQuoteId(fullQuote.quote_id || quoteItem.quote_id);
      const qTotal = fullQuote.total_amount || quoteItem.total_amount || 0;
      if (qTotal && Number(qTotal) > 0) {
        const numAmt = Math.round(Number(qTotal));
        setFeeAmount(String(numAmt));
        setFeeWords(convertNumberToWords(numAmt));
      }
    } finally {
      setLoadingQuoteDetails(false);
    }
  };

  /* ── Auto-Fill Client & Quota PDF Details Based on Project ID ── */
  const handleProjectIdInput = async (
    val: string,
    optionalProjectsList?: any[],
    optionalQuotesList?: any[],
    optionalAgreementsList?: any[]
  ) => {
    setProjectIdInput(val);
    if (!val || !val.trim()) {
      setTitle("Mr.");
      setClientName("");
      setAddress("");
      setFeeAmount("");
      setFeeWords("");
      setSelectedQuoteId(null);
      setActiveQuoteData(null);
      setQuoteHistory([]);
      return;
    }

    const rawClean = val.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const digitsOnly = val.replace(/\D/g, '');

    const effAgreements = (optionalAgreementsList && optionalAgreementsList.length > 0) ? optionalAgreementsList : agreements;
    const effQuotes = (optionalQuotesList && optionalQuotesList.length > 0) ? optionalQuotesList : allQuotesList;
    const effProjects = (optionalProjectsList && optionalProjectsList.length > 0) ? optionalProjectsList : allProjectsList;

    // 1. Search existing saved agreements list FIRST so saved drafts/edits are always prioritized
    let targetAg: any = effAgreements.find((a: any) => {
      const aRef = String(a.ref_id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const aPid = String(a.project_id || a.project_code || a.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const aClient = String(a.client_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');

      if (rawClean && (aRef === rawClean || aPid === rawClean || aPid === `pr${rawClean}` || aPid === `proj${rawClean}` || (rawClean.length >= 2 && aClient.includes(rawClean)))) return true;
      if (digitsOnly && (aRef.endsWith(digitsOnly) || aPid.endsWith(digitsOnly) || aPid === digitsOnly)) return true;
      return false;
    });

    if (targetAg) {
      handleEdit(targetAg);
      return;
    }

    // Direct API fallback for saved agreement in database
    if (digitsOnly || rawClean) {
      try {
        const queryId = digitsOnly || rawClean;
        const res = await fetch(`${API_BASE_URL}/agreements/${encodeURIComponent(queryId)}`).then(r => r.json()).catch(() => null);
        if ((res?.success || res?.status === 'success') && res?.data) {
          handleEdit(res.data);
          return;
        }
      } catch (e) { }
    }

    // 2. Search quotes list next as fallback for un-saved proposals
    let targetQuote: any = effQuotes.find((q: any) => {
      const qPid = String(q.project_id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const qPCode = String(q.project_code || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const qNum = String(q.quote_number || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const qId = String(q.quote_id || '').toLowerCase();
      const qClient = String(q.client_name || q.subtitle || '').toLowerCase().replace(/[^a-z0-9]/g, '');

      if (rawClean && (qPCode === rawClean || qNum === rawClean || qPid === rawClean || qId === rawClean || (rawClean.length >= 2 && qClient.includes(rawClean)))) return true;
      if (digitsOnly && (qPid === digitsOnly || qId === digitsOnly || qPCode.endsWith(digitsOnly) || qNum.endsWith(digitsOnly))) return true;
      return false;
    });

    // 3. Search projects list next
    let targetProject: any = null;
    if (!targetQuote) {
      targetProject = effProjects.find((p: any) => {
        const pId = String(p.project_id || p.id || '').toLowerCase();
        const pCode = String(p.project_code || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const pName = String(p.project_name || p.client_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');

        if (rawClean && (pCode === rawClean || pId === rawClean || (rawClean.length >= 2 && pName.includes(rawClean)))) return true;
        if (digitsOnly && (pId === digitsOnly || pCode.endsWith(digitsOnly))) return true;
        return false;
      });
    }

    // Direct Project API fallback
    if (!targetProject && !targetQuote && (digitsOnly || rawClean)) {
      try {
        const queryId = digitsOnly || rawClean;
        const res = await fetch(`${API_BASE_URL}/projects/${encodeURIComponent(queryId)}`).then(r => r.json()).catch(() => null);
        if (res && (res.data || res.project_id || res.id)) {
          targetProject = res.data || res;
        }
      } catch (e) { }
    }

    // Direct Quote API fallback
    if (!targetQuote && !targetProject && (digitsOnly || rawClean)) {
      try {
        const queryId = digitsOnly || rawClean;
        const res = await fetch(`${API_BASE_URL}/quotes/latest?project_id=${encodeURIComponent(queryId)}`).then(r => r.json()).catch(() => null);
        if (res && (res.data || res.sections)) {
          targetQuote = res.data || res;
        }
      } catch (e) { }
    }

    // Direct Leads API fallback
    if (!targetProject && !targetQuote && (digitsOnly || rawClean)) {
      try {
        const queryId = digitsOnly || rawClean;
        const res = await fetch(`${API_BASE_URL}/leads/${encodeURIComponent(queryId)}`).then(r => r.json()).catch(() => null);
        if (res && (res.data || res.lead_id || res.id)) {
          targetProject = res.data || res;
        }
      } catch (e) { }
    }

    const target = targetQuote || targetProject;

    if (targetQuote) {
      setSelectedQuoteId(targetQuote.quote_id || targetQuote.id);
    } else if (targetProject) {
      const matchingQ = effQuotes.find((q: any) => String(q.project_id) === String(targetProject.project_id || targetProject.id));
      if (matchingQ) setSelectedQuoteId(matchingQ.quote_id);
    }

    if (target) {
      // Project Type
      const pType = String(target.project_type || '').toLowerCase();
      if (pType.includes('furniture')) {
        setProjectType('Furniture Design');
      } else {
        setProjectType('Interior Design');
      }

      // Client Name
      const rawName = target.client_name || target.customer_name || target.subtitle || target.project_name || "";
      if (rawName) {
        const titleMatch = rawName.match(/^(Mr\.|Ms\.|Mrs\.|Miss)\s+(.*)$/i);
        if (titleMatch) {
          setTitle(titleMatch[1]);
          setClientName(titleMatch[2]);
        } else {
          setTitle("Mr.");
          setClientName(rawName);
        }
      }

      // Site Address
      const siteAddr = target.address || target.site_address || target.client_address || target.project_address;
      if (siteAddr) {
        setAddress(siteAddr);
      }

      // Contract Amount
      const rawAmt = target.total_amount ?? target.initial_quote_amount ?? target.total_budget ?? target.contract_value ?? target.fee_amount ?? target.amount ?? 0;
      const amt = parseFloat(rawAmt || 0);
      if (amt > 0) {
        const numStr = Math.round(amt).toLocaleString('en-IN');
        setFeeAmount(numStr);
        setFeeWords(convertNumberToWords(numStr));
      }

      // Ref Number
      if (target.quote_number || target.ref_id || target.project_code) {
        setRefId(target.quote_number || target.ref_id || target.project_code);
      } else {
        setRefId(`PR_${val}`);
      }

      // Client Signature
      if (target.client_signature || target.client_sign) {
        setClientSignature(target.client_signature || target.client_sign);
      }
    }

    // Fetch full quotation history & sections
    fetchQuoteDetailsAndHistory(val, targetQuote?.quote_id);
  };

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
    const init = async () => {
      const data = await fetchAgreements();
      try {
        const params = new URLSearchParams(window.location.search);
        const urlProjId = params.get('project_id') || params.get('id') || params.get('edit');
        const shouldCreate = params.get('create') === 'true' || params.get('edit') === 'true';

        if (urlProjId) {
          await handleProjectIdInput(urlProjId, data?.projects, data?.quotes, data?.savedAgreements);
          if (shouldCreate) setIsListView(false);
        }
      } catch (e) { }
    };
    init();
  }, []);

  useEffect(() => {
    if (!isListView && (projectIdInput || refId) && (!activeQuoteData || !activeQuoteData.sections || activeQuoteData.sections.length === 0)) {
      const lookupTarget = projectIdInput || refId;
      fetchQuoteDetailsAndHistory(lookupTarget, selectedQuoteId);
    }
  }, [isListView, projectIdInput, refId, selectedQuoteId, activeQuoteData?.sections?.length]);

  useEffect(() => {
    if (selectedQuoteId) {
      if (!activeQuoteData || String(activeQuoteData.quote_id) !== String(selectedQuoteId) || !activeQuoteData.sections || activeQuoteData.sections.length === 0) {
        const cleanQId = String(selectedQuoteId).replace(/^quote_/, '');
        fetch(`${API_BASE_URL}/quotes/${cleanQId}`)
          .then(r => r.json())
          .then(res => {
            if (res?.data || res?.sections) {
              const full = res.data || res;
              setActiveQuoteData(full);
            }
          })
          .catch(() => {});
      }
    }
  }, [selectedQuoteId]);

  const fetchAgreements = async () => {
    setLoading(true);
    try {
      // Fetch saved agreements, active projects, all quotations, leads, and finance transactions
      const [agRes, projRes, quoteRes, leadsRes, finRes] = await Promise.all([
        fetch(`${API_BASE_URL}/agreements`).then(r => r.json()).catch(() => ({ success: false, data: [] })),
        fetch(`${API_BASE_URL}/projects`).then(r => r.json()).catch(() => ({ success: false, data: [] })),
        fetch(`${API_BASE_URL}/quotes`).then(r => r.json()).catch(() => ({ success: false, data: [] })),
        fetch(`${API_BASE_URL}/leads`).then(r => r.json()).catch(() => ({ success: false, data: [] })),
        fetch(`${API_BASE_URL}/finance`).then(r => r.json()).catch(() => ({ success: false, data: [] }))
      ]);

      const savedAgreements = agRes.success ? (Array.isArray(agRes.data) ? agRes.data : []) : (Array.isArray(agRes) ? agRes : []);
      const projects = projRes.success ? (Array.isArray(projRes.data) ? projRes.data : []) : (Array.isArray(projRes) ? projRes : []);
      const quotes = quoteRes.success ? (Array.isArray(quoteRes.data) ? quoteRes.data : []) : (Array.isArray(quoteRes) ? quoteRes : []);
      const leads = leadsRes.success ? (Array.isArray(leadsRes.data) ? leadsRes.data : []) : (Array.isArray(leadsRes) ? leadsRes : []);
      const financeTx = finRes.success ? (Array.isArray(finRes.data) ? finRes.data : []) : (Array.isArray(finRes) ? finRes : []);

      setAllQuotesList(quotes);
      setAllProjectsList(projects);

      const cleanName = (str: string) => (str || '').replace(/^(mr\.|ms\.|mrs\.|miss\.|dr\.)\s+/i, '').toLowerCase().trim();

      // Helper: Check if a quotation is strictly Order Converted (status order_converted / won / completed OR Stage 1 advance paid)
      const isQuoteOrderConverted = (q: any): boolean => {
        if (!q) return false;
        const qStatus = String(q.status || '').toLowerCase().trim();
        if (
          qStatus === 'order_converted' ||
          qStatus === 'deal_done' ||
          qStatus === 'deal_won' ||
          qStatus === 'won' ||
          qStatus === 'completed' ||
          qStatus === 'signed'
        ) {
          return true;
        }
        if (q.stage_1_advance_paid || q.is_stage1_paid) {
          return true;
        }

        const rawPid = String(q.project_id || '').toLowerCase().trim();
        const numPid = rawPid.replace(/\D/g, '');
        const rawPcode = String(q.project_code || '').toLowerCase().trim();
        const clientName = cleanName(q.client_name || q.subtitle || '');

        // 1. Check matched project in projects
        const matchedProj = projects.find((p: any) => {
          const pId = String(p.project_id || '').toLowerCase().trim();
          const pCode = String(p.project_code || '').toLowerCase().trim();
          return (rawPid && (pId === rawPid || (numPid && pId === numPid))) ||
                 (rawPcode && (pCode === rawPcode || (pCode.length > 2 && rawPcode.includes(pCode)))) ||
                 (rawPcode && (rawPcode.length > 2 && pCode.includes(rawPcode)));
        });

        if (matchedProj) {
          const pStatus = String(matchedProj.status || '').toLowerCase().trim();
          if (pStatus === 'order_converted' || pStatus === 'deal_done' || pStatus === 'deal_won' || pStatus === 'won' || pStatus === 'completed') {
            return true;
          }
          if (matchedProj.stage1_paid === 1 || matchedProj.is_10_percent_paid === 1 || matchedProj.is_10_percent_paid === true || matchedProj.payment_status === '10% Paid') {
            return true;
          }
          const advPaid = parseFloat(matchedProj.advance_paid || matchedProj.advance_received || 0);
          const budget = parseFloat(matchedProj.total_budget || matchedProj.budget || 0);
          if (advPaid > 0 && (budget <= 0 || advPaid >= (budget * 0.10 - 1))) {
            return true;
          }
        }

        // 2. Check matched lead in leads
        const matchedLead = leads.find((l: any) => {
          const lid = String(l.lead_id || '').toLowerCase().trim();
          const manualId = String(l.manual_client_id || '').toLowerCase().trim();
          const lName = cleanName(l.client_name || '');
          return (numPid && lid === numPid) ||
                 (rawPcode && (manualId === rawPcode || manualId.includes(rawPcode))) ||
                 (clientName && lName && (lName === clientName || lName.includes(clientName)));
        });

        if (matchedLead) {
          const lStage = String(matchedLead.stage || matchedLead.status || '').toLowerCase().trim();
          if (lStage === 'won' || lStage === 'deal_won' || lStage === 'order_converted' || lStage === 'deal_done') {
            return true;
          }
          if (matchedLead.stage1_paid === 1 || matchedLead.is_10_percent_paid === 1 || matchedLead.payment_status === '10% Paid') {
            return true;
          }
          const leadAdv = parseFloat(matchedLead.advance_paid || matchedLead.token_amount || 0);
          const leadBudget = parseFloat(matchedLead.total_budget || matchedLead.estimated_budget || 0);
          if (leadAdv > 0 && (leadBudget <= 0 || leadAdv >= (leadBudget * 0.10 - 1))) {
            return true;
          }
        }

        // 3. Check finance transactions for Stage 1 advance
        const matchingTx = financeTx.filter((t: any) => {
          if (String(t.type || '').toLowerCase() !== 'credit') return false;
          const tPid = String(t.project_id || '').toLowerCase().trim();
          const tPCode = String(t.project_code || '').toLowerCase().trim();
          const tDesc = String(t.description || '').toLowerCase();
          const tCat = String(t.category || '').toLowerCase();

          const pidMatch = (rawPid && (tPid === rawPid || (numPid && tPid === numPid))) ||
                          (rawPcode && (tPid === rawPcode || tPCode === rawPcode || (rawPcode.length > 2 && tDesc.includes(rawPcode)))) ||
                          (clientName && clientName.length > 3 && tDesc.includes(clientName));

          return pidMatch || (tCat.includes('stage 1') && ((rawPid && tPid === rawPid) || (rawPcode && tDesc.includes(rawPcode))));
        });

        const isExplicitStage1Tx = matchingTx.some((t: any) => {
          const cat = String(t.category || '').toLowerCase();
          const desc = String(t.description || '').toLowerCase();
          return cat.includes('stage 1') || cat.includes('token advance') || desc.includes('stage 1') || desc.includes('token advance');
        });
        if (isExplicitStage1Tx) return true;

        const totalTxPaid = matchingTx.reduce((sum: number, t: any) => sum + (parseFloat(t.amount) || 0), 0);
        const quoteTotal = (q.sections && Array.isArray(q.sections) && q.sections.length > 0)
          ? q.sections.reduce((sum: number, s: any) => sum + (s.items || []).reduce((itemSum: number, i: any) => itemSum + (parseFloat(i.amount) || 0), 0), 0)
          : (parseFloat(q.total_amount) || 0);
        const targetBudget = quoteTotal > 0 ? quoteTotal : parseFloat(matchedProj?.total_budget || matchedLead?.total_budget || 0);

        if (totalTxPaid > 0 && (targetBudget <= 0 || totalTxPaid >= (targetBudget * 0.10 - 1))) {
          return true;
        }

        return false;
      };

      // Helper: Check if a project is Order Converted (directly or via linked quotation)
      const isProjectOrderConverted = (p: any): boolean => {
        if (!p) return false;
        const pStatus = String(p.status || '').toLowerCase().trim();
        if (pStatus === 'order_converted' || pStatus === 'deal_done' || pStatus === 'deal_won' || pStatus === 'won' || pStatus === 'completed') {
          return true;
        }
        if (p.stage1_paid === 1 || p.is_10_percent_paid === 1 || p.is_10_percent_paid === true || p.payment_status === '10% Paid') {
          return true;
        }

        const pId = String(p.project_id || p.id || '').toLowerCase().trim();
        const numPid = pId.replace(/\D/g, '');
        const pCode = String(p.project_code || '').toLowerCase().trim();
        const pClient = cleanName(p.client_name || p.project_name || '');

        // Check if ANY quotation for this project has status Order Converted
        const matchingQuotes = quotes.filter((q: any) => {
          const qPid = String(q.project_id || '').toLowerCase().trim();
          const qNumPid = qPid.replace(/\D/g, '');
          const qPcode = String(q.project_code || '').toLowerCase().trim();
          const qClient = cleanName(q.client_name || q.subtitle || '');

          return (pId && (qPid === pId || (numPid && qNumPid === numPid))) ||
                 (pCode && (qPcode === pCode || (pCode.length > 2 && qPcode.includes(pCode)))) ||
                 (pClient && qClient && (pClient === qClient || (pClient.length > 3 && qClient.includes(pClient))));
        });

        return matchingQuotes.some(isQuoteOrderConverted);
      };

      // Helper: Check if a saved agreement belongs to an order-converted quote/project
      const isSavedAgreementOrderConverted = (a: any): boolean => {
        if (!a) return false;
        const aStatus = String(a.status || '').toLowerCase().trim();
        if (aStatus === 'order_converted' || aStatus === 'deal_done' || aStatus === 'deal_won' || aStatus === 'won' || aStatus === 'completed' || aStatus === 'signed') {
          return true;
        }
        if (a.is_signed === 1 || a.is_signed === true) {
          return true;
        }

        const qId = a.selected_quote_id || a.quote_id;
        if (qId) {
          const q = quotes.find((quote: any) => String(quote.quote_id) === String(qId) || String(quote.id) === String(qId));
          if (q && isQuoteOrderConverted(q)) return true;
        }

        const pId = a.project_id || a.lead_id;
        if (pId) {
          const proj = projects.find((p: any) => String(p.project_id) === String(pId) || String(p.id) === String(pId));
          if (proj && isProjectOrderConverted(proj)) return true;
        }

        if (a.client_name) {
          const cNorm = cleanName(a.client_name);
          if (cNorm) {
            const matchQ = quotes.find((q: any) => cleanName(q.client_name || q.subtitle || '') === cNorm);
            if (matchQ && isQuoteOrderConverted(matchQ)) return true;
          }
        }

        return false;
      };

      // Filter quotes and projects to ONLY Order Converted records
      const filteredQuotes = quotes.filter(isQuoteOrderConverted);
      const filteredProjects = projects.filter(isProjectOrderConverted);
      setOrderConvertedQuotesList(filteredQuotes);
      setOrderConvertedProjectsList(filteredProjects);

      // Only real saved agreements from the database are rendered in the agreement history table.
      // Previous automatic workflow (synthesizing fake agreement rows whenever quotations/leads converted)
      // has been removed as requested. Only when an agreement is actually created or clicked will it appear here.
      const combined = [...savedAgreements];
      combined.sort((a: any, b: any) => {
        const tA = a.date ? new Date(a.date).getTime() : (a.created_at ? new Date(a.created_at).getTime() : 0);
        const tB = b.date ? new Date(b.date).getTime() : (b.created_at ? new Date(b.created_at).getTime() : 0);
        return tB - tA;
      });
      setAgreements(combined);
      return { savedAgreements, projects, quotes, leads, financeTx };
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
    setProjectIdInput("");
    setSelectedQuoteId(null);
    setActiveQuoteData(null);
    setQuoteHistory([]);
    setProjectType("Interior Design");
    setTitle("Mr.");
    setClientName("");
    setClientSignature("");
    setAddress("");
    setFeeAmount("");
    setFeeWords("");
    setDate(new Date().toISOString().split("T")[0]);
    setPlace("Visakhapatnam");
    setStatus("Draft");
    setIncludeQuotation(true);
    setIncludeContract(true);
    setIncludeHandover(false);
    setActiveFormTab("general");
    setFurniturePaymentSchedule(DEFAULT_FURNITURE_SCHEDULE);
    setInstallmentsList(DEFAULT_INTERIOR_INSTALLMENTS);
    setBrandsList(DEFAULT_BRANDS_LIST);
    setConvenienceFeeNote("Note: A non-refundable Convenience fee of 2% (including GST) on payment amount may be levied on certain modes of payment including Credit card /Debit card/Net Banking/Wallet/Etc.");
    setDeliveryInstallationNote("Note: Back panel shall be Livincart Aquashield-MDF for all carcasses in any core material other than BWP (Boiling water proof) Ply. For all carcass with BWP (Boiling water proof) Ply as core material; the back panel (wherever applicable) is to be Ply.");
    setCancellationMinAmount("1,50,000");
    setBookingScenarioDate("29th October, 2025 onwards");
  };

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("All");
    setClientFilter("All");
    setContactFilter("All");
    setProjectIdFilter("All");
    setProjectTypeFilter("All");
    setDateRangeFilter("All Time");
    setSelectedYear(new Date().getFullYear());
    setAgreementTypeFilter("Active Agreement");
    setCustomStartDate("");
    setCustomEndDate("");
    setCurrentPage(1);
  };

  const handleQuietSave = async (statusVal = "Created") => {
    if (!clientName || !address || !feeAmount) return null;
    try {
      const extractProjId = (id: any, ref: string) => {
        if (typeof id === 'number') return id;
        if (typeof id === 'string' && id.startsWith('proj_')) return parseInt(id.slice(5), 10);
        if (ref && ref.startsWith('PR_')) {
          const num = parseInt(ref.slice(3), 10);
          if (!isNaN(num)) return num;
        }
        return undefined;
      };

      const payload = {
        id: editingId,
        project_id: projectIdInput || extractProjId(editingId, refId),
        project_code: projectIdInput,
        ref_id: refId,
        project_type: projectType,
        title: title,
        client_name: `${title} ${clientName}`.trim(),
        raw_client_name: clientName,
        address: address,
        contract_value: feeAmount,
        contract_value_words: feeWords,
        date: date,
        place: place,
        status: statusVal,
        furniture_payment_schedule: furniturePaymentSchedule,
        brand_list: brandsList,
        installments_list: installmentsList,
        include_quotation: includeQuotation,
        include_contract: includeContract,
        include_handover: includeHandover,
        selected_quote_id: selectedQuoteId,
        convenience_fee_note: convenienceFeeNote,
        delivery_installation_note: deliveryInstallationNote,
        cancellation_min_amount: cancellationMinAmount,
        booking_scenario_date: bookingScenarioDate,
        client_signature: clientSignature
      };

      const res = await fetch(`${API_BASE_URL}/agreements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json().catch(() => null);
      if (json && json.success) {
        return json.id || editingId;
      }
    } catch (e) { }
    return null;
  };

  const handleSave = async (statusVal = "Created") => {
    if (!clientName || !address || !feeAmount) {
      alert("Please fill all mandatory fields (Client Name, Address, Contract Value)");
      return;
    }

    if (isPlaceholderOrTestData(clientName) || isPlaceholderOrTestData(address)) {
      alert("🚫 CRITICAL BLOCK: Incomplete or placeholder client data detected!\n\nClient Name and Site Address must contain valid client details (not test placeholders like 'cluld test') before finalizing into a Works Contract / Handover Agreement.");
      return;
    }

    try {
      const extractProjId = (id: any, ref: string) => {
        if (typeof id === 'number') return id;
        if (typeof id === 'string' && id.startsWith('proj_')) return parseInt(id.slice(5), 10);
        if (ref && ref.startsWith('PR_')) {
          const num = parseInt(ref.slice(3), 10);
          if (!isNaN(num)) return num;
        }
        return undefined;
      };

      const payload = {
        id: editingId,
        project_id: projectIdInput || extractProjId(editingId, refId),
        project_code: projectIdInput,
        ref_id: refId,
        project_type: projectType,
        title: title,
        client_name: `${title} ${clientName}`.trim(),
        raw_client_name: clientName,
        address: address,
        contract_value: feeAmount,
        contract_value_words: feeWords,
        date: date,
        place: place,
        status: statusVal,
        furniture_payment_schedule: furniturePaymentSchedule,
        brand_list: brandsList,
        installments_list: installmentsList,
        include_quotation: includeQuotation,
        include_contract: includeContract,
        include_handover: includeHandover,
        selected_quote_id: selectedQuoteId,
        convenience_fee_note: convenienceFeeNote,
        delivery_installation_note: deliveryInstallationNote,
        cancellation_min_amount: cancellationMinAmount,
        booking_scenario_date: bookingScenarioDate,
        client_signature: clientSignature
      };

      const res = await fetch(`${API_BASE_URL}/agreements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch (e) {
        console.error("Non-JSON Server Output:", text);
        alert("Server Error: " + text.replace(/<[^>]*>?/gm, '').slice(0, 200));
        return;
      }

      if (json && json.success) {
        alert(json.message || "Agreement saved successfully!");
        setStatus(statusVal);
        if (String(statusVal).toLowerCase() === 'completed' || String(statusVal).toLowerCase() === 'handover') {
          setIncludeHandover(true);
        }
        const targetId = json.id || editingId;
        const cleanCn = (clientName || '').replace(/^(mr\.?|ms\.?|mrs\.?|miss\.?|dr\.?)\s+/i, '').toLowerCase().trim();
        const pId = extractProjId(editingId, refId);

        if (targetId) setEditingId(targetId);

        try {
          if (targetId) localStorage.setItem(`ag_status_${targetId}`, statusVal);
          if (refId) localStorage.setItem(`ag_status_${refId}`, statusVal);

          if (String(statusVal).toLowerCase().includes('sign')) {
            if (cleanCn) localStorage.setItem(`signed_client_${cleanCn}`, 'true');
            if (pId) localStorage.setItem(`signed_proj_${pId}`, 'true');
          } else {
            if (cleanCn) localStorage.removeItem(`signed_client_${cleanCn}`);
            if (pId) localStorage.removeItem(`signed_proj_${pId}`);
          }
        } catch (e) { }

        // Silently update agreements list in background without closing editor form
        fetchAgreements();
      } else {
        alert("Error: " + (json?.message || "Failed to save agreement"));
      }
    } catch (err) {
      console.error("Error saving agreement:", err);
      alert("Failed to save agreement");
    }
  };

  const handleEdit = async (ag: any) => {
    // 1. ALWAYS reset all form state variables FIRST to prevent state leakage between projects
    resetForm();

    let targetAg = ag;

    // 2. Fetch fresh, un-cached data from backend database if any valid lookup ID exists
    const lookupKey = ag?.id || ag?.ref_id || ag?.project_id;
    if (lookupKey) {
      try {
        const res = await fetch(`${API_BASE_URL}/agreements/${encodeURIComponent(lookupKey)}`).then(r => r.json()).catch(() => null);
        if (res?.success && res?.data) {
          targetAg = res.data;
        }
      } catch (e) { }
    }

    // 3. Populate form fields from fresh targetAg
    setEditingId(targetAg.id);
    setRefId(targetAg.ref_id || `PR_${targetAg.id}`);
    setProjectIdInput(targetAg.project_code || (targetAg.project_id ? (String(targetAg.project_id).startsWith('PR-') || String(targetAg.project_id).startsWith('LVC') ? targetAg.project_id : `PR-${targetAg.project_id}`) : `PR-${targetAg.id || 101}`));
    if (targetAg.project_type) setProjectType(targetAg.project_type);

    const nameStr = targetAg.raw_client_name || targetAg.client_name || "";
    const titleMatch = nameStr.match(/^(Mr\.|Ms\.|Mrs\.|Miss)\s+(.*)$/i);
    if (titleMatch) {
      setTitle(targetAg.title || titleMatch[1]);
      setClientName(titleMatch[2]);
    } else {
      setTitle(targetAg.title || "Mr.");
      setClientName(nameStr);
    }

    setAddress(targetAg.address || "");
    setClientSignature(targetAg.client_signature || targetAg.client_sign || "");
    setFeeAmount(targetAg.contract_value || "");
    setFeeWords(targetAg.contract_value_words || convertNumberToWords(targetAg.contract_value));

    const formatDateForInput = (raw: any): string => {
      if (!raw) return new Date().toISOString().split('T')[0];
      const s = String(raw).trim();
      if (s.includes(' ')) return s.split(' ')[0];
      if (s.includes('T')) return s.split('T')[0];
      return s;
    };

    setDate(formatDateForInput(targetAg.date));
    setPlace(targetAg.place || "Visakhapatnam");

    if (targetAg.furniture_payment_schedule && Array.isArray(targetAg.furniture_payment_schedule)) {
      setFurniturePaymentSchedule(targetAg.furniture_payment_schedule);
    } else {
      setFurniturePaymentSchedule(DEFAULT_FURNITURE_SCHEDULE);
    }

    if (targetAg.brand_list && Array.isArray(targetAg.brand_list)) {
      setBrandsList(targetAg.brand_list);
    } else {
      setBrandsList(DEFAULT_BRANDS_LIST);
    }

    if (targetAg.installments_list && Array.isArray(targetAg.installments_list)) {
      setInstallmentsList(targetAg.installments_list);
    } else {
      setInstallmentsList(DEFAULT_INTERIOR_INSTALLMENTS);
    }

    if (targetAg.include_quotation !== undefined) setIncludeQuotation(Boolean(targetAg.include_quotation));
    if (targetAg.include_contract !== undefined) setIncludeContract(Boolean(targetAg.include_contract));
    if (targetAg.include_handover !== undefined) setIncludeHandover(Boolean(targetAg.include_handover));
    if (targetAg.selected_quote_id) setSelectedQuoteId(targetAg.selected_quote_id);
    const targetLookup = targetAg.project_id || targetAg.project_code || targetAg.ref_id || targetAg.client_name;
    fetchQuoteDetailsAndHistory(targetLookup, targetAg.selected_quote_id, nameStr);
    if (targetAg.convenience_fee_note) setConvenienceFeeNote(targetAg.convenience_fee_note);
    if (targetAg.delivery_installation_note) setDeliveryInstallationNote(targetAg.delivery_installation_note);
    if (targetAg.cancellation_min_amount) setCancellationMinAmount(targetAg.cancellation_min_amount);
    if (targetAg.booking_scenario_date) setBookingScenarioDate(targetAg.booking_scenario_date);

    let savedSt = targetAg.status;
    try {
      const localSt = localStorage.getItem(`ag_status_${targetAg.id}`) || localStorage.getItem(`ag_status_${targetAg.ref_id}`);
      if (localSt) savedSt = localSt;
    } catch (e) { }

    setStatus(savedSt || "Draft");
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

  // Helper to get effective canonical status for filtering and metric cards
  const getEffectiveAgreementStatus = (ag: any) => {
    const rawStatus = String(ag?.status || 'booked').toLowerCase().trim();
    if (rawStatus === 'proposal' || rawStatus === 'proposal_sent' || rawStatus === 'sent' || rawStatus === 'issued') {
      return 'proposal_sent';
    } else if (rawStatus === 'approved' || rawStatus === 'qc_approved' || rawStatus === 'finalized' || rawStatus === 'signed' || rawStatus === 'completed') {
      return 'approved';
    } else if (rawStatus === 'order_converted' || rawStatus === 'deal_done' || rawStatus === 'deal_won') {
      return 'order_converted';
    } else {
      return 'booked';
    }
  };

  // Agreements filtered by all criteria EXCEPT statusFilter (used for stable status overview cards metrics)
  const baseFilteredAgreements = useMemo(() => {
    return agreements.filter(ag => {
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase().trim();
        const refId = String(ag.ref_id || '').toLowerCase();
        const cName = String(ag.client_name || '').toLowerCase();
        const phone = String(ag.client_phone || ag.phone || ag.contact_number || '').toLowerCase();
        const email = String(ag.client_email || ag.email || '').toLowerCase();
        const pName = String(ag.project_name || ag.title || '').toLowerCase();
        const pCode = String(ag.project_code || (ag.project_id ? `PR_${ag.project_id}` : '')).toLowerCase();
        const rawPid = String(ag.project_id || '').toLowerCase();
        const pType = String(ag.project_type || '').toLowerCase();
        const val = String(ag.contract_value || ag.fee_amount || '').toLowerCase();
        const status = String(ag.status || '').toLowerCase();
        const address = String(ag.client_address || ag.address || '').toLowerCase();

        const matches = (
          refId.includes(q) ||
          cName.includes(q) ||
          phone.includes(q) ||
          email.includes(q) ||
          pName.includes(q) ||
          pCode.includes(q) ||
          rawPid.includes(q) ||
          pType.includes(q) ||
          val.includes(q) ||
          status.includes(q) ||
          address.includes(q)
        );

        if (!matches) return false;
      }
      if (clientFilter !== "All") {
        const c = String(ag.client_name || '').toLowerCase();
        if (!c.includes(clientFilter.toLowerCase())) return false;
      }
      if (contactFilter !== "All" && contactFilter.trim() !== "") {
        const phone = String(ag.client_phone || ag.phone || ag.contact || '').toLowerCase();
        if (!phone.includes(contactFilter.toLowerCase().trim())) return false;
      }
      if (projectIdFilter !== "All" && projectIdFilter.trim() !== "") {
        const pid = String(ag.project_code || ag.ref_id || (ag.project_id ? `PR_${ag.project_id}` : '')).toLowerCase();
        if (!pid.includes(projectIdFilter.toLowerCase().trim())) return false;
      }
      if (projectTypeFilter !== "All") {
        const ptype = String(ag.project_type || ag.project_category || 'Interior Projects').toLowerCase();
        if (!ptype.includes(projectTypeFilter.toLowerCase())) return false;
      }
      if (dateRangeFilter !== 'All Time' && dateRangeFilter !== 'All') {
        const rawDate = ag.date || ag.created_at;
        if (rawDate) {
          const dt = parseLocalDate(rawDate);
          if (dt) {
            const agDate = dt.getTime();
            const now = Date.now();
            const oneDay = 86400000;
            if (dateRangeFilter === 'Last Month' && (now - agDate) > oneDay * 30) return false;
            if (dateRangeFilter === 'Last 3 Months' && (now - agDate) > oneDay * 90) return false;
            if (dateRangeFilter === 'Last 6 Months' && (now - agDate) > oneDay * 180) return false;
            if (dateRangeFilter === 'This Year' && dt.getFullYear() !== new Date().getFullYear()) return false;
            if (dateRangeFilter === 'By Year' && dt.getFullYear() !== selectedYear) return false;
            if (dateRangeFilter === 'Custom Range') {
              if (customStartDate) {
                const startDt = parseLocalDate(customStartDate);
                if (startDt && agDate < startDt.getTime()) return false;
              }
              if (customEndDate) {
                const [ey, em, ed] = customEndDate.split('-').map(Number);
                const endMs = new Date(ey, em - 1, ed, 23, 59, 59).getTime();
                if (agDate > endMs) return false;
              }
            }
          } else {
            return false;
          }
        } else {
          return false;
        }
      }
      return true;
    });
  }, [agreements, searchQuery, clientFilter, contactFilter, projectIdFilter, projectTypeFilter, dateRangeFilter, selectedYear, customStartDate, customEndDate]);

  // Filter Logic with Status Filter applied
  const filteredAgreements = useMemo(() => {
    return baseFilteredAgreements.filter(ag => {
      if (statusFilter !== "All") {
        const effStatus = getEffectiveAgreementStatus(ag);
        const sf = statusFilter.toLowerCase().trim();
        if (effStatus !== sf) return false;
      }
      return true;
    });
  }, [baseFilteredAgreements, statusFilter]);

  // Unique clients for dropdown
  const uniqueClients = useMemo(() => {
    return Array.from(new Set(agreements.map(a => a.client_name))).filter(Boolean);
  }, [agreements]);

  // Dynamic status overview counts and total ₹ amounts based on base filtered dataset (matching Quotes page)
  const statusCountsAndTotals = useMemo(() => {
    let bookedCount = 0, bookedTotal = 0;
    let proposalCount = 0, proposalTotal = 0;
    let approvedCount = 0, approvedTotal = 0;
    let convertedCount = 0, convertedTotal = 0;
    let totalCount = 0, grandTotal = 0;

    baseFilteredAgreements.forEach((ag: any) => {
      const amt = parseFloat(String(ag.contract_value || ag.fee_amount || 0).replace(/[^0-9.]/g, '')) || 0;
      totalCount++;
      grandTotal += amt;

      const st = getEffectiveAgreementStatus(ag);
      if (st === 'proposal_sent') {
        proposalCount++;
        proposalTotal += amt;
      } else if (st === 'approved') {
        approvedCount++;
        approvedTotal += amt;
      } else if (st === 'order_converted') {
        convertedCount++;
        convertedTotal += amt;
      } else {
        bookedCount++;
        bookedTotal += amt;
      }
    });

    return {
      totalCount, grandTotal,
      bookedCount, bookedTotal,
      proposalCount, proposalTotal,
      approvedCount, approvedTotal,
      convertedCount, convertedTotal
    };
  }, [baseFilteredAgreements]);

  const isCurrentSigned = useMemo(() => {
    const stLower = String(status || '').toLowerCase().trim();
    return (
      stLower === 'signed' ||
      stLower === 'approved' ||
      stLower === 'completed' ||
      stLower === 'order_converted' ||
      stLower === 'deal_done' ||
      stLower === 'finalized'
    );
  }, [status]);

  // Unique Project IDs for dropdown
  const projectIdOptions = useMemo(() => {
    const set = new Set<string>();
    agreements.forEach(a => {
      const pid = a.project_code || a.ref_id || (a.project_id ? (String(a.project_id).startsWith('PR_') ? a.project_id : `PR_${a.project_id}`) : null);
      if (pid) set.add(pid);
    });
    return Array.from(set);
  }, [agreements]);

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
    incContract = includeContract,
    signatureOverride?: string
  ) => {
    const effectiveSig = signatureOverride !== undefined ? signatureOverride : (clientSignature || '');
    return (
      <div className="merged-package-wrapper print-area">
        {/* 1. OFFICIAL ORIGINAL QUOTATION PRINT PDF VIEW (COVER + INFO + SUMMARY + BOQ) */}
        {incQuotation && (() => {
          const matchedAg = agreements.find(a => a.ref_id === rId || a.project_code === projectIdInput || (a.client_name && cName && a.client_name.toLowerCase().trim() === cName.toLowerCase().trim()));
          const resolvedProjId = projectIdInput || matchedAg?.project_id || matchedAg?.project_code || matchedAg?.lead_id || (rId && rId !== 'standalone' ? rId : cName);
          const targetQId = selectedQuoteId || matchedAg?.quote_id || (typeof editingId === 'string' && editingId.startsWith('quote_') ? editingId.slice(6) : undefined);
          let targetQuote: any = null;
          if (selectedQuoteId && quoteHistory.length > 0) {
            targetQuote = quoteHistory.find(q => String(q.quote_id) === String(selectedQuoteId));
          }
          if (!targetQuote) {
            targetQuote = activeQuoteData;
          }
          if (!targetQuote && quoteHistory.length > 0) {
            targetQuote = quoteHistory[0];
          }
          if (!targetQuote) {
            const cleanNumProj = String(resolvedProjId || '').replace(/\D/g, '');
            targetQuote = allQuotesList.find((q: any) => {
              const qPid = String(q.project_id || '');
              const cleanQPid = qPid.replace(/\D/g, '');
              return String(q.quote_id) === String(targetQId) ||
                qPid === String(resolvedProjId) ||
                (cleanNumProj && cleanQPid && cleanNumProj === cleanQPid) ||
                (q.client_name && cName && q.client_name.toLowerCase().trim().includes(cName.toLowerCase().trim()));
            });
          }

          const displayQuoteId = targetQuote?.quote_number || (String(rId || '').startsWith('QTN-') || String(rId || '').startsWith('QTN_') ? String(rId) : `QTN-${rId}`);
          const displayProjectId = String(resolvedProjId || '').startsWith('PR-') || String(resolvedProjId || '').startsWith('PR_') ? String(resolvedProjId) : `PR_${resolvedProjId}`;

          const sections = extractSectionsFromQuote(targetQuote);
          const rawAmt = parseFloat(String(targetQuote?.total_amount || valAmt || 0).replace(/[^0-9.]/g, '')) || 0;
          const displayClientName = targetQuote?.client_name || targetQuote?.subtitle || cName || 'Valued Client';

          // Parse extra_data from targetQuote for commercial breakdown & hidden fields
          const targetExtra = typeof targetQuote?.extra_data === 'string'
            ? (() => { try { return JSON.parse(targetQuote.extra_data); } catch { return {}; } })()
            : (targetQuote?.extra_data || targetQuote?.extra_data_parsed || {});

          const hiddenFields = targetExtra?.hidden_fields || {};

          const quoteDataToUse = {
            ...targetQuote,
            client_name: displayClientName,
            subtitle: displayClientName,
            quote_number: displayQuoteId,
            project_id: displayProjectId,
            project_code: displayProjectId,
            total_amount: rawAmt,
            created_at: targetQuote?.created_at || dVal,
            sections: sections,
            extra_data_parsed: targetExtra,
            extra_data: targetQuote?.extra_data || JSON.stringify(targetExtra),
            hidden_fields: hiddenFields
          };

          const fullQuoteHtml = buildOfficial4PageHtml(quoteDataToUse, hiddenFields);
          const styleMatch = fullQuoteHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
          const quoteStyles = styleMatch ? styleMatch[1] : '';
          const bodyMatch = fullQuoteHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
          const quoteBodyHtml = bodyMatch ? bodyMatch[1] : fullQuoteHtml;

          return (
            <div className="agreements-quotation-wrapper" style={{ width: "100%", margin: "0 auto 30px auto" }}>
              {quoteStyles && <style dangerouslySetInnerHTML={{ __html: quoteStyles }} />}
              <div
                className="agreements-print-preview"
                style={{
                  maxWidth: "794px",
                  width: "100%",
                  margin: "0 auto",
                  backgroundColor: "#ffffff",
                  boxSizing: "border-box"
                }}
                dangerouslySetInnerHTML={{ __html: quoteBodyHtml }}
              />
            </div>
          );
        })()}

        {/* 2. WORKS CONTRACT AGREEMENT & HANDOVER PDF */}
        {(incContract || incHandover) && (
          <div
            className="agreements-contract-wrapper"
            style={{
              maxWidth: "794px",
              width: "100%",
              margin: "0 auto",
              boxSizing: "border-box",
              fontFamily: '"Inter", "Segoe UI", Arial, Helvetica, sans-serif',
              pageBreakBefore: incQuotation ? "always" : "auto",
              breakBefore: incQuotation ? "page" : "auto",
              clear: "both",
              display: "block"
            }}
          >
            {typeVal === "Furniture Design" ? (
              <LivincartFurnitureContract
                clientName={cName}
                date={formatDisplayDate(dVal)}
                contractValue={valAmt}
                contractValueWords={wordsVal || convertNumberToWords(valAmt)}
                address={addrVal}
                refId={rId}
                clientSignature={effectiveSig}
                includeContract={incContract}
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
                clientSignature={effectiveSig}
                includeContract={incContract}
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
    <div style={{ backgroundColor: "#ffffff", minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif", color: "#1e293b" }}>
      <PrintStyles />

      {/* TOP HEADER */}
      <div className="no-print" style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "18px 32px",
        backgroundColor: "#ffffff",
        borderBottom: "1px solid #e2e8f0",
        boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
        flexWrap: "wrap",
        gap: "16px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <FileText size={26} color="#fca412" />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 900, color: "#0c1527", letterSpacing: "-0.3px" }}>
                Agreements &amp; Works Contracts
              </h1>
              <span style={{ backgroundColor: "#fff9f0", border: "1.5px solid #ffe8c2", color: "#fca412", fontSize: "0.78rem", fontWeight: 900, padding: "3px 12px", borderRadius: "12px", boxShadow: "0 1px 2px rgba(252,164,18,0.15)" }}>
                {filteredAgreements.length} Contracts Active
              </span>
            </div>
            <span style={{ fontSize: "0.83rem", color: "#64748b", fontWeight: 500, display: "block", marginTop: "3px" }}>
              Manage customer proposals, signed works contracts, and live sales lead agreements.
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          {isListView ? (
            <>
              <button
                onClick={() => {
                  const agToShare = agreements[0] || {
                    client_name: `${title ? title + ' ' : ''}${clientName}`.trim(),
                    ref_id: refId,
                    contract_value: feeAmount,
                    address: address,
                    client_signature: clientSignature
                  };
                  openShareModal(agToShare);
                }}
                style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "10px 18px", backgroundColor: "#ffffff", color: "#fca412",
                  border: "1.5px solid #fca412", borderRadius: "8px", fontWeight: 800, fontSize: "0.88rem",
                  cursor: "pointer", boxShadow: "0 2px 6px rgba(252,164,18,0.15)",
                  transition: "all 0.15s ease"
                }}
                title="Send Agreement PDF via Email"
              >
                <Mail size={18} /> Send PDF Mail
              </button>

              <button
                onClick={() => { resetForm(); setIsListView(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "10px 20px", backgroundColor: "#fca412", color: "#ffffff",
                  border: "none", borderRadius: "8px", fontWeight: 800, fontSize: "0.88rem",
                  cursor: "pointer", boxShadow: "0 2px 8px rgba(252,164,18,0.35)",
                  transition: "all 0.15s ease"
                }}
              >
                <Plus size={18} /> Create New Agreement
              </button>
            </>
          ) : (
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <button
                onClick={() => {
                  setSigModalAgreement({
                    client_name: `${title} ${clientName}`.trim(),
                    project_id: projectIdInput || editingId,
                    lead_id: editingId,
                    client_signature: clientSignature
                  });
                  setShowSigModal(true);
                }}
                style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "10px 18px", backgroundColor: clientSignature ? "#f0fdf4" : "#eff6ff",
                  color: clientSignature ? "#16a34a" : "#2563eb",
                  border: clientSignature ? "1.5px solid #86efac" : "1.5px solid #93c5fd",
                  borderRadius: "8px", fontWeight: 800, fontSize: "0.88rem",
                  cursor: "pointer", transition: "all 0.15s ease"
                }}
                title="Client Signature Pad"
              >
                <PenTool size={18} /> {clientSignature ? "✍️ Client Signed" : "✍️ Client Signature"}
              </button>
              <button
                onClick={() => { setIsListView(true); resetForm(); }}
                style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "10px 20px", backgroundColor: "#ffffff", color: "#334155",
                  border: "1.5px solid #cbd5e1", borderRadius: "8px", fontWeight: 800, fontSize: "0.88rem",
                  cursor: "pointer"
                }}
              >
                <ArrowLeft size={18} /> Back to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>

      {isListView ? (
        /* =========================================================================
           MODE 1: DASHBOARD LIST VIEW (MATCHING USER REFERENCE IMAGE EXACTLY)
           ========================================================================= */
        <div className="no-print" style={{ padding: "24px 32px", maxWidth: "100%", margin: "0 auto" }}>

          {/* Metric Summary Overview Cards matching Quotes page */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            {/* Card 1: All Agreements */}
            <div
              onClick={() => { setStatusFilter("All"); setCurrentPage(1); }}
              style={{
                backgroundColor: statusFilter === 'All' ? '#f0f7ff' : '#ffffff',
                border: statusFilter === 'All' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '16px 18px',
                boxShadow: statusFilter === 'All' ? '0 4px 12px rgba(37,99,235,0.12)' : '0 1px 3px rgba(0,0,0,0.03)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: statusFilter === 'All' ? '#1d4ed8' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>All Contracts</span>
                <FileText size={18} color={statusFilter === 'All' ? '#2563eb' : '#94a3b8'} />
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a' }}>{statusCountsAndTotals.totalCount}</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#2563eb', marginTop: '2px' }}>₹{statusCountsAndTotals.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>

            {/* Card 2: Booked / Draft */}
            <div
              onClick={() => { setStatusFilter(statusFilter === 'booked' ? 'All' : 'booked'); setCurrentPage(1); }}
              style={{
                backgroundColor: statusFilter === 'booked' ? '#fff9f0' : '#ffffff',
                border: statusFilter === 'booked' ? '2px solid #ea580c' : '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '16px 18px',
                boxShadow: statusFilter === 'booked' ? '0 4px 12px rgba(234,88,12,0.12)' : '0 1px 3px rgba(0,0,0,0.03)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: statusFilter === 'booked' ? '#c2410c' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Booked / Draft</span>
                <Bookmark size={18} color={statusFilter === 'booked' ? '#ea580c' : '#94a3b8'} />
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a' }}>{statusCountsAndTotals.bookedCount}</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#ea580c', marginTop: '2px' }}>₹{statusCountsAndTotals.bookedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>

            {/* Card 3: Proposal Sent */}
            <div
              onClick={() => { setStatusFilter(statusFilter === 'proposal_sent' ? 'All' : 'proposal_sent'); setCurrentPage(1); }}
              style={{
                backgroundColor: statusFilter === 'proposal_sent' ? '#eff6ff' : '#ffffff',
                border: statusFilter === 'proposal_sent' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '16px 18px',
                boxShadow: statusFilter === 'proposal_sent' ? '0 4px 12px rgba(37,99,235,0.12)' : '0 1px 3px rgba(0,0,0,0.03)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: statusFilter === 'proposal_sent' ? '#1d4ed8' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Proposal Sent</span>
                <Send size={18} color={statusFilter === 'proposal_sent' ? '#2563eb' : '#94a3b8'} />
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a' }}>{statusCountsAndTotals.proposalCount}</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#2563eb', marginTop: '2px' }}>₹{statusCountsAndTotals.proposalTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>

            {/* Card 4: Signed / Approved */}
            <div
              onClick={() => { setStatusFilter(statusFilter === 'approved' ? 'All' : 'approved'); setCurrentPage(1); }}
              style={{
                backgroundColor: statusFilter === 'approved' ? '#f0fdf4' : '#ffffff',
                border: statusFilter === 'approved' ? '2px solid #16a34a' : '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '16px 18px',
                boxShadow: statusFilter === 'approved' ? '0 4px 12px rgba(22,163,74,0.12)' : '0 1px 3px rgba(0,0,0,0.03)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: statusFilter === 'approved' ? '#15803d' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Signed / Approved</span>
                <CheckCircle2 size={18} color={statusFilter === 'approved' ? '#16a34a' : '#94a3b8'} />
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a' }}>{statusCountsAndTotals.approvedCount}</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#16a34a', marginTop: '2px' }}>₹{statusCountsAndTotals.approvedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>

            {/* Card 5: Order Converted / Completed */}
            <div
              onClick={() => { setStatusFilter(statusFilter === 'order_converted' ? 'All' : 'order_converted'); setCurrentPage(1); }}
              style={{
                backgroundColor: statusFilter === 'order_converted' ? '#f0fdf4' : '#ffffff',
                border: statusFilter === 'order_converted' ? '2px solid #15803d' : '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '16px 18px',
                boxShadow: statusFilter === 'order_converted' ? '0 4px 12px rgba(21,128,61,0.12)' : '0 1px 3px rgba(0,0,0,0.03)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: statusFilter === 'order_converted' ? '#15803d' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Order Converted</span>
                <Layers size={18} color={statusFilter === 'order_converted' ? '#15803d' : '#94a3b8'} />
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a' }}>{statusCountsAndTotals.convertedCount}</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#15803d', marginTop: '2px' }}>₹{statusCountsAndTotals.convertedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
          </div>

          {/* 1. TOP FILTERS CARD */}
          <div style={{
            backgroundColor: "#ffffff",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
            marginBottom: "16px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            overflow: "hidden"
          }}>
            {/* Filters Top Bar */}
            <div style={{
              padding: "14px 20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <button
                  onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "0.95rem",
                    fontWeight: 800,
                    color: "#0f172a",
                    padding: 0
                  }}
                >
                  {isFiltersOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  <span>Filters</span>
                </button>

                <select
                  value={agreementTypeFilter}
                  onChange={(e) => setAgreementTypeFilter(e.target.value)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "8px",
                    border: "1.5px solid #fca412",
                    backgroundColor: "#fff7ed",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    color: "#0f172a",
                    outline: "none",
                    cursor: "pointer"
                  }}
                >
                  <option value="Active Agreement">Active Agreement</option>
                  <option value="Active Quotation">Active Quotation</option>
                  <option value="Draft Agreements">Draft Agreements</option>
                  <option value="Archived Contracts">Archived Contracts</option>
                </select>

                {/* Global Search Bar */}
                <div style={{ position: "relative", minWidth: "260px", flex: 1, maxWidth: "420px" }}>
                  <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#ea580c" }} />
                  <input
                    type="text"
                    placeholder="Search client, agreement ref, project ID, phone..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    style={{
                      width: "100%",
                      padding: "8px 34px 8px 36px",
                      borderRadius: "8px",
                      border: "1.5px solid #fed7aa",
                      backgroundColor: "#ffffff",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      color: "#0f172a",
                      outline: "none",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.03)"
                    }}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <button
                  onClick={resetFilters}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "1.5px solid #ef4444",
                    backgroundColor: "#fef2f2",
                    color: "#ef4444",
                    fontSize: "0.82rem",
                    fontWeight: 800,
                    cursor: "pointer",
                    boxShadow: "0 2px 6px rgba(239, 68, 68, 0.15)",
                    whiteSpace: "nowrap"
                  }}
                >
                  <RotateCcw size={14} /> Reset Filters
                </button>
              </div>
            </div>

            {/* Filter Grid Controls Panel */}
            {isFiltersOpen && (
              <div style={{
                padding: "18px 20px 22px 20px",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "16px",
                backgroundColor: "#fffcf5",
                borderTop: "1px solid #fed7aa"
              }}>
                {/* Status Filter */}
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 800, color: "#0c1527", textTransform: "uppercase", marginBottom: "6px", letterSpacing: "0.4px" }}>
                    Status:
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1.5px solid #fed7aa",
                      backgroundColor: "#ffffff",
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      color: "#0f172a",
                      outline: "none",
                      cursor: "pointer"
                    }}
                  >
                    <option value="All">All Statuses</option>
                    <option value="Created">Created</option>
                    <option value="Draft">Draft</option>
                    <option value="Signed">Signed</option>
                    <option value="Active">Active</option>
                  </select>
                </div>

                {/* Client Filter */}
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 800, color: "#0c1527", textTransform: "uppercase", marginBottom: "6px", letterSpacing: "0.4px" }}>
                    Client:
                  </label>
                  <select
                    value={clientFilter}
                    onChange={(e) => setClientFilter(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1.5px solid #fed7aa",
                      backgroundColor: "#ffffff",
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      color: "#0f172a",
                      outline: "none",
                      cursor: "pointer"
                    }}
                  >
                    <option value="All">All Clients</option>
                    {uniqueClients.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Contact Filter (Interactive Text Input) */}
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 800, color: "#0c1527", textTransform: "uppercase", marginBottom: "6px", letterSpacing: "0.4px" }}>
                    Contact:
                  </label>
                  <input
                    type="text"
                    placeholder="Enter contact number..."
                    value={contactFilter === "All" ? "" : contactFilter}
                    onChange={(e) => setContactFilter(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1.5px solid #fed7aa",
                      backgroundColor: "#ffffff",
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      color: "#0f172a",
                      outline: "none",
                      boxSizing: "border-box"
                    }}
                  />
                </div>

                {/* Project ID Filter */}
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 800, color: "#0c1527", textTransform: "uppercase", marginBottom: "6px", letterSpacing: "0.4px" }}>
                    Project ID:
                  </label>
                  <select
                    value={projectIdFilter}
                    onChange={(e) => setProjectIdFilter(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1.5px solid #fed7aa",
                      backgroundColor: "#ffffff",
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      color: "#0f172a",
                      outline: "none",
                      cursor: "pointer"
                    }}
                  >
                    <option value="All">All Project IDs</option>
                    {projectIdOptions.map((pid, i) => (
                      <option key={i} value={pid}>{pid}</option>
                    ))}
                  </select>
                </div>

                {/* Project Type Filter */}
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 800, color: "#0c1527", textTransform: "uppercase", marginBottom: "6px", letterSpacing: "0.4px" }}>
                    Project Type:
                  </label>
                  <select
                    value={projectTypeFilter}
                    onChange={(e) => setProjectTypeFilter(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1.5px solid #fed7aa",
                      backgroundColor: "#ffffff",
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      color: "#0f172a",
                      outline: "none",
                      cursor: "pointer"
                    }}
                  >
                    <option value="All">All Project Types</option>
                    <option value="Furniture Projects">Furniture Projects</option>
                    <option value="Interior Projects">Interior Projects</option>
                    <option value="Interior & Furniture Projects">Interior &amp; Furniture Projects</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* DATE RANGE TAB STRIP */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "20px",
            overflowX: "auto",
            paddingBottom: "4px",
            flexWrap: "wrap"
          }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 900, color: "#fca412", textTransform: "uppercase", marginRight: "6px", letterSpacing: "0.4px", whiteSpace: "nowrap" }}>
              Date Range:
            </span>
            {['All Time', 'Last Month', 'Last 3 Months', 'Last 6 Months', 'This Year', 'By Year', 'Custom Range'].map((rangeOption) => {
              const isActive = dateRangeFilter === rangeOption;
              return (
                <button
                  key={rangeOption}
                  onClick={() => setDateRangeFilter(rangeOption)}
                  style={{
                    padding: "6px 16px",
                    borderRadius: "20px",
                    fontSize: "0.82rem",
                    fontWeight: 800,
                    border: isActive ? "1.5px solid #fca412" : "1px solid #e2e8f0",
                    backgroundColor: isActive ? "#fca412" : "#ffffff",
                    color: isActive ? "#ffffff" : "#475569",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    boxShadow: isActive ? "0 2px 8px rgba(252,164,18,0.35)" : "0 1px 2px rgba(0,0,0,0.02)",
                    whiteSpace: "nowrap"
                  }}
                >
                  {rangeOption}
                </button>
              );
            })}

            {/* Dynamic Year Picker for By Year */}
            {dateRangeFilter === 'By Year' && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "6px", backgroundColor: "#fff7ed", padding: "6px 14px", borderRadius: "12px", border: "1.5px solid #fed7aa" }}>
                <label style={{ fontSize: "0.78rem", fontWeight: 800, color: "#ea580c" }}>Year:</label>
                <select
                  value={selectedYear}
                  onChange={(e) => {
                    setSelectedYear(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  style={{
                    padding: "5px 10px",
                    borderRadius: "6px",
                    border: "1.5px solid #2563eb",
                    backgroundColor: "#eff6ff",
                    fontSize: "0.82rem",
                    fontWeight: 800,
                    color: "#1e40af",
                    outline: "none",
                    cursor: "pointer"
                  }}
                >
                  {Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - i).map((yr) => (
                    <option key={yr} value={yr}>{yr}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Interactive Custom Date Range Inputs */}
            {dateRangeFilter === 'Custom Range' && (
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginLeft: "6px", backgroundColor: "#fff7ed", padding: "6px 14px", borderRadius: "12px", border: "1.5px solid #fed7aa" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <label style={{ fontSize: "0.78rem", fontWeight: 800, color: "#ea580c" }}>From:</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => {
                      setCustomStartDate(e.target.value);
                      setCurrentPage(1);
                    }}
                    style={{
                      padding: "5px 10px",
                      borderRadius: "6px",
                      border: "1px solid #fed7aa",
                      backgroundColor: "#ffffff",
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      color: "#0f172a",
                      outline: "none",
                      cursor: "pointer"
                    }}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <label style={{ fontSize: "0.78rem", fontWeight: 800, color: "#ea580c" }}>To:</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => {
                      setCustomEndDate(e.target.value);
                      setCurrentPage(1);
                    }}
                    style={{
                      padding: "5px 10px",
                      borderRadius: "6px",
                      border: "1px solid #fed7aa",
                      backgroundColor: "#ffffff",
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      color: "#0f172a",
                      outline: "none",
                      cursor: "pointer"
                    }}
                  />
                </div>
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
              <thead style={{ fontWeight: 900 }}>
                <tr style={{ backgroundColor: "#fff9f0", color: "#0c1527", fontWeight: 900, fontSize: "0.80rem", letterSpacing: "0.6px", height: "54px", borderBottom: "2px solid #fca412" }}>
                  <th style={{ padding: "18px 16px", width: "40px", textAlign: "center", fontWeight: 900 }}>
                    <input
                      type="checkbox"
                      checked={Object.keys(selectedRows).length > 0 && Object.keys(selectedRows).length === filteredAgreements.length}
                      onChange={toggleSelectAll}
                      style={{ cursor: "pointer", accentColor: "#fca412" }}
                    />
                  </th>
                  <th style={{ padding: "18px 16px", whiteSpace: "nowrap", textTransform: "uppercase", fontWeight: 900 }}>
                    Date
                  </th>
                  {SHOW_EXPAND_COLUMN && (
                    <th style={{ padding: "18px 16px", whiteSpace: "nowrap", textTransform: "uppercase", fontWeight: 900 }}>
                      Expand
                    </th>
                  )}
                  <th style={{ padding: "18px 16px", whiteSpace: "nowrap", textTransform: "uppercase", fontWeight: 900 }}>
                    Project ID / Ref #
                  </th>
                  <th style={{ padding: "18px 16px", whiteSpace: "nowrap", textTransform: "uppercase", fontWeight: 900 }}>
                    Quoted To / Client
                  </th>
                  <th style={{ padding: "18px 16px", whiteSpace: "nowrap", textTransform: "uppercase", fontWeight: 900 }}>
                    Amount
                  </th>
                  <th style={{ padding: "18px 16px", whiteSpace: "nowrap", textTransform: "uppercase", fontWeight: 900 }}>
                    Status
                  </th>
                  <th style={{ padding: "18px 16px", whiteSpace: "nowrap", textTransform: "uppercase", fontWeight: 900 }}>
                    Payment Date
                  </th>
                  <th style={{ padding: "18px 16px", textAlign: "right", minWidth: "160px", textTransform: "uppercase", fontWeight: 900 }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={SHOW_EXPAND_COLUMN ? 9 : 8} style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                      Loading agreements...
                    </td>
                  </tr>
                ) : paginatedAgreements.length === 0 ? (
                  <tr>
                    <td colSpan={SHOW_EXPAND_COLUMN ? 9 : 8} style={{ textAlign: "center", padding: "50px 20px", color: "#64748b" }}>
                      <FileText size={48} style={{ margin: "0 auto 12px", display: "block", opacity: 0.3 }} />
                      <div style={{ fontWeight: 700, fontSize: "1rem", color: "#334155" }}>No Agreements Found</div>
                      <div style={{ fontSize: "0.85rem", marginTop: "4px" }}>Click "Create New Agreement" or add a sales lead to populate this list.</div>
                    </td>
                  </tr>
                ) : (
                  paginatedAgreements.map((ag, idx) => {
                    const isExpanded = !!expandedRows[ag.id];
                    const isSelected = !!selectedRows[ag.id];
                    const displayProjectId = ag.project_code || (ag.project_id ? (String(ag.project_id).startsWith('PR-') || String(ag.project_id).startsWith('LVC') ? ag.project_id : `PR-${ag.project_id}`) : (ag.ref_id || `AGR-${ag.id}`));

                    return (
                      <React.Fragment key={ag.id}>
                        <tr
                          onClick={() => handleEdit(ag)}
                          style={{
                            borderBottom: isExpanded ? "none" : "1px solid #f1f5f9",
                            backgroundColor: isSelected ? "#fffcf5" : "transparent",
                            transition: "background-color 0.15s",
                            cursor: "pointer"
                          }}
                        >
                          {/* 1. Checkbox */}
                          <td style={{ padding: "16px", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectRow(ag.id)}
                              style={{ cursor: "pointer", accentColor: "#ea580c" }}
                            />
                          </td>

                          {/* 2. Date */}
                          <td style={{ padding: "16px", color: "#334155", fontWeight: 600, whiteSpace: "nowrap" }}>
                            {formatDisplayDate(ag.date)}
                          </td>

                          {/* 3. + Expand Line Items */}
                          {SHOW_EXPAND_COLUMN && (
                            <td style={{ padding: "16px" }} onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => toggleRowExpand(ag.id)}
                                style={{
                                  background: isExpanded ? "#fff7ed" : "#f8fafc",
                                  border: isExpanded ? "1px solid #fed7aa" : "1px solid #e2e8f0",
                                  borderRadius: "6px",
                                  cursor: "pointer",
                                  fontSize: "0.9rem",
                                  fontWeight: 700,
                                  color: isExpanded ? "#ea580c" : "#475569",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  width: "26px",
                                  height: "26px"
                                }}
                                title="Expand / Collapse Details"
                              >
                                {isExpanded ? <Minus size={14} /> : <Plus size={14} />}
                              </button>
                            </td>
                          )}

                          {/* 4. Project ID / Agreement Ref # */}
                          <td style={{ padding: "16px", fontWeight: 600, color: "#334155" }}>
                            <div style={{ fontSize: "0.92rem", fontWeight: 800, color: "#0c1527" }}>{displayProjectId}</div>
                            {ag.ref_id && ag.ref_id !== displayProjectId && (
                              <span style={{ fontSize: "0.74rem", fontWeight: 600, color: "#64748b", background: "#fff9f0", border: "1px solid #ffe8c2", padding: "2px 8px", borderRadius: "4px", display: "inline-block", marginTop: "3px" }}>
                                Ref: {ag.ref_id}
                              </span>
                            )}
                          </td>

                          {/* 5. Quoted To / Client */}
                          <td style={{ padding: "16px", fontWeight: 600, color: "#0f172a" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <div style={{
                                width: "32px",
                                height: "32px",
                                borderRadius: "50%",
                                backgroundColor: "#fff9f0",
                                border: "1.5px solid #fca412",
                                color: "#0c1527",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                flexShrink: 0
                              }}>
                                {(ag.client_name || 'Valued Client').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                              </div>
                              <span>{ag.client_name}</span>
                              {ag.isFromProject && (
                                <span style={{ fontSize: "0.7rem", backgroundColor: "#fff9f0", border: "1px solid #ffe8c2", color: "#0c1527", padding: "2px 6px", borderRadius: "4px", fontWeight: 700 }}>
                                  Live Sales Lead
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 6. Amount */}
                          <td style={{ padding: "16px", fontWeight: 600, color: "#0f172a", fontSize: "0.90rem", whiteSpace: "nowrap" }}>
                            ₹{parseFloat(String(ag.contract_value || 0).replace(/,/g, '')).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          {/* 7. Status Dropdown matching brand palette */}
                          <td style={{ padding: "16px" }} onClick={(e) => e.stopPropagation()}>
                            {(() => {
                              const rawStatus = String(ag.status || 'booked').toLowerCase().trim();
                              let selectVal = 'booked';
                              let bg = '#fff9f0', fg = '#ea580c', border = '#ffe8c2';

                              if (rawStatus === 'proposal' || rawStatus === 'proposal_sent' || rawStatus === 'sent') {
                                selectVal = 'proposal_sent';
                                bg = '#eff6ff'; fg = '#2563eb'; border = '#bfdbfe';
                              } else if (rawStatus === 'approved' || rawStatus === 'qc_approved' || rawStatus === 'finalized' || rawStatus === 'signed' || rawStatus === 'completed') {
                                selectVal = 'approved';
                                bg = '#f0fdf4'; fg = '#16a34a'; border = '#bbf7d0';
                              } else if (rawStatus === 'order_converted' || rawStatus === 'deal_done' || rawStatus === 'deal_won') {
                                selectVal = 'order_converted';
                                bg = '#15803d'; fg = '#ffffff'; border = '#166534';
                              } else {
                                selectVal = 'booked';
                                bg = '#fff9f0'; fg = '#ea580c'; border = '#ffe8c2';
                              }

                              const agreementStatusOrder = ['booked', 'proposal_sent', 'approved', 'order_converted'];
                              const currentIdx = agreementStatusOrder.indexOf(selectVal);

                              return (
                                <select
                                  value={selectVal}
                                  onChange={async (e) => {
                                    const newSt = e.target.value;
                                    const newIdx = agreementStatusOrder.indexOf(newSt);
                                    if (!isAdmin && newIdx < currentIdx) return; // Disallow reverting to previous status for non-admin
                                    // Update ONLY exact target agreement row in local state INSTANTLY
                                    setAgreements(prev => prev.map(item =>
                                      (String(item.id) === String(ag.id) || (ag.ref_id && String(item.ref_id) === String(ag.ref_id)))
                                        ? { ...item, status: newSt }
                                        : item
                                    ));
                                    try {
                                      // Save status silently in background without page refresh
                                      await fetch(`${API_BASE_URL}/agreements/update-status`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          id: ag.id,
                                          ref_id: ag.ref_id,
                                          status: newSt
                                        })
                                      });
                                    } catch (err: any) {
                                      console.error('Failed to update agreement status:', err);
                                    }
                                  }}
                                  style={{
                                    padding: '6px 12px',
                                    borderRadius: '8px',
                                    fontSize: '0.80rem',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    outline: 'none',
                                    backgroundColor: bg,
                                    color: fg,
                                    border: `1.5px solid ${border}`,
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                                    transition: 'all 0.2s ease-in-out'
                                  }}
                                >
                                  <option value="booked" disabled={!isAdmin && currentIdx > 0} style={{ backgroundColor: '#ffffff', color: (!isAdmin && currentIdx > 0) ? '#9ca3af' : '#ea580c' }}>Booked</option>
                                  <option value="proposal_sent" disabled={!isAdmin && currentIdx > 1} style={{ backgroundColor: '#ffffff', color: (!isAdmin && currentIdx > 1) ? '#9ca3af' : '#2563eb' }}>Proposal Sent</option>
                                  <option value="approved" disabled={!isAdmin && currentIdx > 2} style={{ backgroundColor: '#ffffff', color: (!isAdmin && currentIdx > 2) ? '#9ca3af' : '#16a34a' }}>Approved</option>
                                  <option value="order_converted" disabled={!isAdmin && currentIdx > 3} style={{ backgroundColor: '#ffffff', color: (!isAdmin && currentIdx > 3) ? '#9ca3af' : '#15803d' }}>Order Converted</option>
                                </select>
                              );
                            })()}
                            {/* Acknowledged badge — shown below the status dropdown */}
                            {ag.acknowledged_at && (
                              <div style={{
                                marginTop: '6px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: '#f0fdf4',
                                border: '1px solid #bbf7d0',
                                borderRadius: '6px',
                                padding: '3px 8px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                color: '#16a34a',
                                whiteSpace: 'nowrap'
                              }}>
                                <CheckCircle2 size={11} />
                                Acknowledged&nbsp;
                                <span style={{ fontWeight: 500, color: '#4ade80' }}>
                                  {new Date(ag.acknowledged_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                                </span>
                              </div>
                            )}
                          </td>

                          {/* 8. Payment Date */}
                          <td style={{ padding: "14px 16px", color: "#64748b" }}>
                            {ag.payment_date || "-"}
                          </td>

                          {/* 9. Actions matching reference UI icons */}
                          <td style={{ padding: "14px 16px", textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "6px" }}>
                              {/* Share Email */}
                              <button
                                onClick={() => openShareModal(ag)}
                                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#fca412", padding: "4px", borderRadius: "4px" }}
                                title="Share Agreement via Email"
                              >
                                <Share2 size={16} />
                              </button>

                              {/* Send Acknowledgement Email */}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleSendAckEmail(ag); }}
                                disabled={ackSendingId === ag.id}
                                style={{
                                  background: ag.acknowledged_at ? '#f0fdf4' : 'transparent',
                                  border: ag.acknowledged_at ? '1px solid #bbf7d0' : 'none',
                                  cursor: ackSendingId === ag.id ? 'wait' : 'pointer',
                                  color: ag.acknowledged_at ? '#16a34a' : '#2563eb',
                                  padding: '4px',
                                  borderRadius: '4px',
                                  opacity: ackSendingId === ag.id ? 0.6 : 1,
                                  transition: 'all 0.15s'
                                }}
                                title={ag.acknowledged_at
                                  ? `Acknowledged on ${new Date(ag.acknowledged_at).toLocaleString('en-IN')}`
                                  : (ag.ack_email_sent_at ? 'Re-send Acknowledgement Email' : 'Send Acknowledgement Email')}
                              >
                                {ackSendingId === ag.id
                                  ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                                  : ag.acknowledged_at
                                    ? <CheckCircle2 size={16} />
                                    : <Mail size={16} />}
                              </button>

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

                              {/* Client Signature */}
                              <button
                                onClick={() => {
                                  setSigModalAgreement(ag);
                                  setShowSigModal(true);
                                }}
                                style={{
                                  background: "transparent", border: "none", cursor: "pointer",
                                  color: ag.client_signature ? "#16a34a" : "#0284c7",
                                  padding: "4px", borderRadius: "4px"
                                }}
                                title={ag.client_signature ? "Client Signature (Signed) - Click to view/edit" : "Client Signature Pad"}
                              >
                                <PenTool size={16} />
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

              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <button onClick={async () => {
                  const savedId = await handleQuietSave(status);
                  openShareModal({
                    id: savedId || editingId,
                    client_name: `${title ? title + ' ' : ''}${clientName}`.trim(),
                    raw_client_name: clientName,
                    title: title,
                    ref_id: refId,
                    contract_value: feeAmount,
                    contract_value_words: feeWords,
                    address: address,
                    date: date,
                    place: place,
                    status: status,
                    project_type: projectType,
                    project_id: projectIdInput,
                    quote_id: selectedQuoteId,
                    furniture_payment_schedule: furniturePaymentSchedule,
                    brand_list: brandsList,
                    installments_list: installmentsList,
                    convenience_fee_note: convenienceFeeNote,
                    delivery_installation_note: deliveryInstallationNote,
                    cancellation_min_amount: cancellationMinAmount,
                    booking_scenario_date: bookingScenarioDate,
                    include_quotation: includeQuotation,
                    include_contract: includeContract,
                    include_handover: includeHandover,
                    client_signature: clientSignature
                  });
                }} style={{ padding: "9px 16px", borderRadius: "8px", backgroundColor: "#ffffff", color: "#fca412", border: "1.5px solid #fca412", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Mail size={16} /> Send PDF Mail
                </button>

                <button onClick={() => handleSave("Draft")} style={{ padding: "9px 16px", borderRadius: "8px", backgroundColor: isCurrentSigned ? "#2563eb" : "#fca412", color: "#ffffff", border: "none", fontWeight: 800, cursor: "pointer", boxShadow: isCurrentSigned ? "0 2px 8px rgba(37,99,235,0.3)" : "0 2px 8px rgba(252,164,18,0.3)", display: "flex", alignItems: "center", gap: "6px" }}>
                  {isCurrentSigned ? <Unlock size={16} /> : null}
                  {isCurrentSigned ? 'Revert to Draft & Unlock Editing' : 'Save Draft'}
                </button>

                {isCurrentSigned ? (
                  <div style={{ padding: "9px 16px", borderRadius: "8px", backgroundColor: "#f0fdf4", color: "#16a34a", border: "1.5px solid #bbf7d0", fontWeight: 800, display: "flex", alignItems: "center", gap: "6px" }}>
                    <CheckCircle2 size={16} color="#16a34a" /> Signed &amp; Locked
                  </div>
                ) : (
                  <button onClick={() => handleSave("Signed")} style={{ padding: "9px 16px", borderRadius: "8px", backgroundColor: "#16a34a", color: "#ffffff", border: "none", fontWeight: 800, cursor: "pointer", boxShadow: "0 2px 8px rgba(22,163,74,0.3)", display: "flex", alignItems: "center", gap: "6px" }}>
                    <CheckCircle2 size={16} /> Mark Signed
                  </button>
                )}

                <button onClick={async () => {
                  await handleSave(status);
                  handlePrint();
                }} style={{ padding: "9px 16px", borderRadius: "8px", backgroundColor: "#fca412", color: "#ffffff", border: "none", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", boxShadow: "0 2px 8px rgba(252,164,18,0.3)" }}>
                  <Printer size={16} /> Save &amp; Print Contract PDF
                </button>
              </div>
            </div>

            {isCurrentSigned && (
              <div style={{ backgroundColor: "#f0fdf4", border: "1.5px solid #bbf7d0", color: "#166534", padding: "12px 18px", borderRadius: "10px", marginBottom: "20px", fontWeight: 700, fontSize: "0.88rem", display: "flex", alignItems: "center", gap: "10px" }}>
                <CheckCircle2 size={20} color="#166534" />
                <div>
                  <strong>Signed &amp; Locked Agreement:</strong> Details cannot be edited for signed contracts. Click <b>"Revert to Draft &amp; Unlock Editing"</b> (Save Draft) if you need to edit details for this project.
                </div>
              </div>
            )}

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
                1. General Details &amp; Package Documents
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

            <fieldset disabled={!isAdmin && isCurrentSigned} style={{ border: "none", padding: 0, margin: 0, opacity: (!isAdmin && isCurrentSigned) ? 0.75 : 1 }}>

              {activeFormTab === "general" ? (
                <div>
                  {/* Quick Select Quotation Dropdown */}
                  <div style={{ marginBottom: "18px", padding: "14px 18px", backgroundColor: "#fff9f0", borderRadius: "10px", border: "1.5px solid #fca412", boxShadow: "0 2px 6px rgba(252,164,18,0.1)" }}>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 800, color: "#0c1527", marginBottom: "6px" }}>
                      ⚡ Quick Select Quotation / Project to Auto-Fill &amp; Render PDF:
                    </label>
                    <select
                      onChange={(e) => {
                        if (e.target.value) handleProjectIdInput(e.target.value);
                      }}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: "1.5px solid #fca412",
                        fontSize: "0.9rem",
                        backgroundColor: "#ffffff",
                        fontWeight: 800,
                        color: "#0c1527",
                        outline: "none",
                        cursor: "pointer"
                      }}
                    >
                      <option value="">-- Click here to pick any Order Converted Quotation / Project --</option>
                      {(orderConvertedQuotesList.length > 0 ? orderConvertedQuotesList : allQuotesList).map((q: any, i: number) => {
                        const displayId = q.project_code || (q.project_id ? `PR-${q.project_id}` : `QTN-${q.quote_id}`);
                        const cName = q.client_name || q.subtitle || 'Client';
                        const amt = parseFloat(q.total_amount || 0);
                        const amtStr = amt > 0 ? ` (₹${Math.round(amt).toLocaleString('en-IN')})` : '';
                        return (
                          <option key={`sel-q-${i}`} value={q.quote_number || displayId || q.quote_id}>
                            {displayId} — {cName}{amtStr} [Quote #{q.quote_number || q.quote_id}]
                          </option>
                        );
                      })}
                    </select>
                  </div>

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
                      <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 800, color: "#0c1527", marginBottom: "4px" }}>Project ID (Auto-Fills Details &amp; Links Quota PDF)</label>
                      <input
                        list="project-ids-list"
                        value={projectIdInput}
                        onChange={(e) => handleProjectIdInput(e.target.value)}
                        placeholder="e.g. PR-101 or type/select Project ID..."
                        style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1.5px solid #fca412", backgroundColor: "#fff9f0", fontWeight: 800, fontSize: "0.9rem", color: "#0c1527" }}
                      />
                      <datalist id="project-ids-list">
                        {(orderConvertedProjectsList.length > 0 ? orderConvertedProjectsList : allProjectsList).map((p: any, i: number) => {
                          const pCode = p.project_code || `P-${p.project_id || p.id}`;
                          const rawId = String(p.project_id || p.id || '');
                          return (
                            <React.Fragment key={`p-grp-${i}`}>
                              <option value={pCode}>{pCode} — {p.client_name || p.project_name || 'Project'}</option>
                              {rawId && rawId !== pCode && <option value={rawId}>Project #{rawId} — {p.client_name || p.project_name || 'Project'}</option>}
                            </React.Fragment>
                          );
                        })}
                        {(orderConvertedQuotesList.length > 0 ? orderConvertedQuotesList : allQuotesList).map((q: any, i: number) => {
                          const pCode = q.project_code || (q.project_id ? `PR-${q.project_id}` : `QTN-${q.quote_id}`);
                          const rawId = String(q.project_id || '');
                          return (
                            <React.Fragment key={`q-grp-${i}`}>
                              {pCode && <option value={pCode}>{pCode} — {q.client_name || q.subtitle || 'Quotation'}</option>}
                              {rawId && rawId !== pCode && <option value={rawId}>Project #{rawId} — {q.client_name || q.subtitle || 'Quotation'}</option>}
                            </React.Fragment>
                          );
                        })}
                      </datalist>
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
                        <input
                          type="checkbox"
                          checked={includeHandover}
                          onChange={(e) => setIncludeHandover(e.target.checked)}
                          style={{ width: "18px", height: "18px", cursor: "pointer" }}
                        />
                        Include Handover PDF (Handover Terms & Guidelines)
                      </label>
                    </div>
                  </div>

                  {/* LINKED QUOTATION VERSIONS SELECTOR */}
                  {includeQuotation && quoteHistory.length > 0 && (
                    <div style={{ marginTop: "16px", padding: "14px 18px", backgroundColor: "#f0f7ff", borderRadius: "10px", border: "1.5px solid #93c5fd" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "6px" }}>
                        <span style={{ fontSize: "0.86rem", fontWeight: 800, color: "#1e40af" }}>
                          📋 Linked Quotation Versions History ({quoteHistory.length}):
                        </span>
                        <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#3b82f6" }}>
                          Click a version to update preview &amp; contract value
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                        {quoteHistory.map((q, qIdx) => {
                          const isSel = String(q.quote_id) === String(selectedQuoteId || activeQuoteData?.quote_id);
                          const amt = Math.round(parseFloat(q.total_amount || 0));
                          return (
                            <button
                              key={`qh-${q.quote_id || qIdx}`}
                              type="button"
                              onClick={() => handleSelectQuoteVersion(q)}
                              style={{
                                padding: "6px 14px",
                                borderRadius: "8px",
                                border: isSel ? "2px solid #2563eb" : "1px solid #cbd5e1",
                                backgroundColor: isSel ? "#2563eb" : "#ffffff",
                                color: isSel ? "#ffffff" : "#1e293b",
                                fontSize: "0.82rem",
                                fontWeight: 800,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                boxShadow: isSel ? "0 2px 6px rgba(37,99,235,0.25)" : "none"
                              }}
                            >
                              <span>Version {q.version || (qIdx + 1)}</span>
                              <span style={{ opacity: isSel ? 0.9 : 0.75 }}>• ₹{amt.toLocaleString('en-IN')}</span>
                              {isSel && <span>✓ Active</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
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
            </fieldset>
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
          <div className="modal-box" style={{ backgroundColor: "#ffffff", borderRadius: "12px", width: "90%", maxWidth: "800px" }}>
            {/* Sticky Header */}
            <div className="modal-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: "1px solid #e2e8f0", backgroundColor: "#ffffff", borderRadius: "12px 12px 0 0" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "#0f172a" }}>Agreement Details — {previewAgreement.ref_id}</h3>
                <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>{previewAgreement.client_name} • {previewAgreement.project_type || "Interior Design"}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <button
                  onClick={() => {
                    const target = previewAgreement;
                    setPreviewAgreement(null);
                    handleEdit(target);
                  }}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "6px",
                    backgroundColor: "#fca412",
                    color: "#ffffff",
                    border: "none",
                    fontWeight: 800,
                    fontSize: "0.82rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  <ExternalLink size={14} /> Open Full Contract &amp; PDF
                </button>
                <button onClick={() => setPreviewAgreement(null)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#64748b", padding: "4px", display: "flex", alignItems: "center" }}>
                  <X size={24} />
                </button>
              </div>
            </div>
            {/* Scrollable Body */}
            <div className="modal-body" style={{ padding: "24px", maxHeight: "75vh", overflowY: "auto" }}>
              {previewAgreement.project_type === "Furniture Design" ? (
                <LivincartFurnitureContract
                  clientName={previewAgreement.client_name}
                  date={formatDisplayDate(previewAgreement.date)}
                  contractValue={previewAgreement.contract_value}
                  contractValueWords={previewAgreement.contract_value_words || convertNumberToWords(previewAgreement.contract_value)}
                  address={previewAgreement.address}
                  clientSignature={previewAgreement.client_signature || ''}
                />
              ) : (
                <LivincartContract
                  clientName={previewAgreement.client_name}
                  date={formatDisplayDate(previewAgreement.date)}
                  contractValue={previewAgreement.contract_value}
                  contractValueWords={previewAgreement.contract_value_words || convertNumberToWords(previewAgreement.contract_value)}
                  address={previewAgreement.address}
                  clientSignature={previewAgreement.client_signature || ''}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* SHARE EMAIL MODAL WITH DOCUMENT CHECKBOXES & MERGE CAPABILITY */}
      {shareModalAgreement && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(12,21,39,0.75)", zIndex: 9999, display: "flex", justifyContent: "center", alignItems: "center", padding: "20px" }}>
          <div className="modal-box" style={{ backgroundColor: "#ffffff", borderRadius: "16px", width: "100%", maxWidth: "600px", boxShadow: "0 20px 40px rgba(0,0,0,0.3)" }}>
            {/* Sticky Header */}
            <div className="modal-header" style={{ display: "flex", alignItems: "center", gap: "12px", padding: "20px 24px", borderBottom: "2px solid #f1f5f9", backgroundColor: "#ffffff", borderRadius: "16px 16px 0 0" }}>
              <div style={{ padding: "10px", backgroundColor: "#fff9f0", borderRadius: "10px", color: "#fca412", flexShrink: 0 }}>
                <Mail size={24} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "#0c1527" }}>
                  Share Official Document Email
                </h3>
                <p style={{ margin: "2px 0 0 0", fontSize: "0.85rem", color: "#64748b" }}>
                  Client: {shareModalAgreement.client_name || 'Valued Client'} • Ref: #{shareModalAgreement.ref_id || 'N/A'}
                </p>
              </div>
              <button onClick={() => setShareModalAgreement(null)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#64748b", padding: "4px", display: "flex", alignItems: "center", flexShrink: 0 }}>
                <X size={24} />
              </button>
            </div>
            {/* Scrollable Body */}
            <div className="modal-body" style={{ padding: "24px" }}>

            <form onSubmit={handleSendShareEmail}>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 800, color: "#0c1527", marginBottom: "6px", textTransform: "uppercase" }}>
                  Recipient Email Address
                </label>
                <input
                  type="email"
                  required
                  value={shareEmailForm.to}
                  onChange={(e) => setShareEmailForm({ ...shareEmailForm, to: e.target.value })}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1.5px solid #cbd5e1", fontSize: "0.9rem", color: "#0c1527", fontWeight: 600 }}
                  placeholder="client@gmail.com"
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 800, color: "#0c1527", marginBottom: "6px", textTransform: "uppercase" }}>
                  Email Subject
                </label>
                <input
                  type="text"
                  required
                  value={shareEmailForm.subject}
                  onChange={(e) => setShareEmailForm({ ...shareEmailForm, subject: e.target.value })}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1.5px solid #cbd5e1", fontSize: "0.9rem", color: "#0c1527", fontWeight: 600 }}
                />
              </div>

              {/* Multi-document Selection Checkboxes & Visual Attachments */}
              <div style={{ backgroundColor: "#fff9f0", border: "1.5px dashed #fca412", padding: "16px", borderRadius: "12px", marginBottom: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Paperclip size={18} color="#fca412" />
                    <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#0c1527" }}>
                      Select Documents to Include in Attachment:
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSharePreviewPdfModal(!sharePreviewPdfModal)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "5px 10px",
                      borderRadius: "6px",
                      border: "1px solid #fca412",
                      backgroundColor: sharePreviewPdfModal ? "#fca412" : "#ffffff",
                      color: sharePreviewPdfModal ? "#ffffff" : "#c2410c",
                      fontSize: "0.78rem",
                      fontWeight: 800,
                      cursor: "pointer",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <Eye size={14} /> {sharePreviewPdfModal ? 'Hide Live PDF Preview' : 'Preview PDF Package'}
                  </button>
                </div>

                <div style={{ backgroundColor: "#ffffff", padding: "14px", borderRadius: "8px", border: "1px solid #fed7aa" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

                    {/* 1. Quotation PDF */}
                    <div style={{
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: shareIncludeQuote ? "1.5px solid #fca412" : "1px solid #e2e8f0",
                      backgroundColor: shareIncludeQuote ? "#fffdfa" : "#f8fafc",
                      transition: "all 0.15s ease"
                    }}>
                      <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={shareIncludeQuote}
                          onChange={(e) => setShareIncludeQuote(e.target.checked)}
                          style={{ width: "18px", height: "18px", accentColor: "#fca412", cursor: "pointer", marginTop: "2px" }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "0.88rem", fontWeight: 800, color: "#0f172a" }}>Quotation PDF (Latest Saved Commercial Quote)</span>
                            <span style={{ fontSize: "0.72rem", fontWeight: 800, backgroundColor: shareIncludeQuote ? "#e0f2fe" : "#f1f5f9", color: shareIncludeQuote ? "#0369a1" : "#94a3b8", padding: "2px 8px", borderRadius: "4px" }}>
                              {shareIncludeQuote ? '✓ Configured & Attached' : 'Not Included'}
                            </span>
                          </div>
                          <p style={{ margin: "3px 0 0 0", fontSize: "0.76rem", color: "#64748b", fontWeight: 600 }}>
                            Filename: <span style={{ fontFamily: "monospace", color: "#334155" }}>Quotation_{shareModalAgreement.ref_id || 'Quote'}.pdf</span>
                          </p>
                        </div>
                      </label>
                    </div>

                    {/* 2. Works Contract Agreement PDF */}
                    <div style={{
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: shareIncludeAgreement ? "1.5px solid #fca412" : "1px solid #e2e8f0",
                      backgroundColor: shareIncludeAgreement ? "#fffdfa" : "#f8fafc",
                      transition: "all 0.15s ease"
                    }}>
                      <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={shareIncludeAgreement}
                          onChange={(e) => setShareIncludeAgreement(e.target.checked)}
                          style={{ width: "18px", height: "18px", accentColor: "#fca412", cursor: "pointer", marginTop: "2px" }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "0.88rem", fontWeight: 800, color: "#0f172a" }}>
                              Works Contract Agreement PDF {isAgreementSigned ? '(Signed & Available)' : '(Agreement Terms)'}
                            </span>
                            <span style={{ fontSize: "0.72rem", fontWeight: 800, backgroundColor: shareIncludeAgreement ? (isAgreementSigned ? "#dcfce7" : "#e0f2fe") : "#f1f5f9", color: shareIncludeAgreement ? (isAgreementSigned ? "#15803d" : "#0369a1") : "#94a3b8", padding: "2px 8px", borderRadius: "4px" }}>
                              {shareIncludeAgreement ? (isAgreementSigned ? '✓ Signed & Attached' : '✓ Configured & Attached') : 'Not Included'}
                            </span>
                          </div>
                          <p style={{ margin: "3px 0 0 0", fontSize: "0.76rem", color: "#64748b", fontWeight: 600 }}>
                            Filename: <span style={{ fontFamily: "monospace", color: "#334155" }}>Works_Contract_{shareModalAgreement.ref_id || 'Agreement'}.pdf</span>
                          </p>
                        </div>
                      </label>
                    </div>

                    {/* 3. Handover PDF */}
                    <div style={{
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: shareIncludeHandover ? "1.5px solid #fca412" : "1px solid #e2e8f0",
                      backgroundColor: shareIncludeHandover ? "#fffdfa" : "#f8fafc",
                      transition: "all 0.15s ease"
                    }}>
                      <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={shareIncludeHandover}
                          onChange={(e) => {
                            const isHandoverEligible = String(shareModalAgreement?.status || '').toLowerCase() === 'completed' || 
                                                       shareModalAgreement?.project_stage === 'handover' || 
                                                       shareModalAgreement?.stage5_paid === 1 || 
                                                       shareModalAgreement?.is_100_percent_paid === 1;
                            if (e.target.checked && !isHandoverEligible) {
                              alert('🔒 Handover PDF requires 100% full project payment (Stage 5 milestone). Current project payment is incomplete.');
                              return;
                            }
                            setShareIncludeHandover(e.target.checked);
                          }}
                          style={{ width: "18px", height: "18px", accentColor: "#fca412", cursor: "pointer", marginTop: "2px" }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "0.88rem", fontWeight: 800, color: "#0f172a" }}>Handover PDF (Handover Terms &amp; Guidelines)</span>
                            <span style={{ fontSize: "0.72rem", fontWeight: 800, backgroundColor: shareIncludeHandover ? "#e0e7ff" : "#f1f5f9", color: shareIncludeHandover ? "#3730a3" : "#94a3b8", padding: "2px 8px", borderRadius: "4px" }}>
                              {shareIncludeHandover ? '✓ Attached' : 'Not Included'}
                            </span>
                          </div>
                          <p style={{ margin: "3px 0 0 0", fontSize: "0.76rem", color: "#64748b", fontWeight: 600 }}>
                            Filename: <span style={{ fontFamily: "monospace", color: "#334155" }}>Handover_Terms_{shareModalAgreement.ref_id || 'Guidelines'}.pdf</span>
                          </p>
                        </div>
                      </label>
                    </div>

                  </div>

                  {([shareIncludeQuote, shareIncludeAgreement, shareIncludeHandover].filter(Boolean).length > 1) && (
                    <div style={{ marginTop: "12px", fontSize: "0.78rem", color: "#3730a3", fontWeight: 700, backgroundColor: "#e0e7ff", padding: "8px 12px", borderRadius: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <span>✨ Multiple documents selected! Combined into single PDF package:</span>
                      <strong style={{ textDecoration: "underline" }}>
                        {[shareIncludeQuote && '1. Quotation', shareIncludeAgreement && '2. Agreement', shareIncludeHandover && '3. Handover'].filter(Boolean).join(' → ')}
                      </strong>
                    </div>
                  )}
                </div>

                {/* LIVE PDF PREVIEW MODAL EXPANDER INSIDE SHARE MODAL */}
                {sharePreviewPdfModal && (
                  <div style={{ marginTop: "14px", padding: "14px", backgroundColor: "#ffffff", borderRadius: "10px", border: "1.5px solid #fca412", maxHeight: "350px", overflowY: "auto", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "#0c1527", marginBottom: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>👁️ Live PDF Document Attachment Preview:</span>
                      <span style={{ fontSize: "0.74rem", color: "#64748b" }}>Exact 1-to-1 PDF Rendering</span>
                    </div>
                    <div style={{ zoom: 0.75, border: "1px solid #cbd5e1", borderRadius: "8px", overflow: "hidden" }}>
                      {renderTemplate(
                        shareModalAgreement?.project_type || projectType,
                        shareModalAgreement?.client_name || clientName,
                        shareModalAgreement?.date || date,
                        shareModalAgreement?.contract_value || feeAmount,
                        shareModalAgreement?.contract_value_words || feeWords,
                        shareModalAgreement?.address || address,
                        shareModalAgreement?.ref_id || refId,
                        shareIncludeHandover,
                        shareIncludeQuote,
                        shareIncludeAgreement,
                        shareModalAgreement?.client_signature || clientSignature || ''
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: "24px" }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 800, color: "#0c1527", marginBottom: "6px", textTransform: "uppercase" }}>
                  Email Message Content
                </label>
                <textarea
                  rows={5}
                  required
                  value={shareEmailForm.content}
                  onChange={(e) => setShareEmailForm({ ...shareEmailForm, content: e.target.value })}
                  style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1.5px solid #cbd5e1", color: "#0c1527", fontFamily: "inherit", lineHeight: 1.5 }}
                />
              </div>

              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setShareModalAgreement(null)}
                  style={{ padding: "10px 20px", borderRadius: "8px", border: "1.5px solid #cbd5e1", backgroundColor: "#ffffff", color: "#64748b", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={shareSending}
                  style={{ padding: "10px 24px", borderRadius: "8px", border: "none", backgroundColor: "#fca412", color: "#ffffff", fontWeight: 800, fontSize: "0.88rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", boxShadow: "0 4px 14px rgba(252,164,18,0.35)", opacity: shareSending ? 0.7 : 1 }}
                >
                  {shareSending ? <RotateCcw className="animate-spin" size={18} /> : <Send size={18} />}
                  {shareSending ? "Sending Mail..." : "Send Mail with Attached PDF(s)"}
                </button>
              </div>
            </form>

            {/* SINGLE VISIBLE CAPTURE TARGET FOR EMAIL PDF GENERATION (opacity: 1 to prevent space glyph clipping) */}
            <div id="share-modal-pdf-capture" style={{ position: "absolute", top: "-9999px", left: 0, width: "794px", opacity: 1, pointerEvents: "none", zIndex: -9999, backgroundColor: "#ffffff" }}>
              {renderTemplate(
                shareModalAgreement?.project_type || projectType,
                shareModalAgreement?.client_name || clientName,
                shareModalAgreement?.date || date,
                shareModalAgreement?.contract_value || feeAmount,
                shareModalAgreement?.contract_value_words || feeWords,
                shareModalAgreement?.address || address,
                shareModalAgreement?.ref_id || refId,
                shareIncludeHandover,
                shareIncludeQuote,
                shareIncludeAgreement,
                shareModalAgreement?.client_signature || clientSignature || ''
              )}
            </div>
            </div>
          </div>
        </div>
      )}
      {showSigModal && sigModalAgreement && (
        <ClientSignatureModal
          isOpen={showSigModal}
          onClose={() => setShowSigModal(false)}
          clientName={sigModalAgreement.client_name || 'Client'}
          projectId={sigModalAgreement.project_id || sigModalAgreement.id}
          leadId={sigModalAgreement.lead_id}
          existingSignature={sigModalAgreement.client_signature || clientSignature || ''}
          onSignatureSaved={(sigDataUrl) => {
            setClientSignature(sigDataUrl);
            setAgreements(prev => prev.map(a =>
              (a.id === sigModalAgreement.id || (sigModalAgreement.project_id && a.project_id === sigModalAgreement.project_id))
                ? { ...a, client_signature: sigDataUrl }
                : a
            ));
            fetchAgreements();
          }}
        />
      )}

    </div>
  );
}
