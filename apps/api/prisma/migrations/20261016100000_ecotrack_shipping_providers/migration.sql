-- AlterEnum: the three Ecotrack-hosted couriers (same API as DHD, different base URL)
ALTER TYPE "ShippingCompanyProvider" ADD VALUE 'SwiftExpress';
ALTER TYPE "ShippingCompanyProvider" ADD VALUE 'Anderson';
ALTER TYPE "ShippingCompanyProvider" ADD VALUE 'Hr48';
