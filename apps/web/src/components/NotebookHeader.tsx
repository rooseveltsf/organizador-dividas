import { useContext, type ReactNode } from 'react';
import { BookOpen, CircleHelp } from 'lucide-react';
import { useProfiles } from '../contexts';
import { ProfileSecurityActions } from './ProfilePin';
import { Select } from './ui';
import { GuideHelpContext } from '../tutorial/GuideContext';

export function NotebookHeader({ children }: { children?: ReactNode }) {
  const openHelp = useContext(GuideHelpContext);
  return (
    <header className="masthead">
      <div className="wordmark"><BookOpen aria-hidden="true" size={24} strokeWidth={1.6} />Caderno de Dívidas</div>
      <div className="masthead-tools">{children}
        {openHelp && <button type="button" className="guide-help" onClick={event => openHelp(event.currentTarget)}>
          <CircleHelp size={16} aria-hidden="true" /> Ajuda e tutorial
        </button>}
      </div>
    </header>
  );
}

export function NotebookProfileHeader() {
  const { activeProfile, profiles, selectProfile } = useProfiles();
  if (!activeProfile) return null;

  return (
    <NotebookHeader>
      <span className="profile-monogram mini" aria-hidden="true">{activeProfile.avatarInitials}</span>
      <div className="commitments-profile">
        <Select aria-label="Perfil" size="lg" value={activeProfile.id} onChange={event => {
          const profile = profiles.find(item => item.id === event.target.value);
          if (profile) selectProfile(profile);
        }}>
          {profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
        </Select>
      </div>
      <ProfileSecurityActions />
    </NotebookHeader>
  );
}
