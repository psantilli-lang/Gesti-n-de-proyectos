import { SAPProject, UserSession, AppUser } from '../types/project';

export const INITIAL_APP_USERS: AppUser[] = [
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
    id: 'usr-rossi',
    name: 'Ing. Carlos Rossi (Líder PP / Producción)',
    username: 'crossi',
    email: 'c.rossi@empresa.com',
    password: 'sap2026',
    role: 'responsible',
    area: 'Operaciones',
    createdAt: '2026-01-05T09:00:00.000Z',
  },
  {
    id: 'usr-valdez',
    name: 'Lic. Mariana Valdez (Consultora MM/WM)',
    username: 'mvaldez',
    email: 'm.valdez@empresa.com',
    password: 'sap2026',
    role: 'responsible',
    area: 'Compras',
    createdAt: '2026-01-08T10:00:00.000Z',
  },
  {
    id: 'usr-duarte',
    name: 'Ing. Esteban Duarte (Jefe de Calidad QM)',
    username: 'eduarte',
    email: 'e.duarte@empresa.com',
    password: 'sap2026',
    role: 'responsible',
    area: 'Operaciones',
    createdAt: '2026-01-10T11:00:00.000Z',
  },
  {
    id: 'usr-fontana',
    name: 'Cra. Sofía Fontana (Control de Gestión CO/FI)',
    username: 'sfontana',
    email: 's.fontana@empresa.com',
    password: 'sap2026',
    role: 'responsible',
    area: 'Administración',
    createdAt: '2026-01-12T12:00:00.000Z',
  },
  {
    id: 'usr-perez',
    name: 'Lic. Rodrigo Pérez (Key User SD / Ventas)',
    username: 'rperez',
    email: 'r.perez@empresa.com',
    password: 'sap2026',
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

export const INITIAL_PROJECTS: SAPProject[] = [
  {
    id: 'prj-sap-001',
    code: 'SAP-2026-001',
    area: 'Operaciones',
    sapModules: ['PP', 'MM', 'WM'],
    title: 'Automatización de Consumo de Materias Primas por Backflush en Órdenes de Fabricación',
    currentSituation: 'Actualmente los operarios de planta registran las salidas de insumos y materia prima de forma manual en planillas de papel al finalizar el turno. Esto genera desfasajes de inventario de hasta 48 horas en SAP y diferencias continuas entre stock físico y teórico en almacén intermedio.',
    currentSituationFiles: [
      { id: 'f-001', name: 'Diagnostico_Desvios_Stock_PP_2026.pdf', size: 1420000, type: 'application/pdf', uploadedAt: '2026-01-15' },
      { id: 'f-002', name: 'Planilla_Manual_Consumos_Actual.xlsx', size: 480000, type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', uploadedAt: '2026-01-16' }
    ],
    improvementNeed: 'Implementar el consumo automático por backflush vinculado a la notificación de fases de orden de fabricación (transacciones COOIS / CO11N y terminales RF), integrando almacén intermedio con ubicación específica y reserva de lote.',
    improvementNeedFiles: [
      { id: 'f-003', name: 'Objetivo_Mejora_Backflush_Tiempos.pdf', size: 890000, type: 'application/pdf', uploadedAt: '2026-01-18' }
    ],
    team: [
      { id: 'tm-1', name: 'Ing. Carlos Rossi', role: 'Líder Funcional PP' },
      { id: 'tm-2', name: 'Lic. Mariana Valdez', role: 'Consultora SAP MM/WM' },
      { id: 'tm-3', name: 'Juan Manuel Blanco', role: 'Key User Planta 1' }
    ],
    priority: 1,
    state: '05- En Desarrollo',
    schedule: [
      { stageId: 1, stageName: '01- Pendiente', estimatedStartDate: '2026-01-10', estimatedEndDate: '2026-01-20', actualEndDate: '2026-01-19', status: 'Completada' },
      { stageId: 2, stageName: '02- En relevamiento', estimatedStartDate: '2026-01-21', estimatedEndDate: '2026-02-10', actualEndDate: '2026-02-09', status: 'Completada' },
      { stageId: 3, stageName: '03-Consulta usuario', estimatedStartDate: '2026-02-11', estimatedEndDate: '2026-02-28', actualEndDate: '2026-02-27', status: 'Completada' },
      { stageId: 4, stageName: '05- En Desarrollo', estimatedStartDate: '2026-03-01', estimatedEndDate: '2026-03-30', status: 'En curso' },
      { stageId: 5, stageName: '06- Prueba Funcional', estimatedStartDate: '2026-04-01', estimatedEndDate: '2026-04-20', status: 'No iniciada' },
      { stageId: 6, stageName: '07- Entregado', estimatedStartDate: '2026-04-21', estimatedEndDate: '2026-04-30', status: 'No iniciada' }
    ],
    actions: [
      {
        id: 'act-001',
        stageId: 4,
        stageName: '05- En Desarrollo',
        title: 'Parametrizar perfiles de control de fabricación y tipo de movimiento 261 en ambiente QAS',
        requiredDate: '2026-03-20',
        responsible: 'Lic. Mariana Valdez (Consultora MM/WM)',
        status: 'En proceso',
        executionComment: 'Se definieron los puntos de consumo en ruta de fabricación. Resta probar con órdenes con subcomponentes serializados.',
        commentsHistory: [
          { id: 'c-1', author: 'Lic. Mariana Valdez', date: '2026-03-12', text: 'Iniciada la parametrización de movimientos en QAS.' }
        ],
        attachments: [
          {
            id: 'att-act-001',
            name: 'Mapeo_Movimiento_261_QAS.xlsx',
            size: 452000,
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            uploadedAt: '2026-03-12',
            dataUrl: 'data:text/plain;charset=utf-8,Mapeo%20de%20movimientos%20261%20y%20puntos%20de%20consumo%20PP/WM'
          }
        ],
        createdAt: '2026-03-01'
      },
      {
        id: 'act-002',
        stageId: 4,
        stageName: '05- En Desarrollo',
        title: 'Desarrollar user-exit para validación estricta de stock disponible antes de liberar orden',
        requiredDate: '2026-03-25',
        responsible: 'Ing. Carlos Rossi (Líder PP / Producción)',
        status: 'Pendiente',
        executionComment: '',
        commentsHistory: [],
        createdAt: '2026-03-02'
      },
      {
        id: 'act-003',
        stageId: 4,
        stageName: '05- En Desarrollo',
        title: 'Ajustar datos maestros en listas de materiales (BOM) marcando indicador de backflush',
        requiredDate: '2026-03-28',
        responsible: 'Ing. Carlos Rossi (Líder PP / Producción)',
        status: 'Pendiente',
        executionComment: '',
        commentsHistory: [],
        createdAt: '2026-03-05'
      }
    ],
    createdAt: '2026-01-10',
    updatedAt: '2026-03-12'
  },
  {
    id: 'prj-sap-002',
    code: 'SAP-2026-002',
    area: 'Operaciones',
    sapModules: ['QM', 'MM', 'PP'],
    title: 'Digitalización de Lotes de Inspección en Recepción de Proveedores y Bloqueo Automático',
    currentSituation: 'Los lotes de compras importadas y nacionales se recepcionan sin control sistemático en SAP. Los informes de calidad se archivan en carpetas físicas y a menudo compras utiliza materiales que aún no tienen dictamen de calidad definitivo.',
    currentSituationFiles: [
      { id: 'f-004', name: 'Auditoria_Calidad_Proveedores_2025.pdf', size: 2150000, type: 'application/pdf', uploadedAt: '2026-01-20' }
    ],
    improvementNeed: 'Activar clase de inspección 01 en vista QM del maestro de materiales. Al hacer la MIGO se debe generar automáticamente el lote de inspección en estado bloqueado para control de calidad y solo pasar a libre utilización tras el dictamen (UD).',
    improvementNeedFiles: [
      { id: 'f-005', name: 'Flujo_Aprobacion_QM_Propuesto.pdf', size: 1100000, type: 'application/pdf', uploadedAt: '2026-01-22' }
    ],
    team: [
      { id: 'tm-4', name: 'Ing. Esteban Duarte', role: 'Líder Funcional QM' },
      { id: 'tm-5', name: 'Lic. Mariana Valdez', role: 'Consultora MM' },
      { id: 'tm-6', name: 'Gabriel Soria', role: 'Inspector de Recepción' }
    ],
    priority: 1,
    state: '06- Prueba Funcional',
    schedule: [
      { stageId: 1, stageName: '01- Pendiente', estimatedStartDate: '2026-01-15', estimatedEndDate: '2026-01-25', actualEndDate: '2026-01-24', status: 'Completada' },
      { stageId: 2, stageName: '02- En relevamiento', estimatedStartDate: '2026-01-26', estimatedEndDate: '2026-02-15', actualEndDate: '2026-02-14', status: 'Completada' },
      { stageId: 3, stageName: '03-Consulta usuario', estimatedStartDate: '2026-02-16', estimatedEndDate: '2026-02-28', actualEndDate: '2026-02-27', status: 'Completada' },
      { stageId: 4, stageName: '05- En Desarrollo', estimatedStartDate: '2026-03-01', estimatedEndDate: '2026-03-15', actualEndDate: '2026-03-14', status: 'Completada' },
      { stageId: 5, stageName: '06- Prueba Funcional', estimatedStartDate: '2026-03-16', estimatedEndDate: '2026-03-31', status: 'En curso' },
      { stageId: 6, stageName: '07- Entregado', estimatedStartDate: '2026-04-01', estimatedEndDate: '2026-04-15', status: 'No iniciada' }
    ],
    actions: [
      {
        id: 'act-004',
        stageId: 5,
        stageName: '06- Prueba Funcional',
        title: 'Ejecutar matriz de pruebas con 10 tipos de materiales críticos en ambiente de pruebas',
        requiredDate: '2026-03-24',
        responsible: 'Ing. Esteban Duarte (Jefe de Calidad QM)',
        status: 'En proceso',
        executionComment: 'Se probaron 6 familias con éxito. Faltan chapas y perfiles especiales que requieren plan de muestreo compuesto.',
        commentsHistory: [
          { id: 'c-2', author: 'Ing. Esteban Duarte', date: '2026-03-18', text: 'Iniciadas pruebas en QAS con el equipo de laboratorio.' }
        ],
        attachments: [
          {
            id: 'att-act-002',
            name: 'Matriz_Pruebas_Familias_Criticas.pdf',
            size: 1420000,
            type: 'application/pdf',
            uploadedAt: '2026-03-18',
            dataUrl: 'data:text/plain;charset=utf-8,Matriz%20de%20casos%20de%20prueba%20QM%20en%20recepcion%20de%20materiales'
          }
        ],
        createdAt: '2026-03-16'
      },
      {
        id: 'act-005',
        stageId: 5,
        stageName: '06- Prueba Funcional',
        title: 'Capacitar a los inspectores de recepción en transacción QA32 y registro de defectos',
        requiredDate: '2026-03-29',
        responsible: 'Ing. Esteban Duarte (Jefe de Calidad QM)',
        status: 'Pendiente',
        executionComment: '',
        commentsHistory: [],
        createdAt: '2026-03-16'
      }
    ],
    createdAt: '2026-01-15',
    updatedAt: '2026-03-18'
  },
  {
    id: 'prj-sap-003',
    code: 'SAP-2026-003',
    area: 'Compras',
    sapModules: ['WM', 'MM', 'SD'],
    title: 'Gestión por Radiofrecuencia de Ubicaciones y Picking Guiado en Almacén Central',
    currentSituation: 'El almacén central opera con búsqueda visual y memoria de los operarios. Se producen extravíos de partes semielaboradas y demoras en el abastecimiento a líneas de ensamble final.',
    currentSituationFiles: [
      { id: 'f-006', name: 'Layout_Almacen_Central_Puntos_Criticos.pdf', size: 3200000, type: 'application/pdf', uploadedAt: '2026-02-01' }
    ],
    improvementNeed: 'Implementar transacciones móviles SAP RF (LM00) con códigos de barras de estanterías y pallets, habilitando picking por olas y confirmación en tiempo real.',
    improvementNeedFiles: [
      { id: 'f-007', name: 'Alcance_RF_Almacen_EWM.docx', size: 640000, type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', uploadedAt: '2026-02-03' }
    ],
    team: [
      { id: 'tm-7', name: 'Lic. Mariana Valdez', role: 'Consultora WM' },
      { id: 'tm-8', name: 'Pablo Ferreyra', role: 'Supervisor de Logística' }
    ],
    priority: 1,
    state: '02- En relevamiento',
    schedule: [
      { stageId: 1, stageName: '01- Pendiente', estimatedStartDate: '2026-02-01', estimatedEndDate: '2026-02-15', actualEndDate: '2026-02-14', status: 'Completada' },
      { stageId: 2, stageName: '02- En relevamiento', estimatedStartDate: '2026-02-16', estimatedEndDate: '2026-03-31', status: 'En curso' },
      { stageId: 3, stageName: '03-Consulta usuario', estimatedStartDate: '2026-04-01', estimatedEndDate: '2026-04-20', status: 'No iniciada' },
      { stageId: 4, stageName: '05- En Desarrollo', estimatedStartDate: '2026-04-21', estimatedEndDate: '2026-06-15', status: 'No iniciada' },
      { stageId: 5, stageName: '06- Prueba Funcional', estimatedStartDate: '2026-06-16', estimatedEndDate: '2026-07-15', status: 'No iniciada' },
      { stageId: 6, stageName: '07- Entregado', estimatedStartDate: '2026-07-16', estimatedEndDate: '2026-07-31', status: 'No iniciada' }
    ],
    actions: [
      {
        id: 'act-006',
        stageId: 2,
        stageName: '02- En relevamiento',
        title: 'Definir especificación de terminales rugerizados y compatibilidad con Telnet / ITSmobile SAP',
        requiredDate: '2026-03-22',
        responsible: 'Lic. Mariana Valdez (Consultora MM/WM)',
        status: 'En proceso',
        executionComment: 'Se recibieron cotizaciones de terminales Zebra TC26 y escáneres de largo alcance. Reunión técnica coordinada con IT.',
        commentsHistory: [],
        createdAt: '2026-03-05'
      },
      {
        id: 'act-007',
        stageId: 2,
        stageName: '02- En relevamiento',
        title: 'Completar plano de mapeo de tipos de almacén y nomenclatura de estanterías',
        requiredDate: '2026-03-29',
        responsible: 'Lic. Mariana Valdez (Consultora MM/WM)',
        status: 'Pendiente',
        executionComment: '',
        commentsHistory: [],
        createdAt: '2026-03-08'
      }
    ],
    createdAt: '2026-02-01',
    updatedAt: '2026-03-15'
  },
  {
    id: 'prj-sap-004',
    code: 'SAP-2026-004',
    area: 'Administración',
    sapModules: ['FI', 'CO', 'SD'],
    title: 'Liquidación Automática de Desvíos de Costos de Órdenes de Fabricación (CO-PC)',
    currentSituation: 'El cierre de mes contable demora más de 7 días hábiles debido a revisiones manuales de desviaciones entre costo estándar y costo real de las órdenes de producción.',
    currentSituationFiles: [],
    improvementNeed: 'Automatizar la corrida de liquidación KKS1 y KKS2 en background, con generación de reportes de varianzas por componente y notificación a los responsables de producción.',
    improvementNeedFiles: [],
    team: [
      { id: 'tm-9', name: 'Cra. Sofía Fontana', role: 'Líder Funcional CO/FI' },
      { id: 'tm-10', name: 'Ing. Carlos Rossi', role: 'Interlocutor Producción' }
    ],
    priority: 1,
    state: '07- Entregado',
    schedule: [
      { stageId: 1, stageName: '01- Pendiente', estimatedStartDate: '2025-11-01', estimatedEndDate: '2025-11-15', actualEndDate: '2025-11-14', status: 'Completada' },
      { stageId: 2, stageName: '02- En relevamiento', estimatedStartDate: '2025-11-16', estimatedEndDate: '2025-12-15', actualEndDate: '2025-12-15', status: 'Completada' },
      { stageId: 3, stageName: '03-Consulta usuario', estimatedStartDate: '2025-12-16', estimatedEndDate: '2025-12-28', actualEndDate: '2025-12-23', status: 'Completada' },
      { stageId: 4, stageName: '05- En Desarrollo', estimatedStartDate: '2026-01-05', estimatedEndDate: '2026-02-15', actualEndDate: '2026-02-20', status: 'Completada' },
      { stageId: 5, stageName: '06- Prueba Funcional', estimatedStartDate: '2026-02-21', estimatedEndDate: '2026-03-10', actualEndDate: '2026-03-08', status: 'Completada' },
      { stageId: 6, stageName: '07- Entregado', estimatedStartDate: '2026-03-11', estimatedEndDate: '2026-03-25', actualEndDate: '2026-03-20', status: 'Completada' }
    ],
    actions: [
      {
        id: 'act-008',
        stageId: 6,
        stageName: '07- Entregado',
        title: 'Programar jobs nocturnos de liquidación en ambiente de producción PRD',
        requiredDate: '2026-03-21',
        responsible: 'Cra. Sofía Fontana (Control de Gestión CO/FI)',
        status: 'Finalizada',
        executionComment: 'Se creó la variante de ejecución y los jobs corren satisfactoriamente todas las noches.',
        commentsHistory: [],
        createdAt: '2026-03-11'
      },
      {
        id: 'act-009',
        stageId: 6,
        stageName: '07- Entregado',
        title: 'Verificar primer cierre contable semanal con nuevas cuentas de desvío',
        requiredDate: '2026-03-25',
        responsible: 'Cra. Sofía Fontana (Control de Gestión CO/FI)',
        status: 'Finalizada',
        executionComment: 'Verificado con el equipo contable. Cierre realizado sin incidencias.',
        commentsHistory: [],
        createdAt: '2026-03-12'
      }
    ],
    createdAt: '2025-11-01',
    updatedAt: '2026-03-14'
  },
  {
    id: 'prj-sap-005',
    code: 'SAP-2026-005',
    area: 'Operaciones',
    sapModules: ['PP', 'QM'],
    title: 'Trazabilidad Unitaria por Número de Serie en Chasis y Componentes Críticos',
    currentSituation: 'Solo se manejan lotes agrupados. Al presentarse un reclamo de garantía o defecto de campo, es imposible saber qué chasis exacto montó qué subconjunto o soldadura defectuosa.',
    currentSituationFiles: [],
    improvementNeed: 'Configurar perfiles de número de serie en SAP (transacción OIS2) para asignación obligatoria en orden de fabricación y despacho a cliente vía SD.',
    improvementNeedFiles: [],
    team: [
      { id: 'tm-11', name: 'Ing. Carlos Rossi', role: 'Líder de Proyecto' },
      { id: 'tm-12', name: 'Ing. Esteban Duarte', role: 'Calidad' }
    ],
    priority: 2,
    state: '01- Pendiente',
    schedule: [
      { stageId: 1, stageName: '01- Pendiente', estimatedStartDate: '2026-03-01', estimatedEndDate: '2026-03-25', status: 'En curso' },
      { stageId: 2, stageName: '02- En relevamiento', estimatedStartDate: '2026-03-26', estimatedEndDate: '2026-04-20', status: 'No iniciada' },
      { stageId: 3, stageName: '03-Consulta usuario', estimatedStartDate: '2026-04-21', estimatedEndDate: '2026-04-30', status: 'No iniciada' },
      { stageId: 4, stageName: '05- En Desarrollo', estimatedStartDate: '2026-05-01', estimatedEndDate: '2026-06-15', status: 'No iniciada' },
      { stageId: 5, stageName: '06- Prueba Funcional', estimatedStartDate: '2026-06-16', estimatedEndDate: '2026-07-05', status: 'No iniciada' },
      { stageId: 6, stageName: '07- Entregado', estimatedStartDate: '2026-07-06', estimatedEndDate: '2026-07-20', status: 'No iniciada' }
    ],
    actions: [
      {
        id: 'act-010',
        stageId: 1,
        stageName: '01- Pendiente',
        title: 'Relevar método de grabado físico de números de chasis en línea de ensamble',
        requiredDate: '2026-03-22',
        responsible: 'Ing. Carlos Rossi (Líder PP / Producción)',
        status: 'Pendiente',
        executionComment: '',
        commentsHistory: [],
        createdAt: '2026-03-05'
      }
    ],
    createdAt: '2026-03-01',
    updatedAt: '2026-03-05'
  }
];
