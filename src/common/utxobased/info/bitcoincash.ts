import * as bitcoin from 'altcoin-js'
import { asCodec, asString } from 'cleaners'
import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { IMAGE_SERVER_URL } from '../../constants'
import { CoinInfo, EngineInfo, PluginInfo } from '../../plugin/types'
import { scriptTemplates } from './scriptTemplates/bitcoincashScriptTemplates'

const currencyInfo: EdgeCurrencyInfo = {
  pluginId: 'bitcoincash',
  walletType: 'wallet:bitcoincash',
  currencyCode: 'BCH',
  displayName: 'Bitcoin Cash',
  denominations: [
    { name: 'BCH', multiplier: '100000000', symbol: '₿' },
    { name: 'mBCH', multiplier: '100000', symbol: 'm₿' },
    { name: 'cash', multiplier: '100', symbol: 'ƀ' }
  ],

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockbookServers: [
      'wss://bch1.trezor.io',
      'wss://bch2.trezor.io',
      'wss://bch3.trezor.io',
      'wss://bch4.trezor.io',
      'wss://bch5.trezor.io'
    ],
    enableCustomServers: false
  },
  customFeeTemplate: [
    {
      type: 'nativeAmount',
      key: 'satPerByte',
      displayName: 'Satoshis Per Byte',
      displayMultiplier: '0'
    }
  ],
  metaTokens: [],

  // Explorers:
  blockExplorer: 'https://blockchair.com/bitcoin-cash/block/%s',
  addressExplorer: 'https://blockchair.com/bitcoin-cash/address/%s',
  transactionExplorer: 'https://blockchair.com/bitcoin-cash/transaction/%s',
  xpubExplorer: 'https://bch1.trezor.io/xpub/%s',

  // Images:
  symbolImage: `${IMAGE_SERVER_URL}/bitcoincash-logo-solo-64.png`,
  symbolImageDarkMono: `${IMAGE_SERVER_URL}/bitcoincash-logo-solo-64.png`
}

const engineInfo: EngineInfo = {
  formats: ['bip44', 'bip32'],
  forks: ['bitcoinsv'],
  gapLimit: 10,
  defaultFee: 10000,
  feeUpdateInterval: 60000,
  simpleFeeSettings: {
    highFee: '20',
    lowFee: '3',
    standardFeeLow: '5',
    standardFeeHigh: '10',
    standardFeeLowAmount: '1000000',
    standardFeeHighAmount: '65000000'
  },
  scriptTemplates,
  asBlockbookAddress: asCodec(
    raw => {
      return asString(raw).split(':')[1]
    },
    address => `bitcoincash:${address}`
  )
}

export const coinInfo: CoinInfo = {
  name: 'bitcoincash',
  segwit: false,
  sighash: bitcoin.Psbt.BCH_SIGHASH_ALL,
  coinType: 145,

  prefixes: {
    messagePrefix: ['\x18Bitcoin Signed Message:\n'],
    wif: [0x80],
    legacyXPriv: [0x0488ade4],
    legacyXPub: [0x0488b21e],
    pubkeyHash: [0x00],
    scriptHash: [0x05],
    cashaddr: ['bitcoincash']
  }
}

export const info: PluginInfo = { currencyInfo, engineInfo, coinInfo }
