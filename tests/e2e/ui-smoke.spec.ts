import { expect, test } from '@playwright/test';

const publicRoutes = [
  { path: '/about', heading: /马健文|Jianwen|数字|个人/i },
  { path: '/qa', heading: /问题|星球|问答/i },
  { path: '/community', heading: /社区|广场|打卡|成员/i },
  { path: '/tools', heading: /工具|计算|Tool/i },
  { path: '/guide', heading: /指南|使用|Guide/i },
  { path: '/login', heading: /欢迎回来|登录/i },
  { path: '/register', heading: /注册|创建|加入/i },
  { path: '/forgot-password', heading: /忘记密码|重置|找回/i },
];

test.describe('公共页面可访问性冒烟测试', () => {
  for (const route of publicRoutes) {
    test(`${route.path} renders without client errors`, async ({ page }) => {
      const pageErrors: string[] = [];
      const consoleErrors: string[] = [];

      page.on('pageerror', (error) => pageErrors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') {
          consoleErrors.push(message.text());
        }
      });

      await page.goto(route.path);
      await expect(page.locator('body')).toBeVisible();
      await expect(page.locator('body')).toContainText(route.heading);

      expect(pageErrors, '浏览器运行时错误').toEqual([]);
      expect(
        consoleErrors.filter((error) => !error.includes('Missing Supabase environment variables')),
        'console.error 输出',
      ).toEqual([]);
    });
  }
});

test.describe('导航和响应式交互', () => {
  test('desktop nav can move through core pages', async ({ page, isMobile }) => {
    test.skip(isMobile, '桌面导航仅在桌面视口显示');

    await page.goto('/about');
    await page.getByRole('link', { name: /问题星球/ }).click();
    await expect(page).toHaveURL(/\/qa$/);
    await expect(page.locator('body')).toContainText(/问题|星球|问答/i);

    await page.getByRole('link', { name: /社区广场/ }).click();
    await expect(page).toHaveURL(/\/community$/);
    await expect(page.locator('body')).toContainText(/社区|广场|打卡|成员/i);

    await page.getByRole('link', { name: /工具箱/ }).click();
    await expect(page).toHaveURL(/\/tools$/);
    await expect(page.locator('body')).toContainText(/工具|计算|Tool/i);
  });

  test('mobile menu opens and navigates', async ({ page, isMobile }) => {
    test.skip(!isMobile, '移动端菜单仅在移动视口显示');

    await page.goto('/about');
    await page.getByRole('button').filter({ hasText: /^$/ }).last().click();
    await page.getByRole('link', { name: /问题星球/ }).click();
    await expect(page).toHaveURL(/\/qa$/);
    await expect(page.locator('body')).toContainText(/问题|星球|问答/i);
  });
});

test.describe('认证入口交互', () => {
  test('login requires phone, password and captcha', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('手机号').fill('13800138000');
    await page.locator('#password').fill('wrong-password');
    await page.getByRole('button', { name: '登录' }).click();
    await expect(page.locator('body')).toContainText('请完成安全验证');
  });

  test('password visibility toggle works', async ({ page }) => {
    await page.goto('/login');
    const passwordInput = page.locator('#password');
    await passwordInput.fill('secret123');
    await expect(passwordInput).toHaveAttribute('type', 'password');

    await page.getByRole('button', { name: '显示密码' }).click();
    await expect(passwordInput).toHaveAttribute('type', 'text');

    await page.getByRole('button', { name: '隐藏密码' }).click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('protected pages redirect anonymous users to login', async ({ page }) => {
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator('body')).toContainText(/欢迎回来|登录/i);
  });
});

test.describe('路由兜底', () => {
  test('unknown routes show the 404 experience', async ({ page }) => {
    await page.goto('/definitely-not-a-real-page');
    await expect(page.locator('body')).toContainText(/404|不存在|未找到|返回/i);
  });
});
