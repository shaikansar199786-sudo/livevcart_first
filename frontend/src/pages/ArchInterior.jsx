import React from "react";
import stamp from "../assets/stamp.png";
import sig from "../assets/sig.png";
import loger from "../assets/logo.png";
/*
  ARK Architects – Exact replica of contract_arch-int__4_.docx
  Numbering matches docx exactly:
    Section 1  → numbered list 1–13
    Section 2  → numbered 2.01, 2.02 ... with stage headings
    Section 5  → 5.1 / 5.2.1 indented rows
    Section 6  → 6.01 / 6.02 indented rows
*/

export default function ArchInterior({
    clientName = "Ms Mahalakshmi",
    salutation = "Mam",
    refId      = "PR_01/06-01-26/01",
    date       = "",
    feeAmount  = "Rs 4,50,000.00 (Four Lakhs Fifty Thousand only)",
    address = "",
    place="",
    paymentStages = [],
    totalPercentage = "100%",
}) {
  return (
    <div style={S.root}>

      {/* PAGE 1 */}
      <Page>
        <Letterhead refId={refId} />

        <p style={S.title}>
          TERMS AND CONDITIONS FOR ENGAGEMENT FOR<br />
          Comprehensive architectural &amp; interior design consultations
        </p>

        <p style={S.body}>To,</p>
        <p style={S.body}>{clientName}</p>
        {address && <p style={S.body}>{address}</p>}
        <br />
        <p style={S.body}>Dear {salutation},</p>
        <br />
        <p style={S.justify}>
          Thanks for showing confidence in us for designing of your house; kindly find the fee proposal for the same. Hope this will be up to your satisfaction. Feel free to call for any query.
        </p>

        {/* SECTION 1 */}
        <p style={S.secHead}>1.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;SCOPE OF WORK:</p>

        <p style={S.subHead}>ARCHITECTURAL CONSULTATION</p>

        {/* Numbered list 1–13 */}
        {[
          "Taking Client instructions and preparation of design brief.",
          "Site evaluation and analysis of impact of existing and/ or proposed development.",
          "Design and site development.",
          "Floor plans",
          "Elevation Design",
          "Structure design",
          "Sanitary, plumbing, drainage, water supply and sewerage designs",
          "Electrical designs",
          "Doors & Window design",
          "A/C and Ventilation designs",
          "BoQ",
          "Negotiation with the vendors",
          "Periodic inspection and evaluation of construction work",
        ].map((text, i) => (
          <NumberedRow key={i} num={`${i + 1}.`} text={text} numWidth={44} />
        ))} </Page>

        <Page>

        <p style={{ ...S.subHead, marginTop: 14 }}>INTERIOR DESIGN CONSULTATION</p>

        {[
          "Taking Client Instructions and preparing an initial project concept.",
          "Prepare initial design and take client's inputs and approval before making the final design.",
          "Furniture Layout Plan – comprises layout options of various rooms.",
          "Flooring Plans – comprises preparing flooring layout and selection of flooring material and specifications.",
          "Ceiling design plans – comprises design of ceiling and specification of materials.",
          "Lighting design – comprises design of lighting plan, selection of fixtures",
          "Services plans – Plumbing and drainage, Electrical and AC layouts",
          "Selection of Artifacts and soft furnishings like curtains, cushions, carpets, bedspreads, decorative items, paintings, table lamps, floor lamps etc.",
          "Check and approve shop drawings from vendors",
          "Select samples and get them approved by the client before finalizing them.",
          "Identifying the vendors",
          "Planning the project schedule and ensure the work is carried out accordingly",
        ].map((text, i) => (
          <BulletRow key={i} text={text} />
        ))}
     

      {/* PAGE 2 */}
    
        {/* SECTION 2 */}
        <p style={S.secHead}>2.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;SCHEDULE OF SERVICES:</p>
        <p style={S.justify}>After taking instructions from the Client, we shall render the following services:</p>

        <p style={S.stageHead}>CONCEPT DESIGN [STAGE 1]:</p>
        <NumberedRow num="2.01" text="Ascertain Client's requirements, examine site constraints & potential and prepare a design brief for Client's approval." numWidth={52} />
        <NumberedRow num="2.02" text="Prepare conceptual design with reference to requirements given and prepare rough estimate of cost on area basis." numWidth={52} />

        <p style={{ ...S.stageHead, marginTop: 14 }}>PRELIMINARY DESIGN AND DRAWINGS [STAGE 2]:</p>
        <NumberedRow num="2.03" text="Modify the conceptual designs incorporating required changes and prepare the preliminary drawings, etc., for the Client approval along with preliminary estimate of cost on area basis." numWidth={52} />

        <p style={{ ...S.stageHead, marginTop: 14 }}>WORKING DRAWINGS AND TENDER DOCUMENTS [STAGE 3]:</p>
        <NumberedRow num="2.04" text="Prepare working drawings, specifications and schedule of quantities sufficient to prepare estimate of cost and tender documents including code of practice covering aspects like mode of measurement, method of payments, quality control procedure on materials & works and other conditions of contract." numWidth={52} />


</Page>
<Page>
        <p style={{ ...S.stageHead, marginTop: 14 }}>APPOINTMENT OF CONTRACTORS [STAGE 4]:</p>
        <NumberedRow num="2.05" text="Advise client on appointment of contractors." numWidth={52} />

        <p style={{ ...S.stageHead, marginTop: 14 }}>CONSTRUCTION STAGE [STAGE 5]:</p>
        <NumberedRow num="2.10" text="Prepare and issue working drawings and details of proper execution of works during construction." numWidth={52} />
        <NumberedRow num="2.11" text="Approve samples of various elements and components." numWidth={52} />
        <NumberedRow num="2.12" text="Check and approve shop drawings submitted by the contractor/ vendors." numWidth={52} />
        <NumberedRow num="2.13" text="Visit of Architect or junior staff at the site of work, fortnightly or as per requirement of the site to evaluate the construction works and where necessary clarify any decision, offer interpretation of the drawings/ specification, attend conferences and meetings to ensure that the project proceeds generally in accordance with condition of contract and keep the client informed and render advice on actions, if required." numWidth={52} />
        <NumberedRow num="2.14" text="In order to ensure that the work at site proceeds in accordance with the contract documents/ drawings and to exercise time and quality controls, the day-to-day supervision will be carried out by a Construction Manager, who shall work under the guidance and direction of the architect and shall be appointed and paid by the client." numWidth={52} />
     
        
      {/* PAGE 3 */}
    
        {/* SECTION 3 */}
        <p style={S.secHead}>3.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;PROFESSIONAL FEES</p>
        <BulletRow text={<><strong>A Lump sum of {feeAmount}</strong> shall be charged as a design and supervision fee in consideration of the professional services rendered</>} />
        <BulletRow text="Plus 18% GST." />
        

        
        {/* SECTION 4 */}
        <p style={{ ...S.secHead, marginTop: 18 }}>4.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;SCHEDULE OF PAYMENT</p>
        <p style={S.justify}>
          Professional fee shall be paid in the following stages consistent with the work done plus other charges and reimbursable expenses as agreed upon:
        </p>

                  

        <table style={S.table}>
          <tbody>
            {paymentStages.map((s, i) => (
              <tr key={i} style={{ pageBreakInside: "avoid" }}>
                <td style={S.td}>
                  <strong>{s.stage}</strong><br /> <br></br>{s.description}
                </td>
                <td style={{ ...S.td, textAlign: "center", whiteSpace: "nowrap", fontWeight: "bold" }}>{s.percentage}</td>
              </tr>
            ))}
            <tr style={{ pageBreakInside: "avoid" }}>
              <td style={{ ...S.td, fontWeight: "bold" }}>Total</td>
              <td style={{ ...S.td, textAlign: "center", fontWeight: "bold" }}>{totalPercentage}</td>
            </tr>
          </tbody>
        </table>
        </Page>
        <Page>
            <br></br><br></br><br></br>
        {/* SECTION 5 */}
        <p style={S.secHead}>5.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;EFFECTING PAYMENT TO THE ARCHITECT:</p>
        <IndentedRow num="5.1" text="Progressive, on account, payments shall be made by the Client against any of the above stages based on the quantum work done during that stage, as may be mutually agreed to between the Client and the Architect." />
        <IndentedRow num="5.2.1" text="No deductions shall be made from the Architectural fee on account of penalty, liquidated damages, part rates or other sums withheld from payment or recovered from contractors/ suppliers." />


      {/* PAGE 4 */}
      <br></br>
      <br></br>
      <br></br>
 
        {/* SECTION 6 */}
        <p style={S.secHead}>6.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;REIMBURSABLE EXPENSES:</p>
        <p style={S.justify}>The Client will reimburse the following expenses incurred by him for discharge of his obligations:</p>
        <IndentedRow num="6.01" text="Cost of presentation models or walkthrough prepared at the instance of the Client" />
        <IndentedRow num="6.02" text={`All Out of the pocket expenses like, travel boarding & lodging outside Visakhapatnam if required shall be paid as per  actual, subject to prior approval by client and ${feeAmount} per day as outstation charges.`} />
                   <br></br><br></br>

                   <br></br>     
                   <br></br>
                   <br></br>   {/* SECTION 7 */}
        <p style={{ ...S.secHead, marginTop: 18 }}>7.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;CLIENT'S ROLE AND RESPONSIBILITIES:</p>
        <p style={S.justify}>The Client shall discharge all his obligations with the project and engagement of the Architect as follows:</p>
        {[
          "To provide detailed requirements of the project.",
          "To provide property lease/ ownership documents.",
          
          "To provide a site plan, to a suitable scale, showing boundaries, contours at suitable intervals, existing physical features including any existing roads, paths, trees, existing service and utility lines and such lines to which the proposed service can be connected. In case such information is not readily available, the client shall arrange the survey/ collection of necessary information and pay for the same.",
          "To furnish specific conditions/ Statutory/ stipulation/ Codes of Practice/Schedule of rates, etc., desired to be followed.",
          "To pay all the fees, levies, security deposits and expenses in respect of statutory sanction.",
          "To give effect to the professional advice of the Architect and cause no changes in the drawings and documents without the consent of the Architect.",
          "To honor Architect's bills within 5 days of its submission.",
          "To appoint a Construction Manager (Clerk of the works/ Site Supervisor or Construction Management Agency as per the architect's advice.",
        ].map((text, i) => (
          <BulletRow key={i} text={text} />
        ))}
</Page>
<Page>
        {/* SECTION 8 */}
        <p style={{ ...S.secHead, marginTop: 18 }}>8.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;ARCHITECT'S ROLE AND RESPONSIBILITIES:</p>
        {[
          "Keeping the Client informed about the progress of work in his office.",
          "Appointing specialized consultants in the construction with the client, if necessary.",
          "Taking responsibility for the direction and integration of the consultants work. The consultants however shall be fully responsible for the calculations, the detailed design and periodic inspection and evaluation of the work entrusted to them.",
          "Advising to the Client, on the Time Schedule (Bar Chart/PERT/ CPM Network) prepared by the contractors for the completion of work, if required",
          "Supplying to the Client, free of cost, up to two sets of drawings at different stages.",
          "Not making any deviations, alterations or omissions from the approved drawings, involving financial implications without prior consent of the Client.",
          "Any professional services to be rendered at the instance of the Client after agreed project completion period shall be compensated for, on mutually agreed terms.",
          "Exercising all reasonable skill, care and diligence in the discharge of his duties and shall exercise such general superintendence and inspection as may be necessary to ensure that works are being executed in accordance with the condition of the contract.",
          "Any revision in the drawings, tenders and documents, once approved, required to be made by the Client shall be compensated as additional services rendered and paid for @ 50% of the fee prescribed for the relevant stage(s).",
          "No change shall be made in the approved drawings and specifications at site without the consent of the Architect.",
          "Any curtailment of the professional services, beyond stage 2, shall make it obligatory for the Client to pay at least 20% of the fee for the remaining Stage(s) of the curtailed work/ services.",
        ].map((text, i) => (
          <BulletRow key={i} text={text} />
        ))}
      </Page>

      {/* PAGE 5 */}
      <Page>
        <p style={S.secHead}>9.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;OWNERSHIP OF COPYRIGHT:</p>
        <p style={S.justify}>
          Architectural design is an intellectual property of the Architect, The drawings, specifications, documents and models as instruments of service are the property of the architect whether the project, for which they are made, is executed or not. The Client shall retain copies of the Architect's models, drawings, specifications and other documents for his information and use in connection with the project. The Client or the Architect or any other person, shall not use these for any other project.
        </p>

        <div style={S.thankWrap}>
          <p style={{ margin: "0 0 10px 0" }}>Thanking you,</p>
          <img src={sig} alt="" width="20%" />
          <p style={{ margin: "0 0 4px 0" }}>Yours faithfully,</p>
        </div>

        <div style={{ marginTop: 12, textAlign: "right", fontFamily: FONT, fontSize: "11pt" }}>
          <p style={{ margin: 0 }}>Rohit Kannagatha</p>
          <p style={{ margin: "0 0 16px 0" }}>Managing Partner</p>
        </div>

        <div style={{ marginTop: 10 }}>
        <div style={S.signRow}>
  <span style={S.signLabel}>Name of the Architect</span>
  <span style={S.signColon}>:</span>
  <span style={S.signVal}><strong>ARK Architects and Interior Designers</strong></span>
</div>

<div style={S.signRow}>
  <span style={S.signLabel}>Date</span>
  <span style={S.signColon}>:</span>
  <span style={S.signVal}>{date}</span>
</div>

<div style={S.signRow}>
  <span style={S.signLabel}>Place</span>
  <span style={S.signColon}>:</span>
  <span style={S.signVal}>{place}</span>
</div>
          <div style={{ marginTop: 14 }}>
            <div style={S.signRow}>
              <span style={S.signLabel}>Seal of the Architect</span>
              <span style={S.signColon}>:</span>
              <span style={S.signVal}><img src={stamp} alt=""  width="20%"/></span>
            </div>
          </div>
        </div>

        <p style={{ fontWeight: "bold", marginTop: 30, marginBottom: 18 }}>ACCEPTED</p>
        <div>
          {["Signature of the Client", "Name & address of the Client"].map((label, i) => (
            <div key={i} style={{ ...S.signRow, marginBottom: 10 }}>
              <span style={S.signLabel}>{label}</span>
              <span style={S.signColon}>:</span>
              <span style={S.signVal}>&nbsp;</span>
            </div>
          ))}
        </div>

        <div style={S.bankBox}>
          <p style={{ fontWeight: "bold", margin: "0 0 2px 0" }}>Bank Details:</p>
          <p style={{ fontWeight: "bold", margin: 0 }}>Abhikalpana Rachna Kendra</p>
          <p style={{ fontWeight: "bold", margin: 0 }}>A/c No.: 126905500081</p>
          <p style={{ fontWeight: "bold", margin: 0 }}>IFSC: ICIC0001269</p>
          <p style={{ fontWeight: "bold", margin: 0 }}>HSL Complex Branch</p>
        </div>
      </Page>

    </div>
  );
}

