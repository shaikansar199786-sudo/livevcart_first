<?php
// api/index.php

// CORS Headers — allow both local dev and production frontend
$allowed_origins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'https://silver-walrus-702172.hostingersite.com',
    'https://salmon-viper-858874.hostingersite.com',
    'https://forestgreen-marten-114512.hostingersite.com',
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (in_array($origin, $allowed_origins)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
    header('Access-Control-Max-Age: 86400');
}

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    if (in_array($origin, $allowed_origins)) {
        // Headers already sent above, just exit
        exit(0);
    }
    // If origin not allowed but it's an OPTIONS request, still exit to avoid errors
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


// Simple Router
$request_uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
// Dynamically detect base path — works on both localhost/ARK/api and Hostinger root
$script_dir = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/');
$path = $script_dir ? str_replace($script_dir . '/', '', $request_uri) : ltrim($request_uri, '/');
$path_parts = explode('/', trim($path, '/'));

$resource = $path_parts[0] ?? null;
$id = $path_parts[1] ?? null;

$db = new Database();
$conn = $db->getConnection();

if (!$resource) {
    echo json_encode(["message" => "Welcome to ARK Architects PM System API"]);
    exit;
}
$input = json_decode(file_get_contents("php://input"), true);

// Map resources to controllers
switch ($resource) {
    case 'auth':
        $auth = new AuthController($conn);
        if (isset($path_parts[1]) && $path_parts[1] === 'login' && $_SERVER['REQUEST_METHOD'] === 'POST') {
            echo json_encode($auth->login($input['username'], $input['password']));
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
        $lead = new LeadController($conn);
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            if (isset($path_parts[1]) && $path_parts[1] === 'update-status') {
                echo json_encode($lead->updateStatus($input['lead_id'], $input['status'], $input['data'] ?? null));
            } else {
                echo json_encode($lead->create($input));
            }
        } elseif ($_SERVER['REQUEST_METHOD'] === 'PUT') {
            echo json_encode($lead->update($input));
        } elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
            echo json_encode(["success" => true, "data" => $lead->getAll()]);
        }
        break;
    case 'clients':
        $client = new ClientController($conn);
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
    case 'projects':
        $project = new ProjectController($conn);
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            if (isset($path_parts[1]) && $path_parts[1] === 'update-budget') {
                echo json_encode($project->updateBudget($input['project_id'], $input['budget']));
            } else {
                echo json_encode($project->create($input));
            }
        } elseif ($_SERVER['REQUEST_METHOD'] === 'PUT') {
            echo json_encode($project->update($input['project_id'] ?? $path_parts[1], $input));
        } elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
            if (isset($path_parts[1]) && $path_parts[1] === 'team') {
                echo json_encode(["success" => true, "data" => $project->getTeamMembers($path_parts[2])]);
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
                echo json_encode($quote->saveQuoteState($input));
            } else {
                echo json_encode($quote->createQuote($input));
            }
        } elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
            if (isset($path_parts[1]) && $path_parts[1] === 'latest') {
                $p_id = $_GET['project_id'] ?? null;
                $is_used = isset($_GET['is_used']) && $_GET['is_used'] === 'true';
                echo json_encode(["success" => true, "data" => $quote->getLatestQuote($p_id, $is_used)]);
            } elseif (isset($path_parts[1]) && is_numeric($path_parts[1])) {
                echo json_encode(["success" => true, "data" => $quote->getQuoteDetails($path_parts[1])]);
            } else {
                $p_id = $_GET['project_id'] ?? null;
                echo json_encode(["success" => true, "data" => $quote->getQuotesByProject($p_id)]);
            }
        }
        break;
    case 'dashboard':
        $dashboard = new DashboardController($conn);
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
    default:
        http_response_code(404);
        echo json_encode(["message" => "Resource not found"]);
        break;
}
?>