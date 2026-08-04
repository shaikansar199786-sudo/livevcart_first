-- Livincart Interior Project Management System Database Schema

CREATE DATABASE IF NOT EXISTS Livincart_pm_system;
USE Livincart_pm_system;

-- TABLE: users
CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('principal_architect', 'admin', 'accountant', 'project_head', 'site_engineer') NOT NULL,
    phone VARCHAR(20),
    employee_id VARCHAR(20) UNIQUE,
    profile_photo VARCHAR(255),
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_role (role),
    INDEX idx_status (status),
    INDEX idx_username (username)
);

-- TABLE: leads
CREATE TABLE IF NOT EXISTS leads (
    lead_id INT AUTO_INCREMENT PRIMARY KEY,
    lead_source ENUM('walk_in', 'reference', 'website', 'social_media', 'advertisement') NOT NULL,
    client_name VARCHAR(100) NOT NULL,
    contact_number VARCHAR(20) NOT NULL,
    email VARCHAR(100),
    location TEXT,
    project_type ENUM('residential_interior', 'commercial_interior', 'architecture', 'landscape'),
    estimated_budget DECIMAL(12, 2),
    expected_start_date DATE,
    status ENUM('enquiry', 'proposal_sent', 'converted', 'won', 'lost') DEFAULT 'enquiry',
    follow_up_date DATE,
    assigned_to INT,
    notes TEXT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (assigned_to) REFERENCES users(user_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    INDEX idx_status (status),
    INDEX idx_created_by (created_by),
    INDEX idx_assigned_to (assigned_to)
);

-- TABLE: clients
CREATE TABLE IF NOT EXISTS clients (
    client_id INT AUTO_INCREMENT PRIMARY KEY,
    client_code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20) NOT NULL,
    address TEXT,
    city VARCHAR(50),
    state VARCHAR(50),
    pincode VARCHAR(10),
    gst_number VARCHAR(20),
    lead_source ENUM('walk_in', 'reference', 'website', 'social_media', 'advertisement'),
    converted_from_lead_id INT,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (converted_from_lead_id) REFERENCES leads(lead_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    INDEX idx_client_code (client_code),
    INDEX idx_status (status)
);

-- TABLE: projects
CREATE TABLE IF NOT EXISTS projects (
    project_id INT AUTO_INCREMENT PRIMARY KEY,
    project_code VARCHAR(20) UNIQUE NOT NULL,
    project_name VARCHAR(200) NOT NULL,
    client_id INT NOT NULL,
    project_type ENUM('interior', 'architecture', 'both'),
    site_address TEXT,
    start_date DATE NOT NULL,
    expected_end_date DATE NOT NULL,
    actual_end_date DATE,
    total_budget DECIMAL(15, 2) NOT NULL,
    advance_received DECIMAL(15, 2) DEFAULT 0,
    current_stage ENUM('concept', 'design', 'execution', 'handover') DEFAULT 'concept',
    status ENUM('active', 'on_hold', 'completed', 'cancelled') DEFAULT 'active',
    priority ENUM('high', 'medium', 'low') DEFAULT 'medium',
    completion_percentage INT DEFAULT 0,
    project_head_id INT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(client_id),
    FOREIGN KEY (project_head_id) REFERENCES users(user_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    INDEX idx_project_code (project_code),
    INDEX idx_client_id (client_id),
    INDEX idx_status (status),
    INDEX idx_project_head_id (project_head_id),
    INDEX idx_dates (start_date, expected_end_date)
);

-- TABLE: project_assignments
CREATE TABLE IF NOT EXISTS project_assignments (
    assignment_id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    user_id INT NOT NULL,
    role ENUM('project_head', 'site_engineer') NOT NULL,
    assigned_date DATE NOT NULL,
    unassigned_date DATE,
    status ENUM('active', 'inactive') DEFAULT 'active',
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    INDEX idx_project_user (project_id, user_id),
    INDEX idx_user_active (user_id, status)
);

-- TABLE: project_timeline_master (Stores main container)
CREATE TABLE IF NOT EXISTS project_timeline_master (
    timeline_id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days INT GENERATED ALWAYS AS (DATEDIFF(end_date, start_date) + 1) STORED,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    UNIQUE KEY unique_project_timeline (project_id)
);

-- TABLE: project_timeline_dates (One row per day - auto-generated)
CREATE TABLE IF NOT EXISTS project_timeline_dates (
    date_id INT AUTO_INCREMENT PRIMARY KEY,
    timeline_id INT NOT NULL,
    project_id INT NOT NULL,
    timeline_date DATE NOT NULL,
    day_number INT NOT NULL,
    day_name VARCHAR(10) NOT NULL,
    is_working_day BOOLEAN DEFAULT TRUE,
    date_status ENUM('upcoming', 'current', 'past') DEFAULT 'upcoming',
    has_tasks BOOLEAN DEFAULT FALSE,
    tasks_count INT DEFAULT 0,
    completed_tasks INT DEFAULT 0,
    overdue_tasks INT DEFAULT 0,
    FOREIGN KEY (timeline_id) REFERENCES project_timeline_master(timeline_id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
    UNIQUE KEY unique_project_date (project_id, timeline_date),
    INDEX idx_timeline_date (timeline_id, timeline_date),
    INDEX idx_project_date (project_id, timeline_date)
);

-- TABLE: project_timeline_tasks (Tasks assigned by Project Head)
CREATE TABLE IF NOT EXISTS project_timeline_tasks (
    task_id INT AUTO_INCREMENT PRIMARY KEY,
    timeline_id INT NOT NULL,
    project_id INT NOT NULL,
    task_name VARCHAR(200) NOT NULL,
    task_description TEXT,
    task_category ENUM('site_prep', 'demolition', 'civil', 'electrical', 'plumbing', 
                       'carpentry', 'painting', 'flooring', 'finishing', 'handover', 'other') NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    duration_days INT GENERATED ALWAYS AS (DATEDIFF(end_date, start_date) + 1) STORED,
    assigned_to INT NOT NULL,
    assigned_by INT NOT NULL,
    priority ENUM('high', 'medium', 'low') DEFAULT 'medium',
    status ENUM('not_started', 'in_progress', 'completed', 'overdue', 'completed_late') DEFAULT 'not_started',
    completion_percentage INT DEFAULT 0,
    is_overdue BOOLEAN DEFAULT FALSE,
    overdue_since DATE NULL,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (timeline_id) REFERENCES project_timeline_master(timeline_id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(user_id),
    FOREIGN KEY (assigned_by) REFERENCES users(user_id),
    INDEX idx_project_status (project_id, status),
    INDEX idx_timeline_dates (timeline_id, start_date, end_date),
    INDEX idx_assigned_to (assigned_to),
    INDEX idx_overdue (is_overdue, overdue_since)
);

-- TABLE: project_timeline_updates (Audit trail)
CREATE TABLE IF NOT EXISTS project_timeline_updates (
    update_id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL,
    project_id INT NOT NULL,
    updated_by INT NOT NULL,
    update_type ENUM('started', 'progress', 'completed', 'note_added', 'photo_uploaded', 
                     'mLivincarted_overdue', 'status_changed') NOT NULL,
    old_status VARCHAR(50),
    new_status VARCHAR(50),
    completion_percentage INT,
    notes TEXT,
    photo_path VARCHAR(255),
    update_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES project_timeline_tasks(task_id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
    FOREIGN KEY (updated_by) REFERENCES users(user_id),
    INDEX idx_task_updates (task_id, update_timestamp),
    INDEX idx_project_updates (project_id, update_timestamp)
);

-- TABLE: timeline_task_photos
CREATE TABLE IF NOT EXISTS timeline_task_photos (
    photo_id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL,
    project_id INT NOT NULL,
    photo_path VARCHAR(255) NOT NULL,
    caption TEXT,
    uploaded_by INT NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES project_timeline_tasks(task_id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(user_id),
    INDEX idx_task_photos (task_id)
);

-- TABLE: vendors
CREATE TABLE IF NOT EXISTS vendors (
    vendor_id INT AUTO_INCREMENT PRIMARY KEY,
    vendor_code VARCHAR(20) UNIQUE NOT NULL,
    vendor_name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(100),
    address TEXT,
    gst_number VARCHAR(20),
    payment_terms_days INT DEFAULT 30,
    bank_details JSON,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    INDEX idx_vendor_code (vendor_code),
    INDEX idx_category (category),
    INDEX idx_status (status)
);

-- TABLE: inventory
CREATE TABLE IF NOT EXISTS inventory (
    inventory_id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    material_category VARCHAR(50) NOT NULL,
    item_name VARCHAR(200) NOT NULL,
    opening_stock DECIMAL(10, 2) DEFAULT 0,
    purchased_quantity DECIMAL(10, 2) NOT NULL,
    used_quantity DECIMAL(10, 2) DEFAULT 0,
    current_stock DECIMAL(10, 2) AS (opening_stock + purchased_quantity - used_quantity),
    unit VARCHAR(20) NOT NULL,
    rate_per_unit DECIMAL(10, 2) NOT NULL,
    total_amount DECIMAL(12, 2) AS (purchased_quantity * rate_per_unit),
    vendor_id INT,
    purchase_date DATE NOT NULL,
    bill_number VARCHAR(50),
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
    FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    INDEX idx_project_category (project_id, material_category),
    INDEX idx_current_stock (current_stock)
);

-- TABLE: inventory_usage
CREATE TABLE IF NOT EXISTS inventory_usage (
    usage_id INT AUTO_INCREMENT PRIMARY KEY,
    inventory_id INT NOT NULL,
    project_id INT NOT NULL,
    quantity_used DECIMAL(10, 2) NOT NULL,
    usage_date DATE NOT NULL,
    used_by INT NOT NULL,
    location_used VARCHAR(200),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inventory_id) REFERENCES inventory(inventory_id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
    FOREIGN KEY (used_by) REFERENCES users(user_id),
    INDEX idx_inventory_date (inventory_id, usage_date),
    INDEX idx_project_date (project_id, usage_date)
);

-- TABLE: expenses
CREATE TABLE IF NOT EXISTS expenses (
    expense_id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    expense_category ENUM('material', 'contractor', 'transportation', 'site_costs', 
                          'equipment', 'miscellaneous') NOT NULL,
    vendor_id INT,
    amount DECIMAL(12, 2) NOT NULL,
    payment_mode ENUM('cash', 'cheque', 'neft', 'upi', 'card') NOT NULL,
    payment_date DATE NOT NULL,
    bill_number VARCHAR(50),
    bill_document_path VARCHAR(255),
    description TEXT,
    approved_by INT,
    status ENUM('pending', 'approved', 'paid') DEFAULT 'pending',
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
    FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id),
    FOREIGN KEY (approved_by) REFERENCES users(user_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    INDEX idx_project_category (project_id, expense_category),
    INDEX idx_status (status),
    INDEX idx_payment_date (payment_date)
);

-- TABLE: project_budget
CREATE TABLE IF NOT EXISTS project_budget (
    budget_id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    category ENUM('material', 'labor', 'transportation', 'overhead', 'contingency') NOT NULL,
    allocated_amount DECIMAL(12, 2) NOT NULL,
    spent_amount DECIMAL(12, 2) DEFAULT 0,
    remaining_amount DECIMAL(12, 2) AS (allocated_amount - spent_amount),
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    UNIQUE KEY unique_project_category (project_id, category),
    INDEX idx_project_id (project_id)
);

-- TABLE: client_payments
CREATE TABLE IF NOT EXISTS client_payments (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    client_id INT NOT NULL,
    payment_amount DECIMAL(12, 2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_mode ENUM('cash', 'cheque', 'neft', 'upi', 'card') NOT NULL,
    transaction_reference VARCHAR(100),
    payment_milestone VARCHAR(100),
    receipt_number VARCHAR(50),
    receipt_document_path VARCHAR(255),
    notes TEXT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES clients(client_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    INDEX idx_project_date (project_id, payment_date),
    INDEX idx_client_id (client_id)
);

-- TABLE: invoices
CREATE TABLE IF NOT EXISTS invoices (
    invoice_id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    project_id INT NOT NULL,
    client_id INT NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    subtotal DECIMAL(12, 2) NOT NULL,
    gst_amount DECIMAL(12, 2) NOT NULL,
    total_amount DECIMAL(12, 2) NOT NULL,
    amount_in_words VARCHAR(255),
    status ENUM('draft', 'sent', 'paid', 'overdue', 'cancelled') DEFAULT 'draft',
    payment_status ENUM('unpaid', 'partial', 'paid') DEFAULT 'unpaid',
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES clients(client_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    INDEX idx_invoice_number (invoice_number),
    INDEX idx_project_id (project_id),
    INDEX idx_status (status),
    INDEX idx_payment_status (payment_status)
);

-- TABLE: invoice_items
CREATE TABLE IF NOT EXISTS invoice_items (
    item_id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id INT NOT NULL,
    description TEXT NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    rate DECIMAL(10, 2) NOT NULL,
    taxable_amount DECIMAL(12, 2) AS (quantity * rate),
    gst_percentage DECIMAL(5, 2) NOT NULL,
    gst_amount DECIMAL(12, 2) AS ((quantity * rate * gst_percentage) / 100),
    total_amount DECIMAL(12, 2) AS (quantity * rate + ((quantity * rate * gst_percentage) / 100)),
    FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id) ON DELETE CASCADE,
    INDEX idx_invoice_id (invoice_id)
);

-- TABLE: quotations
CREATE TABLE IF NOT EXISTS quotations (
    quotation_id INT AUTO_INCREMENT PRIMARY KEY,
    quotation_number VARCHAR(50) UNIQUE NOT NULL,
    lead_id INT NOT NULL,
    client_name VARCHAR(100) NOT NULL,
    valid_until DATE NOT NULL,
    subtotal DECIMAL(12, 2) NOT NULL,
    gst_amount DECIMAL(12, 2) NOT NULL,
    total_amount DECIMAL(12, 2) NOT NULL,
    status ENUM('draft', 'sent', 'accepted', 'rejected') DEFAULT 'draft',
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(lead_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    INDEX idx_quotation_number (quotation_number),
    INDEX idx_lead_id (lead_id)
);

-- TABLE: quotation_items
CREATE TABLE IF NOT EXISTS quotation_items (
    item_id INT AUTO_INCREMENT PRIMARY KEY,
    quotation_id INT NOT NULL,
    description TEXT NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    rate DECIMAL(10, 2) NOT NULL,
    amount DECIMAL(12, 2) AS (quantity * rate),
    FOREIGN KEY (quotation_id) REFERENCES quotations(quotation_id) ON DELETE CASCADE,
    INDEX idx_quotation_id (quotation_id)
);

-- TABLE: attendance
CREATE TABLE IF NOT EXISTS attendance (
    attendance_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    project_id INT,
    date DATE NOT NULL,
    status ENUM('present', 'absent', 'half_day', 'leave') NOT NULL,
    check_in_time TIME,
    check_out_time TIME,
    notes TEXT,
    mLivincarted_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE SET NULL,
    FOREIGN KEY (mLivincarted_by) REFERENCES users(user_id),
    UNIQUE KEY unique_user_date (user_id, date),
    INDEX idx_user_date (user_id, date),
    INDEX idx_project_date (project_id, date)
);

-- TABLE: leaves
CREATE TABLE IF NOT EXISTS leaves (
    leave_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    leave_type ENUM('casual', 'sick', 'paid', 'unpaid') NOT NULL,
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    total_days INT NOT NULL,
    reason TEXT,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    approved_by INT,
    applied_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_on TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (approved_by) REFERENCES users(user_id),
    INDEX idx_user_status (user_id, status),
    INDEX idx_dates (from_date, to_date)
);

-- TABLE: notifications
CREATE TABLE IF NOT EXISTS notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    reference_id INT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_user_read (user_id, is_read),
    INDEX idx_created_at (created_at)
);

-- TABLE: activity_logs
CREATE TABLE IF NOT EXISTS activity_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    action VARCHAR(50) NOT NULL,
    module VARCHAR(50) NOT NULL,
    record_id INT,
    description TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    INDEX idx_user_module (user_id, module),
    INDEX idx_created_at (created_at)
);

-- TABLE: system_settings
CREATE TABLE IF NOT EXISTS system_settings (
    setting_id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    description TEXT,
    updated_by INT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by) REFERENCES users(user_id),
    INDEX idx_setting_key (setting_key)
);

-- TABLE: material_requests
CREATE TABLE IF NOT EXISTS material_requests (
    request_id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    item_name VARCHAR(200) NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    requested_by INT NOT NULL,
    approved_by INT,
    urgency ENUM('normal', 'high') DEFAULT 'normal',
    status ENUM('pending', 'approved', 'rejected', 'fulfilled') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
    FOREIGN KEY (requested_by) REFERENCES users(user_id),
    FOREIGN KEY (approved_by) REFERENCES users(user_id)
);

-- TABLE: finance_transactions
CREATE TABLE IF NOT EXISTS finance_transactions (
    transaction_id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT,
    type ENUM('credit', 'debit') NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT,
    transaction_date DATE NOT NULL,
    recorded_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE SET NULL,
    FOREIGN KEY (recorded_by) REFERENCES users(user_id)
);

-- TABLE: monthly_income
CREATE TABLE IF NOT EXISTS monthly_income (
    id INT AUTO_INCREMENT PRIMARY KEY,
    month_year VARCHAR(10) NOT NULL,
    category ENUM('elegance', 'Livincart', 'new_projects', 'major_expenditures') NOT NULL,
    description TEXT,
    amount DECIMAL(15, 2) DEFAULT 0,
    transaction_date DATE DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_month_year (month_year)
);