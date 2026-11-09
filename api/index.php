<?php
// api/index.php

// ── CRITICAL: Suppress ALL PHP warnings/notices from HTTP output ──
// PHP warnings (e.g. from Dompdf SVG parsing) would corrupt JSON responses
// if allowed to print to the response body. Log errors to file only.
@ini_set('display_errors', '0');
@ini_set('display_startup_errors', '0');
@ini_set('log_errors', '1');
error_reporting(E_ALL & ~E_DEPRECATED & ~E_STRICT);

@ini_set('upload_max_filesize', '1024M');
@ini_set('post_max_size', '1024M');
@ini_set('memory_limit', '1024M');
@ini_set('max_execution_time', '1800');
@ini_set('max_input_time', '1800');

// CORS Headers — allow both local dev and production frontend
$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header("Access-Control-Allow-Origin: " . ($origin ? $origin : "*"));
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE, PATCH', true);
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-User-Id, X-User-Role, *', true);
header('Access-Control-Max-Age: 86400');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

header("Content-Type: application/json; charset=UTF-8");

// ── Global Exception & Fatal Error Handlers ──
set_exception_handler(function ($e) {
    http_response_code(500);
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=UTF-8');
    }
    echo json_encode([
        "success" => false,
        "error" => $e->getMessage(),
        "file" => basename($e->getFile()),
        "line" => $e->getLine()
    ]);
    exit;
});

register_shutdown_function(function () {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        http_response_code(500);
        if (!headers_sent()) {
            header('Content-Type: application/json; charset=UTF-8');
        }
        echo json_encode([
            "success" => false,
            "fatal_error" => $err['message'],
            "file" => basename($err['file']),
            "line" => $err['line']
        ]);
    }
});

require_once 'config/database.php';
require_once 'controllers/AuthController.php';
require_once 'controllers/UserController.php';
require_once 'controllers/LeadController.php';
require_once 'controllers/ClientController.php';
require_once 'controllers/ProjectController.php';
require_once 'controllers/InventoryController.php';
require_once 'controllers/FinanceController.php';
require_once 'controllers/QuoteController.php';
require_once 'controllers/DashboardController.php';
require_once 'controllers/TimelineController.php';
require_once 'controllers/VendorController.php';
require_once 'controllers/StockCategoryController.php';
require_once 'controllers/TeamTargetController.php';
require_once 'controllers/ProjectTrackerController.php';
require_once 'controllers/MonthlyIncomeController.php';
require_once 'controllers/CivilEstimateController.php';
require_once 'controllers/NotificationController.php';
require_once 'controllers/GDTaskController.php';
require_once 'controllers/ReimbursementController.php';
require_once 'controllers/MBTaskController.php';
require_once 'controllers/PDFCommentController.php';
require_once 'controllers/PrintTokenHelper.php';
require_once 'controllers/PdfController.php';
require_once 'controllers/VendorQuotaController.php';
require_once 'controllers/MainVendorController.php';
require_once 'controllers/QCController.php';
if (file_exists(__DIR__ . '/controllers/PromoCodeController.php')) require_once __DIR__ . '/controllers/PromoCodeController.php';
if (file_exists(__DIR__ . '/controllers/ContractLabourController.php')) require_once __DIR__ . '/controllers/ContractLabourController.php';
if (file_exists(__DIR__ . '/controllers/RolePermissionController.php')) require_once __DIR__ . '/controllers/RolePermissionController.php';
if (file_exists(__DIR__ . '/controllers/CategoryDiscountController.php')) require_once __DIR__ . '/controllers/CategoryDiscountController.php';


// Simple Router
$request_uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
// Dynamically detect base path — works on both localhost/Livincart/api and Hostinger root
$script_dir = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/');
$path = $script_dir ? str_replace($script_dir . '/', '', $request_uri) : ltrim($request_uri, '/');
$path_parts = explode('/', trim($path, '/'));

$resource = $path_parts[0] ?? null;
$id = $path_parts[1] ?? null;

// Extract User headers for Role-Based Access Control
$current_user_id = $_SERVER['HTTP_X_USER_ID'] ?? null;
$current_user_role = $_SERVER['HTTP_X_USER_ROLE'] ?? null;

// Fallback to getallheaders if needed, though $_SERVER is safer
if (!$current_user_id && function_exists('getallheaders')) {
    $headers = getallheaders();
    $headers_lower = array_change_key_case($headers, CASE_LOWER);
    $current_user_id = $headers_lower['x-user-id'] ?? null;
    $current_user_role = $headers_lower['x-user-role'] ?? null;
}

$db = new Database();
$conn = $db->getConnection();

if (!$resource) {
    echo json_encode(["message" => "Welcome to Livincart Architects PM System API"]);
    exit;
}
$input = json_decode(file_get_contents("php://input"), true);

