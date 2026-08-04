# Product Requirements Document (PRD)
## Interior Design & Architecture Project Management System

**Version:** 1.0  
**Date:** April 18, 2026  
**Document Type:** Complete Product Requirements  
**Tech Stack:** React (Frontend), PHP (Backend), MySQL Database, XAMPP Local Environment

---

## 1. EXECUTIVE SUMMARY

### 1.1 Product Overview
A comprehensive web-based project management system designed specifically for interior design and architecture firms. The system manages the complete lifecycle from lead generation to project completion, including client management, team allocation, inventory tracking, financial management, and timeline monitoring.

### 1.2 Core Philosophy
The application is an **all-in-one integrated system** that includes:
- **Projects** - Complete project lifecycle management
- **Finance** - Budget tracking, payments, expenses, GST invoicing
- **Team** - Staff allocation, workload distribution, attendance
- **Clients** - Lead tracking, conversion, proposal generation

### 1.3 Primary Objectives
- Track every drawing, rupee, task, and person related to a project
- Keep projects on schedule and within budget
- Ensure even distribution of workload across teams
- Track enquiries/leads and improve conversion rates
- Maintain project-wise financial records and inventory

---

## 2. USER ROLES & PERMISSIONS

### 2.1 Super Admin (Full Access)
**Capabilities:**
- Complete system access
- Add/Edit/Delete all users
- View all projects, finances, clients, and team data
- Access all analytics and reports
- System configuration and settings
- Can perform actions of all other roles

### 2.2 Admin / Principal Architect
**Capabilities:**
- Add/Edit/Delete users (except Super Admin)
- Assign Project Heads and Site Engineers to projects
- Add/Edit team members and staff
- View all projects and financial data
- Access all analytics and dashboards
- Approve major expenses and budgets
- Client proposal approval

### 2.3 Accountant
**Capabilities:**
- Enter and manage leads
- Create and manage client records
- Add advance payments and payment tracking
- Manage vendors (Add/Edit/Delete)
- Track expenses (material, contractor, transportation, site costs)
- Generate GST invoices
- Project-wise budgeting
- Project-wise balance sheets
- Client payment tracking
- Add initial inventory for projects
- View financial reports and analytics

### 2.4 Project Head
**Capabilities:**
- View assigned projects
- Monitor project timeline and milestones
- Track task completion
- Update project status
- View project budget and expenses
- Coordinate with Site Engineers
- Submit expense requests
- View project-wise inventory usage
- Update project progress
- Access project-specific analytics

### 2.5 Site Engineer
**Capabilities:**
- View assigned projects
- Update daily site progress
- MLivincart timeline tasks as complete
- Record inventory usage
- Add site expenses (requires approval)
- Upload site photos/documents
- Track attendance at site
- Submit daily/weekly reports
- MLivincart milestone completion

---

## 3. FUNCTIONAL REQUIREMENTS

### 3.1 USER MANAGEMENT

#### 3.1.1 User Creation & Authentication
**Requirements:**
- Super Admin and Admin can create new users
- User types: Super Admin, Admin/Principal Architect, Accountant, Project Head, Site Engineer
- Required fields:
  - Full Name
  - Email (unique, used for login)
  - Password (encrypted)
  - Role/User Type
  - Phone Number
  - Employee ID (auto-generated or manual)
  - Date of Joining
  - Status (Active/Inactive)
  - Profile Photo (optional)

**Features:**
- Email-based login system
- Password reset functionality
- Role-based dashboard on login
- Session management
- User listing with search/filter
- Bulk user import (CSV)
- User deactivation (soft delete)

#### 3.1.2 User Listing & Management
**Display Fields:**
- Employee ID, Name, Role, Email, Phone, Status, Date Joined
- Actions: Edit, Deactivate/Activate, View Details

**Filters:**
- By Role
- By Status (Active/Inactive)
- By Date Joined
- Search by Name/Email/Employee ID

---

### 3.2 CLIENT MANAGEMENT MODULE

#### 3.2.1 Lead Tracking
**Lead Entry Form (Accountant access):**
- Lead Source (Walk-in, Reference, Website, Social Media, Advertisement)
- Client Name
- Contact Number
- Email
- Location/Site Address
- Project Type (Residential Interior, Commercial Interior, Architecture, Landscape)
- Estimated Budget Range
- Expected Start Date
- Lead Status: Enquiry → Proposal Sent → Converted → Won/Lost
- Follow-up Date
- Notes/Comments
- Assigned To (Project Head/Architect for proposal)

**Lead Dashboard:**
- Total Leads
- Conversion Rate (%)
- Leads by Status (Enquiry, Proposal Sent, Converted, Won, Lost)
- Monthly new leads trend
- Lead source analysis

#### 3.2.2 Client Conversion
**When Lead Status = "Converted":**
- Automatically create Client Record
- Client gets unique Client ID
- Move to active clients list
- All lead details transferred to client profile

**Client Profile:**
- Client ID (auto-generated: CL001, CL002...)
- Personal Details (Name, Contact, Email, Address)
- Project Details
- Payment History
- Associated Projects
- Documents (Contracts, Proposals)
- Communication History

#### 3.2.3 Proposal & Quotation Generation
**Features:**
- Template-based quotation creation
- Line items with description, quantity, rate, amount
- Tax calculations (GST)
- Terms & Conditions
- Valid Until date
- PDF generation and download
- Email quotation directly to client
- Quotation versioning (revisions)

---

### 3.3 PROJECT MANAGEMENT MODULE

#### 3.3.1 Project Creation
**Project Creation Flow:**
1. Accountant creates client from converted lead
2. Admin/Principal Architect creates project for client
3. Assign Project Head
4. Assign Site Engineer(s)
5. Set initial budget
6. Add project timeline

**Project Form Fields:**
- Project ID (auto-generated: PRJ001, PRJ002...)
- Project Name
- Client ID (linked to client)
- Project Type (Interior/Architecture/Both)
- Site Address
- Start Date
- Expected Completion Date
- Total Budget
- Advance Received
- Project Stage: Concept → Design → Execution → Handover
- Status: Active, On Hold, Completed, Cancelled
- Priority (High/Medium/Low)

#### 3.3.2 Project Dashboard (Per Project)
**Display Components:**
- Project Overview Card
  - Project Name, Client Name, Project ID
  - Current Stage and Status
  - Start Date and Expected Completion
  - Days Elapsed / Days Remaining
  - Completion Percentage

- **Budget Summary:**
  - Total Budget: ₹XX,XX,XXX
  - Advance Received: ₹XX,XXX
  - Total Expenses: ₹XX,XXX
  - Balance: ₹XX,XXX (Green if positive, Red if negative)
  - Pending Payments: ₹XX,XXX

- **Team Assigned:**
  - Project Head: Name with photo
  - Site Engineer(s): Names with photos
  - Contact buttons

- **Timeline Progress:**
  - Visual Gantt chart showing phases
  - Current phase highlighted
  - Delayed tasks in red
  - Completed tasks in green

