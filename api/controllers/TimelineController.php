<?php
class TimelineController {
    private $conn;

    public function __construct($db) {
        $this->conn = $db;
    }

    // Step 4: Auto-Timeline Generation
    public function generateMasterTimeline($project_id, $start_date, $end_date, $user_id) {
        try {
            // 1. Create Master Record
            $query = "INSERT INTO project_timeline_master (project_id, start_date, end_date, created_by) 
                      VALUES (:p_id, :start, :end, :user)";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':p_id', $project_id);
            $stmt->bindParam(':start', $start_date);
            $stmt->bindParam(':end', $end_date);
            $stmt->bindParam(':user', $user_id);
            $stmt->execute();
            $timeline_id = $this->conn->lastInsertId();

            // 2. Generate Date-by-Date Structure
            $start = new DateTime($start_date);
            $end = new DateTime($end_date);
            $interval = new DateInterval('P1D');
            $period = new DatePeriod($start, $interval, $end->modify('+1 day'));

            $day_num = 1;
            foreach ($period as $date) {
                $t_date = $date->format('Y-m-d');
                $d_name = $date->format('l');
                
                $d_query = "INSERT INTO project_timeline_dates (timeline_id, project_id, timeline_date, day_number, day_name) 
                            VALUES (:t_id, :p_id, :t_date, :d_num, :d_name)";
                $d_stmt = $this->conn->prepare($d_query);
                $d_stmt->bindParam(':t_id', $timeline_id);
                $d_stmt->bindParam(':p_id', $project_id);
                $d_stmt->bindParam(':t_date', $t_date);
                $d_stmt->bindParam(':d_num', $day_num);
                $d_stmt->bindParam(':d_name', $d_name);
                $d_stmt->execute();
                $day_num++;
            }

            // 3. Notify Project Head (Assuming we can find them from project assignments)
            $notif_query = "INSERT INTO notifications (user_id, title, message, type) 
                            SELECT user_id, 'Project Assigned', 'You have been assigned as Project Head. Please initialize the daily timeline.', 'task'
                            FROM project_assignments WHERE project_id = :p_id AND role = 'project_head'";
            $n_stmt = $this->conn->prepare($notif_query);
            $n_stmt->bindParam(':p_id', $project_id);
            $n_stmt->execute();

            return true;
        } catch (Exception $e) {
            error_log("Timeline Gen Error: " . $e->getMessage());
            return false;
        }
    }

    // Get Project Timeline Data
    public function getTimeline($project_id) {
        // Run a quick overdue check before returning data
        $this->runDailyCheck();

        // Get Master Info
        $m_query = "SELECT * FROM project_timeline_master WHERE project_id = :p_id";
        $m_stmt = $this->conn->prepare($m_query);
        $m_stmt->bindParam(':p_id', $project_id);
        $m_stmt->execute();
        $master = $m_stmt->fetch(PDO::FETCH_ASSOC);

        if (!$master) return ["success" => false, "message" => "Timeline not found"];

        // Get Tasks
        $t_query = "SELECT t.*, u.name as assigned_to_name, creator.name as assigned_by_name 
                    FROM project_timeline_tasks t
                    LEFT JOIN users u ON t.assigned_to = u.user_id
                    LEFT JOIN users creator ON t.assigned_by = creator.user_id
                    WHERE t.project_id = :p_id 
                    ORDER BY t.start_date ASC";
        $t_stmt = $this->conn->prepare($t_query);
        $t_stmt->bindParam(':p_id', $project_id);
        $t_stmt->execute();
        $tasks = $t_stmt->fetchAll(PDO::FETCH_ASSOC);

        // Get Dates (for overview)
        $d_query = "SELECT * FROM project_timeline_dates WHERE project_id = :p_id ORDER BY timeline_date ASC";
        $d_stmt = $this->conn->prepare($d_query);
        $d_stmt->bindParam(':p_id', $project_id);
        $d_stmt->execute();
        $dates = $d_stmt->fetchAll(PDO::FETCH_ASSOC);

        return [
            "success" => true, 
            "master" => $master,
            "tasks" => $tasks,
            "dates" => $dates
        ];
    }

    // Save interactive timeline state
    public function saveState($data) {
        $project_id = $data['project_id'];
        $state_json = $data['state_json'];
        
        $dir = __DIR__ . '/../uploads/timelines';
        if (!is_dir($dir)) {
            mkdir($dir, 0777, true);
        }
        
        $file = $dir . '/project_' . $project_id . '.json';
        file_put_contents($file, json_encode($state_json));
        
        return ["success" => true, "message" => "Timeline state saved"];
    }

