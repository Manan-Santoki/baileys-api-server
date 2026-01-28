import express from 'express';
import routes from './routes';
import authMiddleware from './middleware/authMiddleware';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import logger from './logger';

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

// API key authentication
app.use(authMiddleware);

// Routes
app.use('/', routes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
