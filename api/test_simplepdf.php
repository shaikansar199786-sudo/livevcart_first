<?php
require_once __DIR__ . ""/config/database.php"";
require_once __DIR__ . ""/helpers/SimplePdfBuilder.php"";
require_once __DIR__ . ""/libs/dompdf/autoload.inc.php"";
$db = (new Database())->getConnection();
$stmt = $db->query(""SELECT quote_id, quote_number, client_name FROM quotes ORDER BY quote_id DESC LIMIT 1"");
$q = $stmt->fetch(PDO::FETCH_ASSOC);
echo ""Quote: id="" . $q[""quote_id""] . "" num="" . $q[""quote_number""] . PHP_EOL;
$qStmt = $db->prepare(""SELECT * FROM quotes WHERE quote_id = :id"");
$qStmt->execute([""id"" => $q[""quote_id""]]);
$qRow = $qStmt->fetch(PDO::FETCH_ASSOC);
$sStmt = $db->prepare(""SELECT * FROM quote_sections WHERE quote_id = :qid ORDER BY display_order, section_id ASC"");
$sStmt->execute([""qid"" => $q[""quote_id""]]);
$sections = $sStmt->fetchAll(PDO::FETCH_ASSOC);
foreach ($sections as &$sec) { $iStmt = $db->prepare(""SELECT * FROM quote_items WHERE section_id = :sid ORDER BY display_order, item_id ASC""); $iStmt->execute([""sid"" => $sec[""section_id""]]); $sec[""items""] = $iStmt->fetchAll(PDO::FETCH_ASSOC); }
$qRow[""sections""] = $sections;
echo ""Sections: "" . count($sections) . PHP_EOL;
foreach (($sections[0][""items""] ?? []) as $it) { if (($it[""brand""] ?? """") === ""HEADER"") continue; echo ""Item: "" . ($it[""particulars""] ?? ""N/A"") . "" shutter="" . ($it[""shutter_material""] ?? ""NULL"") . "" carcass="" . ($it[""carcass_material""] ?? ""NULL"") . PHP_EOL; break; }
$pdf = SimplePdfBuilder::generateQuotePdfBinary($qRow);
echo ""PDF bytes: "" . strlen($pdf) . PHP_EOL;
file_put_contents(__DIR__ . ""/test_email_pdf.pdf"", $pdf);
echo ""Done"" . PHP_EOL;
