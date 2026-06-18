import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/* ─── Duotone icon paths ─── */
const DUO: Record<string, string> = {
  dash: `<rect class="fill" x="3.5" y="5" width="17" height="14" rx="3"/><rect class="ln" x="3.5" y="5" width="17" height="14" rx="3"/><path class="ln" d="M6.5 12.5h1.8l1.4-3.4 2.2 6.6 1.4-3.2H17.5"/>`,
  inbox: `<path class="fill" d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v6A2.5 2.5 0 0 1 17.5 15H9.5L5.5 18v-3A2.5 2.5 0 0 1 4 12.5Z"/><path class="ln" d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v6A2.5 2.5 0 0 1 17.5 15H9.5L5.5 18v-3A2.5 2.5 0 0 1 4 12.5Z"/><circle fill="currentColor" cx="8.3" cy="9.3" r="1.05"/><circle fill="currentColor" cx="12" cy="9.3" r="1.05"/><circle fill="currentColor" cx="15.7" cy="9.3" r="1.05"/>`,
  leads: `<circle class="fill" cx="9.2" cy="8" r="3.4"/><path class="fill" d="M3.6 19v-1.1A4.8 4.8 0 0 1 8.4 13.1h1.6A4.8 4.8 0 0 1 14.8 17.9V19Z"/><circle class="ln" cx="9.2" cy="8" r="3.4"/><path class="ln" d="M3.6 19v-1.1A4.8 4.8 0 0 1 8.4 13.1h1.6A4.8 4.8 0 0 1 14.8 17.9V19"/><circle class="ln" cx="16.8" cy="8.6" r="2.5"/><path class="ln" d="M15.3 13.2h1.3a4.3 4.3 0 0 1 4.3 4.3V19h-3"/>`,
  clock: `<circle class="fill" cx="12" cy="12" r="2.7"/><path class="ln" d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path class="ln" d="M17.6 3.4v3.6h-3.6"/><circle class="ln" cx="12" cy="12" r="2.7"/>`,
  res: `<path class="fill" d="M12 6.4C10 5 7 5 4.5 6.2v11.6C7 16.6 10 16.6 12 18Z"/><path class="ln" d="M12 6.4C10 5 7 5 4.5 6.2v11.6C7 16.6 10 16.6 12 18c2-1.4 5-1.4 7.5-.2V6.2C17 5 14 5 12 6.4Z"/><path class="ln" d="M12 6.4V18"/>`,
  trophy: `<rect class="fill" x="3.5" y="13.5" width="5" height="6.5" rx="1.2"/><rect class="fill" x="9.5" y="9.5" width="5" height="10.5" rx="1.2"/><rect class="fill" x="15.5" y="15.5" width="5" height="4.5" rx="1.2"/><rect class="ln" x="3.5" y="13.5" width="5" height="6.5" rx="1.2"/><rect class="ln" x="9.5" y="9.5" width="5" height="10.5" rx="1.2"/><rect class="ln" x="15.5" y="15.5" width="5" height="4.5" rx="1.2"/><path fill="currentColor" d="M12 3l.85 1.75 1.9.27-1.38 1.32.33 1.9L12 7.6l-1.7.91.33-1.9L9.25 5.3l1.9-.55z"/>`,
  settings: `<circle class="fill" cx="12" cy="12" r="3.2"/><circle class="ln" cx="12" cy="12" r="3.2"/><path class="ln" d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/>`,
  megaphone: `<circle class="fill" cx="18" cy="12" r="2.6"/><circle class="ln" cx="5.5" cy="6.5" r="2.2"/><circle class="ln" cx="5.5" cy="17.5" r="2.2"/><circle class="ln" cx="18" cy="12" r="2.6"/><path class="ln" d="M7.6 7.2 15.4 11M7.6 16.8 15.4 13"/>`,
};

function DuoIcon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`sf-duo shrink-0 ${className}`}
      style={{ width: 18, height: 18, overflow: 'visible' }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: `<g>${DUO[name] ?? ''}</g>` }}
    />
  );
}

