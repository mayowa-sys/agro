import axios from 'axios';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8001';
const AI_SERVICE_TOKEN = process.env.AI_SERVICE_TOKEN || 'agro-ai-secret-dev';

export const aiClient = axios.create({
  baseURL: AI_SERVICE_URL,
  headers: {
    'Authorization': `Bearer ${AI_SERVICE_TOKEN}`,
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});
