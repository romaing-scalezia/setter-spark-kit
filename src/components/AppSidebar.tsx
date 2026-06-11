import { FreePlanCard } from '@/components/FreePlanCard';
import {
  LayoutDashboard,
  Clock,
  Users,
  Shield,
  Settings,
  Trophy,
  BarChart3,
  Inbox as InboxIcon,
  Library,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar';

const navMain = [
  { title: 'Dashboard',  url: '/dashboard',  icon: LayoutDashboard, roles: ['user', 'admin'] },
  { title: 'Inbox',      url: '/inbox',       icon: InboxIcon,       roles: ['user', 'admin'] },
  { title: 'Leads',      url: '/leads',       icon: Users,           roles: ['user', 'admin'] },
  { title: 'Follow-ups', url: '/follow-ups',  icon: Clock,           roles: ['user', 'admin'] },
];

const navResources = [
  { title: 'Ressources',  url: '/ressources',  icon: Library, roles: ['user', 'coach', 'admin'] },
  { title: 'Leaderboard', url: '/leaderboard', icon: Trophy,  roles: ['user', 'coach', 'admin'] },
];

const navAdmin = [
  { title: 'Supervision',  url: '/coach',             icon: Users,     roles: ['coach'] },
  { title: 'Admin',        url: '/admin',             icon: Shield,    roles: ['admin'] },
  { title: 'Analytics',    url: '/admin/analytics',   icon: BarChart3, roles: ['admin'] },
  { title: 'Assignations', url: '/admin/assignments', icon: Users,     roles: ['admin'] },
  { title: 'Équipes',      url: '/admin/teams',       icon: Users,     roles: ['admin'] },
];

const navSettings = [
  { title: 'Paramètres', url: '/settings', icon: Settings, roles: ['user', 'coach', 'admin'] },
];

const LogoMark = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M32.5 13.5C32.5 9.5 16 9 16 16.8C16 22.6 32 22.9 32 30C32 37.8 16 37.8 16 33.4" strokeWidth="3.4" />
    </g>
    <circle cx="32.5" cy="13.5" r="4" fill="currentColor" />
    <circle cx="24"   cy="23.6" r="4" fill="currentColor" />
    <circle cx="16"   cy="33.4" r="4.6" fill="currentColor" />
  </svg>
);

type NavItem = { title: string; url: string; icon: React.ElementType; roles: string[] };

function NavGroup({ items, label }: { items: NavItem[]; label: string }) {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { activeRole } = useAuth();
  const location = useLocation();
  const visible = items.filter((item) => item.roles.includes(activeRole) || activeRole === 'admin');
  if (!visible.length) return null;
  return (
    <SidebarGroup>
      {label && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {visible.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                isActive={location.pathname.startsWith(item.url)}
                data-testid={`nav-${item.url.replace(/\//g, '-').replace(/^-/, '')}`}
              >
                <NavLink
                  to={item.url}
                  end={item.url === '/dashboard'}
                  className="hover:bg-sidebar-accent"
                  activeClassName="bg-sidebar-accent text-primary font-medium"
                >
                  <item.icon className="h-4 w-4" />
                  {!collapsed && <span>{item.title}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center text-primary">
            <LogoMark />
          </div>
          {!collapsed && (
            <span className="text-lg font-semibold tracking-tight text-sidebar-foreground">
              Setter<span className="text-primary">Flow.</span>
            </span>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavGroup items={navMain}      label="Navigation" />
        <NavGroup items={navResources} label="Ressources & équipe" />
        <NavGroup items={navAdmin}     label="Administration" />
      </SidebarContent>
      <SidebarFooter className="p-2">
        <FreePlanCard />
        <NavGroup items={navSettings} label="" />
      </SidebarFooter>
    </Sidebar>
  );
}
