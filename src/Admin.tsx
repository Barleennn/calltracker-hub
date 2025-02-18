
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload } from "lucide-react";

type PhoneNumber = {
  id: string;
  phone_number: string;
  status: "answered" | "no_answer" | "rejected" | null;
  called_at: string | null;
};

const Admin = () => {
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [newNumber, setNewNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAdmin();
    fetchPhoneNumbers();
  }, []);

  const checkAdmin = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    // First check if profile exists
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", session.user.id)
      .maybeSingle();

    // If no profile exists, create one
    if (!profile) {
      const { error: createError } = await supabase
        .from("profiles")
        .insert([{ id: session.user.id, is_admin: false }]);

      if (createError) {
        console.error("Error creating profile:", createError);
        navigate("/dashboard");
        return;
      }
    }

    // Check if user is admin
    if (!profile?.is_admin) {
      navigate("/dashboard");
      return;
    }

    setIsAdmin(true);
  };

  const fetchPhoneNumbers = async () => {
    try {
      const { data, error } = await supabase
        .from("phone_numbers")
        .select("*")
        .order("created_at");

      if (error) throw error;
      setPhoneNumbers(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVcfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    
    const file = event.target.files[0];
    if (!file.name.toLowerCase().endsWith('.vcf')) {
      toast({
        title: "Error",
        description: "Please upload a .vcf file",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      // Create a sanitized filename using only ASCII characters
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^\x00-\x7F]/g, '').replace(/\s+/g, '_');
      const fileName = `${timestamp}-${sanitizedName}`;

      // Upload file to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('vcf_files')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Read the file content
      const text = await file.text();
      
      // Extract phone numbers using regex
      const phoneRegex = /TEL[^:]*:([\+\d\s-]+)/g;
      const phones = new Set<string>();
      let match;

      while ((match = phoneRegex.exec(text)) !== null) {
        // Clean up phone number - remove spaces, dashes, and other characters
        const cleanNumber = match[1].replace(/[\s-()]/g, '');
        phones.add(cleanNumber);
      }

      // Insert phone numbers into database
      if (phones.size > 0) {
        const phonesToInsert = Array.from(phones).map(phone => ({
          phone_number: phone
        }));

        const { error: insertError } = await supabase
          .from('phone_numbers')
          .insert(phonesToInsert);

        if (insertError) throw insertError;

        toast({
          description: `Successfully imported ${phones.size} phone numbers`,
        });

        fetchPhoneNumbers();
      } else {
        toast({
          title: "Warning",
          description: "No phone numbers found in the VCF file",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const addPhoneNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNumber.trim()) return;

    try {
      const { error } = await supabase
        .from("phone_numbers")
        .insert([{ phone_number: newNumber.trim() }]);

      if (error) throw error;

      toast({
        description: "Phone number added successfully",
      });
      
      setNewNumber("");
      fetchPhoneNumbers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deletePhoneNumber = async (id: string) => {
    try {
      const { error } = await supabase
        .from("phone_numbers")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setPhoneNumbers(phoneNumbers.filter(phone => phone.id !== id));
      toast({
        description: "Phone number deleted successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading || !isAdmin) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            Go to Operator Dashboard
          </Button>
        </div>

        <div className="grid gap-6">
          <Card className="p-4">
            <h2 className="text-lg font-semibold mb-4">Import Contacts</h2>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept=".vcf"
                onChange={handleVcfUpload}
                disabled={uploading}
                className="flex-1"
              />
              {uploading && <div className="text-sm text-gray-500">Uploading...</div>}
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-lg font-semibold mb-4">Add Single Number</h2>
            <form onSubmit={addPhoneNumber} className="flex gap-2">
              <Input
                type="tel"
                placeholder="Add new phone number"
                value={newNumber}
                onChange={(e) => setNewNumber(e.target.value)}
                className="flex-1"
              />
              <Button type="submit">Add Number</Button>
            </form>
          </Card>

          <div className="grid gap-4">
            {phoneNumbers.map((phone) => (
              <Card key={phone.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{phone.phone_number}</p>
                    <p className="text-sm text-gray-500">
                      Status: {phone.status || "Not called"}
                      {phone.called_at && ` (Called: ${new Date(phone.called_at).toLocaleString()})`}
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={() => deletePhoneNumber(phone.id)}
                  >
                    Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Admin;