#### 3.3.3 Phase-wise Tracking
**Phases (Customizable per project):**
1. Concept Development
2. Design & Drawings
3. Client Approval
4. Execution Phase
   - Civil Work
   - Electrical Work
   - Plumbing Work
   - Carpentry
   - Painting
   - Finishing
4. Handover

**For Each Phase:**
- Phase Name
- Planned Start Date
- Planned End Date
- Actual Start Date
- Actual End Date
- Status: Not Started, In Progress, Completed, Delayed
- Completion %
- Assigned To
- Notes/Updates

#### 3.3.4 Timeline / Gantt Chart

**Based on Image 3 - Timeline Requirements:**
Timeline should show detailed interior works schedule similar to the template provided.

**Timeline Features:**
- Visual Gantt chart representation
- Date range selector (weekly/monthly view)
- Tasks include:
  - **Site Preparation**
    - Site cleaning
    - Measurements and mLivincarting
  - **Electrical Works**
    - Wiring layout
    - Switch board installation
    - Light and fan points
  - **Plumbing Works**
    - Pipeline laying
    - Drainage system
    - Fixture installation
  - **Civil Works**
    - Wall construction/demolition
    - Flooring preparation
    - Plastering
  - **Carpentry**
    - False ceiling
    - Kitchen cabinets
    - Wardrobes
    - TV unit and furniture
  - **Painting**
    - Primer
    - Putty
    - Final coats
  - **Finishing Works**
    - Tiling
    - Flooring installation
    - Hardware fitting
    - Cleaning
  - **Handover**

**For Each Timeline Task:**
- Task Name
- Start Date
- End Date
- Duration (auto-calculated in days)
- Assigned To (Site Engineer/Contractor)
- Dependencies (which tasks must complete before this starts)
- Status: Not Started, In Progress, Completed, Delayed
- Completion %
- Can be mLivincarted complete by Site Engineer

**Timeline Visualization:**
- Horizontal bar chart with dates on X-axis
- Tasks on Y-axis
- Color coding:
  - Blue: Not Started
  - Yellow: In Progress
  - Green: Completed
  - Red: Delayed (past end date but not complete)
- Milestone mLivincarters
- Today's date indicator line
- Drag to adjust dates (Admin/Project Head only)

**Site Engineer Timeline Interaction:**
- View timeline for assigned projects
- MLivincart tasks as started
- Update completion percentage
- MLivincart tasks as completed
- Add notes/comments to tasks
- Upload progress photos

#### 3.3.5 Task Assignment & Tracking
**Task Management:**
- Create tasks within project phases
- Assign to team members
- Set due dates
- Priority levels
- Task status tracking
- Task completion checklist
- File attachments
- Comments/discussion thread

---

### 3.4 TEAM MANAGEMENT MODULE

#### 3.4.1 Staff Allocation Per Project
**Features:**
- Assign Project Head to each project
- Assign one or more Site Engineers
- View staff allocation across all projects
- Workload visualization per team member
- Reassign staff when needed

**Staff Allocation View:**
- Table showing:
  - Staff Name
  - Role
  - Current Projects Assigned
  - Workload % (based on number of projects)
  - Availability Status

#### 3.4.2 Workload Tracking
**Objective:** Ensure even distribution of work load across teams

**Features:**
- Visual workload dashboard
- Projects per team member
- Overloaded team members highlighted (>3 projects = red alert)
- Under-utilized team members (0-1 projects = green)
- Workload balancing recommendations

**Display:**
- Bar chart showing number of active projects per person
- Color coding: Green (<2), Yellow (2-3), Red (>3)
- Click to see project details

#### 3.4.3 Attendance + Leave Tracking
**Attendance System:**
- Daily attendance mLivincarting (Present/Absent/Half-day/Leave)
- Attendance by project site for Site Engineers
- Monthly attendance report
- Attendance percentage

**Leave Management:**
- Leave request submission
- Leave types: Casual, Sick, Paid, Unpaid
- Leave approval workflow
- Leave balance tracking
- Calendar view of leaves

---

### 3.5 MATERIAL & FINANCE MANAGEMENT MODULE

#### 3.5.1 Vendor Management
**Vendor Master:**
- Vendor ID (auto-generated: VEN001, VEN002...)
- Vendor Name
- Category (Electrical, Plumbing, Carpentry, Painting, Flooring, Hardware, Furniture, etc.)
- Contact Person
- Phone Number
- Email
- Address
- GST Number
- Payment Terms (Days)
- Bank Details
- Status (Active/Inactive)

**Vendor Listing:**
- Searchable and filterable table
- Filter by category
- Actions: Add, Edit, Delete, View Details

**Accountant Access:**
- Full CRUD operations on vendors
- Can add multiple vendors in same category
- Vendor-wise purchase history

#### 3.5.2 Inventory Management

**Inventory Structure:**
- **Each client/project has SEPARATE inventory**
- Materials purchased for Project A cannot be used in Project B without transfer entry
- Project-wise inventory tracking

**Inventory Entry (by Accountant):**
When project is created, accountant adds initial inventory:
- Material Category (Electrical, Plumbing, Civil, Carpentry, Painting, etc.)
- Item Name
- Quantity
- Unit (Pcs, Sq.ft, Kg, Liters, Bags, etc.)
- Rate per Unit
- Total Amount
- Vendor
- Purchase Date
- Bill/Invoice Number

**Inventory Items Examples:**
- **Electrical:** Wires, switches, sockets, lights, fans, MCBs
- **Plumbing:** Pipes, fittings, taps, fixtures, tanks
- **Civil:** Cement, sand, bricks, steel, aggregates
- **Carpentry:** Ply, wood, hardware, hinges, handles
- **Painting:** Primer, putty, paint, brushes, rollers
- **Flooring:** Tiles, marble, granite, wood flooring
- **Hardware:** Screws, nails, adhesives, tools

**Inventory Dashboard (Per Project):**
- List all inventory items for that project
- Columns: Item Name, Category, Opening Stock, Purchased Qty, Used Qty, Current Stock, Value
- Low stock alerts (when stock < 10% of purchased)
- Filter by category

**Inventory Usage (by Site Engineer):**
Site Engineer records daily usage:
- Select project
- Select item from inventory
- Enter quantity used
- Date of usage
- Notes (where used)
- This reduces current stock automatically

**Inventory Reports:**
- Project-wise inventory summary
- Category-wise consumption
- Material cost analysis
- Inventory valuation
- Usage vs Purchase comparison

#### 3.5.3 Expense Tracking

**Expense Categories:**
1. Material Expenses (from inventory purchases)
2. Contractor Payments (labor charges)
3. Transportation Costs
4. Site Costs (electricity, water, security)
5. Equipment Rental
6. Miscellaneous

**Expense Entry Form (Accountant/Project Head):**
- Project (dropdown)
- Expense Category
- Vendor/Contractor (if applicable)
- Amount
- Payment Mode (Cash/Cheque/NEFT/UPI)
- Payment Date
- Bill/Receipt Number
- Upload Bill Photo/PDF
- Description
- Approved By (for amounts > threshold)

