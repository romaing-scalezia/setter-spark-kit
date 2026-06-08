import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function AppLayout({ children }: { children: ReactNode }) {
  const { profile, activeRole, signOut } = useAuth();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b bg-card px-4 shrink-0">
            <SidebarTrigger className="ml-0" />
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {profile?.full_name || profile?.email}
              </span>
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary capitalize">
                {activeRole}
              </span>
              <Button variant="ghost" size="icon" onClick={signOut} className="h-8 w-8" data-testid="logout-button">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
