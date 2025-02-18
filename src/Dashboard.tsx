import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Phone, LogOut } from "lucide-react";
import type { PhoneNumber } from "@/integrations/supabase/types";
import { CallHistory } from "@/components/CallHistory";
import { DrawerCallHistory } from "@/components/DrawerCallHistory";

const Dashboard = () => {
  const [currentNumber, setCurrentNumber] = useState<PhoneNumber | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate("/auth");
          return;
        }

        setUserId(session.user.id);

        // Get profile and check admin status
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', session.user.id)
          .single();

        setIsAdmin(profile?.is_admin || false);

        // Subscribe to realtime updates for phone numbers
        const subscription = supabase
          .channel('phone_numbers_channel')
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'phone_numbers'
          }, (payload) => {
            handleRealtimeUpdate(payload);
          })
          .subscribe();

        // Get first available number
        await fetchNextNumber();

        setLoading(false);
        
        return () => {
          subscription.unsubscribe();
        };
      } catch (error: any) {
        console.error('Dashboard initialization error:', error);
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    };

    initializeDashboard();
  }, [navigate]);

  const handleRealtimeUpdate = (payload: any) => {
    // Refresh current number if changes affect it
    if (payload.new && currentNumber?.id === payload.new.id) {
      fetchNextNumber();
    }
  };

  const fetchNextNumber = async () => {
    try {
      let query = supabase
        .from("phone_numbers")
        .select("*")
        .is('status', null); // First get numbers with null status

      if (userId) {
        // Then filter for unassigned OR assigned to current user
        query = query.or(`assigned_to.is.null,assigned_to.eq.${userId}`);
      } else {
        // If no userId, only get unassigned numbers
        query = query.is('assigned_to', null);
      }

      const { data, error } = await query.limit(1);

      if (error) throw error;

      // If we got a number, assign it to current user
      if (data && data.length > 0) {
        const selectedNumber = data[0];

        if (userId) {
          // Assign the number to current operator
          const { error: updateError } = await supabase
            .from("phone_numbers")
            .update({ assigned_to: userId })
            .eq("id", selectedNumber.id);

          if (updateError) throw updateError;
        }

        setCurrentNumber(selectedNumber);
      } else {
        setCurrentNumber(null);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCall = (phoneNumber: string) => {
    window.location.href = `tel:${phoneNumber}`;
  };

  const updateStatus = async (status: PhoneNumber["status"]) => {
    if (!currentNumber || !userId) return;

    try {
      // Update phone number status
      const { error: updateError } = await supabase
        .from("phone_numbers")
        .update({ 
          status,
          called_at: new Date().toISOString(),
          assigned_to: null // Release the number
        })
        .eq("id", currentNumber.id);

      if (updateError) throw updateError;

      // Add to call history
      const { error: historyError } = await supabase
        .from("phone_calls_history")
        .insert({
          phone_number_id: currentNumber.id,
          operator_id: userId,
          status,
          called_at: new Date().toISOString()
        });

      if (historyError) throw historyError;

      toast({
        description: "Call status updated successfully",
      });

      // Get next number
      fetchNextNumber();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-lg mb-2">Загрузка...</div>
          <div className="text-sm text-gray-500">Пожалуйста, подождите</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Панель звонков</h1>
          <div className="flex items-center gap-2">
            <DrawerCallHistory userId={userId} />
            {isAdmin && (
              <Button variant="outline" onClick={() => navigate("/admin")}>
                Админ панель
              </Button>
            )}
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Выйти
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Call Panel */}
          <div className="w-full lg:w-2/3">
            {currentNumber ? (
              <Card className="p-6 shadow-lg h-full">
                <div className="flex flex-col gap-6">
                  {/* Информация о номере */}
                  <div className="flex items-center gap-3 border-b pb-4">
                    <div className="bg-blue-100 p-3 rounded-full">
                      <Phone className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <span className="font-medium text-xl block">{currentNumber.name}</span>
                      <span className="text-gray-500 text-lg">{currentNumber.phone_number}</span>
                    </div>
                  </div>
                  
                  {/* Кнопки действий - Mobile first */}
                  <div className="flex flex-col sm:grid sm:grid-cols-2 gap-4">
                    <div className="order-2 sm:order-1 grid grid-cols-3 gap-2">
                      <Button
                        variant="outline"
                        className="border-2 hover:bg-green-50"
                        onClick={() => updateStatus("answered")}
                      >
                        ✅ Ответил
                      </Button>
                      <Button
                        variant="outline"
                        className="border-2 hover:bg-red-50"
                        onClick={() => updateStatus("no_answer")}
                      >
                        ❌ Не ответил
                      </Button>
                      <Button
                        variant="outline"
                        className="border-2 hover:bg-red-50"
                        onClick={() => updateStatus("rejected")}
                      >
                        ❌ Отказ
                      </Button>
                    </div>
                    <Button 
                      variant="default"
                      size="lg"
                      className="order-1 sm:order-2 bg-blue-600 hover:bg-blue-700"
                      onClick={() => handleCall(currentNumber.phone_number)}
                    >
                      Позвонить
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="p-6 text-center h-full">
                <h2 className="text-lg font-semibold mb-2">Нет доступных номеров</h2>
                <p className="text-gray-500">В данный момент нет номеров для обзвона</p>
              </Card>
            )}
          </div>

          {/* Desktop History Panel */}
          {userId && (
            <div className="hidden lg:block w-full lg:w-1/3">
              <CallHistory userId={userId} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
