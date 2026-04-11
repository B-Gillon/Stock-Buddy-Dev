'use client';

import { useState, useEffect } from 'react';
import AppLayout from '@/shared/components/layout/AppLayout';
import PDFTab from './PDFTab';
import CSVTab from './CSVTab';

// ── Shared UI helpers ──────────────────────────────────────────────────────────

function Label({ children, required }) {
  return (
    <label className="block text-sm font-medium text-gray-700 mb-1.5">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 transition-colors ${className}`}
      {...props}
    />
  );
}

function Textarea({ className = '', ...props }) {
  return (
    <textarea
      className={`w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 transition-colors resize-none ${className}`}
      {...props}
    />
  );
}

function Select({ children, className = '', ...props }) {
  return (
    <select
      className={`w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 transition-colors ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

function SaveButton({ onClick, saving }) {
  return (
    <div className="pt-6 border-t border-gray-100 flex justify-end">
      <button
        type="button"
        onClick={onClick}
        disabled={saving}
        className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  );
}

// ── Default email content ──────────────────────────────────────────────────────

const DEFAULT_EMAIL_SUBJECT = 'Purchase Order {{po_number}}';
const DEFAULT_EMAIL_BODY = `Dear {{supplier_name}},

Please find attached Purchase Order {{po_number}}.

PO Date: {{po_date}}
Expected Date: {{expected_date}}

Please confirm receipt of this order.

Thank you,
Stock Buddy`;

// ── Tab: Email ─────────────────────────────────────────────────────────────────

function EmailTab() {
  const [saving,      setSaving]      = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [saveStatus,  setSaveStatus]  = useState(null); // 'saved' | 'error'
  const [subject,     setSubject]     = useState(DEFAULT_EMAIL_SUBJECT);
  const [body,        setBody]        = useState(DEFAULT_EMAIL_BODY);
  const [replyTo,     setReplyTo]     = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch('/api/settings?keys=email.subject,email.body,email.reply_to');
        const data = await res.json();
        if (data['email.subject'])  setSubject(data['email.subject']);
        if (data['email.body'])     setBody(data['email.body']);
        if (data['email.reply_to']) setReplyTo(data['email.reply_to']);
      } catch (e) {
        console.error('Failed to load email settings:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function handleReset() {
    setSubject(DEFAULT_EMAIL_SUBJECT);
    setBody(DEFAULT_EMAIL_BODY);
  }

  async function handleSave() {
    setSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch('/api/settings', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          'email.subject':  subject,
          'email.body':     body,
          'email.reply_to': replyTo,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveStatus(null), 3000);
    }
  }

  const renderedSubject = subject
    .replace('{{po_number}}', 'PO-20260402-5181')
    .replace('{{supplier_name}}', 'Brandon Supplier');

  const renderedBody = body
    .replace(/{{po_number}}/g, 'PO-20260402-5181')
    .replace(/{{supplier_name}}/g, 'Brandon Supplier')
    .replace(/{{po_date}}/g, '4/2/2026')
    .replace(/{{expected_date}}/g, '4/15/2026');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <svg className="animate-spin h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <span className="ml-2 text-sm text-gray-500">Loading settings…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      <div className="bg-blue-50 border border-blue-100 rounded-md px-4 py-3">
        <p className="text-xs text-blue-700 font-medium mb-1">Available template variables</p>
        <p className="text-xs text-blue-600 font-mono">
          {'{{po_number}}  {{supplier_name}}  {{po_date}}  {{expected_date}}'}
        </p>
      </div>

      <div>
        <Label>Email Subject Template</Label>
        <Input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>

      <div>
        <Label>Email Body Template</Label>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} />
      </div>

      <div>
        <Label>Reply-To Email Address</Label>
        <Input
          type="email"
          value={replyTo}
          onChange={(e) => setReplyTo(e.target.value)}
          placeholder="e.g. purchasing@company.com"
          className="max-w-sm"
        />
        <p className="text-xs text-gray-500 mt-1">
          If set, supplier replies will go to this address instead of the sender.
        </p>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button type="button" onClick={handleReset}
          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-50 transition-colors">
          Reset to Default
        </button>
        <button type="button" onClick={() => setPreviewOpen(true)}
          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-50 transition-colors">
          Preview Email
        </button>
        {saveStatus === 'saved' && (
          <span className="text-xs text-green-600 font-medium">Saved</span>
        )}
        {saveStatus === 'error' && (
          <span className="text-xs text-red-600 font-medium">Save failed</span>
        )}
      </div>

      <SaveButton onClick={handleSave} saving={saving} />

      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPreviewOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">Email Preview</h3>
              <button type="button" onClick={() => setPreviewOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="bg-gray-50 rounded-md px-4 py-3 border border-gray-200">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Subject</p>
                <p className="text-sm text-gray-900 font-medium">{renderedSubject}</p>
              </div>
              <div className="bg-gray-50 rounded-md px-4 py-3 border border-gray-200">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2">Body</p>
                <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans">{renderedBody}</pre>
              </div>
              {replyTo && (
                <p className="text-xs text-gray-500">Reply-To: <span className="text-gray-700">{replyTo}</span></p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
              <button type="button" onClick={() => setPreviewOpen(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab: Purchase Orders ───────────────────────────────────────────────────────

function PurchaseOrdersTab({ poNextNumber: initialPoNextNumber }) {
  const [saving, setSaving]             = useState(false);
  const [saveError, setSaveError]       = useState(null);
  const [poFormat, setPoFormat]         = useState('PO-{DATE}-{NUM}');
  const [nextPoNumber, setNextPoNumber] = useState('');
  const poNumberLocked                  = !!initialPoNextNumber;

  async function handleSave() {
    if (!poNumberLocked && (!nextPoNumber || parseInt(nextPoNumber, 10) < 1)) {
      setSaveError('Please enter a valid starting PO number.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const payload = { po_format: poFormat };
      if (!poNumberLocked) payload.po_next_number = String(parseInt(nextPoNumber, 10));
      const res = await fetch('/api/settings', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to save settings.');
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const displayNextNumber = poNumberLocked ? initialPoNextNumber : (nextPoNumber || '1');

  return (
    <div className="space-y-8">

      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-1">PO Number Format</h3>
        <p className="text-xs text-gray-500 mb-3">
          Define the format for generated PO numbers. Use{' '}
          <code className="bg-gray-100 px-1 rounded text-xs">{'{DATE}'}</code> for the current date and{' '}
          <code className="bg-gray-100 px-1 rounded text-xs">{'{NUM}'}</code> for the sequence number.
        </p>
        <div className="max-w-sm">
          <Input type="text" value={poFormat} onChange={(e) => setPoFormat(e.target.value)} placeholder="e.g. PO-{DATE}-{NUM}" />
        </div>
        {poFormat && (
          <p className="text-xs text-gray-500 mt-2">
            Example: <span className="font-mono text-gray-700">
              {poFormat
                .replace('{DATE}', new Date().toISOString().slice(0, 10).replace(/-/g, ''))
                .replace('{NUM}', String(displayNextNumber).padStart(4, '0'))
              }
            </span>
          </p>
        )}
      </div>

      <div className="border-t border-gray-100" />

      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-1">Next PO Number</h3>
        <p className="text-xs text-gray-500 mb-3">
          Set the starting sequence number for PO generation. This can only be set once and cannot be changed after saving.
        </p>
        <div className="max-w-xs">
          {poNumberLocked ? (
            <div className="flex items-center gap-2">
              <p className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-md text-sm text-gray-500 w-full">
                {String(initialPoNextNumber).padStart(4, '0')}
              </p>
              <span className="text-xs text-gray-400 whitespace-nowrap">Locked</span>
            </div>
          ) : (
            <Input
              type="number"
              min="1"
              value={nextPoNumber}
              onChange={(e) => setNextPoNumber(e.target.value)}
              placeholder="e.g. 1000"
            />
          )}
        </div>
        {!poNumberLocked && (
          <p className="text-xs text-amber-600 mt-2">
            ⚠ Once saved, this value cannot be changed.
          </p>
        )}
      </div>

      {saveError && <p className="text-sm text-red-600">{saveError}</p>}

      {!poNumberLocked && <SaveButton onClick={handleSave} saving={saving} />}

    </div>
  );
}

// ── Main Settings component ────────────────────────────────────────────────────

const TABS = ['PDF', 'CSV', 'Email', 'Purchase Orders'];

export default function SettingsClient({ suppliers, locations, poNextNumber }) {
  const [activeTab, setActiveTab] = useState('PDF');

  return (
    <AppLayout title="Settings" showActionBar={false} bareLayout={true}>
      <div className="space-y-4">

        {/* Tab bar */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex gap-0">
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        {activeTab === 'PDF' ? (
          <PDFTab />
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-8 py-7">
            {activeTab === 'CSV'             && <CSVTab />}
            {activeTab === 'Email'           && <EmailTab />}
            {activeTab === 'Purchase Orders' && <PurchaseOrdersTab poNextNumber={poNextNumber} />}
          </div>
        )}

      </div>
    </AppLayout>
  );
}
