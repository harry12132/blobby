export type Eip1193Provider = {
  request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>
  on?: (event: string, handler: (...args: unknown[]) => void) => void
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void
}
declare global { interface Window { ethereum?: Eip1193Provider } }
export const SEPOLIA_CHAIN_ID = '0xaa36a7'
export function getInjectedProvider() {
  return typeof window !== 'undefined' ? window.ethereum : undefined
}
export async function connectToSepolia() {
  const provider = getInjectedProvider()
  if (!provider) throw new Error('No browser wallet found. Install Rabby or MetaMask, then try again.')
  const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[]
  if (!accounts?.[0]) throw new Error('The wallet did not return an account.')
  let chainId = await provider.request({ method: 'eth_chainId' }) as string
  if (chainId.toLowerCase() !== SEPOLIA_CHAIN_ID) {
    try {
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: SEPOLIA_CHAIN_ID }] })
    } catch (error) {
      if ((error as { code?: number }).code !== 4902) throw error
      await provider.request({ method: 'wallet_addEthereumChain', params: [{
        chainId: SEPOLIA_CHAIN_ID, chainName: 'Sepolia Testnet',
        nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: ['https://ethereum-sepolia-rpc.publicnode.com'],
        blockExplorerUrls: ['https://sepolia.etherscan.io'],
      }] })
    }
    chainId = await provider.request({ method: 'eth_chainId' }) as string
  }
  if (chainId.toLowerCase() !== SEPOLIA_CHAIN_ID) throw new Error('Switch your wallet to Sepolia testnet to use Blobby.')
  return { provider, address: accounts[0], chainId }
}
export async function readNativeBalance(address: string) {
  const provider = getInjectedProvider()
  if (!provider) throw new Error('Wallet provider disconnected.')
  const result = await provider.request({ method: 'eth_getBalance', params: [address, 'latest'] }) as string
  const wei = BigInt(result)
  const whole = wei / 10n ** 18n
  const fraction = (wei % 10n ** 18n).toString().padStart(18, '0').slice(0, 6)
  return whole.toString() + '.' + fraction
}
export async function fetchEthMarketPrice() {
  const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd&include_24hr_change=true')
  if (!response.ok) throw new Error('Price data is temporarily unavailable.')
  const data = await response.json() as { ethereum?: { usd?: number; usd_24h_change?: number } }
  if (!data.ethereum?.usd) throw new Error('Price provider returned incomplete data.')
  return { usd: data.ethereum.usd, change24h: data.ethereum.usd_24h_change ?? 0 }
}
export function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)
}

export async function sendSepoliaEth(from: string, to: string, amount: string) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(to)) throw new Error('Enter a valid 0x wallet address.')
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(amount)) throw new Error('Enter a valid ETH amount with up to 18 decimal places.')
  const provider = getInjectedProvider()
  if (!provider) throw new Error('Connect your browser wallet first.')
  const chainId = await provider.request({ method: 'eth_chainId' }) as string
  if (chainId.toLowerCase() !== SEPOLIA_CHAIN_ID) throw new Error('Transactions are restricted to Sepolia testnet.')
  const [whole, fraction = ''] = amount.split('.')
  const wei = BigInt(whole) * 10n ** 18n + BigInt((fraction + '0'.repeat(18)).slice(0, 18))
  if (wei <= 0n) throw new Error('Amount must be greater than zero.')
  const hash = await provider.request({
    method: 'eth_sendTransaction',
    params: [{ from, to, value: '0x' + wei.toString(16) }],
  }) as string
  return hash
}


export type SepoliaTransaction = {
  hash: string
  from: { hash: string }
  to: { hash: string } | null
  value: string
  timestamp: string
  status: string
  method: string | null
  block: number
}
export type SepoliaTokenBalance = {
  token: { address_hash: string; name: string; symbol: string; decimals: string; exchange_rate: string | null; type: string }
  value: string
}
const BLOCKSCOUT_API = 'https://eth-sepolia.blockscout.com/api/v2'
async function blockscout<T>(path: string): Promise<T> {
  const response = await fetch(BLOCKSCOUT_API + path)
  if (!response.ok) throw new Error('Sepolia explorer data is temporarily unavailable.')
  return response.json() as Promise<T>
}
export async function readSepoliaTransactions(address: string): Promise<SepoliaTransaction[]> {
  const data = await blockscout<{ items?: SepoliaTransaction[] }>(`/addresses/${address}/transactions`)
  return data.items ?? []
}
export async function readSepoliaTokenBalances(address: string): Promise<SepoliaTokenBalance[]> {
  const data = await blockscout<SepoliaTokenBalance[]>(`/addresses/${address}/token-balances`)
  return Array.isArray(data) ? data.filter(item => item.token?.symbol && item.token?.decimals !== undefined) : []
}
export function formatTokenAmount(value: string, decimals: string) {
  const precision = Math.min(Math.max(Number(decimals) || 0, 0), 36)
  const raw = BigInt(value || '0')
  const divisor = 10n ** BigInt(precision)
  const whole = raw / divisor
  const fraction = (raw % divisor).toString().padStart(precision, '0').slice(0, 5).replace(/0+$/, '')
  return fraction ? whole.toString() + '.' + fraction : whole.toString()
}
export function formatSepoliaDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
