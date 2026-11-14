import React, { useEffect, useMemo, useState } from 'react';
import {
  MapPin,
  Layers,
  Wind,
  Users,
  Plus,
  Compass,
  Building2,
  Thermometer,
  Droplets,
  Gauge,
  ChevronRight,
  Trash2,
  CheckCircle2,
  X,
  HardHat,
  Sparkles,
} from 'lucide-react';
import {
  MiningSite,
  MiningSector,
  NavigationTab,
  WorkerAssignment,
} from '../types';
import { EXTERNAL_WEATHER } from '../data/mockData';
import {
  CHILE_REGIONS,
  PRELOADED_CREWS,
  PRELOADED_FAENA_PRESETS,
} from '../data/chileGeography';
import { soundAlert } from '../services/audioAlert';

interface MiningSectorsViewProps {
  currentSite: MiningSite;
  allSites: MiningSite[];
  assignments?: WorkerAssignment[];
  onSelectSite: (siteId: string) => void;
  onAddSite: (newSite: MiningSite) => void;
  onUpdateSite?: (updatedSite: MiningSite) => void;
  onNavigateTab: (tab: NavigationTab) => void;
}

interface DraftSectorForm {
  tempId: string;
  name: string;
  code: string;
  depthMeters: number;
  type: MiningSector['type'];
  activeWorkers: number;
  sensorsCount: number;
  ventilationFanStatus: MiningSector['ventilationFanStatus'];
  assignedCrew: string;
  customCrew: string;
}

const SECTOR_TYPE_LABELS: Record<MiningSector['type'], string> = {
  socavon: 'Socavón / Rampa',
  galeria_extraccion: 'Galería de Extracción',
  piquepal: 'Pique / Traspaso',
  taller_mantencion: 'Taller de Mantención',
  chimenea_ventilacion: 'Chimenea de Ventilación',
};

