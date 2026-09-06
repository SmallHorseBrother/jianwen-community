import { expect, test } from '@playwright/test';

test('mobile appreciation button opens a complete, viewport-level QR dialog', async ({ page, isMobile }) => {
  test.skip(!isMobile, '移动端二维码弹窗回归测试');

  await page.goto('/');

  const footer = page.locator('footer');
  await footer.scrollIntoViewIfNeeded();
  await footer.getByRole('button', { name: '请我喝杯咖啡' }).click();

  const dialog = page.getByRole('dialog', { name: '感谢支持' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('img', { name: '赞赏码' })).toBeVisible();

  expect(await dialog.evaluate((element) => element.closest('footer') === null)).toBe(true);

  const dialogBox = await dialog.boundingBox();
  const viewport = page.viewportSize();
  expect(dialogBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(dialogBox!.y).toBeGreaterThanOrEqual(0);
  expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(viewport!.height);
});
