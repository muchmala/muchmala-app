var config = exports;

config.mongodb = {
    host:     process.env.MUCHMALA_MONGODB_HOST || '127.0.0.1',
    user:     process.env.MUCHMALA_MONGODB_USER || 'mongodb',
    database: process.env.MUCHMALA_MONGODB_DATABASE || 'muchmala'
};

config.queue = {
    host: process.env.MUCHMALA_QUEUE_HOST || '127.0.0.1',
    port: process.env.MUCHMALA_QUEUE_PORT || 6379,
    password: process.env.MUCHMALA_QUEUE_PASSWORD || undefined,
    database: process.env.MUCHMALA_QUEUE_DATABASE || 0
};

config.io = {
    port: process.env.MUCHMALA_IO_PORT || 8090,
};