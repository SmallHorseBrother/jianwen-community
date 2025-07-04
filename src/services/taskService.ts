import { supabase } from '../lib/supabase';

export interface Task {
  id: string;
  user_id: string;
  name: string;
  deadline: string;
  description?: string;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskData {
  name: string;
  deadline: string;
  description?: string;
}

export interface UpdateTaskData {
  name?: string;
  deadline?: string;
  description?: string;
  is_completed?: boolean;
}

// 获取用户的所有任务
export const getUserTasks = async (): Promise<Task[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .order('deadline', { ascending: true });

  if (error) throw error;
  return data || [];
};

// 创建新任务
export const createTask = async (taskData: CreateTaskData): Promise<Task> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      user_id: user.id,
      name: taskData.name,
      deadline: taskData.deadline,
      description: taskData.description || '',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

// 更新任务
export const updateTask = async (taskId: string, updates: UpdateTaskData): Promise<Task> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');

  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', taskId)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

// 删除任务
export const deleteTask = async (taskId: string): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)
    .eq('user_id', user.id);

  if (error) throw error;
};

// 标记任务完成/未完成
export const toggleTaskCompletion = async (taskId: string, isCompleted: boolean): Promise<Task> => {
  return updateTask(taskId, { is_completed: isCompleted });
};