**Site Engineer Expense Request:**
- Site engineers can request small expenses
- Goes to Project Head for approval
- Once approved, Accountant processes payment
- Auto-links to project expenses

**Expense Dashboard:**
- Project-wise expense breakdown
- Category-wise pie chart
- Monthly expense trend
- Vendor-wise payments
- Pending payments
- Expense vs Budget comparison

#### 3.5.4 Project-wise Budgeting
**Budget Allocation:**
- Total Project Budget
- Break down by category:
  - Material Budget
  - Labor Budget
  - Transportation Budget
  - Overhead Budget
  - Contingency Budget (10-15%)

**Budget Tracking:**
- Allocated Budget vs Actual Spent
- Category-wise budget utilization %
- Budget alerts (when spent > 80% of allocated)
- Remaining budget
- Visual progress bars for each category

**Budget Approval:**
- Admin approves initial budget
- Any budget increase requires Admin approval
- Budget revision history maintained

#### 3.5.5 GST Invoicing

**Invoice Generation:**
- Invoice Number (auto-generated: INV-001, INV-002...)
- Client Details (auto-filled from project)
- Company Details (pre-configured)
- Invoice Date
- Due Date
- Line Items:
  - Description
  - Quantity
  - Rate
  - Taxable Amount
  - GST % (5%, 12%, 18%, 28%)
  - GST Amount
  - Total Amount
- Sub-total
- Total GST (CGST + SGST or IGST)
- Grand Total
- Amount in Words
- Payment Terms
- Bank Details
- Signature

**Invoice Features:**
- PDF generation with company letterhead
- Email invoice to client
- Print invoice
- Invoice status: Draft, Sent, Paid, Overdue, Cancelled
- Payment recording against invoice
- Invoice listing and search

#### 3.5.6 Project-wise Balance Sheet

**Balance Sheet Components:**
- **Income:**
  - Total Project Value
  - Advance Received
  - Payment Milestones Received
  - Total Received to Date
  - Pending Receivables

- **Expenses:**
  - Material Costs
  - Labor Costs
  - Transportation
  - Site Costs
  - Equipment Rental
  - Miscellaneous
  - Total Expenses

- **Profit/Loss:**
  - Gross Profit = Total Received - Total Expenses
  - Expected Final Profit = Total Project Value - Total Expenses
  - Profit Margin %

**Visual Representation:**
- Income vs Expense bar chart
- Category-wise expense pie chart
- Cash flow timeline
- Profit projection

#### 3.5.7 Client Payment Tracking

**Payment Structure:**
- Advance Payment (% of total)
- Milestone-based payments:
  - After design approval
  - After 25% completion
  - After 50% completion
  - After 75% completion
  - Final payment after handover

**Payment Entry:**
- Project selection
- Payment Amount
- Payment Date
- Payment Mode (Cash/Cheque/NEFT/UPI)
- Transaction Reference
- Payment Milestone
- Receipt Number
- Upload Receipt/Proof
- Notes

**Payment Dashboard:**
- Total Project Value
- Total Received
- Pending Amount
- Payment Schedule (upcoming milestones)
- Payment history table
- Overdue payments highlighted

**Payment Reminders:**
- Auto-generate reminder for upcoming payments
- Overdue payment alerts
- Email/SMS reminders to clients

---

### 3.6 DASHBOARD AND ANALYTICS MODULE

#### 3.6.1 Super Admin / Admin Dashboard

**Overview Cards:**
- Total Active Projects
- Total Completed Projects
- Total Clients
- Total Revenue (this month)
- Pending Payments
- Active Team Members

**Project Status Widget:**
- Projects by Status: Not Started, In Progress, On Hold, Completed
- Donut chart representation
- Click to filter project list

**Project Status with Timeline:**
- List of all projects with timeline status
- Color coding:
  - Green: On schedule
  - Yellow: Minor delay (<1 week)
  - Red: Major delay (>1 week)
- Completion % progress bar
- Days remaining/overdue

**Monthly New Projects and Income:**
- Line chart showing:
  - Number of new projects per month (last 12 months)
  - Revenue per month
- Compare with previous year
- Growth percentage

**Design Projects Monthly Target:**
- Set monthly target for new projects
- Actual vs Target comparison
- Achievement percentage
- Visual gauge chart

**Monthly Income Projections:**
- Expected income from ongoing projects
- Payment milestones due this month
- Projected vs Actual income
- Forecast for next 3 months

**Work Load Distribution:**
- Horizontal bar chart showing:
  - Team member name
  - Number of projects assigned
  - Workload % (based on complexity)
- Identify overloaded/underutilized staff

**Financial Summary:**
- Total Revenue (All time)
- Revenue This Year
- Revenue This Month
- Total Expenses (All time)
- Expenses This Month
- Overall Profit Margin %
- Project-wise profitability ranking

**Recent Activities Feed:**
- New leads added
- Projects started
- Projects completed
- Payments received
- Milestones achieved
- Team assignments

#### 3.6.2 Accountant Dashboard

**Overview Cards:**
- Total Leads
- Converted Leads This Month
- Pending Payments
- Total Expenses This Month
- Vendors
- Low Stock Alerts

**Lead Funnel:**
- Visual funnel showing:
  - Total Enquiries
  - Proposals Sent
  - Negotiations
  - Won
  - Lost
- Conversion rate at each stage

**Payment Due List:**
- Projects with pending payments
- Due amount
- Due date
- Days overdue (if any)
- Quick payment entry button

**Expense Summary:**
- This Month Expenses
- Category-wise breakdown
- Vendor-wise payments
- Pending bill approvals

**Inventory Alerts:**
- Low stock items across all projects
- Stock below threshold
- Purchase recommendations

#### 3.6.3 Project Head Dashboard

**Overview Cards:**
- Projects Assigned
- Active Projects
- Projects On Schedule
- Projects Delayed
- Pending Tasks

**My Projects List:**
- Project Name
- Client Name
- Status
- Completion %
- Timeline Status (On time/Delayed)
- Quick view button

**Tasks Assigned to Me:**
- Pending tasks
- Due date
- Priority
- Project name
- MLivincart complete button

**Project Timeline Overview:**
- Gantt chart of all assigned projects
- Identify overlapping timelines
- Resource allocation view

**Team Performance:**
- Site Engineers under supervision
- Their task completion rate
- Attendance summary

#### 3.6.4 Site Engineer Dashboard

**Overview Cards:**
- Projects Assigned
- Tasks Pending
- Tasks Completed This Week
- Inventory Used Today

**My Projects:**
- List of assigned projects
- Current phase
- My pending tasks
- Quick update button

**Daily Tasks:**
- Tasks due today
- Tasks in progress
- Completed tasks
- MLivincart complete functionality

**Inventory Usage Entry:**
- Quick entry form
- Recent usage history
- Stock alerts

**Daily Report Submission:**
- Site progress notes
- Work completed today
- Issues/challenges
- Material requirements
- Photo upload
- Submit report

---

