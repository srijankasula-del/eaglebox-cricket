import { useState, useEffect, useCallback } from 'react';
import API_URL from "./lib/api";

// ─────────────────────────────── helpers ────────────────────────────────
function api(path, opts = {}, token) {
    return fetch(`${API_URL}${path}`, {
        headers: { 'Content-Type': 'application/json', ...(token ? { 'x-admin-token': token } : {}) },
        ...opts
    }).then(r => r.json());
}

// ════════════════════════════════════════════════════════════════════════
//  LOGIN SCREEN
// ════════════════════════════════════════════════════════════════════════
function LoginScreen({ onLogin }) {
    const [creds, setCreds] = useState({
        username: localStorage.getItem('ebc_admin_username') || '',
        password: localStorage.getItem('ebc_admin_password') || ''
    });
    const [remember, setRemember] = useState(localStorage.getItem('ebc_admin_remember') === 'true');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true); setError('');
        try {
            const payload = {
                username: creds.username.trim(),
                password: creds.password.trim()
            };
            const data = await api('/api/admin/login', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            if (data.token) {
                sessionStorage.setItem('ebc_admin_token', data.token);
                if (remember) {
                    localStorage.setItem('ebc_admin_token', data.token);
                    localStorage.setItem('ebc_admin_username', creds.username);
                    localStorage.setItem('ebc_admin_password', creds.password);
                    localStorage.setItem('ebc_admin_remember', 'true');
                } else {
                    localStorage.removeItem('ebc_admin_token');
                    localStorage.removeItem('ebc_admin_username');
                    localStorage.removeItem('ebc_admin_password');
                    localStorage.setItem('ebc_admin_remember', 'false');
                }
                onLogin(data.token);
            } else {
                setError(data.error || 'Login failed.');
            }
        } catch {
            setError('Cannot reach server.');
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center bg-emerald-900 text-white font-mono font-black text-lg px-4 py-2 rounded-lg mb-4">EBC</div>
                    <h1 className="text-white font-extrabold text-xl">Admin Panel</h1>
                    <p className="text-slate-500 text-xs mt-1">Eagle Box Cricket — Restricted Access</p>
                </div>
                <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                    {error && (
                        <div className="bg-red-950 border border-red-800 text-red-400 text-xs font-bold p-3 rounded-lg">{error}</div>
                    )}
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Username</label>
                        <input type="text" value={creds.username}
                            onChange={e => setCreds(p => ({ ...p, username: e.target.value }))}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-white placeholder-slate-600 focus:border-emerald-600 outline-none"
                            placeholder="admin" required />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Password</label>
                        <input type="password" value={creds.password}
                            onChange={e => setCreds(p => ({ ...p, password: e.target.value }))}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-white placeholder-slate-600 focus:border-emerald-600 outline-none"
                            placeholder="••••••••" required />
                    </div>
                    <label className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/60 px-3 py-2 text-xs text-slate-300">
                        <span>Remember me</span>
                        <input
                            type="checkbox"
                            checked={remember}
                            onChange={(e) => setRemember(e.target.checked)}
                            className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                        />
                    </label>
                    <button type="submit" disabled={loading}
                        className="w-full bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold py-3 rounded-lg text-sm uppercase tracking-wider transition-colors mt-2">
                        {loading ? 'Verifying...' : 'Sign In'}
                    </button>
                </form>
                <p className="text-center text-slate-700 text-[10px] mt-4">This panel is not accessible from the customer site.</p>
            </div>
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════
//  MAIN ADMIN APP
// ════════════════════════════════════════════════════════════════════════
export default function AdminApp({ onBackToCustomer }) {
    const [token, setToken] = useState(() => localStorage.getItem('ebc_admin_token') || sessionStorage.getItem('ebc_admin_token') || '');
    const [activeSection, setActiveSection] = useState('dashboard');
    const [config, setConfig] = useState(null);
    const [bookings, setBookings] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [toast, setToast] = useState('');

    const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

    const loadAll = useCallback(async () => {
        if (!token) return;
        const [cfg, bks, ana] = await Promise.all([
            api('/api/admin/config', {}, token),
            api('/api/bookings', {}, token),
            api('/api/admin/analytics', {}, token)
        ]);
        if (!cfg.error) setConfig(cfg);
        if (Array.isArray(bks)) setBookings(bks);
        if (!ana.error) setAnalytics(ana);
    }, [token]);

    useEffect(() => {
        if (!token) return;
        let active = true;

        (async () => {
            if (active) {
                await loadAll();
            }
        })();

        return () => {
            active = false;
        };
    }, [token, loadAll]);

    const handleLogout = async () => {
        try {
            await api('/api/admin/logout', { method: 'POST' }, token);
        } catch {
            // Ignore logout errors to keep the UI responsive.
        }
        sessionStorage.removeItem('ebc_admin_token');
        localStorage.removeItem('ebc_admin_token');
        localStorage.removeItem('ebc_admin_username');
        localStorage.removeItem('ebc_admin_password');
        localStorage.setItem('ebc_admin_remember', 'false');
        setToken('');
    };

    if (!token) return <LoginScreen onLogin={setToken} />;

    const NAV = [
        { id: 'dashboard', label: 'Dashboard', icon: '◈' },
        { id: 'shifts', label: 'Shifts & Pricing', icon: '◷' },
        { id: 'venues', label: 'Venues', icon: '◎' },
        { id: 'general', label: 'General Settings', icon: '⚙' },
        { id: 'bookings', label: 'Bookings', icon: '▦' },
        { id: 'gate', label: 'Gate Terminal', icon: '⬛' },
    ];

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 flex">
            {/* Toast */}
            {toast && (
                <div className="fixed top-4 right-4 z-50 bg-emerald-800 text-white text-xs font-bold px-4 py-3 rounded-lg shadow-xl border border-emerald-700">
                    ✓ {toast}
                </div>
            )}

            {/* Sidebar */}
            <aside className="w-56 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
                <div className="p-5 border-b border-slate-800">
                    {onBackToCustomer && (
                        <button
                            type="button"
                            onClick={onBackToCustomer}
                            className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-left text-[11px] font-bold text-slate-300 hover:border-emerald-700 hover:text-emerald-400 transition-colors"
                        >
                            ← Back to Booking UI
                        </button>
                    )}
                    <div className="flex items-center space-x-2.5">
                        <div className="bg-emerald-800 text-white font-mono font-black text-xs px-2 py-1 rounded">EBC</div>
                        <div>
                            <div className="text-xs font-bold text-white">Admin Panel</div>
                            <div className="text-[10px] text-slate-500">admin.eagleboxcricket.com</div>
                        </div>
                    </div>
                </div>
                <nav className="flex-1 p-3 space-y-1">
                    {NAV.map(n => (
                        <button key={n.id} onClick={() => setActiveSection(n.id)}
                            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all text-left ${activeSection === n.id ? 'bg-emerald-900/60 text-emerald-400 border border-emerald-800/50' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}>
                            <span className="text-sm">{n.icon}</span>
                            <span>{n.label}</span>
                        </button>
                    ))}
                </nav>
                <div className="p-3 border-t border-slate-800">
                    <button onClick={handleLogout}
                        className="w-full text-xs font-bold text-slate-500 hover:text-red-400 py-2 rounded-lg hover:bg-red-950/30 transition-colors">
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main */}
            <main className="flex-1 overflow-auto">
                <header className="bg-slate-900 border-b border-slate-800 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
                    <h1 className="text-sm font-extrabold text-white">{NAV.find(n => n.id === activeSection)?.label}</h1>
                    <button onClick={loadAll} className="text-[11px] text-slate-500 hover:text-emerald-400 font-bold border border-slate-700 px-3 py-1 rounded-lg hover:border-emerald-700 transition-colors">
                        ↻ Refresh
                    </button>
                </header>

                <div className="p-8">
                    {activeSection === 'dashboard' && config && analytics && <DashboardSection analytics={analytics} bookings={bookings} config={config} />}
                    {activeSection === 'shifts' && config && <ShiftsSection config={config} token={token} onSave={loadAll} showToast={showToast} />}
                    {activeSection === 'venues' && config && <VenuesSection config={config} token={token} onSave={loadAll} showToast={showToast} />}
                    {activeSection === 'general' && config && <GeneralSection config={config} token={token} onSave={loadAll} showToast={showToast} />}
                    {activeSection === 'bookings' && <BookingsSection bookings={bookings} token={token} onRefresh={loadAll} showToast={showToast} />}
                    {activeSection === 'gate' && <GateSection bookings={bookings} token={token} />}
                </div>
            </main>
        </div>
    );
}

