import { describe, expect, it } from 'vitest';
import type { Price } from './api';
import { formatYuan, isWeChatBrowser, ledgerLabel, packHint } from './shopModel';

const prices: Price[] = [
  { kind: 'chat', credits: 1, label: '问 AI（文字）' },
  { kind: 't2i', credits: 10, label: '用文字画图' },
  { kind: 't2v', credits: 60, label: '用文字做视频' },
];

describe('formatYuan', () => {
  it('drops trailing zeros', () => {
    expect(formatYuan(990)).toBe('¥9.9');
    expect(formatYuan(2990)).toBe('¥29.9');
    expect(formatYuan(9900)).toBe('¥99');
    expect(formatYuan(1999)).toBe('¥19.99');
  });
});

describe('packHint', () => {
  it('converts a pack into images and videos at current prices', () => {
    expect(packHint(330, prices)).toBe('约可以画 33 张图，或做 5 段视频');
    expect(packHint(1200, prices)).toBe('约可以画 120 张图，或做 20 段视频');
  });

  it('leaves out videos the pack cannot afford', () => {
    expect(packHint(30, prices)).toBe('约可以画 3 张图');
  });

  it('returns nothing without credits or prices', () => {
    expect(packHint(null, prices)).toBe('');
    expect(packHint(100, [])).toBe('');
  });
});

describe('isWeChatBrowser', () => {
  it('recognises the WeChat in-app browser on phones and desktop', () => {
    expect(isWeChatBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 MicroMessenger/8.0.50(0x18003237) NetType/WIFI Language/zh_CN')).toBe(true);
    expect(isWeChatBrowser('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/116.0 Safari/537.36 MicroMessenger/7.0.20.1781(0x6700143B) WindowsWechat')).toBe(true);
  });

  it('leaves ordinary browsers alone', () => {
    expect(isWeChatBrowser('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36')).toBe(false);
    expect(isWeChatBrowser('')).toBe(false);
  });
});

describe('ledgerLabel', () => {
  it('names each reason and passes unknown ones through', () => {
    expect(ledgerLabel('purchase')).toBe('购买积分');
    expect(ledgerLabel('refund')).toBe('失败退回');
    expect(ledgerLabel('mystery')).toBe('mystery');
  });
});
