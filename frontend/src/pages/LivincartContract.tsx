import React from "react";
import logo from "../assets/1.png";
import ownerSignature from "../assets/LIVE CART SINGTU.png";
import { OWNER_SIGNATURE_BASE64 } from "../assets/ownerSignatureBase64";

const FONT = '"Inter", "Segoe UI", Arial, Helvetica, sans-serif';

export interface BrandItem {
  category: string;
  brands: string;
}

export const DEFAULT_BRANDS_LIST: BrandItem[] = [
  { category: "BWP Ply, BWR Ply, Commercial Ply", brands: "Greenply, Century, E3" },
  { category: "Livincart Fireproof MDF, HydroGuard Plus - HDF", brands: "Action Tesa, E3, Century" },
  { category: "Particle Board", brands: "Action Tesa, E3, Century" },
  { category: "Laminate", brands: "Merino, Stylam, Virgo, Croma, Greenlam, Royale Touch" },
  { category: "Edge Band", brands: "Rehau, Croma, E3" },
  { category: "Hardware & Accessories", brands: "Ebco, Hepo / Hettich, Hafele, Blum, Everyday" },
  { category: "Glass & Mirror", brands: "Saint Gobain, Manufacture" },
  { category: "Painting", brands: "Asian Paints, Birla Opus Paints, Berger Paints" },
  { category: "Appliances", brands: "Elica, Prestige, Faber, Capella, Hafele, Glen, Kaff" },
  { category: "Lighting", brands: "Philips, Wipro, Orient, Havells" },
  { category: "Furniture", brands: "Livincart" },
  { category: "Wallpaper", brands: "All Brands" },
];

export interface InteriorInstallmentItem {
  label: string;
  description: string;
}

export const DEFAULT_INTERIOR_INSTALLMENTS: InteriorInstallmentItem[] = [
  { label: "Stage 1 (a)", description: "Stage 1: Token Advance Payment paid at the time of clicking 'Start Project' to register client, allocate design team, and initiate site kick-off." },
  { label: "Stage 2 (b)", description: "Stage 2: 10% Booking Advance of total quote value paid for site survey, 2D/3D design drafting, material selection, and final BOQ freeze." },
  { label: "Stage 3 (c)", description: "Stage 3: 35% Production Advance (reaching 50% cumulative payment) paid for raw material sourcing (carcass & shutter boards), factory cutting/edge-banding, and site civil, electrical & plumbing prep." },
  { label: "Stage 4 (d)", description: "Stage 4: 45% Dispatch & Installation Advance (reaching 95% cumulative payment) paid upon factory quality inspection for material dispatch to site, unloading, and modular assembly." },
  { label: "Stage 5 (e)", description: "Stage 5: Final 5% Handover Payment (reaching 100% payment) paid after snag list rectification, deep cleaning, quality audit, keys handover, and warranty certificate issuance." },
];

interface LivincartContractProps {
  clientName?: string;
  date?: string;
  contractValue?: string;
  contractValueWords?: string;
  address?: string;
  refId?: string;
  includeContract?: boolean;
  includeHandover?: boolean;
  convenienceFeeNote?: string;
  deliveryInstallationNote?: string;
  cancellationMinAmount?: string;
  bookingScenarioDate?: string;
  installment1Desc?: string;
  installment2Desc?: string;
  installment3Desc?: string;
  installment4Desc?: string;
  installmentsList?: InteriorInstallmentItem[];
  brandsList?: BrandItem[];
  clientSignature?: string;
}

const ListItem: React.FC<{ num: string | number; children?: React.ReactNode; text?: string; html?: string; style?: React.CSSProperties }> = ({ num, children, text, html, style }) => (
  <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "4px", border: "none", boxSizing: "border-box", fontFamily: FONT, letterSpacing: "0px", wordSpacing: "normal", ...style }}>
    <tbody>
      <tr>
        <td style={{ width: "24px", minWidth: "24px", verticalAlign: "top", fontWeight: "bold", color: "#0f172a", fontSize: "9.5pt", padding: "0 4px 0 0", border: "none", lineHeight: "1.55", fontFamily: FONT, letterSpacing: "0px", wordSpacing: "normal" }}>
          {num}{typeof num === 'number' || (!String(num).endsWith('.') && !String(num).endsWith(')')) ? '.' : ''}
        </td>
        <td style={{ verticalAlign: "top", color: "#0f172a", fontSize: "9.5pt", padding: 0, border: "none", lineHeight: "1.55", wordBreak: "break-word", overflowWrap: "break-word", fontFamily: FONT, letterSpacing: "0px", wordSpacing: "normal" }}>
          {html ? <span style={{ fontFamily: FONT, letterSpacing: "0px", wordSpacing: "normal", lineHeight: "1.55" }} dangerouslySetInnerHTML={{ __html: html }} /> : (children || text)}
        </td>
      </tr>
    </tbody>
  </table>
);

