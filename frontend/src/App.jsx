import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import './App.css'
import VoiceAssistant from './components/VoiceAssistant'

const API = 'https://secure-inventory-assistant.onrender.com/api'
const api = axios.create({ baseURL: API })
const auth = { Authorization: 'Bearer owner-demo-token' }
const DEMO_USER_ID = 1

const NAV_ITEMS = [
  ['dashboard', 'Dashboard', '⌂'], ['voice', 'Voice Assistant', '◉'], ['inventory', 'Inventory', '▦'],
  ['alerts', 'Alerts', '!'], ['sales', 'Sales & Trends', '↗'], ['staff', 'Staff & Roles', '◎'], ['settings', 'Settings', '⚙'],
]

function App() {
  const [screen, setScreen] = useState('login')
  const [authState, setAuthState] = useState('idle')
  const [products, setProducts] = useState([])
  const [history, setHistory] = useState([])
  const [sales, setSales] = useState({ total_sold: 0, by_product: [] })
  const [lowStock, setLowStock] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [operationMessage, setOperationMessage] = useState('')
  const [operationLoading, setOperationLoading] = useState(false)
  const [addQuantity, setAddQuantity] = useState('')
  const [removeQuantity, setRemoveQuantity] = useState('')
  const [addProductId, setAddProductId] = useState('')
  const [removeProductId, setRemoveProductId] = useState('')
  const [search, setSearch] = useState('')
  const [productName, setProductName] = useState('')
  const [productUnit, setProductUnit] = useState('')
  const [productQuantity, setProductQuantity] = useState('')
  const [reorderLevel, setReorderLevel] = useState('')
  const [productMessage, setProductMessage] = useState('')
  const [productMessageType, setProductMessageType] = useState('')

  const fetchDashboardData = async () => {
    const [productResult, historyResult, salesResult, lowResult] = await Promise.all([
      api.get('/products', { headers: auth }), api.get('/inventory/history', { headers: auth }), api.get('/analytics/sales', { headers: auth }), api.get('/stock/low', { headers: auth }),
    ])
    return { products: productResult.data, history: historyResult.data, sales: salesResult.data, lowStock: lowResult.data }
  }
  const applyDashboardData = (data) => { setError(''); setProducts(data.products); setHistory(data.history); setSales(data.sales); setLowStock(data.lowStock); setLoading(false) }
  const loadDashboard = async () => {
    try { applyDashboardData(await fetchDashboardData()) } catch (requestError) { setError(requestError.response?.data?.detail || 'The deployed backend is unavailable. Please try again shortly.'); setLoading(false) }
  }
  useEffect(() => { fetchDashboardData().then(applyDashboardData).catch(() => { setError('The deployed backend is unavailable. Please try again shortly.'); setLoading(false) }) }, [])

  const updateStock = async (event, action) => {
    event.preventDefault()
    const productId = action === 'ADD' ? addProductId : removeProductId
    const quantity = action === 'ADD' ? addQuantity : removeQuantity
    if (!productId || Number(quantity) <= 0) { setOperationMessage('Choose a product and enter a quantity greater than zero.'); return }
    setOperationLoading(true); setOperationMessage('')
    try {
      const result = await api.post(`/inventory/${action === 'ADD' ? 'add' : 'remove'}`, { product_id: Number(productId), quantity: Number(quantity), user_id: DEMO_USER_ID }, { headers: auth })
      await loadDashboard(); setOperationMessage(result.data.message)
      if (action === 'ADD') setAddQuantity(''); else setRemoveQuantity('')
    } catch (requestError) { setOperationMessage(requestError.response?.data?.detail || 'The stock update could not be completed.') } finally { setOperationLoading(false) }
  }

  const createProduct = async (event) => {
    event.preventDefault()
    if (!productName.trim() || !productUnit || productQuantity === '' || Number(productQuantity) < 0 || reorderLevel === '' || Number(reorderLevel) < 0) {
      setProductMessageType('error')
      setProductMessage('Enter a product name, unit, and non-negative stock and reorder values.')
      return
    }
    setProductMessage('')
    setProductMessageType('')
    setOperationLoading(true)
    try {
      await api.post('/products', { name: productName.trim(), unit: productUnit, quantity: Number(productQuantity), reorder_threshold: Number(reorderLevel) }, { headers: auth })
      await loadDashboard()
      setProductMessageType('success')
      setProductMessage(`${productName.trim()} was added to inventory.`)
      setProductName(''); setProductUnit(''); setProductQuantity(''); setReorderLevel('')
    } catch (requestError) {
      setProductMessageType('error')
      setProductMessage(requestError.response?.data?.detail || 'The product could not be created.')
    } finally {
      setOperationLoading(false)
    }
  }

  const login = () => { setAuthState('listening'); window.setTimeout(() => setAuthState('verified'), 900) }
  const continueToDashboard = () => { setScreen('dashboard'); setAuthState('idle') }
  const totalStock = useMemo(() => products.reduce((sum, product) => sum + product.quantity, 0), [products])
  const filteredProducts = products.filter((product) => product.name.toLowerCase().includes(search.toLowerCase()))
  const go = (next) => { setScreen(next); setOperationMessage('') }

  if (screen === 'login') return <LoginScreen authState={authState} onAuthenticate={login} onContinue={continueToDashboard} />

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">SI</div><div><strong>Stockwise</strong><span>voice inventory</span></div></div>
      <nav>{NAV_ITEMS.map(([id, label, icon]) => <button className={screen === id ? 'active' : ''} onClick={() => go(id)} key={id}><span>{icon}</span>{label}{id === 'alerts' && lowStock.length > 0 && <em>{lowStock.length}</em>}</button>)}</nav>
      <div className="sidebar-note"><span className="live-dot" /> Prototype / Demo<div>Voice verification is a demo reference flow. Permissions remain enforced by the backend.</div></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><div><p className="eyebrow">MONDAY, 19 SEPTEMBER 2026</p><h1>{screenTitle(screen)}</h1></div><div className="profile"><div className="avatar">AR</div><div><strong>Asha Rao</strong><span>Owner access</span></div><span className="demo-chip">Prototype / Demo</span></div></header>
      {error && <div className="data-banner error-banner">{error}</div>}
      {screen === 'dashboard' && <Dashboard products={products} totalStock={totalStock} lowStock={lowStock} history={history} loading={loading} onNavigate={go} />}
      {screen === 'voice' && <VoiceScreen />}
      {screen === 'inventory' && <InventoryScreen products={filteredProducts} allProducts={products} search={search} setSearch={setSearch} onUpdate={updateStock} onCreateProduct={createProduct} addProductId={addProductId} setAddProductId={setAddProductId} addQuantity={addQuantity} setAddQuantity={setAddQuantity} removeProductId={removeProductId} setRemoveProductId={setRemoveProductId} removeQuantity={removeQuantity} setRemoveQuantity={setRemoveQuantity} operationLoading={operationLoading} operationMessage={operationMessage} productName={productName} setProductName={setProductName} productUnit={productUnit} setProductUnit={setProductUnit} productQuantity={productQuantity} setProductQuantity={setProductQuantity} reorderLevel={reorderLevel} setReorderLevel={setReorderLevel} productMessage={productMessage} productMessageType={productMessageType} />}
      {screen === 'alerts' && <AlertsScreen lowStock={lowStock} onAdd={() => go('inventory')} />}
      {screen === 'sales' && <SalesScreen sales={sales} history={history} lowStock={lowStock} />}
      {screen === 'staff' && <StaffScreen />}
      {screen === 'settings' && <SettingsScreen />}
    </main>
  </div>
}

