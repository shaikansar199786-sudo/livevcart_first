import React from "react";
/* ═══════════════════════════════════════════════════════════════════════════
   Livincart Architects – Interior Design Contract
   Exact replica of Contract_interior_3_.docx
   Fixed: 2.01–2.14 numbering + proper indent alignment (matches images)
   ═══════════════════════════════════════════════════════════════════════════ */

export default function InteriorConsultation({
  clientName = "Ms Mahalakshmi",
  salutation = "Mam",
  refId = "PR_01/06-01-26/01",
  date = "",
  feeAmount = "Rs 4,50,000.00 (Four Lakhs Fifty Thousand only)",
  address = "",
  place = "",
  paymentStages = [],
  totalPercentage = "100%",
}) {
  return (
    <div style={S.root}>

      {/* PAGE 1 ─ Letterhead + Scope */}
      <Page>
        <Letterhead refId={refId} />

        <p style={S.title}>
          TERMS AND CONDITIONS FOR ENGAGEMENT FOR<br />
          COMPREHENSIVE INTERIOR DESIGN SERVICES
        </p>

        <p style={S.body}>To,</p>
        <p style={S.body}>{clientName}</p>
        {address && <p style={S.body}>{address}</p>}
        <br />
        <p style={S.body}>Dear {salutation},</p>
        <br />
        <p style={S.justify}>
          Thank you for showing confidence in us for designing of the interiors of your residence;
          kindly find the terms of contract below. Feel free to call for any query.
        </p>

        {/* ── 1. SCOPE OF WORK (bullet list, matches image 2) */}
        <div style={S.secRow}>
          <span style={S.secNum}>1.</span>
          <span style={S.secHeadText}>SCOPE OF WORK:</span>
        </div>
        <ul style={S.bul}>
          {[
            "Taking Client Instructions and preparing an initial project brief.",
            "Fixed and moveable furniture layout",
            "Services plans – Plumbing and drainage, Electrical and AC layouts.",
            "Preliminary interior Concept presentation showing the approach to design.",
            "Flooring Plans – comprises preparing flooring layout and selection of flooring material. Ceiling design plans – comprises design of ceiling and specification of materials.",
            "Lighting design – comprises design of lighting plan, selection of fixtures.",
            "Interior schemes for each room with 3d views from different angles.",
            "Working drawings for execution of interior works.",
            "Planning the project schedule and ensure the work is carried out accordingly.",
            "Select samples and get them approved by the client before finalizing them.",
            "Periodic supervision on site to ensure that the execution is happening as per the design and informing the client accordingly.",
            "Selection of Artifacts and soft furnishings like curtains, cushions, carpets, bedspreads, decorative items, paintings, table lamps, floor lamps etc.",
          ].map((t, i) => <li key={i} style={S.bli}>{t}</li>)}
        </ul>
      </Page>

      {/* PAGE 2 ─ Schedule of Services 2.01–2.14 */}
      <Page>
        <div style={S.secRow}>
          <span style={S.secNum}>2.</span>
          <span style={S.secHeadText}>SCHEDULE OF SERVICES:</span>
        </div>
        <p style={{ ...S.justify, marginBottom: 14 }}>
          After taking instructions from the Client, we shall render the following services:
        </p>

        {/* CONCEPT DESIGN */}
        <p style={S.stageHead}>CONCEPT DESIGN</p>
        <NR n="2.01">
          Ascertain Client's requirements, examine site constraints &amp; potential and
          prepare a design brief for Client's approval.
        </NR>
        <NR n="2.02">
          Prepare conceptual design with reference to requirements given and prepare rough
          estimate of cost on area basis.
        </NR>

        {/* PRELIMINARY DESIGN */}
        <p style={S.stageHead}>PRELIMINARY DESIGN AND DRAWINGS:</p>
        <NR n="2.03">
          Modify the conceptual designs incorporating required changes and prepare the
          preliminary drawings, etc., for the Client approval along with preliminary
          estimate of cost on area basis.
        </NR>

        {/* WORKING DRAWINGS */}
        <p style={S.stageHead}>WORKING DRAWINGS AND TENDER DOCUMENTS:</p>
        <NR n="2.04">
          Prepare working drawings, specifications and schedule of quantities sufficient to
          prepare estimate of cost and tender documents including code of practice covering
          aspects like mode of measurement, method of payments, quality control procedure
          on materials &amp; works and other conditions of contract.
        </NR>

        {/* APPOINTMENT */}
        <p style={S.stageHead}>APPOINTMENT OF CONTRACTORS:</p>
        <NR n="2.05">Advise client on appointment of contractors.</NR>

        {/* CONSTRUCTION STAGE */}
        <p style={S.stageHead}>CONSTRUCTION STAGE:</p>
        <NR n="2.10">
          Prepare and issue working drawings and details of proper execution of works
          during construction.
        </NR>
        <NR n="2.11">Approve samples of various elements and components.</NR>
        <NR n="2.12">
          Check and approve shop drawings submitted by the contractor/ vendors.
        </NR>
        <NR n="2.13">
          Visit of Architect or junior staff at the site of work, as per requirement of
          the site to evaluate the construction works and where necessary clarify any
          decision, offer interpretation of the drawings/ specification, attend conferences
          and meetings to ensure that the project proceeds generally in accordance with
          condition of contract and keep the client informed and render advice on actions,
          if required.
        </NR>
        <NR n="2.14">
          In order to ensure that the work at site proceeds in accordance with the contract
          documents/ drawings and to exercise time and quality controls, the day-to-day
          supervision will be carried out by a Construction Manager/ Site supervisor, who
          shall work under the guidance and direction of the architect and shall be
          appointed and paid by the client.
        </NR>
      </Page>

      {/* PAGE 3 ─ Fees & Payment */}
      <Page>
        <p style={S.secHead}>3.&nbsp;&nbsp;PROFESSIONAL FEE AND PAYMENT STAGES:</p>
        <p style={S.stageHead}>PROFESSIONAL FEE:</p>

        <NR n="3.01">
          A lump sum of {feeAmount} shall be charged as a design and co-ordination fee in
          consideration of the professional services rendered.
        </NR>
        <NR n="3.02">18% GST extra.</NR>

        <p style={{ ...S.stageHead, marginTop: 10 }}>3.03&nbsp;&nbsp;PAYMENT STAGES</p>

        <table style={S.tbl}>
          <thead>
            <tr>
              <th style={{ ...S.th, width: "16%" }}>STAGE</th>
              <th style={{ ...S.th, width: "58%" }}>DESCRIPTION</th>
              <th style={{ ...S.th, width: "26%", textAlign: "center" }}>ARCHITECT'S FEE</th>
            </tr>
          </thead>
          <tbody>
            {paymentStages.map((s, i) => (
              <tr key={i} style={{ pageBreakInside: "avoid" }}>
                <td style={{ ...S.td, fontWeight: "bold" }}>{s.stage}</td>
                <td style={S.td}>{s.description}</td>
                <td style={{ ...S.td, textAlign: "center" }}>{s.percentage}</td>
              </tr>
            ))}
            <tr>
              <td style={S.td}></td>
              <td style={{ ...S.td, fontWeight: "bold" }}>Total</td>
              <td style={{ ...S.td, fontWeight: "bold", textAlign: "center" }}>{totalPercentage}</td>
            </tr>
          </tbody>
        </table>

        <p style={S.secHead}>4.&nbsp;&nbsp;EFFECTING PAYMENT TO THE ARCHITECT:</p>
        <NR n="4.1">
          Progressive, on account, payments shall be made by the Client against any of the
          above stages based on the quantum work done during that stage, as may be mutually
          agreed to between the Client and the Architect.
        </NR>

        <NR n="4.2.1">
          No deductions shall be made from the Architectural fee on account of penalty,
          liquidated damages, part rates or other sums withheld from payment or recovered
          from contractors/ suppliers.
        </NR>
        {/* <ul style={S.bul}>
          <li style={S.bli}>
            No deductions shall be made from the Architectural fee on account of penalty,
            liquidated damages, part rates or other sums withheld from payment or recovered
            from contractors/ suppliers.
          </li>
        </ul> */}
      </Page>

      {/* PAGE 4 ─ Client & Architect Responsibilities */}
      <Page>
        <p style={S.secHead}>5.&nbsp;&nbsp;CLIENT'S ROLE AND RESPONSIBILITIES:</p>
        <p style={S.justify}>
          The Client shall discharge all his obligations with the project and engagement of
          the Architect as follows:
        </p>
        <ul style={S.bul}>
          {[
            "To provide detailed requirements of the project.",
            "To provide property lease/ ownership documents.",
            "To provide a site plan, to a suitable scale, showing boundaries, contours at suitable intervals, existing physical features including any existing roads, paths, trees, existing service and utility lines and such lines to which the proposed service can be connected. In case such information is not readily available, the client shall arrange the survey/ collection of necessary information and pay for the same.",
            "To furnish specific conditions/ Statutory/ stipulation/ Codes of Practice/ Schedule of rates, etc., desired to be followed.",
            "To pay all the fees, levies, security deposits and expenses in respect of statutory sanction.",
            "To give effect to the professional advice of the Architect and cause no changes in the drawings and documents without the consent of the Architect.",
            "To honor Architect's bills within 5 days of its submission.",
            "To appoint a Construction Manager (Clerk of the works/ Site Supervisor or Construction Management Agency) as per the architect's advice.",
          ].map((t, i) => <li key={i} style={S.bli}>{t}</li>)}
        </ul>

        <p style={S.secHead}>6.&nbsp;&nbsp;REIMBURSABLE EXPENSES:</p>


        <p style={S.justify}>
          The Client will reimburse the following expenses incurred by him for discharge of
          his obligations:
        </p>
        <NR n="6.1">
          Cost of presentation models or walkthrough prepared at the instance of the Client.
        </NR>
        <NR n="6.2">
          All Out of the pocket expenses like, travel boarding &amp; lodging outside Visakhapatnam if required shall be paid as per actual, subject to prior approval by client and Rs 1500/- per day as outstation charges.
        </NR>



        <p style={S.secHead}>7.&nbsp;&nbsp;ARCHITECT'S ROLE AND RESPONSIBILITIES:</p>
        <ul style={S.bul}>
          {[
            "Keeping the Client informed about the progress of work in his office.",
            "Appointing specialized consultants in the construction with the client, if necessary.",
            "Taking responsibility for the direction and integration of the consultants work. The consultants however shall be fully responsible for the calculations, the detailed design and periodic inspection and evaluation of the work entrusted to them.",
            "Advising to the Client, on the Time Schedule (Bar Chart/ PERT/ CPM Network) prepared by the contractors for the completion of work, if required.",
            "Supplying to the Client, free of cost, up to two sets of drawings at different stages.",
            "Not making any deviations, alterations or omissions from the approved drawings, involving financial implications without prior consent of the Client.",
            "Any professional services to be rendered at the instance of the Client after agreed project completion period shall be compensated for, on mutually agreed terms.",
            "Exercising all reasonable skill, care and diligence in the discharge of his duties and shall exercise such general superintendence and inspection as may be necessary to ensure that works are being executed in accordance with the condition of the contract.",
            "Any revision in the drawings, tenders and documents, once approved, required to be made by the Client shall be compensated as additional services rendered and paid for @ 50% of the fee prescribed for the relevant stage(s).",
            "No change shall be made in the approved drawings and specifications at site without the consent of the Architect.",
            "Any curtailment of the professional services, beyond intermediate stage, shall make it obligatory for the Client to pay at least 20% of the fee for the remaining Stage(s) of the curtailed work/ services.",
          ].map((t, i) => <li key={i} style={S.bli}>{t}</li>)}
        </ul>
      </Page>

      {/* PAGE 5 ─ Copyright & Sign-off */}
      <Page>
        <p style={S.secHead}>OWNERSHIP OF COPYRIGHT:</p>
        <p style={S.justify}>
          Architectural design is an intellectual property of the Architect. The drawings,
          specifications, documents and models as instruments of service are the property of
          the architect whether the project, for which they are made, is executed or not. The
          Client shall retain copies of the Architect's models, drawings, specifications and
          other documents for his information and use in connection with the project. The
          Client or the Architect or any other person, shall not use these for any other
          project.
        </p>

        <div style={S.thankWrap}>
          <p style={{ margin: "0 0 20px 0" }}>Thanking you,</p>
          {/* <img src={sig} alt="" width="10%" /> */}
          <p style={{ margin: "0 0 10px 0" }}>Yours faithfully,</p>
        </div>

        <div style={{ marginTop: 28 }}>
          <div style={S.signRow}>
            <span style={S.sLabel}>Name of the Architect</span>
            <span style={S.sColon}>:</span>
            <span><strong>Livincart Architects and Interior Designers</strong></span>
          </div>

          <div style={S.signRow}>
            <span style={S.sLabel}>Date</span>
            <span style={S.sColon}>:</span>
            <span>{date}</span>
          </div>

          <div style={S.signRow}>
            <span style={S.sLabel}>Place</span>
            <span style={S.sColon}>:</span>
            <span>{place}</span>
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={S.signRow}>
              <span style={S.sLabel}>Seal of the Architect</span>
              <span style={S.sColon}>:</span>
              <span></span>
            </div>
          </div>
        </div>

        <p style={{ fontWeight: "bold", marginTop: 32, marginBottom: 16 }}>ACCEPTED</p>
        <div style={{ ...S.signRow, marginBottom: 12 }}>
          <span style={S.sLabel}>Signature of the Client</span>
          <span style={S.sColon}>:</span>


        </div>

        <div style={{ ...S.signRow, marginBottom: 12 }}>
          <span style={S.sLabel}>Name of the Client</span>
          <span style={S.sColon}>:</span>
          <span>{clientName}</span>
        </div>

        <div style={{ ...S.signRow, marginBottom: 12 }}>
          <span style={S.sLabel}>Address of the Client</span>
          <span style={S.sColon}>:</span>
          <span>{address}</span>
        </div>

        <div style={S.bankBox}>
          <p style={{ fontWeight: "bold", margin: "0 0 2px 0" }}>Bank Details:</p>
          <p style={{ fontWeight: "bold", margin: 0 }}>LIVINCART ARCHITECTS AND INTERIOR DESIGNERS</p>
          <p style={{ fontWeight: "bold", margin: 0 }}>A/c No.: 000000000</p>
          <p style={{ fontWeight: "bold", margin: 0 }}>IFSC: ICIC0000000</p>
          <p style={{ fontWeight: "bold", margin: 0 }}>HSL Complex Branch</p>
        </div>
      </Page >

    </div >
  );
}

