export interface NetworkTopic { id: string; name: string; color: string }
export interface Introduction { messageId: string; at: string; text: string }
export interface NetworkPerson {
  id: string; name: string; nickname: string; groupNickname: string; avatar: string;
  joinedAt: string | null; lastActiveAt: string | null; messageCount: number;
  topic: string; topics: string[]; tags: string[]; summary: string;
  offers: string[]; needs: string[]; stage: string; introductions: Introduction[];
}
export type EdgeKind = 'interaction' | 'collaboration' | 'match' | 'shared';
export interface NetworkEdge {
  id: string; source: string; target: string; kind: EdgeKind; reason: string; count?: number;
  evidence: Array<{ at: string; speaker: string; text: string; messageId: string }>;
  firstAt?: string; lastAt?: string;
}
export interface NetworkData {
  schemaVersion: number; title: string; generatedAt: string; contactUpdatedAt: string; lastMessageAt: string;
  topics: NetworkTopic[]; people: NetworkPerson[]; edges: NetworkEdge[]; notes: string;
  groupId?: string; firstMessageAt?: string; messageTotal?: number;
}
export interface NetworkGroup { id: string; title: string; path: string; members: number; introductions: number; messages: number; generatedAt: string }
export interface NetworkCatalog { schemaVersion: number; defaultGroup: string; groups: NetworkGroup[] }