### 3.7 REPORTING MODULE

#### 3.7.1 Standard Reports

**Project Reports:**
- Project Summary Report
- Project Timeline Report
- Project Profitability Report
- Delayed Projects Report
- Project Completion Report

**Financial Reports:**
- Income Statement
- Expense Report (by category, by project, by vendor)
- Payment Collection Report
- Outstanding Payments Report
- GST Report
- Profit & Loss Statement
- Balance Sheet (per project)
- Cash Flow Report

**Client Reports:**
- Client List with Project History
- Lead Conversion Report
- Lead Source Analysis
- Client Payment History

**Team Reports:**
- Staff Allocation Report
- Workload Distribution Report
- Attendance Report
- Leave Report
- Performance Report (tasks completed)

**Inventory Reports:**
- Stock Summary Report
- Inventory Valuation Report
- Material Consumption Report
- Vendor-wise Purchase Report
- Stock Movement Report

**Dashboard Export:**
- All dashboards can be exported as PDF
- Scheduled email reports (daily/weekly/monthly)

#### 3.7.2 Custom Report Builder
- Select report type
- Choose date range
- Select filters
- Choose columns to display
- Generate report
- Export as PDF/Excel
- Save report template for reuse

---

## 4. TECHNICAL REQUIREMENTS

### 4.1 Technology Stack

**Frontend:**
- **React.js** (Latest stable version)
- React Router for navigation
- Redux or Context API for state management
- Axios for API calls
- Chart.js or Recharts for data visualization
- React-Bootstrap or Material-UI for UI components
- React-Datepicker for date selections
- React-Select for dropdowns
- React-Table for data grids
- React-PDF for PDF generation
- Formik + Yup for form validation
- React-Toastify for notifications

**Backend:**
- **PHP 8.x**
- RESTful API architecture
- JWT for authentication
- PDO for database connections
- FPDF or mPDF for server-side PDF generation
- PHPMailer for email functionality
- PHP Sessions for user sessions

**Database:**
- **MySQL 8.x**
- InnoDB storage engine
- Proper indexing for performance
- Foreign key constraints
- Database backup strategy

**Development Environment:**
- **XAMPP** (Apache + MySQL + PHP)
- Local development on Windows/Mac/Linux
- Version control: Git
- Code editor: VS Code

**Hosting Requirements:**
- Linux-based shared hosting or VPS
- PHP 8.x support
- MySQL database
- SSL certificate (HTTPS)
- Min 2GB RAM, 50GB storage
- Daily automated backups
- Domain name (already available as per requirement)

### 4.2 Database Schema (Key Tables)

**users**
- user_id (PK)
- name
- email (unique)
- password (hashed)
- role (super_admin, admin, accountant, project_head, site_engineer)
- phone
- employee_id
- profile_photo
- status (active/inactive)
- created_at
- updated_at

**clients**
- client_id (PK)
- client_code (CL001, CL002...)
- name
- email
- phone
- address
- city
- state
- pincode
- gst_number
- lead_source
- converted_from_lead_id (FK to leads table)
- status (active/inactive)
- created_by (FK to users)
- created_at
- updated_at

**leads**
- lead_id (PK)
- lead_source
- client_name
- contact_number
- email
- location
- project_type
- estimated_budget
- expected_start_date
- status (enquiry, proposal_sent, converted, won, lost)
- follow_up_date
- assigned_to (FK to users)
- notes
- created_by (FK to users)
- created_at
- updated_at

**projects**
- project_id (PK)
- project_code (PRJ001, PRJ002...)
- project_name
- client_id (FK to clients)
- project_type
- site_address
- start_date
- expected_end_date
- actual_end_date
- total_budget
- advance_received
- current_stage (concept, design, execution, handover)
- status (active, on_hold, completed, cancelled)
- priority (high, medium, low)
- completion_percentage
- project_head_id (FK to users)
- created_by (FK to users)
- created_at
- updated_at

**project_assignments**
- assignment_id (PK)
- project_id (FK to projects)
- user_id (FK to users)
- role (project_head, site_engineer)
- assigned_date
- unassigned_date
- status (active, inactive)

**project_timeline**
- timeline_id (PK)
- project_id (FK to projects)
- task_name
- task_category (civil, electrical, plumbing, carpentry, painting, finishing)
- start_date
- end_date
- duration_days
- assigned_to (FK to users)
- dependencies (JSON array of timeline_ids)
- status (not_started, in_progress, completed, delayed)
- completion_percentage
- notes
- created_by (FK to users)
- created_at
- updated_at
- completed_at

**vendors**
- vendor_id (PK)
- vendor_code (VEN001, VEN002...)
- vendor_name
- category
- contact_person
- phone
- email
- address
- gst_number
- payment_terms_days
- bank_details (JSON)
- status (active/inactive)
- created_by (FK to users)
- created_at
- updated_at

**inventory**
- inventory_id (PK)
- project_id (FK to projects)
- material_category
- item_name
- opening_stock
- purchased_quantity
- used_quantity
- current_stock
- unit
- rate_per_unit
- total_amount
- vendor_id (FK to vendors)
- purchase_date
- bill_number
- created_by (FK to users)
- created_at
- updated_at

**inventory_usage**
- usage_id (PK)
- inventory_id (FK to inventory)
- project_id (FK to projects)
- quantity_used
- usage_date
- used_by (FK to users - site engineer)
- location_used
- notes
- created_at

**expenses**
- expense_id (PK)
- project_id (FK to projects)
- expense_category (material, contractor, transportation, site_costs, equipment, miscellaneous)
- vendor_id (FK to vendors, nullable)
- amount
- payment_mode
- payment_date
- bill_number
- bill_document_path
- description
- approved_by (FK to users)
- status (pending, approved, paid)
- created_by (FK to users)
- created_at
- updated_at

**project_budget**
- budget_id (PK)
- project_id (FK to projects)
- category (material, labor, transportation, overhead, contingency)
- allocated_amount
- spent_amount
- remaining_amount
- created_by (FK to users)
- updated_at

**client_payments**
- payment_id (PK)
- project_id (FK to projects)
- client_id (FK to clients)
- payment_amount
- payment_date
- payment_mode
- transaction_reference
- payment_milestone
- receipt_number
- receipt_document_path
- notes
- created_by (FK to users)
- created_at

**invoices**
- invoice_id (PK)
- invoice_number (INV-001, INV-002...)
- project_id (FK to projects)
- client_id (FK to clients)
- invoice_date
- due_date
- subtotal
- gst_amount
- total_amount
- amount_in_words
- status (draft, sent, paid, overdue, cancelled)
- payment_status (unpaid, partial, paid)
- created_by (FK to users)
- created_at
- updated_at

**invoice_items**
- item_id (PK)
- invoice_id (FK to invoices)
- description
- quantity
- rate
- taxable_amount
- gst_percentage
- gst_amount
- total_amount

**attendance**
- attendance_id (PK)
- user_id (FK to users)
- project_id (FK to projects, nullable - for site engineers)
- date
- status (present, absent, half_day, leave)
- check_in_time
- check_out_time
- notes
- mLivincarted_by (FK to users)
- created_at

