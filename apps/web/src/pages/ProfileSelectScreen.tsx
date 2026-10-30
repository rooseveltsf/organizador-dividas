import React, { useState } from 'react';
import { css } from '@/styled-system/css';
import { Users, Plus, Sparkles, Check, ArrowRight } from 'lucide-react';
import { useProfiles, hexToRgba } from '../contexts/ProfileContext';
import { Button, Input, Modal } from '../components/ui';
import type { Profile } from '@organizador/shared';

// Paleta de sugestões modernas de pares de cores
const COLOR_PRESETS = [
  { name: 'Índigo & Rosa', primary: '#6366F1', secondary: '#EC4899' },
  { name: 'Azul & Roxo', primary: '#3B82F6', secondary: '#8B5CF6' },
  { name: 'Esmeralda & Menta', primary: '#10B981', secondary: '#14B8A6' },
  { name: 'Rosa & Âmbar', primary: '#F43F5E', secondary: '#F59E0B' },
  { name: 'Ciano & Safira', primary: '#06B6D4', secondary: '#3B82F6' },
  { name: 'Violeta & Magenta', primary: '#7C3AED', secondary: '#D946EF' },
  { name: 'Âmbar & Laranja', primary: '#F59E0B', secondary: '#EA580C' },
  { name: 'Slate & Grafite', primary: '#475569', secondary: '#1E293B' },
];

