ALTER TABLE products
ALTER COLUMN "unitOfMeasure" TYPE TEXT
USING "unitOfMeasure"::text;