/* ─── Sub-components ──────────────────────────────────────────────────────── */
function Page({ children }) {
  return <div style={S.page}>{children}</div>;
}

/**
 * Numbered row — exactly like image 1:
 *   2.03    <indented justified text>
 */
function NR({ n, children }) {
  return (
    <div style={S.nr}>
      <span style={S.nrN}>{n}</span>
      <span style={S.nrT}>{children}</span>
    </div>
  );
}

function Letterhead({ refId }) {
  return (
    <div style={S.hdrRow}>
      <div style={S.hdrLeft}>
        <p style={S.ref}>REF: {refId}</p>
      </div>
      <div style={S.hdrRight}>
        {/* <svg width="200" height="52" viewBox="0 0 340 70"
          style={{ display: "block", marginLeft: "auto", marginBottom: 2 }}>
          <circle cx="8"   cy="35" r="5" fill="#111"/>
          <line x1="16"  y1="35" x2="88"  y2="35" stroke="#111" strokeWidth="2"/>
          <line x1="188" y1="35" x2="260" y2="35" stroke="#111" strokeWidth="2"/>
          <circle cx="268" cy="35" r="5" fill="#111"/>
          <polyline points="94,52 94,32 106,19 118,32 118,52"
            fill="none" stroke="#111" strokeWidth="2.5" strokeLinejoin="round"/>
          <circle cx="106" cy="17" r="4" fill="none" stroke="#111" strokeWidth="2"/>
          <text x="130" y="56"
            fontFamily="'Palatino Linotype','Palatino','Book Antiqua',Georgia,serif"
            fontSize="44" fontWeight="400" letterSpacing="2" fill="#111">Livincart</text>
        </svg> */}

        <p style={S.firmName}>Livincart</p>
        <p style={S.firmTag}>Architecture .Planning .Landscape . Interiors</p>
        <p style={S.contact}>E mail: infoatLivincart@gmail.com</p>
        <p style={S.contact}>Ph; 91 – 1234567890</p>
        <p style={S.contact}>Sai  Colony, vsphinagar</p>
        <p style={S.contact}>Visakhapatnam  530 040</p>
        <p style={{ ...S.contact, fontStyle: "italic" }}>www.Livincartarchitects.co.in</p>
        <p style={{ ...S.contact, fontStyle: "italic" }}>www.facebook.com/Livincartarchitect</p>
      </div>
    </div>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────────────── */
const F = "'Times New Roman', Times, Georgia, serif";
const FD = "'Palatino Linotype','Palatino','Book Antiqua',Georgia,serif";

const S = {
  root: { padding: "32px 0", minHeight: "100vh" },

  page: {
    width: "210mm", minHeight: "290mm ",
    margin: "0 auto 10px auto",
    padding: "0mm 20mm 10mm 20mm",
    background: "#fff",

    fontFamily: F, fontSize: "11pt", lineHeight: 1.65,
    color: "#111", boxSizing: "border-box",
  },

  /* Header */
  hdrRow: { display: "flex", alignItems: "flex-start", marginBottom: 10 },
  hdrLeft: {
    flex: "0 0 30%", paddingLeft: 4,
    minHeight: 110, paddingTop: 4,
  },
  hdrRight: { flex: 1, textAlign: "right" },
  firmName: { fontFamily: FD, fontSize: "17pt", fontStyle: "italic", margin: "0 0 1px 0", lineHeight: 1.2 },
  firmTag: { fontFamily: F, fontSize: "9pt", fontWeight: "bold", letterSpacing: "0.8px", margin: "2px 0 8px 0" },
  contact: { fontFamily: F, fontSize: "9pt", margin: 0, lineHeight: 1.5 },
  ref: { fontFamily: F, fontSize: "11pt", fontWeight: "bold", margin: 0 },

  /* Text */
  title: {
    fontFamily: F, fontSize: "11.5pt", fontWeight: "bold",
    textAlign: "center", textTransform: "uppercase",
    letterSpacing: "0.5px", margin: "14px 0 16px 0", lineHeight: 1.55,
  },
  body: { fontFamily: F, fontSize: "11pt", margin: "0 0 4px 0" },
  justify: { fontFamily: F, fontSize: "11pt", textAlign: "justify", margin: "0 0 8px 0" },

  /* Section heading row "1.  SCOPE …" */
  secRow: { display: "flex", alignItems: "baseline", margin: "14px 0 6px 0" },
  secNum: { fontFamily: F, fontSize: "11pt", fontWeight: "bold", minWidth: 28, flexShrink: 0 },
  secHeadText: { fontFamily: F, fontSize: "11pt", fontWeight: "bold" },

  secHead: { fontFamily: F, fontSize: "11pt", fontWeight: "bold", margin: "14px 0 4px 0" },
  stageHead: { fontFamily: F, fontSize: "11pt", fontWeight: "bold", margin: "12px 0 4px 0" },

  /* Numbered rows 2.01…  — matching image 1 */
  nr: {
    display: "flex", alignItems: "flex-start",
    marginBottom: 10, fontFamily: F, fontSize: "11pt", lineHeight: 1.65,
  },
  nrN: { minWidth: 52, flexShrink: 0, fontFamily: F, fontSize: "11pt" },
  nrT: { flex: 1, fontFamily: F, fontSize: "11pt", textAlign: "justify" },

  /* Bullet list — matching image 2 */
  bul: {
    fontFamily: F, fontSize: "11pt",
    paddingLeft: 22, margin: "0 0 8px 0",
    textAlign: "justify", listStyleType: "disc",
  },
  bli: { marginBottom: 4, lineHeight: 1.65 },

  /* Table */
  tbl: { width: "100%", borderCollapse: "collapse", fontFamily: F, fontSize: "10.5pt", marginBottom: 12 },
  th: { border: "1px solid #333", padding: "5px 8px", backgroundColor: "#f0f0f0", fontWeight: "bold", textAlign: "left", lineHeight: 1.4 },
  td: { border: "1px solid #333", padding: "5px 8px", verticalAlign: "top", lineHeight: 1.5 },

  /* Sign-off */
  thankWrap: { textAlign: "right", fontFamily: F, fontSize: "11pt", marginTop: 24 },
  signRow: { display: "flex", alignItems: "baseline", marginBottom: 4, fontFamily: F, fontSize: "11pt" },
  sLabel: { minWidth: 180, display: "inline-block" },
  sColon: { minWidth: 24, display: "inline-block" },

  bankBox: { marginTop: 28, fontFamily: F, fontSize: "11pt", lineHeight: 1.7 },
};