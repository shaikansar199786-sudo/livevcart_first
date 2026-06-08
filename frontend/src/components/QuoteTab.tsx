import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2, Printer, Save, Undo2, Redo2, Trash2, PlusCircle, ListPlus, MoveUp, MoveDown, Check, Heading } from 'lucide-react';
import EleganceLogo from '../assets/Elegance Logo.png';
import ArkLogo from '../assets/Logo.png';

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
    const [sections, setSections] = useState<QuoteSection[]>([]);
    const [history, setHistory] = useState<QuoteSection[][]>([]);
    const [redoStack, setRedoStack] = useState<QuoteSection[][]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [subtitle, setSubtitle] = useState('');
    const [gstEnabled, setGstEnabled] = useState(false);

    const addToHistory = (newSections: QuoteSection[]) => {
        setHistory(prev => [...prev.slice(-19), sections]); // Keep last 20 states
        setRedoStack([]);
        setSections(newSections);
    };

    const handleUndo = () => {
        if (history.length === 0) return;
        const previous = history[history.length - 1];
        setRedoStack(prev => [...prev, sections]);
        setHistory(prev => prev.slice(0, -1));
        setSections(previous);
    };

    const handleRedo = () => {
        if (redoStack.length === 0) return;
        const next = redoStack[redoStack.length - 1];
        setHistory(prev => [...prev, sections]);
        setRedoStack(prev => prev.slice(0, -1));
        setSections(next);
    };


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
                setSubtitle(response.data.data.subtitle || '');
            } else if (!isUsedQuote) {
                // If no quote exists and it's not a used quote, load default data
                setSections(getDefaultSections());
            } else {
                setSections([]);
            }
        } catch (err) {
            console.error('Failed to fetch quote');
            if (!isUsedQuote) setSections(getDefaultSections());
        } finally {
            setLoading(false);
        }
    };

    const getDefaultSections = (): QuoteSection[] => [
        {
            id: 'd1', name: 'A. FALSE CEILING', items: [
                { id: 'di1', particulars: 'I. GYPSUM', brand: '', unit: 'sft', quantity: 10000, rate: 70, amount: 700000 },
                { id: 'di2', particulars: 'II. PVC CEILING (IN BALCONY)', brand: '', unit: 'sft', quantity: 68, rate: 420, amount: 28560 },
                { id: 'di3', particulars: 'III. WOODEN CEILING (IN HALL)', brand: '', unit: 'sft', quantity: 45, rate: 1500, amount: 67500 },
            ]
        },
        {
            id: 'd2', name: 'B. ELECTRICAL', items: [
                { id: 'di4', particulars: 'I. 15W Lights', brand: '', unit: 'no', quantity: 30, rate: 700, amount: 21000 },
                { id: 'di5', particulars: 'II. 6W Lights', brand: '', unit: 'no', quantity: 5, rate: 700, amount: 3500 },
                { id: 'di6', particulars: 'III. 3W Lights', brand: '', unit: 'no', quantity: 6, rate: 700, amount: 4200 },
                { id: 'di7', particulars: 'IV. ROPE LIGHTS', brand: '', unit: 'rft', quantity: 75, rate: 220, amount: 16500 },
                { id: 'di8', particulars: 'V. PROFILE LIGHTS', brand: '', unit: 'rft', quantity: 44, rate: 400, amount: 17600 },
                { id: 'di9', particulars: 'VI. FANS', brand: '', unit: 'no', quantity: 7, rate: 7500, amount: 52500 },
                { id: 'di10', particulars: 'VII. EXHAUST FANS IN WASH ROOMS', brand: '', unit: 'no', quantity: 3, rate: 2000, amount: 6000 },
                { id: 'di11', particulars: 'VIII. ELECTRICIAN CHARGES', brand: '', unit: 'lumpsum', quantity: 1, rate: 50000, amount: 50000 },
                { id: 'di12', particulars: 'IX. WIRING AND OTHER MATERIAL', brand: '', unit: 'lumpsum', quantity: 1, rate: 50000, amount: 50000 },
            ]
        },
        {
            id: 'd3', name: 'C. FLOOR GUARD', items: [
                { id: 'di13', particulars: 'I. FLOOR GUARD COVERING', brand: '', unit: 'sft', quantity: 1200, rate: 9, amount: 10800 },
            ]
        },
        {
            id: 'd4', name: 'D. ANTI PEST', items: [
                { id: 'di14', particulars: 'I. ANTI PEST TREATMENT', brand: '', unit: 'sft', quantity: 1200, rate: 6, amount: 7200 },
            ]
        },
        {
            id: 'd5', name: 'E. WOOD WORK', items: [
                { id: 'dh1', particulars: '1. DRAWING ROOM', brand: 'HEADER', unit: '', quantity: 0, rate: 0, amount: 0 },
                { id: 'di15', particulars: 'I. Sofa backpanelling', brand: '', unit: 'sft', quantity: 100, rate: 1500, amount: 150000 },
                { id: 'di16', particulars: 'II. Duco paint', brand: '', unit: 'sft', quantity: 36, rate: 800, amount: 28800 },
                { id: 'di17', particulars: 'III. Mirror', brand: '', unit: 'sft', quantity: 18, rate: 500, amount: 9000 },
                { id: 'di18', particulars: 'IV. Rafters', brand: '', unit: 'sft', quantity: 18, rate: 500, amount: 9000 },
                { id: 'di19', particulars: 'V. Panelling (towards Handwash)', brand: '', unit: 'sft', quantity: 55, rate: 1500, amount: 82500 },
                { id: 'di20', particulars: 'VI. mirrors', brand: '', unit: 'sft', quantity: 15, rate: 500, amount: 7500 },
                { id: 'di21', particulars: 'VII. Wash area Storage', brand: '', unit: 'sft', quantity: 27, rate: 2000, amount: 54000 },
                { id: 'di22', particulars: 'VIII. Profile shutters', brand: '', unit: 'sft', quantity: 20, rate: 1250, amount: 25000 },
                { id: 'di23', particulars: 'IX. Puja Storage', brand: '', unit: 'sft', quantity: 12.5, rate: 2000, amount: 25000 },
                { id: 'di24', particulars: 'X. Corian work', brand: '', unit: 'lumpsum', quantity: 1, rate: 120000, amount: 120000 },
                { id: 'di25', particulars: 'XI. Console beside puja', brand: '', unit: 'lumpsum', quantity: 1, rate: 50000, amount: 50000 },
                { id: 'dh2', particulars: '2. LIVING ROOM', brand: 'HEADER', unit: '', quantity: 0, rate: 0, amount: 0 },
                { id: 'di26', particulars: 'I. TV UNIT Panelling', brand: '', unit: 'sft', quantity: 65, rate: 1500, amount: 97500 },
                { id: 'di27', particulars: 'II. TV UNIT Mirrors', brand: '', unit: 'sft', quantity: 8, rate: 500, amount: 4000 },
                { id: 'di28', particulars: 'III. TV UNIT Rafters', brand: '', unit: 'sft', quantity: 10, rate: 500, amount: 5000 },
                { id: 'di29', particulars: 'IV. TV UNIT Storage', brand: '', unit: 'sft', quantity: 15, rate: 2000, amount: 30000 },
                { id: 'di30', particulars: 'V. Texture paint', brand: '', unit: 'sft', quantity: 100, rate: 500, amount: 50000 },
                { id: 'di31', particulars: 'VI. Panelling above flush doors', brand: '', unit: 'sft', quantity: 8, rate: 1500, amount: 12000 },
                { id: 'dh3', particulars: '3. KITCHEN', brand: 'HEADER', unit: '', quantity: 0, rate: 0, amount: 0 },
                { id: 'di32', particulars: 'I. Box work', brand: '', unit: 'sft', quantity: 234, rate: 2000, amount: 468000 },
                { id: 'di33', particulars: 'II. Tandem drawers', brand: '', unit: 'no.s', quantity: 5, rate: 5750, amount: 28750 },
                { id: 'di34', particulars: 'III. Corner unit', brand: '', unit: 'no.s', quantity: 1, rate: 22000, amount: 22000 },
                { id: 'di35', particulars: 'IV. Bottle pull out', brand: '', unit: 'no.s', quantity: 1, rate: 9200, amount: 9200 },
                { id: 'di36', particulars: 'V. Drawer accessories', brand: '', unit: 'no.s', quantity: 2, rate: 3500, amount: 7000 },
                { id: 'di37', particulars: 'VI. Vegetable baskets', brand: '', unit: 'sft', quantity: 2, rate: 5750, amount: 11500 },
                { id: 'di38', particulars: 'VII. Profile shutters', brand: '', unit: 'sft', quantity: 18, rate: 1250, amount: 22500 },
                { id: 'dh4', particulars: '4. UTILITY', brand: 'HEADER', unit: '', quantity: 0, rate: 0, amount: 0 },
                { id: 'di39', particulars: 'I. Storage above counter', brand: '', unit: 'sft', quantity: 30, rate: 2000, amount: 60000 },
                { id: 'di40', particulars: 'II. Storage below counter', brand: '', unit: 'sft', quantity: 15, rate: 2000, amount: 30000 },
                { id: 'dh5', particulars: '5. MASTER BEDROOM', brand: 'HEADER', unit: '', quantity: 0, rate: 0, amount: 0 },
                { id: 'di41', particulars: 'I. Wardrobe', brand: '', unit: 'sft', quantity: 76, rate: 2000, amount: 152000 },
                { id: 'di42', particulars: 'II. King size bed with side tables', brand: '', unit: 'no', quantity: 1, rate: 60000, amount: 60000 },
                { id: 'di43', particulars: 'III. TV Backpanel', brand: '', unit: 'sft', quantity: 110, rate: 110, amount: 12100 },
                { id: 'di44', particulars: 'IV. TV Rafters', brand: '', unit: 'sft', quantity: 56, rate: 500, amount: 28000 },
                { id: 'di45', particulars: 'V. TV Drawers', brand: '', unit: 'sft', quantity: 4, rate: 2000, amount: 8000 },
                { id: 'di46', particulars: 'VI. Dresser', brand: '', unit: 'sft', quantity: 10, rate: 1500, amount: 15000 },
                { id: 'di47', particulars: 'VII. Mirror', brand: '', unit: 'sft', quantity: 10, rate: 800, amount: 8000 },
                { id: 'dh6', particulars: "6. SON'S BEDROOM", brand: 'HEADER', unit: '', quantity: 0, rate: 0, amount: 0 },
                { id: 'di48', particulars: 'I. Wardrobe-1', brand: '', unit: 'sft', quantity: 48, rate: 2000, amount: 96000 },
                { id: 'di49', particulars: 'II. Profile shutters', brand: '', unit: 'sft', quantity: 31, rate: 1250, amount: 38750 },
                { id: 'di50', particulars: 'III. Bed back texture paint', brand: '', unit: 'sft', quantity: 108, rate: 500, amount: 54000 },
                { id: 'di51', particulars: 'IV. King size bed with side tables', brand: '', unit: 'no', quantity: 1, rate: 60000, amount: 60000 },
                { id: 'di52', particulars: 'V. Study table storage', brand: '', unit: 'sft', quantity: 2, rate: 2000, amount: 4000 },
                { id: 'di53', particulars: 'VI. Study table shelves', brand: '', unit: 'sft', quantity: 4, rate: 2000, amount: 8000 },
                { id: 'di54', particulars: 'VII. Metal supports', brand: '', unit: 'lumpsum', quantity: 1, rate: 10000, amount: 10000 },
                { id: 'di55', particulars: 'VIII. Mirror beside bed', brand: '', unit: 'no', quantity: 1, rate: 10000, amount: 10000 },
                { id: 'di56', particulars: 'IX. Dresser wardrobe-2', brand: '', unit: 'sft', quantity: 34, rate: 2000, amount: 68000 },
                { id: 'di57', particulars: 'X. Dresser Profile shutters', brand: '', unit: 'sft', quantity: 12, rate: 1250, amount: 15000 },
                { id: 'di58', particulars: 'XI. Mirror (sensor)', brand: '', unit: 'sft', quantity: 21, rate: 800, amount: 16800 },
                { id: 'dh7', particulars: "7. DAUGHTER'S BEDROOM", brand: 'HEADER', unit: '', quantity: 0, rate: 0, amount: 0 },
                { id: 'di58_1', particulars: 'I. Wardrobe', brand: '', unit: 'sft', quantity: 76, rate: 2000, amount: 152000 },
                { id: 'di58_2', particulars: 'II. Profile shutter', brand: '', unit: 'sft', quantity: 12, rate: 1250, amount: 15000 },
                { id: 'di58_3', particulars: 'III. Storage beside study', brand: '', unit: 'sft', quantity: 21, rate: 2000, amount: 42000 },
                { id: 'di58_4', particulars: 'IV. Bed backpanel Wallpaper', brand: '', unit: 'no', quantity: 1, rate: 6500, amount: 6500 },
                { id: 'di58_5', particulars: 'V. King size bed with side tables', brand: '', unit: 'no', quantity: 1, rate: 60000, amount: 60000 },
                { id: 'di58_6', particulars: 'VI. Dresser', brand: '', unit: 'sft', quantity: 14, rate: 2000, amount: 28000 },
                { id: 'dh8', particulars: '9. BALCONY', brand: 'HEADER', unit: '', quantity: 0, rate: 0, amount: 0 },
                { id: 'di58_7', particulars: 'I. Mirror (sensor)', brand: '', unit: 'sft', quantity: 1, rate: 10000, amount: 10000 },
                { id: 'di58_8', particulars: 'II. Study cum sewing table', brand: '', unit: 'sft', quantity: 22, rate: 850, amount: 18700 },
                { id: 'di58_9', particulars: 'III. Shelves', brand: '', unit: 'sft', quantity: 8, rate: 850, amount: 6800 },
                { id: 'di58_10', particulars: 'IV. Shelves with metal edge', brand: '', unit: 'sft', quantity: 8, rate: 1000, amount: 8000 },
                { id: 'di58_11', particulars: 'V. Rafters', brand: '', unit: 'sft', quantity: 54, rate: 800, amount: 43200 },
                { id: 'di58_12', particulars: 'VI. BAR UNIT', brand: '', unit: 'sft', quantity: 26, rate: 2000, amount: 52000 },
                { id: 'di58_13', particulars: 'VII. Profile shutters', brand: '', unit: 'sft', quantity: 20, rate: 1250, amount: 25000 },
                { id: 'di58_14', particulars: 'VIII. Backsplash Panelling', brand: '', unit: 'sft', quantity: 6, rate: 850, amount: 5100 },
            ]
        },
        {
            id: 'd6', name: 'F. GRANITE AND TILES WORK', items: [
                { id: 'di59', particulars: 'I. Kitchen quartz counter top', brand: '', unit: 'sft', quantity: 40, rate: 2400, amount: 96000 },
                { id: 'di60', particulars: 'II. Kitchen Backsplash tiles', brand: '', unit: 'sft', quantity: 120, rate: 250, amount: 30000 },
                { id: 'di61', particulars: 'III. Wash area quartz counter top', brand: '', unit: 'sft', quantity: 5, rate: 2400, amount: 12000 },
                { id: 'di62', particulars: 'IV. Backsplash (base)', brand: '', unit: 'sft', quantity: 12, rate: 250, amount: 3000 },
                { id: 'di63', particulars: 'V. Puja counter top', brand: '', unit: 'sft', quantity: 12, rate: 2400, amount: 28800 },
                { id: 'di64', particulars: 'VI. Corian work', brand: '', unit: 'lumpsum', quantity: 1, rate: 150000, amount: 150000 },
                { id: 'di65', particulars: 'VII. Backsplash & tiles', brand: '', unit: 'sft', quantity: 35, rate: 400, amount: 14000 },
                { id: 'di66', particulars: 'VIII. Toilet Vanities Counter top', brand: '', unit: 'sft', quantity: 12, rate: 2000, amount: 24000 },
                { id: 'di67', particulars: 'IX. Utility Granite top & supports', brand: '', unit: 'sft', quantity: 56, rate: 1200, amount: 67200 },
            ]
        },
        {
            id: 'd7', name: 'G. MISC.', items: [
                { id: 'di68', particulars: 'I. Cushion work in MBR', brand: '', unit: 'sft', quantity: 18, rate: 650, amount: 11700 },
                { id: 'di69', particulars: 'II. Cushion work in KBR', brand: '', unit: 'sft', quantity: 18, rate: 650, amount: 11700 },
                { id: 'di70', particulars: 'III. Cushion work in GBR', brand: '', unit: 'sft', quantity: 18, rate: 650, amount: 11700 },
                { id: 'di71', particulars: 'IV. Vanities in bathrooms (woodwork)', brand: '', unit: 'sft', quantity: 12, rate: 2000, amount: 24000 },
            ]
        },
        {
            id: 'd8', name: 'H. PAINTING', items: [
                { id: 'di72', particulars: 'I. Royale shyne (putty+primer+2 coats)', brand: '', unit: 'sft', quantity: 4000, rate: 30, amount: 120000 },
                { id: 'di73', particulars: 'II. Flush Door polishing', brand: '', unit: 'lumpsum', quantity: 1, rate: 120000, amount: 120000 },
            ]
        },
        {
            id: 'd9', name: 'I. APPLIANCES', items: [
                { id: 'di74', particulars: 'I. Home appliances', brand: '', unit: 'no', quantity: 1, rate: 20000, amount: 20000 },
                { id: 'di75', particulars: 'II. HOB', brand: '', unit: 'no', quantity: 1, rate: 25000, amount: 25000 },
                { id: 'di76', particulars: 'III. Chimney', brand: '', unit: 'no', quantity: 1, rate: 45000, amount: 45000 },
                { id: 'di77', particulars: 'IV. In-built microwave oven', brand: '', unit: 'no', quantity: 1, rate: 80000, amount: 80000 },
                { id: 'di78', particulars: 'V. Washing machine', brand: '', unit: 'no', quantity: 1, rate: 80000, amount: 80000 },
                { id: 'di79', particulars: 'VI. Acs', brand: '', unit: 'no', quantity: 6, rate: 65000, amount: 390000 },
                { id: 'di80', particulars: 'VII. Fridge', brand: '', unit: 'no', quantity: 1, rate: 70000, amount: 70000 },
            ]
        },
        {
            id: 'd10', name: 'J. MISCELLANEOUS (LOOSE FURNITURE & DECOR)', items: [
                { id: 'dh9', particulars: '1. LOOSE FURNITURE', brand: 'HEADER', unit: '', quantity: 0, rate: 0, amount: 0 },
                { id: 'di81', particulars: 'I. L shape sofa', brand: '', unit: 'no', quantity: 1, rate: 150000, amount: 150000 },
                { id: 'di82', particulars: 'II. 3 seater sofa', brand: '', unit: 'no', quantity: 1, rate: 80000, amount: 80000 },
                { id: 'di83', particulars: 'III. Accent chair', brand: '', unit: 'no', quantity: 1, rate: 25000, amount: 25000 },
                { id: 'di84', particulars: 'IV. Centre table', brand: '', unit: 'no', quantity: 1, rate: 25000, amount: 25000 },
                { id: 'di85', particulars: 'V. Dining table', brand: '', unit: 'no', quantity: 1, rate: 50000, amount: 50000 },
                { id: 'di86', particulars: "VI. Son's room Study Chair", brand: '', unit: 'no', quantity: 1, rate: 10000, amount: 10000 },
                { id: 'di87', particulars: 'VII. Study Chair in MBR', brand: '', unit: 'no', quantity: 1, rate: 60000, amount: 60000 },
                { id: 'di88', particulars: 'VIII. Pouffes (Family Hall)', brand: '', unit: 'no', quantity: 1, rate: 6000, amount: 6000 },
                { id: 'di89', particulars: 'IX. Window bench (Son Room)', brand: '', unit: 'no', quantity: 2, rate: 4500, amount: 9000 },
                { id: 'di90', particulars: 'X. Pouffes (Daughter Room)', brand: '', unit: 'no', quantity: 1, rate: 6000, amount: 6000 },
                { id: 'di91', particulars: 'XI. Study Chair (Daughter Room)', brand: '', unit: 'no', quantity: 1, rate: 4500, amount: 4500 },
                { id: 'dh10', particulars: '2. BED ACCESSORIES', brand: 'HEADER', unit: '', quantity: 0, rate: 0, amount: 0 },
                { id: 'di92', particulars: 'I. Mattresses & pillows', brand: '', unit: 'no', quantity: 1, rate: 8000, amount: 8000 },
                { id: 'di93', particulars: 'II. Bedcovers & duvets', brand: '', unit: 'no', quantity: 3, rate: 15000, amount: 45000 },
                { id: 'dh11', particulars: '3. SINKS & TAPS', brand: 'HEADER', unit: '', quantity: 0, rate: 0, amount: 0 },
                { id: 'di94', particulars: 'I. Sinks (Kitchen/Utility/Wash)', brand: '', unit: 'no', quantity: 3, rate: 5500, amount: 16500 },
                { id: 'di95', particulars: 'II. Kitchen Tap', brand: '', unit: 'no', quantity: 1, rate: 15000, amount: 15000 },
                { id: 'di96', particulars: 'III. Utility Tap', brand: '', unit: 'no', quantity: 1, rate: 10000, amount: 10000 },
                { id: 'di97', particulars: 'IV. Wash area Tap', brand: '', unit: 'no', quantity: 1, rate: 10000, amount: 10000 },
                { id: 'dh12', particulars: '4. LIGHTS & DECOR', brand: 'HEADER', unit: '', quantity: 0, rate: 0, amount: 0 },
                { id: 'di98', particulars: 'I. Chandelier in hall', brand: '', unit: 'no', quantity: 1, rate: 30000, amount: 30000 },
                { id: 'di99', particulars: 'II. Hanging lights (Daughter Room)', brand: '', unit: 'no', quantity: 1, rate: 15000, amount: 15000 },
                { id: 'di100', particulars: 'III. Curtains (Complete Home)', brand: '', unit: 'no', quantity: 1, rate: 200000, amount: 200000 },
                { id: 'di101', particulars: 'IV. Carpet (Living Room)', brand: '', unit: 'no', quantity: 1, rate: 35000, amount: 35000 },
                { id: 'di102', particulars: 'V. Carpet (Son Room)', brand: '', unit: 'no', quantity: 1, rate: 35000, amount: 35000 },
                { id: 'di103', particulars: 'VI. Carpet (Daughter Room)', brand: '', unit: 'no', quantity: 1, rate: 35000, amount: 35000 },
                { id: 'di104', particulars: 'VII. Artwork', brand: '', unit: 'no', quantity: 1, rate: 40000, amount: 40000 },
                { id: 'di105', particulars: 'VIII. Side tables', brand: '', unit: 'no', quantity: 4, rate: 18000, amount: 72000 },
                { id: 'di106', particulars: 'IX. Wallpapers', brand: '', unit: 'no', quantity: 6, rate: 6000, amount: 36000 },
                { id: 'dh13', particulars: '5. BATHROOMS & MISC', brand: 'HEADER', unit: '', quantity: 0, rate: 0, amount: 0 },
                { id: 'di107', particulars: 'I. Glass partitions', brand: '', unit: 'no', quantity: 1, rate: 25000, amount: 25000 },
                { id: 'di108', particulars: 'II. Bathroom accessories', brand: '', unit: 'no', quantity: 3, rate: 3000, amount: 9000 },
                { id: 'di109', particulars: 'III. Balcony clothes hangers', brand: '', unit: 'no', quantity: 2, rate: 6000, amount: 12000 },
                { id: 'di110', particulars: 'IV. Step dustbins', brand: '', unit: 'no', quantity: 5, rate: 4000, amount: 20000 },
                { id: 'di111', particulars: 'V. Doormats', brand: '', unit: 'no', quantity: 8, rate: 600, amount: 4800 },
            ]
        }
    ];

    const handleSaveQuote = async () => {
        setSaving(true);
        try {
            const total = getGrandTotal();
            const response = await axios.post(`${API_BASE_URL}/quotes/save`, {

                project_id: project.project_id,
                is_used_quote: isUsedQuote,
                total_amount: total,
                sections: sections,
                subtitle: subtitle,
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

    const updateItem = (sectionId: string, itemId: string, field: string, value: any, saveToHistory: boolean = false) => {
        const newSections = sections.map(s => {
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
        });

        if (saveToHistory) {
            addToHistory(newSections);
        } else {
            setSections(newSections);
        }
    };

    const addSection = () => {
        const newSection: QuoteSection = {
            id: 's-' + Date.now(),
            name: 'NEW SECTION',
            items: []
        };
        addToHistory([...sections, newSection]);
    };

    const deleteSection = (sectionId: string) => {
        if (!window.confirm('Delete this entire section?')) return;
        addToHistory(sections.filter(s => s.id !== sectionId));
    };

    const addHeaderAfterGroup = (sectionId: string, headerId: string) => {
        const newItem: QuoteItem = {
            id: 'i-' + Date.now(),
            particulars: 'SUB HEADING',
            brand: 'HEADER',
            unit: '',
            quantity: 0,
            rate: 0,
            amount: 0
        };
        const newSections = sections.map(s => {
            if (s.id === sectionId) {
                const index = s.items.findIndex(i => i.id === headerId);
                if (index !== -1) {
                    // Find the next header or end of list
                    let nextHeaderIndex = s.items.length;
                    for (let j = index + 1; j < s.items.length; j++) {
                        if (s.items[j].brand === 'HEADER') {
                            nextHeaderIndex = j;
                            break;
                        }
                    }
                    const newItems = [...s.items];
                    newItems.splice(nextHeaderIndex, 0, newItem);
                    return { ...s, items: newItems };
                }
                return { ...s, items: [...s.items, newItem] };
            }
            return s;
        });
        addToHistory(newSections);
    };

    const addItem = (sectionId: string, isHeader: boolean = false, insertAfterId?: string) => {
        const newItem: QuoteItem = {
            id: 'i-' + Date.now(),
            particulars: isHeader ? 'SUB HEADING' : 'New Item',
            brand: isHeader ? 'HEADER' : '',
            unit: '',
            quantity: 0,
            rate: 0,
            amount: 0
        };
        const newSections = sections.map(s => {
            if (s.id === sectionId) {
                if (insertAfterId) {
                    const index = s.items.findIndex(i => i.id === insertAfterId);
                    if (index !== -1) {
                        const newItems = [...s.items];
                        newItems.splice(index + 1, 0, newItem);
                        return { ...s, items: newItems };
                    }
                }
                return { ...s, items: [...s.items, newItem] };
            }
            return s;
        });
        addToHistory(newSections);
    };

    const deleteItem = (sectionId: string, itemId: string) => {
        const newSections = sections.map(s => {
            if (s.id === sectionId) {
                return { ...s, items: s.items.filter(i => i.id !== itemId) };
            }
            return s;
        });
        addToHistory(newSections);
    };

    const updateSectionName = (sectionId: string, name: string, saveToHistory: boolean = false) => {
        const newSections = sections.map(s => {
            if (s.id === sectionId) return { ...s, name };
            return s;
        });
        if (saveToHistory) {
            addToHistory(newSections);
        } else {
            setSections(newSections);
        }
    };

    const getGrandTotal = () => {
        return sections.reduce((sum, s) => sum + s.items.reduce((itemSum, i) => itemSum + (i.amount || 0), 0), 0);
    };

    const getGstAmount = () => {
        return gstEnabled ? getGrandTotal() * 0.18 : 0;
    };

    const getFinalTotal = () => {
        return getGrandTotal() + getGstAmount();
    };

    const handlePrint = () => {
        window.print();
    };

    if (loading) return <div style={{ textAlign: 'center', padding: '40px' }}><Loader2 className="animate-spin" style={{ margin: '0 auto' }} /></div>;

    const grandTotal = getGrandTotal();

    return (
        <div className="quote-container print-area" style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px' }}>
            {/* Watermark Overlay for all pages */}
            <div className="print-only" style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                opacity: 0.04,
                zIndex: 9999,
                pointerEvents: 'none',
                width: '600px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
            }}>
                <img src={ArkLogo} alt="Watermark" style={{ width: '100%', objectFit: 'contain' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }} className="no-print">
                <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Project Estimate: {isUsedQuote ? 'Used Materials' : 'Initial Quote'}</h3>
                    {!isReadOnly && (
                        <input
                            type="text"
                            placeholder="Enter subtitle..."
                            value={subtitle}
                            onChange={(e) => setSubtitle(e.target.value)}
                            style={{ marginTop: '8px', padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.9rem', width: '300px' }}
                        />
                    )}
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    {!isReadOnly && (
                        <>
                            <button onClick={handleUndo} disabled={history.length === 0} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '6px', backgroundColor: history.length === 0 ? '#f3f4f6' : '#e5e7eb' }}>
                                <Undo2 size={18} /> Undo
                            </button>
                            <button onClick={handleRedo} disabled={redoStack.length === 0} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '6px', backgroundColor: redoStack.length === 0 ? '#f3f4f6' : '#e5e7eb' }}>
                                <Redo2 size={18} /> Redo
                            </button>
                            <button onClick={addSection} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '6px', backgroundColor: '#eff6ff', color: '#1e40af' }}>
                                <PlusCircle size={18} /> Add Section
                            </button>
                        </>
                    )}
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

            <div className="print-only" style={{ marginBottom: '2px', borderBottom: '1px solid #253b50', paddingBottom: '2px' }}>
                {project.project_id === 'standalone' ? (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <img src={EleganceLogo} alt="Logo" style={{ height: '50px', objectFit: 'contain' }} />
                    </div>
                ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ textAlign: 'left' }}>
                            <h1 style={{ margin: 0, fontSize: '28px', color: '#253b50', fontWeight: 900 }}>ARK ARCHITECTS</h1>
                            <p style={{ margin: '5px 0', fontSize: '14px', color: '#64748b' }}>& INTERIOR DESIGNERS</p>
                        </div>
                        <img src={ArkLogo} alt="Logo" style={{ height: '70px', objectFit: 'contain' }} />
                    </div>
                )}
                <div style={{ marginTop: '0px', textAlign: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>{project.project_id === 'standalone' ? 'Project Quote' : 'Project Estimate'}</h2>
                    {subtitle && <h3 style={{ margin: '5px 0', fontSize: '12px', color: '#475569', fontWeight: 600 }}>{subtitle}</h3>}
                    <p style={{ margin: '0px 0', fontWeight: 600, fontSize: '0.85rem' }}>{project.project_name}</p>
                </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead style={{ backgroundColor: '#253b50', color: 'white' }}>
                        <tr>
                            <th style={{ padding: '2px 4px', border: '1px solid #ddd', textAlign: 'center', width: '30px', fontSize: '0.65rem' }}>S.NO</th>
                            <th style={{ padding: '2px 6px', border: '1px solid #ddd', textAlign: 'left', fontSize: '0.65rem' }}>PARTICULARS</th>
                            <th style={{ padding: '2px 4px', border: '1px solid #ddd', textAlign: 'center', width: '70px', fontSize: '0.65rem' }}>UNIT</th>
                            <th style={{ padding: '2px 4px', border: '1px solid #ddd', textAlign: 'center', width: '60px', fontSize: '0.65rem' }}>QTY</th>
                            {isUsedQuote && <th style={{ padding: '2px 4px', border: '1px solid #ddd', textAlign: 'center', width: '60px', fontSize: '0.65rem' }}>USED QTY</th>}
                            <th style={{ padding: '2px 4px', border: '1px solid #ddd', textAlign: 'center', width: '100px', fontSize: '0.65rem' }}>RATE</th>
                            <th style={{ padding: '2px 4px', border: '1px solid #ddd', textAlign: 'right', width: '120px', fontSize: '0.65rem' }}>AMOUNT</th>
                            {!isReadOnly && <th style={{ padding: '2px 4px', border: '1px solid #ddd', textAlign: 'center', width: '60px', fontSize: '0.65rem' }} className="no-print">ACTIONS</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {sections.map((section, sIdx) => (
                            <React.Fragment key={section.id}>
                                <tr style={{ backgroundColor: '#f1f5f9' }}>
                                    <td style={{ padding: '2px 6px', border: '1px solid #ddd', fontWeight: 900, textAlign: 'center', fontSize: '0.65rem' }}>{String.fromCharCode(65 + sIdx)}</td>
                                    <td colSpan={isUsedQuote ? 6 : 5} style={{ padding: '2px 6px', border: '1px solid #ddd', fontWeight: 900, fontSize: '0.65rem' }}>
                                        {isReadOnly ? section.name : (
                                            <input
                                                value={section.name}
                                                onChange={(e) => updateSectionName(section.id, e.target.value, false)}
                                                onBlur={(e) => updateSectionName(section.id, e.target.value, true)}
                                                style={{ width: '100%', border: 'none', backgroundColor: 'transparent', fontWeight: 900, outline: 'none' }}
                                            />
                                        )}
                                    </td>
                                    {!isReadOnly && (
                                        <td style={{ padding: '5px', border: '1px solid #ddd', textAlign: 'center' }} className="no-print">
                                            <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                                                <button onClick={() => addItem(section.id)} title="Add Item" style={{ color: '#16a34a', background: 'none', border: 'none', cursor: 'pointer' }}><PlusCircle size={18} /></button>
                                                <button onClick={() => addItem(section.id, true)} title="Add Sub Title" style={{ color: '#f59e0b', background: 'none', border: 'none', cursor: 'pointer' }}><Heading size={18} /></button>
                                                <button onClick={() => deleteSection(section.id)} title="Delete Section" style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={18} /></button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                                {section.items.map((item, iIdx) => {
                                    const isHeader = item.brand === 'HEADER';
                                    return (
                                        <tr key={item.id} style={{ backgroundColor: isHeader ? '#f8fafc' : 'white' }}>
                                            <td style={{ padding: '2px 6px', border: '1px solid #ddd', textAlign: 'center', fontWeight: isHeader ? 700 : 400, fontSize: '0.65rem' }}>
                                                {isHeader ? '' : iIdx + 1}
                                            </td>
                                            <td style={{ padding: '2px 6px', border: '1px solid #ddd', fontWeight: isHeader ? 700 : 400, fontSize: '0.65rem' }}>
                                                {isReadOnly ? item.particulars : (
                                                    <input
                                                        value={item.particulars}
                                                        onChange={(e) => updateItem(section.id, item.id, 'particulars', e.target.value, false)}
                                                        onBlur={(e) => updateItem(section.id, item.id, 'particulars', e.target.value, true)}
                                                        style={{ width: '100%', border: 'none', outline: 'none', height: '18px', fontSize: '0.65rem', fontWeight: isHeader ? 700 : 400 }}
                                                    />
                                                )}
                                            </td>
                                            <td style={{ padding: '5px', border: '1px solid #ddd', textAlign: 'center' }}>
                                                {isHeader ? '' : (
                                                    isReadOnly ? item.unit :
                                                        <input
                                                            value={item.unit}
                                                            onChange={(e) => updateItem(section.id, item.id, 'unit', e.target.value, false)}
                                                            onBlur={(e) => updateItem(section.id, item.id, 'unit', e.target.value, true)}
                                                            style={{ width: '100%', border: 'none', textAlign: 'center', outline: 'none' }}
                                                        />
                                                )}
                                            </td>
                                            <td style={{ padding: '5px', border: '1px solid #ddd', textAlign: 'center' }}>
                                                {isHeader ? '' : (
                                                    isReadOnly ? item.quantity :
                                                        <input
                                                            type="number"
                                                            value={item.quantity}
                                                            onChange={(e) => updateItem(section.id, item.id, 'quantity', parseFloat(e.target.value) || 0, false)}
                                                            onBlur={(e) => updateItem(section.id, item.id, 'quantity', parseFloat(e.target.value) || 0, true)}
                                                            style={{ width: '100%', border: 'none', textAlign: 'center', outline: 'none' }}
                                                        />
                                                )}
                                            </td>
                                            {isUsedQuote && (
                                                <td style={{ padding: '5px', border: '1px solid #ddd', textAlign: 'center' }}>
                                                    {isHeader ? '' : (
                                                        isReadOnly ? item.used_quantity :
                                                            <input
                                                                type="number"
                                                                value={item.used_quantity}
                                                                onChange={(e) => updateItem(section.id, item.id, 'used_quantity', parseFloat(e.target.value) || 0, false)}
                                                                onBlur={(e) => updateItem(section.id, item.id, 'used_quantity', parseFloat(e.target.value) || 0, true)}
                                                                style={{ width: '100%', border: 'none', textAlign: 'center', outline: 'none', height: '18px', fontSize: '0.65rem' }}
                                                            />
                                                    )}
                                                </td>
                                            )}
                                            <td style={{ padding: '5px', border: '1px solid #ddd', textAlign: 'center' }}>
                                                {isHeader ? '' : (
                                                    isReadOnly ? item.rate :
                                                        <input
                                                            type="number"
                                                            value={item.rate}
                                                            onChange={(e) => updateItem(section.id, item.id, 'rate', parseFloat(e.target.value) || 0, false)}
                                                            onBlur={(e) => updateItem(section.id, item.id, 'rate', parseFloat(e.target.value) || 0, true)}
                                                            style={{ width: '100%', border: 'none', textAlign: 'center', outline: 'none' }}
                                                        />
                                                )}
                                            </td>
                                            <td style={{ padding: '2px 6px', border: '1px solid #ddd', textAlign: 'right', fontWeight: 600, fontSize: '0.65rem' }}>
                                                {isHeader ? '' : `₹${(item.amount || 0).toLocaleString()}`}
                                            </td>
                                            {!isReadOnly && (
                                                <td style={{ padding: '5px', border: '1px solid #ddd', textAlign: 'center' }} className="no-print">
                                                    <div style={{ display: 'flex', gap: '3px', justifyContent: 'center' }}>
                                                        {!isHeader && <button onClick={() => addItem(section.id, false, item.id)} title="Add Item Below" style={{ color: '#16a34a', background: 'none', border: 'none', cursor: 'pointer' }}><PlusCircle size={15} /></button>}
                                                        {isHeader && <button onClick={() => addItem(section.id, false, item.id)} title="Add Item In Group" style={{ color: '#16a34a', background: 'none', border: 'none', cursor: 'pointer' }}><PlusCircle size={15} /></button>}
                                                        {isHeader && <button onClick={() => addHeaderAfterGroup(section.id, item.id)} title="Add Sub Title After Group" style={{ color: '#f59e0b', background: 'none', border: 'none', cursor: 'pointer' }}><Heading size={15} /></button>}
                                                        <button onClick={() => deleteItem(section.id, item.id)} title={isHeader ? "Delete Header" : "Delete Item"} style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={15} /></button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </React.Fragment>
                        ))}
                        <tr style={{ backgroundColor: '#253b50', color: 'white', fontWeight: 800 }}>
                            <td colSpan={isUsedQuote ? 6 : 5} style={{ padding: '6px 6px', border: '1px solid #ddd', textAlign: 'right', fontSize: '0.75rem' }}>GRAND TOTAL</td>
                            <td style={{ padding: '6px 6px', border: '1px solid #ddd', textAlign: 'right', fontSize: '0.75rem' }}>₹{grandTotal.toLocaleString()}</td>
                        </tr>
                        {gstEnabled && (
                            <tr style={{ backgroundColor: '#1e40af', color: 'white', fontWeight: 800 }}>
                                <td colSpan={isUsedQuote ? 6 : 5} style={{ padding: '6px 6px', border: '1px solid #ddd', textAlign: 'right', fontSize: '0.75rem' }}>GST (18%)</td>
                                <td style={{ padding: '6px 6px', border: '1px solid #ddd', textAlign: 'right', fontSize: '0.75rem' }}>₹{getGstAmount().toLocaleString()}</td>
                            </tr>
                        )}
                        {gstEnabled && (
                            <tr style={{ backgroundColor: '#065f46', color: 'white', fontWeight: 800 }}>
                                <td colSpan={isUsedQuote ? 6 : 5} style={{ padding: '6px 6px', border: '1px solid #ddd', textAlign: 'right', fontSize: '0.8rem' }}>FINAL TOTAL (with GST)</td>
                                <td style={{ padding: '6px 6px', border: '1px solid #ddd', textAlign: 'right', fontSize: '0.8rem' }}>₹{getFinalTotal().toLocaleString()}</td>
                            </tr>
                        )}
                        <tr style={{ backgroundColor: '#f8fafc' }} className="no-print">
                            <td colSpan={isUsedQuote ? 7 : 6} style={{ padding: '8px 6px', border: '1px solid #ddd', textAlign: 'left', fontSize: '0.85rem' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, color: '#253b50' }}>
                                    <input
                                        type="checkbox"
                                        checked={gstEnabled}
                                        onChange={(e) => setGstEnabled(e.target.checked)}
                                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                    />
                                    Add 18% GST to Grand Total
                                </label>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>


            {/* Terms and Conditions - Forced to New Page */}
            <div className="print-only" style={{ breakBefore: 'page', marginTop: '20px', padding: '20px' }}>
                <div style={{ borderBottom: '1px solid #253b50', marginBottom: '20px', paddingBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#253b50', margin: 0 }}>Terms and Conditions</h2>
                    <img src={project.project_id === 'standalone' ? EleganceLogo : ArkLogo} alt="Logo" style={{ height: '40px' }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {[
                                "Plywood used shall be Austin/ Century/Sylvan 710 BWP grade with company warranty.",
                                "Hardware used shall be of EBCO/Olive make. Wires used shall be of Finolex brand and lights of Philips brand.",
                                "Laminate can be chosen from any brand as per client's choice (Max Rs 1800/sheet).",
                                "Final costing shall be done as per actual measurement at the site after completion of the work.",
                                "40% advance at confirmation of work. Balance payment as per the work progress.",
                                "Work will commence at the site within one week from the date of advance payment.",
                                "The quotation is valid for 3 months only.",
                                "Design consultation If required shall be provided for a charge of Rs. 60,000/-",
                                "Only Design consultation charges are Rs. 150/-per sft of the plinth area."
                            ].map((term, i) => (
                                <li key={i} style={{ fontSize: '0.75rem', color: '#334155', display: 'flex', gap: '8px' }}>
                                    <span style={{ color: '#253b50', fontWeight: 800 }}>•</span> {term}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div style={{ marginTop: '15px' }}>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#253b50', marginBottom: '10px', borderBottom: '1px solid #e2e8f0', paddingBottom: '5px' }}>Client's Scope (not included in our scope)</h3>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            {[
                                "Sink and taps to be provided",
                                "Decorative lights (like wall lights, chandeliers etc).",
                                "Curtains & loose furniture (like sofa, dining table, chairs, ottoman, center table etc).",
                                "Art work, decorative items, mattresses and bedsheets.",
                                "Electronics (like hob, chimney, microwave, oven, dishwasher etc).",
                                "Wallpapers"
                            ].map((item, i) => (
                                <li key={i} style={{ fontSize: '0.75rem', color: '#334155', display: 'flex', gap: '8px' }}>
                                    <span style={{ color: '#ef4444', fontWeight: 800 }}>✕</span> {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div style={{ marginTop: '40px', textAlign: 'center' }}>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#253b50', marginBottom: '15px', fontFamily: 'serif', fontStyle: 'italic' }}>Thank You</h2>
                    <img src={project.project_id === 'standalone' ? EleganceLogo : ArkLogo} alt="Logo" style={{ height: '80px', objectFit: 'contain' }} />
                </div>
            </div>
        </div>
    );
};

export default QuoteTab;
