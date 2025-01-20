import { Pool, PoolClient } from 'pg';

export class DbService {
  static getConnexion() {
    throw new Error('Method not implemented.');
  }
  private static instance: DbService;
  private pool: Pool = null;

  private constructor() {
    this.pool = new Pool({
      connectionString: process.env.DB_CONNECTION_STRING,
      // ssl: {
      //   rejectUnauthorized: false,
      // },
    });
  }

  public static getInstance(): DbService {
    if (!DbService.instance) {
      DbService.instance = new DbService();
    }
    return DbService.instance;
  }

  public getConnection(): Promise<PoolClient> {
    return this.pool.connect();
  }
}