function screenTitle(screen) { return { dashboard: 'Inventory Dashboard', voice: 'Voice Assistant', inventory: 'Inventory', alerts: 'Stock Alerts', sales: 'Sales & Trends', staff: 'Staff & Roles', settings: 'Settings' }[screen] }
function LoginScreen({ authState, onAuthenticate, onContinue }) { return <div className="login-shell"><div className="login-brand"><div className="brand-mark">SI</div><strong>Stockwise</strong><span>secure inventory assistant</span></div><section className="login-card"><span className="section-kicker">SECURE ACCESS · PROTOTYPE</span><h1>Welcome to Smart Inventory</h1><p>Use your registered voice to securely access your inventory.</p><div className={`auth-orb ${authState === 'listening' ? 'active' : ''} ${authState === 'verified' ? 'verified' : ''}`}><span>{authState === 'listening' ? '◌' : authState === 'verified' ? '✓' : '◉'}</span></div><strong className="auth-state">{authState === 'listening' ? 'Listening for your voice...' : authState === 'verified' ? 'Prototype identity verified' : 'Asha Rao · Owner'}</strong><small className="prototype-note">Prototype only. This is not biometric security.</small><button className="primary-button" onClick={authState === 'verified' ? onContinue : onAuthenticate}>{authState === 'verified' ? 'Continue to Dashboard' : 'Authenticate with Voice'}</button></section></div> }

