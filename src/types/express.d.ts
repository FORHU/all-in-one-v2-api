import { AuthUserPayload } from '../modules/auth/auth.service';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
      tenantId?: string;
    }
  }
}
