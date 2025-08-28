const winston = require('winston');
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
const defaultLogsDir = path.join(__dirname, '..', 'logs');
const logsDir = process.env.LOG_DIR || (process.env.NODE_ENV === 'production' ? '/tmp/hotel-booking-automation/logs' : defaultLogsDir);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'hotel-booking-automation' },
  transports: [
    // Write all logs with level 'error' and below to 'error.log'
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Write all logs with level 'info' and below to 'combined.log'
    new winston.transports.File({ 
      filename: path.join(logsDir, 'booking.log'),
      maxsize: 5242880, // 5MB  
      maxFiles: 5
    }),
  ],
});

// Always log to console (Heroku-friendly). Set LOG_TO_CONSOLE=false to disable.
if (process.env.LOG_TO_CONSOLE !== 'false') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
      winston.format.printf(({ level, message, timestamp, ...meta }) => {
        let metaStr = '';
        if (Object.keys(meta).length > 0) {
          metaStr = ` ${JSON.stringify(meta, null, 2)}`;
        }
        return `${timestamp} [${level}]: ${message}${metaStr}`;
      })
    )
  }));
}

module.exports = logger;
