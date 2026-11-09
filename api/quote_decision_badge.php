<?php
/**
 * Dynamic Quote Decision Live Status Badge
 * Public endpoint — serves dynamic SVG badge reflecting current quote acceptance status in real-time.
 */

header('Content-Type: image/svg+xml; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

require_once __DIR__ . '/config/database.php';

$token = isset($_GET['token']) ? trim($_GET['token']) : '';
$token = preg_replace('/[^a-f0-9]/', '', $token);

$status = 'pending';
$statusText = 'Decision Pending: Review & Authorize';
$bgColor = '#fff7ed';
$borderColor = '#fed7aa';
$textColor = '#c2410c';
$icon = '⏳';

if (strlen($token) === 64) {
    try {
        $db = new Database();
        $conn = $db->getConnection();
        $stmt = $conn->prepare("SELECT ack_status, status FROM quotes WHERE ack_token = :token LIMIT 1");
        $stmt->execute([':token' => $token]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($row) {
            $ack = strtolower($row['ack_status'] ?? '');
            $st = strtolower($row['status'] ?? '');

            if ($ack === 'accepted' || in_array($st, ['approved', 'accepted', 'order_converted', 'won'])) {
                $status = 'accepted';
                $statusText = 'Quotation Accepted Successfully ✓';
                $bgColor = '#f0fdf4';
                $borderColor = '#86efac';
                $textColor = '#16a34a';
                $icon = '✔';
            } elseif ($ack === 'rejected' || in_array($st, ['order_lost', 'rejected', 'declined'])) {
                $status = 'rejected';
                $statusText = 'Quotation Declined ✕';
                $bgColor = '#fef2f2';
                $borderColor = '#fca5a5';
                $textColor = '#dc2626';
                $icon = '✖';
            }
        }
    } catch (Exception $e) {}
}

// Generate crisp SVG badge
echo '<?xml version="1.0" encoding="UTF-8"?>';
?>
<svg xmlns="http://www.w3.org/2000/svg" width="460" height="48" viewBox="0 0 460 48">
  <rect width="458" height="46" x="1" y="1" rx="10" fill="<?= $bgColor ?>" stroke="<?= $borderColor ?>" stroke-width="1.5" />
  <text x="24" y="29" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="14" font-weight="800" fill="<?= $textColor ?>">
    <?= htmlspecialchars($icon . '  ' . $statusText) ?>
  </text>
  <?php if ($status === 'accepted'): ?>
    <text x="350" y="29" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="11" font-weight="700" fill="#15803d">
      CONFIRMED
    </text>
  <?php elseif ($status === 'rejected'): ?>
    <text x="360" y="29" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="11" font-weight="700" fill="#dc2626">
      RECORDED
    </text>
  <?php else: ?>
    <text x="345" y="29" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="11" font-weight="700" fill="#ea580c">
      ACTION REQ.
    </text>
  <?php endif; ?>
</svg>
