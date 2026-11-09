export interface DepartmentGroup {
    name: string;
    icon: string;
    color: string;
    bgColor: string;
    borderColor: string;
}

export const getDepartmentInfo = (user: any): DepartmentGroup => {
    const rawDept = user?.department ? String(user.department).trim() : '';
    const rawRole = String(user?.role || '').toLowerCase().trim();

    // 1. Check explicit department
    if (rawDept) {
        const lowerDept = rawDept.toLowerCase();
        if (lowerDept.includes('mmt') || lowerDept.includes('masking') || lowerDept.includes('measure')) {
            return { name: 'MMT & Masking', icon: '📦', color: '#ea580c', bgColor: '#fff7ed', borderColor: '#ffedd5' };
        }
        if (lowerDept.includes('pm') || lowerDept.includes('project manage') || lowerDept.includes('project')) {
            return { name: 'Project Management', icon: '🏢', color: '#0284c7', bgColor: '#f0f9ff', borderColor: '#bae6fd' };
        }
        if (lowerDept.includes('design') || lowerDept.includes('architecture')) {
            return { name: 'Design Department', icon: '🎨', color: '#8b5cf6', bgColor: '#f5f3ff', borderColor: '#ddd6fe' };
        }
        if (lowerDept.includes('inspect') || lowerDept.includes('qc') || lowerDept.includes('quality') || lowerDept.includes('site')) {
            return { name: 'Site Inspection & QC', icon: '🔍', color: '#059669', bgColor: '#f0fdf4', borderColor: '#bbf7d0' };
        }
        if (lowerDept.includes('sale') || lowerDept.includes('market') || lowerDept.includes('business')) {
            return { name: 'Sales & Marketing', icon: '💼', color: '#d97706', bgColor: '#fffbeb', borderColor: '#fde68a' };
        }
        if (lowerDept.includes('admin') || lowerDept.includes('manage')) {
            return { name: 'Management & Admin', icon: '🏛️', color: '#475569', bgColor: '#f8fafc', borderColor: '#e2e8f0' };
        }
        return { name: rawDept, icon: '🏷️', color: '#334155', bgColor: '#f1f5f9', borderColor: '#cbd5e1' };
    }

    // 2. Derive from role if department is null
    if (['mmt', 'masking', 'mmts', 'measurement'].includes(rawRole) || rawRole.includes('mmt') || rawRole.includes('masking')) {
        return { name: 'MMT & Masking', icon: '📦', color: '#ea580c', bgColor: '#fff7ed', borderColor: '#ffedd5' };
    }
    if (['project_manager', 'pm', 'project_head', 'operations_manager'].includes(rawRole) || rawRole.includes('project_manager') || rawRole.includes('pm')) {
        return { name: 'Project Management', icon: '🏢', color: '#0284c7', bgColor: '#f0f9ff', borderColor: '#bae6fd' };
    }
    if (['associate_designer', 'designer', 'd1', 'd2', 'graphic_designer', 'cad_designer', '3d_designer', 'lead_designer'].includes(rawRole) || rawRole.includes('design') || rawRole === 'd1' || rawRole === 'd2') {
        return { name: 'Design Department', icon: '🎨', color: '#8b5cf6', bgColor: '#f5f3ff', borderColor: '#ddd6fe' };
    }
    if (['site_inspector', 'site_inspection', 'site_engineer', 'site_manager', 'qc', 'quality_inspector'].includes(rawRole) || rawRole.includes('inspect') || rawRole.includes('site')) {
        return { name: 'Site Inspection & QC', icon: '🔍', color: '#059669', bgColor: '#f0fdf4', borderColor: '#bbf7d0' };
    }
    if (['sales', 'business_associate', 'marketing_analyst', 'marketing', 'telecaller', 'sales_executive'].includes(rawRole) || rawRole.includes('sale') || rawRole.includes('market')) {
        return { name: 'Sales & Marketing', icon: '💼', color: '#d97706', bgColor: '#fffbeb', borderColor: '#fde68a' };
    }
    if (['admin', 'super_admin', 'manager', 'management', 'general_manager'].includes(rawRole) || rawRole.includes('admin') || rawRole === 'manager') {
        return { name: 'Management & Admin', icon: '🏛️', color: '#475569', bgColor: '#f8fafc', borderColor: '#e2e8f0' };
    }

    return { name: 'General Staff', icon: '👤', color: '#64748b', bgColor: '#f8fafc', borderColor: '#e2e8f0' };
};

export const DEPARTMENT_PRIORITY_ORDER = [
    'MMT & Masking',
    'Project Management',
    'Design Department',
    'Site Inspection & QC',
    'Management & Admin',
    'Sales & Marketing',
    'General Staff'
];

export const groupUsersByDepartment = (users: any[]): Record<string, any[]> => {
    const groups: Record<string, any[]> = {};
    
    users.forEach(u => {
        const dept = getDepartmentInfo(u).name;
        if (!groups[dept]) {
            groups[dept] = [];
        }
        groups[dept].push(u);
    });

    return groups;
};