/* ── Reusable row components ──────────────────────────────────────────────── */

/** "1." or "2.01" left label + justified text */
function NumberedRow({ num, text, numWidth = 44 }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", marginBottom: 4,
      fontFamily: "'Times New Roman', Times, Georgia, serif", fontSize: "11pt", lineHeight: 1.65,
    }}>
      <span style={{ minWidth: numWidth, flexShrink: 0, paddingRight: 6 }}>{num}</span>
      <span style={{ flex: 1, textAlign: "justify" }}>{text}</span>
    </div>
  );
}

/** "5.1" / "6.01" — wider label col to match docx indentation */
function IndentedRow({ num, text }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", marginBottom: 10,
      fontFamily: "'Times New Roman', Times, Georgia, serif", fontSize: "11pt", lineHeight: 1.65,
    }}>
      <span style={{ minWidth: 60, flexShrink: 0 }}>{num}</span>
      <span style={{ flex: 1, textAlign: "justify" }}>{text}</span>
    </div>
  );
}

/** Bullet • + justified text */
function BulletRow({ text }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", marginBottom: 5,
      fontFamily: "'Times New Roman', Times, Georgia, serif", fontSize: "11pt", lineHeight: 1.65,
    }}>
      <span style={{ minWidth: 22, flexShrink: 0, paddingLeft: 6 }}>•</span>
      <span style={{ flex: 1, textAlign: "justify" }}>{text}</span>
    </div>
  );
}

