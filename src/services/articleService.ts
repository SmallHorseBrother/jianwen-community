import { supabase } from '../lib/supabase';
import { Article } from '../types';

export interface ArticleFilters {
  type?: 'fitness' | 'learning';
  category?: string;
  search?: string;
  isPublished?: boolean;
}

// 获取文章列表
export const getArticles = async (filters: ArticleFilters = {}) => {
  let query = supabase
    .from('articles')
    .select('*')
    .order('created_at', { ascending: false });

  // 默认只显示已发布的文章
  if (filters.isPublished !== false) {
    query = query.eq('is_published', true);
  }

  if (filters.type) {
    query = query.eq('type', filters.type);
  }

  if (filters.category) {
    query = query.eq('category', filters.category);
  }

  if (filters.search) {
    query = query.or(`title.ilike.%${filters.search}%,content.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;
  
  if (error) throw error;
  
  return data?.map(article => ({
    id: article.id,
    title: article.title,
    content: article.content,
    summary: article.summary,
    category: article.category,
    type: article.type as 'fitness' | 'learning',
    author: article.author_name,
    createdAt: new Date(article.created_at),
    tags: article.tags,
  })) as Article[];
};

// 获取单篇文章
export const getArticle = async (id: string) => {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('id', id)
    .eq('is_published', true)
    .single();

  if (error) throw error;
  
  return {
    id: data.id,
    title: data.title,
    content: data.content,
    summary: data.summary,
    category: data.category,
    type: data.type as 'fitness' | 'learning',
    author: data.author_name,
    createdAt: new Date(data.created_at),
    tags: data.tags,
  } as Article;
};

// 创建文章（管理员功能）
export const createArticle = async (article: Omit<Article, 'id' | 'createdAt'>) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');

  const { data, error } = await supabase
    .from('articles')
    .insert({
      title: article.title,
      content: article.content,
      summary: article.summary,
      category: article.category,
      type: article.type,
      tags: article.tags,
      author_id: user.id,
      author_name: article.author,
      is_published: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

// 更新文章（管理员功能）
export const updateArticle = async (id: string, updates: Partial<Article>) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');

  const updateData: any = {};
  if (updates.title) updateData.title = updates.title;
  if (updates.content) updateData.content = updates.content;
  if (updates.summary !== undefined) updateData.summary = updates.summary;
  if (updates.category) updateData.category = updates.category;
  if (updates.type) updateData.type = updates.type;
  if (updates.tags) updateData.tags = updates.tags;

  const { data, error } = await supabase
    .from('articles')
    .update(updateData)
    .eq('id', id)
    .eq('author_id', user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

// 删除文章（管理员功能）
export const deleteArticle = async (id: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');

  const { error } = await supabase
    .from('articles')
    .delete()
    .eq('id', id)
    .eq('author_id', user.id);

  if (error) throw error;
};