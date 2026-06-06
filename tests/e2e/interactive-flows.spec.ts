import { expect, test, type Locator } from '@playwright/test';

test.describe('核心交互流程', () => {
  const clickFirstVisible = async (locator: Locator) => {
    const count = await locator.count();
    for (let index = 0; index < count; index += 1) {
      const item = locator.nth(index);
      if (await item.isVisible().catch(() => false)) {
        await item.click();
        return;
      }
    }

    throw new Error('No visible target found');
  };

  test('navigation menu can open pages', async ({ page, isMobile }) => {
    await page.goto('/about');

    if (isMobile) {
      await page.locator('header button').last().click();
      await page.locator('a[href="/tools"]').last().click();
    } else {
      await page.locator('nav a[href="/tools"]').click();
    }

    await expect(page).toHaveURL(/\/tools$/);
    await expect(page.locator('main')).toContainText(/产品|Jianwen|Pull-up/i);
  });

  test('tools suggestion button blocks anonymous submission', async ({ page }) => {
    await page.goto('/tools');

    const dialogPromise = new Promise<string>((resolve) => {
      page.once('dialog', async (dialog) => {
        const message = dialog.message();
        await dialog.accept();
        resolve(message);
      });
    });

    await page.locator('main button').first().click();
    const message = await dialogPromise;

    expect(message).toContain('请先登录');
  });

  test('guide feature link navigates to QA', async ({ page }) => {
    await page.goto('/guide');
    await clickFirstVisible(page.locator('a[href="/qa"]'));

    await expect(page).toHaveURL(/\/qa$/);
    await expect(page.locator('main')).toContainText(/问题|星球|问答/);
  });

  test('QA search and ask form respond to input', async ({ page }) => {
    await page.goto('/qa');

    await page.locator('input[type="text"]').first().fill('训练');
    await page.locator('textarea').first().fill('交互测试问题，不实际提交');

    await expect(page.locator('textarea').first()).toHaveValue('交互测试问题，不实际提交');
    await expect(page.locator('form button[type="submit"]')).toBeDisabled();
  });

  test('community can switch to partner search and open a profile when data exists', async ({ page }) => {
    await page.goto('/community');
    await page.locator('main button').nth(1).click();

    await expect(page.locator('main input[type="text"]')).toBeVisible();
    await page.locator('main input[type="text"]').fill('小');
    await page.waitForTimeout(2_000);

    const cards = page.locator('main div.cursor-pointer');
    if ((await cards.count()) === 0) {
      await expect(page.locator('main')).toContainText(/没有找到|暂无公开/);
      return;
    }

    await cards.first().click();
    await expect(page.locator('div.fixed')).toBeVisible();
    await page.locator('div.fixed button').first().click();
    await expect(page.locator('div.fixed')).toHaveCount(0);
  });

  test('auth forms validate and password visibility toggles', async ({ page }) => {
    await page.goto('/register');
    await page.locator('#nickname').fill('交互测试');
    await page.locator('#phone').fill('13900000001');
    await page.locator('#password').fill('123');
    await page.locator('form button[type="submit"]').click();
    await expect(page.locator('body')).toContainText('密码长度至少6位');

    await page.goto('/login');
    await page.locator('#password').fill('abcdef');
    await expect(page.locator('#password')).toHaveAttribute('type', 'password');
    await page.locator('button[aria-label="显示密码"]').click();
    await expect(page.locator('#password')).toHaveAttribute('type', 'text');
  });
});
