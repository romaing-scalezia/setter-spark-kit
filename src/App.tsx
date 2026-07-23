import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AuthGuard } from "@/components/AuthGuard";
import { usePlan } from "@/hooks/usePlan";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AuthCallback from "./pages/AuthCallback";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import FollowUps from "./pages/FollowUps";
import Inbox from "./pages/Inbox";
import CoachPage, { CoachStudentPage } from "./pages/Coach";
import Library from "./pages/Library";
import PersonasPage from "./pages/Personas";
import Ressources from "./pages/Ressources";
import AdminPage from "./pages/Admin";
import AdminAnalytics from "./pages/AdminAnalytics";
import AdminAssignments from "./pages/AdminAssignments";
import AdminTeams from "./pages/AdminTeams";
import SettingsPage from "./pages/Settings";
import WorkspacePage from "./pages/Workspace";
import LeaderboardPage from "./pages/Leaderboard";
import BillingPage from "./pages/Billing";
import Pricing from "./pages/Pricing";
import Campaigns from "./pages/Campaigns";
import CampaignNew from "./pages/CampaignNew";
import CampaignDetail from "./pages/CampaignDetail";
import Onboarding from "./pages/Onboarding";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function PlanGuard({ children }: { children: React.ReactNode }) {
  const { hasStarterAccess } = usePlan();
  if (!hasStarterAccess) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function TrialGuard({ children }: { children: React.ReactNode }) {
  const { canAccess } = usePlan();
  const { loading } = useAuth();
  if (loading) return null;
  if (!canAccess) return <Navigate to="/pricing" replace />;
  return <>{children}</>;
}

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  // Only redirect to onboarding if we have a profile AND it explicitly says not completed.
  // Safe fallback: missing profile or null flag = treat as onboarded (legacy users).
  if (profile && profile.onboarding_completed === false) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/onboarding" element={<AuthGuard><Onboarding /></AuthGuard>} />
            <Route path="/pricing" element={<AuthGuard><Pricing /></AuthGuard>} />

            <Route path="/dashboard" element={<OnboardingGuard><AuthGuard><TrialGuard><Dashboard /></TrialGuard></AuthGuard></OnboardingGuard>} />
            <Route path="/leads" element={<OnboardingGuard><AuthGuard><TrialGuard><Leads /></TrialGuard></AuthGuard></OnboardingGuard>} />
            <Route path="/follow-ups" element={<OnboardingGuard><AuthGuard><TrialGuard><FollowUps /></TrialGuard></AuthGuard></OnboardingGuard>} />
            <Route path="/campaigns" element={<OnboardingGuard><AuthGuard><TrialGuard><Campaigns /></TrialGuard></AuthGuard></OnboardingGuard>} />
            <Route path="/campaigns/new" element={<OnboardingGuard><AuthGuard><TrialGuard><CampaignNew /></TrialGuard></AuthGuard></OnboardingGuard>} />
            <Route path="/campaigns/:id/edit" element={<OnboardingGuard><AuthGuard><TrialGuard><CampaignNew /></TrialGuard></AuthGuard></OnboardingGuard>} />
            <Route path="/campaigns/:id" element={<OnboardingGuard><AuthGuard><TrialGuard><CampaignDetail /></TrialGuard></AuthGuard></OnboardingGuard>} />
            <Route path="/inbox" element={<OnboardingGuard><AuthGuard><TrialGuard><Inbox /></TrialGuard></AuthGuard></OnboardingGuard>} />
            <Route path="/coach" element={<OnboardingGuard><AuthGuard requiredRole="coach"><CoachPage /></AuthGuard></OnboardingGuard>} />
            <Route path="/coach/students/:id" element={<OnboardingGuard><AuthGuard requiredRole="coach"><CoachStudentPage /></AuthGuard></OnboardingGuard>} />
            <Route path="/leaderboard" element={<OnboardingGuard><AuthGuard><TrialGuard><PlanGuard><LeaderboardPage /></PlanGuard></TrialGuard></AuthGuard></OnboardingGuard>} />
            <Route path="/ressources" element={<OnboardingGuard><AuthGuard><TrialGuard><Ressources /></TrialGuard></AuthGuard></OnboardingGuard>} />
            <Route path="/library" element={<OnboardingGuard><AuthGuard><TrialGuard><Library /></TrialGuard></AuthGuard></OnboardingGuard>} />
            <Route path="/personas" element={<OnboardingGuard><AuthGuard><TrialGuard><PersonasPage /></TrialGuard></AuthGuard></OnboardingGuard>} />
            <Route path="/admin" element={<OnboardingGuard><AuthGuard requiredRole="admin"><AdminPage /></AuthGuard></OnboardingGuard>} />
            <Route path="/admin/analytics" element={<OnboardingGuard><AuthGuard requiredRole="admin"><AdminAnalytics /></AuthGuard></OnboardingGuard>} />
            <Route path="/admin/assignments" element={<OnboardingGuard><AuthGuard requiredRole="admin"><AdminAssignments /></AuthGuard></OnboardingGuard>} />
            <Route path="/admin/teams" element={<OnboardingGuard><AuthGuard requiredRole="admin"><AdminTeams /></AuthGuard></OnboardingGuard>} />
            <Route path="/settings" element={<OnboardingGuard><AuthGuard><TrialGuard><SettingsPage /></TrialGuard></AuthGuard></OnboardingGuard>} />
            <Route path="/workspace" element={<Navigate to="/settings?tab=workspace" replace />} />
            <Route path="/billing" element={<Navigate to="/settings?tab=facturation" replace />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