// Map resources to controllers
switch ($resource) {
    case 'auth':
        $auth = new AuthController($conn);
        if (isset($path_parts[1]) && $path_parts[1] === 'login' && $_SERVER['REQUEST_METHOD'] === 'POST') {
            echo json_encode($auth->login($input['username'], $input['password']));
        } elseif (isset($path_parts[1]) && $path_parts[1] === 'forgot-password' && $_SERVER['REQUEST_METHOD'] === 'POST') {
            echo json_encode($auth->forgotPassword($input['email']));
        } elseif (isset($path_parts[1]) && $path_parts[1] === 'reset-password' && $_SERVER['REQUEST_METHOD'] === 'POST') {
            echo json_encode($auth->resetPassword($input['token'], $input['password']));
        }
        break;
    case 'users':
        $user = new UserController($conn);
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            if (isset($path_parts[1]) && $path_parts[1] === 'soft-delete') {
                echo json_encode($user->softDelete($input['user_id'] ?? 0));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'restore') {
                echo json_encode($user->restore($input['user_id'] ?? 0));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'status') {
                echo json_encode($user->updateStatus($input['user_id'] ?? 0, $input['status'] ?? 'active'));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'permanent-delete') {
                echo json_encode($user->hardDelete($input['user_id'] ?? 0));
            } else {
                echo json_encode($user->create($input));
            }
        } elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
            echo json_encode(["success" => true, "data" => $user->getAll()]);
        } elseif ($_SERVER['REQUEST_METHOD'] === 'DELETE' && isset($path_parts[1])) {
            echo json_encode($user->softDelete($path_parts[1]));
        } elseif ($_SERVER['REQUEST_METHOD'] === 'PUT') {
            echo json_encode($user->update($input));
        }
        break;
    case 'role-permissions':
        $rolePermCtrl = new RolePermissionController($conn);
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            echo json_encode($rolePermCtrl->getAll());
        } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
            if (isset($path_parts[1]) && $path_parts[1] === 'reset') {
                echo json_encode($rolePermCtrl->resetRole($input['role'] ?? 'all'));
            } else {
                echo json_encode($rolePermCtrl->save($input));
            }
        }
        break;
    case 'role-project-tab-permissions':
    case 'role-tab-permissions':
        $rolePermCtrl = new RolePermissionController($conn);
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            echo json_encode($rolePermCtrl->getAllTabPermissions());
        } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
            if (isset($path_parts[1]) && $path_parts[1] === 'reset') {
                echo json_encode($rolePermCtrl->resetTabPermissions($input['role'] ?? 'all'));
            } else {
                echo json_encode($rolePermCtrl->saveTabPermissions($input));
            }
        }
        break;
    case 'leads':
        $lead = new LeadController($conn, $current_user_id, $current_user_role);
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            if (isset($path_parts[1]) && $path_parts[1] === 'update-status') {
                echo json_encode($lead->updateStatus($input['lead_id'], $input['status'], $input['data'] ?? null));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'book-d1') {
                echo json_encode($lead->bookD1Slot(
                    $input['lead_id'], 
                    $input['d1_user_id'] ?? null, 
                    $input['booking_time'], 
                    $input['assigned_by_name'] ?? 'Admin', 
                    $input['d1_notes'] ?? null, 
                    $input['status'] ?? null,
                    $input['associate_designer_assigned_id'] ?? null,
                    $input['associate_designer_assigned_name'] ?? null
                ));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'book-mmts') {
                echo json_encode($lead->bookMMTSSlot($input['lead_id'], $input['booking_time'], $input['assigned_by_name'] ?? 'User', $input['mmts_notes'] ?? $input['notes'] ?? null, $input));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'update-mmts-status') {
                echo json_encode($lead->updateMMTSStatus($input['lead_id'], $input['status'], $input['assigned_by_name'] ?? 'User'));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'book-qc') {
                echo json_encode($lead->bookQCSlot($input['lead_id'], $input['booking_time'], $input['assigned_by_name'] ?? 'User', $input['qc_notes'] ?? $input['notes'] ?? null, $input));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'update-qc-status') {
                $targetId = $input['lead_id'] ?? $input['manual_client_id'] ?? $input['project_code'] ?? 0;
                echo json_encode($lead->updateQCStatus($targetId, $input['status'], $input['assigned_by_name'] ?? 'User'));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'send-agreement-pdf') {
                echo json_encode($lead->sendAgreementPDF($input));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'book-site-manager') {
                echo json_encode(['success' => $lead->bookSiteManagerSlot($input['lead_id'], $input['site_manager_id'], $input['booking_time'], $input['assigned_by_name'], $input['notes'] ?? null)]);
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'book-multi-role') {
                echo json_encode($lead->bookMultiRoleSlot($input));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'notes') {
                echo json_encode($lead->addNote($input['lead_id'], $input['note_text']));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'upload') {
                $lead_id = $_POST['lead_id'] ?? $_REQUEST['lead_id'] ?? 0;
                $folder = $_POST['folder'] ?? $_REQUEST['folder'] ?? '';
                $file = $_FILES['file'] ?? null;
                echo json_encode($lead->uploadFile($lead_id, $file, $folder));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'update-client-signature') {
                $pCtrl = new ProjectController($conn, $current_user_id, $current_user_role);
                $pId = $input['project_id'] ?? null;
                $sig = $input['signature'] ?? $input['client_signature'] ?? null;
                $lId = $input['lead_id'] ?? $input['id'] ?? null;
                echo json_encode($pCtrl->updateClientSignature($pId, $sig, $lId));
            } else {
                echo json_encode($lead->create($input));
            }
        } elseif ($_SERVER['REQUEST_METHOD'] === 'PUT') {
            echo json_encode($lead->update($input));
        } elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
            if (isset($path_parts[1]) && $path_parts[1] === 'notes') {
                echo json_encode(["success" => true, "data" => $lead->getNotes($_GET['lead_id'] ?? 0)]);
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'files') {
                echo json_encode(["success" => true, "data" => $lead->getFiles($_GET['lead_id'] ?? 0, $_GET['folder'] ?? '')]);
            } else {
                echo json_encode(["success" => true, "data" => $lead->getAll()]);
            }
        } elseif ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
            if (isset($path_parts[1]) && $path_parts[1] === 'files') {
                echo json_encode($lead->deleteFile($_GET['lead_id'] ?? 0, $_GET['filename'] ?? '', $_GET['folder'] ?? ''));
            } else {
                echo json_encode($lead->delete($_GET['id'] ?? 0));
            }
        }
        break;
    case 'notifications':
        $notif = new NotificationController($conn);
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            if (isset($path_parts[1]) && $path_parts[1] === 'support-queries') {
                echo json_encode($notif->getSupportQueries($_GET['user_id'] ?? null, $_GET['role'] ?? null));
            } else {
                echo json_encode($notif->getUnread($_GET['user_id'] ?? 0));
            }
        } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
            if (isset($path_parts[1]) && $path_parts[1] === 'read') {
                echo json_encode($notif->markAsRead($input['notification_id'] ?? 0));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'notify-admin') {
                $title = $input['title'] ?? 'Designer Timeline Task Approval Request';
                $message = $input['message'] ?? 'A timeline task is pending approval.';
                echo json_encode($notif->notifyAdmins($title, $message));
            } elseif (isset($path_parts[1]) && ($path_parts[1] === 'submit-help' || $path_parts[1] === 'help-query' || $path_parts[1] === 'feedback')) {
                echo json_encode($notif->submitHelpQuery($input ?? []));
            } elseif (isset($path_parts[1]) && ($path_parts[1] === 'reply-support-query' || $path_parts[1] === 'reply-help' || $path_parts[1] === 'reply')) {
                echo json_encode($notif->replySupportQuery($input ?? []));
            }
        }
        break;
    case 'clients':
        $client = new ClientController($conn, $current_user_id, $current_user_role);
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            if (isset($path_parts[1])) {
                echo json_encode(["success" => true, "data" => $client->getDetails($path_parts[1])]);
            } else {
                echo json_encode(["success" => true, "data" => $client->getAll()]);
            }
        } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $result = $client->create($input);
            if ($result) {
                echo json_encode($result);
            } else {
                echo json_encode(["success" => false, "message" => "Failed to create client"]);
            }
        } elseif ($_SERVER['REQUEST_METHOD'] === 'PUT') {
            echo json_encode($client->update($input));
        } elseif ($_SERVER['REQUEST_METHOD'] === 'DELETE' && isset($path_parts[1])) {
            echo json_encode($client->delete($path_parts[1]));
        }
        break;
    case 'documents':
        require_once 'controllers/DocumentController.php';
        $doc = new DocumentController($conn);
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            if (isset($path_parts[1]) && $path_parts[1] === 'notes') {
                echo json_encode($doc->getNotes($_GET['project_id'] ?? 0));
            } elseif (isset($_GET['project_id']) && !isset($_GET['folder_id'])) {
                echo json_encode($doc->getFolders($_GET['project_id']));
            } elseif (isset($_GET['folder_id'])) {
                echo json_encode($doc->getFiles($_GET['folder_id']));
            }
        } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
            if (isset($path_parts[1]) && $path_parts[1] === 'notes') {
                $uid = $input['user_id'] ?? $current_user_id ?? 1;
                echo json_encode($doc->addNote($input['project_id'], $input['note_text'], $uid));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'upload') {
                echo json_encode($doc->uploadFile($_POST['project_id'], $_POST['folder_id'], $_FILES['file'] ?? null, $_POST['user_id']));
            } else {
                echo json_encode($doc->createFolder($input['project_id'], $input['name']));
            }
        } elseif ($_SERVER['REQUEST_METHOD'] === 'DELETE' && isset($path_parts[1])) {
            echo json_encode($doc->deleteFile($path_parts[1]));
        }
        break;
    case 'projects':
        $project = new ProjectController($conn, $current_user_id, $current_user_role);
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            if (isset($path_parts[1]) && $path_parts[1] === 'update-status') {
                echo json_encode($project->updateStatus($input['project_id'], $input['status']));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'update-stage') {
                echo json_encode($project->updateStage($input['project_id'], $input['stage']));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'update-stage5-state') {
                echo json_encode($project->updateStage5State($input['project_id'], $input['state']));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'update-budget') {
                echo json_encode($project->updateBudget($input['project_id'], $input['budget']));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'update-client-signature') {
                $pId = $input['project_id'] ?? $input['id'] ?? null;
                $sig = $input['signature'] ?? $input['client_signature'] ?? null;
                $lId = $input['lead_id'] ?? null;
                echo json_encode($project->updateClientSignature($pId, $sig, $lId));
            } else {
                echo json_encode($project->create($input));
            }
        } elseif ($_SERVER['REQUEST_METHOD'] === 'PUT') {
            echo json_encode($project->update($input['project_id'] ?? $path_parts[1], $input));
        } elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
            if (isset($path_parts[1]) && $path_parts[1] === 'next-code') {
                $type = $_GET['type'] ?? null;
                echo json_encode(["success" => true, "code" => $project->generateNextCode($type)]);
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'team') {
                echo json_encode(["success" => true, "data" => $project->getTeamMembers($path_parts[2])]);
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'financial-overview') {
                echo json_encode($project->getFinancialOverview());
            } elseif (isset($path_parts[1]) && is_numeric($path_parts[1])) {
                $eff_uid = $current_user_id ?? ($_GET['user_id'] ?? null);
                $eff_role = $current_user_role ?? ($_GET['role'] ?? null);
                $stats = $project->getDetailedStats($path_parts[1], $eff_uid, $eff_role);
                if ($stats) {
                    echo json_encode(["success" => true, "data" => $stats]);
                } else {
                    echo json_encode(["success" => false, "message" => "Access denied or project not found."]);
                }
            } elseif (isset($path_parts[1]) && !empty($path_parts[1]) && $path_parts[1] !== 'team' && $path_parts[1] !== 'financial-overview') {
                // Non-numeric ID (e.g. 'pe-11'): resolve via project_code OR leads.manual_client_id chain
                $raw_id = $path_parts[1];
                $resolved_pid = null;

                // 1. Try project_code directly on projects table
                try {
                    $rStmt = $conn->prepare("SELECT project_id FROM projects WHERE project_code = :code LIMIT 1");
                    $rStmt->execute([':code' => $raw_id]);
                    $rRow = $rStmt->fetch(PDO::FETCH_ASSOC);
                    if ($rRow) $resolved_pid = $rRow['project_id'];
                } catch (Exception $e) {}

                // 2. Try leads.manual_client_id → client.converted_from_lead_id → project
                if (!$resolved_pid) {
                    try {
                        $lStmt = $conn->prepare("SELECT lead_id FROM leads WHERE manual_client_id = :mid LIMIT 1");
                        $lStmt->execute([':mid' => $raw_id]);
                        $lRow = $lStmt->fetch(PDO::FETCH_ASSOC);
                        $lId = $lRow['lead_id'] ?? null;
                        if ($lId) {
                            $pStmt = $conn->prepare("SELECT p.project_id FROM projects p JOIN clients c ON p.client_id = c.client_id WHERE c.converted_from_lead_id = :lid LIMIT 1");
                            $pStmt->execute([':lid' => $lId]);
                            $pRow = $pStmt->fetch(PDO::FETCH_ASSOC);
                            if ($pRow) $resolved_pid = $pRow['project_id'];
                        }
                    } catch (Exception $e) {}
                }

                if ($resolved_pid) {
                    $eff_uid = $current_user_id ?? ($_GET['user_id'] ?? null);
                    $eff_role = $current_user_role ?? ($_GET['role'] ?? null);
                    $stats = $project->getDetailedStats($resolved_pid, $eff_uid, $eff_role);
                    if ($stats) {
                        echo json_encode(["success" => true, "data" => $stats]);
                    } else {
                        echo json_encode(["success" => false, "message" => "Access denied or project not found."]);
                    }
                } else {
                    echo json_encode(["success" => false, "message" => "Project not found for ID: $raw_id"]);
                }
            } else {
                $u_id = $_GET['user_id'] ?? $current_user_id ?? null;
                $role = $_GET['role'] ?? $current_user_role ?? null;
                echo json_encode(["success" => true, "data" => $project->getAll($u_id, $role)]);
            }
        } elseif ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
            echo json_encode($project->delete($path_parts[1]));
        }
        break;
    case 'inventory':
        $inventory = new InventoryController($conn);
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            if (isset($path_parts[1]) && $path_parts[1] === 'request') {
                echo json_encode($inventory->createRequest($input));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'update-request') {
                echo json_encode($inventory->updateRequestStatus($input['request_id'], $input['status'], $input['user_id']));
            }
        } elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
            if (isset($path_parts[1]) && $path_parts[1] === 'requests') {
                $p_id = $path_parts[2] ?? null;
                echo json_encode(["success" => true, "data" => $inventory->getPendingRequests($p_id)]);
            } else {
                echo json_encode(["success" => true, "data" => $inventory->getProjectInventory($path_parts[1])]);
            }
        } elseif ($_SERVER['REQUEST_METHOD'] === 'PUT') {
            // Handle stock status update or quantity_used update
            $data = $input;
            $id = $data['id'] ?? 0;

            if (!$id) {
                echo json_encode([
                    "status" => "error",
                    "message" => "Item ID missing"
                ]);
                break;
            }

            // Check if updating quantity_used or stock_status
            if (isset($data['quantity_used'])) {
                // Add quantity_used column if it doesn't exist
                try {
                    $conn->exec("ALTER TABLE project_inventory ADD COLUMN quantity_used INT DEFAULT 0 AFTER quantity");
                } catch (Exception $e) {}

                $quantity_used = $data['quantity_used'] ?? 0;
                $sql = "UPDATE project_inventory SET quantity_used = :quantity_used WHERE id = :id";
                $stmt = $conn->prepare($sql);
                $stmt->execute([
                    ':quantity_used' => $quantity_used,
                    ':id' => $id
                ]);

                echo json_encode([
                    "status" => "success",
                    "message" => "Usage updated successfully"
                ]);
            } elseif (isset($data['stock_status'])) {
                // Check if stock_status column exists, if not add it
                try {
                    $conn->exec("ALTER TABLE project_inventory ADD COLUMN stock_status VARCHAR(50) DEFAULT 'pending' AFTER payment_mode");
                } catch (Exception $e) {}

                // Check if transfer_qty column exists, if not add it
                try {
                    $conn->exec("ALTER TABLE project_inventory ADD COLUMN transfer_qty INT DEFAULT 0 AFTER stock_status");
                } catch (Exception $e) {}

                $stock_status = $data['stock_status'] ?? '';
                $transfer_qty = $data['transfer_qty'] ?? 0;

                $sql = "UPDATE project_inventory SET stock_status = :stock_status, transfer_qty = :transfer_qty WHERE id = :id";
                $stmt = $conn->prepare($sql);
                $stmt->execute([
                    ':stock_status' => $stock_status,
                    ':transfer_qty' => $transfer_qty,
                    ':id' => $id
                ]);

                echo json_encode([
                    "status" => "success",
                    "message" => "Stock status updated successfully"
                ]);
            } else {
                echo json_encode([
                    "status" => "error",
                    "message" => "No valid field to update"
                ]);
            }
        }
        break;
    case 'finance':
        $finance = new FinanceController($conn);
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            if (isset($path_parts[1]) && $path_parts[1] === 'update' && isset($input['transaction_id'])) {
                echo json_encode($finance->updateTransaction($input['transaction_id'], $input));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'delete') {
                $id = $input['transaction_id'] ?? ($path_parts[2] ?? null);
                $uid = $input['deleted_by'] ?? ($current_user_id ?? null);
                echo json_encode($finance->deleteTransaction($id, $uid));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'restore') {
                $id = $input['transaction_id'] ?? ($path_parts[2] ?? null);
                echo json_encode($finance->restoreTransaction($id));
            } elseif (isset($path_parts[1]) && ($path_parts[1] === 'permanent-delete' || $path_parts[1] === 'purge')) {
                $id = $input['transaction_id'] ?? ($path_parts[2] ?? null);
                echo json_encode($finance->permanentDeleteTransaction($id));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'approve') {
                echo json_encode($finance->approveExpense($input['transaction_id'] ?? ($path_parts[2] ?? null), $input['approved_by'] ?? null));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'reject') {
                echo json_encode($finance->rejectExpense($input['transaction_id'] ?? ($path_parts[2] ?? null), $input['approved_by'] ?? null));
            } else {
                echo json_encode($finance->recordTransaction($input));
            }
        } elseif ($_SERVER['REQUEST_METHOD'] === 'PUT') {
            $id = $path_parts[1] ?? ($input['transaction_id'] ?? null);
            echo json_encode($finance->updateTransaction($id, $input));
        } elseif ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
            $id = $path_parts[1] ?? null;
            $uid = $current_user_id ?? null;
            echo json_encode($finance->deleteTransaction($id, $uid));
        } elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
            if (isset($path_parts[1]) && $path_parts[1] === 'summary') {
                echo json_encode(["success" => true, "data" => $finance->getProjectSummary($path_parts[2])]);
            } else {
                $p_id = $path_parts[1] ?? null;
                $include_deleted = isset($_GET['include_deleted']) && ($_GET['include_deleted'] === '1' || strtolower($_GET['include_deleted']) === 'true');
                echo json_encode(["success" => true, "data" => $finance->getAllTransactions($p_id, $include_deleted)]);
            }
        }
        break;
    case 'quotes':
        $quote = new QuoteController($conn);
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            if (!isset($input['user_id']) && $current_user_id) $input['user_id'] = $current_user_id;
            if (!isset($input['role']) && $current_user_role) $input['role'] = $current_user_role;
            if (isset($path_parts[1]) && $path_parts[1] === 'save') {
                // Mark as 'version' save_type
                $input['save_type'] = 'version';
                echo json_encode($quote->saveQuoteState($input));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'save-draft') {
                echo json_encode($quote->saveDraft($input));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'send-to-qc') {
                echo json_encode($quote->sendToQC($input));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'set-initial') {
                echo json_encode($quote->setInitialQuoteAmount($input));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'send-email') {
                echo json_encode($quote->sendEmail($input));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'send-ack-email') {
                echo json_encode($quote->sendAckEmail($input));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'update-status') {
                $q_id = $input['quote_id'] ?? $input['project_id'] ?? null;
                $st = $input['status'] ?? 'opened';
                $uid = $input['user_id'] ?? $input['updated_by'] ?? $input['created_by'] ?? null;
                echo json_encode($quote->updateStatus($q_id, $st, $uid));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'restore') {
                $q_id = $input['quote_id'] ?? ($path_parts[2] ?? 0);
                echo json_encode($quote->restoreQuote($q_id));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'delete') {
                $q_id = $input['quote_id'] ?? ($path_parts[2] ?? 0);
                $uid = $input['user_id'] ?? $current_user_id ?? null;
                echo json_encode($quote->deleteQuote($q_id, $uid));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'permanent-delete') {
                $q_id = $input['quote_id'] ?? ($path_parts[2] ?? 0);
                echo json_encode($quote->permanentDeleteQuote($q_id));
            } else {
                echo json_encode($quote->createQuote($input));
            }
        } elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
            if (isset($path_parts[1]) && $path_parts[1] === 'approved') {
                $p_id = $_GET['project_id'] ?? null;
                $c_name = $_GET['client_name'] ?? null;
                $is_used = isset($_GET['is_used']) && $_GET['is_used'] === 'true';
                echo json_encode(["success" => true, "data" => $quote->getApprovedQuote($p_id, $is_used, $c_name)]);
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'latest') {
                $p_id = $_GET['project_id'] ?? null;
                $c_name = $_GET['client_name'] ?? null;
                $is_used = isset($_GET['is_used']) && $_GET['is_used'] === 'true';
                echo json_encode(["success" => true, "data" => $quote->getLatestQuote($p_id, $is_used, $c_name)]);
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'draft') {
                $p_id = $_GET['project_id'] ?? null;
                $is_used = isset($_GET['is_used']) && $_GET['is_used'] === 'true';
                echo json_encode(["success" => true, "data" => $quote->getDraft($p_id, $is_used)]);
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'versions') {
                $p_id = $_GET['project_id'] ?? null;
                $is_used = isset($_GET['is_used']) && $_GET['is_used'] === 'true';
                echo json_encode(["success" => true, "data" => $quote->getVersionsList($p_id, $is_used)]);
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'history') {
                $p_id = $_GET['project_id'] ?? null;
                $is_used = isset($_GET['is_used']) && $_GET['is_used'] === 'true';
                $effective_uid = $current_user_id ?? ($_GET['user_id'] ?? null);
                $effective_role = $current_user_role ?? ($_GET['role'] ?? null);
                echo json_encode(["success" => true, "data" => $quote->getQuoteHistory($p_id, $is_used, $effective_uid, $effective_role)]);
            } elseif (isset($path_parts[1]) && is_numeric($path_parts[1])) {
                echo json_encode(["success" => true, "data" => $quote->getQuoteDetails($path_parts[1])]);
            } else {
                $p_id = $_GET['project_id'] ?? null;
                $effective_uid = $current_user_id ?? ($_GET['user_id'] ?? null);
                $effective_role = $current_user_role ?? ($_GET['role'] ?? null);
                if ($p_id) {
                    echo json_encode(["success" => true, "data" => $quote->getQuotesByProject($p_id, $effective_uid, $effective_role)]);
                } else {
                    echo json_encode(["success" => true, "data" => $quote->getAllQuotes($effective_uid, $effective_role)]);
                }
            }
        } elseif ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
            $quote_id = (isset($path_parts[1]) && is_numeric($path_parts[1])) ? $path_parts[1] : ($_GET['id'] ?? $_GET['quote_id'] ?? 0);
            $uid = $_GET['user_id'] ?? $current_user_id ?? null;
            echo json_encode($quote->deleteQuote($quote_id, $uid));
        }
        break;
    case 'dashboard':
        $dashboard = new DashboardController($conn, $current_user_id, $current_user_role);
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            $period       = $_GET['period']       ?? 'all';
            $project_type = $_GET['project_type'] ?? 'all';
            $start_date   = $_GET['start_date']   ?? null;
            $end_date     = $_GET['end_date']     ?? null;
            echo json_encode($dashboard->getSummary($period, $project_type, $start_date, $end_date));
        }
        break;
    case 'timeline':
        $timeline = new TimelineController($conn);
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            if (isset($path_parts[1]) && $path_parts[1] === 'update-status') {
                echo json_encode($timeline->updateTaskStatus($input));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'daily-check') {
                echo json_encode($timeline->runDailyCheck());
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'save-state') {
                echo json_encode($timeline->saveState($input));
            } else {
                echo json_encode($timeline->createTask($input));
            }
        } elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
            if (isset($path_parts[1]) && $path_parts[1] === 'state') {
                echo json_encode($timeline->getState($path_parts[2]));
            } elseif (isset($path_parts[1])) {
                echo json_encode($timeline->getTimeline($path_parts[1]));
            }
        }
        break;
    case 'stock-categories':
        $stockCtrl = new StockCategoryController($conn);
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            $p_id = $_GET['project_id'] ?? null;
            echo json_encode(["success" => true, "data" => $stockCtrl->getProjectCategories($p_id)]);
        } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
            echo json_encode($stockCtrl->addCategory($input));
        } elseif ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
            $id = $path_parts[1] ?? null;
            echo json_encode($stockCtrl->deleteCategory($id));
        }
        break;
    case 'stock-items':
        $stockCtrl = new StockCategoryController($conn);
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            $p_id = $_GET['project_id'] ?? null;
            echo json_encode(["success" => true, "data" => $stockCtrl->getItems($p_id)]);
        } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
            if (isset($path_parts[1]) && $path_parts[1] === 'transfer') {
                echo json_encode($stockCtrl->transferItem($input));
            } else {
                echo json_encode($stockCtrl->addItem($input));
            }
        } elseif ($_SERVER['REQUEST_METHOD'] === 'PUT') {
            if (isset($path_parts[1]) && $path_parts[1] === 'usage') {
                echo json_encode($stockCtrl->updateUsage($input));
            } else {
                echo json_encode($stockCtrl->updateItem($input));
            }
        } elseif ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
            $id = $path_parts[1] ?? null;
            echo json_encode($stockCtrl->deleteItem($id));
        }
        break;
    case 'vendors':
        $vendorCtrl = new VendorController($conn);
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            if (isset($path_parts[1]) && $path_parts[1] === 'labor') {
                echo json_encode($vendorCtrl->getLaborVendors());
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'global') {
                echo json_encode($vendorCtrl->getGlobalData());
            } else {
                echo json_encode($vendorCtrl->getAll($_GET['category'] ?? null));
            }
        } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
            if (isset($path_parts[1]) && $path_parts[1] === 'delete') {
                echo json_encode($vendorCtrl->deleteVendor($input));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'toggle-status') {
                echo json_encode($vendorCtrl->toggleStatus($input));
            } else {
                echo json_encode($vendorCtrl->create($input));
            }
        } elseif ($_SERVER['REQUEST_METHOD'] === 'PUT') {
            if (isset($path_parts[1]) && $path_parts[1] === 'update-profile') {
                echo json_encode($vendorCtrl->updateProfile($input));
                exit();
            }
            if (isset($path_parts[1]) && $path_parts[1] === 'update-payment') {
                echo json_encode($vendorCtrl->updatePayment($input));
                exit();
            }
            if (isset($path_parts[1]) && $path_parts[1] === 'payment-approval') {
                echo json_encode($vendorCtrl->processPaymentApproval($input));
                exit();
            }
            if (isset($path_parts[1]) && $path_parts[1] === 'toggle-status') {
                echo json_encode($vendorCtrl->toggleStatus($input));
                exit();
            }
            echo json_encode($vendorCtrl->updateProfile($input));
            exit();
        } elseif ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
            if (isset($path_parts[1]) && $path_parts[1] === 'delete-item') {
                echo json_encode($vendorCtrl->deleteInventoryItem($input));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'delete-vendor') {
                echo json_encode($vendorCtrl->deleteVendor($input));
            } else {
                $delId = $path_parts[1] ?? ($input['vendor_id'] ?? ($input['id'] ?? null));
                echo json_encode($vendorCtrl->deleteVendor($delId ?: $input));
            }
        }
        break;
    case 'contracts-labor':
        $clCtrl = new ContractLabourController($conn);
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            echo json_encode($clCtrl->getProjectContracts($_GET['project_id'] ?? null));
        } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
            if (isset($path_parts[1]) && $path_parts[1] === 'payments') {
                echo json_encode($clCtrl->addPayment($input));
            } else {
                echo json_encode($clCtrl->createContract($input));
            }
        } elseif ($_SERVER['REQUEST_METHOD'] === 'PUT') {
            if (isset($path_parts[1]) && $path_parts[1] === 'payments') {
                echo json_encode($clCtrl->updatePayment($input));
            } else {
                echo json_encode($clCtrl->updateContract($input));
            }
        } elseif ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
            if (isset($path_parts[1]) && $path_parts[1] === 'payments') {
                $payId = $path_parts[2] ?? $input['id'] ?? $_GET['id'] ?? null;
                echo json_encode($clCtrl->deletePayment($payId));
            } else {
                $contractId = $path_parts[1] ?? $input['id'] ?? $_GET['id'] ?? null;
                echo json_encode($clCtrl->deleteContract($contractId));
            }
        }
        break;
    case 'main-vendors':
        $mainVendorCtrl = new MainVendorController();
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            echo json_encode($mainVendorCtrl->getAllMainVendors());
        } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
            echo json_encode($mainVendorCtrl->createMainVendor($input));
        } elseif ($_SERVER['REQUEST_METHOD'] === 'PUT') {
            echo json_encode($mainVendorCtrl->updateMainVendor($input));
        }
        break;
    case 'promo-codes':
        $promoCtrl = new PromoCodeController($conn);
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            echo json_encode($promoCtrl->getAllPromoCodes());
        } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
            echo json_encode($promoCtrl->createPromoCode($input));
        } elseif ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
            $p_id = $path_parts[1] ?? null;
            echo json_encode($promoCtrl->deletePromoCode($p_id));
        }
        break;
    case 'category-discounts':
        if (!class_exists('CategoryDiscountController')) {
            echo json_encode([
                "success" => true,
                "max_discount" => 10.0,
                "category_max_discounts" => [
                    'Wood work' => 10,
                    'Accessories' => 15,
                    'False Ceiling' => 10,
                    'Painting' => 12,
                    'HDS' => 10,
                    'Lights' => 15,
                    'Furniture' => 10,
                    'Furnishing' => 10,
                    'Custom Carpentry' => 10,
                    'Decor' => 15,
                    'Civilwork' => 5,
                    'Services' => 5,
                    'Miscellaneous' => 10,
                    'Appliances' => 5
                ]
            ]);
            break;
        }
        $catDiscCtrl = new CategoryDiscountController($conn);
        $subAction = $path_parts[1] ?? '';
        if ($subAction === 'settings') {
            if ($_SERVER['REQUEST_METHOD'] === 'GET') {
                echo json_encode($catDiscCtrl->getMaxDiscount());
            } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
                echo json_encode($catDiscCtrl->updateMaxDiscount($input));
            }
        } elseif ($subAction === 'request-approval') {
            echo json_encode($catDiscCtrl->submitRequest($input));
        } elseif ($subAction === 'review-request' || $subAction === 'review') {
            echo json_encode($catDiscCtrl->reviewRequest($input));
        } elseif ($subAction === 'requests' || empty($subAction)) {
            if ($_SERVER['REQUEST_METHOD'] === 'GET') {
                echo json_encode($catDiscCtrl->getRequests($_GET));
            } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
                echo json_encode($catDiscCtrl->submitRequest($input));
            }
        }
        break;
    case 'team-targets':
        $targetCtrl = new TeamTargetController($conn);
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            $month = $_GET['month'] ?? null;
            if ($month) {
                echo json_encode(['success' => true, 'data' => $targetCtrl->getByMonth($month)]);
            } else {
                echo json_encode(['success' => true, 'data' => $targetCtrl->getMonths()]);
            }
        } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
            echo json_encode($targetCtrl->save($input['month'], $input['rows']));
        }
        break;
    case 'project-trackers':
        $trackerCtrl = new ProjectTrackerController($conn);
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            if (isset($_GET['project_id'])) {
                echo json_encode(['success' => true, 'data' => $trackerCtrl->getByProjectId($_GET['project_id'])]);
            } else {
                $category = $_GET['category'] ?? 'interior';
                echo json_encode(['success' => true, 'data' => $trackerCtrl->getByCategory($category)]);
            }
        } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
            echo json_encode($trackerCtrl->save($input['category'], $input['rows']));
        }
        break;
    case 'monthly-income':
        $incomeCtrl = new MonthlyIncomeController($conn);
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            $month = $_GET['month'] ?? null;
            if ($month) {
                echo json_encode(['success' => true, 'data' => $incomeCtrl->getByMonth($month)]);
            } else {
                echo json_encode(['success' => true, 'data' => $incomeCtrl->getMonths()]);
            }
        } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
            echo json_encode($incomeCtrl->save($input['month'], $input['rows']));
        }
        break;
    case 'civil-estimate':
        $civilCtrl = new CivilEstimateController($conn);
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            echo json_encode($civilCtrl->save($input));
        } elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
            echo json_encode($civilCtrl->load());
        }
        break;
    case 'gd-tasks':
        $gdCtrl = new GDTaskController($conn);
        $action = $path_parts[1] ?? null;

        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            $filter_gd_id = $_GET['gd_user_id'] ?? null;
            echo json_encode($gdCtrl->getTasks($current_user_id, $current_user_role, $filter_gd_id));
        } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
            if ($action === 'submit') {
                echo json_encode($gdCtrl->submitTarget($input));
            } elseif ($action === 'review-submission') {
                echo json_encode($gdCtrl->reviewSubmission($input));
            } elseif ($action === 'update-status') {
                echo json_encode($gdCtrl->updateStatus($input));
            } elseif ($action === 'review-completion') {
                echo json_encode($gdCtrl->reviewCompletion($input));
            } elseif ($action === 'assign') {
                echo json_encode($gdCtrl->assignDirectTask($input));
            } else {
                echo json_encode($gdCtrl->submitTarget($input));
            }
        }
        break;
    case 'reimbursements':
        $reimb = new ReimbursementController($conn);
        $action = $path_parts[1] ?? null;
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            $effective_user_id = $current_user_id ?? $_GET['user_id'] ?? null;
            $effective_user_role = $current_user_role ?? $_GET['role'] ?? null;
            $force_all = isset($_GET['all']) && ($_GET['all'] === '1' || $_GET['all'] === 'true');
            echo json_encode($reimb->getAll($effective_user_id, $effective_user_role, $force_all));
        } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
            if ($action === 'approve') {
                echo json_encode($reimb->approve($input));
            } elseif ($action === 'reject') {
                echo json_encode($reimb->reject($input));
            } else {
                // submit — multipart/form-data
                echo json_encode($reimb->submit($_POST, $_FILES));
            }
        }
        break;
    case 'mb-tasks':
        $mbCtrl = new MBTaskController($conn);
        $action = $path_parts[1] ?? null;

        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            if ($action === 'summary') {
                echo json_encode($mbCtrl->getStatsSummary($current_user_id, $current_user_role));
            } else {
                $filter_user_id = $_GET['user_id'] ?? null;
                $status_filter = $_GET['status'] ?? null;
                echo json_encode($mbCtrl->getTasks($current_user_id, $current_user_role, $filter_user_id, $status_filter));
            }
        } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
            if ($action === 'submit') {
                echo json_encode($mbCtrl->submitTask($input));
            } elseif ($action === 'review') {
                echo json_encode($mbCtrl->reviewTask($input));
            } elseif ($action === 'update-status') {
                echo json_encode($mbCtrl->updateStatus($input));
            } elseif ($action === 'toggle-subtask') {
                echo json_encode($mbCtrl->toggleSubTask($input));
            } elseif ($action === 'assign') {
                echo json_encode($mbCtrl->assignDirectTask($input));
            } else {
                echo json_encode($mbCtrl->submitTask($input));
            }
        }
        break;
    case 'qc':
        $qcCtrl = new QCController($conn);
        $action = $path_parts[1] ?? null;

        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            if ($action === 'folders') {
                $pid = $_GET['project_id'] ?? null;
                echo json_encode($qcCtrl->getQCFolders($pid));
            } elseif ($action === 'files') {
                $pid = $_GET['project_id'] ?? null;
                $fid = $_GET['folder_id'] ?? null;
                echo json_encode($qcCtrl->getQCFiles($pid, $fid));
            } elseif ($action === 'versions') {
                $fid = $_GET['file_id'] ?? null;
                echo json_encode($qcCtrl->getQCFileVersions($fid));
            } elseif ($action === 'comments') {
                $fid = $_GET['file_id'] ?? null;
                echo json_encode($qcCtrl->getQCComments($fid));
            } elseif ($action === 'reject-details') {
                $fid = $_GET['folder_id'] ?? null;
                echo json_encode($qcCtrl->getFolderRejectDetails($fid));
            } elseif ($action === 'pending-pm-approvals') {
                echo json_encode($qcCtrl->getPendingPMApprovals());
            } else {
                $pid = $_GET['project_id'] ?? null;
                echo json_encode($qcCtrl->getQCFiles($pid));
            }
        } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
            if ($action === 'create-folder') {
                echo json_encode($qcCtrl->createQCFolder($input));
            } elseif ($action === 'send-quote-to-qc') {
                echo json_encode($qcCtrl->sendQuoteToQC($input));
            } elseif ($action === 'update-folder-status') {
                echo json_encode($qcCtrl->updateQCFolderStatus($input));
            } elseif ($action === 'send-to-pm') {
                echo json_encode($qcCtrl->sendToPM($input));
            } elseif ($action === 'pm-approve') {
                echo json_encode($qcCtrl->pmApprove($input));
            } elseif ($action === 'pm-reject') {
                echo json_encode($qcCtrl->pmReject($input));
            } elseif ($action === 'final-qc-approve') {
                echo json_encode($qcCtrl->finalQCApprove($input));
            } elseif ($action === 'final-qc-reject') {
                echo json_encode($qcCtrl->finalQCReject($input));
            } elseif ($action === 'upload-file') {
                echo json_encode($qcCtrl->uploadQCFile($_POST, $_FILES));
            } elseif ($action === 'lock-inspector') {
                echo json_encode($qcCtrl->lockQCInspector($input));
            } elseif ($action === 'add-comment') {
                echo json_encode($qcCtrl->addQCComment($input));
            } elseif ($action === 'update-status') {
                echo json_encode($qcCtrl->updateQCStatus($input));
            } elseif ($action === 'resolve-comment') {
                echo json_encode($qcCtrl->resolveQCComment($input));
            } elseif ($action === 'add-reply') {
                echo json_encode($qcCtrl->addQCCommentReply($input));
            } elseif ($action === 'rename-folder') {
                echo json_encode($qcCtrl->renameQCFolder($input));
            } elseif ($action === 'delete-folder') {
                echo json_encode($qcCtrl->deleteQCFolder($input));
            } elseif ($action === 'rename-file') {
                echo json_encode($qcCtrl->renameQCFile($input));
            } elseif ($action === 'delete-file') {
                echo json_encode($qcCtrl->deleteQCFile($input));
            }
        }
        break;
    case 'agreements':
        require_once 'controllers/AgreementController.php';
        $agCtrl = new AgreementController($conn);
        $action = $path_parts[1] ?? null;
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            if ($id) {
                echo json_encode($agCtrl->getById($id));
            } else {
                echo json_encode($agCtrl->getAll());
            }
        } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
            if ($action === 'update-status') {
                echo json_encode($agCtrl->updateStatus($input['id'] ?? null, $input['status'] ?? 'Booked', $input['ref_id'] ?? null));
            } elseif ($action === 'send-ack-email') {
                // Send acknowledgement-receipt email to client
                echo json_encode($agCtrl->sendAckEmail($input));
            } else {
                echo json_encode($agCtrl->save($input));
            }
        } elseif ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
            if ($id) {
                echo json_encode($agCtrl->delete($id));
            } else {
                echo json_encode(['success' => false, 'message' => 'Missing agreement ID']);
            }
        }
        break;

    case 'pdf-comments':
        $pdfCtrl = new PDFCommentController($conn);
        $action = $path_parts[1] ?? null;

        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            $file_id = intval($_GET['file_id'] ?? 0);
            echo json_encode($pdfCtrl->getComments($file_id));
        } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
            if ($action === 'add') {
                echo json_encode($pdfCtrl->addComment($input));
            } elseif ($action === 'resolve') {
                echo json_encode($pdfCtrl->resolveComment($input));
            } elseif ($action === 'reopen') {
                echo json_encode($pdfCtrl->reopenComment($input));
            } else {
                echo json_encode(['success' => false, 'message' => 'Action not found']);
            }
        }
        break;
    case 'file-proxy':
        $filePath = $_GET['file_path'] ?? '';
        if (!$filePath) {
            http_response_code(400);
            echo json_encode(["success" => false, "message" => "File path required"]);
            exit;
        }
        $fullPath = realpath(__DIR__ . '/../' . ltrim($filePath, '/'));
        $baseDir = realpath(__DIR__ . '/../');
        if (!$fullPath || strpos($fullPath, $baseDir) !== 0 || !file_exists($fullPath)) {
            http_response_code(404);
            echo json_encode(["success" => false, "message" => "File not found: " . $filePath]);
            exit;
        }
        $mime = mime_content_type($fullPath) ?: 'application/pdf';
        header("Content-Type: " . $mime);
        header("Content-Length: " . filesize($fullPath));
        header("Access-Control-Allow-Origin: *");
        header("Access-Control-Allow-Methods: GET, OPTIONS");
        header("Access-Control-Allow-Headers: *");
        readfile($fullPath);
        exit;
    case 'pdf':
        $pdfGen = new PdfController($conn);
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            if (isset($path_parts[1]) && $path_parts[1] === 'generate') {
                echo json_encode($pdfGen->generateQuotePdf($input['quote_id'] ?? 0, $input['project_id'] ?? 0));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'snapshot') {
                // Generate and save snapshot to DB when a version is saved
                echo json_encode($pdfGen->createAndStoreSnapshot($input['quote_id'] ?? 0, $input['project_id'] ?? 0));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'upload-snapshot') {
                echo json_encode($pdfGen->uploadBase64Snapshot(
                    $input['type'] ?? 'quote',
                    $input['id'] ?? $input['quote_id'] ?? $input['agreement_id'] ?? 0,
                    $input['pdf_base64'] ?? ''
                ));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'for-email') {
                // Get stored PDF snapshot if available; fallback to live render for legacy quotes
                echo json_encode($pdfGen->getPdfForEmail($input['quote_id'] ?? 0, $input['project_id'] ?? 0));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'token') {
                echo json_encode($pdfGen->generateToken($input['quote_id'] ?? 0));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'validate-token') {
                echo json_encode($pdfGen->getQuoteDataWithToken(
                    intval($input['quote_id'] ?? 0),
                    $input['token'] ?? ''
                ));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'generate-mom') {
                echo json_encode($pdfGen->generateMomPdf($input['project_id'] ?? 0, $input['type'] ?? $input['source'] ?? null));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'mom-for-email') {
                echo json_encode($pdfGen->getMomPdfForEmail($input['project_id'] ?? 0, $input['type'] ?? $input['source'] ?? null));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'mom-token') {
                echo json_encode($pdfGen->generateToken($input['project_id'] ?? 0));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'validate-mom-token') {
                echo json_encode($pdfGen->getMomDataWithToken(
                    intval($input['project_id'] ?? 0),
                    $input['token'] ?? ''
                ));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'agreement-snapshot') {
                echo json_encode($pdfGen->createAndStoreAgreementSnapshot($input['agreement_id'] ?? ''));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'agreement-for-email') {
                echo json_encode($pdfGen->getAgreementPdfForEmail($input['agreement_id'] ?? ''));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'validate-agreement-token') {
                echo json_encode($pdfGen->getAgreementDataWithToken(
                    $input['agreement_id'] ?? '',
                    $input['token'] ?? ''
                ));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'merge') {
                echo json_encode($pdfGen->mergePdfs($input['pdfs'] ?? []));
            }
        } elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
            if (isset($path_parts[1]) && $path_parts[1] === 'health') {
                echo json_encode(['success' => $pdfGen->healthCheck(), 'message' => $pdfGen->healthCheck() ? 'PDF service running' : 'PDF service NOT running on port 3001']);
            }
        }
        break;
    case 'vendor-quotas':
        $vqController = new VendorQuotaController();
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            $sub = $path_parts[1] ?? '';
            if ($sub === 'project-items') {
                $vqController->getProjectVendorItems();
            } elseif ($sub === 'agreement-pdf') {
                $vqController->getAgreementPdf();
            } elseif ($sub === 'generate-pdf') {
                $vqController->generatePdf();
            } elseif ($sub === 'pending-approvals') {
                $vqController->getPendingApprovals();
            } else {
                $vqController->getVendorQuotas();
            }
        } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $sub = $path_parts[1] ?? '';
            if ($sub === 'generate-pdf') {
                $vqController->generatePdf();
            } elseif ($sub === 'send-approval') {
                $vqController->sendApprovalNotification();
            } else {
                $vqController->saveVendorQuota();
            }
        }
        break;
    default:
        http_response_code(404);
        echo json_encode(["message" => "Resource not found"]);
        break;
}
?>