import Papa from 'papaparse';
import { 
  SAPProject, 
  SAPModule, 
  ProjectState, 
  ActionStatus, 
  StageAction, 
  StageSchedule, 
  PROJECT_STAGES 
} from '../types/project';

export interface GoogleSheetsSyncConfig {
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  title: string;
  lastSyncAt: string | null;
  autoSync: boolean;
  lastError: string | null;
}

const STORAGE_KEY = 'sap_google_sheets_sync_config';

export const DEFAULT_SPREADSHEET_TITLE = 'Proyectos de Mejora SAP - Crucianelli';
export const DEFAULT_SPREADSHEET_ID = '1JGh9DlfXhjAqPlzoKo4U8tKPpLI_UHhaCJnWZQcyaL0';
export const DEFAULT_SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1JGh9DlfXhjAqPlzoKo4U8tKPpLI_UHhaCJnWZQcyaL0/edit';
export const SHEET_NAME = 'Proyectos SAP';

export const SHEETS_COLUMNS = [
  'Código de proyecto',
  'Área procesos',
  'Prioridad',
  'Módulos de SAP involucrados',
  'Título del proyecto',
  'Estado del proyecto',
  'Situación actual',
  'Necesidad de mejora',
  'Descripción de la acción',
  'Estado de la acción',
  'Responsable de la acción',
  'Fecha límite de la acción',
];

/**
 * Extracts a Google Spreadsheet ID from either a full URL or a raw ID string.
 */
export function extractSpreadsheetId(urlOrId: string): string {
  if (!urlOrId || !urlOrId.trim()) return '';
  const trimmed = urlOrId.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed.split('/')[0].split('?')[0].trim();
}

/**
 * Parses raw CSV text into a 2D array of strings, respecting quotes, multiline cells, and delimiters.
 */
export function parseCSVText(csvText: string): string[][] {
  if (!csvText || !csvText.trim()) return [];

  // Remove UTF-8 BOM if present
  const cleanText = csvText.replace(/^\uFEFF/, '');

  const parsed = Papa.parse<string[]>(cleanText, {
    skipEmptyLines: 'greedy',
  });

  if (parsed.errors && parsed.errors.length > 0) {
    console.warn('CSV parse notices/warnings:', parsed.errors);
  }

  const rawRows = parsed.data || [];
  return rawRows
    .map((row) => (Array.isArray(row) ? row.map((cell) => String(cell ?? '').trim()) : []))
    .filter((row) => row.some((cell) => cell.length > 0));
}

/**
 * Transforms a 2D matrix (Google Sheets or CSV rows) into a list of unified SAPProject objects
 * preserving the exact project code/number from the file and ensuring all projects are imported without omissions.
 */
