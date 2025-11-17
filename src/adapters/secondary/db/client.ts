import 'dotenv/config';
import { drizzle } from 'drizzle-orm/libsql';

const db = drizzle({ connection: process.env.DB_URL!, casing: 'snake_case' });

export default db;