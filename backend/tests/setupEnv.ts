process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-secret-that-is-long-enough-for-hmac-signing';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/carecompass-test';
process.env.LOG_LEVEL = 'silent';
process.env.EMAIL_PROVIDER = 'console';
