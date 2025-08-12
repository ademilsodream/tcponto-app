import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bug, Download, Trash2, RefreshCw } from 'lucide-react';
import { getDebugLogs, clearDebugLogs, exportDebugLogs } from '@/utils/debugLogger';

const DebugPanel: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadLogs = () => {
    const entries = getDebugLogs();
    setLogs(entries.map(e => JSON.stringify(e)));
  };

  const clearLogs = () => {
    clearDebugLogs();
    setLogs([]);
  };

  const exportLogs = () => {
    const logData = exportDebugLogs();
    // Criar blob e download
    const blob = new Blob([logData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tcponto-debug-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const refreshLogs = () => {
    setIsLoading(true);
    loadLogs();
    setTimeout(() => setIsLoading(false), 500);
  };

  useEffect(() => {
    const shouldShow = process.env.NODE_ENV === 'development' || 
                      localStorage.getItem('tcponto_show_debug') === 'true';
    setIsVisible(shouldShow);
    if (shouldShow) {
      loadLogs();
      const interval = setInterval(loadLogs, 5000);
      return () => clearInterval(interval);
    }
  }, []);

  if (!isVisible) return null;

  const errorCount = logs.filter(log => {
    try { const parsed = JSON.parse(log); return parsed.level === 'ERROR'; } catch { return false; }
  }).length;

  const warningCount = logs.filter(log => {
    try { const parsed = JSON.parse(log); return parsed.level === 'WARN'; } catch { return false; }
  }).length;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Card className="w-96 max-h-96 shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Bug className="w-4 h-4" />
              Debug Panel
              {errorCount > 0 && (
                <Badge variant="destructive" className="text-xs">{errorCount} errors</Badge>
              )}
              {warningCount > 0 && (
                <Badge variant="secondary" className="text-xs">{warningCount} warnings</Badge>
              )}
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={refreshLogs} disabled={isLoading}>
                <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              <Button size="sm" variant="ghost" onClick={exportLogs}>
                <Download className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="ghost" onClick={clearLogs}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ScrollArea className="h-64">
            <div className="space-y-1">
              {logs.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Nenhum log disponível</p>
              ) : (
                logs.slice(-20).reverse().map((log, index) => {
                  try {
                    const parsed = JSON.parse(log);
                    return (
                      <div key={index} className={`text-xs p-2 rounded border-l-2 ${
                        parsed.level === 'ERROR' ? 'bg-red-50 border-red-500 text-red-700' :
                        parsed.level === 'WARN' ? 'bg-yellow-50 border-yellow-500 text-yellow-700' :
                        'bg-gray-50 border-gray-300 text-gray-700'
                      }`}>
                        <div className="flex justify-between items-start">
                          <span className="font-mono text-xs">{new Date(parsed.timestamp).toLocaleTimeString()}</span>
                          <Badge variant={parsed.level === 'ERROR' ? 'destructive' : 'secondary'} className="text-xs">
                            {parsed.level}
                          </Badge>
                        </div>
                        <div className="mt-1 font-medium">{parsed.message}</div>
                        {parsed.data && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-xs">Detalhes</summary>
                            <pre className="text-xs mt-1 whitespace-pre-wrap">{JSON.stringify(parsed.data, null, 2)}</pre>
                          </details>
                        )}
                      </div>
                    );
                  } catch {
                    return <div key={index} className="text-xs p-2 bg-gray-50 rounded">{log}</div>;
                  }
                })
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default DebugPanel;
