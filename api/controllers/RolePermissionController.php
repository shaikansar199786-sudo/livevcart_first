<?php
// api/controllers/RolePermissionController.php

class RolePermissionController
{
    private $conn;
    private $table_name = "role_page_permissions";
    private $tab_table_name = "role_project_tab_permissions";

    public function __construct($db)
    {
        $this->conn = $db;
        $this->ensureTable();
    }

    private function ensureTable()
    {
        try {
            $sql = "CREATE TABLE IF NOT EXISTS " . $this->table_name . " (
                role VARCHAR(50) NOT NULL PRIMARY KEY,
                allowed_pages LONGTEXT NOT NULL,
                updated_by VARCHAR(100) DEFAULT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
            $this->conn->exec($sql);

            $sqlTabs = "CREATE TABLE IF NOT EXISTS " . $this->tab_table_name . " (
                role VARCHAR(50) NOT NULL PRIMARY KEY,
                allowed_tabs LONGTEXT NOT NULL,
                updated_by VARCHAR(100) DEFAULT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
            $this->conn->exec($sqlTabs);
        } catch (Exception $e) {
            // Silently catch if already exists
        }
    }

    /**
     * Default page paths for each role if not customized in the database.
     */
    public static function getDefaultPermissions()
    {
        return [
            'admin' => [
                '/overview',
                '/project-timelines',
                '/reports',
                '/d1-leads',
                '/leads',
                '/mb-tasks',
                '/clients',
                '/projects',
                '/global-vendors',
                '/finance',
                '/financial-overview',
                '/agreements',
                '/quotes',
                '/vendor-quota',
                '/team',
                '/company-expenses',
                '/reimbursements',
                '/staff-reimbursements'
            ],
            'project_manager' => [
                '/pm-dashboard',
                '/project-timelines',
                '/mb-tasks',
                '/clients',
                '/projects',
                '/global-vendors',
                '/vendor-quota',
                '/team',
                '/company-expenses',
                '/reimbursements',
                '/staff-reimbursements'
            ],
            'manager' => [
                '/manager-dashboard',
                '/project-timelines',
                '/reports',
                '/d1-leads',
                '/leads',
                '/mb-tasks',
                '/clients',
                '/projects',
                '/global-vendors',
                '/agreements',
                '/quotes',
                '/vendor-quota',
                '/team',
                '/company-expenses',
                '/reimbursements',
                '/staff-reimbursements'
            ],
            'accountant' => [
                '/accountant-dashboard',
                '/reports',
                '/clients',
                '/projects',
                '/finance',
                '/agreements',
                '/quotes',
                '/vendor-quota',
                '/reimbursements'
            ],
            'd1' => [
                '/d1-dashboard',
                '/d1-leads',
                '/mb-tasks',
                '/clients',
                '/projects',
                '/quotes',
                '/reimbursements'
            ],
            'd2' => [
                '/d1-dashboard',
                '/d1-leads',
                '/mb-tasks',
                '/clients',
                '/projects',
                '/quotes',
                '/reimbursements'
            ],
            'associate_designer' => [
                '/designer-dashboard',
                '/d1-leads',
                '/mb-tasks',
                '/clients',
                '/projects',
                '/quotes',
                '/reimbursements'
            ],
            'site_engineer' => [
                '/site-dashboard',
                '/site-leads',
                '/mb-tasks',
                '/projects',
                '/reimbursements'
            ],
            'site_inspector' => [
                '/site-dashboard',
                '/site-leads',
                '/mb-tasks',
                '/projects',
                '/reimbursements'
            ],
            'site_inspection' => [
                '/site-dashboard',
                '/site-leads',
                '/mb-tasks',
                '/projects',
                '/reimbursements'
            ],
            'project_head' => [
                '/project-timelines',
                '/mb-tasks',
                '/clients',
                '/projects',
                '/quotes',
                '/vendor-quota',
                '/reimbursements'
            ],
            'business_associate' => [
                '/mb-dashboard',
                '/reports',
                '/mb-tasks',
                '/projects',
                '/reimbursements'
            ],
            'sales' => [
                '/dashboard',
                '/reports',
                '/d1-leads',
                '/leads',
                '/mb-tasks',
                '/clients',
                '/projects',
                '/agreements',
                '/quotes',
                '/vendor-quota',
                '/reimbursements'
            ],
            'marketing_analyst' => [
                '/marketing-dashboard',
                '/mb-tasks',
                '/quotes',
                '/reimbursements'
            ],
            'mmt' => [
                '/mmt-dashboard',
                '/mmt-leads',
                '/mb-tasks',
                '/projects',
                '/global-vendors',
                '/vendor-quota',
                '/reimbursements'
            ],
            'graphic_designer' => [
                '/mb-tasks',
                '/quotes',
                '/reimbursements'
            ],
            'gd' => [
                '/mb-tasks',
                '/quotes',
                '/reimbursements'
            ]
        ];
    }

