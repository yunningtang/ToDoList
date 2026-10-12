import type { DataAdapter } from './types'
import type { Settings } from '../store/types'
import { LocalAdapter } from './localAdapter'
import { HttpAdapter } from './httpAdapter'

export type { DataAdapter, DataSnapshot, Op, Collection, SyncResult } from './types'

/** 根据设置创建数据适配器 */
export function createAdapter(account: Settings['account']): DataAdapter {
  if (account.backend === 'http' && account.serverUrl) return new HttpAdapter(account.serverUrl, account.token)
  return new LocalAdapter()
}
