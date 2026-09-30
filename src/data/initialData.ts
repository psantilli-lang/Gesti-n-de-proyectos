import { SAPProject, UserSession, AppUser } from '../types/project';

export const INITIAL_APP_USERS: AppUser[] = [
  {
    id: 'usr-psantilli',
    name: 'Paola Santilli (PMO SAP)',
    username: 'psantilli',
    email: 'psantilli@crucianelli.com',
    role: 'pmo',
    area: 'Administración',
    createdAt: '2026-01-01T08:00:00.000Z',
  },
  {
    id: 'usr-admin',
    name: 'Administrador General (PMO SAP)',
    username: 'admin',
    email: 'admin.sap@empresa.com',
    role: 'admin',
    area: 'Administración',
    createdAt: '2026-01-01T08:00:00.000Z',
  },
  {
    id: 'usr-rossi',
    name: 'Ing. Carlos Rossi (Líder PP / Producción)',
    username: 'crossi',
    email: 'c.rossi@empresa.com',
    role: 'responsible',
    area: 'Operaciones',
    createdAt: '2026-01-05T09:00:00.000Z',
  },
  {
    id: 'usr-valdez',
    name: 'Lic. Mariana Valdez (Consultora MM/WM)',
    username: 'mvaldez',
    email: 'm.valdez@empresa.com',
    role: 'responsible',
    area: 'Compras',
    createdAt: '2026-01-08T10:00:00.000Z',
  },
  {
    id: 'usr-duarte',
    name: 'Ing. Esteban Duarte (Jefe de Calidad QM)',
    username: 'eduarte',
    email: 'e.duarte@empresa.com',
    role: 'responsible',
    area: 'Operaciones',
    createdAt: '2026-01-10T11:00:00.000Z',
  },
  {
    id: 'usr-fontana',
    name: 'Cra. Sofía Fontana (Control de Gestión CO/FI)',
    username: 'sfontana',
    email: 's.fontana@empresa.com',
    role: 'responsible',
    area: 'Administración',
    createdAt: '2026-01-12T12:00:00.000Z',
  },
  {
    id: 'usr-perez',
    name: 'Lic. Rodrigo Pérez (Key User SD / Ventas)',
    username: 'rperez',
    email: 'r.perez@empresa.com',
    role: 'responsible',
    area: 'Ventas',
    createdAt: '2026-01-15T14:00:00.000Z',
  },
];

export const INITIAL_USERS: UserSession[] = INITIAL_APP_USERS.map((u) => ({
  id: u.id,
  name: u.name,
  username: u.username,
  email: u.email,
  role: u.role,
  area: u.area,
}));

// Official projects will be loaded directly from Crucianelli Google Sheets or CSV.
// Test projects are removed completely.
export const INITIAL_PROJECTS: SAPProject[] = [];