// ────────────────────────── DASHBOARD ───────────────────────────────────
function DashboardSection({ analytics, bookings, config }) {
    const recent = [...bookings].reverse().slice(0, 5);
    const cards = [
        { label: 'Total Bookings', value: analytics.total, color: 'text-blue-400', bg: 'bg-blue-950/40 border-blue-800/40' },
        { label: 'Total Revenue', value: `₹${analytics.revenue.toLocaleString('en-IN')}`, color: 'text-emerald-400', bg: 'bg-emerald-950/40 border-emerald-800/40' },
        { label: 'Admitted Today', value: analytics.admitted, color: 'text-amber-400', bg: 'bg-amber-950/40 border-amber-800/40' },
        { label: 'Pending Entry', value: analytics.confirmed, color: 'text-purple-400', bg: 'bg-purple-950/40 border-purple-800/40' },
    ];

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {cards.map(c => (
                    <div key={c.label} className={`rounded-xl border p-5 ${c.bg}`}>
                        <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">{c.label}</div>
                        <div className={`text-2xl font-extrabold ${c.color}`}>{c.value}</div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Bookings by Shift</h3>
                    {Object.entries(analytics.byShift).map(([k, v]) => {
                        const pct = analytics.total ? Math.round((v / analytics.total) * 100) : 0;
                        return (
                            <div key={k} className="mb-3">
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="font-bold text-slate-300">{k}</span>
                                    <span className="text-slate-500">{v} bookings ({pct}%)</span>
                                </div>
                                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-700 rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Recent Bookings</h3>
                    <div className="space-y-2">
                        {recent.map(b => (
                            <div key={b.id} className="flex items-center justify-between text-xs py-2 border-b border-slate-800 last:border-0">
                                <div>
                                    <div className="font-bold text-slate-200">{b.name}</div>
                                    <div className="text-slate-500 text-[10px]">{b.eventDate} · {b.preferredTime}</div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-emerald-400">₹{b.billAmount}</div>
                                    <div className={`text-[10px] font-bold ${b.status === 'Admitted Inside' ? 'text-blue-400' : 'text-emerald-400'}`}>{b.status}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Live Pricing Overview</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {Object.entries(config.shifts).map(([k, v]) => (
                        <div key={k} className={`rounded-lg p-3 border ${v.active ? 'bg-slate-800 border-slate-700' : 'bg-slate-900 border-slate-800 opacity-50'}`}>
                            <div className="text-[10px] text-slate-500 font-bold uppercase">{k} {!v.active && '(Disabled)'}</div>
                            <div className="text-lg font-extrabold text-emerald-400">₹{v.rate}</div>
                            <div className="text-[10px] text-slate-500">{v.startTime} – {v.endTime}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ────────────────────────── SHIFTS & PRICING ────────────────────────────
function ShiftsSection({ config, token, onSave, showToast }) {
    const [shifts, setShifts] = useState(config.shifts);
    const [saving, setSaving] = useState(null);
    const [newShift, setNewShift] = useState({ key: '', label: '', startTime: '08:00', endTime: '14:00', rate: '' });
    const [showAdd, setShowAdd] = useState(false);

    const saveShift = async (key) => {
        setSaving(key);
        await api('/api/admin/config/shifts', {
            method: 'PATCH',
            body: JSON.stringify({ shiftKey: key, data: shifts[key] })
        }, token);
        setSaving(null);
        showToast(`${key} shift saved.`);
        onSave();
    };

    const toggleActive = (key) => {
        setShifts(prev => ({ ...prev, [key]: { ...prev[key], active: !prev[key].active } }));
    };

    const addShift = async () => {
        if (!newShift.key || !newShift.rate) return;
        await api('/api/admin/config/shifts', {
            method: 'POST',
            body: JSON.stringify(newShift)
        }, token);
        setNewShift({ key: '', label: '', startTime: '08:00', endTime: '14:00', rate: '' });
        setShowAdd(false);
        showToast('New shift added.');
        onSave();
    };

    const deleteShift = async (key) => {
        if (!confirm(`Delete the "${key}" shift? This cannot be undone.`)) return;
        await api(`/api/admin/config/shifts/${key}`, { method: 'DELETE' }, token);
        showToast(`${key} deleted.`);
        onSave();
    };

    return (
        <div className="space-y-4 max-w-2xl">
            <p className="text-xs text-slate-500">Changes here update the customer booking portal immediately.</p>

            {Object.entries(shifts).map(([key, shift]) => (
                <div key={key} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                            <h3 className="text-sm font-extrabold text-white">{key}</h3>
                            <button onClick={() => toggleActive(key)}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${shift.active ? 'bg-emerald-900/50 text-emerald-400 border-emerald-700' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                                {shift.active ? 'ACTIVE' : 'DISABLED'}
                            </button>
                        </div>
                        <button onClick={() => deleteShift(key)} className="text-[10px] text-red-500 hover:text-red-400 font-bold px-2 py-0.5 rounded border border-red-900/50 hover:border-red-700 transition-colors">Delete</button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Start Time</label>
                            <input type="time" value={shift.startTime || ''}
                                onChange={e => setShifts(p => ({ ...p, [key]: { ...p[key], startTime: e.target.value } }))}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">End Time</label>
                            <input type="time" value={shift.endTime || ''}
                                onChange={e => setShifts(p => ({ ...p, [key]: { ...p[key], endTime: e.target.value } }))}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Price per Box (₹) — before GST</label>
                        <div className="flex items-center space-x-2">
                            <span className="text-slate-500 text-lg font-bold">₹</span>
                            <input type="number" value={shift.rate}
                                onChange={e => setShifts(p => ({ ...p, [key]: { ...p[key], rate: parseInt(e.target.value) } }))}
                                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-lg font-extrabold text-emerald-400 w-full" />
                            <span className="text-[10px] text-slate-500 font-bold">+{Math.round(config.gstRate * 100)}% GST → ₹{Math.round(shift.rate * (1 + config.gstRate))}</span>
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Display Label (optional)</label>
                        <input type="text" value={shift.label}
                            onChange={e => setShifts(p => ({ ...p, [key]: { ...p[key], label: e.target.value } }))}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
                    </div>

                    <button onClick={() => saveShift(key)} disabled={saving === key}
                        className="bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-5 py-2 rounded-lg transition-colors uppercase tracking-wider">
                        {saving === key ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            ))}

            {showAdd ? (
                <div className="bg-slate-900 border border-emerald-900/50 rounded-xl p-5 space-y-3">
                    <h3 className="text-sm font-bold text-emerald-400">Add New Shift</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Key (e.g. "Night")</label>
                            <input type="text" value={newShift.key}
                                onChange={e => setNewShift(p => ({ ...p, key: e.target.value }))}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Price (₹)</label>
                            <input type="number" value={newShift.rate}
                                onChange={e => setNewShift(p => ({ ...p, rate: e.target.value }))}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Start Time</label>
                            <input type="time" value={newShift.startTime}
                                onChange={e => setNewShift(p => ({ ...p, startTime: e.target.value }))}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">End Time</label>
                            <input type="time" value={newShift.endTime}
                                onChange={e => setNewShift(p => ({ ...p, endTime: e.target.value }))}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
                        </div>
                    </div>
                    <div className="flex space-x-3">
                        <button onClick={addShift} className="bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2 rounded-lg">Add Shift</button>
                        <button onClick={() => setShowAdd(false)} className="text-slate-500 text-xs font-bold px-5 py-2 rounded-lg border border-slate-700">Cancel</button>
                    </div>
                </div>
            ) : (
                <button onClick={() => setShowAdd(true)}
                    className="w-full border-2 border-dashed border-slate-700 hover:border-emerald-700 text-slate-500 hover:text-emerald-400 rounded-xl py-4 text-xs font-bold transition-colors">
                    + Add New Shift
                </button>
            )}
        </div>
    );
}

// ────────────────────────── VENUES ──────────────────────────────────────
function VenuesSection({ config, token, onSave, showToast }) {
    const [venues, setVenues] = useState(config.venues);
    const [newVenue, setNewVenue] = useState({ name: '', address: '' });
    const [showAdd, setShowAdd] = useState(false);
    const [saving, setSaving] = useState(null);

    const saveVenue = async (id) => {
        setSaving(id);
        const v = venues.find(x => x.id === id);
        await api('/api/admin/config/venues', { method: 'PATCH', body: JSON.stringify({ venueId: id, data: v }) }, token);
        setSaving(null);
        showToast('Venue updated.');
        onSave();
    };

    const deleteVenue = async (id) => {
        if (!confirm('Delete this venue?')) return;
        await api(`/api/admin/config/venues/${id}`, { method: 'DELETE' }, token);
        showToast('Venue deleted.');
        onSave();
    };

    const addVenue = async () => {
        if (!newVenue.name) return;
        await api('/api/admin/config/venues', { method: 'POST', body: JSON.stringify(newVenue) }, token);
        setNewVenue({ name: '', address: '' });
        setShowAdd(false);
        showToast('Venue added.');
        onSave();
    };

    return (
        <div className="space-y-4 max-w-2xl">
            {venues.map(v => (
                <div key={v.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center space-x-2">
                            <h3 className="text-sm font-bold text-white">{v.name}</h3>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${v.active ? 'bg-emerald-900/50 text-emerald-400 border-emerald-700' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                                {v.active ? 'ACTIVE' : 'INACTIVE'}
                            </span>
                        </div>
                        <button onClick={() => deleteVenue(v.id)} className="text-[10px] text-red-500 hover:text-red-400 font-bold px-2 py-0.5 rounded border border-red-900/50">Delete</button>
                    </div>
                    <div className="grid grid-cols-1 gap-3 mb-4">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Venue Name</label>
                            <input type="text" value={v.name}
                                onChange={e => setVenues(prev => prev.map(x => x.id === v.id ? { ...x, name: e.target.value } : x))}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Address</label>
                            <input type="text" value={v.address}
                                onChange={e => setVenues(prev => prev.map(x => x.id === v.id ? { ...x, address: e.target.value } : x))}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
                        </div>
                        <div className="flex items-center space-x-3">
                            <label className="text-xs text-slate-400 font-bold">Active on booking portal:</label>
                            <button onClick={() => setVenues(prev => prev.map(x => x.id === v.id ? { ...x, active: !x.active } : x))}
                                className={`w-10 h-5 rounded-full transition-colors ${v.active ? 'bg-emerald-700' : 'bg-slate-700'}`}>
                                <div className={`w-4 h-4 bg-white rounded-full mx-0.5 transition-transform ${v.active ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>
                    </div>
                    <button onClick={() => saveVenue(v.id)} disabled={saving === v.id}
                        className="bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-5 py-2 rounded-lg transition-colors uppercase tracking-wider">
                        {saving === v.id ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            ))}

            {showAdd ? (
                <div className="bg-slate-900 border border-emerald-900/50 rounded-xl p-5 space-y-3">
                    <h3 className="text-sm font-bold text-emerald-400">Add New Venue</h3>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Name</label>
                        <input type="text" value={newVenue.name}
                            onChange={e => setNewVenue(p => ({ ...p, name: e.target.value }))}
                            placeholder="Eagle Box Cricket - East Campus"
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Address</label>
                        <input type="text" value={newVenue.address}
                            onChange={e => setNewVenue(p => ({ ...p, address: e.target.value }))}
                            placeholder="Gachibowli, Hyderabad"
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
                    </div>
                    <div className="flex space-x-3">
                        <button onClick={addVenue} className="bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2 rounded-lg">Add Venue</button>
                        <button onClick={() => setShowAdd(false)} className="text-slate-500 text-xs font-bold px-5 py-2 rounded-lg border border-slate-700">Cancel</button>
                    </div>
                </div>
            ) : (
                <button onClick={() => setShowAdd(true)}
                    className="w-full border-2 border-dashed border-slate-700 hover:border-emerald-700 text-slate-500 hover:text-emerald-400 rounded-xl py-4 text-xs font-bold transition-colors">
                    + Add New Venue
                </button>
            )}
        </div>
    );
}

// ────────────────────────── GENERAL SETTINGS ────────────────────────────
function GeneralSection({ config, token, onSave, showToast }) {
    const [totalBoxes, setTotalBoxes] = useState(config.totalPhysicalBoxes);
    const [gstRate, setGstRate] = useState(Math.round(config.gstRate * 100));
    const [securityForm, setSecurityForm] = useState({
        currentPassword: '',
        username: localStorage.getItem('ebc_admin_username') || 'admin',
        password: '',
        confirmPassword: ''
    });
    const [paymentMethods, setPaymentMethods] = useState(config.paymentMethods.join('\n'));
    const [blockedDates, setBlockedDates] = useState(config.blockedDates.join('\n'));
    const [weekendOffers, setWeekendOffers] = useState(config.weekendOffers || { enabled: false, discountPercent: 0, label: 'Weekend Offer', days: ['Saturday', 'Sunday'] });
    const [weekendDays, setWeekendDays] = useState((config.weekendOffers?.days || ['Saturday', 'Sunday']).join(', '));
    const [newDate, setNewDate] = useState('');
    const [saving, setSaving] = useState(false);

    const save = async () => {
        setSaving(true);
        await api('/api/admin/config/general', {
            method: 'PATCH',
            body: JSON.stringify({
                totalPhysicalBoxes: parseInt(totalBoxes),
                gstRate: gstRate / 100,
                paymentMethods: paymentMethods.split('\n').map(s => s.trim()).filter(Boolean),
                blockedDates: blockedDates.split('\n').map(s => s.trim()).filter(Boolean),
                weekendOffers: {
                    enabled: weekendOffers.enabled,
                    discountPercent: Number(weekendOffers.discountPercent) || 0,
                    label: weekendOffers.label,
                    days: weekendDays.split(',').map(d => d.trim()).filter(Boolean)
                }
            })
        }, token);
        setSaving(false);
        showToast('General settings saved.');
        onSave();
    };

    const updateSecurity = async () => {
        if (!securityForm.currentPassword) {
            showToast('Enter your current password to change credentials.');
            return;
        }
        if (securityForm.password && securityForm.password !== securityForm.confirmPassword) {
            showToast('New passwords do not match.');
            return;
        }

        const payload = {
            currentPassword: securityForm.currentPassword,
            username: securityForm.username.trim() || 'admin',
            password: securityForm.password || localStorage.getItem('ebc_admin_password') || ''
        };

        try {
            const result = await api('/api/admin/config/security', {
                method: 'PATCH',
                body: JSON.stringify(payload)
            }, token);
            if (result.error) {
                showToast(result.error);
                return;
            }
            localStorage.setItem('ebc_admin_username', payload.username);
            if (securityForm.password) {
                localStorage.setItem('ebc_admin_password', securityForm.password);
            }
            showToast('Admin credentials updated.');
            setSecurityForm(prev => ({ ...prev, currentPassword: '', password: '', confirmPassword: '' }));
        } catch {
            showToast('Could not update credentials.');
        }
    };

    const addBlockedDate = () => {
        if (!newDate) return;
        const current = blockedDates.split('\n').map(s => s.trim()).filter(Boolean);
        if (!current.includes(newDate)) {
            setBlockedDates([...current, newDate].join('\n'));
        }
        setNewDate('');
    };

    const removeBlockedDate = (date) => {
        const current = blockedDates.split('\n').map(s => s.trim()).filter(Boolean);
        setBlockedDates(current.filter(d => d !== date).join('\n'));
    };

    const blockedList = blockedDates.split('\n').map(s => s.trim()).filter(Boolean);

    return (
        <div className="space-y-6 max-w-lg">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-3">Capacity & Tax</h3>

                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Total Physical Box Courts</label>
                    <input type="number" value={totalBoxes} min={1} max={20}
                        onChange={e => setTotalBoxes(e.target.value)}
                        className="w-32 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-lg font-extrabold text-white" />
                    <p className="text-[10px] text-slate-500 mt-1">Max simultaneous bookings = this number per shift.</p>
                </div>

                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">GST Rate (%)</label>
                    <input type="number" value={gstRate} min={0} max={50}
                        onChange={e => setGstRate(e.target.value)}
                        className="w-32 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-lg font-extrabold text-emerald-400" />
                </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-3">Admin Security</h3>
                <p className="text-[10px] text-slate-500">Update the login credentials used by the admin panel. You can change the username and password at any time.</p>

                <div className="space-y-3">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Current Password</label>
                        <input type="password" value={securityForm.currentPassword}
                            onChange={e => setSecurityForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">New Username</label>
                        <input type="text" value={securityForm.username}
                            onChange={e => setSecurityForm(prev => ({ ...prev, username: e.target.value }))}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">New Password</label>
                            <input type="password" value={securityForm.password}
                                onChange={e => setSecurityForm(prev => ({ ...prev, password: e.target.value }))}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Confirm Password</label>
                            <input type="password" value={securityForm.confirmPassword}
                                onChange={e => setSecurityForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
                        </div>
                    </div>
                    <button onClick={updateSecurity}
                        className="bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2 rounded-lg">Update Admin Credentials</button>
                </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-3">Weekend Offers & Promotions</h3>
                <p className="text-[10px] text-slate-500">Turn on special discounts for weekends and update the offer message customers see at checkout.</p>

                <label className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/70 px-3 py-2 text-xs text-slate-200">
                    <span>Enable weekend offer</span>
                    <input
                        type="checkbox"
                        checked={weekendOffers.enabled}
                        onChange={e => setWeekendOffers(prev => ({ ...prev, enabled: e.target.checked }))}
                        className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                    />
                </label>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Discount %</label>
                        <input type="number" value={weekendOffers.discountPercent} min={0} max={100}
                            onChange={e => setWeekendOffers(prev => ({ ...prev, discountPercent: e.target.value }))}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Offer Label</label>
                        <input type="text" value={weekendOffers.label}
                            onChange={e => setWeekendOffers(prev => ({ ...prev, label: e.target.value }))}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
                    </div>
                </div>

                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Apply on Days</label>
                    <input type="text" value={weekendDays}
                        onChange={e => setWeekendDays(e.target.value)}
                        placeholder="Saturday, Sunday"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
                    <p className="text-[10px] text-slate-500 mt-1">Use day names such as Saturday, Sunday, Friday.</p>
                </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-3">Payment Methods</h3>
                <p className="text-[10px] text-slate-500">One per line. These appear as options in the customer checkout.</p>
                <textarea value={paymentMethods} onChange={e => setPaymentMethods(e.target.value)} rows={5}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono resize-none" />
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-3">Blocked Dates</h3>
                <p className="text-[10px] text-slate-500">Customers cannot book on these dates (holidays, maintenance, etc.).</p>

                <div className="flex space-x-2">
                    <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                        className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
                    <button onClick={addBlockedDate} className="bg-red-900 hover:bg-red-800 text-white text-xs font-bold px-4 py-2 rounded-lg">Block Date</button>
                </div>

                {blockedList.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {blockedList.map(d => (
                            <div key={d} className="flex items-center space-x-1 bg-red-950/50 border border-red-800/50 text-red-400 text-[11px] font-bold px-2.5 py-1 rounded-full">
                                <span>{d}</span>
                                <button onClick={() => removeBlockedDate(d)} className="text-red-500 hover:text-red-300 ml-1">×</button>
                            </div>
                        ))}
                    </div>
                ) : <p className="text-slate-600 text-xs">No dates blocked.</p>}
            </div>

            <button onClick={save} disabled={saving}
                className="bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold px-8 py-3 rounded-xl transition-colors uppercase tracking-wider">
                {saving ? 'Saving...' : 'Save All Settings'}
            </button>
        </div>
    );
}

// ────────────────────────── BOOKINGS ────────────────────────────────────
function BookingsSection({ bookings, token, onRefresh, showToast }) {
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('All');

    const filtered = bookings.filter(b => {
        const matchSearch = b.name.toLowerCase().includes(search.toLowerCase()) ||
            b.id.toLowerCase().includes(search.toLowerCase()) ||
            b.phone.includes(search);
        const matchStatus = filterStatus === 'All' || b.status === filterStatus;
        return matchSearch && matchStatus;
    }).reverse();

    const cancelBooking = async (id) => {
        if (!confirm('Cancel this booking?')) return;
        await api(`/api/admin/bookings/${id}`, { method: 'DELETE' }, token);
        showToast('Booking cancelled.');
        onRefresh();
    };

    const markAdmitted = async (id) => {
        await api(`/api/admin/bookings/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'Admitted Inside' })
        }, token);
        showToast('Marked as admitted.');
        onRefresh();
    };

    return (
        <div className="space-y-4">
            <div className="flex space-x-3">
                <input type="text" placeholder="Search by name, phone, or token..."
                    value={search} onChange={e => setSearch(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-600 focus:border-emerald-700 outline-none" />
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-bold text-slate-300">
                    <option>All</option>
                    <option>Paid & Confirmed</option>
                    <option>Admitted Inside</option>
                </select>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[700px]">
                        <thead>
                            <tr className="bg-slate-800 border-b border-slate-700 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                <th className="px-4 py-3">Token ID</th>
                                <th className="px-4 py-3">Customer</th>
                                <th className="px-4 py-3">Date / Shift</th>
                                <th className="px-4 py-3">Boxes</th>
                                <th className="px-4 py-3">Amount</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-xs">
                            {filtered.map(b => (
                                <tr key={b.id} className="hover:bg-slate-800/50 transition-colors">
                                    <td className="px-4 py-3 font-mono text-[10px] text-slate-400 select-all">{b.id}</td>
                                    <td className="px-4 py-3">
                                        <div className="font-bold text-white">{b.name}</div>
                                        <div className="text-[10px] text-slate-500">{b.phone}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="font-bold text-slate-300">{b.eventDate}</div>
                                        <div className="text-[10px] text-slate-500">{b.preferredTime}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-1">
                                            {b.boxesAllotted?.map(bx => (
                                                <span key={bx} className="bg-slate-700 text-slate-300 text-[10px] px-1.5 py-0.5 rounded font-mono font-bold">{bx}</span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 font-bold text-emerald-400">₹{b.billAmount}</td>
                                    <td className="px-4 py-3">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${b.status === 'Admitted Inside' ? 'bg-blue-950/50 text-blue-400 border-blue-800' : 'bg-emerald-950/50 text-emerald-400 border-emerald-800'}`}>
                                            {b.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex space-x-2">
                                            {b.status === 'Paid & Confirmed' && (
                                                <button onClick={() => markAdmitted(b.id)}
                                                    className="text-[10px] font-bold text-blue-400 hover:text-blue-300 border border-blue-800 hover:border-blue-600 px-2 py-0.5 rounded transition-colors">
                                                    Admit
                                                </button>
                                            )}
                                            <button onClick={() => cancelBooking(b.id)}
                                                className="text-[10px] font-bold text-red-500 hover:text-red-400 border border-red-900 hover:border-red-700 px-2 py-0.5 rounded transition-colors">
                                                Cancel
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-600 text-xs">No bookings found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ────────────────────────── GATE TERMINAL ───────────────────────────────
function GateSection({ bookings }) {
    const [scanCode, setScanCode] = useState('');
    const [output, setOutput] = useState(null);

    const scan = (e) => {
        e.preventDefault();
        const found = bookings.find(b => b.id.trim() === scanCode.trim());
        if (!found) {
            setOutput({ error: true, message: 'INVALID TOKEN: No matching booking found.' });
            return;
        }
        if (found.status === 'Admitted Inside') {
            setOutput({ error: true, message: '⚠ DUPLICATE ENTRY: This token was already used.', record: found });
            return;
        }
        // In a real gate terminal this would call the API; here we show the record
        setOutput({ success: true, message: '✓ ACCESS GRANTED — Token verified.', record: found });
    };

    return (
        <div className="max-w-md space-y-4">
            <p className="text-xs text-slate-500">Use this terminal to verify customer QR codes at the venue gate.</p>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Scan / Enter Token</h3>
                <form onSubmit={scan} className="space-y-3">
                    <input type="text" value={scanCode} onChange={e => setScanCode(e.target.value)}
                        placeholder="e.g. EBC-1234-SECURE"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 font-mono text-sm text-white placeholder-slate-600 focus:border-emerald-700 outline-none" required />
                    <button type="submit" className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs py-2.5 rounded-lg uppercase tracking-wider transition-colors">
                        Verify Token
                    </button>
                </form>

                {output && (
                    <div className={`mt-4 pt-4 border-t border-slate-800`}>
                        {output.error ? (
                            <div className="bg-red-950/50 border border-red-800 text-red-400 text-xs font-bold p-3 rounded-lg">{output.message}</div>
                        ) : (
                            <div className="bg-emerald-950/50 border border-emerald-800 rounded-lg p-4 space-y-3">
                                <div className="text-xs font-bold text-emerald-400">{output.message}</div>
                                {output.record && (
                                    <div className="text-xs space-y-1.5 font-mono">
                                        <div><span className="text-slate-500">name:</span> <span className="text-white font-sans font-bold">{output.record.name}</span></div>
                                        <div><span className="text-slate-500">date:</span> <span className="text-white">{output.record.eventDate} · {output.record.preferredTime}</span></div>
                                        <div><span className="text-slate-500">boxes:</span> {output.record.boxesAllotted?.join(', ')}</div>
                                        <div><span className="text-slate-500">paid:</span> <span className="text-emerald-400">₹{output.record.billAmount}</span></div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <button onClick={() => { setScanCode(''); setOutput(null); }}
                className="text-xs text-slate-600 hover:text-slate-400 font-bold">
                Clear
            </button>
        </div>
    );
}
