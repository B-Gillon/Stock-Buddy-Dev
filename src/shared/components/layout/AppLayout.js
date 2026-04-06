"use client";

// /src/shared/components/AppLayout.js

import { useMemo } from "react";
import Header from "@/shared/components/layout/Header";

import {
  SearchIcon,
  FilterIcon,
  ImportIcon,
  RefreshIcon,
} from "@shopify/polaris-icons";

function IconButton({ icon: Icon, onClick, label, disabled }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      title={label}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-300 text-sm text-gray-700 transition ${
        disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-200"
      }`}
    >
      <Icon className="w-4 h-4 text-gray-700" />
      {label}
    </button>
  );
}

function PrevNextButton({ onClick, disabled, label }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`px-2 py-1 rounded-md border border-gray-300 text-sm font-medium transition ${
        disabled
          ? "opacity-40 cursor-not-allowed text-gray-400"
          : "hover:bg-gray-200 text-gray-700"
      }`}
    >
      {label}
    </button>
  );
}

export default function AppLayout({
  title,
  actions,
  paginationControls,
  showActionBar = true,
  bareLayout = false,
  children,
}) {
  const {
    pageSize,
    setPageSize,
    totalPages,
    pageLabel,
    goToPage,
    prevPage,
    nextPage,
    currentPage,
  } = useMemo(() => {
    if (!paginationControls) {
      return {
        pageSize:    20,
        setPageSize: () => {},
        totalPages:  1,
        pageLabel:   "",
        goToPage:    () => {},
        prevPage:    () => {},
        nextPage:    () => {},
        currentPage: 1,
      };
    }
    return {
      pageSize:    paginationControls.pageSize    ?? 20,
      setPageSize: paginationControls.setPageSize ?? (() => {}),
      totalPages:  paginationControls.totalPages  ?? 1,
      pageLabel:   paginationControls.pageLabel   ?? "",
      goToPage:    paginationControls.goToPage    ?? (() => {}),
      prevPage:    paginationControls.prevPage    ?? (() => {}),
      nextPage:    paginationControls.nextPage    ?? (() => {}),
      currentPage: paginationControls.currentPage ?? 1,
    };
  }, [paginationControls]);

  const paginationDisabled = !paginationControls;
  const isFirstPage = currentPage <= 1;
  const isLastPage  = currentPage >= totalPages;

  // All sync props come from actions
  const syncLabel    = actions?.syncLabel    ?? "Sync";
  const onSync       = actions?.onSync       ?? null;
  const syncing      = actions?.syncing      ?? false;
  const lastSyncedAt = actions?.lastSyncedAt ?? null;

  // Timestamp shown in the white action bar (below header)
  const syncTimestamp = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleString()
    : null;

  return (
    <div className="bg-gray-100 flex flex-col items-center py-6">

      {/* GLOBAL HEADER — sync button lives here */}
      <div className="w-full max-w-6xl mb-3">
        <Header
          pageName={title}
          syncLabel={syncLabel}
          onSync={onSync}
          syncing={syncing}
          lastSyncedAt={lastSyncedAt}
          formatTimestamp={(ts) => new Date(ts).toLocaleString()}
        />
      </div>

      {/* PAGE TITLE — gray area between header and content */}
      {title && (
        <div className="w-full max-w-6xl mb-3">
          <h1 className="text-xl font-semibold text-gray-800">{title}</h1>
        </div>
      )}

      {/* PAGE CARD WRAPPER */}
      <div className="w-full max-w-6xl">
        {bareLayout ? (
          <>
            {/* ACTION BAR — floating pill above content */}
            {(showActionBar || paginationControls) && (
              <div className="px-4 py-2 mb-2 border border-gray-300 rounded-lg bg-white">
                <div className="flex items-center justify-between w-full gap-4">
                  <div className="flex items-center gap-2">
                    {paginationControls && (
                      <>
                        <select
                          value={pageSize}
                          disabled={paginationDisabled}
                          onChange={(e) => setPageSize(Number(e.target.value))}
                          className={`border border-gray-300 rounded px-2 py-1 text-sm ${paginationDisabled ? "opacity-40 cursor-not-allowed" : ""}`}
                        >
                          {[10, 20, 50, 100].map((n) => (
                            <option key={n} value={n}>{n} per page</option>
                          ))}
                        </select>
                        <PrevNextButton onClick={prevPage} disabled={paginationDisabled || isFirstPage} label="Prev" />
                        {pageLabel && <span className="text-sm font-medium text-gray-600 px-1 whitespace-nowrap">{pageLabel}</span>}
                        <PrevNextButton onClick={nextPage} disabled={paginationDisabled || isLastPage} label="Next" />
                        <div className="flex items-center gap-1 text-sm">
                          <span>Go to</span>
                          <input type="number" min="1" max={totalPages} disabled={paginationDisabled} onKeyDown={(e) => { if (e.key === "Enter") goToPage(Number(e.target.value)); }} className={`w-16 border border-gray-300 rounded px-2 py-1 text-sm ${paginationDisabled ? "opacity-40 cursor-not-allowed" : ""}`} />
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <IconButton icon={SearchIcon} onClick={actions?.onSearch} label="Search" />
                    {actions?.columnsMenu && actions.columnsMenu}
                    <IconButton icon={FilterIcon} onClick={actions?.onFilter} label="Filter" />
                    <IconButton icon={ImportIcon} onClick={actions?.onExport} label="Export" />
                  </div>
                </div>
              </div>
            )}
            <div className="py-2">{children}</div>
          </>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-300 overflow-hidden">
            {/* PAGE ACTION BAR */}
            {(showActionBar || paginationControls) && (
              <div className="px-4 py-2 border-b border-gray-300 bg-white">
                <div className="flex items-center justify-between w-full gap-4">
                  <div className="flex items-center gap-2">
                    {paginationControls && (
                      <>
                        <select
                          value={pageSize}
                          disabled={paginationDisabled}
                          onChange={(e) => setPageSize(Number(e.target.value))}
                          className={`border border-gray-300 rounded px-2 py-1 text-sm ${paginationDisabled ? "opacity-40 cursor-not-allowed" : ""}`}
                        >
                          {[10, 20, 50, 100].map((n) => (
                            <option key={n} value={n}>{n} per page</option>
                          ))}
                        </select>
                        <PrevNextButton onClick={prevPage} disabled={paginationDisabled || isFirstPage} label="Prev" />
                        {pageLabel && <span className="text-sm font-medium text-gray-600 px-1 whitespace-nowrap">{pageLabel}</span>}
                        <PrevNextButton onClick={nextPage} disabled={paginationDisabled || isLastPage} label="Next" />
                        <div className="flex items-center gap-1 text-sm">
                          <span>Go to</span>
                          <input type="number" min="1" max={totalPages} disabled={paginationDisabled} onKeyDown={(e) => { if (e.key === "Enter") goToPage(Number(e.target.value)); }} className={`w-16 border border-gray-300 rounded px-2 py-1 text-sm ${paginationDisabled ? "opacity-40 cursor-not-allowed" : ""}`} />
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <IconButton icon={SearchIcon} onClick={actions?.onSearch} label="Search" />
                    {actions?.columnsMenu && actions.columnsMenu}
                    <IconButton icon={FilterIcon} onClick={actions?.onFilter} label="Filter" />
                    <IconButton icon={ImportIcon} onClick={actions?.onExport} label="Export" />
                  </div>
                </div>
              </div>
            )}
            <div className="px-4 py-2 bg-white">{children}</div>
          </div>
        )}
      </div>
    </div>
  );
}
