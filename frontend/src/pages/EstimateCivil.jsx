import React, { useState, useEffect, useCallback } from 'react';
import { Printer, Save, CheckCircle, Edit2, Check, Plus, Trash2 } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { useAuth } from '../hooks/useAuth';

const DEFAULT_SECTIONS = [
  {
    section: "1.00", title: "CIVIL WORKS",
    items: [
      { no:"1.1", desc:"Excavation and Refilling: Earthwork in excavation and refilling in foundation, Trenches & plinth in all kinds of soil to the required size & depth, including dressing of sides & pumping and bailing out of water from the trenches & pits & timbering & shoring etc., as may be required. Item includes handling, re-handling etc. as may be required for refilling available earth into the trenches, spaces between & around the building, sides of foundation or in plinth and under floors etc. consolidating each deposited layer by watering and ramming in layers of 20cm in depth, and/or disposal/stacking of surplus soil as directed within a lead of 150 meters. Item includes dressing & levelling of the perimeter of the site with surplus earth up to a width of 6 mts all around. All kinds of soils for all leads, lifts depths, complete as per Architect's drawing & direction.", unit:"Cft", qty:"5,850.00", rate:"8.00", amount:46800 },
      { no:"1.2", desc:"Plain Cement Concrete (PCC): Providing and laying PCC of specified grade as bed concrete under foundation, column footing, beams, under floors, Correction course etc. Including aggregate 20mm for 1:2:4 & 1:3:6 and 40mm & down for 1:4:8 & 1:5:10. PCC mix 1:2:4 (1 Cement : 2 Coarse Sand : 4 Aggregate), complete as per Architect's drawing & direction.", unit:"Cft", qty:"1,315.00", rate:"135.00", amount:177525 },
      { no:"1.10", desc:"Reinforced Cement Concrete (RCC): Providing and laying & testing M20 grade RCC in lintels, ties, counter shelves, slabs, including making/leaving openings/cutouts etc., at all heights & levels. Including preparation of concrete surfaces to receive plaster or any other finishes, complete as per Architect's drawing & direction.", unit:"Cft", qty:"8,500.00", rate:"190.00", amount:1615000 },
      { no:"1.20", desc:"Reinforcement Bars: Supply, straightening, cutting, bending and binding with binding wire of annealed steel wire 0.9 to 1.69mm thickness and placing in position reinforcement bars, to correct shape and size as per detailed drawings for all RCC work in substructure and super structure such as footings, walls, columns, beams, slabs, rafts etc. Wastages, laps, rolling margin & binding wire not measured or paid extra, complete as per Architect's drawing & direction.", unit:"Ton", qty:"27.00", rate:"75,000.00", amount:2025000 },
      { no:"1.30", desc:"Centring and Shuttering: Providing & fixing centring and shuttering including strutting, propping etc. and removal of form for slabs, balconies, lintels, staircase, shelves, columns, beams, Arches etc., complete as per Architect's drawing & direction.", unit:"Sqft", qty:"16,300.00", rate:"40.00", amount:652000 },
      { no:"1.40", desc:"230mm Brick Work: Providing and laying brickmasonry with 230mm thick red bricks in super structure above plinth level up to floor III level with RCC band at sill level and lintel level with approved block laying polymer modified adhesive mortar. Payment of RCC band and reinforcement shall be made separately.", unit:"Cft", qty:"2,560.00", rate:"150.00", amount:384000 },
      { no:"1.50a", desc:"115mm Half Brick Walls: Providing and laying autoclaved aerated cement blocks masonry with 100mm thick AAC blocks in super structure above plinth level in cement mortar 1:4. The rate includes providing and placing 2 Nos 6mm dia M.S. bars at every third course of masonry work.", unit:"Cft", qty:"1,000.00", rate:"120.00", amount:120000 },
      { no:"1.50b", desc:"150mm Brick Walls: Providing and laying autoclaved aerated cement blocks masonry with 150mm thick AAC blocks in super structure above plinth level in cement mortar 1:4. The rate includes providing and placing 2 Nos 6mm dia M.S. bars at every third course of masonry work.", unit:"Cft", qty:"400.00", rate:"120.00", amount:48000 },
      { no:"1.60a", desc:"External Plaster: 15mm to 18mm thick external plaster to rough & fair side of brick masonry, RCC columns, soffits of beams etc. in cement mortar 1:5 applied, finished smooth and cured complete including GI corner/edge trims, complete as per Architect's drawing & direction.", unit:"Sqft", qty:"11,300.00", rate:"35.00", amount:395500 },
      { no:"1.60b", desc:"Internal Plaster: 12mm to 15mm thick internal plaster in cement mortar 1:4 on brick/block masonry walls, RCC columns, beams etc., finished smooth and cured complete as per Architect's drawing & direction.", unit:"Sqft", qty:"14,100.00", rate:"35.00", amount:493500 },
    ]
  },
  {
    section: "2.00", title: "WATERPROOFING WORKS",
    items: [
      { no:"2.10", desc:"Tapecrete Waterproofing: Providing and laying tapecrete waterproofing for sunken portions of toilet and terraces. 1st layer of cement slurry mixed with waterproof compound (Dr. Fixit or equivalent). 2nd layer of 20mm cement mortar 1:3 mixed with waterproofing compound in recommended proportion, complete as per architect's specification and drawings.", unit:"Sqft", qty:"1,930.00", rate:"50.00", amount:96500 },
      { no:"2.20", desc:"Khangar Filling: Providing & filling khangar in toilet sunken area complete as per architect's specification and drawings.", unit:"Sqft", qty:"380.00", rate:"55.00", amount:20900 },
    ]
  },
  {
    section: "3.00", title: "FLOORING WORKS",
    items: [
      { no:"3.10", desc:"Granite on Staircase: Providing and laying 16 to 18mm thk Granite stone on staircase in Flooring/Flooring Bands & skirting (of approved color and size) with half round nosing laid over 20mm thickness of cement mortar 1:4 mix jointed with white cement slurry, mixed with pigment to match color of stone, including cutting, edge polishing, rubbing, polishing etc. (Basic rate of stone @ Rs.120/Sqft)", unit:"Sqft", qty:"700.00", rate:"350.00", amount:245000 },
      { no:"3.20", desc:"Anti Skid Ceramic Tiles on toilet floors & terrace floors: Providing and laying Ceramic tiles of size 300mm x 450mm on Cement mortar 1:4 jointed with 5mm Spacer filled tile grouting of Unitile or equivalent. (Basic Rate of Rs.60/-sft) Complete as per architect's drawings and design.", unit:"Sqft", qty:"335.00", rate:"120.00", amount:40200 },
      { no:"3.30", desc:"Ceramic Tiles on toilet Walls: Providing and laying Ceramic tiles of size 300mm x 450mm on Cement mortar 1:4 jointed with 5mm Spacer filled tile grouting of Unitile or equivalent. (Basic Rate of Rs.50/-sft) Complete as per architect's drawings and design.", unit:"Sqft", qty:"2,140.00", rate:"150.00", amount:321000 },
      { no:"3.40", desc:"Indian Marble Flooring: Providing and Laying Indian marble slabs for flooring having thickness 18mm of approved quality, type & colour. Including cutting to required sizes, shapes & pattern, laying to required level/slope, providing & laying cement mortar (1:4) bed of average thickness 25mm with white cement slurry/paste, cleaning joints and grouting in neat white cement paste with pigmented additives. The sand to be used shall be Quartz sand, coarse, well graded, clean & free from dust. Rate includes Mirror polishing, curing, cleaning etc. complete.", unit:"Sqft", qty:"3,655.00", rate:"400.00", amount:1462000 },
      { no:"3.50", desc:"Indian Marble Skirting: Providing and Laying Indian Marble Skirting 18-20mm thick, Height 100mm of approved quality, type & colour. Including all surface preparation, chipping of Plaster/masonry, cement mortar (1:4) bed 12 to 15mm thick, white cement slurry/paste fixing, cleaning joints with pigmented cement paste, Mirror Polishing, curing, cleaning etc. complete.", unit:"Rft", qty:"655.00", rate:"150.00", amount:98250 },
      { no:"3.60", desc:"Parking Tile Flooring: Providing and Laying anti-skid parking tiles on cement mortar (1:4) bed, jointed with cement slurry, including all surface preparation, curing, cleaning etc. complete as per architect's drawings and design.", unit:"Sqft", qty:"1,420.00", rate:"200.00", amount:284000 },
    ]
  },
  {
    section: "4.00", title: "FINISHING WORKS",
    items: [
      { no:"4.10", desc:"External Textured Paint: Providing and applying external textured paint (Spectrum make Granila finish) with trowel finish on external walls, with preparation of surfaces, scaffolding etc., three or more coats on new work with one coat of primer. Complete as per design and drawing.", unit:"Sqft", qty:"2,195.00", rate:"60.00", amount:131700 },
      { no:"4.20", desc:"HPL Cladding: Providing and applying external wood cladding with 6\" wide sal wood. Including all the framework required. Complete as per architect's instructions and drawings.", unit:"Sqft", qty:"460.00", rate:"120.00", amount:55200 },
      { no:"4.30", desc:"External Paint: Providing and applying external paint (Spectrum make Granila finish) with trowel finish on external walls, with preparation of surfaces, including scaffolding etc., three or more coats on new work with one coat of primer. Complete as per design and drawing.", unit:"Sqft", qty:"8,600.00", rate:"30.00", amount:258000 },
      { no:"4.40", desc:"Interior Plastic Paint: Providing and applying plastic emulsion paint with roller finish of approved brand on internal walls, with preparation of surfaces, three or more coats on new work with one coat of primer, at all heights & levels. Complete as per design and drawing.", unit:"Sqft", qty:"14,100.00", rate:"45.00", amount:634500 },
    ]
  },
  {
    section: "5.00", title: "DOORS AND WINDOWS",
    items: [
      { no:"5.10", desc:"UPVC Sliding Doors & Windows: Providing and fixing UPVC sliding doors and windows of approved make and colour, with all required hardware, accessories, rubber gaskets, etc., complete as per architect's drawing and direction.", unit:"Sqft", qty:"1,280.00", rate:"550.00", amount:704000 },
      { no:"5.20", desc:"Flush Doors: Providing and fixing 35mm thick Internal decorative Flush Door shutters with chowkhat as per design in IInd class teak wood (basic cost of wood Rs.1600/cft) with wood beading and 8mm glass vision panel as per the design. Including all nails, screws, glues, melamine polishing, door stopper, brushed steel 125mm heavy duty hinges (4 nos), buffers, etc. Including door sections 5\"x2.5\" in IInd class teak wood with holdfasts/cleats, 2 coats of fire retardant & anti-termite paint on concealed surfaces, locks & handles. Without jali shutter.", unit:"Sqft", qty:"260.00", rate:"1,250.00", amount:325000 },
      { no:"5.30", desc:"WPC Doors: Providing and fixing WPC (Wood Plastic Composite) door frames and shutters of approved make, complete with all hardware, hinges, locks, handles etc., as per architect's drawing and direction.", unit:"Sqft", qty:"225.00", rate:"350.00", amount:78750 },
    ]
  },
  {
    section: "6.00", title: "MISCELLANEOUS WORKS",
    items: [
      { no:"6.10", desc:"SS Railing: Providing and fixing SS railing for balconies with 304 grade SS sections and 12mm toughened glass panels as per Architect's Instructions & Drawings.", unit:"Rft", qty:"81.00", rate:"1,200.00", amount:97200 },
      { no:"6.20", desc:"MS Railing: Providing and fixing MS railing for staircase and balconies and compound wall complete as per Architect's Instructions & Drawings.", unit:"Rft", qty:"115.00", rate:"200.00", amount:23000 },
      { no:"6.30", desc:"Anti Termite Treatment: Providing and doing Anti termite treatment for all the floors in three stages, as per IS code and architect's specification.", unit:"Sqft", qty:"2,975.00", rate:"10.00", amount:29750 },
    ]
  }
];

