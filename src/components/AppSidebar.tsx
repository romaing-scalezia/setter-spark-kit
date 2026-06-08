import {
  LayoutDashboard,
  MessageSquare,
  Clock,
  Users,
  Shield,
  BookOpen,
  Settings,
  Trophy,
  Target,
  CreditCard,
  BarChart3,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar';

const navItems = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard, roles: ['user', 'admin'] },
  { title: 'Supervision', url: '/coach', icon: Users, roles: ['coach'] },
  { title: 'CRM Leads', url: '/leads', icon: MessageSquare, roles: ['user', 'admin'] },
  { title: 'Follow-ups', url: '/follow-ups', icon: Clock, roles: ['user', 'admin'] },
  { title: 'Leaderboard', url: '/leaderboard', icon: Trophy, roles: ['user', 'coach', 'admin'] },
  { title: 'Bibliothèque', url: '/library', icon: BookOpen, roles: ['user', 'coach', 'admin'] },
  { title: 'Personas', url: '/personas', icon: Target, roles: ['user', 'coach', 'admin'] },
  { title: 'Admin', url: '/admin', icon: Shield, roles: ['admin'] },
  { title: 'Analytics', url: '/admin/analytics', icon: BarChart3, roles: ['admin'] },
  { title: 'Assignations', url: '/admin/assignments', icon: Users, roles: ['admin'] },
  { title: 'Équipes', url: '/admin/teams', icon: Users, roles: ['admin'] },
  { title: 'Workspace', url: '/workspace', icon: Users, roles: ['user', 'coach', 'admin'] },
  { title: 'Abonnement', url: '/billing', icon: CreditCard, roles: ['user', 'coach', 'admin'] },
  { title: 'Paramètres', url: '/settings', icon: Settings, roles: ['user', 'coach', 'admin'] },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { activeRole } = useAuth();
  const location = useLocation();

  const visibleItems = navItems.filter((item) =>
    item.roles.includes(activeRole) || (activeRole === 'admin')
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
            <MessageSquare className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="text-lg font-bold text-sidebar-foreground">SetterFlow</span>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location.pathname.startsWith(item.url)} data-testid={`nav-${item.url.replace(/\//g, '-').replace(/^-/, '')}`}>
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
      </SidebarContent>
    </Sidebar>
  );
}
