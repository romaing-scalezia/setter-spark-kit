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

/* ─── Duotone icon paths (from SetterFlow Sidebar.html reference) ─── */
const DUO: Record<string, string> = {
  dash: `<path class="fill" d="M4 4h6v6H4zM14 14h6v6h-6z"/><path class="ln" d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>`,
  inbox: `<path class="fill" d="M3 13h5l2 3h4l2-3h5v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path class="ln" d="M3 13h5l2 3h4l2-3h5M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/>`,
  leads: `<circle class="fill" cx="9" cy="8" r="3.4"/><path class="ln" d="M15 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle class="ln" cx="9" cy="8" r="3.4"/><path class="ln" d="M16 3.6a3.4 3.4 0 0 1 0 6.6M22 21v-2a4 4 0 0 0-3-3.85"/>`,
  clock: `<circle class="fill" cx="12" cy="12.5" r="8"/><circle class="ln" cx="12" cy="12.5" r="8"/><path class="ln" d="M12 8v4.5l3 1.8"/>`,
  res: `<path class="fill" d="m12 3 8 4.5-8 4.5-8-4.5z"/><path class="ln" d="m12 3 8 4.5-8 4.5-8-4.5z"/><path class="ln" d="m4 12 8 4.5 8-4.5"/>`,
  trophy: `<path class="fill" d="M6 5h12v4a6 6 0 0 1-12 0z"/><path class="ln" d="M6 5h12v4a6 6 0 0 1-12 0zM6 5H4v2a3 3 0 0 0 2 2.85M18 5h2v2a3 3 0 0 1-2 2.85M9 20h6M12 15.5V20"/>`,
  settings: `<circle class="fill" cx="12" cy="12" r="3.2"/><circle class="ln" cx="12" cy="12" r="3.2"/><path class="ln" d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/>`,
  megaphone: `<path class="fill" d="M11 5 6 9H2v6h4l5 4z"/><path class="ln" d="M11 5 6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14"/>`,
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
        'text-[13px] font-medium transition-colors duration-[180ms]',
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
        collapsible="icon"
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
