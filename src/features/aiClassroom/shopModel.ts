import type { Price } from './api';

export type Provider = 'wechat' | 'alipay';
export type ShopProduct = { code: string; kind: 'credit_pack'; title: string; description: string; price_cents: number; credits: number | null };
export type ShopCatalog = { products: ShopProduct[]; providers: Record<Provider, boolean>; can_buy: boolean; balance: number | null };
export type ShopOrder = {
  order_no: string; provider: Provider; status: 'pending' | 'created' | 'paid' | 'expired' | 'failed';
  amount_cents: number; credits: number | null; expires_at: string; paid_at: string | null;
  wechat_code_url: string | null; alipay_payment_url: string | null; balance?: number | null;
};
export type LedgerReason = 'welcome' | 'grant' | 'purchase' | 'charge' | 'refund' | 'adjust';
export type LedgerEntry = { id: number; delta: number; balance_after: number; reason: LedgerReason; note: string | null; created_at: string };

export const PROVIDER_NAMES: Record<Provider, string> = { wechat: '微信支付', alipay: '支付宝' };

// 微信内置浏览器：会拦截支付宝跳转，扫码付通常也要另一台设备
export const isWeChatBrowser = (userAgent: string = typeof navigator === 'undefined' ? '' : navigator.userAgent) => /MicroMessenger/i.test(userAgent);
export const PURCHASE_TERMS = '积分不过期；已购积分不退现金；生成失败会自动退回积分。';

// 990 → ¥9.9，2990 → ¥29.9，9900 → ¥99
export function formatYuan(cents: number): string {
  const digits = cents % 100 === 0 ? 0 : cents % 10 === 0 ? 1 : 2;
  return `¥${(cents / 100).toFixed(digits)}`;
}

// 按当前价目表换算一个积分包大概能做多少事；价目表缺项时不显示对应部分
export function packHint(credits: number | null, prices: readonly Price[]): string {
  if (!credits) return '';
  const cost = (kind: Price['kind']) => prices.find((p) => p.kind === kind)?.credits;
  const parts: string[] = [];
  const image = cost('t2i');
  if (image) parts.push(`画 ${Math.floor(credits / image)} 张图`);
  const video = cost('t2v');
  if (video && credits >= video) parts.push(`做 ${Math.floor(credits / video)} 段视频`);
  return parts.length ? `约可以${parts.join('，或')}` : '';
}

const LEDGER_LABELS: Record<LedgerReason, string> = {
  welcome: '新用户赠送', grant: '平台发放', purchase: '购买积分', charge: '使用', refund: '失败退回', adjust: '调整',
};
export const ledgerLabel = (reason: string): string => LEDGER_LABELS[reason as LedgerReason] || reason;

export const PENDING_ORDER_KEY = 'jw-shop-pending-order';
export const pendingOrder = {
  get(): string | null { try { return sessionStorage.getItem(PENDING_ORDER_KEY); } catch { return null; } },
  set(orderNo: string) { try { sessionStorage.setItem(PENDING_ORDER_KEY, orderNo); } catch { /* 隐私模式 */ } },
  clear() { try { sessionStorage.removeItem(PENDING_ORDER_KEY); } catch { /* 隐私模式 */ } },
};
