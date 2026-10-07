const currentHost = (typeof window !== 'undefined' && window.location && window.location.hostname && window.location.hostname !== '') ? window.location.hostname : '127.0.0.1';

window.CONFIG = {
  BACKEND_URL: `http://${currentHost}:5000`,
  CONTRACT_ADDRESS: "0xf8e81D47203A594245E36C48e151709F0C19fBe8",
  CHAIN_ID: 11155111,
  EXPLORER: "https://sepolia.etherscan.io"
};
var BACKEND_URL = window.CONFIG.BACKEND_URL;
var CONTRACT_ADDRESS = window.CONFIG.CONTRACT_ADDRESS;