**leaves**
- leave_id (PK)
- user_id (FK to users)
- leave_type (casual, sick, paid, unpaid)
- from_date
- to_date
- total_days
- reason
- status (pending, approved, rejected)
- approved_by (FK to users)
- applied_on
- approved_on

**quotations**
- quotation_id (PK)
- quotation_number (QT-001, QT-002...)
- lead_id (FK to leads)
- client_name
- valid_until
- subtotal
- gst_amount
- total_amount
- status (draft, sent, accepted, rejected)
- created_by (FK to users)
- created_at
- updated_at

**quotation_items**
- item_id (PK)
- quotation_id (FK to quotations)
- description
- quantity
- rate
- amount

**notifications**
- notification_id (PK)
- user_id (FK to users)
- title
- message
- type (payment_due, task_due, budget_alert, timeline_delay, etc.)
- is_read
- created_at

**activity_logs**
- log_id (PK)
- user_id (FK to users)
- action (login, create, update, delete, etc.)
- module (project, client, expense, etc.)
- record_id
- description
- ip_address
- created_at

### 4.3 API Endpoints Structure

**Authentication:**
- POST /api/auth/login
- POST /api/auth/logout
- POST /api/auth/forgot-password
- POST /api/auth/reset-password

**Users:**
- GET /api/users (list all)
- GET /api/users/{id}
- POST /api/users (create)
- PUT /api/users/{id}
- DELETE /api/users/{id}
- PUT /api/users/{id}/status (activate/deactivate)

**Leads:**
- GET /api/leads
- GET /api/leads/{id}
- POST /api/leads
- PUT /api/leads/{id}
- DELETE /api/leads/{id}
- POST /api/leads/{id}/convert (convert to client)

**Clients:**
- GET /api/clients
- GET /api/clients/{id}
- POST /api/clients
- PUT /api/clients/{id}
- DELETE /api/clients/{id}

**Projects:**
- GET /api/projects
- GET /api/projects/{id}
- POST /api/projects
- PUT /api/projects/{id}
- DELETE /api/projects/{id}
- GET /api/projects/{id}/timeline
- POST /api/projects/{id}/timeline
- PUT /api/projects/{id}/timeline/{timelineId}
- GET /api/projects/{id}/budget
- PUT /api/projects/{id}/budget

**Vendors:**
- GET /api/vendors
- GET /api/vendors/{id}
- POST /api/vendors
- PUT /api/vendors/{id}
- DELETE /api/vendors/{id}

**Inventory:**
- GET /api/inventory/project/{projectId}
- POST /api/inventory
- PUT /api/inventory/{id}
- DELETE /api/inventory/{id}
- POST /api/inventory/usage (record usage)
- GET /api/inventory/usage/{projectId}

**Expenses:**
- GET /api/expenses/project/{projectId}
- POST /api/expenses
- PUT /api/expenses/{id}
- DELETE /api/expenses/{id}
- PUT /api/expenses/{id}/approve

**Payments:**
- GET /api/payments/project/{projectId}
- POST /api/payments
- GET /api/payments/pending
- GET /api/payments/overdue

**Invoices:**
- GET /api/invoices
- GET /api/invoices/{id}
- POST /api/invoices
- PUT /api/invoices/{id}
- DELETE /api/invoices/{id}
- GET /api/invoices/{id}/pdf
- POST /api/invoices/{id}/send-email

**Quotations:**
- GET /api/quotations
- GET /api/quotations/{id}
- POST /api/quotations
- PUT /api/quotations/{id}
- GET /api/quotations/{id}/pdf
- POST /api/quotations/{id}/send-email

**Attendance:**
- GET /api/attendance
- POST /api/attendance
- GET /api/attendance/user/{userId}
- GET /api/attendance/project/{projectId}

**Leaves:**
- GET /api/leaves
- POST /api/leaves
- PUT /api/leaves/{id}/approve
- PUT /api/leaves/{id}/reject

**Dashboard:**
- GET /api/dashboard/admin
- GET /api/dashboard/accountant
- GET /api/dashboard/project-head
- GET /api/dashboard/site-engineer

**Reports:**
- GET /api/reports/project-summary
- GET /api/reports/financial
- GET /api/reports/inventory
- GET /api/reports/team
- POST /api/reports/custom

### 4.4 Security Requirements

**Authentication & Authorization:**
- JWT-based authentication
- Role-based access control (RBAC)
- Password hashing (bcrypt)
- Session management with timeout
- Password strength validation
- Account lockout after failed login attempts

**Data Security:**
- SQL injection prevention (prepared statements)
- XSS prevention (input sanitization)
- CSRF token implementation
- File upload validation
- Secure file storage with random naming
- Database connection encryption

**API Security:**
- HTTPS only (SSL certificate required)
- Rate limiting on API endpoints
- API request validation
- Error handling without exposing sensitive info
- CORS configuration

**Access Control:**
- Super Admin: Full system access
- Admin: All except Super Admin management
- Accountant: Finance, clients, leads, vendors, inventory
- Project Head: Assigned projects, team, tasks
- Site Engineer: Assigned projects, timeline updates, inventory usage

**Data Privacy:**
- User data encryption
- Audit logs for sensitive operations
- GDPR compliance for data handling
- Data backup and recovery procedures

### 4.5 Performance Requirements

**Response Time:**
- Page load: < 2 seconds
- API response: < 500ms for queries
- Report generation: < 5 seconds

**Scalability:**
- Support up to 100 concurrent users
- Handle 10,000+ projects
- Database optimization with indexing
- Query optimization
- Caching implementation (Redis optional)

**Browser Compatibility:**
- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Edge (latest 2 versions)

**Responsive Design:**
- Desktop (1920x1080 and above)
- Laptop (1366x768)
- Tablet (768x1024)
- Mobile (375x667 and above)

**Data Backup:**
- Daily automated database backups
- Weekly full system backups
- Backup retention: 30 days
- Backup download option for Super Admin

---

## 5. USER INTERFACE REQUIREMENTS

### 5.1 Design Principles
- Clean and professional interface
- Consistent color scheme and branding
- Intuitive navigation
- Responsive design for all devices
- Accessibility standards (WCAG 2.1)
- Fast loading with loading indicators
- Clear error messages
- Success confirmations

### 5.2 Layout Structure

**Header:**
- Company logo
- User name and profile picture
- Notifications bell icon (with count)
- User dropdown menu (Profile, Settings, Logout)

**Sidebar Navigation (Role-based):**
- Dashboard
- Projects (All Projects, Add New, Timeline View)
- Clients (All Clients, Add New, Leads)
- Team (All Staff, Add New, Attendance, Leaves)
- Finance (Expenses, Payments, Invoices, Budget)
- Inventory (All Inventory, Add New, Usage, Vendors)
- Reports
- Settings (for Admin/Super Admin)

**Main Content Area:**
- Breadcrumb navigation
- Page title
- Action buttons (Add New, Export, Filter)
- Content section
- Footer

