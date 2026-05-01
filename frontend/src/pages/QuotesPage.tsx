import React, { useState } from 'react';
import { Loader2, Printer, Plus, Trash2 } from 'lucide-react';

interface QuoteItem {
    id: string;
    particulars: string;
    brand: string;
    unit: string;
    quantity: number;
    rate: number;
    amount: number;
}

interface QuoteSection {
    id: string;
    name: string;
    items: QuoteItem[];
}

export const QuotesPage: React.FC = () => {
    const [sections, setSections] = useState<QuoteSection[]>([
        {
            id: 'A', name: 'A. FALSE CEILING', items: [
                { id: 'A1', particulars: 'GYPSUM', brand: '', unit: 'sft', quantity: 1799, rate: 70, amount: 125930 },
                { id: 'A2', particulars: 'PVC CEILING (IN BALCONY)', brand: '', unit: 'sft', quantity: 68, rate: 420, amount: 28560 },
                { id: 'A3', particulars: 'WOODEN CEILING (IN HALL)', brand: '', unit: 'sft', quantity: 45, rate: 1500, amount: 67500 }
            ]
        },
        {
            id: 'B', name: 'B. ELECTRICAL', items: [
                { id: 'B1', particulars: '15W Lights', brand: '', unit: 'no', quantity: 30, rate: 700, amount: 21000 },
                { id: 'B2', particulars: '6W Lights', brand: '', unit: 'no', quantity: 3, rate: 700, amount: 2100 },
                { id: 'B3', particulars: '3W Lights', brand: '', unit: 'no', quantity: 6, rate: 700, amount: 4200 },
                { id: 'B4', particulars: 'ROPE LIGHTS', brand: '', unit: 'rft', quantity: 75, rate: 220, amount: 16500 },
                { id: 'B5', particulars: 'PROFILE LIGHTS', brand: '', unit: 'rft', quantity: 44, rate: 400, amount: 17600 },
                { id: 'B6', particulars: 'FANS', brand: '', unit: 'no', quantity: 7, rate: 7500, amount: 52500 },
                { id: 'B7', particulars: 'EXHAUST FANS IN WASH ROOMS', brand: '', unit: 'no', quantity: 3, rate: 2000, amount: 6000 },
                { id: 'B8', particulars: 'ELECTRICIAN CHARGES', brand: '', unit: 'lumpsum', quantity: 1, rate: 50000, amount: 50000 },
                { id: 'B9', particulars: 'WIRING AND OTHER MATERIAL', brand: '', unit: 'lumpsum', quantity: 1, rate: 50000, amount: 50000 }
            ]
        },
        {
            id: 'C', name: 'C. FLOOR GUARD', items: [
                { id: 'C1', particulars: 'FLOOR GUARD COVERING', brand: '', unit: 'sft', quantity: 1200, rate: 9, amount: 10800 }
            ]
        },
        {
            id: 'D', name: 'D. ANTI PEST', items: [
                { id: 'D1', particulars: 'ANTI PEST TREATMENT', brand: '', unit: 'sft', quantity: 1200, rate: 6, amount: 7200 }
            ]
        },
        {
            id: 'E', name: 'E. WOOD WORK', items: [
                { id: 'E-h1', particulars: '1. DRAWING ROOM', brand: 'HEADER', unit: '', quantity: 0, rate: 0, amount: 0 },
                { id: 'E1', particulars: 'Sofa backpanelling', brand: '', unit: 'sft', quantity: 100, rate: 1500, amount: 150000 },
                { id: 'E2', particulars: 'Duco paint', brand: '', unit: 'sft', quantity: 36, rate: 800, amount: 28800 },
                { id: 'E3', particulars: 'Mirror', brand: '', unit: 'sft', quantity: 18, rate: 500, amount: 9000 },
                { id: 'E4', particulars: 'Rafters', brand: '', unit: 'sft', quantity: 18, rate: 500, amount: 9000 },
                { id: 'E5', particulars: 'Panelling (towards Handwash)', brand: '', unit: 'sft', quantity: 55, rate: 1500, amount: 82500 },
                { id: 'E6', particulars: 'mirrors', brand: '', unit: 'sft', quantity: 15, rate: 500, amount: 7500 },
                { id: 'E7', particulars: 'Wash area Storage', brand: '', unit: 'sft', quantity: 27, rate: 2000, amount: 54000 },
                { id: 'E8', particulars: 'Profile shutters', brand: '', unit: 'sft', quantity: 20, rate: 1250, amount: 25000 },
                { id: 'E9', particulars: 'Puja Storage', brand: '', unit: 'sft', quantity: 12.5, rate: 2000, amount: 25000 },
                { id: 'E10', particulars: 'Corian work', brand: '', unit: 'lumpsum', quantity: 1, rate: 120000, amount: 120000 },
                { id: 'E11', particulars: 'Console beside puja', brand: '', unit: 'lumpsum', quantity: 1, rate: 50000, amount: 50000 },
                { id: 'E-h2', particulars: '2. LIVING ROOM', brand: 'HEADER', unit: '', quantity: 0, rate: 0, amount: 0 },
                { id: 'E12', particulars: 'TV UNIT Panelling', brand: '', unit: 'sft', quantity: 65, rate: 1500, amount: 97500 },
                { id: 'E13', particulars: 'TV UNIT Mirrors', brand: '', unit: 'sft', quantity: 8, rate: 500, amount: 4000 },
                { id: 'E14', particulars: 'TV UNIT Rafters', brand: '', unit: 'sft', quantity: 10, rate: 500, amount: 5000 },
                { id: 'E15', particulars: 'TV UNIT Storage', brand: '', unit: 'sft', quantity: 15, rate: 2000, amount: 30000 },
                { id: 'E16', particulars: 'Texture paint', brand: '', unit: 'sft', quantity: 100, rate: 500, amount: 50000 },
                { id: 'E17', particulars: 'Panelling above flush doors', brand: '', unit: 'sft', quantity: 8, rate: 1500, amount: 12000 },
                { id: 'E-h3', particulars: '3. KITCHEN', brand: 'HEADER', unit: '', quantity: 0, rate: 0, amount: 0 },
                { id: 'E18', particulars: 'Box work', brand: '', unit: 'sft', quantity: 234, rate: 2000, amount: 468000 },
                { id: 'E19', particulars: 'Tandem drawers', brand: '', unit: 'no.s', quantity: 5, rate: 5750, amount: 28750 },
                { id: 'E20', particulars: 'Corner unit', brand: '', unit: 'no.s', quantity: 1, rate: 22000, amount: 22000 },
                { id: 'E21', particulars: 'Bottle pull out', brand: '', unit: 'no.s', quantity: 1, rate: 9200, amount: 9200 },
                { id: 'E22', particulars: 'Drawer accessories', brand: '', unit: 'no.s', quantity: 2, rate: 3500, amount: 7000 },
                { id: 'E23', particulars: 'Vegetable baskets', brand: '', unit: 'sft', quantity: 2, rate: 5750, amount: 11500 },
                { id: 'E24', particulars: 'Profile shutters', brand: '', unit: 'sft', quantity: 18, rate: 1250, amount: 22500 },
                { id: 'E-h4', particulars: '4. UTILITY', brand: 'HEADER', unit: '', quantity: 0, rate: 0, amount: 0 },
                { id: 'E25', particulars: 'Storage above counter', brand: '', unit: 'sft', quantity: 30, rate: 2000, amount: 60000 },
                { id: 'E26', particulars: 'Storage below counter', brand: '', unit: 'sft', quantity: 15, rate: 2000, amount: 30000 },
                { id: 'E-h5', particulars: '5. MASTER BEDROOM', brand: 'HEADER', unit: '', quantity: 0, rate: 0, amount: 0 },
                { id: 'E27', particulars: 'Wardrobe', brand: '', unit: 'sft', quantity: 76, rate: 2000, amount: 152000 },
                { id: 'E28', particulars: 'King size bed with side tables', brand: '', unit: 'no', quantity: 1, rate: 60000, amount: 60000 },
                { id: 'E29', particulars: 'TV Backpanel', brand: '', unit: 'sft', quantity: 110, rate: 110, amount: 12100 },
                { id: 'E30', particulars: 'TV Rafters', brand: '', unit: 'sft', quantity: 56, rate: 500, amount: 28000 },
                { id: 'E31', particulars: 'TV Drawers', brand: '', unit: 'sft', quantity: 4, rate: 2000, amount: 8000 },
                { id: 'E32', particulars: 'Dresser', brand: '', unit: 'sft', quantity: 10, rate: 1500, amount: 15000 },
                { id: 'E33', particulars: 'Mirror', brand: '', unit: 'sft', quantity: 10, rate: 800, amount: 8000 },
                { id: 'E-h6', particulars: "6. SON'S BEDROOM", brand: 'HEADER', unit: '', quantity: 0, rate: 0, amount: 0 },
                { id: 'E34', particulars: 'Wardrobe-1', brand: '', unit: 'sft', quantity: 48, rate: 2000, amount: 96000 },
                { id: 'E35', particulars: 'Profile shutters', brand: '', unit: 'sft', quantity: 31, rate: 1250, amount: 38750 },
                { id: 'E36', particulars: 'Bed back texture paint', brand: '', unit: 'sft', quantity: 108, rate: 500, amount: 54000 },
                { id: 'E37', particulars: 'King size bed with side tables', brand: '', unit: 'no', quantity: 1, rate: 60000, amount: 60000 },
                { id: 'E38', particulars: 'Study table storage', brand: '', unit: 'sft', quantity: 2, rate: 2000, amount: 4000 },
                { id: 'E39', particulars: 'Study table shelves', brand: '', unit: 'sft', quantity: 4, rate: 2000, amount: 8000 },
                { id: 'E40', particulars: 'Metal supports', brand: '', unit: 'lumpsum', quantity: 1, rate: 10000, amount: 10000 },
                { id: 'E41', particulars: 'Mirror beside bed', brand: '', unit: 'no', quantity: 1, rate: 10000, amount: 10000 },
                { id: 'E42', particulars: 'Dresser wardrobe-2', brand: '', unit: 'sft', quantity: 34, rate: 2000, amount: 68000 },
                { id: 'E43', particulars: 'Dresser Profile shutters', brand: '', unit: 'sft', quantity: 12, rate: 1250, amount: 15000 },
                { id: 'E44', particulars: 'Mirror (sensor)', brand: '', unit: 'sft', quantity: 21, rate: 800, amount: 16800 },
                { id: 'E-h7', particulars: "7. DAUGHTER'S BEDROOM", brand: 'HEADER', unit: '', quantity: 0, rate: 0, amount: 0 },
                { id: 'E45', particulars: 'Wardrobe', brand: '', unit: 'sft', quantity: 76, rate: 2000, amount: 152000 },
                { id: 'E46', particulars: 'Profile shutter', brand: '', unit: 'sft', quantity: 12, rate: 1250, amount: 15000 },
                { id: 'E47', particulars: 'Storage beside study', brand: '', unit: 'sft', quantity: 21, rate: 2000, amount: 42000 },
                { id: 'E48', particulars: 'Bed backpanel Wallpaper', brand: '', unit: 'no', quantity: 1, rate: 6500, amount: 6500 },
                { id: 'E49', particulars: 'King size bed with side tables', brand: '', unit: 'no', quantity: 1, rate: 60000, amount: 60000 },
                { id: 'E50', particulars: 'Dresser', brand: '', unit: 'sft', quantity: 14, rate: 2000, amount: 28000 },
                { id: 'E-h8', particulars: '9. BALCONY', brand: 'HEADER', unit: '', quantity: 0, rate: 0, amount: 0 },
                { id: 'E51', particulars: 'Mirror (sensor)', brand: '', unit: 'sft', quantity: 1, rate: 10000, amount: 10000 },
                { id: 'E52', particulars: 'Study cum sewing table', brand: '', unit: 'sft', quantity: 22, rate: 850, amount: 18700 },
                { id: 'E53', particulars: 'Shelves', brand: '', unit: 'sft', quantity: 8, rate: 850, amount: 6800 },
                { id: 'E54', particulars: 'Shelves with metal edge', brand: '', unit: 'sft', quantity: 8, rate: 1000, amount: 8000 },
                { id: 'E55', particulars: 'Rafters', brand: '', unit: 'sft', quantity: 54, rate: 800, amount: 43200 },
                { id: 'E56', particulars: 'BAR UNIT', brand: '', unit: 'sft', quantity: 26, rate: 2000, amount: 52000 },
                { id: 'E57', particulars: 'Profile shutters', brand: '', unit: 'sft', quantity: 20, rate: 1250, amount: 25000 },
                { id: 'E58', particulars: 'Backsplash Panelling', brand: '', unit: 'sft', quantity: 6, rate: 850, amount: 5100 }
            ]
        },
        {
            id: 'F', name: 'F. GRANITE AND TILES WORK', items: [
                { id: 'F1', particulars: 'Kitchen quartz counter top', brand: '', unit: 'sft', quantity: 40, rate: 2400, amount: 96000 },
                { id: 'F2', particulars: 'Kitchen Backsplash tiles', brand: '', unit: 'sft', quantity: 120, rate: 250, amount: 30000 },
                { id: 'F3', particulars: 'Wash area quartz counter top', brand: '', unit: 'sft', quantity: 5, rate: 2400, amount: 12000 },
                { id: 'F4', particulars: 'Backsplash (base)', brand: '', unit: 'sft', quantity: 12, rate: 250, amount: 3000 },
                { id: 'F5', particulars: 'Puja counter top', brand: '', unit: 'sft', quantity: 12, rate: 2400, amount: 28800 },
                { id: 'F6', particulars: 'Corian work', brand: '', unit: 'lumpsum', quantity: 1, rate: 150000, amount: 150000 },
                { id: 'F7', particulars: 'Backsplash & tiles', brand: '', unit: 'sft', quantity: 35, rate: 400, amount: 14000 },
                { id: 'F8', particulars: 'Description', brand: '', unit: 'sft', quantity: 12, rate: 2000, amount: 24000 },
                { id: 'F9', particulars: 'Utility Granite top & supports', brand: '', unit: 'sft', quantity: 56, rate: 1200, amount: 67200 }
            ]
        },
        {
            id: 'G', name: 'G. MISC.', items: [
                { id: 'G1', particulars: 'Cushion work in MBR', brand: '', unit: 'sft', quantity: 18, rate: 650, amount: 11700 },
                { id: 'G2', particulars: 'Cushion work in KBR', brand: '', unit: 'sft', quantity: 18, rate: 650, amount: 11700 },
                { id: 'G3', particulars: 'Cushion work in GBR', brand: '', unit: 'sft', quantity: 18, rate: 650, amount: 11700 },
                { id: 'G4', particulars: 'Vanities in bathrooms (woodwork)', brand: '', unit: 'sft', quantity: 12, rate: 2000, amount: 24000 }
            ]
        },
        {
            id: 'H', name: 'H. PAINTING', items: [
                { id: 'H1', particulars: 'Royale shyne (putty+primer+2 coats)', brand: '', unit: 'sft', quantity: 4000, rate: 30, amount: 120000 },
                { id: 'H2', particulars: 'Flush Door polishing', brand: '', unit: 'lumpsum', quantity: 1, rate: 120000, amount: 120000 }
            ]
        },
        {
            id: 'I', name: 'I. APPLIANCES', items: [
                { id: 'I1', particulars: 'Home appliances', brand: '', unit: 'no', quantity: 1, rate: 20000, amount: 20000 },
                { id: 'I2', particulars: 'HOB', brand: '', unit: 'no', quantity: 1, rate: 25000, amount: 25000 },
                { id: 'I3', particulars: 'Chimney', brand: '', unit: 'no', quantity: 1, rate: 45000, amount: 45000 },
                { id: 'I4', particulars: 'In-built microwave oven', brand: '', unit: 'no', quantity: 1, rate: 80000, amount: 80000 },
                { id: 'I5', particulars: 'Washing machine', brand: '', unit: 'no', quantity: 1, rate: 80000, amount: 80000 },
                { id: 'I6', particulars: 'Acs', brand: '', unit: 'no', quantity: 6, rate: 65000, amount: 390000 },
                { id: 'I7', particulars: 'Fridge', brand: '', unit: 'no', quantity: 1, rate: 70000, amount: 70000 }
            ]
        },
        {
            id: 'J', name: 'J. MISCELLANEOUS (LOOSE FURNITURE & DECOR)', items: [
                { id: 'J-h1', particulars: '1. LOOSE FURNITURE', brand: 'HEADER', unit: '', quantity: 0, rate: 0, amount: 0 },
                { id: 'J1', particulars: 'L shape sofa', brand: '', unit: 'no', quantity: 1, rate: 150000, amount: 150000 },
                { id: 'J2', particulars: '3 seater sofa', brand: '', unit: 'no', quantity: 1, rate: 80000, amount: 80000 },
                { id: 'J3', particulars: 'Accent chair', brand: '', unit: 'no', quantity: 1, rate: 25000, amount: 25000 },
                { id: 'J4', particulars: 'Centre table', brand: '', unit: 'no', quantity: 1, rate: 25000, amount: 25000 },
                { id: 'J5', particulars: 'Dining table', brand: '', unit: 'no', quantity: 1, rate: 50000, amount: 50000 },
                { id: 'J6', particulars: "Son's room Study Chair", brand: '', unit: 'no', quantity: 1, rate: 10000, amount: 10000 },
                { id: 'J7', particulars: 'Study Chair in MBR', brand: '', unit: 'no', quantity: 1, rate: 60000, amount: 60000 },
                { id: 'J8', particulars: 'Pouffes (Family Hall)', brand: '', unit: 'no', quantity: 1, rate: 6000, amount: 6000 },
                { id: 'J9', particulars: 'Window bench (Son Room)', brand: '', unit: 'no', quantity: 2, rate: 4500, amount: 9000 },
                { id: 'J10', particulars: 'Pouffes (Daughter Room)', brand: '', unit: 'no', quantity: 1, rate: 6000, amount: 6000 },
                { id: 'J11', particulars: 'Study Chair (Daughter Room)', brand: '', unit: 'no', quantity: 1, rate: 4500, amount: 4500 },
                { id: 'J-h2', particulars: '2. BED ACCESSORIES', brand: 'HEADER', unit: '', quantity: 0, rate: 0, amount: 0 },
                { id: 'J12', particulars: 'Mattresses & pillows', brand: '', unit: 'no', quantity: 1, rate: 8000, amount: 8000 },
                { id: 'J13', particulars: 'Bedcovers & duvets', brand: '', unit: 'no', quantity: 3, rate: 15000, amount: 45000 },
                { id: 'J-h3', particulars: '3. SINKS & TAPS', brand: 'HEADER', unit: '', quantity: 0, rate: 0, amount: 0 },
                { id: 'J14', particulars: 'Sinks (Kitchen/Utility/Wash)', brand: '', unit: 'no', quantity: 3, rate: 5500, amount: 16500 },
                { id: 'J15', particulars: 'Kitchen Tap', brand: '', unit: 'no', quantity: 1, rate: 15000, amount: 15000 },
                { id: 'J16', particulars: 'Utility Tap', brand: '', unit: 'no', quantity: 1, rate: 10000, amount: 10000 },
                { id: 'J17', particulars: 'Wash area Tap', brand: '', unit: 'no', quantity: 1, rate: 10000, amount: 10000 },
                { id: 'J-h4', particulars: '4. LIGHTS & DECOR', brand: 'HEADER', unit: '', quantity: 0, rate: 0, amount: 0 },
                { id: 'J18', particulars: 'Chandelier in hall', brand: '', unit: 'no', quantity: 1, rate: 30000, amount: 30000 },
                { id: 'J19', particulars: 'Hanging lights (Daughter Room)', brand: '', unit: 'no', quantity: 1, rate: 15000, amount: 15000 },
                { id: 'J20', particulars: 'Curtains (Complete Home)', brand: '', unit: 'no', quantity: 1, rate: 200000, amount: 200000 },
                { id: 'J21', particulars: 'Carpet (Living Room)', brand: '', unit: 'no', quantity: 1, rate: 35000, amount: 35000 },
                { id: 'J22', particulars: 'Carpet (Son Room)', brand: '', unit: 'no', quantity: 1, rate: 35000, amount: 35000 },
                { id: 'J23', particulars: 'Carpet (Daughter Room)', brand: '', unit: 'no', quantity: 1, rate: 35000, amount: 35000 },
                { id: 'J24', particulars: 'Artwork', brand: '', unit: 'no', quantity: 1, rate: 40000, amount: 40000 },
                { id: 'J25', particulars: 'Side tables', brand: '', unit: 'no', quantity: 4, rate: 18000, amount: 72000 },
                { id: 'J26', particulars: 'Wallpapers', brand: '', unit: 'no', quantity: 6, rate: 6000, amount: 36000 },
                { id: 'J-h5', particulars: '5. BATHROOMS & MISC', brand: 'HEADER', unit: '', quantity: 0, rate: 0, amount: 0 },
                { id: 'J27', particulars: 'Glass partitions', brand: '', unit: 'no', quantity: 1, rate: 25000, amount: 25000 },
                { id: 'J28', particulars: 'Bathroom accessories', brand: '', unit: 'no', quantity: 3, rate: 3000, amount: 9000 },
                { id: 'J29', particulars: 'Balcony clothes hangers', brand: '', unit: 'no', quantity: 2, rate: 6000, amount: 12000 },
                { id: 'J30', particulars: 'Step dustbins', brand: '', unit: 'no', quantity: 5, rate: 4000, amount: 20000 },
                { id: 'J31', particulars: 'Doormats', brand: '', unit: 'no', quantity: 8, rate: 600, amount: 4800 }
            ]
        }
    ]);

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

    const addSection = () => {
        const newId = (sections.length + 100).toString();
        setSections([...sections, { id: newId, name: 'NEW SECTION', items: [] }]);
    };

    const addItem = (sectionId: string, isHeader: boolean = false) => {
        setSections(sections.map(s => {
            if (s.id === sectionId) {
                const newId = s.id + '-' + (s.items.length + 1);
                return {
                    ...s,
                    items: [...s.items, { id: newId, particulars: isHeader ? 'NEW HEADER' : '', brand: isHeader ? 'HEADER' : '', unit: '', quantity: 0, rate: 0, amount: 0 }]
                };
            }
            return s;
        }));
    };

    const getGroupATotal = () => sections.filter(s => ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].includes(s.id)).reduce((total, s) => total + s.items.reduce((st, i) => st + (i.amount || 0), 0), 0);
    const getGroupBTotal = () => sections.filter(s => s.id === 'I').reduce((total, s) => total + s.items.reduce((st, i) => st + (i.amount || 0), 0), 0);
    const getGroupCTotal = () => sections.filter(s => s.id === 'J').reduce((total, s) => total + s.items.reduce((st, i) => st + (i.amount || 0), 0), 0);
    const getGrandTotal = () => getGroupATotal() + getGroupBTotal() + getGroupCTotal();

    const romanize = (num: number) => {
        const lookup: any = { m: 1000, cm: 900, d: 500, cd: 400, c: 100, xc: 90, l: 50, xl: 40, x: 10, ix: 9, v: 5, iv: 4, i: 1 };
        let roman = '';
        for (let i in lookup) {
            while (num >= lookup[i]) {
                roman += i;
                num -= lookup[i];
            }
        }
        return roman.toUpperCase();
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="quotes-page">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }} className="no-print">
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#253b50' }}>Quote Generator</h2>
                    <p style={{ color: '#6b7280' }}>Create manual estimates for clients</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={addSection} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: 'white', fontWeight: 600, cursor: 'pointer' }}>+ Add Section</button>
                    <button onClick={handlePrint} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Printer size={18} /> Print Quote
                    </button>
                </div>
            </div>

            <div className="premium-card quote-container" style={{ padding: '25px', maxWidth: '820px', margin: '0 auto', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#253b50', marginBottom: '2px' }}>ARK ARCHITECTS & INTERIOR DESIGNERS</h1>
                    <p style={{ fontWeight: 700, fontSize: '0.8rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px' }}>ESTIMATE FOR INTERIORS</p>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#253b50', color: 'white' }}>
                            <th style={{ padding: '6px', border: '1px solid #334155', textAlign: 'left', width: '60%' }}>PARTICULARS</th>
                            <th style={{ padding: '6px', border: '1px solid #334155', textAlign: 'left', width: '40px' }}>UNIT</th>
                            <th style={{ padding: '6px', border: '1px solid #334155', textAlign: 'left', width: '40px' }}>QTY</th>
                            <th style={{ padding: '6px', border: '1px solid #334155', textAlign: 'left', width: '60px' }}>RATE</th>
                            <th style={{ padding: '6px', border: '1px solid #334155', textAlign: 'left', width: '80px' }}>AMOUNT</th>
                            <th className="no-print" style={{ width: '40px' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {sections.map((section) => {
                            let subItemCounter = 0;
                            return (
                                <React.Fragment key={section.id}>
                                    <tr className="section-header" style={{ backgroundColor: '#cbd5e1', fontWeight: 800 }}>
                                        <td colSpan={5} style={{ padding: '4px 8px', border: '1px solid #94a3b8' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <input
                                                    value={section.name}
                                                    onChange={(e) => setSections(sections.map(s => s.id === section.id ? { ...s, name: e.target.value } : s))}
                                                    style={{ fontWeight: 800, border: 'none', background: 'none', width: '80%', color: '#1e293b' }}
                                                />
                                                <div className="no-print">
                                                    <Plus size={16} style={{ cursor: 'pointer', marginRight: '10px' }} onClick={() => addItem(section.id)} />
                                                    <Trash2 size={16} style={{ cursor: 'pointer', color: '#ef4444' }} onClick={() => setSections(sections.filter(s => s.id !== section.id))} />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="no-print"></td>
                                    </tr>
                                    {section.items.map((item) => {
                                        const isSubHeader = item.brand === 'HEADER';
                                        if (!isSubHeader) subItemCounter++;
                                        else subItemCounter = 0;

                                        return (
                                            <tr key={item.id} style={{ backgroundColor: isSubHeader ? '#f8fafc' : 'white' }}>
                                                <td style={{ border: '1px solid #e2e8f0', padding: '0' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                                        {!isSubHeader && <span style={{ paddingLeft: '4px', color: '#6b7280', fontSize: '0.65rem', width: '18px' }}>{romanize(subItemCounter)}.</span>}
                                                        <textarea
                                                            value={item.particulars}
                                                            onChange={(e) => updateItem(section.id, item.id, 'particulars', e.target.value)}
                                                            style={{ flex: 1, padding: '3px', border: 'none', fontWeight: isSubHeader ? 700 : 400, backgroundColor: 'transparent', resize: 'none' }}
                                                            placeholder={isSubHeader ? "Header Name" : "Item Description"}
                                                            rows={1}
                                                            onInput={(e: any) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                                                        />
                                                    </div>
                                                </td>
                                                <td style={{ border: '1px solid #e2e8f0', padding: '0' }}>
                                                    {!isSubHeader && <input value={item.unit} onChange={(e) => updateItem(section.id, item.id, 'unit', e.target.value)} style={{ width: '100%', padding: '3px', border: 'none', backgroundColor: 'transparent' }} placeholder="unit" />}
                                                </td>
                                                <td style={{ border: '1px solid #e2e8f0', padding: '0' }}>
                                                    {!isSubHeader && <input type="number" value={item.quantity} onChange={(e) => updateItem(section.id, item.id, 'quantity', parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '3px', border: 'none', backgroundColor: 'transparent' }} />}
                                                </td>
                                                <td style={{ border: '1px solid #e2e8f0', padding: '0' }}>
                                                    {!isSubHeader && <input type="number" value={item.rate} onChange={(e) => updateItem(section.id, item.id, 'rate', parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '3px', border: 'none', backgroundColor: 'transparent' }} />}
                                                </td>
                                                <td style={{ border: '1px solid #e2e8f0', padding: '3px', fontWeight: 600, textAlign: 'right' }}>
                                                    {!isSubHeader && (item.amount || 0).toLocaleString()}
                                                </td>
                                                <td className="no-print" style={{ border: '1px solid #e2e8f0', textAlign: 'center' }}>
                                                    <Trash2 size={14} color="#ef4444" style={{ cursor: 'pointer' }} onClick={() => setSections(sections.map(s => s.id === section.id ? { ...s, items: s.items.filter(i => i.id !== item.id) } : s))} />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </React.Fragment>
                            );
                        })}

                        {/* Total Rows */}
                        <tr style={{ backgroundColor: '#f1f5f9', fontWeight: 700 }}>
                            <td colSpan={4} style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'right' }}>TOTAL (A) INTERIOR WORKS</td>
                            <td style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'right' }}>₹{getGroupATotal().toLocaleString()}</td>
                            <td className="no-print"></td>
                        </tr>
                        <tr style={{ backgroundColor: '#f1f5f9', fontWeight: 700 }}>
                            <td colSpan={4} style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'right' }}>TOTAL (B) APPLIANCES & HOB</td>
                            <td style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'right' }}>₹{getGroupBTotal().toLocaleString()}</td>
                            <td className="no-print"></td>
                        </tr>
                        <tr style={{ backgroundColor: '#f1f5f9', fontWeight: 700 }}>
                            <td colSpan={4} style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'right' }}>TOTAL (C) LOOSE FURNITURE & DECOR</td>
                            <td style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'right' }}>₹{getGroupCTotal().toLocaleString()}</td>
                            <td className="no-print"></td>
                        </tr>
                        <tr style={{ backgroundColor: '#253b50', color: 'white', fontWeight: 800, fontSize: '0.8rem' }}>
                            <td colSpan={4} style={{ padding: '8px', border: '1px solid #334155', textAlign: 'right' }}>GRAND TOTAL (A + B + C)</td>
                            <td style={{ padding: '8px', border: '1px solid #334155', textAlign: 'right' }}>₹{getGrandTotal().toLocaleString()}</td>
                            <td className="no-print"></td>
                        </tr>
                    </tbody>
                </table>

                {/* Terms & Scope Section */}
                <div className="terms-section" style={{ marginTop: '12px', padding: '8px', borderTop: '1px dashed #e2e8f0' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="print-only" style={{ display: 'block' }}>
                            <h4 style={{ color: '#253b50', marginBottom: '4px', fontSize: '0.7rem', fontWeight: 800, borderBottom: '1px solid #253b50', display: 'inline-block' }}>TERMS & CONDITIONS:</h4>
                            <ul style={{ paddingLeft: '10px', fontSize: '0.55rem', color: '#334155', lineHeight: '1.3', margin: 0 }}>
                                <li>Plywood used shall be Austin/ Century/Sylvan 710 BWP grade with company warranty.</li>
                                <li>Hardware used shall be of EBCO/Olive make.</li>
                                <li>Wires used shall be of Finolex brand and lights of Philips brand.</li>
                                <li>Laminate can be chosen from any brand as per client's choice (Max Rs 1800/sheet).</li>
                                <li>Final costing shall be done as per actual measurement at the site after completion of the work.</li>
                                <li>40% advance at confirmation of work. Balance payment as per the work progress.</li>
                                <li>Work will commence at the site within one week from the date of advance payment.</li>
                                <li>The quotation is valid for 3 months only.</li>
                                <li>Design consultation If required shall be provided for a charge of Rs. 60,000/-</li>
                                <li>Only Design consultation charges are Rs. 150/-per sft of the plinth area.</li>
                            </ul>
                        </div>
                        <div className="print-only" style={{ display: 'block' }}>
                            <h4 style={{ color: '#b91c1c', marginBottom: '4px', fontSize: '0.7rem', fontWeight: 800, borderBottom: '1px solid #b91c1c', display: 'inline-block' }}>CLIENT'S SCOPE (NOT INCLUDED):</h4>
                            <ul style={{ paddingLeft: '10px', fontSize: '0.55rem', color: '#334155', lineHeight: '1.3', margin: 0 }}>
                                <li>Sink and taps to be provided.</li>
                                <li>Decorative lights (like wall lights, chandeliers etc).</li>
                                <li>Curtains & loose furniture (sofa, dining table, chairs, center table etc).</li>
                                <li>Art work, decorative items, mattresses and bedsheets.</li>
                                <li>Electronics (hob, chimney, microwave, oven, dishwasher etc).</li>
                                <li>Wallpapers.</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Print Footer with Logo */}
                <div className="print-footer print-only" style={{ marginTop: '15px', padding: '0 20px 5px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ borderTop: '1px solid #000', width: '100px', marginBottom: '3px' }}></div>
                        <p style={{ fontSize: '0.6rem', fontWeight: 600 }}>Client Signature</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ marginBottom: '4px' }}>
                            <img src="/src/assets/Logo.png" alt="ARK" style={{ height: '25px', objectFit: 'contain' }} />
                        </div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '1px 0', color: '#253b50' }}>THANK YOU</h3>
                        <p style={{ fontSize: '0.65rem', fontWeight: 600 }}>Authorized Signatory for ARK</p>
                    </div>
                </div>
            </div>

            <style>{`
                @media print {
                    @page { margin: 5mm; size: A4; }
                    body * { visibility: hidden !important; }
                    .premium-card, .premium-card * { visibility: visible !important; }
                    .premium-card { 
                        position: absolute !important; 
                        left: 50% !important; 
                        top: 0 !important; 
                        transform: translateX(-50%) !important;
                        width: 175mm !important; 
                        padding: 10mm !important; 
                        margin: 0 !important;
                        box-shadow: none !important; 
                        border: none !important;
                        box-sizing: border-box;
                        display: block !important;
                        background: white !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .no-print { display: none !important; }
                    .print-only { display: block !important; visibility: visible !important; }
                    tr { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; page-break-inside: avoid; }
                    th, td { 
                        padding: 1.5px 4px !important;
                        font-family: 'Inter', system-ui, sans-serif !important;
                        font-size: 6.8pt !important;
                        border: 0.5px solid #64748b !important;
                        color: black !important;
                    }
                    th { background-color: #253b50 !important; color: white !important; }
                    .section-header { background-color: #cbd5e1 !important; }
                    .section-header td { padding: 2px 6px !important; font-weight: 800 !important; }
                    
                    input, textarea { 
                        padding: 0px !important; 
                        font-size: 6.8pt !important;
                        min-height: 1px !important;
                        line-height: 1.1 !important;
                        color: black !important;
                    }

                    /* Spacing adjustments to fit one page */
                    .quote-container table { margin-bottom: 5px !important; }
                    .terms-section { margin-top: 15px !important; padding: 5px !important; page-break-inside: avoid; }
                    .print-footer { margin-top: 25px !important; page-break-inside: avoid; }
                    
                    h1 { font-size: 1.2rem !important; margin-bottom: 10px !important; }
                    p, li { font-size: 6.5pt !important; margin-bottom: 3px !important; color: black !important; }
                }
                .quotes-page, .quotes-page input, .quotes-page textarea, .quotes-page button {
                    font-family: 'Inter', system-ui, sans-serif;
                }
                .print-only { display: none; }
                input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
                input, textarea { border: none; outline: none; width: 100%; }
                @media (max-width: 768px) {
                    .quote-container {
                        overflow-x: auto !important;
                        -webkit-overflow-scrolling: touch;
                    }
                    .quote-container table {
                        min-width: 800px;
                    }
                }
            `}</style>
        </div>
    );
};