export default function LivincartContract({
  clientName = "Mr. K Ranjit Kumar",
  date = "10.07.2026",
  contractValue = "1,18,000",
  contractValueWords = "One Lakh Eighteen Thousand Rupees Only",
  address = "10-79/7/2, GF-104, AMMUS GREEN VALLEY, SAGAR NAGAR, ENDADA, Thatichetlapalem, Revenue Ward 6, Visakhapatnam - 530045",
  refId = "PR_2026_009/01",
  includeContract = true,
  includeHandover = false,
  clientSignature = "",
  convenienceFeeNote = "Note: A non-refundable Convenience fee of 2% (including GST) on payment amount may be levied on certain modes of payment including Credit card /Debit card/Net Banking/Wallet/Etc.",
  deliveryInstallationNote = "Note: Back panel shall be Livincart Aquashield-MDF for all carcasses in any core material other than BWP (Boiling water proof) Ply. For all carcass with BWP (Boiling water proof) Ply as core material; the back panel (wherever applicable) is to be Ply.",
  cancellationMinAmount = "1,50,000",
  bookingScenarioDate = "29th October, 2025 onwards",
  installment1Desc = "First Installment – 10% of the total quote value (woodwork + non-woodwork) paid at the time of order booking.",
  installment2Desc = "Second Installment - 50% of the total quote value (woodwork + non-woodwork), which is payable at the time of signing of the Works Contract. The Customer order shall move to the production stage only after payment of the Second Installment.",
  installment3Desc = "Third Installment - 35% of the woodwork and non-woodwork quote value, which is payable as per the due date mentioned in the “Ready to Dispatch” email sent to the Customer of the Third Installment.",
  installment4Desc = "Fourth/Final Installment – Remaining 5% of the woodwork quote value, which is payable as per the Handover date mentioned in the “Handover scheduled” email sent to the Customer.",
  installmentsList,
  brandsList = DEFAULT_BRANDS_LIST,
}: LivincartContractProps) {
  const displayValue = (!contractValue || contractValue === "0" || contractValue === "₹0") ? "1,18,000" : contractValue.replace(/[₹]/g, '').trim();
  const displayWords = (!contractValueWords || contractValueWords.toLowerCase().includes("zero")) ? "One Lakh Eighteen Thousand Rupees Only" : contractValueWords;

  return (
    <div style={{ padding: 0, margin: 0, backgroundColor: "#ffffff", background: "#ffffff" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        
        .page, .page *, .page table, .page tr, .page td, .page th, .page p, .page span, .page div, .page li, .page strong, .page b, .page u, .page h1, .page h2, .page h3, .page h4 {
          font-family: "Inter", "Segoe UI", Arial, Helvetica, sans-serif !important;
          letter-spacing: 0px !important;
          word-spacing: normal !important;
        }
      `}</style>
      {includeContract && (
        <div className="page" style={S.page}>

          {/* Letterhead */}
          <div style={S.lhRow}>
            <div style={{ display: "table-cell", width: "30%", verticalAlign: "middle" }}>
              <img src={logo} alt="Livincart Logo" style={{ height: "48px", maxHeight: "48px", width: "48px", maxWidth: "48px", objectFit: "contain", display: "inline-block" }} />
            </div>
            <div style={{ display: "table-cell", width: "70%", verticalAlign: "middle", textAlign: "right", paddingRight: "24px" }}>
              <p style={{ margin: 0, fontSize: "11pt", fontWeight: "bold", color: "#253b50" }}>Livincart Works Contract</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "8.5pt", color: "#64748b" }}>support@livincart.com | www.livincart.com</p>
            </div>
          </div>
          <hr style={{ borderTop: "1.5px solid #253b50", margin: "4px 0 8px" }} />

          {/* Intro */}
          <p style={S.body}>
            This agreement is made on <strong>{date || "____________"}</strong> between <strong>{clientName}</strong> and <strong>Livincart Company</strong> for the Interior Design work of the Residential home in <strong>{address}</strong>.
          </p>

          <p style={{ ...S.subTitle, marginTop: 14, marginBottom: 10 }}>Para 1 – Introduction</p>
          <p style={S.justify}>
            The total contract value is <strong><span style={{ fontFamily: "DejaVu Sans, Arial, sans-serif" }}>₹</span>{displayValue} ({displayWords})</strong>, inclusive of all material, labour, transportation, loading and unloading, supervision, overhead, service, and miscellaneous charges. This is a fixed-price contract, and the Owner shall not be liable for any additional costs. Livincart shall complete the Project as per the approved quotation and material specifications shared via email.
          </p>

          <p style={{ ...S.subTitle, marginTop: 20, marginBottom: 10 }}>Terms and Conditions</p>
          <p style={S.justify}>
            These Terms and Conditions is an understanding between Livincart and services private limited (hereinafter referred to as the “Company”) and its Customers.
            Livincart is a Company, which is engaged in the business of providing end-to-end home interior solutions for its Customers.
            Customer refers to an individual, organization or entity that purchases goods or services from Livincart.
          </p>

          <p style={{ ...S.subTitle, marginTop: 14, marginBottom: 10 }}>Price and Payment Terms</p>
          <div style={S.list}>
            <ListItem num={1} text="The exact price of the Customer project will depend on measurements, scope of work and change in designs / material / finishes. Based on these revisions, Customers can expect the quote value to rise or drop by approximately 5-10%. However, in case of non standard product selection / customization / additional scope of work, the prices may substantially increase from the initial quote value." />
            <ListItem num={2} text="Based on Customer's initial discussion with the Livincart representatives, Customer shall make an initial payment of 10% of quote value for booking the order with Livincart, subject to terms and conditions mentioned herein, if applicable. Quotations released before First Installment payment shall be valid for fifteen (15) Days and quotations released after First Installment payment shall be valid for a period of six (6) months." />
            <ListItem num={3} text="The total quote value of the project may have both woodwork and non-woodwork (civil work, Custom carpentry, Appliances, HDS - Home Decor Services etc.) and the payment towards the same shall be as per the clause below." />
            <ListItem num={4} text="The Price structure shall have the following Installments, as per the applicable scenario:" />

            <p style={{ ...S.body, marginLeft: 28, fontWeight: "bold" }}>Scenario - In case of all orders booked {bookingScenarioDate}</p>
            {(installmentsList && installmentsList.length > 0 ? installmentsList : [
              { label: "1st Installment (a)", description: installment1Desc },
              { label: "2nd Installment (b)", description: installment2Desc },
              { label: "3rd Installment (c)", description: installment3Desc },
              { label: "4th/Final Installment (d)", description: installment4Desc },
            ]).map((inst, idx) => {
              const letter = String.fromCharCode(97 + idx);
              return (
                <ListItem key={idx} num={letter} text={inst.description} style={{ paddingLeft: 24 }} />
              );
            })}
          </div>
          {convenienceFeeNote && (
            <div style={{ marginLeft: 28, fontWeight: "bold", backgroundColor: "#fff7ed", color: "#000000", padding: "12px 16px", borderRadius: "8px", border: "1.5px solid #fed7aa", marginBottom: "14px" }}>
              {convenienceFeeNote}
            </div>
          )}

          <div style={S.list}>
            {[
              "The name used for order booking should be in line with the KYC of the customer. No name change or GST number inclusion is possible once order is booked. Disclosing complete names at the time of order booking will help for all legal communications, availing finance options, GST Invoice in case of registered person and processing refund if in case of cancellation as specified in this terms and conditions.",
              `For Cancellation an order with Livincart before second payment, Customer quote value should include a minimum of INR ${cancellationMinAmount} of "Quote". In case of the quote value having woodwork less than INR ${cancellationMinAmount}, the same shall not be accepted.`,
              "The initial quote value provided by Livincart at the time of order booking for services like, plumbing, gas-piping or electrical work would be an estimate. The exact value of the quote will depend on the site conditions.",
              "The fourth/ final installment payment has to be completed before the Handover. Livincart shall not provide handover, unless the Final Installment is received and approved by Livincart.",
              "Between First Installment and Third Installment payment stage of Customer order brand partnered categories such as appliances, lights and loose furniture etc. are subject to price fluctuation and may not be available due to stock issues from the manufacturer’s end. In such cases, the Customer will have an option to choose the other available products.",
              "We have categorised the work of Livincart as interior solutions and has been considered as “Works Contract Services of Interior Solutions” (SAC 995476). Place of supply will be considered based on the state where the installation is to be carried out irrespective of bill to state. GST will be collected on each advance payment and GST invoices are raised upon completion of the project.",
              "If a customer wishes to make payments in cash, Livincart can accept cash up to Rs.199,999/- between all the stages of the respective project.\n a. Maximum amount of cash that Livincart accepts without PAN is Rs.49,999/-\n b. Maximum amount of cash that Livincart accepts with PAN is Rs.1,99,999/- and note that, PAN should belong to the customer ONLY and it is mandatory to obtain copy of the PAN from a customer and to be shared with Finance team to approve payments.\n c. Orders can not be split to accommodate additional cash from a customer.",
              "If the fourth/final Installment (i.e. the final 5% of the total quote value) is not paid by the Customer within the time stipulated (1week) in the “Handover scheduled” email sent to the Customer, then the Customer shall be liable to pay a demurrage charge of INR 500 per day, from the second day that the quality check becomes completed such time that the same is paid in full.",
              "The final quote value shall be valid for a period of Six (6) months. In case of extension of the quote validity beyond 6 months, then the prices shall vary, as per the then existing pricing.",
              "All payments made by the Customer throughout their engagement with Livincart should be approved by Livincart via email communication, and only on such approval, the payment shall be deemed effective."
            ].map((text, idx) => (
              <ListItem key={idx} num={idx + 5} html={text.replace(/\n/g, '<br />')} />
            ))}
          </div>


          {/* ─── END PAGE 2 / START PAGE 3 ─── */}


          <p style={S.subTitle}>Installation Checks</p>
          <div style={S.list}>
            <ListItem num={1} text="When civil work is done at site (including false ceiling, electrical, plumbing, gas piping, wall demolition, wall partition, etc.), hand marks and scratches are bound to occur and cannot be avoided. It’s recommended to have a final coat of paint after completion of all interiors." />
          </div>

          <p style={S.subTitle}>Delivery and Installation</p>
          <div style={S.list}>
            <ListItem num={1} text="The delivery and installation of Customer's Order shall be on or before the delivery date prescribed in the Quotation, and at the address given by the Customer." />
            <ListItem num={2} text="Delivery Date will be calculated from the date of completion of the following requirements (“All-Set-Go”):" />
            <ListItem num="a" text="Both Parties, Customer and Livincart, signing off on the designs and specifications for the home interiors;" style={{ paddingLeft: 24 }} />
            <ListItem num="b" text="Customer making all payments, strictly in accordance with the specified payment milestones. The Delivery Guarantee will commence from the date of approval of payment, which shall be confirmed via email by Livincart; and" style={{ paddingLeft: 24 }} />
            <ListItem num="c" text="Customer handing over the Site to Livincart in a condition that meets the requirements of Customer’s Site Readiness Checklist as per the Works Contract." style={{ paddingLeft: 24 }} />
          </div>
          {deliveryInstallationNote && (
            <div style={{ fontWeight: "bold", backgroundColor: "#fff7ed", color: "#000000", padding: "12px 16px", borderRadius: "8px", border: "1.5px solid #fed7aa", marginTop: 10, marginBottom: 14 }}>
              {deliveryInstallationNote}
            </div>
          )}

          <p style={S.subTitle}>Delivery Guarantee</p>
          <p style={S.justify}>
            Customers may be entitled to the benefit of Livincart’s Delivery Guarantee, depending on the Scope of work, and subject to achieving All-Set-Go. Customers may either be provided with a (i) 45 days’ delivery Guarantee; or (ii) (45 + 10) days delivery Guarantee, or (iii) Estimated Timeline Commitment, subject to the Categories mentioned below. Under point (i) and (ii) above, the Customer will be eligible to get compensation in case of a breach, as per the terms and conditions hereunder. Under the point (iii) above, the Delivery Date provided is an estimate. There is no compensation available and Livincart shall not be in breach, if the same is not adhered to.
          </p>
          <div style={S.list}>
            <ListItem num={1} html="<strong>Standard Livincart Offerings:</strong> A 45-day delivery guarantee shall be applicable to Customer project if the Customer overall scope of services includes items from the following <strong>“Type A” categories</strong> only." />
            <table style={{ width: "100%", borderCollapse: "collapse", margin: "8px 0 12px 26px", fontSize: "9.5pt", fontWeight: 700, color: "#0f172a", fontFamily: FONT, letterSpacing: "0px", wordSpacing: "normal" }}>
              <tbody>
                {[
                  ["a. Woodwork value < 15 lakh", "b. Aluminium - Hinged and Sliding"],
                  ["c. Membrane", "d. Acrylic"],
                  ["e. Appliances", "f. False Ceiling"],
                  ["g. Electrical", "h. Cleaning"],
                  ["i. Unloading Services", "j. CounterTop Material & Services"],
                  ["k. Switches-Sockets & Plates", "l. Ceiling Panels"],
                  ["m. Miscellaneous works", ""]
                ].map((row, i) => (
                  <tr key={i}>
                    <td style={{ width: "50%", padding: "3px 8px 3px 0", border: "none", verticalAlign: "top", fontFamily: FONT, letterSpacing: "0px", wordSpacing: "normal", lineHeight: "1.55" }}>{row[0]}</td>
                    <td style={{ width: "50%", padding: "3px 0 3px 8px", border: "none", verticalAlign: "top", fontFamily: FONT, letterSpacing: "0px", wordSpacing: "normal", lineHeight: "1.55" }}>{row[1]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ListItem num={2} html="<strong>Additional Services:</strong> A 45+10 day delivery guarantee is applicable to the Customer project if the Customer's overall scope of services includes any items from the following <strong>“Type B” categories</strong> along with items from above mentioned “Type A” categories." style={{ marginTop: 10 }} />
            <table style={{ width: "100%", borderCollapse: "collapse", margin: "8px 0 12px 26px", fontSize: "9.5pt", fontWeight: 700, color: "#0f172a", fontFamily: FONT, letterSpacing: "0px", wordSpacing: "normal" }}>
              <tbody>
                {[
                  ["a. Woodwork value > 15 lakh", "b. Flooring"],
                  ["c. Wallpaper", "d. Painting"],
                  ["e. PU Shutter", "f. Armadio"],
                  ["g. Lighting", "h. Plumbing"],
                  ["i. Décor", "j. Loose Furniture"],
                  ["k. Custom Shower Cubicle", "l. Home Security & Automation"],
                  ["m. Wall Cladding", "n. Soft Furnishing items"],
                  ["o. Balcony Garden", "p. Working hours restriction at site"],
                  ["q. Hob and Chimney Supply/Installation", "r. Chimney Supply/Installation in client scope"],
                  ["s. Granite Supply/Installation in client scope", "t. Electrical Point shifting in client scope"]
                ].map((row, i) => (
                  <tr key={i}>
                    <td style={{ width: "50%", padding: "3px 8px 3px 0", border: "none", verticalAlign: "top", fontFamily: FONT, letterSpacing: "0px", wordSpacing: "normal", lineHeight: "1.55" }}>{row[0]}</td>
                    <td style={{ width: "50%", padding: "3px 0 3px 8px", border: "none", verticalAlign: "top", fontFamily: FONT, letterSpacing: "0px", wordSpacing: "normal", lineHeight: "1.55" }}>{row[1]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>


          {/* ─── END PAGE 3 / START PAGE 4 ─── */}


          <div style={S.list}>
            <ListItem num={3} html="<strong>Non Standard Categories:</strong> A fixed timeline delivery guarantee will NOT be applicable on the Customer project if it includes items from any of the following <strong>“Type C” categories</strong>:" />
            <table style={{ width: "100%", borderCollapse: "collapse", margin: "8px 0 12px 26px", fontSize: "9.5pt", fontWeight: 700, color: "#0f172a", fontFamily: FONT, letterSpacing: "0px", wordSpacing: "normal" }}>
              <tbody>
                {[
                  ["a. Civil works", "b. Demolition"],
                  ["c. Safety Doors", "d. Custom Carpentry"],
                  ["e. Ceiling & Wall Panels", "f. Other Carpentry"],
                  ["g. Doors and Windows", "h. Custom PVC Panels"],
                  ["i. Metal shoe rack", ""]
                ].map((row, i) => (
                  <tr key={i}>
                    <td style={{ width: "50%", padding: "3px 8px 3px 0", border: "none", verticalAlign: "top", fontFamily: FONT, letterSpacing: "0px", wordSpacing: "normal", lineHeight: "1.55" }}>{row[0]}</td>
                    <td style={{ width: "50%", padding: "3px 0 3px 8px", border: "none", verticalAlign: "top", fontFamily: FONT, letterSpacing: "0px", wordSpacing: "normal", lineHeight: "1.55" }}>{row[1]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {[
              "The fixed timeline delivery guarantee period, if applicable, will begin once all 3 of the following stages are complete:\n a. Customer and Livincart project team should have signed off on the design.\n b. Customer has accepted the Livincart Works Contract.\n c. The payment for the Customer's Second installment is received and approved by Livincart.",
              "If Livincart doesn't complete the Customer’s project within the applicable delivery guarantee period then Livincart shall pay rent (Rs. 500/day) for every day of delay, subject to a maximum amount equivalent to the price for the items that were delayed and fulfillment of all the pre-conditions for availing such a delivery guarantee. Please refer to the “Pre-conditions for Delivery Guarantee” section below to know more about such conditions.",
              "Pre-conditions to our Delivery Guarantee: All items contained in the site-readiness checklist should be complete when Livincart starts the installation process.",
              "If an item is not marked with any category symbol in the quotation then it shall be assumed that it belongs to the “Type A” Category wherein a 45 days delivery guarantee will be applicable.",
              "Livincart shall not be held liable for any delays in delivery that are caused by Customer or due to an event of Force Majeure.",
              "The word \"Guarantee\" or \"Guaranteed\" is used in marketing, branding, promotions, other places on the website and/or such other Products owned and managed by Livincart, in common parlance only and it should be interpreted accordingly."
            ].map((text, idx) => (
              <ListItem key={idx} num={idx + 4} html={text.replace(/\n/g, '<br />')} />
            ))}
          </div>

          <p style={S.subTitle}>Pre-Conditions for Delivery Guarantee</p>
          <p style={S.justify}>The Delivery Guarantee shall not be applicable in the following cases:</p>
          <div style={S.list}>
            <ListItem num={1} html="If the following items are in the Customer's scope or the builder’s scope:<br />a. Granite supply or installation; b. Hob and /or chimney supply or installation; or c. Electrical point shifting;" />
            {[
              "If the site has restrictions on work timings during the day.",
              "If the Customer is not in full possession of the site and temporary possession has been allowed by the builder.",
              "If there is concurrent work being done at the site by any other third party contractor like Painting, Wallpaper, Wooden Flooring or Carpentry Work during installation, and work being executed by the builder such as civil works, core-cutting, painting, etc.",
              "If there are any changes to designs after the order is in production.",
              "If the Customer is living at the site at the time of installation.",
              "Abnormal hindrances in execution like Continuous Lack of Power, Non-Working Lifts, No Permission from Builder, etc.",
              "If any litigation related to the property, site or any other issues related to the Customer or builder or any third party which disrupts the work of Livincart.",
              "A Force Majeure event occurs (A Force Majeure event refers to the acts of God including; such as flooding, hurricane, earthquake, lightning, any natural calamities etc., environmental condition such as air pollution, solvent exposure, mold, mildew etc., or staining from foreign substances such as dirt, grease, oils, sprays etc. fire, acts of war, acts of terrorism, pandemic, lockdown, acts of Government or any other event which is beyond the control of Livincart).",
              "OEM replacements due to functional defects found at the time of handover are outside the Delivery Guarantee. The replacements will be done free of cost based on the OEM timeline and Livincart will facilitate the replacements. Eg. hardware, appliances like hob and chimney, accessories, colour mismatch or scratches in handles, etc.",
              "Deep scratches found on shutters after peeling off of protective liners will be replaced by Livincart if they are not removable using polishing agents, but they are outside of Delivery Guarantee.",
              "Shade variation for the same colour of shutter finish will be replaced based on OEM (like Merino, Associate, Action Tesa, etc.) timeline, free of cost, but the same will be outside of Delivery Guarantee. Livincart will facilitate the replacements through OEMs.",
              "If the woodwork component of the quote is equal to or greater than INR 15 lakhs then the Delivery Guarantee will not be applicable due to the volume of work involved."
            ].map((text, idx) => (
              <ListItem key={idx} num={idx + 2} text={text} />
            ))}
          </div>


          {/* ─── END PAGE 4 / START PAGE 5 ─── */}


          <p style={S.subTitle}>Warranty - Product and Service</p>
          <div style={S.list}>
            <ListItem num={1} html="<strong>FLAT 10 YEAR WARRANTY:</strong> All Customer's woodwork is covered under Livincart’s Flat 10 Years Warranty. This safeguards you against any defect in manufacturing of woodwork items or in installation workmanship." />
            <ListItem num={2} text="All accessories, hardware, appliances etc. procured from OEMs are covered as per the respective Manufacturer’s Warranty Policy." />
            <ListItem num={3} text="Livincart also provides Service Warranty on certain offerings, as outlined hereunder." />
            <ListItem num={4} html="A detailed description of our Warranty Policy is also mentioned in the Livincart Works Contract and FAQ section at <u>www.Livincart.com/faqs</u> for the Customer's reference. Customers can refer to the Works Contract while making the Second Installment payment of the quote value." />
          </div>
          <div style={{ backgroundColor: "#fff7ed", color: "#000000", padding: "12px 16px", borderRadius: "8px", border: "1.5px solid #fed7aa", fontWeight: "600", margin: "14px 0" }}>
            <strong style={{ color: "#ea580c" }}>*Note:</strong> Livincart’s Flat 10-Year Warranty is not applicable on Livincart Custom Carpentry works (which shall fall under a 3 Year Warranty bracket) and products from OEMs.
          </div>

          <p style={{ ...S.body, fontWeight: "bold", marginTop: 12 }}>1. Covered Products – Livincart’s Product Warranty</p>
          <table style={S.table}>
            <thead>
              <tr style={{ backgroundColor: "rgba(254, 143, 62, 1)", color: "#ffffff" }}>
                <th style={S.th}>Product</th>
                <th style={S.th}>Warranty Period</th>
                <th style={S.th}>Remarks</th>
                <th style={S.th}>Exceptions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={S.td}>Cabinet, Carcass and Shutter</td>
                <td style={S.td}>10 Years</td>
                <td style={S.td}>Covers BWP Plywood. Covers against delamination &amp; edgeband peeling.</td>
                <td style={S.td} rowSpan={3}>*A comprehensive list of Exceptions are covered below under the heading “Limitations to Warranty”</td>
              </tr>
              <tr>
                <td style={S.td}>Cabinet, Carcass</td>
                <td style={S.td}>10 Years</td>
                <td style={S.td}>Covers core materials: BWR Plywood, Commercial Plywood, HydroGuard Plus-HDF &amp; Fireproof-MDF.</td>
              </tr>
              <tr>
                <td style={S.td}>Shutter</td>
                <td style={S.td}>10 Years</td>
                <td style={S.td}>Covers finishes &amp; core material: HDHMR, Fireproof-MDF, Aluminium Shutter Frame.</td>
              </tr>
            </tbody>
          </table>

          <p style={{ ...S.body, fontWeight: "bold", marginTop: 12 }}>2. Products from OEMs (Original Equipment Manufacturers)</p>
          <table style={S.table}>
            <thead>
              <tr style={{ backgroundColor: "rgba(254, 143, 62, 1)", color: "#ffffff" }}>
                <th style={S.th}>Product</th>
                <th style={S.th}>Warranty Period</th>
                <th style={S.th}>Remarks</th>
                <th style={S.th}>Exceptions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={S.td}>Glass Shutters</td>
                <td style={S.td}>Manufacturer's Warranty - 5 Years</td>
                <td style={S.td}>N/A</td>
                <td style={S.td}>Abusive damage to glass infill will not fall under warranty; replacement chargeable.</td>
              </tr>
              <tr>
                <td style={S.td}>Hardware, Accessory</td>
                <td style={S.td}>Manufacturer's Warranty</td>
                <td style={S.td}>N/A</td>
                <td style={S.td}>Do not use chemical sprays or household cleaning agents. Excludes misuse or wear and tear.</td>
              </tr>
              <tr>
                <td style={S.td}>Appliances</td>
                <td style={S.td}>Manufacturer's Warranty</td>
                <td style={S.td}>N/A</td>
                <td style={S.td}>Labour and cleaning charges (e.g. for Chimney) are extra.</td>
              </tr>
            </tbody>
          </table>


          {/* ─── END PAGE 5 / START PAGE 6 ─── */}


          <table style={S.table}>
            <thead>
              <tr style={{ backgroundColor: "rgba(254, 143, 62, 1)", color: "#ffffff" }}>
                <th style={S.th}>Product</th>
                <th style={S.th}>Warranty Period</th>
                <th style={S.th}>Remarks</th>
                <th style={S.th}>Exceptions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={S.td}>Sink, Tap, Other Plumbing Installation</td>
                <td style={S.td}>Manufacturer's Warranty</td>
                <td style={S.td}>No warranty for installation services &amp; leakage post-handover.</td>
                <td style={S.td}>Inspection to be done by customer during handover; any issues then will be rectified.</td>
              </tr>
              <tr>
                <td style={S.td}>Switches, Lights, Other Electrical</td>
                <td style={S.td}>Manufacturer's Warranty</td>
                <td style={S.td}>Labour charge of Rs. 500 will be charged for any replacement.</td>
                <td style={S.td}>Wiring inspection during handover; any issues then will be rectified.</td>
              </tr>
              <tr>
                <td style={S.td}>Accessory products</td>
                <td style={S.td}>Manufacturer's Warranty</td>
                <td style={S.td}>As per Manufacturer warranty guidelines</td>
                <td style={S.td}>As per Manufacturer warranty guidelines</td>
              </tr>
              <tr>
                <td style={S.td}>Mirrors</td>
                <td style={S.td}>1 Year Warranty on Electrical Component</td>
                <td style={S.td}>Warranty on the Electrical Component of the Mirrors only.</td>
                <td style={S.td}>No warranty on Mirror and Glass</td>
              </tr>
              <tr>
                <td style={S.td}>Wallpaper</td>
                <td style={S.td}>Manufacturer's Warranty - 1 Year</td>
                <td style={S.td}>Includes wallpaper and installation.</td>
                <td style={S.td}>Base preparation not covered. Seepage causing peeling not covered. Excludes fading.</td>
              </tr>
              <tr>
                <td style={S.td}>Flooring</td>
                <td style={S.td}>Manufacturer's Warranty</td>
                <td style={S.td}>Includes flooring material and installation.</td>
                <td style={S.td}>Undulation of flooring not covered. External damage not covered.</td>
              </tr>
              <tr>
                <td style={S.td}>Sanitary Fixtures</td>
                <td style={S.td}>Manufacturer's Warranty</td>
                <td style={S.td}>As per guidelines</td>
                <td style={S.td}>As per guidelines</td>
              </tr>
              <tr>
                <td style={S.td}>Home Automation (Smart locks/WiFi cams)</td>
                <td style={S.td}>Manufacturer's Warranty</td>
                <td style={S.td}>As per guidelines</td>
                <td style={S.td}>As per guidelines</td>
              </tr>
              <tr>
                <td style={S.td}>CNC Pooja units</td>
                <td style={S.td}>3 Years</td>
                <td style={S.td}>N/A</td>
                <td style={S.td}>*A comprehensive list of Exceptions are covered under “Limitations to Warranty”</td>
              </tr>
            </tbody>
          </table>

          <p style={{ ...S.body, fontWeight: "bold", marginTop: 12 }}>3. No Warranty Products</p>
          <p style={S.body}>All other items, Products or materials supplied or used by Livincart are provided on an as-is basis, without warranties of any kind:</p>
          <table style={S.table}>
            <thead>
              <tr style={{ backgroundColor: "rgba(254, 143, 62, 1)", color: "#ffffff" }}>
                <th style={S.th}>Product</th>
                <th style={S.th}>Warranty Period</th>
                <th style={S.th}>Exceptions / Details</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={S.td}>Countertop (Material)</td>
                <td style={S.td}>No Warranty</td>
                <td style={S.td}>N/A</td>
              </tr>
              <tr>
                <td style={S.td}>Gas Piping, Tiling, Other Civil Work</td>
                <td style={S.td}>No Warranty</td>
                <td style={S.td}>Inspection to be done by customer during handover; any issues then will be rectified.</td>
              </tr>
              <tr>
                <td style={S.td}>Mirror, Glass, Other Fragile Items</td>
                <td style={S.td}>No Warranty</td>
                <td style={S.td}>Electrical component of Mirrors shall be covered under 1 year warranty.</td>
              </tr>
            </tbody>
          </table>


          {/* ─── END PAGE 6 / START PAGE 7 ─── */}


          <p style={{ ...S.body, fontWeight: "bold" }}>4. Covered Services – Livincart’s Service Warranty</p>
          <p style={S.justify}>In case of any installation defect following handover date, Livincart shall repair, at its discretion, the said Products, with respect to service issues and exceptions:</p>
          <table style={S.table}>
            <thead>
              <tr style={{ backgroundColor: "rgba(254, 143, 62, 1)", color: "#ffffff" }}>
                <th style={S.th}>Service Category</th>
                <th style={S.th}>Warranty</th>
                <th style={S.th}>Remarks</th>
                <th style={S.th}>Exceptions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={S.td}>Countertop Installation</td>
                <td style={S.td}>1 Year</td>
                <td style={S.td}>Covers stone joint issues, stone-to-sink joint leakage, countertop levelling. Both material and installation must be from Livincart.</td>
                <td style={S.td}>No warranty on countertop material. Excludes stains, cracks from improper usage, hot vessels or dropping heavy objects.</td>
              </tr>
              <tr>
                <td style={S.td}>False Ceiling</td>
                <td style={S.td}>1 Year</td>
                <td style={S.td}>Covers installation, cracking of joint compound, flaking, flaking and peeling of paint (if under Livincart scope). Minimum area 150 sqft.</td>
                <td style={S.td}>Excludes dripping water from AC/vegetation, capillary water rise, dampness from seepage, or physical damage.</td>
              </tr>
              <tr>
                <td style={S.td}>Painting</td>
                <td style={S.td}>1 Year</td>
                <td style={S.td}>Covers fading, flaking or peeling of paint. Minimum area 250 sqft.</td>
                <td style={S.td}>Excludes paint code discontinuation, structural cracks, humidity seepage, or damage from wire brushes.</td>
              </tr>
              <tr>
                <td style={S.td}>Electrical</td>
                <td style={S.td}>1 Year</td>
                <td style={S.td}>Covers short circuits, tripping, loose contact in plugs/switches or fixture installation. Scope must exceed Rs. 50,000.</td>
                <td style={S.td}>Excludes appliances/fixtures (handled by brand warranty), improper power input, or repairs by third parties.</td>
              </tr>
              <tr>
                <td style={S.td}>Plumbing</td>
                <td style={S.td}>1 Year</td>
                <td style={S.td}>Covers leakage in plumbing/sanitary pipes or improper fixing. Scope must exceed Rs. 20,000.</td>
                <td style={S.td}>Excludes fixtures (taps, faucets, closets), blockages from food/debris, hard water scale/corrosion.</td>
              </tr>
            </tbody>
          </table>


          {/* ─── END PAGE 7 / START PAGE 8 ─── */}


          <table style={S.table}>
            <thead>
              <tr style={{ backgroundColor: "rgba(254, 143, 62, 1)", color: "#ffffff" }}>
                <th style={S.th}>Service Category</th>
                <th style={S.th}>Warranty</th>
                <th style={S.th}>Remarks</th>
                <th style={S.th}>Exceptions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={S.td}>Civil works</td>
                <td style={S.td}>1 Year</td>
                <td style={S.td}>Covers dado tiling, flooring, tile grouting, hollow sound when tapped. Civil scope must exceed Rs. 15,000.</td>
                <td style={S.td}>Excludes discontinued tiles, damage from harsh cleaners/acid, structural settling cracks, or physical damage.</td>
              </tr>
              <tr>
                <td style={S.td}>Custom Work</td>
                <td style={S.td}>1 Year</td>
                <td style={S.td}>Covers custom carpentry, bulging/bending of core, bubble formation or peeling of laminate/veneer.</td>
                <td style={S.td}>Excludes exposure to direct sunlight/heat, refurbishment scope, natural wear/tear, or rusting of metallic parts due to moisture.</td>
              </tr>
              <tr>
                <td style={S.td}>Shower Cubicles</td>
                <td style={S.td}>1 Year</td>
                <td style={S.td}>Covers enclosures, caulking leakage, squeaking, sagging.</td>
                <td style={S.td}>Excludes glass breakage/scratches, polycarbonate/acrylic sweeps/seals, or settling of house.</td>
              </tr>
              <tr>
                <td style={S.td}>Tiles Installation</td>
                <td style={S.td}>1 Year</td>
                <td style={S.td}>Replacement of exact/equivalent tile shade. No warranty on tiles post-handover.</td>
                <td style={S.td}>Excludes seepage leading to tile fall, or fading from normal wear.</td>
              </tr>
              <tr>
                <td style={S.td}>Soft Furnishings</td>
                <td style={S.td}>1 Year</td>
                <td style={S.td}>Covers fabric manufacturing defects and stitching.</td>
                <td style={S.td}>Excludes rough usage damage, color fading after 3 months, or hardware accessories.</td>
              </tr>
            </tbody>
          </table>

          <p style={S.subTitle}>Limitations to Warranty</p>
          <p style={S.justify}>Livincart does not warrant against and is not responsible for:</p>
          <div style={S.list}>
            {[
              "Wear and tear suffered through normal use (including scratches, dents and cuts) or damage caused by impacts or accidents or mishandling.",
              "Damage caused by misuse, negligence, normal wear and tear.",
              "Only bends that are >3mm will be attended by Livincart.",
              "Water leakage and seepage within the building structure and continuous dampness of the surface beyond (i) 72 hours for BWP grade plywood (IS710); 48 hours for BWR grade plywood (IS303); and 24 hours for exterior grade - HDF materials.",
              "Degradation, discolouration, damage, fading, etc. in colour, grain, or texture of natural wood materials, laminates and other materials due to exposure to intensive or excessive light, sunlight, moisture or heat or other environmental factors.",
              "Use of inappropriate chemicals, detergents, abrasives or other inappropriate cleaning agents that can damage the wooden surface of the products or rust the accessories.",
              "Mistreatment, negligent use, misuse, insufficient or improper care (including but not limited to exposure to harsh weather conditions).",
              "Alterations, modifications or use of products which are beyond or inconsistent with the supplied product instructions by Livincart and/ the usage of products which have not been authorised by Livincart.",
              "Destroyed, damaged or becomes unusable due to any Force Majeure event.",
              "Improper maintenance of the Covered Products the same not being utilised for the intended purpose.",
              "In case of a resale of the Covered Products (either as part of the sale of Customer’s property or otherwise).",
              "The Covered Products have been subject to re-installation, repair or alteration by any person not authorised by Livincart.",
              "Rusting of channels, hinges and other metallic parts, as these could be damaged due to household chemicals and sprays or exposure to moisture/dampness.",
              "Defects caused by pests and pets including but not limited to termites, ants, wood borers, rats, dogs and cats."
            ].map((text, idx) => (
              <ListItem key={idx} num={idx + 1} text={text} />
            ))}
          </div>


          {/* ─── END PAGE 8 / START PAGE 9 ─── */}


          <p style={S.subTitle}>Procedure to claim Warranty</p>
          <div style={S.list}>
            <ListItem num={1} text="For claiming warranty against any of the Covered Products which is valid under the warranty terms, Customer shall raise a ticket on the Email or call on Livincart's toll free number, identifying the Covered Product and the defect observed, including photographs and/or other proofs of the same." />
            <ListItem num={2} text="Once Livincart receives a Customer's written notice, Livincart shall send their authorised representative to the Customer's Site for inspection and assessing the same to confirm whether the claim is covered under Warranty." />
            <ListItem num={3} text="If it is covered under warranty as per Livincart representative’s information, Livincart shall either arrange for repair or replace the defective Product." />
            <ListItem num={4} text="In case of replacement: Livincart shall provide a similar Product that is as close as possible in dimension, function and colour to the defective product. Livincart does not guarantee that the replacement product will be exactly the same as the Covered defective Product. A replacement Product will not be covered by any further warranties. i.e. no fresh warranty shall be applicable on a replaced product, which shall be covered under the original warranty term." />
          </div>

          <p style={S.subTitle}>Service and Maintenance</p>
          <div style={S.list}>
            <ListItem num={1} text="For the first 12 months from the date of Handover, One (1) free service shall be provided to the Customers to address routine maintenance issues in respect of moving parts (hinges, channels etc.), such as alignment, parts becoming loose, etc. Note: Complimentary visits cannot roll over beyond the 12 month period." />
            <ListItem num={2} text="To avail the free service, Customer should schedule a visit by contacting Livincart’s customer care number +91 7702312351 or raise your request through contact@livincart.com. If the free service is not availed by Customer within the aforesaid period of 12 months, Livincart’s obligation to provide such free service shall lapse." />
            <ListItem num={3} text="After the period of 12 months from the date of handover, in case of maintenance requirement, Customers can seek paid maintenance services, by contacting Livincart’s customer care and scheduling a service visit. Such visits shall be chargeable at Livincart’s prevailing service visit rates. Livincart’s current service visit fee is a sum of Rs. 699 per visit." />
            <ListItem num={4} text="Any repairs or replacements advised during a service visit (whether free or paid-for), or any maintenance that may be sought by Customer, which is not covered under the Warranty terms, shall be done at additional charges. Livincart will provide Customer an estimate of such additional charges after inspection and assessment during the service visit." />
          </div>

          <p style={S.subTitle}>Livincart Care and Support</p>
          <div style={S.list}>
            <ListItem num={1} html="For any concerns regarding their project, Customers can raise a request through <u>contact@livincart.com</u> or Call Us at <u>+91 7702312351</u>." />
            <ListItem num={2} text="Livincart shall provide One service visit to the site, free-of-cost, within 12 months from the date of handover, for routine checks which cover moving parts like hinges, channels, etc. The Care team will contact the Customer to schedule the visit. The free service addresses issues like minor alignment, loose parts, etc. It also covers general alignment check of all shutters, lofts, the functioning of drawers and all accessories, and any additional concealment of wiring for the TV unit." />
            <ListItem num={3} text="Since some products are designed to have a lot of moving parts, Livincart's products may require occasional re-alignment and servicing. If there are any service and maintenance requests after the free services, they will be taken up on a chargeable basis. Livincart’s current service visit fee is a sum of Rs. 699 per visit. This visit includes re-alignment of all products, but without any replacements. This request will have to be raised by the customer through contact@livincart.com." />
          </div>


          {/* ─── END PAGE 9 / START PAGE 10 ─── */}


          <div style={S.list}>
            <ListItem num={4} text="If the work includes re-alignment of units and/or replacement of items not covered under warranty (due to physical damage, continuous water leakage, rusting, etc), the cost of replacement will be over and above Rs. 499, and a bill for the same will be provided after the visit." />
            <ListItem num={5} text="Customer is directed to keep all their communications in writing with our representative on their official email and keep the necessary POC designated by the company in loop, if applicable. In case of any assistance during your project, and before handover, customer may reach out to the Support Team at support@Livincart.com. In case of any escalation post handover of the project and any issues regarding warranty, customer may reach out to the Care Team at support@livincart.com." />
          </div>

          <p style={S.subTitle}>Cleaning Services</p>
          <p style={S.justify}>Post installation, the following set of services will be done at the site:</p>
          <div style={S.list}>
            {["Dusting, sweeping and mopping of all areas.", "Cleaning of doors of the cabinets to remove pencil marks and dust.", "Cleaning the insides of wooden cabinets.", "Deep cleaning with the use of mechanical equipment is out of scope."].map((text, idx) => (
              <ListItem key={idx} num={idx + 1} text={text} />
            ))}
          </div>

          <p style={S.subTitle}>Unloading Services</p>
          <p style={S.justify}>Any movement of materials by stairs above 2nd floor will attract the following additional charge/s:</p>
          <div style={S.list}>
            <ListItem num={1} text="A fixed unloading charge of Rs. 5000 shall be charged for movement of material from 3rd floor and above where the service lift is unavailable." />
            <ListItem num={2} text="An additional charge of Rs. 2000 will be applicable for each floor movement of material from the 9th floor and above, where the service lift is unavailable." />
          </div>

          <p style={S.subTitle}>Notice</p>
          <p style={S.justify}>
            Customer shall send any legal notice or court summons or mediation proceeding summons or any other legal document to the following registered address of the Company: <strong>LIVINCART AND SERVICES PRIVATE LIMITED, Legal Team, 3rd floor, 30-15-35, above IDBI Bank, near Saraswati Park Road, Daba Gardens, Visakhapatnam, Andhra Pradesh 530020</strong>.
          </p>

          <p style={S.subTitle}>Cancellation Policy</p>
          <table style={S.table}>
            <thead>
              <tr style={{ backgroundColor: "rgba(254, 143, 62, 1)", color: "#ffffff" }}>
                <th style={S.th}>Time of cancellation</th>
                <th style={S.th}>Stage of Order</th>
                <th style={S.th}>Policy</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={S.td}>Within 48 hours from order booking and if Site Measurement or First Design Discussion has not happened</td>
                <td style={S.td}>Design Stage</td>
                <td style={S.td}>100% refund of the Order Booking Amount shall be made</td>
              </tr>
              <tr>
                <td style={S.td}>After 48 hours from Order Booking or if Site Measurement and First Design Discussion has happened</td>
                <td style={S.td}>Design Stage</td>
                <td style={S.td}>Nil Refund</td>
              </tr>
              <tr>
                <td style={S.td}>Any time period after payment of Second Installment or if Production is completed</td>
                <td style={S.td}>Production Stage</td>
                <td style={S.td}>Nil refund. *The customer will not be eligible for any refund and shall be obligated to pay the remaining price of Order Value of the project to Livincart i.e. the remaining 40%, in compliance with the Works Contract.</td>
              </tr>
            </tbody>
          </table>


          {/* ─── END PAGE 10 / START PAGE 11 ─── */}


          <div style={{ backgroundColor: "#fff7ed", padding: "14px 16px", borderRadius: "8px", border: "1.5px solid #fed7aa", marginBottom: "16px" }}>
            <p style={{ ...S.body, fontWeight: "bold", color: "#ea580c", margin: "0 0 8px 0" }}>Cancellation Notes:</p>
            <div style={S.list}>
              {[
                "Order Booking Amount: The Order Booking Amount shall be the payment of First Installment by the Customer.",
                "Time period is computed from the date of order booking (i.e. Order Booking Amount received by Livincart).",
                "Design Stage: This Stage commences after Customer makes payment towards First Installment, and ends at the payment of the first Installment. Design stage starts with the Site measurement process.",
                "Production Stage: This Stage commences when the Customer makes successful payment towards Second Installment (i.e. 50% of the Total Order value). It is during this stage the orders are pushed for production.",
                "First Design Discussion: This is the date of the very first offline/online design discussion between the Customer and Livincart representatives.",
                "Site Measurement: Site Measurement refers to the date when Livincart representatives visit the Customer site for measurement/masking.",
                "Order Value: This can be defined as the total value of your project that shall be paid to Livincart, that may consist of both woodwork and non-woodwork, as finalized post the confirmation of quote. This value is inclusive of all discounts and tax, as applicable.",
                "Refunds as per above policy as applicable will be processed only to the customer bank account irrespective of what mode and from whose account we have received the original payment.",
                "This Cancellation Policy is applicable to all customers who have booked their order with Livincart w.e.f 29th October, 2025."
              ].map((text, idx) => (
                <ListItem key={idx} num={idx + 1} text={text} style={{ color: "#ea580c" }} />
              ))}
            </div>
          </div>

          <p style={S.subTitle}>Customer Conduct</p>
          <div style={S.list}>
            <ListItem num={1} text="Livincart prohibits discrimination against its representatives including on the basis of sex, race, religion, caste, origin, disability, marital status, gender identity, age, or any other characteristic that may be protected under applicable law." />
            <ListItem num={2} text="Customers are directed to treat all our representatives with respect and courtesy, and provide them a safe and compliant location to perform service(s) at the project site. Livincart shall be entitled to refuse to perform any service(s) if the Customer doesn’t comply with this section and/or the Customer has not provided a safe and compliant location and/or Customer has behaved in a discourteous, disrespectful, abusive, or otherwise inappropriate manner. Livincart reserves the right to withhold the services at its absolute discretion until the requirements under this section are fully complied. Non-compliance under this section may result in delay and affect the timeline of Delivery Guarantee." />
            <ListItem num={3} text="Customers agree that in an event where our representative behaves in a manner that is discourteous, disrespectful, abusive, inappropriate, or in violation of the law, Customer shall be required to report such incident with valid proofs at support@livincart.com within 48 hours." />
            <ListItem num={4} text="Customers are directed to keep all their communications in writing with our representative on their official email and keep the designated POC in loop. Any complaint/escalation marked to unnecessary party/s in the company shall be treated as non-compliance and the company reserves its right to take appropriate action." />
          </div>


          {/* ─── END PAGE 11 / START PAGE 12 ─── */}


          <p style={S.subTitle}>Personal Data and Privacy Policy</p>
          <div style={S.list}>
            {[
              "The Customer explicitly grants authorization to Livincart for the collection, storage, retention, processing, and utilization of personal data, including contact information, as outlined in our Privacy Policy. The Company shall use the personal data of the Customer only for the legitimate use to provide the product and services to the Customer.",
              "The Customer authorizes the Company to contact them through various channels such as phone, SMS, WhatsApp, and email. It is understood that such communication will exclusively pertain to the products or services provided, and the confidentiality of personal data will be maintained. Livincart retains the right to photograph and publish the completed work.",
              "Furthermore, the Customer allows the Company to share personal data, including contact information, with the vendors, franchisees and third-party suppliers, in accordance with our Privacy Policy.",
              "For a comprehensive understanding of our data handling practices, please refer to our Privacy Policy at https://www.Livincart.com/privacypolicy.",
              "Any notices intended for the Company in accordance with the personal data usage or deletion should be written to support@livincart.com.",
              "The customer confirms that they have read and agreed that all the terms of the works contract are accurate to the best of their knowledge and align with their requests."
            ].map((text, idx) => (
              <ListItem key={idx} num={idx + 1} text={text} />
            ))}
          </div>

          <p style={S.subTitle}>Governing Law and Jurisdiction</p>
          <div style={S.list}>
            <ListItem num={1} text="These Terms and Conditions shall be governed by and interpreted in accordance with the laws of India." />
            <ListItem num={2} text="Any dispute arising out of or in relation to this shall be subject to the exclusive jurisdiction of the courts at Visakhapatnam, India." />
          </div>

          <p style={S.subTitle}>Custom Quotation Offerings - Terms and Conditions*</p>
          <p style={S.justify}>
            The Custom Quotation Offerings – Terms and Conditions (“Custom Quotation T&Cs”) shall be applicable on the Custom Quotation provided by Livincart to the Customer, if any, wherein Livincart shall get the Custom work done through their Vendors. These Vendors through their expertise and experience, handle the necessary work involved in customs work of the Customer. The responsibility for the completion and quality of custom work lies solely with the Vendors, except as specified in these Terms &amp; Conditions.
          </p>
          <div style={S.list}>
            <ListItem num={1} text="Vendor/s - refers to individuals, organizations or Companies that are associated with Livincart for providing the Services related to Custom Work." />
            <ListItem num={2} text="Custom Work: Any/all custom work in the Quotation shall be differentiated from Livincart’s standard offerings, by using the terminology “Custom” prior to the description of such product/service." />
            <ListItem num={3} text="Data Protection and Customer Consent: This Consent pertains to the sharing of Customers information with Vendors engaged by Livincart for the purpose of providing Custom Work." />
          </div>


          {/* ─── END PAGE 12 / START PAGE 13 ─── */}


          <div style={S.list}>
            <ListItem num={4} text="Designs - The designs for the Custom Scope of Work shall be provided by Livincart, in discussion with the Customer. However, there can be no changes/revisions to the designs finalized, post the payment of Second Installment by the Customer." />
            <ListItem num={5} text="Non-Solicitation - Customer shall not approach any Vendors undertaking the Custom Scope of Work, directly or indirectly, without the explicit written consent of Livincart." />
            {[
              "In case of any issues, concerns or dispute before handover, the Customer should reach out to the Livincart project manager.",
              "Customer shall not indulge in any unethical/illegal practices including but not limited to bribery, or any direct payment to the Vendor or its representative(s) either in cash or kind.",
              "No-Delivery Guarantee: In case of there being any Custom Work in the overall scope of project, such project shall automatically be categorized under Estimated Timeline Commitment.",
              "Warranty: Livincart shall provide 1 year warranty on the Custom Scope of Work from the date of handover.",
              "Variation in price in Custom Work: The exact cost of the project under the Custom Scope of Work shall be dependent upon the measurements, change in design, material, finishes etc. Based on such revisions, the cost of Custom Work may increase or decrease by approximately 10 to 20%.",
              "Relationship between Livincart and the Vendor: Livincart shall act as a facilitator between the Vendor and the Customer. Livincart is not liable for any product or service(s) to be rendered by the Vendor.",
              "Disclaiming of Liability: Livincart shall not be liable in any manner for any products or services provided by Vendors, contractors, or agencies who are referred to the Customer but are not formally registered as approved Vendors with Livincart.",
              "These Custom Quotation T&Cs are governed by the laws of India. Any dispute shall be governed exclusively by the courts of Visakhapatnam only.",
              "In case of conflict between the Customer Quotation T&Cs and other Terms and Conditions including Works Contract, the provisions under the Works Contract shall prevail.",
              "In the event of any misuse or abuse of the process by the Customer and/or Vendor, Livincart reserves the right to deny or cancel the project without any liability.",
              "Livincart shall not be liable for any loss or damage resulting from material breach of any terms and condition(s) by the Customer, including negligence.",
              "Livincart shall not be liable for any indirect, punitive, special, incidental or consequential damages arising out or in connection with the Custom Work.",
              "Livincart shall not be liable for loss or damage arising due to Force Majeure event.",
              "In any event, the entire liability of Livincart under Custom Work shall not exceed the amount of price paid to Livincart for such Custom Scope of Work, at the time of dispute.",
              "Livincart reserves the right to alter, modify or withdraw the Custom Work and underlined T&Cs anytime without any liability."
            ].map((text, idx) => (
              <ListItem key={idx} num={idx + 6} text={text} />
            ))}
          </div>


          {/* ─── END PAGE 13 / START PAGE 14 ─── */}


          <p style={{ ...S.body, fontWeight: "bold" }}>Brands associated with Livincart (but not limited to):</p>
          <table style={S.table}>
            <thead>
              <tr style={{ backgroundColor: "rgba(254, 143, 62, 1)", color: "#ffffff" }}>
                <th style={S.th}>Category</th>
                <th style={S.th}>Brands Associated With</th>
              </tr>
            </thead>
            <tbody>
              {(brandsList || DEFAULT_BRANDS_LIST).map((item, idx) => (
                <tr key={idx}>
                  <td style={S.td}>{item.category}</td>
                  <td style={S.td}>{item.brands}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ backgroundColor: "#fff7ed", padding: "10px 14px", borderRadius: "8px", border: "1.5px solid #fed7aa", marginTop: 10 }}>
            <p style={{ fontFamily: FONT, fontSize: "9.5pt", color: "#000000", margin: 0, fontWeight: 600 }}>
              This Brand Association Table includes a list of all the brands Livincart is associated with. Livincart reserves the right to use a subset of the products of these individual brands in its catalogue. Livincart also reserves the right to change it from time to time without any prior notice to the Customer.
            </p>
          </div>

          <p style={{ fontFamily: FONT, fontSize: "11pt", fontWeight: "bold", margin: "40px 0 20px 0", textAlign: "center" }}>
            IN WITNESS WHEREOF the parties hereto have signed this agreement.
          </p>

          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 28, tableLayout: "fixed", pageBreakInside: "avoid", breakInside: "avoid" }}>
            <tbody>
              <tr>
                <td style={{ width: "46%", verticalAlign: "top", textAlign: "left", padding: "12px 14px", border: "1.5px solid #fed7aa", borderRadius: "8px", backgroundColor: "#fff7ed", boxSizing: "border-box" }}>
                  <p style={{ margin: 0, fontWeight: "bold", color: "#ea580c", fontSize: "10pt" }}>1. Authorized Signatories from Company</p>
                  <p style={{ margin: "10px 0 2px 0", fontSize: "10pt", color: "#000000" }}>Full Name: <strong>Janapareddy Madhu Satya Sai</strong></p>
                  <div style={{ margin: "4px 0", minHeight: "45px", height: "48px", display: "flex", alignItems: "center" }}>
                    <img src={OWNER_SIGNATURE_BASE64} alt="Livincart Owner Signature" style={{ height: "45px", maxWidth: "160px", objectFit: "contain", display: "block" }} />
                  </div>
                  <p style={{ margin: "4px 0 0 0", borderTop: "1px dashed #ea580c", paddingTop: "5px", fontSize: "9pt", color: "#64748b" }}>Signature</p>
                </td>
                <td className="sig-spacer-td" style={{ width: "8%", border: "none !important", backgroundColor: "transparent", background: "transparent", padding: 0 }}>&nbsp;</td>
                <td style={{ width: "46%", verticalAlign: "top", textAlign: "left", padding: "12px 14px", border: "1.5px solid #fed7aa", borderRadius: "8px", backgroundColor: "#fff7ed", boxSizing: "border-box" }}>
                  <p style={{ margin: 0, fontWeight: "bold", color: "#ea580c", fontSize: "10pt" }}>2. Authorized Signatories from Client</p>
                  <p style={{ margin: "10px 0 2px 0", fontSize: "10pt", color: "#000000" }}>Full Name: <strong>{clientName}</strong></p>
                  <div style={{ margin: "4px 0", minHeight: "45px", height: "48px", display: "flex", alignItems: "center" }}>
                    {clientSignature ? (
                      <img src={clientSignature} alt="Client Signature" style={{ height: "45px", maxWidth: "160px", objectFit: "contain", display: "block" }} />
                    ) : null}
                  </div>
                  <p style={{ margin: "4px 0 0 0", borderTop: "1px dashed #ea580c", paddingTop: "5px", fontSize: "9pt", color: "#64748b" }}>Signature</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ─── CONDITIONAL HANDOVER AGREEMENT MERGE (LIVINCART INTERIOR PROJECT HANDOVER AGREEMENT) ─── */}
      {includeHandover && (
        <div className="page" style={{ ...S.page, pageBreakBefore: includeContract ? "always" : "auto", breakBefore: includeContract ? "page" : "auto", marginTop: includeContract ? "24px" : "0px" }}>
          {/* Handover Header */}
          <div style={S.lhRow}>
            <div style={{ display: "table-cell", width: "25%", verticalAlign: "middle" }}>
              <img src={logo} alt="Livincart Logo" style={{ height: "48px", maxHeight: "48px", width: "48px", maxWidth: "48px", objectFit: "contain", display: "inline-block" }} />
            </div>
            <div style={{ display: "table-cell", width: "75%", verticalAlign: "middle", textAlign: "right", paddingRight: "24px" }}>
              <h2 style={{ margin: 0, fontSize: "10.5pt", fontWeight: "bold", color: "#000000", letterSpacing: "0.2px" }}>LIVINCART PROJECT HANDOVER AGREEMENT</h2>
              <p style={{ margin: "2px 0 0 0", fontSize: "9pt", fontWeight: "bold", color: "#ea580c" }}>INTERIOR PROJECT HANDOVER AGREEMENT</p>
            </div>
          </div>
          <hr style={{ borderTop: "1.5px solid #ea580c", margin: "8px 0 16px 0" }} />

          {/* Section 1 */}
          <div style={{ marginBottom: "14px" }}>
            <h3 style={{ fontSize: "11pt", fontWeight: "bold", color: "#ea580c", margin: "0 0 6px 0" }}>1. Parties</h3>
            <p style={S.body}>
              This Interior Project Handover Agreement ("Agreement") is entered into between <strong>LivinCart and Services Private Limited</strong> (hereinafter referred to as the <strong>"Company"</strong>), and the Client identified in the approved Works Contract, Quotation, or Purchase Order (hereinafter referred to as the <strong>"Client"</strong>).
            </p>
            <p style={S.body}>
              The Parties acknowledge and agree that the Company has substantially completed the interior works, supplied and installed the Products and Services forming part of the approved scope of work, and is formally handing over the completed Project to the Client in accordance with the terms of the Works Contract, approved Project Documents, and this Agreement. The Client agrees to accept possession of the completed Project, subject to any pending rectification items specifically recorded in this Agreement.
            </p>
            <p style={S.body}>
              This Agreement shall serve as conclusive evidence of the formal handover of the completed Project and shall govern the respective rights and obligations of the Parties arising after the date of handover.
            </p>
          </div>

          {/* Section 2 */}
          <div style={{ marginBottom: "14px" }}>
            <h3 style={{ fontSize: "11pt", fontWeight: "bold", color: "#ea580c", margin: "0 0 6px 0" }}>2. Project Details</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", margin: "8px 0", padding: "14px 16px", backgroundColor: "#fff7ed", color: "#000000", borderRadius: "8px", border: "1.5px solid #fed7aa", fontSize: "9.5pt", fontWeight: 600 }}>
              <div><strong style={{ color: "#ea580c" }}>Project ID:</strong> {refId || "___________"}</div>
              <div><strong style={{ color: "#ea580c" }}>Customer:</strong> {clientName || "___________"}</div>
              <div style={{ gridColumn: "span 2" }}><strong style={{ color: "#ea580c" }}>Address:</strong> {address || "___________"}</div>
              <div><strong style={{ color: "#ea580c" }}>Contract Value:</strong> <span style={{ fontFamily: "DejaVu Sans, Arial, sans-serif" }}>₹</span>{displayValue}</div>
              <div><strong style={{ color: "#ea580c" }}>Handover Date:</strong> {date || "___________"}</div>
            </div>
          </div>

          {/* Section 3 */}
          <div style={{ marginBottom: "14px" }}>
            <h3 style={{ fontSize: "11pt", fontWeight: "bold", color: "#ea580c", margin: "0 0 6px 0" }}>3. Scope of Handover</h3>
            <p style={S.body}>
              The Company confirms that the approved scope of work has been substantially completed in accordance with the Works Contract, approved Quotation, BOQ, drawings, specifications, and approved Change Orders.
            </p>
            <p style={S.body}>
              The handover includes, as applicable, furniture, modular units, wardrobes, kitchen units, civil works, electrical works, plumbing works, false ceiling, painting, flooring, lighting, glass works, hardware, curtains, blinds, appliances, accessories, and all other Products and Services specifically included in the approved scope.
            </p>
            <p style={S.body}>
              The Client acknowledges that the handover is limited to the items expressly included in the approved Project Documents. Any additional work, material, or service not specifically approved in writing shall be deemed excluded from the Company's obligations.
            </p>
            <p style={S.body}>
              The Parties acknowledge that minor variations in colour, texture, grain, finish, dimensions, or alignment that are consistent with industry standards and do not affect the functionality or quality of the Project shall not constitute defects. Any pending minor rectification items, if any, shall be recorded separately and completed within the mutually agreed timeline.
            </p>
          </div>

          {/* Section 4 */}
          <div style={{ marginBottom: "14px" }}>
            <h3 style={{ fontSize: "11pt", fontWeight: "bold", color: "#ea580c", margin: "0 0 6px 0" }}>4. Inspection, Testing and Acceptance of the project</h3>
            <p style={S.body}>
              The Client acknowledges that, prior to the execution of this Agreement, the Company has provided reasonable opportunity for a comprehensive joint inspection of the completed Project. Such inspection includes, but is not limited to, verification of dimensions, alignment, workmanship, finishes, colour shades, functionality of shutters, drawers, hinges, channels, locks, handles, lighting fixtures, electrical accessories, plumbing fixtures, hardware fittings, appliances (where supplied), and all other Products and Services forming part of the approved scope of work.
            </p>
            <p style={S.body}>
              The Client confirms that the Project has been inspected to their reasonable satisfaction and that any observations, deficiencies, or incomplete items identified during such inspection have been documented in writing in the Punch List annexed to this Agreement.
            </p>
            <p style={S.body}>
              The Client further acknowledges that minor aesthetic variations, natural characteristics of wood, veneer, stone, laminate, fabric, leather, glass, metal, paint texture, colour shade, grain pattern, or other natural materials shall not constitute manufacturing defects or grounds for rejection of the Project.
            </p>
            <p style={S.body}>
              Except for the items expressly recorded in writing, the Client accepts that the Project has been completed substantially in accordance with the approved drawings, Bill of Quantities (BOQ), specifications, material schedule, and approved change orders.
            </p>
          </div>

          {/* Section 5 */}
          <div style={{ marginBottom: "14px" }}>
            <h3 style={{ fontSize: "11pt", fontWeight: "bold", color: "#ea580c", margin: "0 0 6px 0" }}>5. Handover of Possession</h3>
            <p style={S.body}>
              Upon execution of this Agreement, the Company hereby hands over peaceful physical possession of the completed Project to the Client. The Client acknowledges receipt of the completed interior works and confirms that unrestricted access to the premises has been restored.
            </p>
            <p style={S.body}>
              From the date of handover, the Client shall assume responsibility for the care, security, operation, cleaning, maintenance, and preservation of all installed Products and completed works.
            </p>
            <p style={S.body}>
              The Company shall not be responsible for any damage, deterioration, theft, vandalism, accidental impact, misuse, negligence, water seepage, plumbing leakage, electrical faults originating from third-party installations, pest infestation, structural movement of the building, or any other event occurring after handover except to the extent covered under the applicable warranty.
            </p>
          </div>

          {/* Section 6 */}
          <div style={{ marginBottom: "14px" }}>
            <h3 style={{ fontSize: "11pt", fontWeight: "bold", color: "#ea580c", margin: "0 0 6px 0" }}>6. Warranty</h3>
            <p style={S.body}>
              The warranty for the Products and Services covered under the Project shall commence from the date of execution of this Handover Agreement, unless otherwise specified in the applicable Warranty Certificate. The warranty shall be governed by the terms of the Works Contract, Warranty Policy, and the manufacturer's warranty, where applicable.
            </p>
            <p style={S.body}>
              The warranty covers manufacturing defects and workmanship deficiencies arising under normal use and maintenance, subject to the terms, conditions, exclusions, and limitations specified in the Warranty Policy. The warranty shall not apply to normal wear and tear, misuse, negligence, accidental damage, unauthorized modifications or repairs, improper maintenance, water seepage, electrical faults, pest infestation, force majeure events, or any damage caused by factors beyond the Company's reasonable control.
            </p>
          </div>

          {/* Section 7 */}
          <div style={{ marginBottom: "14px" }}>
            <h3 style={{ fontSize: "11pt", fontWeight: "bold", color: "#ea580c", margin: "0 0 6px 0" }}>7. Transfer of Possession</h3>
            <p style={S.body}>
              Upon execution of this Handover Agreement, the Company shall be deemed to have delivered, and the Client shall be deemed to have accepted, peaceful physical possession of the completed Project and all Products and Services forming part of the approved scope of work.
            </p>
            <p style={S.body}>
              From the date of handover, the risk of loss, damage, theft, misuse, deterioration, or destruction of the completed Project shall pass to the Client, who shall thereafter be solely responsible for its care, operation, maintenance, and security. The Company shall not be liable for any damage or loss occurring after handover, except to the extent covered under the applicable warranty.
            </p>
            <p style={S.body}>
              Notwithstanding the transfer of possession and risk, legal ownership and title to the Products supplied by the Company shall remain vested in the Company until all amounts payable under the Works Contract, including the contract value, applicable taxes, approved variations, and any other outstanding dues, have been paid in full by the Client. Upon receipt of full and final payment, ownership of the Products shall automatically transfer to the Client without the need for any further documentation or action by either Party.
            </p>
          </div>

          {/* Section 8 */}
          <div style={{ marginBottom: "14px" }}>
            <h3 style={{ fontSize: "11pt", fontWeight: "bold", color: "#ea580c", margin: "0 0 6px 0" }}>8. Customer Responsibilities</h3>
            <p style={S.body}>
              Upon handover, the Client shall be responsible for the proper use, care, operation, and maintenance of all Products and completed works in accordance with the Company's Product Care Guide, Warranty Policy, and any maintenance instructions provided. The Client shall take reasonable precautions to protect the Products from misuse, negligence, accidental damage, water seepage, moisture, pest infestation, unauthorized alterations, or any other condition that may adversely affect their performance or durability.
            </p>
            <p style={S.body}>
              The Client shall promptly notify the Company in writing of any defect or issue covered under the applicable warranty and shall provide the Company with reasonable access to inspect and rectify such defects. Failure to maintain the Products in accordance with the prescribed care instructions or any unauthorized repair, modification, or relocation of the Products may result in the warranty being limited or void to the extent permitted under the applicable warranty terms.
            </p>
          </div>

          {/* Section 9 */}
          <div style={{ marginBottom: "14px" }}>
            <h3 style={{ fontSize: "11pt", fontWeight: "bold", color: "#ea580c", margin: "0 0 6px 0" }}>9. Company Responsibilities</h3>
            <p style={S.body}>
              The Company shall, subject to the terms of the Works Contract and Warranty Policy, attend to valid warranty claims and complete any agreed punch-list or rectification items within a reasonable timeframe, subject to site access and material availability.
            </p>
            <p style={S.body}>
              The Company shall use reasonable efforts to repair or replace defective Products or rectify workmanship defects covered under the applicable warranty. The Company shall not be liable for defects or damage arising from normal wear and tear, misuse, negligence, unauthorized modifications, improper maintenance, or any cause beyond its reasonable control. The Client shall provide reasonable access to the Project premises to enable inspection and completion of the required rectification works.
            </p>
          </div>

          {/* Section 10 */}
          <div style={{ marginBottom: "14px" }}>
            <h3 style={{ fontSize: "11pt", fontWeight: "bold", color: "#ea580c", margin: "0 0 6px 0" }}>10. Governing Law and Jurisdiction</h3>
            <p style={S.body}>
              This Agreement shall be governed by and construed in accordance with the laws of India. Any dispute, claim, or difference arising out of or relating to this Agreement, its interpretation, performance, breach, or termination shall, in the first instance, be resolved amicably through mutual discussions between the Parties.
            </p>
            <p style={S.body}>
              If the Parties are unable to resolve the dispute amicably within a reasonable period, such dispute shall be subject to the exclusive jurisdiction of the competent courts at <strong>Visakhapatnam, Andhra Pradesh</strong>, without prejudice to any dispute resolution mechanism provided under the Works Contract or applicable law.
            </p>
          </div>

          {/* Customer Declaration */}
          <div style={{ margin: "20px 0 14px 0", padding: "14px 16px", backgroundColor: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: "8px", color: "#000000" }}>
            <h4 style={{ margin: "0 0 6px 0", fontSize: "10pt", fontWeight: "bold", color: "#ea580c" }}>Customer Declaration</h4>
            <p style={S.body}>
              I hereby acknowledge that I have jointly inspected the completed Project and confirm that the Products and Services have been handed over to my satisfaction, subject to any observations or pending rectification items specifically recorded in this Agreement. I further acknowledge receipt of possession of the completed interior works, warranty documents, user manuals, keys (where applicable), invoices, and other relevant project documents.
            </p>
            <p style={{ ...S.body, marginTop: 6 }}>
              I confirm that I have been informed of the applicable warranty terms, product care and maintenance guidelines, and my responsibilities after handover. I agree to comply with the terms of the Works Contract, Warranty Policy, and this Handover Agreement, and acknowledge that the Project has been formally handed over to me on the date of execution of this Agreement.
            </p>
          </div>

          {/* Handover Signatures Table */}
          <div style={{ marginTop: 20 }}>
            <h4 style={{ margin: "0 0 8px 0", fontSize: "10pt", fontWeight: "bold", color: "#ea580c" }}>Signatures</h4>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt", border: "1px solid #cbd5e1" }}>
              <thead>
                <tr style={{ backgroundColor: "rgba(254, 143, 62, 1)", color: "#ffffff", fontWeight: "bold" }}>
                  <th style={{ padding: "8px 12px", border: "1px solid #1e293b", width: "50%", textAlign: "left", color: "#ffffff", backgroundColor: "rgba(254, 143, 62, 1)" }}>LivinCart Authorized Signatory</th>
                  <th style={{ padding: "8px 12px", border: "1px solid #1e293b", width: "50%", textAlign: "left", color: "#ffffff", backgroundColor: "rgba(254, 143, 62, 1)" }}>Client</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: "10px 12px", border: "1px solid #cbd5e1", verticalAlign: "top" }}>
                    <div>Name: <strong>Janapareddy Madhu Satya Sai</strong></div>
                    <div style={{ margin: "6px 0", display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "9pt", fontWeight: 600, marginRight: "6px" }}>Signature: </span>
                      <img src={OWNER_SIGNATURE_BASE64} alt="Livincart Owner Signature" style={{ height: "38px", maxWidth: "140px", objectFit: "contain" }} />
                    </div>
                    <div>Date: {date}</div>
                  </td>
                  <td style={{ padding: "10px 12px", border: "1px solid #cbd5e1", verticalAlign: "top" }}>
                    <div>Name: <strong>{clientName}</strong></div>
                    <div style={{ margin: "6px 0", display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "9pt", fontWeight: 600, marginRight: "6px" }}>Signature: </span>
                      {clientSignature ? (
                        <img src={clientSignature} alt="Client Signature" style={{ height: "38px", maxWidth: "140px", objectFit: "contain" }} />
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
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: {
    fontFamily: FONT,
    letterSpacing: "0px",
    wordSpacing: "normal",
    width: "100%",
    maxWidth: "100%",
    minHeight: "auto",
    margin: "0 auto",
    padding: "0px",
    background: "#ffffff",
    boxSizing: "border-box",
    fontSize: "9.5pt",
    lineHeight: "1.55",
    color: "#0f172a",
    borderRadius: "0",
    boxShadow: "none",
    border: "none",
    wordBreak: "break-word",
    overflowWrap: "break-word",
  },
  lhRow: { display: "table", width: "100%", tableLayout: "fixed", marginBottom: 6, boxSizing: "border-box", fontFamily: FONT, letterSpacing: "0px" },
  lhLeft: { display: "table-cell", width: "40%", verticalAlign: "middle", fontFamily: FONT, letterSpacing: "0px" },
  lhRight: { display: "table-cell", width: "60%", verticalAlign: "middle", textAlign: "right", fontFamily: FONT, letterSpacing: "0px" },
  firmName: { fontFamily: FONT, letterSpacing: "0px", fontSize: "13pt", margin: 0, lineHeight: "1.3em" },
  contact: { fontFamily: FONT, letterSpacing: "0px", fontSize: "8.5pt", margin: "2px 0 0 0", color: "#64748b" },
  subTitle: { fontFamily: FONT, letterSpacing: "0px", fontWeight: "bold", fontSize: "11pt", textDecoration: "underline", textUnderlineOffset: "5px", color: "#ea580c", marginTop: 16, marginBottom: 12, pageBreakAfter: "avoid", breakAfter: "avoid" },
  body: { fontFamily: FONT, letterSpacing: "0px", wordSpacing: "normal", margin: "0 0 6px", fontSize: "9.5pt", lineHeight: "1.55", wordBreak: "break-word", overflowWrap: "break-word" },
  justify: { fontFamily: FONT, letterSpacing: "0px", wordSpacing: "normal", textAlign: "left", margin: "0 0 6px", fontSize: "9.5pt", lineHeight: "1.55", wordBreak: "break-word", overflowWrap: "break-word" },
  list: { marginBottom: "8px", fontFamily: FONT, letterSpacing: "0px" },
  listItem: { fontFamily: FONT, letterSpacing: "0px", display: "table", width: "100%", tableLayout: "fixed", marginBottom: "4px", fontSize: "9.5pt", lineHeight: "1.55", boxSizing: "border-box" },
  listNum: { fontFamily: FONT, letterSpacing: "0px", display: "table-cell", width: "24px", verticalAlign: "top", fontWeight: "bold", color: "#0f172a" },
  listText: { fontFamily: FONT, letterSpacing: "0px", display: "table-cell", verticalAlign: "top", lineHeight: "1.55", wordBreak: "break-word", overflowWrap: "break-word" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "8.5pt", margin: "8px 0", border: "1px solid #cbd5e1", pageBreakInside: "avoid", breakInside: "avoid", boxSizing: "border-box", fontFamily: FONT, letterSpacing: "0px" },
  th: { border: "none", padding: "6px 8px", fontWeight: "bold", textAlign: "left", backgroundColor: "rgba(254, 143, 62, 1)", color: "#ffffff", fontFamily: FONT, letterSpacing: "0px" },
  td: { border: "1px solid #cbd5e1", padding: "6px 8px", verticalAlign: "top", wordBreak: "break-word", fontFamily: FONT, letterSpacing: "0px", lineHeight: "1.55" },
};
