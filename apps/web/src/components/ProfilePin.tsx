import { useId, useRef, useState, type FormEvent } from 'react';
import { Lock, Settings } from 'lucide-react';
import { useProfiles } from '../contexts/ProfileContext';
import { Button, emptyPin, Modal, PinField } from './ui';
import { useGuideScene } from '../tutorial/GuideContext';

export function ProfileEntryDialog() {
  const { entry, selectProfile, unlockProfile } = useProfiles();
  const [pin, setPin] = useState(emptyPin);
  const input = useRef<HTMLInputElement>(null);
  const errorId = useId();
  if (!entry?.needsPin) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (entry?.pending) return;
    setPin(emptyPin);
    await unlockProfile(pin.join(''));
    input.current?.focus();
  }

  return (
    <Modal isOpen title={'Desbloquear ' + entry.profile.name} onClose={() => selectProfile(null)}
      className="directory-modal">
      <form className="directory-form" onSubmit={submit}>
        <PinField label="PIN do perfil" hint="Digite quatro dígitos." data-initial-focus ref={input}
          aria-invalid={Boolean(entry.error) || undefined} aria-describedby={errorId}
          value={pin} onValueChange={setPin} />
        <p id={errorId} role="alert" className="directory-error">{entry.error}</p>
        <p role="status">{entry.pending ? 'Verificando o PIN…' : ''}</p>
        <div className="directory-actions">
          <Button variant="outline" onClick={() => selectProfile(null)}>Cancelar</Button>
          <Button type="submit" data-guide="unlock-profile" aria-disabled={entry.pending || undefined}>Desbloquear</Button>
        </div>
      </form>
    </Modal>
  );
}

function PinSettings({ onClose }: { onClose: () => void }) {
  const { activeProfile, updatePin } = useProfiles();
  const [removing, setRemoving] = useState(false);
  const [currentPin, setCurrentPin] = useState(emptyPin);
  const [pin, setPin] = useState(emptyPin);
  const [pinConfirmation, setConfirmation] = useState(emptyPin);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const confirmation = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const hasPin = activeProfile?.hasPin;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const newPin = pin.join('');
    const confirmationPin = pinConfirmation.join('');
    if (!removing && newPin !== confirmationPin) {
      setMismatch(true);
      confirmation.current?.focus();
      return;
    }
    setSaving(true);
    setError('');
    try {
      await updatePin(removing
        ? { pin: null, currentPin: currentPin.join('') }
        : { pin: newPin, pinConfirmation: confirmationPin, currentPin: hasPin ? currentPin.join('') : undefined });
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível atualizar o PIN.');
      setSaving(false);
    }
  }

  return (
    <Modal isOpen title="Configurações do perfil" description={activeProfile?.name} onClose={onClose}
      dismissDisabled={saving} className="directory-modal">
      <form className="directory-form" onSubmit={submit}>
        <fieldset className="directory-form-fields" disabled={saving}>
          {hasPin && <PinField label="PIN atual" data-initial-focus aria-describedby={errorId}
            value={currentPin} onValueChange={setCurrentPin} />}
          {removing ? <p>Ao remover o PIN, o perfil poderá ser aberto diretamente pela lista de perfis.</p> : <>
            <PinField label="Novo PIN" hint="Use quatro dígitos." data-initial-focus={!hasPin || undefined}
              value={pin} onValueChange={value => { setPin(value); setMismatch(false); }} />
            <PinField label="Confirmar novo PIN" ref={confirmation}
              errorMessage={mismatch ? 'Os PINs precisam ser iguais.' : undefined}
              value={pinConfirmation} onValueChange={value => { setConfirmation(value); setMismatch(false); }} />
          </>}
          {hasPin && <Button variant="ghost" onClick={() => {
            setRemoving(!removing);
            setError('');
          }}>{removing ? 'Voltar para a alteração de PIN' : 'Remover PIN'}</Button>}
        </fieldset>
        <p id={errorId} role="alert" className="directory-error">{error}</p>
        <p role="status">{saving ? 'Salvando…' : ''}</p>
        <div className="directory-actions" data-guide="pin-actions">
          <Button variant="outline" disabled={saving} onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant={removing ? 'danger' : 'primary'} aria-disabled={saving || undefined}>
            {removing ? 'Confirmar remoção' : 'Salvar PIN'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function ProfileSecurityActions() {
  const { activeProfile, lockProfile } = useProfiles();
  const scene = useGuideScene();
  const [settings, setSettings] = useState(scene?.panel === 'pin');
  return <>
    {activeProfile?.hasPin && <button type="button" className="profile-tool" aria-label="Bloquear perfil"
      title="Bloquear perfil" onClick={lockProfile}><Lock size={15} aria-hidden="true" /></button>}
    <button type="button" className="profile-tool" aria-label="Configurações do perfil" title="Configurações do perfil"
      onClick={event => { event.currentTarget.focus(); setSettings(true); }}><Settings size={15} aria-hidden="true" /></button>
    {settings && <PinSettings onClose={() => setSettings(false)} />}
  </>;
}
