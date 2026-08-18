"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { Pin } from "@/lib/types";
import {
  exportAsJSON,
  exportAsCSV,
  exportAsExcel,
  type ExportFormat,
} from "@/lib/export";

interface ExportModalProps {
  isOpen: boolean;
  pins: Pin[];
  onClose: () => void;
}

function FileIcon({ format }: { format: ExportFormat }) {
  if (format === "json") {
    return (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <text x="9" y="15" fontSize="6" fontWeight="bold" fill="currentColor">
          JSON
        </text>
      </svg>
    );
  }

  if (format === "csv") {
    return (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <text x="9" y="15" fontSize="6" fontWeight="bold" fill="currentColor">
          CSV
        </text>
      </svg>
    );
  }

  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <text x="7" y="15" fontSize="6" fontWeight="bold" fill="currentColor">
        XLSX
      </text>
    </svg>
  );
}

export default function ExportModal({
  isOpen,
  pins,
  onClose,
}: ExportModalProps) {
  const [exporting, setExporting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Lock body scroll while the modal is open
  useEffect(() => {
    if (isOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [isOpen]);

  const handleExport = async (format: ExportFormat) => {
    setExporting(true);
    try {
      if (format === "json") exportAsJSON(pins);
      else if (format === "csv") exportAsCSV(pins);
      else if (format === "excel") exportAsExcel(pins);

      // Small delay for UX feedback
      await new Promise((resolve) => setTimeout(resolve, 300));
      onClose();
    } finally {
      setExporting(false);
    }
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        style={{ zIndex: 10000 }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        style={{ zIndex: 10001 }}
      >
        <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden">
          {/* Header */}
          <div className="bg-linear-to-r from-slate-900 to-slate-800 px-6 py-4">
            <h3 className="text-lg font-bold text-white">
              Elegir formato de exportación
            </h3>
          </div>

          {/* Content */}
          <div className="p-6 space-y-3">
            {/* JSON */}
            <button
              onClick={() => handleExport("json")}
              disabled={exporting}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-left group"
            >
              <div className="shrink-0 text-blue-600 group-hover:text-blue-700">
                <FileIcon format="json" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 text-sm">
                  Exportar como JSON
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Formato estructurado, fácil de importar
                </p>
              </div>
            </button>

            {/* CSV */}
            <button
              onClick={() => handleExport("csv")}
              disabled={exporting}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-green-400 hover:bg-green-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-left group"
            >
              <div className="shrink-0 text-green-600 group-hover:text-green-700">
                <FileIcon format="csv" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 text-sm">
                  Exportar como CSV
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Compatible con Excel y Sheets
                </p>
              </div>
            </button>

            {/* Excel */}
            <button
              onClick={() => handleExport("excel")}
              disabled={exporting}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-left group"
            >
              <div className="shrink-0 text-emerald-600 group-hover:text-emerald-700">
                <FileIcon format="excel" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 text-sm">
                  Exportar como Excel
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Archivo XLSX con formato automático
                </p>
              </div>
            </button>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
            <button
              onClick={onClose}
              disabled={exporting}
              className="px-4 py-2 rounded-lg font-medium text-sm text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
