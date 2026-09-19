/**
 * PurchaseModal.jsx —— 课程解锁购买弹窗（前端模拟支付闭环）
 *
 *  props:
 *   - pack:        课程包对象
 *   - units:       单元列表（用于统计步数）
 *   - freeCount:   免费试学单元数
 *   - onClose:     关闭
 *   - onPurchased: 购买成功回调（父组件据此解锁并进入单元）
 *
 *  说明：当前为模拟支付，点击「立即解锁」走 loading → 成功 → 写本地权限。
 *  接真实支付时，仅需把 handlePay 内的 setTimeout 换成支付 SDK 流程。
 */

import { useState } from 'react'
import {
  getCourseMeta,
  priceLabel,
  savePurchase,
  typeLabel,
} from '../lib/courseAccess'

const C = {
  brand: '#4F46E5',
  brandDark: '#4338CA',
  brandSoft: '#EEF0FF',
  text: '#18181B',
  sub: '#71717A',
  faint: '#A1A1AA',
  line: '#E9E9EE',
  gold: '#D97706',
  green: '#059669',
}

export default function PurchaseModal({ pack, units, onClose, onPurchased }) {
  const meta = getCourseMeta(pack)
  const [paying, setPaying] = useState(false)
  const [done, setDone] = useState(false)

  if (!pack) return null

  const totalUnits = (units && units.length) || pack.lesson_count || pack.unit_count || 0
  const totalSteps = (units || []).reduce((n, u) => n + (u.step_count || 0), 0)

  const handlePay = () => {
    if (paying || done) return
    setPaying(true)
    // —— 模拟支付链路（真实支付接入点）——
    setTimeout(() => {
      savePurchase(pack.id, { kind: meta.isPro ? 'pro' : 'buy', price: meta.price })
      setPaying(false)
      setDone(true)
      setTimeout(() => {
        onPurchased && onPurchased()
      }, 750)
    }, 900)
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(24,24,27,0.55)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        animation: 'pmFade .18s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 440,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: '#fff',
          borderRadius: 22,
          boxShadow: '0 24px 64px rgba(24,24,27,0.22)',
          overflow: 'hidden',
          animation: 'pmPop .22s cubic-bezier(.2,.9,.3,1.2)',
        }}
      >
        {/* 头图 */}
        <div
          style={{
            position: 'relative',
            height: 132,
            background:
              'linear-gradient(135deg,#6366F1 0%,#4F46E5 55%,#4338CA 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 6,
            color: '#fff',
          }}
        >
          <span
            style={{
              fontSize: 12,
              background: 'rgba(255,255,255,.2)',
              padding: '3px 12px',
              borderRadius: 999,
              fontWeight: 600,
              letterSpacing: 1,
            }}
          >
            {typeLabel(meta.type)}
          </span>
          <span style={{ fontSize: 22, fontWeight: 800, padding: '0 24px', textAlign: 'center' }}>
            {pack.title}
          </span>
          <button
            onClick={onClose}
            aria-label="关闭"
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(255,255,255,.22)',
              color: '#fff',
              fontSize: 17,
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '22px 24px 24px' }}>
          {/* 标签行 */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {[pack.level, pack.category].filter(Boolean).map((t) => (
              <span
                key={t}
                style={{
                  fontSize: 11.5,
                  color: C.brandDark,
                  background: C.brandSoft,
                  padding: '3px 11px',
                  borderRadius: 999,
                  fontWeight: 600,
                }}
              >
                {t}
              </span>
            ))}
            <span style={{ fontSize: 11.5, color: C.sub, background: '#F4F4F6', padding: '3px 11px', borderRadius: 999 }}>
              {totalUnits} 单元 · {totalSteps} 步
            </span>
          </div>

          {/* 试学提示 */}
          <div
            style={{
              background: C.brandSoft,
              borderRadius: 12,
              padding: '11px 14px',
              fontSize: 13,
              color: C.brandDark,
              fontWeight: 600,
              marginBottom: 16,
              lineHeight: 1.6,
            }}
          >
            {done
              ? '✓ 已解锁全部单元，正在为你进入学习…'
              : `可免费试学前 ${meta.freeUnits} 个单元，解锁后全部 ${totalUnits} 个单元永久开放`}
          </div>

          {/* 亮点 */}
          {!done && (
            <ul style={{ listStyle: 'none', margin: '0 0 18px', padding: 0, display: 'grid', gap: 10 }}>
              {(meta.highlights || []).map((h) => (
                <li key={h} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13.5, color: C.text, lineHeight: 1.5 }}>
                  <span
                    style={{
                      flex: '0 0 auto',
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: '#E7F5EF',
                      color: C.green,
                      fontSize: 11,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: 1,
                      fontWeight: 700,
                    }}
                  >
                    ✓
                  </span>
                  {h}
                </li>
              ))}
            </ul>
          )}

          {/* 价格 + CTA */}
          {!done ? (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 30, fontWeight: 800, color: C.brand, lineHeight: 1 }}>
                  {priceLabel(meta)}
                </span>
                <span style={{ fontSize: 12.5, color: C.faint }}>一次购买，永久学习 · 7 天无理由退款</span>
              </div>
              <button
                onClick={handlePay}
                disabled={paying}
                style={{
                  width: '100%',
                  padding: '14px 0',
                  border: 'none',
                  borderRadius: 14,
                  background: paying ? '#A5B4FC' : `linear-gradient(135deg,${C.brand},${C.brandDark})`,
                  color: '#fff',
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: paying ? 'wait' : 'pointer',
                  boxShadow: '0 8px 20px rgba(79,70,229,.28)',
                  transition: 'transform .15s ease, box-shadow .15s ease',
                }}
              >
                {paying ? '支付处理中…' : `立即解锁 ${priceLabel(meta)}`}
              </button>
              <div
                style={{
                  marginTop: 12,
                  background: '#FFFBF0',
                  border: '1px solid #FDE68A',
                  borderRadius: 12,
                  padding: '10px 14px',
                  fontSize: 12.5,
                  color: C.gold,
                  textAlign: 'center',
                  lineHeight: 1.6,
                }}
              >
                开通全站会员，本课及全部付费课程免费学 · 会员功能即将上线
              </div>
            </>
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '18px 0 6px',
                fontSize: 16,
                fontWeight: 700,
                color: C.green,
              }}
            >
              🎉 解锁成功
            </div>
          )}
        </div>
      </div>

      <style>
        {`
          @keyframes pmFade{from{opacity:0}to{opacity:1}}
          @keyframes pmPop{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:none}}
        `}
      </style>
    </div>
  )
}
