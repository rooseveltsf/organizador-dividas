import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import { flushSync } from 'react-dom';
import { ArrowRight, Check, Lock, Notebook, Plus, Search, Trash2 } from 'lucide-react';
import type { Profile } from '@organizador/shared';
import { useProfiles } from '../contexts/ProfileContext';
import { NotebookHeader } from '../components/NotebookHeader';
import { ProfileEntryDialog } from '../components/ProfilePin';
import { Button, emptyPin, Input, Modal, PinField } from '../components/ui';
import './ProfileSelectScreen.css';

const COLOR_PRESETS = [
  { name: 'Petróleo e sálvia', primary: '#244E42', secondary: '#ABB8A2' },
  { name: 'Índigo & Rosa', primary: '#6366F1', secondary: '#EC4899' },
  { name: 'Azul & Roxo', primary: '#3B82F6', secondary: '#8B5CF6' },
  { name: 'Esmeralda & Menta', primary: '#10B981', secondary: '#14B8A6' },
  { name: 'Rosa & Âmbar', primary: '#F43F5E', secondary: '#F59E0B' },
  { name: 'Ciano & Safira', primary: '#06B6D4', secondary: '#3B82F6' },
  { name: 'Violeta & Magenta', primary: '#7C3AED', secondary: '#D946EF' },
  { name: 'Âmbar & Laranja', primary: '#F59E0B', secondary: '#EA580C' },
  { name: 'Ardósia & Grafite', primary: '#475569', secondary: '#1E293B' },
];

const defaultColors = COLOR_PRESETS[0];

function fullHex(value: string) {
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(value)) {
    return (
      '#' +
      Array.from(value.slice(1), (digit) => digit.repeat(2))
        .join('')
        .toUpperCase()
    );
  }
  return '';
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (!parts[0]) return 'PF';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Escolhe a tinta com maior contraste sobre a capa, inclusive nas paletas personalizadas.
function monogramInk(hex: string) {
  const [r, g, b] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? '#000000' : '#FFFFFF';
}

type ProfileIdentity = Omit<Profile, 'id'>;

function ProfileLabel({ profile }: { profile: ProfileIdentity }) {
  const cover = fullHex(profile.primaryColor) || defaultColors.primary;
  return (
    <span className="directory-label">
      <span
        aria-hidden="true"
        className="directory-monogram"
        style={{
          backgroundColor: cover,
          borderLeftColor: fullHex(profile.secondaryColor) || defaultColors.secondary,
          color: monogramInk(cover),
        }}
      >
        {profile.avatarInitials || initials(profile.name)}
      </span>
      <span className="directory-text">
        <span className="directory-name">{profile.name} {profile.hasPin &&
          <Lock className="directory-lock" size={15} aria-hidden="true" />}</span>
        <span className="directory-enter">
          Entrar no perfil <ArrowRight size={15} aria-hidden="true" />
        </span>
      </span>
    </span>
  );
}

function ColorField({
  label,
  id,
  value,
  fallback,
  onChange,
}: {
  label: string;
  id: string;
  value: string;
  fallback: string;
  onChange: (value: string) => void;
}) {
  const [touched, setTouched] = useState(false);
  const color = fullHex(value);
  const invalid = touched && !color;
  return (
    <div className="directory-color">
      <label htmlFor={id}>{label}</label>
      <div className="directory-color-input">
        <input
          aria-label={'Escolher ' + label.toLowerCase()}
          type="color"
          value={color || fallback}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
        />
        <input
          id={id}
          type="text"
          value={value}
          required
          pattern="#([a-fA-F0-9]{3}|[a-fA-F0-9]{6})"
          maxLength={7}
          spellCheck={false}
          autoCapitalize="characters"
          aria-invalid={invalid || undefined}
          aria-describedby={id + '-hint' + (invalid ? ' ' + id + '-error' : '')}
          onInvalid={() => setTouched(true)}
          onBlur={() => setTouched(true)}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
        />
      </div>
      <p id={id + '-hint'} className="field-hint">Use # seguido de 3 ou 6 dígitos hexadecimais.</p>
      <p id={id + '-error'} className="directory-error" role="alert">
        {invalid ? 'Informe uma cor válida.' : ''}
      </p>
    </div>
  );
}

function CreateProfileDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (name: string) => void }) {
  const { createProfile } = useProfiles();
  const [name, setName] = useState('');
  const [primaryColor, setPrimary] = useState(defaultColors.primary);
  const [secondaryColor, setSecondary] = useState(defaultColors.secondary);
  const [protect, setProtect] = useState(false);
  const [pin, setPin] = useState(emptyPin);
  const [pinConfirmation, setConfirmation] = useState(emptyPin);
  const [pinMismatch, setPinMismatch] = useState(false);
  const [error, setError] = useState('');
  const [invalidName, setInvalidName] = useState(false);
  const [saving, setSaving] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const confirmation = useRef<HTMLInputElement>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (name.trim().length < 2) {
      flushSync(() => setInvalidName(true));
      nameInput.current?.focus();
      return;
    }
    const newPin = pin.join('');
    const confirmationPin = pinConfirmation.join('');
    if (protect && newPin !== confirmationPin) {
      flushSync(() => setPinMismatch(true));
      confirmation.current?.focus();
      return;
    }
    setError('');
    setSaving(true);
    try {
      const profile = await createProfile({
        name: name.trim(),
        primaryColor: fullHex(primaryColor),
        secondaryColor: fullHex(secondaryColor),
        ...(protect ? { pin: newPin, pinConfirmation: confirmationPin } : {}),
      });
      onCreated(profile.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar o perfil.');
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      dismissDisabled={saving}
      title="Criar perfil"
      className="directory-modal"
    >
      <form className="directory-form" onSubmit={submit}>
        <fieldset disabled={saving} className="directory-form-fields">
          <Input
            label="Nome do perfil"
            ref={nameInput}
            data-initial-focus
            hint="Use pelo menos dois caracteres."
            value={name}
            required
            minLength={2}
            errorMessage={
              invalidName ? 'Informe um nome com pelo menos dois caracteres.' : undefined
            }
            onInvalid={() => flushSync(() => setInvalidName(true))}
            onChange={(e) => {
              setName(e.target.value);
              setInvalidName(false);
            }}
          />
          <fieldset className="directory-palettes">
            <legend>Paletas sugeridas</legend>
            <div className="directory-palette-grid">
              {COLOR_PRESETS.map((preset) => {
                const checked =
                  fullHex(primaryColor) === preset.primary &&
                  fullHex(secondaryColor) === preset.secondary;
                return (
                  <label key={preset.name}>
                    <input
                      type="radio"
                      name="profile-palette"
                      value={preset.name}
                      checked={checked}
                      onChange={() => {
                        setPrimary(preset.primary);
                        setSecondary(preset.secondary);
                      }}
                    />
                    <span className="directory-palette-option">
                      <span
                        aria-hidden="true"
                        className="palette-pair"
                        style={{
                          backgroundColor: preset.primary,
                          borderRightColor: preset.secondary,
                        }}
                      />
                      <span>{preset.name}</span>
                      {checked && <Check size={13} aria-hidden="true" />}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <fieldset>
            <legend>Cores personalizadas</legend>
            <div className="directory-colors">
              <ColorField
                id="profile-primary"
                label="Cor primária"
                value={primaryColor}
                fallback={defaultColors.primary}
                onChange={setPrimary}
              />
              <ColorField
                id="profile-secondary"
                label="Cor secundária"
                value={secondaryColor}
                fallback={defaultColors.secondary}
                onChange={setSecondary}
              />
            </div>
          </fieldset>
          <label className="profile-pin-option">
            <input type="checkbox" checked={protect} onChange={event => {
              setProtect(event.target.checked);
              setPin(emptyPin);
              setConfirmation(emptyPin);
              setPinMismatch(false);
              setError('');
            }} />
            Proteger com PIN
          </label>
          {protect && <>
            <PinField label="Novo PIN" hint="Use quatro dígitos." value={pin}
              onValueChange={value => { setPin(value); setPinMismatch(false); setError(''); }} />
            <PinField label="Confirmar novo PIN" value={pinConfirmation} ref={confirmation}
              errorMessage={pinMismatch ? 'Os PINs precisam ser iguais.' : undefined}
              onValueChange={value => { setConfirmation(value); setPinMismatch(false); setError(''); }} />
          </>}
          <div className="directory-preview">
            <h3>Prévia na seleção de perfis</h3>
            <div className="directory-card">
              <ProfileLabel
                profile={{
                  name: name.trim() || 'Nome do perfil',
                  avatarInitials: initials(name),
                  primaryColor,
                  secondaryColor,
                  hasPin: protect,
                }}
              />
            </div>
          </div>
        </fieldset>
        <p role="alert" className="directory-error">{error}</p>
        <p role="status">{saving ? 'Criando o perfil…' : ''}</p>
        <div className="directory-actions">
          <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" aria-disabled={saving || undefined}>
            Criar e entrar <ArrowRight size={16} aria-hidden="true" />
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function searchName(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR').trim();
}

export function ProfileSelectScreen({ entryNotice, clearEntryNotice, onProfileCreated }: {
  entryNotice: string;
  clearEntryNotice: () => void;
  onProfileCreated: (name: string) => void;
}) {
  const { profiles, selectProfile, entry, accessNotice, deleteProfile, profileListStatus, fetchProfiles } =
    useProfiles();
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [retrying, setRetrying] = useState(false);
  const createButton = useRef<HTMLButtonElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const nextFocus = useRef<string | null>(null);
  const showFilter = profiles.length >= 7 || Boolean(query);
  const term = searchName(query);
  const visible = term
    ? profiles.filter((profile) => searchName(profile.name).includes(term))
    : profiles;

  useLayoutEffect(() => {
    if (document.activeElement === document.body) title.current?.focus();
  }, [profileListStatus, profiles.length]);

  useEffect(() => {
    if (entryNotice) setNotice(entryNotice);
  }, [entryNotice]);

  function openCreate(event: MouseEvent<HTMLButtonElement>) {
    event.currentTarget.focus();
    clearEntryNotice();
    setCreating(true);
  }

  useEffect(() => {
    if (!removing && nextFocus.current !== null) {
      const next = document.getElementById('enter-' + nextFocus.current) || createButton.current;
      next?.focus();
      nextFocus.current = null;
    }
  }, [removing]);

  async function confirmDelete() {
    if (!removing || deleting) return;
    setDeleting(true);
    setError('');
    try {
      await deleteProfile(removing.id);
      const index = visible.findIndex((profile) => profile.id === removing.id);
      nextFocus.current = (visible[index + 1] || visible[index - 1])?.id ?? '';
      setNotice('Perfil ' + removing.name + ' excluído.');
      setRemoving(null);
      if (profiles.length === 1) setQuery('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir o perfil.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="notebook-page profile-directory">
      <NotebookHeader>
        <span className="section-marker">
          <Notebook aria-hidden="true" size={16} /> Perfis
        </span>
      </NotebookHeader>

      {profileListStatus !== 'ready' ? (
        <section className="directory-intro">
          <div>
            <h1 tabIndex={-1} ref={title}>Seus perfis</h1>
            <p role="status">{profileListStatus === 'loading' ? 'Carregando seus perfis…' : ''}</p>
            <p role="alert" className="directory-error">{profileListStatus === 'error' ? 'Não foi possível carregar a lista de perfis.' : ''}</p>
          </div>
          {(profileListStatus === 'error' || retrying) && (
            <Button variant="outline" aria-disabled={retrying || undefined} onClick={async () => {
              if (retrying) return;
              setRetrying(true);
              try {
                await fetchProfiles();
              } finally {
                setRetrying(false);
              }
            }}>Tentar carregar os perfis novamente</Button>
          )}
        </section>
      ) : profiles.length === 0 ? (
        <section className="cover-hero directory-welcome">
          <div className="cover-copy">
            <h1 tabIndex={-1} ref={title}>
              Seu primeiro <em>perfil.</em>
            </h1>
            <p>
              Crie um perfil com seu nome e suas cores para começar a usar o caderno financeiro.
            </p>
            <Button ref={createButton} onClick={openCreate}>
              <Plus size={16} aria-hidden="true" /> Criar meu perfil
            </Button>
          </div>
          <div className="cover-art" aria-hidden="true">
            <div className="book-back" />
            <div className="book-front">
              <span className="book-label">
                <i />
                <i />
                <i />
              </span>
              <span className="book-band" />
            </div>
            <span className="cover-pencil" />
          </div>
        </section>
      ) : (
        <>
          <div className="directory-intro">
            <div>
              <h1 tabIndex={-1} ref={title}>
                Seus <em>perfis</em>
              </h1>
              <p>Escolha um perfil para abrir o painel.</p>
            </div>
            <Button ref={createButton} variant="outline" onClick={openCreate}>
              <Plus size={16} aria-hidden="true" /> Criar perfil
            </Button>
          </div>
          <section aria-label="Perfis disponíveis">
            <div className="directory-toolbar">
              <p role="status">
                {term ? visible.length + ' de ' : ''}
                {profiles.length} {profiles.length === 1 ? 'perfil' : 'perfis'}
              </p>
              {showFilter && (
                <label className="directory-search">
                  <Search size={16} aria-hidden="true" />
                  <input
                    aria-label="Buscar perfil por nome"
                    ref={search}
                    placeholder="Buscar por nome"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
              )}
            </div>
            {visible.length ? (
              <ul className="directory-grid" aria-label="Lista de perfis">
                {visible.map((profile) => (
                  <li className="directory-card" key={profile.id}>
                    <button
                      className="directory-link"
                      id={'enter-' + profile.id}
                      aria-label={'Entrar no perfil ' + profile.name}
                      aria-describedby={profile.hasPin ? 'protected-' + profile.id : undefined}
                      onClick={() => {
                        clearEntryNotice();
                        selectProfile(profile);
                      }}
                    >
                      <ProfileLabel profile={profile} />
                    </button>
                    {profile.hasPin ? <span id={'protected-' + profile.id} className="sr-only">Protegido por PIN</span> : <button
                      className="profile-delete directory-delete"
                      title={'Excluir perfil ' + profile.name}
                      aria-label={'Excluir perfil ' + profile.name}
                      onClick={(event) => {
                        event.currentTarget.focus();
                        setRemoving(profile);
                        setError('');
                      }}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="directory-no-results">
                <p>Nenhum perfil encontrado para “{query}”.</p>
                <Button variant="outline" onClick={() => {
                  (profiles.length >= 7 ? search.current : title.current)?.focus();
                  setQuery('');
                }}>
                  Limpar busca
                </Button>
              </div>
            )}
          </section>
        </>
      )}
      <p className="directory-notice" role="status">
        {entry?.pending && !entry.needsPin ? 'Verificando o acesso ao perfil…' : accessNotice || notice}
      </p>
      <p role="alert" className="directory-error">{entry && !entry.needsPin ? entry.error : ''}</p>
      {creating && <CreateProfileDialog onClose={() => setCreating(false)} onCreated={name => {
        setCreating(false);
        onProfileCreated(name);
      }} />}
      <ProfileEntryDialog key={entry?.profile.id} />
      <Modal
        isOpen={Boolean(removing)}
        title="Excluir perfil?"
        className="directory-modal"
        onClose={() => setRemoving(null)}
        dismissDisabled={deleting}
      >
        {removing && (
          <div className="directory-confirm">
            <p>
              O perfil <strong>{removing.name}</strong> e todos os lançamentos vinculados a ele
              serão <strong>excluídos permanentemente</strong>.
            </p>
            <p role="alert" className="directory-error">{error}</p>
            <p role="status">{deleting ? 'Excluindo o perfil…' : ''}</p>
            <div className="directory-actions">
              <Button variant="outline" data-initial-focus disabled={deleting} onClick={() => setRemoving(null)}>
                Cancelar
              </Button>
              <Button variant="danger" aria-disabled={deleting || undefined} onClick={confirmDelete}>
                Excluir perfil
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </main>
  );
}
