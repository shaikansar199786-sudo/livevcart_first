import React from "react";
import stamp from "../assets/stamp.png";
import sig from "../assets/sig.png";
import logo from "../assets/Elegance Logo.png";

const FONT = "'Times New Roman', Times, Georgia, serif";

interface EleganceInteriorProps {
  clientName?: string;
  date?: string;
  contractValue?: string;
  contractValueWords?: string;
  completionDays?: string | number;
}

export default function EleganceInterior({
  clientName = "Mrs Kinnera",
  date = "",
  contractValue = "42,18,130",
  contractValueWords = "Forty Two Lakhs Eighteen Thousand One Hundred and Thirty",
  completionDays = "120",
}: EleganceInteriorProps) {
  const paymentSchedule = [
    { pct: "40%", desc: "As Advance" },
    { pct: "30%", desc: "On completion of bare wood work" },
    { pct: "25%", desc: "On fixing of laminates/acrylics" },
    { pct: "05%", desc: "On Completion of the project" },
  ];

  const otherConditions = [
    "Royalty or any securities to the Building Management to carry on work shall be borne by the CLIENT.",
    "Formalities related to entry pass of workers and materials shall be provided by the CLIENT.",
    "Scope of works (inclusions and Exclusions) are listed as per annexure.",
    "The Client will issue a quotation for any work beyond the scope of work and payment will be made separately. Any Extra Area/Work introduced during the work within the residence premises will be considered work beyond the scope and payment for the same will be made separately along with the review in time extension.",
    "CLIENT will provide all approvals within 02 working days. Any delay in providing approvals by the CLIENT shall be considered for extra time schedule duly conveyed.",
    "CLIENT will grant additional days in the set schedule in case of changes in the approved layout plan.",
    "Public holidays and force majeure if any are excluded from the working day schedule.",
  ];

  return (
    <div style={{ padding: "24px 0", backgroundColor: "#f5f5f5" }}>
      {/* ─── PAGE 1 ─── */}
      <div style={S.page}>
        {/* Letterhead */}
        <div style={S.lhRow}>
          <div style={S.lhLeft}>
            {/* Empty left side */}
          </div>
          <div style={S.lhRight}>
            <img src={logo} alt="Elegance Logo" style={{ width: "90%", maxWidth: 180, float: "right" }} />
            <div style={{ clear: "both" }}></div>
          </div>
        </div>
        <hr style={{ borderTop: "1.5px solid #555", margin: "6px 0 14px" }} />

        {/* Title */}
        <p style={{ ...S.centered, fontWeight: "bold", fontSize: "13pt", marginBottom: 6 }}>
          AGREEMENT FOR INTERIOR DESIGNING
        </p>

        {/* Date + Parties */}
        <p style={S.body}>
          THIS AGREEMENT is made at Visakhapatnam on the <strong>{date || "____________"}</strong>.
        </p>
        <br />
        <p style={S.body}>
          <strong>BETWEEN</strong>
        </p>
        <p style={S.body}>
          <strong>{clientName}</strong>, hereinafter called as the "CLIENT"
        </p>
        <br />
        <p style={S.body}>
          <strong>AND</strong>
        </p>
        <p style={S.body}>
          <strong>M/S Elegance Interior Works</strong>, is represented by its Managing Director Mr ROHIT KANNAGATHA, hereinafter referred to as the "CONTRACTOR" which expression shall, unless it be repugnant to the context or meaning thereof, be deemed to mean and include its successors and assigns) of the other part.
        </p>
        <br />
        <p style={S.body}>
          NOW IT IS AGREED BY AND BETWEEN THE PARTIES AS FOLLOWS:
        </p>
        <br />

        {/* Clause 1 */}
        <p style={S.clause}><strong>1. Scope of Work:</strong></p>
        <p style={S.justify}>
          That the CONTRACTOR shall carry out Interior Design, fabrication, erection of internal
          structures and renovation of the existing flat of <strong>{clientName}</strong>, hereinafter referred to as the SITE, on the terms and conditions
          herein contained and Schedule of rates and plan, and instructions to be given by and
          under the supervision of and to the entire satisfaction of the client and their
          authorized representatives at Visakhapatnam. The description of the work and terms of
          the contract are as under:
        </p>
        <br />

        {/* Clause 2 */}
        <p style={S.clause}><strong>2. Description of Work, Quantity, Rate, and Contract Value:</strong></p>
        <p style={S.justify}>
          The total contract value of the work is{" "}
          <strong>Rs. {contractValue}/- (Rupees {contractValueWords} only)</strong> plus 18% GST extra.
          A detailed description of the work is placed in Annexure - A.
        </p>
        <br />

        {/* Clause 3 */}
        <p style={S.clause}><strong>3. Period for Completion of Work:</strong></p>
        <p style={S.justify}>
          The CONTRACTOR hereby agrees to complete total interior works as described in the
          agreement and annexure within a period of <strong>{completionDays} days</strong> starting on
          the next day of issuance of the purchase order along with the advance amount.
        </p>
        <br />

        {/* Clause 4 */}
        <p style={S.clause}><strong>4. Inspection of Site:</strong></p>
        <p style={S.justify}>
          The CONTRACTOR confirms that he/they has/have inspected the SITE before submitting the
          proposal and has satisfied himself as to the nature of the work to be executed on the
          site. Any difficulties which the CONTRACTOR may come across in the course of the work
          shall neither in any way relieve him from fulfilling the terms of this agreement nor
          entitle him to claim or receive extra payment unless the client and their authorized
          representatives are of the opinion that such difficulties could not have been foreseen.
        </p>
      </div>

      {/* ─── PAGE 2 ─── */}
      <div style={S.page}>
        {/* Clause 5 */}
        <p style={S.clause}><strong>5. Supply of Material / Labour:</strong></p>
        <p style={S.justify}>
          The CONTRACTOR agrees to furnish all labour, materials, equipment, tools, tackles, &amp;
          everything necessary for the construction &amp; completion of the interior work. The
          CONTRACTOR will assume all responsibility for the safety, protection &amp; accounting of
          all material/equipment supplied to the CLIENT &amp; the work during construction. The
          details &amp; dimensions shown on the plan shall be adhered to by the CONTRACTOR &amp; no
          alteration shall be made therein by the Contractor without obtaining previous approval
          from the CLIENT and their authorized representative.
        </p>
        <p style={{ ...S.body, marginTop: 8 }}>
          All materials supplied by the CONTRACTOR shall be as per the approved brand and grade
          mentioned in Annexure-A.
        </p>
        <br />

        {/* Clause 6 */}
        <p style={S.clause}><strong>6. Damage on Account of Incomplete Work or Delay:</strong></p>
        <p style={S.justify}>
          The Contractor agreed to commence the work immediately on receiving written instructions
          along with the receipt of Advance to that effect. The work will be progressed in
          accordance with the agreed schedule and the whole work shall be completed and handed
          over ready for use within a separately agreed time period from the date of commencement
          of work (time being of the essence), failing which the Contractor shall pay or allow
          the Client to deduct an amount of 1% to a maximum of 3% of the actual Contract value
          of Operation Area for each late day for extra time taken until the work is completed
          and handed over. Such damages may be deducted by the Client from any money due to the
          Contractor. The client shall allow a grace period of a maximum of 07 days before he
          levies the penalty.
        </p>
        <br />

        {/* Clause 7 */}
        <p style={S.clause}><strong>7. Termination of Contract:</strong></p>
        <p style={S.justify}>
          The CONTRACTOR agreed that in the event of the CONTRACTOR failing to keep to the
          agreed schedule of work, or in the event of the CONTRACTOR failing to complete the
          work within the stipulated period or absence/discontinuation of work by the CONTRACTOR,
          the CLIENT may notwithstanding the provisions in Clause 4 above, terminate this
          agreement forthwith and employ at the Contractor's cost, another contractor or a
          sufficient number of workmen to complete the work in which event the damages specified
          in Clause 6 above shall not apply from the date this agreement is terminated.
        </p>
        <br />

        {/* Clause 8 */}
        <p style={S.clause}><strong>8. Defective Work / Materials:</strong></p>
        <p style={S.justify}>
          If any part of the work done by the CONTRACTOR shall be found defective in workmanship
          or if bad or inferior materials have been used, the CONTRACTOR shall at his own risk
          and costs demolish all such defective work and rebuild the same and/or replace the bad
          or inferior materials used, to the satisfaction of the CLIENT and their authorized
          representatives. The decision of the CLIENT in this regard shall be final and binding
          on the CONTRACTOR. In case of default of the CONTRACTOR to remove the defective work
          and rebuild the same or replace the bad or inferior materials as aforesaid, as directed
          by the CLIENT, the CLIENT shall be entitled to employ anyone else to carry out the same
          and recover all expenses incurred in this regard from the CONTRACTOR.
        </p>
      </div>

      {/* ─── PAGE 3 ─── */}
      <div style={S.page}>
        {/* Clause 9 */}
        <p style={S.clause}><strong>9. Inspection of Work:</strong></p>
        <p style={S.justify}>
          During the progress of the work, the CLIENT or any other representative of the CLIENT
          and Architect shall be entitled at all times to have access to and inspect the work.
        </p>
        <br />

        {/* Clause 10 */}
        <p style={S.clause}><strong>10. Supervision:</strong></p>
        <p style={S.justify}>
          The CONTRACTOR shall provide one or more competent and technical supervisors duly and
          fully authorized to act on his behalf in all matters relating to the works to be
          carried out under or any other matter concerning this agreement.
        </p>
        <br />

        {/* Clause 11 – Payment */}
        <p style={S.clause}><strong>11. Payment for Work Done:</strong></p>
        <p style={S.justify}>
          During the progress of the work, the CONTRACTOR, at the sole discretion of the CLIENT
          and their authorized representatives may receive interim payment proportionate to the
          amount of work performed, after such work has been inspected and approved by such
          representative. The payment schedule is as under:
        </p>
        <table style={S.table}>
          <tbody>
            {paymentSchedule.map((row, i) => (
              <tr key={i}>
                <td style={{ ...S.td, width: 80, fontWeight: "bold" }}>{row.pct}</td>
                <td style={S.td}>{row.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ ...S.body, marginTop: 8 }}>
          The CLIENT will release payment within 04 days of receipt of the invoice after proper
          approval.
        </p>
        <p style={{ ...S.body, marginTop: 8 }}>
          The CONTRACTOR must submit his final bills in duplicate based on measurements jointly
          recorded by the CLIENT and their authorized representatives and with the CONTRACTOR's
          authorized Representative. All payments against the bill will be made by Cheque/Pay
          Order or Bank Transfer and such payments shall be subject to deduction of income tax
          as may be applicable from time to time.
        </p>
        <p style={{ ...S.body, marginTop: 8 }}>
          The CLIENT in consideration of the CONTRACTOR constructing and carrying out the work
          shall pay the CONTRACTOR at the rates given in the attached Schedule, subject to
          deductions, retention, and abatements if any to be made there-from. The payment in all
          cases will be in accordance with the actual quantities, based on the measurements
          as specified in Clause 9 above recorded by the CLIENT's Authorised Representative.
        </p>
        <br />

        {/* Clause 12 – Other Conditions */}
        <p style={S.clause}><strong>12. Other Conditions:</strong></p>
        {otherConditions.map((cond, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, fontFamily: FONT, fontSize: "11pt", textAlign: "justify" }}>
            <span style={{ minWidth: 20 }}>{i + 1}.</span>
            <span>{cond}</span>
          </div>
        ))}
        <br />

        {/* Clause 13 */}
        <p style={S.clause}><strong>13. Force Majeure:</strong></p>
        <p style={S.justify}>
          The parties to this agreement shall not be responsible for any failure of performance or delay in performance of their obligations hereunder if such failure or delay shall be a result of any Government directive relevant to this agreement or due to war, hostility, act of public enemy riots or civil commotion, strikes, lock-out, fire, floods, epidemic or acts of God, arrests, and restraints of rulers and people, political or administrative acts of recognized or defector governments, import or export restriction compliance with orders of any governmental/local authority or any other cause or causes beyond their control.
        </p>
      </div>

      {/* ─── PAGE 4: SIGNATURES ─── */}
      <div style={S.page}>
        <p style={{ fontFamily: FONT, fontSize: "12pt", fontWeight: "bold", marginBottom: 40, textAlign: "center" }}>
          IN WITNESS WHEREOF the parties hereto have signed this agreement on the date first
          mentioned above.
        </p>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 100 }}>
          <div style={{ width: "45%", textAlign: "center" }}>
            <div style={{ borderTop: "1px solid #333", paddingTop: 8, fontFamily: FONT, fontSize: "11pt" }}>
              <p style={{ margin: 0, fontWeight: "bold" }}>CLIENT</p>
              <p style={{ margin: "4px 0 0" }}>{clientName}</p>
              <p style={{ margin: "4px 0 0" }}>Date: {date || "____________"}</p>
            </div>
          </div>
          <div style={{ width: "45%", textAlign: "center", position: "relative" }}>
            <div style={{ position: "absolute", top: -80, left: 0, right: 0, textAlign: "center" }}>
              <img src={sig} alt="Signature" width="25%" style={{ verticalAlign: "bottom" }} />
              <img src={stamp} alt="Stamp" width="20%" style={{ verticalAlign: "bottom", marginLeft: 10 }} />
            </div>
            <div style={{ borderTop: "1px solid #333", paddingTop: 8, fontFamily: FONT, fontSize: "11pt" }}>
              <p style={{ margin: 0, fontWeight: "bold" }}>CONTRACTOR</p>
              <p style={{ margin: "4px 0 0" }}>Elegance Interior Designing</p>
              <p style={{ margin: "4px 0 0" }}>Date: {date || "____________"}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Styles ── */
