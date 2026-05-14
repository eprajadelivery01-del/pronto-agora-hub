import { useMemo } from "react";
import type { DeliveryWithRelations } from "@/services/deliveries";

/**
 * useUniqueDeliveries
 * Hook especializado para evitar a exibição de entregas duplicadas na interface.
 * Garante que cada ID de entrega seja processado apenas uma vez e aplica uma
 * regra de "fuzzy match" para ignorar duplicatas acidentais (mesmo cliente/valor/empresa no mesmo segundo).
 */
export function useUniqueDeliveries(deliveries: DeliveryWithRelations[] | undefined) {
  return useMemo(() => {
    if (!deliveries || deliveries.length === 0) return [];

    const seenIds = new Set<string>();
    const fuzzyKeys = new Set<string>();
    
    return deliveries.filter((delivery) => {
      // 1. Verificação Primária: ID Único
      if (!delivery.id || seenIds.has(delivery.id)) {
        return false;
      }
      seenIds.add(delivery.id);

      // 2. Verificação Secundária (Heurística): Evita "Double Inserts" no banco/realtime
      // Se houver outra entrega para o mesmo cliente, da mesma empresa, com o mesmo valor 
      // criada no exato mesmo segundo, provavelmente é uma duplicata sistêmica.
      const createdAt = new Date(delivery.created_at).getTime();
      const secondPrecision = Math.floor(createdAt / 1000);
      
      const fuzzyKey = [
        delivery.company_id,
        delivery.customer_name,
        delivery.value || delivery.price || 0,
        secondPrecision
      ].join('|');

      if (fuzzyKeys.has(fuzzyKey)) {
        console.warn(`[Anti-Duplicidade] Entrega duplicada detectada e ocultada: ${delivery.id}`);
        return false;
      }

      fuzzyKeys.add(fuzzyKey);
      return true;
    });
  }, [deliveries]);
}
