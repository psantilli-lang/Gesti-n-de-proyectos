import React, { useState, useMemo } from 'react';
import { 
  SAPProject, 
  ALL_PROJECT_STATES, 
  SAP_MODULES_DATA 
} from '../types/project';
import { storageService } from '../services/storageService';
import { 
  formatDateSpanish, 
  downloadCSV, 
  isActionOverdue 
} from '../utils/helpers';
import { generateExecutiveReportPDF } from '../utils/pdfGenerator';
import { 
  BarChart3, 
  Calendar, 
  Filter, 
  Printer, 
  FileSpreadsheet, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  Users, 
  TrendingUp,
  FileCheck,
  ChevronRight,
  Download,
  Loader2,
  FileText,
  Check,
  X
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell, 
  PieChart, 
  Pie, 
  Legend 
} from 'recharts';

interface ReportsViewProps {
  projects: SAPProject[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({ projects }) => {
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<'all' | 'week' | 'month' | 'quarter' | 'custom'>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<boolean>(false);
  const [pdfNotification, setPdfNotification] = useState<{
    type: 'success' | 'info' | 'error';
    message: string;
  } | null>(null);

  // Extract distinct areas
  const areas = useMemo(() => {
    return Array.from(new Set(projects.map((p) => p.area))).sort();
  }, [projects]);

  // Compute date filter boundary
  const { filterStart, filterEnd } = useMemo(() => {
    const today = new Date();
    let start: Date | null = null;
    let end: Date | null = new Date();

    if (datePreset === 'week') {
      start = new Date();
      start.setDate(today.getDate() - 7);
    } else if (datePreset === 'month') {
      start = new Date();
      start.setDate(today.getDate() - 30);
    } else if (datePreset === 'quarter') {
      start = new Date();
      start.setDate(today.getDate() - 90);
    } else if (datePreset === 'custom') {
      if (startDate) start = new Date(startDate);
      if (endDate) end = new Date(endDate);
    }

    return {
      filterStart: start ? start.toISOString().split('T')[0] : null,
      filterEnd: end ? end.toISOString().split('T')[0] : null,
    };
  }, [datePreset, startDate, endDate]);

  // Filter projects by Area and Date (based on createdAt or updatedAt)
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (selectedArea !== 'all' && p.area !== selectedArea) return false;

      if (filterStart) {
        const prjDate = (p.createdAt || '').split('T')[0];
        if (prjDate && prjDate < filterStart) return false;
      }
      if (filterEnd) {
        const prjDate = (p.createdAt || '').split('T')[0];
        if (prjDate && prjDate > filterEnd) return false;
      }

      return true;
    });
  }, [projects, selectedArea, filterStart, filterEnd]);

  // 1. Proyectos Totales y Estado General
  const totalProjects = filteredProjects.length;
  const isProjectClosed = (p: SAPProject) => p.state.includes('07- Entregado') || p.state.includes('Entregado');
  const isProjectCancelled = (p: SAPProject) =>
    p.state.includes('Cancelado') || p.state.startsWith('8-') || p.state.startsWith('08-');
  const activeProjects = filteredProjects.filter((p) => !isProjectClosed(p) && !isProjectCancelled(p)).length;
  const closedProjects = filteredProjects.filter(isProjectClosed).length;
  const cancelledProjects = filteredProjects.filter(isProjectCancelled).length;

  // 2. Proyectos por Etapas (para gráfico de barras y tabla)
  const stageDistribution = useMemo(() => {
    const stagesCounts: { [state: string]: number } = {};
    ALL_PROJECT_STATES.forEach((st) => {
      stagesCounts[st] = 0;
    });

    filteredProjects.forEach((p) => {
      if (stagesCounts[p.state] !== undefined) {
        stagesCounts[p.state]++;
      } else {
        const match = ALL_PROJECT_STATES.find(
          (s) => s.startsWith(p.state.slice(0, 3)) || p.state.startsWith(s.slice(0, 3))
        );
        if (match) stagesCounts[match]++;
        else stagesCounts[p.state] = 1;
      }
    });

    return ALL_PROJECT_STATES.map((st, idx) => ({
      stageIndex: idx + 1,
      fullName: st,
      shortName: st,
      count: stagesCounts[st] || 0,
    }));
  }, [filteredProjects]);

  // 3. Cumplimiento del Cronograma (Plan vs Actual)
  // Los proyectos en estado "01- Pendiente" o "8- Cancelado" no se contabilizan para el indicador de cumplimiento de cronograma
  const scheduleCompliance = useMemo(() => {
    let onTimeProjects = 0;
    let delayedProjects = 0;
    let pendingProjectsCount = 0;
    let cancelledProjectsCount = 0;
    let totalDelayedDays = 0;
    let delayedStagesTotal = 0;
    let completedStagesTotal = 0;

    filteredProjects.forEach((p) => {
      const health = storageService.getProjectHealth(p);

      // Si el proyecto está en estado cancelado, no contabiliza para el cumplimiento de cronograma
      if (
        health.isCancelled ||
        p.state.includes('Cancelado') ||
        p.state.startsWith('8-') ||
        p.state.startsWith('08-')
      ) {
        cancelledProjectsCount++;
        return;
      }

      // Si el proyecto está en estado pendiente, no contabiliza para el cumplimiento de cronograma
      if (health.isPendingStart || p.state.trim().startsWith('01') || p.state.toLowerCase().includes('pendiente')) {
        pendingProjectsCount++;
        return;
      }

      if (health.overallStatus === 'A tiempo' || health.overallStatus === 'Completado') {
        onTimeProjects++;
      } else {
        delayedProjects++;
      }

      p.schedule.forEach((st) => {
        if (st.status === 'Completada') completedStagesTotal++;
        const dev = storageService.calculateStageDeviation(st);
        if (dev.isDelayed) {
          delayedStagesTotal++;
          totalDelayedDays += Math.max(0, dev.daysDiff);
        }
      });
    });

    const evaluatedProjectsCount = onTimeProjects + delayedProjects;
    const complianceRate = evaluatedProjectsCount > 0 ? Math.round((onTimeProjects / evaluatedProjectsCount) * 100) : 100;
    const avgDelayDays = delayedProjects > 0 ? Math.round(totalDelayedDays / delayedProjects) : 0;

    return {
      onTimeProjects,
      delayedProjects,
      pendingProjectsCount,
      cancelledProjectsCount,
      evaluatedProjectsCount,
      complianceRate,
      avgDelayDays,
      delayedStagesTotal,
      completedStagesTotal,
    };
  }, [filteredProjects]);

  // 4. Listado de Acciones Pendientes por Proyecto
  const pendingActionsList = useMemo(() => {
    const list: Array<{
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
    }> = [];

    filteredProjects.forEach((p) => {
      if (isProjectCancelled(p)) return;
      p.actions.forEach((a) => {
        if (a.status !== 'Finalizada') {
          list.push({
            projectCode: p.code,
            projectTitle: p.title,
            projectArea: p.area,
            stageName: a.stageName,
            actionTitle: a.title,
            responsible: a.responsible,
            requiredDate: a.requiredDate,
            status: a.status,
            isOverdue: isActionOverdue(a),
            executionComment: a.executionComment || '',
          });
        }
      });
    });

    return list.sort((a, b) => a.requiredDate.localeCompare(b.requiredDate));
  }, [filteredProjects]);

  // Export to CSV
  const handleExportCSV = () => {
    const rows = pendingActionsList.map((item) => ({
      'Código Proyecto': item.projectCode,
      'Título Proyecto': item.projectTitle,
      'Área': item.projectArea,
      'Etapa': item.stageName,
      'Acción Pendiente': item.actionTitle,
      'Responsable': item.responsible,
      'Fecha Requerida': item.requiredDate,
      'Estado': item.status,
      'Vencida': item.isOverdue ? 'SÍ' : 'NO',
      'Último Comentario': item.executionComment,
    }));

    downloadCSV(`Reporte_Acciones_Pendientes_SAP_${new Date().toISOString().split('T')[0]}.csv`, rows);
  };

  // Export / Download PDF handler
  const handleDownloadPDF = async () => {
    try {
      setIsGeneratingPDF(true);
      setPdfNotification(null);

      // Small delay so UI renders the spinner immediately
      await new Promise((resolve) => setTimeout(resolve, 60));

      const doc = generateExecutiveReportPDF({
        projects,
        filteredProjects,
        selectedArea,
        datePreset,
        scheduleCompliance,
        stageDistribution,
        pendingActionsList,
        getProjectHealth: (p) => storageService.getProjectHealth(p),
      });

      const today = new Date().toISOString().split('T')[0];
      const areaTag = selectedArea === 'all' ? 'Todas_Areas' : selectedArea.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `Reporte_Ejecutivo_SAP_${areaTag}_${today}.pdf`;

      // Download via Blob URL for maximum browser and iframe compatibility
      try {
        const blob = doc.output('blob');
        const blobUrl = URL.createObjectURL(blob);
        const downloadLink = document.createElement('a');
        downloadLink.href = blobUrl;
        downloadLink.download = filename;
        downloadLink.style.display = 'none';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        setTimeout(() => {
          document.body.removeChild(downloadLink);
          URL.revokeObjectURL(blobUrl);
        }, 1000);
      } catch (saveErr) {
        // Fallback to doc.save
        doc.save(filename);
      }

      setPdfNotification({
        type: 'success',
        message: `¡Reporte generado y descargado exitosamente como "${filename}"! Formato oficial A4 apaisado con métricas, cronogramas y acciones pendientes.`,
      });

      setTimeout(() => {
        setPdfNotification((prev) => (prev?.type === 'success' ? null : prev));
      }, 7000);
    } catch (error) {
      console.error('Error generating PDF:', error);
      setPdfNotification({
        type: 'error',
        message: 'Ocurrió un error al compilar el PDF. Por favor reintente.',
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handlePrint = () => {
    try {
      // Direct window.print trigger
      window.print();
    } catch (err) {
      console.warn('La llamada a window.print fue bloqueada por el entorno:', err);
      // Fallback: generate and download PDF automatically
      handleDownloadPDF();
      setPdfNotification({
        type: 'info',
        message: 'La impresión directa fue limitada por las restricciones de seguridad del navegador. Se generó y descargó automáticamente el documento PDF en su lugar.',
      });
    }
  };

  const STAGE_COLORS = [
    '#f59e0b', // amber (01- Pendiente)
    '#3b82f6', // blue (02- En relevamiento)
    '#8b5cf6', // purple (03- Consulta usuario)
    '#0ea5e9', // sky (05- En Desarrollo)
    '#6366f1', // indigo (06- Prueba Funcional)
    '#10b981', // emerald (07- Entregado)
    '#64748b', // slate (8- Cancelado)
  ];

  return (
    <div className="space-y-6 pb-16 print:p-0 print:space-y-4">
      {/* Title & Filter Bar (No print when printing) */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Reporte Ejecutivo e Indicadores de Mejora SAP
          </h2>
          <p className="text-xs text-slate-500">
            Cumplimiento del cronograma (plan vs actual), avance por etapas y acciones pendientes
          </p>
        </div>

        {/* Export & Print actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-semibold border border-emerald-200 transition-colors cursor-pointer"
            title="Exportar listado de acciones a archivo CSV / Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Exportar CSV</span>
          </button>

          {/* Button: Imprimir / Guardar PDF (Genera y descarga el PDF real) */}
          <button
            onClick={handleDownloadPDF}
            disabled={isGeneratingPDF}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            title="Generar y descargar el reporte oficial en formato PDF A4 apaisado"
          >
            {isGeneratingPDF ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>{isGeneratingPDF ? 'Generando PDF...' : 'Imprimir / Guardar PDF'}</span>
          </button>

          {/* Direct Print Dialog Button */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-300 transition-colors cursor-pointer"
            title="Abrir vista previa de impresión en el navegador"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Imprimir</span>
          </button>
        </div>
      </div>

      {/* PDF Generation Notification Alert */}
      {pdfNotification && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-3 border shadow-xs transition-all print:hidden ${
            pdfNotification.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : pdfNotification.type === 'info'
              ? 'bg-blue-50 text-blue-900 border-blue-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {pdfNotification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : pdfNotification.type === 'info' ? (
              <AlertCircle className="w-4 h-4 text-blue-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{pdfNotification.message}</span>
          </div>

          <button
            onClick={() => setPdfNotification(null)}
            className="p-1 hover:bg-black/5 rounded text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            title="Cerrar notificación"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Date and Area Selection Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
          {/* Area Selector */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="font-bold text-slate-700">Filtrar por Área:</span>
            <select
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">Todas las Áreas ({projects.length} proyectos)</option>
              {areas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Preset Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="font-bold text-slate-700">Frecuencia / Fechas:</span>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
              <button
                onClick={() => setDatePreset('all')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  datePreset === 'all' ? 'bg-white text-blue-700 font-bold shadow-2xs' : 'text-slate-600'
                }`}
              >
                Histórico Total
              </button>
              <button
                onClick={() => setDatePreset('week')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  datePreset === 'week' ? 'bg-white text-blue-700 font-bold shadow-2xs' : 'text-slate-600'
                }`}
              >
                Semanal (Últimos 7 días)
              </button>
              <button
                onClick={() => setDatePreset('month')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  datePreset === 'month' ? 'bg-white text-blue-700 font-bold shadow-2xs' : 'text-slate-600'
                }`}
              >
                Mensual (Últimos 30 días)
              </button>
              <button
                onClick={() => setDatePreset('custom')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  datePreset === 'custom' ? 'bg-white text-blue-700 font-bold shadow-2xs' : 'text-slate-600'
                }`}
              >
                Personalizado
              </button>
            </div>
          </div>
        </div>

        {/* Custom Date Inputs if custom is picked */}
        {datePreset === 'custom' && (
          <div className="pt-2 border-t border-slate-100 flex items-center gap-3 text-xs">
            <span className="font-medium text-slate-600">Rango personalizado:</span>
            <div className="flex items-center gap-2">
              <label className="text-slate-500">Desde:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-slate-500">Hasta:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs"
              />
            </div>
          </div>
        )}
      </div>

      {/* Printable Report Header */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-3 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-slate-900">
              REPORTE EJECUTIVO DE PROYECTOS DE MEJORA SAP
            </h1>
            <p className="text-xs text-slate-600">
              Área: {selectedArea === 'all' ? 'Todas las Áreas' : selectedArea} | Fecha de emisión: {new Date().toLocaleDateString('es-AR')}
            </p>
          </div>
          <div className="text-right text-xs font-mono font-bold text-slate-800">
            TOTAL PROYECTOS: {totalProjects}
          </div>
        </div>
      </div>

      {/* KPI METRICS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Proyectos Totales */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Proyectos Totales
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">{totalProjects}</span>
            <span className="text-xs font-semibold text-slate-500">
              ({activeProjects} en curso)
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{closedProjects} proyectos finalizados</span>
            </span>
            {cancelledProjects > 0 && (
              <span className="text-slate-500 font-medium">
                • {cancelledProjects} cancelados
              </span>
            )}
          </div>
        </div>

        {/* Cumplimiento del Cronograma (% Plan vs Actual) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Cumplimiento Cronograma
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-600">
              {scheduleCompliance.complianceRate}%
            </span>
            <span className="text-xs font-semibold text-slate-500">A tiempo</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex flex-col gap-0.5">
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>
                {scheduleCompliance.onTimeProjects} a tiempo / {scheduleCompliance.delayedProjects} demorados
              </span>
            </div>
            {scheduleCompliance.pendingProjectsCount > 0 && (
              <span className="text-[10px] text-amber-700 font-medium">
                ({scheduleCompliance.pendingProjectsCount} en estado pendiente excluidos - inician en relevamiento)
              </span>
            )}
            {scheduleCompliance.cancelledProjectsCount > 0 && (
              <span className="text-[10px] text-slate-500 font-medium">
                ({scheduleCompliance.cancelledProjectsCount} en estado cancelado excluidos)
              </span>
            )}
          </div>
        </div>

        {/* Desvío Promedio de Días */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Desvío Promedio
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-700">
              {scheduleCompliance.avgDelayDays}
            </span>
            <span className="text-xs font-semibold text-slate-500">días / proyecto retrasado</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            {scheduleCompliance.delayedStagesTotal} etapas totales con desvío
          </div>
        </div>

        {/* Acciones Pendientes Totales */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Acciones Pendientes
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">{pendingActionsList.length}</span>
            <span className="text-xs font-semibold text-rose-600 font-bold">
              ({pendingActionsList.filter((a) => a.isOverdue).length} vencidas)
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            Asignadas a {new Set(pendingActionsList.map((a) => a.responsible)).size} responsables
          </div>
        </div>
      </div>

      {/* CHARTS SECTION: PROYECTOS POR ETAPAS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar Chart: Projects per stage */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Distribución de Proyectos por Etapa Actual (6 Estados)
              </h3>
              <p className="text-xs text-slate-500">
                Cantidad de proyectos activos e implementados en cada hito
              </p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stageDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <XAxis dataKey="shortName" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: any) => [`${value} proyectos`, 'Cantidad']}
                  labelFormatter={(label, payload) => {
                    const item = payload?.[0]?.payload;
                    return item ? item.fullName : label;
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {stageDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STAGE_COLORS[index % STAGE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Stage Table Summary */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Desglose Numérico de Etapas
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Total consolidado de la selección
            </p>

            <div className="space-y-2">
              {stageDistribution.map((st, i) => (
                <div
                  key={st.stageIndex}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: STAGE_COLORS[i % STAGE_COLORS.length] }}
                    />
                    <span className="font-semibold text-slate-800 truncate" title={st.fullName}>
                      {st.fullName}
                    </span>
                  </div>
                  <span className="font-bold text-slate-900 px-2 py-0.5 rounded bg-white border border-slate-200 shrink-0">
                    {st.count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 text-center font-medium">
            100% de proyectos trazables en SAP
          </div>
        </div>
      </div>

      {/* CUMPLIMIENTO DEL CRONOGRAMA: TABLA PLAN VS ACTUAL */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Cumplimiento del Cronograma (Plan vs. Actual) por Proyecto
            </h3>
            <p className="text-xs text-slate-500">
              Desvíos de cronograma, fechas estimadas vs reales de hitos
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            {filteredProjects.length} proyectos evaluados
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 divide-y divide-slate-200">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3 px-4">Código</th>
                <th className="py-3 px-4">Área</th>
                <th className="py-3 px-4 min-w-[200px]">Título del Proyecto</th>
                <th className="py-3 px-4">Estado Actual</th>
                <th className="py-3 px-4">Avance Etapas</th>
                <th className="py-3 px-4">Estado Cronograma</th>
                <th className="py-3 px-4">Desvío Detectado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProjects.map((p) => {
                const health = storageService.getProjectHealth(p);
                const completedStages = p.schedule.filter((s) => s.status === 'Completada').length;

                return (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">
                      {p.code}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {p.area}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {p.title}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-800 border border-slate-200">
                        {p.state}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900">
                        {completedStages} de {p.schedule.length} ({health.completionPercentage}%)
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          health.overallStatus === 'Cancelado'
                            ? 'bg-slate-100 text-slate-600 border border-slate-300'
                            : health.overallStatus === 'Pendiente'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : health.overallStatus === 'A tiempo' || health.overallStatus === 'Completado'
                            ? 'bg-emerald-100 text-emerald-800'
                            : health.overallStatus === 'Demorado'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {health.overallStatus === 'Pendiente' ? 'Pendiente de inicio' : health.overallStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {health.overallStatus === 'Cancelado' ? (
                        <span className="text-slate-500 italic text-[11px]">
                          Proyecto cancelado (no computa desvío)
                        </span>
                      ) : health.overallStatus === 'Pendiente' ? (
                        <span className="text-slate-500 italic text-[11px]">
                          Inicia en relevamiento (no computa desvío)
                        </span>
                      ) : health.delayedStagesCount > 0 ? (
                        <span className="text-rose-600 font-bold">
                          {health.delayedStagesCount} etapa(s) con desvío
                        </span>
                      ) : (
                        <span className="text-emerald-600 font-medium">Cumple plan</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* LISTADO DE ACCIONES PENDIENTES POR PROYECTO */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              Listado de Acciones Pendientes por Proyecto
            </h3>
            <p className="text-xs text-slate-500">
              Tareas requeridas en curso o pendientes, responsables y fecha límite de entrega
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
              {pendingActionsList.length} acciones pendientes
            </span>
          </div>
        </div>

        {pendingActionsList.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No hay acciones pendientes para los filtros seleccionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 divide-y divide-slate-200">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3 px-4">Proyecto</th>
                  <th className="py-3 px-4">Área</th>
                  <th className="py-3 px-4">Etapa</th>
                  <th className="py-3 px-4 min-w-[220px]">Acción Requerida</th>
                  <th className="py-3 px-4 min-w-[150px]">Responsable</th>
                  <th className="py-3 px-4">Fecha Requerida</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 min-w-[200px]">Último Comentario de Ejecución</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingActionsList.map((item, idx) => (
                  <tr
                    key={idx}
                    className={`hover:bg-slate-50/70 ${
                      item.isOverdue ? 'bg-rose-50/30' : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">
                      {item.projectCode}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {item.projectArea}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-medium">
                      {item.stageName}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {item.actionTitle}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">
                      {item.responsible}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <span
                        className={`px-2 py-0.5 rounded font-bold ${
                          item.isOverdue
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {formatDateSpanish(item.requiredDate)}
                        {item.isOverdue && ' (Vencida)'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          item.status === 'En proceso'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 italic">
                      {item.executionComment ? `"${item.executionComment}"` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
