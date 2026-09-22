import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SAPProject } from '../types/project';
import { ProjectHealth } from '../services/storageService';
import { formatDateSpanish } from './helpers';

// Helper to safely invoke autoTable across different bundling modes (CJS/ESM/Vite)
function runAutoTable(doc: jsPDF, options: any) {
  if (typeof autoTable === 'function') {
    autoTable(doc, options);
  } else if (typeof (autoTable as any)?.default === 'function') {
    (autoTable as any).default(doc, options);
  } else if (typeof (doc as any).autoTable === 'function') {
    (doc as any).autoTable(options);
  } else {
    throw new Error('Librería de tablas no disponible');
  }
}

interface GenerateReportPDFParams {
  projects: SAPProject[];
  filteredProjects: SAPProject[];
  selectedArea: string;
  datePreset: string;
  scheduleCompliance: {
    complianceRate: number;
    avgDelayDays: number;
    onTimeProjects: number;
    delayedProjects: number;
    delayedStagesTotal: number;
    pendingProjectsCount?: number;
    cancelledProjectsCount?: number;
    evaluatedProjectsCount?: number;
  };
  stageDistribution: Array<{
    stageIndex: number;
    fullName: string;
    shortName: string;
    count: number;
  }>;
  pendingActionsList: Array<{
    projectCode: string;
    projectTitle: string;
    projectArea: string;
    stageName: string;
    actionTitle: string;
    responsible: string;
    requiredDate: string;
    status: string;
    isOverdue: boolean;
    executionComment: string;
  }>;
  getProjectHealth: (p: SAPProject) => ProjectHealth;
}

