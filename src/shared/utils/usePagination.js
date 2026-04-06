"use client";

import { useState, useMemo } from "react";

export default function usePagination(data, defaultPageSize = 20) {
  const [pageSize, setPageSizeState] = useState(defaultPageSize);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(data.length / pageSize)),
    [data.length, pageSize]
  );

  function setPageSize(size) {
    setPageSizeState(size);
    setCurrentPage(1);
  }

  const safePage = Math.min(currentPage, totalPages);

  const pageData = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, safePage, pageSize]);

  function goToPage(page) {
    const clamped = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(clamped);
  }

  function prevPage() { goToPage(safePage - 1); }
  function nextPage() { goToPage(safePage + 1); }

  const start = data.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end   = Math.min(safePage * pageSize, data.length);
  const pageLabel = data.length === 0
    ? "No results"
    : `${start}–${end} of ${data.length.toLocaleString()}`;

  return {
    pageData,
    pageSize,
    setPageSize,
    currentPage: safePage,
    totalPages,
    pageLabel,
    goToPage,
    prevPage,
    nextPage,
  };
}