import { dayjs } from './date'
import type { Dayjs } from './date'

/**
 * 农历转换（1900-01-31 ～ 2100-12-31）
 * lunarInfo：每年一个 20 位整数
 *   bit 16     闰月天数（1 = 30 天，0 = 29 天）
 *   bit 15–4   正月～十二月天数（1 = 30 天，0 = 29 天）
 *   bit 3–0    闰月月份（0 = 无闰月）
 */
const LUNAR_INFO = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2, // 1900-1909
  0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977, // 1910-1919
  0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970, // 1920-1929
  0x06566, 0x0d4a0, 0x0ea50, 0x16a95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950, // 1930-1939
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557, // 1940-1949
  0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0, // 1950-1959
  0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0, // 1960-1969
  0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6, // 1970-1979
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570, // 1980-1989
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x05ac0, 0x0ab60, 0x096d5, 0x092e0, // 1990-1999
  0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5, // 2000-2009
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930, // 2010-2019
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530, // 2020-2029
  0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45, // 2030-2039
  0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0, // 2040-2049
  0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0, // 2050-2059
  0x0a2e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4, // 2060-2069
  0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0, // 2070-2079
  0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160, // 2080-2089
  0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252, // 2090-2099
  0x0d520, // 2100
]

const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
const ZODIAC = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪']
export const MONTH_NAMES = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月']
const DAY_NAMES = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
]

/** 24 节气：从小寒开始；按 1900-01-06 02:05 起算的分钟偏移（经典近似公式） */
const TERM_NAMES = [
  '小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨', '立夏', '小满', '芒种', '夏至',
  '小暑', '大暑', '立秋', '处暑', '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至',
]
const TERM_INFO = [
  0, 21208, 42467, 63836, 85337, 107014, 128867, 150921, 173149, 195551, 218072, 240693,
  263343, 285989, 308563, 331033, 353350, 375494, 397447, 419210, 440795, 462224, 483532, 504758,
]

export type LunarFestival = '春节' | '元宵' | '端午' | '中秋' | '重阳' | '除夕'

export interface LunarDate {
  year: number
  /** 1–12 */
  month: number
  /** 1–30 */
  day: number
  isLeap: boolean
  monthName: string
  dayName: string
  ganzhiYear: string
  zodiac: string
  term?: string
  festival?: LunarFestival
}

/** 农历 y 年闰哪个月（0 = 无） */
export function leapMonth(y: number): number {
  return LUNAR_INFO[y - 1900] & 0xf
}
/** 农历 y 年闰月天数 */
export function leapDays(y: number): number {
  return leapMonth(y) ? ((LUNAR_INFO[y - 1900] & 0x10000) ? 30 : 29) : 0
}
/** 农历 y 年 m 月（非闰）天数 */
export function monthDays(y: number, m: number): number {
  return LUNAR_INFO[y - 1900] & (0x10000 >> m) ? 30 : 29
}
/** 农历 y 年总天数 */
export function yearDays(y: number): number {
  let sum = 348
  for (let i = 0x8000; i > 0x8; i >>= 1) sum += LUNAR_INFO[y - 1900] & i ? 1 : 0
  return sum + leapDays(y)
}

export function ganzhiYear(y: number): string {
  return STEMS[((y - 4) % 10 + 10) % 10] + BRANCHES[((y - 4) % 12 + 12) % 12]
}
export function zodiacOf(y: number): string {
  return ZODIAC[((y - 4) % 12 + 12) % 12]
}

const termCache = new Map<number, Map<string, string>>()
/** 某公历年全部节气：'MM-DD' → 名称 */
export function solarTermsOf(year: number): Map<string, string> {
  const cached = termCache.get(year)
  if (cached) return cached
  const map = new Map<string, string>()
  const base = Date.UTC(1900, 0, 6, 2, 5)
  for (let n = 0; n < 24; n++) {
    const ms = base + 31556925974.7 * (year - 1900) + TERM_INFO[n] * 60000
    const d = new Date(ms)
    const key = `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
    map.set(key, TERM_NAMES[n])
  }
  termCache.set(year, map)
  return map
}

export function solarTerm(date: string | Dayjs): string | undefined {
  const d = dayjs(date)
  return solarTermsOf(d.year()).get(d.format('MM-DD'))
}

const EPOCH = Date.UTC(1900, 0, 31)

/** 公历 → 农历；超出 1900-01-31 ～ 2100-12-31 时返回 null */
export function toLunar(date: string | Dayjs): LunarDate | null {
  const d = dayjs(date)
  if (!d.isValid()) return null
  let offset = Math.floor((Date.UTC(d.year(), d.month(), d.date()) - EPOCH) / 86400000)
  if (offset < 0) return null

  let year = 1900
  for (; year <= 2100; year++) {
    const days = yearDays(year)
    if (offset < days) break
    offset -= days
  }
  if (year > 2100) return null

  const leap = leapMonth(year)
  let isLeap = false
  let month = 1
  for (; month <= 12; month++) {
    // 先走正常月份
    let days = monthDays(year, month)
    if (offset < days) {
      isLeap = false
      break
    }
    offset -= days
    // 再走闰月（闰 m 月紧跟在 m 月之后）
    if (leap === month) {
      days = leapDays(year)
      if (offset < days) {
        isLeap = true
        break
      }
      offset -= days
    }
  }
  const day = offset + 1

  const out: LunarDate = {
    year,
    month,
    day,
    isLeap,
    monthName: (isLeap ? '闰' : '') + MONTH_NAMES[month - 1],
    dayName: DAY_NAMES[day - 1] ?? '',
    ganzhiYear: ganzhiYear(year),
    zodiac: zodiacOf(year),
  }
  const term = solarTermsOf(d.year()).get(d.format('MM-DD'))
  if (term) out.term = term
  if (!isLeap) {
    if (month === 1 && day === 1) out.festival = '春节'
    else if (month === 1 && day === 15) out.festival = '元宵'
    else if (month === 5 && day === 5) out.festival = '端午'
    else if (month === 8 && day === 15) out.festival = '中秋'
    else if (month === 9 && day === 9) out.festival = '重阳'
    else if (month === 12 && day === monthDays(year, 12) && leap !== 12) out.festival = '除夕'
  }
  return out
}

/** 日历格子里的短标签：节日 > 节气 > 初一显示月名 > 日名；accent 表示应高亮 */
export function lunarCellLabel(date: string | Dayjs): { text: string; accent: boolean } {
  const l = toLunar(date)
  if (!l) return { text: '', accent: false }
  if (l.festival) return { text: l.festival, accent: true }
  if (l.term) return { text: l.term, accent: true }
  if (l.day === 1) return { text: l.monthName, accent: false }
  return { text: l.dayName, accent: false }
}

/** 完整文案：'农历八月十五' / '农历闰六月初一' */
export function lunarText(date: string | Dayjs): string {
  const l = toLunar(date)
  return l ? `农历${l.monthName}${l.dayName}` : ''
}
