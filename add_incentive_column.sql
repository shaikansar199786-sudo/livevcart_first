-- Add incentive column to finance_transactions table
ALTER TABLE finance_transactions ADD COLUMN incentive DECIMAL(15, 2) DEFAULT NULL AFTER recorded_by;
