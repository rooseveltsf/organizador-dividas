import React, { useLayoutEffect, useRef } from 'react';
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
  backgroundColor: 'bgCard',
  borderRadius: '2xl',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'slate.200',
  maxHeight: 'calc(100dvh - 2rem)',
  overflowY: 'auto',
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
  fontFamily: 'heading',
  fontSize: '2xl',
  fontWeight: 'normal',
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

type ModalLayerProps = React.ComponentPropsWithoutRef<'dialog'> & { onDismiss: () => void };

export function ModalLayer({ onDismiss, children, className, ...props }: ModalLayerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current!;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <dialog ref={ref} className={cx('notebook-dialog', className)}
      onCancel={(event) => { event.preventDefault(); onDismiss(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onDismiss(); }}
      {...props}
    >
      {children}
    </dialog>
  );
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
}) => {
  const titleId = React.useId();
  if (!isOpen) return null;

  return (
    <ModalLayer
      className={overlayStyle}
      onDismiss={onClose}
      aria-labelledby={title ? titleId : undefined}
    >
      <div className={cx(modalBoxStyle, className)}>
        {(title || description) && (
          <div className={modalHeaderStyle}>
            <div className={modalHeaderContentStyle}>
              {title && <h2 id={titleId} className={modalTitleStyle}>{title}</h2>}
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
    </ModalLayer>
  );
};