function createEmptyDraftSector(index: number): DraftSectorForm {
  return {
    tempId: `draft-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
    name: index === 0 ? 'Nivel Principal 1' : `Sector Operativo ${index + 1}`,
    code: `SEC-0${index + 1}`,
    depthMeters: 200 + index * 80,
    type: 'socavon',
    activeWorkers: 12,
    sensorsCount: 4,
    ventilationFanStatus: 'operativo_normal',
    assignedCrew: '',
    customCrew: '',
  };
}

export const MiningSectorsView: React.FC<MiningSectorsViewProps> = ({
  currentSite,
  allSites,
  assignments = [],
  onSelectSite,
  onAddSite,
  onUpdateSite,
  onNavigateTab,
}) => {
  const [selectedSectorId, setSelectedSectorId] = useState<string>(
    currentSite.activeSectors[0]?.id || ''
  );
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Modals visibility
  const [showAddSiteModal, setShowAddSiteModal] = useState(false);
  const [showAddSectorModal, setShowAddSectorModal] = useState(false);
  const [showAssignCrewModal, setShowAssignCrewModal] = useState(false);

  // Sync selectedSectorId when switching faena
  useEffect(() => {
    if (!currentSite.activeSectors.some((s) => s.id === selectedSectorId)) {
      setSelectedSectorId(currentSite.activeSectors[0]?.id || '');
    }
  }, [currentSite, selectedSectorId]);

  const showToast = (msg: string) => {
    setStatusNotice(msg);
    setTimeout(() => {
      setStatusNotice((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  // All available crews (from Equipos assignments + already assigned in sites + preloaded Chilean mining crews)
  const availableCrews = useMemo(() => {
    const set = new Set<string>(PRELOADED_CREWS);
    assignments.forEach((a) => {
      if (a.crew?.trim()) set.add(a.crew.trim());
    });
    allSites.forEach((site) => {
      site.activeSectors.forEach((sec) => {
        (sec.assignedCrews || []).forEach((c) => {
          if (c?.trim()) set.add(c.trim());
        });
      });
    });
    return Array.from(set);
  }, [assignments, allSites]);

  // Preset templates not yet registered in allSites
  const availablePresetsToQuickLoad = useMemo(() => {
    const existingNames = new Set(allSites.map((s) => s.name.trim().toLowerCase()));
    return PRELOADED_FAENA_PRESETS.filter(
      (p) => !existingNames.has(p.name.trim().toLowerCase())
    );
  }, [allSites]);

  // ---------------------------------------------------------------------------
  // MODAL 1 STATE: REGISTRAR NUEVA FAENA MINERA
  // ---------------------------------------------------------------------------
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [newName, setNewName] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [newRegion, setNewRegion] = useState<string>('Atacama');
  const [newComuna, setNewComuna] = useState<string>('Tierra Amarilla');
  const [customComuna, setCustomComuna] = useState<string>('');
  const [newType, setNewType] = useState<'subterranea' | 'rajo_abierto' | 'mixta'>('subterranea');
  const [newElevation, setNewElevation] = useState<number>(2400);
  const [draftSiteSectors, setDraftSiteSectors] = useState<DraftSectorForm[]>([
    createEmptyDraftSector(0),
  ]);

  const selectedRegionObj = useMemo(
    () => CHILE_REGIONS.find((r) => r.name === newRegion) || CHILE_REGIONS[3],
    [newRegion]
  );

  const handleRegionChange = (regionName: string) => {
    setNewRegion(regionName);
    const regionData = CHILE_REGIONS.find((r) => r.name === regionName);
    if (regionData && regionData.comunas.length > 0) {
      setNewComuna(regionData.comunas[0]);
      setCustomComuna('');
    } else {
      setNewComuna('__custom__');
    }
  };

  const handleApplyFaenaPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    if (!presetId) {
      return;
    }

    // Check if matching an already-entered faena or a preloaded Chile preset
    const existingSite = allSites.find((s) => s.id === presetId);
    if (existingSite) {
      setNewName(`${existingSite.name} (Copia)`);
      setNewCompany(existingSite.company);
      const matchedRegion =
        CHILE_REGIONS.find(
          (r) => r.name.toLowerCase() === existingSite.region.toLowerCase()
        )?.name || CHILE_REGIONS[2].name;
      setNewRegion(matchedRegion);
      const regionData = CHILE_REGIONS.find((r) => r.name === matchedRegion);
      const targetComuna = existingSite.comuna || existingSite.location.split(',')[0].trim();
      if (regionData?.comunas.includes(targetComuna)) {
        setNewComuna(targetComuna);
        setCustomComuna('');
      } else {
        setNewComuna('__custom__');
        setCustomComuna(targetComuna);
      }
      setNewType(existingSite.type);
      setNewElevation(existingSite.elevationMsl || 2400);
      setDraftSiteSectors(
        existingSite.activeSectors.map((sec, idx) => ({
          tempId: `copy-${Date.now()}-${idx}`,
          name: sec.name,
          code: sec.code,
          depthMeters: sec.depthMeters,
          type: sec.type,
          activeWorkers: sec.activeWorkers,
          sensorsCount: sec.sensorsCount,
          ventilationFanStatus: sec.ventilationFanStatus,
          assignedCrew: sec.assignedCrews?.[0] || '',
          customCrew: '',
        }))
      );
      return;
    }

    const preset = PRELOADED_FAENA_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setNewName(preset.name);
      setNewCompany(preset.company);
      setNewRegion(preset.region);
      const regionData = CHILE_REGIONS.find((r) => r.name === preset.region);
      if (regionData?.comunas.includes(preset.comuna)) {
        setNewComuna(preset.comuna);
        setCustomComuna('');
      } else {
        setNewComuna('__custom__');
        setCustomComuna(preset.comuna);
      }
      setNewType(preset.type);
      setNewElevation(preset.elevationMsl);
      setDraftSiteSectors(
        preset.sectors.map((sec, idx) => ({
          tempId: `preset-${Date.now()}-${idx}`,
          name: sec.name,
          code: sec.code,
          depthMeters: sec.depthMeters,
          type: sec.type,
          activeWorkers: sec.activeWorkers,
          sensorsCount: sec.sensorsCount,
          ventilationFanStatus: sec.ventilationFanStatus,
          assignedCrew: sec.assignedCrews?.[0] || '',
          customCrew: '',
        }))
      );
    }
  };

  const resetAddSiteForm = () => {
    setSelectedPresetId('');
    setNewName('');
    setNewCompany('');
    setNewRegion('Atacama');
    setNewComuna('Tierra Amarilla');
    setCustomComuna('');
    setNewType('subterranea');
    setNewElevation(2400);
    setDraftSiteSectors([createEmptyDraftSector(0)]);
  };

  const handleCreateSite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newCompany.trim()) return;

    const finalComuna =
      newComuna === '__custom__' ? customComuna.trim() || 'Sector Minero' : newComuna;
    const timestamp = Date.now();

    const sectors: MiningSector[] = draftSiteSectors
      .filter((s) => s.name.trim() !== '')
      .map((draft, idx) => {
        const crewName =
          draft.assignedCrew === '__custom__'
            ? draft.customCrew.trim()
            : draft.assignedCrew.trim();
        return {
          id: `sec-${timestamp}-${idx + 1}`,
          name: draft.name.trim(),
          code: draft.code.trim() || `SEC-0${idx + 1}`,
          depthMeters: Number(draft.depthMeters) || 200,
          type: draft.type,
          activeWorkers: Number(draft.activeWorkers) || 0,
          sensorsCount: Number(draft.sensorsCount) || 1,
          generalStatus: 'normal',
          ventilationFanStatus: draft.ventilationFanStatus,
          assignedCrews: crewName ? [crewName] : [],
        };
      });

    const newSite: MiningSite = {
      id: `site-${timestamp}`,
      name: newName.trim(),
      company: newCompany.trim(),
      comuna: finalComuna,
      location: `${finalComuna}, Región de ${newRegion}`,
      region: newRegion,
      type: newType,
      elevationMsl: Number(newElevation) || 2400,
      isPreloaded: false,
      activeSectors:
        sectors.length > 0
          ? sectors
          : [
              {
                id: `sec-${timestamp}-1`,
                name: 'Nivel Principal 1',
                code: 'NV-01',
                depthMeters: 200,
                type: 'socavon',
                activeWorkers: 12,
                sensorsCount: 4,
                generalStatus: 'normal',
                ventilationFanStatus: 'operativo_normal',
                assignedCrews: [],
              },
            ],
    };

    onAddSite(newSite);
    setSelectedSectorId(newSite.activeSectors[0]?.id || '');
    soundAlert.playFeedbackBeep();
    setShowAddSiteModal(false);
    resetAddSiteForm();
    showToast(`Faena "${newSite.name}" registrada con ${newSite.activeSectors.length} sector(es).`);
  };

  // ---------------------------------------------------------------------------
  // MODAL 2 STATE: CREAR SECTORES EN FAENA ACTUAL (1 O MÁS SECTORES)
  // ---------------------------------------------------------------------------
  const [newSectorsQueue, setNewSectorsQueue] = useState<DraftSectorForm[]>([
    createEmptyDraftSector(0),
  ]);

  const openAddSectorModal = () => {
    const nextIdx = currentSite.activeSectors.length;
    setNewSectorsQueue([
      {
        ...createEmptyDraftSector(nextIdx),
        name: `Galería / Nivel ${nextIdx + 1}`,
        code: `SEC-${String(nextIdx + 1).padStart(2, '0')}`,
      },
    ]);
    setShowAddSectorModal(true);
  };

  const handleSaveNewSectors = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateSite) return;
    const baseTs = Date.now();
    const createdSectors: MiningSector[] = newSectorsQueue
      .filter((s) => s.name.trim() !== '')
      .map((draft, idx) => {
        const crewName =
          draft.assignedCrew === '__custom__'
            ? draft.customCrew.trim()
            : draft.assignedCrew.trim();
        return {
          id: `sec-${baseTs}-${idx + 1}`,
          name: draft.name.trim(),
          code: draft.code.trim() || `SEC-${currentSite.activeSectors.length + idx + 1}`,
          depthMeters: Number(draft.depthMeters) || 200,
          type: draft.type,
          activeWorkers: Number(draft.activeWorkers) || 0,
          sensorsCount: Number(draft.sensorsCount) || 1,
          generalStatus: 'normal',
          ventilationFanStatus: draft.ventilationFanStatus,
          assignedCrews: crewName ? [crewName] : [],
        };
      });

    if (createdSectors.length === 0) return;

    const updatedSite: MiningSite = {
      ...currentSite,
      activeSectors: [...currentSite.activeSectors, ...createdSectors],
    };

    onUpdateSite(updatedSite);
    setSelectedSectorId(createdSectors[0].id);
    soundAlert.playFeedbackBeep();
    setShowAddSectorModal(false);
    showToast(
      `Se crearon ${createdSectors.length} sector(es) nuevo(s) en "${currentSite.name}".`
    );
  };

  // ---------------------------------------------------------------------------
  // MODAL 3 STATE: ASIGNAR CUADRILLA A 1 O MÁS SECTORES
  // ---------------------------------------------------------------------------
  const [crewSelectionMode, setCrewSelectionMode] = useState<'existing' | 'custom'>('existing');
  const [selectedCrewName, setSelectedCrewName] = useState<string>(PRELOADED_CREWS[0]);
  const [customCrewName, setCustomCrewName] = useState<string>('');
  const [targetSectorIds, setTargetSectorIds] = useState<string[]>([]);
  const [workersToAddIfZero, setWorkersToAddIfZero] = useState<number>(8);

  const openAssignCrewModal = (preselectedSectorIds?: string[]) => {
    const firstCrew = availableCrews[0] || PRELOADED_CREWS[0];
    setCrewSelectionMode('existing');
    setSelectedCrewName(firstCrew);
    setCustomCrewName('');
    setTargetSectorIds(
      preselectedSectorIds && preselectedSectorIds.length > 0
        ? preselectedSectorIds
        : selectedSectorId
        ? [selectedSectorId]
        : currentSite.activeSectors[0]
        ? [currentSite.activeSectors[0].id]
        : []
    );
    setShowAssignCrewModal(true);
  };

  const toggleTargetSector = (sectorId: string) => {
    setTargetSectorIds((prev) =>
      prev.includes(sectorId) ? prev.filter((id) => id !== sectorId) : [...prev, sectorId]
    );
  };

  const handleAssignCrewToSectors = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateSite) return;

    const finalCrew =
      crewSelectionMode === 'custom' ? customCrewName.trim() : selectedCrewName.trim();
    if (!finalCrew || targetSectorIds.length === 0) return;

    const updatedSectors = currentSite.activeSectors.map((sector) => {
      if (!targetSectorIds.includes(sector.id)) return sector;
      const existingCrews = sector.assignedCrews || [];
      const nextCrews = existingCrews.includes(finalCrew)
        ? existingCrews
        : [...existingCrews, finalCrew];
      const nextWorkers =
        sector.activeWorkers === 0 && workersToAddIfZero > 0
          ? workersToAddIfZero
          : sector.activeWorkers;
      return {
        ...sector,
        assignedCrews: nextCrews,
        activeWorkers: nextWorkers,
      };
    });

    onUpdateSite({
      ...currentSite,
      activeSectors: updatedSectors,
    });
    soundAlert.playFeedbackBeep();
    setShowAssignCrewModal(false);
    showToast(
      `Cuadrilla "${finalCrew}" asignada a ${targetSectorIds.length} sector(es) de la faena.`
    );
  };

  const handleRemoveCrewFromSector = (sectorId: string, crewToRemove: string) => {
    if (!onUpdateSite) return;
    const updatedSectors = currentSite.activeSectors.map((sector) => {
      if (sector.id !== sectorId) return sector;
      return {
        ...sector,
        assignedCrews: (sector.assignedCrews || []).filter((c) => c !== crewToRemove),
      };
    });
    onUpdateSite({
      ...currentSite,
      activeSectors: updatedSectors,
    });
    soundAlert.playFeedbackBeep();
    showToast(`Cuadrilla "${crewToRemove}" desvinculada del sector.`);
  };

  const handleHeaderSiteSelect = (value: string) => {
    if (value.startsWith('__preset__::')) {
      const presetId = value.replace('__preset__::', '');
      const preset = PRELOADED_FAENA_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;
      const ts = Date.now();
      const loadedSite: MiningSite = {
        id: `site-${preset.id}`,
        name: preset.name,
        company: preset.company,
        comuna: preset.comuna,
        location: `${preset.comuna}, Región de ${preset.region}`,
        region: preset.region,
        type: preset.type,
        elevationMsl: preset.elevationMsl,
        isPreloaded: true,
        activeSectors: preset.sectors.map((sec, idx) => ({
          ...sec,
          id: `sec-${preset.id}-${ts}-${idx + 1}`,
        })),
      };
      onAddSite(loadedSite);
      setSelectedSectorId(loadedSite.activeSectors[0]?.id || '');
      soundAlert.playFeedbackBeep();
      showToast(`Faena precargada "${loadedSite.name}" activada con ${loadedSite.activeSectors.length} sectores.`);
      return;
    }

    onSelectSite(value);
    soundAlert.playFeedbackBeep();
  };

  const selectedSector =
    currentSite.activeSectors.find((s) => s.id === selectedSectorId) ||
    currentSite.activeSectors[0];

  const totalAssignedCrewsInSite = useMemo(() => {
    const crewSet = new Set<string>();
    currentSite.activeSectors.forEach((sec) => {
      (sec.assignedCrews || []).forEach((c) => crewSet.add(c));
    });
    return crewSet.size;
  }, [currentSite]);

  return (
    <div className="space-y-6">
      {statusNotice && (
        <div className="bg-emerald-950/80 border border-emerald-700/80 text-emerald-200 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{statusNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusNotice(null)}
            className="text-emerald-300 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Banner and Faena Selector */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-cyan-400" />
              Faenas Mineras, Sectores y Cuadrillas
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Selección de faenas precargadas o registradas, regiones y comunas de Chile, creación de múltiples sectores y asignación de cuadrillas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Faena Selector (Ingresadas + Precargadas de Chile) */}
            <select
              value={currentSite.id}
              onChange={(e) => handleHeaderSiteSelect(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-950 border border-cyan-800/80 rounded-lg text-cyan-300 focus:outline-none max-w-xs sm:max-w-sm"
            >
              <optgroup label={`Faenas Ingresadas y Activas (${allSites.length})`}>
                {allSites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.isPreloaded ? '★ ' : ''}
                    {site.name} · {site.activeSectors.length} sectores
                  </option>
                ))}
              </optgroup>
              {availablePresetsToQuickLoad.length > 0 && (
                <optgroup label="Cargar Faena Precargada de Chile (+)">
                  {availablePresetsToQuickLoad.map((preset) => (
                    <option key={preset.id} value={`__preset__::${preset.id}`}>
                      + Precargar: {preset.name} ({preset.comuna}, {preset.region})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>

            <button
              type="button"
              onClick={openAddSectorModal}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-800/70 rounded-lg transition-colors whitespace-nowrap"
            >
              <Layers className="w-3.5 h-3.5" />
              + Crear Sector
            </button>

            <button
              type="button"
              onClick={() => openAssignCrewModal()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg transition-colors whitespace-nowrap"
            >
              <Users className="w-3.5 h-3.5" />
              Asignar Cuadrilla
            </button>

            <button
              type="button"
              onClick={() => setShowAddSiteModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Nueva Faena
            </button>
          </div>
        </div>

        {/* Site Details Card */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3.5 bg-slate-950/70 rounded-lg border border-slate-800 text-xs">
          <div>
            <span className="text-slate-400 block text-[10px]">Empresa Minera Titular:</span>
            <span className="font-semibold text-white">{currentSite.company}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">Comuna y Región (Chile):</span>
            <span className="text-slate-200 font-medium">
              {currentSite.comuna
                ? `${currentSite.comuna}, ${currentSite.region}`
                : currentSite.location}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">Cota Superficie:</span>
            <span className="font-mono text-cyan-400">{currentSite.elevationMsl} msnm</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">Modalidad de Explotación:</span>
            <span className="capitalize text-emerald-400 font-semibold">
              {currentSite.type.replace('_', ' ')}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">Cuadrillas en Faena:</span>
            <span className="text-cyan-300 font-semibold">
              {totalAssignedCrewsInSite} Cuadrilla(s) · {currentSite.activeSectors.length} Sectores
            </span>
          </div>
        </div>
      </div>

      {/* Surface Weather vs Underground Atmospheric Influence */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Compass className="w-4 h-4 text-cyan-400" />
            Condiciones Meteorológicas en Superficie (Estación Cordillera Nivel 0)
          </h3>
          <span className="text-[11px] text-slate-400">Influye en tiro natural de chimeneas</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center gap-3">
            <Thermometer className="w-5 h-5 text-amber-400" />
            <div>
              <span className="text-slate-400 block text-[10px]">Temp. Exterior</span>
              <span className="font-mono font-bold text-white text-base">
                {EXTERNAL_WEATHER.exteriorTemp} °C
              </span>
            </div>
          </div>
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center gap-3">
            <Droplets className="w-5 h-5 text-cyan-400" />
            <div>
              <span className="text-slate-400 block text-[10px]">Humedad Exterior</span>
              <span className="font-mono font-bold text-white text-base">
                {EXTERNAL_WEATHER.humidity} %
              </span>
            </div>
          </div>
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center gap-3">
            <Gauge className="w-5 h-5 text-purple-400" />
            <div>
              <span className="text-slate-400 block text-[10px]">Presión Barométrica</span>
              <span className="font-mono font-bold text-white text-base">
                {EXTERNAL_WEATHER.barometricPressure} mmHg
              </span>
            </div>
          </div>
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center gap-3">
            <Wind className="w-5 h-5 text-emerald-400" />
            <div>
              <span className="text-slate-400 block text-[10px]">Viento Superficie</span>
              <span className="font-mono font-bold text-white text-base">
                {EXTERNAL_WEATHER.windSpeed} m/s ({EXTERNAL_WEATHER.windDirection})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Subterranean Mine Shaft Interactive Schematic */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Schematic Levels List */}
        <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-cyan-400" />
              <h3 className="text-base font-bold text-white">
                Cortes y Sectores Subterráneos de Faena
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 font-mono">
                {currentSite.activeSectors.length} Sectores Instrumentados
              </span>
              <button
                type="button"
                onClick={openAddSectorModal}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar Sectores
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {currentSite.activeSectors.map((sector) => {
              const isSelected = selectedSector?.id === sector.id;
              const crews = sector.assignedCrews || [];
              return (
                <div
                  key={sector.id}
                  onClick={() => {
                    setSelectedSectorId(sector.id);
                    soundAlert.playFeedbackBeep();
                  }}
                  className={`p-4 rounded-xl border cursor-pointer transition-all duration-150 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isSelected
                      ? 'border-cyan-500 bg-slate-900/90 shadow-md shadow-cyan-950 ring-1 ring-cyan-500/50'
                      : 'border-slate-800 hover:border-slate-700 bg-slate-950/60'
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-4">
                    <div className="w-12 h-12 shrink-0 rounded-lg bg-slate-900 border border-slate-700 flex flex-col items-center justify-center text-cyan-300 font-mono font-bold text-xs">
                      <span>-{sector.depthMeters}m</span>
                      <span className="text-[9px] text-slate-400 font-sans">Nivel</span>
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                          {sector.code}
                        </span>
                        <h4 className="text-sm font-bold text-white">{sector.name}</h4>
                        <span className="text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          {SECTOR_TYPE_LABELS[sector.type]}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Personal en sector:{' '}
                        <span className="text-white font-medium">{sector.activeWorkers} mineros</span>{' '}
                        · Sensores IoT:{' '}
                        <span className="text-cyan-400 font-mono">{sector.sensorsCount}</span>
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {crews.length > 0 ? (
                          crews.map((crew) => (
                            <span
                              key={crew}
                              className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-800/80"
                            >
                              <HardHat className="w-3 h-3" />
                              {crew}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">
                            Sin cuadrilla asignada
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded border uppercase ${
                        sector.generalStatus === 'normal'
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                          : 'bg-amber-950 text-amber-300 border-amber-800'
                      }`}
                    >
                      {sector.generalStatus}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Col: Selected Sector Detail Panel */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-4 flex flex-col justify-between">
          {selectedSector ? (
            <>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-cyan-400 font-bold block mb-1">
                  Sector Seleccionado
                </span>
                <h3 className="text-lg font-bold text-white">{selectedSector.name}</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Código: <span className="font-mono text-slate-200">{selectedSector.code}</span> ·
                  Profundidad:{' '}
                  <span className="text-cyan-300 font-mono">
                    -{selectedSector.depthMeters} metros
                  </span>
                </p>

                <div className="space-y-3 mt-5 text-xs">
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">
                      Sistema de Ventilación Secundaria:
                    </span>
                    <span className="text-emerald-400 font-semibold block mt-0.5 capitalize">
                      {selectedSector.ventilationFanStatus.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">
                      Dotación Humana en el Frente:
                    </span>
                    <span className="text-white font-bold text-sm block mt-0.5">
                      {selectedSector.activeWorkers} Operadores activos
                    </span>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">
                      Red de Monitoreo Instalada:
                    </span>
                    <span className="text-cyan-300 font-medium block mt-0.5">
                      {selectedSector.sensorsCount} Sensores LoRaWAN / ESP32 de monitoreo continuo
                    </span>
                  </div>

                  {/* Assigned Crews Management */}
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[10px] uppercase font-bold">
                        Cuadrillas Asignadas a este Sector
                      </span>
                      <button
                        type="button"
                        onClick={() => openAssignCrewModal([selectedSector.id])}
                        className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        Asignar
                      </button>
                    </div>

                    {(selectedSector.assignedCrews || []).length > 0 ? (
                      <div className="space-y-1.5">
                        {(selectedSector.assignedCrews || []).map((crew) => (
                          <div
                            key={crew}
                            className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-950/50 border border-emerald-800/70 text-emerald-200"
                          >
                            <span className="flex items-center gap-1.5 font-medium">
                              <HardHat className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              {crew}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveCrewFromSector(selectedSector.id, crew)}
                              title="Quitar cuadrilla de este sector"
                              className="text-slate-400 hover:text-red-400 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-500 text-[11px] italic">
                        Aún no hay cuadrillas asignadas a este sector.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 space-y-2">
                <button
                  type="button"
                  onClick={() => openAssignCrewModal([selectedSector.id])}
                  className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white transition-colors flex items-center justify-center gap-1.5"
                >
                  <Users className="w-3.5 h-3.5" />
                  Asignar Cuadrilla (1 o más sectores)
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTab('monitoreo')}
                  className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
                >
                  Ver Sensores de este Sector en Monitoreo
                </button>
              </div>
            </>
          ) : (
            <div className="text-xs text-slate-400 py-8 text-center">
              Selecciona o crea un sector para ver su detalle operativo.
            </div>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODAL 1: REGISTRAR NUEVA FAENA MINERA (CON PRECARGA, REGIONES, COMUNAS Y MULTI-SECTOR) */}
      {/* ===================================================================== */}
      {showAddSiteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-cyan-400" />
                Registrar Nueva Faena Minera
              </h3>
              <button
                type="button"
                onClick={() => setShowAddSiteModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleCreateSite}
              className="p-6 space-y-4 text-xs overflow-y-auto flex-1"
            >
              {/* Preload template selector */}
              <div className="p-3 bg-cyan-950/30 border border-cyan-800/60 rounded-xl space-y-1.5">
                <label className="text-cyan-300 font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Seleccionar Faena Precargada o Ya Ingresada (Opcional)
                </label>
                <select
                  value={selectedPresetId}
                  onChange={(e) => handleApplyFaenaPreset(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-cyan-800/70 rounded-lg text-white"
                >
                  <option value="">-- Ingreso Manual desde Cero --</option>
                  <optgroup label="Faenas ya Ingresadas (Copiar estructura)">
                    {allSites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.comuna || s.location} · {s.region})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Faenas Mineras Precargadas de Chile">
                    {PRELOADED_FAENA_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {p.comuna}, {p.region}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">
                    Nombre de la Faena *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Mina Candelaria Nivel Sur"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-medium">
                    Empresa Mandante *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Lundin Mining Corporation"
                    value={newCompany}
                    onChange={(e) => setNewCompany(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                </div>
              </div>

              {/* Cascading Chile Region & Comuna */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">
                    Región de Chile *
                  </label>
                  <select
                    value={newRegion}
                    onChange={(e) => handleRegionChange(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  >
                    {CHILE_REGIONS.map((reg) => (
                      <option key={reg.id} value={reg.name}>
                        {reg.roman} - {reg.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-medium">
                    Comuna / Localidad *
                  </label>
                  <select
                    value={newComuna}
                    onChange={(e) => setNewComuna(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  >
                    {selectedRegionObj.comunas.map((comuna) => (
                      <option key={comuna} value={comuna}>
                        {comuna}
                      </option>
                    ))}
                    <option value="__custom__">Otra localidad (ingresar manual)</option>
                  </select>
                  {newComuna === '__custom__' && (
                    <input
                      type="text"
                      required
                      placeholder="Escribe la comuna o localidad"
                      value={customComuna}
                      onChange={(e) => setCustomComuna(e.target.value)}
                      className="w-full mt-2 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">
                    Tipo de Explotación
                  </label>
                  <select
                    value={newType}
                    onChange={(e) =>
                      setNewType(e.target.value as 'subterranea' | 'rajo_abierto' | 'mixta')
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  >
                    <option value="subterranea">Mina Subterránea</option>
                    <option value="rajo_abierto">Mina a Rajo Abierto</option>
                    <option value="mixta">Explotación Mixta</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-medium">
                    Cota Superficie (msnm)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={6000}
                    value={newElevation}
                    onChange={(e) => setNewElevation(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono"
                  />
                </div>
              </div>

              {/* Dynamic Multi-Sector Builder */}
              <div className="pt-2 border-t border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-200 font-bold flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    Sectores de la Faena ({draftSiteSectors.length})
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setDraftSiteSectors((prev) => [
                        ...prev,
                        createEmptyDraftSector(prev.length),
                      ])
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 rounded-lg font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar Otro Sector
                  </button>
                </div>

                <div className="space-y-2.5">
                  {draftSiteSectors.map((sec, idx) => (
                    <div
                      key={sec.tempId}
                      className="p-3 bg-slate-950/90 border border-slate-800 rounded-xl space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-cyan-400">
                          Sector #{idx + 1}
                        </span>
                        {draftSiteSectors.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setDraftSiteSectors((prev) =>
                                prev.filter((item) => item.tempId !== sec.tempId)
                              )
                            }
                            className="text-slate-400 hover:text-red-400 flex items-center gap-1 text-[11px]"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Quitar
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          required
                          placeholder="Nombre del Sector"
                          value={sec.name}
                          onChange={(e) =>
                            setDraftSiteSectors((prev) =>
                              prev.map((item) =>
                                item.tempId === sec.tempId
                                  ? { ...item, name: e.target.value }
                                  : item
                              )
                            )
                          }
                          className="sm:col-span-2 px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white"
                        />
                        <input
                          type="text"
                          placeholder="Código (ej: NV-01)"
                          value={sec.code}
                          onChange={(e) =>
                            setDraftSiteSectors((prev) =>
                              prev.map((item) =>
                                item.tempId === sec.tempId
                                  ? { ...item, code: e.target.value }
                                  : item
                              )
                            )
                          }
                          className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono"
                        />
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">
                            Tipo
                          </label>
                          <select
                            value={sec.type}
                            onChange={(e) =>
                              setDraftSiteSectors((prev) =>
                                prev.map((item) =>
                                  item.tempId === sec.tempId
                                    ? {
                                        ...item,
                                        type: e.target.value as MiningSector['type'],
                                      }
                                    : item
                                )
                              )
                            }
                            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white"
                          >
                            {Object.entries(SECTOR_TYPE_LABELS).map(([val, label]) => (
                              <option key={val} value={val}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">
                            Profundidad (m)
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={sec.depthMeters}
                            onChange={(e) =>
                              setDraftSiteSectors((prev) =>
                                prev.map((item) =>
                                  item.tempId === sec.tempId
                                    ? { ...item, depthMeters: Number(e.target.value) }
                                    : item
                                )
                              )
                            }
                            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono"
                          />
                        </div>

                        <div className="col-span-2">
                          <label className="text-[10px] text-slate-400 block mb-0.5">
                            Cuadrilla Asignada (Opcional)
                          </label>
                          <select
                            value={sec.assignedCrew}
                            onChange={(e) =>
                              setDraftSiteSectors((prev) =>
                                prev.map((item) =>
                                  item.tempId === sec.tempId
                                    ? { ...item, assignedCrew: e.target.value }
                                    : item
                                )
                              )
                            }
                            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white"
                          >
                            <option value="">-- Sin cuadrilla por ahora --</option>
                            {availableCrews.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                            <option value="__custom__">+ Escribir nueva cuadrilla...</option>
                          </select>
                          {sec.assignedCrew === '__custom__' && (
                            <input
                              type="text"
                              placeholder="Nombre de la nueva cuadrilla"
                              value={sec.customCrew}
                              onChange={(e) =>
                                setDraftSiteSectors((prev) =>
                                  prev.map((item) =>
                                    item.tempId === sec.tempId
                                      ? { ...item, customCrew: e.target.value }
                                      : item
                                  )
                                )
                              }
                              className="w-full mt-1.5 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddSiteModal(false)}
                  className="px-4 py-2 text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg font-semibold"
                >
                  Guardar Faena ({draftSiteSectors.length} sectores)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: CREAR SECTORES EN LA FAENA ACTUAL (1 O MÁS SECTORES) */}
      {/* ===================================================================== */}
      {showAddSectorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  Crear Nuevos Sectores en Faena
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">{currentSite.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddSectorModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSaveNewSectors}
              className="p-6 space-y-4 text-xs overflow-y-auto flex-1"
            >
              <div className="flex items-center justify-between">
                <span className="text-slate-300">
                  Puedes agregar uno o varios sectores simultáneamente y asignarles cuadrilla:
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setNewSectorsQueue((prev) => [
                      ...prev,
                      createEmptyDraftSector(currentSite.activeSectors.length + prev.length),
                    ])
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 rounded-lg font-semibold shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar Otro Sector
                </button>
              </div>

              <div className="space-y-3">
                {newSectorsQueue.map((sec, idx) => (
                  <div
                    key={sec.tempId}
                    className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-cyan-300">
                        Nuevo Sector #{idx + 1}
                      </span>
                      {newSectorsQueue.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setNewSectorsQueue((prev) =>
                              prev.filter((item) => item.tempId !== sec.tempId)
                            )
                          }
                          className="text-slate-400 hover:text-red-400 flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Eliminar
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="sm:col-span-2">
                        <label className="text-slate-400 block mb-1 text-[10px]">
                          Nombre del Sector *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ej: Galería Sur Nivel -480"
                          value={sec.name}
                          onChange={(e) =>
                            setNewSectorsQueue((prev) =>
                              prev.map((item) =>
                                item.tempId === sec.tempId
                                  ? { ...item, name: e.target.value }
                                  : item
                              )
                            )
                          }
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white"
                        />
                      </div>

                      <div>
                        <label className="text-slate-400 block mb-1 text-[10px]">
                          Código Sector *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="GAL-S-480"
                          value={sec.code}
                          onChange={(e) =>
                            setNewSectorsQueue((prev) =>
                              prev.map((item) =>
                                item.tempId === sec.tempId
                                  ? { ...item, code: e.target.value }
                                  : item
                              )
                            )
                          }
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div>
                        <label className="text-slate-400 block mb-1 text-[10px]">
                          Tipo de Sector
                        </label>
                        <select
                          value={sec.type}
                          onChange={(e) =>
                            setNewSectorsQueue((prev) =>
                              prev.map((item) =>
                                item.tempId === sec.tempId
                                  ? {
                                      ...item,
                                      type: e.target.value as MiningSector['type'],
                                    }
                                  : item
                              )
                            )
                          }
                          className="w-full px-2.5 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white"
                        >
                          {Object.entries(SECTOR_TYPE_LABELS).map(([val, label]) => (
                            <option key={val} value={val}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-slate-400 block mb-1 text-[10px]">
                          Profundidad (m)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={sec.depthMeters}
                          onChange={(e) =>
                            setNewSectorsQueue((prev) =>
                              prev.map((item) =>
                                item.tempId === sec.tempId
                                  ? { ...item, depthMeters: Number(e.target.value) }
                                  : item
                              )
                            )
                          }
                          className="w-full px-2.5 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-slate-400 block mb-1 text-[10px]">
                          Mineros Activos
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={sec.activeWorkers}
                          onChange={(e) =>
                            setNewSectorsQueue((prev) =>
                              prev.map((item) =>
                                item.tempId === sec.tempId
                                  ? { ...item, activeWorkers: Number(e.target.value) }
                                  : item
                              )
                            )
                          }
                          className="w-full px-2.5 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-slate-400 block mb-1 text-[10px]">
                          Sensores IoT
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={sec.sensorsCount}
                          onChange={(e) =>
                            setNewSectorsQueue((prev) =>
                              prev.map((item) =>
                                item.tempId === sec.tempId
                                  ? { ...item, sensorsCount: Number(e.target.value) }
                                  : item
                              )
                            )
                          }
                          className="w-full px-2.5 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-400 block mb-1 text-[10px]">
                        Cuadrilla Inicial Asignada (Opcional)
                      </label>
                      <select
                        value={sec.assignedCrew}
                        onChange={(e) =>
                          setNewSectorsQueue((prev) =>
                            prev.map((item) =>
                              item.tempId === sec.tempId
                                ? { ...item, assignedCrew: e.target.value }
                                : item
                            )
                          )
                        }
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white"
                      >
                        <option value="">-- Sin cuadrilla inicial --</option>
                        {availableCrews.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                        <option value="__custom__">+ Escribir nueva cuadrilla...</option>
                      </select>
                      {sec.assignedCrew === '__custom__' && (
                        <input
                          type="text"
                          placeholder="Ej: Cuadrilla Delta - Turno Noche"
                          value={sec.customCrew}
                          onChange={(e) =>
                            setNewSectorsQueue((prev) =>
                              prev.map((item) =>
                                item.tempId === sec.tempId
                                  ? { ...item, customCrew: e.target.value }
                                  : item
                              )
                            )
                          }
                          className="w-full mt-2 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddSectorModal(false)}
                  className="px-4 py-2 text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg font-semibold"
                >
                  Guardar {newSectorsQueue.length} Sector(es)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: ASIGNAR CUADRILLA A 1 O MÁS SECTORES */}
      {/* ===================================================================== */}
      {showAssignCrewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-400" />
                  Asignar Cuadrilla a Sectores
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">{currentSite.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAssignCrewModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleAssignCrewToSectors}
              className="p-6 space-y-4 text-xs overflow-y-auto flex-1"
            >
              {/* Crew Selection */}
              <div className="space-y-2">
                <label className="text-slate-300 font-semibold block">
                  1. Seleccionar o Crear Cuadrilla
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCrewSelectionMode('existing')}
                    className={`py-2 px-3 rounded-lg border font-semibold transition-colors ${
                      crewSelectionMode === 'existing'
                        ? 'bg-emerald-950/70 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    Cuadrilla Existente / Precargada
                  </button>
                  <button
                    type="button"
                    onClick={() => setCrewSelectionMode('custom')}
                    className={`py-2 px-3 rounded-lg border font-semibold transition-colors ${
                      crewSelectionMode === 'custom'
                        ? 'bg-emerald-950/70 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    + Nueva Cuadrilla
                  </button>
                </div>

                {crewSelectionMode === 'existing' ? (
                  <select
                    value={selectedCrewName}
                    onChange={(e) => setSelectedCrewName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  >
                    {availableCrews.map((crew) => (
                      <option key={crew} value={crew}>
                        {crew}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    placeholder="Ej: Cuadrilla Delta - Nivel -500"
                    value={customCrewName}
                    onChange={(e) => setCustomCrewName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                )}
              </div>

              {/* Multi-sector Checkboxes */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-semibold">
                    2. Seleccionar 1 o más Sectores ({targetSectorIds.length} seleccionados)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setTargetSectorIds(currentSite.activeSectors.map((s) => s.id))
                      }
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold"
                    >
                      Todos
                    </button>
                    <span className="text-slate-600">|</span>
                    <button
                      type="button"
                      onClick={() => setTargetSectorIds([])}
                      className="text-[11px] text-slate-400 hover:text-white font-semibold"
                    >
                      Ninguno
                    </button>
                  </div>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {currentSite.activeSectors.map((sec) => {
                    const checked = targetSectorIds.includes(sec.id);
                    return (
                      <label
                        key={sec.id}
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                          checked
                            ? 'bg-emerald-950/40 border-emerald-600/80'
                            : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTargetSector(sec.id)}
                          className="mt-0.5 accent-emerald-500 w-4 h-4 rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-cyan-300">
                              {sec.code}
                            </span>
                            <span className="font-semibold text-white truncate">
                              {sec.name}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 ml-auto">
                              -{sec.depthMeters}m
                            </span>
                          </div>
                          {(sec.assignedCrews || []).length > 0 && (
                            <p className="text-[10px] text-emerald-300/80 mt-1">
                              Actuales: {(sec.assignedCrews || []).join(', ')}
                            </p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 text-[10px]">
                  Dotación asignada por defecto si el sector tiene 0 mineros:
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={workersToAddIfZero}
                  onChange={(e) => setWorkersToAddIfZero(Number(e.target.value))}
                  className="w-32 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAssignCrewModal(false)}
                  className="px-4 py-2 text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={targetSectorIds.length === 0}
                  className="px-4 py-2 text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-semibold"
                >
                  Asignar a {targetSectorIds.length} Sector(es)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
