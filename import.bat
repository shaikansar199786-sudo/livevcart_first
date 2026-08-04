@echo off
c:\xampp\mysql\bin\mysql -u root -e "DROP DATABASE IF EXISTS demoarks; CREATE DATABASE demoarks;"
c:\xampp\mysql\bin\mysql -u root demoarks < "ark_pm_system (3).sql"
echo DONE
