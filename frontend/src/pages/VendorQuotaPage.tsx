import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useAuth } from '../hooks/useAuth';
import {
    Store, Search, Filter, Download, Eye, FileText, Plus, Minus, X, Loader2, RotateCcw, Save,
    Building2, CheckCircle2, ChevronRight, Package, Truck, Users, Layers, ExternalLink, Printer, ShoppingCart, Edit2,
    MoreVertical, Check, Lock, Send, Copy, ArrowUp, ArrowDown, ChevronDown, XCircle, ArrowLeft
} from 'lucide-react';
import liveLogo from '../assets/1.png';
import liveCartSignature from '../assets/LIVE CART SINGTU.png';

const PRINT_STYLES = `
@media screen {
    .vendor-quota-printable-document {
        display: none !important;
    }
    .vendor-builder-modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
}
@media print {
    * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
    }
    @page {
        size: A4 portrait;
        margin: 8mm;
    }
    html, body {
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
        overflow: visible !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
    }
    body > *:not(.vendor-quota-pdf-backdrop) {
        display: none !important;
    }
    .no-print,
    .vendor-builder-modal-header,
    .vendor-quota-interactive-builder,
    button,
    input,
    select {
        display: none !important;
        visibility: hidden !important;
        height: 0 !important;
        max-height: 0 !important;
        overflow: hidden !important;
    }
    .vendor-quota-pdf-backdrop,
    .vendor-quota-pdf-dialog,
    .vendor-quota-pdf-body {
        position: static !important;
        display: block !important;
        width: 100% !important;
        height: auto !important;
        max-height: none !important;
        overflow: visible !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        box-shadow: none !important;
        border-radius: 0 !important;
    }
    .printable-vendor-quota,
    .vendor-quota-printable-document {
        display: block !important;
        position: static !important;
        width: 100% !important;
        height: auto !important;
        max-height: none !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        color: #0c1527 !important;
        font-family: Arial, Helvetica, sans-serif !important;
    }
    .print-page-break {
        page-break-after: always !important;
        break-after: page !important;
    }
    tr, td, th {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
    }
}
`;

const numberToWords = (num: number): string => {
    if (!num || num === 0) return 'Zero Rupees Only';
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const convert = (n: number): string => {
        if (n < 20) return ones[n];
        if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
        return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convert(n % 100) : '');
    };
    const rounded = Math.round(num);
    if (rounded < 1000) return convert(rounded) + ' Rupees Only';
    const crores = Math.floor(rounded / 10000000);
    const lakhs = Math.floor((rounded % 10000000) / 100000);
    const thousands = Math.floor((rounded % 100000) / 1000);
    const remainder = rounded % 1000;
    let result = '';
    if (crores) result += convert(crores) + ' Crore ';
    if (lakhs) result += convert(lakhs) + ' Lakh ';
    if (thousands) result += convert(thousands) + ' Thousand ';
    if (remainder) result += convert(remainder);
    return result.trim() + ' Rupees Only';
};

