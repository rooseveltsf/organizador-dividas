import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { PayslipController, uploadPayslipPdf } from '../controllers/payslipController';
import { ApiResponse } from '@organizador/shared';

const router = Router();

/**
 * Middleware que captura e trata erros específicos do Multer
 * (limite de 5MB e filtro de arquivo não-PDF) retornando HTTP 400 padronizado.
 */
function handleUploadMiddleware(req: Request, res: Response, next: NextFunction): void {
  const upload = uploadPayslipPdf.single('file');

  upload(req, res, (err: any) => {
    if (err) {
      let message = err.message || 'Erro durante o upload do arquivo PDF.';
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        message = 'O arquivo PDF excede o limite máximo permitido de 5MB.';
      }

      const response: ApiResponse = {
        success: false,
        message,
        errors: [err.message],
      };
      res.status(400).json(response);
      return;
    }
    next();
  });
}

/**
 * POST /payslip/parse
 * Recebe o PDF no campo "file", analisa coordenadas X/Y e retorna as fontes de renda e descontos estruturados.
 */
router.post('/parse', handleUploadMiddleware, PayslipController.parse);

export default router;

