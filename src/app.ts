import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import router from './routes';
import { isDev } from './config';
import cors from 'cors';
import { errorHandler } from './middleware/error.middleware';
import { correlationMiddleware } from './middleware/correlation.middleware';
import { resolveTenant } from './middleware/tenant.middleware';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './utils/swagger';

const app = express();

app.set('trust proxy', 1);

// Assign correlationId + requestId to every request (must be first)
app.use(correlationMiddleware);

app.use(
  cors({
    origin: '*',
    credentials: true,
  }),
);

// Webhooks must receive the raw body for signature verification — register BEFORE express.json()
app.use('/api/v2/payments/webhooks*', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set up rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

if (!isDev) app.use(limiter);

// Set up security headers
app.use(helmet());
app.disable('x-powered-by');

// Resolve the vertical (fashion/beauty/sports) before any route runs. Must come
// after correlationMiddleware, which creates the context store it writes into.
app.use(resolveTenant);

// API Routes
//
// Authenticated JSON — never let the browser cache or revalidate it. Without
// this, Express's default weak ETags make the browser store each response and
// later re-request it conditionally; the server answers 304 with an empty
// body, which the frontend fetch client (expecting a JSON body) reports as a
// failed request.
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use('/api', router);

// Swagger UI — available at http://localhost:PORT/api/docs (dev only)
if (isDev) {
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: 'Node.js API Docs',
      customCss: '.swagger-ui .topbar { display: none }',
    }),
  );
}

// Error Handling
app.use(errorHandler);

export default app;
