import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, ArrowRight, Upload, Check, Loader2, Info } from 'lucide-react';

/* ─── Types ─── */
type ScenarioType = 'A' | 'B' | 'C';
type ActionType = 'visit' | 'invite' | 'message';

interface StepConfig {
  step_order: number;
  action_type: ActionType;
  label: string;
  message_content: string;
  delay_days: number;
  editable: boolean;
}

interface CsvLead {
  linkedin_url: string;
  first_name: string;
  last_name: string;
  company_name: string;
}

/* ─── Scenario builder ─── */
function buildSteps(scenario: ScenarioType): StepConfig[] {
  const steps: StepConfig[] = [
    { step_order: 1, action_type: 'visit',   label: 'Visite du profil',    message_content: '', delay_days: 0, editable: false },
    { step_order: 2, action_type: 'invite',  label: 'Invitation LinkedIn', message_content: '', delay_days: 1, editable: true  },
    { step_order: 3, action_type: 'message', label: 'Message 1',           message_content: '', delay_days: 3, editable: true  },
  ];
  if (scenario === 'B' || scenario === 'C') {
    steps.push({ step_order: 4, action_type: 'message', label: 'Message 2', message_content: '', delay_days: 5, editable: true });
  }
  if (scenario === 'C') {
    steps.push({ step_order: 5, action_type: 'message', label: 'Message 3', message_content: '', delay_days: 7, editable: true });
  }
  return steps;
}

/* ─── CSV parser (handles quoted fields with commas) ─── */
function splitCsvLine(line: string): string[] {
  return line
    .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    .map((v) => v.trim().replace(/^"|"$/g, ''));
}

function parseCSV(text: string): CsvLead[] {
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) =>
    h.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  );
  return lines
    .slice(1)
    .map((line) => {
      const values = splitCsvLine(line);
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = values[i] ?? ''; });
      return {
        linkedin_url:  obj.linkedin_url || obj.url || obj.linkedin || '',
        first_name:    obj.first_name   || obj.firstname || obj.prenom || '',
        last_name:     obj.last_name    || obj.lastname  || obj.nom    || '',
        company_name:  obj.company_name || obj.company   || obj.entreprise || '',
      };
    })
    .filter((l) => l.linkedin_url.length > 0);
}

