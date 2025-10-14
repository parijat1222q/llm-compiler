require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const routes = require('./routes');
const { errorHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger').logger;
const config = require('./config');

const app = express();

app.use(express.json());
app.use(morgan('dev'));
app.use(cors());

app.use(routes);

// serve generated zips
app.use('/downloads', express.static(config.outputDir));

// global error handler (must come after all middleware/routes)
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  logger.info(`Server listening on port ${PORT}`);
});

function gracefulShutdown() {
  logger.info('Shutting down gracefully...');
  server.close(() => {
    logger.info('Closed out remaining connections');
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('Forcing shutdown');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
