# SYSTEM ARCHITECTURE & DATABASE DESIGN
## Interior Design Project Management System

---

## 1. SYSTEM ARCHITECTURE

### 1.1 Three-Tier Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                       │
│                         (React.js)                           │
├─────────────────────────────────────────────────────────────┤
│  - Super Admin Dashboard    - Project Head Dashboard        │
│  - Admin Dashboard          - Site Engineer Dashboard       │
│  - Accountant Dashboard     - Shared Components             │
│  - Authentication UI        - Reports & Analytics           │
└─────────────────────────────────────────────────────────────┘
                            ↕ (REST API Calls)
┌─────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                       │
│                           (PHP)                              │
├─────────────────────────────────────────────────────────────┤
│  - Authentication Service   - Notification Service           │
│  - User Management         - Report Generation Service      │
│  - Project Management      - PDF Generation Service         │
│  - Client & Lead Mgmt      - Email Service                  │
│  - Finance Management      - File Upload Service            │
│  - Inventory Management    - Analytics Service              │
│  - Timeline Management     - Validation & Security          │
└─────────────────────────────────────────────────────────────┘
                            ↕ (SQL Queries)
┌─────────────────────────────────────────────────────────────┐
│                        DATA LAYER                            │
│                         (MySQL)                              │
├─────────────────────────────────────────────────────────────┤
│  - User Tables            - Finance Tables                   │
│  - Project Tables         - Inventory Tables                │
│  - Client/Lead Tables     - Report Tables                   │
│  - Team Tables            - Logs & Audit Tables             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. DETAILED DATABASE SCHEMA

### 2.1 Entity Relationship Diagram (ERD)

**Core Entities:**
1. Users (Super Admin, Admin, Accountant, Project Head, Site Engineer)
2. Clients (Converted from Leads)
3. Leads (Potential Clients)
4. Projects (Main entity)
5. Timeline (Project phases and tasks)
6. Vendors (Material/Service suppliers)
7. Inventory (Project-wise materials)
8. Expenses (Project costs)
9. Payments (Client payments)
10. Invoices (GST invoices to clients)

**Relationships:**
```
Users (1) ──creates──→ (M) Leads
Leads (1) ──converts_to──→ (1) Clients
Clients (1) ──has──→ (M) Projects
Projects (M) ──assigned_to──→ (M) Users (via project_assignments)
Projects (1) ──has──→ (M) Timeline Tasks
Projects (1) ──has──→ (M) Inventory Items
Projects (1) ──has──→ (M) Expenses
Projects (1) ──has──→ (M) Payments
Projects (1) ──has──→ (M) Invoices
Vendors (1) ──supplies──→ (M) Inventory
Vendors (1) ──receives──→ (M) Expenses
Inventory (1) ──has──→ (M) Inventory Usage
Users (1) ──records──→ (M) Attendance
Users (1) ──applies──→ (M) Leaves
```

---

### 2.2 TABLE DEFINITIONS

#### TABLE: users
```sql
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('super_admin', 'admin', 'accountant', 'project_head', 'site_engineer') NOT NULL,
    phone VARCHAR(20),
    employee_id VARCHAR(20) UNIQUE,
    profile_photo VARCHAR(255),
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_role (role),
    INDEX idx_status (status),
    INDEX idx_email (email)
);
```

#### TABLE: leads
```sql
CREATE TABLE leads (
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
```

#### TABLE: clients
```sql
CREATE TABLE clients (
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
```

#### TABLE: projects
```sql
CREATE TABLE projects (
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
```

#### TABLE: project_assignments
```sql
CREATE TABLE project_assignments (
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
```

#### TABLE: project_timeline
```sql
CREATE TABLE project_timeline (
    timeline_id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    task_name VARCHAR(200) NOT NULL,
    task_category ENUM('site_prep', 'demolition', 'civil', 'electrical', 'plumbing', 
                       'carpentry', 'painting', 'flooring', 'finishing', 'handover'),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    duration_days INT GENERATED ALWAYS AS (DATEDIFF(end_date, start_date) + 1) STORED,
    assigned_to INT,
    dependencies JSON,
    status ENUM('not_started', 'in_progress', 'completed', 'delayed') DEFAULT 'not_started',
    completion_percentage INT DEFAULT 0,
    actual_start_date DATE,
    actual_end_date DATE,
    notes TEXT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(user_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    INDEX idx_project_status (project_id, status),
    INDEX idx_dates (start_date, end_date),
    INDEX idx_assigned_to (assigned_to)
);
```

