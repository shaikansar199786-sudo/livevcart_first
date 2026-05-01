import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2, Printer, Save } from 'lucide-react';

interface QuoteItem {
    id: string;
    particulars: string;
    brand: string;
    unit: string;
    quantity: number;
    used_quantity?: number;
    rate: number;
    amount: number;
}

interface QuoteSection {
    id: string;
    name: string;
    items: QuoteItem[];
}

interface QuoteTabProps {
    project: any;
    setQuoteTotal?: (total: number) => void;
    isReadOnly?: boolean;
    user?: any;
    isUsedQuote?: boolean;
    hideSave?: boolean;
}

import { API_BASE_URL } from '../config';

const QuoteTab: React.FC<QuoteTabProps> = ({ project, setQuoteTotal, isReadOnly, user, isUsedQuote, hideSave }) => {
    const [sections, setSections] = useState<QuoteSection[]>([
        {
            id: '16-s1',
            name: 'A. FALSE CEILING',
            items: [
                { id: '16-h1', particulars: '1. GYPSUM CEILING', brand: 'HEADER', unit: '', quantity: 0, rate: 0, amount: 0 },
                { id: '16-1', particulars: 'Gypsum board ceiling with GI framing (Saint-gobain)', brand: 'sft', unit: 'sqft', quantity: 980, rate: 110, amount: 107800 },
                { id: '16-2', particulars: 'Ceiling wiring (Finolex/Poly-cab wire, sudhakar pipes)', brand: 'no.s', unit: 'no', quantity: 75, rate: 150, amount: 11250 },
                { id: '16-3', particulars: 'Ceiling light cutting and fixing (Standard size)', brand: 'no.s', unit: 'no', quantity: 75, rate: 100, amount: 7500 },
                { id: '16-h2', particulars: '2. GRID CEILING', brand: 'HEADER', unit: '', quantity: 0, rate: 0, amount: 0 },
                { id: '16-4', particulars: 'Armstrong Grid ceiling for toilets', brand: 'sft', unit: 'sqft', quantity: 180, rate: 120, amount: 21600 }
            ]
        },
        {
            id: '16-s2',
            name: 'B. PAINTING WORKS',
            items: [
                { id: '16-h3', particulars: '3. PAINTING ON WALLS & CEILING', brand: 'HEADER', unit: '', quantity: 0, rate: 0, amount: 0 },
                { id: '16-5', particulars: 'Luppam/putty finish with 2 coats of Asian royal emulsion paint (Ceiling)', brand: 'sft', unit: 'sqft', quantity: 1050, rate: 45, amount: 47250 },
                { id: '16-6', particulars: 'Luppam/putty finish with 2 coats of Asian royal emulsion paint (Walls)', brand: 'sft', unit: 'sqft', quantity: 2450, rate: 45, amount: 110250 },
                { id: '16-7', particulars: 'One wall with Asian Royal Play/Texture paint', brand: 'sft', unit: 'sqft', quantity: 380, rate: 150, amount: 57000 }
            ]
        },
        {
            id: '16-s3',
            name: 'C. ELECTRICAL WORKS',
            items: [
                { id: '16-h4', particulars: '4. ELECTRICAL CHIPPING & WIRING', brand: 'HEADER', unit: '', quantity: 0, rate: 0, amount: 0 },
                { id: '16-8', particulars: 'Electrical chipping and wiring for points (Finolex/Polycab)', brand: 'no.s', unit: 'no', quantity: 45, rate: 850, amount: 38250 },
                { id: '16-9', particulars: 'Main circuit wiring', brand: 'ls', unit: 'ls', quantity: 1, rate: 15000, amount: 15000 },
                { id: '16-10', particulars: 'Inverter wiring', brand: 'ls', unit: 'ls', quantity: 1, rate: 8000, amount: 8000 },
                { id: '16-11', particulars: 'Switchboard and plates fixing (Legrand/Anchor)', brand: 'no.s', unit: 'no', quantity: 18, rate: 250, amount: 4500 }
            ]
        }
    ]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchQuote();
    }, [project.project_id, isUsedQuote]);

    const fetchQuote = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/quotes/latest?project_id=${project.project_id}&is_used=${isUsedQuote}`);
            if (response.data.success && response.data.data) {
                const mappedSections = response.data.data.sections.map((s: any) => ({
                    id: s.section_id,
                    name: s.section_name,
                    items: s.items.map((i: any) => ({
                        id: i.item_id,
                        particulars: i.particulars,
                        brand: i.brand,
                        unit: i.unit,
                        quantity: parseFloat(i.quantity),
                        used_quantity: parseFloat(i.used_quantity),
                        rate: parseFloat(i.rate),
                        amount: parseFloat(i.amount)
                    }))
                }));
                setSections(mappedSections);
            }
        } catch (err) {
            console.error('Failed to fetch quote');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveQuote = async () => {
        setSaving(true);
        try {
            const total = getGrandTotal();
            const response = await axios.post(`${API_BASE_URL}/quotes/save`, {

                project_id: project.project_id,
                is_used_quote: isUsedQuote,
                total_amount: total,
                sections: sections,
                created_by: user.user_id
            });
            if (response.data.success) {
                alert('Quote saved successfully');
                if (setQuoteTotal) setQuoteTotal(total);
            } else {
                alert('Failed to save: ' + (response.data.message || 'Unknown error'));
            }
        } catch (err: any) {
            alert('Failed to save quote: ' + (err.response?.data?.message || err.message));
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        const total = getGrandTotal();
        if (setQuoteTotal) setQuoteTotal(total);
    }, [sections]);

    const calculateItemAmount = (qty: number, rate: number) => qty * rate;

    const updateItem = (sectionId: string, itemId: string, field: string, value: any) => {
        setSections(sections.map(s => {
            if (s.id === sectionId) {
                return {
                    ...s,
                    items: s.items.map(i => {
                        if (i.id === itemId) {
                            const updated = { ...i, [field]: value };
                            if (field === 'quantity' || field === 'rate') {
                                updated.amount = calculateItemAmount(updated.quantity, updated.rate);
                            }
                            return updated;
                        }
                        return i;
                    })
                };
            }
            return s;
        }));
    };

    const getGrandTotal = () => {
        return sections.reduce((sum, s) => sum + s.items.reduce((itemSum, i) => itemSum + (i.amount || 0), 0), 0);
    };

    const handlePrint = () => {
        window.print();
    };

    if (loading) return <div style={{ textAlign: 'center', padding: '40px' }}><Loader2 className="animate-spin" style={{ margin: '0 auto' }} /></div>;

    const grandTotal = getGrandTotal();

    return (
        <div className="quote-container" style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }} className="no-print">
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Project Estimate: {isUsedQuote ? 'Used Materials' : 'Initial Quote'}</h3>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={handlePrint} className="btn-primary" style={{ backgroundColor: '#16a34a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Printer size={18} /> Print Quote
                    </button>
                    {!isReadOnly && !hideSave && (
                        <button onClick={handleSaveQuote} disabled={saving} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            {saving ? 'Saving...' : 'Save Estimate'}
                        </button>
                    )}
                </div>
            </div>

            <div className="print-only" style={{ textAlign: 'center', marginBottom: '30px' }}>
                <h1 style={{ margin: 0, fontSize: '24px' }}>ARK ARCHITECTS & INTERIOR DESIGNERS</h1>
                <p style={{ margin: '5px 0' }}>Project Quote - {project.project_name}</p>
                <div style={{ borderBottom: '2px solid #000', margin: '15px 0' }}></div>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead style={{ backgroundColor: '#253b50', color: 'white' }}>
                        <tr>
                            <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'center', width: '50px' }}>S.NO</th>
                            <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>PARTICULARS</th>
                            <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'center' }}>BRAND / TYPE</th>
                            <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'center' }}>UNIT</th>
                            <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'center' }}>QTY</th>
                            {isUsedQuote && <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'center' }}>USED QTY</th>}
                            <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'center' }}>RATE</th>
                            <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'right' }}>AMOUNT</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sections.map((section, sIdx) => (
                            <React.Fragment key={section.id}>
                                <tr style={{ backgroundColor: '#f1f5f9' }}>
                                    <td style={{ padding: '10px', border: '1px solid #ddd', fontWeight: 900, textAlign: 'center' }}>{String.fromCharCode(65 + sIdx)}</td>
                                    <td colSpan={isUsedQuote ? 7 : 6} style={{ padding: '10px', border: '1px solid #ddd', fontWeight: 900 }}>{section.name}</td>
                                </tr>
                                {section.items.map((item, iIdx) => {
                                    const isHeader = item.brand === 'HEADER';
                                    return (
                                        <tr key={item.id} style={{ backgroundColor: isHeader ? '#f8fafc' : 'white' }}>
                                            <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center', fontWeight: isHeader ? 700 : 400 }}>
                                                {isHeader ? '' : iIdx}
                                            </td>
                                            <td style={{ padding: '10px', border: '1px solid #ddd', fontWeight: isHeader ? 700 : 400 }}>
                                                {item.particulars}
                                            </td>
                                            <td style={{ padding: '5px', border: '1px solid #ddd', textAlign: 'center' }}>
                                                {isHeader ? '' : (
                                                    isReadOnly ? item.brand :
                                                        <input value={item.brand} onChange={(e) => updateItem(section.id, item.id, 'brand', e.target.value)} style={{ width: '100%', border: 'none', textAlign: 'center' }} />
                                                )}
                                            </td>
                                            <td style={{ padding: '5px', border: '1px solid #ddd', textAlign: 'center' }}>
                                                {isHeader ? '' : (
                                                    isReadOnly ? item.unit :
                                                        <input value={item.unit} onChange={(e) => updateItem(section.id, item.id, 'unit', e.target.value)} style={{ width: '100%', border: 'none', textAlign: 'center' }} />
                                                )}
                                            </td>
                                            <td style={{ padding: '5px', border: '1px solid #ddd', textAlign: 'center' }}>
                                                {isHeader ? '' : (
                                                    isReadOnly ? item.quantity :
                                                        <input type="number" value={item.quantity} onChange={(e) => updateItem(section.id, item.id, 'quantity', parseFloat(e.target.value) || 0)} style={{ width: '100%', border: 'none', textAlign: 'center' }} />
                                                )}
                                            </td>
                                            {isUsedQuote && (
                                                <td style={{ padding: '5px', border: '1px solid #ddd', textAlign: 'center' }}>
                                                    {isHeader ? '' : (
                                                        isReadOnly ? item.used_quantity :
                                                            <input type="number" value={item.used_quantity} onChange={(e) => updateItem(section.id, item.id, 'used_quantity', parseFloat(e.target.value) || 0)} style={{ width: '100%', border: 'none', textAlign: 'center' }} />
                                                    )}
                                                </td>
                                            )}
                                            <td style={{ padding: '5px', border: '1px solid #ddd', textAlign: 'center' }}>
                                                {isHeader ? '' : (
                                                    isReadOnly ? item.rate :
                                                        <input type="number" value={item.rate} onChange={(e) => updateItem(section.id, item.id, 'rate', parseFloat(e.target.value) || 0)} style={{ width: '100%', border: 'none', textAlign: 'center' }} />
                                                )}
                                            </td>
                                            <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'right', fontWeight: 600 }}>
                                                {isHeader ? '' : `₹${(item.amount || 0).toLocaleString()}`}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </React.Fragment>
                        ))}
                        <tr style={{ backgroundColor: '#253b50', color: 'white', fontWeight: 800 }}>
                            <td colSpan={isUsedQuote ? 7 : 6} style={{ padding: '15px', border: '1px solid #ddd', textAlign: 'right', fontSize: '1.1rem' }}>GRAND TOTAL</td>
                            <td style={{ padding: '15px', border: '1px solid #ddd', textAlign: 'right', fontSize: '1.1rem' }}>₹{grandTotal.toLocaleString()}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="print-only" style={{ marginTop: '50px', display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ borderTop: '1px solid #000', width: '200px', marginBottom: '10px' }}></div>
                    <p>Client Signature</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ borderTop: '1px solid #000', width: '200px', marginBottom: '10px' }}></div>
                    <p>Authorized Signatory</p>
                </div>
            </div>
        </div>
    );
};

export default QuoteTab;
