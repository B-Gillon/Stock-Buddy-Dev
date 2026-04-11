"use client";

import { useState, useRef } from "react";
import Button from "@/shared/components/ui/Button";

export default function CsvImportModal({ isOpen, onClose, onImportComplete }) {
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    setFile(e.target.files[0] || null);
    setResult(null);
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/location-product-data/import", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Import failed");
      setResult(json);
      if (json.errors?.length === 0) {
        onImportComplete(json);
      }
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setImporting(false);
    }
  };

  const handleDone = () => {
    if (result && !result.error) {
      onImportComplete(result);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Import Bin Locations (CSV)</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Format description */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4 text-sm text-gray-600">
          <p className="font-medium text-gray-700 mb-1">Required CSV columns:</p>
          <code className="text-xs text-gray-600">sku, location_name, bin_location</code>
          <p className="mt-2 text-xs text-gray-500">
            Rows are matched by SKU and location name. Missing bin_location clears the field.
            Rows with invalid SKUs or location names are skipped and reported.
          </p>
        </div>

        {/* File picker */}
        <div className="mb-4">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded file:border file:border-gray-300 file:text-sm file:bg-white file:text-gray-700 hover:file:bg-gray-50 cursor-pointer"
          />
        </div>

        {/* Result */}
        {result && (
          <div className="mb-4">
            {result.error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                {result.error}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-700">
                  {result.imported} row{result.imported !== 1 ? "s" : ""} imported successfully.
                </div>
                {result.errors?.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-sm text-yellow-800 max-h-40 overflow-y-auto">
                    <p className="font-medium mb-1">{result.errors.length} row(s) skipped:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      {result.errors.map((e, i) => (
                        <li key={i} className="text-xs">{e}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          {result && !result.error ? (
            <Button variant="primary" size="sm" onClick={handleDone}>
              Done
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={handleImport}
              disabled={!file || importing}
            >
              {importing ? "Importing..." : "Import"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
