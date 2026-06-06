import { expect, test, type Page } from '@playwright/test';

const fakeUserId = '00000000-0000-4000-8000-000000000001';
const fakeCreatedAt = '2026-06-05T12:00:00.000Z';
const tinyImage =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#22d3ee"/>
          <stop offset="1" stop-color="#8b5cf6"/>
        </linearGradient>
      </defs>
      <rect width="640" height="480" fill="url(#g)"/>
      <text x="64" y="230" fill="white" font-size="58" font-family="Arial" font-weight="700">E2E Check-in</text>
    </svg>
  `);

const getSupabaseStorageKey = () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://dltotjjxhucysnezzzkc.supabase.co';
  const ref = new URL(supabaseUrl).host.split('.')[0];
  return `sb-${ref}-auth-token`;
};

const fakeProfile = {
  id: fakeUserId,
  phone: '13900000000',
  nickname: '测试用户',
  bio: '',
  avatar_url: null,
  is_public: true,
  created_at: fakeCreatedAt,
  updated_at: fakeCreatedAt,
  group_identity: ['不在群内'],
  group_nickname: '小马尾',
  tags: ['健身'],
  skills_offering: null,
  skills_seeking: null,
  wechat_id: null,
  social_links: {},
  age: null,
  gender: null,
  bench_press: 0,
  squat: 0,
  deadlift: 0,
  profession: null,
  specialties: [],
  fitness_interests: [],
  learning_interests: [],
};

const fakeCheckIn = {
  id: '11111111-1111-4111-8111-111111111111',
  user_id: fakeUserId,
  content: '建设社区网站\n修补食探和教链',
  image_urls: [tinyImage],
  category: 'daily',
  created_at: fakeCreatedAt,
  updated_at: fakeCreatedAt,
  profiles: fakeProfile,
  likes: [],
  comments: [],
};

async function mockAuthenticatedCommunity(page: Page) {
  await page.route('**/auth/v1/**', async (route) => {
    if (route.request().url().includes('/user')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: fakeUserId,
          aud: 'authenticated',
          role: 'authenticated',
          email: '13900000000@jianwen.community',
        }),
      });
      return;
    }

    await route.continue();
  });

  await page.route('**/rest/v1/profiles**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fakeProfile),
    });
  });

  await page.route('**/rest/v1/check_ins**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([fakeCheckIn]),
    });
  });

  await page.addInitScript(
    ({ storageKey, userId, expiresAt }) => {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          access_token: 'fake-access-token',
          refresh_token: 'fake-refresh-token',
          expires_at: expiresAt,
          expires_in: 3600,
          token_type: 'bearer',
          user: {
            id: userId,
            aud: 'authenticated',
            role: 'authenticated',
            email: '13900000000@jianwen.community',
            app_metadata: { provider: 'email', providers: ['email'] },
            user_metadata: {},
            created_at: new Date().toISOString(),
          },
        }),
      );
    },
    {
      storageKey: getSupabaseStorageKey(),
      userId: fakeUserId,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    },
  );
}

test.describe('打卡分享图移动端操作', () => {
  test('mobile share modal exposes a viewport-visible PNG download action', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            (window as any).__copiedText = text;
          },
        },
      });
    });
    await mockAuthenticatedCommunity(page);

    await page.goto('/community');
    await page.getByRole('button', { name: /分享图/ }).click();

    const downloadButton = page.getByRole('button', { name: '下载打卡分享图 PNG' }).last();
    await expect(downloadButton).toBeVisible();

    const box = await downloadButton.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(360);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(780);

    await page.getByRole('button', { name: '复制打卡链接' }).last().click();
    const copiedText = await page.evaluate(() => (window as any).__copiedText);
    expect(copiedText).toContain(`/community?checkIn=${fakeCheckIn.id}`);
  });
});
