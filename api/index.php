<?php
// api/index.php

// CORS Headers
if (isset($_SERVER['HTTP_ORIGIN'])) {
    header("Access-Control-Allow-Origin: {$_SERVER['HTTP_ORIGIN']}");
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Max-Age: 86400');
}

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_METHOD']))
        header("Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE");
    if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']))
        header("Access-Control-Allow-Headers: {$_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']}");
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

// Simple Router
$request_uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
// Ensure base path matches the xampp folder structure
$base_path = '/ARK/api/';
$path = str_replace($base_path, '', $request_uri);
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
            echo json_encode($user->softDelete($path_parts[1]));
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
            $clientId = $client->create($input);
            if ($clientId) {
                echo json_encode(["success" => true, "message" => "Client created", "client_id" => $clientId]);
            } else {
                echo json_encode(["success" => false, "message" => "Failed to create client"]);
            }
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
        }
        break;
    case 'finance':
        $finance = new FinanceController($conn);
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            echo json_encode($finance->recordTransaction($input));
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
    case 'vendors':
        $vendorCtrl = new VendorController($conn);
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            if (isset($path_parts[1]) && $path_parts[1] === 'labor') {
                echo json_encode($vendorCtrl->getLaborVendors());
            } else {
                echo json_encode($vendorCtrl->getAll());
            }
        } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
            echo json_encode($vendorCtrl->create($input));
        }
        break;
    default:
        http_response_code(404);
        echo json_encode(["message" => "Resource not found"]);
        break;
}
?>