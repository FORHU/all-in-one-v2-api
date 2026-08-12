import TaxRepository from './tax.repository';
import { requireTenantId } from '../../utils/async-context';
import { Prisma } from '@prisma/client';

export default class TaxService {
  static async createTaxClass(data: Omit<Prisma.TaxClassCreateInput, 'tenant'>) {
    return TaxRepository.createTaxClass(requireTenantId(), data);
  }

  static async getTaxClasses() {
    return TaxRepository.findTaxClasses(requireTenantId());
  }
}
