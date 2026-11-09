@echo off
echo Adding incentive column to finance_transactions table...
cd C:\xampp\mysql\bin
mysql -u root -e "USE chnge-arkks; ALTER TABLE finance_transactions ADD COLUMN incentive DECIMAL(15, 2) DEFAULT NULL AFTER recorded_by;"
echo Done!
pause
