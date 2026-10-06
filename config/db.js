import { initDatabase } from '../services/dbService.js';

export const connectDB = async () => {
  return await initDatabase();
};