### 5.3 Color Scheme (Suggestion)
- Primary: #2C3E50 (DLivincart Blue-Gray)
- Secondary: #3498DB (Blue)
- Success: #27AE60 (Green)
- Warning: #F39C12 (Orange)
- Danger: #E74C3C (Red)
- Info: #16A085 (Teal)
- Light Background: #ECF0F1
- White: #FFFFFF
- Text: #2C3E50

### 5.4 Key UI Components

**Dashboard Cards:**
- Icon on left
- Metric value (large, bold)
- Metric label
- Trend indicator (up/down arrow with %)
- Click to drill down

**Data Tables:**
- Searchable
- Sortable columns
- Pagination (10, 25, 50, 100 per page)
- Row actions (View, Edit, Delete icons)
- Bulk actions checkbox
- Responsive (mobile: card view)

**Forms:**
- Clear labels
- Placeholder text
- Required field indicators (*)
- Inline validation
- Error messages below fields
- Submit and Cancel buttons
- Form sections with headings

**Charts:**
- Interactive (hover for details)
- Legend
- Axis labels
- Responsive sizing
- Export chart as image option

**Modals:**
- Confirmation modals for delete actions
- Quick add/edit modals for small forms
- Image preview modals
- PDF preview modals

**Notifications:**
- Toast notifications for success/error
- Auto-dismiss after 5 seconds
- Closeable manually
- Position: top-right

**File Upload:**
- Drag and drop area
- File type and size validation
- Upload progress bar
- Preview for images
- Remove file option

### 5.5 Mobile Responsiveness
- Hamburger menu for sidebar on mobile
- Stack cards vertically
- Tables convert to card view
- Larger touch targets for buttons
- Simplified forms on mobile
- Mobile-optimized charts

---

## 6. WORKFLOW EXAMPLES

### 6.1 Complete Lead to Project Workflow

**Step 1: Lead Entry (Accountant)**
1. Accountant receives inquiry
2. Logs into system → Goes to Leads → Add New Lead
3. Fills form: Name, Contact, Project Type, Budget, etc.
4. Assigns to Principal Architect for proposal
5. Saves lead with status "Enquiry"

**Step 2: Proposal Generation**
1. Principal Architect reviews lead
2. Creates quotation with line items
3. Generates PDF quotation
4. Emails to client
5. Updates lead status to "Proposal Sent"

**Step 3: Follow-up**
1. Accountant sets follow-up date
2. System sends reminder on follow-up date
3. Accountant contacts client
4. Updates lead status based on response

**Step 4: Lead Conversion (If Client Agrees)**
1. Accountant changes lead status to "Converted"
2. System auto-creates Client record
3. Client gets unique ID (CL001)

**Step 5: Project Creation (Admin/Principal Architect)**
1. Goes to Projects → Add New Project
2. Selects client from dropdown
3. Fills project details (name, budget, dates, etc.)
4. Saves project → Gets Project ID (PRJ001)

**Step 6: Team Assignment (Admin)**
1. Opens project details
2. Assigns Project Head
3. Assigns Site Engineer(s)
4. Saves assignments

**Step 7: Budget Allocation (Admin + Accountant)**
1. Admin sets overall budget
2. Accountant breaks down by category
3. Material budget, Labor budget, etc.
4. Saves budget allocation

**Step 8: Advance Payment (Accountant)**
1. Client pays advance (e.g., 30%)
2. Accountant goes to Payments → Add Payment
3. Selects project, enters amount, date, mode
4. Uploads receipt
5. Saves payment

**Step 9: Initial Inventory Addition (Accountant)**
1. Goes to Inventory → Add Inventory
2. Selects project (PRJ001)
3. Adds materials purchased:
   - Category: Electrical
   - Item: Wires, switches, fans, etc.
   - Quantity, rate, vendor
4. Repeats for all categories
5. Each item gets inventory ID linked to this project

**Step 10: Timeline Creation (Project Head)**
1. Goes to project timeline
2. Adds tasks phase-wise:
   - Site cleaning (1 week)
   - Electrical wiring (2 weeks)
   - Plumbing (1 week)
   - Civil work (3 weeks)
   - Carpentry (2 weeks)
   - Painting (1 week)
   - Finishing (1 week)
3. Sets start and end dates for each
4. Assigns tasks to Site Engineer
5. Saves timeline

**Step 11: Project Execution (Site Engineer)**
1. Site Engineer logs in
2. Views assigned projects and tasks
3. MLivincarts "Site cleaning" as In Progress
4. Updates daily progress
5. Records inventory usage:
   - Used 50m of wire today
   - System reduces inventory automatically
6. Uploads site progress photos
7. MLivincarts task complete when done
8. Timeline auto-updates

**Step 12: Expense Recording**
1. Site Engineer requests petty cash expense
2. Goes to Request Expense → Enter details
3. Project Head approves
4. Accountant processes payment
5. Expense auto-links to project
6. Budget tracking updates

**Step 13: Milestone Payment**
1. Project reaches 50% completion
2. Project Head notifies Admin
3. Admin verifies completion
4. Accountant generates invoice for milestone payment
5. Sends invoice to client
6. Client pays
7. Accountant records payment

**Step 14: Monitoring (Admin Dashboard)**
1. Admin views dashboard daily
2. Sees project PRJ001 status:
   - 50% complete
   - On schedule (green)
   - Budget utilization: 45% (healthy)
   - No issues
3. Views timeline - all tasks on track
4. Reviews financial summary - profit on track

**Step 15: Project Completion**
1. All timeline tasks mLivincarted complete
2. Site Engineer submits final report
3. Project Head reviews and confirms
4. Admin mLivincarts project status as "Completed"
5. Accountant sends final invoice
6. Collects final payment
7. Generates final project balance sheet
8. Archives project

### 6.2 Daily Site Engineer Workflow

**Morning (9 AM):**
1. Log in to system
2. View Dashboard → See today's tasks
3. Check assigned projects (e.g., 2 active projects)
4. Review pending tasks
5. Note material requirements

**At Site (10 AM):**
1. MLivincart attendance for the project site
2. Review timeline for the day
3. Check which phase is active (e.g., Electrical work)
4. Coordinate with contractors

**During Work (12 PM):**
1. Material usage:
   - Opens Inventory Usage
   - Selects project
   - Selects items used (e.g., 100m wire, 20 switches)
   - Enters quantity
   - Saves
2. Task update:
   - Opens timeline task
   - Updates completion % (e.g., 30% → 60%)
   - Adds notes
   - Uploads progress photo

**Afternoon (3 PM):**
1. Contractor requests petty cash
2. Site Engineer creates expense request
3. Amount: ₹5,000
4. Description: Labor payment
5. Submits to Project Head
6. Waits for approval

**Evening (6 PM):**
1. Final inventory usage entry
2. MLivincart tasks completed for the day
3. Submit daily site report:
   - Work completed today
   - Materials used
   - Issues faced
   - Next day plan
4. Upload site photos
5. MLivincart attendance out
6. Logout