#### TABLE: vendors
```sql
CREATE TABLE vendors (
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
```

#### TABLE: inventory
```sql
CREATE TABLE inventory (
    inventory_id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    material_category VARCHAR(50) NOT NULL,
    item_name VARCHAR(200) NOT NULL,
    opening_stock DECIMAL(10, 2) DEFAULT 0,
    purchased_quantity DECIMAL(10, 2) NOT NULL,
    used_quantity DECIMAL(10, 2) DEFAULT 0,
    current_stock DECIMAL(10, 2) GENERATED ALWAYS AS (opening_stock + purchased_quantity - used_quantity) STORED,
    unit VARCHAR(20) NOT NULL,
    rate_per_unit DECIMAL(10, 2) NOT NULL,
    total_amount DECIMAL(12, 2) GENERATED ALWAYS AS (purchased_quantity * rate_per_unit) STORED,
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
```

#### TABLE: inventory_usage
```sql
CREATE TABLE inventory_usage (
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
```

#### TABLE: expenses
```sql
CREATE TABLE expenses (
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
```

#### TABLE: project_budget
```sql
CREATE TABLE project_budget (
    budget_id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    category ENUM('material', 'labor', 'transportation', 'overhead', 'contingency') NOT NULL,
    allocated_amount DECIMAL(12, 2) NOT NULL,
    spent_amount DECIMAL(12, 2) DEFAULT 0,
    remaining_amount DECIMAL(12, 2) GENERATED ALWAYS AS (allocated_amount - spent_amount) STORED,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    UNIQUE KEY unique_project_category (project_id, category),
    INDEX idx_project_id (project_id)
);
```

#### TABLE: client_payments
```sql
CREATE TABLE client_payments (
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
```

#### TABLE: invoices
```sql
CREATE TABLE invoices (
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
```

#### TABLE: invoice_items
```sql
CREATE TABLE invoice_items (
    item_id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id INT NOT NULL,
    description TEXT NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    rate DECIMAL(10, 2) NOT NULL,
    taxable_amount DECIMAL(12, 2) GENERATED ALWAYS AS (quantity * rate) STORED,
    gst_percentage DECIMAL(5, 2) NOT NULL,
    gst_amount DECIMAL(12, 2) GENERATED ALWAYS AS ((quantity * rate * gst_percentage) / 100) STORED,
    total_amount DECIMAL(12, 2) GENERATED ALWAYS AS (quantity * rate + ((quantity * rate * gst_percentage) / 100)) STORED,
    FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id) ON DELETE CASCADE,
    INDEX idx_invoice_id (invoice_id)
);
```

#### TABLE: quotations
```sql
CREATE TABLE quotations (
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
```

#### TABLE: quotation_items
```sql
CREATE TABLE quotation_items (
    item_id INT AUTO_INCREMENT PRIMARY KEY,
    quotation_id INT NOT NULL,
    description TEXT NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    rate DECIMAL(10, 2) NOT NULL,
    amount DECIMAL(12, 2) GENERATED ALWAYS AS (quantity * rate) STORED,
    FOREIGN KEY (quotation_id) REFERENCES quotations(quotation_id) ON DELETE CASCADE,
    INDEX idx_quotation_id (quotation_id)
);
```

#### TABLE: attendance
```sql
CREATE TABLE attendance (
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
```

#### TABLE: leaves
```sql
CREATE TABLE leaves (
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
```

#### TABLE: notifications
```sql
CREATE TABLE notifications (
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
```

#### TABLE: activity_logs
```sql
CREATE TABLE activity_logs (
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
```

#### TABLE: system_settings
```sql
CREATE TABLE system_settings (
    setting_id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    description TEXT,
    updated_by INT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by) REFERENCES users(user_id),
    INDEX idx_setting_key (setting_key)
);
```

---

## 3. DATA FLOW DIAGRAMS

### 3.1 Lead to Project Flow
```
[Accountant] 
    ↓ (Enter Lead)
[Lead Table]
    ↓ (Send Proposal)
[Quotation Generated]
    ↓ (Client Accepts)
[Lead Status: Converted]
    ↓ (Auto-create)
[Client Table]
    ↓ (Admin Creates)
[Project Table]
    ↓ (Assign Team)
[Project Assignments]
    ↓ (Set Budget)
[Project Budget]
    ↓ (Add Timeline)
[Timeline Table]
```

