// Typescript translation from original code in edge-currency-bitcoin

import { asObject } from 'cleaners'
import { navigateDisklet } from 'disklet'
import { EdgeIo, EdgeLog } from 'edge-core-js/types'
import { makeMemlet, Memlet } from 'memlet'

import { UtxoEngineState } from '../utxobased/engine/makeUtxoEngineState'
import { asServerInfoCache, ServerCache, ServerInfoCache } from './serverCache'

const InfoServerUrl = 'https://info1.edge.app/v1/blockBook/'

/** A JSON object (as opposed to an array or primitive). */
interface JsonObject {
  [name: string]: unknown
}

export interface CurrencySettings {
  customFeeSettings: string[]
  blockBookServers: string[]
  disableFetchingServers?: boolean
}

/**
 * This object holds the plugin-wide per-currency caches.
 * Engine plugins are responsible for keeping it up to date.
 */
export interface PluginStateSettings {
  io: EdgeIo
  defaultSettings: CurrencySettings
  currencyCode: string
  pluginId: string
  log: EdgeLog
}

export class PluginState extends ServerCache {
  // On-disk server information:
  // serverCache: ServerCache

  /**
   * Begins notifying the engine of state changes. Used at connection time.
   */
  addEngine(engineState: UtxoEngineState): void {
    this.engines.push(engineState)
  }

  /**
   * Stops notifying the engine of state changes. Used at disconnection time.
   */
  removeEngine(engineState: UtxoEngineState): void {
    this.engines = this.engines.filter(engine => engine !== engineState)
  }

  dumpData(): JsonObject {
    return {
      'pluginState.servers_': this.servers_
    }
  }

  // ------------------------------------------------------------------------
  // Private stuff
  // ------------------------------------------------------------------------
  io: EdgeIo
  disableFetchingServers: boolean
  defaultServers: string[]
  currencyCode: string

  engines: UtxoEngineState[]
  memlet: Memlet

  serverCacheJson: ServerInfoCache
  pluginId: string

  constructor({
    io,
    defaultSettings,
    currencyCode,
    pluginId,
    log
  }: PluginStateSettings) {
    super(log)
    this.io = io
    this.defaultServers = defaultSettings.blockBookServers
    this.disableFetchingServers = !!(
      defaultSettings.disableFetchingServers ?? false
    )
    this.currencyCode = currencyCode
    this.engines = []
    this.memlet = makeMemlet(navigateDisklet(io.disklet, 'plugins/' + pluginId))

    this.pluginId = pluginId
    this.serverCacheJson = {}
  }

  async load(): Promise<PluginState> {
    try {
      this.serverCacheJson = asServerInfoCache(
        await this.memlet.getJson('serverCache.json')
      )
    } catch (e) {
      this.log(
        `${this.pluginId}: Failed to load server cache: ${JSON.stringify(e)}`
      )
    }

    // Fetch servers in the background:
    this.fetchServers().catch(e => {
      this.log(`${this.pluginId} - ${JSON.stringify(e.toString())}`)
    })

    return this
  }

  async clearCache(): Promise<void> {
    this.clearServerCache()
    this.serverCacheDirty = true
    await this.saveServerCache()
    await this.fetchServers()
  }

  async saveServerCache(): Promise<void> {
    // this.printServerCache()
    if (this.serverCacheDirty) {
      try {
        await this.memlet.setJson('serverCache.json', this.servers_)
        this.serverCacheDirty = false
        this.cacheLastSave_ = Date.now()
        this.log(`${this.pluginId} - Saved server cache`)
      } catch (e) {
        this.log(`${this.pluginId} - ${JSON.stringify(e.toString())}`)
      }
    }
  }

  dirtyServerCache(serverUrl: string): void {
    this.serverCacheDirty = true
    for (const engine of this.engines) {
      if (engine.processedPercent === 1) {
        for (const uri of engine.getServerList()) {
          if (uri === serverUrl) {
            this.saveServerCache().catch(e => {
              this.log(`${this.pluginId} - ${JSON.stringify(e.toString())}`)
            })
            return
          }
        }
      }
    }
  }

  async fetchServers(): Promise<void> {
    const { io } = this
    let serverList = this.defaultServers
    if (!this.disableFetchingServers) {
      this.log(`${this.pluginId} - GET ${InfoServerUrl}`)
      const serverListResponse = await io
        .fetch(InfoServerUrl)
        .then(async response => {
          if (!response.ok) {
            this.log(
              `${this.pluginId} - Fetching ${InfoServerUrl} failed with ${response.status}`
            )
            return
          }
          return await response.json()
        })
        .catch(err => {
          this.log(
            `${this.pluginId} - Fetching ${InfoServerUrl} failed: ${err.message}`
          )
        })
      const remoteServerList: string[] = serverListResponse[this.currencyCode]

      serverList =
        remoteServerList.map(
          url => url.replace('https', 'wss') + '/websocket'
        ) ?? this.defaultServers
    }
    this.serverCacheLoad(this.serverCacheJson, serverList)
    await this.saveServerCache()

    // Tell the engines about the new servers:
    for (const engine of this.engines) {
      engine.refillServers()
    }
  }

  async updateServers(settings: JsonObject): Promise<void> {
    const { blockBookServers, disableFetchingServers } = settings
    if (typeof disableFetchingServers === 'boolean') {
      this.disableFetchingServers = disableFetchingServers
    }
    if (Array.isArray(blockBookServers)) {
      this.defaultServers = blockBookServers
    }
    const engines = []
    const disconnects = []
    for (const engine of this.engines) {
      engines.push(engine)
      engine.setServerList([])
      disconnects.push(engine.stop())
    }
    await Promise.all(disconnects)
    this.clearServerCache()
    this.serverCacheJson = {}
    this.serverCacheDirty = true
    await this.saveServerCache()
    await this.fetchServers()
    for (const engine of engines) {
      await engine.stop()
    }
  }
}
