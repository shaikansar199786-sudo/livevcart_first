<?php
require_once 'config/database.php';
require_once 'controllers/LeadController.php';

$db = new Database();
$conn = $db->getConnection();

// Create lead controller simulating user_id 28 (sales)
$lead = new LeadController($conn, 28, 'sales');

$leadData = [
    "client_name" => "Test Auto Client Creation",
    "contact_number" => "9848022338",
    "email" => "testautocreate@gmail.com",
    "location" => "VSP",
    "client_address" => "VSP colony",
    "project_type" => "Furniture projects",
    "estimated_budget" => "120000",
    "lead_source" => "walk_in",
    "manual_client_id" => "CL-AUTO-1",
    "project_scope" => "2 BHK",
    "created_by" => 28
];

$res = $lead->create($leadData);
echo json_encode($res);
