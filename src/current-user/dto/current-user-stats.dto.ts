export interface CurrentUserStatsDto {
  averageDelayResponse: number | null;
  createdAt: Date;
  responseRate: number | null;
  totalConversationWithMirrorRoleCount: number | null;
}
