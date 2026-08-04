<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

$notesDir = __DIR__ . '/../../uploads/timelines';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $projectId = intval($_GET['project_id'] ?? 0);
    if (!$projectId) { echo json_encode(['success' => false, 'message' => 'Missing project_id']); exit(); }

    $file = "$notesDir/stage_notes_$projectId.json";
    $notes = file_exists($file) ? json_decode(file_get_contents($file), true) : [];

    echo json_encode(['success' => true, 'data' => $notes ?: []]);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = file_get_contents('php://input');
    $payload = json_decode($raw, true);
    $projectId = intval($payload['project_id'] ?? 0);
    $notes = $payload['notes'] ?? [];

    if (!$projectId) { echo json_encode(['success' => false, 'message' => 'Missing project_id']); exit(); }

    if (!is_dir($notesDir)) mkdir($notesDir, 0755, true);
    $file = "$notesDir/stage_notes_$projectId.json";
    file_put_contents($file, json_encode($notes, JSON_PRETTY_PRINT));

    echo json_encode(['success' => true, 'message' => 'Stage notes saved']);
    exit();
}

echo json_encode(['success' => false, 'message' => 'Method not allowed']);
