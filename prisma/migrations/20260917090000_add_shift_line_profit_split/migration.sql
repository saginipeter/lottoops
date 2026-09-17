-- Add store profit (5%) and state cost (95%) split columns to shift_lines
ALTER TABLE "shift_lines" ADD COLUMN IF NOT EXISTS "profitAmount" DECIMAL(10,2);
ALTER TABLE "shift_lines" ADD COLUMN IF NOT EXISTS "stateCost" DECIMAL(10,2);