const fmt = (v) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(v) || 0);

export default function EstimateCivil() {
  const { user } = useAuth();
  const canEdit = user && ['admin', 'principal_architect', 'accountant'].includes(user.role);

  const [sections, setSections]   = useState(DEFAULT_SECTIONS);
  const [saving, setSaving]       = useState(false);
  const [saveMsg, setSaveMsg]     = useState('');
  const [loading, setLoading]     = useState(true);
  const [editingHeader, setEditingHeader] = useState(false);
  const [header, setHeader] = useState({
    title: 'Detail Project Cost for Proposed Residence',
    client: 'Mr. Venu at Nerellavalasa',
    company: 'ARK Architects and Interior Designers',
    date: '18.08.2019'
  });

  // Load from DB on mount
  useEffect(() => {
    fetch(`${API_BASE_URL}/civil-estimate`)
      .then(r => r.json())
      .then(res => {
        if (res.success && res.data) {
          if (res.data.sections) setSections(res.data.sections);
          if (res.data.header) setHeader(res.data.header);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleItemChange = (sIdx, iIdx, field, val) => {
    setSections(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const item = next[sIdx].items[iIdx];
      item[field] = val;
      
      // Auto-calculate amount if qty or rate changes
      if (field === 'qty' || field === 'rate') {
        const qty = parseFloat(item.qty?.toString().replace(/,/g, '')) || 0;
        const rate = parseFloat(item.rate?.toString().replace(/,/g, '')) || 0;
        item.amount = qty * rate;
      }
      return next;
    });
  };

  const handleSectionChange = (sIdx, field, val) => {
    setSections(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      next[sIdx][field] = val;
      return next;
    });
  };

  const handleAddSection = () => {
    setSections(prev => [
      ...prev,
      {
        section: `${prev.length + 1}.00`,
        title: "NEW SECTION",
        items: []
      }
    ]);
  };

  const handleDeleteSection = (sIdx) => {
    if (!window.confirm('Delete this section?')) return;
    setSections(prev => prev.filter((_, i) => i !== sIdx));
  };

  const handleAddItem = (sIdx) => {
    setSections(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      next[sIdx].items.push({
        no: `${next[sIdx].section.split('.')[0]}.${next[sIdx].items.length + 1}`,
        desc: "New Item",
        unit: "Nos",
        qty: "1",
        rate: "0",
        amount: 0
      });
      return next;
    });
  };

  const handleDeleteItem = (sIdx, iIdx) => {
    if (!window.confirm('Delete this item?')) return;
    setSections(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      next[sIdx].items = next[sIdx].items.filter((_, i) => i !== iIdx);
      return next;
    });
  };

  const sectionTotals = sections.map(s => s.items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0));
  const subTotal      = sectionTotals.reduce((a, b) => a + b, 0);
  const plumbing      = subTotal * 0.08;
  const electrical    = subTotal * 0.08;
  const grandTotal    = subTotal + plumbing + electrical;

  const handleSave = async () => {
    setSaving(true); setSaveMsg('');
    try {
      const res = await fetch(`${API_BASE_URL}/civil-estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          header,
          sections,
          grand_total: grandTotal
        })
      });
      const data = await res.json();
      setSaveMsg(data.success ? '✅ Saved successfully!' : '❌ ' + data.message);
    } catch (e) {
      setSaveMsg('❌ Failed to connect to server');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(''), 3000);
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading estimate…</div>;

  return (
    <div style={{ background: '#f4f6f8', minHeight: '100vh', padding: '24px 0' }}>

      {/* Toolbar — hidden on print */}
      <div className="no-print" style={{ display:'flex', gap:12, justifyContent:'flex-end', padding:'0 32px 20px' }}>
        {saveMsg && (
          <span style={{ alignSelf:'center', fontWeight:600, color: saveMsg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>
            {saveMsg}
          </span>
        )}
        <button onClick={handleSave} disabled={saving}
          style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 22px', background:'#16a34a', color:'#fff', border:'none', borderRadius:8, fontWeight:700, cursor:'pointer', fontSize:15 }}>
          <Save size={18}/>{saving ? 'Saving…' : 'Save Estimate'}
        </button>
        <button onClick={() => window.print()}
          style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 22px', background:'#2563eb', color:'#fff', border:'none', borderRadius:8, fontWeight:700, cursor:'pointer', fontSize:15 }}>
          <Printer size={18}/> Print
        </button>
      </div>

      {/* ── PRINT AREA — everything inside this div prints ── */}
      <div className="print-area" style={{ background:'#fff', maxWidth:980, margin:'0 auto', padding:'40px 44px', borderRadius:10 }}>

        {/* ═══════════════ PAGE 1: SUMMARY ═══════════════ */}
        <div style={{ textAlign:'center', marginBottom:32, position:'relative' }}>
          {canEdit && (
            <button className="no-print" onClick={() => setEditingHeader(h => !h)}
              style={{ position:'absolute', right:0, top:0, background: editingHeader ? '#16a34a':'#2563eb', color:'#fff', border:'none', borderRadius:6, padding:'5px 12px', cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontSize:13, fontWeight:600 }}>
              {editingHeader ? <><Check size={14}/> Done</> : <><Edit2 size={14}/> Edit Header</>}
            </button>
          )}
          {editingHeader ? (
            <div style={{ display:'flex', flexDirection:'column', gap:8, alignItems:'center', padding:'8px 0' }}>
              <input value={header.title} onChange={e => setHeader(h=>({...h, title:e.target.value}))}
                style={{ width:'80%', padding:'8px 12px', fontSize:16, fontWeight:700, textAlign:'center', border:'1.5px solid #2563eb', borderRadius:6 }} placeholder="Title" />
              <input value={header.client} onChange={e => setHeader(h=>({...h, client:e.target.value}))}
                style={{ width:'60%', padding:'6px 12px', fontSize:14, fontWeight:600, textAlign:'center', border:'1.5px solid #2563eb', borderRadius:6 }} placeholder="Client Name" />
              <div style={{ display:'flex', gap:12, justifyContent:'center' }}>
                <input value={header.company} onChange={e => setHeader(h=>({...h, company:e.target.value}))}
                  style={{ width:'280px', padding:'6px 10px', fontSize:12, textAlign:'center', border:'1.5px solid #2563eb', borderRadius:6 }} placeholder="Company Name" />
                <input value={header.date} onChange={e => setHeader(h=>({...h, date:e.target.value}))}
                  style={{ width:'120px', padding:'6px 10px', fontSize:12, textAlign:'center', border:'1.5px solid #2563eb', borderRadius:6 }} placeholder="Date" />
              </div>
            </div>
          ) : (
            <>
              <h1 style={{ fontSize:20, fontWeight:700, margin:'0 0 6px', textTransform:'uppercase', letterSpacing:1 }}>
                {header.title}
              </h1>
              <h2 style={{ fontSize:15, fontWeight:600, color:'#444', margin:'0 0 4px' }}>
                For {header.client}
              </h2>
              <p style={{ fontSize:12, color:'#666', margin:0 }}>{header.company} &nbsp;|&nbsp; Date: {header.date}</p>
            </>
          )}
        </div>

        {/* Summary Table */}
        <table style={TS.table}>
          <thead>
            <tr>
              {['SL.NO', 'ITEMS', 'AMOUNT (₹)'].map(h => (
                <th key={h} style={{ ...TS.th, textAlign: h==='AMOUNT (₹)' ? 'right' : 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sections.map((sec, i) => (
              <tr key={`summary-${i}`}>
                <td style={TS.td}>{sec.section}</td>
                <td style={TS.td}>{sec.title}</td>
                <td style={{ ...TS.td, textAlign:'right' }}>{fmt(sectionTotals[i])}</td>
              </tr>
            ))}
            <tr style={{ background:'#f0f4fa' }}>
              <td colSpan={2} style={{ ...TS.td, fontWeight:700, textAlign:'right' }}>TOTAL</td>
              <td style={{ ...TS.td, fontWeight:700, textAlign:'right' }}>{fmt(subTotal)}</td>
            </tr>
            <tr>
              <td style={TS.td}>7.0</td>
              <td style={TS.td}>PLUMBING WORKS (8% of Total Cost)</td>
              <td style={{ ...TS.td, textAlign:'right' }}>{fmt(plumbing)}</td>
            </tr>
            <tr>
              <td style={TS.td}>8.0</td>
              <td style={TS.td}>ELECTRICAL WORKS (8% of Total Cost)</td>
              <td style={{ ...TS.td, textAlign:'right' }}>{fmt(electrical)}</td>
            </tr>
            <tr style={{ background:'#1e3a5f', color:'#fff' }}>
              <td colSpan={2} style={{ ...TS.td, fontWeight:700, fontSize:16, textAlign:'right', color:'#fff' }}>GRAND TOTAL</td>
              <td style={{ ...TS.td, fontWeight:700, fontSize:16, textAlign:'right', color:'#fff' }}>{fmt(grandTotal)}</td>
            </tr>
          </tbody>
        </table>

        {/* ═══════════════ PAGES 2+: DETAILED BoQ ═══════════════ */}
        <h2 style={{ fontSize:16, fontWeight:700, margin:'40px 0 16px', borderBottom:'2px solid #1e3a5f', paddingBottom:8 }}>
          DETAILED BILL OF QUANTITIES
        </h2>

        {sections.map((sec, sIdx) => (
          <div key={`detail-${sIdx}`} style={{ marginBottom:28, position: 'relative' }}>
            {canEdit && (
              <div className="no-print" style={{ position: 'absolute', top: -35, right: 0, display: 'flex', gap: '8px' }}>
                <button onClick={() => handleAddItem(sIdx)} style={{ background: '#16a34a', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                  <Plus size={12} /> Add Row
                </button>
                <button onClick={() => handleDeleteSection(sIdx)} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                  <Trash2 size={12} /> Delete Section
                </button>
              </div>
            )}
            {/* Section header */}
            <table style={TS.table}>
              <thead>
                <tr>
                  <th style={{ ...TS.th, width:70 }}>S.No.</th>
                  <th style={{ ...TS.th, textAlign:'left' }}>Description</th>
                  <th style={{ ...TS.th, width:60 }}>Unit</th>
                  <th style={{ ...TS.th, width:80 }}>Qty</th>
                  <th style={{ ...TS.th, width:80 }}>Rate</th>
                  <th style={{ ...TS.th, width:120 }}>Amount (₹)</th>
                  {canEdit && <th className="no-print" style={{ ...TS.th, width: 40 }}></th>}
                </tr>
              </thead>
              <tbody>
                {/* Section title row */}
                <tr style={{ background:'#e8edf5' }}>
                  <td style={{ ...TS.td, fontWeight:700 }}>
                    {canEdit ? (
                      <input className="no-print" value={sec.section} onChange={e => handleSectionChange(sIdx, 'section', e.target.value)} style={{ width: '100%', padding: '4px', border: '1px solid #ccc', borderRadius: '4px', fontWeight: 'bold' }} />
                    ) : null}
                    <span className={canEdit ? "print-only" : ""}>{sec.section}</span>
                  </td>
                  <td colSpan={canEdit ? 6 : 5} style={{ ...TS.td, fontWeight:700 }}>
                    {canEdit ? (
                      <input className="no-print" value={sec.title} onChange={e => handleSectionChange(sIdx, 'title', e.target.value)} style={{ width: '100%', padding: '4px', border: '1px solid #ccc', borderRadius: '4px', fontWeight: 'bold' }} />
                    ) : null}
                    <span className={canEdit ? "print-only" : ""}>{sec.title}</span>
                  </td>
                </tr>

                {/* Items */}
                {sec.items.map((item, iIdx) => (
                  <tr key={`item-${sIdx}-${iIdx}`}>
                    <td style={{ ...TS.td, verticalAlign:'top', fontWeight:600 }}>
                      {canEdit ? (
                        <input className="no-print" value={item.no} onChange={e => handleItemChange(sIdx, iIdx, 'no', e.target.value)} style={{ width: '100%', padding: '4px', border: '1px solid #cbd5e0', borderRadius: '4px', fontSize: '13px' }} />
                      ) : null}
                      <span className={canEdit ? "print-only" : ""}>{item.no}</span>
                    </td>
                    <td style={{ ...TS.td, textAlign:'justify', lineHeight:1.6 }}>
                      {canEdit ? (
                        <textarea className="no-print" value={item.desc} onChange={e => handleItemChange(sIdx, iIdx, 'desc', e.target.value)} rows={3} style={{ width: '100%', padding: '4px', border: '1px solid #cbd5e0', borderRadius: '4px', fontSize: '13px', resize: 'vertical' }} />
                      ) : null}
                      <span className={canEdit ? "print-only" : ""}>{item.desc}</span>
                    </td>
                    <td style={{ ...TS.td, textAlign:'center', verticalAlign:'top' }}>
                      {canEdit ? (
                        <input className="no-print" value={item.unit} onChange={e => handleItemChange(sIdx, iIdx, 'unit', e.target.value)} style={{ width: '100%', padding: '4px', border: '1px solid #cbd5e0', borderRadius: '4px', fontSize: '13px', textAlign: 'center' }} />
                      ) : null}
                      <span className={canEdit ? "print-only" : ""}>{item.unit}</span>
                    </td>
                    <td style={{ ...TS.td, textAlign:'right', verticalAlign:'top' }}>
                      {canEdit ? (
                        <input className="no-print" value={item.qty} onChange={e => handleItemChange(sIdx, iIdx, 'qty', e.target.value)} style={{ width: '100%', padding: '4px', border: '1px solid #cbd5e0', borderRadius: '4px', fontSize: '13px', textAlign: 'right' }} />
                      ) : null}
                      <span className={canEdit ? "print-only" : ""}>{item.qty}</span>
                    </td>
                    <td style={{ ...TS.td, textAlign:'right', verticalAlign:'top' }}>
                      {canEdit ? (
                        <input className="no-print" value={item.rate} onChange={e => handleItemChange(sIdx, iIdx, 'rate', e.target.value)} style={{ width: '100%', padding: '4px', border: '1px solid #cbd5e0', borderRadius: '4px', fontSize: '13px', textAlign: 'right' }} />
                      ) : null}
                      <span className={canEdit ? "print-only" : ""}>{item.rate}</span>
                    </td>
                    <td style={{ ...TS.td, verticalAlign:'top', textAlign: 'right' }}>
                      {/* Screen: editable input */}
                      <input
                        className="no-print"
                        type="number"
                        value={item.amount}
                        onChange={e => handleItemChange(sIdx, iIdx, 'amount', parseFloat(e.target.value) || 0)}
                        style={{ width:'100%', padding:'6px 8px', border:'1px solid #cbd5e0', borderRadius:4, textAlign:'right', boxSizing:'border-box', fontSize:14 }}
                      />
                      {/* Print: plain text */}
                      <span className="print-only" style={{ display: canEdit ? 'none' : 'block', float:'right' }}>{fmt(item.amount)}</span>
                    </td>
                    {canEdit && (
                      <td className="no-print" style={{ ...TS.td, verticalAlign: 'top', textAlign: 'center' }}>
                        <button onClick={() => handleDeleteItem(sIdx, iIdx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}

                {/* Section subtotal */}
                <tr style={{ background:'#f7f9fc' }}>
                  <td colSpan={5} style={{ ...TS.td, fontWeight:700, textAlign:'right' }}>
                    Total of {sec.title}
                  </td>
                  <td style={{ ...TS.td, fontWeight:700, textAlign:'right' }}>{fmt(sectionTotals[sIdx])}</td>
                  {canEdit && <td className="no-print" style={TS.td}></td>}
                </tr>
              </tbody>
            </table>
          </div>
        ))}

        {canEdit && (
          <div className="no-print" style={{ textAlign: 'center', marginBottom: 20 }}>
            <button onClick={handleAddSection} style={{ background: '#2563eb', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={16} /> Add New Section
            </button>
          </div>
        )}

        {/* Grand Summary at bottom */}
        <table style={{ ...TS.table, marginTop:20 }}>
          <tbody>
            <tr style={{ background:'#f0f4fa' }}>
              <td colSpan={5} style={{ ...TS.td, fontWeight:700, textAlign:'right', fontSize:15 }}>SUB TOTAL</td>
              <td style={{ ...TS.td, fontWeight:700, textAlign:'right', fontSize:15, width:140 }}>{fmt(subTotal)}</td>
            </tr>
            <tr>
              <td style={TS.td}>7.0</td>
              <td colSpan={4} style={TS.td}>PLUMBING WORKS (8% of Total Cost)</td>
              <td style={{ ...TS.td, textAlign:'right' }}>{fmt(plumbing)}</td>
            </tr>
            <tr>
              <td style={TS.td}>8.0</td>
              <td colSpan={4} style={TS.td}>ELECTRICAL WORKS (8% of Total Cost)</td>
              <td style={{ ...TS.td, textAlign:'right' }}>{fmt(electrical)}</td>
            </tr>
            <tr style={{ background:'#1e3a5f', color:'#fff' }}>
              <td colSpan={5} style={{ ...TS.td, fontWeight:800, textAlign:'right', fontSize:17, color:'#fff' }}>GRAND TOTAL</td>
              <td style={{ ...TS.td, fontWeight:800, textAlign:'right', fontSize:17, color:'#fff' }}>{fmt(grandTotal)}</td>
            </tr>
          </tbody>
        </table>

      </div>{/* end .print-area */}

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: inline !important; }
          input { display: none !important; }
        }
        @media screen {
          .print-only { display: none !important; }
        }
      `}</style>
    </div>
  );
}

const TS = {
  table: { width:'100%', borderCollapse:'collapse', fontSize:13, marginBottom:0 },
  th: { padding:'10px 12px', background:'#1e3a5f', color:'#fff', border:'1px solid #c8d4e8', fontWeight:700, textAlign:'center' },
  td: { padding:'9px 12px', border:'1px solid #dde3ee', verticalAlign:'middle' },
};
