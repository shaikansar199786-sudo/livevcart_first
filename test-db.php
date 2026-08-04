<?php require 'api/config/database.php'; $db = getMysqliConnection(); $res = $db->query('SELECT project_id, project_code FROM projects'); while($row = $res->fetch_assoc()) { print_r($row); }
