const dns = require('dns');
const mongoose = require('mongoose');

const DEFAULT_MONGO_DNS_SERVERS = ['8.8.8.8', '1.1.1.1'];

const configureMongoDns = (uri) => {
  if (!String(uri || '').startsWith('mongodb+srv://')) {
    return;
  }

  const dnsServers = String(process.env.MONGO_DNS_SERVERS || DEFAULT_MONGO_DNS_SERVERS.join(','))
    .split(',')
    .map((server) => server.trim())
    .filter(Boolean);

  if (!dnsServers.length) {
    return;
  }

  dns.setServers(dnsServers);
  console.log(`MongoDB SRV DNS servers: ${dnsServers.join(', ')}`);
};

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    configureMongoDns(uri);
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;

export {};
