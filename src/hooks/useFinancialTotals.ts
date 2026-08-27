import { useMemo } from "react";
import { getDeliveryValue } from "@/lib/delivery";
import type { DeliveryWithRelations } from "@/services/deliveries";

export function useFinancialTotals(validDeliveries: DeliveryWithRelations[], drivers: any[]) {
  return useMemo(() => {
    let totalValue = 0;
    let totalCommission = 0;
    
    const enrichedDeliveries = validDeliveries.map(d => {
      const value = getDeliveryValue(d);
      totalValue += value;
      
      let commission = 0;
      if (d.driver_id) {
        const driver = drivers?.find(dr => dr.id === d.driver_id);
        const rate = (driver?.commission_rate !== undefined && driver?.commission_rate !== null)
          ? Number(driver.commission_rate) 
          : 0.40; // Default taxa por corrida: R$ 0,40
        
        // A comissão do entregador cobrada pela plataforma é um valor fixo em Reais por entrega (ex: R$ 0,40 por corrida).
        if (rate <= 1 && rate > 0) {
          commission = rate; // R$ 0,40 por corrida
        } else if (rate > 1 && rate <= 100) {
          commission = rate > 5 ? (value * (rate / 100)) : rate;
        } else {
          commission = rate;
        }
      } else {
        commission = 0.40; // Taxa padrão por corrida
      }
      totalCommission += commission;
      
      return {
        ...d,
        calculatedValue: value,
        calculatedCommission: commission
      };
    });

    return {
      totalValue,
      totalCommission,
      completedCount: enrichedDeliveries.length,
      enrichedDeliveries
    };
  }, [validDeliveries, drivers]);
}