### 6.3 Monthly Accountant Workflow

**Week 1:**
- Follow up on pending leads
- Convert interested leads to clients
- Create projects for new clients
- Collect advance payments
- Add initial inventory for new projects
- Generate invoices for milestone payments
- Record all payments received

**Week 2:**
- Process expense claims from Site Engineers
- Make vendor payments
- Update expense records
- Track inventory usage across projects
- Add new inventory purchases
- Low stock alerts - order materials

**Week 3:**
- Generate GST invoices for completed milestones
- Follow up on overdue payments
- Update payment trackers
- Reconcile bank statements
- Update project budgets if needed

**Week 4:**
- Monthly financial reports
- Project-wise profitability analysis
- Prepare balance sheets
- Vendor payment summary
- Lead conversion analysis
- Prepare data for Admin review

### 6.4 Admin Monthly Review Workflow

**Dashboard Review:**
1. Login → View Admin Dashboard
2. Check overview cards:
   - Active projects: 15
   - Completed this month: 3
   - New clients: 5
   - Revenue this month: ₹25,00,000
3. Review project status distribution
4. Check timeline status - identify delayed projects

**Project Performance:**
1. Open "Projects" → Filter by "Delayed"
2. Review each delayed project
3. Check reasons (timeline tab)
4. Contact Project Head for updates
5. Take corrective action if needed

**Financial Review:**
1. Open Financial Dashboard
2. Review income vs expense
3. Check profit margins
4. Identify loss-making projects
5. Review pending payments
6. Approve large expenses (> ₹50,000)

**Team Performance:**
1. Open Team Dashboard
2. Review workload distribution
3. Identify overloaded staff
4. Reassign projects if needed
5. Check attendance patterns
6. Approve pending leaves

**Lead Analysis:**
1. Open Lead Reports
2. Check conversion rate
3. Identify bottlenecks in sales funnel
4. Review lost leads - reasons
5. Set targets for next month

**Vendor Review:**
1. Check vendor performance
2. Payment timeliness
3. Material quality issues (from site reports)
4. Negotiate better rates
5. Add new vendors if needed

**Strategic Planning:**
1. Review monthly targets vs achievements
2. Plan resource allocation for next month
3. Budget forecasting
4. Growth projections
5. System improvement suggestions

---

## 7. IMPLEMENTATION PHASES

### Phase 1: Core Foundation (Weeks 1-4)
**Deliverables:**
- Database design and creation
- User authentication system
- User management (Add/Edit/Delete users)
- Role-based access control
- Basic dashboard for each role
- Navigation structure

**Testing:**
- User login/logout
- Role-based access restrictions
- User CRUD operations

### Phase 2: Client & Lead Management (Weeks 5-6)
**Deliverables:**
- Lead entry and management
- Lead status tracking
- Lead to client conversion
- Client management
- Quotation generation
- Basic reporting for leads

**Testing:**
- Lead lifecycle flow
- Client creation
- Quotation PDF generation

### Phase 3: Project Management (Weeks 7-9)
**Deliverables:**
- Project creation and management
- Project dashboard
- Team assignment to projects
- Project phases tracking
- Basic timeline functionality
- Project status updates

**Testing:**
- Project CRUD operations
- Team assignments
- Status workflow

### Phase 4: Timeline & Task Management (Weeks 10-11)
**Deliverables:**
- Detailed timeline/Gantt chart
- Task creation and assignment
- Timeline task updates by Site Engineer
- Timeline visualization
- Dependency management
- Timeline status indicators

**Testing:**
- Timeline creation
- Task completion flow
- Gantt chart rendering
- Date calculations

### Phase 5: Finance - Part 1 (Weeks 12-13)
**Deliverables:**
- Vendor management
- Expense tracking
- Payment recording
- Budget allocation and tracking
- Expense approval workflow

**Testing:**
- Expense entry and approval
- Budget alerts
- Payment recording

### Phase 6: Finance - Part 2 (Weeks 14-15)
**Deliverables:**
- GST invoice generation
- Invoice PDF creation
- Payment tracking per invoice
- Project-wise balance sheet
- Financial reports
- Client payment reminders

**Testing:**
- Invoice generation
- GST calculations
- Payment reconciliation

### Phase 7: Inventory Management (Weeks 16-17)
**Deliverables:**
- Inventory master setup
- Project-wise inventory tracking
- Inventory usage recording
- Stock alerts
- Inventory reports
- Vendor-wise purchase tracking

**Testing:**
- Inventory addition
- Usage recording
- Stock calculations
- Low stock alerts

### Phase 8: Team Management (Week 18)
**Deliverables:**
- Staff allocation tracking
- Workload distribution view
- Attendance management
- Leave management
- Team performance tracking

**Testing:**
- Attendance mLivincarting
- Leave workflow
- Workload calculations

### Phase 9: Dashboard & Analytics (Weeks 19-20)
**Deliverables:**
- Complete dashboards for all roles
- Data visualization (charts/graphs)
- KPI cards
- Real-time data updates
- Activity feed
- Notifications system

**Testing:**
- Dashboard data accuracy
- Chart rendering
- Notification delivery

### Phase 10: Reports & Export (Week 21)
**Deliverables:**
- All standard reports
- PDF export functionality
- Excel export
- Custom report builder
- Scheduled reports
- Report email functionality

**Testing:**
- Report generation
- Export formats
- Email delivery

### Phase 11: Final Integration & Testing (Weeks 22-23)
**Deliverables:**
- Complete end-to-end integration
- Security hardening
- Performance optimization
- Mobile responsiveness
- Cross-browser testing
- Bug fixes

**Testing:**
- User acceptance testing
- Load testing
- Security testing
- Regression testing

### Phase 12: Deployment & Training (Week 24)
**Deliverables:**
- Production deployment
- Domain and SSL setup
- Database migration
- User training documentation
- Video tutorials
- Admin training session
- Go-live support

---

## 8. USER TRAINING & DOCUMENTATION

### 8.1 User Manuals
- Super Admin manual
- Admin/Principal Architect manual
- Accountant manual
- Project Head manual
- Site Engineer manual

### 8.2 Training Videos
- System overview (10 mins)
- User management (5 mins)
- Lead to project workflow (15 mins)
- Timeline management (10 mins)
- Financial management (15 mins)
- Inventory tracking (10 mins)
- Reporting (8 mins)

### 8.3 Quick Reference Guides
- Login and navigation
- Adding a new project
- Recording payments
- MLivincarting timeline tasks
- Generating invoices
- Common troubleshooting

### 8.4 Training Schedule
- Week 1: Super Admin & Admin training (2 hours)
- Week 2: Accountant training (2 hours)
- Week 3: Project Head & Site Engineer training (2 hours)
- Week 4: Q&A and advanced features (1 hour)

---

## 9. MAINTENANCE & SUPPORT

### 9.1 Post-Launch Support
- 30 days free support after go-live
- Bug fixes at no extra cost
- Email support (response within 24 hours)
- Phone support for critical issues
- Remote assistance via screen share