function Dashboard({ products, totalStock, lowStock, history, loading, onNavigate }) { return <>
  <section className="hero-banner"><div><span className="section-kicker">YOUR SHOP AT A GLANCE</span><h2>Good morning, Asha.</h2><p>Stay ahead of every shelf with a voice-first inventory view.</p><div className="hero-actions"><button className="primary-button" onClick={() => onNavigate('voice')}>◉ Start Voice Assistant</button><button className="ghost-button" onClick={() => onNavigate('inventory')}>View inventory →</button></div></div><div className="hero-stat"><span>LIVE STOCK VALUE</span><strong>{totalStock.toLocaleString()}</strong><small>items tracked from SQLite</small></div></section>
  <section className="summary-grid"><Metric label="Total products" value={loading ? '—' : products.length} meta="in your catalogue" /><Metric label="Total stock items" value={loading ? '—' : totalStock.toLocaleString()} meta="across all units" /><Metric label="Low stock items" value={loading ? '—' : lowStock.length} meta="needs attention" alert={lowStock.length > 0} /><Metric label="Today's transactions" value={loading ? '—' : history.length} meta="recorded activity" /></section>
  <div className="section-heading"><div><span className="section-kicker">QUICK ACTIONS</span><h2>What would you like to do?</h2></div></div><div className="quick-grid"><QuickAction icon="+" title="Add Stock" text="Record incoming goods" onClick={() => onNavigate('inventory')} /><QuickAction icon="−" title="Remove Stock" text="Record a sale or removal" onClick={() => onNavigate('inventory')} /><QuickAction icon="⌕" title="Check Stock" text="See what is on shelf" onClick={() => onNavigate('inventory')} /><QuickAction icon="◉" title="Voice Assistant" text="Speak naturally" onClick={() => onNavigate('voice')} /></div>
  <section className="dashboard-grid"><Panel title="Low-stock alerts" action="See all" onAction={() => onNavigate('alerts')}>{lowStock.length ? lowStock.slice(0, 3).map((item) => <AlertRow product={item} key={item.id} />) : <Empty text="No products need attention." />}</Panel><Panel title="Recent transactions" action="View history" onAction={() => onNavigate('inventory')}>{history.slice(0, 4).map((item) => <Transaction item={item} key={item.id} />)}{!history.length && <Empty text="No transactions yet." />}</Panel></section>
</> }
function VoiceScreen() { return <><div className="screen-intro"><span className="section-kicker">VOICE-FIRST WORKFLOW</span><h2>Talk to your inventory naturally.</h2><p>Choose a language, speak a command, then review the prototype result before anything is confirmed.</p></div><VoiceAssistant /><div className="flow-steps"><span className="done">01 <b>Speak</b></span><span>02 <b>Review command</b></span><span>03 <b>Confirm prototype</b></span></div></> }
function InventoryScreen({ products, allProducts, search, setSearch, onUpdate, onCreateProduct, addProductId, setAddProductId, addQuantity, setAddQuantity, removeProductId, setRemoveProductId, removeQuantity, setRemoveQuantity, operationLoading, operationMessage, productName, setProductName, productUnit, setProductUnit, productQuantity, setProductQuantity, reorderLevel, setReorderLevel, productMessage, productMessageType }) { return <><div className="screen-intro split"><div><span className="section-kicker">LIVE CATALOGUE</span><h2>Everything on the shelf.</h2><p>Real products and quantities from your FastAPI inventory.</p></div><input className="search-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="⌕  Search products" /></div><form className="product-form" onSubmit={onCreateProduct}><div className="form-heading"><span className="section-kicker">NEW PRODUCT</span><strong>Add a product to your catalogue</strong></div><label>Product Name<input value={productName} onChange={(event) => setProductName(event.target.value)} placeholder="e.g. Tea" disabled={operationLoading} /></label><label>Unit<select value={productUnit} onChange={(event) => setProductUnit(event.target.value)} disabled={operationLoading}><option value="">Choose unit</option>{['Pieces', 'Kg', 'Bags', 'Cartons', 'Boxes', 'Dozens', 'Litres'].map((unit) => <option value={unit} key={unit}>{unit}</option>)}</select></label><label>Initial Stock<input type="number" min="0" step="0.01" value={productQuantity} onChange={(event) => setProductQuantity(event.target.value)} placeholder="0" disabled={operationLoading} /></label><label>Reorder Level<input type="number" min="0" step="0.01" value={reorderLevel} onChange={(event) => setReorderLevel(event.target.value)} placeholder="10" disabled={operationLoading} /></label><button className="stock-button add-button" type="submit" disabled={operationLoading}>{operationLoading ? 'Creating...' : 'Add Product'}</button></form>{productMessage && <div className={`data-banner ${productMessageType === 'error' ? 'error-banner' : 'success-banner'}`}>{productMessage}</div>}{operationMessage && <div className="data-banner success-banner">{operationMessage}</div>}<section className="stock-actions"><StockForm action="ADD" products={allProducts} productId={addProductId} setProductId={setAddProductId} quantity={addQuantity} setQuantity={setAddQuantity} loading={operationLoading} onSubmit={onUpdate} /><StockForm action="REMOVE" products={allProducts} productId={removeProductId} setProductId={setRemoveProductId} quantity={removeQuantity} setQuantity={setRemoveQuantity} loading={operationLoading} onSubmit={onUpdate} /></section><div className="table-panel"><div className="panel-top"><strong>Inventory</strong><span>{products.length} visible products</span></div><table><thead><tr><th>Product</th><th>Quantity</th><th>Unit</th><th>Reorder level</th><th>Status</th><th>Actions</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td><span className="product-icon">{product.name[0]}</span><strong>{product.name}</strong></td><td>{product.quantity}</td><td>{product.unit}</td><td>{product.reorder_threshold}</td><td><span className={`tag ${statusClass(product)}`}>{statusLabel(product)}</span></td><td><button className="table-action" onClick={() => setAddProductId(String(product.id))}>Add</button><button className="table-action muted-action" onClick={() => setRemoveProductId(String(product.id))}>Remove</button></td></tr>)}</tbody></table></div></> }
function AlertsScreen({ lowStock, onAdd }) { return <><div className="alert-summary"><div><span className="section-kicker">STOCK HEALTH</span><h2>Catch the quiet warnings.</h2><p>These products are at or below their reorder level.</p></div><strong>{lowStock.length}<small>items need review</small></strong></div><div className="alert-list">{lowStock.map((product) => <div className="alert-card" key={product.id}><div className="severity-icon">!</div><div><span className="tag warning">LOW STOCK</span><h3>{product.name}</h3><p>{product.quantity} {product.unit} remaining · reorder at {product.reorder_threshold}</p></div><button className="outline-button" onClick={onAdd}>Add Stock →</button></div>)}{!lowStock.length && <Empty text="Your stock is in good shape." />}</div></> }
function SalesScreen({ sales, history, lowStock }) { return <><div className="summary-grid"><Metric label="Sales this week" value={sales.total_sold} meta="from recorded removals" /><Metric label="Transactions" value={history.length} meta="in available history" /><Metric label="Top-selling product" value={sales.by_product[0]?.product || '—'} meta="based on real sales" /><Metric label="Needs restock" value={lowStock.length} meta="current alerts" alert /></div><section className="chart-panel large-chart"><div className="panel-top"><div><strong>Sales by product</strong><span>Calculated from remove transactions</span></div><span className="chart-label">LIVE DATA</span></div><div className="chart-wrap">{sales.by_product.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={sales.by_product}><defs><linearGradient id="salesFillPrototype" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e6a644" stopOpacity={0.35} /><stop offset="100%" stopColor="#e6a644" stopOpacity={0} /></linearGradient></defs><XAxis dataKey="product" axisLine={false} tickLine={false} /><YAxis axisLine={false} tickLine={false} /><Tooltip /><Area type="monotone" dataKey="quantity" stroke="#d58b20" fill="url(#salesFillPrototype)" strokeWidth={3} /></AreaChart></ResponsiveContainer> : <Empty text="Sales analytics will appear after a sale is recorded." />}</div></section><div className="suggestions"><span className="section-kicker">SMART SUGGESTIONS · DEMO</span><div className="suggestion-grid"><p>Biscuits are below the reorder threshold.</p><p>Rice has had frequent stock additions.</p><p>Consider reviewing Oil stock levels.</p></div></div></> }
function StaffScreen() { return <><div className="screen-intro"><span className="section-kicker">ACCESS CONTROL · PROTOTYPE</span><h2>People and permissions.</h2><p>A simple view of who can do what in the shop.</p></div><div className="role-grid"><RoleCard name="Asha Rao" role="Owner" access="Full Access" permissions="Inventory · Reports · Staff Management · Settings" /><RoleCard name="Ravi Kumar" role="Staff Member" access="Inventory Access" permissions="Add Stock · Remove Stock · Check Stock" /></div><div className="button-row"><button className="primary-button">+ Add Staff</button><button className="ghost-button">Edit Role</button></div></> }
function SettingsScreen() { return <><div className="screen-intro"><span className="section-kicker">WORKSPACE PREFERENCES</span><h2>Settings</h2><p>Shape how Stockwise feels in your shop.</p></div><div className="settings-grid"><Setting label="Business Name" value="Asha General Store" /><Setting label="Preferred Language" value="English" select /><Setting label="Voice Settings" value="Browser speech recognition" /><Setting label="Notification Settings" value="Low-stock alerts" /><Setting label="Reorder Settings" value="Use product thresholds" /><Setting label="User Role" value="Owner" /></div><button className="primary-button">Save Settings</button></> }
function QuickAction({ icon, title, text, onClick }) { return <button className="quick-action" onClick={onClick}><span>{icon}</span><strong>{title}</strong><small>{text}</small><b>→</b></button> }
function Panel({ title, action, onAction, children }) { return <section className="panel"><div className="panel-top"><strong>{title}</strong><button className="text-button" onClick={onAction}>{action} →</button></div>{children}</section> }
function AlertRow({ product }) { return <div className="alert-row"><div className="alert-icon">!</div><div><strong>{product.name} is running low</strong><span>{product.quantity} {product.unit} left · threshold {product.reorder_threshold}</span></div></div> }
function Transaction({ item }) { return <div className="activity-row"><span className={`activity-dot ${item.action === 'ADD' ? 'add' : 'remove'}`} /><div><strong>{item.action === 'ADD' ? 'Added' : 'Sold'} {item.quantity} {item.unit}</strong><span>{item.product_name} · {item.user_name}</span></div><time>{new Date(`${item.timestamp}Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time></div> }
function RoleCard({ name, role, access, permissions }) { return <div className="role-card"><div className="avatar">{name.split(' ').map((part) => part[0]).join('')}</div><div><span className="tag good">{role}</span><h3>{name}</h3><strong>{access}</strong><p>{permissions}</p></div></div> }
function Setting({ label, value, select }) { return <label className="setting"><span>{label}</span>{select ? <select defaultValue={value}><option>English</option><option>Telugu</option><option>Hindi</option></select> : <input defaultValue={value} />}</label> }
function Empty({ text }) { return <p className="empty-state">{text}</p> }
function Metric({ label, value, meta, alert }) { return <div className="metric"><span className="metric-label">{label}</span><strong className={alert ? 'orange' : ''}>{value}</strong><span className="metric-meta">{meta}</span></div> }
function StockForm({ action, products, productId, setProductId, quantity, setQuantity, loading, onSubmit }) { return <form className="stock-form" onSubmit={(event) => onSubmit(event, action)}><div><span className="section-kicker">{action === 'ADD' ? 'ADD STOCK' : 'REMOVE STOCK'}</span><strong>{action === 'ADD' ? 'Record incoming goods' : 'Record a sale or removal'}</strong></div><label>Product<select value={productId} onChange={(event) => setProductId(event.target.value)} disabled={loading}><option value="">Choose product</option>{products.map((product) => <option value={product.id} key={product.id}>{product.name} · {product.unit}</option>)}</select></label><label>Quantity<input type="number" min="0.01" step="0.01" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="0" disabled={loading} /></label><button className={action === 'ADD' ? 'stock-button add-button' : 'stock-button remove-button'} type="submit" disabled={loading}>{loading ? 'Saving...' : action === 'ADD' ? 'Add stock' : 'Remove stock'}</button></form> }
function statusLabel(product) { return product.quantity === 0 ? 'Out of Stock' : product.quantity <= product.reorder_threshold ? 'Low Stock' : 'In Stock' }
function statusClass(product) { return product.quantity === 0 ? 'danger' : product.quantity <= product.reorder_threshold ? 'warning' : 'good' }
export default App
