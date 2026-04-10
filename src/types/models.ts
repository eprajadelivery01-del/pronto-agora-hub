export type DeliveryStatus = "pending" | "broadcasted" | "accepted" | "collecting" | "in_route" | "completed" | "cancelled";

export type OccurrenceType = "motorcycle_issue" | "accident" | "robbery";

export type UserRole = "admin" | "company" | "driver" | "customer";

export interface Region {
  id: string;
  name: string;
  color: string;
  price: number;
}

export interface Company {
  id: string;
  name: string;
  phone: string;
  address: string;
  region_id: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface DeliveryDriver {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  is_online: boolean;
  rating: number;
}

export interface Customer {
  id: string;
  name: string;
  cpf: string;
  phone: string;
}

export interface Delivery {
  id: string;
  company_id: string;
  company_name: string;
  driver_id: string | null;
  driver_name: string | null;
  customer_name: string;
  address: string;
  region_id: string;
  region_name: string;
  status: DeliveryStatus;
  value: number;
  commission: number;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  customer_id: string;
  company_id: string;
  items: OrderItem[];
  total: number;
  delivery_id?: string;
  status: "pending" | "preparing" | "ready" | "delivered" | "cancelled";
  created_at: string;
}

export interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
}

export interface Review {
  id: string;
  delivery_id: string;
  driver_id: string;
  rating: number;
  comment?: string;
  created_at: string;
}

export interface Occurrence {
  id: string;
  driver_id: string;
  driver_name: string;
  type: OccurrenceType;
  description: string;
  delivery_id: string | null;
  created_at: string;
  status: "open" | "resolved";
}
