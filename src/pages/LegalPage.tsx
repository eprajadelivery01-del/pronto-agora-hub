import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

export default function LegalPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isPrivacy = location.pathname.includes("privacy");

  return (
    <div className="min-h-screen bg-background p-6 md:p-12 text-foreground">
      <div className="max-w-3xl mx-auto space-y-8">
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)} 
          className="gap-2 mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        
        <h1 className="text-3xl font-black tracking-tighter uppercase">
          {isPrivacy ? "Política de Privacidade" : "Termos de Uso"}
        </h1>
        
        <div className="prose prose-sm prose-invert max-w-none text-muted-foreground space-y-6">
          <section>
            <h2 className="text-xl font-bold text-foreground">1. Introdução</h2>
            <p>
              O É Pra Já valoriza sua privacidade e a transparência no uso de dados. 
              Este documento descreve como tratamos as informações dos lojistas parceiros.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">2. Coleta de Dados</h2>
            <p>
              Coletamos dados necessários para a operação do seu estabelecimento no marketplace, 
              incluindo nome, email, telefone e dados da empresa.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">3. Uso da Plataforma</h2>
            <p>
              O uso deste painel é restrito a parceiros autorizados e deve seguir as diretrizes 
              operacionais do ecossistema É Pra Já.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">4. Exclusão de Conta</h2>
            <p>
              Em conformidade com as diretrizes da App Store, você pode solicitar a exclusão 
              permanente de sua conta e dados associados através das configurações de perfil.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
