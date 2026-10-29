import React, { useEffect } from 'react';
import { css, cx } from '@/styled-system/css';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const overlayStyle = css({
  position: 'fixed',
  inset: '0',
  zIndex: 50,
  backgroundColor: 'rgba(15, 23, 42, 0.5)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '4',
  animation: 'fadeIn 0.2s ease-out forwards',
});

const modalBoxStyle = css({
  position: 'relative',
  width: '100%',
  maxWidth: '520px',
  backgroundColor: 'white',
  borderRadius: '2xl',
  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'slate.200',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  animation: 'fadeIn 0.25s ease-out forwards',
});

const modalHeaderStyle = css({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  paddingX: '6',
  paddingTop: '6',
  paddingBottom: '2',
});

const modalHeaderContentStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1',
  pr: '6',
});

const modalTitleStyle = css({
  fontSize: 'lg',
  fontWeight: 'bold',
  color: 'slate.900',
  lineHeight: '1.3',
  margin: '0',
});

const modalDescriptionStyle = css({
  fontSize: 'sm',
  color: 'slate.500',
  margin: '0',
});

const closeButtonStyle = css({
  color: 'slate.400',
  backgroundColor: 'transparent',
  border: 'none',
  borderRadius: 'lg',
  padding: '1.5',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.15s ease-in-out',
  _hover: {
    backgroundColor: 'slate.100',
    color: 'slate.700',
  },
});

const modalBodyStyle = css({
  paddingX: '6',
  paddingY: '4',
});

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
}) => {
  // Fecha o modal ao pressionar a tecla Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Bloqueia o scroll do body quando o modal estiver aberto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className={overlayStyle}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className={cx(modalBoxStyle, className)}>
        {(title || description) && (
          <div className={modalHeaderStyle}>
            <div className={modalHeaderContentStyle}>
              {title && <h2 className={modalTitleStyle}>{title}</h2>}
              {description && <p className={modalDescriptionStyle}>{description}</p>}
            </div>
            <button
              type="button"
              className={closeButtonStyle}
              onClick={onClose}
              aria-label="Fechar modal"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className={modalBodyStyle}>{children}</div>
      </div>
    </div>
  );
};
