import React, { useState, useEffect } from 'react';
import { Loader2, PlusCircle, Save, Trash2, XCircle } from 'lucide-react';
import { API_BASE_URL } from '../config';

interface WorkloadItem {
    id?: number;
    member_id: number;
    category: 'RED' | 'YELLOW' | 'GREEN';
    content: string;
    order_index: number;
}

interface TeamMember {
    id: number;
    name: string;
    row_number: number;
    order_index: number;
    items: {
        RED: WorkloadItem[];
        YELLOW: WorkloadItem[];
        GREEN: WorkloadItem[];
    };
}

export const TeamWorkLoad: React.FC = () => {
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [rowCounts, setRowCounts] = useState({ RED: 3, YELLOW: 3, GREEN: 3 });

    useEffect(() => {
        fetchWorkload();
    }, []);

    const fetchWorkload = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/team_workload/get.php`);
            const result = await response.json();
            if (result.success) {
                setMembers(result.data);

                // Use row counts from database if available, otherwise fallback to defaults
                if (result.rowCounts) {
                    setRowCounts(result.rowCounts);
                } else {
                    const counts = { RED: 3, YELLOW: 3, GREEN: 3 };
                    result.data.forEach((m: TeamMember) => {
                        ['RED', 'YELLOW', 'GREEN'].forEach(cat => {
                            m.items[cat as keyof typeof m.items].forEach(it => {
                                if (it.order_index >= (counts as any)[cat]) {
                                    (counts as any)[cat] = it.order_index + 1;
                                }
                            });
                        });
                    });
                    setRowCounts(counts);
                }
            }
        } catch (error) {
            console.error('Error fetching workload:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleMemberNameChange = (orderIdx: number, rowNum: number, name: string) => {
        setMembers(prev => {
            const newMembers = [...prev];
            const idx = newMembers.findIndex(m => Number(m.order_index) === Number(orderIdx) && Number(m.row_number) === Number(rowNum));
            if (idx > -1) {
                newMembers[idx] = { ...newMembers[idx], name };
            } else {
                newMembers.push({
                    id: 0,
                    name,
                    row_number: rowNum,
                    order_index: orderIdx,
                    items: { RED: [], YELLOW: [], GREEN: [] }
                });
            }
            return newMembers;
        });
    };

    const deleteMember = async (id: number, orderIdx: number) => {
        if (!confirm('Delete this entire team column?')) return;
        if (id > 0) {
            try {
                await fetch(`${API_BASE_URL}/team_workload/save.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'delete_member', id })
                });
            } catch (error) { console.error(error); }
        }
        setMembers(prev => prev.filter(m => m.order_index !== orderIdx));
        fetchWorkload();
    };

    const deleteRowTotally = async (category: 'RED' | 'YELLOW' | 'GREEN', itemIdx: number) => {
        if (!confirm('Permanently delete this entire row? This will shift all rows below it up.')) return;

        const newMembers = members.map(m => {
            const items = m.items[category];
            const newItems = items
                .filter(it => it.order_index !== itemIdx)
                .map(it => it.order_index > itemIdx ? { ...it, order_index: it.order_index - 1 } : it);

            return {
                ...m,
                items: {
                    ...m.items,
                    [category]: newItems
                }
            };
        });

        const newRowCounts = { ...rowCounts, [category]: Math.max(1, rowCounts[category] - 1) };
        setMembers(newMembers);
        setRowCounts(newRowCounts);

        // Auto-save after deletion to ensure persistence
        await performBulkSave(newMembers, newRowCounts);
    };

    const handleItemChange = (memberOrderIdx: number, memberRowNum: number, category: 'RED' | 'YELLOW' | 'GREEN', itemIdx: number, content: string) => {
        setMembers(prev => {
            const newMembers = [...prev];
            let memberIdx = newMembers.findIndex(m => Number(m.order_index) === Number(memberOrderIdx) && Number(m.row_number) === Number(memberRowNum));

            if (memberIdx === -1) {
                newMembers.push({
                    id: 0,
                    name: '',
                    row_number: memberRowNum,
                    order_index: memberOrderIdx,
                    items: { RED: [], YELLOW: [], GREEN: [] }
                });
                memberIdx = newMembers.length - 1;
            }

            const items = [...newMembers[memberIdx].items[category]];
            let targetIdx = items.findIndex(it => it.order_index === itemIdx);
            if (targetIdx === -1) {
                items.push({ member_id: 0, category, content: '', order_index: itemIdx });
                targetIdx = items.length - 1;
            }
            items[targetIdx] = { ...items[targetIdx], content };

            newMembers[memberIdx] = {
                ...newMembers[memberIdx],
                items: { ...newMembers[memberIdx].items, [category]: items }
            };
            return newMembers;
        });
    };

    const saveAllChanges = async () => {
        await performBulkSave(members, rowCounts);
    };

    const performBulkSave = async (membersToSave: TeamMember[], countsToSave?: any) => {
        setSaving(true);
        try {
            const payloadItems: any[] = [];
            membersToSave.forEach(m => {
                ['RED', 'YELLOW', 'GREEN'].forEach(cat => {
                    (m.items as any)[cat].forEach((item: WorkloadItem) => {
                        if (item.content.trim()) {
                            payloadItems.push({
                                order_index_col: m.order_index,
                                row_number_col: m.row_number,
                                category: cat,
                                content: item.content,
                                order_index_row: item.order_index
                            });
                        }
                    });
                });
            });

            const response = await fetch(`${API_BASE_URL}/team_workload/bulk_save.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    members: membersToSave.map(m => ({ id: m.id, name: m.name, row_number: m.row_number, order_index: m.order_index })),
                    items: payloadItems,
                    rowCounts: countsToSave || rowCounts
                })
            });
            const result = await response.json();
            if (result.success) {
                fetchWorkload();
            } else {
                alert('Save failed: ' + result.message);
            }
        } catch (error) {
            console.error('Error saving:', error);
            alert('Error connecting to server.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-10 text-center"><Loader2 className="animate-spin inline" /> Loading...</div>;

    const columnsMap: { [key: number]: { r1?: TeamMember, r2?: TeamMember } } = {};
    members.forEach(m => {
        if (!columnsMap[m.order_index]) columnsMap[m.order_index] = {};
        if (Number(m.row_number) === 1) columnsMap[m.order_index].r1 = m;
        else columnsMap[m.order_index].r2 = m;
    });

    const colIds = Object.keys(columnsMap).map(Number).sort((a, b) => a - b);
    const displayColIds = colIds.length > 0 ? colIds : [0, 1, 2, 3];
    const nextColId = Math.max(...displayColIds, -1) + 1;

    let globalRowIndex = 3;

    const renderDataRows = (category: 'RED' | 'YELLOW' | 'GREEN', colorClass: string) => {
        const rows = [];
        const count = rowCounts[category];

        for (let i = 0; i < count; i++) {
            rows.push(
                <tr key={`${category}-${i}`}>
                    <td style={{ textAlign: 'center', backgroundColor: '#f3f4f6', border: '1px solid #000', fontSize: '11px', width: '35px' }}>{globalRowIndex++}</td>
                    {i === 0 ? (
                        <td rowSpan={count} className="category-label-cell" style={{ fontWeight: 800, fontSize: '14px', border: '1px solid #000' }}>
                            {category}
                        </td>
                    ) : null}

                    {displayColIds.map(id => {
                        const m1 = columnsMap[id]?.r1;
                        const m2 = columnsMap[id]?.r2;
                        const m = m1 || m2;
                        const item = m?.items[category].find(it => Number(it.order_index) === Number(i));

                        return (
                            <React.Fragment key={`${category}-${id}-${i}`}>
                                <td className={colorClass} style={{ minWidth: '180px', padding: '0', border: '1px solid #000' }}>
                                    <input
                                        className="workload-input"
                                        style={{ height: '32px', padding: '0 10px', width: '100%', fontSize: '15px', fontWeight: '500' }}
                                        value={item?.content || ''}
                                        onChange={(e) => handleItemChange(id, m1 ? 1 : 2, category, i, e.target.value)}
                                        placeholder=""
                                    />
                                </td>
                                <td style={{ width: '15px', border: '1px solid #ccc', backgroundColor: '#fff' }}></td>
                            </React.Fragment>
                        );
                    })}
                    <td style={{ padding: '0 5px', textAlign: 'center', border: '1px solid #000', backgroundColor: '#f8fafc' }}>
                        <button onClick={() => deleteRowTotally(category, i)} className="text-slate-300 hover:text-red-500 transition-colors p-1" title="Delete entire row">
                            <Trash2 size={16} />
                        </button>
                    </td>
                </tr>
            );
        }
        return rows;
    };

    return (
        <div className="p-8" style={{ backgroundColor: '#f1f5f9', minHeight: '100vh', overflowX: 'auto' }}>
            <style>{`
                .workload-input::placeholder { color: rgba(255,255,255,0.4) !important; }
                .data-input::placeholder { color: rgba(0,0,0,0.2) !important; }
            `}</style>

            <div className="max-w-[1400px] mx-auto bg-white p-8 rounded-3xl shadow-2xl border border-slate-200">
                <div className="flex justify-between items-center mb-10 pb-8 border-b-2 border-slate-50"
                    style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <div>
                        <h2 className="text-4xl font-black text-slate-900 tracking-tight uppercase leading-none">TEAM WORK LOAD</h2>
                        <p className="text-slate-400 text-sm mt-3 font-semibold tracking-wide uppercase">ENTER DATA DIRECTLY INTO CELLS • CLICK SAVE TO SYNC</p>
                    </div>
                    <button
                        onClick={saveAllChanges}
                        disabled={saving}
                        className="group flex items-center gap-4 bg-[#10b981] hover:bg-[#059669] text-white px-14 py-6 rounded-2xl font-black text-2xl shadow-[0_15px_30px_-12px_rgba(16,185,129,0.5)] transition-all transform active:scale-95 disabled:opacity-50"
                        style={{ display: 'flex', alignItems: 'center', fontSize: '18px', backgroundColor: '#fca311', color: 'white', borderRadius: '5px' }}
                    >
                        {saving ? <Loader2 className="animate-spin" size={32} /> : <Save className="group-hover:scale-110 transition-transform" size={32} />}
                        SAVE CHANGES
                    </button>
                </div>

                <table className="workload-table w-full" style={{ border: '3px solid #000' }}>
                    <thead>
                        <tr className="bg-slate-100">
                            <td style={{ backgroundColor: '#cbd5e1', border: '1px solid #000', textAlign: 'center', fontSize: '11px', fontWeight: '900' }}>1</td>
                            <td style={{ width: '50px', border: '1px solid #000' }}></td>
                            {displayColIds.map(id => {
                                const m = columnsMap[id]?.r1;
                                return (
                                    <React.Fragment key={`h1-${id}`}>
                                        <td className="workload-header-cell" style={{ padding: '0', border: '1px solid #000', backgroundColor: '#334155' }}>
                                            <div className="flex items-center">
                                                <input
                                                    className="workload-input text-white"
                                                    style={{ height: '45px', padding: '0 15px', width: '100%', fontWeight: '900', backgroundColor: 'transparent', textAlign: 'left', fontSize: '18px', color: 'white' }}
                                                    value={m?.name || ''}
                                                    onChange={(e) => handleMemberNameChange(id, 1, e.target.value)}
                                                    placeholder="NAME..."
                                                />
                                                {m && (
                                                    <button onClick={() => deleteMember(m.id, id)} className="text-slate-400 hover:text-red-400 p-2 transition-colors mr-1">
                                                        <Trash2 size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ width: '15px', border: '1px solid #e2e8f0', backgroundColor: '#fff' }}></td>
                                    </React.Fragment>
                                );
                            })}
                            <td rowSpan={2} style={{ verticalAlign: 'middle', padding: '20px', border: '1px solid #000', backgroundColor: '#f8fafc' }}>
                                <button onClick={() => handleMemberNameChange(nextColId, 1, '')} className="text-emerald-500 hover:text-emerald-600 transition-all transform hover:scale-125 active:rotate-90">
                                    <PlusCircle size={44} />
                                </button>
                            </td>
                        </tr>
                        <tr className="bg-slate-100">
                            <td style={{ backgroundColor: '#cbd5e1', border: '1px solid #000', textAlign: 'center', fontSize: '11px', fontWeight: '900' }}>2</td>
                            <td style={{ border: '1px solid #000' }}></td>
                            {displayColIds.map(id => {
                                const m = columnsMap[id]?.r2;
                                return (
                                    <React.Fragment key={`h2-${id}`}>
                                        <td className="workload-header-cell" style={{ padding: '0', border: '1px solid #000', backgroundColor: '#334155' }}>
                                            <div className="flex items-center">
                                                <input
                                                    className="workload-input text-white"
                                                    style={{ height: '45px', padding: '0 15px', width: '100%', fontWeight: '900', backgroundColor: 'transparent', textAlign: 'left', fontSize: '18px', color: 'white' }}
                                                    value={m?.name || ''}
                                                    onChange={(e) => handleMemberNameChange(id, 2, e.target.value)}
                                                    placeholder="NAME..."
                                                />
                                                {m && !columnsMap[id]?.r1 && (
                                                    <button onClick={() => deleteMember(m.id, id)} className="text-slate-400 hover:text-red-400 p-2 transition-colors mr-1">
                                                        <Trash2 size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ width: '15px', border: '1px solid #e2e8f0', backgroundColor: '#fff' }}></td>
                                    </React.Fragment>
                                );
                            })}
                        </tr>
                        <tr>
                            <td style={{ backgroundColor: '#f1f5f9', border: '1px solid #000', textAlign: 'center', fontSize: '11px' }}>{globalRowIndex++}</td>
                            <td colSpan={displayColIds.length * 2 + 1} style={{ height: '25px', border: '1px solid #000', backgroundColor: '#fff' }}></td>
                            <td style={{ border: '1px solid #000', backgroundColor: '#f1f5f9' }}></td>
                        </tr>
                    </thead>
                    <tbody>
                        {renderDataRows('RED', 'red-data-cell')}
                        <tr>
                            <td style={{ border: '1px solid #000', backgroundColor: '#f8fafc', textAlign: 'center' }}>
                                <button onClick={() => setRowCounts(p => ({ ...p, RED: p.RED + 1 }))} className="font-black text-emerald-600 hover:text-emerald-800 p-1 text-2xl">+</button>
                            </td>
                            <td colSpan={displayColIds.length * 2 + 1} style={{ height: '25px', border: '1px solid #000' }}></td>
                            <td style={{ border: '1px solid #000', backgroundColor: '#f8fafc' }}></td>
                        </tr>
                        {renderDataRows('YELLOW', 'yellow-data-cell')}
                        <tr>
                            <td style={{ border: '1px solid #000', backgroundColor: '#f8fafc', textAlign: 'center' }}>
                                <button onClick={() => setRowCounts(p => ({ ...p, YELLOW: p.YELLOW + 1 }))} className="font-black text-emerald-600 hover:text-emerald-800 p-1 text-2xl">+</button>
                            </td>
                            <td colSpan={displayColIds.length * 2 + 1} style={{ height: '25px', border: '1px solid #000' }}></td>
                            <td style={{ border: '1px solid #000', backgroundColor: '#f8fafc' }}></td>
                        </tr>
                        {renderDataRows('GREEN', 'green-data-cell')}
                        <tr>
                            <td style={{ border: '1px solid #000', backgroundColor: '#f8fafc', textAlign: 'center' }}>
                                <button onClick={() => setRowCounts(p => ({ ...p, GREEN: p.GREEN + 1 }))} className="font-black text-emerald-600 hover:text-emerald-800 p-1 text-2xl">+</button>
                            </td>
                            <td colSpan={displayColIds.length * 2 + 1} style={{ height: '25px', border: '1px solid #000' }}></td>
                            <td style={{ border: '1px solid #000', backgroundColor: '#f8fafc' }}></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};