function LogoMark() {
  return (
    <svg viewBox="0 0 48 48" fill="none" style={{ width: 17, height: 17, color: '#fff' }} aria-hidden="true">
      <path
        d="M32.5 13.5C32.5 9.5 16 9 16 16.8C16 22.6 32 22.9 32 30C32 37.8 16 37.8 16 33.4"
        stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"
      />
      <circle cx="32.5" cy="13.5" r="4" fill="currentColor" />
      <circle cx="24"   cy="23.6" r="4" fill="currentColor" />
      <circle cx="16"   cy="33.4" r="4.6" fill="currentColor" />
    </svg>
  );
}

type NavDef = { title: string; url: string; icon: string; roles: string[]; badge?: string };

const navMain: NavDef[] = [
  { title: 'Dashboard',  url: '/dashboard',  icon: 'dash',  roles: ['user', 'admin'] },
  { title: 'Inbox',      url: '/inbox',       icon: 'inbox', roles: ['user', 'admin'] },
  { title: 'Leads',      url: '/leads',       icon: 'leads', roles: ['user', 'admin'] },
  { title: 'Follow-ups', url: '/follow-ups',  icon: 'clock',      roles: ['user', 'admin'] },
  { title: 'Campagnes',  url: '/campaigns',   icon: 'megaphone',  roles: ['user', 'admin'] },
];

const navResources: NavDef[] = [
  { title: 'Ressources',  url: '/ressources',  icon: 'res',    roles: ['user', 'coach', 'admin'] },
  { title: 'Leaderboard', url: '/leaderboard', icon: 'trophy', roles: ['user', 'coach', 'admin'] },
];

const navSettings: NavDef[] = [
  { title: 'Paramètres', url: '/settings', icon: 'settings', roles: ['user', 'coach', 'admin'] },
];

function NavItem({ item, collapsed }: { item: NavDef; collapsed: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = location.pathname === item.url || location.pathname.startsWith(item.url + '/');

  return (
    <button
      type="button"
      onClick={() => navigate(item.url)}
      title={collapsed ? item.title : undefined}
      className={[
        'relative flex w-full items-center gap-[11px] rounded-[9px] px-[11px] py-[9px]',
        'text-[13px] font-medium transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5851E8]/40',
        isActive
          ? 'bg-[#EDECFD] font-semibold'
          : 'hover:bg-[#F5F5F7]',
      ].join(' ')}
      style={{ color: isActive ? '#4A43DA' : '#5C606A' }}
    >
      {isActive && (
        <span
          className="pointer-events-none absolute top-[7px] bottom-[7px] w-[3px] rounded-r-[3px]"
          style={{ left: -12, background: '#5851E8' }}
        />
      )}

      <DuoIcon name={item.icon} className={isActive ? 'text-[#5851E8]' : 'text-[#9A9EA8]'} />

      {!collapsed && <span className="truncate">{item.title}</span>}

      {!collapsed && item.badge && (
        <span
          className="ml-auto rounded-full px-[7px] py-[1px] text-[10.5px] font-bold leading-none"
          style={
            isActive
              ? { background: '#5851E8', color: '#fff' }
              : { border: '1px solid #EAEAEE', color: '#9A9EA8' }
          }
        >
          {item.badge}
        </span>
      )}
    </button>
  );
}

function NavGroup({ label, items, collapsed }: { label: string; items: NavDef[]; collapsed: boolean }) {
  const { activeRole } = useAuth();
  const visible = items.filter((i) => i.roles.includes(activeRole) || activeRole === 'admin');
  if (!visible.length) return null;

  return (
    <div>
      {label && !collapsed && (
        <p className="px-2 pb-[9px] text-[10px] font-bold uppercase tracking-[.12em]" style={{ color: '#AEB3BA' }}>
          {label}
        </p>
      )}
      <div className="flex flex-col gap-[2px]">
        {visible.map((item) => <NavItem key={item.url} item={item} collapsed={collapsed} />)}
      </div>
    </div>
  );
}

function FreePlanCard({ collapsed }: { collapsed: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('memberships')
      .select('plan')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => setPlan(data?.plan ?? 'free'));
  }, [user?.id]);

  if (!plan || plan !== 'free' || collapsed) return null;

  return (
    <div className="rounded-[12px] p-[12px]" style={{ background: '#EDECFD', border: '1px solid #D9D7FB' }}>
      <p className="text-[11.5px] font-bold" style={{ color: '#4A43DA' }}>Plan Free</p>
      <p className="mt-[3px] mb-[9px] text-[10.5px] leading-snug" style={{ color: '#6E69B5' }}>
        3 leads/mois · 1 compte LinkedIn
      </p>
      <button
        type="button"
        onClick={() => navigate('/settings?tab=facturation')}
        className="block w-full rounded-[8px] py-[7px] text-center text-[11.5px] font-bold text-white transition-opacity hover:opacity-90"
        style={{ background: '#5851E8' }}
      >
        Passer en Pro →
      </button>
    </div>
  );
}

