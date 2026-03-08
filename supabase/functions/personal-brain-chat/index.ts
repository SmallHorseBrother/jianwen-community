import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type PersonalProfileRow = {
  id: string;
  slug: string;
  display_name: string;
  headline: string;
  intro: string;
  long_bio: string;
  location: string | null;
  email_public: string | null;
  wechat_public: string | null;
  social_links: Record<string, string> | null;
  expertise: string[] | null;
  ai_enabled: boolean;
  ai_welcome_message: string | null;
  ai_system_prompt: string | null;
  is_public: boolean;
};

type PersonalEntryRow = {
  entry_type: 'resume' | 'paper' | 'venture' | 'project' | 'custom';
  title: string;
  subtitle: string | null;
  organization: string | null;
  start_date: string | null;
  end_date: string | null;
  is_ongoing: boolean;
  summary: string | null;
  content: string | null;
  highlights: string[] | null;
  links: unknown;
};

type PersonalFileRow = {
  title: string;
  description: string | null;
  mime_type: string | null;
  file_url: string;
  extracted_text: string | null;
  use_for_ai: boolean;
};

const buildPrompt = (
  profile: PersonalProfileRow,
  entries: PersonalEntryRow[],
  files: PersonalFileRow[],
) => {
  const structuredProfile = {
    displayName: profile.display_name,
    headline: profile.headline,
    intro: profile.intro,
    longBio: profile.long_bio,
    location: profile.location,
    emailPublic: profile.email_public,
    wechatPublic: profile.wechat_public,
    expertise: profile.expertise || [],
    socialLinks: profile.social_links || {},
  };

  const contentByType = ['resume', 'paper', 'venture', 'project', 'custom']
    .map((type) => {
      const items = entries.filter((entry) => entry.entry_type === type);
      if (items.length === 0) return '';

      const rendered = items
        .map((entry, index) => {
          const lines = [
            `${index + 1}. 标题: ${entry.title || ''}`,
            `副标题: ${entry.subtitle || ''}`,
            `机构: ${entry.organization || ''}`,
            `时间: ${[entry.start_date, entry.is_ongoing ? '至今' : entry.end_date]
              .filter(Boolean)
              .join(' - ')}`,
            `摘要: ${entry.summary || ''}`,
            `正文: ${entry.content || ''}`,
            `亮点: ${(entry.highlights || []).join('；')}`,
            `链接: ${JSON.stringify(entry.links || [])}`,
          ];

          return lines.join('\n');
        })
        .join('\n\n');

      return `## ${type}\n${rendered}`;
    })
    .filter(Boolean)
    .join('\n\n');

  const fileSection = files.length
    ? files
        .map((file, index) => {
          const lines = [
            `${index + 1}. 标题: ${file.title}`,
            `描述: ${file.description || ''}`,
            `文件类型: ${file.mime_type || ''}`,
            `链接: ${file.file_url || ''}`,
            `供回答参考的摘要: ${file.extracted_text || ''}`,
          ];
          return lines.join('\n');
        })
        .join('\n\n')
    : '暂无附件。';

  return `
你是网站主人的数字分身，需要基于公开资料回答问题。

规则:
1. 只能基于提供资料回答，不要编造。
2. 如果资料不足，请明确说“不确定”或“资料里没有提到”。
3. 回答尽量口语化、自然，但保持专业。
4. 优先引用具体经历、论文、项目或附件信息。
5. 如果用户问联系方式，只能返回公开资料里有的联系方式。

额外系统提示:
${profile.ai_system_prompt || '无'}

公开个人资料:
${JSON.stringify(structuredProfile, null, 2)}

内容条目:
${contentByType || '暂无结构化内容。'}

附件资料:
${fileSection}
  `.trim();
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const apiKey = Deno.env.get('DASHSCOPE_API_KEY');
    const baseUrl =
      Deno.env.get('DASHSCOPE_BASE_URL') ?? 'https://coding.dashscope.aliyuncs.com/v1';
    const model = Deno.env.get('DASHSCOPE_MODEL') ?? 'kimi-k2.5';

    if (!apiKey) {
      throw new Error('Missing DASHSCOPE_API_KEY secret');
    }

    const { slug, messages } = (await req.json()) as {
      slug?: string;
      messages?: ChatMessage[];
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('messages is required');
    }

    let profileQuery = supabase
      .from('personal_profiles')
      .select('*')
      .eq('is_public', true)
      .limit(1);

    if (slug) {
      profileQuery = profileQuery.eq('slug', slug);
    }

    const { data: profileRows, error: profileError } = await profileQuery;
    if (profileError) throw profileError;

    const profile = profileRows?.[0] as PersonalProfileRow | undefined;
    if (!profile) {
      throw new Error('Public personal profile not found');
    }

    if (!profile.ai_enabled) {
      throw new Error('Digital human is disabled');
    }

    const [entriesResult, filesResult] = await Promise.all([
      supabase
        .from('personal_entries')
        .select('*')
        .eq('profile_id', profile.id)
        .eq('is_public', true)
        .order('entry_type', { ascending: true })
        .order('sort_order', { ascending: true }),
      supabase
        .from('personal_files')
        .select('*')
        .eq('profile_id', profile.id)
        .eq('use_for_ai', true)
        .order('created_at', { ascending: false }),
    ]);

    if (entriesResult.error) throw entriesResult.error;
    if (filesResult.error) throw filesResult.error;

    const prompt = buildPrompt(profile, entriesResult.data || [], filesResult.data || []);

    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [
          {
            role: 'system',
            content: prompt,
          },
          ...messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DashScope request failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const answer = data?.choices?.[0]?.message?.content;

    if (!answer || typeof answer !== 'string') {
      throw new Error('No answer returned from model');
    }

    return new Response(
      JSON.stringify({
        answer,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 200,
      },
    );
  } catch (error) {
    console.error('personal-brain-chat error:', error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 400,
      },
    );
  }
});