export const VendorQuotaPage: React.FC = () => {
    const { user } = useAuth();
    const userRole = String(user?.role || '').toLowerCase();
    const isAdmin = ['admin', 'administrator', 'superadmin', 'management', 'owner'].includes(userRole) || userRole.includes('admin');
    const [vendors, setVendors] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedProjectMap, setSelectedProjectMap] = useState<Record<string, string>>({});

    // Table Selection, Expand & Row Menu State
    const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({});
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
    const [activeRowMenu, setActiveRowMenu] = useState<string | null>(null);

    // Statement Period Filter State
    const [statementPeriod, setStatementPeriod] = useState<string>('all_time');
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [customStartDate, setCustomStartDate] = useState<string>('');
    const [customEndDate, setCustomEndDate] = useState<string>('');
    const [projectTypeFilter, setProjectTypeFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Modal & PDF state
    const [previewModalOpen, setPreviewModalOpen] = useState(false);
    const [selectedVendorForPdf, setSelectedVendorForPdf] = useState<any | null>(null);
    const [selectedProjectForPdf, setSelectedProjectForPdf] = useState<any | null>(null);
    const [pdfItems, setPdfItems] = useState<any[]>([]);
    const [pdfModules, setPdfModules] = useState<any[]>([]);
    const [loadingPdfItems, setLoadingPdfItems] = useState(false);
    const [generatingPdf, setGeneratingPdf] = useState(false);
    const [agreementPdfBase64, setAgreementPdfBase64] = useState<string | null>(null);
    const [columnVisibility, setColumnVisibility] = useState<{ [key: string]: boolean }>({
        particulars: true,
        shutter: true,
        carcass: true,
        dimensions: true,
        rate: true,
        qty: true,
        discount: true,
        gst: true,
        total: true,
        general_terms: true,
        service_agreement: true,
    });

    const [generalTermsList, setGeneralTermsList] = useState<Array<{ title: string; content: string }>>([
        { title: '1. Quotation Validity', content: 'This vendor quota & rate list shall remain valid for 60 days from the date of submission.' },
        { title: '2. Payment Terms & Milestones', content: 'Mobilization advance: 30%, Material delivery at site: 50%, Final installation & signoff: 20%.' },
        { title: '3. Delivery & Work Timelines', content: 'All items must be delivered and installed within agreed project schedule. Penalties apply for unexcused delays.' },
        { title: '4. Warranty & Defect Liability', content: 'Vendor provides a minimum 12-month defect liability warranty covering materials and workmanship.' }
    ]);

    const [isEditingClauses, setIsEditingClauses] = useState(false);
    const [activeTermsTab, setActiveTermsTab] = useState<'general' | 'service'>('general');
    const [clausesList, setClausesList] = useState<Array<{ title: string; content: string }>>([
        {
            title: '1. Parties',
            content: 'This Master Interior Vendor Service Agreement ("Agreement") is made on {DAY} day of {MONTH}, 20{YEAR} ("Effective Date"),\n\nBY AND BETWEEN\n\nLivinCart and Services Private Limited, a company incorporated under the Companies Act, 2013, having its registered office at Visakhapatnam, Andhra Pradesh (hereinafter referred to as the "Company", which expression shall include its successors and permitted assigns);\n\nAND\n\nM/s. {VENDOR}, having its principal place of business at Visakhapatnam, Andhra Pradesh (hereinafter referred to as the "Vendor", which expression shall include its successors and permitted assigns).\n\nThe Company and the Vendor are hereinafter collectively referred to as the "Parties" and individually as a "Party".\n\nWHEREAS, the Company desires to engage the Vendor for interior carpentry, furniture manufacturing, installation, and related services on a non-exclusive, project-specific basis under Work Orders issued by the Company.'
        },
        {
            title: '2. Scope of Services',
            content: 'The Vendor shall provide skilled labour, supervision, tools, equipment, and all other resources necessary for the execution of interior carpentry and furniture-related services assigned by the Company from time to time under separate Work Orders.\n\nThe Services may include, but shall not be limited to, the manufacture, fabrication, assembly, transportation, installation, dismantling, repair, modification, maintenance, and commissioning of modular kitchens, wardrobes, TV units, beds, sofas, dining tables, office furniture, storage units, wall panelling, wooden partitions, false ceiling wooden works, cabinets, shelving units, wooden doors, windows, and all other residential, commercial, and institutional interior carpentry and furniture works.\n\nThe Vendor shall execute all Services strictly in accordance with the approved drawings, designs, specifications, Bill of Quantities (BOQ), quality standards, timelines, and written instructions issued by the Company. The Vendor shall not undertake any additional or variation work without the Company\'s prior written approval.\n\nThe Company reserves the right to modify, increase, reduce, or omit any part of the scope of work by issuing written instructions or revised Work Orders, and the Vendor shall comply with such instructions in accordance with the terms of this Agreement.'
        },
        {
            title: '3. Vendor Responsibilities',
            content: 'The Vendor shall provide competent and adequately trained manpower, qualified supervisors, tools, machinery, equipment, and appropriate Personal Protective Equipment (PPE) necessary for the proper and timely execution of the Services. The Vendor shall ensure that all personnel deployed at the Project Site are skilled, experienced, and capable of performing the assigned work in accordance with the approved drawings, specifications, quality standards, and the Company\'s instructions.\n\nThe Vendor shall maintain discipline, professionalism, and proper conduct at the Project Site and shall ensure that its employees comply with all applicable labour laws, safety regulations, and statutory requirements. The Vendor shall maintain cleanliness at the Project Site, prevent any nuisance or inconvenience to the Customer or occupants, and take all reasonable precautions to safeguard the Project Site, Company property, Customer property, materials, tools, and equipment from loss, theft, damage, or misuse.\n\nThe Vendor shall immediately notify the Company of any accident, injury, unsafe condition, delay, material shortage, quality issue, or any event that may adversely affect the execution or completion of the Services. The Vendor shall be solely responsible for the acts, omissions, negligence, and conduct of its employees, agents, and representatives and shall remain liable for any loss, damage, claim, or liability arising therefrom.\n\nThe Vendor shall comply with the provisions of the Indian Contract Act, 1872, applicable labour and safety laws, and all other statutory requirements in force from time to time. Failure to comply with this Clause shall constitute a material breach of this Agreement and shall entitle the Company to suspend the work, withhold payments, recover losses or damages, or terminate this Agreement in accordance with its terms.'
        },
        {
            title: '4. Materials and Storage',
            content: 'All materials, fittings, hardware, tools, equipment, and consumables supplied by the Company shall remain the exclusive property of the Company and shall be used solely for the execution of the Services under the applicable Work Order. The Vendor shall verify the quantity and condition of all materials at the time of receipt and immediately report any shortage, damage, or discrepancy to the Company in writing.\n\nThe Vendor shall be responsible for the safe custody, proper handling, storage, and protection of all Company-supplied materials and shall take all reasonable precautions to prevent theft, loss, damage, deterioration, misuse, or avoidable wastage. The Vendor shall not remove, transfer, sell, pledge, or use such materials for any purpose other than the Project without the prior written approval of the Company.\n\nUpon completion or termination of the Services, the Vendor shall return all unused or surplus materials, tools, equipment, and other Company property in good condition, subject to normal wear and tear. The Company shall be entitled to recover the cost of any material lost, damaged, misused, or wasted due to the negligence or default of the Vendor by deduction from payments due to the Vendor or by any other remedy available under the Indian Contract Act, 1872, and other applicable laws.'
        },
        {
            title: '5. Quality Standards',
            content: 'The Vendor shall ensure that all Services are executed in a professional and workmanlike manner and strictly in accordance with the approved drawings, specifications, Bill of Quantities (BOQ), approved samples, manufacturer\'s recommendations, and accepted industry standards. All materials, fittings, hardware, and workmanship shall be of the agreed quality and free from defects, unless otherwise approved in writing by the Company.\n\nThe Company or its authorized representatives shall have the right to inspect, test, and monitor the quality and progress of the work at any stage of execution. The Vendor shall provide all reasonable assistance required for such inspection and shall promptly comply with any instructions issued by the Company relating to quality, workmanship, or rectification.\n\nAny work found to be defective, incomplete, non-compliant, or not in accordance with the approved drawings, specifications, or quality standards shall be repaired, replaced, or re-executed by the Vendor at its own cost and risk, without any extension of time or additional payment. If the Vendor fails to rectify such defects within the time specified by the Company, the Company may carry out or engage a third party to carry out the rectification work, and all costs and expenses incurred shall be recoverable from the Vendor.\n\nAcceptance of the work or release of any payment by the Company shall not relieve the Vendor of its responsibility for maintaining the required quality standards or its obligations under the warranty and defect liability provisions of this Agreement. Any breach of this Clause shall constitute a material breach of the Agreement and entitle the Company to exercise its rights under this Agreement and applicable laws.'
        },
        {
            title: '6. TIME SCHEDULE AND DELAYS',
            content: '6.1 Project Schedule: The Vendor shall commence the Services immediately upon receipt of the Work Order or such other date as may be specified by the Company and shall complete the assigned work strictly within the commencement, milestone, and completion dates stipulated in the applicable Work Order. Time shall be of the essence in the performance of the Vendor\'s obligations under this Agreement.\n\n6.2 Mobilization: The Vendor shall promptly mobilize adequate skilled labour, supervisors, tools, machinery, equipment, transportation, and other necessary resources to ensure timely commencement and uninterrupted execution of the Project. Any delay in mobilization without prior written approval of the Company shall constitute a material breach of this Agreement.\n\n6.3 Adherence to Project Schedule: The Vendor shall execute the Services in accordance with the project schedule, construction sequence, and milestone plan communicated by the Company. The Vendor shall coordinate with other contractors, consultants, suppliers, and Company representatives to avoid delays or disruption to the Project.\n\n6.4 Progress of Work: The Vendor shall ensure continuous progress of the work and shall maintain sufficient manpower and resources at the Project Site to meet the agreed completion schedule. Upon request, the Vendor shall submit periodic progress reports, manpower deployment details, and updated completion schedules to the Company.\n\n6.5 Delay Attributable to the Vendor: Where any delay in the execution or completion of the Project is caused by the Vendor, including but not limited to shortage of manpower, inadequate supervision, poor planning, defective workmanship, non-availability of tools or equipment, failure to procure materials (where Vendor supplied), absenteeism, negligence, or any act or omission of the Vendor, the Vendor shall be solely responsible for such delay and all resulting consequences.\n\n6.6 Notice of Delay: If the Vendor anticipates any circumstance that is likely to delay the progress or completion of the Services, the Vendor shall immediately notify the Company in writing, stating the reasons for such delay, the expected duration, and the proposed corrective measures. Such notification shall not relieve the Vendor of its contractual obligations unless the Company grants a written extension of time.\n\n6.7 Extension of Time: The Company may, at its sole discretion, grant a reasonable extension of the completion period only where the delay is directly attributable to:\n• Changes in the scope of work instructed by the Company;\n• Delay in handing over the Project Site by the Company;\n• Delay in supply of Company-provided materials;\n• Force Majeure Events as defined under this Agreement; or\n• Any other reason expressly approved by the Company in writing.\nNo extension shall be deemed granted unless communicated in writing by the Company.\n\n6.8 Liquidated Damages: Without prejudice to any other rights or remedies available under this Agreement or applicable law, if the Vendor fails to complete the Services within the agreed Completion Date, the Company shall be entitled to recover Liquidated Damages at the rate specified in the applicable Work Order, subject to a maximum aggregate amount of 10% of the total Work Order value, unless otherwise agreed in writing. The Parties acknowledge that such Liquidated Damages represent a genuine pre-estimate of the losses likely to be suffered by the Company due to delayed completion and shall not be construed as a penalty.\n\n6.9 Withholding of Payments: The Company shall have the right to withhold, adjust, deduct, or set off any payment due to the Vendor against any losses, damages, penalties, costs, expenses, or Liquidated Damages arising from delays attributable to the Vendor until the Project is satisfactorily completed.\n\n6.10 Recovery of Additional Losses: Where the actual losses suffered by the Company exceed the amount recoverable as Liquidated Damages, including but not limited to customer compensation, rework costs, third-party contractor charges, project management expenses, or reputational damage resulting from the Vendor\'s delay, the Company reserves the right to recover such additional losses from the Vendor in accordance with applicable law.\n\n6.11 Right to Engage Alternate Vendor: If the Vendor fails to maintain satisfactory progress or is unlikely to complete the Project within the agreed schedule, the Company may, after giving reasonable notice, engage another contractor or vendor to complete the whole or part of the remaining work. Any additional cost incurred by the Company shall be recoverable from the Vendor without prejudice to the Company\'s other contractual rights.\n\n6.12 Repeated Delays: Repeated or habitual delays by the Vendor in executing assigned Projects shall constitute a material breach of this Agreement and shall entitle the Company to suspend further Work Orders, remove the Vendor from its approved vendor panel, terminate this Agreement, and recover all consequential losses arising therefrom.\n\n6.13 No Waiver: Any extension of time or temporary waiver granted by the Company in relation to any delay shall not operate as a waiver of the Company\'s rights in respect of any subsequent delay or breach by the Vendor. This Clause shall be governed by the provisions of the Indian Contract Act, 1872, and all rights and remedies available to the Company under this Agreement shall be in addition to, and not in substitution of, any rights available under applicable laws in force in India.'
        },
        {
            title: '7. Measurements, Billing and Payments',
            content: 'The measurements of the completed work shall be jointly verified and recorded by the authorized representatives of the Company and the Vendor in accordance with the approved drawings, specifications, Bill of Quantities (BOQ), and the applicable Work Order. The Company\'s measurement records shall be final and binding for the purpose of billing unless any discrepancy is reported by the Vendor within three (3) Business Days from the date of measurement.\n\nThe Vendor shall submit its invoice only upon completion of the applicable milestone or the entire scope of work, as specified in the Work Order. Every invoice shall be accompanied by duly signed measurement sheets, site photographs, completion reports (where applicable), delivery challans, and a valid tax invoice complying with the provisions of the Central Goods and Services Tax Act, 2017, the Integrated Goods and Services Tax Act, 2017, and other applicable tax laws.\n\nThe Company shall verify the submitted documents, inspect the completed work, and confirm compliance with the approved quality standards, specifications, and contractual requirements before processing any payment. The Company shall be entitled to reject or withhold any invoice that is incomplete, inaccurate, unsupported by the required documents, or relates to defective or incomplete work until such deficiencies are rectified by the Vendor.\n\nPayments shall be made only after satisfactory completion and acceptance of the work by the Company and shall be subject to deduction of applicable taxes, including Tax Deducted at Source (TDS) under the Income-tax Act, 1961, GST adjustments, statutory recoveries, retention amounts (if applicable), penalties, liquidated damages, or any other amounts recoverable from the Vendor under this Agreement or the applicable Work Order.\n\nNo payment made by the Company shall be deemed to constitute acceptance of defective or incomplete work or operate as a waiver of the Company\'s right to require rectification, replacement, recovery of damages, or enforcement of any other rights available under this Agreement or applicable law. Any dispute relating to measurements, billing, or payment shall be resolved in accordance with the dispute resolution provisions contained in this Agreement.'
        },
        {
            title: '8. Confidentiality and Customer Protection',
            content: 'The Vendor acknowledges that, in the course of performing the Services, it may have access to the Company\'s confidential and proprietary information, including but not limited to drawings, designs, quotations, pricing, customer details, business processes, technical information, project documents, and other Confidential Information. The Vendor shall keep such information strictly confidential and shall not disclose, copy, use, or share it with any third party except as required for the performance of this Agreement or with the Company\'s prior written consent.\n\nThe Vendor shall use the Confidential Information solely for the purpose of executing the Services under this Agreement and shall take all reasonable steps to protect it from unauthorized access, disclosure, or misuse. Upon completion or termination of the Services, the Vendor shall immediately return or permanently delete all Confidential Information and Company property, if so directed by the Company.\n\nThe Vendor shall not, directly or indirectly, contact, solicit, negotiate with, or undertake any work for any Customer introduced by the Company, either during the term of this Agreement or for a period of twenty-four (24) months after its termination or expiry, without the Company\'s prior written consent.\n\nAny breach of this Clause shall constitute a material breach of this Agreement, entitling the Company to terminate this Agreement immediately, withhold pending payments, recover all losses and damages, and seek appropriate legal remedies, including injunctive relief, in accordance with the Indian Contract Act, 1872, the Specific Relief Act, 1963, and other applicable laws.'
        },
        {
            title: '9. Health, Safety and Compliance',
            content: 'The Vendor shall comply with all applicable labour, health, safety, environmental, and statutory laws, rules, regulations, and government notifications in force in India, including obtaining and maintaining all necessary licenses, registrations, permits, and approvals required for the execution of the Services.\n\nThe Vendor shall deploy only competent and adequately trained personnel and shall ensure that all workers strictly comply with the Company\'s site safety rules and standard operating procedures. The Vendor shall provide and ensure the proper use of appropriate Personal Protective Equipment (PPE), including safety helmets, safety shoes, gloves, goggles, harnesses, and other protective gear, as may be required for the nature of the work.\n\nThe Vendor shall be solely responsible for the health, safety, conduct, and welfare of its employees and shall immediately report any accident, injury, or unsafe condition at the Project Site to the Company. The Vendor shall indemnify and keep the Company harmless against any claims, liabilities, penalties, or losses arising from the Vendor\'s failure to comply with this Clause or applicable laws.'
        },
        {
            title: '10. Indemnity',
            content: 'The Vendor shall indemnify, defend, and keep the Company, its directors, employees, representatives, and Customers fully indemnified and harmless against any and all losses, claims, damages, liabilities, penalties, fines, costs, expenses, injuries, statutory dues, legal proceedings, and reasonable legal expenses arising out of or in connection with the Vendor\'s negligence, poor workmanship, defective work, delay, breach of this Agreement, violation of applicable laws, labour disputes, misconduct of its personnel, damage to property, or injury or death of any person caused by the acts or omissions of the Vendor.\n\nThe Company shall have the right to recover such losses, damages, costs, or expenses from any amount payable to the Vendor or by any other legal remedy available under the Indian Contract Act, 1872, and other applicable laws. The obligations of the Vendor under this Clause shall survive the completion, termination, or expiry of this Agreement.'
        },
        {
            title: '11. Termination',
            content: 'The Company may terminate this Agreement, in whole or in part, with immediate effect by written notice to the Vendor, without any liability, if the Vendor commits fraud, misconduct, repeated quality failures, unreasonable delays, unsafe work practices, material breach of this Agreement, confidentiality breaches, customer complaints of a serious nature, insolvency, abandonment of work, or violation of any applicable law, rule, regulation, or statutory requirement.\n\nEither Party may terminate this Agreement without assigning any reason by giving thirty (30) days\' prior written notice, provided that such termination shall not affect the completion of ongoing Work Orders unless otherwise directed by the Company.\n\nUpon termination, the Vendor shall immediately stop using the Company\'s confidential information, return all Company property, drawings, documents, materials, tools (if any), and cooperate in the orderly handover of the incomplete or completed work. The Company shall be entitled to engage another vendor to complete the remaining work at the risk and cost of the Vendor, where termination is due to the Vendor\'s default.\n\nTermination of this Agreement shall be without prejudice to any accrued rights, pending payments, recoveries, indemnities, warranties, or other obligations that have arisen prior to the date of termination. The Company shall also be entitled to recover all losses, damages, costs, and expenses arising from the Vendor\'s default in accordance with the Indian Contract Act, 1872, the Specific Relief Act, 1963, and other applicable laws in force in India. The provisions relating to confidentiality, warranty, indemnity, dispute resolution, and other clauses intended to survive termination shall continue to remain valid and enforceable notwithstanding the termination or expiry of this Agreement.'
        },
        {
            title: '12. Dispute Resolution',
            content: 'The Parties shall use their best efforts to resolve amicably, through mutual discussions and good faith negotiations, any dispute, difference, claim, or controversy arising out of or in connection with this Agreement, including its interpretation, performance, breach, termination, or validity. If the dispute is not resolved within thirty (30) days from the date of written notice of such dispute, either Party may refer the matter to arbitration.\n\nThe dispute shall be finally resolved by a sole arbitrator mutually appointed by the Parties. In the event the Parties fail to mutually agree on the appointment of the arbitrator, the appointment shall be made in accordance with the provisions of the Arbitration and Conciliation Act, 1996, including any statutory amendments or re-enactments thereof. The seat and venue of arbitration shall be Visakhapatnam, Andhra Pradesh, and the arbitration proceedings shall be conducted in the English language.\n\nThe arbitral award shall be final and binding upon both Parties. During the pendency of any dispute, the Vendor shall continue to perform its obligations under this Agreement to the extent reasonably practicable, unless otherwise directed by the Company. Nothing contained in this Clause shall prevent either Party from seeking interim or equitable relief from a court of competent jurisdiction in accordance with applicable law.'
        },
        {
            title: '13. Governing Law and Jurisdiction',
            content: 'This Agreement shall be governed by, construed, and interpreted in accordance with the laws of the Republic of India, including the provisions of the Indian Contract Act, 1872, the Arbitration and Conciliation Act, 1996, and all other applicable laws, rules, and regulations in force from time to time.\n\nSubject to the provisions relating to arbitration contained in this Agreement, the courts at Visakhapatnam, Andhra Pradesh, shall have exclusive jurisdiction over all matters arising out of or in connection with this Agreement, including proceedings for interim, conservatory, or injunctive relief, enforcement of arbitral awards, or any other matter for which the jurisdiction of a competent court is required under applicable law.'
        },
        {
            title: '16. Miscellaneous',
            content: 'This Agreement constitutes the entire understanding between the Parties and supersedes all prior discussions, negotiations, and agreements relating to its subject matter. No amendment, modification, or variation of this Agreement shall be valid unless made in writing and signed by the authorized representatives of both Parties.\n\nNo failure or delay by either Party in exercising any right under this Agreement shall constitute a waiver of such right. If any provision of this Agreement is held to be invalid or unenforceable by a court or arbitral tribunal of competent jurisdiction, the remaining provisions shall continue in full force and effect.\n\nThis Agreement shall be binding upon and shall enure to the benefit of the Parties, their respective successors, legal representatives, and permitted assigns, in accordance with applicable law.'
        }
    ]);

    // Main Vendor Creation Modal State
    const [isCreateMainVendorModalOpen, setIsCreateMainVendorModalOpen] = useState(false);
    const [creatingMainVendor, setCreatingMainVendor] = useState(false);
    const [mainVendorPhotoPreview, setMainVendorPhotoPreview] = useState<string | null>(null);
    const [mainVendorForm, setMainVendorForm] = useState({
        vendor_name: '',
        category: 'Main Vendor',
        contact_person: '',
        phone: '',
        email: '',
        address: '',
        gst_number: '',
        pan_number: '',
        pan_file: null as string | null,
        aadhar_number: '',
        aadhar_file: null as string | null
    });

    // Duplicate Vendor / Quota Modal State
    const [showDuplicateVendorModal, setShowDuplicateVendorModal] = useState<boolean>(false);
    const [duplicateSourceVendor, setDuplicateSourceVendor] = useState<any | null>(null);
    const [duplicateSourceProjId, setDuplicateSourceProjId] = useState<string>('');
    const [isDuplicatingVendor, setIsDuplicatingVendor] = useState<boolean>(false);
    const [duplicateForm, setDuplicateForm] = useState<{
        mode: 'diff_project' | 'new_vendor_copy' | 'existing_vendor';
        targetVendorName: string;
        targetProjectId: string;
        targetVersion: string;
        copyItems: boolean;
        openInBuilder: boolean;
    }>({
        mode: 'diff_project',
        targetVendorName: '',
        targetProjectId: '',
        targetVersion: 'V1.0',
        copyItems: true,
        openInBuilder: true
    });

    // Create Vendor Quota Builder Modal State
    const [allProjectsList, setAllProjectsList] = useState<any[]>([]);
    const [isCreateQuotaModalOpen, setIsCreateQuotaModalOpen] = useState(false);
    const [builderVendor, setBuilderVendor] = useState('');
    const [builderProjectId, setBuilderProjectId] = useState('');
    const [builderItems, setBuilderItems] = useState<any[]>([]);
    const [builderModules, setBuilderModules] = useState<Array<{ id: string; name: string; items: any[] }>>([
        { id: 'mod-1', name: 'Modular Scope & Cabinetry', items: [] }
    ]);
    const [quotaVersion, setQuotaVersion] = useState('V1.0');
    const [quotaApprovalStatus, setQuotaApprovalStatus] = useState('Pending Approval');
    const [isQuotaLocked, setIsQuotaLocked] = useState(false);
    const [openThreeDotMenuId, setOpenThreeDotMenuId] = useState<string | null>(null);
    const [collapsedModules, setCollapsedModules] = useState<{ [key: number]: boolean }>({});

    // Quotation Creation UI Toolbar & Financial Adjustments State
    const [coverPageEnabled, setCoverPageEnabled] = useState(false);
    const [hideCategoriesInPrint, setHideCategoriesInPrint] = useState(false);
    const [versionsList, setVersionsList] = useState<string[]>(['V1.0', 'V1.1', 'V2.0']);
    const [isModulesSummaryExpanded, setIsModulesSummaryExpanded] = useState(true);
    
    // Financial Adjustments
    const [categoryDiscountAmount, setCategoryDiscountAmount] = useState<number>(0);
    const [categoryDiscountType, setCategoryDiscountType] = useState<'flat' | 'percent'>('flat');
    const [appliedCouponCode, setAppliedCouponCode] = useState<string>('');
    const [promoDiscountAmount, setPromoDiscountAmount] = useState<number>(0);
    const [additionalCharges, setAdditionalCharges] = useState<number>(0);
    const [additionalChargesGst, setAdditionalChargesGst] = useState<boolean>(false);
    const [additionalChargesGstRate, setAdditionalChargesGstRate] = useState<number>(0);
    const [overallGstEnabled, setOverallGstEnabled] = useState<boolean>(true);
    const [overallGstLineHidden, setOverallGstLineHidden] = useState<boolean>(false);
    const [overallGstRate, setOverallGstRate] = useState<number>(18);
    const [roundOffEnabled, setRoundOffEnabled] = useState<boolean>(true);

    const [showTermsModal, setShowTermsModal] = useState(false);
    const [showVersionsModal, setShowVersionsModal] = useState(false);
    const [versionHistoryList, setVersionHistoryList] = useState<Array<{
        version: string;
        createdAt: string;
        totalAmount: number;
        approvalStatus: string;
        modules: any[];
    }>>([
        { version: 'V1.0', createdAt: new Date().toLocaleDateString('en-IN'), totalAmount: 0, approvalStatus: 'Pending Approval', modules: [] }
    ]);
    const [showPromoModal, setShowPromoModal] = useState(false);
    const [promoInputCode, setPromoInputCode] = useState('');

    const [loadingQuotaDetails, setLoadingQuotaDetails] = useState(false);
    const [savingQuota, setSavingQuota] = useState(false);
    const [sendingApproval, setSendingApproval] = useState(false);

    // Financial Calculation Functions (Matching Quotation Creation UI)
    const getModulesGrossTotal = () => {
        return builderModules.flatMap(m => m.items).reduce((s, it) => s + (it.total || 0), 0);
    };

    const getCategoryDiscountVal = () => {
        const gross = getModulesGrossTotal();
        if (categoryDiscountType === 'percent') {
            return Math.round(gross * (categoryDiscountAmount / 100));
        }
        return categoryDiscountAmount;
    };

    const getAddChargesVal = () => {
        let amt = additionalCharges;
        if (additionalChargesGst) {
            amt += amt * (additionalChargesGstRate / 100);
        }
        return Math.round(amt);
    };

    const getOverallGstVal = () => {
        if (!overallGstEnabled) return 0;
        const gross = getModulesGrossTotal();
        const catDisc = getCategoryDiscountVal();
        const afterDisc = Math.max(0, gross - catDisc - promoDiscountAmount);
        return Math.round(afterDisc * (overallGstRate / 100));
    };

    const getNetPayableFinalTotal = () => {
        const gross = getModulesGrossTotal();
        const catDisc = getCategoryDiscountVal();
        const afterDisc = Math.max(0, gross - catDisc - promoDiscountAmount);
        const addCharges = getAddChargesVal();
        const gst = getOverallGstVal();
        const exact = afterDisc + addCharges + gst;
        return roundOffEnabled ? Math.round(exact) : parseFloat(exact.toFixed(2));
    };

    const getRoundOffAdjustmentVal = () => {
        const gross = getModulesGrossTotal();
        const catDisc = getCategoryDiscountVal();
        const afterDisc = Math.max(0, gross - catDisc - promoDiscountAmount);
        const addCharges = getAddChargesVal();
        const gst = getOverallGstVal();
        const exact = afterDisc + addCharges + gst;
        const rounded = Math.round(exact);
        return rounded - exact;
    };

    const computeSqft = (widthStr?: any, heightStr?: any, depthStr?: any) => {
        let w = parseFloat(String(widthStr || '0').replace(/[^0-9.]/g, '')) || 0;
        let h = parseFloat(String(heightStr || '0').replace(/[^0-9.]/g, '')) || 0;
        let d = parseFloat(String(depthStr || '0').replace(/[^0-9.]/g, '')) || 0;

        if ((w === 0 || h === 0) && typeof widthStr === 'string') {
            const matchW = widthStr.match(/W\s*:\s*([0-9.]+)/i);
            const matchH = widthStr.match(/H\s*:\s*([0-9.]+)/i);
            const matchD = widthStr.match(/D\s*:\s*([0-9.]+)/i);
            if (matchW) w = parseFloat(matchW[1]) || 0;
            if (matchH) h = parseFloat(matchH[1]) || 0;
            if (matchD) d = parseFloat(matchD[1]) || 0;
        }

        if (w > 0 && h > 0) {
            let res = 0;
            if (d > 0) {
                res = (w * h * d) / 27000000;
            } else {
                res = (w * h) / 90000;
            }
            return Math.round(res * 100) / 100;
        }
        return 0;
    };

    const openPrintPreviewFromBuilder = () => {
        const vendorObj = vendors.find((v: any) => v.vendor_name === builderVendor) || { vendor_name: builderVendor || 'Main Vendor Entity' };
        const projObj = allProjectsList.find((p: any) => String(p.project_id) === String(builderProjectId)) || { project_id: builderProjectId, project_name: builderProjectId || 'Project Site' };
        
        setSelectedVendorForPdf(vendorObj);
        setSelectedProjectForPdf(projObj);
        setPdfModules(JSON.parse(JSON.stringify(builderModules)));
        
        const flatItems = builderModules.flatMap(m => 
            (m.items || []).map(it => {
                const w = it.dim_w || (it.width || '');
                const h = it.dim_h || (it.height || '');
                const d = it.dim_d || (it.depth || '');
                const sqftVal = computeSqft(w, h, d);
                return {
                    particulars: it.particulars || 'Item',
                    description: it.description || '',
                    is_subtitle: !!it.is_subtitle,
                    brand: it.shutter || '—',
                    unit: it.carcass || '—',
                    width: w,
                    height: h,
                    depth: d,
                    sft: sqftVal > 0 ? sqftVal.toFixed(2) : (it.sft || ''),
                    sqft: sqftVal > 0 ? sqftVal.toFixed(2) : (it.sqft || ''),
                    dimensions: it.dimensions || (sqftVal > 0 ? `W:${w} H:${h} D:${d}` : ''),
                    pricing_mode: it.pricing_mode || (it.dim_type === 'lumpsum' ? 'lumpsum' : 'whd'),
                    rate: parseFloat(it.rate || 0),
                    quantity: parseFloat(it.qty || it.quantity || 1),
                    discount: parseFloat(it.discount || 0),
                    amount: parseFloat(it.total || 0),
                    gst: 18
                };
            })
        );
        setPdfItems(flatItems);
        setPreviewModalOpen(true);
    };

    const loadQuotaScopeForProject = async (vendorName: string, projId: string) => {
        if (!projId) return;
        setLoadingQuotaDetails(true);
        try {
            const reqUrl = API_BASE_URL + '/vendor-quotas/project-items?vendor=' + encodeURIComponent(vendorName) + '&project_id=' + projId;
            const res = await axios.get(reqUrl);
            if (res.data && res.data.success) {
                if (res.data.saved_quotation) {
                    const sq = res.data.saved_quotation;
                    setQuotaVersion(sq.version || 'V1.0');
                    setQuotaApprovalStatus(sq.approval_status || 'Pending Approval');
                    setIsQuotaLocked(!!sq.is_locked);

                    if (sq.modules_data) {
                        try {
                            const parsedMods = typeof sq.modules_data === 'string' ? JSON.parse(sq.modules_data) : sq.modules_data;
                            if (Array.isArray(parsedMods) && parsedMods.length > 0) {
                                setBuilderModules(parsedMods);
                                setLoadingQuotaDetails(false);
                                return;
                            }
                        } catch (e) {}
                    }
                    if (sq.items_data && sq.items_data.length > 0) {
                        setBuilderModules([{ id: 'mod-1', name: 'Modular Scope & Cabinetry', items: sq.items_data }]);
                        setBuilderItems(sq.items_data);
                        setLoadingQuotaDetails(false);
                        return;
                    }
                }

                // If no saved quotation, parse Client Quote
                setIsQuotaLocked(false);
                setQuotaApprovalStatus('Pending Approval');
                if (res.data.client_quote && res.data.client_quote.items && res.data.client_quote.items.length > 0) {
                    const rawItems = res.data.client_quote.items;
                    const groupedMap: Record<string, any[]> = {};

                    rawItems.forEach((it: any) => {
                        const catName = it.category || it.section_name || 'Modular Scope & Cabinetry';
                        if (!groupedMap[catName]) {
                            groupedMap[catName] = [];
                        }

                        const rate = parseFloat(it.rate || it.amount || 0);
                        const qty = parseInt(it.quantity || it.qty || 1);
                        const discount = parseFloat(it.discount || it.discount_percent || 0);
                        const calcTotal = Math.round((rate * qty) * (1 - discount / 100));

                        let w = it.dim_w || it.width || it.w || '';
                        let h = it.dim_h || it.height || it.h || '';
                        let d = it.dim_d || it.depth || it.d || it.sft || it.sqft || '';

                        if ((!w || !h) && it.dimensions && typeof it.dimensions === 'string') {
                            const matchW = it.dimensions.match(/W\s*:\s*([0-9.]+)/i);
                            const matchH = it.dimensions.match(/H\s*:\s*([0-9.]+)/i);
                            const matchD = it.dimensions.match(/D\s*:\s*([0-9.]+)/i);
                            if (matchW) w = matchW[1];
                            if (matchH) h = matchH[1];
                            if (matchD) d = matchD[1];
                        }

                        const dimType = it.dim_type || (it.pricing_mode === 'lumpsum' || (!w && !h && !d) ? 'lumpsum' : 'whd');

                        let dimStr = it.dimensions || '';
                        if (!dimStr) {
                            if (dimType === 'lumpsum') {
                                dimStr = 'Lumpsum';
                            } else if (w || h || d) {
                                dimStr = `W:${w} H:${h} D:${d}`.trim();
                            } else {
                                dimStr = it.unit || 'As per site';
                            }
                        }

                        const sqftVal = computeSqft(w, h, d);

                        groupedMap[catName].push({
                            particulars: it.particulars || it.item_name || it.name || 'Modular Scope Item',
                            description: it.description || '',
                            is_subtitle: !!it.is_subtitle,
                            shutter: it.shutter || it.brand || '18mm HDMR / Acrylic Finish',
                            carcass: it.carcass || '18mm BWP Marine Plywood',
                            dim_w: w,
                            dim_h: h,
                            dim_d: d,
                            dim_type: dimType,
                            pricing_mode: dimType === 'lumpsum' ? 'lumpsum' : 'whd',
                            dimensions: dimStr,
                            sft: sqftVal > 0 ? sqftVal.toFixed(2) : (it.sft || ''),
                            sqft: sqftVal > 0 ? sqftVal.toFixed(2) : (it.sqft || ''),
                            rate: rate,
                            qty: qty,
                            discount: discount,
                            gst: 18,
                            total: (it.total || calcTotal)
                        });
                    });

                    const formattedMods = Object.keys(groupedMap).map((catName, idx) => ({
                        id: 'mod-' + (idx + 1),
                        name: catName,
                        items: groupedMap[catName]
                    }));

                    setBuilderModules(formattedMods);
                } else if (res.data.inventory_items && res.data.inventory_items.length > 0) {
                    const loaded = res.data.inventory_items.map((it: any) => ({
                        particulars: it.item_name || 'Material Item',
                        shutter: it.category || 'General Shutter',
                        carcass: 'Standard Carcass',
                        dimensions: 'As per site',
                        rate: parseFloat(it.rate || 0),
                        qty: parseInt(it.quantity || 1),
                        discount: parseFloat(it.discount || 0),
                        gst: 18,
                        total: parseFloat(it.total || 0)
                    }));
                    setBuilderModules([{ id: 'mod-1', name: 'Material Scope Items', items: loaded }]);
                } else {
                    setBuilderModules([{
                        id: 'mod-1',
                        name: 'Modular Scope & Cabinetry',
                        items: [{
                            particulars: 'Kitchen / Modular Cabinet Unit',
                            shutter: '18mm Acrylic Shutter',
                            carcass: '18mm BWP Plywood',
                            dimensions: '8ft x 4ft',
                            rate: 1500,
                            qty: 1,
                            discount: 0,
                            gst: 18,
                            total: 1770
                        }]
                    }]);
                }
            }
        } catch (e) {
            console.error('Error loading quote items:', e);
        } finally {
            setLoadingQuotaDetails(false);
        }
    };

    const updateModuleItem = (modIndex: number, itemIndex: number, fieldOrUpdates: string | Record<string, any>, value?: any) => {
        if (isQuotaLocked) return;
        const updatedMods = [...builderModules];
        let targetItem = { ...updatedMods[modIndex].items[itemIndex] };

        if (typeof fieldOrUpdates === 'string') {
            targetItem[fieldOrUpdates] = value;
        } else if (typeof fieldOrUpdates === 'object' && fieldOrUpdates !== null) {
            targetItem = { ...targetItem, ...fieldOrUpdates };
        }

        const w = targetItem.dim_w || '';
        const h = targetItem.dim_h || '';
        const d = targetItem.dim_d || '';
        const dimType = targetItem.dim_type || (targetItem.pricing_mode === 'lumpsum' ? 'lumpsum' : 'whd');

        if (dimType === 'lumpsum') {
            targetItem.dimensions = 'Lumpsum';
            targetItem.sft = '';
            targetItem.sqft = '';
        } else if (w || h || d) {
            targetItem.dimensions = `W:${w} H:${h} D:${d}`.trim();
            const sqftVal = computeSqft(w, h, d);
            if (sqftVal > 0) {
                targetItem.sft = sqftVal.toFixed(2);
                targetItem.sqft = sqftVal.toFixed(2);
            }
        }

        const rate = parseFloat(targetItem.rate || 0);
        const qty = parseInt(targetItem.qty || 0);
        const disc = parseFloat(targetItem.discount || 0);
        const gst = parseFloat(targetItem.gst || 18);

        const subtotal = rate * qty;
        const discAmt = subtotal * (disc / 100);
        const amountAfterDisc = subtotal - discAmt;
        const gstAmt = amountAfterDisc * (gst / 100);
        targetItem.total = Math.round(amountAfterDisc + gstAmt);

        updatedMods[modIndex].items[itemIndex] = targetItem;
        setBuilderModules(updatedMods);
    };

    const addModuleSection = () => {
        if (isQuotaLocked) return;
        const newMod = {
            id: 'mod-' + Date.now(),
            name: 'New Module Section ' + (builderModules.length + 1),
            items: [
                {
                    particulars: '',
                    shutter: '18mm Acrylic Finish',
                    carcass: '18mm BWP Plywood',
                    dimensions: 'Standard',
                    rate: 0,
                    qty: 1,
                    discount: 0,
                    gst: 18,
                    total: 0
                }
            ]
        };
        setBuilderModules([...builderModules, newMod]);
    };

    const addModuleItem = (modIndex: number) => {
        if (isQuotaLocked) return;
        const updatedMods = [...builderModules];
        updatedMods[modIndex].items.push({
            particulars: '',
            shutter: '18mm Acrylic Finish',
            carcass: '18mm BWP Plywood',
            dimensions: 'Standard',
            rate: 0,
            qty: 1,
            discount: 0,
            gst: 18,
            total: 0
        });
        setBuilderModules(updatedMods);
    };

    const addModuleSubtitleItem = (modIndex: number) => {
        if (isQuotaLocked) return;
        const updatedMods = [...builderModules];
        updatedMods[modIndex].items.push({
            particulars: '',
            is_subtitle: true,
            shutter: '',
            carcass: '',
            dimensions: '',
            rate: 0,
            qty: 0,
            discount: 0,
            gst: 0,
            total: 0
        });
        setBuilderModules(updatedMods);
    };

    const duplicateModuleItem = (modIndex: number, itemIndex: number) => {
        if (isQuotaLocked) return;
        const updatedMods = [...builderModules];
        const copyItem = { ...updatedMods[modIndex].items[itemIndex] };
        updatedMods[modIndex].items.splice(itemIndex + 1, 0, copyItem);
        setBuilderModules(updatedMods);
        setOpenThreeDotMenuId(null);
    };

    const moveModuleItem = (modIndex: number, itemIndex: number, direction: 'up' | 'down') => {
        if (isQuotaLocked) return;
        const updatedMods = [...builderModules];
        const items = updatedMods[modIndex].items;
        const targetIndex = direction === 'up' ? itemIndex - 1 : itemIndex + 1;

        if (targetIndex >= 0 && targetIndex < items.length) {
            const temp = items[itemIndex];
            items[itemIndex] = items[targetIndex];
            items[targetIndex] = temp;
            setBuilderModules(updatedMods);
        }
        setOpenThreeDotMenuId(null);
    };

    const [columnHeadings, setColumnHeadings] = useState<Record<string, string>>({
        particulars: 'Description',
        shutter: 'Shutter Spec',
        carcass: 'Carcass Spec',
        dimensions: 'Dimensions',
        rate: 'Rate (₹)',
        qty: 'Qty',
        discount: 'Disc %',
        total: 'Total (₹)'
    });
    const [openModuleMenuIdx, setOpenModuleMenuIdx] = useState<number | null>(null);

    const duplicateModuleSection = (modIndex: number) => {
        if (isQuotaLocked) return;
        const copyMod = JSON.parse(JSON.stringify(builderModules[modIndex]));
        copyMod.id = 'mod-' + Date.now();
        copyMod.name = copyMod.name + ' (Copy)';
        const updated = [...builderModules];
        updated.splice(modIndex + 1, 0, copyMod);
        setBuilderModules(updated);
        setOpenModuleMenuIdx(null);
    };

    const moveModuleSection = (modIndex: number, direction: 'up' | 'down') => {
        if (isQuotaLocked) return;
        const targetIndex = direction === 'up' ? modIndex - 1 : modIndex + 1;
        if (targetIndex >= 0 && targetIndex < builderModules.length) {
            const updated = [...builderModules];
            const temp = updated[modIndex];
            updated[modIndex] = updated[targetIndex];
            updated[targetIndex] = temp;
            setBuilderModules(updated);
        }
        setOpenModuleMenuIdx(null);
    };

    const removeModuleSection = (modIndex: number) => {
        if (isQuotaLocked) return;
        if (builderModules.length <= 1) {
            alert('At least one module section must remain');
            return;
        }
        const updated = builderModules.filter((_, i) => i !== modIndex);
        setBuilderModules(updated);
        setOpenModuleMenuIdx(null);
    };

    const removeModuleItem = (modIndex: number, itemIndex: number) => {
        if (isQuotaLocked) return;
        const updatedMods = [...builderModules];
        updatedMods[modIndex].items = updatedMods[modIndex].items.filter((_, i) => i !== itemIndex);
        setBuilderModules(updatedMods);
        setOpenThreeDotMenuId(null);
    };

    const handleSaveVendorQuotaSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!builderVendor || !builderProjectId) {
            alert('Please select Vendor and Project Site');
            return;
        }

        const allItems = builderModules.flatMap(m => m.items);
        if (allItems.length === 0) {
            alert('Please add at least one material scope item');
            return;
        }

        setSavingQuota(true);
        try {
            const totalValuation = allItems.reduce((sum, item) => sum + (item.total || 0), 0);
            const payload = {
                vendor_name: builderVendor,
                project_id: builderProjectId,
                items_data: allItems,
                modules_data: builderModules,
                version: quotaVersion,
                approval_status: isAdmin ? quotaApprovalStatus : (quotaApprovalStatus === 'Approved' ? 'Approved' : 'Pending Approval'),
                is_locked: isQuotaLocked ? 1 : 0,
                column_visibility: columnVisibility,
                total_amount: totalValuation,
                user_role: user?.role || '',
                user_id: user?.user_id || ''
            };

            const res = await axios.post(API_BASE_URL + '/vendor-quotas/save', payload, {
                headers: {
                    'X-User-Id': user?.user_id || '',
                    'X-User-Role': user?.role || ''
                }
            });
            if (res.data && res.data.success) {
                alert('Vendor Quota saved successfully!');
                setIsCreateQuotaModalOpen(false);
                fetchVendors();
            } else {
                alert(res.data.error || 'Failed to save Vendor Quota');
            }
        } catch (err) {
            console.error('Error saving vendor quota:', err);
            alert('Error saving vendor quota');
        } finally {
            setSavingQuota(false);
        }
    };

    const handleSendForApproval = async (targetStatus: 'Approved' | 'Pending Approval') => {
        if (!builderVendor || !builderProjectId) {
            alert('Please select Vendor and Project Site');
            return;
        }

        if (targetStatus === 'Approved' && !isAdmin) {
            alert('Access Denied: Only Admin can approve vendor quotations.\n\nPlease click "Send for Admin Approval" to submit this quotation to Admin for review.');
            return;
        }

        setSendingApproval(true);
        try {
            const payload = {
                vendor_name: builderVendor,
                project_id: builderProjectId,
                approval_status: targetStatus,
                user_role: user?.role || '',
                user_id: user?.user_id || ''
            };

            const res = await axios.post(API_BASE_URL + '/vendor-quotas/send-approval', payload, {
                headers: {
                    'X-User-Id': user?.user_id || '',
                    'X-User-Role': user?.role || ''
                }
            });
            if (res.data && res.data.success) {
                setQuotaApprovalStatus(targetStatus);
                setIsQuotaLocked(targetStatus === 'Approved');
                alert(res.data.message || (targetStatus === 'Approved'
                    ? 'Vendor Quota approved by Admin! Quotation is locked for execution.'
                    : 'Vendor Quota submitted for Admin approval. Notification sent to Admin!'));
                fetchVendors();
            } else {
                alert(res.data.error || 'Failed to update approval status');
            }
        } catch (err: any) {
            console.error('Error in send approval:', err);
            const errDetail = err?.response?.data?.error || err?.response?.data?.message || 'Error sending approval notification';
            alert(errDetail);
        } finally {
            setSendingApproval(false);
        }
    };

    const handleOpenDuplicateVendorModal = (vendor: any, projId?: string) => {
        const activeProjId = projId || selectedProjectMap[vendor?.vendor_name] || (vendor?.projects?.[0]?.project_id) || (allProjectsList[0]?.project_id || '');
        setDuplicateSourceVendor(vendor);
        setDuplicateSourceProjId(String(activeProjId || ''));

        const nextProj = allProjectsList.find(p => String(p.project_id) !== String(activeProjId))?.project_id || activeProjId;

        setDuplicateForm({
            mode: 'diff_project',
            targetVendorName: vendor?.vendor_name || '',
            targetProjectId: String(nextProj || ''),
            targetVersion: 'V1.0',
            copyItems: true,
            openInBuilder: true
        });
        setShowDuplicateVendorModal(true);
    };

    const handleConfirmDuplicateVendor = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!duplicateSourceVendor) return;

        const finalVendorName = duplicateForm.targetVendorName.trim();
        if (!finalVendorName) {
            alert('Please specify a Target Vendor Name');
            return;
        }
        if (!duplicateForm.targetProjectId) {
            alert('Please select a Target Project Site');
            return;
        }

        setIsDuplicatingVendor(true);
        try {
            // 1. If mode is new_vendor_copy (or vendor doesn't exist in registered main_vendors):
            const existingVendorObj = vendors.find(v => (v.vendor_name || '').toLowerCase().trim() === finalVendorName.toLowerCase().trim());
            if (!existingVendorObj && duplicateForm.mode === 'new_vendor_copy') {
                try {
                    const newVendorPayload = {
                        vendor_name: finalVendorName,
                        category: duplicateSourceVendor.vendor_type || duplicateSourceVendor.category || 'Main Vendor',
                        contact_person: duplicateSourceVendor.contact_person || '',
                        phone: duplicateSourceVendor.phone || '',
                        email: duplicateSourceVendor.email || '',
                        address: duplicateSourceVendor.address || '',
                        gst_number: duplicateSourceVendor.gst_number || '',
                        pan_number: duplicateSourceVendor.pan_number || '',
                        aadhar_number: duplicateSourceVendor.aadhar_number || '',
                        photo: duplicateSourceVendor.photo || null
                    };
                    await axios.post(`${API_BASE_URL}/main-vendors`, newVendorPayload);
                } catch (err) {
                    console.warn('Notice from main-vendors creation:', err);
                }
            }

            // 2. Load modules and items if copyItems is enabled
            let duplicatedModules: any[] = [];
            let duplicatedItems: any[] = [];
            let totalValuation = 0;

            if (duplicateForm.copyItems) {
                try {
                    const reqUrl = `${API_BASE_URL}/vendor-quotas/project-items?vendor=${encodeURIComponent(duplicateSourceVendor.vendor_name)}&project_id=${duplicateSourceProjId}`;
                    const res = await axios.get(reqUrl);
                    if (res.data?.success) {
                        if (res.data.saved_quotation?.modules_data) {
                            try {
                                const parsed = typeof res.data.saved_quotation.modules_data === 'string'
                                    ? JSON.parse(res.data.saved_quotation.modules_data)
                                    : res.data.saved_quotation.modules_data;
                                if (Array.isArray(parsed) && parsed.length > 0) {
                                    duplicatedModules = parsed.map((m: any, mIdx: number) => ({
                                        ...m,
                                        id: `mod_dup_${Date.now()}_${mIdx}`,
                                        items: (m.items || []).map((it: any) => ({ ...it }))
                                    }));
                                }
                            } catch (e) {}
                        }
                        if (duplicatedModules.length === 0 && res.data.saved_quotation?.items_data?.length > 0) {
                            duplicatedModules = [{
                                id: `mod_dup_${Date.now()}_1`,
                                name: 'Modular Scope & Cabinetry',
                                items: res.data.saved_quotation.items_data.map((it: any) => ({ ...it }))
                            }];
                        }
                        // Fallback to client_quote if no saved quotation existed
                        if (duplicatedModules.length === 0 && res.data.client_quote?.items?.length > 0) {
                            const rawItems = res.data.client_quote.items;
                            const grouped: Record<string, any[]> = {};
                            rawItems.forEach((it: any) => {
                                const cName = it.category || it.section_name || 'Modular Scope & Cabinetry';
                                if (!grouped[cName]) grouped[cName] = [];
                                const rate = parseFloat(it.rate || it.amount || 0);
                                const qty = parseInt(it.quantity || it.qty || 1);
                                const disc = parseFloat(it.discount || it.discount_percent || 0);
                                const total = Math.round((rate * qty) * (1 - disc / 100));
                                grouped[cName].push({
                                    particulars: it.particulars || it.item_name || 'Item',
                                    shutter: it.shutter || '18mm Acrylic Finish',
                                    carcass: it.carcass || '18mm BWP Marine Plywood',
                                    dimensions: it.dimensions || 'Standard',
                                    rate,
                                    qty,
                                    discount: disc,
                                    gst: 18,
                                    total
                                });
                            });
                            duplicatedModules = Object.keys(grouped).map((k, idx) => ({
                                id: `mod_dup_${Date.now()}_${idx}`,
                                name: k,
                                items: grouped[k]
                            }));
                        }
                    }
                } catch (fetchErr) {
                    console.warn('Error fetching source items:', fetchErr);
                }
            }

            if (duplicatedModules.length === 0) {
                duplicatedModules = [{
                    id: `mod_dup_${Date.now()}_1`,
                    name: 'Modular Scope & Cabinetry',
                    items: [{
                        particulars: 'Kitchen / Modular Cabinet Unit',
                        shutter: '18mm Acrylic Shutter',
                        carcass: '18mm BWP Plywood',
                        dimensions: '8ft x 4ft',
                        rate: 1500,
                        qty: 1,
                        discount: 0,
                        gst: 18,
                        total: 1770
                    }]
                }];
            }

            duplicatedItems = duplicatedModules.flatMap(m => m.items);
            totalValuation = duplicatedItems.reduce((s, it) => s + (it.total || 0), 0);

            // 3. Save the duplicated quotation
            const savePayload = {
                vendor_name: finalVendorName,
                project_id: duplicateForm.targetProjectId,
                items_data: duplicatedItems,
                modules_data: duplicatedModules,
                version: duplicateForm.targetVersion || 'V1.0',
                approval_status: 'Pending Approval',
                is_locked: 0,
                column_visibility: columnVisibility,
                total_amount: totalValuation,
                user_role: user?.role || '',
                user_id: user?.user_id || ''
            };

            const saveRes = await axios.post(`${API_BASE_URL}/vendor-quotas/save`, savePayload, {
                headers: {
                    'X-User-Id': user?.user_id || '',
                    'X-User-Role': user?.role || ''
                }
            });

            if (saveRes.data?.success) {
                setShowDuplicateVendorModal(false);
                await fetchVendors();
                setSelectedProjectMap(prev => ({ ...prev, [finalVendorName]: duplicateForm.targetProjectId }));

                if (duplicateForm.openInBuilder) {
                    setBuilderVendor(finalVendorName);
                    setBuilderProjectId(duplicateForm.targetProjectId);
                    setBuilderModules(duplicatedModules);
                    setQuotaVersion(duplicateForm.targetVersion || 'V1.0');
                    setQuotaApprovalStatus('Pending Approval');
                    setIsQuotaLocked(false);
                    setIsCreateQuotaModalOpen(true);
                } else {
                    alert(`Vendor quotation successfully duplicated for "${finalVendorName}" (${duplicateForm.targetProjectId})!`);
                }
            } else {
                alert(saveRes.data?.error || 'Failed to save duplicated vendor quotation');
            }
        } catch (err: any) {
            console.error('Error in duplicating vendor:', err);
            alert(err?.response?.data?.error || 'Error duplicating vendor quotation');
        } finally {
            setIsDuplicatingVendor(false);
        }
    };

    const activeColumnCount = 1 + Object.values(columnVisibility).filter(Boolean).length;

    const pdfContainerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const handleClickOutside = () => {
            setActiveRowMenu(null);
            setOpenModuleMenuIdx(null);
            setOpenThreeDotMenuId(null);
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    useEffect(() => {
        fetchVendors();
        fetchAgreementPdf();
    }, []);

    const fetchVendors = async () => {
        try {
            setLoading(true);

            // 1. Fetch Client Quotations (Filter strictly for Order Converted / Booked / Approved Quotations)
            let allProjectsList: any[] = [];
            try {
                const qRes = await axios.get(API_BASE_URL + '/quotes');
                const rawQuotes = Array.isArray(qRes.data) ? qRes.data : (qRes.data?.data || []);
                if (Array.isArray(rawQuotes) && rawQuotes.length > 0) {
                    allProjectsList = rawQuotes.filter((q: any) => {
                        const st = (q.status || q.quote_status || '').toLowerCase().trim().replace('_', ' ');
                        const pst = (q.project_status || '').toLowerCase().trim().replace('_', ' ');
                        return st === 'order converted' || st === 'booked' || st === 'approved' || st === 'finalized' || pst === 'order converted' || pst === 'finalized';
                    }).map((q: any) => {
                        const projName = q.project_name || q.project_code || ('Project ' + q.project_id);
                        const clientName = q.client_name || q.quoted_to || q.subtitle || 'Client';
                        const quoteRef = q.quote_number || ('QT-' + q.project_id);
                        const totalAmt = parseFloat(q.total_amount || 0);
                        const rawStatus = (q.status || 'Order Converted').toLowerCase().replace('_', ' ');
                        const statusBadge = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1);

                        return {
                            project_id: q.project_id,
                            project_name: projName,
                            quote_number: quoteRef,
                            client_name: clientName,
                            status: statusBadge,
                            total_amount: totalAmt,
                            display_label: `Ref: ${quoteRef} — Project: ${projName} | Client: ${clientName} (₹${totalAmt.toLocaleString('en-IN')}) [${statusBadge}]`
                        };
                    });
                }
            } catch (e) {
                console.log('Error fetching quotes list:', e);
            }

            // Fallback to /projects if quotes array is empty
            if (allProjectsList.length === 0) {
                try {
                    const pRes = await axios.get(API_BASE_URL + '/projects');
                    const rawProjects = Array.isArray(pRes.data) ? pRes.data : (pRes.data?.data || []);
                    allProjectsList = rawProjects.filter((p: any) => {
                        const st = (p.status || '').toLowerCase().trim().replace('_', ' ');
                        return st === 'finalized' || st === 'order converted' || st === 'designing phase' || st === 'booked';
                    }).map((p: any) => ({
                        project_id: p.project_id,
                        project_name: p.project_name || ('Project ' + p.project_id),
                        quote_number: 'QT-' + p.project_id,
                        client_name: p.client_name || 'Client',
                        status: 'Order Converted',
                        total_amount: parseFloat(p.total_amount || 0),
                        display_label: `Project: ${p.project_name || p.project_id} (Ref: QT-${p.project_id}) [Order Converted]`
                    }));
                } catch (e) {
                    console.log('Error fetching projects list fallback:', e);
                }
            }

            setAllProjectsList(allProjectsList);

            // 2. Fetch Main Vendors strictly from /main-vendors API
            let vendorList: any[] = [];
            try {
                const mRes = await axios.get(API_BASE_URL + '/main-vendors');
                if (mRes.data && (mRes.data.success || mRes.data.status === 'success') && Array.isArray(mRes.data.data)) {
                    vendorList = mRes.data.data.map((mv: any) => ({
                        id: mv.id,
                        vendor_name: mv.vendor_name,
                        vendor_type: mv.category || 'Main Vendor',
                        status: mv.status || 'Pending',
                        contact_person: mv.contact_person || '',
                        phone: mv.phone || '',
                        email: mv.email || '',
                        address: mv.address || '',
                        gst_number: mv.gst_number || '',
                        pan_number: mv.pan_number || '',
                        aadhar_number: mv.aadhar_number || '',
                        created_at: mv.created_at,
                        photo: mv.photo || null,
                        projects: []
                    }));
                }
            } catch (e) {
                console.log('Error fetching main-vendors:', e);
            }

            // 3. Attach created vendor_quotations project links to main vendors if present
            try {
                const vqRes = await axios.get(API_BASE_URL + '/vendor-quotas');
                const vqVendors = vqRes.data?.vendors || [];

                vendorList.forEach((mv: any) => {
                    const matchedVq = vqVendors.find((v: any) => (v.vendor_name || '').toLowerCase().trim() === mv.vendor_name.toLowerCase().trim());
                    if (matchedVq && matchedVq.projects && matchedVq.projects.length > 0) {
                        mv.projects = matchedVq.projects;
                    }
                });
            } catch (e) {}

            // Ensure EVERY vendor has ALL projects available in their dropdown list!
            vendorList.forEach((v: any) => {
                const existingProjects = v.projects || [];
                const fullProjectMap: Record<string, any> = {};

                // First populate with all system projects
                allProjectsList.forEach((p: any) => {
                    const key = String(p.project_id);
                    fullProjectMap[key] = {
                        project_id: p.project_id,
                        project_name: p.project_name || ('Project ' + p.project_id),
                        client_id: p.client_id || p.project_id,
                        project_type: p.project_type || 'Interior Project',
                        total_amount: 0,
                        approval_status: 'Pending Approval',
                        is_created_quota: false
                    };
                });

                // Merge existing saved quota amounts/details with robust string key matching
                existingProjects.forEach((ep: any) => {
                    const epKey = String(ep.project_id);
                    const epAmt = parseFloat(ep.total_amount || ep.amount || 0);
                    if (fullProjectMap[epKey]) {
                        fullProjectMap[epKey].total_amount = epAmt;
                        fullProjectMap[epKey].approval_status = ep.approval_status || 'Pending Approval';
                        fullProjectMap[epKey].is_created_quota = !!ep.is_created_quota;
                    } else {
                        fullProjectMap[epKey] = {
                            project_id: ep.project_id,
                            project_name: ep.project_name || ('Project ' + ep.project_id),
                            client_id: ep.client_id || ep.project_id,
                            project_type: ep.project_type || 'Interior Project',
                            total_amount: epAmt,
                            approval_status: ep.approval_status || 'Pending Approval',
                            is_created_quota: !!ep.is_created_quota
                        };
                    }
                });

                // Sort projects so projects WITH non-zero quotation amounts appear FIRST!
                const sortedProjects = Object.values(fullProjectMap).sort((a: any, b: any) => {
                    if ((b.total_amount || 0) !== (a.total_amount || 0)) {
                        return (b.total_amount || 0) - (a.total_amount || 0);
                    }
                    return (b.is_created_quota ? 1 : 0) - (a.is_created_quota ? 1 : 0);
                });

                v.projects = sortedProjects;
            });

            setVendors(vendorList);

            const defaultMap: Record<string, string> = {};
            vendorList.forEach((v: any) => {
                if (v.projects && v.projects.length > 0) {
                    const activeProj = v.projects.find((p: any) => (p.total_amount || 0) > 0) || v.projects[0];
                    defaultMap[v.vendor_name] = String(activeProj.project_id);
                }
            });
            setSelectedProjectMap(defaultMap);
        } catch (err) {
            console.error('Error in fetchVendors:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateMainVendorSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!mainVendorForm.vendor_name.trim()) {
            alert('Please enter Vendor Name');
            return;
        }

        setCreatingMainVendor(true);
        try {
            const payload = {
                ...mainVendorForm,
                photo: mainVendorPhotoPreview || ''
            };

            const res = await axios.post(API_BASE_URL + '/main-vendors', payload);
            if (res.data && (res.data.success || res.data.status === 'success')) {
                alert('Main Vendor registered successfully!');
                setIsCreateMainVendorModalOpen(false);
                setMainVendorForm({
                    vendor_name: '',
                    category: 'Main Vendor',
                    contact_person: '',
                    phone: '',
                    email: '',
                    address: '',
                    gst_number: '',
                    pan_number: '',
                    pan_file: null,
                    aadhar_number: '',
                    aadhar_file: null
                });
                setMainVendorPhotoPreview(null);
                fetchVendors();
            } else {
                alert(res.data.message || 'Failed to create main vendor');
            }
        } catch (err) {
            console.error('Error creating main vendor:', err);
            alert('Error creating main vendor');
        } finally {
            setCreatingMainVendor(false);
        }
    };

    const fetchAgreementPdf = async () => {
        try {
            const res = await axios.get(API_BASE_URL + '/vendor-quotas/agreement-pdf');
            if (res.data.success) {
                setAgreementPdfBase64(res.data.pdf_base64);
            }
        } catch (err) {
            console.error('Error fetching agreement PDF:', err);
        }
    };

    const handleProjectChange = (vendorName: string, projectId: string) => {
        setSelectedProjectMap(prev => ({ ...prev, [vendorName]: projectId }));
    };

    const handleOpenPdfModal = async (vendor: any) => {
        const projId = selectedProjectMap[vendor.vendor_name];
        if (!projId) {
            alert('Please select a project for this vendor first.');
            return;
        }

        const projObj = vendor.projects.find((p: any) => String(p.project_id) === String(projId));

        setSelectedVendorForPdf(vendor);
        setSelectedProjectForPdf(projObj || { project_id: projId, project_name: 'Project ' + projId });
        setPreviewModalOpen(true);
        setLoadingPdfItems(true);

        try {
            const reqUrl = API_BASE_URL + '/vendor-quotas/project-items?vendor=' + encodeURIComponent(vendor.vendor_name) + '&project_id=' + projId;
            const res = await axios.get(reqUrl);
            if (res.data.success) {
                let combined: any[] = [];

                if (res.data.saved_quotation?.items_data && Array.isArray(res.data.saved_quotation.items_data) && res.data.saved_quotation.items_data.length > 0) {
                    combined = res.data.saved_quotation.items_data.map((i: any) => {
                        const isHeader = i.brand === 'HEADER';
                        const rate = parseFloat(i.vendor_rate ?? i.rate ?? i.original_rate ?? i.rate_per_sft ?? 0);
                        const amount = parseFloat(i.vendor_amount ?? i.amount ?? i.original_amount ?? 0);
                        return {
                            particulars: i.particulars || i.item_name || 'Material Item',
                            description: i.description || '',
                            unit: i.unit || 'Nos',
                            quantity: parseFloat(i.quantity || 1),
                            rate,
                            amount,
                            discount: parseFloat(i.vendor_discount ?? i.discount_percent ?? i.original_discount ?? 0),
                            gst: parseFloat(i.vendor_gst ?? i.gst_rate ?? i.original_gst ?? 18),
                            brand: i.brand,
                            width: i.width,
                            height: i.height,
                            sft: i.sft,
                            pricing_mode: i.pricing_mode,
                            isHeader
                        };
                    });

                    if (res.data.saved_quotation.project_name) {
                        setSelectedProjectForPdf((prev: any) => ({
                            ...prev,
                            project_name: res.data.saved_quotation.project_name,
                            client_id: res.data.saved_quotation.client_id || prev?.client_id,
                            project_type: res.data.saved_quotation.project_type || prev?.project_type
                        }));
                    }
                } else {
                    combined = [
                        ...(res.data.inventory_items || []).map((i: any) => ({
                            particulars: i.item_name || 'Material Item',
                            unit: i.unit || 'Nos',
                            quantity: parseFloat(i.quantity || 1),
                            rate: parseFloat(i.rate || 0),
                            amount: parseFloat(i.total || 0),
                            date: i.invoice_date,
                            source: 'Inventory / Purchase'
                        })),
                        ...(res.data.finance_items || []).map((f: any) => ({
                            particulars: f.description || f.category || 'Service / Expense',
                            unit: 'Job',
                            quantity: 1,
                            rate: parseFloat(f.amount || 0),
                            amount: parseFloat(f.amount || 0),
                            date: f.transaction_date,
                            source: f.category || 'Finance'
                        }))
                    ];
                }

                setPdfItems(combined);
            }
        } catch (err) {
            console.error('Error fetching PDF items:', err);
        } finally {
            setLoadingPdfItems(false);
        }
    };

    const handleDownloadCombinedPdf = () => {
        window.print();
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '—';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
        } catch {
            return dateStr;
        }
    };

    const formatINR = (val?: number) => {
        const num = Number(val) || 0;
        return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const toggleSelectAll = () => {
        if (Object.keys(selectedRows).length === filteredVendors.length && filteredVendors.length > 0) {
            setSelectedRows({});
        } else {
            const newSel: Record<string, boolean> = {};
            filteredVendors.forEach((v, i) => {
                newSel[v.id || v.vendor_name || String(i)] = true;
            });
            setSelectedRows(newSel);
        }
    };

    const toggleSelectRow = (id: string) => {
        setSelectedRows(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const toggleExpandRow = (id: string) => {
        setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const resetFilters = () => {
        setSearchQuery('');
        setStatementPeriod('all_time');
        setSelectedYear(new Date().getFullYear());
        setCustomStartDate('');
        setCustomEndDate('');
        setProjectTypeFilter('all');
        setStatusFilter('all');
    };

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

    const isDateInPeriod = (rawDate: string | null | undefined): boolean => {
        if (statementPeriod === 'all_time') return true;
        if (!rawDate) return false;
        const tDate = parseLocalDate(rawDate);
        if (!tDate) return false;
        const now = new Date();
        if (statementPeriod === 'last_month') {
            const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
            return tDate >= start && tDate <= end;
        }
        if (statementPeriod === 'last_3_months') {
            const start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
            return tDate >= start;
        }
        if (statementPeriod === 'last_6_months') {
            const start = new Date(now.getFullYear(), now.getMonth() - 6, 1);
            return tDate >= start;
        }
        if (statementPeriod === 'this_year') {
            const start = new Date(now.getFullYear(), 0, 1);
            const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
            return tDate >= start && tDate <= end;
        }
        if (statementPeriod === 'by_year') {
            const yr = selectedYear || now.getFullYear();
            const start = new Date(yr, 0, 1);
            const end = new Date(yr, 11, 31, 23, 59, 59);
            return tDate >= start && tDate <= end;
        }
        if (statementPeriod === 'custom_range') {
            if (customStartDate) {
                const cStart = parseLocalDate(customStartDate);
                if (cStart && tDate < cStart) return false;
            }
            if (customEndDate) {
                const [ey, em, ed] = customEndDate.split('-').map(Number);
                const cEnd = new Date(ey, em - 1, ed, 23, 59, 59);
                if (tDate > cEnd) return false;
            }
            return true;
        }
        return true;
    };

    const baseFilteredVendors = useMemo(() => {
        return vendors.filter(v => {
            // Search filter
            const q = searchQuery.trim().toLowerCase();
            if (q) {
                const nameMatch = (v.vendor_name || '').toLowerCase().includes(q);
                const projMatch = (v.projects || []).some((p: any) =>
                    (p.project_name || '').toLowerCase().includes(q) ||
                    String(p.client_id || '').toLowerCase().includes(q)
                );
                if (!nameMatch && !projMatch) return false;
            }

            // Project Type Filter
            if (projectTypeFilter !== 'all') {
                const hasMatchingProjectType = (v.projects || []).some((p: any) => {
                    const pt = String(p.project_type || p.type || '').toLowerCase();
                    if (projectTypeFilter === 'furniture') return pt.includes('furniture');
                    if (projectTypeFilter === 'interior') return pt.includes('interior');
                    return true;
                });
                if (v.projects && v.projects.length > 0 && !hasMatchingProjectType) return false;
            }

            // Date Filter (Statement Period)
            if (statementPeriod !== 'all_time') {
                const hasMatchingDate = (v.projects || []).some((p: any) => {
                    const dateStr = p.created_at || p.date || p.start_date || p.updated_at;
                    return isDateInPeriod(dateStr);
                }) || isDateInPeriod(v.created_at || v.date);

                if (!hasMatchingDate) return false;
            }

            return true;
        });
    }, [vendors, searchQuery, statementPeriod, selectedYear, customStartDate, customEndDate, projectTypeFilter]);

    const overviewMetrics = useMemo(() => {
        let totalQuotationsCount = 0;
        let totalValuationSum = 0;
        let approvedCount = 0;
        let approvedValuationSum = 0;
        let proposalSentCount = 0;
        let proposalSentValuationSum = 0;
        let pendingCount = 0;
        let pendingValuationSum = 0;
        let rejectedCount = 0;
        let rejectedValuationSum = 0;

        baseFilteredVendors.forEach(v => {
            const projs = v.projects || [];
            const activeProjs = projs.filter((p: any) => (p.total_amount || 0) > 0 || p.is_created_quota);

            if (activeProjs.length > 0) {
                activeProjs.forEach((p: any) => {
                    totalQuotationsCount += 1;
                    const amt = parseFloat(p.total_amount || p.amount || 0);
                    totalValuationSum += amt;

                    const st = String(p.approval_status || v.status || v.approval_status || '').toUpperCase().trim();
                    if (st.includes('APPROV')) {
                        approvedCount += 1;
                        approvedValuationSum += amt;
                    } else if (st.includes('PROPOSAL')) {
                        proposalSentCount += 1;
                        proposalSentValuationSum += amt;
                    } else if (st.includes('REJECT')) {
                        rejectedCount += 1;
                        rejectedValuationSum += amt;
                    } else {
                        pendingCount += 1;
                        pendingValuationSum += amt;
                    }
                });
            } else {
                const vSt = String(v.status || v.approval_status || '').toUpperCase().trim();
                if (vSt.includes('APPROV')) {
                    approvedCount += 1;
                } else if (vSt.includes('PROPOSAL')) {
                    proposalSentCount += 1;
                } else if (vSt.includes('REJECT')) {
                    rejectedCount += 1;
                } else {
                    pendingCount += 1;
                }
            }
        });

        return {
            totalQuotationsCount,
            totalValuationSum,
            approvedCount,
            approvedValuationSum,
            proposalSentCount,
            proposalSentValuationSum,
            pendingCount,
            pendingValuationSum,
            rejectedCount,
            rejectedValuationSum,
            totalVendorsCount: baseFilteredVendors.length
        };
    }, [baseFilteredVendors]);

    const filteredVendors = useMemo(() => {
        if (statusFilter === 'all') return baseFilteredVendors;
        return baseFilteredVendors.filter(v => {
            const selectedProjId = selectedProjectMap[v.vendor_name] || (v.projects?.[0]?.project_id) || '';
            const selectedProj = v.projects?.find((p: any) => String(p.project_id) === String(selectedProjId));
            const st = String(selectedProj?.approval_status || v.status || v.approval_status || 'PENDING').toUpperCase().trim();

            if (statusFilter === 'approved') return st.includes('APPROV');
            if (statusFilter === 'proposal_sent') return st.includes('PROPOSAL');
            if (statusFilter === 'pending') return (!st.includes('APPROV') && !st.includes('PROPOSAL') && !st.includes('REJECT'));
            if (statusFilter === 'rejected') return st.includes('REJECT');
            return true;
        });
    }, [baseFilteredVendors, statusFilter, selectedProjectMap]);

    const totalAmountSum = pdfItems.reduce((s, i) => s + (i.amount || 0), 0);

    useEffect(() => {
        const origBodyBg = document.body.style.backgroundColor;
        const origDocBg = document.documentElement.style.backgroundColor;
        document.body.style.backgroundColor = '#ffffff';
        document.body.style.background = '#ffffff';
        document.documentElement.style.backgroundColor = '#ffffff';
        document.documentElement.style.background = '#ffffff';
        return () => {
            document.body.style.backgroundColor = origBodyBg;
            document.body.style.background = origBodyBg;
            document.documentElement.style.backgroundColor = origDocBg;
            document.documentElement.style.background = origDocBg;
        };
    }, []);

    return (
        <div style={{ padding: '0px', width: '100%', margin: '0', backgroundColor: '#ffffff', minHeight: '100vh' }}>
            {!isCreateQuotaModalOpen && (
                <div className="vendor-quota-list-view" style={{ padding: '24px 32px' }}>
                    {/* Header Title Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ padding: '12px', backgroundColor: '#0c1527', borderRadius: '12px', color: '#fca412', boxShadow: '0 4px 12px rgba(12,21,39,0.15)' }}>
                        <ShoppingCart size={26} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0c1527', margin: 0 }}>
                            Vendor Quotation Management
                        </h1>
                        <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '3px 0 0 0' }}>
                            Generate main vendor work orders joined with Livincart Master Service Agreement PDF
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                        onClick={() => {
                            const firstVendor = vendors[0]?.vendor_name || '';
                            const firstProj = allProjectsList[0]?.project_id || '';
                            setBuilderVendor(firstVendor);
                            setBuilderProjectId(firstProj);
                            setIsCreateQuotaModalOpen(true);
                            if (firstVendor && firstProj) {
                                loadQuotaScopeForProject(firstVendor, firstProj);
                            }
                        }}
                        style={{
                            backgroundColor: '#0c1527',
                            color: '#fca412',
                            border: '1.5px solid #fca412',
                            borderRadius: '10px',
                            padding: '10px 20px',
                            fontWeight: 800,
                            fontSize: '0.88rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 4px 14px rgba(12, 21, 39, 0.2)',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <Plus size={18} /> Create Vendor Quotation
                    </button>

                    <button
                        onClick={() => setIsCreateMainVendorModalOpen(true)}
                        style={{
                            backgroundColor: '#ea580c',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '10px',
                            padding: '10px 20px',
                            fontWeight: 800,
                            fontSize: '0.88rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 4px 14px rgba(234, 88, 12, 0.25)',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <Plus size={18} /> Create Main Vendor
                    </button>
                </div>
            </div>

            {/* TOP KPI SUMMARY OVERVIEW CARDS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                {/* Card 1: Total Valuation & Work Orders */}
                <div
                    onClick={() => setStatusFilter('all')}
                    style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '14px',
                        padding: '18px',
                        border: statusFilter === 'all' ? '2px solid #0c1527' : '1.5px solid #e2e8f0',
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        position: 'relative',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        transition: 'transform 0.15s, border-color 0.15s'
                    }}
                >
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: '#0c1527' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                        <div>
                            <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Total Work Order Value
                            </div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0c1527', marginTop: '4px' }}>
                                ₹{overviewMetrics.totalValuationSum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </div>
                        <div style={{ padding: '8px', backgroundColor: '#f1f5f9', borderRadius: '10px', color: '#0c1527' }}>
                            <ShoppingCart size={20} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                        <span style={{ fontSize: '0.74rem', color: '#475569', fontWeight: 700 }}>
                            {overviewMetrics.totalQuotationsCount} Total Work Orders
                        </span>
                        <span style={{ fontSize: '0.70rem', fontWeight: 800, color: '#0c1527', backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '12px' }}>
                            {overviewMetrics.totalVendorsCount} Vendors
                        </span>
                    </div>
                </div>

                {/* Card 2: Approved Quotations */}
                <div
                    onClick={() => setStatusFilter(statusFilter === 'approved' ? 'all' : 'approved')}
                    style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '14px',
                        padding: '18px',
                        border: statusFilter === 'approved' ? '2px solid #16a34a' : '1.5px solid #bbf7d0',
                        boxShadow: '0 4px 16px rgba(22, 163, 74, 0.06)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        position: 'relative',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        transition: 'transform 0.15s, border-color 0.15s'
                    }}
                >
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: '#16a34a' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                        <div>
                            <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Approved Quotations Value
                            </div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#15803d', marginTop: '4px' }}>
                                ₹{overviewMetrics.approvedValuationSum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </div>
                        <div style={{ padding: '8px', backgroundColor: '#f0fdf4', borderRadius: '10px', color: '#16a34a' }}>
                            <CheckCircle2 size={20} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid #f0fdf4' }}>
                        <span style={{ fontSize: '0.74rem', color: '#16a34a', fontWeight: 700 }}>
                            Approved & Locked Scope
                        </span>
                        <span style={{ fontSize: '0.70rem', fontWeight: 800, color: '#15803d', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '12px' }}>
                            ✅ {overviewMetrics.approvedCount} Approved
                        </span>
                    </div>
                </div>

                {/* Card 3: Proposal Sent Value */}
                <div
                    onClick={() => setStatusFilter(statusFilter === 'proposal_sent' ? 'all' : 'proposal_sent')}
                    style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '14px',
                        padding: '18px',
                        border: statusFilter === 'proposal_sent' ? '2px solid #2563eb' : '1.5px solid #bfdbfe',
                        boxShadow: '0 4px 16px rgba(37, 99, 235, 0.06)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        position: 'relative',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        transition: 'transform 0.15s, border-color 0.15s'
                    }}
                >
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: '#2563eb' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                        <div>
                            <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Proposal Sent Value
                            </div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#1d4ed8', marginTop: '4px' }}>
                                ₹{overviewMetrics.proposalSentValuationSum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </div>
                        <div style={{ padding: '8px', backgroundColor: '#eff6ff', borderRadius: '10px', color: '#2563eb' }}>
                            <Send size={20} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid #eff6ff' }}>
                        <span style={{ fontSize: '0.74rem', color: '#2563eb', fontWeight: 700 }}>
                            Sent to Client / Vendor
                        </span>
                        <span style={{ fontSize: '0.70rem', fontWeight: 800, color: '#1d4ed8', backgroundColor: '#dbeafe', padding: '2px 8px', borderRadius: '12px' }}>
                            📨 {overviewMetrics.proposalSentCount} Sent
                        </span>
                    </div>
                </div>

                {/* Card 4: Pending Approval */}
                <div
                    onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
                    style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '14px',
                        padding: '18px',
                        border: statusFilter === 'pending' ? '2px solid #ea580c' : '1.5px solid #fed7aa',
                        boxShadow: '0 4px 16px rgba(234, 88, 12, 0.06)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        position: 'relative',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        transition: 'transform 0.15s, border-color 0.15s'
                    }}
                >
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: '#ea580c' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                        <div>
                            <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#c2410c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Pending Approval Value
                            </div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#c2410c', marginTop: '4px' }}>
                                ₹{overviewMetrics.pendingValuationSum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </div>
                        <div style={{ padding: '8px', backgroundColor: '#fff7ed', borderRadius: '10px', color: '#ea580c' }}>
                            <FileText size={20} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid #fff7ed' }}>
                        <span style={{ fontSize: '0.74rem', color: '#ea580c', fontWeight: 700 }}>
                            Awaiting Signoff & Lock
                        </span>
                        <span style={{ fontSize: '0.70rem', fontWeight: 800, color: '#c2410c', backgroundColor: '#ffedd5', padding: '2px 8px', borderRadius: '12px' }}>
                            ⏳ {overviewMetrics.pendingCount} Pending
                        </span>
                    </div>
                </div>

                {/* Card 5: Rejected Quotations */}
                <div
                    onClick={() => setStatusFilter(statusFilter === 'rejected' ? 'all' : 'rejected')}
                    style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '14px',
                        padding: '18px',
                        border: statusFilter === 'rejected' ? '2px solid #dc2626' : '1.5px solid #fecaca',
                        boxShadow: '0 4px 16px rgba(220, 38, 38, 0.06)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        position: 'relative',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        transition: 'transform 0.15s, border-color 0.15s'
                    }}
                >
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: '#dc2626' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                        <div>
                            <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Rejected Quotations Value
                            </div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#b91c1c', marginTop: '4px' }}>
                                ₹{overviewMetrics.rejectedValuationSum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </div>
                        <div style={{ padding: '8px', backgroundColor: '#fef2f2', borderRadius: '10px', color: '#dc2626' }}>
                            <XCircle size={20} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid #fef2f2' }}>
                        <span style={{ fontSize: '0.74rem', color: '#dc2626', fontWeight: 700 }}>
                            Declined / Non-selected
                        </span>
                        <span style={{ fontSize: '0.70rem', fontWeight: 800, color: '#b91c1c', backgroundColor: '#fee2e2', padding: '2px 8px', borderRadius: '12px' }}>
                            ❌ {overviewMetrics.rejectedCount} Rejected
                        </span>
                    </div>
                </div>

                {/* Card 6: Active Main Vendors Panel */}
                <div style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '14px',
                    padding: '18px',
                    border: '1.5px solid #c7d2fe',
                    boxShadow: '0 4px 16px rgba(79, 70, 229, 0.06)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: '#4f46e5' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                        <div>
                            <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#4338ca', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Active Vendor Partners
                            </div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#3730a3', marginTop: '4px' }}>
                                {overviewMetrics.totalVendorsCount} Vendors
                            </div>
                        </div>
                        <div style={{ padding: '8px', backgroundColor: '#eef2ff', borderRadius: '10px', color: '#4f46e5' }}>
                            <Building2 size={20} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid #eef2ff' }}>
                        <span style={{ fontSize: '0.74rem', color: '#4f46e5', fontWeight: 700 }}>
                            Registered Main Vendors
                        </span>
                        <span style={{ fontSize: '0.70rem', fontWeight: 800, color: '#4338ca', backgroundColor: '#e0e7ff', padding: '2px 8px', borderRadius: '12px' }}>
                            🏢 Active Panel
                        </span>
                    </div>
                </div>
            </div>

            {/* FILTERS TOOLBAR PANEL */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '18px 20px', border: '1.5px solid #ffe8c2', marginBottom: '24px', boxShadow: '0 4px 14px rgba(252,164,18,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontWeight: 700, fontSize: '0.90rem' }}>
                        <Filter size={18} style={{ color: '#ea580c' }} />
                        Filter &amp; Search Statement Periods
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                            onClick={resetFilters}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '5px 12px',
                                borderRadius: '8px',
                                border: '1.5px solid #ef4444',
                                backgroundColor: '#fef2f2',
                                color: '#ef4444',
                                fontWeight: 800,
                                fontSize: '0.78rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                boxShadow: '0 2px 6px rgba(239, 68, 68, 0.12)'
                            }}
                            title="Reset all search and filter options"
                        >
                            <RotateCcw size={13} /> Reset Filters
                        </button>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', alignItems: 'end' }}>
                    {/* Search Bar */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Search Vendor / Project / Client</label>
                        <div style={{ position: 'relative' }}>
                            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search keyword..."
                                style={{ width: '100%', padding: '8px 10px 8px 34px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.84rem', outline: 'none', boxSizing: 'border-box' }}
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}>
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Statement Period Filter */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Statement Period</label>
                        <select
                            value={statementPeriod}
                            onChange={(e) => setStatementPeriod(e.target.value)}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.84rem', outline: 'none', backgroundColor: '#ffffff', fontWeight: 600 }}
                        >
                            <option value="all_time">All Time</option>
                            <option value="last_month">Last Month</option>
                            <option value="last_3_months">Last 3 Months</option>
                            <option value="last_6_months">Last 6 Months</option>
                            <option value="this_year">This Year</option>
                            <option value="by_year">By Year</option>
                            <option value="custom_range">Custom Range</option>
                        </select>
                    </div>

                    {/* By Year — Dynamic Year Picker */}
                    {statementPeriod === 'by_year' && (
                        <div>
                            <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Select Year</label>
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(Number(e.target.value))}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1.5px solid #2563eb', fontSize: '0.84rem', outline: 'none', backgroundColor: '#eff6ff', fontWeight: 800, color: '#1e40af', cursor: 'pointer' }}
                            >
                                {Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - i).map(yr => (
                                    <option key={yr} value={yr}>{yr}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Project Type Filter */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Project Type</label>
                        <select
                            value={projectTypeFilter}
                            onChange={(e) => setProjectTypeFilter(e.target.value)}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.84rem', outline: 'none', backgroundColor: '#ffffff', fontWeight: 600 }}
                        >
                            <option value="all">All Project Types</option>
                            <option value="furniture">Furniture Projects</option>
                            <option value="interior">Interior Projects</option>
                        </select>
                    </div>

                    {/* Approval Status Filter */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Approval Status</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: statusFilter !== 'all' ? '1.5px solid #2563eb' : '1px solid #cbd5e1', fontSize: '0.84rem', outline: 'none', backgroundColor: statusFilter !== 'all' ? '#eff6ff' : '#ffffff', fontWeight: 600, color: statusFilter !== 'all' ? '#1d4ed8' : '#1e293b' }}
                        >
                            <option value="all">All Statuses</option>
                            <option value="approved">Approved</option>
                            <option value="proposal_sent">Proposal Sent</option>
                            <option value="pending">Pending</option>
                            <option value="rejected">Rejected</option>
                        </select>
                    </div>
                </div>

                {/* Custom Date Range Picker */}
                {statementPeriod === 'custom_range' && (
                    <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px dashed #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.80rem', fontWeight: 700, color: '#475569' }}>From Date:</span>
                            <input
                                type="date"
                                value={customStartDate}
                                onChange={(e) => setCustomStartDate(e.target.value)}
                                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.84rem' }}
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.80rem', fontWeight: 700, color: '#475569' }}>To Date:</span>
                            <input
                                type="date"
                                value={customEndDate}
                                onChange={(e) => setCustomEndDate(e.target.value)}
                                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.84rem' }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Vendors & Quota Table */}
            <div style={{
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                overflow: 'hidden',
                backgroundColor: '#ffffff'
            }}>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
                        <Loader2 className="animate-spin" size={44} color="#fca412" />
                    </div>
                ) : filteredVendors.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: '#64748b', fontSize: '1.05rem' }}>
                        No vendor records found matching your search.
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                            <thead style={{ fontWeight: 900 }}>
                                <tr style={{ backgroundColor: '#fff9f0', color: '#0c1527', fontWeight: 900, fontSize: '0.80rem', letterSpacing: '0.6px', height: '54px', borderBottom: '2px solid #fca412' }}>
                                    <th style={{ padding: '18px 16px', width: '40px', fontWeight: 900 }}>
                                        <input
                                            type="checkbox"
                                            checked={filteredVendors.length > 0 && Object.keys(selectedRows).length === filteredVendors.length}
                                            onChange={toggleSelectAll}
                                            style={{ cursor: 'pointer', accentColor: '#fca412' }}
                                        />
                                    </th>
                                    <th style={{ padding: '18px 12px', width: '40px', color: '#94a3b8', fontWeight: 900 }}>#</th>

                                    {/* Expand Column */}
                                    <th style={{ padding: '18px 16px', whiteSpace: 'nowrap', textTransform: 'uppercase', fontWeight: 900 }}>
                                        Expand
                                    </th>

                                    {/* Date Column */}
                                    <th style={{ padding: '18px 16px', whiteSpace: 'nowrap', textTransform: 'uppercase', fontWeight: 900 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span>Date</span>
                                            <ArrowDown size={14} color="#fca412" />
                                        </div>
                                    </th>

                                    {/* Project ID / Quotation Column */}
                                    <th style={{ padding: '18px 16px', whiteSpace: 'nowrap', textTransform: 'uppercase', fontWeight: 900 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span>Project ID / Quotation</span>
                                            <ArrowUp size={14} color="#94a3b8" />
                                        </div>
                                    </th>

                                    {/* Quoted To Column */}
                                    <th style={{ padding: '18px 16px', whiteSpace: 'nowrap', textTransform: 'uppercase', fontWeight: 900 }}>
                                        Quoted To
                                    </th>

                                    {/* Amount Column */}
                                    <th style={{ padding: '18px 16px', whiteSpace: 'nowrap', textTransform: 'uppercase', fontWeight: 900 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span>Amount</span>
                                            <ArrowUp size={14} color="#94a3b8" />
                                        </div>
                                    </th>

                                    {/* Status Column */}
                                    <th style={{ padding: '18px 16px', whiteSpace: 'nowrap', textTransform: 'uppercase', fontWeight: 900 }}>
                                        Status
                                    </th>

                                    {/* Payment Date Column */}
                                    <th style={{ padding: '18px 16px', whiteSpace: 'nowrap', textTransform: 'uppercase', fontWeight: 900 }}>
                                        Payment Date
                                    </th>

                                    {/* Actions Column */}
                                    <th style={{ padding: '18px 16px', textAlign: 'right', minWidth: '160px', textTransform: 'uppercase', fontWeight: 900 }}>
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredVendors.map((vendor, idx) => {
                                    const rowNum = idx + 1;
                                    const rowKey = vendor.id || vendor.vendor_name || String(idx);
                                    const isSelected = !!selectedRows[rowKey];
                                    const isExpanded = !!expandedRows[rowKey];
                                    const selectedProjId = selectedProjectMap[vendor.vendor_name] || (vendor.projects?.[0]?.project_id) || '';
                                    const selectedProj = vendor.projects?.find((p: any) => String(p.project_id) === String(selectedProjId));
                                    const totalAmt = selectedProj ? (parseFloat(selectedProj.total_amount) || 0) : 0;

                                    const displayProjId = selectedProjId ? (String(selectedProjId).startsWith('DC-') ? String(selectedProjId).replace('DC-', 'PR-') : (String(selectedProjId).startsWith('PR-') || String(selectedProjId).startsWith('LVC') ? selectedProjId : `PR-${selectedProjId}`)) : `PR-${rowNum}`;
                                    const refCode = `Ref: VQ-${vendor.id || rowNum}`;

                                    // Status matching
                                    const rawStatus = String(vendor.status || 'PENDING').toUpperCase().trim();
                                    let selectVal = 'PENDING';
                                    let bg = '#fff9f0', fg = '#ea580c', border = '#ffe8c2';

                                    if (rawStatus.includes('PROPOSAL')) {
                                        selectVal = 'PROPOSAL SENT';
                                        bg = '#eff6ff'; fg = '#2563eb'; border = '#bfdbfe';
                                    } else if (rawStatus.includes('APPROV')) {
                                        selectVal = 'APPROVED';
                                        bg = '#f0fdf4'; fg = '#16a34a'; border = '#bbf7d0';
                                    } else if (rawStatus.includes('REJECT')) {
                                        selectVal = 'REJECTED';
                                        bg = '#fef2f2'; fg = '#dc2626'; border = '#fecaca';
                                    } else {
                                        selectVal = 'PENDING';
                                        bg = '#fff9f0'; fg = '#ea580c'; border = '#ffe8c2';
                                    }

                                    return (
                                        <React.Fragment key={`v-frag-${rowKey}-${idx}`}>
                                            <tr style={{
                                                borderBottom: isExpanded ? 'none' : '1px solid #f1f5f9',
                                                backgroundColor: isSelected ? '#fffcf5' : 'transparent',
                                                transition: 'background 0.15s'
                                            }}>
                                                {/* Checkbox */}
                                                <td style={{ padding: '16px' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleSelectRow(rowKey)}
                                                        style={{ cursor: 'pointer', accentColor: '#ea580c' }}
                                                    />
                                                </td>

                                                {/* Row Index */}
                                                <td style={{ padding: '16px 12px', fontWeight: 600, color: '#64748b' }}>
                                                    {rowNum}
                                                </td>

                                                {/* Expand Line Items (+) */}
                                                <td style={{ padding: '16px' }}>
                                                    <button
                                                        onClick={() => toggleExpandRow(rowKey)}
                                                        title="Toggle Line Items Breakdown"
                                                        style={{
                                                            background: isExpanded ? '#fff7ed' : '#f8fafc',
                                                            border: isExpanded ? '1px solid #fed7aa' : '1px solid #e2e8f0',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer',
                                                            fontSize: '0.9rem',
                                                            fontWeight: 700,
                                                            color: isExpanded ? '#ea580c' : '#475569',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            width: '26px',
                                                            height: '26px'
                                                        }}
                                                    >
                                                        {isExpanded ? <Minus size={14} /> : <Plus size={14} />}
                                                    </button>
                                                </td>

                                                {/* Date */}
                                                <td style={{ padding: '16px', fontWeight: 600, color: '#334155', whiteSpace: 'nowrap' }}>
                                                    {formatDate(vendor.created_at)}
                                                </td>

                                                {/* Project ID / Quotation Number */}
                                                <td style={{ padding: '16px', fontWeight: 600, color: '#334155' }}>
                                                    <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>{displayProjId}</div>
                                                    <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b', background: '#fff9f0', border: '1px solid #ffe8c2', padding: '2px 8px', borderRadius: '4px', display: 'inline-block', marginTop: '3px' }}>
                                                        {refCode}
                                                    </span>
                                                    {vendor.projects && vendor.projects.length > 0 && (
                                                        <div style={{ marginTop: '6px' }}>
                                                            <select
                                                                value={selectedProjId}
                                                                onChange={e => handleProjectChange(vendor.vendor_name, e.target.value)}
                                                                style={{
                                                                    padding: '4px 8px', borderRadius: '6px',
                                                                    border: '1px solid #cbd5e1', backgroundColor: '#ffffff',
                                                                    fontWeight: 600, fontSize: '0.78rem', color: '#334155',
                                                                    outline: 'none', cursor: 'pointer', maxWidth: '240px'
                                                                }}
                                                            >
                                                                {vendor.projects.map((p: any) => (
                                                                    <option key={p.project_id} value={p.project_id}>
                                                                        {p.project_name} {p.total_amount ? (' (₹' + Number(p.total_amount).toLocaleString('en-IN') + ')') : ''}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Quoted To (Vendor Name with Circle Initials Avatar) */}
                                                <td style={{ padding: '16px', fontWeight: 600, color: '#0f172a' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        {vendor.photo ? (
                                                            <img src={vendor.photo} alt={vendor.vendor_name} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #fca412' }} />
                                                        ) : (
                                                            <div style={{
                                                                width: '32px',
                                                                height: '32px',
                                                                borderRadius: '50%',
                                                                backgroundColor: '#fff9f0',
                                                                border: '1.5px solid #fca412',
                                                                color: '#0c1527',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                fontSize: '0.75rem',
                                                                fontWeight: 700,
                                                                flexShrink: 0
                                                            }}>
                                                                {(vendor.vendor_name || 'Vendor').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                                                            </div>
                                                        )}
                                                        <div>
                                                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{vendor.vendor_name}</div>
                                                            {vendor.contact_person && (
                                                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
                                                                    👤 {vendor.contact_person} {vendor.phone ? `• 📞 ${vendor.phone}` : ''}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Amount formatted e.g. ₹18,88,623.00 */}
                                                <td style={{ padding: '16px', fontWeight: 600, color: '#0f172a', fontSize: '0.90rem', whiteSpace: 'nowrap' }}>
                                                    {formatINR(totalAmt)}
                                                </td>

                                                {/* Status Dropdown Selector (PENDING, PROPOSAL SENT, APPROVED, REJECTED) */}
                                                <td style={{ padding: '14px 16px' }}>
                                                    <select
                                                        value={selectVal}
                                                        onChange={async (e) => {
                                                            const newStatus = e.target.value;
                                                            if (newStatus === 'APPROVED' && !isAdmin) {
                                                                alert('Access Denied: Only Admin can approve vendor quotations.');
                                                                return;
                                                            }
                                                            const updated = vendors.map(v => {
                                                                if (v.vendor_name === vendor.vendor_name) {
                                                                    const updatedProjs = (v.projects || []).map((p: any) => {
                                                                        if (String(p.project_id) === String(selectedProjId)) {
                                                                            return { ...p, approval_status: newStatus === 'APPROVED' ? 'Approved' : newStatus };
                                                                        }
                                                                        return p;
                                                                    });
                                                                    return { ...v, status: newStatus, approval_status: newStatus, projects: updatedProjs };
                                                                }
                                                                // Automatic competitor rejection trigger on APPROVED
                                                                if (newStatus === 'APPROVED' && selectedProjId && v.projects?.some((p: any) => String(p.project_id) === String(selectedProjId))) {
                                                                    const updatedProjs = (v.projects || []).map((p: any) => {
                                                                        if (String(p.project_id) === String(selectedProjId)) {
                                                                            return { ...p, approval_status: 'Rejected' };
                                                                        }
                                                                        return p;
                                                                    });
                                                                    return { ...v, status: 'REJECTED', approval_status: 'REJECTED', projects: updatedProjs };
                                                                }
                                                                return v;
                                                            });
                                                            setVendors(updated);
                                                            try {
                                                                await axios.put(API_BASE_URL + '/main-vendors', {
                                                                    id: vendor.id,
                                                                    vendor_name: vendor.vendor_name,
                                                                    status: newStatus,
                                                                    project_id: selectedProjId,
                                                                    user_role: user?.role || ''
                                                                }, {
                                                                    headers: {
                                                                        'X-User-Id': user?.user_id || '',
                                                                        'X-User-Role': user?.role || ''
                                                                    }
                                                                });
                                                            } catch (err) {
                                                                console.error('Error updating vendor status:', err);
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
                                                            transition: 'all 0.15s ease'
                                                        }}
                                                    >
                                                        <option value="PENDING" style={{ backgroundColor: '#ffffff', color: '#ea580c' }}>PENDING</option>
                                                        <option value="PROPOSAL SENT" style={{ backgroundColor: '#ffffff', color: '#2563eb' }}>PROPOSAL SENT</option>
                                                        <option value="APPROVED" disabled={!isAdmin} style={{ backgroundColor: '#ffffff', color: !isAdmin ? '#94a3b8' : '#16a34a' }}>
                                                            APPROVED {!isAdmin ? '(Admin Only)' : ''}
                                                        </option>
                                                        <option value="REJECTED" style={{ backgroundColor: '#ffffff', color: '#dc2626' }}>REJECTED</option>
                                                    </select>
                                                </td>

                                                {/* Payment Date */}
                                                <td style={{ padding: '14px 16px', color: '#64748b', fontWeight: 600 }}>
                                                    {vendor.payment_date || '-'}
                                                </td>

                                                {/* Action Icons */}
                                                <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                                                        {/* Preview & Generate Work Order PDF (Eye Symbol) */}
                                                        <button
                                                            onClick={() => handleOpenPdfModal(vendor)}
                                                            title="Preview & Generate Work Order PDF"
                                                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#2563eb', padding: '4px', display: 'flex', alignItems: 'center' }}
                                                        >
                                                            <Eye size={17} color="#2563eb" />
                                                        </button>

                                                        {/* Duplicate Vendor / Quota (Copy Symbol) */}
                                                        <button
                                                            onClick={() => handleOpenDuplicateVendorModal(vendor, selectedProjId)}
                                                            title="Duplicate Vendor / Quotation"
                                                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ea580c', padding: '4px', display: 'flex', alignItems: 'center' }}
                                                        >
                                                            <Copy size={16} color="#ea580c" />
                                                        </button>

                                                        {/* Open Vendor Quota Builder (Edit2 Symbol) */}
                                                        <button
                                                            onClick={() => {
                                                                const firstProj = selectedProjId || (allProjectsList[0]?.project_id || '');
                                                                setBuilderVendor(vendor.vendor_name);
                                                                setBuilderProjectId(firstProj);
                                                                setIsCreateQuotaModalOpen(true);
                                                                if (vendor.vendor_name && firstProj) {
                                                                    loadQuotaScopeForProject(vendor.vendor_name, firstProj);
                                                                }
                                                            }}
                                                            title="Open Vendor Quotation Builder"
                                                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>

                                                        {/* More Options */}
                                                        <div style={{ position: 'relative' }}>
                                                            {activeRowMenu === rowKey && (
                                                                <div 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setActiveRowMenu(null);
                                                                    }}
                                                                    style={{
                                                                        position: 'fixed',
                                                                        top: 0,
                                                                        left: 0,
                                                                        right: 0,
                                                                        bottom: 0,
                                                                        zIndex: 90,
                                                                        background: 'transparent'
                                                                    }}
                                                                />
                                                            )}
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setActiveRowMenu(activeRowMenu === rowKey ? null : rowKey);
                                                                }}
                                                                title="More Actions"
                                                                style={{ 
                                                                    background: activeRowMenu === rowKey ? '#eff6ff' : 'transparent', 
                                                                    border: activeRowMenu === rowKey ? '1.5px solid #2563eb' : 'none', 
                                                                    borderRadius: '6px',
                                                                    cursor: 'pointer', 
                                                                    color: activeRowMenu === rowKey ? '#2563eb' : '#64748b', 
                                                                    padding: '4px',
                                                                    boxShadow: activeRowMenu === rowKey ? '0 0 0 3px rgba(37, 99, 235, 0.15)' : 'none',
                                                                    transition: 'all 0.15s ease',
                                                                    position: 'relative',
                                                                    zIndex: activeRowMenu === rowKey ? 95 : 1
                                                                }}
                                                            >
                                                                <MoreVertical size={16} color={activeRowMenu === rowKey ? '#2563eb' : '#64748b'} />
                                                            </button>

                                                            {activeRowMenu === rowKey && (
                                                                <div 
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    style={{
                                                                        position: 'absolute',
                                                                        right: 0,
                                                                        top: '100%',
                                                                        backgroundColor: '#ffffff',
                                                                        border: '1px solid #cbd5e1',
                                                                        borderRadius: '8px',
                                                                        boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                                                                        zIndex: 100,
                                                                        width: '200px',
                                                                        padding: '4px'
                                                                    }}>
                                                                    <button
                                                                        onClick={() => {
                                                                            setActiveRowMenu(null);
                                                                            handleOpenPdfModal(vendor);
                                                                        }}
                                                                        style={{ width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'transparent', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: '#0f172a', fontWeight: 600 }}
                                                                    >
                                                                        <Printer size={14} color="#ea580c" /> Print / View Work Order
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            setActiveRowMenu(null);
                                                                            handleOpenDuplicateVendorModal(vendor, selectedProjId);
                                                                        }}
                                                                        style={{ width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'transparent', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: '#ea580c', fontWeight: 600 }}
                                                                    >
                                                                        <Copy size={14} color="#ea580c" /> Duplicate Vendor / Quota
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            setActiveRowMenu(null);
                                                                            const firstProj = selectedProjId || (allProjectsList[0]?.project_id || '');
                                                                            setBuilderVendor(vendor.vendor_name);
                                                                            setBuilderProjectId(firstProj);
                                                                            setIsCreateQuotaModalOpen(true);
                                                                            if (vendor.vendor_name && firstProj) {
                                                                                loadQuotaScopeForProject(vendor.vendor_name, firstProj);
                                                                            }
                                                                        }}
                                                                        style={{ width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'transparent', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: '#0f172a', fontWeight: 600 }}
                                                                    >
                                                                        <Edit2 size={14} color="#2563eb" /> Open Quota Builder
                                                                    </button>
                                                                    {isAdmin ? (
                                                                        <button
                                                                            onClick={async () => {
                                                                                setActiveRowMenu(null);
                                                                                const firstProj = selectedProjId || (vendor.projects && vendor.projects[0]?.project_id) || (allProjectsList[0]?.project_id || '');
                                                                                if (!firstProj) {
                                                                                    alert('No project site associated with this quotation');
                                                                                    return;
                                                                                }
                                                                                try {
                                                                                    const res = await axios.post(API_BASE_URL + '/vendor-quotas/send-approval', {
                                                                                        vendor_name: vendor.vendor_name,
                                                                                        project_id: firstProj,
                                                                                        approval_status: 'Approved',
                                                                                        user_role: user?.role || '',
                                                                                        user_id: user?.user_id || ''
                                                                                    }, {
                                                                                        headers: { 'X-User-Id': user?.user_id || '', 'X-User-Role': user?.role || '' }
                                                                                    });
                                                                                    if (res.data?.success) {
                                                                                        alert(res.data.message || 'Vendor Quota approved by Admin and locked for execution!');
                                                                                        fetchVendors();
                                                                                    } else {
                                                                                        alert(res.data?.error || 'Failed to approve quotation');
                                                                                    }
                                                                                } catch (err: any) {
                                                                                    alert(err?.response?.data?.error || 'Error approving quotation');
                                                                                }
                                                                            }}
                                                                            style={{ width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'transparent', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: '#16a34a', fontWeight: 700 }}
                                                                        >
                                                                            <Check size={14} color="#16a34a" /> Approve Quotation (Admin)
                                                                        </button>
                                                                    ) : (
                                                                        <button
                                                                            onClick={async () => {
                                                                                setActiveRowMenu(null);
                                                                                const firstProj = selectedProjId || (vendor.projects && vendor.projects[0]?.project_id) || (allProjectsList[0]?.project_id || '');
                                                                                if (!firstProj) {
                                                                                    alert('No project site associated with this quotation');
                                                                                    return;
                                                                                }
                                                                                try {
                                                                                    const res = await axios.post(API_BASE_URL + '/vendor-quotas/send-approval', {
                                                                                        vendor_name: vendor.vendor_name,
                                                                                        project_id: firstProj,
                                                                                        approval_status: 'Pending Approval',
                                                                                        user_role: user?.role || '',
                                                                                        user_id: user?.user_id || ''
                                                                                    }, {
                                                                                        headers: { 'X-User-Id': user?.user_id || '', 'X-User-Role': user?.role || '' }
                                                                                    });
                                                                                    if (res.data?.success) {
                                                                                        alert(res.data.message || 'Vendor Quota submitted for Admin approval. Notification sent to Admin!');
                                                                                        fetchVendors();
                                                                                    } else {
                                                                                        alert(res.data?.error || 'Failed to send for approval');
                                                                                    }
                                                                                } catch (err: any) {
                                                                                    alert(err?.response?.data?.error || 'Error sending for approval');
                                                                                }
                                                                            }}
                                                                            style={{ width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'transparent', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: '#ea580c', fontWeight: 700 }}
                                                                        >
                                                                            <Send size={14} color="#ea580c" /> Send for Admin Approval
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Expandable Line Item Breakdown Detail Row */}
                                            {isExpanded && (
                                                <tr style={{ backgroundColor: '#fffcf5', borderBottom: '1px solid #f1f5f9' }}>
                                                    <td colSpan={10} style={{ padding: '16px 24px' }}>
                                                        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #fed7aa', padding: '16px', boxShadow: '0 2px 8px rgba(252,164,18,0.06)' }}>
                                                            <div style={{ fontWeight: 800, color: '#0c1527', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                                <span style={{ fontSize: '0.90rem' }}>📦 Assigned Scope &amp; Line Items Breakdown — <strong>{vendor.vendor_name}</strong> ({displayProjId})</span>
                                                                <span style={{ fontSize: '0.78rem', color: '#ea580c', backgroundColor: '#fff7ed', padding: '3px 10px', borderRadius: '6px', border: '1px solid #ffedd5', fontWeight: 700 }}>
                                                                    Version: {vendor.version || 'V1.0'}
                                                                </span>
                                                            </div>
                                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                                                <thead>
                                                                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                                                                        <th style={{ padding: '10px 12px', textAlign: 'left' }}>Particulars / Item Name</th>
                                                                        <th style={{ padding: '10px 12px', textAlign: 'left' }}>Specification / Shutter</th>
                                                                        <th style={{ padding: '10px 12px', textAlign: 'left' }}>Dimensions / Unit</th>
                                                                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>Rate (₹)</th>
                                                                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>Qty</th>
                                                                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total Amount (₹)</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {(selectedProj?.items && selectedProj.items.length > 0 ? selectedProj.items : [
                                                                        { particulars: '18mm HDMR Acrylic Finish Shutters', shutter: '18mm Acrylic', dimensions: '8ft x 4ft', rate: 1500, qty: 2, total: 3000 },
                                                                        { particulars: '18mm BWP Marine Plywood Carcass Unit', shutter: 'BWP Plywood', dimensions: 'As per site', rate: 2200, qty: 1, total: 2200 }
                                                                    ]).map((item: any, iIdx: number) => (
                                                                        <tr key={iIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                                            <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0f172a' }}>{item.particulars || item.item_name || 'Material Item'}</td>
                                                                            <td style={{ padding: '10px 12px', color: '#475569' }}>{item.shutter || item.brand || '—'}</td>
                                                                            <td style={{ padding: '10px 12px', color: '#475569' }}>{item.dimensions || item.unit || 'Standard'}</td>
                                                                            <td style={{ padding: '10px 12px', textAlign: 'right', color: '#334155' }}>{formatINR(item.rate || 0)}</td>
                                                                            <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600 }}>{item.qty || item.quantity || 1}</td>
                                                                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#ea580c' }}>{formatINR(item.total || item.amount || 0)}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
                </div>
            )}

            {/* Combined PDF Modal */}
            {previewModalOpen && createPortal(
                <div className="vendor-quota-pdf-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(248, 246, 240, 0.94)', backdropFilter: 'blur(8px)', zIndex: 2000000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
                    <div className="vendor-quota-pdf-dialog" style={{ backgroundColor: '#ffffff', width: '100%', maxWidth: '900px', maxHeight: '90vh', borderRadius: '20px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>

                        {/* Modal Header */}
                        <div className="no-print" style={{ padding: '16px 24px', backgroundColor: '#0c1527', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <FileText color="#fca412" size={22} />
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Vendor Quotation &amp; Service Agreement PDF</h3>
                                    <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                                        Vendor: <strong style={{ color: '#fca412' }}>{selectedVendorForPdf?.vendor_name}</strong> | Site: <strong>{selectedProjectForPdf?.project_name}</strong>
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <button
                                    onClick={() => window.print()}
                                    style={{
                                        padding: '8px 16px', borderRadius: '8px',
                                        backgroundColor: '#1e293b', color: '#ffffff',
                                        border: '1px solid #334155', fontWeight: 700, fontSize: '0.85rem',
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                                    }}
                                >
                                    <Printer size={16} />
                                    Print
                                </button>
                                <button
                                    onClick={handleDownloadCombinedPdf}
                                    disabled={generatingPdf || loadingPdfItems}
                                    style={{
                                        padding: '8px 18px', borderRadius: '8px',
                                        backgroundColor: '#fca412', color: '#ffffff',
                                        border: 'none', fontWeight: 800, fontSize: '0.85rem',
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                                        boxShadow: '0 4px 12px rgba(252,164,18,0.35)'
                                    }}
                                >
                                    {generatingPdf ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                                    Download PDF
                                </button>
                                <button onClick={() => setPreviewModalOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}>
                                    <X size={22} />
                                </button>
                            </div>
                        </div>                        {/* Column Hide / Show Controls Bar */}
                        <div className="no-print" style={{ backgroundColor: '#fff9f0', borderBottom: '1px solid #ffe8c2', padding: '10px 24px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px', fontSize: '0.80rem' }}>
                            <div style={{ fontWeight: 800, color: '#0c1527', display: 'flex', alignItems: 'center', gap: '6px', marginRight: '4px' }}>
                                <Eye size={15} color="#fca412" /> Print Columns:
                            </div>
                            {[
                                { key: 'particulars', label: 'Particulars' },
                                { key: 'shutter', label: 'Shutter Material' },
                                { key: 'carcass', label: 'Carcass Material' },
                                { key: 'dimensions', label: 'Dimensions' },
                                { key: 'rate', label: 'Rate (₹)' },
                                { key: 'qty', label: 'Qty' },
                                { key: 'discount', label: 'Disc %' },
                                { key: 'gst', label: 'GST %' },
                                { key: 'total', label: 'Total (₹)' },
                                { key: 'service_agreement', label: '📜 Service Agreement (16 Clauses)' },
                            ].map((col) => (
                                <label key={col.key} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer', userSelect: 'none', color: columnVisibility[col.key] ? '#0c1527' : '#94a3b8', fontWeight: columnVisibility[col.key] ? 700 : 500 }}>
                                    <input
                                        type="checkbox"
                                        checked={columnVisibility[col.key]}
                                        onChange={(e) => setColumnVisibility(prev => ({ ...prev, [col.key]: e.target.checked }))}
                                        style={{ accentColor: '#fca412', cursor: 'pointer' }}
                                    />
                                    {col.label}
                                </label>
                            ))}

                            {columnVisibility.service_agreement && (
                                <button
                                    type="button"
                                    onClick={() => setIsEditingClauses(!isEditingClauses)}
                                    style={{
                                        marginLeft: 'auto',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '5px 12px',
                                        borderRadius: '6px',
                                        border: '1px solid #fca412',
                                        backgroundColor: isEditingClauses ? '#fca412' : '#ffffff',
                                        color: isEditingClauses ? '#ffffff' : '#0c1527',
                                        fontWeight: 800,
                                        fontSize: '0.78rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <Edit2 size={13} /> {isEditingClauses ? '✓ Done Editing Clauses' : '✏️ Edit Agreement Clauses'}
                                </button>
                            )}
                        </div>

                        {/* Modal Body - PDF Document Content */}
                        <div className="vendor-quota-pdf-body" style={{ flex: 1, overflowY: 'auto', padding: '0px', backgroundColor: '#ffffff' }}>
                            {loadingPdfItems ? (
                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '100px', color: '#0c1527' }}>
                                    <Loader2 className="animate-spin" size={40} color="#fca412" />
                                </div>
                            ) : (
                                <div ref={pdfContainerRef} className="printable-vendor-quota" style={{ backgroundColor: '#ffffff', width: '100%', padding: '24px', boxSizing: 'border-box', boxShadow: 'none', fontFamily: 'Arial, Helvetica, sans-serif', lineHeight: 1.6 }}>
                                    <style>{PRINT_STYLES}</style>

                                    {/* ── PAGE 1: EXECUTIVE COVER PAGE (COVER PAGE ONLY) ── */}
                                    <div className="vendor-quota-cover-page" style={{ minHeight: '270mm', height: '270mm', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backgroundColor: '#ffffff', padding: '16px 12px 20px 12px', position: 'relative', boxSizing: 'border-box', pageBreakAfter: 'always', breakAfter: 'page', marginBottom: '0' }}>
                                        {/* Top Header */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2.5px solid #ea580c', paddingBottom: '14px', marginBottom: '24px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                                <img src={liveLogo} alt="Logo" style={{ height: '50px', objectFit: 'contain' }} />
                                                <div>
                                                    <div style={{ fontSize: '15pt', fontWeight: 900, color: '#000000', marginBottom: '2px' }}>Livincart Private Limited</div>
                                                    <div style={{ fontSize: '8pt', color: '#64748b', fontWeight: 500 }}>Official Vendor Work Order &amp; Service Agreement Workspace</div>
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '9.5pt', fontWeight: 900, color: '#000000', marginBottom: '4px' }}>LIVINCART AND SERVICES PRIVATE LIMITED</div>
                                                <div style={{ fontSize: '7.5pt', color: '#475569', fontWeight: 600, marginTop: '4px' }}>
                                                    <span style={{ marginRight: '10px' }}>📍 Visakhapatnam, Andhra Pradesh – 530020</span>
                                                    <span>📞 +91 7702312351</span>
                                                </div>
                                                <div style={{ fontSize: '7.5pt', color: '#475569', fontWeight: 600, marginTop: '2px' }}>
                                                    <span style={{ marginRight: '10px' }}>✉️ contact@livincart.com</span>
                                                    <span>🌐 www.livincart.com</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Center Hero Block */}
                                        <div style={{ textAlign: 'center', margin: 'auto 0' }}>
                                            <img src={liveLogo} alt="Logo Center" style={{ height: '85px', objectFit: 'contain', marginBottom: '16px' }} />
                                            <div style={{ fontSize: '13pt', fontWeight: 900, color: '#000000', marginBottom: '10px' }}>LIVINCART AND SERVICES PRIVATE LIMITED</div>
                                            <div style={{ width: '160px', height: '0px', borderBottom: '3.5px solid #ea580c', margin: '10px auto 26px' }} />

                                            <h1 style={{ margin: 0, fontSize: '22pt', fontWeight: 900, color: '#000000' }}>OFFICIAL WORK ORDER &amp;</h1>
                                            <h1 style={{ margin: '6px 0 0 0', fontSize: '24pt', fontWeight: 900, color: '#ea580c' }}>
                                                VENDOR MATERIAL QUOTA
                                            </h1>
                                            <div style={{ width: '200px', height: '0px', borderBottom: '3.5px solid #ea580c', margin: '14px auto 30px' }} />

                                            {/* Details Box */}
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '28px', border: '2px solid #ea580c', borderRadius: '16px', padding: '16px 36px', backgroundColor: '#ffffff' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <span style={{ fontSize: '18pt' }}>🏢</span>
                                                    <div style={{ textAlign: 'left' }}>
                                                        <div style={{ fontSize: '8.5pt', color: '#64748b', fontWeight: 600 }}>Vendor Entity</div>
                                                        <div style={{ fontSize: '11pt', fontWeight: 900, color: '#000000', whiteSpace: 'nowrap' }}>{selectedVendorForPdf?.vendor_name || 'Vendor Entity'}</div>
                                                    </div>
                                                </div>
                                                <div style={{ width: '1.5px', height: '34px', backgroundColor: '#fed7aa' }} />
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <span style={{ fontSize: '18pt' }}>📋</span>
                                                    <div style={{ textAlign: 'left' }}>
                                                        <div style={{ fontSize: '8.5pt', color: '#64748b', fontWeight: 600 }}>Project / Site Ref</div>
                                                        <div style={{ fontSize: '11pt', fontWeight: 900, color: '#000000', whiteSpace: 'nowrap' }}>{selectedProjectForPdf?.client_id || selectedProjectForPdf?.project_id || 'PR-101'}</div>
                                                    </div>
                                                </div>
                                                <div style={{ width: '1.5px', height: '34px', backgroundColor: '#fed7aa' }} />
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <span style={{ fontSize: '18pt' }}>📅</span>
                                                    <div style={{ textAlign: 'left' }}>
                                                        <div style={{ fontSize: '8.5pt', color: '#64748b', fontWeight: 600 }}>Date</div>
                                                        <div style={{ fontSize: '11pt', fontWeight: 900, color: '#000000', whiteSpace: 'nowrap' }}>{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Bottom Contact Card */}
                                        <div style={{ border: '2px solid #ea580c', borderRadius: '16px', backgroundColor: '#ffffff', overflow: 'hidden' }}>
                                            <div style={{ backgroundColor: '#ea580c', padding: '14px 24px', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '9pt', fontWeight: 800 }}>
                                                    📍 Visakhapatnam, Andhra Pradesh 530020
                                                </div>
                                                <div style={{ width: '1.5px', height: '18px', backgroundColor: '#ffffff' }} />
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '9pt', fontWeight: 800 }}>
                                                    📞 +91 7702312351
                                                </div>
                                                <div style={{ width: '1.5px', height: '18px', backgroundColor: '#ffffff' }} />
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '9pt', fontWeight: 800 }}>
                                                    ✉️ contact@livincart.com
                                                </div>
                                            </div>
                                            <div style={{ backgroundColor: '#fff7ed', padding: '12px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-around', borderTop: '1.5px solid #fed7aa' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '9.5pt', fontWeight: 900, color: '#0f172a' }}>
                                                    <span style={{ color: '#ea580c' }}>🌐</span> www.livincart.com
                                                </div>
                                                <div style={{ width: '1.5px', height: '20px', backgroundColor: '#fed7aa' }} />
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '9.5pt', fontWeight: 900, color: '#0f172a' }}>
                                                    <span style={{ color: '#ea580c' }}>👤</span> Livincart Procurement Division
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* ── PART 1: Vendor Quota Document Header & BOQ Table ── */}
                                    <div className="vendor-quota-part1">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #0c1527', paddingBottom: '20px', marginBottom: '24px' }}>
                                            <div>
                                                <img src={liveLogo} alt="LivinCart" style={{ height: '50px', objectFit: 'contain', marginBottom: '8px' }} />
                                                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>LivinCart and Services Private Limited</div>
                                                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Visakhapatnam, Andhra Pradesh</div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0c1527', textTransform: 'uppercase' }}>VENDOR MATERIAL QUOTATION</div>
                                                <div style={{ fontSize: '0.85rem', color: '#fca412', fontWeight: 800, marginTop: '4px' }}>REF: VQ-{selectedProjectForPdf?.project_id}-{Date.now().toString().slice(-4)}</div>
                                                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>Date: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                                            </div>
                                        </div>

                                        {/* Vendor & Project Details Grid */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', marginBottom: '24px', backgroundColor: '#fff9f0', padding: '16px 20px', borderRadius: '12px', border: '1.5px solid #ffe8c2' }}>
                                            <div>
                                                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#fca412', textTransform: 'uppercase', marginBottom: '4px' }}>VENDOR DETAILS:</div>
                                                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0c1527' }}>{selectedVendorForPdf?.vendor_name}</div>
                                                {selectedVendorForPdf?.phone && <div style={{ fontSize: '0.8rem', color: '#475569' }}>Phone: {selectedVendorForPdf.phone}</div>}
                                                {selectedVendorForPdf?.address && <div style={{ fontSize: '0.8rem', color: '#475569' }}>Address: {selectedVendorForPdf.address}</div>}
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#fca412', textTransform: 'uppercase', marginBottom: '4px' }}>PROJECT DETAILS:</div>
                                                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0c1527' }}>{selectedProjectForPdf?.project_name}</div>
                                                <div style={{ fontSize: '0.8rem', color: '#475569' }}>Project ID: {selectedProjectForPdf?.client_id || selectedProjectForPdf?.project_id}</div>
                                                <div style={{ fontSize: '0.8rem', color: '#475569' }}>Type: {selectedProjectForPdf?.project_type || 'Interior Project'}</div>
                                            </div>
                                        </div>

                                        {/* Items Table / Modules */}
                                        <div style={{ marginBottom: '24px' }}>
                                            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0c1527', marginBottom: '10px', textTransform: 'uppercase' }}>Scope of Supplies / Material Details</div>
                                            
                                            {pdfModules && pdfModules.length > 0 ? (
                                                pdfModules.map((mod: any, modIdx: number) => {
                                                    const modTotal = (mod.items || []).reduce((sum: number, it: any) => sum + (it.total || it.amount || 0), 0);
                                                    return (
                                                        <div key={modIdx} style={{ marginBottom: '24px', border: '1.5px solid #fed7aa', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                                                            <div style={{ backgroundColor: '#fff4e6', color: '#0c1527', padding: '10px 16px', fontWeight: 800, fontSize: '0.92rem', display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #ea580c', borderLeft: '4px solid #ea580c' }}>
                                                                <span>Module {modIdx + 1}: {mod.name}</span>
                                                                <span style={{ color: '#ea580c', fontWeight: 900 }}>Total Value: ₹{modTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                                            </div>
                                                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
                                                                <thead>
                                                                    <tr style={{ backgroundColor: 'rgb(254, 143, 62)', color: '#ffffff' }}>
                                                                        <th style={{ padding: '10px 12px', fontWeight: 800, width: '35px' }}>#</th>
                                                                        {columnVisibility.particulars && <th style={{ padding: '10px 12px', fontWeight: 800 }}>{columnHeadings.particulars}</th>}
                                                                        {columnVisibility.shutter && <th style={{ padding: '10px 12px', fontWeight: 800 }}>{columnHeadings.shutter}</th>}
                                                                        {columnVisibility.carcass && <th style={{ padding: '10px 12px', fontWeight: 800 }}>{columnHeadings.carcass}</th>}
                                                                        {columnVisibility.dimensions && <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'center' }}>{columnHeadings.dimensions}</th>}
                                                                        {columnVisibility.rate && <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'right' }}>{columnHeadings.rate}</th>}
                                                                        {columnVisibility.qty && <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'center' }}>{columnHeadings.qty}</th>}
                                                                        {columnVisibility.discount && <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'center' }}>{columnHeadings.discount}</th>}
                                                                        {columnVisibility.total && <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'right' }}>{columnHeadings.total}</th>}
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {mod.items.map((it: any, itemIdx: number) => {
                                                                        if (it.is_subtitle) {
                                                                            return (
                                                                                <tr key={itemIdx} style={{ backgroundColor: '#fff7ed', borderLeft: '4px solid #ea580c', borderBottom: '1px solid #fed7aa' }}>
                                                                                    <td colSpan={10} style={{ padding: '8px 12px', fontWeight: 900, color: '#c2410c', fontSize: '0.86rem' }}>
                                                                                        📌 {it.particulars}
                                                                                    </td>
                                                                                </tr>
                                                                            );
                                                                        }
                                                                        return (
                                                                            <tr key={itemIdx} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: itemIdx % 2 === 0 ? '#ffffff' : '#fcfbf8' }}>
                                                                                <td style={{ padding: '10px 12px', fontWeight: 700, color: '#64748b' }}>{itemIdx + 1}</td>
                                                                                {columnVisibility.particulars && (
                                                                                    <td style={{ padding: '10px 12px' }}>
                                                                                        <div style={{ fontWeight: 800, color: '#0c1527' }}>{it.particulars || '—'}</div>
                                                                                        {it.description && (
                                                                                            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px', whiteSpace: 'pre-line', fontWeight: 500 }}>
                                                                                                {it.description}
                                                                                            </div>
                                                                                        )}
                                                                                    </td>
                                                                                )}
                                                                                {columnVisibility.shutter && <td style={{ padding: '10px 12px', color: '#475569' }}>{it.shutter || '—'}</td>}
                                                                                {columnVisibility.carcass && <td style={{ padding: '10px 12px', color: '#475569' }}>{it.carcass || '—'}</td>}
                                                                                {columnVisibility.dimensions && (
                                                                                    <td style={{ padding: '10px 12px', textAlign: 'center', color: '#334155' }}>
                                                                                        <div>{it.dimensions || '—'}</div>
                                                                                        {(() => {
                                                                                            const sqft = computeSqft(it.dim_w || it.width, it.dim_h || it.height, it.dim_d || it.depth) || parseFloat(it.sft || it.sqft || '0');
                                                                                            return sqft > 0 ? (
                                                                                                <div style={{ fontSize: '0.72rem', color: '#ea580c', fontWeight: 800, marginTop: '2px' }}>
                                                                                                    ({sqft.toFixed(2)} SFT)
                                                                                                </div>
                                                                                            ) : null;
                                                                                        })()}
                                                                                    </td>
                                                                                )}
                                                                                {columnVisibility.rate && <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>₹{(it.rate || 0).toLocaleString('en-IN')}</td>}
                                                                                {columnVisibility.qty && <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700 }}>{it.qty || 1}</td>}
                                                                                {columnVisibility.discount && <td style={{ padding: '10px 12px', textAlign: 'center', color: '#ef4444' }}>{it.discount ? (it.discount + '%') : '—'}</td>}
                                                                                {columnVisibility.total && <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 900, color: '#0c1527' }}>₹{(it.total || 0).toLocaleString('en-IN')}</td>}
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                    <tr style={{ backgroundColor: '#fff7ed', borderTop: '2px solid #fed7aa', fontWeight: 800 }}>
                                                                        <td colSpan={8} style={{ padding: '10px 12px', textAlign: 'right', color: '#c2410c', fontSize: '0.88rem' }}>
                                                                            Module {modIdx + 1} ({mod.name}) Subtotal:
                                                                        </td>
                                                                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#ea580c', fontWeight: 900, fontSize: '0.95rem' }}>
                                                                            ₹{modTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                                        </td>
                                                                    </tr>
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                                                    <thead>
                                                        <tr style={{ backgroundColor: 'rgb(254, 143, 62)', color: '#ffffff' }}>
                                                            <th style={{ padding: '10px 12px', fontWeight: 800, width: '35px' }}>#</th>
                                                            {columnVisibility.particulars && <th style={{ padding: '10px 12px', fontWeight: 800, width: '25%' }}>Product Description / Particulars</th>}
                                                            {columnVisibility.shutter && <th style={{ padding: '10px 12px', fontWeight: 800 }}>Shutter Material</th>}
                                                            {columnVisibility.carcass && <th style={{ padding: '10px 12px', fontWeight: 800 }}>Carcass Material</th>}
                                                            {columnVisibility.dimensions && <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'center' }}>Dimensions (W × H × D)</th>}
                                                            {columnVisibility.rate && <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'right' }}>Rate (₹)</th>}
                                                            {columnVisibility.qty && <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'center' }}>Qty</th>}
                                                            {columnVisibility.discount && <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'center' }}>Disc %</th>}
                                                            {columnVisibility.gst && <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'center' }}>GST %</th>}
                                                            {columnVisibility.total && <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'right' }}>Total (₹)</th>}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {pdfItems.length === 0 ? (
                                                            <tr>
                                                                <td colSpan={10} style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                                                                    No line items recorded for this vendor on this project.
                                                                </td>
                                                            </tr>
                                                        ) : (
                                                            pdfItems.map((item, i) => (
                                                                <tr key={i} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                                                    <td style={{ padding: '10px 12px', fontWeight: 700, color: '#64748b' }}>{i + 1}</td>
                                                                    {columnVisibility.particulars && (
                                                                        <td style={{ padding: '10px 12px' }}>
                                                                            <div style={{ fontWeight: 800, color: '#0c1527' }}>{item.particulars}</div>
                                                                            {item.description && item.description !== item.particulars && (
                                                                                <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: '2px', whiteSpace: 'pre-line' }}>{item.description}</div>
                                                                            )}
                                                                        </td>
                                                                    )}
                                                                    {columnVisibility.shutter && <td style={{ padding: '10px 12px', color: '#475569' }}>{item.brand || '—'}</td>}
                                                                    {columnVisibility.carcass && <td style={{ padding: '10px 12px', color: '#475569' }}>{item.unit || '—'}</td>}
                                                                    {columnVisibility.dimensions && (
                                                                        <td style={{ padding: '10px 12px', textAlign: 'center', color: '#334155' }}>
                                                                            {item.pricing_mode === 'lumpsum' || (!item.width && !item.height && !item.sft) ? (
                                                                                <span style={{ color: '#16a34a', fontWeight: 800, backgroundColor: '#f0fdf4', padding: '2px 6px', borderRadius: '4px', border: '1px solid #bbf7d0', fontSize: '0.76rem' }}>
                                                                                    Lumpsum
                                                                                </span>
                                                                            ) : (
                                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', alignItems: 'center', fontSize: '0.78rem', lineHeight: 1.2 }}>
                                                                                    {item.width && <div>W: {item.width}</div>}
                                                                                    {item.height && <div>H: {item.height}</div>}
                                                                                    {item.depth ? <div>D: {item.depth}</div> : (item.sft && !item.sqft && <div>D: {item.sft}</div>)}
                                                                                    {(() => {
                                                                                        const sqft = computeSqft(item.width, item.height, item.depth || item.sft) || parseFloat(item.sqft || item.sft || '0');
                                                                                        return sqft > 0 ? (
                                                                                            <span style={{ fontSize: '0.70rem', color: '#ea580c', fontWeight: 800, backgroundColor: '#fff7ed', padding: '1px 6px', borderRadius: '3px', border: '1px solid #fed7aa', marginTop: '2px' }}>
                                                                                                {sqft.toFixed(2)} SFT
                                                                                            </span>
                                                                                        ) : null;
                                                                                    })()}
                                                                                </div>
                                                                            )}
                                                                        </td>
                                                                    )}
                                                                    {columnVisibility.rate && <td style={{ padding: '10px 12px', textAlign: 'right' }}>₹{(item.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>}
                                                                    {columnVisibility.qty && <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700 }}>{item.quantity || 1}</td>}
                                                                    {columnVisibility.discount && <td style={{ padding: '10px 12px', textAlign: 'center' }}>{item.discount ?? 0}%</td>}
                                                                    {columnVisibility.gst && <td style={{ padding: '10px 12px', textAlign: 'center' }}>{item.gst ?? 18}%</td>}
                                                                    {columnVisibility.total && <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#0c1527' }}>₹{(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>}
                                                                </tr>
                                                            ))
                                                        )}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>

                                        {/* Total Calculation Card */}
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '30px' }}>
                                            <div style={{ width: '320px', backgroundColor: '#fff9f0', padding: '16px 20px', borderRadius: '12px', border: '1.5px solid #ffe8c2' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.9rem', color: '#475569' }}>
                                                    <span>Sub Total:</span>
                                                    <span style={{ fontWeight: 700 }}>₹{totalAmountSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '1.1rem', fontWeight: 900, color: '#0c1527', borderTop: '2px solid #ffe8c2', marginTop: '4px' }}>
                                                    <span>Grand Total:</span>
                                                    <span style={{ color: '#fca412' }}>₹{totalAmountSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* ── PART 2A: General Terms & Conditions ── */}
                                        {columnVisibility.general_terms && (
                                            <div className="print-page-break" style={{ pageBreakBefore: 'always', breakBefore: 'page', paddingTop: '20px', borderTop: '3px solid #0c1527', marginBottom: '30px' }}>
                                                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                                                    <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0c1527', textTransform: 'uppercase', marginBottom: '4px' }}>
                                                        GENERAL TERMS &amp; CONDITIONS
                                                    </h2>
                                                    <div style={{ fontSize: '0.82rem', color: '#ea580c', fontWeight: 700 }}>
                                                        Commercial Terms, Validity, Payment Milestones &amp; Warranty Guidelines
                                                    </div>
                                                </div>
                                                <div style={{ display: 'grid', gap: '12px', fontSize: '0.84rem', color: '#334155' }}>
                                                    {generalTermsList.map((term, index) => (
                                                        <div key={index} style={{ backgroundColor: isEditingClauses ? '#fff9f0' : '#fff7ed', padding: '12px 16px', borderRadius: '8px', border: isEditingClauses ? '1px dashed #fed7aa' : '1px solid #fed7aa' }}>
                                                            {isEditingClauses ? (
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                        <input
                                                                            type="text"
                                                                            value={term.title}
                                                                            onChange={(e) => {
                                                                                const updated = [...generalTermsList];
                                                                                updated[index].title = e.target.value;
                                                                                setGeneralTermsList(updated);
                                                                            }}
                                                                            style={{ fontWeight: 800, fontSize: '0.90rem', color: '#0c1527', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', width: '80%' }}
                                                                        />
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setGeneralTermsList(generalTermsList.filter((_, i) => i !== index))}
                                                                            style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem' }}
                                                                        >
                                                                            🗑️ Delete Term
                                                                        </button>
                                                                    </div>
                                                                    <textarea
                                                                        rows={2}
                                                                        value={term.content}
                                                                        onChange={(e) => {
                                                                            const updated = [...generalTermsList];
                                                                            updated[index].content = e.target.value;
                                                                            setGeneralTermsList(updated);
                                                                        }}
                                                                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.84rem', lineHeight: 1.5, boxSizing: 'border-box' }}
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <div style={{ fontWeight: 800, color: '#0c1527', fontSize: '0.90rem', marginBottom: '4px' }}>{term.title}</div>
                                                                    <div style={{ whiteSpace: 'pre-line', color: '#475569' }}>{term.content}</div>
                                                                </>
                                                            )}
                                                        </div>
                                                    ))}
                                                    {isEditingClauses && (
                                                        <div style={{ textAlign: 'center', marginTop: '10px' }}>
                                                            <button
                                                                type="button"
                                                                onClick={() => setGeneralTermsList([...generalTermsList, { title: (generalTermsList.length + 1) + '. Custom Term', content: 'Enter general term details here...' }])}
                                                                style={{ padding: '6px 16px', backgroundColor: '#ea580c', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 800, fontSize: '0.80rem', cursor: 'pointer' }}
                                                            >
                                                                + Add General Term
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* ── PART 2B: Attached Vendor Service Agreement Document (Clauses) ── */}
                                    {columnVisibility.service_agreement && (
                                        <div className="vendor-agreement-page page-break-before" style={{ pageBreakBefore: 'always', breakBefore: 'page', position: 'relative', display: 'block', clear: 'both', paddingTop: '20px', borderTop: '4px solid #0c1527' }}>
                                            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                                                <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0c1527', textTransform: 'uppercase', marginBottom: '4px' }}>
                                                    LIVINCART VENDOR SERVICE AGREEMENT
                                                </h2>
                                                <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>
                                                    Master Terms &amp; Conditions Governing Work Orders &amp; Material Deliveries (Clauses 1 to {clausesList.length})
                                                </div>
                                            </div>

                                            <div style={{ fontSize: '0.84rem', color: '#334155', lineHeight: 1.6 }}>
                                                {clausesList.map((clause, index) => {
                                                    const formattedContent = clause.content
                                                        .replace('{VENDOR}', selectedVendorForPdf?.vendor_name || 'Vendor')
                                                        .replace('{PROJECT}', selectedProjectForPdf?.project_name || 'Project');

                                                    return (
                                                        <div key={index} style={{ marginBottom: '16px', backgroundColor: isEditingClauses ? '#fff9f0' : 'transparent', padding: isEditingClauses ? '12px' : '0', borderRadius: '8px', border: isEditingClauses ? '1px dashed #ffe8c2' : 'none' }}>
                                                            {isEditingClauses ? (
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                        <input
                                                                            type="text"
                                                                            value={clause.title}
                                                                            onChange={(e) => {
                                                                                const updated = [...clausesList];
                                                                                updated[index].title = e.target.value;
                                                                                setClausesList(updated);
                                                                            }}
                                                                            style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0c1527', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', width: '80%' }}
                                                                        />
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                const updated = clausesList.filter((_, i) => i !== index);
                                                                                setClausesList(updated);
                                                                            }}
                                                                            style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem' }}
                                                                        >
                                                                            🗑️ Remove Clause
                                                                        </button>
                                                                    </div>
                                                                    <textarea
                                                                        rows={4}
                                                                        value={clause.content}
                                                                        onChange={(e) => {
                                                                            const updated = [...clausesList];
                                                                            updated[index].content = e.target.value;
                                                                            setClausesList(updated);
                                                                        }}
                                                                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.84rem', lineHeight: 1.5, boxSizing: 'border-box' }}
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <h4 style={{ color: '#0c1527', fontWeight: 800, fontSize: '0.95rem', margin: '0 0 4px 0' }}>{clause.title}</h4>
                                                                    <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{formattedContent}</p>
                                                                </>
                                                            )}
                                                        </div>
                                                    );
                                        })}

                                                {isEditingClauses && (
                                                    <div style={{ textAlign: 'center', marginTop: '16px', marginBottom: '24px' }}>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setClausesList([...clausesList, { title: (clausesList.length + 1) + '. Custom Clause Title', content: 'Enter custom clause conditions here...' }]);
                                                            }}
                                                            style={{ padding: '8px 20px', backgroundColor: '#0c1527', color: '#fca412', border: 'none', borderRadius: '8px', fontWeight: 800, fontSize: '0.84rem', cursor: 'pointer' }}
                                                        >
                                                            + Add Custom Clause
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Execution Signatures */}
                                            <div style={{ marginTop: '40px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '40px', borderTop: '2px dashed #cbd5e1', paddingTop: '30px' }}>
                                                <div>
                                                    <div style={{ fontWeight: 800, color: '#0c1527', fontSize: '0.9rem' }}>For LivinCart and Services Pvt. Ltd.</div>
                                                    <div style={{ height: '65px', display: 'flex', alignItems: 'center', margin: '6px 0' }}>
                                                        <img src={liveCartSignature} alt="LivinCart Signature" style={{ height: '55px', objectFit: 'contain' }} />
                                                    </div>
                                                    <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700 }}>Authorized Signatory</div>
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 800, color: '#0c1527', fontSize: '0.9rem' }}>For Vendor ({selectedVendorForPdf?.vendor_name})</div>
                                                    <div style={{ height: '65px', display: 'flex', alignItems: 'center', margin: '6px 0' }}>
                                                        <div style={{ fontStyle: 'italic', color: '#94a3b8', fontSize: '0.8rem' }}>Signed Electronically / Verified</div>
                                                    </div>
                                                    <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700 }}>Authorized Signatory / Partner</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* CREATE MAIN VENDOR POPUP MODAL */}
            {isCreateMainVendorModalOpen && createPortal(
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 999999,
                    padding: '20px'
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '16px',
                        width: '100%',
                        maxWidth: '650px',
                        maxHeight: '90vh',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
                        border: '1px solid #cbd5e1'
                    }}>
                        <div style={{ padding: '20px 24px', backgroundColor: '#0c1527', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTopLeftRadius: '16px', borderTopRightRadius: '16px', flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Store size={22} style={{ color: '#ea580c' }} />
                                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Register New Main Vendor</h3>
                            </div>
                            <button type="button" onClick={() => setIsCreateMainVendorModalOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <X size={22} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateMainVendorSubmit} style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Vendor Name *</label>
                                    <input
                                        type="text"
                                        required
                                        value={mainVendorForm.vendor_name}
                                        onChange={(e) => setMainVendorForm({ ...mainVendorForm, vendor_name: e.target.value })}
                                        placeholder="e.g. Master Carpenter &amp; Woodworks Pvt Ltd"
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Category / Vendor Type</label>
                                    <select
                                        value={mainVendorForm.category}
                                        onChange={(e) => setMainVendorForm({ ...mainVendorForm, category: e.target.value })}
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', backgroundColor: '#fff', boxSizing: 'border-box' }}
                                    >
                                        <option value="Main Vendor">Main Vendor</option>
                                        <option value="Interior Work Order Vendor">Interior Work Order Vendor</option>
                                        <option value="Furniture Work Order Vendor">Furniture Work Order Vendor</option>
                                        <option value="Turnkey Execution Partner">Turnkey Execution Partner</option>
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Contact Person Name</label>
                                    <input
                                        type="text"
                                        value={mainVendorForm.contact_person}
                                        onChange={(e) => setMainVendorForm({ ...mainVendorForm, contact_person: e.target.value })}
                                        placeholder="e.g. Rajesh Kumar"
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Phone Number</label>
                                    <input
                                        type="text"
                                        value={mainVendorForm.phone}
                                        onChange={(e) => setMainVendorForm({ ...mainVendorForm, phone: e.target.value })}
                                        placeholder="+91 9876543210"
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Email Address</label>
                                    <input
                                        type="email"
                                        value={mainVendorForm.email}
                                        onChange={(e) => setMainVendorForm({ ...mainVendorForm, email: e.target.value })}
                                        placeholder="vendor@company.com"
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                                    />
                                </div>

                                <div style={{ gridColumn: 'span 2' }}>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Address</label>
                                    <textarea
                                        rows={2}
                                        value={mainVendorForm.address}
                                        onChange={(e) => setMainVendorForm({ ...mainVendorForm, address: e.target.value })}
                                        placeholder="Principal Place of Business address..."
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>GST Number</label>
                                    <input
                                        type="text"
                                        value={mainVendorForm.gst_number}
                                        onChange={(e) => setMainVendorForm({ ...mainVendorForm, gst_number: e.target.value })}
                                        placeholder="37AAAAA0000A1Z5"
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>PAN Card Number</label>
                                    <input
                                        type="text"
                                        value={mainVendorForm.pan_number}
                                        onChange={(e) => setMainVendorForm({ ...mainVendorForm, pan_number: e.target.value })}
                                        placeholder="ABCDE1234F"
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                                    />
                                </div>

                                <div style={{ gridColumn: 'span 2' }}>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Aadhar Card Number</label>
                                    <input
                                        type="text"
                                        value={mainVendorForm.aadhar_number}
                                        onChange={(e) => setMainVendorForm({ ...mainVendorForm, aadhar_number: e.target.value })}
                                        placeholder="1234 5678 9012"
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                                    />
                                </div>

                                <div style={{ gridColumn: 'span 2' }}>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Vendor Photo / Logo</label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onloadend = () => {
                                                    setMainVendorPhotoPreview(reader.result as string);
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                        style={{ width: '100%', fontSize: '0.84rem' }}
                                    />
                                    {mainVendorPhotoPreview && (
                                        <img src={mainVendorPhotoPreview} alt="Preview" style={{ height: '50px', objectFit: 'cover', marginTop: '8px', borderRadius: '6px' }} />
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                                <button
                                    type="button"
                                    onClick={() => setIsCreateMainVendorModalOpen(false)}
                                    style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontWeight: 700, cursor: 'pointer' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creatingMainVendor}
                                    style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', backgroundColor: '#ea580c', color: '#ffffff', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                >
                                    {creatingMainVendor ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                    Save Main Vendor
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* DEDICATED DUPLICATE VENDOR & QUOTATION MODAL */}
            {showDuplicateVendorModal && duplicateSourceVendor && createPortal(
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(12, 21, 39, 0.72)',
                    backdropFilter: 'blur(5px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 99999,
                    padding: '16px'
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '16px',
                        maxWidth: '620px',
                        width: '100%',
                        maxHeight: '92vh',
                        overflowY: 'auto',
                        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35)',
                        border: '1.5px solid #fed7aa',
                        position: 'relative'
                    }}>
                        {/* Header */}
                        <div style={{
                            padding: '18px 24px',
                            backgroundColor: '#0c1527',
                            borderBottom: '3px solid #fca412',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            borderTopLeftRadius: '14px',
                            borderTopRightRadius: '14px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                    padding: '8px',
                                    backgroundColor: '#fca412',
                                    borderRadius: '10px',
                                    color: '#0c1527',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <Copy size={20} color="#0c1527" />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.18rem', fontWeight: 800, color: '#ffffff' }}>
                                        Duplicate Vendor &amp; Quotation
                                    </h3>
                                    <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                                        Clone vendor profile, copy quotation scope, or duplicate to another project site
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowDuplicateVendorModal(false)}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleConfirmDuplicateVendor} style={{ padding: '24px' }}>
                            {/* Source Overview Info Banner */}
                            <div style={{
                                backgroundColor: '#fff7ed',
                                border: '1.5px solid #fed7aa',
                                borderRadius: '12px',
                                padding: '14px 16px',
                                marginBottom: '20px'
                            }}>
                                <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 900, color: '#c2410c', letterSpacing: '0.5px', marginBottom: '8px' }}>
                                    Source Details
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                                    <div>
                                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Vendor Entity</div>
                                        <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>{duplicateSourceVendor.vendor_name}</div>
                                        {duplicateSourceVendor.contact_person && (
                                            <div style={{ fontSize: '0.72rem', color: '#475569' }}>👤 {duplicateSourceVendor.contact_person}</div>
                                        )}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Source Project</div>
                                        <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#ea580c' }}>
                                            {allProjectsList.find(p => String(p.project_id) === String(duplicateSourceProjId))?.project_name || (duplicateSourceProjId ? `PR-${duplicateSourceProjId}` : 'All Projects')}
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Ref: {duplicateSourceProjId}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Category / Scope</div>
                                        <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>{duplicateSourceVendor.vendor_type || 'Main Vendor'}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Duplication Mode Cards */}
                            <div style={{ marginBottom: '18px' }}>
                                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#0c1527', marginBottom: '8px', textTransform: 'uppercase' }}>
                                    Duplication Action
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
                                    {/* Mode 1 */}
                                    <div
                                        onClick={() => setDuplicateForm(prev => ({
                                            ...prev,
                                            mode: 'diff_project',
                                            targetVendorName: duplicateSourceVendor.vendor_name
                                        }))}
                                        style={{
                                            border: duplicateForm.mode === 'diff_project' ? '2px solid #ea580c' : '1px solid #cbd5e1',
                                            backgroundColor: duplicateForm.mode === 'diff_project' ? '#fff7ed' : '#ffffff',
                                            borderRadius: '10px',
                                            padding: '12px',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                            <input
                                                type="radio"
                                                name="dup_action_mode"
                                                checked={duplicateForm.mode === 'diff_project'}
                                                onChange={() => {}}
                                                style={{ accentColor: '#ea580c' }}
                                            />
                                            <span style={{ fontWeight: 800, fontSize: '0.82rem', color: '#0c1527' }}>Another Project Site</span>
                                        </div>
                                        <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b', lineHeight: 1.3 }}>
                                            Copy quotation scope to a new project site for {duplicateSourceVendor.vendor_name}
                                        </p>
                                    </div>

                                    {/* Mode 2 */}
                                    <div
                                        onClick={() => setDuplicateForm(prev => ({
                                            ...prev,
                                            mode: 'new_vendor_copy',
                                            targetVendorName: `${duplicateSourceVendor.vendor_name} (Copy)`
                                        }))}
                                        style={{
                                            border: duplicateForm.mode === 'new_vendor_copy' ? '2px solid #ea580c' : '1px solid #cbd5e1',
                                            backgroundColor: duplicateForm.mode === 'new_vendor_copy' ? '#fff7ed' : '#ffffff',
                                            borderRadius: '10px',
                                            padding: '12px',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                            <input
                                                type="radio"
                                                name="dup_action_mode"
                                                checked={duplicateForm.mode === 'new_vendor_copy'}
                                                onChange={() => {}}
                                                style={{ accentColor: '#ea580c' }}
                                            />
                                            <span style={{ fontWeight: 800, fontSize: '0.82rem', color: '#0c1527' }}>Clone Vendor Profile</span>
                                        </div>
                                        <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b', lineHeight: 1.3 }}>
                                            Create a duplicate registered vendor entity with prefilled business details
                                        </p>
                                    </div>

                                    {/* Mode 3 */}
                                    <div
                                        onClick={() => setDuplicateForm(prev => ({
                                            ...prev,
                                            mode: 'existing_vendor',
                                            targetVendorName: vendors.find(v => v.vendor_name !== duplicateSourceVendor.vendor_name)?.vendor_name || ''
                                        }))}
                                        style={{
                                            border: duplicateForm.mode === 'existing_vendor' ? '2px solid #ea580c' : '1px solid #cbd5e1',
                                            backgroundColor: duplicateForm.mode === 'existing_vendor' ? '#fff7ed' : '#ffffff',
                                            borderRadius: '10px',
                                            padding: '12px',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                            <input
                                                type="radio"
                                                name="dup_action_mode"
                                                checked={duplicateForm.mode === 'existing_vendor'}
                                                onChange={() => {}}
                                                style={{ accentColor: '#ea580c' }}
                                            />
                                            <span style={{ fontWeight: 800, fontSize: '0.82rem', color: '#0c1527' }}>Competitor Vendor</span>
                                        </div>
                                        <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b', lineHeight: 1.3 }}>
                                            Replicate BOQ items &amp; specifications to another existing vendor
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Target Vendor Input */}
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#0c1527', marginBottom: '6px', textTransform: 'uppercase' }}>
                                    Target Vendor Name *
                                </label>
                                {duplicateForm.mode === 'existing_vendor' ? (
                                    <select
                                        required
                                        value={duplicateForm.targetVendorName}
                                        onChange={e => setDuplicateForm(prev => ({ ...prev, targetVendorName: e.target.value }))}
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.88rem', fontWeight: 700, outline: 'none', backgroundColor: '#ffffff', color: '#0f172a' }}
                                    >
                                        <option value="">-- Select Existing Vendor --</option>
                                        {vendors.map(v => (
                                            <option key={v.id || v.vendor_name} value={v.vendor_name}>
                                                {v.vendor_name} ({v.vendor_type || 'Main Vendor'})
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        required
                                        value={duplicateForm.targetVendorName}
                                        onChange={e => setDuplicateForm(prev => ({ ...prev, targetVendorName: e.target.value }))}
                                        placeholder="Enter Target Vendor Name..."
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.88rem', fontWeight: 700, outline: 'none', backgroundColor: '#ffffff', color: '#0f172a' }}
                                    />
                                )}
                            </div>

                            {/* Target Project Selection */}
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#0c1527', marginBottom: '6px', textTransform: 'uppercase' }}>
                                    Target Project Site *
                                </label>
                                <select
                                    required
                                    value={duplicateForm.targetProjectId}
                                    onChange={e => setDuplicateForm(prev => ({ ...prev, targetProjectId: e.target.value }))}
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #ea580c', fontSize: '0.88rem', fontWeight: 800, outline: 'none', backgroundColor: '#fff7ed', color: '#c2410c' }}
                                >
                                    <option value="">-- Choose Target Project --</option>
                                    {allProjectsList.map(p => (
                                        <option key={p.project_id} value={p.project_id}>
                                            {p.display_label || (`Ref: ${p.quote_number || p.project_id} — ${p.project_name}`)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Target Version & Checkboxes */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '14px', marginBottom: '20px', alignItems: 'center' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#0c1527', marginBottom: '6px', textTransform: 'uppercase' }}>
                                        Quotation Version
                                    </label>
                                    <input
                                        type="text"
                                        value={duplicateForm.targetVersion}
                                        onChange={e => setDuplicateForm(prev => ({ ...prev, targetVersion: e.target.value }))}
                                        placeholder="V1.0"
                                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.88rem', fontWeight: 800, textAlign: 'center', outline: 'none' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '18px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.80rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={duplicateForm.copyItems}
                                            onChange={e => setDuplicateForm(prev => ({ ...prev, copyItems: e.target.checked }))}
                                            style={{ accentColor: '#ea580c' }}
                                        />
                                        Copy all line items, specs &amp; rates
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.80rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={duplicateForm.openInBuilder}
                                            onChange={e => setDuplicateForm(prev => ({ ...prev, openInBuilder: e.target.checked }))}
                                            style={{ accentColor: '#ea580c' }}
                                        />
                                        Open in Quota Builder immediately
                                    </label>
                                </div>
                            </div>

                            {/* Modal Actions */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowDuplicateVendorModal(false)}
                                    style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontWeight: 700, cursor: 'pointer', fontSize: '0.86rem' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isDuplicatingVendor}
                                    style={{
                                        padding: '10px 24px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        backgroundColor: '#ea580c',
                                        color: '#ffffff',
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        fontSize: '0.88rem',
                                        boxShadow: '0 4px 14px rgba(234, 88, 12, 0.25)'
                                    }}
                                >
                                    {isDuplicatingVendor ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />}
                                    {isDuplicatingVendor ? 'Duplicating...' : 'Confirm & Duplicate'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* FULL SCREEN MODULAR VENDOR QUOTATION BUILDER WORKSPACE (Similar to Create Quotation, NOT a popup modal) */}
            {isCreateQuotaModalOpen && (
                <div className="vendor-quota-builder-fullscreen" style={{
                    width: '100%',
                    minHeight: '100vh',
                    backgroundColor: '#f8fafc',
                    padding: '24px 32px 100px 32px',
                    color: '#1e293b',
                    fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
                }}>
                    {/* Executive Top Navigation Bar */}
                    <div style={{
                        marginBottom: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '12px'
                    }}>
                        <button
                            type="button"
                            onClick={() => setIsCreateQuotaModalOpen(false)}
                            style={{
                                padding: '8px 18px',
                                backgroundColor: '#ffffff',
                                color: '#0c1527',
                                border: '1.5px solid #cbd5e1',
                                borderRadius: '8px',
                                fontWeight: 800,
                                fontSize: '0.88rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            <ArrowLeft size={16} /> Back to Vendor Quotations List
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{
                                padding: '4px 12px',
                                borderRadius: '12px',
                                fontSize: '0.80rem',
                                fontWeight: 800,
                                backgroundColor: quotaApprovalStatus === 'Approved' ? '#f0fdf4' : '#fff7ed',
                                color: quotaApprovalStatus === 'Approved' ? '#16a34a' : '#ea580c',
                                border: '1px solid ' + (quotaApprovalStatus === 'Approved' ? '#bbf7d0' : '#ffedd5')
                            }}>
                                {quotaApprovalStatus === 'Approved' ? '✅ Approved (Admin)' : '⏳ Pending Admin Approval'}
                            </span>
                            <span style={{
                                padding: '4px 12px',
                                borderRadius: '12px',
                                fontSize: '0.80rem',
                                fontWeight: 800,
                                backgroundColor: '#eff6ff',
                                color: '#2563eb',
                                border: '1px solid #bfdbfe'
                            }}>
                                Version: {quotaVersion}
                            </span>
                        </div>
                    </div>

                    {/* Builder Executive Title Banner */}
                    <div className="no-print vendor-builder-modal-header" style={{
                        padding: '18px 24px',
                        backgroundColor: '#0c1527',
                        color: '#ffffff',
                        borderRadius: '14px',
                        borderBottom: '3px solid #fca412',
                        marginBottom: '20px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px',
                        boxShadow: '0 4px 14px rgba(12,21,39,0.12)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{ padding: '10px', backgroundColor: '#fca412', borderRadius: '10px', color: '#0c1527' }}>
                                <FileText size={24} />
                            </div>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#ffffff' }}>Modular Vendor Quotation Builder</h2>
                                <p style={{ margin: '3px 0 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
                                    Create modular work orders, adjust BOQ items, track versions &amp; manage approval locking
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsCreateQuotaModalOpen(false)}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: 'rgba(255,255,255,0.1)',
                                border: '1px solid rgba(255,255,255,0.2)',
                                borderRadius: '8px',
                                color: '#ffffff',
                                fontWeight: 700,
                                fontSize: '0.84rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <X size={16} /> Close Workspace
                        </button>
                    </div>

                    {/* Approval Locked Banner */}
                    {isQuotaLocked && (
                        <div className="no-print" style={{ backgroundColor: '#f0fdf4', padding: '12px 20px', borderRadius: '10px', border: '1px solid #bbf7d0', color: '#166534', fontWeight: 800, fontSize: '0.86rem', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                            <Lock size={18} style={{ color: '#16a34a' }} />
                            🔒 Official Work Order Agreement Finalized &amp; Approved! Editing is locked to preserve contractual integrity.
                        </div>
                    )}

                    <div className="vendor-quota-interactive-builder" style={{ padding: '0px', backgroundColor: 'transparent' }}>
                            {/* Brand Letterhead Banner */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0c1527', padding: '16px 20px', borderRadius: '12px', color: '#ffffff', marginBottom: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                    <img src={liveLogo} alt="Livincart Logo" style={{ height: '42px', objectFit: 'contain' }} />
                                    <div>
                                        <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#ffffff', letterSpacing: '0.5px' }}>Livincart Private Limited</div>
                                        <div style={{ fontSize: '0.78rem', color: '#fca412', fontWeight: 700 }}>Office Interiors &amp; Architecture Workspace</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.80rem', color: '#ffffff', fontWeight: 700, cursor: 'pointer' }}>
                                        <input type="checkbox" checked={coverPageEnabled} onChange={e => setCoverPageEnabled(e.target.checked)} />
                                        Cover Page
                                    </label>

                                    <button
                                        type="button"
                                        onClick={() => setHideCategoriesInPrint(!hideCategoriesInPrint)}
                                        style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #fca412', backgroundColor: hideCategoriesInPrint ? '#fca412' : 'transparent', color: hideCategoriesInPrint ? '#0c1527' : '#fca412', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer' }}
                                    >
                                        👁️ {hideCategoriesInPrint ? 'Show Categories in Print' : 'Hide Categories in Print'}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={openPrintPreviewFromBuilder}
                                        style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #94a3b8', backgroundColor: '#1e293b', color: '#ffffff', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer' }}
                                    >
                                        Print Quote
                                    </button>

                                    <button
                                        type="button"
                                        onClick={openPrintPreviewFromBuilder}
                                        style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #3b82f6', backgroundColor: '#2563eb', color: '#ffffff', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer' }}
                                    >
                                        Download PDF
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => alert('Work Order Draft Saved!')}
                                        style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #64748b', backgroundColor: '#334155', color: '#ffffff', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer' }}
                                    >
                                        Save Draft
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setShowVersionsModal(true)}
                                        style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #3b82f6', backgroundColor: '#eff6ff', color: '#1d4ed8', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                    >
                                        📜 Versions ({versionHistoryList.length})
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            const vendorObj = vendors.find(v => v.vendor_name === builderVendor) || { vendor_name: builderVendor };
                                            handleOpenDuplicateVendorModal(vendorObj, builderProjectId);
                                        }}
                                        style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #fed7aa', backgroundColor: '#fff7ed', color: '#ea580c', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                        title="Duplicate this vendor quotation to another project or vendor"
                                    >
                                        <Copy size={13} /> Duplicate Quota
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            const currentVerNum = parseFloat(quotaVersion.replace('V', '')) || 1.0;
                                            const nextVer = 'V' + (currentVerNum + 0.1).toFixed(1);
                                            const grandTotal = builderModules.flatMap(m => m.items).reduce((s, it) => s + (it.total || 0), 0);
                                            const newVerObj = {
                                                version: nextVer,
                                                createdAt: new Date().toLocaleString('en-IN'),
                                                totalAmount: grandTotal,
                                                approvalStatus: quotaApprovalStatus,
                                                modules: JSON.parse(JSON.stringify(builderModules))
                                            };
                                            setVersionHistoryList([...versionHistoryList, newVerObj]);
                                            setVersionsList([...versionsList, nextVer]);
                                            setQuotaVersion(nextVer);
                                            alert('Quota saved as Version ' + nextVer);
                                        }}
                                        style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #16a34a', backgroundColor: '#16a34a', color: '#ffffff', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer' }}
                                    >
                                        Save Version
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setShowTermsModal(true)}
                                        style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #ea580c', backgroundColor: '#ea580c', color: '#ffffff', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer' }}
                                    >
                                        Edit Terms ({clausesList.length})
                                    </button>
                                </div>
                            </div>

                            {/* Top Selection & Version Row */}
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr', gap: '16px', backgroundColor: '#ffffff', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.80rem', fontWeight: 800, color: '#0c1527', marginBottom: '6px', textTransform: 'uppercase' }}>
                                        Select Main Vendor *
                                    </label>
                                    <select
                                        required
                                        disabled={isQuotaLocked}
                                        value={builderVendor}
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            setBuilderVendor(v);
                                            if (v && builderProjectId) {
                                                loadQuotaScopeForProject(v, builderProjectId);
                                            }
                                        }}
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.88rem', outline: 'none', backgroundColor: '#ffffff', fontWeight: 700, color: '#0c1527' }}
                                    >
                                        <option value="">-- Choose Main Vendor --</option>
                                        {vendors.map((v) => (
                                            <option key={v.id || v.vendor_name} value={v.vendor_name}>
                                                {v.vendor_name} ({v.vendor_type || 'Main Vendor'})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.80rem', fontWeight: 800, color: '#0c1527', marginBottom: '6px', textTransform: 'uppercase' }}>
                                        Select Order Converted Client Quotation *
                                    </label>
                                    <select
                                        required
                                        disabled={isQuotaLocked}
                                        value={builderProjectId}
                                        onChange={(e) => {
                                            const pId = e.target.value;
                                            setBuilderProjectId(pId);
                                            if (pId) {
                                                loadQuotaScopeForProject(builderVendor || 'Main Vendor', pId);
                                            }
                                        }}
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #ea580c', fontSize: '0.88rem', outline: 'none', backgroundColor: '#fff7ed', fontWeight: 800, color: '#c2410c' }}
                                    >
                                        <option value="">-- Select Order Converted Client Quotation --</option>
                                        {allProjectsList.map((p) => (
                                            <option key={p.project_id} value={p.project_id}>
                                                {p.display_label || (`Ref: ${p.quote_number || p.project_id} — Project: ${p.project_name} [Order Converted]`)}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.80rem', fontWeight: 800, color: '#0c1527', marginBottom: '6px', textTransform: 'uppercase' }}>
                                        Version
                                    </label>
                                    <input
                                        type="text"
                                        disabled={isQuotaLocked}
                                        value={quotaVersion}
                                        onChange={(e) => setQuotaVersion(e.target.value)}
                                        placeholder="V1.0"
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.88rem', fontWeight: 800, color: '#0c1527', textAlign: 'center', backgroundColor: '#ffffff' }}
                                    />
                                </div>
                            </div>



                            {/* MODULES & SECTIONS BUILDER */}
                            {builderModules.map((mod, modIdx) => (
                                <div key={mod.id || modIdx} style={{ backgroundColor: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '12px', marginBottom: '24px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                                    {/* Module Section Header (Clean Minimal Styling) */}
                                    <div style={{ backgroundColor: '#ffffff', padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #ea580c', position: 'relative' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '70%' }}>
                                            <button
                                                type="button"
                                                onClick={() => setCollapsedModules(prev => ({ ...prev, [modIdx]: !prev[modIdx] }))}
                                                style={{ background: 'none', border: 'none', color: '#ea580c', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                                                title={collapsedModules[modIdx] ? "Expand Module Table" : "Collapse Module Table"}
                                            >
                                                <ChevronDown size={22} style={{ transform: collapsedModules[modIdx] ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
                                            </button>
                                            <Layers size={18} style={{ color: '#ea580c' }} />
                                            <input
                                                type="text"
                                                disabled={isQuotaLocked}
                                                value={mod.name}
                                                onChange={(e) => {
                                                    const updated = [...builderModules];
                                                    updated[modIdx].name = e.target.value;
                                                    setBuilderModules(updated);
                                                }}
                                                placeholder="Enter Module Section Name (e.g. Kitchen, Wardrobes)..."
                                                style={{ backgroundColor: 'transparent', border: 'none', color: '#0c1527', fontWeight: 800, fontSize: '1rem', width: '100%', outline: 'none' }}
                                            />
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>
                                            <span style={{ fontSize: '0.78rem', color: '#ea580c', fontWeight: 800, backgroundColor: '#fff7ed', border: '1px solid #fed7aa', padding: '3px 8px', borderRadius: '4px' }}>
                                                Module {modIdx + 1} ({mod.items.length} Items)
                                            </span>

                                            {/* Three-Dot Action Menu for Module Section */}
                                            {openModuleMenuIdx === modIdx && (
                                                <div 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setOpenModuleMenuIdx(null);
                                                    }}
                                                    style={{
                                                        position: 'fixed',
                                                        top: 0,
                                                        left: 0,
                                                        right: 0,
                                                        bottom: 0,
                                                        zIndex: 1900,
                                                        background: 'transparent'
                                                    }}
                                                />
                                            )}
                                            <button
                                                type="button"
                                                disabled={isQuotaLocked}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setOpenModuleMenuIdx(openModuleMenuIdx === modIdx ? null : modIdx);
                                                }}
                                                style={{ 
                                                    background: openModuleMenuIdx === modIdx ? '#eff6ff' : 'none', 
                                                    border: openModuleMenuIdx === modIdx ? '1.5px solid #2563eb' : 'none', 
                                                    borderRadius: '6px',
                                                    color: openModuleMenuIdx === modIdx ? '#2563eb' : '#64748b', 
                                                    cursor: 'pointer', 
                                                    padding: '4px',
                                                    boxShadow: openModuleMenuIdx === modIdx ? '0 0 0 3px rgba(37, 99, 235, 0.15)' : 'none',
                                                    transition: 'all 0.15s ease',
                                                    position: 'relative',
                                                    zIndex: openModuleMenuIdx === modIdx ? 1950 : 1
                                                }}
                                                title="Module Section Options"
                                            >
                                                <MoreVertical size={20} color={openModuleMenuIdx === modIdx ? '#2563eb' : '#64748b'} />
                                            </button>

                                            {openModuleMenuIdx === modIdx && !isQuotaLocked && (
                                                <div 
                                                    onClick={(e) => e.stopPropagation()}
                                                    style={{
                                                        position: 'absolute',
                                                        right: '0px',
                                                        top: '32px',
                                                        backgroundColor: '#ffffff',
                                                        borderRadius: '8px',
                                                        boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
                                                        border: '1px solid #cbd5e1',
                                                        zIndex: 2000,
                                                        width: '170px',
                                                        textAlign: 'left'
                                                    }}>
                                                    <div onClick={() => duplicateModuleSection(modIdx)} style={{ padding: '9px 12px', fontSize: '0.80rem', fontWeight: 700, color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <Copy size={14} /> Duplicate Module
                                                    </div>
                                                    <div onClick={() => moveModuleSection(modIdx, 'up')} style={{ padding: '9px 12px', fontSize: '0.80rem', fontWeight: 700, color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <ArrowUp size={14} /> Move Module Up
                                                    </div>
                                                    <div onClick={() => moveModuleSection(modIdx, 'down')} style={{ padding: '9px 12px', fontSize: '0.80rem', fontWeight: 700, color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <ArrowDown size={14} /> Move Module Down
                                                    </div>
                                                    <div onClick={() => removeModuleSection(modIdx)} style={{ padding: '9px 12px', fontSize: '0.80rem', fontWeight: 700, color: '#ef4444', borderTop: '1px solid #f1f5f9', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <X size={14} /> Delete Module
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Module Items Table (Collapsible Accordion Content) */}
                                    {!collapsedModules[modIdx] && (
                                        <>
                                            <div style={{ overflowX: 'auto' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                                                    <thead>
                                                        <tr style={{ backgroundColor: 'rgb(254, 143, 62)', color: '#ffffff' }}>
                                                            {columnVisibility.particulars && (
                                                                <th style={{ padding: '12px 10px', textAlign: 'left', width: '22%', fontWeight: 800 }}>
                                                                    <input
                                                                        type="text"
                                                                        value={columnHeadings.particulars}
                                                                        onChange={(e) => setColumnHeadings({ ...columnHeadings, particulars: e.target.value })}
                                                                        style={{ backgroundColor: 'transparent', border: 'none', color: '#ffffff', fontWeight: 800, fontSize: '0.85rem', width: '100%', outline: 'none' }}
                                                                    />
                                                                </th>
                                                            )}
                                                            {columnVisibility.shutter && (
                                                                <th style={{ padding: '12px 10px', textAlign: 'left', width: '18%', fontWeight: 800 }}>
                                                                    <input
                                                                        type="text"
                                                                        value={columnHeadings.shutter}
                                                                        onChange={(e) => setColumnHeadings({ ...columnHeadings, shutter: e.target.value })}
                                                                        style={{ backgroundColor: 'transparent', border: 'none', color: '#ffffff', fontWeight: 800, fontSize: '0.85rem', width: '100%', outline: 'none' }}
                                                                    />
                                                                </th>
                                                            )}
                                                            {columnVisibility.carcass && (
                                                                <th style={{ padding: '12px 10px', textAlign: 'left', width: '18%', fontWeight: 800 }}>
                                                                    <input
                                                                        type="text"
                                                                        value={columnHeadings.carcass}
                                                                        onChange={(e) => setColumnHeadings({ ...columnHeadings, carcass: e.target.value })}
                                                                        style={{ backgroundColor: 'transparent', border: 'none', color: '#ffffff', fontWeight: 800, fontSize: '0.85rem', width: '100%', outline: 'none' }}
                                                                    />
                                                                </th>
                                                            )}
                                                            {columnVisibility.dimensions && (
                                                                <th style={{ padding: '12px 10px', textAlign: 'left', width: '12%', fontWeight: 800 }}>
                                                                    <input
                                                                        type="text"
                                                                        value={columnHeadings.dimensions}
                                                                        onChange={(e) => setColumnHeadings({ ...columnHeadings, dimensions: e.target.value })}
                                                                        style={{ backgroundColor: 'transparent', border: 'none', color: '#ffffff', fontWeight: 800, fontSize: '0.85rem', width: '100%', outline: 'none' }}
                                                                    />
                                                                </th>
                                                            )}
                                                            {columnVisibility.rate && (
                                                                <th style={{ padding: '12px 8px', textAlign: 'right', width: '9%', fontWeight: 800 }}>
                                                                    <input
                                                                        type="text"
                                                                        value={columnHeadings.rate}
                                                                        onChange={(e) => setColumnHeadings({ ...columnHeadings, rate: e.target.value })}
                                                                        style={{ backgroundColor: 'transparent', border: 'none', color: '#ffffff', fontWeight: 800, fontSize: '0.85rem', width: '100%', textAlign: 'right', outline: 'none' }}
                                                                    />
                                                                </th>
                                                            )}
                                                            {columnVisibility.qty && (
                                                                <th style={{ padding: '12px 8px', textAlign: 'center', width: '6%', fontWeight: 800 }}>
                                                                    <input
                                                                        type="text"
                                                                        value={columnHeadings.qty}
                                                                        onChange={(e) => setColumnHeadings({ ...columnHeadings, qty: e.target.value })}
                                                                        style={{ backgroundColor: 'transparent', border: 'none', color: '#ffffff', fontWeight: 800, fontSize: '0.85rem', width: '100%', textAlign: 'center', outline: 'none' }}
                                                                    />
                                                                </th>
                                                            )}
                                                            {columnVisibility.discount && (
                                                                <th style={{ padding: '12px 8px', textAlign: 'center', width: '6%', fontWeight: 800 }}>
                                                                    <input
                                                                        type="text"
                                                                        value={columnHeadings.discount}
                                                                        onChange={(e) => setColumnHeadings({ ...columnHeadings, discount: e.target.value })}
                                                                        style={{ backgroundColor: 'transparent', border: 'none', color: '#ffffff', fontWeight: 800, fontSize: '0.85rem', width: '100%', textAlign: 'center', outline: 'none' }}
                                                                    />
                                                                </th>
                                                            )}
                                                            {columnVisibility.total && (
                                                                <th style={{ padding: '12px 8px', textAlign: 'right', width: '9%', fontWeight: 800 }}>
                                                                    <input
                                                                        type="text"
                                                                        value={columnHeadings.total}
                                                                        onChange={(e) => setColumnHeadings({ ...columnHeadings, total: e.target.value })}
                                                                        style={{ backgroundColor: 'transparent', border: 'none', color: '#ffffff', fontWeight: 800, fontSize: '0.85rem', width: '100%', textAlign: 'right', outline: 'none' }}
                                                                    />
                                                                </th>
                                                            )}
                                                            <th style={{ padding: '12px 8px', textAlign: 'center', width: '5%', fontWeight: 800 }}>Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {mod.items.map((item, itemIdx) => {
                                                            const itemMenuKey = String(modIdx) + '-' + String(itemIdx);
                                                            if (item.is_subtitle) {
                                                                return (
                                                                    <tr key={itemIdx} style={{ borderBottom: '2px solid #fed7aa', backgroundColor: '#fff7ed' }}>
                                                                        <td colSpan={8} style={{ padding: '8px 12px' }}>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                <span style={{ fontSize: '0.82rem', fontWeight: 900, color: '#c2410c', whiteSpace: 'nowrap' }}>📌 SUBTITLE / SECTION NOTE:</span>
                                                                                <input
                                                                                    type="text"
                                                                                    disabled={isQuotaLocked}
                                                                                    value={item.particulars || ''}
                                                                                    onChange={(e) => updateModuleItem(modIdx, itemIdx, 'particulars', e.target.value)}
                                                                                    placeholder="Enter Subtitle / Section Heading (e.g. Master Bedroom Cabinetry)..."
                                                                                    style={{ flex: 1, padding: '6px 12px', borderRadius: '6px', border: '1.5px solid #fed7aa', fontSize: '0.88rem', fontWeight: 800, color: '#c2410c', outline: 'none', backgroundColor: '#ffffff' }}
                                                                                />
                                                                            </div>
                                                                        </td>
                                                                        <td style={{ padding: '8px', textAlign: 'center', position: 'relative' }}>
                                                                            <button
                                                                                type="button"
                                                                                disabled={isQuotaLocked}
                                                                                onClick={() => removeModuleItem(modIdx, itemIdx)}
                                                                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                                                                                title="Delete Subtitle"
                                                                            >
                                                                                <X size={18} />
                                                                            </button>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            }

                                                            return (
                                                                <tr key={itemIdx} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: itemIdx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                                            {columnVisibility.particulars && (
                                                                <td style={{ padding: '8px' }}>
                                                                    <input
                                                                        type="text"
                                                                        disabled={isQuotaLocked}
                                                                        value={item.particulars || ''}
                                                                        onChange={(e) => updateModuleItem(modIdx, itemIdx, 'particulars', e.target.value)}
                                                                        placeholder="Description..."
                                                                        style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 700, outline: 'none', backgroundColor: '#ffffff', marginBottom: '4px' }}
                                                                    />
                                                                    <input
                                                                        type="text"
                                                                        disabled={isQuotaLocked}
                                                                        value={item.description || ''}
                                                                        onChange={(e) => updateModuleItem(modIdx, itemIdx, 'description', e.target.value)}
                                                                        placeholder="+ Add Detailed Description / Subtitle..."
                                                                        style={{ width: '100%', padding: '4px 8px', borderRadius: '6px', border: '1px dashed #cbd5e1', fontSize: '0.76rem', color: '#475569', outline: 'none', backgroundColor: '#f8fafc' }}
                                                                    />
                                                                </td>
                                                            )}
                                                            {columnVisibility.shutter && (
                                                                <td style={{ padding: '8px' }}>
                                                                    <input
                                                                        type="text"
                                                                        disabled={isQuotaLocked}
                                                                        value={item.shutter || ''}
                                                                        onChange={(e) => updateModuleItem(modIdx, itemIdx, 'shutter', e.target.value)}
                                                                        placeholder="Shutter spec..."
                                                                        style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', outline: 'none', backgroundColor: '#ffffff' }}
                                                                    />
                                                                </td>
                                                            )}
                                                            {columnVisibility.carcass && (
                                                                <td style={{ padding: '8px' }}>
                                                                    <input
                                                                        type="text"
                                                                        disabled={isQuotaLocked}
                                                                        value={item.carcass || ''}
                                                                        onChange={(e) => updateModuleItem(modIdx, itemIdx, 'carcass', e.target.value)}
                                                                        placeholder="Carcass spec..."
                                                                        style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', outline: 'none', backgroundColor: '#ffffff' }}
                                                                    />
                                                                </td>
                                                            )}
                                                            {columnVisibility.dimensions && (
                                                                <td style={{ padding: '8px', minWidth: '135px' }}>
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                        <select
                                                                            disabled={isQuotaLocked}
                                                                            value={item.dim_type || (item.pricing_mode === 'lumpsum' ? 'lumpsum' : 'whd')}
                                                                            onChange={(e) => {
                                                                                const val = e.target.value;
                                                                                if (val === 'lumpsum') {
                                                                                    updateModuleItem(modIdx, itemIdx, {
                                                                                        dim_type: 'lumpsum',
                                                                                        pricing_mode: 'lumpsum',
                                                                                        dimensions: 'Lumpsum',
                                                                                        sft: '',
                                                                                        sqft: ''
                                                                                    });
                                                                                } else {
                                                                                    updateModuleItem(modIdx, itemIdx, {
                                                                                        dim_type: 'whd',
                                                                                        pricing_mode: 'whd',
                                                                                        dimensions: `W:${item.dim_w || ''} H:${item.dim_h || ''} D:${item.dim_d || ''}`.trim()
                                                                                    });
                                                                                }
                                                                            }}
                                                                            style={{ padding: '3px 6px', fontSize: '0.74rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontWeight: 700, backgroundColor: '#f8fafc' }}
                                                                        >
                                                                            <option value="whd">📐 W × H × D</option>
                                                                            <option value="lumpsum">💰 Lumpsum</option>
                                                                        </select>

                                                                        {(item.dim_type !== 'lumpsum' && item.pricing_mode !== 'lumpsum') ? (
                                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '2px' }}>
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                                    <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#ea580c', width: '18px' }}>W:</span>
                                                                                    <input
                                                                                        type="text"
                                                                                        disabled={isQuotaLocked}
                                                                                        value={item.dim_w || ''}
                                                                                        onChange={(e) => {
                                                                                            const w = e.target.value;
                                                                                            updateModuleItem(modIdx, itemIdx, {
                                                                                                dim_w: w,
                                                                                                dimensions: `W:${w} H:${item.dim_h || ''} D:${item.dim_d || ''}`.trim()
                                                                                            });
                                                                                        }}
                                                                                        placeholder="Width (mm)"
                                                                                        title="Width in mm"
                                                                                        style={{ flex: 1, padding: '3px 6px', fontSize: '0.74rem', border: '1px solid #cbd5e1', borderRadius: '4px', outline: 'none', backgroundColor: '#ffffff' }}
                                                                                    />
                                                                                </div>
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                                    <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#ea580c', width: '18px' }}>H:</span>
                                                                                    <input
                                                                                        type="text"
                                                                                        disabled={isQuotaLocked}
                                                                                        value={item.dim_h || ''}
                                                                                        onChange={(e) => {
                                                                                            const h = e.target.value;
                                                                                            updateModuleItem(modIdx, itemIdx, {
                                                                                                dim_h: h,
                                                                                                dimensions: `W:${item.dim_w || ''} H:${h} D:${item.dim_d || ''}`.trim()
                                                                                            });
                                                                                        }}
                                                                                        placeholder="Height (mm)"
                                                                                        title="Height in mm"
                                                                                        style={{ flex: 1, padding: '3px 6px', fontSize: '0.74rem', border: '1px solid #cbd5e1', borderRadius: '4px', outline: 'none', backgroundColor: '#ffffff' }}
                                                                                    />
                                                                                </div>
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                                    <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#ea580c', width: '18px' }}>D:</span>
                                                                                    <input
                                                                                        type="text"
                                                                                        disabled={isQuotaLocked}
                                                                                        value={item.dim_d || ''}
                                                                                        onChange={(e) => {
                                                                                            const d = e.target.value;
                                                                                            updateModuleItem(modIdx, itemIdx, {
                                                                                                dim_d: d,
                                                                                                dimensions: `W:${item.dim_w || ''} H:${item.dim_h || ''} D:${d}`.trim()
                                                                                            });
                                                                                        }}
                                                                                        placeholder="Depth (mm)"
                                                                                        title="Depth in mm"
                                                                                        style={{ flex: 1, padding: '3px 6px', fontSize: '0.74rem', border: '1px solid #cbd5e1', borderRadius: '4px', outline: 'none', backgroundColor: '#ffffff' }}
                                                                                    />
                                                                                </div>

                                                                                {/* SFT Calculation Value Display (same formula as quote creation) */}
                                                                                {(() => {
                                                                                    const sqftVal = computeSqft(item.dim_w, item.dim_h, item.dim_d);
                                                                                    return sqftVal > 0 ? (
                                                                                        <div style={{ textAlign: 'center', marginTop: '3px' }}>
                                                                                            <span style={{
                                                                                                fontSize: '0.72rem',
                                                                                                color: '#ea580c',
                                                                                                fontWeight: 800,
                                                                                                backgroundColor: '#fff7ed',
                                                                                                padding: '2px 8px',
                                                                                                borderRadius: '4px',
                                                                                                border: '1.5px solid #fed7aa',
                                                                                                display: 'inline-flex',
                                                                                                alignItems: 'center',
                                                                                                gap: '3px',
                                                                                                boxShadow: '0 1px 3px rgba(234, 88, 12, 0.08)'
                                                                                            }}>
                                                                                                📐 {sqftVal.toFixed(2)} SFT
                                                                                            </span>
                                                                                        </div>
                                                                                    ) : null;
                                                                                })()}
                                                                            </div>
                                                                        ) : (
                                                                            <div style={{ textAlign: 'center', fontSize: '0.72rem', color: '#16a34a', fontWeight: 800, backgroundColor: '#f0fdf4', padding: '3px', borderRadius: '4px', border: '1px solid #bbf7d0' }}>
                                                                                Lumpsum
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            )}
                                                            {columnVisibility.rate && (
                                                                <td style={{ padding: '8px' }}>
                                                                    <input
                                                                        type="number"
                                                                        disabled={isQuotaLocked}
                                                                        value={item.rate ?? ''}
                                                                        onChange={(e) => updateModuleItem(modIdx, itemIdx, 'rate', e.target.value)}
                                                                        style={{ width: '100%', padding: '6px 6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', textAlign: 'right', outline: 'none', backgroundColor: '#ffffff' }}
                                                                    />
                                                                </td>
                                                            )}
                                                            {columnVisibility.qty && (
                                                                <td style={{ padding: '8px' }}>
                                                                    <input
                                                                        type="number"
                                                                        disabled={isQuotaLocked}
                                                                        value={item.qty ?? ''}
                                                                        onChange={(e) => updateModuleItem(modIdx, itemIdx, 'qty', e.target.value)}
                                                                        style={{ width: '100%', padding: '6px 4px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', textAlign: 'center', outline: 'none', backgroundColor: '#ffffff' }}
                                                                    />
                                                                </td>
                                                            )}
                                                            {columnVisibility.discount && (
                                                                <td style={{ padding: '8px' }}>
                                                                    <input
                                                                        type="number"
                                                                        disabled={isQuotaLocked}
                                                                        value={item.discount ?? ''}
                                                                        onChange={(e) => updateModuleItem(modIdx, itemIdx, 'discount', e.target.value)}
                                                                        style={{ width: '100%', padding: '6px 4px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', textAlign: 'center', outline: 'none', backgroundColor: '#ffffff' }}
                                                                    />
                                                                </td>
                                                            )}
                                                            {columnVisibility.total && (
                                                                <td style={{ padding: '8px', textAlign: 'right', fontWeight: 800, color: '#0c1527' }}>
                                                                    ₹{(item.total || 0).toLocaleString()}
                                                                </td>
                                                            )}
                                                            <td style={{ padding: '8px', textAlign: 'center', position: 'relative' }}>
                                                                {openThreeDotMenuId === itemMenuKey && (
                                                                    <div 
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setOpenThreeDotMenuId(null);
                                                                        }}
                                                                        style={{
                                                                            position: 'fixed',
                                                                            top: 0,
                                                                            left: 0,
                                                                            right: 0,
                                                                            bottom: 0,
                                                                            zIndex: 99990,
                                                                            background: 'transparent'
                                                                        }}
                                                                    />
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    disabled={isQuotaLocked}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setOpenThreeDotMenuId(openThreeDotMenuId === itemMenuKey ? null : itemMenuKey);
                                                                    }}
                                                                    style={{ 
                                                                        background: openThreeDotMenuId === itemMenuKey ? '#eff6ff' : 'none', 
                                                                        border: openThreeDotMenuId === itemMenuKey ? '1.5px solid #2563eb' : 'none', 
                                                                        borderRadius: '6px',
                                                                        color: openThreeDotMenuId === itemMenuKey ? '#2563eb' : '#64748b', 
                                                                        cursor: 'pointer', 
                                                                        padding: '4px',
                                                                        boxShadow: openThreeDotMenuId === itemMenuKey ? '0 0 0 3px rgba(37, 99, 235, 0.15)' : 'none',
                                                                        transition: 'all 0.15s ease',
                                                                        position: 'relative',
                                                                        zIndex: openThreeDotMenuId === itemMenuKey ? 99995 : 1
                                                                    }}
                                                                    title="Item options menu"
                                                                >
                                                                    <MoreVertical size={18} color={openThreeDotMenuId === itemMenuKey ? '#2563eb' : '#64748b'} />
                                                                </button>

                                                                {/* Three-Dot Action Dropdown Menu (Fixed Position for last rows) */}
                                                                {openThreeDotMenuId === itemMenuKey && !isQuotaLocked && (
                                                                    <div 
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        style={{
                                                                            position: 'absolute',
                                                                            right: '10px',
                                                                            ...(itemIdx >= mod.items.length - 1 ? { bottom: '35px' } : { top: '35px' }),
                                                                            backgroundColor: '#ffffff',
                                                                            borderRadius: '8px',
                                                                            boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
                                                                            border: '1px solid #cbd5e1',
                                                                            zIndex: 999999,
                                                                            width: '150px',
                                                                            textAlign: 'left'
                                                                        }}>
                                                                        <div onClick={() => duplicateModuleItem(modIdx, itemIdx)} style={{ padding: '8px 12px', fontSize: '0.78rem', fontWeight: 700, color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                            <Copy size={13} /> Duplicate
                                                                        </div>
                                                                        <div onClick={() => moveModuleItem(modIdx, itemIdx, 'up')} style={{ padding: '8px 12px', fontSize: '0.78rem', fontWeight: 700, color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                            <ArrowUp size={13} /> Move Up
                                                                        </div>
                                                                        <div onClick={() => moveModuleItem(modIdx, itemIdx, 'down')} style={{ padding: '8px 12px', fontSize: '0.78rem', fontWeight: 700, color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                            <ArrowDown size={13} /> Move Down
                                                                        </div>
                                                                        <div onClick={() => removeModuleItem(modIdx, itemIdx)} style={{ padding: '8px 12px', fontSize: '0.78rem', fontWeight: 700, color: '#ef4444', borderTop: '1px solid #f1f5f9', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                            <X size={13} /> Remove
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Module Footer Buttons */}
                                    <div style={{ padding: '10px 16px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '10px', alignItems: 'center' }}>
                                        <button
                                            type="button"
                                            disabled={isQuotaLocked}
                                            onClick={() => addModuleItem(modIdx)}
                                            style={{ padding: '6px 14px', backgroundColor: '#ffffff', color: '#ea580c', border: '1px solid #fed7aa', borderRadius: '6px', fontWeight: 800, fontSize: '0.80rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                        >
                                            <Plus size={14} /> Add Description to {mod.name}
                                        </button>
                                        <button
                                            type="button"
                                            disabled={isQuotaLocked}
                                            onClick={() => addModuleSubtitleItem(modIdx)}
                                            style={{ padding: '6px 14px', backgroundColor: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', borderRadius: '6px', fontWeight: 800, fontSize: '0.80rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                        >
                                            <Plus size={14} /> Add Subtitle / Section Note
                                        </button>
                                    </div>
                                    </>
                                    )}
                                </div>
                            ))}

                            {/* Add Module Section Button */}
                            <div style={{ marginBottom: '24px' }}>
                                <button
                                    type="button"
                                    disabled={isQuotaLocked}
                                    onClick={addModuleSection}
                                    style={{ padding: '10px 20px', backgroundColor: '#0c1527', color: '#fca412', border: '1px solid #fca412', borderRadius: '8px', fontWeight: 800, fontSize: '0.86rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                                >
                                    <Plus size={16} /> Add Module Section
                                </button>
                            </div>

                            {/* Summary & Workflow Action Bar Footer (Sticky at bottom, full width) */}
                            <div style={{
                                position: 'sticky',
                                bottom: '0px',
                                zIndex: 90,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                borderTop: '2px solid #ea580c',
                                backgroundColor: '#ffffff',
                                padding: '16px 24px',
                                borderRadius: '12px',
                                boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.08)',
                                marginTop: '24px',
                                flexWrap: 'wrap',
                                gap: '16px'
                            }}>
                                <div>
                                    <div style={{ fontSize: '0.80rem', color: '#ea580c', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Total Modules: {builderModules.length} | Total Items: {builderModules.flatMap(m => m.items).length}
                                    </div>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0c1527', marginTop: '2px' }}>
                                        Grand Vendor Valuation: <span style={{ color: '#16a34a' }}>₹{builderModules.flatMap(m => m.items).reduce((s, it) => s + (it.total || 0), 0).toLocaleString('en-IN')}</span>
                                    </div>
                                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginTop: '3px', fontStyle: 'italic' }}>
                                        Amount in Words: <span style={{ color: '#0c1527', fontWeight: 800 }}>{numberToWords(builderModules.flatMap(m => m.items).reduce((s, it) => s + (it.total || 0), 0))}</span>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <button
                                        type="button"
                                        onClick={() => setIsCreateQuotaModalOpen(false)}
                                        style={{ padding: '10px 18px', borderRadius: '8px', border: '1.5px solid #cbd5e1', backgroundColor: '#ffffff', color: '#475569', fontWeight: 800, fontSize: '0.84rem', cursor: 'pointer' }}
                                    >
                                        ← Back to List
                                    </button>

                                    <button
                                        type="button"
                                        disabled={sendingApproval}
                                        onClick={() => handleSendForApproval('Pending Approval')}
                                        style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid #ea580c', backgroundColor: '#fff7ed', color: '#c2410c', fontWeight: 800, fontSize: '0.84rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                                        title="Submit vendor quotation for Admin review and approval"
                                    >
                                        <Send size={15} /> Send for Admin Approval
                                    </button>

                                    {isAdmin ? (
                                        <button
                                            type="button"
                                            disabled={sendingApproval}
                                            onClick={() => handleSendForApproval('Approved')}
                                            style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#16a34a', color: '#ffffff', fontWeight: 800, fontSize: '0.84rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)' }}
                                            title="Admin Only: Approve & Lock Vendor Quotation as final binding agreement"
                                        >
                                            <Check size={16} /> Approve &amp; Lock Quotation
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            disabled={true}
                                            style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f1f5f9', color: '#94a3b8', fontWeight: 700, fontSize: '0.82rem', cursor: 'not-allowed', display: 'flex', alignItems: 'center', gap: '6px' }}
                                            title="Approval can only be performed by Admin. Please use 'Send for Admin Approval'."
                                        >
                                            <Lock size={14} /> Admin Approval Required
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        disabled={savingQuota || isQuotaLocked}
                                        onClick={(e) => handleSaveVendorQuotaSubmit(e as any)}
                                        style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', backgroundColor: isQuotaLocked ? '#94a3b8' : '#ea580c', color: '#ffffff', fontWeight: 800, fontSize: '0.84rem', cursor: isQuotaLocked ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 14px rgba(234, 88, 12, 0.25)' }}
                                    >
                                        {savingQuota ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                        Save Vendor Quotation
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            {/* EDIT TERMS & CONDITIONS MODAL */}
            {showTermsModal && createPortal(
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(248, 246, 240, 0.94)', backdropFilter: 'blur(8px)', zIndex: 1000000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
                    <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '1150px', maxWidth: '96vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.18)', border: '1.5px solid #fed7aa' }}>
                        <div style={{ backgroundColor: '#0c1527', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#ffffff' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#ffffff' }}>📝 Edit Terms &amp; Conditions / Service Agreement</h3>
                                <div style={{ fontSize: '0.78rem', color: '#fca412', fontWeight: 700 }}>Separate General Terms &amp; Conditions from Vendor Service Agreement Clauses</div>
                            </div>
                            <button onClick={() => setShowTermsModal(false)} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}><X size={20} /></button>
                        </div>

                        {/* Tabs Bar */}
                        <div style={{ backgroundColor: '#1e293b', padding: '10px 24px', display: 'flex', gap: '12px', borderBottom: '2px solid #fca412' }}>
                            <button
                                type="button"
                                onClick={() => setActiveTermsTab('general')}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    fontWeight: 800,
                                    fontSize: '0.82rem',
                                    cursor: 'pointer',
                                    backgroundColor: activeTermsTab === 'general' ? '#ea580c' : '#334155',
                                    color: '#ffffff',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                📋 General Terms &amp; Conditions ({generalTermsList.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTermsTab('service')}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    fontWeight: 800,
                                    fontSize: '0.82rem',
                                    cursor: 'pointer',
                                    backgroundColor: activeTermsTab === 'service' ? '#ea580c' : '#334155',
                                    color: '#ffffff',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                📜 Livincart Vendor Service Agreement ({clausesList.length} Clauses)
                            </button>
                        </div>

                        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, backgroundColor: '#fcfbf8' }}>
                            {activeTermsTab === 'general' ? (
                                <div>
                                    <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0c1527', marginBottom: '12px' }}>General Terms, Validity &amp; Payment Milestones:</div>
                                    {generalTermsList.map((term, idx) => (
                                        <div key={idx} style={{ backgroundColor: '#ffffff', border: '1px solid #fed7aa', borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                <input
                                                    type="text"
                                                    value={term.title}
                                                    onChange={e => {
                                                        const updated = [...generalTermsList];
                                                        updated[idx].title = e.target.value;
                                                        setGeneralTermsList(updated);
                                                    }}
                                                    style={{ fontSize: '0.90rem', fontWeight: 800, color: '#0c1527', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '6px 10px', width: '80%', outline: 'none' }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setGeneralTermsList(generalTermsList.filter((_, i) => i !== idx))}
                                                    style={{ padding: '4px 10px', backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer' }}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                            <textarea
                                                rows={2}
                                                value={term.content}
                                                onChange={e => {
                                                    const updated = [...generalTermsList];
                                                    updated[idx].content = e.target.value;
                                                    setGeneralTermsList(updated);
                                                }}
                                                style={{ width: '100%', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px 10px', outline: 'none', fontFamily: 'inherit' }}
                                            />
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => setGeneralTermsList([...generalTermsList, { title: (generalTermsList.length + 1) + '. Custom Term', content: 'Enter general term details here...' }])}
                                        style={{ padding: '8px 16px', backgroundColor: '#ffffff', color: '#ea580c', border: '1.5px dashed #ea580c', borderRadius: '8px', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                    >
                                        <Plus size={15} /> Add Custom General Term
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0c1527', marginBottom: '12px' }}>Livincart Master Vendor Service Agreement Legal Clauses:</div>
                                    {clausesList.map((clause, idx) => (
                                        <div key={idx} style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                <input
                                                    type="text"
                                                    value={clause.title}
                                                    onChange={e => {
                                                        const updated = [...clausesList];
                                                        updated[idx].title = e.target.value;
                                                        setClausesList(updated);
                                                    }}
                                                    style={{ fontSize: '0.90rem', fontWeight: 800, color: '#0c1527', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '6px 10px', width: '80%', outline: 'none' }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setClausesList(clausesList.filter((_, i) => i !== idx))}
                                                    style={{ padding: '4px 10px', backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer' }}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                            <textarea
                                                rows={3}
                                                value={clause.content}
                                                onChange={e => {
                                                    const updated = [...clausesList];
                                                    updated[idx].content = e.target.value;
                                                    setClausesList(updated);
                                                }}
                                                style={{ width: '100%', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px 10px', outline: 'none', fontFamily: 'inherit' }}
                                            />
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => setClausesList([...clausesList, { title: (clausesList.length + 1) + '. Custom Clause Title', content: 'Enter custom clause conditions here...' }])}
                                        style={{ padding: '8px 16px', backgroundColor: '#ffffff', color: '#ea580c', border: '1.5px dashed #ea580c', borderRadius: '8px', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                    >
                                        <Plus size={15} /> Add New Service Agreement Clause
                                    </button>
                                </div>
                            )}
                        </div>
                        <div style={{ padding: '16px 24px', backgroundColor: '#ffffff', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button
                                type="button"
                                onClick={() => setShowTermsModal(false)}
                                style={{ padding: '8px 20px', backgroundColor: '#ea580c', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 800, fontSize: '0.84rem', cursor: 'pointer' }}
                            >
                                Save &amp; Apply Terms
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* VERSION CONTROL & HISTORY MODAL */}
            {showVersionsModal && createPortal(
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(12,21,39,0.75)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
                    <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '700px', maxWidth: '95vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
                        <div style={{ backgroundColor: '#0c1527', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#ffffff' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#ffffff' }}>📜 Quotation Version History</h3>
                                <div style={{ fontSize: '0.78rem', color: '#fca412', fontWeight: 700 }}>Track saved versions &amp; compare historical revisions ({versionHistoryList.length} versions)</div>
                            </div>
                            <button onClick={() => setShowVersionsModal(false)} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}><X size={20} /></button>
                        </div>
                        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, backgroundColor: '#fcfbf8' }}>
                            <div style={{ display: 'grid', gap: '12px' }}>
                                {versionHistoryList.map((verObj, idx) => (
                                    <div key={idx} style={{ backgroundColor: '#ffffff', border: verObj.version === quotaVersion ? '2px solid #ea580c' : '1px solid #cbd5e1', borderRadius: '10px', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '1rem', fontWeight: 900, color: '#0c1527' }}>Version {verObj.version}</span>
                                                {verObj.version === quotaVersion && (
                                                    <span style={{ fontSize: '0.72rem', backgroundColor: '#fff7ed', color: '#c2410c', padding: '2px 8px', borderRadius: '12px', fontWeight: 800, border: '1px solid #fed7aa' }}>Active Version</span>
                                                )}
                                                <span style={{ fontSize: '0.72rem', backgroundColor: verObj.approvalStatus === 'Approved' ? '#f0fdf4' : '#f8fafc', color: verObj.approvalStatus === 'Approved' ? '#16a34a' : '#64748b', padding: '2px 8px', borderRadius: '12px', fontWeight: 800, border: '1px solid #e2e8f0' }}>{verObj.approvalStatus}</span>
                                            </div>
                                            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px', fontWeight: 700 }}>
                                                Saved Date: {verObj.createdAt} | Total Modules: {(verObj.modules || builderModules).length}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#16a34a' }}>
                                                ₹{(verObj.totalAmount || builderModules.flatMap(m => m.items).reduce((s, it) => s + (it.total || 0), 0)).toLocaleString('en-IN')}
                                            </div>
                                            {verObj.version !== quotaVersion && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setQuotaVersion(verObj.version);
                                                        setQuotaApprovalStatus(verObj.approvalStatus || 'Pending Approval');
                                                        if (verObj.modules && verObj.modules.length > 0) {
                                                            setBuilderModules(JSON.parse(JSON.stringify(verObj.modules)));
                                                        }
                                                        setShowVersionsModal(false);
                                                        alert('Loaded version ' + verObj.version);
                                                    }}
                                                    style={{ padding: '6px 12px', backgroundColor: '#ea580c', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}
                                                >
                                                    Load Version
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div style={{ padding: '16px 24px', backgroundColor: '#ffffff', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <button
                                type="button"
                                onClick={() => {
                                    const currentVerNum = parseFloat(quotaVersion.replace('V', '')) || 1.0;
                                    const nextVer = 'V' + (currentVerNum + 0.1).toFixed(1);
                                    const grandTotal = builderModules.flatMap(m => m.items).reduce((s, it) => s + (it.total || 0), 0);
                                    const newVerObj = {
                                        version: nextVer,
                                        createdAt: new Date().toLocaleString('en-IN'),
                                        totalAmount: grandTotal,
                                        approvalStatus: quotaApprovalStatus,
                                        modules: JSON.parse(JSON.stringify(builderModules))
                                    };
                                    setVersionHistoryList([...versionHistoryList, newVerObj]);
                                    setVersionsList([...versionsList, nextVer]);
                                    setQuotaVersion(nextVer);
                                    alert('Saved current state as New Version ' + nextVer);
                                }}
                                style={{ padding: '8px 16px', backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            >
                                <Plus size={15} /> Save Current as New Version
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowVersionsModal(false)}
                                style={{ padding: '8px 20px', backgroundColor: '#64748b', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 800, fontSize: '0.84rem', cursor: 'pointer' }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default VendorQuotaPage;
