-- AlterEnum: more education levels (diploma 1/2, doctorate). Additive: existing rows are untouched.
ALTER TYPE "Degree" ADD VALUE 'D1' BEFORE 'D3';
ALTER TYPE "Degree" ADD VALUE 'D2' BEFORE 'D3';
ALTER TYPE "Degree" ADD VALUE 'S3';