export const ProfileSelectScreen: React.FC = () => {
  const { profiles, selectProfile, createProfile } = useProfiles();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Estados do formulário de criação
  const [name, setName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#6366F1');
  const [secondaryColor, setSecondaryColor] = useState('#EC4899');
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
    setPrimaryColor('#6366F1');
    setSecondaryColor('#EC4899');
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
    <div
      className={css({
        minHeight: '100vh',
        width: '100vw',
        backgroundColor: 'slate.50',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: { base: '6', md: '12' },
        backgroundImage:
          'radial-gradient(circle at 50% 10%, rgba(99, 102, 241, 0.08) 0%, transparent 60%), radial-gradient(circle at 80% 90%, rgba(236, 72, 153, 0.05) 0%, transparent 50%)',
      })}
    >
      <div className={css({ width: '100%', maxWidth: '960px', textAlign: 'center' })}>
        {/* Cabeçalho da Tela */}
        <div className={css({ display: 'inline-flex', alignItems: 'center', gap: '2', color: 'brand.primary', mb: '3' })}>
          <Users size={28} />
          <span className={css({ fontSize: 'sm', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 'wider' })}>
            Multiperfis Financeiros
          </span>
        </div>

        <h1
          className={css({
            fontSize: { base: '2xl', md: '4xl' },
            fontWeight: '800',
            color: 'slate.900',
            letterSpacing: '-0.03em',
            margin: '0',
          })}
        >
          Quem está gerenciando as finanças?
        </h1>

        <p
          className={css({
            fontSize: { base: 'sm', md: 'base' },
            color: 'slate.500',
            marginTop: '2',
            marginBottom: { base: '8', md: '12' },
            maxWidth: '560px',
            marginX: 'auto',
          })}
        >
          Selecione o seu perfil para acessar suas contas, rendimentos e relatórios com sua identidade visual personalizada.
        </p>

        {/* Grade de Perfis */}
        <div
          className={css({
            display: 'grid',
            gridTemplateColumns: {
              base: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)',
              lg: 'repeat(auto-fit, minmax(220px, 1fr))',
            },
            gap: '6',
            justifyContent: 'center',
            alignItems: 'stretch',
          })}
        >
          {profiles.map((profile: Profile) => {
            const glowColor = hexToRgba(profile.primaryColor, 0.35);

            return (
              <div
                key={profile.id}
                role="button"
                tabIndex={0}
                onClick={() => selectProfile(profile)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    selectProfile(profile);
                  }
                }}
                className={css({
                  backgroundColor: 'white',
                  borderRadius: '2xl',
                  padding: '6',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  cursor: 'pointer',
                  borderWidth: '2px',
                  borderStyle: 'solid',
                  borderColor: 'slate.200',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  overflow: 'hidden',
                  _hover: {
                    transform: 'translateY(-6px)',
                    borderColor: profile.primaryColor,
                    boxShadow: `0 12px 24px -4px ${glowColor}, 0 4px 12px -2px rgba(0,0,0,0.05)`,
                  },
                })}
              >
                {/* Linha decorativa no topo */}
                <div
                  style={{
                    background: `linear-gradient(90deg, ${profile.primaryColor}, ${profile.secondaryColor})`,
                  }}
                  className={css({
                    position: 'absolute',
                    top: '0',
                    left: '0',
                    right: '0',
                    height: '4px',
                  })}
                />

                {/* Avatar Circular Gradiente */}
                <div
                  style={{
                    background: `linear-gradient(135deg, ${profile.primaryColor}, ${profile.secondaryColor})`,
                    boxShadow: `0 8px 16px -2px ${hexToRgba(profile.primaryColor, 0.4)}`,
                  }}
                  className={css({
                    width: '20',
                    height: '20',
                    borderRadius: 'full',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '2xl',
                    fontWeight: '800',
                    letterSpacing: 'wider',
                    marginBottom: '4',
                    marginTop: '2',
                    transition: 'transform 0.25s ease',
                    _groupHover: {
                      transform: 'scale(1.05)',
                    },
                  })}
                >
                  {profile.avatarInitials}
                </div>

                {/* Nome do Perfil */}
                <h3
                  className={css({
                    fontSize: 'lg',
                    fontWeight: 'bold',
                    color: 'slate.900',
                    margin: '0',
                  })}
                >
                  {profile.name}
                </h3>

                {/* Tag de entrada rápida */}
                <span
                  style={{
                    color: profile.primaryColor,
                    backgroundColor: hexToRgba(profile.primaryColor, 0.1),
                  }}
                  className={css({
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '1',
                    fontSize: 'xs',
                    fontWeight: 'semibold',
                    paddingX: '2.5',
                    paddingY: '1',
                    borderRadius: 'full',
                    marginTop: '3',
                  })}
                >
                  Acessar Painel <ArrowRight size={12} />
                </span>
              </div>
            );
          })}

          {/* Card / Botão de Criar Novo Perfil */}
          <div
            role="button"
            tabIndex={0}
            onClick={handleOpenModal}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleOpenModal();
              }
            }}
            className={css({
              backgroundColor: 'rgba(255, 255, 255, 0.7)',
              borderRadius: '2xl',
              padding: '6',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              cursor: 'pointer',
              borderWidth: '2px',
              borderStyle: 'dashed',
              borderColor: 'slate.300',
              transition: 'all 0.25s ease-in-out',
              minHeight: '200px',
              _hover: {
                backgroundColor: 'white',
                borderColor: 'brand.primary',
                transform: 'translateY(-4px)',
                boxShadow: '0 8px 16px -2px rgba(99, 102, 241, 0.15)',
              },
            })}
          >
            <div
              className={css({
                width: '14',
                height: '14',
                borderRadius: 'full',
                backgroundColor: 'slate.100',
                color: 'slate.600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '3',
                transition: 'all 0.2s ease',
              })}
            >
              <Plus size={26} />
            </div>

            <span
              className={css({
                fontSize: 'base',
                fontWeight: 'bold',
                color: 'slate.800',
              })}
            >
              Criar Novo Perfil
            </span>
            <span
              className={css({
                fontSize: 'xs',
                color: 'slate.400',
                marginTop: '1',
              })}
            >
              Adicione outro membro ou conta
            </span>
          </div>
        </div>
      </div>

      {/* Modal Rico de Criação de Perfil com Cores Customizadas e Preview em Tempo Real */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Criar Novo Perfil Financeiro"
        description="Defina o nome e escolha as cores personalizadas do seu painel."
      >
        <form onSubmit={handleCreateSubmit} className={css({ display: 'flex', flexDirection: 'column', gap: '5' })}>
          {formError && (
            <div
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
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '2',
              })}
            >
              {COLOR_PRESETS.map((preset) => {
                const isSelected = primaryColor === preset.primary && secondaryColor === preset.secondary;
                return (
                  <button
                    key={preset.name}
                    type="button"
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
                    <div
                      style={{
                        background: `linear-gradient(135deg, ${preset.primary}, ${preset.secondary})`,
                      }}
                      className={css({
                        width: '5',
                        height: '5',
                        borderRadius: 'full',
                        flexShrink: 0,
                      })}
                    />
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

          {/* Preview em Tempo Real */}
          <div
            className={css({
              borderRadius: 'xl',
              padding: '4',
              backgroundColor: 'slate.50',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: 'slate.200',
            })}
          >
            <div className={css({ display: 'flex', alignItems: 'center', gap: '1.5', fontSize: 'xs', fontWeight: 'bold', color: 'slate.600', mb: '3' })}>
              <Sparkles size={14} />
              <span>Preview em Tempo Real</span>
            </div>

            <div
              className={css({
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '4',
                backgroundColor: 'white',
                padding: '4',
                borderRadius: 'lg',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: 'slate.100',
              })}
            >
              {/* Avatar + Nome de Preview */}
              <div className={css({ display: 'flex', alignItems: 'center', gap: '3' })}>
                <div
                  style={{
                    background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                    boxShadow: `0 4px 10px -1px ${hexToRgba(primaryColor, 0.4)}`,
                  }}
                  className={css({
                    width: '12',
                    height: '12',
                    borderRadius: 'full',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: 'base',
                  })}
                >
                  {previewInitials}
                </div>
                <div>
                  <h4 className={css({ fontSize: 'sm', fontWeight: 'bold', color: 'slate.900', margin: '0' })}>
                    {name.trim() || 'Nome do Perfil'}
                  </h4>
                  <span
                    style={{ color: secondaryColor }}
                    className={css({ fontSize: 'xs', fontWeight: 'semibold' })}
                  >
                    Identidade Personalizada
                  </span>
                </div>
              </div>

              {/* Botão de Exemplo Dinâmico */}
              <button
                type="button"
                style={{
                  backgroundColor: primaryColor,
                  boxShadow: `0 2px 6px ${hexToRgba(primaryColor, 0.35)}`,
                }}
                className={css({
                  color: 'white',
                  fontWeight: 'semibold',
                  fontSize: 'xs',
                  paddingX: '3.5',
                  paddingY: '2',
                  borderRadius: 'md',
                  border: 'none',
                  cursor: 'default',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '1.5',
                })}
              >
                <Check size={14} />
                <span>Botão Exemplo</span>
              </button>
            </div>
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
              style={{
                backgroundColor: primaryColor,
              }}
            >
              {isSubmitting ? 'Criando...' : 'Criar Perfil'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
