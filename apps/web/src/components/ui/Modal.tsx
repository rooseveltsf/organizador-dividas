import React, { useLayoutEffect, useRef } from 'react';
import { css, cx } from '@/styled-system/css';
import { X } from 'lucide-react';
import { useGuideScene } from '../../tutorial/GuideContext';

interface ModalContentProps {
  isOpen: boolean;
  onClose: () => void;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  dismissDisabled?: boolean;
}

export type ModalProps = ModalContentProps & (
  { title: React.ReactNode; 'aria-label'?: never } |
  { title?: never; 'aria-label': string }
);

const overlayStyle = css({
  position: 'fixed',
  inset: '0',
  zIndex: 50,
  backgroundColor: 'rgba(15, 23, 42, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '4',
  smDown: { padding: '2' },
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
  smDown: { maxHeight: 'calc(100dvh - 1rem)' },
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
  smDown: { paddingX: '4' },
  paddingTop: '6',
  paddingBottom: '2',
});

const modalHeaderContentStyle = css({
  minWidth: 0,
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
  overflowWrap: 'anywhere',
  fontSize: 'sm',
  color: 'slate.500',
  margin: '0',
});

const closeButtonStyle = css({
  color: 'slate.600',
  backgroundColor: 'transparent',
  border: 'none',
  borderRadius: 'lg',
  padding: '1.5',
  minWidth: '9',
  minHeight: '9',
  flexShrink: 0,
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
  smDown: { paddingX: '4' },
  paddingY: '4',
});

type ModalLayerProps = React.ComponentPropsWithoutRef<'dialog'> & { onDismiss: () => void };

const tabStops = 'a[href], button, input, select, textarea, summary, [tabindex]';

export function ModalLayer(props: ModalLayerProps) {
  const scene = useGuideScene();
  return scene ? <InlineExample {...props} /> : <NativeModal {...props} />;
}

function InlineExample({ onDismiss, children, className, 'aria-label': label, 'aria-labelledby': labelledBy,
  'aria-describedby': describedBy }: ModalLayerProps) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const layer = ref.current!;
    const previous = document.activeElement;
    if (!(previous instanceof HTMLElement) || !previous.closest('.guide-demo') || layer.contains(previous)) return;
    (layer.querySelector<HTMLElement>('[data-initial-focus], h2') ?? layer).focus();
    return () => {
      if (previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return <section ref={ref} tabIndex={-1} aria-label={label} aria-labelledby={labelledBy} aria-describedby={describedBy}
    className={cx('guide-inline', className)} onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); onDismiss(); }
    }}>
    {children}
  </section>;
}

function NativeModal({ onDismiss, children, className, ...props }: ModalLayerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const pointerStartedOutside = useRef(false);
  useLayoutEffect(() => {
    const dialog = ref.current!;
    const opener = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const initial = dialog.querySelector<HTMLElement>('[data-initial-focus]');
    if (initial) initial.autofocus = true;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    if (initial && document.activeElement !== initial) initial.focus();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (opener instanceof HTMLElement && opener.isConnected) {
        opener.focus({ preventScroll: true });
      }
    };
  }, []);

  return (
    <dialog {...props} ref={ref} className={cx('notebook-dialog', className)}
      onCancel={(event) => { event.preventDefault(); onDismiss(); }}
      onPointerDown={(event) => {
        pointerStartedOutside.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (pointerStartedOutside.current && event.target === event.currentTarget) onDismiss();
        pointerStartedOutside.current = false;
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab' || event.defaultPrevented) return;
        const dialog = event.currentTarget;
        const controls = Array.from(dialog.querySelectorAll<HTMLElement>(tabStops)).filter(
          (element) => element.tabIndex >= 0 && !element.matches(':disabled') &&
            element.getClientRects().length > 0 && getComputedStyle(element).visibility === 'visible',
        );
        const tabbable = controls.filter((element) => {
          if (!(element instanceof HTMLInputElement) || element.type !== 'radio' || !element.name) return true;
          const checked = controls.find((candidate) => candidate instanceof HTMLInputElement &&
            candidate.type === 'radio' && candidate.name === element.name &&
            candidate.form === element.form && candidate.checked);
          return !checked || checked === element;
        });
        const start = tabbable[0];
        const end = tabbable[tabbable.length - 1];
        const focused = document.activeElement;
        const boundary = event.shiftKey ? start : end;
        if (focused === boundary || focused === dialog) {
          event.preventDefault();
          (event.shiftKey ? end : start)?.focus();
        }
      }}
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
  dismissDisabled,
  'aria-label': ariaLabel,
}) => {
  const titleId = React.useId();
  const descriptionId = React.useId();
  if (!isOpen) return null;

  function dismiss() {
    if (!dismissDisabled) onClose();
  }

  return (
    <ModalLayer
      className={overlayStyle}
      onDismiss={dismiss}
      aria-label={ariaLabel}
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descriptionId : undefined}
    >
      <div className={cx(modalBoxStyle, 'dialog-content', className)}>
        <div className={modalHeaderStyle}>
          <div className={modalHeaderContentStyle}>
            {title && <h2 id={titleId} tabIndex={-1} className={modalTitleStyle}>{title}</h2>}
            {description && <p id={descriptionId} className={modalDescriptionStyle}>{description}</p>}
          </div>
          <button
            type="button"
            className={closeButtonStyle}
            onClick={dismiss}
            aria-disabled={dismissDisabled || undefined}
            aria-label="Fechar diálogo"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className={modalBodyStyle}>{children}</div>
      </div>
    </ModalLayer>
  );
};