/* ── Page wrapper ─────────────────────────────────────────────────────────── */
function Page({ children }) {
  return <div style={S.page}>{children}</div>;
}

/* ── Letterhead ───────────────────────────────────────────────────────────── */
const FONT          = "'Times New Roman', Times, Georgia, serif";
const SERIF_DISPLAY = "'Palatino Linotype','Palatino','Book Antiqua',Georgia,serif";

function Letterhead({ refId }) {
  return (
    <>
      <div style={S.hdrRow}>
        <div style={S.hdrLeft}>
          <p style={S.ref}>REF: {refId}</p>
        </div>
        <div style={S.hdrRight}>
          {/* <svg width="200" height="54" viewBox="0 0 340 72"
            style={{ display: "block", marginLeft: "auto", marginBottom: 2 }}>
            <circle cx="8"   cy="36" r="5" fill="#111" />
            <line x1="16" y1="36" x2="88" y2="36" stroke="#111" strokeWidth="2" />
            <line x1="188" y1="36" x2="260" y2="36" stroke="#111" strokeWidth="2" />
            <circle cx="268" cy="36" r="5" fill="#111" />
            <polyline points="94,54 94,34 106,20 118,34 118,54"
              fill="none" stroke="#111" strokeWidth="2.5" strokeLinejoin="round" />
            <circle cx="106" cy="18" r="4" fill="none" stroke="#111" strokeWidth="2" />
            <text x="130" y="58"
              fontFamily="'Palatino Linotype','Palatino','Book Antiqua',Georgia,serif"
              fontSize="46" fontWeight="400" letterSpacing="2" fill="#111">ark</text>
          </svg> */}
          <img src={loger} alt="" width="50%" />
          <p style={S.firmName}>AbhikalpanaRachna Kendra</p>
          <p style={S.firmTag}>Architecture . Planning . Landscape . Interiors</p>
          <p style={S.contact}>E mail: infoatark@gmail.com</p>
          <p style={S.contact}>Ph: 91 – 9908041365</p>
          <p style={S.contact}>10-385/1/13, Sri Siridi Sai Veternary Colony, Visalakshinagar</p>
          <p style={S.contact}>Near Hanumanthwaka Jn, Visakhapatnam – 530 040</p>
          <p style={{ ...S.contact, fontStyle: "italic" }}>www.arkarchitects.co.in</p>
          <p style={{ ...S.contact, fontStyle: "italic" }}>www.facebook.com/arkarchitect</p>
        </div>
      </div>
      <hr style={{ borderTop: "1px solid #555", margin: "6px 0 10px 0" }} />
    </>
  );
}

