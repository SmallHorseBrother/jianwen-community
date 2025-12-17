export interface User {
  id: string;
  phone: string;
  nickname: string;
  bio: string;
  avatar?: string;
  isPublic: boolean;
  createdAt: Date;
  // 社交名片核心字段
  groupIdentity: string[]; // 所属群组 (多选)
  groupNickname?: string; // 群昵称
  tags: string[]; // 个人标签
  skillsOffering?: string; // 我能提供
  skillsSeeking?: string; // 我正在寻找
  wechatId?: string; // 微信号
  socialLinks: { [key: string]: string }; // 社交链接
  // 废弃字段 (保留兼容性)
  powerData?: {
    bench: number;
    squat: number;
    deadlift: number;
  };
  profession?: string;
  specialties?: string[];
  fitnessInterests?: string[];
  learningInterests?: string[];
}

// 群身份选项
export const GROUP_IDENTITIES = [
  "健身一群",
  "健身二群",
  "健身三群",
  "学习一班",
  "学习二班",
  "学习三班",
  "不在群内",
] as const;

// ========== 以下为兼容旧代码保留的常量 (已废弃) ==========

// @deprecated 已废弃，使用个人简介或标签代替
export const PROFESSIONS = [
  "计算机科学",
  "软件工程",
  "数据科学",
  "人工智能",
  "数学",
  "物理",
  "化学",
  "生物",
  "经济学",
  "金融",
  "管理学",
  "市场营销",
  "心理学",
  "教育学",
  "法学",
  "医学",
  "机械工程",
  "电子工程",
  "土木工程",
  "建筑学",
  "艺术设计",
  "文学",
  "历史学",
  "哲学",
  "其他",
] as const;

// @deprecated 已废弃，使用 skillsOffering 代替
export const SPECIALTIES = [
  "编程开发",
  "数据分析",
  "机器学习",
  "前端开发",
  "后端开发",
  "数学建模",
  "统计分析",
  "算法设计",
  "写作",
  "翻译",
  "演讲",
  "设计",
  "项目管理",
  "团队协作",
  "产品设计",
  "健身教练",
  "营养指导",
  "康复训练",
  "语言学习",
  "考试技巧",
  "时间管理",
] as const;

// @deprecated 已废弃，使用 tags 代替
export const FITNESS_INTERESTS = [
  "力量训练",
  "健美",
  "举重",
  "健力",
  "跑步",
  "有氧训练",
  "瑜伽",
  "普拉提",
  "游泳",
  "骑行",
  "攀岩",
  "武术",
  "篮球",
  "足球",
  "网球",
  "羽毛球",
  "营养学",
  "康复训练",
  "体能训练",
] as const;

// @deprecated 已废弃，使用 tags 代替
export const LEARNING_INTERESTS = [
  "编程技术",
  "数据科学",
  "人工智能",
  "机器学习",
  "数学",
  "物理",
  "化学",
  "生物",
  "经济学",
  "金融",
  "投资理财",
  "心理学",
  "哲学",
  "历史",
  "文学",
  "语言学习",
  "考试准备",
  "职业发展",
  "创业",
  "管理",
  "领导力",
  "沟通技巧",
] as const;

export interface Article {
  id: string;
  title: string;
  content: string;
  category: string;
  type: "fitness" | "learning";
  author: string;
  createdAt: Date;
  tags: string[];
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
