/**
 * petSkins.js —— 悟空宠物助手皮肤注册表 + 会员判断
 *
 * 皮肤 = 成套素材：站立立像 / 蹬棒腾空立像 / 招手帧(4张) / 筋斗云
 * 会员专属皮肤（vip:true）仅会员可选；非会员在设置页点击时提示开通会员。
 */
import { getPurchasedMap } from './courseAccess'

export const PET_SKINS = {
  default: {
    id: 'default',
    name: '齐天悟空',
    desc: '经典金红战袍 · 白色筋斗云',
    vip: false,
    preview: '/images/ai-assistant/wukong-stand.webp',
    assets: {
      stand: '/images/ai-assistant/wukong-stand.webp',
      hop: '/images/ai-assistant/wukong-hop.webp',
      waves: [
        '/images/ai-assistant/wave-1.webp',
        '/images/ai-assistant/wave-2.webp',
        '/images/ai-assistant/wave-3.webp',
        '/images/ai-assistant/wave-4.webp',
      ],
      cloud: '/images/ai-assistant/cloud-fine.webp',
    },
  },
  golden: {
    id: 'golden',
    name: '金甲威龙',
    desc: '鎏金战甲 · 威风凛凛 · 金色祥云',
    vip: true,
    preview: '/images/ai-assistant/skins/golden-stand.webp',
    assets: {
      stand: '/images/ai-assistant/skins/golden-stand.webp',
      hop: '/images/ai-assistant/skins/golden-hop.webp',
      waves: [
        '/images/ai-assistant/skins/golden-wave-1.webp',
        '/images/ai-assistant/skins/golden-wave-2.webp',
        '/images/ai-assistant/skins/golden-wave-3.webp',
        '/images/ai-assistant/skins/golden-wave-4.webp',
      ],
      cloud: '/images/ai-assistant/skins/golden-cloud.webp',
    },
  },
  flame: {
    id: 'flame',
    name: '烈焰战神',
    desc: '赤炎战衣 · 火焰祥云',
    vip: true,
    preview: '/images/ai-assistant/skins/flame-stand.webp',
    assets: {
      stand: '/images/ai-assistant/skins/flame-stand.webp',
      hop: '/images/ai-assistant/skins/flame-hop.webp',
      waves: [
        '/images/ai-assistant/skins/flame-wave-1.webp',
        '/images/ai-assistant/skins/flame-wave-2.webp',
        '/images/ai-assistant/skins/flame-wave-3.webp',
        '/images/ai-assistant/skins/flame-wave-4.webp',
      ],
      cloud: '/images/ai-assistant/skins/flame-cloud.webp',
    },
  },
}

export const PET_SKIN_LIST = Object.values(PET_SKINS)

/** 全站会员判断：购买记录中存在 kind==='vip'（模拟开通会员） */
export function isVipUser() {
  if (typeof window === 'undefined') return false
  const m = getPurchasedMap()
  return Object.keys(m).some((k) => m[k] && m[k].kind === 'vip')
}

/** 当前皮肤（ui.petSkin 缺省 default；非法 id 回退 default） */
export function resolveSkin(id) {
  return PET_SKINS[id] || PET_SKINS.default
}
