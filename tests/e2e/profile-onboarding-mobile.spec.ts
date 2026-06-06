import { expect, test, type Page } from '@playwright/test';

const fakeUserId = '00000000-0000-4000-8000-000000000001';

const getSupabaseStorageKey = () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://dltotjjxhucysnezzzkc.supabase.co';
  const ref = new URL(supabaseUrl).host.split('.')[0];
  return `sb-${ref}-auth-token`;
};

const fakeProfile = {
  id: fakeUserId,
  phone: '13900000000',
  nickname: 'test-user',
  bio: '',
  avatar_url: null,
  is_public: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  group_identity: ['不在群内'],
  group_nickname: null,
  tags: ['INTP', '夜猫子', '读书'],
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

async function mockAuthenticatedProfile(page: Page, fontSize?: string) {
  await page.route('**/rest/v1/profiles**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fakeProfile),
    });
  });

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

  await page.addInitScript(
    ({ storageKey, userId, expiresAt, fontSize }) => {
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

      if (fontSize) {
        const style = document.createElement('style');
        style.textContent = `html { font-size: ${fontSize} !important; }`;
        document.documentElement.appendChild(style);
      }
    },
    {
      storageKey: getSupabaseStorageKey(),
      userId: fakeUserId,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      fontSize,
    },
  );
}

async function getOverflowOffenders(page: Page) {
  return page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;

    return [...document.querySelectorAll('body *')]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName,
          className: element.className?.toString?.() || '',
          text: (element.textContent || '').trim().slice(0, 80),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
        };
      })
      .filter(
        (item) =>
          item.width > 0 &&
          (item.right > viewportWidth + 2 ||
            item.left < -2 ||
            item.scrollWidth > item.clientWidth + 2),
      )
      .slice(0, 10);
  });
}

test.describe('注册后资料完善移动端布局', () => {
  for (const scenario of [
    { width: 320, fontSize: undefined },
    { width: 360, fontSize: undefined },
    { width: 360, fontSize: '20px' },
    { width: 390, fontSize: undefined },
  ]) {
    test(`group and tag options do not overflow at ${scenario.width}px${scenario.fontSize ? ' large font' : ''}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: scenario.width, height: 780 });
      await mockAuthenticatedProfile(page, scenario.fontSize);
      await page.goto('/profile?flow=register');
      await page.locator('aside button').nth(1).click();

      await expect(page.locator('body')).toContainText('个人标签');
      await expect.poll(async () => getOverflowOffenders(page)).toEqual([]);
    });
  }
});
