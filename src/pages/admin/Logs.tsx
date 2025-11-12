import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, Filter, User, ShoppingCart, CreditCard, CheckCircle, AlertCircle, RefreshCw, Bug, Users, FileText, AlertTriangle } from "lucide-react";

export interface Log {
  id: string;
  created_at: string;
  level: string;
  context: string;
  message: string;
  metadata: any;
}

export interface UserJourney {
  email: string;
  userId: string;
  logs: Log[];
  timeline: TimelineEvent[];
  status: 'success' | 'error' | 'warning' | 'processing';
  problemTypes: string[];
}

export interface TimelineEvent {
  timestamp: string;
  event: string;
  context: string;
  message: string;
  level: string;
  metadata: any;
}

interface ProblemSummary {
  type: string;
  description: string;
  count: number;
  journeys: UserJourney[];
}

// ... rest of the file remains unchanged