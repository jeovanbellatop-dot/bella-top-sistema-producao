import React, { useState } from 'react';
import { useMesStore } from '../../hooks/useMesStore';
import { parseOpFiles } from '../../services/opReaderService';
import { ExtractedOpData } from '../../types/mes';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  X,
  Layers,
  Crop,
  Eye,
  Image as ImageIcon,
  Check,
  ShieldCheck,
  ArrowLeft,
  FileCheck2,
  AlertCircle,
  UserCheck,
  Edit3,
  Sliders,
  CheckCircle,
} from 'lucide-react';
import { OpProductThumbnail } from '../common/OpProductThumbnail';
import { LayoutCropModal } from './LayoutCropModal';
import { FullLayoutModal } from './FullLayoutModal';
import { PcpManualReviewForm } from './PcpManualReviewForm';
import { CropBox, createBellaTopBagSvg } from '../../utils/imageCropper';
import { processDocumentFile } from '../../utils/pdfRenderer';
import { loadFileOnce, type LoadedFile } from '../../utils/loadedFile';

interface PcpUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpCreated: (opId: string) => void;
}

export const PcpUploadModal: React.FC<PcpUploadModalProps> = ({
  isOpen,
  onClose,
  onOpCreated,
}) => {
  const { createOrderFromExtracted, generateRouteForOpData, machines, logAudit } = useMesStore();

  // Os arquivos são lidos UMA ÚNICA VEZ no momento da seleção (loadFileOnce) e
  // guardados já materializados em memória. Guardar o objeto File cru e lê-lo
  // depois é o que causava o erro NotFoundError, sobretudo no celular.
  const [opFile, setOpFile] = useState<LoadedFile | null>(null);
  const [layoutFile, setLayoutFile] = useState<LoadedFile | null>(null);
  const [layoutPreviewUrl, setLayoutPreviewUrl] = useState<string | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedOpData | null>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'review'>('upload');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Manual Review & Edit Mode State
  const [isEditingManualData, setIsEditingManualData] = useState(false);

  // Modals for Cropping & Full Layout
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [isFullLayoutModalOpen, setIsFullLayoutModalOpen] = useState(false);

  // Editable route
  const [editableRoute, setEditableRoute] = useState<
    Array<{
      processTypeId: string;
      processName: string;
      machineId: string;
      machineName: string;
      estimatedMinutes: number;
    }>
  >([]);

  if (!isOpen) return null;

  // Documental Status Calculation
  const isOpLoaded = !!opFile;
  const isLayoutLoaded = !!layoutFile;
  const isDocumentalComplete = isOpLoaded && isLayoutLoaded;

  let documentalStatusText = 'AGUARDANDO DOCUMENTOS';
  let documentalStatusType: 'complete' | 'op_missing' | 'layout_missing' | 'empty' = 'empty';

  if (isDocumentalComplete) {
    documentalStatusText = 'STATUS DOCUMENTAL: COMPLETO';
    documentalStatusType = 'complete';
  } else if (isOpLoaded && !isLayoutLoaded) {
    documentalStatusText = 'LAYOUT PENDENTE';
    documentalStatusType = 'layout_missing';
  } else if (!isOpLoaded && isLayoutLoaded) {
    documentalStatusText = 'ORDEM DE PRODUÇÃO PENDENTE';
    documentalStatusType = 'op_missing';
  }

  const uploadFileToStorage = async (file: LoadedFile, folder: string): Promise<string> => {
    // Sem releitura do arquivo: o dataUrl foi gerado na seleção.
    const response = await fetch('/api/storage/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: file.name, mimeType: file.type, dataUrl: file.dataUrl, folder }),
    })

    const result = (await response.json()) as { success: boolean; error?: string; data?: { url: string } }
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Falha ao enviar arquivo para o Storage.')
    }

    return result.data.url as string
  }

  const handleOpFileSelect = async (file: File) => {
    setErrorMsg(null);
    try {
      setOpFile(await loadFileOnce(file));
    } catch (err: any) {
      setOpFile(null);
      setErrorMsg(err?.message || 'Não foi possível ler o arquivo da Ordem de Produção.');
    }
  };

  const handleLayoutFileSelect = async (file: File) => {
    setErrorMsg(null);
    let loaded: LoadedFile;
    try {
      loaded = await loadFileOnce(file);
    } catch (err: any) {
      setLayoutFile(null);
      setErrorMsg(err?.message || 'Não foi possível ler o arquivo do Layout.');
      return;
    }

    setLayoutFile(loaded);
    try {
      const rendered = await processDocumentFile(loaded);
      setLayoutPreviewUrl(rendered.dataUrl);
    } catch (err: any) {
      console.warn('Não foi possível gerar pré-visualização imediata do layout:', err);
    }
  };

  const handleAnalyzeAndCreate = async () => {
    if (!opFile || !layoutFile) {
      setErrorMsg('Os dois arquivos (Ordem de Produção e Layout Aprovado) são estritamente obrigatórios.');
      return;
    }

    try {
      setErrorMsg(null);
      setIsProcessing(true);

      const data = await parseOpFiles({ opFile, layoutFile });

      // Se o backend não conseguir identificar a imagem e não houver preview, usar renderizador vetorial do produto
      if (!data.layoutPreviewImage && !data.productThumbnail) {
        const fallbackSvg = createBellaTopBagSvg({
          productName: data.produtoNome,
          client: data.cliente,
          handleType: data.tipoAlca,
          hasVisor: data.usoVisor,
        });
        data.layoutPreviewImage = layoutPreviewUrl || fallbackSvg;
        data.productThumbnail = fallbackSvg;
        data.productThumbnailStatus = 'needs_validation';
      } else if (layoutPreviewUrl && !data.layoutPreviewImage) {
        data.layoutPreviewImage = layoutPreviewUrl;
      }

      let opFileUrl = opFile.name
      let layoutFileUrl = layoutFile.name
      try {
        const [uploadedOpUrl, uploadedLayoutUrl] = await Promise.all([
          uploadFileToStorage(opFile, 'op-pdfs'),
          uploadFileToStorage(layoutFile, 'layouts'),
        ])
        opFileUrl = uploadedOpUrl
        layoutFileUrl = uploadedLayoutUrl
        data.layoutPreviewImage = uploadedLayoutUrl
      } catch (uploadErr: any) {
        console.warn('Falha ao enviar arquivos para o Firebase Storage, usando referencia local como fallback:', uploadErr)
      }

      data.opFileName = opFile.name
      data.op_file = opFileUrl
      data.layoutFileName = layoutFile.name
      data.layout_file = layoutFileUrl
      data.layoutStatus = 'COMPLETO';
      data.layout_status = 'COMPLETO';

      setExtractedData(data);

      // Gerar roteiro com distribuição de máquinas
      const route = generateRouteForOpData(data);
      setEditableRoute(route.steps);

      setIsEditingManualData(false);
      setActiveTab('review');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Falha ao processar a OP e o Layout. Verifique os arquivos e tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveCrop = (croppedBase64: string, cropBox: CropBox) => {
    if (extractedData) {
      setExtractedData({
        ...extractedData,
        productThumbnail: croppedBase64,
        layoutCropBox: cropBox,
        productThumbnailStatus: 'available',
      });
    }
  };

  const handleSaveManualReview = async (
    updatedData: ExtractedOpData,
    diffs: string[],
    justification: string
  ) => {
    setExtractedData(updatedData);
    setIsEditingManualData(false);
    setErrorMsg(null);
    setSuccessMsg('Ficha técnica revisada e validada com sucesso pelo PCP! Liberação autorizada.');

    // Recalcula o roteiro caso o processo fabril dependa dos novos dados
    try {
      const newRoute = generateRouteForOpData(updatedData);
      setEditableRoute(newRoute.steps);
    } catch (e) {
      console.warn('Erro ao recalcular roteiro após revisão manual:', e);
    }

    // Registra na auditoria local
    logAudit({
      action: 'PCP_OP_MANUALLY_REVISED' as any,
      entityType: 'OP',
      entityId: `OP_${updatedData.numeroOp}`,
      details: `PCP revisou e confirmou manualmente a ficha técnica da OP ${updatedData.numeroOp}. Motivo: ${justification}. Alterações: ${diffs.join('; ') || 'Nenhuma'}`,
      metadata: {
        opNumber: updatedData.numeroOp,
        diffs,
        justification,
      },
    });

    // Registra na auditoria do servidor
    try {
      await fetch('/api/op/audit-revision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opNumber: updatedData.numeroOp,
          justification,
          diffs,
          updatedData,
        }),
      });
    } catch (err) {
      console.warn('Não foi possível enviar auditoria ao servidor:', err);
    }
  };

  const handleApproveAndRelease = () => {
    if (!extractedData) return;
    if (extractedData.precisaRevisaoPcp) {
      setIsEditingManualData(true);
      setErrorMsg('Existem dados pendentes ou não identificados com certeza. Preencha os campos abaixo no formulário de revisão para liberar a OP.');
      return;
    }
    const newOrder = createOrderFromExtracted(extractedData, editableRoute);
    onOpCreated(newOrder.id);
    onClose();
  };

  const handleMachineChangeForStep = (stepIdx: number, newMachineId: string) => {
    const mach = machines.find((m) => m.id === newMachineId);
    if (!mach) return;

    setEditableRoute((prev) => {
      const updated = [...prev];
      updated[stepIdx] = {
        ...updated[stepIdx],
        machineId: mach.id,
        machineName: mach.name,
      };
      return updated;
    });
  };

  const layoutImageSrc = extractedData?.layoutPreviewImage || layoutPreviewUrl || extractedData?.images?.[0]?.urlOrBase64 || extractedData?.productThumbnail;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-[#1C1418]/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in">
        <div className="bg-white border border-[#E5DAD3] w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
          
          {/* Header */}
          <div className="bg-[#FAF5F1] px-6 py-4 border-b border-[#E5DAD3] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#E30A78] to-[#B30A5C] text-white flex items-center justify-center font-bold shadow-sm">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-[#1C1418] flex items-center gap-2">
                  <span>Cadastro & Importação de Ordem de Produção</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-100 text-[#B30A5C] font-mono border border-pink-200">
                    UPLOAD 2 ARQUIVOS OBRIGATÓRIOS
                  </span>
                </h3>
                <p className="text-xs text-[#6E615B]">
                  1 Arquivo de OP (Instruções produtivas) + 1 Arquivo de Layout (Identidade visual da sacola)
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-[#6E615B] hover:text-[#1C1418] hover:bg-[#F2EBE6] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Content */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
            {errorMsg && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2.5 font-medium">
                <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2.5 font-medium animate-in fade-in">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* TAB 1: UPLOAD DE 2 ARQUIVOS SEPARADOS */}
            {activeTab === 'upload' && (
              <div className="space-y-6">
                
                {/* 2 Separate Upload Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  
                  {/* FIELD 1: ORDEM DE PRODUÇÃO */}
                  <div
                    className={`rounded-2xl border-2 p-5 transition-all flex flex-col justify-between ${
                      opFile
                        ? 'border-emerald-500 bg-emerald-50/40'
                        : 'border-[#E5DAD3] hover:border-[#E30A78]/70 bg-[#FAF5F1]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between pb-3 border-b border-[#E5DAD3]">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-pink-50 border border-[#F5C6DC] text-[#E30A78] flex items-center justify-center font-bold">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-[10px] font-mono font-black tracking-widest text-[#B30A5C] uppercase block">
                              ARQUIVO 1
                            </span>
                            <h4 className="font-extrabold text-sm text-[#1C1418]">
                              ORDEM DE PRODUÇÃO
                            </h4>
                          </div>
                        </div>
                        {opFile ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold border border-emerald-300 flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-600" />
                            CARREGADA
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold border border-amber-300">
                            PENDENTE
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-[#6E615B] mt-2">
                        Fornece número da OP, cliente, quantidade, materiais, setores, medidas e instruções de fabricação.
                      </p>

                      {/* File Card or Drop Area */}
                      <div className="mt-4">
                        {opFile ? (
                          <div className="bg-white border border-emerald-200 p-3.5 rounded-xl flex items-center justify-between gap-3 shadow-sm">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <FileCheck2 className="w-6 h-6 text-emerald-600 shrink-0" />
                              <div className="min-w-0">
                                <div className="font-bold text-xs text-[#1C1418] truncate">
                                  {opFile.name}
                                </div>
                                <div className="text-[10px] text-[#6E615B] font-mono">
                                  {(opFile.size / 1024).toFixed(1)} KB • PDF Industrial
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setOpFile(null)}
                              className="text-xs text-rose-600 hover:text-rose-700 font-bold px-2 py-1 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              Trocar
                            </button>
                          </div>
                        ) : (
                          <div
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              if (e.dataTransfer.files?.[0]) handleOpFileSelect(e.dataTransfer.files[0]);
                            }}
                            onClick={() => document.getElementById('op-input-field')?.click()}
                            className="border border-dashed border-[#E5DAD3] hover:border-[#E30A78] rounded-xl p-6 text-center bg-white cursor-pointer transition-colors flex flex-col items-center justify-center gap-2"
                          >
                            <input
                              type="file"
                              id="op-input-field"
                              accept=".pdf,application/pdf,.txt"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files?.[0]) handleOpFileSelect(e.target.files[0]);
                              }}
                            />
                            <div className="w-10 h-10 rounded-xl bg-pink-50 text-[#E30A78] flex items-center justify-center">
                              <Upload className="w-5 h-5" />
                            </div>
                            <span className="font-bold text-xs text-[#1C1418]">
                              [ CARREGAR PDF DA OP ]
                            </span>
                            <span className="text-[10px] text-[#6E615B]">
                              Clique ou arraste o arquivo PDF da OP aqui
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* FIELD 2: LAYOUT APROVADO */}
                  <div
                    className={`rounded-2xl border-2 p-5 transition-all flex flex-col justify-between ${
                      layoutFile
                        ? 'border-emerald-500 bg-emerald-50/40'
                        : 'border-[#E5DAD3] hover:border-[#E30A78]/70 bg-[#FAF5F1]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between pb-3 border-b border-[#E5DAD3]">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-pink-50 border border-[#F5C6DC] text-[#B30A5C] flex items-center justify-center font-bold">
                            <ImageIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-[10px] font-mono font-black tracking-widest text-[#B30A5C] uppercase block">
                              ARQUIVO 2
                            </span>
                            <h4 className="font-extrabold text-sm text-[#1C1418]">
                              LAYOUT APROVADO
                            </h4>
                          </div>
                        </div>
                        {layoutFile ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold border border-emerald-300 flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-600" />
                            CARREGADO
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold border border-amber-300">
                            PENDENTE
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-[#6E615B] mt-2">
                        Fornece a imagem principal da sacola/saco, cores da estampa, arte visual e referências gráficas oficiais.
                      </p>

                      {/* File Card or Drop Area */}
                      <div className="mt-4">
                        {layoutFile ? (
                          <div className="bg-white border border-emerald-200 p-3.5 rounded-xl flex items-center justify-between gap-3 shadow-sm">
                            <div className="flex items-center gap-2.5 min-w-0">
                              {layoutPreviewUrl ? (
                                <img
                                  src={layoutPreviewUrl}
                                  alt="Preview layout"
                                  className="w-10 h-10 rounded-lg object-contain bg-[#FAF5F1] border border-[#E5DAD3] shrink-0 p-0.5"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <FileCheck2 className="w-6 h-6 text-emerald-600 shrink-0" />
                              )}
                              <div className="min-w-0">
                                <div className="font-bold text-xs text-[#1C1418] truncate">
                                  {layoutFile.name}
                                </div>
                                <div className="text-[10px] text-[#6E615B] font-mono">
                                  {(layoutFile.size / 1024).toFixed(1)} KB • Layout Aprovado
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setLayoutFile(null);
                                setLayoutPreviewUrl(null);
                              }}
                              className="text-xs text-rose-600 hover:text-rose-700 font-bold px-2 py-1 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              Trocar
                            </button>
                          </div>
                        ) : (
                          <div
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              if (e.dataTransfer.files?.[0]) handleLayoutFileSelect(e.dataTransfer.files[0]);
                            }}
                            onClick={() => document.getElementById('layout-input-field')?.click()}
                            className="border border-dashed border-[#E5DAD3] hover:border-[#E30A78] rounded-xl p-6 text-center bg-white cursor-pointer transition-colors flex flex-col items-center justify-center gap-2"
                          >
                            <input
                              type="file"
                              id="layout-input-field"
                              accept=".pdf,application/pdf,image/*"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files?.[0]) handleLayoutFileSelect(e.target.files[0]);
                              }}
                            />
                            <div className="w-10 h-10 rounded-xl bg-pink-50 text-[#B30A5C] flex items-center justify-center">
                              <Upload className="w-5 h-5" />
                            </div>
                            <span className="font-bold text-xs text-[#1C1418]">
                              [ CARREGAR LAYOUT ]
                            </span>
                            <span className="text-[10px] text-[#6E615B]">
                              Clique ou arraste o arquivo do Layout aprovado (PDF ou Imagem)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Documental Status Indicator Bar */}
                <div
                  className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    documentalStatusType === 'complete'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-amber-50 border-amber-200 text-amber-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {documentalStatusType === 'complete' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                    )}
                    <div>
                      <div className="font-extrabold text-xs tracking-wide">
                        {documentalStatusText}
                      </div>
                      <div className="text-[11px] opacity-80">
                        {documentalStatusType === 'complete'
                          ? 'Vínculo direto estabelecido: OP + Layout serão gravados juntos na mesma Ordem de Produção.'
                          : documentalStatusType === 'layout_missing'
                          ? 'Carregue o Layout Aprovado para poder analisar e liberar a OP para a fábrica.'
                          : documentalStatusType === 'op_missing'
                          ? 'Carregue o PDF da Ordem de Produção para extrair dados técnicos e roteiro.'
                          : 'Carregue os dois documentos correspondentes para prosseguir.'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                        isOpLoaded ? 'bg-emerald-200 text-emerald-700' : 'bg-amber-200 text-amber-700'
                      }`}
                    >
                      OP: {isOpLoaded ? 'OK' : 'PENDENTE'}
                    </span>
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                        isLayoutLoaded ? 'bg-emerald-200 text-emerald-700' : 'bg-amber-200 text-amber-700'
                      }`}
                    >
                      LAYOUT: {isLayoutLoaded ? 'OK' : 'PENDENTE'}
                    </span>
                  </div>
                </div>

                {/* Processing State */}
                {isProcessing && (
                  <div className="py-8 space-y-3 flex flex-col items-center justify-center bg-[#FAF5F1] rounded-2xl border border-[#E5DAD3]">
                    <RefreshCw className="w-10 h-10 text-[#E30A78] animate-spin" />
                    <div className="text-base font-extrabold text-[#1C1418]">
                      Lendo Ordem de Produção e Layout Aprovado...
                    </div>
                    <p className="text-[#6E615B] text-xs max-w-md text-center">
                      Associando os dois documentos, interpretando dados técnicos, determinando roteiro fabril e isolando a foto oficial da sacola.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: CONFERÊNCIA & REVISÃO ANTES DA LIBERAÇÃO */}
            {activeTab === 'review' && extractedData && (
              <div className="space-y-6">
                
                {/* BANNER DE AVISO QUANDO PRECISA DE REVISÃO PCP */}
                {extractedData.precisaRevisaoPcp && !isEditingManualData && (
                  <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3 animate-in fade-in">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                          <AlertTriangle className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-black text-sm text-amber-950 uppercase tracking-wide">
                              Revisão PCP Obrigatória
                            </h4>
                            <span className="px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 font-bold text-[10px] border border-amber-400">
                              PENDÊNCIA TÉCNICA
                            </span>
                          </div>
                          <p className="text-xs text-amber-900 mt-1 leading-relaxed">
                            Alguns campos técnicos da OP não foram identificados com 100% de certeza ou estão ausentes. Para evitar erros no chão de fábrica, confira e corrija os dados abaixo antes de liberar a produção.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsEditingManualData(true)}
                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#E30A78] to-[#B30A5C] hover:from-[#c20866] hover:to-[#96084c] text-white font-black text-xs flex items-center gap-2 shadow-md shadow-pink-600/20 transition-all cursor-pointer self-start sm:self-auto shrink-0 active:scale-95"
                      >
                        <Edit3 className="w-4 h-4" />
                        <span>REVISAR E CORRIGIR DADOS</span>
                      </button>
                    </div>

                    {/* Lista de Inconsistências / Campos Pendentes */}
                    {extractedData.inconsistencias && extractedData.inconsistencias.length > 0 && (
                      <div className="bg-white/80 border border-amber-200 rounded-xl p-3 text-[11px] space-y-1">
                        <span className="font-bold text-amber-900 block">Campos que requerem sua atenção:</span>
                        <ul className="list-disc list-inside space-y-0.5 text-amber-800">
                          {extractedData.inconsistencias.map((inc, i) => (
                            <li key={i}>{inc}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Se estiver no modo de edição, renderiza o formulário interativo */}
                {isEditingManualData ? (
                  <PcpManualReviewForm
                    initialData={extractedData}
                    onSave={handleSaveManualReview}
                    onCancel={() => setIsEditingManualData(false)}
                  />
                ) : (
                  <>
                    {/* 1. SEÇÃO DOCUMENTOS */}
                    <div className="bg-[#FAF5F1] border border-[#E5DAD3] rounded-2xl p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5DAD3] pb-3">
                        <h4 className="font-black text-xs uppercase tracking-widest text-[#B30A5C] flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-[#E30A78]" />
                          <span>1. DOCUMENTOS VINCULADOS</span>
                        </h4>
                        <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 font-extrabold text-[11px] flex items-center gap-1.5 font-mono">
                          <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                          STATUS DOCUMENTAL: COMPLETO
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                        <div className="bg-white border border-[#E5DAD3] p-3 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-[#E30A78]" />
                            <span className="font-bold text-xs text-[#1C1418]">OP:</span>
                            <span className="text-xs text-[#6E615B] font-mono truncate max-w-[180px]">
                              {opFile?.name || extractedData.opFileName || 'Ordem_Producao.pdf'}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            CARREGADA
                          </span>
                        </div>

                        <div className="bg-white border border-[#E5DAD3] p-3 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ImageIcon className="w-4 h-4 text-[#B30A5C]" />
                            <span className="font-bold text-xs text-[#1C1418]">Layout:</span>
                            <span className="text-xs text-[#6E615B] font-mono truncate max-w-[180px]">
                              {layoutFile?.name || extractedData.layoutFileName || 'Layout_Aprovado.pdf'}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            CARREGADO
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 2. SEÇÃO FOTO IDENTIFICADA (MINIATURA OFICIAL) */}
                    <div className="rounded-2xl border border-[#F5C6DC] bg-gradient-to-r from-pink-50/40 via-white to-pink-50/20 p-5 space-y-4 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5DAD3] pb-3">
                        <h4 className="font-black text-xs uppercase tracking-widest text-[#B30A5C] flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-[#E30A78]" />
                          <span>2. FOTO IDENTIFICADA (MINIATURA OFICIAL DA OP)</span>
                        </h4>

                        <div className="flex items-center gap-2">
                          {layoutImageSrc && (
                            <>
                              <button
                                type="button"
                                onClick={() => setIsCropperOpen(true)}
                                className="px-3 py-1.5 rounded-xl bg-pink-50 hover:bg-pink-100 text-[#B30A5C] border border-[#F5C6DC] font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <Crop className="w-3.5 h-3.5 text-[#E30A78]" />
                                <span>Ajustar Recorte da Sacola</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setIsFullLayoutModalOpen(true)}
                                className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#F2EBE6] text-[#1C1418] border border-[#E5DAD3] font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5 text-[#E30A78]" />
                                <span>Ver Layout Completo</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                        {/* Isolated Product Bag Thumbnail */}
                        <div className="bg-white border border-[#E5DAD3] p-4 rounded-xl flex items-center gap-4">
                          <OpProductThumbnail
                            thumbnail={extractedData.productThumbnail}
                            layoutImage={layoutImageSrc}
                            opNumber={extractedData.numeroOp}
                            size="2xl"
                            interactive={false}
                            className="border-2 border-[#E30A78]/40 shadow-sm"
                          />

                          <div className="space-y-1 flex-1">
                            <span className="text-[10px] uppercase font-bold text-[#8A7D77] tracking-wider block">
                              Identidade Visual em Produção
                            </span>
                            <h5 className="font-extrabold text-sm text-[#1C1418]">
                              {extractedData.produtoNome}
                            </h5>
                            <p className="text-[11px] text-[#6E615B] font-mono">
                              Cliente: <strong>{extractedData.cliente}</strong>
                            </p>
                            <p className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded inline-block font-semibold mt-1">
                              Acompanhará a OP em todas as telas
                            </p>
                          </div>
                        </div>

                        {/* Original Layout Preview */}
                        <div className="bg-white border border-[#E5DAD3] p-4 rounded-xl flex items-center justify-between gap-3">
                          <div className="space-y-1">
                            <span className="text-[10px] uppercase font-bold text-[#8A7D77] tracking-wider block">
                              Layout Técnico de Origem
                            </span>
                            <div className="font-bold text-xs text-[#1C1418] flex items-center gap-1.5">
                              <Layers className="w-4 h-4 text-[#E30A78]" />
                              <span>{layoutFile?.name || extractedData.layoutFileName || 'Layout_Oficial.pdf'}</span>
                            </div>
                            <p className="text-[11px] text-[#6E615B]">
                              Documento original aprovado pelo cliente.
                            </p>
                          </div>

                          {layoutImageSrc && (
                            <div
                              className="w-20 h-20 rounded-xl bg-[#FAF5F1] border border-[#E5DAD3] overflow-hidden shrink-0 flex items-center justify-center cursor-pointer group"
                              onClick={() => setIsFullLayoutModalOpen(true)}
                              title="Clique para ver layout completo"
                            >
                              <img
                                src={layoutImageSrc}
                                alt="Preview layout"
                                className="w-full h-full object-contain p-1 group-hover:scale-105 transition-transform"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 3. SEÇÃO DADOS LIDOS & 4. ROTEIRO SUGERIDO */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      
                      {/* Column 1: Ficha Técnica Lida da OP */}
                      <div className="bg-[#FAF5F1] border border-[#E5DAD3] rounded-2xl p-5 space-y-3">
                        <div className="flex items-center justify-between border-b border-[#E5DAD3] pb-2">
                          <h4 className="font-extrabold text-[#1C1418] flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-[#E30A78]" />
                            <span>3. Dados Lidos da OP</span>
                          </h4>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setIsEditingManualData(true)}
                              className="px-2.5 py-1 rounded-lg bg-white hover:bg-pink-50 text-[#B30A5C] border border-[#F5C6DC] font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                              title="Corrigir ou editar os dados lidos"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-[#E30A78]" />
                              <span>Editar Ficha</span>
                            </button>
                            <span className="font-mono text-[#E30A78] font-bold">
                              OP #{extractedData.numeroOp}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5 text-[#3A3034]">
                          <div>
                            <span className="text-[10px] uppercase text-[#8A7D77] font-semibold block">
                              Cliente
                            </span>
                            <span className={`font-bold text-xs ${extractedData.cliente === 'Não identificado' ? 'text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-mono' : 'text-[#1C1418]'}`}>
                              {extractedData.cliente}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] uppercase text-[#8A7D77] font-semibold block">
                              Pedido / Emissão
                            </span>
                            <span className="font-mono text-[#3A3034] text-xs">
                              {extractedData.numeroPedido}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] uppercase text-[#8A7D77] font-semibold block">
                              Produto Identificado
                            </span>
                            <span className={`font-semibold text-xs ${extractedData.produtoNome === 'Não identificado' ? 'text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-mono' : 'text-[#B30A5C]'}`}>
                              {extractedData.produtoNome}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] uppercase text-[#8A7D77] font-semibold block">
                              Quantidade Lote
                            </span>
                            <span className="font-mono font-bold text-emerald-700 text-xs">
                              {extractedData.quantidade.toLocaleString('pt-BR')} {extractedData.unidade}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] uppercase text-[#8A7D77] font-semibold block">
                              Material & Gramatura
                            </span>
                            <span className="text-[#1C1418]">
                              {extractedData.material} • {extractedData.gramatura} g/m² ({extractedData.corMaterial})
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] uppercase text-[#8A7D77] font-semibold block">
                              Medidas
                            </span>
                            <span className="font-mono text-[#1C1418]">
                              {extractedData.medidasFormatadas ||
                                `${extractedData.larguraMm}x${extractedData.alturaMm}+${extractedData.fundoMm}mm`}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] uppercase text-[#8A7D77] font-semibold block">
                              Impressão
                            </span>
                            <span className="text-[#1C1418]">
                              {extractedData.tipoImpressao} ({extractedData.numeroCores} cores)
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] uppercase text-[#8A7D77] font-semibold block">
                              Alça / Fechamento
                            </span>
                            <span className="text-[#1C1418]">
                              Alça: {extractedData.tipoAlca} | Cordão: {extractedData.usoCordao ? 'Sim' : 'Não'}
                            </span>
                          </div>
                        </div>

                        {extractedData.observacoesTecnicas && (
                          <div className="pt-2 border-t border-[#E5DAD3] text-[11px]">
                            <span className="text-[#8A7D77] font-semibold uppercase text-[10px] block">
                              Observações Técnicas:
                            </span>
                            <p className="text-[#3A3034] italic mt-0.5">
                              {extractedData.observacoesTecnicas}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Column 2: Roteiro Sugerido & Máquinas */}
                      <div className="bg-[#FAF5F1] border border-[#E5DAD3] rounded-2xl p-5 space-y-3">
                        <div className="flex items-center justify-between border-b border-[#E5DAD3] pb-2">
                          <h4 className="font-extrabold text-[#1C1418] flex items-center gap-1.5">
                            <Layers className="w-4 h-4 text-emerald-600" />
                            <span>4. Roteiro Sugerido & Máquinas</span>
                          </h4>
                          <span className="text-[11px] text-[#6E615B] font-mono">
                            {editableRoute.length} Operações
                          </span>
                        </div>

                        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                          {editableRoute.map((step, idx) => {
                            const compatibleMachines = machines.filter(
                              (m) => m.processTypeId === step.processTypeId && m.isActive
                            );

                            return (
                              <div
                                key={idx}
                                className="p-2.5 rounded-xl bg-white border border-[#E5DAD3] flex items-center justify-between gap-3 text-xs shadow-sm"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="w-5 h-5 rounded-full bg-pink-100 text-[#B30A5C] font-mono font-bold flex items-center justify-center text-[10px] border border-pink-200">
                                    {idx + 1}
                                  </span>
                                  <div>
                                    <div className="font-bold text-[#1C1418] flex items-center gap-1.5">
                                      <span>{step.processName}</span>
                                      {((step as any).hasCord || (step.processTypeId === 'proc_solda' && (extractedData?.op?.has_cord || extractedData?.op?.hasDrawstring || extractedData?.op?.handle_type === 'CORDAO'))) && (
                                        <span className="text-[9px] font-mono font-black px-1.5 py-0.2 rounded bg-amber-100 text-amber-700 border border-amber-300">
                                          Cordão: SIM
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-[#6E615B] font-mono">
                                      Estimado: ~{step.estimatedMinutes} min
                                    </div>
                                  </div>
                                </div>

                                {step.processTypeId === 'proc_expedicao' || (step as any).isManual || step.processName.toLowerCase().includes('expedi') ? (
                                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold shadow-xs">
                                    <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <span>Manual • Carlos (Expedição)</span>
                                  </div>
                                ) : (
                                  <select
                                    value={step.machineId}
                                    onChange={(e) => handleMachineChangeForStep(idx, e.target.value)}
                                    className="bg-[#FAF5F1] border border-[#E5DAD3] text-[#1C1418] rounded-lg px-2 py-1 text-[11px] font-bold focus:border-[#E30A78] focus:outline-none"
                                  >
                                    {compatibleMachines.length > 0 ? (
                                      compatibleMachines.map((m) => (
                                        <option key={m.id} value={m.id}>
                                          {m.name} ({m.status})
                                        </option>
                                      ))
                                    ) : (
                                      <option value="">Sem máquina compatível</option>
                                    )}
                                  </select>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="bg-[#FAF5F1] px-6 py-4 border-t border-[#E5DAD3] flex items-center justify-between">
            {activeTab === 'upload' ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-[#F2EBE6] text-[#1C1418] border border-[#E5DAD3] text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleAnalyzeAndCreate}
                  disabled={!isDocumentalComplete || isProcessing}
                  className={`px-6 py-2.5 rounded-xl font-black text-xs shadow-lg transition-all flex items-center gap-2 cursor-pointer ${
                    isDocumentalComplete && !isProcessing
                      ? 'bg-gradient-to-r from-[#E30A78] to-[#B30A5C] hover:from-[#c20866] hover:to-[#96084c] text-white shadow-pink-600/20 active:scale-95'
                      : 'bg-[#E5DAD3] text-[#8A7D77] cursor-not-allowed opacity-70 shadow-none'
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>ANALISANDO DOCUMENTOS...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>ANALISAR E CRIAR OP</span>
                    </>
                  )}
                </button>
              </>
            ) : isEditingManualData ? (
              <div className="w-full flex items-center justify-between">
                <span className="text-[11px] text-[#6E615B] font-medium">
                  Modo de edição ativo. Preencha os campos obrigatórios e clique em salvar.
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditingManualData(false)}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-[#F2EBE6] text-[#1C1418] border border-[#E5DAD3] text-xs font-bold transition-colors cursor-pointer"
                >
                  Voltar à Visualização
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingManualData(false);
                    setActiveTab('upload');
                  }}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-[#F2EBE6] text-[#1C1418] border border-[#E5DAD3] text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>CORRIGIR ARQUIVOS</span>
                </button>

                {extractedData?.precisaRevisaoPcp ? (
                  <button
                    type="button"
                    onClick={() => setIsEditingManualData(true)}
                    className="px-6 py-2.5 rounded-xl font-black text-xs shadow-lg transition-all flex items-center gap-2 bg-gradient-to-r from-[#E30A78] to-[#B30A5C] hover:from-[#c20866] hover:to-[#96084c] text-white shadow-pink-600/20 cursor-pointer active:scale-95"
                  >
                    <Edit3 className="w-4 h-4 stroke-[2.5]" />
                    <span>REVISAR E CORRIGIR DADOS DA OP</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleApproveAndRelease}
                    className="px-6 py-2.5 rounded-xl font-black text-xs shadow-lg transition-all flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white shadow-emerald-600/20 cursor-pointer active:scale-95"
                  >
                    <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                    <span>CONFIRMAR E LIBERAR PARA PRODUÇÃO</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Cropper Modal Overlay */}
      {layoutImageSrc && (
        <LayoutCropModal
          isOpen={isCropperOpen}
          onClose={() => setIsCropperOpen(false)}
          layoutImage={layoutImageSrc}
          opNumber={extractedData?.numeroOp || 'Nova'}
          initialCropBox={extractedData?.layoutCropBox}
          onSaveCrop={handleSaveCrop}
        />
      )}

      {/* Full Layout Modal */}
      {extractedData && (
        <FullLayoutModal
          order={{
            id: 'temp-preview',
            opNumber: extractedData.numeroOp,
            orderNumber: extractedData.numeroPedido,
            client: extractedData.cliente,
            productId: 'temp',
            productName: extractedData.produtoNome,
            productCode: extractedData.codigoProduto,
            targetQuantity: extractedData.quantidade,
            currentGoodQuantity: 0,
            totalLosses: 0,
            unit: extractedData.unidade,
            material: extractedData.material,
            grammage: extractedData.gramatura,
            color: extractedData.corMaterial,
            dimensions: {
              width: extractedData.larguraMm,
              height: extractedData.alturaMm,
              gusset: extractedData.fundoMm,
            },
            printing: {
              type: extractedData.tipoImpressao,
              colorsCount: extractedData.numeroCores,
              front: extractedData.impressaoFrente,
              back: extractedData.impressaoVerso,
            },
            handleType: extractedData.tipoAlca,
            hasDrawstring: extractedData.usoCordao,
            hasVisor: extractedData.usoVisor,
            technicalNotes: extractedData.observacoesTecnicas,
            deadline: extractedData.prazoEntrega,
            estimatedCompletionDate: extractedData.prazoEntrega,
            safetyMarginHours: 24,
            priority: 'VERDE',
            status: 'PROGRAMADA',
            currentStepIndex: 0,
            steps: [],
            createdAt: new Date().toISOString(),
            createdBy: 'PCP',
            layoutImage: layoutImageSrc,
            layoutPreviewImage: layoutImageSrc,
            productThumbnail: extractedData.productThumbnail,
            layoutFileName: layoutFile?.name || extractedData.layoutFileName,
          }}
          isOpen={isFullLayoutModalOpen}
          onClose={() => setIsFullLayoutModalOpen(false)}
        />
      )}
    </>
  );
};
