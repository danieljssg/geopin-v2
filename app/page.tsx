"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import type { Pin, PinFormData } from "@/lib/types";
import { getAllPins, addPin, deletePin, updatePin } from "@/lib/db";
import { normalizeCategory } from "@/lib/categories";
import PinForm from "@/components/PinForm";
import Drawer from "@/components/Drawer";
import PinsList from "@/components/PinsList";
import AppNavigation from "@/components/AppNavigation";
import SyncStatus from "@/components/field/SyncStatus";
import type { MapViewProps } from "@/components/MapView";

// Leaflet requires a browser environment — load with ssr:false
const MapView = dynamic<MapViewProps>(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex flex-col items-center justify-center bg-slate-100 gap-3">
      <div
        style={{
          width: 32,
          height: 32,
          border: "3px solid #1d4ed8",
          borderTopColor: "transparent",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <p className="text-sm text-slate-500 font-medium">Cargando mapa...</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  ),
});

const DEFAULT_FORM: PinFormData = {
  lat: 0,
  lng: 0,
  nombre: "",
  descripcion: "",
  categoria: "vivienda",
  usoGeneral: undefined,
  usoEspecifico: undefined,
  pisosConstruccion: undefined,
  estadoConstruccion: undefined,
  material: undefined,
  hectareasParcela: undefined,
  poblacionRango: undefined,
  drenaje: undefined,
  metrosCuadradosParcela: undefined,
  metrosCuadradosManzana: undefined,
};

type GPSStatus = "idle" | "searching" | "found" | "error" | "denied";

function pinToFormData(pin: Pin): PinFormData {
  return {
    lat: pin.lat,
    lng: pin.lng,
    nombre: pin.nombre,
    descripcion: pin.descripcion,
    categoria: normalizeCategory(pin.categoria),
    usoGeneral: pin.usoGeneral,
    usoEspecifico: pin.usoEspecifico,
    pisosConstruccion: pin.pisosConstruccion,
    estadoConstruccion: pin.estadoConstruccion,
    material: pin.material,
    hectareasParcela: pin.hectareasParcela,
    poblacionRango: pin.poblacionRango,
    drenaje: pin.drenaje,
    metrosCuadradosParcela: pin.metrosCuadradosParcela,
    metrosCuadradosManzana: pin.metrosCuadradosManzana,
  };
}

