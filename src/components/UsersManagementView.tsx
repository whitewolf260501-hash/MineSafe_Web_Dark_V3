import React, { useState } from 'react';
import { 
  Users, 
  UserCheck, 
  Shield, 
  Crown, 
  HardHat, 
  Plus, 
  Search, 
  Filter, 
  Edit2, 
  Check, 
  X, 
  Lock,
  Mail,
  Clock,
  Radio,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import { soundAlert } from '../services/audioAlert';

interface UsersManagementViewProps {
  currentUser: UserProfile;
  usersList: UserProfile[];
  onAddUser: (newUser: UserProfile) => void;
  onUpdateUserRole: (userId: string, newRole: UserRole) => void;
  onToggleUserStatus: (userId: string) => void;
}

export const UsersManagementView: React.FC<UsersManagementViewProps> = ({
  currentUser,
  usersList,
  onAddUser,
  onUpdateUserRole,
  onToggleUserStatus,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New user form state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRut, setNewRut] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('operador');
  const [newShift, setNewShift] = useState('Turno Mañana (07:00 - 15:30)');

  const isSuperAdmin = currentUser.role === 'superadmin';
  const isAdminOrSuper = currentUser.role === 'superadmin' || currentUser.role === 'admin';

  const showToast = (type: 'success' | 'error', text: string) => {
    setFeedbackToast({ type, text });
    setTimeout(() => setFeedbackToast(null), 4000);
  };

  const filteredUsers = usersList.filter((u) => {
    const matchesSearch = 
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.rut.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleRoleSelectChange = (targetUser: UserProfile, nextRole: UserRole) => {
    if (targetUser.role === 'superadmin') {
      soundAlert.playFeedbackBeep();
      showToast('error', 'Acción bloqueada: Un Administrador no puede quitarle permisos al único SuperAdministrador.');
      return;
    }
    if (nextRole === 'superadmin') {
      soundAlert.playFeedbackBeep();
      showToast('error', 'Acción bloqueada: Solo existe un único SuperAdministrador en toda la plataforma.');
      return;
    }

    onUpdateUserRole(targetUser.id, nextRole);
    showToast(
      'success',
      nextRole === 'admin'
        ? `Permisos de Administrador otorgados a ${targetUser.name}.`
        : `Rol actualizado a Operador (Usuario Normal) para ${targetUser.name}.`
    );
  };

  const handleStatusToggleClick = (targetUser: UserProfile) => {
    if (targetUser.role === 'superadmin') {
      soundAlert.playFeedbackBeep();
      showToast('error', 'Acción bloqueada: El único SuperAdministrador no puede ser desactivado.');
      return;
    }
    onToggleUserStatus(targetUser.id);
    showToast(
      'success',
      `Cuenta de ${targetUser.name} ${targetUser.status === 'activo' ? 'desactivada' : 'activada'}.`
    );
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail) return;

    // Garantizar que nunca se cree un segundo superadmin
    const safeRole: UserRole = newRole === 'superadmin' ? 'admin' : newRole;

    const roleLabels: Record<UserRole, string> = {
      superadmin: 'Super Administrador de Seguridad Minera',
      admin: 'Administrador / Prevencionista Sernageomin',
      operador: 'Usuario Normal / Operador de Faena',
    };

    const created: UserProfile = {
      id: `usr-${Date.now()}`,
      name: newName,
      email: newEmail,
      role: safeRole,
      roleLabel: roleLabels[safeRole],
      rut: newRut || '18.123.456-7',
      shift: newShift,
      status: 'activo',
      lastLogin: 'Nunca',
    };

    onAddUser(created);
    soundAlert.playFeedbackBeep();
    showToast('success', `Usuario ${created.name} creado con rol ${safeRole === 'admin' ? 'Administrador' : 'Operador'}.`);
    setShowAddModal(false);
    setNewName('');
    setNewEmail('');
    setNewRut('');
    setNewRole('operador');
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'superadmin':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-300 bg-purple-950 px-2 py-0.5 rounded border border-purple-800">
            <Crown className="w-3.5 h-3.5 text-purple-400" />
            SuperAdmin Único
          </span>
        );
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            Admin / Prevencionista
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 bg-amber-950 px-2 py-0.5 rounded border border-amber-800">
            <HardHat className="w-3.5 h-3.5 text-amber-400" />
            Usuario Normal (Operador)
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-400" />
              Gestión de Usuarios y Roles (RBAC)
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Administración de cuentas con <span className="text-purple-400 font-semibold">1 Único SuperAdmin Protegido</span>, <span className="text-cyan-400 font-semibold">Administradores</span> y <span className="text-amber-400 font-semibold">Usuarios Normales</span>.
            </p>
          </div>

          {isAdminOrSuper && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nuevo Usuario
            </button>
          )}
        </div>

        {/* Feedback Toast */}
        {feedbackToast && (
          <div className={`mb-4 p-3 rounded-xl border text-xs font-semibold flex items-center justify-between animate-in fade-in ${
            feedbackToast.type === 'error'
              ? 'bg-rose-950/80 border-rose-700 text-rose-200'
              : 'bg-emerald-950/80 border-emerald-700 text-emerald-200'
          }`}>
            <div className="flex items-center gap-2">
              {feedbackToast.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              <span>{feedbackToast.text}</span>
            </div>
            <button onClick={() => setFeedbackToast(null)} className="text-[10px] underline opacity-80 hover:opacity-100">
              Cerrar
            </button>
          </div>
        )}

        {/* Roles Permission Matrix Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-slate-950/70 rounded-xl border border-slate-800 text-xs">
          
          <div className="p-3 bg-purple-950/20 border border-purple-900/40 rounded-lg space-y-1.5">
            <div className="flex items-center justify-between gap-1.5 text-purple-300 font-bold">
              <span className="flex items-center gap-1.5">
                <Crown className="w-4 h-4" />
                Super Administrador
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-950 border border-purple-700 text-purple-200">
                1 Único
              </span>
            </div>
            <p className="text-slate-400 text-[11px]">
              Autoridad máxima única e intransferible: otorga permisos de Administrador a los usuarios. Protegido contra cambios o revocación por parte de cualquier Admin.
            </p>
          </div>

          <div className="p-3 bg-cyan-950/20 border border-cyan-900/40 rounded-lg space-y-1.5">
            <div className="flex items-center gap-1.5 text-cyan-300 font-bold">
              <Shield className="w-4 h-4" />
              Administrador / Prevencionista
            </div>
            <p className="text-slate-400 text-[11px]">
              Gestión operacional: monitoreo, umbrales, arriendos y gestión de operadores. No puede quitarle permisos ni desactivar al SuperAdministrador.
            </p>
          </div>

          <div className="p-3 bg-amber-950/20 border border-amber-900/40 rounded-lg space-y-1.5">
            <div className="flex items-center gap-1.5 text-amber-300 font-bold">
              <HardHat className="w-4 h-4" />
              Usuario Normal / Operador
            </div>
            <p className="text-slate-400 text-[11px]">
              Acceso operativo asignado por defecto en todo registro nuevo: consulta en tiempo real de su sector y telemetría personal.
            </p>
          </div>

        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/40 p-4 rounded-xl border border-slate-800">
        <div className="relative flex-1 sm:w-64 w-full">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar por nombre, email o RUT..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">Todos los Roles</option>
            <option value="superadmin">SuperAdmin Único</option>
            <option value="admin">Solo Administradores</option>
            <option value="operador">Solo Usuarios Normales</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Usuario & Nombre</th>
                <th className="px-4 py-3">Email Corporativo</th>
                <th className="px-4 py-3">RUT</th>
                <th className="px-4 py-3">Rol Minero</th>
                <th className="px-4 py-3">Turno / Sector</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredUsers.map((user) => {
                const isTargetSuperAdmin = user.role === 'superadmin';
                const isCurrentSession = user.id === currentUser.id;
                const canModifyTarget = isAdminOrSuper && !isCurrentSession && !isTargetSuperAdmin;

                return (
                  <tr key={user.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs border ${
                          isTargetSuperAdmin
                            ? 'bg-purple-950 text-purple-300 border-purple-700'
                            : 'bg-cyan-950 text-cyan-300 border-cyan-800'
                        }`}>
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <span className="font-semibold text-white block">{user.name}</span>
                          <span className="text-[10px] text-slate-400">{user.roleLabel}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-slate-300">{user.email}</td>
                    <td className="px-4 py-3.5 font-mono text-slate-400">{user.rut}</td>
                    <td className="px-4 py-3.5">{getRoleBadge(user.role)}</td>
                    <td className="px-4 py-3.5 text-slate-300">
                      <div>{user.shift}</div>
                      {user.assignedSector && (
                        <div className="text-[10px] text-cyan-400 font-medium">{user.assignedSector}</div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        user.status === 'activo' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-slate-900 text-slate-500 border border-slate-800'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {isTargetSuperAdmin ? (
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-950/70 border border-purple-700/70 text-purple-300 text-[11px] font-semibold"
                          title="El único SuperAdministrador está protegido; ningún Admin puede quitarle permisos ni desactivarlo."
                        >
                          <Lock className="w-3 h-3 text-purple-400" />
                          <span>{isCurrentSession ? 'Sesión actual (Protegida)' : 'SuperAdmin Protegido'}</span>
                        </span>
                      ) : canModifyTarget ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={user.role}
                            onChange={(e) => handleRoleSelectChange(user, e.target.value as UserRole)}
                            aria-label={`Cambiar rol de ${user.name}`}
                            className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-[11px] text-cyan-200 font-medium focus:border-cyan-500"
                          >
                            <option value="admin">Admin (Prevencionista)</option>
                            <option value="operador">Operador (Normal)</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => handleStatusToggleClick(user)}
                            className="text-[11px] text-slate-400 hover:text-white underline"
                          >
                            {user.status === 'activo' ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-[11px]">
                          {isCurrentSession ? 'Sesión actual' : 'Solo lectura'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: NUEVO USUARIO */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                Registrar Nuevo Usuario en MineSafe
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Claudia Valdés M."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Email Corporativo</label>
                <input
                  type="email"
                  required
                  placeholder="cvaldes@minesafe.cl"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-300 block mb-1">RUT</label>
                  <input
                    type="text"
                    placeholder="18.321.654-3"
                    value={newRut}
                    onChange={(e) => setNewRut(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1">Rol en Faena</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  >
                    <option value="operador">Usuario Normal (Operador)</option>
                    <option value="admin">Administrador (Prevencionista)</option>
                  </select>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-purple-950/30 border border-purple-800/40 text-[11px] text-purple-200/90 flex items-center gap-2">
                <Crown className="w-4 h-4 text-purple-400 shrink-0" />
                <span>
                  Solo existe <strong>1 SuperAdministrador</strong> en toda la plataforma. Puedes asignar rol de <strong>Operador</strong> o <strong>Administrador</strong>.
                </span>
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Turno de Faena</label>
                <input
                  type="text"
                  value={newShift}
                  onChange={(e) => setNewShift(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-slate-300 bg-slate-800 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg font-semibold"
                >
                  Crear Usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
