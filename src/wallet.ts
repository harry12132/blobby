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