### 3.2 Payment & Invoice Flow
```
[Project Created] → [Payment Milestone Defined]
                          ↓
        [Work Progress] → [Milestone Reached]
                          ↓
      [Accountant] → [Generate Invoice] → [Invoice Table]
                          ↓
               [Send to Client]
                          ↓
              [Client Pays]
                          ↓
     [Record Payment] → [Client Payments Table]
                          ↓
         [Update Invoice Status: Paid]
                          ↓
   [Update Project: Advance Received/Total Received]
```

### 3.3 Inventory Flow
```
[Project Created]
        ↓
[Accountant Purchases Materials]
        ↓
[Inventory Table] (project_id linked)
        ↓
[Site Engineer at Site]
        ↓
[Uses Materials] → [Inventory Usage Table]
        ↓
[Inventory.used_quantity Updated]
        ↓
[Inventory.current_stock Auto-calculated]
        ↓
[Low Stock Alert if < 10%]
```

### 3.4 Timeline Tracking Flow
```
[Project Head Creates Timeline]
        ↓
[Timeline Tasks Created] (status: not_started)
        ↓
[Site Engineer Assigned]
        ↓
[Site Engineer MLivincarts: In Progress]
        ↓
[Daily Updates: Completion %]
        ↓
[Upload Progress Photos]
        ↓
[Site Engineer MLivincarts: Completed]
        ↓
[Timeline Task Status: Completed]
        ↓
[Project Completion % Auto-updated]
        ↓
[Next Task Auto-triggered (if dependency)]
```

---

## 4. SECURITY ARCHITECTURE

### 4.1 Authentication Flow
```
[User Login] → [Email + Password]
      ↓
[Backend Validation]
      ↓
[Password Hash Match?]
      ↓ (Yes)
[Generate JWT Token]
      ↓
[Return Token + User Data]
      ↓
[Frontend Stores Token in localStorage]
      ↓
[Include Token in All API Requests]
      ↓
[Backend Validates Token]
      ↓
[Check Role-Based Permissions]
      ↓
[Execute Request or Return 403]
```

### 4.2 Role-Based Access Matrix

| Feature                  | Super Admin | Admin | Accountant | Project Head | Site Engineer |
|--------------------------|-------------|-------|------------|--------------|---------------|
| Add/Delete Users         | ✓           | ✓*    | ✗          | ✗            | ✗             |
| View All Projects        | ✓           | ✓     | ✓          | Assigned     | Assigned      |
| Create Projects          | ✓           | ✓     | ✗          | ✗            | ✗             |
| Assign Team              | ✓           | ✓     | ✗          | ✗            | ✗             |
| Add Leads                | ✓           | ✓     | ✓          | ✗            | ✗             |
| Manage Vendors           | ✓           | ✓     | ✓          | ✗            | ✗             |
| Add Inventory            | ✓           | ✓     | ✓          | ✗            | ✗             |
| Record Inventory Usage   | ✓           | ✓     | ✓          | ✓            | ✓             |
| Add Expenses             | ✓           | ✓     | ✓          | Request      | Request       |
| Approve Expenses         | ✓           | ✓     | ✓          | ✗            | ✗             |
| Record Payments          | ✓           | ✓     | ✓          | ✗            | ✗             |
| Generate Invoices        | ✓           | ✓     | ✓          | ✗            | ✗             |
| Create Timeline          | ✓           | ✓     | ✗          | ✓            | ✗             |
| Update Timeline Tasks    | ✓           | ✓     | ✗          | ✓            | ✓             |
| MLivincart Attendance          | ✓           | ✓     | ✓          | ✓            | Self          |
| View Financial Reports   | ✓           | ✓     | ✓          | Project-wise | ✗             |
| System Settings          | ✓           | ✗     | ✗          | ✗            | ✗             |

*Admin can add/delete all except Super Admin

---

## 5. FILE STORAGE STRUCTURE

