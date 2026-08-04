<?php
// api/index.php
@ini_set('upload_max_filesize', '1024M');
@ini_set('post_max_size', '1024M');
@ini_set('memory_limit', '1024M');
@ini_set('max_execution_time', '1800');
@ini_set('max_input_time', '1800');

// CORS Headers — allow both local dev and production frontend
$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header("Access-Control-Allow-Origin: " . ($origin ? $origin : "*"));
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE');
header('Access-Control-Allow-Headers: *');
header('Access-Control-Max-Age: 86400');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

header("Content-Type: application/json; charset=UTF-8");

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
            echo json_encode($user->create($input));
        } elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
            echo json_encode(["success" => true, "data" => $user->getAll()]);
        } elseif ($_SERVER['REQUEST_METHOD'] === 'DELETE' && isset($path_parts[1])) {
            echo json_encode($user->hardDelete($path_parts[1]));
        } elseif ($_SERVER['REQUEST_METHOD'] === 'PUT') {
            echo json_encode($user->update($input));
        }
        break;
    case 'leads':
        $lead = new LeadController($conn, $current_user_id, $current_user_role);
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            if (isset($path_parts[1]) && $path_parts[1] === 'update-status') {
                echo json_encode($lead->updateStatus($input['lead_id'], $input['status'], $input['data'] ?? null));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'book-d1') {
                echo json_encode($lead->bookD1Slot($input['lead_id'], $input['d1_user_id'], $input['booking_time'], $input['assigned_by_name'], $input['d1_notes'] ?? null));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'book-site-manager') {
                echo json_encode(['success' => $lead->bookSiteManagerSlot($input['lead_id'], $input['site_manager_id'], $input['booking_time'], $input['assigned_by_name'], $input['notes'] ?? null)]);
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'notes') {
                echo json_encode($lead->addNote($input['lead_id'], $input['note_text']));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'upload') {
                $lead_id = $_POST['lead_id'] ?? $_REQUEST['lead_id'] ?? 0;
                $folder = $_POST['folder'] ?? $_REQUEST['folder'] ?? '';
                $file = $_FILES['file'] ?? null;
                echo json_encode($lead->uploadFile($lead_id, $file, $folder));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'create-folder') {
                echo json_encode($lead->createFolder($input['lead_id'] ?? 0, $input['folder_name'] ?? '', $input['parent_folder'] ?? ''));
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
            echo json_encode($notif->getUnread($_GET['user_id'] ?? 0));
        } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
            if (isset($path_parts[1]) && $path_parts[1] === 'read') {
                echo json_encode($notif->markAsRead($input['notification_id'] ?? 0));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'notify-admin') {
                $title = $input['title'] ?? 'Designer Timeline Task Approval Request';
                $message = $input['message'] ?? 'A timeline task is pending approval.';
                echo json_encode($notif->notifyAdmins($title, $message));
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
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'update-budget') {
                echo json_encode($project->updateBudget($input['project_id'], $input['budget']));
            } else {
                echo json_encode($project->create($input));
            }
        } elseif ($_SERVER['REQUEST_METHOD'] === 'PUT') {
            echo json_encode($project->update($input['project_id'] ?? $path_parts[1], $input));
        } elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
            if (isset($path_parts[1]) && $path_parts[1] === 'team') {
                echo json_encode(["success" => true, "data" => $project->getTeamMembers($path_parts[2])]);
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'financial-overview') {
                echo json_encode($project->getFinancialOverview());
            } elseif (isset($path_parts[1]) && is_numeric($path_parts[1])) {
                echo json_encode(["success" => true, "data" => $project->getDetailedStats($path_parts[1])]);
            } else {
                $u_id = $_GET['user_id'] ?? null;
                $role = $_GET['role'] ?? null;
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
            } else {
                echo json_encode($finance->recordTransaction($input));
            }
        } elseif ($_SERVER['REQUEST_METHOD'] === 'PUT') {
            $id = $path_parts[1] ?? ($input['transaction_id'] ?? null);
            echo json_encode($finance->updateTransaction($id, $input));
        } elseif ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
            $id = $path_parts[1] ?? null;
            echo json_encode($finance->deleteTransaction($id));
        } elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
            if (isset($path_parts[1]) && $path_parts[1] === 'summary') {
                echo json_encode(["success" => true, "data" => $finance->getProjectSummary($path_parts[2])]);
            } else {
                $p_id = $path_parts[1] ?? null;
                echo json_encode(["success" => true, "data" => $finance->getAllTransactions($p_id)]);
            }
        }
        break;
    case 'quotes':
        $quote = new QuoteController($conn);
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            if (isset($path_parts[1]) && $path_parts[1] === 'save') {
                // Mark as 'version' save_type
                $input['save_type'] = 'version';
                echo json_encode($quote->saveQuoteState($input));
            } elseif (isset($path_parts[1]) && $path_parts[1] === 'save-draft') {
                echo json_encode($quote->saveDraft($input));
            } else {
                echo json_encode($quote->createQuote($input));
            }
        } elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
            if (isset($path_parts[1]) && $path_parts[1] === 'latest') {
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
                echo json_encode(["success" => true, "data" => $quote->getQuoteHistory($p_id, $is_used)]);
            } elseif (isset($path_parts[1]) && is_numeric($path_parts[1])) {
                echo json_encode(["success" => true, "data" => $quote->getQuoteDetails($path_parts[1])]);
            } else {
                $p_id = $_GET['project_id'] ?? null;
                if ($p_id) {
                    echo json_encode(["success" => true, "data" => $quote->getQuotesByProject($p_id)]);
                } else {
                    echo json_encode(["success" => true, "data" => $quote->getAllQuotes()]);
                }
            }
        }
        break;
    case 'dashboard':
        $dashboard = new DashboardController($conn, $current_user_id, $current_user_role);
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            echo json_encode($dashboard->getSummary());
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
                echo json_encode($vendorCtrl->getAll());
            }
        } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
            echo json_encode($vendorCtrl->create($input));
        } elseif ($_SERVER['REQUEST_METHOD'] === 'PUT') {
            if (isset($path_parts[1]) && $path_parts[1] === 'update-payment') {
                echo json_encode($vendorCtrl->updatePayment($input));
            }
        } elseif ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
            if (isset($path_parts[1]) && $path_parts[1] === 'delete-item') {
                echo json_encode($vendorCtrl->deleteInventoryItem($input));
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
            $category = $_GET['category'] ?? 'interior';
            echo json_encode(['success' => true, 'data' => $trackerCtrl->getByCategory($category)]);
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
            echo json_encode($reimb->getAll($current_user_id, $current_user_role));
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
    case 'agreements':
        require_once 'controllers/AgreementController.php';
        $agCtrl = new AgreementController($conn);
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            if ($id) {
                echo json_encode($agCtrl->getById($id));
            } else {
                echo json_encode($agCtrl->getAll());
            }
        } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
            echo json_encode($agCtrl->save($input));
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
    default:
        http_response_code(404);
        echo json_encode(["message" => "Resource not found"]);
        break;
}
?>