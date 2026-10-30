import React, { useState } from 'react';
import { 
  UserCheck, 
  Shield, 
  Mail, 
  User, 
  Briefcase, 
  Clock, 
  Check, 
  X,
  Plus
} from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import { PRELOADED_USERS } from '../data/mockData';
import { soundAlert } from '../services/audioAlert';

interface UserManagementModalProps {
  currentUser: UserProfile;
  onSelectUser: (user: UserProfile) => void;
  onClose: () => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  currentUser,
  onSelectUser,
  onClose,
}) => {
  const [users, setUsers] = useState<UserProfile[]>(PRELOADED_USERS);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(currentUser.name);
  const [editEmail, setEditEmail] = useState(currentUser.email);
  const [editRole, setEditRole] = useState<UserRole>(currentUser.role);
  const [editShift, setEditShift] = useState(currentUser.shift);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const roleLabels: Record<UserRole, string> = {
      superadmin: 'Super Administrador de Seguridad Minera',
      admin: 'Administrador / Prevencionista Sernageomin',
      operador: 'Usuario Normal / Operador de Faena',
    };

    const updatedUser: UserProfile = {
      ...currentUser,
      name: editName,
      email: editEmail,
      role: editRole,
      roleLabel: roleLabels[editRole],
      shift: editShift,
    };

    onSelectUser(updatedUser);
    soundAlert.playFeedbackBeep();
    setIsEditing(false);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm p-3 sm:p-6 animate-in fade-in">
      <div className="min-h-full flex items-center justify-center py-4">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full shadow-2xl flex flex-col max-h-[min(90vh,760px)]">
          
          {/* Header */}
          <div className="flex items-center justify-between p-5 sm:p-6 pb-4 border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-800 flex items-center justify-center">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white">Perfil y Control de Acceso</h2>
                <p className="text-xs text-slate-400">Seleccione un perfil de demostración o edite sus credenciales.</p>
              </div>
            </div>

            <button onClick={onClose} aria-label="Cerrar modal" className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="p-5 sm:p-6 pt-4 overflow-y-auto space-y-5">
            {/* Current User Active Card */}
            <div className="p-4 rounded-xl bg-slate-950 border border-cyan-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-cyan-500 to-blue-700 text-white flex items-center justify-center font-bold text-base shadow-sm">
              {currentUser.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">{currentUser.name}</h3>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                  {currentUser.role}
                </span>
              </div>
              <p className="text-xs text-slate-400">{currentUser.email}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">RUT: {currentUser.rut} · {currentUser.shift}</p>
            </div>
          </div>

          <button
            onClick={() => setIsEditing(!isEditing)}
            className="text-xs font-medium text-cyan-400 hover:text-cyan-300 underline"
          >
            {isEditing ? 'Cancelar' : 'Editar'}
          </button>
        </div>

        {/* Edit Form */}
        {isEditing && (
          <form onSubmit={handleSaveProfile} className="space-y-3 p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs">
            <div>
              <label className="text-slate-300 block mb-1">Nombre</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-white"
              />
            </div>
            <div>
              <label className="text-slate-300 block mb-1">Email Corporativo</label>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-300 block mb-1">Rol Operativo</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-white"
                >
                  <option value="superadmin">Super Administrador</option>
                  <option value="admin">Administrador / Prevencionista</option>
                  <option value="operador">Usuario Normal (Operador)</option>
                </select>
              </div>
              <div>
                <label className="text-slate-300 block mb-1">Turno Asignado</label>
                <input
                  type="text"
                  value={editShift}
                  onChange={(e) => setEditShift(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-white"
                />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white rounded"
              >
                Guardar Cambios
              </button>
            </div>
          </form>
        )}

        {/* Quick Role Switcher List (Preloaded Users) */}
        <div className="space-y-2">
          <h4 className="text-xs uppercase font-bold text-slate-400 tracking-wider">
            Cambio Rápido de Cuenta / Perfil Minero
          </h4>
          <div className="space-y-2">
            {users.map((user) => (
              <button
                key={user.id}
                onClick={() => {
                  onSelectUser(user);
                  soundAlert.playFeedbackBeep();
                  onClose();
                }}
                className={`w-full p-3 rounded-lg border text-left transition-colors flex items-center justify-between ${
                  currentUser.id === user.id
                    ? 'border-cyan-500 bg-cyan-950/30'
                    : 'border-slate-800 bg-slate-950/60 hover:bg-slate-800/60'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{user.name}</span>
                    <span className="text-[10px] text-cyan-300 font-semibold px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-800">
                      {user.role}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">{user.roleLabel}</p>
                </div>

                {currentUser.id === user.id && (
                  <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>

        </div>

        {/* Footer - Fixed at bottom */}
        <div className="flex justify-end p-4 border-t border-slate-800 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  </div>
);
};
