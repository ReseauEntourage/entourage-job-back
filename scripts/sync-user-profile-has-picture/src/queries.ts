import { DbService } from './services/db.service';
import { UserProfile } from './types/user-profile.type';

export const fetchAllUserProfiles = async (): Promise<UserProfile[]> => {
  try {
    const connection = await DbService.getInstance().getConnection();
    const result = await connection.query<UserProfile>(
      'SELECT "UserId" FROM "User_Profiles"'
    );
    connection.release();
    return result.rows;
  } catch (error) {
    console.error('Error executing query:', error);
    throw error;
  }
};

export const updateHasPicture = async (userIds: string[]): Promise<number> => {
  let updatedRowCount = 0;
  try {
    const connection = await DbService.getInstance().getConnection();
    const res = await connection.query(
      'UPDATE "User_Profiles" SET "hasPicture" = true WHERE "UserId" = ANY($1::uuid[])',
      [userIds]
    );
    updatedRowCount = res.rowCount;
    connection.release();
  } catch (error) {
    console.error('Error executing query:', error);
    throw error;
  }
  return updatedRowCount;
};