function UserRow({ collapsed }: { collapsed: boolean }) {
  const { user, profile } = useAuth();
  if (!user) return null;

  const name = profile?.full_name || user.email || '';
  const email = user.email || '';
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || email.slice(0, 2).toUpperCase();

  return (
    <div
      className="flex items-center gap-[9px] px-[6px] py-[9px]"
      style={{ borderTop: '1px solid #F0F1F3' }}
    >
      <span
        className="grid shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
        style={{ width: 30, height: 30, background: '#5851E8' }}
      >
        {initials}
      </span>
      {!collapsed && (
        <div className="min-w-0">
          <p className="truncate text-[12.5px] font-bold" style={{ color: '#15161A' }}>{name}</p>
          <p className="truncate text-[10.5px]" style={{ color: '#9A9EA8' }}>{email}</p>
        </div>
      )}
    </div>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  return (
    <>
      <style>{`
        .sf-duo .fill { fill: currentColor; fill-opacity: .18; stroke: none; }
        .sf-duo .ln   { fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
        @media (prefers-reduced-motion: reduce) { * { transition-duration: .01ms !important; } }
      `}</style>

      <Sidebar
        collapsible="none"
        style={{ '--sidebar-width': '232px' } as React.CSSProperties}
      >
        <SidebarHeader style={{ padding: '16px 12px 0' }}>
          <div className="flex items-center gap-[10px] px-[6px] py-[4px]">
            <span
              className="grid shrink-0 place-items-center rounded-[8px]"
              style={{ width: 28, height: 28, background: '#5851E8', boxShadow: '0 2px 10px rgba(88,81,232,.30)' }}
            >
              <LogoMark />
            </span>
            {!collapsed && (
              <span className="text-[16.5px] font-bold tracking-[-0.01em]" style={{ color: '#15161A' }}>
                SetterFlow<span style={{ color: '#5851E8' }}>.</span>
              </span>
            )}
          </div>
          <div className="mx-[6px] mt-[14px] h-px" style={{ background: '#F0F1F3' }} />
        </SidebarHeader>

        <SidebarContent className="flex flex-col gap-[14px]" style={{ padding: '14px 12px 0', overflow: 'visible' }}>
          <NavGroup label="Navigation"          items={navMain}      collapsed={collapsed} />
          <NavGroup label="Ressources & équipe" items={navResources} collapsed={collapsed} />
        </SidebarContent>

        <SidebarFooter className="flex flex-col gap-[11px]" style={{ padding: '10px 12px 16px' }}>
          <FreePlanCard collapsed={collapsed} />
          <NavGroup label="" items={navSettings} collapsed={collapsed} />
          <UserRow collapsed={collapsed} />
        </SidebarFooter>
      </Sidebar>
    </>
  );
}
