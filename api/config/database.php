<?php
// api/config/database.php

// ─────────────────────────────────────────────
// ENVIRONMENT DETECTION
// ─────────────────────────────────────────────
define('IS_PRODUCTION', false); // 🔁 CHANGE TO true ON HOSTINGER

// ─────────────────────────────────────────────
// DATABASE CONFIGURATION
// ─────────────────────────────────────────────
if (IS_PRODUCTION) {
    // 🔐 Hostinger Credentials (REPLACE THESE)
    define('DB_HOST', 'localhost');
    define('DB_NAME', 'u123456789_prestark');   // your Hostinger DB name
    define('DB_USER', 'u123456789_user');       // your Hostinger DB user
    define('DB_PASS', 'your_password');         // your Hostinger DB password
} else {
    // 💻 Local XAMPP Credentials
    define('DB_HOST', 'localhost');
    define('DB_NAME', 'prestark');
    define('DB_USER', 'root');
    define('DB_PASS', '');
}

// ─────────────────────────────────────────────
// PDO DATABASE CLASS (RECOMMENDED)
// ─────────────────────────────────────────────
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

            // 🔍 Show real error only in local
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

// ─────────────────────────────────────────────
// OPTIONAL: MySQLi CONNECTION (USE ONLY IF NEEDED)
// ─────────────────────────────────────────────
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