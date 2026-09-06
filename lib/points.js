'use strict';

const POINT_PRICE_TWD = 1;

const PACKS = {
  small: { id: 'small', principal: 500, bonus: 0, pay_twd: 500 },
  mid: { id: 'mid', principal: 1000, bonus: 100, pay_twd: 1000 },
  large: { id: 'large', principal: 3000, bonus: 450, pay_twd: 3000 },
  xl: { id: 'xl', principal: 5000, bonus: 1000, pay_twd: 5000 },
};

const MEMBERSHIP_GIFT_POINTS = {
  day_4h: 0,
  day_12h: 0,
  month: 1000,
  quarter: 3000,
  year: 10000,
  founding: 20000,
};

const REDEEM_PRICES = {
  shower: 70,
  laundry: 50,            // 頂樓洗脫烘一次
  capsule_per_hour: 100,
  entertainment_per_hour: 100,
};

// 一般會籍牌價（NT$），線上 Stripe 結帳與現場開通共用
const PLAN_PRICE_TWD = {
  day_4h: 200,
  day_12h: 500,
  month: 4000,
  quarter: 10000,
  year: 35000,
};

function addYears(date, years) {
  const d = new Date(date);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d;
}

function isLotAvailable(lot, now = new Date()) {
  if (!lot.remaining || lot.remaining <= 0) return false;
  if (lot.expires_at == null) return true;
  return new Date(lot.expires_at) > now;
}

function availableBalance(lots, now = new Date()) {
  return lots.reduce((s, l) => s + (isLotAvailable(l, now) ? Number(l.remaining) : 0), 0);
}

function sortLotsForDebit(lots) {
  return [...lots].sort((a, b) => {
    const ae = a.expires_at == null ? Infinity : +new Date(a.expires_at);
    const be = b.expires_at == null ? Infinity : +new Date(b.expires_at);
    if (ae !== be) return ae - be;
    return +new Date(a.created_at) - +new Date(b.created_at);
  });
}

function redeemPointsFor(service, hoursOrQty) {
  if (service === 'shower') return REDEEM_PRICES.shower * (hoursOrQty || 1);
  if (service === 'laundry') return REDEEM_PRICES.laundry * (hoursOrQty || 1);
  if (service === 'capsule') {
    if (!Number.isInteger(hoursOrQty) || hoursOrQty < 1) throw new Error('hours required');
    return REDEEM_PRICES.capsule_per_hour * hoursOrQty;
  }
  if (service === 'entertainment') {
    if (!Number.isInteger(hoursOrQty) || hoursOrQty < 1) throw new Error('hours required');
    return REDEEM_PRICES.entertainment_per_hour * hoursOrQty;
  }
  throw new Error('unsupported service');
}

function planDebit(lots, points, now = new Date()) {
  if (!Number.isInteger(points) || points < 1) return { ok: false, error: 'invalid_points' };
  let need = points;
  const allocations = [];
  for (const lot of sortLotsForDebit(lots)) {
    if (!isLotAvailable(lot, now) || need <= 0) continue;
    const take = Math.min(Number(lot.remaining), need);
    if (take > 0) {
      allocations.push({ lot_id: lot.id, amount: take });
      need -= take;
    }
  }
  if (need > 0) return { ok: false, error: 'insufficient' };
  return { ok: true, allocations };
}

function planRefund(lots, orderId, principalPoints) {
  if (!Number.isInteger(principalPoints) || principalPoints < 1) {
    return { ok: false, error: 'invalid_points' };
  }
  const purchaseLots = lots.filter(
    l => l.type === 'purchase' && l.source_id === orderId && Number(l.remaining) > 0
  );
  const avail = purchaseLots.reduce((s, l) => s + Number(l.remaining), 0);
  if (principalPoints > avail) return { ok: false, error: 'exceeds_principal' };

  let need = principalPoints;
  const debit_principal = [];
  for (const lot of purchaseLots) {
    if (need <= 0) break;
    const take = Math.min(Number(lot.remaining), need);
    debit_principal.push({ lot_id: lot.id, amount: take });
    need -= take;
  }

  const void_bonus = lots
    .filter(l => l.type === 'bonus' && l.source_id === orderId && Number(l.remaining) > 0)
    .map(l => ({ lot_id: l.id, amount: Number(l.remaining) }));

  return {
    ok: true,
    debit_principal,
    void_bonus,
    refund_twd: principalPoints * POINT_PRICE_TWD,
  };
}

module.exports = {
  PLAN_PRICE_TWD,
  POINT_PRICE_TWD,
  PACKS,
  MEMBERSHIP_GIFT_POINTS,
  REDEEM_PRICES,
  addYears,
  isLotAvailable,
  availableBalance,
  sortLotsForDebit,
  redeemPointsFor,
  planDebit,
  planRefund,
};
