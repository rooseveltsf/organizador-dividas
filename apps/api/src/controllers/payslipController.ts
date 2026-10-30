import { Request, Response } from 'express';
import multer from 'multer';
import { ApiResponse, PayslipParseResult } from '@organizador/shared';
import { PayslipPdfParserService } from '../services/payslipPdfParserService';

/**
 * Configuração do Multer para armazenamento em memória
 * Limite de 5MB e filtro restrito para arquivos application/pdf
 */
export const uploadPayslipPdf = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (_req, file, cb) => {
    const isPdfMime = file.mimetype === 'application/pdf';
    const hasPdfExtension = file.originalname.toLowerCase().endsWith('.pdf');

    if (isPdfMime || hasPdfExtension) {
      cb(null, true);
    } else {
      cb(new Error('Formato inválido. Apenas documentos no formato PDF são aceitos.'));
    }
  },
});

export class PayslipController {
  /**
   * POST /payslip/parse
   * Recebe um arquivo PDF no campo "file", processa suas linhas tabulares,
   * classifica proventos e descontos e retorna o resultado estruturado.
   */
  public static async parse(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        const badRequest: ApiResponse = {
          success: false,
          message: 'Nenhum arquivo PDF foi enviado. Envie o contracheque através do campo "file".',
        };
        res.status(400).json(badRequest);
        return;
      }

      // Validação do cabeçalho binário do PDF (%PDF-)
      const buffer = req.file.buffer;
      const pdfHeader = buffer.slice(0, 5).toString('ascii');
      if (!pdfHeader.startsWith('%PDF')) {
        const badRequest: ApiResponse = {
          success: false,
          message: 'O arquivo enviado não é um documento PDF válido.',
        };
        res.status(400).json(badRequest);
        return;
      }

      const parseResult = await PayslipPdfParserService.parse(buffer);

      const response: ApiResponse<PayslipParseResult> = {
        success: true,
        message: 'Contracheque processado com sucesso.',
        data: parseResult,
      };

      res.status(200).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Erro ao processar o contracheque em PDF.',
        errors: [error instanceof Error ? error.message : 'Erro interno durante a leitura do PDF'],
      };
      res.status(400).json(response);
    }
  }
}