```
/project-root/
│
├── /public/
│   ├── index.html
│   └── /assets/
│       ├── /images/
│       └── /css/
│
├── /src/ (React Frontend)
│   ├── /components/
│   │   ├── /auth/
│   │   ├── /dashboard/
│   │   ├── /projects/
│   │   ├── /clients/
│   │   ├── /team/
│   │   ├── /finance/
│   │   ├── /inventory/
│   │   └── /reports/
│   ├── /services/
│   │   └── api.js
│   ├── /utils/
│   ├── /redux/ (or /context/)
│   ├── App.js
│   └── index.js
│
├── /api/ (PHP Backend)
│   ├── /config/
│   │   ├── database.php
│   │   └── constants.php
│   ├── /controllers/
│   │   ├── AuthController.php
│   │   ├── UserController.php
│   │   ├── ProjectController.php
│   │   ├── ClientController.php
│   │   ├── InventoryController.php
│   │   ├── FinanceController.php
│   │   └── ReportController.php
│   ├── /models/
│   │   ├── User.php
│   │   ├── Project.php
│   │   ├── Client.php
│   │   └── ...
│   ├── /middleware/
│   │   ├── AuthMiddleware.php
│   │   └── RoleMiddleware.php
│   ├── /services/
│   │   ├── PDFService.php
│   │   ├── EmailService.php
│   │   └── NotificationService.php
│   ├── /routes/
│   │   └── api.php
│   └── index.php
│
├── /uploads/
│   ├── /profiles/
│   ├── /bills/
│   ├── /receipts/
│   ├── /site_photos/
│   └── /documents/
│
├── /generated/
│   ├── /invoices/
│   ├── /quotations/
│   └── /reports/
│
└── /database/
    ├── schema.sql
    ├── seed_data.sql
    └── migrations/
```

---

## 6. API RESPONSE FORMATS

### 6.1 Success Response
```json
{
    "success": true,
    "message": "Operation successful",
    "data": {
        // Response data
    },
    "timestamp": "2026-04-18T10:30:00Z"
}
```

### 6.2 Error Response
```json
{
    "success": false,
    "message": "Error description",
    "errors": {
        "field_name": ["Error message 1", "Error message 2"]
    },
    "timestamp": "2026-04-18T10:30:00Z"
}
```

### 6.3 Pagination Response
```json
{
    "success": true,
    "data": [...],
    "pagination": {
        "current_page": 1,
        "per_page": 25,
        "total_records": 250,
        "total_pages": 10,
        "has_next": true,
        "has_prev": false
    }
}
```

---

## 7. BACKUP & DISASTER RECOVERY

### 7.1 Backup Strategy
```
Daily Automated Backup:
    ├── Database Dump (SQL file)
    ├── Uploads folder (incremental)
    └── Generated files (full)

Weekly Full Backup:
    └── Entire application + database

Monthly Archive:
    └── Compress and store off-site
```

### 7.2 Backup Retention
- Daily backups: 7 days
- Weekly backups: 4 weeks
- Monthly backups: 12 months
- Yearly backups: Indefinite

### 7.3 Recovery Procedure
1. Restore database from latest backup
2. Restore uploaded files
3. Verify data integrity
4. Test critical functions
5. Notify users of restoration

---

## 8. PERFORMANCE OPTIMIZATION

### 8.1 Database Optimization
- Proper indexing on frequently queried columns
- Composite indexes for multi-column queries
- Avoid SELECT *; specify columns
- Use LIMIT for large result sets
- Regular ANALYZE and OPTIMIZE TABLE
- Connection pooling

### 8.2 Frontend Optimization
- Code splitting with React.lazy()
- Memoization with React.memo
- Virtual scrolling for large lists
- Image lazy loading
- Minification and compression
- CDN for static assets

### 8.3 Backend Optimization
- Query caching
- Response caching (Redis optional)
- Pagination for large datasets
- Async operations for heavy tasks
- Database query optimization
- Proper error handling

### 8.4 Caching Strategy
```
Level 1: Browser Cache (Static assets)
    ├── Images: 30 days
    ├── CSS/JS: 7 days
    └── HTML: No cache

Level 2: Application Cache (API responses)
    ├── Dashboard data: 5 minutes
    ├── Reports: 1 hour
    └── Static data: 24 hours

Level 3: Database Query Cache
    └── SELECT queries: MySQL query cache
```

---

## 9. DEPLOYMENT CHECKLIST

### 9.1 Pre-Deployment
- [ ] All features tested
- [ ] Security audit completed
- [ ] Database backup taken
- [ ] SSL certificate installed
- [ ] Domain DNS configured
- [ ] Environment variables set
- [ ] Error logging configured
- [ ] Email service tested

### 9.2 Deployment Steps
1. Upload files to server
2. Import database schema
3. Configure database connection
4. Set file permissions (755 for folders, 644 for files)
5. Configure .htaccess (if Apache)
6. Test API endpoints
7. Build React production bundle
8. Deploy frontend
9. Test complete workflows
10. Enable SSL/HTTPS
11. Configure automated backups
12. Set up monitoring

### 9.3 Post-Deployment
- [ ] User training conducted
- [ ] Documentation provided
- [ ] Support channels established
- [ ] Monitoring active
- [ ] Backup verification
- [ ] Performance baseline recorded
- [ ] Feedback mechanism in place

---

**END OF DOCUMENT**
