<?php
class DocumentController {
    private $conn;

    public function __construct($db) {
        $this->conn = $db;
    }

    public function getFolders($project_id) {
        $this->ensureTablesExist();
        $this->syncLeadDocumentsIfNeeded($project_id);

        $query = "SELECT * FROM project_folders WHERE project_id = :project_id ORDER BY created_at DESC";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':project_id', $project_id);
        $stmt->execute();
        return ["success" => true, "data" => $stmt->fetchAll(PDO::FETCH_ASSOC)];
    }

    private function ensureTablesExist() {
        try {
            $this->conn->exec("CREATE TABLE IF NOT EXISTS project_folders (
                folder_id INT(11) AUTO_INCREMENT PRIMARY KEY,
                project_id INT(11) NOT NULL,
                name VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )");
            $this->conn->exec("CREATE TABLE IF NOT EXISTS project_files (
                file_id INT(11) AUTO_INCREMENT PRIMARY KEY,
                project_id INT(11) NOT NULL,
                folder_id INT(11) NOT NULL,
                file_name VARCHAR(255) NOT NULL,
                file_path VARCHAR(255) NOT NULL,
                file_type VARCHAR(100) DEFAULT NULL,
                uploaded_by INT(11) DEFAULT NULL,
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )");
            $this->conn->exec("CREATE TABLE IF NOT EXISTS project_notes (
                id INT(11) AUTO_INCREMENT PRIMARY KEY,
                project_id INT(11) NOT NULL,
                user_id INT(11) NOT NULL,
                note_text TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )");
        } catch (Exception $e) {}
    }

    public function getNotes($project_id) {
        $this->ensureTablesExist();
        $query = "SELECT n.*, COALESCE(NULLIF(u.name, ''), u.username, 'Team Member') as user_name 
                  FROM project_notes n 
                  LEFT JOIN users u ON n.user_id = u.user_id 
                  WHERE n.project_id = :project_id 
                  ORDER BY n.created_at DESC";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':project_id', $project_id);
        $stmt->execute();
        return ["success" => true, "data" => $stmt->fetchAll(PDO::FETCH_ASSOC)];
    }

    public function addNote($project_id, $note_text, $user_id) {
        $this->ensureTablesExist();
        if (empty(trim($note_text))) {
            return ["success" => false, "message" => "Note text cannot be empty"];
        }
        $query = "INSERT INTO project_notes (project_id, user_id, note_text) VALUES (:project_id, :user_id, :note_text)";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':project_id', $project_id);
        $stmt->bindParam(':user_id', $user_id);
        $stmt->bindParam(':note_text', $note_text);
        if ($stmt->execute()) {
            return ["success" => true, "message" => "Note added successfully"];
        }
        return ["success" => false, "message" => "Failed to add note"];
    }

    private function syncLeadDocumentsIfNeeded($project_id) {
        try {
            // Check if folder 'D1 & Lead Documents' exists
            $chk = $this->conn->prepare("SELECT folder_id FROM project_folders WHERE project_id = :pid AND name = 'D1 & Lead Documents'");
            $chk->execute(['pid' => $project_id]);
            $existing_folder = $chk->fetch(PDO::FETCH_ASSOC);

            // Find lead ID & Sales Representative ID associated with project
            $q = "SELECT c.converted_from_lead_id, l.created_by as sales_user_id 
                  FROM projects p 
                  JOIN clients c ON p.client_id = c.client_id 
                  LEFT JOIN leads l ON c.converted_from_lead_id = l.lead_id 
                  WHERE p.project_id = :pid";
            $s = $this->conn->prepare($q);
            $s->execute(['pid' => $project_id]);
            $row = $s->fetch(PDO::FETCH_ASSOC);

            $lead_id = $row['converted_from_lead_id'] ?? null;
            $sales_user_id = !empty($row['sales_user_id']) ? $row['sales_user_id'] : 1;
            if (!$lead_id) return;

            $lead_upload_dir = __DIR__ . '/../../uploads/leads/' . $lead_id;

            if (!$existing_folder) {
                $f_stmt = $this->conn->prepare("INSERT INTO project_folders (project_id, name) VALUES (:pid, 'D1 & Lead Documents')");
                $f_stmt->execute(['pid' => $project_id]);
                $folder_id = $this->conn->lastInsertId();
            } else {
                $folder_id = $existing_folder['folder_id'];
            }

            // Update existing files in D1 & Lead Documents to reference sales_user_id if missing or default admin
            if ($sales_user_id) {
                $u_sql = "UPDATE project_files SET uploaded_by = :uid WHERE folder_id = :fid AND (uploaded_by IS NULL OR uploaded_by = 1)";
                $u_st = $this->conn->prepare($u_sql);
                $u_st->execute(['uid' => $sales_user_id, 'fid' => $folder_id]);
            }

            if (is_dir($lead_upload_dir)) {
                $project_upload_dir = __DIR__ . '/../../uploads/projects/' . $project_id . '/' . $folder_id;
                if (!is_dir($project_upload_dir)) {
                    $this->copyDir($lead_upload_dir, $project_upload_dir);
                }
                $this->registerCopiedFiles($lead_upload_dir, $project_id, $folder_id, $sales_user_id);
            }
        } catch (Exception $e) {}
    }

    private function registerCopiedFiles($dir, $project_id, $folder_id, $user_id, $sub_path = '') {
        if (!is_dir($dir)) return;
        $items = array_diff(scandir($dir), array('.', '..'));
        foreach ($items as $item) {
            $path = $dir . '/' . $item;
            $relative_sub = $sub_path ? ($sub_path . '/' . $item) : $item;
            if (is_file($path)) {
                $clean_name = preg_replace('/^\d+_/', '', $item);
                $db_path = 'uploads/projects/' . $project_id . '/' . $folder_id . '/' . $relative_sub;

                $c = $this->conn->prepare("SELECT file_id FROM project_files WHERE project_id = :pid AND folder_id = :fid AND file_path = :fpath");
                $c->execute(['pid' => $project_id, 'fid' => $folder_id, 'fpath' => $db_path]);
                if (!$c->fetch()) {
                    $ext = strtolower(pathinfo($item, PATHINFO_EXTENSION));
                    $file_type = in_array($ext, ['jpg', 'jpeg', 'png', 'gif']) ? 'image/' . ($ext == 'jpg' ? 'jpeg' : $ext) : ($ext == 'pdf' ? 'application/pdf' : 'application/octet-stream');

                    $stmt = $this->conn->prepare("INSERT INTO project_files (project_id, folder_id, file_name, file_path, file_type, uploaded_by) VALUES (:pid, :fid, :fname, :fpath, :ftype, :uid)");
                    $stmt->execute([
                        'pid' => $project_id,
                        'fid' => $folder_id,
                        'fname' => $clean_name,
                        'fpath' => $db_path,
                        'ftype' => $file_type,
                        'uid' => $user_id
                    ]);
                }
            } elseif (is_dir($path)) {
                $this->registerCopiedFiles($path, $project_id, $folder_id, $user_id, $relative_sub);
            }
        }
    }

    private function copyDir($src, $dst) {
        $dir = @opendir($src);
        if (!$dir) return;
        @mkdir($dst, 0777, true);
        while (false !== ($file = readdir($dir))) {
            if (($file != '.') && ($file != '..')) {
                if (is_dir($src . '/' . $file)) {
                    $this->copyDir($src . '/' . $file, $dst . '/' . $file);
                } else {
                    @copy($src . '/' . $file, $dst . '/' . $file);
                }
            }
        }
        closedir($dir);
    }

    public function createFolder($project_id, $name) {
        $this->ensureTablesExist();
        $query = "INSERT INTO project_folders (project_id, name) VALUES (:project_id, :name)";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':project_id', $project_id);
        $stmt->bindParam(':name', $name);
        
        if ($stmt->execute()) {
            return ["success" => true, "message" => "Folder created successfully", "folder_id" => $this->conn->lastInsertId()];
        }
        return ["success" => false, "message" => "Failed to create folder"];
    }

    private function fixFilePathsIfNeeded($folder_id) {
        try {
            $q = "SELECT file_id, project_id, file_path FROM project_files WHERE folder_id = :fid";
            $s = $this->conn->prepare($q);
            $s->execute(['fid' => $folder_id]);
            $rows = $s->fetchAll(PDO::FETCH_ASSOC);

            $root_dir = realpath(__DIR__ . '/../../');

            foreach ($rows as $row) {
                $full_path = __DIR__ . '/../../' . $row['file_path'];
                if (!file_exists($full_path)) {
                    $filename = basename($row['file_path']);
                    $folder_dir = __DIR__ . '/../../uploads/projects/' . $row['project_id'] . '/' . $folder_id;
                    $found = $this->findFileRecursive($folder_dir, $filename);
                    if ($found && $root_dir) {
                        $found_real = realpath($found);
                        if ($found_real && strpos($found_real, $root_dir) === 0) {
                            $rel = substr($found_real, strlen($root_dir) + 1);
                            $rel = str_replace('\\', '/', $rel);
                            $u_stmt = $this->conn->prepare("UPDATE project_files SET file_path = :fpath WHERE file_id = :fid");
                            $u_stmt->execute(['fpath' => $rel, 'fid' => $row['file_id']]);
                        }
                    }
                }
            }
        } catch (Exception $e) {}
    }

    private function findFileRecursive($dir, $filename) {
        if (!is_dir($dir)) return null;
        $items = array_diff(scandir($dir), array('.', '..'));
        foreach ($items as $item) {
            $path = $dir . '/' . $item;
            if (is_file($path) && $item === $filename) {
                return $path;
            } elseif (is_dir($path)) {
                $res = $this->findFileRecursive($path, $filename);
                if ($res) return $res;
            }
        }
        return null;
    }

    public function getFiles($folder_id) {
        $this->ensureTablesExist();
        $this->fixFilePathsIfNeeded($folder_id);

        $query = "SELECT f.*, COALESCE(NULLIF(u.name, ''), u.username, 'Sales Representative') as uploader_name FROM project_files f 
                  LEFT JOIN users u ON f.uploaded_by = u.user_id 
                  WHERE f.folder_id = :folder_id ORDER BY f.uploaded_at DESC";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':folder_id', $folder_id);
        $stmt->execute();
        return ["success" => true, "data" => $stmt->fetchAll(PDO::FETCH_ASSOC)];
    }

    public function uploadFile($project_id, $folder_id, $file, $user_id) {
        $this->ensureTablesExist();
        if (!isset($file) || $file['error'] !== UPLOAD_ERR_OK) {
            return ["success" => false, "message" => "Invalid file upload"];
        }

        $upload_dir = __DIR__ . '/../../uploads/projects/' . $project_id . '/' . $folder_id . '/';
        if (!file_exists($upload_dir)) {
            mkdir($upload_dir, 0777, true);
        }

        $file_extension = pathinfo($file['name'], PATHINFO_EXTENSION);
        $unique_name = time() . '_' . preg_replace('/[^a-zA-Z0-9_.-]/', '_', $file['name']);
        $target_path = $upload_dir . $unique_name;
        
        $db_path = 'uploads/projects/' . $project_id . '/' . $folder_id . '/' . $unique_name;

        if (move_uploaded_file($file['tmp_name'], $target_path) || copy($file['tmp_name'], $target_path)) {
            $query = "INSERT INTO project_files (project_id, folder_id, file_name, file_path, file_type, uploaded_by) 
                      VALUES (:pid, :fid, :fname, :fpath, :ftype, :uid)";
            $stmt = $this->conn->prepare($query);
            $stmt->execute([
                'pid' => $project_id,
                'fid' => $folder_id,
                'fname' => $file['name'],
                'fpath' => $db_path,
                'ftype' => $file['type'] ?? 'application/octet-stream',
                'uid' => $user_id
            ]);
            return ["success" => true, "message" => "File uploaded successfully"];
        }

        return ["success" => false, "message" => "Failed to save file"];
    }

    public function deleteFile($file_id) {
        $this->ensureTablesExist();
        $q = "SELECT file_path FROM project_files WHERE file_id = :fid";
        $s = $this->conn->prepare($q);
        $s->execute(['fid' => $file_id]);
        $file = $s->fetch(PDO::FETCH_ASSOC);

        if ($file) {
            $full_path = __DIR__ . '/../../' . $file['file_path'];
            if (file_exists($full_path)) {
                @unlink($full_path);
            }
            
            $dq = "DELETE FROM project_files WHERE file_id = :fid";
            $ds = $this->conn->prepare($dq);
            $ds->execute(['fid' => $file_id]);
            return ["success" => true, "message" => "File deleted"];
        }
        return ["success" => false, "message" => "File not found"];
    }
}
?>
