<?php
$httpHost = strtolower($_SERVER['HTTP_HOST'] ?? '');
$isLocal = ($httpHost === 'localhost' || 
            strpos($httpHost, 'localhost:') === 0 || 
            $httpHost === '127.0.0.1' || 
            strpos($httpHost, '127.0.0.1:') === 0 || 
            $httpHost === '::1');

// Any non-localhost domain (Hostinger, staging, custom domain, IP) is a live production environment
$isLiveHost = !$isLocal || (strpos($httpHost, 'bizools.in') !== false || strpos($httpHost, 'livincart') !== false || strpos($httpHost, 'livrcart') !== false);

define('IS_PRODUCTION', $isLiveHost ? true : false);

// Secret key for signing short-lived print tokens (Puppeteer PDF route)
// Change this to a strong random string in production
define('PRINT_TOKEN_SECRET', 'lv1nc4rt-pdf-s3cr3t-k3y-change-in-prod');

if (IS_PRODUCTION || $isLiveHost) {
    define('DB_HOST', 'localhost');
    define('DB_NAME', 'u218756229_test_12');
    define('DB_USER', 'u218756229_test_12');
    define('DB_PASS', 'UUPDCs4!r');
    define('API_BASE_URL', (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https://' : 'http://') . ($httpHost ?: 'livincart.bizools.in') . '/api');
    define('FRONTEND_BASE_URL', (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https://' : 'http://') . ($httpHost ?: 'livincart.bizools.in'));
    define('PDF_GENERATOR_URL', 'http://127.0.0.1:3001');
    define('AMP_ENDPOINT_URL', API_BASE_URL . '/acknowledge.php');
    define('PUBLIC_ACK_URL', API_BASE_URL . '/acknowledge.php');
} else {
    define('DB_HOST', 'localhost');
    // define('DB_NAME', 'cart_final');
    define('DB_NAME', 'updted_liveicart');
    define('DB_USER', 'root');
    define('DB_PASS', '');
    define('API_BASE_URL', 'http://localhost/livrcart/demoark/api');
    define('FRONTEND_BASE_URL', 'http://localhost:5173');
    define('PDF_GENERATOR_URL', 'http://127.0.0.1:3001');
    define('AMP_ENDPOINT_URL', ''); // Disabled on localhost (Google AMP requires public HTTPS)
    define('PUBLIC_ACK_URL', ''); // Empty on localhost so local testing points to local database
}

class Database
{
    private $host = DB_HOST;
    private $db_name = DB_NAME;
    private $username = DB_USER;
    private $password = DB_PASS;
    public $conn;

    public function getConnection()
    {
        $this->conn = null;

        try {
            $this->conn = new PDO(
                "mysql:host={$this->host};dbname={$this->db_name};charset=utf8",
                $this->username,
                $this->password,
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                ]
            );

            try {
                $this->conn->exec("SET GLOBAL max_allowed_packet=67108864;");
            } catch (Throwable $e) {}

        } catch (PDOException $exception) {
            // On Linux/Hostinger, if connecting to "localhost" fails (socket issue), try 127.0.0.1
            if ($this->host === 'localhost') {
                try {
                    $this->conn = new PDO(
                        "mysql:host=127.0.0.1;dbname={$this->db_name};charset=utf8",
                        $this->username,
                        $this->password,
                        [
                            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                        ]
                    );
                    return $this->conn;
                } catch (PDOException $e2) {
                    // Fall through to error response below
                }
            }

            http_response_code(500);
            echo json_encode([
                "success" => false,
                "message" => "Database connection failed: " . $exception->getMessage(),
                "db_user" => $this->username,
                "db_name" => $this->db_name
            ]);
            exit;
        }

        return $this->conn;
    }
}

function getMysqliConnection()
{
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);

    if ($conn->connect_error) {
        http_response_code(500);

        if (!IS_PRODUCTION) {
            die(json_encode([
                "success" => false,
                "message" => $conn->connect_error
            ]));
        } else {
            die(json_encode([
                "success" => false,
                "message" => "MySQLi connection failed."
            ]));
        }
    }

    return $conn;
}