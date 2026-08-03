import AuditRepository from '../repositories/audit.repository';

export default class AuditService {
  static async getAuditLogs() {
    return AuditRepository.getAuditLogs();
  }

  static async getJobs() {
    return AuditRepository.getJobs();
  }

  static async getJobLogs(jobId: string) {
    return AuditRepository.getJobLogs(jobId);
  }
}
