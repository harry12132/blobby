import { useEffect, useMemo, useState } from 'react'
import { connectToSepolia, fetchEthMarketPrice, formatUsd, getInjectedProvider, readNativeBalance, readSepoliaTransactions, readSepoliaTokenBalances, formatTokenAmount, formatSepoliaDate, SEPOLIA_CHAIN_ID, sendSepoliaEth } from './wallet'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowDownLeft, ArrowDownUp, ArrowLeftRight, ArrowUpRight, Bell, Check,
  ChevronDown, ChevronRight, CircleHelp, Copy, Disc3, Grid2X2, Heart,
  Home, Image, LayoutGrid, Plus, Search, Settings2, ShieldCheck, Sparkles,
  Wallet, X, Clock3, ExternalLink
} from 'lucide-react'

type Tab = 'Home' | 'Explore' | 'Collections' | 'Activity' | 'Wallet'
type Asset = { name: string; ticker: string; amount: string; value: string; change: string; icon: string; tone: string }
type Drop = { id: number; title: string; creator: string; type: string; price: string; art: string; edition: string; likes: string; description?: string; payoutAddress?: string }
type CreatorProfile = { displayName: string; handle: string; role: string; bio: string; payoutAddress: string }
type WalletTransaction = { hash: string; from: { hash: string }; to: { hash: string } | null; value: string; timestamp: string; status: string; method: string | null; block: number }
type WalletToken = { token: { address_hash: string; name: string; symbol: string; decimals: string; exchange_rate: string | null; type: string }; value: string }
const assets: Asset[] = [
  { name: 'Ethereum', ticker: 'ETH', amount: '0.8421', value: '$2,841.62', change: '+3.24%', icon: 'Ξ', tone: 'eth' },
  { name: 'Solana', ticker: 'SOL', amount: '12.50', value: '$1,937.50', change: '+5.81%', icon: '◎', tone: 'sol' },
  { name: 'Bitcoin', ticker: 'BTC', amount: '0.0184', value: '$1,204.18', change: '+1.12%', icon: '₿', tone: 'btc' },
]
const drops: Drop[] = [
  { id: 1, title: 'Soft Signals', creator: 'studio.morrow', type: 'Digital art', price: '0.08 ETH', art: 'sunset', edition: '12 / 50', likes: '2.4k' },
  { id: 2, title: 'After Hours Vol. 1', creator: 'nina.wav', type: 'Music', price: '0.025 ETH', art: 'night', edition: 'Open edition', likes: '1.8k' },
  { id: 3, title: 'Objects from Elsewhere', creator: 'oddobjects', type: '3D objects', price: '0.04 ETH', art: 'object', edition: '31 / 100', likes: '986' },
]
const activity = [
  { title: 'Received ETH', detail: 'From 0x84...a91c · Ethereum', amount: '+0.12 ETH', value: '+$404.80', time: '2h ago', incoming: true },
  { title: 'Collected Soft Signals', detail: 'studio.morrow · Digital art', amount: '−0.08 ETH', value: '−$270.40', time: 'Yesterday', incoming: false },
  { title: 'Swapped SOL for ETH', detail: 'Jupiter · Solana', amount: '+0.16 ETH', value: '+$540.10', time: 'Mon, 2 Nov', incoming: true },
]
const creators: { name: string; role: string; followers: string; initials: string; tone: string }[] = [
  { name: 'nina.wav', role: 'Music producer', followers: '18.2k', initials: 'N', tone: 'pink' },
  { name: 'studio.morrow', role: 'Visual artist', followers: '9.6k', initials: 'M', tone: 'lime' },
  { name: 'oddobjects', role: '3D artist', followers: '6.1k', initials: 'O', tone: 'blue' },
]
const nav: { label: Tab; icon: typeof Home }[] = [
  { label: 'Home', icon: Home }, { label: 'Explore', icon: Search }, { label: 'Collections', icon: Grid2X2 },
  { label: 'Activity', icon: Clock3 }, { label: 'Wallet', icon: Wallet },
]
function App() {
  const [walletAddress, setWalletAddress] = useState('')
  const [ethBalance, setEthBalance] = useState('')
  const [ethPrice, setEthPrice] = useState<number | null>(null)
  const [ethChange, setEthChange] = useState<number | null>(null)
  const [walletBusy, setWalletBusy] = useState(false)
  const [sendAddress, setSendAddress] = useState('')
  const [sendAmount, setSendAmount] = useState('')
  const [sendBusy, setSendBusy] = useState(false)
  const [walletError, setWalletError] = useState('')
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [tokens, setTokens] = useState<WalletToken[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [creatorProfile, setCreatorProfile] = useState<CreatorProfile>(() => {
    try { return JSON.parse(localStorage.getItem('blobby-creator-profile-v1') || 'null') || { displayName: '', handle: '', role: '', bio: '', payoutAddress: '' } }
    catch { return { displayName: '', handle: '', role: '', bio: '', payoutAddress: '' } }
  })
  const [publishedDrops, setPublishedDrops] = useState<Drop[]>(() => {
    try { return JSON.parse(localStorage.getItem('blobby-published-drops-v1') || '[]') as Drop[] }
    catch { return [] }
  })
  const [dropTitle, setDropTitle] = useState('')
  const [dropDescription, setDropDescription] = useState('')
  const [dropType, setDropType] = useState('Digital art')
  const [dropPrice, setDropPrice] = useState('0.001')
  const [profileName, setProfileName] = useState(creatorProfile.displayName)
  const [profileHandle, setProfileHandle] = useState(creatorProfile.handle)
  const [profileRole, setProfileRole] = useState(creatorProfile.role)
  const [profileBio, setProfileBio] = useState(creatorProfile.bio)
  const [profilePayout, setProfilePayout] = useState(creatorProfile.payoutAddress)
  const shortAddress = walletAddress ? walletAddress.slice(0, 6) + '…' + walletAddress.slice(-4) : ''
  const portfolioValue = walletAddress ? (ethBalance && ethPrice !== null ? formatUsd(Number(ethBalance) * ethPrice) : 'Loading…') : '$5,983.30'
  const sendTestnetEth = async () => {
    if (!walletAddress) {
      notify('Connect a wallet first.')
      return
    }
    setSendBusy(true)
    try {
      const hash = await sendSepoliaEth(walletAddress, sendAddress.trim(), sendAmount.trim())
      closeModal()
      setSendAddress('')
      setSendAmount('')
      notify('Testnet transaction submitted: ' + hash.slice(0, 12) + '…')
      window.open('https://sepolia.etherscan.io/tx/' + hash, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => void refreshWallet(), 5000)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Transaction was not submitted.')
    } finally {
      setSendBusy(false)
    }
  }
  const connectWallet = async () => {
    setWalletBusy(true)
    setWalletError('')
    try {
      const connected = await connectToSepolia()
      setWalletAddress(connected.address)
      setEthBalance(await readNativeBalance(connected.address))
      notify('Connected to Sepolia testnet.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not connect wallet.'
      setWalletError(message)
      notify(message)
    } finally {
      setWalletBusy(false)
    }
  }
  const refreshWallet = async () => {
    if (!walletAddress) return
    try {
      const [balance, market] = await Promise.all([readNativeBalance(walletAddress), fetchEthMarketPrice()])
      setEthBalance(balance)
      setEthPrice(market.usd)
      setEthChange(market.change24h)
      setHistoryLoading(true)
      const [historyResult, tokenResult] = await Promise.allSettled([
        readSepoliaTransactions(walletAddress), readSepoliaTokenBalances(walletAddress)
      ])
      if (historyResult.status === 'fulfilled') setTransactions(historyResult.value)
      if (tokenResult.status === 'fulfilled') setTokens(tokenResult.value)
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : 'Could not refresh wallet.')
    } finally {
      setHistoryLoading(false)
    }
  }
  useEffect(() => {
    fetchEthMarketPrice().then(market => {
      setEthPrice(market.usd)
      setEthChange(market.change24h)
    }).catch(() => undefined)
  }, [])
  useEffect(() => {
    if (walletAddress) void refreshWallet()
  }, [walletAddress])
  useEffect(() => {
    const provider = getInjectedProvider()
    if (!provider) return
    const accountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[]
      setWalletAddress(accounts?.[0] ?? '')
      if (!accounts?.length) setEthBalance('')
    }
    const chainChanged = (...args: unknown[]) => {
      if ((args[0] as string)?.toLowerCase() !== SEPOLIA_CHAIN_ID) {
        setWalletAddress('')
        setEthBalance('')
        setWalletError('Blobby currently supports Sepolia testnet only.')
      }
    }
    provider.on?.('accountsChanged', accountsChanged)
    provider.on?.('chainChanged', chainChanged)
    return () => {
      provider.removeListener?.('accountsChanged', accountsChanged)
      provider.removeListener?.('chainChanged', chainChanged)
    }
  }, [])
  const [tab, setTab] = useState<Tab>('Home')
  const [modal, setModal] = useState<'send' | 'receive' | 'swap' | 'collect' | 'profile' | 'publish' | null>(null)
  const [selectedDrop, setSelectedDrop] = useState<Drop | null>(null)
  const [hidden, setHidden] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('For you')
  const [liked, setLiked] = useState<number[]>([2])
  const [following, setFollowing] = useState<string[]>([])
  const [toast, setToast] = useState('')
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2600) }
  const allDrops = useMemo(() => [...publishedDrops, ...drops], [publishedDrops])
  const filteredDrops = useMemo(() => allDrops.filter(d =>
    (filter === 'For you' || filter === 'All' || d.type.toLowerCase().includes(filter.toLowerCase())) &&
    (d.title + d.creator).toLowerCase().includes(query.toLowerCase())
  ), [allDrops, filter, query])
  const money = (value: string) => hidden ? '••••••' : value
  const saveCreatorProfile = () => {
    const handle = profileHandle.trim().replace(/^@/, '').replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase()
    if (!profileName.trim() || !handle) { notify('Add a display name and a valid handle.'); return }
    if (profilePayout.trim() && !/^0x[a-fA-F0-9]{40}$/.test(profilePayout.trim())) { notify('Payout address must be a valid 0x address.'); return }
    const next = { displayName: profileName.trim(), handle, role: profileRole.trim(), bio: profileBio.trim(), payoutAddress: profilePayout.trim() }
    setCreatorProfile(next)
    localStorage.setItem('blobby-creator-profile-v1', JSON.stringify(next))
    closeModal()
    notify('Creator profile saved on this device.')
  }
  const publishDrop = () => {
    if (!creatorProfile.displayName || !creatorProfile.payoutAddress) { notify('Save a creator profile and Sepolia payout address first.'); return }
    if (!dropTitle.trim() || !/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(dropPrice) || Number(dropPrice) <= 0) { notify('Enter a title and a valid test ETH price.'); return }
    const next: Drop = { id: Date.now(), title: dropTitle.trim(), creator: '@' + creatorProfile.handle, type: dropType, price: dropPrice + ' ETH', art: dropType === 'Music' ? 'night' : dropType === '3D objects' ? 'object' : 'sunset', edition: 'Open edition', likes: '0', description: dropDescription.trim(), payoutAddress: creatorProfile.payoutAddress }
    const updated = [next, ...publishedDrops]
    setPublishedDrops(updated)
    localStorage.setItem('blobby-published-drops-v1', JSON.stringify(updated))
    setDropTitle(''); setDropDescription('')
    closeModal(); setTab('Explore')
    notify('Drop published locally. It is not on-chain.')
  }
  const buyDrop = async (drop: Drop) => {
    if (!walletAddress) { notify('Connect your Sepolia wallet first.'); return }
    if (!drop.payoutAddress) { notify('This demo drop has no configured testnet payout address.'); return }
    const amount = drop.price.replace(/\\s*ETH$/i, '').trim()
    try {
      const hash = await sendSepoliaEth(walletAddress, drop.payoutAddress, amount)
      closeModal()
      notify('Testnet purchase submitted. Waiting for confirmation.')
      window.open('https://sepolia.etherscan.io/tx/' + hash, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => void refreshWallet(), 7000)
    } catch (error) { notify(error instanceof Error ? error.message : 'Purchase was not submitted.') }
  }
  const closeModal = () => { setModal(null); setSelectedDrop(null) }
  const title = tab === 'Home' ? 'Your world, in one place.' : tab === 'Explore' ? 'Find your people.' : tab === 'Collections' ? 'Things worth keeping.' : tab === 'Activity' ? 'The little details.' : 'Your money, made simple.'
  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand" onClick={() => setTab('Home')} aria-label="Blobby home">
        <span className="brand-mark"><i/><i/><i/></span><span>blobby<span className="brand-period">.</span></span>
      </button>
      <div className="nav-caption">YOUR SPACE</div>
      <nav className="nav-list">{nav.map(item => <button key={item.label} className={tab === item.label ? 'nav-link active' : 'nav-link'} onClick={() => setTab(item.label)}><item.icon size={18}/><span>{item.label}</span>{item.label === 'Activity' && <span className="nav-count">3</span>}</button>)}</nav>
      <div className="nav-caption side-caption">YOUR CORNER</div>
      <button className="nav-link" onClick={() => notify('Saved drops are coming soon.')}><Heart size={18}/><span>Saved</span></button>
      <button className="nav-link" onClick={() => notify('Communities are coming soon.')}><Disc3 size={18}/><span>Communities</span></button>
      <div className="sidebar-bottom">
        <div className="sidebar-promo"><div className="promo-orb"/><span>GOOD THINGS<br/>ARE COLLECTED.</span><Sparkles size={17}/></div>
        <button className="profile-switch" onClick={() => {setProfileName(creatorProfile.displayName);setProfileHandle(creatorProfile.handle);setProfileRole(creatorProfile.role);setProfileBio(creatorProfile.bio);setProfilePayout(creatorProfile.payoutAddress);setModal('profile')}}><div className="user-avatar">{creatorProfile.displayName ? creatorProfile.displayName.slice(0,1).toUpperCase() : 'H'}</div><span><strong>{creatorProfile.displayName || 'Your profile'}</strong><small>{creatorProfile.handle ? '@' + creatorProfile.handle : 'Set up creator profile'}</small></span><Settings2 size={17}/></button>
      </div>
    </aside>
    <main className="main-area">
      <header className="topbar">
        <div className="topbar-left"><span className="status-dot"/><span>THE INTERNET, COLLECTED.</span></div>
        <div className="topbar-right">
          <label className="search-field"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search anything..." /><kbd>⌘ K</kbd></label>
          <button className="top-icon" onClick={() => notify('You’re all caught up.')} aria-label="Notifications"><Bell size={18}/><i/></button>
          <button className="network-select" onClick={walletAddress ? () => void refreshWallet() : () => void connectWallet()} disabled={walletBusy}><span className="eth-dot"/>{walletBusy ? 'Connecting…' : walletAddress ? shortAddress : 'Connect wallet'}<ChevronDown size={14}/></button>
        </div>
      </header>
      <div className="page-wrap">
        <div className="page-intro"><div><div className="overline"><span/> {tab === 'Home' ? 'TUESDAY, NOVEMBER 3' : 'WELCOME TO BLOBBY'}</div><h1>{title}</h1><p>{tab === 'Home' ? 'Your assets, your collections, your corner of the internet.' : tab === 'Explore' ? 'Discover independent creators and the things they make.' : tab === 'Collections' ? 'A home for the digital things you love.' : tab === 'Activity' ? 'A clear, human-readable history of your wallet.' : 'A clearer view of what you own.'}</p></div><div className="intro-art" aria-hidden="true"><span className="intro-blob blob-a"/><span className="intro-blob blob-b"/><span className="intro-blob blob-c"/><b>✳</b><i>MAKE<br/>ROOM.</i></div></div>
        {tab === 'Home' && <>
          <section className="hero-grid">
            <div className="portfolio-card">
              <div className="portfolio-top"><span><span className="live-dot"/> TOTAL PORTFOLIO</span><button onClick={() => setHidden(!hidden)}>{hidden ? 'SHOW' : 'HIDE'} BALANCE</button></div>
              <div className="portfolio-number">{money(portfolioValue)} <span className="portfolio-change">{walletAddress && ethChange !== null ? (ethChange >= 0 ? '↗ ' : '↘ ') + Math.abs(ethChange).toFixed(2) + '%' : 'DEMO'}</span></div>
              <div className="portfolio-caption">{walletAddress ? 'Sepolia testnet · ' + (ethPrice ? 'ETH ' + formatUsd(ethPrice) : 'Loading ETH price…') : 'Sample portfolio · connect a wallet for live testnet data'}</div>
              {!walletAddress && <><svg className="portfolio-chart" viewBox="0 0 600 112" preserveAspectRatio="none" aria-label="Illustrative portfolio chart"><defs><linearGradient id="chartArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c9f58b" stopOpacity=".26"/><stop offset="1" stopColor="#c9f58b" stopOpacity="0"/></linearGradient></defs><path d="M0 88 C30 83 35 68 65 76 S105 91 130 61 S170 68 195 48 S230 61 258 45 S290 58 320 33 S360 49 388 26 S425 43 455 22 S500 35 530 16 S570 26 600 7 L600 112 L0 112Z" fill="url(#chartArea)"/><path d="M0 88 C30 83 35 68 65 76 S105 91 130 61 S170 68 195 48 S230 61 258 45 S290 58 320 33 S360 49 388 26 S425 43 455 22 S500 35 530 16 S570 26 600 7" fill="none" stroke="#c9f58b" strokeWidth="2.5" strokeLinecap="round"/></svg>
              <div className="chart-labels"><span>7 DAYS</span><span>1 NOV</span><span>NOW</span></div></>}
              <div className="portfolio-decoration"><span/><span/><span/></div>
            </div>
            <div className="action-card"><div className="card-heading"><span>QUICK ACTIONS</span><span className="heading-spark">✳</span></div><div className="action-grid">
              <button onClick={() => setModal('send')}><span className="action-icon action-send"><ArrowUpRight size={19}/></span><strong>Send</strong><small>Move assets</small></button>
              <button onClick={() => setModal('receive')}><span className="action-icon action-receive"><ArrowDownLeft size={19}/></span><strong>Receive</strong><small>Get paid</small></button>
              <button onClick={() => setModal('swap')}><span className="action-icon action-swap"><ArrowLeftRight size={19}/></span><strong>Swap</strong><small>Trade assets</small></button>
              <button onClick={() => setTab('Explore')}><span className="action-icon action-explore"><Plus size={19}/></span><strong>Explore</strong><small>Find a drop</small></button>
            </div><div className="action-foot"><ShieldCheck size={14}/> Transactions are simulated in this preview.</div></div>
          </section>
          <section className="content-grid">
            <div className="panel assets-panel"><div className="section-head"><div><div className="overline"><span/> YOUR MONEY</div><h2>Assets<span>.</span></h2></div><button className="subtle-link" onClick={() => setTab('Wallet')}>All assets <ChevronRight size={15}/></button></div>
              <div className="asset-table">{(walletAddress ? [{ ...assets[0], amount: ethBalance || '0', value: ethPrice !== null ? formatUsd(Number(ethBalance || 0) * ethPrice) : 'Loading…', change: ethChange !== null ? (ethChange >= 0 ? '+' : '') + ethChange.toFixed(2) + '%' : '—' }] : assets).map((a, i) => <div className="asset-item" key={a.ticker}><div className={'asset-symbol '+a.tone}>{a.icon}</div><div className="asset-title"><strong>{a.name}</strong><small>{a.ticker} <span>·</span> {i === 0 ? 'Ethereum' : i === 1 ? 'Solana' : 'Bitcoin'}</small></div><div className="asset-quantity"><strong>{money(a.amount + ' ' + a.ticker)}</strong><small>{money(a.value)}</small></div><span className="asset-performance">{a.change}</span><ChevronRight className="asset-chevron" size={16}/></div>)}</div>
              <div className="demo-note"><ShieldCheck size={15}/> {walletAddress ? 'Live Sepolia balance · read-only wallet connection.' : 'Sample balances only. Connect Rabby or MetaMask to view your Sepolia testnet balance.'}</div>
            </div>
            <div className="panel activity-panel"><div className="section-head"><div><div className="overline"><span/> RECENT MOVES</div><h2>Activity<span>.</span></h2></div><button className="subtle-link" onClick={() => setTab('Activity')}>See all <ChevronRight size={15}/></button></div>
              <div className="activity-list">{walletAddress ? historyLoading ? <div className="wallet-history-empty">Loading Sepolia transaction history…</div> : transactions.length ? transactions.slice(0,8).map((tx) => {
                const incoming = tx.to?.hash?.toLowerCase() === walletAddress.toLowerCase()
                const amount = formatTokenAmount(tx.value, '18')
                return <div className="activity-item" key={tx.hash}><div className={incoming ? 'activity-icon incoming' : 'activity-icon outgoing'}>{incoming ? <ArrowDownLeft size={17}/> : <ArrowUpRight size={17}/>}</div><div className="activity-copy"><strong>{incoming ? 'Received ETH' : 'Sent ETH'}</strong><small>{incoming ? 'From ' + tx.from.hash.slice(0,6) + '…' + tx.from.hash.slice(-4) : 'To ' + (tx.to?.hash ? tx.to.hash.slice(0,6) + '…' + tx.to.hash.slice(-4) : 'contract')} · <a href={'https://sepolia.etherscan.io/tx/' + tx.hash} target="_blank" rel="noreferrer">View transaction</a></small></div><div className="activity-amount"><strong className={incoming ? 'amount-in' : 'amount-out'}>{incoming ? '+' : '−'}{amount} ETH</strong><small>{formatSepoliaDate(tx.timestamp)}</small></div></div>
              }) : <div className="wallet-history-empty">{walletAddress ? 'No Sepolia transactions found yet.' : 'Connect your wallet to load transaction history.'}</div>} : activity.slice(0,3).map((item,i)=><div className="activity-item" key={item.title}><div className={item.incoming?'activity-icon incoming':'activity-icon outgoing'}>{item.incoming?<ArrowDownLeft size={17}/>:<ArrowUpRight size={17}/>}</div><div className="activity-copy"><strong>{item.title}</strong><small>{item.detail}</small></div><div className="activity-amount"><strong className={item.incoming?'amount-in':'amount-out'}>{item.amount}</strong><small>{item.time}</small></div></div>)}</div>
            </div>
          </section>
          <section className="discover-section"><div className="section-head"><div><div className="overline"><span/> MADE BY PEOPLE, NOT ALGORITHMS</div><h2>Fresh from the internet<span>.</span></h2></div><button className="subtle-link" onClick={() => setTab('Explore')}>Explore all <ExternalLink size={14}/></button></div><div className="drop-grid">{allDrops.map((drop,i)=><DropCard key={drop.id} drop={drop} liked={liked.includes(drop.id)} onLike={() => setLiked(old=>old.includes(drop.id)?old.filter(x=>x!==drop.id):[...old,drop.id])} onOpen={() => setSelectedDrop(drop)}/>)}</div></section>
        </>}
        {tab === 'Wallet' && <><div className="wallet-overview"><div className="wallet-total-card"><span>{walletAddress ? 'SEPOLIA TESTNET VALUE' : 'TOTAL WALLET VALUE · DEMO'}</span><strong>{money(portfolioValue)}</strong><small>{walletAddress ? shortAddress + ' · ' + (ethPrice ? 'ETH ' + formatUsd(ethPrice) : 'Loading price…') : 'Connect a browser wallet for live testnet data'}</small></div><div className="wallet-quick"><button onClick={() => setModal('send')}><ArrowUpRight/>Send</button><button onClick={() => setModal('receive')}><ArrowDownLeft/>Receive</button><button onClick={() => setModal('swap')}><ArrowLeftRight/>Swap</button></div></div><div className="panel full-panel"><div className="section-head"><div><div className="overline"><span/> YOUR HOLDINGS</div><h2>All assets<span>.</span></h2></div><button className="privacy-button" onClick={() => setHidden(!hidden)}>{hidden?'Show':'Hide'} balances</button></div><div className="asset-table">{(walletAddress ? [{ ...assets[0], amount: ethBalance || '0', value: ethPrice !== null ? formatUsd(Number(ethBalance || 0) * ethPrice) : 'Loading…', change: ethChange !== null ? (ethChange >= 0 ? '+' : '') + ethChange.toFixed(2) + '%' : '—' }] : assets).map(a=><div className="asset-item" key={a.ticker}><div className={'asset-symbol '+a.tone}>{a.icon}</div><div className="asset-title"><strong>{a.name}</strong><small>{a.ticker}</small></div><div className="asset-quantity"><strong>{money(a.amount+' '+a.ticker)}</strong><small>{money(a.value)}</small></div><span className="asset-performance">{a.change}</span></div>)}</div>{walletAddress && <><div className="token-section-head"><strong>ERC-20 tokens</strong><span>Sepolia testnet</span></div>{tokens.length ? tokens.map((item) => <div className="asset-item" key={item.token.address_hash}><div className="asset-symbol token-symbol">{(item.token.symbol || '?').slice(0,2)}</div><div className="asset-title"><strong>{item.token.name || item.token.symbol}</strong><small>{item.token.symbol} · Sepolia token</small></div><div className="asset-quantity"><strong>{money(formatTokenAmount(item.value, item.token.decimals) + ' ' + item.token.symbol)}</strong><small>Testnet token · no market value</small></div><span className="asset-performance">—</span></div>)} : <div className="wallet-history-empty">No ERC-20 token balances detected. Test tokens only appear here once their contract has issued them to your address.</div>}</>}<div className="security-callout"><ShieldCheck size={20}/><div><strong>{walletAddress ? 'Wallet connected · read only.' : 'Your keys, your control.'}</strong><p>{walletAddress ? 'Blobby reads your public Sepolia address and balance. Your wallet keeps the keys.' : 'Connect Rabby or MetaMask to read a Sepolia testnet balance. Blobby never receives your private keys.'}</p></div></div></div></>}
        {tab === 'Activity' && <div className="panel full-panel"><div className="section-head"><div><div className="overline"><span/> WALLET HISTORY</div><h2>Recent activity<span>.</span></h2></div><span className="demo-pill">{walletAddress ? 'SEPOLIA · LIVE HISTORY' : 'SAMPLE ACTIVITY'}</span></div><div className="activity-list expanded">{walletAddress ? historyLoading ? <div className="wallet-history-empty">Loading Sepolia transaction history…</div> : transactions.length ? transactions.slice(0,8).map((tx) => {
                const incoming = tx.to?.hash?.toLowerCase() === walletAddress.toLowerCase()
                const amount = formatTokenAmount(tx.value, '18')
                return <div className="activity-item" key={tx.hash}><div className={incoming ? 'activity-icon incoming' : 'activity-icon outgoing'}>{incoming ? <ArrowDownLeft size={17}/> : <ArrowUpRight size={17}/>}</div><div className="activity-copy"><strong>{incoming ? 'Received ETH' : 'Sent ETH'}</strong><small>{incoming ? 'From ' + tx.from.hash.slice(0,6) + '…' + tx.from.hash.slice(-4) : 'To ' + (tx.to?.hash ? tx.to.hash.slice(0,6) + '…' + tx.to.hash.slice(-4) : 'contract')} · <a href={'https://sepolia.etherscan.io/tx/' + tx.hash} target="_blank" rel="noreferrer">View transaction</a></small></div><div className="activity-amount"><strong className={incoming ? 'amount-in' : 'amount-out'}>{incoming ? '+' : '−'}{amount} ETH</strong><small>{formatSepoliaDate(tx.timestamp)}</small></div></div>
              }) : <div className="wallet-history-empty">{walletAddress ? 'No Sepolia transactions found yet.' : 'Connect your wallet to load transaction history.'}</div>} : activity.map((item,i)=><div className="activity-item" key={item.title}><div className={item.incoming?'activity-icon incoming':'activity-icon outgoing'}>{item.incoming?<ArrowDownLeft size={17}/>:<ArrowUpRight size={17}/>}</div><div className="activity-copy"><strong>{item.title}</strong><small>{item.detail}</small></div><div className="activity-amount"><strong className={item.incoming?'amount-in':'amount-out'}>{item.amount}</strong><small>{item.value} · {item.time}</small></div><button className="row-more" onClick={() => notify('Demo activity only.')}><ChevronRight size={17}/></button></div>)}</div><div className="security-callout"><ShieldCheck size={20}/><div><strong>Readable by design.</strong><p>When real transactions are enabled, Blobby will explain what is entering and leaving your wallet before you approve.</p></div></div></div>}
        {(tab === 'Explore' || tab === 'Collections') && <><div className="explore-toolbar"><div className="filter-tabs">{(tab === 'Explore' ? ['For you','All','Digital art','Music','3D objects'] : ['All','Digital art','Music','3D objects']).map(f=><button key={f} className={filter===f?'filter-tab selected':'filter-tab'} onClick={() => setFilter(f)}>{f}</button>)}</div><span className="results-count">{tab === 'Explore' ? 'CURATED FOR CURIOUS PEOPLE' : 'YOUR COLLECTION · DEMO'}</span></div>{tab === 'Collections' && <div className="collection-intro"><div className="collection-feature-art"><span className="feature-orb"/><span className="feature-ring"/></div><div><div className="overline"><span/> YOUR DIGITAL GALLERY</div><h2>Collect what<br/><em>moves you.</em></h2><p>Your collection is a reflection of your taste. Art, music, objects and internet ephemera, all in one place.</p></div></div>}<div className="drop-grid large-drops">{filteredDrops.map(drop=><DropCard key={drop.id} drop={drop} liked={liked.includes(drop.id)} onLike={() => setLiked(old=>old.includes(drop.id)?old.filter(x=>x!==drop.id):[...old,drop.id])} onOpen={() => setSelectedDrop(drop)}/>)}</div><div className="panel creator-panel"><div className="section-head"><div><div className="overline"><span/> PEOPLE MAKING THINGS</div><h2>Good people to know<span>.</span></h2></div><div className="creator-actions"><button className="subtle-link" onClick={() => {setProfileName(creatorProfile.displayName);setProfileHandle(creatorProfile.handle);setProfileRole(creatorProfile.role);setProfileBio(creatorProfile.bio);setProfilePayout(creatorProfile.payoutAddress);setModal('profile')}}>{creatorProfile.displayName ? 'Edit your profile' : 'Create profile'}</button><button className="modal-primary creator-publish" onClick={() => setModal('publish')}>Publish a drop <Plus size={15}/></button></div></div><div className="creator-grid">{(creatorProfile.displayName ? [{ name: '@' + creatorProfile.handle, role: creatorProfile.role || 'Creator', followers: 'Your profile', initials: creatorProfile.displayName.slice(0,1).toUpperCase(), tone: 'lime' }, ...creators] : creators).map(c=><div className="creator-card" key={c.name}><div className={'creator-avatar '+c.tone}>{c.initials}</div><div><strong>{c.name}</strong><small>{c.role} · {c.followers}</small></div><button className={following.includes(c.name)?'follow-btn following':'follow-btn'} onClick={() => setFollowing(old=>old.includes(c.name)?old.filter(x=>x!==c.name):[...old,c.name])}>{following.includes(c.name)?'Following':'Follow'}</button></div>)}</div></div></>}
        <footer className="page-footer"><span><b>blobby.</b> A little more culture.</span><span>{walletAddress ? 'SEPOLIA TESTNET · READ ONLY' : 'DEMO EXPERIENCE · NO REAL ASSETS'}</span><span>MADE FOR THE INTERNET <i>✳</i></span></footer>
      </div>
    </main>
    <AnimatePresence>{(modal || selectedDrop) && <motion.div className="modal-scrim" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={closeModal}><motion.div className="modal-sheet" initial={{opacity:0,y:18,scale:.98}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:12}} onClick={e=>e.stopPropagation()}><button className="modal-x" onClick={closeModal}><X size={18}/></button>{selectedDrop ? <><div className={'modal-drop-art art-'+selectedDrop.art}><Sparkles size={27}/></div><div className="overline"><span/> {selectedDrop.type.toUpperCase()}</div><h2>{selectedDrop.title}</h2><p className="modal-copy">A piece of the internet by <b>{selectedDrop.creator}</b>. Collect the things that move you.</p><div className="modal-info-row"><span>Edition</span><b>{selectedDrop.edition}</b></div><div className="modal-info-row"><span>Price</span><b>{selectedDrop.price}</b></div><button className="modal-primary" onClick={() => void buyDrop(selectedDrop)} disabled={!walletAddress || !selectedDrop.payoutAddress}> {selectedDrop.payoutAddress ? 'Buy with Sepolia test ETH' : 'Demo drop · unavailable to buy'} <ArrowUpRight size={17}/></button><p className="modal-footnote">{selectedDrop.payoutAddress ? 'Testnet payment only. Your wallet will ask you to approve the transfer.' : 'This sample listing is illustrative and has no payment destination.'}</p></> : modal === 'profile' ? <><div className="overline"><span/> CREATOR PROFILE</div><h2>Make it yours.</h2><p className="modal-copy">Your profile is saved in this browser for now. A shared account system will come later.</p><label className="form-label">DISPLAY NAME<input value={profileName} onChange={e=>setProfileName(e.target.value)} placeholder="Your name"/></label><label className="form-label">HANDLE<input value={profileHandle} onChange={e=>setProfileHandle(e.target.value)} placeholder="your.handle"/></label><label className="form-label">WHAT DO YOU MAKE?<input value={profileRole} onChange={e=>setProfileRole(e.target.value)} placeholder="Visual artist, producer…"/></label><label className="form-label">BIO<textarea value={profileBio} onChange={e=>setProfileBio(e.target.value)} placeholder="A short introduction…" rows={3}/></label><label className="form-label">SEPOLIA PAYOUT ADDRESS<input value={profilePayout} onChange={e=>setProfilePayout(e.target.value)} placeholder="0x…"/></label><button className="modal-primary" onClick={saveCreatorProfile}>Save creator profile <Check size={17}/></button></> : modal === 'publish' ? <><div className="overline"><span/> NEW CREATOR DROP</div><h2>Put something out there.</h2><p className="modal-copy">Creates a locally saved listing. Purchases, when enabled, send Sepolia test ETH to your saved payout address.</p><label className="form-label">DROP TITLE<input value={dropTitle} onChange={e=>setDropTitle(e.target.value)} placeholder="Name your drop"/></label><label className="form-label">DESCRIPTION<textarea value={dropDescription} onChange={e=>setDropDescription(e.target.value)} placeholder="What is it about?" rows={3}/></label><label className="form-label">CATEGORY<select value={dropType} onChange={e=>setDropType(e.target.value)}><option>Digital art</option><option>Music</option><option>3D objects</option></select></label><label className="form-label">PRICE (SEPOLIA TEST ETH)<input value={dropPrice} onChange={e=>setDropPrice(e.target.value)} inputMode="decimal"/></label><button className="modal-primary" onClick={publishDrop}>Publish drop <Plus size={17}/></button></> : modal === 'send' ? <><div className="modal-symbol send-symbol"><ArrowUpRight size={21}/></div><div className="overline"><span/> SEND ASSETS</div><h2>Send with confidence.</h2><p className="modal-copy">Sepolia testnet only. Your connected wallet will show the transaction and network fee before you approve it. Blobby cannot send mainnet funds.</p><label className="form-label">RECIPIENT ADDRESS<input value={sendAddress} onChange={e => setSendAddress(e.target.value)} placeholder="0x… recipient address" autoComplete="off"/></label><label className="form-label">NETWORK<input value="Ethereum Sepolia testnet" readOnly/></label><label className="form-label">AMOUNT (TEST ETH)<input value={sendAmount} onChange={e => setSendAmount(e.target.value)} placeholder="0.00" inputMode="decimal"/></label><div className="preview-note"><ShieldCheck size={16}/> Your wallet will display the final recipient, amount and estimated network fee before you approve.</div><button className="modal-primary" onClick={() => void sendTestnetEth()} disabled={sendBusy || !walletAddress}>{sendBusy ? 'Waiting for wallet…' : 'Review & send test ETH'} <ArrowUpRight size={17}/></button></> : modal === 'receive' ? <><div className="modal-symbol receive-symbol"><ArrowDownLeft size={21}/></div><div className="overline"><span/> RECEIVE ASSETS</div><h2>{walletAddress ? 'Your receive address.' : 'Your address, one tap away.'}</h2><p className="modal-copy">{walletAddress ? 'This is your public Sepolia testnet address. Only share it when you want to receive test ETH.' : 'Connect a wallet to display your public receive address.'}</p><div className="address-empty"><Wallet size={22}/><span><b>{walletAddress ? shortAddress : 'No wallet connected'}</b><small>{walletAddress ? 'Sepolia testnet receive address' : 'Your receive address will appear here.'}</small></span>{walletAddress && <button className="copy-address" onClick={() => {void navigator.clipboard.writeText(walletAddress);notify('Address copied.')}} aria-label="Copy receive address"><Copy size={16}/></button>}</div><button className="modal-primary" onClick={() => {closeModal();void connectWallet()}} disabled={walletBusy}>{walletBusy ? 'Connecting…' : walletAddress ? 'Refresh wallet' : 'Connect browser wallet'} <ArrowUpRight size={17}/></button></> : <><div className="modal-symbol swap-symbol"><ArrowLeftRight size={21}/></div><div className="overline"><span/> SWAP ASSETS</div><h2>Move between assets.</h2><p className="modal-copy">A swap preview will compare the rate, network fee and minimum received before you approve.</p><div className="swap-preview"><span>YOU PAY <b>ETH</b></span><ArrowDownUp size={18}/><span>YOU RECEIVE <b>SOL</b></span></div><button className="modal-primary" onClick={() => {closeModal();notify('Swap is not connected in this prototype.')}}>Understood <Check size={17}/></button></>}</motion.div></motion.div>}</AnimatePresence>
    <AnimatePresence>{toast && <motion.div className="toast-message" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:8}}><Sparkles size={16}/>{toast}</motion.div>}</AnimatePresence>
  </div>
}
function DropCard({drop,liked,onLike,onOpen}:{drop:Drop;liked:boolean;onLike:()=>void;onOpen:()=>void}) {
  return <motion.article className="drop-card" layout initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} whileHover={{y:-4}}><button className={'drop-art art-'+drop.art} onClick={onOpen}><span className="drop-label">{drop.type}</span><span className="art-edition">{drop.art==='night'?'SIDE A':drop.art==='object'?'OBJ. 003':'EDITION 01'}</span>{drop.art==='sunset'?<><span className="sun"/><span className="horizon"/></>:drop.art==='night'?<><span className="moon"/><span className="orbit orbit-one"/><span className="orbit orbit-two"/><span className="note">♫</span></>:<><span className="sculpture"/><span className="sculpture-shadow"/></>}<span className="art-number">0{drop.id}</span><span className="open-art"><ArrowUpRight size={17}/></span></button><div className="drop-details"><div><h3>{drop.title}</h3><p>by {drop.creator}</p></div><button className={liked?'like-control liked':'like-control'} onClick={onLike} aria-label={liked?'Unlike drop':'Like drop'}><Heart size={17} fill={liked?'currentColor':'none'}/></button></div><div className="drop-bottom"><span>{drop.edition}</span><strong>{drop.price}</strong></div></motion.article>
}
export default App