export default function Page() {
  const [formData, setFormData] = useState<PinFormData>(DEFAULT_FORM);
  const [savedPins, setSavedPins] = useState<Pin[]>([]);
  const [gpsStatus, setGpsStatus] = useState<GPSStatus>("idle");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingPinId, setEditingPinId] = useState<string | null>(null);
  const creationDraft = useRef<PinFormData>(DEFAULT_FORM);

  // Load existing pins from IndexedDB (Dexie) on mount
  useEffect(() => {
    getAllPins()
      .then((data) => setSavedPins(data))
      .catch(() => {});
  }, []);

  const handlePositionChange = useCallback((lat: number, lng: number) => {
    setFormData((prev) => ({ ...prev, lat, lng }));
  }, []);

  const handleFormChange = useCallback((data: Partial<PinFormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  }, []);

  const handleSubmit = useCallback(
    async (data: PinFormData) => {
      if (editingPinId) {
        const updatedPin = await updatePin(editingPinId, data);
        setSavedPins((prev) =>
          prev.map((pin) => (pin.id === editingPinId ? updatedPin : pin)),
        );
        setEditingPinId(null);
        setFormData(creationDraft.current);
        return;
      }

      const newPin = await addPin(data);
      setSavedPins((prev) => [...prev, newPin]);
      // Keep the position and icon category ready for the next pin.
      setFormData((prev) => ({
        ...DEFAULT_FORM,
        lat: prev.lat,
        lng: prev.lng,
        categoria: prev.categoria,
      }));
    },
    [editingPinId],
  );

  const handleEditPin = useCallback(
    (pin: Pin) => {
      if (!editingPinId) creationDraft.current = formData;
      setEditingPinId(pin.id);
      setFormData(pinToFormData(pin));
      if (window.matchMedia("(max-width: 767px)").matches) setDrawerOpen(true);
    },
    [editingPinId, formData],
  );

  const handleCancelEdit = useCallback(() => {
    setEditingPinId(null);
    setFormData(creationDraft.current);
  }, []);

  const handleDeletePin = useCallback(
    async (id: string) => {
      await deletePin(id);
      setSavedPins((prev) => prev.filter((p) => p.id !== id));
      if (id === editingPinId) handleCancelEdit();
    },
    [editingPinId, handleCancelEdit],
  );

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(savedPins, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `geopin-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [savedPins]);

  return (
    <main className="h-screen flex flex-col overflow-hidden bg-slate-50">
      <a
        href="#map-content"
        className="fixed left-3 top-3 z-1000001 -translate-y-20 rounded-md bg-white px-4 py-2 text-sm font-bold text-[#1e3a5f] shadow-lg focus:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      >
        Saltar al mapa
      </a>
      {/* ── Top header ──────────────────────────────────────── */}
      <header
        className="flex items-center gap-3 px-3 py-3 shadow-sm z-20 shrink-0 sm:px-5"
        style={{ background: "#1e3a5f" }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#60a5fa"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        <div>
          <h1 className="font-bold text-base leading-none text-white tracking-tight">
            GeoPin
          </h1>
          <p
            className="hidden text-xs leading-none mt-0.5 sm:block"
            style={{ color: "#93c5fd" }}
          >
            Sistema de marcado de establecimientos
          </p>
        </div>

        {/* GPS status pill (desktop) */}
        {gpsStatus !== "idle" && (
          <span
            className="hidden md:flex ml-3 items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
            style={{
              background:
                gpsStatus === "found"
                  ? "#14532d"
                  : gpsStatus === "searching"
                    ? "#1e3a8a"
                    : "#7f1d1d",
              color:
                gpsStatus === "found"
                  ? "#86efac"
                  : gpsStatus === "searching"
                    ? "#93c5fd"
                    : "#fca5a5",
            }}
          >            {gpsStatus === "searching" && (
              <span
                style={{
                  width: 9,
                  height: 9,
                  border: "1.5px solid currentColor",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  display: "inline-block",
                  animation: "spin 0.8s linear infinite",
                }}
              />
            )}
            {gpsStatus !== "searching" && (
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "currentColor",
                  display: "inline-block",
                }}
              />
            )}
            {gpsStatus === "found" && "GPS activo"}
            {gpsStatus === "searching" && "Buscando GPS..."}
            {gpsStatus === "error" && "GPS no disponible"}
            {gpsStatus === "denied" && "GPS denegado"}
          </span>
        )}
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div className="ml-3">
          <SyncStatus />
        </div>
        <AppNavigation active="map" />
      </header>

      {/* ── Split layout ────────────────────────────────────── */}
      <div
        id="map-content"
        tabIndex={-1}
        className="flex flex-1 overflow-hidden"
      >
        {/* Left panel — form + list (desktop) */}
        <aside
          className="hidden md:flex flex-col overflow-hidden shrink-0"
          style={{ width: 360, borderRight: "1px solid #e2e8f0" }}
        >
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 flex flex-col gap-5">
              {/* Form section */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <div
                    style={{
                      width: 4,
                      height: 16,
                      background: "#1d4ed8",
                      borderRadius: 2,
                    }}
                    aria-hidden="true"
                  />
                  <h2 className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                    {editingPinId ? "Editar pin" : "Nuevo pin"}
                  </h2>
                </div>
                <PinForm
                  key={`desktop-${editingPinId ?? "new"}`}
                  formData={formData}
                  onChange={handleFormChange}
                  onSubmit={handleSubmit}
                  gpsStatus={gpsStatus}
                  isEditing={editingPinId !== null}
                  onCancel={handleCancelEdit}
                />
              </section>

              <hr style={{ border: "none", borderTop: "1px solid #e2e8f0" }} />

              {/* Pins list section */}
              <section>
                <PinsList
                  pins={savedPins}
                  onDelete={handleDeletePin}
                  onEdit={handleEditPin}
                  onExport={handleExport}
                  onExportStart={() => setDrawerOpen(false)}
                />
              </section>
            </div>
          </div>
        </aside>

        {/* Mobile drawer (bottom) */}
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          height={"84vh"}
        >
          <div className="p-4 flex flex-col gap-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div
                  style={{
                    width: 4,
                    height: 16,
                    background: "#1d4ed8",
                    borderRadius: 2,
                  }}
                  aria-hidden="true"
                />
                <h2 className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                  {editingPinId ? "Editar pin" : "Nuevo pin"}
                </h2>
              </div>
              <div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Cerrar formulario"
                  className="p-2 rounded-md bg-rose-500"
                >
                  ✕
                </button>
              </div>
            </div>

            <section>
              <PinForm
                key={`mobile-${editingPinId ?? "new"}`}
                formData={formData}
                onChange={handleFormChange}
                onSubmit={async (d) => {
                  await handleSubmit(d);
                  setDrawerOpen(false);
                }}
                gpsStatus={gpsStatus}
                isEditing={editingPinId !== null}
                onCancel={handleCancelEdit}
              />
            </section>

            <hr style={{ border: "none", borderTop: "1px solid #e2e8f0" }} />

            <section>
              <PinsList
                pins={savedPins}
                onDelete={handleDeletePin}
                onEdit={handleEditPin}
                onExport={handleExport}
                onExportStart={() => setDrawerOpen(false)}
              />
            </section>
          </div>
        </Drawer>

        {/* Floating button (mobile) */}
        {!drawerOpen && (
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir formulario"
            className="fixed md:hidden left-1/2 -translate-x-1/2 bottom-6 bg-indigo-600 text-white rounded-full px-4 py-3 shadow-lg"
            style={{ zIndex: 1000000 }}
          >
            Añadir pin
          </button>
        )}

        {/* Right panel — map */}
        <div className="flex-1 relative overflow-hidden">
          <MapView
            lat={formData.lat}
            lng={formData.lng}
            categoria={formData.categoria}
            savedPins={savedPins.filter((pin) => pin.id !== editingPinId)}
            onPositionChange={handlePositionChange}
            onGPSStatus={(s) => setGpsStatus(s as GPSStatus)}
            onDeletePin={handleDeletePin}
            onEditPin={handleEditPin}
          />

          {/* Map hint overlay */}
          {/* <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full text-xs font-medium pointer-events-none z-[1000]"
            style={{
              background: 'rgba(15,23,42,.72)',
              color: '#e2e8f0',
              backdropFilter: 'blur(4px)',
              whiteSpace: 'nowrap',
            }}
          >
            Haz clic en el mapa o arrastra el marcador para posicionar el pin
          </div> */}
        </div>
      </div>
    </main>
  );
}