export function generateExecutiveReportPDF({
  projects,
  filteredProjects,
  selectedArea,
  datePreset,
  scheduleCompliance,
  stageDistribution,
  pendingActionsList,
  getProjectHealth,
}: GenerateReportPDFParams): jsPDF {
  // Use landscape A4 (297 x 210 mm) for rich tabular visibility
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const totalPagesExp = '{total_pages_count_string}';
  const currentDateStr = new Date().toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Colors
  const primaryNavy: [number, number, number] = [15, 42, 74]; // #0f2a4a
  const accentBlue: [number, number, number] = [37, 99, 235]; // #2563eb
  const textDark: [number, number, number] = [30, 41, 59]; // #1e293b
  const textMuted: [number, number, number] = [100, 116, 139]; // #64748b
  const bgLight: [number, number, number] = [248, 250, 252]; // #f8fafc

  // Header Banner
  doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.rect(0, 0, 297, 24, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('CRUCIANELLI  |  REPORTE EJECUTIVO DE PROYECTOS DE MEJORA SAP', 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(
    'Tablero de Control, Cronogramas y Acciones Requeridas por Responsable',
    14,
    18
  );

  // Date and Metadata on Top Right
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(`Emisión: ${currentDateStr}`, 283, 11, { align: 'right' });

  const filterText = `Área: ${selectedArea === 'all' ? 'Todas' : selectedArea}   |   Rango: ${
    datePreset === 'all'
      ? 'Histórico Total'
      : datePreset === 'week'
      ? 'Últimos 7 días'
      : datePreset === 'month'
      ? 'Últimos 30 días'
      : 'Personalizado'
  }`;
  doc.setTextColor(191, 219, 254);
  doc.text(filterText, 283, 18, { align: 'right' });

  // 1. KPI SUMMARY BOXES (Y: 28 to 48)
  const boxY = 28;
  const boxH = 19;
  const boxW = 64;
  const gap = 6;
  let startX = 14;

  const kpis = [
    {
      title: 'PROYECTOS TOTALES',
      main: `${filteredProjects.length}`,
      sub: `${filteredProjects.filter((p) => p.state !== '07- Entregado' && !p.state.includes('Cancelado')).length} activos • ${
        filteredProjects.filter((p) => p.state === '07- Entregado').length
      } finalizados${
        filteredProjects.filter((p) => p.state.includes('Cancelado')).length > 0
          ? ` • ${filteredProjects.filter((p) => p.state.includes('Cancelado')).length} cancelados`
          : ''
      }`,
      borderCol: accentBlue,
    },
    {
      title: 'CUMPLIMIENTO CRONOGRAMA',
      main: `${scheduleCompliance.complianceRate}%`,
      sub: `${scheduleCompliance.onTimeProjects} a tiempo • ${scheduleCompliance.delayedProjects} demorados${
        scheduleCompliance.pendingProjectsCount
          ? ` (${scheduleCompliance.pendingProjectsCount} pend.`
          : ''
      }${
        scheduleCompliance.cancelledProjectsCount
          ? `${scheduleCompliance.pendingProjectsCount ? ', ' : ' ('}${scheduleCompliance.cancelledProjectsCount} canc.`
          : ''
      }${
        scheduleCompliance.pendingProjectsCount || scheduleCompliance.cancelledProjectsCount ? ' excluidos)' : ''
      }`,
      borderCol: [16, 185, 129], // emerald
    },
    {
      title: 'DESVÍO PROMEDIO',
      main: `${scheduleCompliance.avgDelayDays} días`,
      sub: `${scheduleCompliance.delayedStagesTotal} etapas en desvío`,
      borderCol: [245, 158, 11], // amber
    },
    {
      title: 'ACCIONES PENDIENTES',
      main: `${pendingActionsList.length}`,
      sub: `${pendingActionsList.filter((a) => a.isOverdue).length} vencidas`,
      borderCol: [225, 29, 72], // rose
    },
  ];

  kpis.forEach((kpi, idx) => {
    const x = startX + idx * (boxW + gap);
    // Box background
    doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
    doc.roundedRect(x, boxY, boxW, boxH, 2, 2, 'F');

    // Left accent bar
    doc.setFillColor(kpi.borderCol[0], kpi.borderCol[1], kpi.borderCol[2]);
    doc.rect(x, boxY, 2.5, boxH, 'F');

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(kpi.title, x + 5, boxY + 5);

    // Main Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(kpi.main, x + 5, boxY + 11.5);

    // Subtext
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(kpi.sub, x + 5, boxY + 16);
  });

  // 2. DISTRIBUTION BY STAGE SUMMARY (Mini Strip)
  const distY = 51;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text('DISTRIBUCIÓN POR ESTADO ACTUAL', 14, distY);

  const stageLabels = stageDistribution.map((s) => `${s.fullName}: ${s.count}`).join('   |   ');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(stageLabels, 14, distY + 4.5);

  // 3. TABLE 1: SCHEDULE COMPLIANCE BY PROJECT
  const projectTableData = filteredProjects.map((p) => {
    const health = getProjectHealth(p);
    const completedStages = p.schedule.filter((s) => s.status === 'Completada').length;
    const isPending =
      health.overallStatus === 'Pendiente' ||
      p.state.trim().startsWith('01') ||
      p.state.toLowerCase().includes('pendiente');
    const isCancelled =
      health.overallStatus === 'Cancelado' ||
      p.state.includes('Cancelado') ||
      p.state.startsWith('8-') ||
      p.state.startsWith('08-');

    return [
      p.code,
      p.area,
      p.title,
      p.state,
      `${completedStages}/${p.schedule.length} (${health.completionPercentage}%)`,
      isCancelled ? 'Cancelado' : isPending ? 'Pendiente' : health.overallStatus,
      isCancelled
        ? 'Proyecto cancelado'
        : isPending
        ? 'Inicia en relevamiento'
        : health.delayedStagesCount > 0
        ? `${health.delayedStagesCount} etapa(s) con desvío`
        : 'Cumple plan',
    ];
  });

  runAutoTable(doc, {
    startY: distY + 8,
    head: [
      [
        'CÓDIGO',
        'ÁREA',
        'PROYECTO',
        'ESTADO ACTUAL',
        'AVANCE ETAPAS',
        'CRONOGRAMA',
        'DESVÍO',
      ],
    ],
    body: projectTableData,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: primaryNavy,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    columnStyles: {
      0: { cellWidth: 20, fontStyle: 'bold' },
      1: { cellWidth: 32 },
      2: { cellWidth: 95 },
      3: { cellWidth: 40 },
      4: { cellWidth: 28, halign: 'center' },
      5: { cellWidth: 25, halign: 'center', fontStyle: 'bold' },
      6: { cellWidth: 29 },
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        if (data.column.index === 5) {
          const val = data.cell.raw;
          if (val === 'A tiempo' || val === 'Completado') {
            data.cell.styles.textColor = [16, 185, 129];
          } else if (val === 'Demorado') {
            data.cell.styles.textColor = [225, 29, 72];
          } else if (val === 'Pendiente' || val === 'Cancelado') {
            data.cell.styles.textColor = [100, 116, 139]; // Slate neutro
            data.cell.styles.fontStyle = 'normal';
          } else {
            data.cell.styles.textColor = [245, 158, 11];
          }
        } else if (data.column.index === 6) {
          const val = data.cell.raw;
          if (val === 'Inicia en relevamiento' || val === 'Proyecto cancelado') {
            data.cell.styles.textColor = [100, 116, 139];
            data.cell.styles.fontStyle = 'italic';
          }
        }
      }
    },
    margin: { left: 14, right: 14, bottom: 15 },
  });

  // 4. TABLE 2: PENDING ACTIONS BY PROJECT (starts on current page or new page if tight)
  let lastFinalY = (doc as any).lastAutoTable?.finalY || 100;

  // If less than 40mm space remaining, add a page
  if (lastFinalY > 155) {
    doc.addPage();
    lastFinalY = 15;
  } else {
    lastFinalY += 8;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text(
    `LISTADO DE ACCIONES PENDIENTES POR PROYECTO (${pendingActionsList.length} ACCIONES)`,
    14,
    lastFinalY
  );

  const actionsTableData = pendingActionsList.map((a) => {
    return [
      a.projectCode,
      a.projectArea,
      a.stageName,
      a.actionTitle,
      a.responsible,
      a.requiredDate ? formatDateSpanish(a.requiredDate) : '-',
      a.status + (a.isOverdue ? ' (Vencida)' : ''),
      a.executionComment ? `"${a.executionComment}"` : '-',
    ];
  });

  if (actionsTableData.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text('No se registran acciones pendientes para la selección actual.', 14, lastFinalY + 7);
  } else {
    runAutoTable(doc, {
      startY: lastFinalY + 4,
      head: [
        [
          'CÓDIGO',
          'ÁREA',
          'ETAPA',
          'ACCIÓN REQUERIDA',
          'RESPONSABLE',
          'FECHA LÍMITE',
          'ESTADO',
          'ÚLTIMO COMENTARIO / AVANCE',
        ],
      ],
      body: actionsTableData,
      theme: 'grid',
      styles: {
        fontSize: 7.2,
        cellPadding: 1.8,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [30, 58, 138], // Indigo navy
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.2,
      },
      columnStyles: {
        0: { cellWidth: 18, fontStyle: 'bold' },
        1: { cellWidth: 26 },
        2: { cellWidth: 28 },
        3: { cellWidth: 62 },
        4: { cellWidth: 32, fontStyle: 'bold' },
        5: { cellWidth: 22, halign: 'center' },
        6: { cellWidth: 24, halign: 'center' },
        7: { cellWidth: 57, fontStyle: 'italic' },
      },
      didParseCell: (data) => {
        if (data.section === 'body') {
          if (data.column.index === 6) {
            const val = String(data.cell.raw);
            if (val.includes('Vencida')) {
              data.cell.styles.textColor = [225, 29, 72];
              data.cell.styles.fontStyle = 'bold';
            } else if (val.includes('En proceso')) {
              data.cell.styles.textColor = [37, 99, 235];
            }
          }
        }
      },
      margin: { left: 14, right: 14, bottom: 15 },
    });
  }

  // Footer on all pages
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);

    // Footer line
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 202, 283, 202);

    doc.text(
      'Crucianelli S.A.  •  Sistema de Gestión y Seguimiento de Proyectos de Mejora SAP',
      14,
      206
    );
    doc.text(`Página ${i} de ${pageCount}`, 283, 206, { align: 'right' });
  }

  return doc;
}
