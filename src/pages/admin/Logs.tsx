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

interface Log {
  id: string;
  created_at: string;
  level: string;
  context: string;
  message: string;
  metadata: any;
}

interface UserJourney {
  email: string;
  userId: string;
  logs: Log[];
  timeline: TimelineEvent[];
  status: 'success' | 'error' | 'warning' | 'processing';
  problemTypes: string[];
}

interface TimelineEvent {
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

export default function Logs() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [userJourneys, setUserJourneys] = useState<UserJourney[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchEmail, setSearchEmail] = useState("");
  const [selectedContext, setSelectedContext] = useState<string>("all");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [selectedProblems, setSelectedProblems] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("journeys");

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;
      setLogs(data || []);
      processUserJourneys(data || []);
    } catch (error) {
      console.error('Erro ao buscar logs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const processUserJourneys = (logsData: Log[]) => {
    const userMap = new Map<string, UserJourney>();
    
    logsData.forEach(log => {
      const email = extractEmailFromLog(log);
      const userId = extractUserIdFromLog(log);
      
      if (email || userId) {
        const key = email || userId;
        if (!userMap.has(key!)) {
          userMap.set(key!, {
            email: email || 'Email não identificado',
            userId: userId || 'ID não identificado',
            logs: [],
            timeline: [],
            status: 'processing',
            problemTypes: []
          });
        }
        
        const journey = userMap.get(key!)!;
        journey.logs.push(log);
        
        const event: TimelineEvent = {
          timestamp: log.created_at,
          event: getEventType(log.context),
          context: log.context,
          message: log.message,
          level: log.level,
          metadata: log.metadata
        };
        
        journey.timeline.push(event);
      }
    });

    userMap.forEach(journey => {
      journey.timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      journey.status = determineJourneyStatus(journey);
      journey.problemTypes = detectProblems(journey);
    });

    setUserJourneys(Array.from(userMap.values()));
  };

  const extractEmailFromLog = (log: Log): string | null => {
    if (log.metadata?.email) return log.metadata.email;
    if (log.metadata?.requestBody?.email) return log.metadata.requestBody.email;
    if (log.message?.includes('@')) {
      const emailMatch = log.message.match(/\S+@\S+\.\S+/);
      return emailMatch ? emailMatch[0] : null;
    }
    return null;
  };

  const extractUserIdFromLog = (log: Log): string | null => {
    if (log.metadata?.userId) return log.metadata.userId;
    if (log.metadata?.adminUserId) return log.metadata.adminUserId;
    if (log.metadata?.userIdToUpdate) return log.metadata.userIdToUpdate;
    if (log.metadata?.userIdToDelete) return log.metadata.userIdToDelete;
    return null;
  };

  const getEventType = (context: string): string => {
    const eventMap: Record<string, string> = {
      'create-asaas-payment': 'Início do Pagamento',
      'user-management': 'Gerenciamento de Usuário',
      'product-validation': 'Validação de Produto',
      'coupon-application': 'Aplicação de Cupom',
      'order-creation': 'Criação de Pedido',
      'pix-payment': 'Pagamento PIX',
      'credit-card-payment': 'Pagamento Cartão',
      'asaas-webhook': 'Webhook Asaas',
      'admin-update-user': 'Atualização Admin',
      'admin-delete-user': 'Exclusão Admin',
      'reset-user-password': 'Redefinição Senha',
      'check-user-exists': 'Verificação Usuário',
      'create-customer': 'Criação Cliente'
    };
    
    return eventMap[context] || context;
  };

  const determineJourneyStatus = (journey: UserJourney): 'success' | 'error' | 'warning' | 'processing' => {
    const hasError = journey.logs.some(log => log.level === 'error');
    const hasSuccess = journey.logs.some(log => 
      log.context === 'asaas-webhook' && 
      log.message.includes('processed successfully')
    );
    
    if (hasError) return 'error';
    if (hasSuccess) return 'success';
    if (journey.logs.some(log => log.level === 'warning')) return 'warning';
    return 'processing';
  };

  const detectProblems = (journey: UserJourney): string[] => {
    const problems: string[] = [];
    const userIds = new Set<string>();
    const contexts = journey.logs.map(log => log.context);

    // Coletar todos os user IDs encontrados
    journey.logs.forEach(log => {
      const userId = extractUserIdFromLog(log);
      if (userId) userIds.add(userId);
    });

    // Problema: Múltiplos User IDs para o mesmo email
    if (userIds.size > 1) {
      problems.push('multiple-user-ids');
    }

    // Problema: Auth criado mas profile não
    const hasAuthCreation = journey.logs.some(log => 
      log.context.includes('user-management') && 
      log.message.includes('created successfully')
    );
    const hasProfileCreation = journey.logs.some(log => 
      log.context.includes('user-management') && 
      log.message.includes('profile')
    );
    
    if (hasAuthCreation && !hasProfileCreation) {
      problems.push('auth-without-profile');
    }

    // Problema: Duplicação detectada
    const hasDuplication = journey.logs.some(log => 
      log.message.includes('duplicate') || 
      log.message.includes('already exists')
    );
    if (hasDuplication) {
      problems.push('user-duplication');
    }

    // Problema: Falha no webhook
    const hasWebhookError = journey.logs.some(log => 
      log.context === 'asaas-webhook' && 
      log.level === 'error'
    );
    if (hasWebhookError) {
      problems.push('webhook-failure');
    }

    // Problema: Pagamento sem conclusão
    const hasPaymentStart = journey.logs.some(log => 
      log.context.includes('payment') && 
      !log.context.includes('webhook')
    );
    const hasPaymentCompletion = journey.logs.some(log => 
      log.context === 'asaas-webhook' && 
      log.message.includes('processed successfully')
    );
    if (hasPaymentStart && !hasPaymentCompletion) {
      problems.push('payment-incomplete');
    }

    return problems;
  };

  const problemSummaries: ProblemSummary[] = useMemo(() => {
    const problemsMap = new Map<string, ProblemSummary>();
    
    const problemDefinitions = {
      'multiple-user-ids': {
        description: 'Múltiplos User IDs para o mesmo email',
        icon: Users
      },
      'auth-without-profile': {
        description: 'Auth criado mas perfil não',
        icon: User
      },
      'user-duplication': {
        description: 'Duplicação de usuário detectada',
        icon: FileText
      },
      'webhook-failure': {
        description: 'Falha no webhook do Asaas',
        icon: AlertTriangle
      },
      'payment-incomplete': {
        description: 'Pagamento iniciado mas não concluído',
        icon: CreditCard
      }
    };

    userJourneys.forEach(journey => {
      journey.problemTypes.forEach(problemType => {
        if (!problemsMap.has(problemType)) {
          problemsMap.set(problemType, {
            type: problemType,
            description: problemDefinitions[problemType as keyof typeof problemDefinitions]?.description || problemType,
            count: 0,
            journeys: []
          });
        }
        const problem = problemsMap.get(problemType)!;
        problem.count++;
        problem.journeys.push(journey);
      });
    });

    return Array.from(problemsMap.values()).sort((a, b) => b.count - a.count);
  }, [userJourneys]);

  const getStatusBadge = (status: string) => {
    const variants = {
      success: { color: "bg-green-100 text-green-800", icon: CheckCircle },
      error: { color: "bg-red-100 text-red-800", icon: AlertCircle },
      warning: { color: "bg-yellow-100 text-yellow-800", icon: AlertCircle },
      processing: { color: "bg-blue-100 text-blue-800", icon: RefreshCw }
    };
    
    const variant = variants[status as keyof typeof variants] || variants.processing;
    const IconComponent = variant.icon;
    
    return (
      <Badge className={`${variant.color} flex items-center gap-1`}>
        <IconComponent className="h-3 w-3" />
        {status === 'success' ? 'Concluído' : 
         status === 'error' ? 'Erro' :
         status === 'warning' ? 'Atenção' : 'Processando'}
      </Badge>
    );
  };

  const getLevelBadge = (level: string) => {
    const colors = {
      error: "bg-red-100 text-red-800",
      warning: "bg-yellow-100 text-yellow-800",
      info: "bg-blue-100 text-blue-800"
    };
    
    return (
      <Badge className={colors[level as keyof typeof colors] || "bg-gray-100 text-gray-800"}>
        {level}
      </Badge>
    );
  };

  const getProblemBadge = (problemType: string) => {
    const colors = {
      'multiple-user-ids': "bg-purple-100 text-purple-800",
      'auth-without-profile': "bg-orange-100 text-orange-800",
      'user-duplication': "bg-pink-100 text-pink-800",
      'webhook-failure': "bg-red-100 text-red-800",
      'payment-incomplete': "bg-yellow-100 text-yellow-800"
    };
    
    const descriptions = {
      'multiple-user-ids': 'Múltiplos IDs',
      'auth-without-profile': 'Sem Perfil',
      'user-duplication': 'Duplicação',
      'webhook-failure': 'Webhook Falhou',
      'payment-incomplete': 'Pagamento Incompleto'
    };
    
    return (
      <Badge className={colors[problemType as keyof typeof colors] || "bg-gray-100 text-gray-800"}>
        {descriptions[problemType as keyof typeof descriptions] || problemType}
      </Badge>
    );
  };

  const filteredJourneys = userJourneys.filter(journey => {
    const emailMatch = journey.email.toLowerCase().includes(searchEmail.toLowerCase());
    const contextMatch = selectedContext === "all" || 
      journey.logs.some(log => log.context === selectedContext);
    const levelMatch = selectedLevel === "all" || 
      journey.logs.some(log => log.level === selectedLevel);
    const problemMatch = selectedProblems.length === 0 || 
      selectedProblems.some(problem => journey.problemTypes.includes(problem));
    
    return emailMatch && contextMatch && levelMatch && problemMatch;
  });

  useEffect(() => {
    fetchLogs();
  }, []);

  const contexts = [...new Set(logs.map(log => log.context))];
  const levels = [...new Set(logs.map(log => log.level))];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Logs do Sistema</h1>
          <p className="text-muted-foreground">
            Monitoramento da jornada dos usuários no checkout
          </p>
        </div>
        <Button 
          onClick={() => {
            setRefreshing(true);
            fetchLogs();
          }}
          disabled={refreshing}
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="journeys" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Jornadas dos Usuários
          </TabsTrigger>
          <TabsTrigger value="problems" className="flex items-center gap-2">
            <Bug className="h-4 w-4" />
            Análise de Problemas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="journeys" className="space-y-6">
          {/* Filtros */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtros Avançados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Buscar por E-mail</label>
                  <Input
                    placeholder="Digite o e-mail..."
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    className="w-full"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Contexto</label>
                  <Select value={selectedContext} onValueChange={setSelectedContext}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os contextos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os contextos</SelectItem>
                      {contexts.map(context => (
                        <SelectItem key={context} value={context}>
                          {getEventType(context)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nível</label>
                  <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os níveis" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os níveis</SelectItem>
                      {levels.map(level => (
                        <SelectItem key={level} value={level}>
                          {level.charAt(0).toUpperCase() + level.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      <SelectItem value="success">Concluído</SelectItem>
                      <SelectItem value="error">Erro</SelectItem>
                      <SelectItem value="warning">Atenção</SelectItem>
                      <SelectItem value="processing">Processando</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Filtros de Problemas */}
              <div className="space-y-3">
                <label className="text-sm font-medium">Filtrar por Problemas</label>
                <div className="flex flex-wrap gap-2">
                  {problemSummaries.map(problem => (
                    <div key={problem.type} className="flex items-center space-x-2">
                      <Checkbox
                        id={`problem-${problem.type}`}
                        checked={selectedProblems.includes(problem.type)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedProblems([...selectedProblems, problem.type]);
                          } else {
                            setSelectedProblems(selectedProblems.filter(p => p !== problem.type));
                          }
                        }}
                      />
                      <Label htmlFor={`problem-${problem.type}`} className="text-sm flex items-center gap-1 cursor-pointer">
                        {getProblemBadge(problem.type)}
                        <span className="text-xs text-muted-foreground">({problem.count})</span>
                      </Label>
                    </div>
                  ))}
                  {selectedProblems.length > 0 && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setSelectedProblems([])}
                      className="ml-2"
                    >
                      Limpar
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total de Jornadas</p>
                    <p className="text-2xl font-bold">{userJourneys.length}</p>
                  </div>
                  <User className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Concluídas</p>
                    <p className="text-2xl font-bold text-green-600">
                      {userJourneys.filter(j => j.status === 'success').length}
                    </p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Com Erros</p>
                    <p className="text-2xl font-bold text-red-600">
                      {userJourneys.filter(j => j.status === 'error').length}
                    </p>
                  </div>
                  <AlertCircle className="h-8 w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Com Problemas</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {userJourneys.filter(j => j.problemTypes.length > 0).length}
                    </p>
                  </div>
                  <Bug className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Lista de Jornadas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Jornadas dos Usuários ({filteredJourneys.length})
              </CardTitle>
              <CardDescription>
                Linha do tempo completa de cada usuário no processo de checkout
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin" />
                </div>
              ) : filteredJourneys.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma jornada encontrada com os filtros aplicados</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredJourneys.map((journey, index) => (
                    <Card key={index} className={`border-l-4 ${
                      journey.status === 'error' ? 'border-l-red-500' :
                      journey.status === 'warning' ? 'border-l-yellow-500' :
                      journey.status === 'success' ? 'border-l-green-500' : 'border-l-blue-500'
                    }`}>
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                              <User className="h-5 w-5" />
                              {journey.email}
                              {getStatusBadge(journey.status)}
                            </CardTitle>
                            <CardDescription className="flex items-center gap-2 mt-1">
                              <span>User ID: {journey.userId}</span>
                              <span>•</span>
                              <span>{journey.logs.length} eventos</span>
                              <span>•</span>
                              <span>
                                Última atualização: {format(new Date(journey.timeline[journey.timeline.length - 1]?.timestamp || new Date()), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </span>
                            </CardDescription>
                            {journey.problemTypes.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {journey.problemTypes.map(problemType => (
                                  <div key={problemType}>
                                    {getProblemBadge(problemType)}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {journey.timeline.map((event, eventIndex) => (
                            <div key={eventIndex} className="flex gap-4">
                              <div className="flex flex-col items-center">
                                <div className={`w-3 h-3 rounded-full ${
                                  event.level === 'error' ? 'bg-red-500' :
                                  event.level === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                                }`} />
                                {eventIndex < journey.timeline.length - 1 && (
                                  <div className={`w-0.5 h-8 ${
                                    event.level === 'error' ? 'bg-red-200' :
                                    event.level === 'warning' ? 'bg-yellow-200' : 'bg-blue-200'
                                  }`} />
                                )}
                              </div>
                              <div className="flex-1 pb-4">
                                <div className="flex justify-between items-start mb-1">
                                  <span className="font-medium">{event.event}</span>
                                  <div className="flex items-center gap-2">
                                    {getLevelBadge(event.level)}
                                    <span className="text-xs text-muted-foreground">
                                      {format(new Date(event.timestamp), "dd/MM HH:mm", { locale: ptBR })}
                                    </span>
                                  </div>
                                </div>
                                <p className="text-sm text-muted-foreground mb-2">{event.message}</p>
                                {event.metadata && Object.keys(event.metadata).length > 0 && (
                                  <details className="text-xs">
                                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                      Detalhes do evento
                                    </summary>
                                    <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
                                      {JSON.stringify(event.metadata, null, 2)}
                                    </pre>
                                  </details>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="problems" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bug className="h-5 w-5" />
                Análise de Problemas
              </CardTitle>
              <CardDescription>
                Resumo dos problemas mais comuns encontrados nas jornadas dos usuários
              </CardDescription>
            </CardHeader>
            <CardContent>
              {problemSummaries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum problema identificado nas jornadas atuais</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {problemSummaries.map((problem, index) => (
                    <Card key={index} className="border-l-4 border-l-orange-500">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                              {getProblemBadge(problem.type)}
                              <span className="text-base">{problem.description}</span>
                            </CardTitle>
                            <CardDescription>
                              {problem.count} jornada(s) afetada(s)
                            </CardDescription>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedProblems([problem.type]);
                              setActiveTab("journeys");
                            }}
                          >
                            Ver Jornadas
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {problem.journeys.slice(0, 5).map((journey, journeyIndex) => (
                            <div key={journeyIndex} className="flex justify-between items-center py-2 border-b last:border-b-0">
                              <div>
                                <p className="font-medium">{journey.email}</p>
                                <p className="text-sm text-muted-foreground">User ID: {journey.userId}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                {getStatusBadge(journey.status)}
                                <span className="text-xs text-muted-foreground">
                                  {journey.logs.length} eventos
                                </span>
                              </div>
                            </div>
                          ))}
                          {problem.journeys.length > 5 && (
                            <p className="text-sm text-muted-foreground text-center">
                              ... e mais {problem.journeys.length - 5} jornadas
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}