const S: Record<string, React.CSSProperties> = {
  page: {
    width: "210mm",
    minHeight: "270mm",
    margin: "0 auto 12px",
    padding: "0mm 20mm 10mm 0mm",
    background: "#fff",
    boxSizing: "border-box",
    fontSize: "11pt",
    lineHeight: 1.65,
    color: "#111",
  },
  lhRow: { display: "flex", alignItems: "flex-start", marginBottom: 1 },
  lhLeft: { flex: "0 0 10%", paddingTop: 4 },
  lhRight: { flex: 1, textAlign: "right" },
  firmName: { fontFamily: "'Palatino Linotype','Book Antiqua',Georgia,serif", fontSize: "17pt", fontStyle: "italic", margin: "0 0 1px", lineHeight: 1.2 },
  firmTag: { fontFamily: FONT, fontSize: "9pt", fontWeight: "bold", letterSpacing: "0.8px", margin: "2px 0 8px" },
  contact: { fontFamily: FONT, fontSize: "9pt", margin: 0, lineHeight: 1.5 },
  centered: { fontFamily: FONT, textAlign: "center", margin: "1 px 0" },

  body: { fontFamily: FONT, fontSize: "11pt", margin: "0 0 4px" },
  justify: { fontFamily: FONT, fontSize: "11pt", textAlign: "justify", margin: "0 0 8px", lineHeight: 1.7 },
  clause: { fontFamily: FONT, fontSize: "11pt", margin: "14px 0 6px", textDecoration: "underline" },
  table: { width: "100%", borderCollapse: "collapse", fontFamily: FONT, fontSize: "11pt", margin: "10px 0" },
  td: { border: "1px solid #555", padding: "6px 12px", verticalAlign: "top" },
};