/* ─── Scenario visuals (right panel) ─── */
const SCENARIO_SVG: Record<ScenarioType, string> = {
  A: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 820 650" fill="none" font-family="Satoshi, sans-serif" style="display:block;width:100%;height:100%"
<defs>
  <radialGradient id="bg" cx="26%" cy="2%" r="130%"><stop offset="0" stop-color="#7B74F2"></stop><stop offset="0.5" stop-color="#5851E8"></stop><stop offset="1" stop-color="#453ED6"></stop></radialGradient>
  <pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.3" fill="#fff" fill-opacity="0.18"></circle></pattern>
  <clipPath id="clip"><rect width="820" height="650" rx="22"></rect></clipPath>
  <filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="4" stdDeviation="7" flood-color="#12111F" flood-opacity="0.18"></feDropShadow></filter>
</defs>
<g clip-path="url(#clip)">
  <rect width="820" height="650" fill="url(#bg)"></rect>
  <rect width="820" height="650" fill="url(#dots)"></rect>
  <g transform="translate(-49.20 39.96) scale(1.1200)"><rect x="260" y="0" width="300" height="50" rx="12" fill="#fff" filter="url(#sh)"></rect><circle cx="280" cy="25" r="4" fill="#5851E8"></circle><text x="294" y="30" font-size="13.5" font-weight="600" fill="#5851E8" text-anchor="start" letter-spacing="-0.01em">Début de séquence</text><g fill="#9A9EA8"><circle cx="520" cy="25" r="1.6"></circle><circle cx="527" cy="25" r="1.6"></circle><circle cx="534" cy="25" r="1.6"></circle></g><rect x="409" y="50" width="2" height="34" fill="#ffffff" fill-opacity="0.45"></rect><circle cx="410" cy="67" r="11" fill="#fff" stroke="#ffffff" stroke-opacity="0.8" stroke-width="1.5"></circle><text x="410" y="72.5" font-size="17" font-weight="500" fill="#5851E8" text-anchor="middle" letter-spacing="-0.01em">+</text><rect x="260" y="84" width="300" height="106" rx="14" fill="#fff" filter="url(#sh)"></rect><path d="M260 98 a14 14 0 0 1 14-14 h272 a14 14 0 0 1 14 14 v22 h-300 Z" fill="#F5F5F7"></path><line x1="260" y1="120" x2="560" y2="120" stroke="#F0F1F3" stroke-width="1"></line><g transform="translate(271 94.5) scale(0.625)" fill="none" stroke="#9A9EA8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"></circle><path d="M12 7.5v4.7l3.2 1.9"></path></g><text x="292" y="106" font-size="12" font-weight="600" fill="#5C606A" text-anchor="start" letter-spacing="-0.01em">Envoyer <tspan fill="#5851E8" font-weight="700">immédiatement</tspan></text><g transform="translate(534 95) scale(0.5833333333333334)" fill="none" stroke="#9A9EA8" stroke-width="1.8" stroke-linejoin="round"><path d="M4 20l4-1L19 8a2 2 0 0 0-3-3L5 16l-1 4Z"></path></g><rect x="274" y="134" width="42" height="42" rx="11" fill="#F4F3FE" stroke="#D9D7FB" stroke-width="1"></rect><g transform="translate(283.5 143.5) scale(0.9583333333333334)"><g fill="#5851E8" fill-opacity="0.16"><path d="M2.6 12C4.6 7.8 8 5.6 12 5.6S19.4 7.8 21.4 12C19.4 16.2 16 18.4 12 18.4S4.6 16.2 2.6 12Z"></path></g><g fill="none" stroke="#5851E8" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2.6 12C4.6 7.8 8 5.6 12 5.6S19.4 7.8 21.4 12C19.4 16.2 16 18.4 12 18.4S4.6 16.2 2.6 12Z"></path><circle cx="12" cy="12" r="3.1"></circle></g></g><rect x="304" y="164" width="17" height="17" rx="5" fill="#0A66C2" stroke="#fff" stroke-width="1.5"></rect><text x="312.5" y="175.5" font-size="9" font-weight="800" fill="#fff" text-anchor="middle" letter-spacing="-0.01em">in</text><text x="330" y="148" font-size="13.5" font-weight="700" fill="#15161A" text-anchor="start" letter-spacing="-0.01em">Visiter le profil</text><text x="330" y="165" font-size="11.5" font-weight="400" fill="#9A9EA8" text-anchor="start" letter-spacing="-0.01em">Consulter le profil du lead</text><g fill="#9A9EA8"><circle cx="520" cy="142" r="1.6"></circle><circle cx="527" cy="142" r="1.6"></circle><circle cx="534" cy="142" r="1.6"></circle></g><rect x="409" y="190" width="2" height="34" fill="#ffffff" fill-opacity="0.45"></rect><circle cx="410" cy="207" r="11" fill="#fff" stroke="#ffffff" stroke-opacity="0.8" stroke-width="1.5"></circle><text x="410" y="212.5" font-size="17" font-weight="500" fill="#5851E8" text-anchor="middle" letter-spacing="-0.01em">+</text><rect x="260" y="224" width="300" height="106" rx="14" fill="#fff" filter="url(#sh)"></rect><path d="M260 238 a14 14 0 0 1 14-14 h272 a14 14 0 0 1 14 14 v22 h-300 Z" fill="#F5F5F7"></path><line x1="260" y1="260" x2="560" y2="260" stroke="#F0F1F3" stroke-width="1"></line><g transform="translate(271 234.5) scale(0.625)" fill="none" stroke="#9A9EA8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"></circle><path d="M12 7.5v4.7l3.2 1.9"></path></g><text x="292" y="246" font-size="12" font-weight="600" fill="#5C606A" text-anchor="start" letter-spacing="-0.01em">Délai de <tspan fill="#5851E8" font-weight="700">X jours</tspan></text><g transform="translate(534 235) scale(0.5833333333333334)" fill="none" stroke="#9A9EA8" stroke-width="1.8" stroke-linejoin="round"><path d="M4 20l4-1L19 8a2 2 0 0 0-3-3L5 16l-1 4Z"></path></g><rect x="274" y="274" width="42" height="42" rx="11" fill="#F4F3FE" stroke="#D9D7FB" stroke-width="1"></rect><g transform="translate(283.5 283.5) scale(0.9583333333333334)"><g fill="#5851E8" fill-opacity="0.16"><circle cx="9.2" cy="8" r="3.4"></circle><path d="M3.4 19v-1A4.9 4.9 0 0 1 8.3 13.1h1.8A4.9 4.9 0 0 1 15 18v1Z"></path></g><g fill="none" stroke="#5851E8" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="9.2" cy="8" r="3.4"></circle><path d="M3.4 19v-1A4.9 4.9 0 0 1 8.3 13.1h1.8A4.9 4.9 0 0 1 15 18v1"></path><path d="M18.5 7.5v5M16 10h5"></path></g></g><rect x="304" y="304" width="17" height="17" rx="5" fill="#0A66C2" stroke="#fff" stroke-width="1.5"></rect><text x="312.5" y="315.5" font-size="9" font-weight="800" fill="#fff" text-anchor="middle" letter-spacing="-0.01em">in</text><text x="330" y="288" font-size="13.5" font-weight="700" fill="#15161A" text-anchor="start" letter-spacing="-0.01em">Invitation</text><text x="330" y="305" font-size="11.5" font-weight="400" fill="#9A9EA8" text-anchor="start" letter-spacing="-0.01em">Envoyer une demande de connexion</text><g fill="#9A9EA8"><circle cx="520" cy="282" r="1.6"></circle><circle cx="527" cy="282" r="1.6"></circle><circle cx="534" cy="282" r="1.6"></circle></g><rect x="409" y="330" width="2" height="34" fill="#ffffff" fill-opacity="0.45"></rect><circle cx="410" cy="347" r="11" fill="#fff" stroke="#ffffff" stroke-opacity="0.8" stroke-width="1.5"></circle><text x="410" y="352.5" font-size="17" font-weight="500" fill="#5851E8" text-anchor="middle" letter-spacing="-0.01em">+</text><rect x="260" y="364" width="300" height="106" rx="14" fill="#fff" filter="url(#sh)"></rect><rect x="258.5" y="362.5" width="303" height="109" rx="15.5" fill="none" stroke="#5851E8" stroke-width="1.5"></rect><rect x="256" y="360" width="308" height="114" rx="18" fill="none" stroke="#5851E8" stroke-opacity="0.14" stroke-width="3"></rect><path d="M260 378 a14 14 0 0 1 14-14 h272 a14 14 0 0 1 14 14 v22 h-300 Z" fill="#F5F5F7"></path><line x1="260" y1="400" x2="560" y2="400" stroke="#F0F1F3" stroke-width="1"></line><g transform="translate(271 374.5) scale(0.625)" fill="none" stroke="#9A9EA8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"></circle><path d="M12 7.5v4.7l3.2 1.9"></path></g><text x="292" y="386" font-size="12" font-weight="600" fill="#5C606A" text-anchor="start" letter-spacing="-0.01em">Délai de <tspan fill="#5851E8" font-weight="700">X jours</tspan></text><g transform="translate(534 375) scale(0.5833333333333334)" fill="none" stroke="#9A9EA8" stroke-width="1.8" stroke-linejoin="round"><path d="M4 20l4-1L19 8a2 2 0 0 0-3-3L5 16l-1 4Z"></path></g><rect x="274" y="414" width="42" height="42" rx="11" fill="#F4F3FE" stroke="#D9D7FB" stroke-width="1"></rect><g transform="translate(283.5 423.5) scale(0.9583333333333334)"><g fill="#5851E8" fill-opacity="0.16"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v6A2.5 2.5 0 0 1 17.5 15H9.5L5.5 18v-3A2.5 2.5 0 0 1 4 12.5Z"></path></g><g fill="none" stroke="#5851E8" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v6A2.5 2.5 0 0 1 17.5 15H9.5L5.5 18v-3A2.5 2.5 0 0 1 4 12.5Z"></path></g><g fill="#5851E8"><circle cx="8.3" cy="9.3" r="1.05"></circle><circle cx="12" cy="9.3" r="1.05"></circle><circle cx="15.7" cy="9.3" r="1.05"></circle></g></g><rect x="304" y="444" width="17" height="17" rx="5" fill="#0A66C2" stroke="#fff" stroke-width="1.5"></rect><text x="312.5" y="455.5" font-size="9" font-weight="800" fill="#fff" text-anchor="middle" letter-spacing="-0.01em">in</text><text x="330" y="428" font-size="13.5" font-weight="700" fill="#15161A" text-anchor="start" letter-spacing="-0.01em">Message</text><text x="330" y="445" font-size="11.5" font-weight="400" fill="#9A9EA8" text-anchor="start" letter-spacing="-0.01em">Envoyer un message</text><g fill="#9A9EA8"><circle cx="520" cy="422" r="1.6"></circle><circle cx="527" cy="422" r="1.6"></circle><circle cx="534" cy="422" r="1.6"></circle></g><rect x="409" y="470" width="2" height="28" fill="#ffffff" fill-opacity="0.45"></rect><circle cx="410" cy="498" r="11" fill="#fff" stroke="#ffffff" stroke-opacity="0.8" stroke-width="1.5"></circle><text x="410" y="503.5" font-size="17" font-weight="500" fill="#5851E8" text-anchor="middle" letter-spacing="-0.01em">+</text></g>
</g>
</svg>`,
  B: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 820 650" fill="none" font-family="Satoshi, sans-serif" style="display:block;width:100%;height:100%"
<defs>
  <radialGradient id="bg" cx="26%" cy="2%" r="130%"><stop offset="0" stop-color="#7B74F2"></stop><stop offset="0.5" stop-color="#5851E8"></stop><stop offset="1" stop-color="#453ED6"></stop></radialGradient>
  <pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.3" fill="#fff" fill-opacity="0.18"></circle></pattern>
  <clipPath id="clip"><rect width="820" height="650" rx="22"></rect></clipPath>
  <filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="4" stdDeviation="7" flood-color="#12111F" flood-opacity="0.18"></feDropShadow></filter>
</defs>
<g clip-path="url(#clip)">
  <rect width="820" height="650" fill="url(#bg)"></rect>
  <rect width="820" height="650" fill="url(#dots)"></rect>
  <g transform="translate(29.69 24.00) scale(0.9276)"><rect x="260" y="0" width="300" height="50" rx="12" fill="#fff" filter="url(#sh)"></rect><circle cx="280" cy="25" r="4" fill="#5851E8"></circle><text x="294" y="30" font-size="13.5" font-weight="600" fill="#5851E8" text-anchor="start" letter-spacing="-0.01em">Début de séquence</text><g fill="#9A9EA8"><circle cx="520" cy="25" r="1.6"></circle><circle cx="527" cy="25" r="1.6"></circle><circle cx="534" cy="25" r="1.6"></circle></g><rect x="409" y="50" width="2" height="34" fill="#ffffff" fill-opacity="0.45"></rect><circle cx="410" cy="67" r="11" fill="#fff" stroke="#ffffff" stroke-opacity="0.8" stroke-width="1.5"></circle><text x="410" y="72.5" font-size="17" font-weight="500" fill="#5851E8" text-anchor="middle" letter-spacing="-0.01em">+</text><rect x="260" y="84" width="300" height="106" rx="14" fill="#fff" filter="url(#sh)"></rect><path d="M260 98 a14 14 0 0 1 14-14 h272 a14 14 0 0 1 14 14 v22 h-300 Z" fill="#F5F5F7"></path><line x1="260" y1="120" x2="560" y2="120" stroke="#F0F1F3" stroke-width="1"></line><g transform="translate(271 94.5) scale(0.625)" fill="none" stroke="#9A9EA8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"></circle><path d="M12 7.5v4.7l3.2 1.9"></path></g><text x="292" y="106" font-size="12" font-weight="600" fill="#5C606A" text-anchor="start" letter-spacing="-0.01em">Envoyer <tspan fill="#5851E8" font-weight="700">immédiatement</tspan></text><g transform="translate(534 95) scale(0.5833333333333334)" fill="none" stroke="#9A9EA8" stroke-width="1.8" stroke-linejoin="round"><path d="M4 20l4-1L19 8a2 2 0 0 0-3-3L5 16l-1 4Z"></path></g><rect x="274" y="134" width="42" height="42" rx="11" fill="#F4F3FE" stroke="#D9D7FB" stroke-width="1"></rect><g transform="translate(283.5 143.5) scale(0.9583333333333334)"><g fill="#5851E8" fill-opacity="0.16"><path d="M2.6 12C4.6 7.8 8 5.6 12 5.6S19.4 7.8 21.4 12C19.4 16.2 16 18.4 12 18.4S4.6 16.2 2.6 12Z"></path></g><g fill="none" stroke="#5851E8" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2.6 12C4.6 7.8 8 5.6 12 5.6S19.4 7.8 21.4 12C19.4 16.2 16 18.4 12 18.4S4.6 16.2 2.6 12Z"></path><circle cx="12" cy="12" r="3.1"></circle></g></g><rect x="304" y="164" width="17" height="17" rx="5" fill="#0A66C2" stroke="#fff" stroke-width="1.5"></rect><text x="312.5" y="175.5" font-size="9" font-weight="800" fill="#fff" text-anchor="middle" letter-spacing="-0.01em">in</text><text x="330" y="148" font-size="13.5" font-weight="700" fill="#15161A" text-anchor="start" letter-spacing="-0.01em">Visiter le profil</text><text x="330" y="165" font-size="11.5" font-weight="400" fill="#9A9EA8" text-anchor="start" letter-spacing="-0.01em">Consulter le profil du lead</text><g fill="#9A9EA8"><circle cx="520" cy="142" r="1.6"></circle><circle cx="527" cy="142" r="1.6"></circle><circle cx="534" cy="142" r="1.6"></circle></g><rect x="409" y="190" width="2" height="34" fill="#ffffff" fill-opacity="0.45"></rect><circle cx="410" cy="207" r="11" fill="#fff" stroke="#ffffff" stroke-opacity="0.8" stroke-width="1.5"></circle><text x="410" y="212.5" font-size="17" font-weight="500" fill="#5851E8" text-anchor="middle" letter-spacing="-0.01em">+</text><rect x="260" y="224" width="300" height="106" rx="14" fill="#fff" filter="url(#sh)"></rect><path d="M260 238 a14 14 0 0 1 14-14 h272 a14 14 0 0 1 14 14 v22 h-300 Z" fill="#F5F5F7"></path><line x1="260" y1="260" x2="560" y2="260" stroke="#F0F1F3" stroke-width="1"></line><g transform="translate(271 234.5) scale(0.625)" fill="none" stroke="#9A9EA8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"></circle><path d="M12 7.5v4.7l3.2 1.9"></path></g><text x="292" y="246" font-size="12" font-weight="600" fill="#5C606A" text-anchor="start" letter-spacing="-0.01em">Délai de <tspan fill="#5851E8" font-weight="700">X jours</tspan></text><g transform="translate(534 235) scale(0.5833333333333334)" fill="none" stroke="#9A9EA8" stroke-width="1.8" stroke-linejoin="round"><path d="M4 20l4-1L19 8a2 2 0 0 0-3-3L5 16l-1 4Z"></path></g><rect x="274" y="274" width="42" height="42" rx="11" fill="#F4F3FE" stroke="#D9D7FB" stroke-width="1"></rect><g transform="translate(283.5 283.5) scale(0.9583333333333334)"><g fill="#5851E8" fill-opacity="0.16"><circle cx="9.2" cy="8" r="3.4"></circle><path d="M3.4 19v-1A4.9 4.9 0 0 1 8.3 13.1h1.8A4.9 4.9 0 0 1 15 18v1Z"></path></g><g fill="none" stroke="#5851E8" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="9.2" cy="8" r="3.4"></circle><path d="M3.4 19v-1A4.9 4.9 0 0 1 8.3 13.1h1.8A4.9 4.9 0 0 1 15 18v1"></path><path d="M18.5 7.5v5M16 10h5"></path></g></g><rect x="304" y="304" width="17" height="17" rx="5" fill="#0A66C2" stroke="#fff" stroke-width="1.5"></rect><text x="312.5" y="315.5" font-size="9" font-weight="800" fill="#fff" text-anchor="middle" letter-spacing="-0.01em">in</text><text x="330" y="288" font-size="13.5" font-weight="700" fill="#15161A" text-anchor="start" letter-spacing="-0.01em">Invitation</text><text x="330" y="305" font-size="11.5" font-weight="400" fill="#9A9EA8" text-anchor="start" letter-spacing="-0.01em">Envoyer une demande de connexion</text><g fill="#9A9EA8"><circle cx="520" cy="282" r="1.6"></circle><circle cx="527" cy="282" r="1.6"></circle><circle cx="534" cy="282" r="1.6"></circle></g><rect x="409" y="330" width="2" height="34" fill="#ffffff" fill-opacity="0.45"></rect><circle cx="410" cy="347" r="11" fill="#fff" stroke="#ffffff" stroke-opacity="0.8" stroke-width="1.5"></circle><text x="410" y="352.5" font-size="17" font-weight="500" fill="#5851E8" text-anchor="middle" letter-spacing="-0.01em">+</text><rect x="260" y="364" width="300" height="106" rx="14" fill="#fff" filter="url(#sh)"></rect><path d="M260 378 a14 14 0 0 1 14-14 h272 a14 14 0 0 1 14 14 v22 h-300 Z" fill="#F5F5F7"></path><line x1="260" y1="400" x2="560" y2="400" stroke="#F0F1F3" stroke-width="1"></line><g transform="translate(271 374.5) scale(0.625)" fill="none" stroke="#9A9EA8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"></circle><path d="M12 7.5v4.7l3.2 1.9"></path></g><text x="292" y="386" font-size="12" font-weight="600" fill="#5C606A" text-anchor="start" letter-spacing="-0.01em">Délai de <tspan fill="#5851E8" font-weight="700">X jours</tspan></text><g transform="translate(534 375) scale(0.5833333333333334)" fill="none" stroke="#9A9EA8" stroke-width="1.8" stroke-linejoin="round"><path d="M4 20l4-1L19 8a2 2 0 0 0-3-3L5 16l-1 4Z"></path></g><rect x="274" y="414" width="42" height="42" rx="11" fill="#F4F3FE" stroke="#D9D7FB" stroke-width="1"></rect><g transform="translate(283.5 423.5) scale(0.9583333333333334)"><g fill="#5851E8" fill-opacity="0.16"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v6A2.5 2.5 0 0 1 17.5 15H9.5L5.5 18v-3A2.5 2.5 0 0 1 4 12.5Z"></path></g><g fill="none" stroke="#5851E8" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v6A2.5 2.5 0 0 1 17.5 15H9.5L5.5 18v-3A2.5 2.5 0 0 1 4 12.5Z"></path></g><g fill="#5851E8"><circle cx="8.3" cy="9.3" r="1.05"></circle><circle cx="12" cy="9.3" r="1.05"></circle><circle cx="15.7" cy="9.3" r="1.05"></circle></g></g><rect x="304" y="444" width="17" height="17" rx="5" fill="#0A66C2" stroke="#fff" stroke-width="1.5"></rect><text x="312.5" y="455.5" font-size="9" font-weight="800" fill="#fff" text-anchor="middle" letter-spacing="-0.01em">in</text><text x="330" y="428" font-size="13.5" font-weight="700" fill="#15161A" text-anchor="start" letter-spacing="-0.01em">Message 1</text><text x="330" y="445" font-size="11.5" font-weight="400" fill="#9A9EA8" text-anchor="start" letter-spacing="-0.01em">Envoyer un message</text><g fill="#9A9EA8"><circle cx="520" cy="422" r="1.6"></circle><circle cx="527" cy="422" r="1.6"></circle><circle cx="534" cy="422" r="1.6"></circle></g><rect x="409" y="470" width="2" height="34" fill="#ffffff" fill-opacity="0.45"></rect><circle cx="410" cy="487" r="11" fill="#fff" stroke="#ffffff" stroke-opacity="0.8" stroke-width="1.5"></circle><text x="410" y="492.5" font-size="17" font-weight="500" fill="#5851E8" text-anchor="middle" letter-spacing="-0.01em">+</text><rect x="260" y="504" width="300" height="106" rx="14" fill="#fff" filter="url(#sh)"></rect><rect x="258.5" y="502.5" width="303" height="109" rx="15.5" fill="none" stroke="#5851E8" stroke-width="1.5"></rect><rect x="256" y="500" width="308" height="114" rx="18" fill="none" stroke="#5851E8" stroke-opacity="0.14" stroke-width="3"></rect><path d="M260 518 a14 14 0 0 1 14-14 h272 a14 14 0 0 1 14 14 v22 h-300 Z" fill="#F5F5F7"></path><line x1="260" y1="540" x2="560" y2="540" stroke="#F0F1F3" stroke-width="1"></line><g transform="translate(271 514.5) scale(0.625)" fill="none" stroke="#9A9EA8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"></circle><path d="M12 7.5v4.7l3.2 1.9"></path></g><text x="292" y="526" font-size="12" font-weight="600" fill="#5C606A" text-anchor="start" letter-spacing="-0.01em">Délai de <tspan fill="#5851E8" font-weight="700">X jours</tspan></text><g transform="translate(534 515) scale(0.5833333333333334)" fill="none" stroke="#9A9EA8" stroke-width="1.8" stroke-linejoin="round"><path d="M4 20l4-1L19 8a2 2 0 0 0-3-3L5 16l-1 4Z"></path></g><rect x="274" y="554" width="42" height="42" rx="11" fill="#F4F3FE" stroke="#D9D7FB" stroke-width="1"></rect><g transform="translate(283.5 563.5) scale(0.9583333333333334)"><g fill="#5851E8" fill-opacity="0.16"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v6A2.5 2.5 0 0 1 17.5 15H9.5L5.5 18v-3A2.5 2.5 0 0 1 4 12.5Z"></path></g><g fill="none" stroke="#5851E8" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v6A2.5 2.5 0 0 1 17.5 15H9.5L5.5 18v-3A2.5 2.5 0 0 1 4 12.5Z"></path></g><g fill="#5851E8"><circle cx="8.3" cy="9.3" r="1.05"></circle><circle cx="12" cy="9.3" r="1.05"></circle><circle cx="15.7" cy="9.3" r="1.05"></circle></g></g><rect x="304" y="584" width="17" height="17" rx="5" fill="#0A66C2" stroke="#fff" stroke-width="1.5"></rect><text x="312.5" y="595.5" font-size="9" font-weight="800" fill="#fff" text-anchor="middle" letter-spacing="-0.01em">in</text><text x="330" y="568" font-size="13.5" font-weight="700" fill="#15161A" text-anchor="start" letter-spacing="-0.01em">Message 2</text><text x="330" y="585" font-size="11.5" font-weight="400" fill="#9A9EA8" text-anchor="start" letter-spacing="-0.01em">Envoyer un message</text><g fill="#9A9EA8"><circle cx="520" cy="562" r="1.6"></circle><circle cx="527" cy="562" r="1.6"></circle><circle cx="534" cy="562" r="1.6"></circle></g><rect x="409" y="610" width="2" height="28" fill="#ffffff" fill-opacity="0.45"></rect><circle cx="410" cy="638" r="11" fill="#fff" stroke="#ffffff" stroke-opacity="0.8" stroke-width="1.5"></circle><text x="410" y="643.5" font-size="17" font-weight="500" fill="#5851E8" text-anchor="middle" letter-spacing="-0.01em">+</text></g>
</g>
</svg>`,
  C: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 820 650" fill="none" font-family="Satoshi, sans-serif" style="display:block;width:100%;height:100%"
<defs>
  <radialGradient id="bg" cx="26%" cy="2%" r="130%"><stop offset="0" stop-color="#7B74F2"></stop><stop offset="0.5" stop-color="#5851E8"></stop><stop offset="1" stop-color="#453ED6"></stop></radialGradient>
  <pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.3" fill="#fff" fill-opacity="0.18"></circle></pattern>
  <clipPath id="clip"><rect width="820" height="650" rx="22"></rect></clipPath>
  <filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="4" stdDeviation="7" flood-color="#12111F" flood-opacity="0.18"></feDropShadow></filter>
</defs>
<g clip-path="url(#clip)">
  <rect width="820" height="650" fill="url(#bg)"></rect>
  <rect width="820" height="650" fill="url(#dots)"></rect>
  <g transform="translate(97.17 24.00) scale(0.7630)"><rect x="260" y="0" width="300" height="50" rx="12" fill="#fff" filter="url(#sh)"></rect><circle cx="280" cy="25" r="4" fill="#5851E8"></circle><text x="294" y="30" font-size="13.5" font-weight="600" fill="#5851E8" text-anchor="start" letter-spacing="-0.01em">Début de séquence</text><g fill="#9A9EA8"><circle cx="520" cy="25" r="1.6"></circle><circle cx="527" cy="25" r="1.6"></circle><circle cx="534" cy="25" r="1.6"></circle></g><rect x="409" y="50" width="2" height="34" fill="#ffffff" fill-opacity="0.45"></rect><circle cx="410" cy="67" r="11" fill="#fff" stroke="#ffffff" stroke-opacity="0.8" stroke-width="1.5"></circle><text x="410" y="72.5" font-size="17" font-weight="500" fill="#5851E8" text-anchor="middle" letter-spacing="-0.01em">+</text><rect x="260" y="84" width="300" height="106" rx="14" fill="#fff" filter="url(#sh)"></rect><path d="M260 98 a14 14 0 0 1 14-14 h272 a14 14 0 0 1 14 14 v22 h-300 Z" fill="#F5F5F7"></path><line x1="260" y1="120" x2="560" y2="120" stroke="#F0F1F3" stroke-width="1"></line><g transform="translate(271 94.5) scale(0.625)" fill="none" stroke="#9A9EA8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"></circle><path d="M12 7.5v4.7l3.2 1.9"></path></g><text x="292" y="106" font-size="12" font-weight="600" fill="#5C606A" text-anchor="start" letter-spacing="-0.01em">Envoyer <tspan fill="#5851E8" font-weight="700">immédiatement</tspan></text><g transform="translate(534 95) scale(0.5833333333333334)" fill="none" stroke="#9A9EA8" stroke-width="1.8" stroke-linejoin="round"><path d="M4 20l4-1L19 8a2 2 0 0 0-3-3L5 16l-1 4Z"></path></g><rect x="274" y="134" width="42" height="42" rx="11" fill="#F4F3FE" stroke="#D9D7FB" stroke-width="1"></rect><g transform="translate(283.5 143.5) scale(0.9583333333333334)"><g fill="#5851E8" fill-opacity="0.16"><path d="M2.6 12C4.6 7.8 8 5.6 12 5.6S19.4 7.8 21.4 12C19.4 16.2 16 18.4 12 18.4S4.6 16.2 2.6 12Z"></path></g><g fill="none" stroke="#5851E8" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2.6 12C4.6 7.8 8 5.6 12 5.6S19.4 7.8 21.4 12C19.4 16.2 16 18.4 12 18.4S4.6 16.2 2.6 12Z"></path><circle cx="12" cy="12" r="3.1"></circle></g></g><rect x="304" y="164" width="17" height="17" rx="5" fill="#0A66C2" stroke="#fff" stroke-width="1.5"></rect><text x="312.5" y="175.5" font-size="9" font-weight="800" fill="#fff" text-anchor="middle" letter-spacing="-0.01em">in</text><text x="330" y="148" font-size="13.5" font-weight="700" fill="#15161A" text-anchor="start" letter-spacing="-0.01em">Visiter le profil</text><text x="330" y="165" font-size="11.5" font-weight="400" fill="#9A9EA8" text-anchor="start" letter-spacing="-0.01em">Consulter le profil du lead</text><g fill="#9A9EA8"><circle cx="520" cy="142" r="1.6"></circle><circle cx="527" cy="142" r="1.6"></circle><circle cx="534" cy="142" r="1.6"></circle></g><rect x="409" y="190" width="2" height="34" fill="#ffffff" fill-opacity="0.45"></rect><circle cx="410" cy="207" r="11" fill="#fff" stroke="#ffffff" stroke-opacity="0.8" stroke-width="1.5"></circle><text x="410" y="212.5" font-size="17" font-weight="500" fill="#5851E8" text-anchor="middle" letter-spacing="-0.01em">+</text><rect x="260" y="224" width="300" height="106" rx="14" fill="#fff" filter="url(#sh)"></rect><path d="M260 238 a14 14 0 0 1 14-14 h272 a14 14 0 0 1 14 14 v22 h-300 Z" fill="#F5F5F7"></path><line x1="260" y1="260" x2="560" y2="260" stroke="#F0F1F3" stroke-width="1"></line><g transform="translate(271 234.5) scale(0.625)" fill="none" stroke="#9A9EA8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"></circle><path d="M12 7.5v4.7l3.2 1.9"></path></g><text x="292" y="246" font-size="12" font-weight="600" fill="#5C606A" text-anchor="start" letter-spacing="-0.01em">Délai de <tspan fill="#5851E8" font-weight="700">X jours</tspan></text><g transform="translate(534 235) scale(0.5833333333333334)" fill="none" stroke="#9A9EA8" stroke-width="1.8" stroke-linejoin="round"><path d="M4 20l4-1L19 8a2 2 0 0 0-3-3L5 16l-1 4Z"></path></g><rect x="274" y="274" width="42" height="42" rx="11" fill="#F4F3FE" stroke="#D9D7FB" stroke-width="1"></rect><g transform="translate(283.5 283.5) scale(0.9583333333333334)"><g fill="#5851E8" fill-opacity="0.16"><circle cx="9.2" cy="8" r="3.4"></circle><path d="M3.4 19v-1A4.9 4.9 0 0 1 8.3 13.1h1.8A4.9 4.9 0 0 1 15 18v1Z"></path></g><g fill="none" stroke="#5851E8" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="9.2" cy="8" r="3.4"></circle><path d="M3.4 19v-1A4.9 4.9 0 0 1 8.3 13.1h1.8A4.9 4.9 0 0 1 15 18v1"></path><path d="M18.5 7.5v5M16 10h5"></path></g></g><rect x="304" y="304" width="17" height="17" rx="5" fill="#0A66C2" stroke="#fff" stroke-width="1.5"></rect><text x="312.5" y="315.5" font-size="9" font-weight="800" fill="#fff" text-anchor="middle" letter-spacing="-0.01em">in</text><text x="330" y="288" font-size="13.5" font-weight="700" fill="#15161A" text-anchor="start" letter-spacing="-0.01em">Invitation</text><text x="330" y="305" font-size="11.5" font-weight="400" fill="#9A9EA8" text-anchor="start" letter-spacing="-0.01em">Envoyer une demande de connexion</text><g fill="#9A9EA8"><circle cx="520" cy="282" r="1.6"></circle><circle cx="527" cy="282" r="1.6"></circle><circle cx="534" cy="282" r="1.6"></circle></g><rect x="409" y="330" width="2" height="34" fill="#ffffff" fill-opacity="0.45"></rect><circle cx="410" cy="347" r="11" fill="#fff" stroke="#ffffff" stroke-opacity="0.8" stroke-width="1.5"></circle><text x="410" y="352.5" font-size="17" font-weight="500" fill="#5851E8" text-anchor="middle" letter-spacing="-0.01em">+</text><rect x="260" y="364" width="300" height="106" rx="14" fill="#fff" filter="url(#sh)"></rect><path d="M260 378 a14 14 0 0 1 14-14 h272 a14 14 0 0 1 14 14 v22 h-300 Z" fill="#F5F5F7"></path><line x1="260" y1="400" x2="560" y2="400" stroke="#F0F1F3" stroke-width="1"></line><g transform="translate(271 374.5) scale(0.625)" fill="none" stroke="#9A9EA8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"></circle><path d="M12 7.5v4.7l3.2 1.9"></path></g><text x="292" y="386" font-size="12" font-weight="600" fill="#5C606A" text-anchor="start" letter-spacing="-0.01em">Délai de <tspan fill="#5851E8" font-weight="700">X jours</tspan></text><g transform="translate(534 375) scale(0.5833333333333334)" fill="none" stroke="#9A9EA8" stroke-width="1.8" stroke-linejoin="round"><path d="M4 20l4-1L19 8a2 2 0 0 0-3-3L5 16l-1 4Z"></path></g><rect x="274" y="414" width="42" height="42" rx="11" fill="#F4F3FE" stroke="#D9D7FB" stroke-width="1"></rect><g transform="translate(283.5 423.5) scale(0.9583333333333334)"><g fill="#5851E8" fill-opacity="0.16"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v6A2.5 2.5 0 0 1 17.5 15H9.5L5.5 18v-3A2.5 2.5 0 0 1 4 12.5Z"></path></g><g fill="none" stroke="#5851E8" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v6A2.5 2.5 0 0 1 17.5 15H9.5L5.5 18v-3A2.5 2.5 0 0 1 4 12.5Z"></path></g><g fill="#5851E8"><circle cx="8.3" cy="9.3" r="1.05"></circle><circle cx="12" cy="9.3" r="1.05"></circle><circle cx="15.7" cy="9.3" r="1.05"></circle></g></g><rect x="304" y="444" width="17" height="17" rx="5" fill="#0A66C2" stroke="#fff" stroke-width="1.5"></rect><text x="312.5" y="455.5" font-size="9" font-weight="800" fill="#fff" text-anchor="middle" letter-spacing="-0.01em">in</text><text x="330" y="428" font-size="13.5" font-weight="700" fill="#15161A" text-anchor="start" letter-spacing="-0.01em">Message 1</text><text x="330" y="445" font-size="11.5" font-weight="400" fill="#9A9EA8" text-anchor="start" letter-spacing="-0.01em">Envoyer un message</text><g fill="#9A9EA8"><circle cx="520" cy="422" r="1.6"></circle><circle cx="527" cy="422" r="1.6"></circle><circle cx="534" cy="422" r="1.6"></circle></g><rect x="409" y="470" width="2" height="34" fill="#ffffff" fill-opacity="0.45"></rect><circle cx="410" cy="487" r="11" fill="#fff" stroke="#ffffff" stroke-opacity="0.8" stroke-width="1.5"></circle><text x="410" y="492.5" font-size="17" font-weight="500" fill="#5851E8" text-anchor="middle" letter-spacing="-0.01em">+</text><rect x="260" y="504" width="300" height="106" rx="14" fill="#fff" filter="url(#sh)"></rect><path d="M260 518 a14 14 0 0 1 14-14 h272 a14 14 0 0 1 14 14 v22 h-300 Z" fill="#F5F5F7"></path><line x1="260" y1="540" x2="560" y2="540" stroke="#F0F1F3" stroke-width="1"></line><g transform="translate(271 514.5) scale(0.625)" fill="none" stroke="#9A9EA8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"></circle><path d="M12 7.5v4.7l3.2 1.9"></path></g><text x="292" y="526" font-size="12" font-weight="600" fill="#5C606A" text-anchor="start" letter-spacing="-0.01em">Délai de <tspan fill="#5851E8" font-weight="700">X jours</tspan></text><g transform="translate(534 515) scale(0.5833333333333334)" fill="none" stroke="#9A9EA8" stroke-width="1.8" stroke-linejoin="round"><path d="M4 20l4-1L19 8a2 2 0 0 0-3-3L5 16l-1 4Z"></path></g><rect x="274" y="554" width="42" height="42" rx="11" fill="#F4F3FE" stroke="#D9D7FB" stroke-width="1"></rect><g transform="translate(283.5 563.5) scale(0.9583333333333334)"><g fill="#5851E8" fill-opacity="0.16"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v6A2.5 2.5 0 0 1 17.5 15H9.5L5.5 18v-3A2.5 2.5 0 0 1 4 12.5Z"></path></g><g fill="none" stroke="#5851E8" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v6A2.5 2.5 0 0 1 17.5 15H9.5L5.5 18v-3A2.5 2.5 0 0 1 4 12.5Z"></path></g><g fill="#5851E8"><circle cx="8.3" cy="9.3" r="1.05"></circle><circle cx="12" cy="9.3" r="1.05"></circle><circle cx="15.7" cy="9.3" r="1.05"></circle></g></g><rect x="304" y="584" width="17" height="17" rx="5" fill="#0A66C2" stroke="#fff" stroke-width="1.5"></rect><text x="312.5" y="595.5" font-size="9" font-weight="800" fill="#fff" text-anchor="middle" letter-spacing="-0.01em">in</text><text x="330" y="568" font-size="13.5" font-weight="700" fill="#15161A" text-anchor="start" letter-spacing="-0.01em">Message 2</text><text x="330" y="585" font-size="11.5" font-weight="400" fill="#9A9EA8" text-anchor="start" letter-spacing="-0.01em">Envoyer un message</text><g fill="#9A9EA8"><circle cx="520" cy="562" r="1.6"></circle><circle cx="527" cy="562" r="1.6"></circle><circle cx="534" cy="562" r="1.6"></circle></g><rect x="409" y="610" width="2" height="34" fill="#ffffff" fill-opacity="0.45"></rect><circle cx="410" cy="627" r="11" fill="#fff" stroke="#ffffff" stroke-opacity="0.8" stroke-width="1.5"></circle><text x="410" y="632.5" font-size="17" font-weight="500" fill="#5851E8" text-anchor="middle" letter-spacing="-0.01em">+</text><rect x="260" y="644" width="300" height="106" rx="14" fill="#fff" filter="url(#sh)"></rect><rect x="258.5" y="642.5" width="303" height="109" rx="15.5" fill="none" stroke="#5851E8" stroke-width="1.5"></rect><rect x="256" y="640" width="308" height="114" rx="18" fill="none" stroke="#5851E8" stroke-opacity="0.14" stroke-width="3"></rect><path d="M260 658 a14 14 0 0 1 14-14 h272 a14 14 0 0 1 14 14 v22 h-300 Z" fill="#F5F5F7"></path><line x1="260" y1="680" x2="560" y2="680" stroke="#F0F1F3" stroke-width="1"></line><g transform="translate(271 654.5) scale(0.625)" fill="none" stroke="#9A9EA8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"></circle><path d="M12 7.5v4.7l3.2 1.9"></path></g><text x="292" y="666" font-size="12" font-weight="600" fill="#5C606A" text-anchor="start" letter-spacing="-0.01em">Délai de <tspan fill="#5851E8" font-weight="700">X jours</tspan></text><g transform="translate(534 655) scale(0.5833333333333334)" fill="none" stroke="#9A9EA8" stroke-width="1.8" stroke-linejoin="round"><path d="M4 20l4-1L19 8a2 2 0 0 0-3-3L5 16l-1 4Z"></path></g><rect x="274" y="694" width="42" height="42" rx="11" fill="#F4F3FE" stroke="#D9D7FB" stroke-width="1"></rect><g transform="translate(283.5 703.5) scale(0.9583333333333334)"><g fill="#5851E8" fill-opacity="0.16"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v6A2.5 2.5 0 0 1 17.5 15H9.5L5.5 18v-3A2.5 2.5 0 0 1 4 12.5Z"></path></g><g fill="none" stroke="#5851E8" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v6A2.5 2.5 0 0 1 17.5 15H9.5L5.5 18v-3A2.5 2.5 0 0 1 4 12.5Z"></path></g><g fill="#5851E8"><circle cx="8.3" cy="9.3" r="1.05"></circle><circle cx="12" cy="9.3" r="1.05"></circle><circle cx="15.7" cy="9.3" r="1.05"></circle></g></g><rect x="304" y="724" width="17" height="17" rx="5" fill="#0A66C2" stroke="#fff" stroke-width="1.5"></rect><text x="312.5" y="735.5" font-size="9" font-weight="800" fill="#fff" text-anchor="middle" letter-spacing="-0.01em">in</text><text x="330" y="708" font-size="13.5" font-weight="700" fill="#15161A" text-anchor="start" letter-spacing="-0.01em">Message 3</text><text x="330" y="725" font-size="11.5" font-weight="400" fill="#9A9EA8" text-anchor="start" letter-spacing="-0.01em">Envoyer un message</text><g fill="#9A9EA8"><circle cx="520" cy="702" r="1.6"></circle><circle cx="527" cy="702" r="1.6"></circle><circle cx="534" cy="702" r="1.6"></circle></g><rect x="409" y="750" width="2" height="28" fill="#ffffff" fill-opacity="0.45"></rect><circle cx="410" cy="778" r="11" fill="#fff" stroke="#ffffff" stroke-opacity="0.8" stroke-width="1.5"></circle><text x="410" y="783.5" font-size="17" font-weight="500" fill="#5851E8" text-anchor="middle" letter-spacing="-0.01em">+</text></g>
</g>
</svg>`,
};

const SCENARIOS: Array<{
  type: ScenarioType;
  description: string;
  steps: string[];
}> = [
  {
    type: 'A',
    description: 'idéal pour débuter',
    steps: ['Visite', 'Invitation', 'Message 1'],
  },
  {
    type: 'B',
    description: 'suivi renforcé',
    steps: ['Visite', 'Invitation', 'Message 1', 'Message 2'],
  },
  {
    type: 'C',
    description: 'séquence complète',
    steps: ['Visite', 'Invitation', 'Message 1', 'Message 2', 'Message 3'],
  },
];

/* ─── Step indicator ─── */
function StepIndicator({ current }: { current: 1 | 2 | 3 | 4 }) {
  const steps = [
    { n: 1, label: 'Infos & scénario' },
    { n: 2, label: 'Messages & délais' },
    { n: 3, label: 'Import leads' },
    { n: 4, label: 'Confirmation' },
  ];
  return (
    <div className="flex items-center gap-0">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className={[
                'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors',
                current === s.n
                  ? 'bg-primary text-white'
                  : current > s.n
                  ? 'bg-primary/20 text-primary'
                  : 'bg-muted text-muted-foreground',
              ].join(' ')}
            >
              {current > s.n ? <Check className="h-3.5 w-3.5" /> : s.n}
            </div>
            <span className={`text-[11px] font-medium whitespace-nowrap ${current === s.n ? 'text-foreground' : 'text-muted-foreground'}`}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`mx-3 mb-4 h-px w-12 transition-colors ${current > s.n ? 'bg-primary/30' : 'bg-border'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Main component ─── */
export default function CampaignNew() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [step, setStep]                 = useState<1 | 2 | 3 | 4>(1);
  const [name, setName]                 = useState('');
  const [scenarioType, setScenarioType] = useState<ScenarioType>('A');
  const [personaId, setPersonaId]       = useState<string>('');
  const [stepsConfig, setStepsConfig]   = useState<StepConfig[]>(() => buildSteps('A'));
  const [csvLeads, setCsvLeads]         = useState<CsvLead[]>([]);
  const [csvError, setCsvError]         = useState('');
  const fileInputRef                    = useRef<HTMLInputElement>(null);
  const taRefs                          = useRef<(HTMLTextAreaElement | null)[]>([]);

  /* Rebuild steps when scenario changes */
  useEffect(() => {
    setStepsConfig(buildSteps(scenarioType));
  }, [scenarioType]);

  const { data: personas = [] } = useQuery({
    queryKey: ['personas-filter', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('personas').select('id, name').order('name');
      return (data ?? []) as { id: string; name: string }[];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  /* ─── Step config helpers ─── */
  function updateStep(index: number, field: 'message_content' | 'delay_days', value: string | number) {
    setStepsConfig((prev) => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  }

  function insertVariable(index: number, variable: string) {
    const ta = taRefs.current[index];
    const current = stepsConfig[index].message_content;
    const start = ta?.selectionStart ?? current.length;
    const end   = ta?.selectionEnd   ?? current.length;
    const next = current.slice(0, start) + variable + current.slice(end);
    updateStep(index, 'message_content', next);
    setTimeout(() => {
      ta?.setSelectionRange(start + variable.length, start + variable.length);
      ta?.focus();
    }, 0);
  }

  /* ─── CSV handler ─── */
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvError('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const leads = parseCSV(text);
      if (leads.length === 0) {
        setCsvError('Aucun lead valide trouvé. Vérifiez que votre fichier contient une colonne "linkedin_url".');
        setCsvLeads([]);
      } else {
        setCsvLeads(leads);
      }
    };
    reader.readAsText(file);
  }

  /* ─── Shared campaign insert helper ─── */
  async function insertCampaign(status: 'active' | 'draft') {
    if (!user) throw new Error('Non authentifié');

    const { data: campaign, error: cErr } = await (supabase as any)
      .from('campaigns')
      .insert({
        user_id:       user.id,
        name:          name.trim(),
        scenario_type: scenarioType,
        persona_id:    personaId || null,
        status,
      })
      .select('id')
      .single();
    if (cErr) throw cErr;

    const campaignId: string = campaign.id;

    const { error: sErr } = await (supabase as any)
      .from('campaign_steps')
      .insert(
        stepsConfig.map((s) => ({
          campaign_id:     campaignId,
          step_order:      s.step_order,
          action_type:     s.action_type,
          message_content: s.message_content || null,
          delay_days:      s.delay_days,
        }))
      );
    if (sErr) throw sErr;

    if (csvLeads.length > 0) {
      const { data: insertedLeads, error: lErr } = await (supabase as any)
        .from('campaign_leads')
        .insert(
          csvLeads.map((l) => ({
            campaign_id:  campaignId,
            user_id:      user.id,
            linkedin_url: l.linkedin_url,
            first_name:   l.first_name   || null,
            last_name:    l.last_name    || null,
            company_name: l.company_name || null,
          }))
        )
        .select('id');
      if (lErr) throw lErr;

      if (status === 'active') {
        const now = new Date().toISOString();
        const { error: jErr } = await (supabase as any)
          .from('campaign_jobs')
          .insert(
            (insertedLeads ?? []).map((lead: { id: string }) => ({
              campaign_id:      campaignId,
              campaign_lead_id: lead.id,
              user_id:          user.id,
              action_type:      'visit',
              status:           'pending',
              execute_at:       now,
            }))
          );
        if (jErr) throw jErr;
      }
    }

    return campaignId;
  }

  /* ─── Launch mutation ─── */
  const launch = useMutation({
    mutationFn: () => insertCampaign('active'),
    onSuccess: (campaignId) => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      navigate(`/campaigns/${campaignId}`);
    },
    onError: (e: any) => {
      toast({ variant: 'destructive', title: 'Erreur', description: e.message });
    },
  });

  /* ─── Save draft mutation ─── */
  const saveDraft = useMutation({
    mutationFn: () => insertCampaign('draft'),
    onSuccess: (campaignId) => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      toast({ title: 'Brouillon enregistré' });
      navigate(`/campaigns/${campaignId}`);
    },
    onError: (e: any) => {
      toast({ variant: 'destructive', title: 'Erreur', description: e.message });
    },
  });

  /* ─── Validation ─── */
  const step1Valid = name.trim().length > 0;
  const step3Valid = csvLeads.length > 0;

  /* ─── Render steps ─── */
  return (
    <AppLayout>
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        {/* Colonne gauche — formulaire */}
        <div className="flex-1 p-4 sm:p-6 max-w-2xl space-y-6 min-w-0" data-testid="page-campaign-new">
        {/* Back */}
        <Button variant="ghost" size="sm" className="text-muted-foreground -ml-1" onClick={() => navigate('/campaigns')}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1" />
          Campagnes
        </Button>

        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Nouvelle campagne</h1>
        </div>

        <StepIndicator current={step} />

        {/* Bandeau quotas LinkedIn */}
        <div className="flex gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
          <div className="space-y-1 text-muted-foreground">
            <p className="font-medium text-foreground">Quotas LinkedIn appliqués automatiquement</p>
            <ul className="space-y-0.5 text-xs">
              <li>· <span className="font-medium text-foreground">80 visites</span> de profil / jour</li>
              <li>· <span className="font-medium text-foreground">20 invitations</span> / jour (≈ 140/semaine)</li>
              <li>· <span className="font-medium text-foreground">50 messages</span> / jour</li>
            </ul>
            <p className="text-xs">Les actions en attente reprennent automatiquement le lendemain si le quota est atteint.</p>
          </div>
        </div>

        {/* ─── Step 1 : Infos & scénario ─── */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="campaign-name">Nom de la campagne <span className="text-destructive">*</span></Label>
              <Input
                id="campaign-name"
                placeholder="Ex : Outreach CEO Tech — Juin 2025"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              <Label>Scénario <span className="text-destructive">*</span></Label>
              <div className="grid gap-3">
                {SCENARIOS.map((s) => (
                  <button
                    key={s.type}
                    type="button"
                    onClick={() => setScenarioType(s.type)}
                    className={[
                      'flex items-start gap-4 rounded-xl border p-4 text-left transition-colors',
                      scenarioType === s.type
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/40',
                    ].join(' ')}
                  >
                    <div
                      className={[
                        'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                        scenarioType === s.type
                          ? 'border-primary bg-primary'
                          : 'border-muted-foreground/30',
                      ].join(' ')}
                    >
                      {scenarioType === s.type && <div className="h-2 w-2 rounded-full bg-white" />}
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-sm font-semibold text-foreground">
                        Scénario {s.type} - {s.steps.length} étape{s.steps.length > 1 ? 's' : ''} <span className="font-normal text-muted-foreground">({s.description})</span>
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {s.steps.map((label, i) => (
                          <span key={i} className="flex items-center gap-1">
                            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                              {label}
                            </span>
                            {i < s.steps.length - 1 && (
                              <ArrowRight className="h-3 w-3 text-primary/40" />
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {personas.length > 0 && (
              <div className="space-y-2">
                <Label>Persona associé <span className="text-muted-foreground text-xs">(optionnel)</span></Label>
                <Select value={personaId} onValueChange={setPersonaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un persona" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Aucun</SelectItem>
                    {personas.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                disabled={!step1Valid || saveDraft.isPending}
                onClick={() => saveDraft.mutate()}
              >
                {saveDraft.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                Enregistrer en brouillon
              </Button>
              <Button disabled={!step1Valid} onClick={() => setStep(2)}>
                Suivant
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </div>
          </div>
        )}

        {/* ─── Step 2 : Messages & délais ─── */}
        {step === 2 && (
          <div className="space-y-4">
            {stepsConfig.map((s, i) => (
              <div
                key={i}
                className={[
                  'rounded-xl border p-4 space-y-3',
                  s.editable ? 'border-border' : 'border-border bg-muted/30',
                ].join(' ')}
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                    {s.step_order}
                  </span>
                  <p className="text-sm font-semibold text-foreground">{s.label}</p>
                  {!s.editable && (
                    <span className="ml-auto text-xs text-muted-foreground">Lance immédiatement</span>
                  )}
                </div>

                {s.editable && (
                  <>
                    {/* Variable chips */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs text-muted-foreground">Variables :</span>
                      {['{{first_name}}', '{{last_name}}', '{{company_name}}'].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => insertVariable(i, v)}
                          className="rounded-md border border-primary/30 bg-primary/5 px-2 py-0.5 text-[11px] font-mono text-primary hover:bg-primary/10 transition-colors"
                        >
                          {v}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        {s.action_type === 'invite' ? 'Note d\'invitation' : 'Message'}
                        {s.action_type === 'invite' && (
                          <span className="ml-1 text-muted-foreground/70">(optionnelle, max 300 car.)</span>
                        )}
                      </Label>
                      <Textarea
                        ref={(el) => { taRefs.current[i] = el; }}
                        placeholder={
                          s.action_type === 'invite'
                            ? 'Bonjour {{first_name}}, je souhaite échanger avec vous sur…'
                            : 'Bonjour {{first_name}}, je reviens vers vous suite à…'
                        }
                        value={s.message_content}
                        onChange={(e) => updateStep(i, 'message_content', e.target.value)}
                        rows={4}
                        className="resize-none text-sm"
                        maxLength={s.action_type === 'invite' ? 300 : undefined}
                      />
                      {s.action_type === 'invite' && (
                        <p className="text-right text-xs text-muted-foreground">
                          {s.message_content.length}/300
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <Label className="text-xs text-muted-foreground whitespace-nowrap">Délai après étape précédente</Label>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          min={0}
                          max={30}
                          value={s.delay_days}
                          onChange={(e) => updateStep(i, 'delay_days', Math.max(0, Math.min(30, Number(e.target.value))))}
                          className="w-16 text-center text-sm h-8"
                        />
                        <span className="text-xs text-muted-foreground">jour{s.delay_days !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}

            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                Retour
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  disabled={saveDraft.isPending}
                  onClick={() => saveDraft.mutate()}
                >
                  {saveDraft.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                  Enregistrer en brouillon
                </Button>
                <Button onClick={() => setStep(3)}>
                  Suivant
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Step 3 : Import CSV ─── */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Fichier CSV de leads <span className="text-destructive">*</span></Label>
              <p className="text-xs text-muted-foreground">
                Colonnes attendues : <code className="font-mono">linkedin_url</code> (obligatoire),{' '}
                <code className="font-mono">first_name</code>, <code className="font-mono">last_name</code>,{' '}
                <code className="font-mono">company_name</code>
              </p>

              <div
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/20 py-8 hover:bg-muted/40 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {csvLeads.length > 0
                    ? `${csvLeads.length} lead${csvLeads.length > 1 ? 's' : ''} importé${csvLeads.length > 1 ? 's' : ''} — cliquez pour changer`
                    : 'Cliquez pour choisir un fichier CSV'}
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFileChange}
              />
              {csvError && <p className="text-xs text-destructive">{csvError}</p>}
            </div>

            {/* Preview */}
            {csvLeads.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  Aperçu — {csvLeads.length} lead{csvLeads.length > 1 ? 's' : ''}
                </p>
                <div className="rounded-xl border border-border overflow-hidden max-h-64 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead>LinkedIn URL</TableHead>
                        <TableHead>Prénom</TableHead>
                        <TableHead>Nom</TableHead>
                        <TableHead>Entreprise</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvLeads.slice(0, 20).map((lead, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <span className="text-xs font-mono text-primary truncate max-w-[140px] block">
                              {lead.linkedin_url}
                            </span>
                          </TableCell>
                          <TableCell><span className="text-sm">{lead.first_name || '—'}</span></TableCell>
                          <TableCell><span className="text-sm">{lead.last_name  || '—'}</span></TableCell>
                          <TableCell><span className="text-sm">{lead.company_name || '—'}</span></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {csvLeads.length > 20 && (
                    <p className="py-2 text-center text-xs text-muted-foreground">
                      … et {csvLeads.length - 20} autre{csvLeads.length - 20 > 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                Retour
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  disabled={saveDraft.isPending}
                  onClick={() => saveDraft.mutate()}
                >
                  {saveDraft.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                  Enregistrer en brouillon
                </Button>
                <Button disabled={!step3Valid} onClick={() => setStep(4)}>
                  Suivant
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Step 4 : Confirmation ─── */}
        {step === 4 && (
          <div className="space-y-5">
            {/* Résumé général */}
            <div className="rounded-xl border border-border bg-muted/20 divide-y divide-border">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Campagne</span>
                <span className="text-sm font-semibold text-foreground">{name}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Scénario</span>
                <span className="text-sm font-mono font-medium text-foreground">
                  Scénario {scenarioType} — {stepsConfig.length} étape{stepsConfig.length > 1 ? 's' : ''}
                </span>
              </div>
              {personaId && personas.find((p) => p.id === personaId) && (
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Persona</span>
                  <span className="text-sm text-foreground">{personas.find((p) => p.id === personaId)!.name}</span>
                </div>
              )}
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Prospects</span>
                <span className="text-sm font-bold text-primary">
                  {csvLeads.length} prospect{csvLeads.length > 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Détail des étapes */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Séquence</p>
              <div className="space-y-2">
                {stepsConfig.map((s, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white mt-0.5">
                      {s.step_order}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">{s.label}</p>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {s.delay_days === 0 ? 'Immédiatement' : `J+${s.delay_days}`}
                        </span>
                      </div>
                      {s.message_content && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{s.message_content}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setStep(3)}>
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                Retour
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  disabled={saveDraft.isPending || launch.isPending}
                  onClick={() => saveDraft.mutate()}
                >
                  {saveDraft.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                  Enregistrer en brouillon
                </Button>
                <Button
                  disabled={launch.isPending || saveDraft.isPending}
                  onClick={() => launch.mutate()}
                >
                  {launch.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  ) : (
                    <Check className="h-4 w-4 mr-1.5" />
                  )}
                  Lancer la campagne
                </Button>
              </div>
            </div>
          </div>
        )}
        </div>

        {/* Colonne droite — visuel scénario (sticky) */}
        <div className="hidden lg:flex flex-col items-center justify-center flex-1 border-l bg-muted/20 sticky top-14 h-[calc(100vh-3.5rem)] p-8">
          <div className="w-full space-y-4 text-center flex flex-col items-center">
            <div
              className="w-full rounded-2xl overflow-hidden shadow-lg"
              style={{ maxHeight: 'calc(100vh - 13rem)' }}
              dangerouslySetInnerHTML={{ __html: SCENARIO_SVG[scenarioType] }}
            />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
