import 'dotenv/config';
import { drizzle } from 'drizzle-orm/libsql';

const db = drizzle({ connection: process.env.SQLITE_DB_FILE_NAME!, casing: 'snake_case' });

export default db;