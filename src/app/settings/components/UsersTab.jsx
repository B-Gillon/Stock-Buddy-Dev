'use client';
// Settings → Users: add retailer or supplier users and send them a link to create a password.
import { useCallback, useEffect, useState } from 'react';
import { Toast, useToast } from '@/shared/components/ui/Toast';

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';
const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US') : '—');
const STATUS = {
  invited:  { label: 'Invited',  cls: 'bg-amber-100 text-amber-700' },
  active:   { label: 'Active',   cls: 'bg-green-100 text-green-700' },
  disabled: { label: 'Disabled', cls: 'bg-gray-100 text-gray-500' },
};

export default function UsersTab() {
  const { toast, showToast } = useToast();
  const [users, setUsers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ role: 'retailer', supplier_id: '', email: '' });
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/users');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Could not load users');
      setUsers(json.users); setSuppliers(json.suppliers);
    } catch (err) { showToast(err.message, 'error'); }
    finally { setLoading(false); }
  }, [showToast]);
  useEffect(() => { load(); }, [load]);

  const canAdd = form.email.trim() && (form.role === 'retailer' || form.supplier_id);

  async function add(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: form.role, supplier_id: form.role === 'supplier' ? form.supplier_id : null, email: form.email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Could not add user');
      showToast(json.emailSent ? 'User added. A link to create a password was emailed.' : 'User added, but the email could not be sent. Use Resend.', json.emailSent ? 'success' : 'warning');
      setForm({ role: form.role, supplier_id: '', email: '' });
      load();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setSaving(false); }
  }

  async function act(id, action, okMsg) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed');
      showToast(okMsg); load();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setBusyId(null); }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={add} className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-800">Add User</h2>
        <p className="mt-1 text-xs text-gray-500">The user receives an email with a link to create their password.</p>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">User Type</label>
            <select className={inputClass} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value, supplier_id: '' })}>
              <option value="retailer">Retailer</option>
              <option value="supplier">Supplier</option>
            </select>
          </div>
          {form.role === 'supplier' && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Supplier Account</label>
              <select className={inputClass} value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
                <option value="">Select supplier…</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.supplier_name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Email Address</label>
            <input type="email" className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button type="submit" disabled={!canAdd || saving}
            className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Adding…' : 'Add User & Send Email'}
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-xs text-gray-600">
              <th className="px-3 py-2 text-left font-medium">Email</th>
              <th className="px-3 py-2 text-left font-medium">Type</th>
              <th className="px-3 py-2 text-left font-medium">Supplier</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-left font-medium">Last Sign-in</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">No users yet.</td></tr>
            ) : users.map((u) => {
              const st = STATUS[u.status] ?? STATUS.invited;
              return (
                <tr key={u.id} className="border-b border-gray-100">
                  <td className="whitespace-nowrap px-3 py-2 text-gray-800">{u.email}</td>
                  <td className="px-3 py-2 text-gray-700">{u.role === 'supplier' ? 'Supplier' : 'Retailer'}</td>
                  <td className="px-3 py-2 text-gray-700">{u.supplier_name ?? '—'}</td>
                  <td className="px-3 py-2"><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span></td>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-700">{fmt(u.last_login_at)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      {u.status !== 'disabled' && (
                        <button disabled={busyId === u.id} onClick={() => act(u.id, 'resend', u.status === 'invited' ? 'Invite resent.' : 'Password reset link sent.')}
                          className="rounded border border-gray-300 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-50">
                          {u.status === 'invited' ? 'Resend Invite' : 'Send Reset Link'}
                        </button>
                      )}
                      {u.status === 'disabled' ? (
                        <button disabled={busyId === u.id} onClick={() => act(u.id, 'enable', 'User enabled.')}
                          className="rounded border border-gray-300 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-50">Enable</button>
                      ) : (
                        <button disabled={busyId === u.id} onClick={() => act(u.id, 'disable', 'User disabled.')}
                          className="rounded border border-gray-300 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50">Disable</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Toast message={toast.message} type={toast.type} />
    </div>
  );
}
