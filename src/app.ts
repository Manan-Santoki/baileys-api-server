import express from 'express';
import routes from './routes';
import legacyRoutes from './routes/legacy';
import config from './config';
import authMiddleware from './middleware/authMiddleware';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import logger from './logger';
import openApiSpec from './docs/openapi';

const app = express();

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging
app.use((req, res, next) => {
  logger.debug({
    method: req.method,
    path: req.path,
    query: req.query,
  }, 'Incoming request');
  next();
});

// OpenAPI/Swagger docs
app.get('/openapi.json', (_req, res) => {
  res.json(openApiSpec);
});

app.get('/docs', (_req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Baileys API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body style="margin:0">
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      window.ui = SwaggerUIBundle({
        url: '/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        displayRequestDuration: true
      });
    };
  </script>
</body>
</html>`);
});

// API key authentication
app.use(authMiddleware);

if (config.enableLegacyRouter) {
  app.use('/legacy', legacyRoutes);
}

// Routes
app.use('/', routes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
