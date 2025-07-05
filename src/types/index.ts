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
  // 社区卡片相关字段
  groupIdentity?: string; // 群身份
  profession?: string; // 专业领域
  groupNickname?: string; // 群昵称
  specialties: string[]; // 擅长领域
  fitnessInterests: string[]; // 健身爱好
  learningInterests: string[]; // 学习兴趣
  socialLinks: { [key: string]: string }; // 社交链接
  createdAt: Date;
}

// 群身份选项
export const GROUP_IDENTITIES = [
  '学习一群',
  '学习二群',
  '学习三群',
  '健身一群',
  '健身二群',
  '健身三群',
  '综合交流群'
] as const;

// 常见专业领域
export const PROFESSIONS = [
  '计算机科学', '软件工程', '数据科学', '人工智能',
  '数学', '物理', '化学', '生物',
  '经济学', '金融', '管理学', '市场营销',
  '心理学', '教育学', '法学', '医学',
  '机械工程', '电子工程', '土木工程', '建筑学',
  '艺术设计', '文学', '历史学', '哲学',
  '其他'
] as const;

// 常见擅长领域
export const SPECIALTIES = [
  '编程开发', '数据分析', '机器学习', '前端开发', '后端开发',
  '数学建模', '统计分析', '算法设计',
  '写作', '翻译', '演讲', '设计',
  '项目管理', '团队协作', '产品设计',
  '健身教练', '营养指导', '康复训练',
  '语言学习', '考试技巧', '时间管理'
] as const;

// 健身爱好
export const FITNESS_INTERESTS = [
  '力量训练', '健美', '举重', '健力',
  '跑步', '有氧训练', '瑜伽', '普拉提',
  '游泳', '骑行', '攀岩', '武术',
  '篮球', '足球', '网球', '羽毛球',
  '营养学', '康复训练', '体能训练'
] as const;

// 学习兴趣
export const LEARNING_INTERESTS = [
  '编程技术', '数据科学', '人工智能', '机器学习',
  '数学', '物理', '化学', '生物',
  '经济学', '金融', '投资理财',
  '心理学', '哲学', '历史', '文学',
  '语言学习', '考试准备', '职业发展',
  '创业', '管理', '领导力', '沟通技巧'
] as const;

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