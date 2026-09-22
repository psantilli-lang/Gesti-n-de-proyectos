import { SAPProject } from '../types/project';

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

export class GoogleSheetsSyncService {
  getConfig(): GoogleSheetsSyncConfig {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('Error reading Google Sheets sync config', e);
    }
    return {
      spreadsheetId: null,
      spreadsheetUrl: null,
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
   * Outputting 1 action per row, with separate columns for Action Description,
   * Action Status, Responsible, and Due Date.
   */
  buildSpreadsheetData(projects: SAPProject[]): (string | number)[][] {
    const headerRow = [...SHEETS_COLUMNS];
    const dataRows: (string | number)[][] = [];

    projects.forEach((p) => {
      // Shared project fields
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
        // Output 1 row per action
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
            a.responsible || 'Sin asignar',
            a.requiredDate || '-',
          ]);
        });
      } else {
        // Project with no actions yet: output 1 row with placeholder
        dataRows.push([
          code,
          area,
          priority,
          modules,
          title,
          state,
          currentSituation,
          improvementNeed,
          'Sin acciones registradas',
          '-',
          '-',
          '-',
        ]);
      }
    });

    return [headerRow, ...dataRows];
  }

  /**
   * Ensures that a single spreadsheet exists and is accessible.
   * If it already exists in config and is valid, returns it.
   * Otherwise, creates a new one and stores its ID.
   */
  async ensureSpreadsheet(accessToken: string): Promise<{ id: string; url: string }> {
    const config = this.getConfig();

    if (config.spreadsheetId) {
      try {
        const verifyRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}?fields=spreadsheetId,spreadsheetUrl,properties.title`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (verifyRes.ok) {
          const data = await verifyRes.json();
          const url = data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`;
          this.saveConfig({
            spreadsheetId: data.spreadsheetId,
            spreadsheetUrl: url,
            title: data.properties?.title || config.title,
            lastError: null,
          });
          return { id: data.spreadsheetId, url };
        }
      } catch (err) {
        console.warn('Existing spreadsheet could not be accessed, creating a fresh one', err);
      }
    }

    // Create a new single unique spreadsheet
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
                frozenRowCount: 1,
                columnCount: 12,
              },
            },
          },
        ],
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`Error al crear la hoja en Google Sheets: ${errText}`);
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

  /**
   * Synchronizes all loaded projects with the unique Google Sheet.
   */
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
      // 1. Ensure unique spreadsheet file exists
      const { id: spreadsheetId, url: spreadsheetUrl } = await this.ensureSpreadsheet(accessToken);

      // 2. Prepare tabular matrix
      const values = this.buildSpreadsheetData(projects);

      // 3. Clear existing content in the sheet
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

      // 4. Update rows
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

      // 5. Apply header styling & column dimensions for professional corporate appearance
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

  /**
   * Applies formatting (SAP navy header, bold white text, cell padding, auto wrap)
   */
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
      // Format header row (Navy Blue #0F172A, bold white text, centered)
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
              backgroundColor: { red: 0.06, green: 0.09, blue: 0.16 }, // #0F172A
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
      // Freeze row 1
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
