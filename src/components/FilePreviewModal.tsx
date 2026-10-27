import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCw,
  FileText,
  FileSpreadsheet,
  FileCode,
  Image as ImageIcon,
  AlertCircle,
  Maximize2,
  Minimize2,
  Loader2,
} from 'lucide-react';
import { AttachedFile } from '../types/project';
import { formatFileSize, formatDateSpanish } from '../utils/helpers';
import { attachmentService } from '../services/attachmentService';

interface FilePreviewModalProps {
  file: AttachedFile | null;
  onClose: () => void;
  projectTitle?: string;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  file,
  onClose,
  projectTitle,
}) => {
  const [zoom, setZoom] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isLoadingText, setIsLoadingText] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const [resolvedDataUrl, setResolvedDataUrl] = useState<string | null>(file?.dataUrl || null);
  const [isLoadingFile, setIsLoadingFile] = useState<boolean>(false);

  // Process text decoding when dataUrl is available
  const processTextContent = (dataUrl: string) => {
    setIsLoadingText(true);
    try {
      if (dataUrl.startsWith('data:')) {
        const parts = dataUrl.split(',');
        if (parts.length > 1) {
          const mimeInfo = parts[0];
          const raw = parts[1];
          if (mimeInfo.includes(';base64')) {
            try {
              const decoded = atob(raw);
              setTextContent(decoded);
            } catch (err) {
              const binary = atob(raw);
              const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
              const decoded = new TextDecoder('utf-8').decode(bytes);
              setTextContent(decoded);
            }
          } else {
            setTextContent(decodeURIComponent(raw));
          }
        }
      } else {
        fetch(dataUrl)
          .then((res) => res.text())
          .then((text) => setTextContent(text))
          .catch(() => setLoadError('No se pudo cargar el contenido de texto.'));
      }
    } catch (e) {
      setLoadError('Error al decodificar archivo de texto');
    } finally {
      setIsLoadingText(false);
    }
  };

  // Reset zoom & rotation and resolve file dataUrl when file changes
  useEffect(() => {
    let isCancelled = false;
    setZoom(100);
    setRotation(0);
    setTextContent(null);
    setLoadError(null);

    if (!file) {
      setResolvedDataUrl(null);
      return;
    }

    if (file.dataUrl) {
      setResolvedDataUrl(file.dataUrl);
      const fileType = getFileType(file.name, file.type);
      if (fileType === 'text') {
        processTextContent(file.dataUrl);
      }
      return;
    }

    // Lazy load dataUrl from dedicated attachment store
    setIsLoadingFile(true);
    attachmentService
      .getAttachmentDataUrl(file.id)
      .then((url) => {
        if (!isCancelled) {
          if (url) {
            setResolvedDataUrl(url);
            const fileType = getFileType(file.name, file.type);
            if (fileType === 'text') {
              processTextContent(url);
            }
          } else {
            setLoadError('El archivo no tiene contenido disponible para previsualización.');
          }
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setLoadError('Error al descargar el archivo adjunto desde la nube.');
        }
      })
      .finally(() => {
        if (!isCancelled) setIsLoadingFile(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [file]);

  if (!file) return null;

  // Determine file category
  const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';

  const getFileType = (name: string, mime: string): 'image' | 'pdf' | 'text' | 'spreadsheet' | 'document' | 'other' => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp'].includes(ext) || mime.startsWith('image/')) {
      return 'image';
    }
    if (ext === 'pdf' || mime === 'application/pdf') {
      return 'pdf';
    }
    if (['txt', 'csv', 'log', 'json', 'xml', 'md'].includes(ext) || mime.startsWith('text/')) {
      return 'text';
    }
    if (['xlsx', 'xls', 'ods', 'xlsm'].includes(ext) || mime.includes('spreadsheet') || mime.includes('excel')) {
      return 'spreadsheet';
    }
    if (['docx', 'doc', 'odt', 'rtf'].includes(ext) || mime.includes('word') || mime.includes('document')) {
      return 'document';
    }
    return 'other';
  };

  const fileCategory = getFileType(file.name, file.type);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 300));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 50));
  const handleResetZoom = () => {
    setZoom(100);
    setRotation(0);
  };
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  // Safe download trigger
  const handleDownload = () => {
    const url = resolvedDataUrl || file.dataUrl;
    if (!url) {
      alert('El archivo se está cargando. Por favor intentá nuevamente en un instante.');
      return;
    }
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Open in new window safely
  const handleOpenNewWindow = () => {
    const url = resolvedDataUrl || file.dataUrl;
    if (!url) return;
    const newWindow = window.open();
    if (newWindow) {
      if (fileCategory === 'image') {
        newWindow.document.write(`
          <html>
            <head><title>${file.name}</title></head>
            <body style="margin:0;background:#0f172a;display:flex;align-items:center;justify-content:center;height:100vh;">
              <img src="${url}" style="max-width:100%;max-height:100%;object-fit:contain;" alt="${file.name}" />
            </body>
          </html>
        `);
      } else {
        newWindow.location.href = url;
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className={`bg-slate-900 border border-slate-700 rounded-2xl flex flex-col overflow-hidden shadow-2xl transition-all duration-200 ${
          isFullscreen
            ? 'w-full h-full rounded-none'
            : 'w-full max-w-5xl h-[88vh]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 text-white shrink-0">
          {/* File Information */}
          <div className="flex items-center gap-3 overflow-hidden min-w-0">
            <div className="p-2 rounded-lg bg-slate-800 text-blue-400 border border-slate-700 shrink-0">
              {fileCategory === 'image' && <ImageIcon className="w-5 h-5" />}
              {fileCategory === 'pdf' && <FileText className="w-5 h-5 text-rose-400" />}
              {fileCategory === 'text' && <FileCode className="w-5 h-5 text-emerald-400" />}
              {fileCategory === 'spreadsheet' && <FileSpreadsheet className="w-5 h-5 text-emerald-500" />}
              {fileCategory === 'document' && <FileText className="w-5 h-5 text-blue-400" />}
              {fileCategory === 'other' && <FileText className="w-5 h-5 text-slate-400" />}
            </div>

            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-white truncate" title={file.name}>
                {file.name}
              </h3>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="font-mono">{formatFileSize(file.size)}</span>
                {file.uploadedAt && (
                  <>
                    <span>•</span>
                    <span>Cargado: {formatDateSpanish(file.uploadedAt)}</span>
                  </>
                )}
                {projectTitle && (
                  <>
                    <span className="hidden md:inline">•</span>
                    <span className="hidden md:inline truncate max-w-[240px] text-slate-400 font-medium">
                      {projectTitle}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-1.5 shrink-0 ml-3">
            {fileCategory === 'image' && (
              <div className="hidden sm:flex items-center gap-1 bg-slate-800/80 p-1 rounded-lg border border-slate-700 mr-2 text-xs text-slate-300">
                <button
                  onClick={handleZoomOut}
                  className="p-1 hover:text-white hover:bg-slate-700 rounded transition-colors"
                  title="Alejar (-)"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="px-1.5 font-mono text-[11px] min-w-[42px] text-center">
                  {zoom}%
                </span>
                <button
                  onClick={handleZoomIn}
                  className="p-1 hover:text-white hover:bg-slate-700 rounded transition-colors"
                  title="Acercar (+)"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={handleRotate}
                  className="p-1 hover:text-white hover:bg-slate-700 rounded transition-colors ml-1"
                  title="Girar 90°"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                {(zoom !== 100 || rotation !== 0) && (
                  <button
                    onClick={handleResetZoom}
                    className="px-1.5 py-0.5 text-[10px] text-blue-400 hover:text-blue-300 rounded font-semibold"
                  >
                    Restablecer
                  </button>
                )}
              </div>
            )}

            {/* Open in new tab/window */}
            {(resolvedDataUrl || file.dataUrl) && (
              <button
                onClick={handleOpenNewWindow}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Abrir en pestaña nueva"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            )}

            {/* Toggle Fullscreen */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors hidden sm:inline-flex cursor-pointer"
              title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Download Button */}
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors shadow-sm cursor-pointer"
              title="Descargar archivo original"
            >
              <Download className="w-4 h-4" />
              <span className="hidden md:inline">Descargar</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors ml-1 cursor-pointer"
              title="Cerrar vista previa (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Viewer Area */}
        <div className="flex-1 bg-slate-950 relative overflow-auto flex items-center justify-center p-4">
          {isLoadingFile && (
            <div className="flex flex-col items-center justify-center gap-3 text-slate-400 p-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <p className="text-sm font-medium">Cargando archivo adjunto desde la nube...</p>
            </div>
          )}

          {/* IMAGE VIEWER */}
          {!isLoadingFile && fileCategory === 'image' && (resolvedDataUrl || file.dataUrl) && (
            <div className="w-full h-full flex items-center justify-center overflow-auto select-none">
              <img
                src={resolvedDataUrl || file.dataUrl || ''}
                alt={file.name}
                style={{
                  transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                  transition: 'transform 0.15s ease-out',
                  maxWidth: zoom <= 100 ? '100%' : 'none',
                  maxHeight: zoom <= 100 ? '100%' : 'none',
                }}
                className="object-contain shadow-2xl rounded-sm"
              />
            </div>
          )}

          {/* PDF VIEWER */}
          {!isLoadingFile && fileCategory === 'pdf' && (resolvedDataUrl || file.dataUrl) && (
            <div className="w-full h-full flex flex-col rounded-lg overflow-hidden border border-slate-800 bg-white shadow-xl">
              <iframe
                src={resolvedDataUrl || file.dataUrl || ''}
                title={file.name}
                className="w-full h-full border-none"
              />
            </div>
          )}

          {/* TEXT / CODE / CSV VIEWER */}
          {fileCategory === 'text' && (
            <div className="w-full h-full flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-inner">
              <div className="px-4 py-2 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>Formato: {fileExtension.toUpperCase()}</span>
                <span>{textContent ? `${textContent.split('\n').length} líneas` : ''}</span>
              </div>
              <div className="flex-1 p-4 overflow-auto font-mono text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap selection:bg-blue-600 selection:text-white">
                {isLoadingText ? (
                  <div className="flex items-center justify-center h-full text-slate-400">
                    <span>Cargando contenido de texto...</span>
                  </div>
                ) : loadError ? (
                  <div className="flex flex-col items-center justify-center h-full text-rose-400 gap-2">
                    <AlertCircle className="w-6 h-6" />
                    <span>{loadError}</span>
                  </div>
                ) : (
                  textContent || 'El archivo está vacío o no contiene texto decodificable.'
                )}
              </div>
            </div>
          )}

          {/* SPREADSHEETS (EXCEL / CSV) NOTIFICATION & QUICK ACTION */}
          {fileCategory === 'spreadsheet' && (
            <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-2xl text-center space-y-5 shadow-2xl">
              <div className="w-16 h-16 rounded-2xl bg-emerald-950/80 text-emerald-400 border border-emerald-700/50 flex items-center justify-center mx-auto shadow-inner">
                <FileSpreadsheet className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h4 className="text-lg font-bold text-white">Planilla de Cálculo</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Los archivos de Excel ({fileExtension.toUpperCase()}) contienen fórmulas y formatos complejos que requieren ser abiertos con Microsoft Excel o Google Sheets.
                </p>
                <div className="p-3 bg-slate-800/60 rounded-lg border border-slate-700/80 text-xs text-slate-300 font-mono">
                  {file.name} ({formatFileSize(file.size)})
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
                <button
                  onClick={handleDownload}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors shadow-md"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar y Abrir en Excel</span>
                </button>
                {file.dataUrl && (
                  <button
                    onClick={handleOpenNewWindow}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Abrir en navegador</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* WORD / RICH DOCUMENTS NOTIFICATION */}
          {fileCategory === 'document' && (
            <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-2xl text-center space-y-5 shadow-2xl">
              <div className="w-16 h-16 rounded-2xl bg-blue-950/80 text-blue-400 border border-blue-700/50 flex items-center justify-center mx-auto shadow-inner">
                <FileText className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h4 className="text-lg font-bold text-white">Documento de Word ({fileExtension.toUpperCase()})</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Para visualizar el formato de página, fuentes y estilos originales de este documento, por favor descárgalo o ábrelo directamente en Microsoft Word.
                </p>
                <div className="p-3 bg-slate-800/60 rounded-lg border border-slate-700/80 text-xs text-slate-300 font-mono">
                  {file.name} ({formatFileSize(file.size)})
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
                <button
                  onClick={handleDownload}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors shadow-md"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar y Abrir en Word</span>
                </button>
                {file.dataUrl && (
                  <button
                    onClick={handleOpenNewWindow}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Abrir en navegador</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* OTHER / BINARY FILES */}
          {fileCategory === 'other' && (
            <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-2xl text-center space-y-5 shadow-2xl">
              <div className="w-16 h-16 rounded-2xl bg-slate-800 text-slate-400 border border-slate-700 flex items-center justify-center mx-auto shadow-inner">
                <FileText className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h4 className="text-lg font-bold text-white">Archivo Adjunto</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Este formato de archivo ({fileExtension ? `.${fileExtension}` : 'binario'}) no admite vista previa directa interactiva. Puedes descargarlo en tu equipo.
                </p>
                <div className="p-3 bg-slate-800/60 rounded-lg border border-slate-700/80 text-xs text-slate-300 font-mono">
                  {file.name} ({formatFileSize(file.size)})
                </div>
              </div>

              <div className="pt-2 flex justify-center">
                <button
                  onClick={handleDownload}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors shadow-md"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar Archivo</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="px-4 py-2 bg-slate-900/95 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between shrink-0">
          <span>Pulsa <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300 font-mono text-[10px]">Esc</kbd> o haz clic fuera para salir</span>
          <div className="flex items-center gap-3">
            <span>Tipo MIME: <span className="font-mono text-slate-300">{file.type || 'desconocido'}</span></span>
          </div>
        </div>
      </div>
    </div>
  );
};
