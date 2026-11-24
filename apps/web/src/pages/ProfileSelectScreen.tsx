import React, { useState } from 'react';
import { css } from '@/styled-system/css';
import { Notebook, Plus, Check, ArrowRight, Trash2, AlertTriangle } from 'lucide-react';
import { useProfiles } from '../contexts/ProfileContext';
import { Button, Input, Modal } from '../components/ui';
import { NotebookHeader } from '../components/NotebookHeader';
import type { Profile } from '@organizador/shared';

// Paleta de sugestões modernas de pares de cores
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

export const ProfileSelectScreen: React.FC = () => {
  const { profiles, selectProfile, createProfile, deleteProfile } = useProfiles();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Estados para exclusão de perfil
  const [deletingProfile, setDeletingProfile] = useState<Profile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Estados do formulário de criação
  const [name, setName] = useState('');
  const [primaryColor, setPrimaryColor] = useState(COLOR_PRESETS[0].primary);
  const [secondaryColor, setSecondaryColor] = useState(COLOR_PRESETS[0].secondary);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Computa iniciais de preview
  const previewInitials = React.useMemo(() => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'PF';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [name]);

  const handleOpenModal = () => {
    setName('');
    setPrimaryColor(COLOR_PRESETS[0].primary);
    setSecondaryColor(COLOR_PRESETS[0].secondary);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSelectPreset = (preset: { primary: string; secondary: string }) => {
    setPrimaryColor(preset.primary);
    setSecondaryColor(preset.secondary);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name.trim().length < 2) {
      setFormError('O nome do perfil deve ter pelo menos 2 caracteres.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      await createProfile({
        name: name.trim(),
        primaryColor,
        secondaryColor,
      });
      setIsModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao criar perfil.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="notebook-page">
      <NotebookHeader>
        <span className="section-marker"><Notebook size={16} /> Perfis financeiros</span>
      </NotebookHeader>

      <section className="cover-hero">
        <div className="cover-copy">
          <h1>Caderno <em>financeiro.</em></h1>
          <p>Escolha um perfil para acompanhar suas contas, receitas e parcelamentos.</p>
        </div>
        <div className="cover-art" aria-hidden="true">
          <div className="book-back" />
          <div className="book-front">
            <span className="book-label"><i /><i /><i /></span>
            <span className="book-band" />
          </div>
          <span className="cover-pencil" />
        </div>
      </section>

      <section aria-labelledby="profiles-title" className="profiles-section">
        <div className="section-heading">
          <h2 id="profiles-title">Seus perfis</h2>
          <Button type="button" onClick={handleOpenModal}><Plus size={16} /> Criar perfil</Button>
        </div>
        {profiles.length === 0 ? (
          <div className="profiles-empty">
            <Notebook size={26} strokeWidth={1.4} />
            <div><h3>Seu primeiro perfil</h3><p>Crie um perfil para começar a registrar suas finanças.</p></div>
          </div>
        ) : (
          <div className="profile-grid">
            {profiles.map((profile) => (
              <div className="profile-entry" key={profile.id}>
                <button type="button" className="profile-link" onClick={() => selectProfile(profile)}>
                  <span className="profile-monogram" style={{ borderLeftColor: profile.primaryColor, borderBottomColor: profile.secondaryColor }}>
                    {profile.avatarInitials}
                  </span>
                  <span className="profile-name">{profile.name}</span>
                  <span className="profile-open">Abrir caderno <ArrowRight size={15} /></span>
                </button>
                <button type="button" className="profile-delete" onClick={() => setDeletingProfile(profile)}
                  title="Excluir perfil" aria-label={'Excluir perfil ' + profile.name}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Modal Rico de Criação de Perfil com Cores Customizadas e Preview em Tempo Real */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Criar Novo Perfil Financeiro"
        description="Defina o nome e escolha as cores personalizadas do seu painel."
      >
        <form onSubmit={handleCreateSubmit} className={css({ display: 'flex', flexDirection: 'column', gap: '5' })}>
          {formError && (
            <div role="alert"
              className={css({
                padding: '3',
                borderRadius: 'lg',
                backgroundColor: 'expense.50',
                color: 'expense.700',
                fontSize: 'xs',
                fontWeight: 'medium',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: 'expense.200',
              })}
            >
              {formError}
            </div>
          )}

          {/* Campo Nome */}
          <Input
            label="Nome do Perfil *"
            placeholder="Ex: Meu Perfil, Esposa, Pessoal..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />

          {/* Paleta de Cores Pré-definidas */}
          <div>
            <label className={css({ display: 'block', fontSize: 'xs', fontWeight: 'semibold', color: 'slate.700', mb: '2' })}>
              Paletas Recomendadas
            </label>
            <div
              className={css({
                display: 'grid',
                gridTemplateColumns: { base: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))' },
                gap: '2',
              })}
            >
              {COLOR_PRESETS.map((preset) => {
                const isSelected = primaryColor === preset.primary && secondaryColor === preset.secondary;
                return (
                  <button
                    key={preset.name}
                    type="button"
                    aria-label={preset.name}
                    aria-pressed={isSelected}
                    onClick={() => handleSelectPreset(preset)}
                    className={css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2',
                      padding: '2',
                      borderRadius: 'lg',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: isSelected ? 'slate.900' : 'slate.200',
                      backgroundColor: isSelected ? 'slate.50' : 'white',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      _hover: { borderColor: 'slate.400' },
                    })}
                  >
                    <span className="palette-pair" style={{ backgroundColor: preset.primary, borderRightColor: preset.secondary }} />
                    {isSelected && <Check size={12} aria-hidden="true" />}
                    <span className={css({ fontSize: '2xs', color: 'slate.700', fontWeight: 'medium', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' })}>
                      {preset.name.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Seletores Manuais de Cor Primária e Secundária */}
          <div className={css({ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4' })}>
            {/* Cor Primária */}
            <div>
              <label className={css({ display: 'block', fontSize: 'xs', fontWeight: 'semibold', color: 'slate.700', mb: '1.5' })}>
                Cor Primária
              </label>
              <div
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: 'slate.200',
                  borderRadius: 'lg',
                  padding: '1.5',
                  backgroundColor: 'white',
                })}
              >
                <input
                  type="color"
                  aria-label="Cor primária"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className={css({
                    width: '8',
                    height: '8',
                    borderRadius: 'md',
                    cursor: 'pointer',
                    border: 'none',
                    padding: '0',
                    backgroundColor: 'transparent',
                  })}
                />
                <input
                  type="text"
                  aria-label="Código da cor primária"
                  value={primaryColor.toUpperCase()}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  maxLength={7}
                  className={css({
                    width: '100%',
                    fontSize: 'xs',
                    fontWeight: 'mono',
                    border: 'none',
                    outline: 'none',
                    color: 'slate.700',
                  })}
                />
              </div>
            </div>

            {/* Cor Secundária */}
            <div>
              <label className={css({ display: 'block', fontSize: 'xs', fontWeight: 'semibold', color: 'slate.700', mb: '1.5' })}>
                Cor Secundária
              </label>
              <div
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: 'slate.200',
                  borderRadius: 'lg',
                  padding: '1.5',
                  backgroundColor: 'white',
                })}
              >
                <input
                  type="color"
                  aria-label="Cor secundária"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className={css({
                    width: '8',
                    height: '8',
                    borderRadius: 'md',
                    cursor: 'pointer',
                    border: 'none',
                    padding: '0',
                    backgroundColor: 'transparent',
                  })}
                />
                <input
                  type="text"
                  aria-label="Código da cor secundária"
                  value={secondaryColor.toUpperCase()}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  maxLength={7}
                  className={css({
                    width: '100%',
                    fontSize: 'xs',
                    fontWeight: 'mono',
                    border: 'none',
                    outline: 'none',
                    color: 'slate.700',
                  })}
                />
              </div>
            </div>
          </div>

          <div className="profile-preview">
            <span className="profile-monogram" style={{ borderLeftColor: primaryColor, borderBottomColor: secondaryColor }}>
              {previewInitials}
            </span>
            <div><span className="small-label">Prévia do perfil</span><p className="profile-name">{name.trim() || 'Nome do perfil'}</p></div>
          </div>

          {/* Botões do Rodapé do Modal */}
          <div className={css({ display: 'flex', justifyContent: 'flex-end', gap: '2', marginTop: '2' })}>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Criando...' : 'Criar Perfil'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal de Confirmação para Excluir Perfil */}
      <Modal
        isOpen={Boolean(deletingProfile)}
        onClose={() => !isDeleting && setDeletingProfile(null)}
        title="Excluir Perfil"
        description="Esta ação é permanente e não poderá ser desfeita"
      >
        {deletingProfile && (
          <div className={css({ display: 'flex', flexDirection: 'column', gap: '4' })}>
            <div
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: '3',
                padding: '3.5',
                borderRadius: 'xl',
                backgroundColor: 'expense.50',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: 'expense.200',
                color: 'expense.800',
                fontSize: 'sm',
              })}
            >
              <AlertTriangle size={24} className={css({ flexShrink: 0, color: 'expense.600' })} />
              <div>
                Tem certeza de que deseja excluir o perfil <strong>{deletingProfile.name}</strong>?
                <div className={css({ fontSize: 'xs', color: 'expense.700', marginTop: '1' })}>
                  Todas as receitas, despesas, contas e parcelamentos vinculados a este perfil serão permanentemente excluídos.
                </div>
              </div>
            </div>

            <div className={css({ display: 'flex', justifyContent: 'flex-end', gap: '3', marginTop: '2' })}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDeletingProfile(null)}
                disabled={isDeleting}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={isDeleting}
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    await deleteProfile(deletingProfile.id);
                    setDeletingProfile(null);
                  } catch (err) {
                    console.error('Erro ao excluir perfil:', err);
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.5',
                })}
              >
                <Trash2 size={16} />
                <span>{isDeleting ? 'Excluindo...' : 'Sim, Excluir Perfil'}</span>
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </main>
  );
};
