import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import Dialog from '../../components/Common/Dialog';
import type { Price } from './api';
import { useInterval } from './components';
import { shopApi } from './shopApi';
import { formatYuan, isWeChatBrowser, packHint, pendingOrder, PROVIDER_NAMES, PURCHASE_TERMS, type Provider, type ShopCatalog, type ShopOrder } from './shopModel';
import './classroom.css';

const POLL_MS = 3000;
const POLL_LIMIT_MS = 10 * 60_000; // 扫码后最多自动查 10 分钟，之后改为手动刷新
const PROVIDERS: Provider[] = ['wechat', 'alipay'];

type Props = {
  prices?: readonly Price[];
  resumeOrderNo?: string | null; // 从支付宝付完跳回来时，接着查这笔订单
  onClose: () => void;
  onPaid: (balance: number | null) => void;
};

// 买积分：选积分包 → 选微信或支付宝 → 微信显示二维码、支付宝跳转 → 自动查单，到账后回调 onPaid
const BuyCredits: React.FC<Props> = ({ prices = [], resumeOrderNo = null, onClose, onPaid }) => {
  const [catalog, setCatalog] = useState<ShopCatalog | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [orderNo, setOrderNo] = useState<string | null>(resumeOrderNo);
  const [order, setOrder] = useState<ShopOrder | null>(null);
  const [qr, setQr] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pollUntil, setPollUntil] = useState(resumeOrderNo ? Date.now() + POLL_LIMIT_MS : 0);

  useEffect(() => {
    let active = true;
    shopApi.catalog()
      .then((value) => {
        if (!active) return;
        setCatalog(value);
        setSelected((current) => current ?? (value.products[1] ?? value.products[0])?.code ?? null);
      })
      .catch((caught: Error) => { if (active) setError(caught.message); });
    return () => { active = false; };
  }, []);

  // 同一时间只查一次；确认到账后不再接受晚到的“未支付”回复，onPaid 也只调用一次
  const inFlight = useRef(false);
  const paid = useRef(false);
  const sync = useCallback(async () => {
    if (!orderNo || inFlight.current || paid.current) return;
    inFlight.current = true;
    try {
      const next = await shopApi.syncOrder(orderNo);
      if (paid.current) return;
      setOrder(next);
      setError('');
      if (next.status === 'paid') {
        paid.current = true;
        pendingOrder.clear();
        setPollUntil(0);
        onPaid(next.balance ?? null);
      }
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      inFlight.current = false;
    }
  }, [orderNo, onPaid]);

  // 只在打开时查一次：从支付宝跳回来的订单
  useEffect(() => { if (resumeOrderNo) void sync(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const polling = Boolean(orderNo && pollUntil && order?.status !== 'paid');
  useInterval(() => {
    if (Date.now() > pollUntil) { setPollUntil(0); return; }
    void sync();
  }, polling ? POLL_MS : null);

  useEffect(() => {
    const url = order?.wechat_code_url;
    if (!url) { setQr(''); return; }
    QRCode.toDataURL(url, { margin: 1, width: 280 }).then(setQr).catch(() => setQr(''));
  }, [order?.wechat_code_url]);

  const buy = async (provider: Provider) => {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      const created = await shopApi.createOrder(selected, provider);
      setOrder(created);
      setOrderNo(created.order_no);
      if (provider === 'alipay' && created.alipay_payment_url) {
        pendingOrder.set(created.order_no);
        window.location.assign(created.alipay_payment_url);
        return;
      }
      setPollUntil(Date.now() + POLL_LIMIT_MS);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const restart = () => { setOrder(null); setOrderNo(null); setPollUntil(0); pendingOrder.clear(); };
  const inWeChat = isWeChatBrowser();
  const product = catalog?.products.find((item) => item.code === selected);
  const providers = PROVIDERS.filter((key) => catalog?.providers[key]);

  let content: React.ReactNode;
  if (order?.status === 'paid') {
    content = (
      <div className="cw-shop-done" role="status">
        <CheckCircle2 aria-hidden="true" />
        <h3>已到账 {order.credits} 积分</h3>
        {order.balance != null && <p>现在的余额：{order.balance} 积分</p>}
        <button type="button" className="jw-action" onClick={onClose}>好的</button>
      </div>
    );
  } else if (orderNo) {
    content = (
      <div className="cw-shop-pay">
        {order?.provider === 'wechat' && qr ? (
          <>
            <img src={qr} alt="微信支付二维码" width={240} height={240} />
            <p>用微信扫一扫，支付 <b>{formatYuan(order.amount_cents)}</b></p>
            <p className="cw-shop-note">{inWeChat
              ? '可以试试长按二维码识别付款；如果识别后付不了，请在电脑上打开本页扫码，或在手机浏览器里打开本页用支付宝付。'
              : '付完会自动到账，通常几秒钟。电脑上打开时扫码最方便；在手机上可以用另一台设备扫。'}</p>
          </>
        ) : (
          <p className="cw-shop-note" role="status"><Loader2 className="cw-spin" aria-hidden="true" /> 正在确认支付结果…</p>
        )}
        {!pollUntil && <p className="cw-shop-note">已经停止自动查询。如果已经付款，点“我已支付，刷新”。</p>}
        <div className="cw-shop-actions">
          <button type="button" className="jw-action secondary" onClick={() => void sync()}>我已支付，刷新</button>
          <button type="button" className="cw-shop-link" onClick={restart}>换一个积分包</button>
        </div>
      </div>
    );
  } else if (!catalog) {
    content = !error && <p className="cw-shop-note" role="status">正在读取积分包…</p>;
  } else if (!catalog.can_buy) {
    content = <div className="cw-shop-pay"><p>购买积分需要先登录正式账号。</p><Link to="/login" className="jw-action">登录</Link></div>;
  } else {
    content = (
      <>
        {inWeChat && (
          <p className="cw-shop-notice">你正在微信里打开：微信会拦住支付宝跳转，扫码付通常也要用另一台设备。最顺的办法是点右上角「···」选「在浏览器打开」，再用支付宝付；或者在电脑上打开本页扫码。</p>
        )}
        <div className="cw-shop-packs" role="radiogroup" aria-label="选择积分包">
          {catalog.products.map((item) => (
            <label key={item.code} className={selected === item.code ? 'on' : undefined}>
              <input type="radio" name="credit-pack" value={item.code} checked={selected === item.code} onChange={() => setSelected(item.code)} />
              <span className="cw-shop-pack-title">{item.title}</span>
              <strong>{item.credits} 积分</strong>
              <span className="cw-shop-price">{formatYuan(item.price_cents)}</span>
              <small>{[item.description, packHint(item.credits, prices)].filter(Boolean).join(' · ')}</small>
            </label>
          ))}
        </div>
        {providers.length ? (
          <div className="cw-shop-actions">
            {providers.map((key) => (
              <button key={key} type="button" className="jw-action" disabled={busy || !product} onClick={() => void buy(key)}>
                {busy ? <Loader2 className="cw-spin" aria-hidden="true" /> : null}{PROVIDER_NAMES[key]}{product ? ` ${formatYuan(product.price_cents)}` : ''}
              </button>
            ))}
          </div>
        ) : <p className="cw-shop-note">在线支付还没开通，请联系管理员。</p>}
        <p className="cw-shop-note">{PURCHASE_TERMS}</p>
      </>
    );
  }

  return (
    <Dialog title="购买积分" onClose={onClose} className="cw-shop">
      {error && <p className="cw-shop-error" role="alert">{error}</p>}
      {content}
    </Dialog>
  );
};

export default BuyCredits;
