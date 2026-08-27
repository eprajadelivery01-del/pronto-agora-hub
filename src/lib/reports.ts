import { getDeliveryValue } from "./delivery";
import type { DeliveryWithRelations } from "../services/deliveries";

export interface ReportFilters {
  regionFilter?: string;
  paymentFilter?: string;
  minVal?: string;
  maxVal?: string;
  statusFilter?: string;
}

export function filterDeliveriesByLocalParams(rawDeliveries: DeliveryWithRelations[], filters: ReportFilters) {
  const { regionFilter, paymentFilter, minVal, maxVal, statusFilter } = filters;
  
  return rawDeliveries.filter((d) => {
    if (regionFilter && d.region_id !== regionFilter) return false;
    if (paymentFilter && d.payment_method !== paymentFilter) return false;
    if (minVal && getDeliveryValue(d) < Number(minVal)) return false;
    if (maxVal && getDeliveryValue(d) > Number(maxVal)) return false;
    // "Finalizadas" deve incluir tanto 'delivered' quanto 'completed'
    if (statusFilter === "delivered" && !(d.status === "delivered" || (d.status as string) === "completed")) return false;
    return true;
  });
}

export function getValidDeliveries(deliveries: DeliveryWithRelations[]) {
  return deliveries.filter(d => d.status === "delivered" || (d.status as string) === "completed");
}

export function calculateReportsTotals(validDeliveries: DeliveryWithRelations[], drivers?: any[]) {
  const totalValue = validDeliveries.reduce((s, d) => s + getDeliveryValue(d), 0);
  const totalCommission = validDeliveries.reduce((s, d) => {
    if (d.commission !== undefined && d.commission !== null) {
      return s + Number(d.commission);
    }
    let rate = 0.40;
    if (d.driver_id && drivers) {
      const driver = drivers.find(dr => dr.id === d.driver_id);
      if (driver?.commission_rate !== undefined && driver?.commission_rate !== null) {
        rate = Number(driver.commission_rate);
      }
    }
    const commission = (rate <= 1 && rate > 0) ? rate : (rate > 5 ? (getDeliveryValue(d) * (rate / 100)) : rate);
    return s + commission;
  }, 0);
  return { totalValue, totalCommission, completedCount: validDeliveries.length };
}
