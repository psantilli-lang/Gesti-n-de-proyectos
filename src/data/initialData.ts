import { SAPProject, UserSession, AppUser } from '../types/project';

export const INITIAL_APP_USERS: AppUser[] = [
  {
    id: 'usr-psantilli',
    name: 'Paola Santilli (PMO SAP)',
    username: 'psantilli',
    email: 'psantilli@crucianelli.com',
    password: 'admin',
    role: 'admin',
    area: 'Administración',
    createdAt: '2026-01-01T08:00:00.000Z',
  },
  {
    id: 'usr-admin',
    name: 'Administrador General (PMO SAP)',
    username: 'admin',
    email: 'admin.sap@empresa.com',
    password: 'admin',
    role: 'admin',
    area: 'Administración',
    createdAt: '2026-01-01T08:00:00.000Z',
  },
  {
    id: 'usr-pmo',
    name: 'Oficina de Proyectos (PMO SAP)',
    username: 'pmo',
    email: 'pmo.sap@empresa.com',
    password: 'pmo',
    role: 'pmo',
    area: 'Administración',
    createdAt: '2026-01-01T08:00:00.000Z',
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