/* ── Styles ───────────────────────────────────────────────────────────────── */
const S = {
  root: {  padding: "32px 0", minHeight: "100vh" },
  page: {
    width: "210mm", minHeight: "268mm ",
    margin: "0 auto 10px auto",
    padding: "0mm 20mm 10mm 20mm",
    background: "#fff",
   
     fontSize: "11pt", lineHeight: 1.65,
    color: "#111", boxSizing: "border-box",
  },
  hdrRow: { display: "flex", alignItems: "flex-start", marginBottom: 4 },
  hdrLeft: { flex: "0 0 30%", paddingLeft: 4, minHeight: 110, paddingTop: 4 },
  hdrRight: { flex: 1, textAlign: "right" },
  firmName: { fontFamily: SERIF_DISPLAY, fontSize: "17pt", fontStyle: "italic", margin: "0 0 1px 0", lineHeight: 1.2 },
  firmTag: { fontFamily: FONT, fontSize: "9pt", fontWeight: "bold", letterSpacing: "0.8px", margin: "2px 0 8px 0" },
  contact: { fontFamily: FONT, fontSize: "9pt", margin: 0, lineHeight: 1.5 },
  ref: { fontFamily: FONT, fontSize: "11pt", fontWeight: "bold", margin: 0 },
  title: {
    fontFamily: FONT, fontSize: "11.5pt", fontWeight: "bold",
    textAlign: "center", letterSpacing: "0.3px",
    margin: "14px 0 16px 0", lineHeight: 1.55,
  },
  body: { fontFamily: FONT, fontSize: "11pt", margin: "0 0 4px 0" },
  justify: { fontFamily: FONT, fontSize: "11pt", textAlign: "justify", margin: "0 0 8px 0" },
  secHead: {
    fontFamily: FONT, fontSize: "11pt", fontWeight: "bold",
    letterSpacing: "0.5px", margin: "14px 0 6px 0", textTransform: "uppercase",
  },
  subHead: {
    fontFamily: FONT, fontSize: "11pt", fontWeight: "bold",
    margin: "8px 0 4px 0", textTransform: "uppercase", letterSpacing: "0.3px",
  },
  stageHead: { fontFamily: FONT, fontSize: "11pt", fontWeight: "bold", margin: "8px 0 2px 0" },
  table: { width: "100%", borderCollapse: "collapse", fontFamily: FONT, fontSize: "10.5pt", marginBottom: 12 },
  td: { border: "1px solid #333", padding: "5px 10px", verticalAlign: "top", lineHeight: 1.5 },
  thankWrap: { textAlign: "right", fontFamily: FONT, fontSize: "11pt", marginTop: 24 },
  signRow: { display: "flex", alignItems: "baseline", marginBottom: 4, fontFamily: FONT, fontSize: "11pt" },
  signLabel: { minWidth: 200, display: "inline-block" },
  signColon: { minWidth: 24, display: "inline-block" },
  signVal: { flex: 1 },
  bankBox: { marginTop: 28, fontFamily: FONT, fontSize: "11pt", lineHeight: 1.7 },
};