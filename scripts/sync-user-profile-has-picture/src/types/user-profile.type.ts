export interface UserProfile {
  UserId: string;
}

const toUserProfile = (row: UserProfile): UserProfile => {
  return {
    UserId: row.UserId,
  };
};

export const toUserProfiles = (rows: UserProfile[]): UserProfile[] => {
  return rows.map((row) => toUserProfile(row));
};