    // Get interactive timeline state
    public function getState($project_id) {
        $file = __DIR__ . '/../uploads/timelines/project_' . $project_id . '.json';
        if (file_exists($file)) {
            $data = json_decode(file_get_contents($file), true);
            return ["success" => true, "state" => $data];
        }
        return ["success" => false, "message" => "No state found"];
    }

    // Step 5: Project Head Assigns Task
    public function createTask($data) {
        $query = "INSERT INTO project_timeline_tasks 
                  (timeline_id, project_id, task_name, task_description, task_category, start_date, end_date, assigned_to, assigned_by, priority) 
                  VALUES (:t_id, :p_id, :name, :desc, :cat, :start, :end, :to, :by, :priority)";
        
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':t_id', $data['timeline_id']);
        $stmt->bindParam(':p_id', $data['project_id']);
        $stmt->bindParam(':name', $data['task_name']);
        $stmt->bindParam(':desc', $data['task_description']);
        $stmt->bindParam(':cat', $data['task_category']);
        $stmt->bindParam(':start', $data['start_date']);
        $stmt->bindParam(':end', $data['end_date']);
        $stmt->bindParam(':to', $data['assigned_to']);
        $stmt->bindParam(':by', $data['assigned_by']);
        $stmt->bindParam(':priority', $data['priority']);

        if ($stmt->execute()) {
            $task_id = $this->conn->lastInsertId();
            $this->updateDateMetadata($data['project_id'], $data['start_date'], $data['end_date']);
            return ["success" => true, "message" => "Task assigned", "task_id" => $task_id];
        }
        return ["success" => false, "message" => "Failed to assign task"];
    }

    // Step 6: Site Manager Updates Task
    public function updateTaskStatus($data) {
        $task_id = $data['task_id'];
        $new_status = $data['status'];
        $user_id = $data['user_id'];
        $notes = $data['notes'] ?? '';
        $percentage = $data['completion_percentage'] ?? 0;

        // Get old status
        $old_query = "SELECT status FROM project_timeline_tasks WHERE task_id = :id";
        $os_stmt = $this->conn->prepare($old_query);
        $os_stmt->bindParam(':id', $task_id);
        $os_stmt->execute();
        $old_status = $os_stmt->fetchColumn();

        // Update Task
        $update_fields = "status = :status, completion_percentage = :pct, notes = :notes";
        if ($new_status === 'in_progress' && $old_status === 'not_started') {
            $update_fields .= ", started_at = CURRENT_TIMESTAMP";
        }
        if ($new_status === 'completed') {
            $update_fields .= ", completed_at = CURRENT_TIMESTAMP, completion_percentage = 100";
            $percentage = 100;
        }

        $query = "UPDATE project_timeline_tasks SET $update_fields WHERE task_id = :id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':status', $new_status);
        $stmt->bindParam(':pct', $percentage);
        $stmt->bindParam(':notes', $notes);
        $stmt->bindParam(':id', $task_id);

        if ($stmt->execute()) {
            // Log Update
            $l_query = "INSERT INTO project_timeline_updates (task_id, project_id, updated_by, update_type, old_status, new_status, completion_percentage, notes) 
                        SELECT :t_id, project_id, :user, 'status_changed', :old, :new, :pct, :notes 
                        FROM project_timeline_tasks WHERE task_id = :t_id";
            $l_stmt = $this->conn->prepare($l_query);
            $l_stmt->bindParam(':t_id', $task_id);
            $l_stmt->bindParam(':user', $user_id);
            $l_stmt->bindParam(':old', $old_status);
            $l_stmt->bindParam(':new', $new_status);
            $l_stmt->bindParam(':pct', $percentage);
            $l_stmt->bindParam(':notes', $notes);
            $l_stmt->execute();

            return ["success" => true, "message" => "Status updated"];
        }
        return ["success" => false, "message" => "Update failed"];
    }

    // Internal: Update has_tasks in timeline_dates
    private function updateDateMetadata($project_id, $start, $end) {
        $query = "UPDATE project_timeline_dates 
                  SET has_tasks = TRUE, tasks_count = tasks_count + 1 
                  WHERE project_id = :p_id AND timeline_date BETWEEN :start AND :end";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':p_id', $project_id);
        $stmt->bindParam(':start', $start);
        $stmt->bindParam(':end', $end);
        $stmt->execute();
    }

    // Cron/Automated: Daily Overdue Check
    public function runDailyCheck() {
        $today = date('Y-m-d');
        // MLivincart as overdue if end_date has passed and not completed
        $query = "UPDATE project_timeline_tasks 
                  SET status = 'overdue', is_overdue = TRUE, overdue_since = end_date 
                  WHERE end_date < :today AND status NOT IN ('completed', 'completed_late', 'overdue')";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':today', $today);
        $stmt->execute();
        
        return ["success" => true, "checked_at" => date('Y-m-d H:i:s')];
    }
}
?>
