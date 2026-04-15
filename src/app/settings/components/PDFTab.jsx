'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

function Label({ children }) {
  return (
    <label className="block text-xs font-medium text-gray-600 mb-1">{children}</label>
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

function SaveButton({ onClick, saving }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving}
      className="w-full mt-4 inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {saving ? 'Saving…' : 'Save Changes'}
    </button>
  );
}

// ── Logo Dropzone ─────────────────────────────────────────────────────────────
function LogoDropzone({ preview, onFile, onRemove }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped && (dropped.type === 'image/png' || dropped.type === 'image/svg+xml')) {
      onFile(dropped);
    }
  }, [onFile]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`w-full border-2 border-dashed rounded-lg transition-colors flex flex-col items-center justify-center text-center ${
        dragging
          ? 'border-blue-400 bg-blue-50'
          : preview
            ? 'border-gray-200 bg-white'
            : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100 cursor-pointer'
      }`}
      style={{ minHeight: '160px' }}
      onClick={() => !preview && inputRef.current?.click()}
    >
      {preview ? (
        <div className="p-4 flex flex-col items-center gap-3 w-full">
          <img src={preview} alt="Logo preview" className="max-h-24 max-w-full object-contain" />
          <div className="flex gap-2">
            <button type="button"
              onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
              className="px-3 py-1 text-xs font-medium border border-gray-300 text-gray-600 rounded-md hover:bg-gray-50 transition-colors">
              Replace
            </button>
            <button type="button"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="px-3 py-1 text-xs font-medium border border-gray-200 text-gray-900 rounded-md hover:bg-gray-50 transition-colors">
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div className="p-6 space-y-2">
          <svg className="mx-auto h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-xs text-gray-500">Drag and drop your logo here, or</p>
          {/* Format guidance */}
          <p className="text-xs text-gray-400">
            PNG or SVG · Max 1 MB · Recommended: 300 × 100 px (horizontal)
          </p>
          <button type="button"
            onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors">
            Upload Logo
          </button>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/png,image/svg+xml" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
    </div>
  );
}

// ── PDF Tab ───────────────────────────────────────────────────────────────────
export default function PDFTab() {
  const [logoFile,      setLogoFile]      = useState(null);
  const [logoPreview,   setLogoPreview]   = useState(null);
  const [contactName,   setContactName]   = useState('');
  const [contactEmail,  setContactEmail]  = useState('');
  const [contactPhone,  setContactPhone]  = useState('');
  const [savingLogo,    setSavingLogo]    = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [logoStatus,    setLogoStatus]    = useState(null);
  const [contactStatus, setContactStatus] = useState(null);

  // Load existing settings and check for logo on mount
  useEffect(() => {
    async function load() {
      const res  = await fetch('/api/settings?keys=pdf.contact_name,pdf.contact_email,pdf.contact_phone');
      const data = await res.json();
      setContactName(data['pdf.contact_name']  || '');
      setContactEmail(data['pdf.contact_email'] || '');
      setContactPhone(data['pdf.contact_phone'] || '');
    }
    load();

    // Check if a logo already exists on the server
    fetch('/logo.png', { method: 'HEAD' })
      .then(r => { if (r.ok) setLogoPreview('/logo.png?t=' + Date.now()); })
      .catch(() => {});
  }, []);

  function handleLogoFile(file) {
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setLogoStatus(null);
  }

  function handleLogoRemove() {
    setLogoFile(null);
    setLogoPreview(null);
    setLogoStatus(null);
  }

  async function handleSaveLogo() {
    if (!logoFile) return;
    setSavingLogo(true);
    setLogoStatus(null);
    try {
      const form = new FormData();
      form.append('logo', logoFile);
      const res = await fetch('/api/settings/logo', { method: 'POST', body: form });
      if (!res.ok) throw new Error('Upload failed');
      setLogoStatus('saved');
      setLogoFile(null);
    } catch {
      setLogoStatus('error');
    } finally {
      setSavingLogo(false);
    }
  }

  async function handleSaveContact() {
    setSavingContact(true);
    setContactStatus(null);
    try {
      const res = await fetch('/api/settings', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          'pdf.contact_name':  contactName,
          'pdf.contact_email': contactEmail,
          'pdf.contact_phone': contactPhone,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      setContactStatus('saved');
    } catch {
      setContactStatus('error');
    } finally {
      setSavingContact(false);
    }
  }

  function handleOpenPreview() {
    window.open('/api/settings/pdf-preview', '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="flex gap-4 items-stretch" style={{ minHeight: '600px' }}>

      {/* ── Left column ── */}
      <div className="flex flex-col gap-4" style={{ width: '25%', minWidth: '200px' }}>

        {/* Logo card */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex flex-col">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Logo</h3>
          <LogoDropzone preview={logoPreview} onFile={handleLogoFile} onRemove={handleLogoRemove} />
          {logoStatus === 'saved' && <p className="text-xs text-green-600 mt-2 text-center">Logo saved.</p>}
          {logoStatus === 'error' && <p className="text-xs text-red-600 mt-2 text-center">Upload failed.</p>}
          <button
            type="button"
            onClick={handleSaveLogo}
            disabled={!logoFile || savingLogo}
            className="w-full mt-3 inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {savingLogo ? 'Uploading…' : 'Upload Logo'}
          </button>
        </div>

        {/* Contact Info card */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex flex-col flex-1">
          <h3 className="text-sm font-semibold text-gray-800 mb-1">Contact Info</h3>
          <p className="text-xs text-gray-500 mb-3">Appears in the Contact Info section of generated PDFs.</p>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Purchasing Dept." />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="orders@company.com" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="(555) 123-4567" />
            </div>
          </div>
          {contactStatus === 'saved' && <p className="text-xs text-green-600 mt-2">Saved.</p>}
          {contactStatus === 'error' && <p className="text-xs text-red-600 mt-2">Save failed.</p>}
          <SaveButton onClick={handleSaveContact} saving={savingContact} />
        </div>

      </div>

      {/* ── Right card: Preview ── */}
      <div className="flex-1 bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-800">PDF Preview</h3>
        </div>

        {/* Replace broken iframe with a simple open-in-new-tab prompt.
            Iframes are blocked by the app's security headers when the page
            tries to embed itself — opening in a new tab bypasses this cleanly. */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-gray-200 bg-gray-50">
          <svg className="h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-gray-700">Preview your PO PDF</p>
            <p className="text-xs text-gray-400">Opens a sample PDF in a new tab using your current logo and contact info.</p>
          </div>
          <button
            type="button"
            onClick={handleOpenPreview}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Open Preview
          </button>
          <p className="text-xs text-gray-400">
            Save your logo and contact info first, then click Open Preview to see the latest version.
          </p>
        </div>
      </div>

    </div>
  );
}
