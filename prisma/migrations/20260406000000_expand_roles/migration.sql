-- Rename existing roles to the new expanded role model.
-- Administrator → Tenant Admin (H&S consultancy admin)
-- Employee      → Tenant Staff (H&S consultancy employee)
-- Customer      → Customer User (individual within a client company)

UPDATE "User" SET role = 'Tenant Admin'  WHERE role = 'Administrator';
UPDATE "User" SET role = 'Tenant Staff'  WHERE role = 'Employee';
UPDATE "User" SET role = 'Customer User' WHERE role = 'Customer';