export function parseSpreadsheetRowsToProjects(rows: (string | number)[][]): SAPProject[] {
  if (!rows || rows.length === 0) return [];

  // 1. Detect if row 0 is a header, data, or banner
  let headerRowIndex = -1;

  const KEYWORD_SET = [
    'código', 'codigo', 'cód', 'cod', 'n°', 'nº', 'nro', 'número', 'numero', 'id', 'item', '#',
    'área', 'area', 'sector', 'departamento', 'gerencia', 'proceso',
    'prioridad', 'prio', 'orden', 'ranking',
    'módulo', 'modulo', 'modulos', 'módulos', 'sap',
    'título', 'titulo', 'nombre', 'iniciativa', 'mejora',
    'responsable', 'asignado', 'encargado', 'dueño',
    'acción', 'accion', 'tarea', 'actividad', 'compromiso',
    'estado', 'status', 'fase', 'etapa', 'situación', 'situacion', 'necesidad', 'fecha'
  ];

  const countKeywords = (row: (string | number)[]): number => {
    return row.filter((c) => {
      const s = String(c || '').trim().toLowerCase();
      return s && KEYWORD_SET.some((kw) => s === kw || s.includes(kw));
    }).length;
  };

  const isNumericCode = (val: string | number): boolean => {
    const s = String(val ?? '').trim();
    return /^\d{1,4}$/.test(s);
  };

  const row0 = rows[0] || [];
  const row1 = rows[1] || [];
  const row0Cell0 = String(row0[0] || '').trim();
  const row1Cell0 = String(row1[0] || '').trim();

  // If row 0 cell 0 is numeric, and row 1 cell 0 is numeric, row 0 is already project data
  if (isNumericCode(row0Cell0) && isNumericCode(row1Cell0)) {
    headerRowIndex = -1;
  } else {
    const row0NonEmptyCount = row0.filter((c) => String(c || '').trim().length > 0).length;
    const row1Matches = countKeywords(row1);
    const row0Matches = countKeywords(row0);

    // If row 0 is a 1-2 cell banner and row 1 has multiple column headers
    if (row0NonEmptyCount <= 2 && row1Matches >= 2 && !isNumericCode(row1Cell0)) {
      headerRowIndex = 1;
    } else if (row0Matches >= 1 && !isNumericCode(row0Cell0)) {
      headerRowIndex = 0;
    } else {
      headerRowIndex = isNumericCode(row0Cell0) ? -1 : 0;
    }
  }

  // Check if any column contains ProySC pattern across rows
  let colWithProySc = -1;
  let maxProyScMatches = 0;
  const numCols = Math.max(...rows.map((r) => r.length));

  for (let c = 0; c < numCols; c++) {
    let count = 0;
    for (let r = 0; r < rows.length; r++) {
      const val = String(rows[r]?.[c] || '').trim();
      if (/^proysc[-_\s]?\d+/i.test(val)) {
        count++;
      }
    }
    if (count > maxProyScMatches) {
      maxProyScMatches = count;
      colWithProySc = c;
    }
  }

  // 2. Identify Column Indices
  let codeIdx = colWithProySc >= 0 ? colWithProySc : 0;
  let titleIdx = -1;
  let areaIdx = -1;
  let priorityIdx = -1;
  let modulesIdx = -1;
  let stateIdx = -1;
  let currentSituationIdx = -1;
  let improvementNeedIdx = -1;
  let actionTitleIdx = -1;
  let actionStatusIdx = -1;
  let actionResponsibleIdx = -1;
  let actionDueDateIdx = -1;

  if (headerRowIndex >= 0) {
    const headerRow = (rows[headerRowIndex] || []).map((h) => String(h || '').trim().toLowerCase());

    const matchHeader = (header: string, keyword: string): boolean => {
      const h = header.trim().toLowerCase();
      const kw = keyword.trim().toLowerCase();
      if (h === kw) return true;
      if (kw.length <= 3) {
        const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`(^|[^a-záéíóúñ0-9])${escaped}([^a-záéíóúñ0-9]|$)`, 'i').test(h);
      }
      return h.includes(kw);
    };

    const findCol = (keywords: string[], exclude: number[] = []): number => {
      return headerRow.findIndex((h, idx) => !exclude.includes(idx) && keywords.some((kw) => matchHeader(h, kw)));
    };

    const findColByPriority = (keywordGroups: string[][], exclude: number[] = []): number => {
      for (const group of keywordGroups) {
        const found = headerRow.findIndex(
          (h, idx) => !exclude.includes(idx) && group.some((kw) => matchHeader(h, kw))
        );
        if (found >= 0) return found;
      }
      return -1;
    };

    if (colWithProySc >= 0) {
      codeIdx = colWithProySc;
    } else {
      const detectedCodeCol = findColByPriority([
        // Group 1: Specific project code headers
        [
          'código de proyecto', 'codigo de proyecto', 'código proyecto', 'codigo proyecto',
          'código sap', 'codigo sap', 'proysc', 'id proyecto', 'id proy',
          'código', 'codigo', 'cód', 'cod.', 'cod'
        ],
        // Group 2: Project number headers
        [
          'n° de proyecto', 'nro de proyecto', 'n° proy', 'nro proy', 'número de proyecto', 'numero de proyecto'
        ],
        // Group 3: Row index / sequence number (only if no code column found)
        [
          'n°', 'nº', 'nro.', 'nro', 'número', 'numero', 'id', 'item', 'ítem', '#'
        ]
      ]);
      codeIdx = detectedCodeCol >= 0 ? detectedCodeCol : -1;
    }

    titleIdx = findColByPriority([
      // Priority 1: Exact explicit title / theme / topic keywords
      [
        'título del proyecto', 'titulo del proyecto', 'título proyecto', 'titulo proyecto',
        'título de proyecto', 'titulo de proyecto', 'nombre del proyecto', 'nombre de proyecto',
        'nombre proyecto', 'tema del proyecto', 'tema de proyecto', 'tema o proyecto',
        'tema / proyecto', 'tema/proyecto', 'tema proyecto', 'tema', 'título', 'titulo'
      ],
      // Priority 2: General title / name / topic
      [
        'nombre', 'denominación', 'denominacion',
        'iniciativa', 'iniciativas', 'mejora', 'mejoras', 'asunto'
      ],
      // Priority 3: Project description / detail
      [
        'descripción del proyecto', 'descripcion del proyecto', 'descripción', 'descripcion',
        'detalle del proyecto', 'detalle', 'proyecto', 'proyectos', 'requerimiento', 'objeto', 'objetivo'
      ]
    ], codeIdx >= 0 ? [codeIdx] : []);

    if (codeIdx < 0) {
      codeIdx = 0;
    }

    if (titleIdx < 0) {
      // Find candidate column not matched to code with text content
      const candidateIdx = headerRow.findIndex((_, idx) => idx !== codeIdx && idx !== colWithProySc);
      if (candidateIdx >= 0 && numCols >= 5) {
        titleIdx = candidateIdx <= 4 ? 4 : candidateIdx;
      }
    }

    areaIdx = findCol([
      'área procesos', 'area procesos', 'área proceso', 'area proceso',
      'área', 'area', 'sector', 'departamento', 'gerencia', 'proceso', 'procesos'
    ], [codeIdx, titleIdx]);

    priorityIdx = findCol([
      'prioridad', 'prio', 'orden', 'ranking', 'peso'
    ], [codeIdx, titleIdx]);

    modulesIdx = findCol([
      'módulos de sap', 'modulos de sap', 'módulo sap', 'modulo sap',
      'módulos', 'modulos', 'módulo', 'modulo', 'sap'
    ], [codeIdx, titleIdx]);

    stateIdx = findCol([
      'estado del proyecto', 'estado proyecto', 'fase', 'etapa', 'status proyecto'
    ], [codeIdx, titleIdx]);

    if (stateIdx < 0) {
      stateIdx = headerRow.findIndex(
        (h, idx) => idx !== codeIdx && idx !== titleIdx && h.includes('estado') && !h.includes('acción') && !h.includes('accion')
      );
    }

    currentSituationIdx = findCol([
      'situación actual', 'situacion actual', 'situación', 'situacion', 'problema', 'diagnóstico', 'diagnostico'
    ], [codeIdx, titleIdx]);

    improvementNeedIdx = findCol([
      'necesidad de mejora', 'necesidad mejora', 'necesidad', 'oportunidad', 'objetivo', 'meta', 'propósito', 'proposito'
    ], [codeIdx, titleIdx]);

    actionTitleIdx = findCol([
      'descripción de la acción', 'descripcion de la accion', 'descripción acción', 'descripcion accion',
      'acción', 'accion', 'tarea', 'actividad', 'compromiso'
    ], [codeIdx, titleIdx]);

    actionStatusIdx = findCol([
      'estado de la acción', 'estado de la accion', 'estado acción', 'estado accion', 'status de la acción'
    ], [codeIdx, titleIdx, stateIdx]);

    actionResponsibleIdx = findCol([
      'responsable de la acción', 'responsable acción', 'responsable', 'asignado', 'encargado', 'dueño', 'leader'
    ], [codeIdx, titleIdx]);

    actionDueDateIdx = findCol([
      'fecha límite de la acción', 'fecha límite', 'fecha limite', 'fecha fin', 'vencimiento', 'plazo', 'límite', 'limite', 'fecha'
    ], [codeIdx, titleIdx]);
  } else {
    // Default indices based on standard 12 columns
    codeIdx = 0;
    areaIdx = 1;
    priorityIdx = 2;
    modulesIdx = 3;
    titleIdx = 4;
    stateIdx = 5;
    currentSituationIdx = 6;
    improvementNeedIdx = 7;
    actionTitleIdx = 8;
    actionStatusIdx = 9;
    actionResponsibleIdx = 10;
    actionDueDateIdx = 11;
  }

  const projectEntries: {
    key: string;
    project: Partial<SAPProject>;
    actions: StageAction[];
  }[] = [];

  const projectMap = new Map<string, (typeof projectEntries)[0]>();
  let lastProjectKey = '';

  const startIndex = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || row.every((c) => !String(c || '').trim())) {
      continue;
    }

    // 1. Maintain the exact original project code from column 0 (or codeIdx)
    const cellCode = codeIdx >= 0 && row[codeIdx] !== undefined ? String(row[codeIdx]).trim() : '';

    const rawTitle = titleIdx >= 0 && row[titleIdx] !== undefined ? String(row[titleIdx]).trim() : '';
    const rawArea = areaIdx >= 0 && row[areaIdx] !== undefined ? String(row[areaIdx]).trim() : '';
    const rawPriority = priorityIdx >= 0 && row[priorityIdx] !== undefined ? String(row[priorityIdx]).trim() : '1';
    const numPriority = parseInt(rawPriority.replace(/[^0-9]/g, ''), 10) || 1;

    const rawModules = modulesIdx >= 0 && row[modulesIdx] !== undefined ? String(row[modulesIdx]).trim() : '';
    const sapModules: SAPModule[] = rawModules
      .split(/[,;\/]/)
      .map((m) => m.trim().toUpperCase() as SAPModule)
      .filter((m): m is SAPModule => ['PP', 'MM', 'WM', 'QM', 'SD', 'FI', 'CO'].includes(m));

    const rawState = stateIdx >= 0 && row[stateIdx] !== undefined ? String(row[stateIdx]).trim() : '01- Pendiente';
    const rawCurrentSit = currentSituationIdx >= 0 && row[currentSituationIdx] !== undefined ? String(row[currentSituationIdx]).trim() : '';
    const rawNeed = improvementNeedIdx >= 0 && row[improvementNeedIdx] !== undefined ? String(row[improvementNeedIdx]).trim() : '';

    const rawActionDesc = actionTitleIdx >= 0 && row[actionTitleIdx] !== undefined ? String(row[actionTitleIdx]).trim() : '';
    const rawActionStatus = actionStatusIdx >= 0 && row[actionStatusIdx] !== undefined ? String(row[actionStatusIdx]).trim() : 'Pendiente';
    const rawResponsible = actionResponsibleIdx >= 0 && row[actionResponsibleIdx] !== undefined ? String(row[actionResponsibleIdx]).trim() : '';
    const rawDueDate = actionDueDateIdx >= 0 && row[actionDueDateIdx] !== undefined ? String(row[actionDueDateIdx]).trim() : '';

    // Check if this row is strictly a continuation action for the preceding project
    const isSecondaryActionOnly =
      Boolean(lastProjectKey) &&
      !rawTitle &&
      !rawCurrentSit &&
      !rawNeed &&
      Boolean(rawActionDesc) &&
      (!cellCode || cellCode === projectMap.get(lastProjectKey)?.project.code);

    if (isSecondaryActionOnly) {
      const entry = projectMap.get(lastProjectKey)!;
      let normStatus: ActionStatus = 'Pendiente';
      const sLower = rawActionStatus.toLowerCase();
      if (sLower.includes('finaliz') || sLower.includes('complet')) normStatus = 'Finalizada';
      else if (sLower.includes('proceso') || sLower.includes('curso')) normStatus = 'En proceso';

      entry.actions.push({
        id: `act-${entry.project.code || 'prj'}-${entry.actions.length + 1}-${i}-${Date.now().toString(36)}`,
        stageId: 1,
        stageName: '01- Pendiente',
        title: rawActionDesc,
        status: normStatus,
        responsible: rawResponsible || 'Sin asignar',
        requiredDate: rawDueDate || new Date().toISOString().split('T')[0],
        commentsHistory: [],
        createdAt: new Date().toISOString(),
      });
      continue;
    }

    // This row is a PROJECT
    // Determine the true project code (always ensuring ProySC- format)
    let projectCode = '';

    // 1. Check designated code column (column 0) first
    const cellVal = cellCode;
    if (cellVal) {
      const mProySc = cellVal.match(/^proysc[-_\s]?(\d+)/i);
      if (mProySc) {
        projectCode = `ProySC-${mProySc[1]}`;
      } else {
        const mProj = cellVal.match(/^(?:proyecto|proy)[-_\s]*(\d+)/i);
        if (mProj) {
          projectCode = `ProySC-${mProj[1]}`;
        } else if (/^\d{1,4}$/.test(cellVal)) {
          projectCode = `ProySC-${cellVal}`;
        } else {
          projectCode = cellVal;
        }
      }
    }

    // 2. If not found in code column, check if ANY cell in this row has a ProySC- pattern
    if (!projectCode || !/^proysc[-_\s]?\d+/i.test(projectCode)) {
      for (const cell of row) {
        const s = String(cell ?? '').trim();
        const m = s.match(/^proysc[-_\s]?(\d+)/i);
        if (m) {
          projectCode = `ProySC-${m[1]}`;
          break;
        }
      }
    }

    // 3. Fallback if still empty: assign sequential ProySC- number
    if (!projectCode) {
      const seq = i + 1 - (headerRowIndex >= 0 ? 1 : 0);
      projectCode = `ProySC-${seq}`;
    }

    // Determine the true project title from CSV
    let projectTitle = rawTitle;
    if (!projectTitle) {
      // Check if any cell has a descriptive project title (length >= 3, not module, not state, not code)
      for (let c = 0; c < row.length; c++) {
        if (c === codeIdx || c === areaIdx || c === priorityIdx || c === modulesIdx || c === stateIdx || c === actionTitleIdx || c === actionResponsibleIdx || c === actionDueDateIdx) continue;
        const s = String(row[c] ?? '').trim();
        if (s.length >= 3 && !/^\d+$/.test(s) && !/^\d{4}-\d{2}-\d{2}$/.test(s) && !/^proysc[-_\s]?\d+/i.test(s)) {
          projectTitle = s;
          break;
        }
      }
    }
    if (!projectTitle) {
      if (rawNeed && rawNeed.length <= 120) {
        projectTitle = rawNeed;
      } else if (rawCurrentSit && rawCurrentSit.length <= 120) {
        projectTitle = rawCurrentSit;
      } else {
        projectTitle = `Proyecto ${projectCode}`;
      }
    }

    // If duplicate codes appear in different rows with titles, keep them both as distinct projects
    let entryKey = projectCode;
    if (projectMap.has(entryKey)) {
      entryKey = `${projectCode}__row_${i}`;
    }

    const projectId = `prj-${projectCode.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}-${i + 1}`;

    const projectEntry = {
      key: entryKey,
      project: {
        id: projectId,
        code: projectCode, // EXACT ProySC-X format guaranteed!
        area: (rawArea || 'Operaciones') as any,
        priority: numPriority,
        sapModules: sapModules.length > 0 ? sapModules : (['PP'] as SAPModule[]),
        title: projectTitle,
        state: (rawState as ProjectState) || '01- Pendiente',
        currentSituation: rawCurrentSit,
        currentSituationFiles: [],
        improvementNeed: rawNeed,
        improvementNeedFiles: [],
        team: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      actions: [] as StageAction[],
    };

    if (rawActionDesc) {
      let normStatus: ActionStatus = 'Pendiente';
      const sLower = rawActionStatus.toLowerCase();
      if (sLower.includes('finaliz') || sLower.includes('complet')) normStatus = 'Finalizada';
      else if (sLower.includes('proceso') || sLower.includes('curso')) normStatus = 'En proceso';

      projectEntry.actions.push({
        id: `act-${projectCode}-1-${i}-${Date.now().toString(36)}`,
        stageId: 1,
        stageName: '01- Pendiente',
        title: rawActionDesc,
        status: normStatus,
        responsible: rawResponsible || 'Sin asignar',
        requiredDate: rawDueDate || new Date().toISOString().split('T')[0],
        commentsHistory: [],
        createdAt: new Date().toISOString(),
      });
    }

    projectMap.set(entryKey, projectEntry);
    projectEntries.push(projectEntry);
    lastProjectKey = entryKey;
  }

  const result: SAPProject[] = [];
  for (const entry of projectEntries) {
    const p = entry.project;
    const schedule: StageSchedule[] = PROJECT_STAGES.map((st) => ({
      stageId: st.id,
      stageName: st.name,
      estimatedStartDate: '',
      estimatedEndDate: '',
      status: 'No iniciada',
    }));

    result.push({
      id: p.id || `prj-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      code: p.code || '',
      area: p.area || 'Operaciones',
      sapModules: p.sapModules && p.sapModules.length > 0 ? p.sapModules : ['PP'],
      title: p.title || `Proyecto ${p.code}`,
      currentSituation: p.currentSituation || '',
      currentSituationFiles: [],
      improvementNeed: p.improvementNeed || '',
      improvementNeedFiles: [],
      team: [],
      priority: p.priority || 1,
      state: p.state || '01- Pendiente',
      schedule,
      actions: entry.actions,
      createdAt: p.createdAt || new Date().toISOString(),
      updatedAt: p.updatedAt || new Date().toISOString(),
    });
  }

  // Sort logically by code (numbers 1, 2, 3.. and alphanumeric)
  result.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  return result;
}

export class GoogleSheetsSyncService {
  getConfig(): GoogleSheetsSyncConfig {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ...parsed,
          spreadsheetId: parsed.spreadsheetId || DEFAULT_SPREADSHEET_ID,
          spreadsheetUrl: parsed.spreadsheetUrl || DEFAULT_SPREADSHEET_URL,
        };
      }
    } catch (e) {
      console.error('Error reading Google Sheets sync config', e);
    }
    return {
      spreadsheetId: DEFAULT_SPREADSHEET_ID,
      spreadsheetUrl: DEFAULT_SPREADSHEET_URL,
      title: DEFAULT_SPREADSHEET_TITLE,
      lastSyncAt: null,
      autoSync: true,
      lastError: null,
    };
  }

  saveConfig(partial: Partial<GoogleSheetsSyncConfig>): GoogleSheetsSyncConfig {
    const current = this.getConfig();
    const updated: GoogleSheetsSyncConfig = { ...current, ...partial };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Error saving Google Sheets sync config', e);
    }
    return updated;
  }

  resetConfig(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Error removing Google Sheets sync config', e);
    }
  }

  /**
   * Transforms a list of SAPProject items into rows for Google Sheets
   */
  buildSpreadsheetData(projects: SAPProject[]): (string | number)[][] {
    const headerRow = [...SHEETS_COLUMNS];
    const dataRows: (string | number)[][] = [];

    projects.forEach((p) => {
      const code = p.code || '';
      const area = p.area || '';
      const priority =
        p.priority !== undefined && p.priority !== null
          ? `Prioridad #${p.priority}`
          : 'Sin prioridad';
      const modules = Array.isArray(p.sapModules) ? p.sapModules.join(', ') : '';
      const title = p.title || '';
      const state = p.state || '';
      const currentSituation = p.currentSituation || '';
      const improvementNeed = p.improvementNeed || '';

      if (p.actions && p.actions.length > 0) {
        p.actions.forEach((a) => {
          dataRows.push([
            code,
            area,
            priority,
            modules,
            title,
            state,
            currentSituation,
            improvementNeed,
            a.title || '',
            a.status || 'Pendiente',
            a.responsible || '',
            a.requiredDate || '',
          ]);
        });
      } else {
        dataRows.push([
          code,
          area,
          priority,
          modules,
          title,
          state,
          currentSituation,
          improvementNeed,
          '',
          '',
          '',
          '',
        ]);
      }
    });

    return [headerRow, ...dataRows];
  }

  /**
   * Fetches rows from a Google Sheet and parses them into unified SAPProject objects.
   * Scans all tabs in the spreadsheet to find the tab containing the most projects (e.g. 74 projects).
   */
  async importProjectsFromSpreadsheet(
    spreadsheetId: string,
    accessToken: string,
    targetSheetTitle?: string
  ): Promise<{
    projects: SAPProject[];
    totalRows: number;
    sheetTitle: string;
    availableSheets: {
      sheetId: number;
      title: string;
      rowCount: number;
      projectCount: number;
    }[];
  }> {
    try {
      if (!accessToken || accessToken.length < 20 || accessToken === 'undefined' || accessToken === 'null') {
        throw new Error('401: Token de acceso no válido o ausente. Se requiere reautenticación con Google.');
      }

      // 1. Get sheet names and properties
      const metaRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!metaRes.ok) {
        const errText = await metaRes.text();
        let message = `Error al acceder a la planilla (${metaRes.status})`;
        try {
          const parsed = JSON.parse(errText);
          if (parsed.error?.message) {
            message = parsed.error.message;
          }
        } catch {}

        if (metaRes.status === 401) {
          throw new Error(`401: La sesión de Google ha expirado o no cuenta con credenciales válidas (${message})`);
        }
        if (metaRes.status === 403) {
          throw new Error(`403: Permisos insuficientes para acceder a esta planilla con tu cuenta Google. Verificá que estés utilizando tu correo @crucianelli.com.`);
        }
        if (metaRes.status === 404) {
          throw new Error(`404: No se encontró la planilla con ID "${spreadsheetId}". Verificá la URL.`);
        }
        throw new Error(`Error (${metaRes.status}): ${message}`);
      }

      const metaData = await metaRes.json();
      const rawSheets = metaData.sheets || [];

      if (rawSheets.length === 0) {
        throw new Error('No se encontraron hojas o pestañas en el documento de Google Sheets.');
      }

      // Helper to construct a strictly valid A1 range derived from the sheet's actual grid dimensions
      const buildSheetRange = (sheetProps: any): string => {
        const title = (sheetProps?.title || 'Hoja').replace(/'/g, "''");
        const grid = sheetProps?.gridProperties;
        let lastCol = 'Z';
        if (grid?.columnCount && typeof grid.columnCount === 'number') {
          let temp = Math.min(Math.max(grid.columnCount, 1), 52);
          let letter = '';
          while (temp > 0) {
            const mod = (temp - 1) % 26;
            letter = String.fromCharCode(65 + mod) + letter;
            temp = Math.floor((temp - mod) / 26);
          }
          lastCol = letter || 'Z';
        }
        const maxRows = grid?.rowCount ? Math.min(grid.rowCount, 5000) : 2000;
        return `'${title}'!A1:${lastCol}${maxRows}`;
      };

      // 2. Fetch all sheet tabs. First try batchGet to read all tabs in 1 fast, reliable request.
      const evaluatedSheets: {
        sheetId: number;
        title: string;
        rowCount: number;
        projectCount: number;
        projects: SAPProject[];
      }[] = [];

      let batchSucceeded = false;
      try {
        const rangesQuery = rawSheets
          .map((s) => `ranges=${encodeURIComponent(buildSheetRange(s.properties))}`)
          .join('&');

        const batchRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${rangesQuery}&majorDimension=ROWS`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (batchRes.status === 401) {
          throw new Error('401: Sesión de Google expirada o no autenticada.');
        }
        if (batchRes.status === 403) {
          throw new Error('403: Permisos insuficientes para acceder a los datos de la planilla.');
        }

        if (batchRes.ok) {
          const batchData = await batchRes.json();
          const valueRanges: { range: string; values?: (string | number)[][] }[] = batchData.valueRanges || [];

          for (let i = 0; i < rawSheets.length; i++) {
            const s = rawSheets[i];
            const sTitle = s.properties?.title || 'Hoja';
            const sId = s.properties?.sheetId ?? 0;
            const vr = valueRanges[i];
            const rows = vr?.values || [];

            if (rows.length >= 2) {
              const parsedProjects = parseSpreadsheetRowsToProjects(rows);
              if (parsedProjects.length > 0) {
                evaluatedSheets.push({
                  sheetId: sId,
                  title: sTitle,
                  rowCount: Math.max(0, rows.length - 1),
                  projectCount: parsedProjects.length,
                  projects: parsedProjects,
                });
              }
            }
          }
          if (evaluatedSheets.length > 0) {
            batchSucceeded = true;
          }
        } else {
          const errBody = await batchRes.text().catch(() => '');
          console.warn(`batchGet returned status ${batchRes.status}:`, errBody);
        }
      } catch (batchErr: any) {
        if (batchErr?.message?.includes('401') || batchErr?.message?.includes('403')) {
          throw batchErr;
        }
        console.warn('batchGet failed or skipped, falling back to individual sheet fetch:', batchErr);
      }

      // If batchGet didn't evaluate any sheets, fall back to individual sheet requests with progressive range strategies
      if (!batchSucceeded || evaluatedSheets.length === 0) {
        for (const s of rawSheets) {
          const sTitle = s.properties?.title || 'Hoja 1';
          const sId = s.properties?.sheetId ?? 0;
          const safeTitle = sTitle.replace(/'/g, "''");

          const candidateRanges = [
            `'${safeTitle}'`,
            `${sTitle}`,
            buildSheetRange(s.properties),
            `'${safeTitle}'!A1:Z2000`,
            `'${safeTitle}'!A:Z`,
            `${sTitle}!A1:Z2000`,
            `${sTitle}!A:Z`,
          ];

          let rows: (string | number)[][] = [];

          for (const rangeCandidate of candidateRanges) {
            try {
              const valuesRes = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(rangeCandidate)}`,
                {
                  headers: { Authorization: `Bearer ${accessToken}` },
                }
              );

              if (valuesRes.status === 401) {
                throw new Error('401: Sesión de Google expirada o no autenticada.');
              }
              if (valuesRes.status === 403) {
                throw new Error('403: Permisos insuficientes para acceder a la planilla.');
              }

              if (valuesRes.ok) {
                const valuesData = await valuesRes.json();
                if (valuesData.values && valuesData.values.length >= 1) {
                  rows = valuesData.values;
                  break; // Successful range fetch
                }
              }
            } catch (rangeErr: any) {
              if (rangeErr?.message?.includes('401') || rangeErr?.message?.includes('403')) {
                throw rangeErr;
              }
            }
          }

          if (rows.length >= 1) {
            const parsedProjects = parseSpreadsheetRowsToProjects(rows);
            if (parsedProjects.length > 0) {
              evaluatedSheets.push({
                sheetId: sId,
                title: sTitle,
                rowCount: Math.max(0, rows.length - 1),
                projectCount: parsedProjects.length,
                projects: parsedProjects,
              });
            }
          }
        }
      }

      if (evaluatedSheets.length === 0) {
        const checkedNames = rawSheets.map((s: any) => `"${s.properties?.title || 'Hoja'}"`).join(', ');
        throw new Error(
          `No se encontraron filas con datos de proyectos para importar en ninguna de las pestañas revisadas (${checkedNames}). ` +
          `Verificá que la planilla contenga encabezados y filas con datos de proyectos, o importá directamente tu archivo CSV.`
        );
      }

      // Sort candidate sheets by project count descending
      evaluatedSheets.sort((a, b) => b.projectCount - a.projectCount);

      // Select target sheet if requested as a valid string, otherwise pick the sheet with the most projects
      let selected = evaluatedSheets[0];
      if (typeof targetSheetTitle === 'string' && targetSheetTitle.trim().length > 0) {
        const needle = targetSheetTitle.trim().toLowerCase();
        const matched = evaluatedSheets.find((es) => es.title.toLowerCase() === needle);
        if (matched) selected = matched;
      }

      this.saveConfig({
        spreadsheetId,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
        lastSyncAt: new Date().toISOString(),
        lastError: null,
      });

      return {
        projects: selected.projects,
        totalRows: selected.rowCount,
        sheetTitle: selected.title,
        availableSheets: evaluatedSheets.map((es) => ({
          sheetId: es.sheetId,
          title: es.title,
          rowCount: es.rowCount,
          projectCount: es.projectCount,
        })),
      };
    } catch (error: any) {
      console.error('Error importing from Google Sheets:', error);
      this.saveConfig({ lastError: error?.message });
      throw error;
    }
  }

  async ensureSpreadsheet(
    accessToken: string
  ): Promise<{ id: string; url: string }> {
    const config = this.getConfig();

    if (config.spreadsheetId) {
      try {
        const checkRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}?fields=spreadsheetId,spreadsheetUrl,properties.title`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );
        if (checkRes.ok) {
          const data = await checkRes.json();
          return {
            id: config.spreadsheetId,
            url: data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/edit`,
          };
        }
      } catch (e) {
        console.warn('Could not verify existing spreadsheet, creating a new one', e);
      }
    }

    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: DEFAULT_SPREADSHEET_TITLE,
        },
        sheets: [
          {
            properties: {
              title: SHEET_NAME,
              gridProperties: {
                rowCount: 1000,
                columnCount: SHEETS_COLUMNS.length,
                frozenRowCount: 1,
              },
            },
          },
        ],
      }),
    });

    if (!createRes.ok) {
      const errorText = await createRes.text();
      throw new Error(`Error al crear la planilla de Google Sheets: ${errorText}`);
    }

    const createdData = await createRes.json();
    const newId = createdData.spreadsheetId;
    const newUrl = createdData.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${newId}/edit`;

    this.saveConfig({
      spreadsheetId: newId,
      spreadsheetUrl: newUrl,
      title: DEFAULT_SPREADSHEET_TITLE,
      lastError: null,
    });

    return { id: newId, url: newUrl };
  }

  async syncProjects(
    projects: SAPProject[],
    accessToken: string
  ): Promise<{
    success: boolean;
    spreadsheetId: string;
    spreadsheetUrl: string;
    syncedCount: number;
    syncedRows: number;
    syncedAt: string;
  }> {
    try {
      const { id: spreadsheetId, url: spreadsheetUrl } = await this.ensureSpreadsheet(accessToken);
      const values = this.buildSpreadsheetData(projects);

      try {
        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${SHEET_NAME}'!A1:Z5000:clear`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
      } catch (e) {
        console.warn('Could not clear sheet prior to update', e);
      }

      const updateRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${SHEET_NAME}'!A1?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            range: `'${SHEET_NAME}'!A1`,
            majorDimension: 'ROWS',
            values,
          }),
        }
      );

      if (!updateRes.ok) {
        const errorText = await updateRes.text();
        throw new Error(`Error al escribir los proyectos en Google Sheets: ${errorText}`);
      }

      try {
        await this.formatSheet(spreadsheetId, accessToken);
      } catch (formatErr) {
        console.warn('Formatting spreadsheet headers had a minor issue', formatErr);
      }

      const now = new Date().toISOString();
      this.saveConfig({
        spreadsheetId,
        spreadsheetUrl,
        lastSyncAt: now,
        lastError: null,
      });

      return {
        success: true,
        spreadsheetId,
        spreadsheetUrl,
        syncedCount: projects.length,
        syncedRows: Math.max(0, values.length - 1),
        syncedAt: now,
      };
    } catch (error: any) {
      const msg = error?.message || 'Error desconocido al sincronizar con Google Sheets';
      this.saveConfig({ lastError: msg });
      throw error;
    }
  }

  private async formatSheet(spreadsheetId: string, accessToken: string): Promise<void> {
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (!metaRes.ok) return;
    const metaData = await metaRes.json();
    const targetSheet = metaData.sheets?.find(
      (s: any) => s.properties?.title === SHEET_NAME
    ) || metaData.sheets?.[0];

    const sheetId = targetSheet?.properties?.sheetId ?? 0;

    const requests = [
      {
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: SHEETS_COLUMNS.length,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.06, green: 0.09, blue: 0.16 },
              textFormat: {
                bold: true,
                foregroundColor: { red: 1, green: 1, blue: 1 },
                fontSize: 10,
              },
              verticalAlignment: 'MIDDLE',
              wrapStrategy: 'WRAP',
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,wrapStrategy)',
        },
      },
      {
        updateSheetProperties: {
          properties: {
            sheetId,
            gridProperties: {
              frozenRowCount: 1,
            },
          },
          fields: 'gridProperties.frozenRowCount',
        },
      },
    ];

    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    });
  }
}

export const googleSheetsSyncService = new GoogleSheetsSyncService();
