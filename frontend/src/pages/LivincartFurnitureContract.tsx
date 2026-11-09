import React from "react";
import logo from "../assets/1.png";
import { OWNER_SIGNATURE_BASE64 } from "../assets/ownerSignatureBase64";

const FONT = '"Calibri", "Segoe UI", Arial, Helvetica, sans-serif';

export interface FurniturePaymentStage {
  stage: string;
  percentage: string;
}

export const DEFAULT_FURNITURE_SCHEDULE: FurniturePaymentStage[] = [
  { stage: "Initial agreement", percentage: "10%" },
  { stage: "Design finalisation", percentage: "50%" },
  { stage: "Before Dispatch", percentage: "35%" },
  { stage: "Upon final Handover", percentage: "05%" },
];

interface LivincartFurnitureContractProps {
  clientName?: string;
  date?: string;
  contractValue?: string;
  contractValueWords?: string;
  address?: string;
  refId?: string;
  place?: string;
  includeContract?: boolean;
  includeHandover?: boolean;
  clientSignature?: string;
  furniturePaymentSchedule?: FurniturePaymentStage[];
  convenienceFeeNote?: string;
  deliveryInstallationNote?: string;
  cancellationMinAmount?: string;
  bookingScenarioDate?: string;
}

export default function LivincartFurnitureContract({
  clientName = "Mr. K Ranjit Kumar",
  date = "09.07.2026",
  contractValue = "1,75,000",
  contractValueWords = "Rupees One Lakh Seventy-Five Thousand Only",
  address = "Talikulam Puthiyangadi",
  refId = "PR_2026_009/01",
  place = "Visakhapatnam",
  includeContract = true,
  includeHandover = false,
  clientSignature = "",
  furniturePaymentSchedule = DEFAULT_FURNITURE_SCHEDULE,
  convenienceFeeNote = "",
  deliveryInstallationNote = "",
  cancellationMinAmount = "",
  bookingScenarioDate = "",
}: LivincartFurnitureContractProps) {
  return (
    <div className="contract-wrapper" style={{ padding: "0", backgroundColor: "#ffffff", fontFamily: FONT, color: "#1e293b" }}>
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm 30mm 12mm 30mm !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }
          .contract-wrapper {
            padding: 0 !important;
            background: #ffffff !important;
            background-color: #ffffff !important;
            box-sizing: border-box !important;
          }
          .contract-document, .page {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            background: #ffffff !important;
            background-color: #ffffff !important;
          }
          tfoot {
            display: table-footer-group !important;
          }
          .print-running-footer {
            display: block !important;
            width: 100% !important;
            padding-top: 8px !important;
            margin-top: 14px !important;
            background: #ffffff !important;
            border-top: 1px solid #cbd5e1 !important;
            text-align: center !important;
            font-size: 8.5pt !important;
            color: #475569 !important;
            line-height: 1.4 !important;
          }
          h1, h2, h3, h4, .signature-block {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          h3, h4 {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          p, li {
            orphans: 2;
            widows: 2;
          }
        }
      `}</style>

      {/* ─── CONTINUOUS SMOOTH FLOW DOCUMENT ─── */}
      <div className="contract-document" style={S.document}>
        <table style={{ width: "100%", borderCollapse: "collapse", backgroundColor: "#ffffff" }}>
          <tbody>
            <tr>
              <td style={{ padding: 0 }}>
                {/* Letterhead Header */}
                <div style={S.lhRow}>
                  <div>
                    <img src={logo} alt="Livincart Logo" style={{ width: "110px", height: "auto", objectFit: "contain" }} />
                  </div>
                  <div style={{ textAlign: "right", paddingRight: "16px" }}>
                    <h2 style={{ margin: 0, fontSize: "14pt", fontWeight: 800, color: "#1e3a8a", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Livincart Furniture Agreement
                    </h2>
                    <p style={{ margin: "2px 0 0 0", fontSize: "8.5pt", color: "#64748b" }}>
                      support@livincart.com | www.livincart.com
                    </p>
                  </div>
                </div>
                <hr style={{ borderTop: "1.5px solid #1e3a8a", margin: "6px 0 16px 0" }} />

                {includeContract && (
                  <>
                    <div className="section-block">
                      <p style={S.body}>
                        This Livincart Work Agreement is made and entered into on this, (<strong>“Effective Date”</strong>),
                      </p>
                      <p style={S.body}>
                        This agreement is made on <strong>{date || "____________"}</strong> between <strong>{clientName}</strong> and <strong>LivinCart and Services Private Limited</strong> for the Furniture Design, supply, and installation work at <strong>{address}</strong>.
                      </p>
                    </div>

                    {/* Section 1 */}
                    <div className="section-block">
                      <h3 style={S.heading}>1. Parties</h3>
                      <p style={S.body}>
                        <strong>1.1</strong> This Agreement is executed between LivinCart and Services Private Limited ('Company') and the Client identified in the quotation or work order. The Parties acknowledge that this Agreement governs their contractual relationship for the supply, manufacture and installation of furniture.
                      </p>
                      <p style={S.body}>
                        <strong>1.2</strong> This Agreement shall automatically apply to all future quotations, purchase orders, approved variations and related project documents unless otherwise agreed in writing.
                      </p>
                      <p style={S.body}>
                        <strong>1.3</strong> Both Parties shall act in good faith, cooperate with each other, promptly provide information, approvals and access required for successful execution of the project, and comply with all applicable laws.
                      </p>
                    </div>

                    {/* Section 2 */}
                    <div className="section-block">
                      <h3 style={S.heading}>2. Definitions</h3>
                      <p style={S.body}>
                        <strong>2.1</strong> 'Products' means all furniture, accessories and components supplied by the Company.
                      </p>
                      <p style={S.body}>
                        <strong>2.2</strong> 'Services' include consultation, design, measurement, engineering, manufacturing, procurement, delivery, installation, testing and after-sales support.
                      </p>
                      <p style={S.body}>
                        <strong>2.3</strong> 'Project Documents' include quotations, BOQs, drawings, specifications, material schedules and written approvals.
                      </p>
                    </div>

                    {/* Section 3 */}
                    <div className="section-block">
                      <h3 style={S.heading}>3. Scope of Work</h3>
                      <p style={S.body}>
                        <strong>3.1</strong> The Company shall design, manufacture, procure, supply and install furniture as described in the approved quotation. The Company shall execute the work in a professional manner using industry-standard practices. Any work outside the agreed scope, including civil, electrical, plumbing or structural modifications, shall be treated as additional work and charged separately after written approval.
                      </p>
                      <p style={S.body}>
                        <strong>3.2</strong> The scope may include customized furniture, modular furniture, loose furniture and standard products.
                      </p>
                      <p style={S.body}>
                        <strong>3.3</strong> Items not specifically mentioned in the quotation shall be treated as exclusions unless added through a written Change Order.
                      </p>
                      <p style={S.body}>
                        <strong>3.4</strong> The Company may engage qualified subcontractors while remaining responsible for overall project execution.
                      </p>
                    </div>

                    {/* Section 4 */}
                    <div className="section-block">
                      <h3 style={S.heading}>4. Design and Approvals</h3>
                      <p style={S.body}>
                        <strong>4.1</strong> Production shall commence only after the Client approves drawings, dimensions, colours, fabrics, finishes and specifications. The Client shall carefully review all drawings before approval. Approved drawings shall be deemed final, and any subsequent modifications may require redesign, remanufacturing, additional costs and revised completion schedules.
                      </p>
                      <p style={S.body}>
                        <strong>4.2</strong> Any revision after approval shall require written confirmation and may affect price and delivery.
                      </p>
                      <p style={S.body}>
                        <strong>4.3</strong> The Company shall not be responsible for delays resulting from late approvals.
                      </p>
                    </div>

                    {/* Section 5 */}
                    <div className="section-block">
                      <h3 style={S.heading}>5. Materials and Specifications</h3>
                      <p style={S.body}>
                        <strong>5.1</strong> Materials shall conform to the approved quotation and specification schedule. Minor variations in colour, shade, texture, grain pattern and finish due to natural materials or manufacturing processes shall be commercially acceptable and shall not constitute a defect.
                      </p>
                      <p style={S.body}>
                        <strong>5.2</strong> Natural variations in wood grain, veneer, marble, leather, fabric or stone are inherent characteristics and shall not be considered defects.
                      </p>
                      <p style={S.body}>
                        <strong>5.3</strong> Equivalent substitute materials may be proposed only where the original material becomes unavailable and shall require Client approval.
                      </p>
                    </div>

                    {/* Section 6 */}
                    <div className="section-block">
                      <h3 style={S.heading}>6. CONTRACT VALUE AND PAYMENT TERMS</h3>
                      <h4 style={S.subHeading}>6.1 Contract Value</h4>
                      <p style={S.body}>
                        The total contract value for the scope of work described herein shall be <strong>₹{contractValue} ({contractValueWords})</strong>.
                      </p>
                      <p style={S.body}>
                        The Contract Value is <strong>all-inclusive</strong> and covers the cost of materials, labour, manufacturing, transportation, installation, Goods and Services Tax (GST), and all other applicable taxes, duties, and charges, unless otherwise expressly stated in writing.
                      </p>

                      <h4 style={S.subHeading}>6.2 Payment Milestones</h4>
                      <p style={S.body}>
                        The Customer shall make payments to the Company in accordance with the following milestone-based payment schedule:
                      </p>

                      <table style={S.table}>
                        <thead>
                          <tr style={S.thRow}>
                            <th style={S.th}>Payment Stage</th>
                            <th style={S.th}>Percentage</th>
                          </tr>
                        </thead>
                        <tbody>
                          {furniturePaymentSchedule.map((row, idx) => (
                            <tr key={idx} style={S.tr}>
                              <td style={S.td}>{row.stage}</td>
                              <td style={{ ...S.td, fontWeight: "bold", color: "#2563eb" }}>{row.percentage}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      <p style={S.body}>
                        <strong>6.1</strong> Payments shall be made strictly as per the agreed payment schedule. Failure to make payments as agreed may entitle the Company to suspend manufacturing, delivery or installation until outstanding dues are cleared, without affecting any other legal remedies available.
                      </p>
                      <p style={S.body}>
                        <strong>6.2</strong> GST and other applicable taxes shall be charged separately unless expressly included.
                      </p>
                      <p style={S.body}>
                        <strong>6.3</strong> Delayed payments may result in suspension of work, delayed delivery and applicable interest where legally permissible.
                      </p>
                      <p style={S.body}>
                        <strong>6.4</strong> Ownership of the furniture shall remain with the Company until full payment has been received.
                      </p>
                    </div>

                    {/* Section 7 */}
                    <div className="section-block">
                      <h3 style={S.heading}>7. Delivery and Installation</h3>
                      <h4 style={S.subHeading}>7.1 Delivery Schedule</h4>
                      <p style={S.body}>
                        The Company shall use reasonable efforts to manufacture, deliver and install the Products within the estimated timelines specified in the approved Quotation, Purchase Order or Delivery Schedule. The Parties acknowledge that all delivery and installation dates are estimates based on production schedules, material availability, transportation and other operational factors, and shall not constitute a guarantee unless expressly agreed in writing.
                      </p>
                      <p style={S.body}>
                        The Client shall provide safe and unrestricted access to the Project Site, adequate storage space, electricity, lighting, water (where required) and a safe working environment necessary for delivery and installation. Any delay arising from the Client's failure to provide site readiness, required approvals, access, utilities or cooperation, or due to the acts or omissions of third parties, shall entitle the Company to a reasonable extension of time for completion without incurring liability for such delay.
                      </p>

                      <h4 style={S.subHeading}>7.2 Site Readiness</h4>
                      <p style={S.body}>
                        The Client shall ensure that all civil, electrical, plumbing, flooring, painting, false ceiling, air-conditioning and other prerequisite works affecting installation have been completed prior to the scheduled delivery date. The Client shall also obtain all necessary permissions and provide uninterrupted access to enable timely execution of the work.
                      </p>
                      <p style={S.body}>
                        Where delivery or installation is delayed due to the Client's failure to ensure site readiness, the Company shall be entitled to recover any reasonable additional costs incurred, including storage, transportation, labour, remobilization or repeated site visits, provided such costs are properly documented and communicated to the Client.
                      </p>

                      <h4 style={S.subHeading}>7.3 Transfer of Risk and Title</h4>
                      <p style={S.body}>
                        The risk of accidental loss of or damage to the Products shall pass to the Client upon successful delivery at the Project Site or upon completion of installation and handover, whichever is applicable.
                      </p>
                      <p style={S.body}>
                        <strong>Notwithstanding the transfer of risk, ownership and title to the Products shall remain vested in the Company until the Client has made full payment of all amounts due under this Agreement.</strong>
                      </p>
                    </div>

                    {/* Section 8 */}
                    <div className="section-block">
                      <h3 style={S.heading}>8. Inspection and Acceptance</h3>
                      <h4 style={S.subHeading}>8.1 Inspection of Products</h4>
                      <p style={S.body}>
                        Upon completion of delivery and installation, the Client or the Client's authorized representative shall promptly inspect the Products to verify that they conform to the approved drawings, specifications, quantities and workmanship as set out in this Agreement. The Client shall conduct such inspection within a reasonable period and communicate any observations or discrepancies in writing to the Company.
                      </p>
                      <p style={S.body}>
                        If no written objections or deficiencies are reported within the inspection period specified under this Agreement, the Products shall be deemed to have been inspected, accepted and approved by the Client. Minor cosmetic variations, finishing touch-ups or defects that do not materially affect the quality, safety, functionality or intended use of the Products shall not constitute valid grounds for rejection, cancellation or withholding of payment and shall be rectified by the Company within a reasonable period.
                      </p>

                      <h4 style={S.subHeading}>8.2 Notification of Defects</h4>
                      <p style={S.body}>
                        The Client shall notify the Company in writing of any visible defects, shortages, damage or non-conformity within <strong>seven (7) calendar days</strong> from the date of delivery or installation. The written notice shall clearly specify the nature of the defect together with supporting photographs or other reasonable evidence, where applicable.
                      </p>
                      <p style={S.body}>
                        Failure to notify the Company within the prescribed period shall constitute conclusive evidence that the Products have been delivered in good condition and in accordance with the approved specifications.
                      </p>

                      <h4 style={S.subHeading}>8.3 Acceptance of Products</h4>
                      <p style={S.body}>
                        The Client's continued use, occupation, relocation, alteration or commercial use of the Products after delivery or installation, without raising any written objection within the prescribed inspection period, shall constitute unconditional acceptance of the Products.
                      </p>
                    </div>

                    {/* Section 9 */}
                    <div className="section-block">
                      <h3 style={S.heading}>9. Warranty</h3>
                      <h4 style={S.subHeading}>9.1 Warranty Coverage</h4>
                      <p style={S.body}>
                        The Company warrants that all Products supplied under this Agreement shall be free from manufacturing defects in material and workmanship for the warranty period specifically mentioned in the approved Quotation, Purchase Order, Work Order or Warranty Certificate (<strong>"Warranty Period"</strong>), commencing from the date of successful installation, handover or customer acceptance, whichever occurs earlier.
                      </p>

                      <h4 style={S.subHeading}>9.2 Warranty Exclusions</h4>
                      <p style={S.body}>
                        The warranty provided under this Agreement is limited exclusively to manufacturing defects and shall not apply to any defect, damage, deterioration or failure arising directly or indirectly from:
                      </p>
                      <ul style={S.ul}>
                        <li>Misuse, abuse, negligence or improper handling of the Products.</li>
                        <li>Normal wear and tear arising from ordinary usage over time.</li>
                        <li>Accidental damage, impact damage, scratches, dents, cracks or breakage caused by external force.</li>
                        <li>Water leakage, seepage, flooding, excessive moisture, humidity or prolonged exposure to liquids.</li>
                        <li>Fire, smoke, lightning, earthquake, cyclone, storm, flood or any other natural disaster or Force Majeure event.</li>
                        <li>Termite infestation, fungal growth, pest attack or rodent damage.</li>
                        <li>Exposure to corrosive chemicals, acids, solvents, cleaning agents, bleaching agents or abrasive materials.</li>
                        <li>Fading, discoloration or deterioration of fabrics, leather, veneers, laminates, polish, paint, coatings or finishes resulting from prolonged exposure to sunlight, UV radiation, heat or environmental conditions.</li>
                        <li>Variations in wood grain, veneer texture, marble patterns, natural stone, leather appearance, fabric weave or colour tone.</li>
                        <li>Improper installation, relocation, dismantling, modification or reinstallation carried out by unauthorized persons.</li>
                        <li>Unauthorized repairs, alterations, additions or modifications made without prior written approval.</li>
                        <li>Improper cleaning methods or inadequate maintenance.</li>
                        <li>Excessive loading, overloading or usage beyond intended design capacity.</li>
                        <li>Consumable items including light fittings, batteries, gas lifts, wheels, rubber pads, upholstery filling, etc.</li>
                      </ul>

                      <h4 style={S.subHeading}>9.3 Limitation of Warranty Obligation</h4>
                      <p style={S.body}>
                        The Company's obligations under this Warranty shall be strictly limited to the inspection, repair, replacement or rectification of the defective Product or component at the Company's sole discretion.
                      </p>
                    </div>

                    {/* Section 10 */}
                    <div className="section-block">
                      <h3 style={S.heading}>10. Change Orders</h3>
                      <p style={S.body}>
                        <strong>10.1</strong> Any request by the Client for changes to the approved scope of work shall be documented through a written <strong>Change Order</strong> duly approved by both Parties.
                      </p>
                      <p style={S.body}>
                        <strong>10.2 Effect of Change Orders:</strong> The Company reserves the right to revise the Contract Price, manufacturing schedule, delivery timeline and installation programme.
                      </p>
                    </div>

                    {/* Section 11 */}
                    <div className="section-block">
                      <h3 style={S.heading}>11. Cancellation and Refund</h3>
                      <p style={S.body}>
                        <strong>11.1 Cancellation of Orders:</strong> Orders for customized, made-to-order or specially manufactured Products shall not ordinarily be cancelled once procurement of materials or production has commenced. Where cancellation is accepted, the Client shall be liable for all costs and expenses incurred up to the date of cancellation.
                      </p>
                      <p style={S.body}>
                        <strong>11.2 Refunds:</strong> Refunds, where approved by the Company, shall be subject to deduction of all actual costs, expenses and liabilities incurred.
                      </p>
                    </div>

                    {/* Section 12 */}
                    <div className="section-block">
                      <h3 style={S.heading}>12. Liability and Disputes</h3>
                      <p style={S.body}>
                        <strong>12.1</strong> The Company's total liability shall not exceed the value of the affected products.
                      </p>
                      <p style={S.body}>
                        <strong>12.2</strong> Neither party shall be liable for indirect or consequential damages.
                      </p>
                      <p style={S.body}>
                        <strong>12.3</strong> This Agreement shall be governed by the laws of India and disputes shall be resolved through arbitration under the Arbitration and Conciliation Act, 1996.
                      </p>
                    </div>

                    {/* Section 13 */}
                    <div className="section-block">
                      <h3 style={S.heading}>13. Annexures</h3>
                      <p style={S.body}>
                        The following Annexures constitute an integral and inseparable part of this Agreement:
                      </p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", margin: "12px 0", fontSize: "9.5pt", fontWeight: 600, color: "#334155" }}>
                        <div>• Annexure A – Approved Quotation</div>
                        <div>• Annexure B – Bill of Quantities (BOQ)</div>
                        <div>• Annexure C – Approved Drawings</div>
                        <div>• Annexure D – Material and Finish Schedule</div>
                        <div>• Annexure E – Payment Schedule</div>
                        <div>• Annexure F – Delivery & Installation Schedule</div>
                        <div>• Annexure G – Warranty Certificate</div>
                        <div>• Annexure H – Handover Certificate</div>
                        <div>• Annexure I – Customer Acceptance Form</div>
                        <div>• Annexure J – Change Order Form</div>
                      </div>

                      <h4 style={S.subHeading}>Website Policies and Incorporation by Reference</h4>
                      <p style={S.body}>
                        The Client acknowledges that the Company's official website, <strong>www.livincart.com</strong>, contains additional policies, guidelines, procedures, warranty terms and product care instructions. In the event of any conflict, the provisions of this Agreement shall prevail.
                      </p>
                    </div>

                    {/* Signatures */}
                    <div className="section-block signature-block" style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid #cbd5e1" }}>
                      <h3 style={S.heading}>14. SIGNATURES</h3>
                      <p style={S.body}>
                        IN WITNESS WHEREOF, the Parties are acknowledged all policies and have executed this Agreement on the date first written above.
                      </p>

                      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 20, tableLayout: "fixed", pageBreakInside: "avoid", breakInside: "avoid" }}>
                        <tbody>
                          <tr>
                            <td style={{ width: "46%", verticalAlign: "top", textAlign: "left" }}>
                              <div style={{ fontWeight: 800, fontSize: "10pt", color: "#1e3a8a", marginBottom: 6 }}>Customer</div>
                              <div style={{ fontSize: "9.5pt", color: "#334155", margin: "4px 0" }}>Name: <strong>{clientName}</strong></div>
                              <div style={{ margin: "4px 0", height: "40px", display: "flex", alignItems: "center" }}>
                                {clientSignature ? (
                                  <img src={clientSignature} alt="Client Signature" style={{ height: "38px", maxWidth: "140px", objectFit: "contain" }} />
                                ) : (
                                  <span style={{ fontSize: "9.5pt", color: "#334155" }}>Signature: ______________________</span>
                                )}
                              </div>
                              <div style={{ fontSize: "9.5pt", color: "#334155", margin: "4px 0" }}>Date: {date}</div>
                            </td>
                            <td className="sig-spacer-td" style={{ width: "8%", border: "none !important", backgroundColor: "transparent", background: "transparent", padding: 0 }}>&nbsp;</td>
                            <td style={{ width: "46%", verticalAlign: "top", textAlign: "right" }}>
                              <div style={{ fontWeight: 800, fontSize: "10pt", color: "#1e3a8a", marginBottom: 6 }}>Company</div>
                              <div style={{ fontSize: "9.5pt", color: "#334155", margin: "4px 0" }}>Name: <strong>LivinCart and Services Pvt. Ltd.</strong></div>
                              <div style={{ margin: "4px 0", height: "40px", display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
                                <img src={OWNER_SIGNATURE_BASE64} alt="Livincart Owner Signature" style={{ height: "38px", maxWidth: "140px", objectFit: "contain" }} />
                              </div>
                              <div style={{ fontSize: "9.5pt", color: "#334155", margin: "4px 0" }}>Date: {date}</div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {/* ─── CONDITIONAL HANDOVER AGREEMENT MERGE (LIVINCART FURNITURE PROJECT HANDOVER AGREEMENT) ─── */}
                {includeHandover && (
                  <div style={{ pageBreakBefore: includeContract ? "always" : "auto", breakBefore: includeContract ? "page" : "auto", paddingTop: includeContract ? "20px" : "0px", marginTop: includeContract ? "30px" : "0px", borderTop: includeContract ? "2px dashed #cbd5e1" : "none" }}>
                    {/* Handover Header */}
                    <div style={S.lhRow}>
                      <div>
                        <img src={logo} alt="Livincart Logo" style={{ width: "110px", height: "auto", objectFit: "contain" }} />
                      </div>
                      <div style={{ textAlign: "right", paddingRight: "16px" }}>
                        <h2 style={{ margin: 0, fontSize: "11pt", fontWeight: 800, color: "#1e3a8a", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          Livincart Furniture Project
                        </h2>
                        <h3 style={{ margin: "2px 0 0 0", fontSize: "10pt", fontWeight: 700, color: "#2563eb" }}>
                          HANDOVER AGREEMENT
                        </h3>
                      </div>
                    </div>
                    <hr style={{ borderTop: "1.5px solid #1e3a8a", margin: "8px 0 16px 0" }} />

                    <p style={{ ...S.body, fontStyle: "italic", color: "#475569" }}>
                      Furniture Project Handover Agreement between LivinCart and Services Private Limited and the Client.
                    </p>

                    {/* Handover Section 1 */}
                    <div className="section-block">
                      <h3 style={S.heading}>1. Parties</h3>
                      <p style={S.body}>
                        This Interior/Furniture Project Handover Agreement ("Agreement") is entered into between <strong>LivinCart and Services Private Limited</strong> (hereinafter referred to as the <strong>"Company"</strong>), and the Client identified in the approved Works Contract, Quotation, or Purchase Order (hereinafter referred to as the <strong>"Client"</strong>).
                      </p>
                      <p style={S.body}>
                        The Parties acknowledge and agree that the Company has substantially completed the interior/furniture works, supplied and installed the Products and Services forming part of the approved scope of work, and is formally handing over the completed Project to the Client in accordance with the terms of the Works Contract, approved Project Documents, and this Agreement. The Client agrees to accept possession of the completed Project, subject to any pending rectification items specifically recorded in this Agreement.
                      </p>
                      <p style={S.body}>
                        This Agreement shall serve as conclusive evidence of the formal handover of the completed Project and shall govern the respective rights and obligations of the Parties arising after the date of handover.
                      </p>
                    </div>

                    {/* Handover Section 2 */}
                    <div className="section-block">
                      <h3 style={S.heading}>2. Project Details</h3>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", margin: "10px 0", padding: "12px", backgroundColor: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "9.5pt" }}>
                        <div><strong>Project ID:</strong> {refId || "___________"}</div>
                        <div><strong>Customer:</strong> {clientName || "___________"}</div>
                        <div style={{ gridColumn: "span 2" }}><strong>Address:</strong> {address || "___________"}</div>
                        <div><strong>Contract Value:</strong> ₹{contractValue || "___________"}</div>
                        <div><strong>Handover Date:</strong> {date || "___________"}</div>
                      </div>
                    </div>

                    {/* Handover Section 3 */}
                    <div className="section-block">
                      <h3 style={S.heading}>3. Scope of Furniture Handover</h3>
                      <p style={S.body}>
                        The Company confirms that the approved scope of supply, delivery, installation, and finishing of the furniture Products has been substantially completed in accordance with the approved Quotation, Purchase Order, Works Contract, approved drawings (where applicable), specifications, and any approved Change Orders.
                      </p>
                      <p style={S.body}>
                        The handover includes, as applicable, sofas, beds, wardrobes, dining tables, chairs, TV units, coffee tables, office furniture, modular furniture, storage units, customized furniture, hardware, accessories, and all other Products expressly included in the approved Project Documents.
                      </p>
                      <p style={S.body}>
                        The Client acknowledges that the handover is limited to the Products and Services specifically included in the approved quotation and related Project Documents. Any additional items, modifications, or services not approved in writing shall be deemed excluded from the Company's obligations.
                      </p>
                      <p style={S.body}>
                        The Parties further acknowledge that minor variations in colour, texture, grain, fabric pattern, finish, dimensions, or alignment that are consistent with accepted industry standards and do not affect the functionality, structural integrity, or intended use of the Products shall not constitute defects. Any agreed pending minor rectification items shall be recorded separately and completed within the mutually agreed timeline.
                      </p>
                    </div>

                    {/* Handover Section 4 */}
                    <div className="section-block">
                      <h3 style={S.heading}>4. Inspection, Testing & Acceptance</h3>
                      <p style={S.body}>
                        The Client acknowledges that, prior to the execution of this Agreement, a joint inspection of the supplied and installed furniture Products has been conducted by the Company and the Client. The inspection includes verification of the quantity, dimensions, finish, colour, material, workmanship, stability, alignment, functionality, hardware fittings, drawers, shutters, hinges, channels, locks, handles, upholstery, fabric, polish, laminate, veneer, and all other accessories included in the approved scope of supply.
                      </p>
                      <p style={S.body}>
                        The Client confirms that the furniture Products have been inspected and found satisfactory, except for any observations or minor punch-list items specifically recorded in writing. Such punch-list items shall not constitute grounds for rejection of the handover and shall be rectified by the Company within the mutually agreed timeline.
                      </p>
                      <p style={S.body}>
                        The Client further acknowledges that minor variations in colour, grain pattern, texture, fabric, finish, or dimensions that are inherent to natural or manufactured materials and are within accepted industry standards shall not be considered manufacturing defects. Upon execution of this Agreement, the Client accepts the completed furniture Products as being substantially in accordance with the approved Quotation, specifications, and Project Documents.
                      </p>
                    </div>

                    {/* Handover Section 5 */}
                    <div className="section-block">
                      <h3 style={S.heading}>5. Handover of Furniture</h3>
                      <p style={S.body}>
                        Upon execution of this Agreement, the Company hereby hands over peaceful possession of the completed furniture Products to the Client. The Client acknowledges receipt of all furniture items supplied and installed under the approved Quotation, Purchase Order, or Works Contract, together with the applicable warranty documents, invoices, product care and maintenance guidelines, user manuals (where applicable), and other relevant project documents.
                      </p>
                      <p style={S.body}>
                        The Client confirms that the furniture Products have been delivered and installed in accordance with the approved specifications and accepts possession of the same, subject to any punch-list or minor rectification items specifically recorded in writing. From the date of handover, the Client shall assume responsibility for the care, maintenance, and safe use of the furniture Products, subject to the terms of the applicable warranty.
                      </p>
                    </div>

                    {/* Handover Section 6 */}
                    <div className="section-block">
                      <h3 style={S.heading}>6. Warranty</h3>
                      <p style={S.body}>
                        The warranty for the Products and Services covered under the Project shall commence from the date of execution of this Handover Agreement, unless otherwise specified in the applicable Warranty Certificate. The warranty shall be governed by the terms of the Works Contract, Warranty Policy, and the manufacturer's warranty, where applicable.
                      </p>
                      <p style={S.body}>
                        The warranty covers manufacturing defects and workmanship deficiencies arising under normal use and maintenance, subject to the terms, conditions, exclusions, and limitations specified in the Warranty Policy. The warranty shall not apply to normal wear and tear, misuse, negligence, accidental damage, unauthorized modifications or repairs, improper maintenance, water seepage, electrical faults, pest infestation, force majeure events, or any damage caused by factors beyond the Company's reasonable control.
                      </p>
                    </div>

                    {/* Handover Section 7 */}
                    <div className="section-block">
                      <h3 style={S.heading}>7. Transfer of Possession & Ownership</h3>
                      <p style={S.body}>
                        Upon execution of this Agreement, the Company shall be deemed to have delivered, and the Client shall be deemed to have accepted, peaceful possession of all furniture Products supplied and installed under the approved Quotation, Purchase Order, or Works Contract.
                      </p>
                      <p style={S.body}>
                        From the date of handover, the risk of loss, damage, theft, misuse, deterioration, or destruction of the furniture Products shall pass to the Client, who shall thereafter be solely responsible for their care, maintenance, operation, and safekeeping. The Company shall not be liable for any damage or loss occurring after handover, except to the extent covered under the applicable warranty.
                      </p>
                      <p style={S.body}>
                        Notwithstanding the transfer of possession and risk, legal ownership and title to the furniture Products shall remain vested in the Company until the Client has paid in full all amounts due under the Works Contract, including the contract value, applicable taxes, approved variations, and any other outstanding dues. Upon receipt of full and final payment, ownership of the furniture Products shall automatically transfer to the Client without requiring any further act or documentation by either Party.
                      </p>
                    </div>

                    {/* Handover Section 8 */}
                    <div className="section-block">
                      <h3 style={S.heading}>8. Customer Responsibilities</h3>
                      <p style={S.body}>
                        Upon handover, the Client shall be responsible for the proper use, care, operation, and maintenance of all Products and completed works in accordance with the Company's Product Care Guide, Warranty Policy, and any maintenance instructions provided. The Client shall take reasonable precautions to protect the Products from misuse, negligence, accidental damage, water seepage, moisture, pest infestation, unauthorized alterations, or any other condition that may adversely affect their performance or durability.
                      </p>
                      <p style={S.body}>
                        The Client shall promptly notify the Company in writing of any defect or issue covered under the applicable warranty and shall provide the Company with reasonable access to inspect and rectify such defects. Failure to maintain the Products in accordance with the prescribed care instructions or any unauthorized repair, modification, or relocation of the Products may result in the warranty being limited or void to the extent permitted under the applicable warranty terms.
                      </p>
                    </div>

                    {/* Handover Section 9 */}
                    <div className="section-block">
                      <h3 style={S.heading}>9. Company Responsibilities</h3>
                      <p style={S.body}>
                        The Company shall, subject to the terms of the Works Contract and Warranty Policy, attend to valid warranty claims and complete any agreed punch-list or rectification items within a reasonable timeframe, subject to site access and material availability.
                      </p>
                      <p style={S.body}>
                        The Company shall use reasonable efforts to repair or replace defective Products or rectify workmanship defects covered under the applicable warranty. The Company shall not be liable for defects or damage arising from normal wear and tear, misuse, negligence, unauthorized modifications, improper maintenance, or any cause beyond its reasonable control. The Client shall provide reasonable access to the Project premises to enable inspection and completion of the required rectification works.
                      </p>
                    </div>

                    {/* Handover Section 10 */}
                    <div className="section-block">
                      <h3 style={S.heading}>10. Governing Law and Jurisdiction</h3>
                      <p style={S.body}>
                        This Agreement shall be governed by and construed in accordance with the laws of India. Any dispute, claim, or difference arising out of or relating to this Agreement, its interpretation, performance, breach, or termination shall, in the first instance, be resolved amicably through mutual discussions between the Parties.
                      </p>
                      <p style={S.body}>
                        If the Parties are unable to resolve the dispute amicably within a reasonable period, such dispute shall be subject to the exclusive jurisdiction of the competent courts at <strong>Visakhapatnam, Andhra Pradesh</strong>, without prejudice to any dispute resolution mechanism provided under the Works Contract or applicable law.
                      </p>
                    </div>

                    {/* Customer Declaration */}
                    <div className="section-block" style={{ marginTop: 24, padding: "14px", backgroundColor: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "6px" }}>
                      <h4 style={{ margin: "0 0 8px 0", fontSize: "10pt", fontWeight: 800, color: "#1e3a8a" }}>Customer Declaration</h4>
                      <p style={S.body}>
                        I hereby acknowledge that I have jointly inspected the completed Project and confirm that the Products and Services have been handed over to my satisfaction, subject to any observations or pending rectification items specifically recorded in this Agreement. I further acknowledge receipt of possession of the completed interior works, warranty documents, user manuals, keys (where applicable), invoices, and other relevant project documents.
                      </p>
                      <p style={{ ...S.body, marginTop: 6 }}>
                        I confirm that I have been informed of the applicable warranty terms, product care and maintenance guidelines, and my responsibilities after handover. I agree to comply with the terms of the Works Contract, Warranty Policy, and this Handover Agreement, and acknowledge that the Project has been formally handed over to me on the date of execution of this Agreement.
                      </p>
                    </div>

                    {/* Handover Signatures Table */}
                    <div className="section-block signature-block" style={{ marginTop: 24 }}>
                      <h4 style={{ margin: "0 0 10px 0", fontSize: "10pt", fontWeight: 800, color: "#1e3a8a" }}>Signatures</h4>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt", border: "1px solid #cbd5e1" }}>
                        <thead>
                          <tr style={{ backgroundColor: "#f1f5f9", color: "#1e3a8a", fontWeight: 800 }}>
                            <th style={{ padding: "8px 12px", border: "1px solid #cbd5e1", width: "50%", textAlign: "left" }}>LivinCart Authorized Signatory</th>
                            <th style={{ padding: "8px 12px", border: "1px solid #cbd5e1", width: "50%", textAlign: "left" }}>Client</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td style={{ padding: "10px 12px", border: "1px solid #cbd5e1", verticalAlign: "top" }}>
                              <div>Name: <strong>Janapareddy Madhu Satya Sai</strong></div>
                              <div style={{ margin: "6px 0", height: "38px", display: "flex", alignItems: "center" }}>
                                <img src={OWNER_SIGNATURE_BASE64} alt="Livincart Owner Signature" style={{ height: "36px", maxWidth: "140px", objectFit: "contain" }} />
                              </div>
                              <div>Date: {date}</div>
                            </td>
                            <td style={{ padding: "10px 12px", border: "1px solid #cbd5e1", verticalAlign: "top" }}>
                              <div>Name: <strong>{clientName}</strong></div>
                              <div style={{ margin: "6px 0", height: "38px", display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontSize: "9pt", fontWeight: 600, color: "#334155" }}>Signature: </span>
                                {clientSignature ? (
                                  <img src={clientSignature} alt="Client Signature" style={{ height: "36px", maxWidth: "140px", objectFit: "contain" }} />
                                ) : (
                                  <span>______________________</span>
                                )}
                              </div>
                              <div>Date: {date}</div>
                            </td>
                          </tr>
                          <tr>
                            <td style={{ padding: "8px 12px", border: "1px solid #cbd5e1" }}>
                              Witness 1: ______________________
                            </td>
                            <td style={{ padding: "8px 12px", border: "1px solid #cbd5e1" }}>
                              Witness 2: ______________________
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td style={{ padding: 0 }}>
                {/* Running Footer matching requested Livincart Headquarters address */}
                <div className="print-running-footer" style={{
                  marginTop: "20px",
                  paddingTop: "10px",
                  borderTop: "1px solid #cbd5e1",
                  textAlign: "center",
                  fontSize: "8.5pt",
                  color: "#475569",
                  lineHeight: "1.5",
                  backgroundColor: "#ffffff"
                }}>
                  <div><strong>Livincart Headquarters :</strong> 3rd floor, 30-15-35, above IDBI Bank, near Saraswati Park Road, Daba Gardens, Allipuram, Jct, Visakhapatnam, Andhra Pradesh 530020</div>
                  <div>Website : www.livincart.com</div>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

    </div>
  );
}

const S: { [key: string]: React.CSSProperties } = {
  document: {
    width: "100%",
    maxWidth: "100%",
    minHeight: "auto",
    margin: "0",
    backgroundColor: "#ffffff",
    padding: "0 12px",
    boxSizing: "border-box",
    boxShadow: "none",
    position: "relative"
  },
  lhRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },
  heading: {
    fontSize: "12pt",
    fontWeight: 800,
    color: "#1e3a8a",
    marginTop: "16px",
    marginBottom: "8px",
    borderBottom: "1px solid #e2e8f0",
    paddingBottom: "4px"
  },
  subHeading: {
    fontSize: "10.5pt",
    fontWeight: 700,
    color: "#1e293b",
    marginTop: "12px",
    marginBottom: "6px"
  },
  body: {
    fontSize: "9.5pt",
    lineHeight: "1.6em",
    color: "#334155",
    margin: "6px 0",
    textAlign: "left"
  },
  ul: {
    fontSize: "9pt",
    lineHeight: "1.5em",
    color: "#334155",
    paddingLeft: "20px",
    margin: "6px 0",
    pageBreakInside: "avoid",
    breakInside: "avoid"
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "9.5pt",
    margin: "12px 0",
    pageBreakInside: "avoid",
    breakInside: "avoid"
  },
  thRow: {
    backgroundColor: "#eff6ff",
    borderBottom: "1.5px solid #bfdbfe"
  },
  th: {
    padding: "8px 12px",
    textAlign: "left",
    fontWeight: 800,
    color: "#1e3a8a"
  },
  tr: {
    borderBottom: "1px solid #e2e8f0"
  },
  td: {
    padding: "8px 12px",
    color: "#334155"
  }
};