### 9.2 Maintenance Plan
- Monthly security updates
- Quarterly feature updates
- Database optimization
- Backup monitoring
- Server health checks
- Performance monitoring

### 9.3 Enhancement Requests
- User feedback collection
- Feature request tracking
- Prioritization of enhancements
- Quarterly update releases
- Change request process

---

## 10. SUCCESS METRICS

### 10.1 Key Performance Indicators (KPIs)

**Project Management:**
- % of projects completed on time
- Average project delay (days)
- Project completion rate
- Budget adherence % (projects within budget)

**Financial:**
- Monthly revenue growth
- Profit margin %
- Payment collection efficiency
- Expense vs budget variance

**Client Management:**
- Lead conversion rate
- Number of active clients
- Client retention rate
- Average project value

**Team Efficiency:**
- Average projects per team member
- Task completion rate
- Attendance %
- Workload balance score

**System Usage:**
- Daily active users
- User adoption rate by role
- Average session duration
- Feature utilization %

### 10.2 Business Goals
- Reduce project delays by 30%
- Improve lead conversion by 20%
- Achieve 95% on-time payment collection
- Increase profit margin by 15%
- Manage 50+ concurrent projects efficiently
- 100% inventory tracking accuracy
- Reduce manual paperwork by 90%

---

## 11. RISKS & MITIGATION

### 11.1 Technical Risks
**Risk:** Data loss due to server failure  
**Mitigation:** Daily automated backups, cloud backup storage, disaster recovery plan

**Risk:** Security breach  
**Mitigation:** SSL encryption, regular security audits, strong authentication, access logs

**Risk:** Poor performance with scale  
**Mitigation:** Database optimization, caching, scalable hosting, load testing

**Risk:** Browser compatibility issues  
**Mitigation:** Cross-browser testing, progressive enhancement, polyfills

### 11.2 User Adoption Risks
**Risk:** Resistance to new system  
**Mitigation:** Comprehensive training, easy UI, gradual rollout, support team

**Risk:** Data entry errors  
**Mitigation:** Validation rules, required fields, error messages, double-entry checks

**Risk:** Low user engagement  
**Mitigation:** Notifications, email reminders, dashboard alerts, gamification

### 11.3 Business Risks
**Risk:** Budget overrun  
**Mitigation:** Phased approach, fixed scope for each phase, change control process

**Risk:** Timeline delays  
**Mitigation:** Buffer time in schedule, regular progress reviews, agile methodology

**Risk:** Scope creep  
**Mitigation:** Clear PRD, change request process, priority-based backlog

---

## 12. APPENDICES

### Appendix A: Glossary
- **Lead**: Potential client inquiry
- **Project Head**: Person responsible for project execution
- **Site Engineer**: On-site project executor
- **Timeline**: Gantt chart showing project tasks and schedule
- **Milestone**: Significant project completion point tied to payment
- **Inventory**: Materials purchased for a specific project
- **Vendor**: Supplier of materials or services
- **GST**: Goods and Services Tax
- **RBAC**: Role-Based Access Control
- **JWT**: JSON Web Token (authentication method)

### Appendix B: Acronyms
- **PRD**: Product Requirements Document
- **CRUD**: Create, Read, Update, Delete
- **API**: Application Programming Interface
- **UI**: User Interface
- **UX**: User Experience
- **KPI**: Key Performance Indicator
- **CSV**: Comma-Separated Values
- **PDF**: Portable Document Format
- **SSL**: Secure Sockets Layer
- **XAMPP**: Cross-platform Apache, MySQL, PHP, Perl

### Appendix C: Sample Data
**Sample Project Timeline:**
- Phase 1: Site Preparation (2 days)
- Phase 2: Demolition (3 days)
- Phase 3: Electrical First Fix (5 days)
- Phase 4: Plumbing First Fix (4 days)
- Phase 5: Civil Work (10 days)
- Phase 6: Electrical Second Fix (3 days)
- Phase 7: Plumbing Second Fix (2 days)
- Phase 8: False Ceiling (7 days)
- Phase 9: Carpentry (15 days)
- Phase 10: Painting (8 days)
- Phase 11: Flooring (6 days)
- Phase 12: Finishing & Fixtures (5 days)
- Phase 13: Cleaning & Handover (2 days)

**Total Project Duration:** 72 days (approx. 10-11 weeks)

### Appendix D: Sample Budget Breakdown
Total Project Budget: ₹10,00,000

- Material Costs: ₹4,00,000 (40%)
  - Electrical: ₹80,000
  - Plumbing: ₹60,000
  - Civil: ₹1,00,000
  - Carpentry: ₹1,20,000
  - Painting: ₹40,000
  - Flooring: ₹80,000
  - Fixtures: ₹20,000

- Labor Costs: ₹3,50,000 (35%)
  - Contractors: ₹2,50,000
  - Site staff: ₹1,00,000

- Transportation: ₹50,000 (5%)

- Overheads: ₹1,00,000 (10%)
  - Office expenses
  - Utilities
  - Equipment rental

- Contingency: ₹1,00,000 (10%)

---

## 13. CONCLUSION

This PRD outlines a comprehensive project management system tailored for interior design and architecture firms. The system covers the entire lifecycle from lead generation to project completion, with strong emphasis on:

1. **Timeline Management**: Detailed Gantt charts for tracking every phase of interior work
2. **Financial Control**: Complete budget tracking, expense management, and payment collection
3. **Inventory Tracking**: Project-wise inventory with usage monitoring
4. **Team Collaboration**: Role-based access with clear workflows
5. **Client Management**: Lead tracking and conversion optimization
6. **Analytics**: Comprehensive dashboards and reports

The phased implementation approach ensures manageable development cycles with regular testing and feedback. The system is designed to be scalable, secure, and user-friendly, with mobile responsiveness for on-site usage.

**Key Differentiators:**
- Project-wise separate inventory (not shared pool)
- Detailed timeline with site engineer mLivincarting capability
- Complete financial tracking from advance to final payment
- Role-based dashboards with relevant KPIs
- Vendor management integrated with expenses
- Real-time project status with timeline visualization

**Expected Outcomes:**
- 30% reduction in project delays
- 20% improvement in lead conversion
- 95% on-time payment collection
- 15% increase in profit margins
- Complete elimination of manual paperwork
- Real-time visibility into all projects

This system will transform project management from reactive to proactive, ensuring better client satisfaction, improved profitability, and scalable operations.

---

**Document Prepared By:** Claude AI  
**Date:** April 18, 2026  
**Version:** 1.0  
**Status:** Ready for Development

---

## NEXT STEPS

1. **Review & Approval**: Stakeholder review of this PRD
2. **Design Phase**: UI/UX mockups based on this PRD
3. **Development**: Start with Phase 1 implementation
4. **Testing**: Parallel to each phase
5. **Deployment**: Production launch after Phase 12
6. **Training**: User training and documentation
7. **Go-Live**: System activation with support
8. **Feedback**: Collect feedback for enhancements

---

**END OF DOCUMENT**
