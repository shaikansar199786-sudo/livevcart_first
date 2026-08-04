-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Apr 28, 2026 at 08:14 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `Livincart_pm_system`
--

-- --------------------------------------------------------

--
-- Table structure for table `activity_logs`
--

CREATE TABLE `activity_logs` (
  `log_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `action` varchar(50) NOT NULL,
  `module` varchar(50) NOT NULL,
  `record_id` int(11) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `attendance`
--

CREATE TABLE `attendance` (
  `attendance_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `project_id` int(11) DEFAULT NULL,
  `date` date NOT NULL,
  `status` enum('present','absent','half_day','leave') NOT NULL,
  `check_in_time` time DEFAULT NULL,
  `check_out_time` time DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `mLivincarted_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `clients`
--

CREATE TABLE `clients` (
  `client_id` int(11) NOT NULL,
  `client_code` varchar(20) NOT NULL,
  `name` varchar(100) NOT NULL,
  `email` varchar(100) DEFAULT NULL,
  `phone` varchar(20) NOT NULL,
  `address` text DEFAULT NULL,
  `city` varchar(50) DEFAULT NULL,
  `state` varchar(50) DEFAULT NULL,
  `pincode` varchar(10) DEFAULT NULL,
  `gst_number` varchar(20) DEFAULT NULL,
  `lead_source` enum('walk_in','reference','website','social_media','advertisement') DEFAULT NULL,
  `converted_from_lead_id` int(11) DEFAULT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `clients`
--

INSERT INTO `clients` (`client_id`, `client_code`, `name`, `email`, `phone`, `address`, `city`, `state`, `pincode`, `gst_number`, `lead_source`, `converted_from_lead_id`, `status`, `created_by`, `created_at`, `updated_at`) VALUES
(13, 'Livincart-CL-001', 'Preetham Ram', 'preethamram.avala2004@gmail.com', '08374062188', 'P & T Colony (Vm)', NULL, NULL, NULL, NULL, 'walk_in', NULL, 'active', 3, '2026-04-20 11:07:45', '2026-04-20 11:07:45'),
(14, 'Livincart-CL-014', 'test', 'test@gmai.lcom', '909090', 'assd', NULL, NULL, NULL, NULL, 'walk_in', NULL, 'active', 3, '2026-04-22 07:11:33', '2026-04-22 07:11:33'),
(15, 'Livincart-CL-015', 'product', 'test@gmal.co', '900990090', 'sd', NULL, NULL, NULL, NULL, 'walk_in', NULL, 'active', 1, '2026-04-22 12:48:58', '2026-04-22 12:48:58'),
(16, 'Livincart-CL-016', 'Livincart Project ', 'gh@gmail.com', '040044440', 'Visakhapatanam\n', NULL, NULL, NULL, NULL, 'walk_in', NULL, 'active', 3, '2026-04-24 06:16:19', '2026-04-24 06:16:19'),
(17, 'Livincart-CL-017', 'Qwe', 'gh@gmail.com', '5645646', ' hgqwuw', NULL, NULL, NULL, NULL, 'walk_in', NULL, 'active', 3, '2026-04-24 09:34:21', '2026-04-24 09:34:21'),
(18, 'Livincart-CL-018', 'Livincart ', 'Livincart @gmail.com', '489457', 'P & T Colony (Vm)', NULL, NULL, NULL, NULL, 'walk_in', NULL, 'active', 3, '2026-04-25 05:21:11', '2026-04-25 05:21:11'),
(19, 'Livincart-CL-019', 'Salman', '', '546879213', 'RK Beach', NULL, NULL, NULL, NULL, 'walk_in', NULL, 'active', 3, '2026-04-28 05:47:20', '2026-04-28 05:47:20');

-- --------------------------------------------------------

--
-- Table structure for table `client_payments`
--

CREATE TABLE `client_payments` (
  `payment_id` int(11) NOT NULL,
  `project_id` int(11) NOT NULL,
  `client_id` int(11) NOT NULL,
  `payment_amount` decimal(12,2) NOT NULL,
  `payment_date` date NOT NULL,
  `payment_mode` enum('cash','cheque','neft','upi','card') NOT NULL,
  `transaction_reference` varchar(100) DEFAULT NULL,
  `payment_milestone` varchar(100) DEFAULT NULL,
  `receipt_number` varchar(50) DEFAULT NULL,
  `receipt_document_path` varchar(255) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `expenses`
--

CREATE TABLE `expenses` (
  `expense_id` int(11) NOT NULL,
  `project_id` int(11) NOT NULL,
  `expense_category` enum('material','contractor','transportation','site_costs','equipment','miscellaneous','labor') DEFAULT NULL,
  `vendor_id` int(11) DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL,
  `payment_mode` enum('cash','cheque','neft','upi','card') NOT NULL,
  `payment_date` date NOT NULL,
  `bill_number` varchar(50) DEFAULT NULL,
  `bill_document_path` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `approved_by` int(11) DEFAULT NULL,
  `status` enum('pending','approved','paid') DEFAULT 'pending',
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `finance_transactions`
--

CREATE TABLE `finance_transactions` (
  `transaction_id` int(11) NOT NULL,
  `project_id` int(11) DEFAULT NULL,
  `type` enum('credit','debit') NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `category` varchar(50) NOT NULL,
  `description` text DEFAULT NULL,
  `transaction_date` date NOT NULL,
  `recorded_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `finance_transactions`
--

INSERT INTO `finance_transactions` (`transaction_id`, `project_id`, `type`, `amount`, `category`, `description`, `transaction_date`, `recorded_by`, `created_at`) VALUES
(1, 2, 'credit', 200000.00, 'Advance Payment', 'Advance Payment', '2026-04-20', 3, '2026-04-20 11:26:50'),
(2, 3, 'credit', 100000.00, 'Advance Payment', 'Advance Payment', '2026-04-22', 3, '2026-04-22 07:15:22'),
(3, 8, 'credit', 50000.00, 'milestone_payment', '', '2026-04-25', 3, '2026-04-25 05:51:17'),
(4, 8, 'debit', 5000.00, 'Transport', 'Marble Exps', '2026-04-28', 5, '2026-04-28 05:03:17');

-- --------------------------------------------------------

--
-- Table structure for table `inventory`
--

CREATE TABLE `inventory` (
  `inventory_id` int(11) NOT NULL,
  `project_id` int(11) NOT NULL,
  `material_category` varchar(50) NOT NULL,
  `item_name` varchar(200) NOT NULL,
  `opening_stock` decimal(10,2) DEFAULT 0.00,
  `purchased_quantity` decimal(10,2) NOT NULL,
  `used_quantity` decimal(10,2) DEFAULT 0.00,
  `current_stock` decimal(10,2) GENERATED ALWAYS AS (`opening_stock` + `purchased_quantity` - `used_quantity`) VIRTUAL,
  `unit` varchar(20) NOT NULL,
  `rate_per_unit` decimal(10,2) NOT NULL,
  `total_amount` decimal(12,2) GENERATED ALWAYS AS (`purchased_quantity` * `rate_per_unit`) VIRTUAL,
  `vendor_id` int(11) DEFAULT NULL,
  `purchase_date` date NOT NULL,
  `bill_number` varchar(50) DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `inventory_usage`
--

CREATE TABLE `inventory_usage` (
  `usage_id` int(11) NOT NULL,
  `inventory_id` int(11) NOT NULL,
  `project_id` int(11) NOT NULL,
  `quantity_used` decimal(10,2) NOT NULL,
  `usage_date` date NOT NULL,
  `used_by` int(11) NOT NULL,
  `location_used` varchar(200) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `invoices`
--

CREATE TABLE `invoices` (
  `invoice_id` int(11) NOT NULL,
  `invoice_number` varchar(50) NOT NULL,
  `project_id` int(11) NOT NULL,
  `client_id` int(11) NOT NULL,
  `invoice_date` date NOT NULL,
  `due_date` date NOT NULL,
  `subtotal` decimal(12,2) NOT NULL,
  `gst_amount` decimal(12,2) NOT NULL,
  `total_amount` decimal(12,2) NOT NULL,
  `amount_in_words` varchar(255) DEFAULT NULL,
  `status` enum('draft','sent','paid','overdue','cancelled') DEFAULT 'draft',
  `payment_status` enum('unpaid','partial','paid') DEFAULT 'unpaid',
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `invoice_items`
--

CREATE TABLE `invoice_items` (
  `item_id` int(11) NOT NULL,
  `invoice_id` int(11) NOT NULL,
  `description` text NOT NULL,
  `quantity` decimal(10,2) NOT NULL,
  `rate` decimal(10,2) NOT NULL,
  `taxable_amount` decimal(12,2) GENERATED ALWAYS AS (`quantity` * `rate`) VIRTUAL,
  `gst_percentage` decimal(5,2) NOT NULL,
  `gst_amount` decimal(12,2) GENERATED ALWAYS AS (`quantity` * `rate` * `gst_percentage` / 100) VIRTUAL,
  `total_amount` decimal(12,2) GENERATED ALWAYS AS (`quantity` * `rate` + `quantity` * `rate` * `gst_percentage` / 100) VIRTUAL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `leads`
--

CREATE TABLE `leads` (
  `lead_id` int(11) NOT NULL,
  `lead_source` enum('walk_in','reference','website','social_media','advertisement') NOT NULL,
  `client_name` varchar(100) NOT NULL,
  `contact_number` varchar(20) NOT NULL,
  `email` varchar(100) DEFAULT NULL,
  `location` text DEFAULT NULL,
  `project_type` enum('residential_interior','commercial_interior','architecture','landscape') DEFAULT NULL,
  `estimated_budget` decimal(12,2) DEFAULT NULL,
  `expected_start_date` date DEFAULT NULL,
  `status` enum('enquiry','proposal_sent','converted','won','lost') DEFAULT 'enquiry',
  `follow_up_date` date DEFAULT NULL,
  `assigned_to` int(11) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `leaves`
--

CREATE TABLE `leaves` (
  `leave_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `leave_type` enum('casual','sick','paid','unpaid') NOT NULL,
  `from_date` date NOT NULL,
  `to_date` date NOT NULL,
  `total_days` int(11) NOT NULL,
  `reason` text DEFAULT NULL,
  `status` enum('pending','approved','rejected') DEFAULT 'pending',
  `approved_by` int(11) DEFAULT NULL,
  `applied_on` timestamp NOT NULL DEFAULT current_timestamp(),
  `approved_on` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `material_requests`
--

CREATE TABLE `material_requests` (
  `request_id` int(11) NOT NULL,
  `project_id` int(11) NOT NULL,
  `item_name` varchar(200) NOT NULL,
  `quantity` decimal(10,2) NOT NULL,
  `unit` varchar(20) NOT NULL,
  `requested_by` int(11) NOT NULL,
  `approved_by` int(11) DEFAULT NULL,
  `urgency` enum('normal','high') DEFAULT 'normal',
  `status` enum('pending','approved','rejected','fulfilled') DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `notification_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `title` varchar(200) NOT NULL,
  `message` text NOT NULL,
  `type` varchar(50) NOT NULL,
  `reference_id` int(11) DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `projects`
--

CREATE TABLE `projects` (
  `project_id` int(11) NOT NULL,
  `project_code` varchar(20) NOT NULL,
  `project_name` varchar(200) NOT NULL,
  `client_id` int(11) NOT NULL,
  `project_type` enum('interior','architecture','both') DEFAULT NULL,
  `site_address` text DEFAULT NULL,
  `start_date` date NOT NULL,
  `expected_end_date` date NOT NULL,
  `actual_end_date` date DEFAULT NULL,
  `total_budget` decimal(15,2) NOT NULL,
  `advance_received` decimal(15,2) DEFAULT 0.00,
  `current_stage` enum('concept','design','execution','handover') DEFAULT 'concept',
  `status` enum('active','on_hold','completed','cancelled') DEFAULT 'active',
  `priority` enum('high','medium','low') DEFAULT 'medium',
  `completion_percentage` int(11) DEFAULT 0,
  `project_head_id` int(11) DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `projects`
--

INSERT INTO `projects` (`project_id`, `project_code`, `project_name`, `client_id`, `project_type`, `site_address`, `start_date`, `expected_end_date`, `actual_end_date`, `total_budget`, `advance_received`, `current_stage`, `status`, `priority`, `completion_percentage`, `project_head_id`, `created_by`, `created_at`, `updated_at`) VALUES
(2, 'Livincart-PR-1776684146', 'Preetham Ram Project', 13, NULL, NULL, '2026-04-20', '2026-10-20', NULL, 5000000.00, 0.00, 'concept', 'active', 'medium', 0, 7, 1, '2026-04-20 11:22:26', '2026-04-20 11:26:37'),
(3, 'Livincart-PR-1776842057', 'test Project', 14, NULL, NULL, '2026-04-22', '2026-10-22', NULL, 0.00, 0.00, 'concept', 'active', 'medium', 0, 7, 4, '2026-04-22 07:14:17', '2026-04-22 07:14:17'),
(4, 'Livincart-PR-1777011418', 'Livincart Project  Project', 16, NULL, NULL, '2026-04-24', '2026-09-30', NULL, 0.00, 0.00, 'concept', 'active', 'medium', 0, 7, 1, '2026-04-24 06:16:58', '2026-04-24 06:16:58'),
(5, 'Livincart-PR-1777011465', 'Livincart Project  Project', 16, NULL, NULL, '2026-04-24', '2026-11-30', NULL, 0.00, 0.00, 'concept', 'active', 'medium', 0, 7, 1, '2026-04-24 06:17:45', '2026-04-24 06:17:45'),
(6, 'Livincart-PR-1777011507', 'Livincart Project  Project', 16, NULL, NULL, '2026-04-24', '2026-10-30', NULL, 0.00, 0.00, 'concept', 'active', 'medium', 0, 7, 1, '2026-04-24 06:18:27', '2026-04-24 06:18:27'),
(7, 'Livincart-PR-1777023328', 'Qwe Project', 17, NULL, NULL, '2026-04-24', '2026-12-30', NULL, 0.00, 0.00, 'concept', 'active', 'medium', 0, 7, 1, '2026-04-24 09:35:28', '2026-04-24 09:35:28'),
(8, 'Livincart-PR-1777094547', 'Livincart  Project', 18, NULL, NULL, '2026-04-25', '2026-10-05', NULL, 0.00, 0.00, 'concept', 'active', 'medium', 0, 7, 1, '2026-04-25 05:22:27', '2026-04-25 05:26:17'),
(9, 'Livincart-PR-1777355401', 'Salman Project', 19, NULL, NULL, '2026-04-28', '2026-09-23', NULL, 0.00, 0.00, 'concept', 'active', 'medium', 0, 6, 1, '2026-04-28 05:50:01', '2026-04-28 05:50:01');

-- --------------------------------------------------------

--
-- Table structure for table `project_assignments`
--

CREATE TABLE `project_assignments` (
  `assignment_id` int(11) NOT NULL,
  `project_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `role` enum('project_head','site_engineer') NOT NULL,
  `assigned_date` date NOT NULL,
  `unassigned_date` date DEFAULT NULL,
  `status` enum('active','inactive') DEFAULT 'active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `project_assignments`
--

INSERT INTO `project_assignments` (`assignment_id`, `project_id`, `user_id`, `role`, `assigned_date`, `unassigned_date`, `status`) VALUES
(2, 2, 7, 'project_head', '2026-04-20', NULL, 'active'),
(3, 3, 7, 'project_head', '2026-04-22', NULL, 'active'),
(4, 4, 7, 'project_head', '2026-04-24', NULL, 'active'),
(5, 4, 5, 'site_engineer', '2026-04-24', NULL, 'active'),
(6, 5, 7, 'project_head', '2026-04-24', NULL, 'active'),
(7, 5, 5, 'site_engineer', '2026-04-24', NULL, 'active'),
(8, 6, 7, 'project_head', '2026-04-24', NULL, 'active'),
(9, 6, 5, 'site_engineer', '2026-04-24', NULL, 'active'),
(10, 7, 7, 'project_head', '2026-04-24', NULL, 'active'),
(11, 7, 5, 'site_engineer', '2026-04-24', NULL, 'active'),
(12, 8, 4, 'project_head', '2026-04-25', NULL, 'inactive'),
(13, 8, 5, 'site_engineer', '2026-04-25', NULL, 'inactive'),
(14, 8, 4, 'project_head', '2026-04-25', NULL, 'inactive'),
(15, 8, 5, 'site_engineer', '2026-04-25', NULL, 'inactive'),
(16, 8, 7, 'project_head', '2026-04-25', NULL, 'active'),
(17, 8, 5, 'site_engineer', '2026-04-25', NULL, 'active'),
(18, 9, 6, 'project_head', '2026-04-28', NULL, 'active'),
(19, 9, 5, 'site_engineer', '2026-04-28', NULL, 'active');

-- --------------------------------------------------------

--
-- Table structure for table `project_budget`
--

CREATE TABLE `project_budget` (
  `budget_id` int(11) NOT NULL,
  `project_id` int(11) NOT NULL,
  `category` enum('material','labor','transportation','overhead','contingency') NOT NULL,
  `allocated_amount` decimal(12,2) NOT NULL,
  `spent_amount` decimal(12,2) DEFAULT 0.00,
  `remaining_amount` decimal(12,2) GENERATED ALWAYS AS (`allocated_amount` - `spent_amount`) VIRTUAL,
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `project_inventory`
--

CREATE TABLE `project_inventory` (
  `id` int(11) NOT NULL,
  `project_id` varchar(50) DEFAULT NULL,
  `items` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`items`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `vendor` varchar(255) DEFAULT NULL,
  `item_name` varchar(255) DEFAULT NULL,
  `rate` decimal(10,2) DEFAULT NULL,
  `quantity` int(11) DEFAULT NULL,
  `amount` decimal(10,2) DEFAULT NULL,
  `gst` decimal(10,2) DEFAULT NULL,
  `total` decimal(10,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `project_inventory`
--

INSERT INTO `project_inventory` (`id`, `project_id`, `items`, `created_at`, `vendor`, `item_name`, `rate`, `quantity`, `amount`, `gst`, `total`) VALUES
(10, '3', NULL, '2026-04-23 02:27:38', 'rest', 's', 5.00, 1, 5.00, 0.90, 5.90),
(11, '3', NULL, '2026-04-23 02:27:38', 'kol', 'fan', 555.00, 1, 555.00, 99.90, 654.90),
(12, '2', NULL, '2026-04-23 04:42:51', 'permat', 'fan', 3.00, 1, 3.00, 0.54, 3.54),
(13, '6', NULL, '2026-04-24 07:46:28', 'Raju', 'Fan', 100.00, 15, 1500.00, 270.00, 1770.00),
(14, '6', NULL, '2026-04-24 07:46:28', '', '', 0.00, 1, 0.00, 0.00, 0.00),
(15, '8', NULL, '2026-04-25 05:42:45', 'Wipro', '50', 500.00, 50, 25000.00, 4500.00, 29500.00);

-- --------------------------------------------------------

--
-- Table structure for table `project_timeline`
--

CREATE TABLE `project_timeline` (
  `timeline_id` int(11) NOT NULL,
  `project_id` int(11) NOT NULL,
  `external_id` bigint(20) DEFAULT NULL,
  `task_name` varchar(200) NOT NULL,
  `task_category` varchar(100) DEFAULT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `duration_days` int(11) DEFAULT NULL,
  `assigned_to` int(11) DEFAULT NULL,
  `dependencies` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`dependencies`)),
  `status` enum('not_started','in_progress','completed','delayed') DEFAULT 'not_started',
  `completion_percentage` int(11) DEFAULT 0,
  `actual_start_date` date DEFAULT NULL,
  `actual_end_date` date DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `completed_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `project_timeline`
--

INSERT INTO `project_timeline` (`timeline_id`, `project_id`, `external_id`, `task_name`, `task_category`, `start_date`, `end_date`, `duration_days`, `assigned_to`, `dependencies`, `status`, `completion_percentage`, `actual_start_date`, `actual_end_date`, `notes`, `created_by`, `created_at`, `updated_at`, `completed_at`) VALUES
(86, 8, 1, 'AC piping, Ceiling Wiring', '', '2026-04-28', '2026-04-29', 1, NULL, NULL, 'not_started', 0, NULL, NULL, NULL, 5, '2026-04-28 04:55:29', '2026-04-28 04:55:29', NULL),
(87, 8, 1777292812155, 'Spreading floor mats', '1. INITIAL WORKS', '2026-04-30', '2026-05-08', 8, NULL, NULL, 'not_started', 0, NULL, NULL, NULL, 5, '2026-04-28 04:55:29', '2026-04-28 04:55:29', NULL),
(88, 8, 1777352033922, 'Demolition', '1. INITIAL WORKS', '2026-04-26', '2026-05-08', 12, NULL, NULL, 'not_started', 0, NULL, NULL, NULL, 5, '2026-04-28 04:55:29', '2026-04-28 04:55:29', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `quotations`
--

CREATE TABLE `quotations` (
  `quotation_id` int(11) NOT NULL,
  `quotation_number` varchar(50) NOT NULL,
  `lead_id` int(11) NOT NULL,
  `client_name` varchar(100) NOT NULL,
  `valid_until` date NOT NULL,
  `subtotal` decimal(12,2) NOT NULL,
  `gst_amount` decimal(12,2) NOT NULL,
  `total_amount` decimal(12,2) NOT NULL,
  `status` enum('draft','sent','accepted','rejected') DEFAULT 'draft',
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `quotation_items`
--

CREATE TABLE `quotation_items` (
  `item_id` int(11) NOT NULL,
  `quotation_id` int(11) NOT NULL,
  `description` text NOT NULL,
  `quantity` decimal(10,2) NOT NULL,
  `rate` decimal(10,2) NOT NULL,
  `amount` decimal(12,2) GENERATED ALWAYS AS (`quantity` * `rate`) VIRTUAL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `quotes`
--

CREATE TABLE `quotes` (
  `quote_id` int(11) NOT NULL,
  `project_id` int(11) NOT NULL,
  `quote_number` varchar(50) NOT NULL,
  `version` int(11) DEFAULT 1,
  `total_amount` decimal(15,2) DEFAULT 0.00,
  `status` enum('draft','sent','approved','rejected') DEFAULT 'draft',
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `quote_items`
--

CREATE TABLE `quote_items` (
  `item_id` int(11) NOT NULL,
  `section_id` int(11) NOT NULL,
  `particulars` varchar(255) NOT NULL,
  `brand` varchar(100) DEFAULT NULL,
  `unit` varchar(20) DEFAULT NULL,
  `quantity` decimal(12,2) DEFAULT 0.00,
  `rate` decimal(15,2) DEFAULT 0.00,
  `amount` decimal(15,2) DEFAULT 0.00,
  `display_order` int(11) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `quote_sections`
--

CREATE TABLE `quote_sections` (
  `section_id` int(11) NOT NULL,
  `quote_id` int(11) NOT NULL,
  `section_name` varchar(100) NOT NULL,
  `display_order` int(11) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `system_settings`
--

CREATE TABLE `system_settings` (
  `setting_id` int(11) NOT NULL,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text DEFAULT NULL,
  `description` text DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `user_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `username` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('principal_architect','admin','accountant','project_head','site_engineer') NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `employee_id` varchar(20) DEFAULT NULL,
  `profile_photo` varchar(255) DEFAULT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`user_id`, `name`, `username`, `password`, `role`, `phone`, `employee_id`, `profile_photo`, `status`, `created_at`, `updated_at`) VALUES
(1, 'Super Admin', 'admin', '$2y$10$AkBCmzz2SwvX9IqPxYC1A.BF6jNk54sgJlPjfElk0f3feE47eHYfK', 'principal_architect', NULL, 'Livincart001', NULL, 'active', '2026-04-18 07:27:08', '2026-04-18 10:16:48'),
(3, 'Rani', 'Rani', '$2y$10$myMIpH7bmxvK9FI.h.g4GOPsYWiZFPjI.2P.LN1KIbKFmtnwYV73e', 'accountant', '123456789', '1000', NULL, 'active', '2026-04-18 07:29:51', '2026-04-18 07:33:43'),
(4, 'Ravi', 'Ravi', '$2y$10$beFrNlhpCFRZoIrUP3AzGuLVzltYwJ2/zmtM9gdYuXvYxcwxw46HO', 'admin', '987654321', '2000', NULL, 'active', '2026-04-18 07:33:06', '2026-04-18 07:33:06'),
(5, 'Ramesh', 'Ramesh', '$2y$10$cZcHdvX.dhguKjyPvp3qI.VKOKvDEpfMJjXsDYhpR.B.PMqGy3Ykq', 'site_engineer', '123798465', '3000', NULL, 'active', '2026-04-18 07:37:46', '2026-04-18 07:37:46'),
(6, 'Rahul', 'Rahul', '$2y$10$CsbjTS3ZU13SnKVLtsoRguMzjGOS6QX81G5B51d5vqQApqK2SORm2', 'admin', '465132798', '4000', NULL, 'inactive', '2026-04-18 07:38:35', '2026-04-20 11:09:38'),
(7, 'Raju', 'raju', '$2y$10$Ox4.TpmawwF0GJsIYkL8nukHJtLIOnS7Fpc.yPwZ9IBeFrkUdodGW', 'project_head', '040404000', '8000', NULL, 'active', '2026-04-20 11:11:32', '2026-04-20 11:11:32');

-- --------------------------------------------------------

--
-- Table structure for table `vendors`
--

CREATE TABLE `vendors` (
  `vendor_id` int(11) NOT NULL,
  `vendor_code` varchar(20) NOT NULL,
  `vendor_name` varchar(100) NOT NULL,
  `category` varchar(50) NOT NULL,
  `contact_person` varchar(100) DEFAULT NULL,
  `phone` varchar(20) NOT NULL,
  `email` varchar(100) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `gst_number` varchar(20) DEFAULT NULL,
  `payment_terms_days` int(11) DEFAULT 30,
  `bank_details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`bank_details`)),
  `status` enum('active','inactive') DEFAULT 'active',
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `activity_logs`
--
ALTER TABLE `activity_logs`
  ADD PRIMARY KEY (`log_id`),
  ADD KEY `idx_user_module` (`user_id`,`module`),
  ADD KEY `idx_created_at` (`created_at`);

--
-- Indexes for table `attendance`
--
ALTER TABLE `attendance`
  ADD PRIMARY KEY (`attendance_id`),
  ADD UNIQUE KEY `unique_user_date` (`user_id`,`date`),
  ADD KEY `mLivincarted_by` (`mLivincarted_by`),
  ADD KEY `idx_user_date` (`user_id`,`date`),
  ADD KEY `idx_project_date` (`project_id`,`date`);

--
-- Indexes for table `clients`
--
ALTER TABLE `clients`
  ADD PRIMARY KEY (`client_id`),
  ADD UNIQUE KEY `client_code` (`client_code`),
  ADD KEY `converted_from_lead_id` (`converted_from_lead_id`),
  ADD KEY `created_by` (`created_by`),
  ADD KEY `idx_client_code` (`client_code`),
  ADD KEY `idx_status` (`status`);

--
-- Indexes for table `client_payments`
--
ALTER TABLE `client_payments`
  ADD PRIMARY KEY (`payment_id`),
  ADD KEY `created_by` (`created_by`),
  ADD KEY `idx_project_date` (`project_id`,`payment_date`),
  ADD KEY `idx_client_id` (`client_id`);

--
-- Indexes for table `expenses`
--
ALTER TABLE `expenses`
  ADD PRIMARY KEY (`expense_id`),
  ADD KEY `vendor_id` (`vendor_id`),
  ADD KEY `approved_by` (`approved_by`),
  ADD KEY `created_by` (`created_by`),
  ADD KEY `idx_project_category` (`project_id`,`expense_category`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_payment_date` (`payment_date`);

--
-- Indexes for table `finance_transactions`
--
ALTER TABLE `finance_transactions`
  ADD PRIMARY KEY (`transaction_id`),
  ADD KEY `project_id` (`project_id`),
  ADD KEY `recorded_by` (`recorded_by`);

--
-- Indexes for table `inventory`
--
ALTER TABLE `inventory`
  ADD PRIMARY KEY (`inventory_id`),
  ADD KEY `vendor_id` (`vendor_id`),
  ADD KEY `created_by` (`created_by`),
  ADD KEY `idx_project_category` (`project_id`,`material_category`),
  ADD KEY `idx_current_stock` (`current_stock`);

--
-- Indexes for table `inventory_usage`
--
ALTER TABLE `inventory_usage`
  ADD PRIMARY KEY (`usage_id`),
  ADD KEY `used_by` (`used_by`),
  ADD KEY `idx_inventory_date` (`inventory_id`,`usage_date`),
  ADD KEY `idx_project_date` (`project_id`,`usage_date`);

--
-- Indexes for table `invoices`
--
ALTER TABLE `invoices`
  ADD PRIMARY KEY (`invoice_id`),
  ADD UNIQUE KEY `invoice_number` (`invoice_number`),
  ADD KEY `client_id` (`client_id`),
  ADD KEY `created_by` (`created_by`),
  ADD KEY `idx_invoice_number` (`invoice_number`),
  ADD KEY `idx_project_id` (`project_id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_payment_status` (`payment_status`);

--
-- Indexes for table `invoice_items`
--
ALTER TABLE `invoice_items`
  ADD PRIMARY KEY (`item_id`),
  ADD KEY `idx_invoice_id` (`invoice_id`);

--
-- Indexes for table `leads`
--
ALTER TABLE `leads`
  ADD PRIMARY KEY (`lead_id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_created_by` (`created_by`),
  ADD KEY `idx_assigned_to` (`assigned_to`);

--
-- Indexes for table `leaves`
--
ALTER TABLE `leaves`
  ADD PRIMARY KEY (`leave_id`),
  ADD KEY `approved_by` (`approved_by`),
  ADD KEY `idx_user_status` (`user_id`,`status`),
  ADD KEY `idx_dates` (`from_date`,`to_date`);

--
-- Indexes for table `material_requests`
--
ALTER TABLE `material_requests`
  ADD PRIMARY KEY (`request_id`),
  ADD KEY `project_id` (`project_id`),
  ADD KEY `requested_by` (`requested_by`),
  ADD KEY `approved_by` (`approved_by`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`notification_id`),
  ADD KEY `idx_user_read` (`user_id`,`is_read`),
  ADD KEY `idx_created_at` (`created_at`);

--
-- Indexes for table `projects`
--
ALTER TABLE `projects`
  ADD PRIMARY KEY (`project_id`),
  ADD UNIQUE KEY `project_code` (`project_code`),
  ADD KEY `created_by` (`created_by`),
  ADD KEY `idx_project_code` (`project_code`),
  ADD KEY `idx_client_id` (`client_id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_project_head_id` (`project_head_id`),
  ADD KEY `idx_dates` (`start_date`,`expected_end_date`);

--
-- Indexes for table `project_assignments`
--
ALTER TABLE `project_assignments`
  ADD PRIMARY KEY (`assignment_id`),
  ADD KEY `idx_project_user` (`project_id`,`user_id`),
  ADD KEY `idx_user_active` (`user_id`,`status`);

--
-- Indexes for table `project_budget`
--
ALTER TABLE `project_budget`
  ADD PRIMARY KEY (`budget_id`),
  ADD UNIQUE KEY `unique_project_category` (`project_id`,`category`),
  ADD KEY `created_by` (`created_by`),
  ADD KEY `idx_project_id` (`project_id`);

--
-- Indexes for table `project_inventory`
--
ALTER TABLE `project_inventory`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `project_timeline`
--
ALTER TABLE `project_timeline`
  ADD PRIMARY KEY (`timeline_id`),
  ADD KEY `created_by` (`created_by`),
  ADD KEY `idx_project_status` (`project_id`,`status`),
  ADD KEY `idx_dates` (`start_date`,`end_date`),
  ADD KEY `idx_assigned_to` (`assigned_to`);

--
-- Indexes for table `quotations`
--
ALTER TABLE `quotations`
  ADD PRIMARY KEY (`quotation_id`),
  ADD UNIQUE KEY `quotation_number` (`quotation_number`),
  ADD KEY `created_by` (`created_by`),
  ADD KEY `idx_quotation_number` (`quotation_number`),
  ADD KEY `idx_lead_id` (`lead_id`);

--
-- Indexes for table `quotation_items`
--
ALTER TABLE `quotation_items`
  ADD PRIMARY KEY (`item_id`),
  ADD KEY `idx_quotation_id` (`quotation_id`);

--
-- Indexes for table `quotes`
--
ALTER TABLE `quotes`
  ADD PRIMARY KEY (`quote_id`),
  ADD UNIQUE KEY `quote_number` (`quote_number`),
  ADD KEY `project_id` (`project_id`);

--
-- Indexes for table `quote_items`
--
ALTER TABLE `quote_items`
  ADD PRIMARY KEY (`item_id`),
  ADD KEY `section_id` (`section_id`);

--
-- Indexes for table `quote_sections`
--
ALTER TABLE `quote_sections`
  ADD PRIMARY KEY (`section_id`),
  ADD KEY `quote_id` (`quote_id`);

--
-- Indexes for table `system_settings`
--
ALTER TABLE `system_settings`
  ADD PRIMARY KEY (`setting_id`),
  ADD UNIQUE KEY `setting_key` (`setting_key`),
  ADD KEY `updated_by` (`updated_by`),
  ADD KEY `idx_setting_key` (`setting_key`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD UNIQUE KEY `employee_id` (`employee_id`),
  ADD KEY `idx_role` (`role`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_username` (`username`);

--
-- Indexes for table `vendors`
--
ALTER TABLE `vendors`
  ADD PRIMARY KEY (`vendor_id`),
  ADD UNIQUE KEY `vendor_code` (`vendor_code`),
  ADD KEY `created_by` (`created_by`),
  ADD KEY `idx_vendor_code` (`vendor_code`),
  ADD KEY `idx_category` (`category`),
  ADD KEY `idx_status` (`status`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `activity_logs`
--
ALTER TABLE `activity_logs`
  MODIFY `log_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `attendance`
--
ALTER TABLE `attendance`
  MODIFY `attendance_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `clients`
--
ALTER TABLE `clients`
  MODIFY `client_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=20;

--
-- AUTO_INCREMENT for table `client_payments`
--
ALTER TABLE `client_payments`
  MODIFY `payment_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `expenses`
--
ALTER TABLE `expenses`
  MODIFY `expense_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `finance_transactions`
--
ALTER TABLE `finance_transactions`
  MODIFY `transaction_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `inventory`
--
ALTER TABLE `inventory`
  MODIFY `inventory_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `inventory_usage`
--
ALTER TABLE `inventory_usage`
  MODIFY `usage_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `invoices`
--
ALTER TABLE `invoices`
  MODIFY `invoice_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `invoice_items`
--
ALTER TABLE `invoice_items`
  MODIFY `item_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `leads`
--
ALTER TABLE `leads`
  MODIFY `lead_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `leaves`
--
ALTER TABLE `leaves`
  MODIFY `leave_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `material_requests`
--
ALTER TABLE `material_requests`
  MODIFY `request_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `notification_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `projects`
--
ALTER TABLE `projects`
  MODIFY `project_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `project_assignments`
--
ALTER TABLE `project_assignments`
  MODIFY `assignment_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=20;

--
-- AUTO_INCREMENT for table `project_budget`
--
ALTER TABLE `project_budget`
  MODIFY `budget_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `project_inventory`
--
ALTER TABLE `project_inventory`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT for table `project_timeline`
--
ALTER TABLE `project_timeline`
  MODIFY `timeline_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=89;

--
-- AUTO_INCREMENT for table `quotations`
--
ALTER TABLE `quotations`
  MODIFY `quotation_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `quotation_items`
--
ALTER TABLE `quotation_items`
  MODIFY `item_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `quotes`
--
ALTER TABLE `quotes`
  MODIFY `quote_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `quote_items`
--
ALTER TABLE `quote_items`
  MODIFY `item_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `quote_sections`
--
ALTER TABLE `quote_sections`
  MODIFY `section_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `system_settings`
--
ALTER TABLE `system_settings`
  MODIFY `setting_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `user_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `vendors`
--
ALTER TABLE `vendors`
  MODIFY `vendor_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `activity_logs`
--
ALTER TABLE `activity_logs`
  ADD CONSTRAINT `activity_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `attendance`
--
ALTER TABLE `attendance`
  ADD CONSTRAINT `attendance_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `attendance_ibfk_2` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `attendance_ibfk_3` FOREIGN KEY (`mLivincarted_by`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `clients`
--
ALTER TABLE `clients`
  ADD CONSTRAINT `clients_ibfk_1` FOREIGN KEY (`converted_from_lead_id`) REFERENCES `leads` (`lead_id`),
  ADD CONSTRAINT `clients_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `client_payments`
--
ALTER TABLE `client_payments`
  ADD CONSTRAINT `client_payments_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `client_payments_ibfk_2` FOREIGN KEY (`client_id`) REFERENCES `clients` (`client_id`),
  ADD CONSTRAINT `client_payments_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `expenses`
--
ALTER TABLE `expenses`
  ADD CONSTRAINT `expenses_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `expenses_ibfk_2` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`vendor_id`),
  ADD CONSTRAINT `expenses_ibfk_3` FOREIGN KEY (`approved_by`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `expenses_ibfk_4` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `finance_transactions`
--
ALTER TABLE `finance_transactions`
  ADD CONSTRAINT `finance_transactions_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `finance_transactions_ibfk_2` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `inventory`
--
ALTER TABLE `inventory`
  ADD CONSTRAINT `inventory_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `inventory_ibfk_2` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`vendor_id`),
  ADD CONSTRAINT `inventory_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `inventory_usage`
--
ALTER TABLE `inventory_usage`
  ADD CONSTRAINT `inventory_usage_ibfk_1` FOREIGN KEY (`inventory_id`) REFERENCES `inventory` (`inventory_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `inventory_usage_ibfk_2` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `inventory_usage_ibfk_3` FOREIGN KEY (`used_by`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `invoices`
--
ALTER TABLE `invoices`
  ADD CONSTRAINT `invoices_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `invoices_ibfk_2` FOREIGN KEY (`client_id`) REFERENCES `clients` (`client_id`),
  ADD CONSTRAINT `invoices_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `invoice_items`
--
ALTER TABLE `invoice_items`
  ADD CONSTRAINT `invoice_items_ibfk_1` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`invoice_id`) ON DELETE CASCADE;

--
-- Constraints for table `leads`
--
ALTER TABLE `leads`
  ADD CONSTRAINT `leads_ibfk_1` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `leads_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `leaves`
--
ALTER TABLE `leaves`
  ADD CONSTRAINT `leaves_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `leaves_ibfk_2` FOREIGN KEY (`approved_by`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `material_requests`
--
ALTER TABLE `material_requests`
  ADD CONSTRAINT `material_requests_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `material_requests_ibfk_2` FOREIGN KEY (`requested_by`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `material_requests_ibfk_3` FOREIGN KEY (`approved_by`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE;

--
-- Constraints for table `projects`
--
ALTER TABLE `projects`
  ADD CONSTRAINT `projects_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`client_id`),
  ADD CONSTRAINT `projects_ibfk_2` FOREIGN KEY (`project_head_id`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `projects_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `project_assignments`
--
ALTER TABLE `project_assignments`
  ADD CONSTRAINT `project_assignments_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `project_assignments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `project_budget`
--
ALTER TABLE `project_budget`
  ADD CONSTRAINT `project_budget_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `project_budget_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `project_timeline`
--
ALTER TABLE `project_timeline`
  ADD CONSTRAINT `project_timeline_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `project_timeline_ibfk_2` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `project_timeline_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `quotations`
--
ALTER TABLE `quotations`
  ADD CONSTRAINT `quotations_ibfk_1` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`lead_id`),
  ADD CONSTRAINT `quotations_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `quotation_items`
--
ALTER TABLE `quotation_items`
  ADD CONSTRAINT `quotation_items_ibfk_1` FOREIGN KEY (`quotation_id`) REFERENCES `quotations` (`quotation_id`) ON DELETE CASCADE;

--
-- Constraints for table `quotes`
--
ALTER TABLE `quotes`
  ADD CONSTRAINT `quotes_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`);

--
-- Constraints for table `quote_items`
--
ALTER TABLE `quote_items`
  ADD CONSTRAINT `quote_items_ibfk_1` FOREIGN KEY (`section_id`) REFERENCES `quote_sections` (`section_id`) ON DELETE CASCADE;

--
-- Constraints for table `quote_sections`
--
ALTER TABLE `quote_sections`
  ADD CONSTRAINT `quote_sections_ibfk_1` FOREIGN KEY (`quote_id`) REFERENCES `quotes` (`quote_id`) ON DELETE CASCADE;

--
-- Constraints for table `system_settings`
--
ALTER TABLE `system_settings`
  ADD CONSTRAINT `system_settings_ibfk_1` FOREIGN KEY (`updated_by`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `vendors`
--
ALTER TABLE `vendors`
  ADD CONSTRAINT `vendors_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
