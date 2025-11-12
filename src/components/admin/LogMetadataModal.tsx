import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Copy, CheckCircle, AlertTriangle, XCircle, Info } from "lucide-react";
import type { Log } from "@/pages/admin/Logs";

interface LogMetadataModalProps {
  log: Log | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LogMetadataModal({ log, open, onOpenChange }: LogMetadataModalProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    if (log?.metadata) {
      navigator.clipboard.writeText(JSON.stringify(log.metadata, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!log) return null;

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'info':
        return <Info className="h-5 w-5 text-blue-500" />;
      default:
        return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getLevelIcon(log.level)}
            Detalhes do Log - {log.context}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Mensagem</Label>
            <p className="text-sm text-muted-foreground mt-1">{log.message}</p>
          </div>
          
          <div>
            <Label className="text-sm font-medium">Timestamp</Label>
            <p className="text-sm text-muted-foreground mt-1">
              {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
            </p>
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-2">
              <Label className="text-sm font-medium">Metadados</Label>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={copyToClipboard}
                className="h-7 px-2"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Copiado!' : 'Copiar'}
              </Button>
            </div>
            <pre className="p-3 bg-muted rounded-lg text-xs overflow-x-auto">
              {JSON.stringify(log.metadata, null, 2)}
            </pre>
          </div>
        </div>
        
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}