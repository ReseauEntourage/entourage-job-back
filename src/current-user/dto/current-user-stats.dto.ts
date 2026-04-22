export interface CurrentUserStatsDto {
  createdAt: Date;
  averageDelayResponse: number | null;
  responseRate: number | null;
  totalConversationWithMirrorRoleCount: number | null;
}
