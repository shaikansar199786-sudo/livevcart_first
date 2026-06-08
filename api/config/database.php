<?php
define('IS_PRODUCTION', false);

if (IS_PRODUCTION) {
    define('DB_HOST', 'localhost');
    define('DB_NAME', 'u218756229_test_12');
    define('DB_USER', 'u218756229_test_12');
    define('DB_PASS', 'UUPDCs4!r');
} else {
    define('DB_HOST', 'localhost');
    define('DB_NAME', 'chnge-arkks');
    define('DB_USER', 'root');
    define('DB_PASS', '');
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

        } catch (PDOException $exception) {
            http_response_code(500);

            if (!IS_PRODUCTION) {
                echo json_encode([
                    "success" => false,
                    "message" => $exception->getMessage()
                ]);
            } else {
                echo json_encode([
                    "success" => false,
                    "message" => "Database connection failed."
                ]);
            }

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