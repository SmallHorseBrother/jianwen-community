export interface User {
  id: string;
  phone: string;
  nickname: string;
  bio: string;
  avatar?: string;
  powerData: {
    bench: number;
    squat: number;
    deadlift: number;
  };
  isPublic: boolean;
  createdAt: Date;
}

export interface Article {
  id: string;
  title: string;
  content: string;
  category: string;
  type: 'fitness' | 'learning';
  author: string;
  createdAt: Date;
  tags: string[];
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}