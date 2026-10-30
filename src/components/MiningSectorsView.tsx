import React, { useState } from 'react';
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
  ShieldCheck,
  AlertTriangle,
  Radio,
  X
} from 'lucide-react';
import { MiningSite, MiningSector, NavigationTab } from '../types';
import { EXTERNAL_WEATHER } from '../data/mockData';
import { soundAlert } from '../services/audioAlert';

interface MiningSectorsViewProps {
  currentSite: MiningSite;
  allSites: MiningSite[];
  onSelectSite: (siteId: string) => void;
  onAddSite: (newSite: MiningSite) => void;
  onNavigateTab: (tab: NavigationTab) => void;
}

export const MiningSectorsView: React.FC<MiningSectorsViewProps> = ({
  currentSite,
  allSites,
  onSelectSite,
  onAddSite,
  onNavigateTab,
}) => {
  const [selectedSectorId, setSelectedSectorId] = useState<string>(currentSite.activeSectors[0]?.id || '');
  const [showAddSiteModal, setShowAddSiteModal] = useState(false);

  // New site form
  const [newName, setNewName] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newRegion, setNewRegion] = useState('');
  const [newType, setNewType] = useState<'subterranea' | 'rajo_abierto' | 'mixta'>('subterranea');

  const selectedSector = currentSite.activeSectors.find(s => s.id === selectedSectorId) || currentSite.activeSectors[0];

  const handleCreateSite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newCompany) return;

    const newSite: MiningSite = {
      id: `site-${Date.now()}`,
      name: newName,
      company: newCompany,
      location: newLocation || 'Chile',
      region: newRegion || 'Región Minera',
      type: newType,
      elevationMsl: 2400,
      activeSectors: [
        {
          id: `sec-${Date.now()}-1`,
          name: 'Nivel Principal 1',
          code: 'NV-01',
          depthMeters: 200,
          type: 'socavon',
          activeWorkers: 15,
          sensorsCount: 4,
          generalStatus: 'normal',
          ventilationFanStatus: 'operativo_normal',
        }
      ],
    };

    onAddSite(newSite);
    soundAlert.playFeedbackBeep();
    setShowAddSiteModal(false);
    setNewName('');
    setNewCompany('');
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner and Faena Selector */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-cyan-400" />
              Faenas Mineras, Sectores y Geolocalización
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Topografía subterránea, distribución de cuadrillas y condiciones meteorológicas de superficie.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Faena Selector */}
            <select
              value={currentSite.id}
              onChange={(e) => {
                onSelectSite(e.target.value);
                soundAlert.playFeedbackBeep();
              }}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-950 border border-cyan-800/80 rounded-lg text-cyan-300 focus:outline-none"
            >
              {allSites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name} ({site.type === 'subterranea' ? 'Subterránea' : 'Rajo'})
                </option>
              ))}
            </select>

            <button
              onClick={() => setShowAddSiteModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Nueva Faena
            </button>
          </div>
        </div>

        {/* Site Details Card */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-950/70 rounded-lg border border-slate-800 text-xs">
          <div>
            <span className="text-slate-400 block text-[10px]">Empresa Minera Titular:</span>
            <span className="font-semibold text-white">{currentSite.company}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">Ubicación Geográfica:</span>
            <span className="text-slate-300">{currentSite.location}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">Cota Superficie:</span>
            <span className="font-mono text-cyan-400">{currentSite.elevationMsl} msnm</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">Modalidad de Explotación:</span>
            <span className="capitalize text-emerald-400 font-semibold">{currentSite.type}</span>
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
              <span className="font-mono font-bold text-white text-base">{EXTERNAL_WEATHER.exteriorTemp} °C</span>
            </div>
          </div>
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center gap-3">
            <Droplets className="w-5 h-5 text-cyan-400" />
            <div>
              <span className="text-slate-400 block text-[10px]">Humedad Exterior</span>
              <span className="font-mono font-bold text-white text-base">{EXTERNAL_WEATHER.humidity} %</span>
            </div>
          </div>
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center gap-3">
            <Gauge className="w-5 h-5 text-purple-400" />
            <div>
              <span className="text-slate-400 block text-[10px]">Presión Barométrica</span>
              <span className="font-mono font-bold text-white text-base">{EXTERNAL_WEATHER.barometricPressure} mmHg</span>
            </div>
          </div>
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center gap-3">
            <Wind className="w-5 h-5 text-emerald-400" />
            <div>
              <span className="text-slate-400 block text-[10px]">Viento Superficie</span>
              <span className="font-mono font-bold text-white text-base">{EXTERNAL_WEATHER.windSpeed} m/s ({EXTERNAL_WEATHER.windDirection})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Subterranean Mine Shaft Interactive Schematic */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Schematic Levels List */}
        <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-cyan-400" />
              <h3 className="text-base font-bold text-white">
                Cortes y Sectores Subterráneos de Faena
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {currentSite.activeSectors.length} Sectores Instrumentados
            </span>
          </div>

          <div className="space-y-3">
            {currentSite.activeSectors.map((sector) => {
              const isSelected = selectedSectorId === sector.id;
              return (
                <div
                  key={sector.id}
                  onClick={() => {
                    setSelectedSectorId(sector.id);
                    soundAlert.playFeedbackBeep();
                  }}
                  className={`p-4 rounded-xl border cursor-pointer transition-all duration-150 flex items-center justify-between ${
                    isSelected 
                      ? 'border-cyan-500 bg-slate-900/90 shadow-md shadow-cyan-950 ring-1 ring-cyan-500/50' 
                      : 'border-slate-800 hover:border-slate-700 bg-slate-950/60'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-700 flex flex-col items-center justify-center text-cyan-300 font-mono font-bold text-xs">
                      <span>-{sector.depthMeters}m</span>
                      <span className="text-[9px] text-slate-400 font-sans">Nivel</span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-cyan-300 bg-cyan-950 px-2 py-0.2 rounded border border-cyan-800">
                          {sector.code}
                        </span>
                        <h4 className="text-sm font-bold text-white">{sector.name}</h4>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Personal en sector: <span className="text-white font-medium">{sector.activeWorkers} mineros</span> · Sensores IoT: <span className="text-cyan-400 font-mono">{sector.sensorsCount}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded border uppercase ${
                      sector.generalStatus === 'normal' 
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-800' 
                        : 'bg-amber-950 text-amber-300 border-amber-800'
                    }`}>
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
          <div>
            <span className="text-[10px] uppercase tracking-wider text-cyan-400 font-bold block mb-1">
              Sector Seleccionado
            </span>
            <h3 className="text-lg font-bold text-white">{selectedSector.name}</h3>
            <p className="text-xs text-slate-400 mt-1">
              Código: <span className="font-mono text-slate-200">{selectedSector.code}</span> · Profundidad: <span className="text-cyan-300 font-mono">-{selectedSector.depthMeters} metros</span>
            </p>

            <div className="space-y-3 mt-5 text-xs">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Sistema de Ventilación Secundaria:</span>
                <span className="text-emerald-400 font-semibold block mt-0.5 capitalize">
                  {selectedSector.ventilationFanStatus.replace('_', ' ')}
                </span>
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Dotación Humana en el Frente:</span>
                <span className="text-white font-bold text-sm block mt-0.5">
                  {selectedSector.activeWorkers} Operadores activos
                </span>
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Red de Monitoreo Instalada:</span>
                <span className="text-cyan-300 font-medium block mt-0.5">
                  {selectedSector.sensorsCount} Sensores LoRaWAN de monitoreo continuo
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800">
            <button
              onClick={() => onNavigateTab('monitoreo')}
              className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
            >
              Ver Sensores de este Sector en Monitoreo
            </button>
          </div>
        </div>

      </div>

      {/* MODAL: REGISTRAR NUEVA FAENA */}
      {showAddSiteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-cyan-400" />
                Registrar Nueva Faena Minera
              </h3>
              <button onClick={() => setShowAddSiteModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSite} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1">Nombre de la Faena</label>
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
                <label className="text-slate-300 block mb-1">Empresa Mandante</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Lundin Mining Corporation"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-300 block mb-1">Comuna / Localidad</label>
                  <input
                    type="text"
                    placeholder="Tierra Amarilla"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1">Región</label>
                  <input
                    type="text"
                    placeholder="Atacama"
                    value={newRegion}
                    onChange={(e) => setNewRegion(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Tipo de Explotación</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as 'subterranea' | 'rajo_abierto' | 'mixta')}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                >
                  <option value="subterranea">Mina Subterránea</option>
                  <option value="rajo_abierto">Mina a Rajo Abierto</option>
                  <option value="mixta">Explotación Mixta</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddSiteModal(false)}
                  className="px-4 py-2 text-slate-300 bg-slate-800 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg font-semibold"
                >
                  Guardar Faena
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
