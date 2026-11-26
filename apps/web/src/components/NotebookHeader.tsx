import type { ReactNode } from 'react';
import { BookOpen } from 'lucide-react';
import { useProfiles } from '../contexts';
import { ProfileSecurityActions } from './ProfilePin';
import { Select } from './ui';

export function NotebookHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="masthead">
      <div className="wordmark"><BookOpen aria-hidden="true" size={24} strokeWidth={1.6} />Organizador de Dívidas</div>
      <div className="masthead-tools">{children}</div>
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