    public static function getRoleDashboardPath($role)
    {
        switch ($role) {
            case 'site_engineer':
            case 'site_inspector':
            case 'site_inspection':
                return '/site-dashboard';
            case 'project_manager':
                return '/pm-dashboard';
            case 'manager':
                return '/manager-dashboard';
            case 'accountant':
                return '/accountant-dashboard';
            case 'd1':
            case 'd2':
                return '/d1-dashboard';
            case 'associate_designer':
                return '/designer-dashboard';
            case 'marketing_analyst':
                return '/marketing-dashboard';
            case 'mmt':
                return '/mmt-dashboard';
            case 'business_associate':
                return '/mb-dashboard';
            case 'graphic_designer':
            case 'gd':
                return '/gd-dashboard';
            case 'sales':
                return '/dashboard';
            case 'admin':
                return '/overview';
            default:
                return '/dashboard';
        }
    }

    public function getAll()
    {
        try {
            $stmt = $this->conn->prepare("SELECT role, allowed_pages, updated_at FROM " . $this->table_name);
            $stmt->execute();
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $defaults = self::getDefaultPermissions();
            $customMap = [];

            foreach ($rows as $row) {
                $role = strtolower(trim($row['role']));
                $decoded = json_decode($row['allowed_pages'], true);
                if (is_array($decoded)) {
                    $customMap[$role] = $decoded;
                }
            }

            // Merge defaults with custom configured permissions
            $result = [];
            foreach ($defaults as $rKey => $defPages) {
                $pages = isset($customMap[$rKey]) ? $customMap[$rKey] : $defPages;
                $dashPath = self::getRoleDashboardPath($rKey);
                if ($dashPath && !in_array($dashPath, $pages)) {
                    array_unshift($pages, $dashPath);
                }
                $result[$rKey] = $pages;
            }

            // Include any custom roles that might exist in database
            foreach ($customMap as $rKey => $pages) {
                if (!isset($result[$rKey])) {
                    $dashPath = self::getRoleDashboardPath($rKey);
                    if ($dashPath && !in_array($dashPath, $pages)) {
                        array_unshift($pages, $dashPath);
                    }
                    $result[$rKey] = $pages;
                }
            }

            return [
                "success" => true,
                "data" => $result,
                "defaults" => $defaults,
                "custom_configured" => array_keys($customMap)
            ];
        } catch (Exception $e) {
            return [
                "success" => false,
                "message" => "Database error: " . $e->getMessage(),
                "data" => self::getDefaultPermissions()
            ];
        }
    }

