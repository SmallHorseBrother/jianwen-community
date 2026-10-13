export interface NetworkTopic { id: string; name: string; color: string }
export interface Introduction { messageId: string; at: string; text: string }
export interface SpeechEvidence { messageCount: number; dayCount: number; firstAt: string; lastAt: string }
export interface SpeechSummary {
  version: number; summary: string; analyzedMessages: number; firstAt: string; lastAt: string;
  topics: Array<SpeechEvidence & { id: string; name: string; keywords: string[]; confidence: '多次讨论' | '有限线索' }>;
  goals: Array<SpeechEvidence & { name: string }>;
}
export interface MemberPortrait {
  version: 2; status: 'specific' | 'limited' | 'insufficient'; summary: string;
  sections: Array<{ kind: 'practice' | 'background' | 'interests' | 'needs' | 'contribution'; title: string; text: string; confidence: 'self_reported' | 'inferred'; references: Array<{ messageId: string; at: string }> }>;
  badges: string[]; topicIds: string[]; goals: string[]; sourceEnd: string;
  coverage: { messageCount: number; textCount: number; replyCount?: number; meaningfulTextCount: number; sampledMessages: number; imageCount: number; stickerCount: number; voiceCount: number; videoCount?: number; linkCount?: number; otherCount: number };
}
export interface NetworkPerson {
  id: string; name: string; nickname: string; groupNickname: string; avatar: string;
  joinedAt: string | null; lastActiveAt: string | null; messageCount: number;
  topic: string; topics: string[]; tags: string[]; summary: string;
  offers: string[]; needs: string[]; stage: string; goals?: string[]; introductions: Introduction[];
  speech?: SpeechSummary | null; portrait?: MemberPortrait; profileSource?: 'introduction' | 'speech' | 'portrait' | 'nickname' | 'empty';
}
export type EdgeKind = 'interaction' | 'collaboration' | 'match' | 'shared';
export interface NetworkEdge {
  id: string; source: string; target: string; kind: EdgeKind; reason: string; count?: number;
  evidence: Array<{ at: string; speaker: string; text: string; messageId: string }>;
  firstAt?: string; lastAt?: string;
}
export interface NetworkData {
  classification: {
    kind: 'entrepreneurship' | 'learning' | 'fitness'; label: string;
    topicLabel: string; goalLabel: string; offersLabel: string; needsLabel: string;
    eyebrow: string; description: string; matchLabel: string; sharedLabel: string; goals: string[];
  };
  schemaVersion: number; title: string; generatedAt: string; contactUpdatedAt: string; lastMessageAt: string;
  topics: NetworkTopic[]; people: NetworkPerson[]; edges: NetworkEdge[]; notes: string;
  groupId?: string; firstMessageAt?: string; messageTotal?: number;
  speechUpdatedAt?: string;
  portraitUpdatedAt?: string;
}
export interface NetworkGroup { id: string; kind: NetworkData['classification']['kind']; title: string; path: string; members: number; introductions: number; messages: number; generatedAt: string }
export interface NetworkCatalog { schemaVersion: number; defaultGroup: string; groups: NetworkGroup[] }
