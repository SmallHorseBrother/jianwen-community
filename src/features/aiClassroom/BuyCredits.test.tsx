import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Price } from './api';
import BuyCredits from './BuyCredits';
import { shopApi } from './shopApi';
import { PENDING_ORDER_KEY, type ShopCatalog, type ShopOrder } from './shopModel';

vi.mock('./shopApi', () => ({ shopApi: { catalog: vi.fn(), createOrder: vi.fn(), syncOrder: vi.fn(), ledger: vi.fn() } }));
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,QR') } }));

const api = vi.mocked(shopApi);
const prices: Price[] = [
  { kind: 't2i', credits: 10, label: '用文字画图' },
  { kind: 't2v', credits: 60, label: '用文字做视频' },
];
const catalog: ShopCatalog = {
  products: [
    { code: 'credits-100', kind: 'credit_pack', title: '尝鲜包', description: '', price_cents: 990, credits: 100 },
    { code: 'credits-330', kind: 'credit_pack', title: '常用包', description: '多送约 10%', price_cents: 2990, credits: 330 },
    { code: 'credits-1200', kind: 'credit_pack', title: '课堂包', description: '多送 20%', price_cents: 9900, credits: 1200 },
  ],
  providers: { wechat: true, alipay: true },
  can_buy: true,
  balance: 30,
};
const ORDER_NO = 'SP20261028120000ABCDEF1234';
const order = (patch: Partial<ShopOrder> = {}): ShopOrder => ({
  order_no: ORDER_NO, provider: 'wechat', status: 'created', amount_cents: 2990, credits: 330,
  expires_at: '2026-10-28T12:30:00Z', paid_at: null, wechat_code_url: 'weixin://wxpay/bizpayurl?pr=abc', alipay_payment_url: null,
  ...patch,
});

const renderBuy = (props: Partial<React.ComponentProps<typeof BuyCredits>> = {}) => {
  const onPaid = vi.fn();
  render(<MemoryRouter><BuyCredits prices={prices} onClose={vi.fn()} onPaid={onPaid} {...props} /></MemoryRouter>);
  return { onPaid };
};

describe('BuyCredits', () => {
  beforeAll(() => {
    // jsdom 没有实现原生 dialog 的 showModal / close
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute('open', ''); };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute('open'); };
  });
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    api.catalog.mockResolvedValue(catalog);
  });
  afterEach(() => { cleanup(); });

  it('lists the packs with prices, preselects the middle one and shows the purchase terms', async () => {
    renderBuy();
    const middle = await screen.findByRole('radio', { name: /常用包/ });
    expect((middle as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText(/约可以画 33 张图，或做 5 段视频/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '微信支付 ¥29.9' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '支付宝 ¥29.9' })).toBeTruthy();
    expect(screen.getByText('积分不过期；已购积分不退现金；生成失败会自动退回积分。')).toBeTruthy();
  });

  it('creates a WeChat order, shows the QR code and reports the new balance once paid', async () => {
    api.createOrder.mockResolvedValue(order());
    api.syncOrder.mockResolvedValueOnce(order()).mockResolvedValueOnce(order({ status: 'paid', paid_at: '2026-10-28T12:01:00Z', balance: 360 }));
    const user = userEvent.setup();
    const { onPaid } = renderBuy();

    await user.click(await screen.findByRole('radio', { name: /课堂包/ }));
    await user.click(screen.getByRole('button', { name: '微信支付 ¥99' }));
    expect(api.createOrder).toHaveBeenCalledWith('credits-1200', 'wechat');
    expect(await screen.findByAltText('微信支付二维码')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '我已支付，刷新' }));
    expect(onPaid).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '我已支付，刷新' }));
    expect(await screen.findByText('已到账 330 积分')).toBeTruthy();
    expect(onPaid).toHaveBeenCalledWith(360);
  });

  it('sends Alipay buyers to the cashier and remembers the order for the return trip', async () => {
    const cashier = 'https://openapi.alipay.com/gateway.do?sign=x';
    api.createOrder.mockResolvedValue(order({ provider: 'alipay', wechat_code_url: null, alipay_payment_url: cashier }));
    const original = window.location;
    const assign = vi.fn();
    Object.defineProperty(window, 'location', { value: { ...original, assign }, configurable: true });
    try {
      const user = userEvent.setup();
      renderBuy();
      await user.click(await screen.findByRole('button', { name: '支付宝 ¥29.9' }));
      expect(assign).toHaveBeenCalledWith(cashier);
      expect(sessionStorage.getItem(PENDING_ORDER_KEY)).toBe(ORDER_NO);
    } finally {
      Object.defineProperty(window, 'location', { value: original, configurable: true });
    }
  });

  it('picks up an order after returning from Alipay', async () => {
    sessionStorage.setItem(PENDING_ORDER_KEY, ORDER_NO);
    api.syncOrder.mockResolvedValue(order({ provider: 'alipay', status: 'paid', credits: 100, amount_cents: 990, balance: 130 }));
    const { onPaid } = renderBuy({ resumeOrderNo: ORDER_NO });
    expect(await screen.findByText('已到账 100 积分')).toBeTruthy();
    expect(api.syncOrder).toHaveBeenCalledWith(ORDER_NO);
    expect(onPaid).toHaveBeenCalledWith(130);
    expect(sessionStorage.getItem(PENDING_ORDER_KEY)).toBeNull();
  });

  it('asks visitors without a real account to sign in first', async () => {
    api.catalog.mockResolvedValue({ ...catalog, can_buy: false });
    renderBuy();
    expect(await screen.findByRole('link', { name: '登录' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /微信支付/ })).toBeNull();
  });

  it('tells WeChat in-app visitors how to pay', async () => {
    const ua = vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone) Mobile/15E148 MicroMessenger/8.0.50 NetType/WIFI');
    try {
      renderBuy();
      expect(await screen.findByText(/你正在微信里打开/)).toBeTruthy();
    } finally {
      ua.mockRestore();
    }
  });

  it('does not show the WeChat notice in ordinary browsers', async () => {
    renderBuy();
    await screen.findByRole('radio', { name: /常用包/ });
    expect(screen.queryByText(/你正在微信里打开/)).toBeNull();
  });

  it('shows the server message when an order cannot be created', async () => {
    api.createOrder.mockRejectedValue(new Error('微信支付尚未配置'));
    const user = userEvent.setup();
    renderBuy();
    await user.click(await screen.findByRole('button', { name: '微信支付 ¥29.9' }));
    expect((await screen.findByRole('alert')).textContent).toBe('微信支付尚未配置');
  });
});