    public function save($data)
    {
        try {
            // Check if batch save: { "permissions": { "role_name": [...] } }
            if (isset($data['permissions']) && is_array($data['permissions'])) {
                $stmt = $this->conn->prepare(
                    "INSERT INTO " . $this->table_name . " (role, allowed_pages, updated_by) 
                     VALUES (:role, :allowed_pages, :updated_by) 
                     ON DUPLICATE KEY UPDATE allowed_pages = VALUES(allowed_pages), updated_by = VALUES(updated_by)"
                );

                $updatedBy = $data['updated_by'] ?? 'Admin';
                foreach ($data['permissions'] as $role => $pages) {
                    $roleKey = strtolower(trim($role));
                    $pagesJson = json_encode(array_values(array_unique((array)$pages)));
                    $stmt->execute([
                        ':role' => $roleKey,
                        ':allowed_pages' => $pagesJson,
                        ':updated_by' => $updatedBy
                    ]);
                }

                return [
                    "success" => true,
                    "message" => "All role page access permissions saved successfully."
                ];
            }

            // Single role save: { "role": "site_engineer", "allowed_pages": [...] }
            $role = strtolower(trim($data['role'] ?? ''));
            if (empty($role)) {
                return ["success" => false, "message" => "Role identifier is required."];
            }

            $allowedPages = array_values(array_unique((array)($data['allowed_pages'] ?? [])));
            $pagesJson = json_encode($allowedPages);
            $updatedBy = $data['updated_by'] ?? 'Admin';

            $stmt = $this->conn->prepare(
                "INSERT INTO " . $this->table_name . " (role, allowed_pages, updated_by) 
                 VALUES (:role, :allowed_pages, :updated_by) 
                 ON DUPLICATE KEY UPDATE allowed_pages = VALUES(allowed_pages), updated_by = VALUES(updated_by)"
            );

            $stmt->execute([
                ':role' => $role,
                ':allowed_pages' => $pagesJson,
                ':updated_by' => $updatedBy
            ]);

            return [
                "success" => true,
                "message" => "Page access for role '{$role}' updated successfully."
            ];
        } catch (Exception $e) {
            return [
                "success" => false,
                "message" => "Failed to save permissions: " . $e->getMessage()
            ];
        }
    }

    public function resetRole($role)
    {
        try {
            $role = strtolower(trim($role));
            if ($role === 'all') {
                $this->conn->exec("TRUNCATE TABLE " . $this->table_name);
                return ["success" => true, "message" => "All roles reset to default page access."];
            }

            $stmt = $this->conn->prepare("DELETE FROM " . $this->table_name . " WHERE role = :role");
            $stmt->execute([':role' => $role]);

            return [
                "success" => true,
                "message" => "Role '{$role}' reset to default page access."
            ];
        } catch (Exception $e) {
            return [
                "success" => false,
                "message" => "Failed to reset role: " . $e->getMessage()
            ];
        }
    }

    /**
     * Default Project Details Tab Permissions for each role.
     */
    public static function getDefaultTabPermissions()
    {
        $allTabs = [
            'overview',
            'quote',
            'quality_check',
            'documents',
            'timeline',
            'pm_timeline',
            'stock_category',
            'vendor_quta',
            'transport',
            'labor',
            'miscellaneous',
            'reimbursements',
            'balance_sheet'
        ];

        return [
            'admin' => $allTabs,
            'accountant' => $allTabs,
            'project_head' => $allTabs,
            'project_manager' => $allTabs,
            'manager' => $allTabs,
            'site_engineer' => ['overview', 'quality_check', 'documents', 'timeline', 'pm_timeline', 'stock_category'],
            'site_inspector' => ['overview', 'quality_check', 'documents', 'timeline', 'pm_timeline', 'stock_category'],
            'd1' => ['overview', 'quote', 'quality_check', 'documents', 'timeline', 'pm_timeline'],
            'd2' => ['overview', 'quote', 'quality_check', 'documents', 'timeline', 'pm_timeline'],
            'associate_designer' => ['overview', 'quote', 'quality_check', 'documents', 'timeline', 'pm_timeline'],
            'graphic_designer' => ['overview', 'quote', 'quality_check', 'documents', 'timeline', 'pm_timeline'],
            'sales' => ['overview', 'quote', 'documents', 'timeline'],
            'marketing_analyst' => ['overview', 'quote', 'documents', 'timeline'],
            'business_associate' => ['overview', 'quote', 'documents', 'timeline'],
            'mmt' => ['overview', 'quote', 'quality_check', 'documents', 'timeline', 'stock_category', 'vendor_quta']
        ];
    }

