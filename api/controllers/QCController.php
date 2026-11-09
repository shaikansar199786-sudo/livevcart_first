<?php
// api/controllers/QCController.php
require_once __DIR__ . '/../helpers/MailHelper.php';

class QCController
{
    private $conn;

    public function __construct($db)
    {
        $this->conn = $db;
        $this->ensureTablesExist();
    }

    private function ensureTablesExist()
    {
        try {
            // 1. Folders table
            $this->conn->exec("CREATE TABLE IF NOT EXISTS qc_folders (
                folder_id INT AUTO_INCREMENT PRIMARY KEY,
                project_id INT NOT NULL,
                name VARCHAR(255) NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            // 2. QC Files table
            $this->conn->exec("CREATE TABLE IF NOT EXISTS qc_files (
                file_id INT AUTO_INCREMENT PRIMARY KEY,
                project_id INT NOT NULL,
                folder_id INT DEFAULT NULL,
                quote_id INT DEFAULT NULL,
                file_name VARCHAR(255) NOT NULL,
                file_path TEXT NOT NULL,
                file_type VARCHAR(100) DEFAULT 'pdf',
                uploader_name VARCHAR(255) DEFAULT 'System',
                status VARCHAR(50) DEFAULT 'pending_review',
                revision_number INT DEFAULT 1,
                parent_file_id INT DEFAULT NULL,
                reviewer_name VARCHAR(255) DEFAULT NULL,
                reviewer_id VARCHAR(100) DEFAULT NULL,
                uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            // 3. QC Comments & Issue Notes table
            $this->conn->exec("CREATE TABLE IF NOT EXISTS qc_comments (
                comment_id INT AUTO_INCREMENT PRIMARY KEY,
                file_id INT NOT NULL,
                project_id INT NOT NULL,
                page_number INT DEFAULT 1,
                user_name VARCHAR(255) NOT NULL,
                severity VARCHAR(20) DEFAULT 'medium',
                comment_text TEXT NOT NULL,
                status VARCHAR(30) DEFAULT 'open',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            // Migrations for existing tables
            try { $this->conn->exec("ALTER TABLE qc_folders ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending_review'"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE qc_folders ADD COLUMN IF NOT EXISTS version_number INT DEFAULT 1"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE qc_folders ADD COLUMN IF NOT EXISTS pm_status VARCHAR(50) DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE qc_folders ADD COLUMN IF NOT EXISTS pm_notes TEXT DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE qc_folders ADD COLUMN IF NOT EXISTS pm_reviewer_name VARCHAR(255) DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE qc_folders ADD COLUMN IF NOT EXISTS pm_reviewed_at DATETIME DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE qc_folders ADD COLUMN IF NOT EXISTS final_qc_approved TINYINT(1) DEFAULT 0"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE qc_folders ADD COLUMN IF NOT EXISTS final_qc_reviewer_name VARCHAR(255) DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE qc_folders ADD COLUMN IF NOT EXISTS final_qc_approved_at DATETIME DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE qc_files ADD COLUMN IF NOT EXISTS revision_number INT DEFAULT 1"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE qc_files ADD COLUMN IF NOT EXISTS parent_file_id INT DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE qc_files ADD COLUMN IF NOT EXISTS reviewer_name VARCHAR(255) DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE qc_files ADD COLUMN IF NOT EXISTS reviewer_id VARCHAR(100) DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE qc_comments ADD COLUMN IF NOT EXISTS severity VARCHAR(20) DEFAULT 'medium'"); } catch (Exception $e) {}

        } catch (Exception $e) {
            // Table creation handled gracefully
        }
    }

    public function getQCFolders($raw_project_id)
    {
        try {
            $aliases = $this->getProjectIdAliases($raw_project_id);
            if (empty($aliases)) {
                $aliases = [trim((string)$raw_project_id)];
            }
            $inClause = implode(',', array_fill(0, count($aliases), '?'));

            // Also find any folder_id from qc_files matching quotes or files for this project
            $quoteFolderIds = [];
            try {
                $qfStmt = $this->conn->prepare("SELECT DISTINCT folder_id FROM qc_files WHERE (project_id IN ($inClause) OR quote_id IN (SELECT quote_id FROM quotes WHERE project_id IN ($inClause))) AND folder_id IS NOT NULL");
                $qfStmt->execute(array_merge($aliases, $aliases));
                $quoteFolderIds = array_filter(array_map('intval', $qfStmt->fetchAll(PDO::FETCH_COLUMN)));
            } catch (Exception $e) {}

            if (!empty($quoteFolderIds)) {
                $fInClause = implode(',', array_fill(0, count($quoteFolderIds), '?'));
                $stmt = $this->conn->prepare("SELECT * FROM qc_folders WHERE project_id IN ($inClause) OR folder_id IN ($fInClause) ORDER BY folder_id ASC");
                $stmt->execute(array_merge($aliases, $quoteFolderIds));
            } else {
                $stmt = $this->conn->prepare("SELECT * FROM qc_folders WHERE project_id IN ($inClause) ORDER BY folder_id ASC");
                $stmt->execute($aliases);
            }
            $folders = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Process and normalize folder objects & extract version numbers from names if missing
            foreach ($folders as &$f) {
                if (stripos($f['name'], 'Quotation Reviews') !== false) {
                    $f['version_number'] = 0;
                    continue;
                }
                if (empty($f['version_number']) || intval($f['version_number']) <= 0) {
                    if (preg_match('/version\s*(\d+)/i', $f['name'], $matches)) {
                        $f['version_number'] = intval($matches[1]);
                    } else if (preg_match('/v(\d+)/i', $f['name'], $matches)) {
                        $f['version_number'] = intval($matches[1]);
                    } else {
                        $f['version_number'] = 0;
                    }
                } else {
                    $f['version_number'] = intval($f['version_number']);
                }

                // Clean up folder names for display
                if ($f['version_number'] > 0) {
                    $f['name'] = "Version " . $f['version_number'];
                }
            }
            unset($f);

            // Group and deduplicate folders by version_number to eliminate duplicate folders
            $uniqueFolders = [];
            foreach ($folders as $f) {
                $vNum = intval($f['version_number'] ?? 0);
                $key = $vNum > 0 ? "v_" . $vNum : "n_" . strtolower(trim($f['name']));

                if (!isset($uniqueFolders[$key])) {
                    $uniqueFolders[$key] = $f;
                } else {
                    // Re-link files from duplicate folder to primary folder and delete duplicate folder
                    $primaryFid = $uniqueFolders[$key]['folder_id'];
                    $duplicateFid = $f['folder_id'];
                    if ($primaryFid !== $duplicateFid) {
                        try {
                            $updFiles = $this->conn->prepare("UPDATE qc_files SET folder_id = :pfid WHERE folder_id = :dfid");
                            $updFiles->execute(['pfid' => $primaryFid, 'dfid' => $duplicateFid]);
                            
                            $delF = $this->conn->prepare("DELETE FROM qc_folders WHERE folder_id = :dfid");
                            $delF->execute(['dfid' => $duplicateFid]);
                        } catch (Exception $e) {}
                    }
                }
            }
            $folders = array_values($uniqueFolders);

            // Clean up any empty ghost 'Quotation Reviews' or version_number=0 folders without files
            try {
                $this->conn->exec("DELETE FROM qc_folders WHERE (name = 'Quotation Reviews' OR version_number = 0) AND folder_id NOT IN (SELECT DISTINCT folder_id FROM qc_files WHERE folder_id IS NOT NULL)");
            } catch (Exception $e) {}

            // Filter out any empty 'Quotation Reviews' placeholder
            $folders = array_values(array_filter($folders, function($f) {
                return stripos($f['name'], 'Quotation Reviews') === false || intval($f['version_number'] ?? 0) > 0;
            }));

            // Sort folders: Highest version number first (Version 7, Version 6, Version 5...), followed by general folders
            usort($folders, function($a, $b) {
                $vA = intval($a['version_number'] ?? 0);
                $vB = intval($b['version_number'] ?? 0);
                if ($vA !== $vB) {
                    return $vB - $vA; // Higher version number first
                }
                return intval($b['folder_id']) - intval($a['folder_id']);
            });

            return ["success" => true, "data" => $folders];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    public function createQCFolder($data)
    {
        try {
            $raw_project_id = $data['project_id'] ?? null;
            $name = trim($data['name'] ?? '');

            if (!$raw_project_id || empty($name)) {
                return ["success" => false, "message" => "Project ID and folder name are required"];
            }

            $aliases = $this->getProjectIdAliases($raw_project_id);
            $project_id = !empty($aliases) ? $aliases[0] : $raw_project_id;

            $vNum = 0;
            if (preg_match('/version\s*(\d+)/i', $name, $matches)) {
                $vNum = intval($matches[1]);
            } else if (preg_match('/v(\d+)/i', $name, $matches)) {
                $vNum = intval($matches[1]);
            }

            $stmt = $this->conn->prepare("INSERT INTO qc_folders (project_id, name, status, version_number) VALUES (:pid, :name, 'pending_review', :vnum)");
            $stmt->execute(['pid' => $project_id, 'name' => $name, 'vnum' => $vNum]);
            $folder_id = $this->conn->lastInsertId();

            // When creating a new version folder (e.g. Version 2), carry over ONLY approved files from previous versions
            if ($vNum > 1 && $folder_id) {
                $this->carryOverApprovedFiles($folder_id, $project_id, $vNum);
            }

            return ["success" => true, "message" => "QC folder created successfully", "folder_id" => $folder_id];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    /**
     * Shifts / carries over ONLY approved drawings and companion files from earlier versions
     * to the new version folder. Rejected or unapproved files are never carried over.
     */
    public function carryOverApprovedFiles($folder_id, $project_id, $version_number)
    {
        try {
            $folder_id = intval($folder_id);
            $version_number = intval($version_number);
            if ($folder_id <= 0 || $version_number <= 1) {
                return;
            }

            // 1. Get current folder info
            $cfStmt = $this->conn->prepare("SELECT folder_id, project_id, name, version_number FROM qc_folders WHERE folder_id = ? LIMIT 1");
            $cfStmt->execute([$folder_id]);
            $currFolder = $cfStmt->fetch(PDO::FETCH_ASSOC);

            // 2. Gather all project aliases
            $rawPids = array_filter([$project_id, $currFolder['project_id'] ?? null]);
            $aliases = [];
            foreach ($rawPids as $rp) {
                $aliases = array_merge($aliases, $this->getProjectIdAliases($rp));
            }
            $aliases = array_values(array_unique(array_filter($aliases)));
            if (empty($aliases)) {
                $aliases = [(string)$project_id];
            }
            $inClause = implode(',', array_fill(0, count($aliases), '?'));

            // 3. Find earlier folders for this project
            $allFStmt = $this->conn->prepare("SELECT folder_id, name, version_number FROM qc_folders WHERE project_id IN ($inClause) ORDER BY folder_id ASC");
            $allFStmt->execute($aliases);
            $allFolders = $allFStmt->fetchAll(PDO::FETCH_ASSOC);

            $prevFolderIds = [];
            foreach ($allFolders as $f) {
                $v = intval($f['version_number'] ?? 0);
                if ($v <= 0) {
                    if (preg_match('/version\s*(\d+)/i', $f['name'], $m)) {
                        $v = intval($m[1]);
                    } else if (preg_match('/v(\d+)/i', $f['name'], $m)) {
                        $v = intval($m[1]);
                    }
                }
                if ($v > 0 && $v < $version_number && intval($f['folder_id']) !== $folder_id) {
                    $prevFolderIds[] = intval($f['folder_id']);
                }
            }

            // Also check qc_files directly to find any files belonging to earlier rounds
            try {
                $moreFStmt = $this->conn->prepare("SELECT DISTINCT folder_id FROM qc_files WHERE project_id IN ($inClause) AND folder_id != ? AND folder_id IS NOT NULL");
                $moreFStmt->execute(array_merge($aliases, [$folder_id]));
                $foundFids = array_filter(array_map('intval', $moreFStmt->fetchAll(PDO::FETCH_COLUMN)));
                foreach ($foundFids as $ffid) {
                    if (!in_array($ffid, $prevFolderIds)) {
                        $prevFolderIds[] = $ffid;
                    }
                }
            } catch (Exception $e) {}

            if (empty($prevFolderIds)) {
                return;
            }

            // 4. Query files with status = 'approved' from earlier folders
            $pfInClause = implode(',', array_fill(0, count($prevFolderIds), '?'));
            $appStmt = $this->conn->prepare("
                SELECT * FROM qc_files 
                WHERE folder_id IN ($pfInClause) 
                  AND status = 'approved'
                ORDER BY file_id ASC
            ");
            $appStmt->execute($prevFolderIds);
            $approvedFiles = $appStmt->fetchAll(PDO::FETCH_ASSOC);

            if (empty($approvedFiles)) {
                return;
            }

            // 5. Carry over each approved file if not already in $folder_id
            foreach ($approvedFiles as $af) {
                $fname = trim($af['file_name']);

                // Skip auto-generated quote PDF from old version (e.g. Quotation_v1_..._QC.pdf)
                if (preg_match('/Quotation_v(\d+)_.*_QC\.pdf$/i', $fname, $qm) && intval($qm[1]) < $version_number) {
                    continue;
                }

                // Check if file with same name already exists in target folder
                $chk = $this->conn->prepare("SELECT file_id, status FROM qc_files WHERE folder_id = :fid AND file_name = :fname LIMIT 1");
                $chk->execute(['fid' => $folder_id, 'fname' => $fname]);
                $existing = $chk->fetch(PDO::FETCH_ASSOC);

                if (!$existing) {
                    // Insert approved file into new version folder
                    $ins = $this->conn->prepare("
                        INSERT INTO qc_files (project_id, folder_id, quote_id, file_name, file_path, file_type, uploader_name, status, revision_number, parent_file_id)
                        VALUES (:pid, :fid, :qid, :fname, :fpath, :ftype, :uname, 'approved', :rev, :parent_id)
                    ");
                    $ins->execute([
                        'pid' => $af['project_id'] ?: ($currFolder['project_id'] ?? $project_id),
                        'fid' => $folder_id,
                        'qid' => $af['quote_id'] ?: NULL,
                        'fname' => $af['file_name'],
                        'fpath' => $af['file_path'],
                        'ftype' => $af['file_type'] ?? 'application/pdf',
                        'uname' => $af['uploader_name'] ?? 'System',
                        'rev' => $version_number,
                        'parent_id' => $af['parent_file_id'] ?: $af['file_id']
                    ]);
                } else if ($existing['status'] !== 'approved') {
                    // Ensure carried-over file has approved status
                    $this->conn->prepare("UPDATE qc_files SET status = 'approved' WHERE file_id = :fid")->execute(['fid' => $existing['file_id']]);
                }
            }
        } catch (Exception $e) {
            error_log("Error in carryOverApprovedFiles: " . $e->getMessage());
        }
    }

    public function getQCFiles($raw_project_id, $folder_id = null)
    {
        try {
            if ($folder_id && intval($folder_id) > 0) {
                $fid = intval($folder_id);

                // Auto-sync approved drawings from earlier versions if this is a version folder (version > 1)
                try {
                    $fStmt = $this->conn->prepare("SELECT project_id, name, version_number FROM qc_folders WHERE folder_id = ? LIMIT 1");
                    $fStmt->execute([$fid]);
                    $fRow = $fStmt->fetch(PDO::FETCH_ASSOC);
                    if ($fRow) {
                        $vNum = intval($fRow['version_number'] ?? 0);
                        if ($vNum <= 0) {
                            if (preg_match('/version\s*(\d+)/i', $fRow['name'], $m)) {
                                $vNum = intval($m[1]);
                            } else if (preg_match('/v(\d+)/i', $fRow['name'], $m)) {
                                $vNum = intval($m[1]);
                            }
                        }
                        if ($vNum > 1) {
                            $this->carryOverApprovedFiles($fid, $fRow['project_id'] ?: $raw_project_id, $vNum);
                        }
                    }
                } catch (Exception $e) {}

                $stmt = $this->conn->prepare("SELECT * FROM qc_files WHERE folder_id = ? ORDER BY uploaded_at DESC, file_id DESC");
                $stmt->execute([$fid]);
                $files = $stmt->fetchAll(PDO::FETCH_ASSOC);
                return ["success" => true, "data" => $files];
            }

            $aliases = $this->getProjectIdAliases($raw_project_id);
            if (empty($aliases)) {
                $aliases = [trim((string)$raw_project_id)];
            }
            $inClause = implode(',', array_fill(0, count($aliases), '?'));

            $stmt = $this->conn->prepare("SELECT * FROM qc_files WHERE project_id IN ($inClause) OR quote_id IN (SELECT quote_id FROM quotes WHERE project_id IN ($inClause)) ORDER BY uploaded_at DESC, file_id DESC");
            $stmt->execute(array_merge($aliases, $aliases));
            $files = $stmt->fetchAll(PDO::FETCH_ASSOC);

            return ["success" => true, "data" => $files];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    private function getProjectIdAliases($project_id)
    {
        $raw = trim((string)$project_id);
        if (empty($raw) || $raw === '0' || $raw === 'null' || $raw === 'undefined') return [];
        $aliases = [$raw];
        $numOnly = preg_replace('/[^0-9]/', '', $raw);
        if (!empty($numOnly)) {
            $aliases[] = $numOnly;
            $aliases[] = 'PR-' . $numOnly;
        }

        $canonicalPid = null;

        // 1. Exact lookup in projects table
        try {
            $q = "SELECT p.project_id, p.project_code, p.client_id, p.project_name 
                  FROM projects p 
                  WHERE p.project_id = :id 
                     OR LOWER(p.project_code) = LOWER(:code)";
            $params = ['id' => $raw, 'code' => $raw];
            if (!empty($numOnly)) {
                $q .= " OR p.project_id = :num";
                $params['num'] = intval($numOnly);
            }
            $q .= " LIMIT 1";
            $stmt = $this->conn->prepare($q);
            $stmt->execute($params);
            $proj = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($proj) {
                $canonicalPid = (string)$proj['project_id'];
                $aliases[] = $canonicalPid;
                $aliases[] = 'PR-' . $canonicalPid;
                if (!empty($proj['project_code'])) {
                    $aliases[] = (string)$proj['project_code'];
                    $aliases[] = strtolower((string)$proj['project_code']);
                    $aliases[] = strtoupper((string)$proj['project_code']);
                }
                if (!empty($proj['client_id'])) {
                    $aliases[] = (string)$proj['client_id'];
                    try {
                        $cStmt = $this->conn->prepare("SELECT converted_from_lead_id FROM clients WHERE client_id = :cid LIMIT 1");
                        $cStmt->execute(['cid' => $proj['client_id']]);
                        $cli = $cStmt->fetch(PDO::FETCH_ASSOC);
                        if (!empty($cli['converted_from_lead_id'])) {
                            $aliases[] = (string)$cli['converted_from_lead_id'];
                            $aliases[] = 'PR-' . $cli['converted_from_lead_id'];
                        }
                    } catch (Exception $e) {}
                }
            }
        } catch (Exception $e) {}

        // 2. Exact lookup in leads table
        try {
            $lq = "SELECT lead_id, manual_client_id, client_name 
                   FROM leads 
                   WHERE lead_id = :lid 
                      OR LOWER(manual_client_id) = LOWER(:mcid)";
            $lparams = ['lid' => $raw, 'mcid' => $raw];
            if (!empty($numOnly)) {
                $lq .= " OR lead_id = :num";
                $lparams['num'] = intval($numOnly);
            }
            $lq .= " LIMIT 1";
            $lStmt = $this->conn->prepare($lq);
            $lStmt->execute($lparams);
            $lead = $lStmt->fetch(PDO::FETCH_ASSOC);
            if ($lead) {
                $aliases[] = (string)$lead['lead_id'];
                $aliases[] = 'PR-' . $lead['lead_id'];
                if (!empty($lead['manual_client_id'])) {
                    $aliases[] = (string)$lead['manual_client_id'];
                    $aliases[] = strtolower((string)$lead['manual_client_id']);
                    $aliases[] = strtoupper((string)$lead['manual_client_id']);
                }
                try {
                    $convStmt = $this->conn->prepare("SELECT p.project_id, p.project_code FROM projects p JOIN clients c ON p.client_id = c.client_id WHERE c.converted_from_lead_id = :lid LIMIT 1");
                    $convStmt->execute(['lid' => $lead['lead_id']]);
                    $convProj = $convStmt->fetch(PDO::FETCH_ASSOC);
                    if ($convProj) {
                        $aliases[] = (string)$convProj['project_id'];
                        $aliases[] = 'PR-' . $convProj['project_id'];
                        if (!empty($convProj['project_code'])) {
                            $aliases[] = (string)$convProj['project_code'];
                        }
                    }
                } catch (Exception $e) {}
            }
        } catch (Exception $e) {}

        // 3. Quotes project_id cross-reference
        if ($canonicalPid) {
            try {
                $qStmt = $this->conn->prepare("SELECT DISTINCT qf.project_id FROM qc_files qf JOIN quotes q ON qf.quote_id = q.quote_id WHERE q.project_id = :pid LIMIT 5");
                $qStmt->execute(['pid' => $canonicalPid]);
                $legacyPids = $qStmt->fetchAll(PDO::FETCH_COLUMN);
                foreach ($legacyPids as $lpid) {
                    if (!empty($lpid)) {
                        $aliases[] = (string)$lpid;
                    }
                }
            } catch (Exception $e) {}
        }

        // Filter and deduplicate
        $clean = array_filter(array_unique($aliases), function($v) {
            $t = trim((string)$v);
            return !empty($t) && $t !== '0' && $t !== 'null' && $t !== 'undefined';
        });

        // Ensure canonical numeric project_id is first in the list if available
        $result = array_values($clean);
        if ($canonicalPid) {
            $pos = array_search($canonicalPid, $result);
            if ($pos !== false) {
                array_splice($result, $pos, 1);
            }
            array_unshift($result, $canonicalPid);
        }

        return $result;
    }

    public function getQCFileVersions($file_id)
    {
        try {
            $stmt = $this->conn->prepare("SELECT file_id, parent_file_id, file_name, project_id, quote_id FROM qc_files WHERE file_id = :fid LIMIT 1");
            $stmt->execute(['fid' => $file_id]);
            $file = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$file) return ["success" => false, "message" => "File not found"];

            $root_id = $file['parent_file_id'] ?: $file['file_id'];
            
            $vStmt = $this->conn->prepare("SELECT * FROM qc_files WHERE file_id = :root_id OR parent_file_id = :root_id ORDER BY revision_number DESC, file_id DESC");
            $vStmt->execute(['root_id' => $root_id]);
            $versions = $vStmt->fetchAll(PDO::FETCH_ASSOC);

            return ["success" => true, "data" => $versions];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    public function lockQCInspector($data)
    {
        try {
            $file_id = $data['file_id'] ?? null;
            $user_name = trim($data['user_name'] ?? 'QC Inspector');
            $user_id = $data['user_id'] ?? null;

            if (!$file_id) return ["success" => false, "message" => "File ID is required"];

            $stmt = $this->conn->prepare("SELECT file_id, status, reviewer_name, reviewer_id FROM qc_files WHERE file_id = :fid LIMIT 1");
            $stmt->execute(['fid' => $file_id]);
            $file = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$file) return ["success" => false, "message" => "File not found"];

            // No blocking lock: Any QC, admin, designer, or other employee can open and review the file freely
            // Only set status to 'under_review' if it was 'pending_review'.
            // Do NOT overwrite 'changes_requested' (rejected) or 'approved' statuses when merely opening the file!
            if ($file['status'] === 'pending_review') {
                $upd = $this->conn->prepare("UPDATE qc_files SET status = 'under_review', reviewer_name = :rname, reviewer_id = :rid WHERE file_id = :fid");
                $upd->execute([
                    'rname' => $user_name,
                    'rid' => $user_id,
                    'fid' => $file_id
                ]);
            } else {
                // Update latest reviewer without changing existing status
                $upd = $this->conn->prepare("UPDATE qc_files SET reviewer_name = :rname, reviewer_id = :rid WHERE file_id = :fid");
                $upd->execute([
                    'rname' => $user_name,
                    'rid' => $user_id,
                    'fid' => $file_id
                ]);
            }

            return [
                "success" => true,
                "locked" => false,
                "message" => "File opened for review"
            ];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    public function sendQuoteToQC($data)
    {
        try {
            $raw_project_id = $data['project_id'] ?? null;
            $quote_id = $data['quote_id'] ?? null;
            $user_name = $data['user_name'] ?? 'System User';
            $quote_number = $data['quote_number'] ?? null;
            $req_version = isset($data['version']) ? intval($data['version']) : 0;

            if (!$raw_project_id && !$quote_id) {
                return ["success" => false, "message" => "Project ID is required"];
            }

            // 1. Resolve canonical numeric project_id
            $canonical_project_id = 0;
            if ($quote_id && intval($quote_id) > 0) {
                $qCheck = $this->conn->prepare("SELECT quote_id, project_id, version, quote_number, subtitle FROM quotes WHERE quote_id = :qid LIMIT 1");
                $qCheck->execute(['qid' => $quote_id]);
                $qRow = $qCheck->fetch(PDO::FETCH_ASSOC);
                if ($qRow && !empty($qRow['project_id'])) {
                    $canonical_project_id = intval($qRow['project_id']);
                    if (!$quote_number) {
                        $quote_number = $qRow['subtitle'] ?: ($qRow['quote_number'] ?: ('QT-' . $quote_id));
                    }
                    if ($req_version <= 0 && !empty($qRow['version'])) {
                        $req_version = intval($qRow['version']);
                    }
                }
            }

            if ($canonical_project_id <= 0 && $raw_project_id) {
                $pCheck = $this->conn->prepare("SELECT project_id, project_code FROM projects WHERE project_id = :pid OR LOWER(project_code) = LOWER(:code) LIMIT 1");
                $pCheck->execute(['pid' => $raw_project_id, 'code' => $raw_project_id]);
                $pRow = $pCheck->fetch(PDO::FETCH_ASSOC);
                if ($pRow && !empty($pRow['project_id'])) {
                    $canonical_project_id = intval($pRow['project_id']);
                } else if (is_numeric($raw_project_id) && intval($raw_project_id) > 0) {
                    $canonical_project_id = intval($raw_project_id);
                }
            }

            $project_id = $canonical_project_id > 0 ? $canonical_project_id : trim((string)$raw_project_id);
            $aliases = $this->getProjectIdAliases($project_id);
            if (empty($aliases)) {
                $aliases = [(string)$project_id];
            }

            $inClause = implode(',', array_fill(0, count($aliases), '?'));
            if (!$quote_id) {
                $qStmt = $this->conn->prepare("SELECT quote_id, quote_number, subtitle, version FROM quotes WHERE project_id IN ($inClause) ORDER BY version DESC, quote_id DESC LIMIT 1");
                $qStmt->execute($aliases);
                $latestQuote = $qStmt->fetch(PDO::FETCH_ASSOC);
                if ($latestQuote) {
                    $quote_id = $latestQuote['quote_id'];
                    $quote_number = $latestQuote['subtitle'] ?: ($latestQuote['quote_number'] ?: ('QT-' . $quote_id));
                    if ($req_version <= 0 && !empty($latestQuote['version'])) {
                        $req_version = intval($latestQuote['version']);
                    }
                }
            }

            if ($req_version > 0) {
                $version_number = $req_version;
            } else {
                $version_number = 1;
            }

            // Find all QC folders associated with this project / quotes
            $quoteFolderIds = [];
            try {
                $qfStmt = $this->conn->prepare("SELECT DISTINCT folder_id FROM qc_files WHERE (project_id IN ($inClause) OR quote_id IN (SELECT quote_id FROM quotes WHERE project_id IN ($inClause))) AND folder_id IS NOT NULL");
                $qfStmt->execute(array_merge($aliases, $aliases));
                $quoteFolderIds = array_filter(array_map('intval', $qfStmt->fetchAll(PDO::FETCH_COLUMN)));
            } catch (Exception $e) {}

            $allFoldersQuery = !empty($quoteFolderIds)
                ? "SELECT * FROM qc_folders WHERE project_id IN ($inClause) OR folder_id IN (" . implode(',', array_fill(0, count($quoteFolderIds), '?')) . ") ORDER BY folder_id ASC"
                : "SELECT * FROM qc_folders WHERE project_id IN ($inClause) ORDER BY folder_id ASC";
            $allFoldersStmt = $this->conn->prepare($allFoldersQuery);
            $allFoldersStmt->execute(!empty($quoteFolderIds) ? array_merge($aliases, $quoteFolderIds) : $aliases);
            $allFolders = $allFoldersStmt->fetchAll(PDO::FETCH_ASSOC);

            // Clean up any empty ghost 'Quotation Reviews' or version_number=0 folders without files
            try {
                $this->conn->exec("DELETE FROM qc_folders WHERE (name = 'Quotation Reviews' OR version_number = 0) AND folder_id NOT IN (SELECT DISTINCT folder_id FROM qc_files WHERE folder_id IS NOT NULL)");
            } catch (Exception $e) {}

            // Normalize version_number on each folder and strictly keep quotation version folders (version_number >= 1)
            $versionFolders = [];
            foreach ($allFolders as $f) {
                $vNum = intval($f['version_number'] ?? 0);
                if ($vNum <= 0) {
                    if (preg_match('/version\s*(\d+)/i', $f['name'], $m)) {
                        $vNum = intval($m[1]);
                    } else if (preg_match('/v(\d+)/i', $f['name'], $m)) {
                        $vNum = intval($m[1]);
                    }
                }
                if ($vNum > 0) {
                    $f['version_number'] = $vNum;
                    $versionFolders[] = $f;
                }
            }

            // Sort version folders: Highest version number first
            usort($versionFolders, function($a, $b) {
                if ($a['version_number'] !== $b['version_number']) {
                    return $b['version_number'] - $a['version_number'];
                }
                return intval($b['folder_id']) - intval($a['folder_id']);
            });

            // Find the immediate previous version folder that actually has files submitted and was under review
            $prevFolderToCheck = null;
            foreach ($versionFolders as $f) {
                if ($f['version_number'] > 0 && $f['version_number'] < $version_number) {
                    try {
                        $chkF = $this->conn->prepare("SELECT COUNT(*) FROM qc_files WHERE folder_id = :fid");
                        $chkF->execute(['fid' => $f['folder_id']]);
                        if (intval($chkF->fetchColumn() ?: 0) > 0) {
                            $prevFolderToCheck = $f;
                            break;
                        }
                    } catch (Exception $e) {
                        $prevFolderToCheck = $f;
                        break;
                    }
                }
            }

            if ($prevFolderToCheck && $prevFolderToCheck['version_number'] > 0 && $version_number > $prevFolderToCheck['version_number']) {
                $isPrevTotalRejected = (
                    $prevFolderToCheck['status'] === 'changes_requested' ||
                    $prevFolderToCheck['status'] === 'rejected' ||
                    $prevFolderToCheck['pm_status'] === 'qc_rejected' ||
                    $prevFolderToCheck['pm_status'] === 'pm_rejected'
                );

                $isPrevApproved = (
                    intval($prevFolderToCheck['final_qc_approved'] ?? 0) === 1 ||
                    ($prevFolderToCheck['pm_status'] ?? '') === 'approved' ||
                    ($prevFolderToCheck['pm_status'] ?? '') === 'pm_approved' ||
                    ($prevFolderToCheck['status'] ?? '') === 'approved'
                );

                // Block submitting new version UNLESS previous version folder has been Total Rejected or Approved by QC
                if (!$isPrevTotalRejected && !$isPrevApproved) {
                    return [
                        "success" => false,
                        "message" => "Quotation Version " . $prevFolderToCheck['version_number'] . " is currently under Quality Check review. Please wait for the QC team's final decision on Version " . $prevFolderToCheck['version_number'] . " folder before submitting Version " . $version_number . "."
                    ];
                }
            }

            if (!$quote_id || intval($quote_id) <= 0) {
                return ["success" => false, "message" => "No quote found for this project. Please save a quote first."];
            }

            try { $this->conn->exec("ALTER TABLE qc_folders ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending_review'"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE qc_folders ADD COLUMN IF NOT EXISTS version_number INT DEFAULT 1"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE qc_folders ADD COLUMN IF NOT EXISTS pm_status VARCHAR(50) DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE qc_folders ADD COLUMN IF NOT EXISTS pm_notes TEXT DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE qc_folders ADD COLUMN IF NOT EXISTS final_qc_approved TINYINT(1) DEFAULT 0"); } catch (Exception $e) {}

            $folderName = "Version " . $version_number;

            // Version specific folder (e.g. Version 2)
            $fStmt = $this->conn->prepare("SELECT folder_id, status, pm_status FROM qc_folders WHERE project_id IN ($inClause) AND (name = ? OR name LIKE ? OR version_number = ?) ORDER BY folder_id ASC LIMIT 1");
            $fStmt->execute(array_merge($aliases, [$folderName, "Version " . $version_number . "%", $version_number]));
            $folder = $fStmt->fetch(PDO::FETCH_ASSOC);

            if (!$folder) {
                $insF = $this->conn->prepare("INSERT INTO qc_folders (project_id, name, status, version_number, pm_status, pm_notes, final_qc_approved) VALUES (:pid, :fname, 'pending_review', :vnum, NULL, NULL, 0)");
                $insF->execute(['pid' => $project_id, 'fname' => $folderName, 'vnum' => $version_number]);
                $folder_id = $this->conn->lastInsertId();
            } else {
                $folder_id = $folder['folder_id'];
                $updF = $this->conn->prepare("UPDATE qc_folders SET project_id = :pid, name = :fname, status = 'pending_review', version_number = :vnum, pm_status = NULL, pm_notes = NULL, final_qc_approved = 0 WHERE folder_id = :fid");
                $updF->execute(['pid' => $project_id, 'fname' => $folderName, 'vnum' => $version_number, 'fid' => $folder_id]);
            }

            $file_name = "Quotation_v" . $version_number . "_" . ($quote_number ?: ('QT-' . $quote_id)) . "_QC.pdf";
            $file_path = "print-quote/" . $quote_id;

            $file_id = null;

            // Insert or update directly in the Version specific folder
            $chkFile = $this->conn->prepare("SELECT file_id FROM qc_files WHERE folder_id = :fid AND (quote_id = :qid OR file_name = :fname) LIMIT 1");
            $chkFile->execute(['fid' => $folder_id, 'qid' => $quote_id, 'fname' => $file_name]);
            $existingFile = $chkFile->fetch(PDO::FETCH_ASSOC);

            if ($existingFile) {
                $upd = $this->conn->prepare("UPDATE qc_files SET project_id = :pid, folder_id = :fid, status = 'under_review', uploaded_at = CURRENT_TIMESTAMP, uploader_name = :uname WHERE file_id = :fid");
                $upd->execute(['pid' => $project_id, 'fid' => $folder_id, 'uname' => $user_name, 'fid' => $existingFile['file_id']]);
                $file_id = $existingFile['file_id'];
            } else {
                $ins = $this->conn->prepare("INSERT INTO qc_files (project_id, folder_id, quote_id, file_name, file_path, file_type, uploader_name, status, revision_number) 
                                             VALUES (:pid, :fid, :qid, :fname, :fpath, 'quote_pdf', :uname, 'under_review', :rev)");
                $ins->execute([
                    'pid' => $project_id,
                    'fid' => $folder_id,
                    'qid' => $quote_id,
                    'fname' => $file_name,
                    'fpath' => $file_path,
                    'uname' => $user_name,
                    'rev' => $version_number
                ]);
                $file_id = $this->conn->lastInsertId();
            }

            if ($file_id) {
                try {
                    $insC = $this->conn->prepare("INSERT INTO qc_comments (file_id, project_id, page_number, user_name, severity, comment_text, status)
                                                  VALUES (:fid, :pid, 1, :uname, 'medium', :txt, 'open')");
                    $insC->execute([
                        'fid' => $file_id,
                        'pid' => $project_id,
                        'uname' => $user_name,
                        'txt' => "Quotation Version " . $version_number . " sent for Quality Check inspection."
                    ]);
                } catch (Exception $e) {}
            }

            // SMART STATUS CARRY-OVER ACROSS VERSIONS:
            // Carry over ONLY approved files from earlier versions into this new version folder
            // Rejected or unapproved files are never carried over
            if ($version_number > 1 && $folder_id) {
                $this->carryOverApprovedFiles($folder_id, $project_id, $version_number);
            }

            return [
                "success" => true,
                "message" => "Quotation Version " . $version_number . " sent to Quality Check (QC) tab successfully!",
                "file_id" => $file_id,
                "folder_id" => $folder_id,
                "quote_id" => $quote_id
            ];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    public function uploadQCFile($data, $files)
    {
        try {
            $raw_project_id = $data['project_id'] ?? null;
            $folder_id = isset($data['folder_id']) ? intval($data['folder_id']) : null;
            $user_name = $data['uploader_name'] ?? 'User';

            if (!$raw_project_id || !isset($files['file'])) {
                return ["success" => false, "message" => "File and Project ID are required"];
            }

            $aliases = $this->getProjectIdAliases($raw_project_id);
            $project_id = !empty($aliases) ? $aliases[0] : $raw_project_id;

            $file = $files['file'];
            if ($file['error'] !== UPLOAD_ERR_OK) {
                return ["success" => false, "message" => "File upload error: code " . $file['error']];
            }

            $upload_dir = __DIR__ . '/../../uploads/qc/' . $project_id . '/';
            if (!file_exists($upload_dir)) {
                mkdir($upload_dir, 0777, true);
            }

            $unique_name = time() . '_' . preg_replace('/[^a-zA-Z0-9_.-]/', '_', $file['name']);
            $target_path = $upload_dir . $unique_name;
            $db_path = 'uploads/qc/' . $project_id . '/' . $unique_name;

            if (move_uploaded_file($file['tmp_name'], $target_path) || copy($file['tmp_name'], $target_path)) {
                // Determine folder version number if available
                $fVer = 1;
                if ($folder_id) {
                    $fStmt = $this->conn->prepare("SELECT version_number, name FROM qc_folders WHERE folder_id = ? LIMIT 1");
                    $fStmt->execute([$folder_id]);
                    $folderRow = $fStmt->fetch(PDO::FETCH_ASSOC);
                    if ($folderRow) {
                        $fVer = intval($folderRow['version_number'] ?? 0);
                        if ($fVer <= 0) {
                            if (preg_match('/version\s*(\d+)/i', $folderRow['name'], $m)) {
                                $fVer = intval($m[1]);
                            }
                        }
                    }
                }
                if ($fVer <= 0) $fVer = 1;

                // Check if file already exists in THIS specific folder
                $chkFolderFile = $this->conn->prepare("SELECT file_id, parent_file_id FROM qc_files WHERE folder_id = :fid AND file_name = :fname LIMIT 1");
                $chkFolderFile->execute(['fid' => $folder_id, 'fname' => $file['name']]);
                $inCurrentFolder = $chkFolderFile->fetch(PDO::FETCH_ASSOC);

                // Check if file exists across project for revision tracking
                $inClause = implode(',', array_fill(0, count($aliases), '?'));
                $chk = $this->conn->prepare("SELECT file_id, revision_number, parent_file_id FROM qc_files WHERE project_id IN ($inClause) AND file_name = ? ORDER BY revision_number DESC, file_id DESC LIMIT 1");
                $chk->execute(array_merge($aliases, [$file['name']]));
                $existing = $chk->fetch(PDO::FETCH_ASSOC);

                if ($inCurrentFolder) {
                    $upd = $this->conn->prepare("UPDATE qc_files SET file_path = :fpath, file_type = :ftype, uploader_name = :uname, status = 'under_review', uploaded_at = CURRENT_TIMESTAMP WHERE file_id = :fid");
                    $upd->execute([
                        'fpath' => $db_path,
                        'ftype' => $file['type'] ?? 'application/pdf',
                        'uname' => $user_name,
                        'fid' => $inCurrentFolder['file_id']
                    ]);
                    $file_id = $inCurrentFolder['file_id'];
                } else if ($existing) {
                    $root_id = $existing['parent_file_id'] ?: $existing['file_id'];
                    $next_rev = $fVer > 1 ? $fVer : (intval($existing['revision_number'] ?: 1) + 1);

                    $stmt = $this->conn->prepare("INSERT INTO qc_files (project_id, folder_id, file_name, file_path, file_type, uploader_name, status, revision_number, parent_file_id) 
                                                  VALUES (:pid, :fid, :fname, :fpath, :ftype, :uname, 'under_review', :rev, :parent_id)");
                    $stmt->execute([
                        'pid' => $project_id,
                        'fid' => $folder_id,
                        'fname' => $file['name'],
                        'fpath' => $db_path,
                        'ftype' => $file['type'] ?? 'application/pdf',
                        'uname' => $user_name,
                        'rev' => $next_rev,
                        'parent_id' => $root_id
                    ]);
                    $file_id = $this->conn->lastInsertId();
                } else {
                    $stmt = $this->conn->prepare("INSERT INTO qc_files (project_id, folder_id, file_name, file_path, file_type, uploader_name, status, revision_number, parent_file_id) 
                                                  VALUES (:pid, :fid, :fname, :fpath, :ftype, :uname, 'under_review', :rev, NULL)");
                    $stmt->execute([
                        'pid' => $project_id,
                        'fid' => $folder_id,
                        'fname' => $file['name'],
                        'fpath' => $db_path,
                        'ftype' => $file['type'] ?? 'application/pdf',
                        'uname' => $user_name,
                        'rev' => $fVer
                    ]);
                    $file_id = $this->conn->lastInsertId();
                }

                return [
                    "success" => true, 
                    "message" => "QC document uploaded successfully", 
                    "file_id" => $file_id,
                    "status" => "under_review"
                ];
            }

            return ["success" => false, "message" => "Failed to save upload file"];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    public function getQCComments($file_id)
    {
        try {
            $stmt = $this->conn->prepare("
                SELECT c.*, 
                       f.file_name, 
                       f.revision_number as file_version_number, 
                       fol.name as folder_name, 
                       fol.version_number as folder_version_number
                FROM qc_comments c
                LEFT JOIN qc_files f ON c.file_id = f.file_id
                LEFT JOIN qc_folders fol ON f.folder_id = fol.folder_id
                WHERE c.file_id = :fid
                ORDER BY c.created_at DESC
            ");
            $stmt->execute(['fid' => $file_id]);
            $comments = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Deduplicate comments if any joined twice
            $seen = [];
            $uniqueComments = [];
            foreach ($comments as $c) {
                if (!isset($seen[$c['comment_id']])) {
                    $seen[$c['comment_id']] = true;
                    $uniqueComments[] = $c;
                }
            }
            $comments = $uniqueComments;

            try {
                $this->conn->exec("CREATE TABLE IF NOT EXISTS qc_comment_replies (
                    reply_id INT AUTO_INCREMENT PRIMARY KEY,
                    comment_id INT NOT NULL,
                    user_name VARCHAR(255) NOT NULL,
                    user_role VARCHAR(50) DEFAULT 'designer',
                    reply_text TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

                foreach ($comments as &$c) {
                    $rStmt = $this->conn->prepare("SELECT * FROM qc_comment_replies WHERE comment_id = :cid ORDER BY created_at ASC");
                    $rStmt->execute(['cid' => $c['comment_id']]);
                    $c['replies'] = $rStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                }
            } catch (Exception $e) {
                foreach ($comments as &$c) {
                    $c['replies'] = [];
                }
            }

            return ["success" => true, "data" => $comments];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    public function addQCComment($data)
    {
        try {
            $file_id = $data['file_id'] ?? null;
            $project_id = $data['project_id'] ?? null;
            $user_name = $data['user_name'] ?? 'QC Inspector';
            $page_number = intval($data['page_number'] ?? 1);
            $target_text = trim($data['target_text'] ?? '');
            $comment_text = trim($data['comment_text'] ?? '');

            if (!$file_id || (empty($comment_text) && empty($target_text))) {
                return ["success" => false, "message" => "File ID and comment text or target text are required"];
            }

            try { $this->conn->exec("ALTER TABLE qc_comments ADD COLUMN IF NOT EXISTS target_text TEXT"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE qc_comments ADD COLUMN IF NOT EXISTS severity VARCHAR(20) DEFAULT 'medium'"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE qc_comments ADD COLUMN IF NOT EXISTS box_x VARCHAR(20) DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE qc_comments ADD COLUMN IF NOT EXISTS box_y VARCHAR(20) DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE qc_comments ADD COLUMN IF NOT EXISTS box_w VARCHAR(20) DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE qc_comments ADD COLUMN IF NOT EXISTS box_h VARCHAR(20) DEFAULT NULL"); } catch (Exception $e) {}

            $severity = $data['severity'] ?? 'medium';
            $box_x = isset($data['box_x']) ? strval($data['box_x']) : null;
            $box_y = isset($data['box_y']) ? strval($data['box_y']) : null;
            $box_w = isset($data['box_w']) ? strval($data['box_w']) : null;
            $box_h = isset($data['box_h']) ? strval($data['box_h']) : null;

            $stmt = $this->conn->prepare("INSERT INTO qc_comments (file_id, project_id, page_number, user_name, target_text, comment_text, severity, box_x, box_y, box_w, box_h, status) 
                                          VALUES (:fid, :pid, :page, :uname, :target, :txt, :severity, :bx, :by, :bw, :bh, 'open')");
            $stmt->execute([
                'fid' => $file_id,
                'pid' => $project_id,
                'page' => $page_number,
                'uname' => $user_name,
                'target' => $target_text,
                'txt' => $comment_text,
                'severity' => $severity,
                'bx' => $box_x,
                'by' => $box_y,
                'bw' => $box_w,
                'bh' => $box_h
            ]);

            return ["success" => true, "message" => "QC issue note submitted successfully", "comment_id" => $this->conn->lastInsertId()];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    public function updateQCStatus($data)
    {
        try {
            $file_id = $data['file_id'] ?? null;
            $status = $data['status'] ?? 'under_review'; // pending_review, under_review, approved, changes_requested

            if (!$file_id) {
                return ["success" => false, "message" => "File ID is required"];
            }

            if ($status === 'approved') {
                $chk = $this->conn->prepare("SELECT COUNT(*) FROM qc_comments WHERE file_id = :fid AND status IN ('open', 'reopen')");
                $chk->execute(['fid' => $file_id]);
                $unresolvedComments = intval($chk->fetchColumn());

                if ($unresolvedComments > 0) {
                    return [
                        "success" => false,
                        "message" => "Cannot approve document: There are open/reopened issues that have not been resolved by the designer yet."
                    ];
                }

                // Auto-approve comments that were marked 'resolved' by designer
                try {
                    $this->conn->prepare("UPDATE qc_comments SET status = 'approved' WHERE file_id = :fid AND status = 'resolved'")->execute(['fid' => $file_id]);
                } catch (Exception $e) {}
            }

            $stmt = $this->conn->prepare("UPDATE qc_files SET status = :st WHERE file_id = :fid");
            $stmt->execute(['st' => $status, 'fid' => $file_id]);

            // File status updated; parent folder status is manually updated by QC clicking Total Accept or Reject
            return ["success" => true, "message" => "QC status updated to " . str_replace('_', ' ', $status)];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    public function updateQCFolderStatus($data)
    {
        try {
            $folder_id = $data['folder_id'] ?? null;
            $status = $data['status'] ?? 'under_review'; // pending_review, under_review, approved, changes_requested
            $user_name = $data['user_name'] ?? 'QC Inspector';
            $notes = trim($data['notes'] ?? '');

            if (!$folder_id) {
                return ["success" => false, "message" => "Folder ID is required"];
            }

            if ($status === 'approved') {
                // Check if any open or reopen comments remain on any file in this folder
                $chkComments = $this->conn->prepare("SELECT COUNT(*) FROM qc_comments c 
                                                     JOIN qc_files f ON c.file_id = f.file_id 
                                                     WHERE f.folder_id = :fid AND c.status IN ('open', 'reopen')");
                $chkComments->execute(['fid' => $folder_id]);
                if (intval($chkComments->fetchColumn()) > 0) {
                    return [
                        "success" => false,
                        "message" => "Cannot approve version: There are open/reopened issues on files in this version. Designer must resolve them first."
                    ];
                }

                // Auto-approve comments that were marked 'resolved' by designer in this folder
                try {
                    $this->conn->prepare("UPDATE qc_comments c JOIN qc_files f ON c.file_id = f.file_id 
                                          SET c.status = 'approved' 
                                          WHERE f.folder_id = :fid AND c.status = 'resolved'")->execute(['fid' => $folder_id]);
                } catch (Exception $e) {}
            }

            try { $this->conn->exec("ALTER TABLE qc_folders ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending_review'"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE qc_folders ADD COLUMN IF NOT EXISTS pm_notes TEXT DEFAULT NULL"); } catch (Exception $e) {}

            $stmt = $this->conn->prepare("UPDATE qc_folders SET status = :st, pm_notes = :notes WHERE folder_id = :fid");
            $stmt->execute(['st' => $status, 'notes' => $notes ?: null, 'fid' => $folder_id]);

            // Version folder status updated for the folder only; file statuses are preserved independently

            // If folder is Rejected (changes_requested), send rejection email to designer
            if ($status === 'changes_requested' || $status === 'rejected') {
                $this->sendQCRejectionEmail($folder_id, $user_name, $notes);
            }

            return ["success" => true, "message" => "QC folder status updated to " . str_replace('_', ' ', $status)];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    private function sendQCRejectionEmail($folder_id, $qc_name, $notes = '')
    {
        try {
            $fStmt = $this->conn->prepare("SELECT * FROM qc_folders WHERE folder_id = :fid LIMIT 1");
            $fStmt->execute(['fid' => $folder_id]);
            $folder = $fStmt->fetch(PDO::FETCH_ASSOC);
            if (!$folder) return false;

            $pid = $folder['project_id'];
            $version_number = intval($folder['version_number'] ?? 1);
            if ($version_number <= 0) {
                if (preg_match('/version\s*(\d+)/i', $folder['name'], $m)) {
                    $version_number = intval($m[1]);
                } else {
                    $version_number = 1;
                }
            }
            $revNo = 'Rev-' . sprintf('%02d', $version_number);

            $projectName = 'Project #' . $pid;
            $customerName = 'Customer';
            $designerName = 'Designer';
            $designerEmail = null;
            $designerId = null;
            $clientEmail = null;
            $displayProjectId = (string)$pid;

            // 1. Try leads table
            try {
                $lStmt = $this->conn->prepare("SELECT * FROM leads WHERE lead_id = :lid OR manual_client_id = :lid LIMIT 1");
                $lStmt->execute(['lid' => $pid]);
                $lead = $lStmt->fetch(PDO::FETCH_ASSOC);
                if ($lead) {
                    $customerName = $lead['client_name'] ?: $lead['name'] ?: $customerName;
                    $projectName = $lead['project_name'] ?: $lead['client_name'] ?: $projectName;
                    $displayProjectId = $lead['manual_client_id'] ?: $lead['lead_id'] ?: $displayProjectId;
                    $clientEmail = $lead['email'] ?? null;
                    if (!empty($lead['assigned_to'])) {
                        $designerName = $lead['assigned_to'];
                    }
                    if (!empty($lead['designer_id'])) {
                        $designerId = $lead['designer_id'];
                    }
                }
            } catch (Exception $e) {}

            // 2. Try projects table
            try {
                $pStmt = $this->conn->prepare("SELECT p.*, c.name as client_name, c.email as client_email, u.name as designer_user_name, u.username as designer_user_email, u.email as designer_u_email 
                                               FROM projects p 
                                               LEFT JOIN clients c ON p.client_id = c.client_id 
                                               LEFT JOIN users u ON p.designer_id = u.id 
                                               WHERE p.project_id = :pid OR p.project_code = :pid LIMIT 1");
                $pStmt->execute(['pid' => $pid]);
                $proj = $pStmt->fetch(PDO::FETCH_ASSOC);
                if ($proj) {
                    if (!empty($proj['project_name'])) $projectName = $proj['project_name'];
                    if (!empty($proj['client_name'])) $customerName = $proj['client_name'];
                    if (!empty($proj['project_code'])) $displayProjectId = $proj['project_code'];
                    if (!empty($proj['client_email'])) $clientEmail = $proj['client_email'];
                    if (!empty($proj['designer_user_name'])) $designerName = $proj['designer_user_name'];
                    $dEmail = $proj['designer_user_email'] ?: ($proj['designer_u_email'] ?? null);
                    if (!empty($dEmail)) $designerEmail = $dEmail;
                    if (!empty($proj['designer_id'])) $designerId = $proj['designer_id'];
                }
            } catch (Exception $e) {}

            // 3. Resolve designer email if not yet found
            if (!$designerEmail && $designerId) {
                $designerEmail = MailHelper::getUserEmail($this->conn, $designerId);
            }
            if (!$designerEmail && !empty($designerName) && $designerName !== 'Designer') {
                try {
                    $uStmt = $this->conn->prepare("SELECT username, email FROM users WHERE name = :uname OR username = :uname LIMIT 1");
                    $uStmt->execute(['uname' => $designerName]);
                    $uRow = $uStmt->fetch(PDO::FETCH_ASSOC);
                    if ($uRow) {
                        $designerEmail = (!empty($uRow['username']) && filter_var($uRow['username'], FILTER_VALIDATE_EMAIL))
                            ? $uRow['username']
                            : ($uRow['email'] ?? null);
                    }
                } catch (Exception $e) {}
            }

            // 4. Fetch any open comments on files in this folder to include in remarks
            $qcCommentsText = $notes;
            try {
                $cStmt = $this->conn->prepare("SELECT c.comment_text, c.severity, f.file_name 
                                               FROM qc_comments c 
                                               JOIN qc_files f ON c.file_id = f.file_id 
                                               WHERE f.folder_id = :fid AND c.status IN ('open', 'reopen') AND c.comment_text NOT LIKE '%sent for Quality Check inspection%' 
                                               ORDER BY c.comment_id ASC");
                $cStmt->execute(['fid' => $folder_id]);
                $openCmts = $cStmt->fetchAll(PDO::FETCH_ASSOC);
                if (!empty($openCmts)) {
                    $cmtList = [];
                    foreach ($openCmts as $idx => $oc) {
                        $cmtList[] = ($idx + 1) . ". [" . ($oc['file_name'] ?: 'File') . "] " . $oc['comment_text'];
                    }
                    if (!empty($notes)) {
                        $qcCommentsText = $notes . "\n\nSpecific Issue Notes:\n" . implode("\n", $cmtList);
                    } else {
                        $qcCommentsText = implode("\n", $cmtList);
                    }
                }
            } catch (Exception $e) {}

            if (empty($qcCommentsText)) {
                $qcCommentsText = "Revisions required as per Quality Check inspection.";
            }

            $mailData = [
                'project_id' => $displayProjectId,
                'project_name' => $projectName,
                'customer_name' => $customerName,
                'designer_name' => $designerName,
                'designer_email' => $designerEmail,
                'designer_id' => $designerId,
                'client_email' => $clientEmail,
                'qc_name' => $qc_name ?: 'QC Inspector',
                'rev_no' => $revNo,
                'qc_date' => date('d M Y'),
                'qc_comments' => $qcCommentsText
            ];

            return MailHelper::sendQCNotification($this->conn, 'rejected', $mailData);
        } catch (Exception $e) {
            error_log("sendQCRejectionEmail error: " . $e->getMessage());
            return false;
        }
    }

    public function resolveQCComment($data)
    {
        try {
            $comment_id = $data['comment_id'] ?? null;
            $status = $data['status'] ?? 'resolved';

            if (!$comment_id) {
                return ["success" => false, "message" => "Comment ID is required"];
            }

            if ($status === 'resolved') {
                try {
                    $this->conn->exec("CREATE TABLE IF NOT EXISTS qc_comment_replies (
                        reply_id INT AUTO_INCREMENT PRIMARY KEY,
                        comment_id INT NOT NULL,
                        user_name VARCHAR(255) NOT NULL,
                        user_role VARCHAR(50) DEFAULT 'designer',
                        reply_text TEXT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

                    $rStmt = $this->conn->prepare("SELECT COUNT(*) FROM qc_comment_replies WHERE comment_id = :cid");
                    $rStmt->execute(['cid' => $comment_id]);
                    $replyCount = intval($rStmt->fetchColumn() ?: 0);
                    if ($replyCount === 0) {
                        return ["success" => false, "message" => "A reply is required before marking this issue as resolved. Please post a reply first."];
                    }
                } catch (Exception $e) {}
            }

            $stmt = $this->conn->prepare("UPDATE qc_comments SET status = :st WHERE comment_id = :cid");
            $stmt->execute(['st' => $status, 'cid' => $comment_id]);

            return ["success" => true, "message" => "Comment status updated to " . $status];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    public function addQCCommentReply($data)
    {
        try {
            $comment_id = $data['comment_id'] ?? null;
            $user_name = $data['user_name'] ?? 'Designer';
            $user_role = $data['user_role'] ?? 'designer';
            $reply_text = trim($data['reply_text'] ?? '');

            if (!$comment_id || empty($reply_text)) {
                return ["success" => false, "message" => "Comment ID and reply text are required"];
            }

            try {
                $this->conn->exec("CREATE TABLE IF NOT EXISTS qc_comment_replies (
                    reply_id INT AUTO_INCREMENT PRIMARY KEY,
                    comment_id INT NOT NULL,
                    user_name VARCHAR(255) NOT NULL,
                    user_role VARCHAR(50) DEFAULT 'designer',
                    reply_text TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
            } catch (Exception $e) {}

            $stmt = $this->conn->prepare("INSERT INTO qc_comment_replies (comment_id, user_name, user_role, reply_text) 
                                          VALUES (:cid, :uname, :urole, :txt)");
            $stmt->execute([
                'cid' => $comment_id,
                'uname' => $user_name,
                'urole' => $user_role,
                'txt' => $reply_text
            ]);

            // Automatically transition comment to 'resolved' upon reply
            $this->conn->prepare("UPDATE qc_comments SET status = 'resolved' WHERE comment_id = :cid")
                       ->execute(['cid' => $comment_id]);

            return ["success" => true, "message" => "Reply posted and comment resolved successfully", "reply_id" => $this->conn->lastInsertId(), "status" => "resolved"];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    private function checkQCManagementAccess($data)
    {
        $user_role = strtolower(trim($data['user_role'] ?? ''));
        $is_admin = !empty($data['is_admin']);
        $allowed_roles = [
            'admin', 'superadmin', 'owner',
            'manager', 'design_manager', 'designer_manager', 'dm',
            'business_manager', 'business_associate', 'bm', 'ba'
        ];
        return $is_admin || in_array($user_role, $allowed_roles) || strpos($user_role, 'admin') !== false || strpos($user_role, 'design_manager') !== false || strpos($user_role, 'business_manager') !== false;
    }

    public function renameQCFolder($data)
    {
        try {
            $folder_id = $data['folder_id'] ?? null;
            $name = trim($data['name'] ?? '');
            if (!$folder_id || empty($name)) {
                return ["success" => false, "message" => "Folder ID and name are required"];
            }

            if (!$this->checkQCManagementAccess($data) && !empty($data['user_role'])) {
                return ["success" => false, "message" => "Access denied. Only Admin, Design Manager, and Business Manager can rename version folders."];
            }

            $stmt = $this->conn->prepare("UPDATE qc_folders SET name = :name WHERE folder_id = :fid");
            $stmt->execute(['name' => $name, 'fid' => $folder_id]);
            return ["success" => true, "message" => "Folder renamed successfully"];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    public function deleteQCFolder($data)
    {
        try {
            $folder_id = $data['folder_id'] ?? null;
            if (!$folder_id) {
                return ["success" => false, "message" => "Folder ID is required"];
            }

            // Permission check: Only Admin, Design Manager, and Business Manager
            if (!$this->checkQCManagementAccess($data) && !empty($data['user_role'])) {
                return ["success" => false, "message" => "Access denied. Only Admin, Design Manager, and Business Manager can delete version folders."];
            }

            $stmtC = $this->conn->prepare("DELETE FROM qc_comments WHERE file_id IN (SELECT file_id FROM qc_files WHERE folder_id = :fid)");
            $stmtC->execute(['fid' => $folder_id]);

            $stmtF = $this->conn->prepare("DELETE FROM qc_files WHERE folder_id = :fid");
            $stmtF->execute(['fid' => $folder_id]);

            $stmt = $this->conn->prepare("DELETE FROM qc_folders WHERE folder_id = :fid");
            $stmt->execute(['fid' => $folder_id]);
            return ["success" => true, "message" => "Folder deleted successfully"];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    public function renameQCFile($data)
    {
        try {
            $file_id = $data['file_id'] ?? null;
            $name = trim($data['name'] ?? '');
            if (!$file_id || empty($name)) {
                return ["success" => false, "message" => "File ID and name are required"];
            }

            if (!$this->checkQCManagementAccess($data) && !empty($data['user_role'])) {
                return ["success" => false, "message" => "Access denied. Only Admin, Design Manager, and Business Manager can rename files."];
            }

            $stmt = $this->conn->prepare("UPDATE qc_files SET file_name = :name WHERE file_id = :fid");
            $stmt->execute(['name' => $name, 'fid' => $file_id]);
            return ["success" => true, "message" => "File renamed successfully"];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    public function deleteQCFile($data)
    {
        try {
            $file_id = $data['file_id'] ?? null;
            if (!$file_id) {
                return ["success" => false, "message" => "File ID is required"];
            }

            if (!$this->checkQCManagementAccess($data) && !empty($data['user_role'])) {
                return ["success" => false, "message" => "Access denied. Only Admin, Design Manager, and Business Manager can delete files."];
            }

            $stmtC = $this->conn->prepare("DELETE FROM qc_comments WHERE file_id = :fid");
            $stmtC->execute(['fid' => $file_id]);

            $stmt = $this->conn->prepare("DELETE FROM qc_files WHERE file_id = :fid");
            $stmt->execute(['fid' => $file_id]);
            return ["success" => true, "message" => "File deleted successfully"];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    public function sendToPM($data)
    {
        try {
            $folder_id = $data['folder_id'] ?? null;
            $user_name = $data['user_name'] ?? 'QC Inspector';
            $notes = trim($data['notes'] ?? '');

            if (!$folder_id) {
                return ["success" => false, "message" => "Folder ID is required"];
            }

            $stmt = $this->conn->prepare("SELECT * FROM qc_folders WHERE folder_id = :fid LIMIT 1");
            $stmt->execute(['fid' => $folder_id]);
            $folder = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$folder) {
                return ["success" => false, "message" => "Folder not found"];
            }

            // Verify that all files in this folder are approved
            $unapp = $this->conn->prepare("SELECT COUNT(*) FROM qc_files WHERE folder_id = :fid AND status != 'approved'");
            $unapp->execute(['fid' => $folder_id]);
            $unapprovedCount = intval($unapp->fetchColumn());

            if ($unapprovedCount > 0) {
                return [
                    "success" => false,
                    "message" => "Cannot send to PM: All files in this version folder must be fully Approved by QC first."
                ];
            }

            $upd = $this->conn->prepare("UPDATE qc_folders SET status = 'approved', pm_status = 'pending_pm_review', pm_notes = :notes WHERE folder_id = :fid");
            $upd->execute(['notes' => $notes, 'fid' => $folder_id]);

            return [
                "success" => true,
                "message" => "Version " . ($folder['version_number'] ?: '') . " sent to Project Manager (PM) for final review successfully!"
            ];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    public function pmApprove($data)
    {
        try {
            $folder_id = $data['folder_id'] ?? null;
            $user_name = $data['user_name'] ?? 'Project Manager';
            $notes = trim($data['notes'] ?? '');

            if (!$folder_id) {
                return ["success" => false, "message" => "Folder ID is required"];
            }

            $stmt = $this->conn->prepare("SELECT * FROM qc_folders WHERE folder_id = :fid LIMIT 1");
            $stmt->execute(['fid' => $folder_id]);
            $folder = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$folder) {
                return ["success" => false, "message" => "Folder not found"];
            }

            $upd = $this->conn->prepare("UPDATE qc_folders SET pm_status = 'pm_approved', pm_reviewer_name = :uname, pm_reviewed_at = CURRENT_TIMESTAMP, pm_notes = :notes WHERE folder_id = :fid");
            $upd->execute([
                'uname' => $user_name,
                'notes' => $notes,
                'fid' => $folder_id
            ]);

            // Sync with projects table so SOW done status is persisted immediately
            $pid = $folder['project_id'] ?? ($data['project_id'] ?? null);
            if ($pid) {
                try { $this->conn->exec("ALTER TABLE projects ADD COLUMN IF NOT EXISTS pm_status VARCHAR(50) DEFAULT NULL"); } catch (Exception $e) {}
                try { $this->conn->exec("ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_pm_approved TINYINT(1) DEFAULT 0"); } catch (Exception $e) {}
                try { $this->conn->exec("ALTER TABLE projects ADD COLUMN IF NOT EXISTS pm_qc_accepted TINYINT(1) DEFAULT 0"); } catch (Exception $e) {}
                try { $this->conn->exec("ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_sow_done TINYINT(1) DEFAULT 0"); } catch (Exception $e) {}

                $pUpd = $this->conn->prepare("UPDATE projects SET pm_status = 'pm_approved', is_pm_approved = 1, pm_qc_accepted = 1, is_sow_done = 1, project_stage = 'SOW done' WHERE project_id = :pid OR project_code = :pcode");
                $pUpd->execute([':pid' => $pid, ':pcode' => (string)$pid]);

                // Also update leads table if linked
                try {
                    $this->conn->prepare("UPDATE leads SET pm_status = 'pm_approved', is_pm_approved = 1, is_sow_done = 1 WHERE lead_id = :lid OR manual_client_id = :pcode")->execute([':lid' => $pid, ':pcode' => (string)$pid]);
                } catch (Exception $e) {}
            }

            return [
                "success" => true,
                "message" => "Version " . ($folder['version_number'] ?: '') . " has been accepted and cleared by PM! Scope of Work (SOW done) is confirmed."
            ];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    public function finalQCApprove($data)
    {
        try {
            $folder_id = $data['folder_id'] ?? null;
            $user_name = $data['user_name'] ?? 'QC Inspector';

            if (!$folder_id) {
                return ["success" => false, "message" => "Folder ID is required"];
            }

            $stmt = $this->conn->prepare("SELECT * FROM qc_folders WHERE folder_id = :fid LIMIT 1");
            $stmt->execute(['fid' => $folder_id]);
            $folder = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$folder) {
                return ["success" => false, "message" => "Folder not found"];
            }

            if ($folder['pm_status'] !== 'pm_approved') {
                return ["success" => false, "message" => "Cannot issue Final QC Approval: This version folder must be accepted and cleared by the Project Manager (PM) first."];
            }

            $upd = $this->conn->prepare("UPDATE qc_folders SET status = 'approved', final_qc_approved = 1, final_qc_reviewer_name = :uname, final_qc_approved_at = CURRENT_TIMESTAMP WHERE folder_id = :fid");
            $upd->execute([
                'uname' => $user_name,
                'fid' => $folder_id
            ]);

            // Finalize Project & Quotation
            $pid = $folder['project_id'];
            $finalQuoteAmt = null;
            $targetFinalQuoteId = null;

            if ($pid) {
                $projAliases = $this->getProjectIdAliases($pid);

                // Check for quotation in this folder
                $qInFolder = $this->conn->prepare("SELECT quote_id FROM qc_files WHERE folder_id = :fid AND quote_id IS NOT NULL AND quote_id > 0 LIMIT 1");
                $qInFolder->execute(['fid' => $folder_id]);
                $fQuoteId = $qInFolder->fetchColumn();

                if ($fQuoteId) {
                    $targetFinalQuoteId = intval($fQuoteId);
                    $fqStmt = $this->conn->prepare("SELECT total_amount FROM quotes WHERE quote_id = :qid LIMIT 1");
                    $fqStmt->execute(['qid' => $targetFinalQuoteId]);
                    $finalQuoteAmt = floatval($fqStmt->fetchColumn() ?: 0);
                }

                if (!$targetFinalQuoteId) {
                    foreach ($projAliases as $apid) {
                        try {
                            $fqStmt = $this->conn->prepare("SELECT quote_id, total_amount, extra_data FROM quotes WHERE project_id = :pid ORDER BY (status = 'Finalized' OR status = 'approved' OR status = 'qc_approved') DESC, version DESC, quote_id DESC LIMIT 1");
                            $fqStmt->execute(['pid' => $apid]);
                            $fqRow = $fqStmt->fetch(PDO::FETCH_ASSOC);
                            if ($fqRow && floatval($fqRow['total_amount'] ?? 0) > 0) {
                                $finalQuoteAmt = floatval($fqRow['total_amount']);
                                $targetFinalQuoteId = intval($fqRow['quote_id']);
                                break;
                            }
                        } catch (Exception $e) {}
                    }
                }

                foreach ($projAliases as $apid) {
                    try {
                        if ($finalQuoteAmt !== null && $finalQuoteAmt > 0) {
                            $pStmt = $this->conn->prepare("UPDATE projects SET status = 'qc_approved', total_budget = :famt, is_final_quote_approved = 1 WHERE project_id = :pid OR manual_client_id = :pid OR project_code = :pid OR id = :pid");
                            $pStmt->execute(['pid' => $apid, 'famt' => $finalQuoteAmt]);
                        } else {
                            $pStmt = $this->conn->prepare("UPDATE projects SET status = 'qc_approved', is_final_quote_approved = 1 WHERE project_id = :pid OR manual_client_id = :pid OR project_code = :pid OR id = :pid");
                            $pStmt->execute(['pid' => $apid]);
                        }
                    } catch (Exception $e) {}

                    if ($targetFinalQuoteId) {
                        try {
                            $qStmt = $this->conn->prepare("UPDATE quotes SET status = 'qc_approved', is_qc_approved = 1 WHERE quote_id = :qid");
                            $qStmt->execute(['qid' => $targetFinalQuoteId]);

                            $qExStmt = $this->conn->prepare("SELECT extra_data FROM quotes WHERE quote_id = :qid");
                            $qExStmt->execute(['qid' => $targetFinalQuoteId]);
                            $rawEx = $qExStmt->fetchColumn();
                            $exData = !empty($rawEx) ? (json_decode($rawEx, true) ?: []) : [];
                            $exData['is_final_version'] = true;
                            $this->conn->prepare("UPDATE quotes SET extra_data = :ex WHERE quote_id = :qid")->execute(['ex' => json_encode($exData), 'qid' => $targetFinalQuoteId]);
                        } catch (Exception $e) {}
                    } else {
                        try {
                            $qStmt = $this->conn->prepare("UPDATE quotes SET status = 'qc_approved', is_qc_approved = 1 WHERE project_id = :pid ORDER BY version DESC LIMIT 1");
                            $qStmt->execute(['pid' => $apid]);
                        } catch (Exception $e) {}
                    }

                    try {
                        $this->conn->prepare("UPDATE leads SET qc_status = 'approved', is_qc_completed = 1, is_qc_done = 1 WHERE lead_id = :lid OR manual_client_id = :lid")->execute(['lid' => $apid]);
                    } catch (Exception $e) {}
                }
            }

            return [
                "success" => true,
                "message" => "🎉 Final QC Approval complete! Version " . ($folder['version_number'] ?: '') . " has been officially sealed as the Final Quotation, and the project budget of ₹" . number_format($finalQuoteAmt ?: 0) . " is now finalized!"
            ];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    public function finalQCReject($data)
    {
        try {
            $folder_id = $data['folder_id'] ?? null;
            $user_name = $data['user_name'] ?? 'QC Inspector';
            $notes = trim($data['notes'] ?? '');

            if (!$folder_id) {
                return ["success" => false, "message" => "Folder ID is required"];
            }

            $upd = $this->conn->prepare("UPDATE qc_folders SET final_qc_approved = 0, pm_status = 'qc_rejected', pm_notes = :notes WHERE folder_id = :fid");
            $upd->execute([
                'notes' => $notes,
                'fid' => $folder_id
            ]);

            return [
                "success" => true,
                "message" => "Version returned with rejection notes for corrections."
            ];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    public function pmReject($data)
    {
        try {
            $folder_id = $data['folder_id'] ?? null;
            $user_name = $data['user_name'] ?? 'Project Manager';
            $notes = trim($data['notes'] ?? '');

            if (!$folder_id) {
                return ["success" => false, "message" => "Folder ID is required"];
            }

            $upd = $this->conn->prepare("UPDATE qc_folders SET pm_status = 'pm_rejected', status = 'changes_requested', pm_reviewer_name = :uname, pm_reviewed_at = CURRENT_TIMESTAMP, pm_notes = :notes WHERE folder_id = :fid");
            $upd->execute([
                'uname' => $user_name,
                'notes' => $notes,
                'fid' => $folder_id
            ]);

            // Flag files with open/reopened comments as changes_requested
            try {
                $this->conn->prepare("UPDATE qc_files SET status = 'changes_requested' WHERE folder_id = :fid AND file_id IN (SELECT file_id FROM qc_comments WHERE status IN ('open', 'reopen'))")->execute(['fid' => $folder_id]);
            } catch (Exception $e) {}

            return [
                "success" => true,
                "message" => "Version returned back to QC by Project Manager with rejection notes."
            ];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    public function getPendingPMApprovals()
    {
        try {
            $stmt = $this->conn->prepare("
                SELECT f.*, 
                       p.project_name, 
                       p.project_code,
                       p.project_id as db_project_id
                FROM qc_folders f
                LEFT JOIN projects p ON (f.project_id = p.project_id)
                WHERE f.pm_status = 'pending_pm_review'
                ORDER BY f.folder_id DESC
            ");
            $stmt->execute();
            $folders = $stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($folders as &$f) {
                if (empty($f['project_name'])) {
                    try {
                        $lStmt = $this->conn->prepare("SELECT client_name, name, manual_client_id FROM leads WHERE lead_id = :lid OR manual_client_id = :lid LIMIT 1");
                        $lStmt->execute(['lid' => $f['project_id']]);
                        $lead = $lStmt->fetch(PDO::FETCH_ASSOC);
                        if ($lead) {
                            $f['project_name'] = $lead['client_name'] ?: $lead['name'] ?: ('Project #' . $f['project_id']);
                            $f['project_code'] = $lead['manual_client_id'] ?: ('PRJ-' . $f['project_id']);
                        }
                    } catch (Exception $e) {}
                }
                if (empty($f['project_name'])) {
                    $f['project_name'] = 'Project #' . $f['project_id'];
                }

                try {
                    $cStmt = $this->conn->prepare("SELECT COUNT(*) as total_files FROM qc_files WHERE folder_id = :fid");
                    $cStmt->execute(['fid' => $f['folder_id']]);
                    $f['total_files'] = $cStmt->fetchColumn() ?: 0;
                } catch (Exception $e) {
                    $f['total_files'] = 0;
                }
            }
            unset($f);

            return ["success" => true, "data" => $folders];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    public function getFolderRejectDetails($folder_id)
    {
        try {
            if (!$folder_id) {
                return ["success" => false, "message" => "Folder ID is required"];
            }

            $stmt = $this->conn->prepare("SELECT * FROM qc_folders WHERE folder_id = :fid LIMIT 1");
            $stmt->execute(['fid' => $folder_id]);
            $folder = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$folder) {
                return ["success" => false, "message" => "Folder not found"];
            }

            $fStmt = $this->conn->prepare("SELECT * FROM qc_files WHERE folder_id = :fid ORDER BY (quote_id IS NOT NULL) DESC, file_id ASC");
            $fStmt->execute(['fid' => $folder_id]);
            $files = $fStmt->fetchAll(PDO::FETCH_ASSOC);

            // Fetch comments for all files in this folder
            $fileIds = array_column($files, 'file_id');
            $comments = [];
            if (!empty($fileIds)) {
                $inClause = implode(',', array_fill(0, count($fileIds), '?'));
                $cStmt = $this->conn->prepare("SELECT c.*, f.file_name, f.quote_id 
                                               FROM qc_comments c 
                                               JOIN qc_files f ON c.file_id = f.file_id 
                                               WHERE c.file_id IN ($inClause) 
                                               ORDER BY c.created_at ASC");
                $cStmt->execute($fileIds);
                $allComments = $cStmt->fetchAll(PDO::FETCH_ASSOC);

                // Fetch replies
                foreach ($allComments as &$com) {
                    try {
                        $rStmt = $this->conn->prepare("SELECT * FROM qc_comment_replies WHERE comment_id = :cid ORDER BY created_at ASC");
                        $rStmt->execute(['cid' => $com['comment_id']]);
                        $com['replies'] = $rStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                    } catch (Exception $e) {
                        $com['replies'] = [];
                    }
                }
                unset($com);
                $comments = $allComments;
            }

            return [
                "success" => true,
                "data" => [
                    "folder" => $folder,
                    "files" => $files,
                    "comments" => $comments
                ]
            ];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }
}
