import { useMemo } from "react";
import type { DeliveryWithRelations } from "@/services/deliveries";

/**
 * useUniqueDeliveries
 * Hook especializado para evitar a exibição de entregas duplicadas na interface.
 * Mantém apenas a verificação por ID único para evitar race conditions.
 */
export function useUniqueDeliveries(deliveries: DeliveryWithRelations[] | undefined) {
  return useMemo(() => {
    if (!deliveries || deliveries.length === 0) return [];

    const seenIds = new Set<string>();
    
    return deliveries.filter((delivery) => {
      // Verificação por ID Único
      if (!delivery.id || seenIds.has(delivery.id)) {
        return false;
      }
      seenIds.add(delivery.id);
      return true;
    });
  }, [deliveries]);
}
