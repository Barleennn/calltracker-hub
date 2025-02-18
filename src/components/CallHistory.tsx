import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button"; 
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Search, ChevronDown, ChevronUp } from "lucide-react";

type CallHistoryEntry = {
  id: string;
  phone_number: string;
  name: string;
  status: "answered" | "no_answer" | "rejected";
  called_at: string;
}

type PhoneCallHistory = {
  id: string;
  status: "answered" | "no_answer" | "rejected";
  called_at: string;
  phone_numbers: {
    phone_number: string;
    name: string;
  };
}

export function CallHistory({ userId, drawer = false }: { userId: string; drawer?: boolean }): JSX.Element {
  const [history, setHistory] = useState<CallHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [hasNewEntries, setHasNewEntries] = useState(false);

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('phone_calls_history')
        .select(`
          id,
          status,
          called_at,
          phone_numbers (
            phone_number,
            name
          )
        `)
        .eq('operator_id', userId)
        .order('called_at', { ascending: false });

      if (error) throw error;

      const formattedData = (data as unknown as PhoneCallHistory[])?.map(entry => ({
        id: entry.id,
        phone_number: entry.phone_numbers.phone_number,
        name: entry.phone_numbers.name,
        status: entry.status,
        called_at: entry.called_at
      })) || [];

      setHistory(formattedData);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  // Subscribe to realtime changes
  useEffect(() => {
    if (!isOpen && !drawer) return;

    const channel = supabase
      .channel('call_history_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'phone_calls_history',
          filter: `operator_id=eq.${userId}`
        },
        async () => {
          await fetchHistory();
        }
      )
      .subscribe();

    // Initial fetch
    fetchHistory();

    return () => {
      channel.unsubscribe();
    };
  }, [userId, isOpen, drawer]);

  // Reset new entries indicator when opening
  useEffect(() => {
    if (isOpen || drawer) {
      setHasNewEntries(false);
    }
  }, [isOpen, drawer]);

  const filteredHistory = history.filter(entry => 
    entry.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.phone_number.includes(searchQuery)
  );

  const getStatusEmoji = (status: string) => {
    switch (status) {
      case 'answered': return '✅';
      case 'no_answer': return '❌';
      case 'rejected': return '⛔';
      default: return '❓';
    }
  };

  return (
    <div className="h-full">
      <Card className="p-4 h-full">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg relative">
              История звонков
              {hasNewEntries && (
                <span className="absolute -top-1 -right-4 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              )}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(!isOpen)}
              className="lg:hidden" // Only show on mobile
            >
              {isOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Content - Always visible on desktop, toggleable on mobile */}
          <div className={`flex-1 ${isOpen || 'hidden lg:block'}`}>
            <div className="relative mb-4">
              <Input
                type="text"
                placeholder="Поиск по имени или номеру..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            </div>
            {loading ? (
              <div className="text-center p-4">Загрузка истории...</div>
            ) : (
              <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 250px)' }}>
                {filteredHistory.length > 0 ? (
                  filteredHistory.map((entry) => (
                    <div 
                      key={entry.id} 
                      className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{entry.name}</div>
                        <div className="text-sm text-gray-500">{entry.phone_number}</div>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <span>{getStatusEmoji(entry.status)}</span>
                        <span className="text-sm text-gray-500 hidden sm:inline">
                          {format(new Date(entry.called_at), 'dd.MM.yyyy HH:mm')}
                        </span>
                        <span className="text-sm text-gray-500 sm:hidden">
                          {format(new Date(entry.called_at), 'HH:mm')}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-500">
                    {searchQuery ? "Ничего не найдено" : "История звонков пуста"}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