    /**
     * Retrieve all Project Details Tab permissions for all roles.
     */
    public function getAllTabPermissions()
    {
        try {
            $defaults = self::getDefaultTabPermissions();
            $stmt = $this->conn->prepare("SELECT role, allowed_tabs FROM " . $this->tab_table_name);
            $stmt->execute();
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $customMap = [];
            foreach ($rows as $r) {
                $decoded = json_decode($r['allowed_tabs'], true);
                if (is_array($decoded)) {
                    $customMap[strtolower(trim($r['role']))] = $decoded;
                }
            }

            // Merge with defaults
            $result = [];
            foreach ($defaults as $rKey => $tabs) {
                if (isset($customMap[$rKey])) {
                    $result[$rKey] = $customMap[$rKey];
                } else {
                    $result[$rKey] = $tabs;
                }
            }

            foreach ($customMap as $rKey => $tabs) {
                if (!isset($result[$rKey])) {
                    $result[$rKey] = $tabs;
                }
            }

            return [
                "success" => true,
                "data" => $result,
                "defaults" => $defaults,
                "custom_configured" => array_keys($customMap)
            ];
        } catch (Exception $e) {
            return [
                "success" => false,
                "message" => "Database error: " . $e->getMessage(),
                "data" => self::getDefaultTabPermissions()
            ];
        }
    }

    /**
     * Save Project Details Tab permissions (batch or single).
     */
    public function saveTabPermissions($data)
    {
        try {
            // Check if batch save: { "permissions": { "role_name": [...] } }
            if (isset($data['permissions']) && is_array($data['permissions'])) {
                $stmt = $this->conn->prepare(
                    "INSERT INTO " . $this->tab_table_name . " (role, allowed_tabs, updated_by) 
                     VALUES (:role, :allowed_tabs, :updated_by) 
                     ON DUPLICATE KEY UPDATE allowed_tabs = VALUES(allowed_tabs), updated_by = VALUES(updated_by)"
                );

                $updatedBy = $data['updated_by'] ?? 'Admin';
                foreach ($data['permissions'] as $role => $tabs) {
                    $roleKey = strtolower(trim($role));
                    $tabsJson = json_encode(array_values(array_unique((array)$tabs)));
                    $stmt->execute([
                        ':role' => $roleKey,
                        ':allowed_tabs' => $tabsJson,
                        ':updated_by' => $updatedBy
                    ]);
                }

                return [
                    "success" => true,
                    "message" => "All role project tab access permissions saved successfully."
                ];
            }

            // Single role save: { "role": "d1", "allowed_tabs": [...] }
            $role = strtolower(trim($data['role'] ?? ''));
            if (empty($role)) {
                return ["success" => false, "message" => "Role identifier is required."];
            }

            $allowedTabs = array_values(array_unique((array)($data['allowed_tabs'] ?? [])));
            $tabsJson = json_encode($allowedTabs);
            $updatedBy = $data['updated_by'] ?? 'Admin';

            $stmt = $this->conn->prepare(
                "INSERT INTO " . $this->tab_table_name . " (role, allowed_tabs, updated_by) 
                 VALUES (:role, :allowed_tabs, :updated_by) 
                 ON DUPLICATE KEY UPDATE allowed_tabs = VALUES(allowed_tabs), updated_by = VALUES(updated_by)"
            );

            $stmt->execute([
                ':role' => $role,
                ':allowed_tabs' => $tabsJson,
                ':updated_by' => $updatedBy
            ]);

            return [
                "success" => true,
                "message" => "Project tab access for role '{$role}' updated successfully."
            ];
        } catch (Exception $e) {
            return [
                "success" => false,
                "message" => "Failed to save project tab permissions: " . $e->getMessage()
            ];
        }
    }

    /**
     * Reset Project Details Tab permissions to default.
     */
    public function resetTabPermissions($role)
    {
        try {
            $role = strtolower(trim($role));
            if ($role === 'all') {
                $this->conn->exec("TRUNCATE TABLE " . $this->tab_table_name);
                return ["success" => true, "message" => "All roles reset to default project tab access."];
            }

            $stmt = $this->conn->prepare("DELETE FROM " . $this->tab_table_name . " WHERE role = :role");
            $stmt->execute([':role' => $role]);

            return [
                "success" => true,
                "message" => "Role '{$role}' reset to default project tab access."
            ];
        } catch (Exception $e) {
            return [
                "success" => false,
                "message" => "Failed to reset project tab permissions: " . $e->getMessage()
            ];
        }
    }
}
